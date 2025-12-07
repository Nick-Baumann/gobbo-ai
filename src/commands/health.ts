import fs from "node:fs";
import path from "node:path";

import { loadConfig } from "../config/config.js";
import { loadSessionStore, resolveStorePath } from "../config/sessions.js";
import { info } from "../globals.js";
import type { RuntimeEnv } from "../runtime.js";
import { resolveHeartbeatSeconds } from "../web/reconnect.js";
import {
  createWaSocket,
  getStatusCode,
  getWebAuthAgeMs,
  logWebSelfId,
  waitForWaConnection,
  webAuthExists,
} from "../web/session.js";

type HealthConnect = {
  ok: boolean;
  status?: number | null;
  error?: string | null;
  elapsedMs: number;
};

type HealthSummary = {
  ts: number;
  durationMs: number;
  web: {
    linked: boolean;
    authAgeMs: number | null;
    connect?: HealthConnect;
  };
  heartbeatSeconds: number;
  sessions: {
    path: string;
    count: number;
    recent: Array<{
      key: string;
      updatedAt: number | null;
      age: number | null;
    }>;
  };
  ipc: { path: string; exists: boolean };
};

const DEFAULT_TIMEOUT_MS = 10_000;

async function probeWebConnect(timeoutMs: number): Promise<HealthConnect> {
  const started = Date.now();
  const sock = await createWaSocket(false, false);
  try {
    await Promise.race([
      waitForWaConnection(sock),
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error("timeout")), timeoutMs),
      ),
    ]);
    return {
      ok: true,
      status: null,
      error: null,
      elapsedMs: Date.now() - started,
    };
  } catch (err) {
    return {
      ok: false,
      status: getStatusCode(err),
      error: err instanceof Error ? err.message : String(err),
      elapsedMs: Date.now() - started,
    };
  } finally {
    try {
      sock.ws?.close();
    } catch {
      // ignore
    }
  }
}

export async function healthCommand(
  opts: { json?: boolean; timeoutMs?: number },
  runtime: RuntimeEnv,
) {
  const cfg = loadConfig();
  const linked = await webAuthExists();
  const authAgeMs = getWebAuthAgeMs();
  const heartbeatSeconds = resolveHeartbeatSeconds(cfg, undefined);
  const storePath = resolveStorePath(cfg.inbound?.reply?.session?.store);
  const store = loadSessionStore(storePath);
  const sessions = Object.entries(store)
    .filter(([key]) => key !== "global" && key !== "unknown")
    .map(([key, entry]) => ({ key, updatedAt: entry?.updatedAt ?? 0 }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const recent = sessions.slice(0, 5).map((s) => ({
    key: s.key,
    updatedAt: s.updatedAt || null,
    age: s.updatedAt ? Date.now() - s.updatedAt : null,
  }));

  const ipcPath = path.join(process.env.HOME ?? "", ".clawdis", "clawdis.sock");
  const ipcExists = Boolean(ipcPath) && fs.existsSync(ipcPath);

  const start = Date.now();
  const timeoutMs = Math.max(1000, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const connect = linked ? await probeWebConnect(timeoutMs) : undefined;

  const summary: HealthSummary = {
    ts: Date.now(),
    durationMs: Date.now() - start,
    web: { linked, authAgeMs, connect },
    heartbeatSeconds,
    sessions: {
      path: storePath,
      count: sessions.length,
      recent,
    },
    ipc: { path: ipcPath, exists: ipcExists },
  };

  const fatal = !linked || (connect && !connect.ok);

  if (opts.json) {
    runtime.log(JSON.stringify(summary, null, 2));
  } else {
    runtime.log(
      linked
        ? `Web: linked (auth age ${authAgeMs ? `${Math.round(authAgeMs / 60000)}m` : "unknown"})`
        : "Web: not linked (run clawdis login)",
    );
    if (linked) {
      logWebSelfId(runtime, true);
    }
    if (connect) {
      const base = connect.ok
        ? info(`Connect: ok (${connect.elapsedMs}ms)`)
        : `Connect: failed (${connect.status ?? "unknown"})`;
      runtime.log(base + (connect.error ? ` - ${connect.error}` : ""));
    }
    runtime.log(info(`Heartbeat interval: ${heartbeatSeconds}s`));
    runtime.log(
      info(`Session store: ${storePath} (${sessions.length} entries)`),
    );
    if (recent.length > 0) {
      runtime.log("Recent sessions:");
      for (const r of recent) {
        runtime.log(
          `- ${r.key} (${r.updatedAt ? `${Math.round((Date.now() - r.updatedAt) / 60000)}m ago` : "no activity"})`,
        );
      }
    }
    runtime.log(
      info(`IPC socket: ${ipcExists ? "present" : "missing"} (${ipcPath})`),
    );
  }

  if (fatal) {
    runtime.exit(1);
  }
}
