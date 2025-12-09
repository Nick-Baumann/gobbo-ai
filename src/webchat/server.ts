import { randomUUID } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type WebSocket, WebSocketServer } from "ws";
import { loadConfig } from "../config/config.js";
import {
  loadSessionStore,
  resolveStorePath,
  type SessionEntry,
} from "../config/sessions.js";
import { GatewayClient } from "../gateway/client.js";
import { logDebug, logError } from "../logger.js";

const WEBCHAT_DEFAULT_PORT = 18788;

type WebChatServerState = {
  server: http.Server;
  port: number;
};

type ChatMessage = { role: string; content: string };
type RpcPayload = { role: string; content: string };

let state: WebChatServerState | null = null;
let wss: WebSocketServer | null = null;
const wsSessions: Map<string, Set<WebSocket>> = new Map();
let gateway: GatewayClient | null = null;
let gatewayReady = false;
let latestSnapshot: Record<string, unknown> | null = null;
let latestPolicy: Record<string, unknown> | null = null;

function resolveWebRoot() {
  const here = path.dirname(fileURLToPath(import.meta.url));

  const candidates = [
    // Bundled inside Clawdis.app: .../Contents/Resources/WebChat
    path.resolve(here, "../../../WebChat"),
    // When running from repo without bundling
    path.resolve(here, "../../WebChat"),
    // Fallback to source tree location
    path.resolve(here, "../../apps/macos/Sources/Clawdis/Resources/WebChat"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error(`webchat assets not found; tried: ${candidates.join(", ")}`);
}

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req
      .on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
      .on("end", () => resolve(Buffer.concat(chunks)))
      .on("error", reject);
  });
}

function pickSessionId(
  sessionKey: string,
  store: Record<string, SessionEntry>,
): string | null {
  if (store[sessionKey]?.sessionId) return store[sessionKey].sessionId;
  const first = Object.values(store)[0]?.sessionId;
  return first ?? null;
}

function readSessionMessages(
  sessionId: string,
  storePath: string,
): ChatMessage[] {
  const dir = path.dirname(storePath);
  const candidates = [
    path.join(dir, `${sessionId}.jsonl`),
    path.join(
      os.homedir(),
      ".tau/agent/sessions/clawdis",
      `${sessionId}.jsonl`,
    ),
  ];
  let content: string | null = null;
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        content = fs.readFileSync(p, "utf-8");
        break;
      } catch {
        // continue
      }
    }
  }
  if (!content) return [];

  const messages: ChatMessage[] = [];
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      const msg = obj.message ?? obj;
      if (!msg?.role || !msg?.content) continue;
      messages.push({ role: msg.role, content: msg.content });
    } catch (err) {
      logDebug(`webchat history parse error: ${String(err)}`);
    }
  }
  return messages;
}

function broadcastSession(sessionKey: string, payload: unknown) {
  const conns = wsSessions.get(sessionKey);
  if (!conns || conns.size === 0) return;
  const msg = JSON.stringify(payload);
  for (const ws of conns) {
    try {
      ws.send(msg);
    } catch {
      // ignore and let close handler prune
    }
  }
}

function broadcastAll(payload: unknown) {
  const msg = JSON.stringify(payload);
  for (const [, conns] of wsSessions) {
    for (const ws of conns) {
      try {
        ws.send(msg);
      } catch {
        // ignore
      }
    }
  }
}

async function handleRpc(
  body: unknown,
): Promise<{ ok: boolean; payloads?: RpcPayload[]; error?: string }> {
  const payload = body as {
    text?: unknown;
    thinking?: unknown;
    deliver?: unknown;
    to?: unknown;
    timeout?: unknown;
  };

  const text: string = (payload.text ?? "").toString();
  if (!text.trim()) return { ok: false, error: "empty text" };
  if (!gateway || !gatewayReady) {
    return { ok: false, error: "gateway unavailable" };
  }

  const thinking =
    typeof payload.thinking === "string" ? payload.thinking : undefined;
  const to = typeof payload.to === "string" ? payload.to : undefined;
  const deliver = Boolean(payload.deliver);
  const timeout =
    typeof payload.timeout === "number" ? payload.timeout : undefined;

  const idempotencyKey = randomUUID();
  try {
    // Send agent request; wait for final res (status ok/error)
    const res = (await gateway.request(
      "agent",
      {
        message: text,
        thinking,
        deliver,
        to,
        timeout,
        idempotencyKey,
      },
      { expectFinal: true },
    )) as { status?: string; summary?: string };
    if (res?.status && res.status !== "ok") {
      return { ok: false, error: res.summary || res.status };
    }
    // The actual agent output is delivered via events; HTTP just returns ack.
    return { ok: true, payloads: [] };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function notFound(res: http.ServerResponse) {
  res.statusCode = 404;
  res.end("Not Found");
}

export async function startWebChatServer(
  port = WEBCHAT_DEFAULT_PORT,
  gatewayOverrideUrl?: string,
  opts?: { disableGateway?: boolean },
) {
  if (state) return state;

  const root = resolveWebRoot();
  // Precompute session store root for file watching
  const cfg = loadConfig();
  const sessionCfg = cfg.inbound?.reply?.session;
  const storePath = sessionCfg?.store
    ? resolveStorePath(sessionCfg.store)
    : resolveStorePath(undefined);
  const storeDir = path.dirname(storePath);

  const server = http.createServer(async (req, res) => {
    if (!req.url) return notFound(res);
    if (
      req.socket.remoteAddress &&
      !req.socket.remoteAddress.startsWith("127.")
    ) {
      res.statusCode = 403;
      res.end("loopback only");
      return;
    }

    const url = new URL(req.url, "http://127.0.0.1");
    const isInfo = url.pathname === "/webchat/info" || url.pathname === "/info";
    const isRpc = url.pathname === "/webchat/rpc" || url.pathname === "/rpc";

    if (isInfo) {
      const sessionKey = url.searchParams.get("session") ?? "main";
      const store = loadSessionStore(storePath);
      const sessionId = pickSessionId(sessionKey, store);
      const messages = sessionId
        ? readSessionMessages(sessionId, storePath)
        : [];
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          port,
          sessionKey,
          storePath,
          sessionId,
          initialMessages: messages,
          basePath: "/",
          gatewayConnected: gatewayReady,
          gatewaySnapshot: latestSnapshot,
          gatewayPolicy: latestPolicy,
        }),
      );
      return;
    }

    if (isRpc && req.method === "POST") {
      const bodyBuf = await readBody(req);
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(bodyBuf.toString("utf-8"));
      } catch {
        // ignore
      }
      const result = await handleRpc(body);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
      return;
    }

    if (url.pathname.startsWith("/webchat")) {
      let rel = url.pathname.replace(/^\/webchat\/?/, "");
      if (!rel || rel.endsWith("/")) rel = `${rel}index.html`;
      const filePath = path.join(root, rel);
      if (!filePath.startsWith(root)) return notFound(res);
      if (!fs.existsSync(filePath)) return notFound(res);
      const data = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const type =
        ext === ".html"
          ? "text/html"
          : ext === ".js"
            ? "application/javascript"
            : ext === ".css"
              ? "text/css"
              : "application/octet-stream";
      res.setHeader("Content-Type", type);
      res.end(data);
      return;
    }

    if (url.pathname === "/") {
      const filePath = path.join(root, "index.html");
      const data = fs.readFileSync(filePath);
      res.setHeader("Content-Type", "text/html");
      res.end(data);
      return;
    }

    const relPath = url.pathname.replace(/^\//, "");
    if (relPath) {
      const filePath = path.join(root, relPath);
      if (filePath.startsWith(root) && fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath);
        res.setHeader("Content-Type", "application/octet-stream");
        res.end(data);
        return;
      }
    }

    notFound(res);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  }).catch((err) => {
    const code = (err as NodeJS.ErrnoException).code;
    const msg = code ? `${code}: ${String(err)}` : String(err);
    logError(
      `webchat server failed to bind 127.0.0.1:${port} (${msg}); continuing without webchat`,
    );
  });

  // Gateway connection (control/data plane)
  const cfgObj = loadConfig() as Record<string, unknown>;
  if (!opts?.disableGateway) {
    const cfgGatewayPort =
      (cfgObj.webchat as { gatewayPort?: number } | undefined)?.gatewayPort ??
      18789;
    const gatewayUrl = gatewayOverrideUrl ?? `ws://127.0.0.1:${cfgGatewayPort}`;
    const gatewayToken =
      process.env.CLAWDIS_GATEWAY_TOKEN ??
      (cfgObj.gateway as { token?: string } | undefined)?.token;
    gateway = new GatewayClient({
      url: gatewayUrl,
      token: gatewayToken,
      clientName: "webchat-backend",
      clientVersion:
        process.env.CLAWDIS_VERSION ?? process.env.npm_package_version ?? "dev",
      platform: process.platform,
      mode: "webchat",
      instanceId: `webchat-${os.hostname()}`,
      onHelloOk: (hello) => {
        gatewayReady = true;
        latestSnapshot = hello.snapshot as Record<string, unknown>;
        latestPolicy = hello.policy as Record<string, unknown>;
        broadcastAll({
          type: "gateway-snapshot",
          snapshot: hello.snapshot,
          policy: hello.policy,
        });
      },
      onEvent: (evt) => {
        broadcastAll({
          type: "gateway-event",
          event: evt.event,
          payload: evt.payload,
          seq: evt.seq,
          stateVersion: evt.stateVersion,
        });
      },
      onClose: () => {
        gatewayReady = false;
      },
      onGap: async () => {
        if (!gatewayReady || !gateway) return;
        try {
          const [health, presence] = await Promise.all([
            gateway.request("health"),
            gateway.request("system-presence"),
          ]);
          latestSnapshot = {
            ...latestSnapshot,
            health,
            presence,
          } as Record<string, unknown>;
          broadcastAll({ type: "gateway-refresh", health, presence });
        } catch (err) {
          logError(`webchat gap refresh failed: ${String(err)}`);
        }
      },
    });
    gateway.start();
  }

  // WebSocket setup for live session updates.
  wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    try {
      const url = new URL(req.url ?? "", "http://127.0.0.1");
      if (url.pathname !== "/webchat/socket" && url.pathname !== "/socket") {
        socket.destroy();
        return;
      }
      const addr = req.socket.remoteAddress ?? "";
      const isLocal =
        addr.startsWith("127.") ||
        addr === "::1" ||
        addr.endsWith("127.0.0.1") ||
        addr.endsWith("::ffff:127.0.0.1");
      if (!isLocal) {
        socket.destroy();
        return;
      }
      const sessionKey = url.searchParams.get("session") ?? "main";
      if (!wss) {
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
        ws.on("close", () => {
          const set = wsSessions.get(sessionKey);
          if (set) {
            set.delete(ws);
            if (set.size === 0) wsSessions.delete(sessionKey);
          }
        });
        wsSessions.set(
          sessionKey,
          (wsSessions.get(sessionKey) ?? new Set()).add(ws),
        );
        // Send initial snapshot
        const store = loadSessionStore(storePath);
        const sessionId = pickSessionId(sessionKey, store);
        const sessionEntry = sessionKey ? store[sessionKey] : undefined;
        const persistedThinking = sessionEntry?.thinkingLevel;
        const messages = sessionId
          ? readSessionMessages(sessionId, storePath)
          : [];
        ws.send(
          JSON.stringify({
            type: "session",
            sessionKey,
            messages,
            thinkingLevel:
              typeof persistedThinking === "string"
                ? persistedThinking
                : (cfg.inbound?.reply?.thinkingDefault ?? "off"),
          }),
        );
        if (latestSnapshot) {
          ws.send(
            JSON.stringify({
              type: "gateway-snapshot",
              snapshot: latestSnapshot,
              policy: latestPolicy,
            }),
          );
        }
      });
    } catch (_err) {
      socket.destroy();
    }
  });

  // Watch for session/message file changes and push updates.
  try {
    if (fs.existsSync(storeDir)) {
      fs.watch(storeDir, { persistent: false }, (_event, filename) => {
        if (!filename) return;
        // On any file change, refresh for active sessions.
        for (const sessionKey of wsSessions.keys()) {
          try {
            const store = loadSessionStore(storePath);
            const sessionId = pickSessionId(sessionKey, store);
            const sessionEntry = sessionKey ? store[sessionKey] : undefined;
            const persistedThinking = sessionEntry?.thinkingLevel;
            const messages = sessionId
              ? readSessionMessages(sessionId, storePath)
              : [];
            broadcastSession(sessionKey, {
              type: "session",
              sessionKey,
              messages,
              thinkingLevel:
                typeof persistedThinking === "string"
                  ? persistedThinking
                  : (cfg.inbound?.reply?.thinkingDefault ?? "off"),
            });
          } catch {
            // ignore
          }
        }
      });
    }
  } catch {
    // watcher is best-effort
  }

  state = { server, port };
  logDebug(`webchat server listening on 127.0.0.1:${port}`);
  return state;
}

export async function stopWebChatServer() {
  if (!state) return;
  gatewayReady = false;
  gateway?.stop();
  gateway = null;
  if (wss) {
    for (const client of wss.clients) {
      try {
        client.close();
      } catch {
        /* ignore */
      }
    }
    await new Promise<void>((resolve) => wss?.close(() => resolve()));
  }
  if (state.server) {
    await new Promise<void>((resolve) => state?.server.close(() => resolve()));
  }
  wss = null;
  wsSessions.clear();
  state = null;
}

export async function waitForWebChatGatewayReady(timeoutMs = 10000) {
  const start = Date.now();
  while (!latestSnapshot) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("webchat gateway not ready");
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

// Test-only helpers to seed/broadcast without a live Gateway connection.
export function __forceWebChatSnapshotForTests(
  snapshot: Record<string, unknown>,
  policy?: Record<string, unknown>,
) {
  latestSnapshot = snapshot;
  latestPolicy = policy ?? null;
  gatewayReady = true;
  broadcastAll({
    type: "gateway-snapshot",
    snapshot: latestSnapshot,
    policy: latestPolicy,
  });
}

export function __broadcastGatewayEventForTests(
  event: string,
  payload: unknown,
) {
  broadcastAll({ type: "gateway-event", event, payload });
}

export async function ensureWebChatServerFromConfig() {
  const cfg = loadConfig();
  if (cfg.webchat?.enabled === false) return null;
  const port = cfg.webchat?.port ?? WEBCHAT_DEFAULT_PORT;
  try {
    return await startWebChatServer(port);
  } catch (err) {
    logDebug(`webchat server failed to start: ${String(err)}`);
    throw err;
  }
}
