import { loadConfig } from "../config/config.js";
import { resolveBrowserConfig } from "./config.js";

export type BrowserStatus = {
  enabled: boolean;
  controlUrl: string;
  running: boolean;
  pid: number | null;
  cdpPort: number;
  chosenBrowser: string | null;
  userDataDir: string | null;
  color: string;
  headless: boolean;
  attachOnly: boolean;
};

export type BrowserTab = {
  targetId: string;
  title: string;
  url: string;
  type?: string;
};

export type BrowserToolResponse = {
  ok: true;
  [key: string]: unknown;
};

export type ScreenshotResult = {
  ok: true;
  path: string;
  targetId: string;
  url: string;
};

export type EvalResult = {
  ok: true;
  targetId: string;
  url: string;
  result: {
    type: string;
    subtype?: string;
    value?: unknown;
    description?: string;
    unserializableValue?: string;
    preview?: unknown;
  };
};

export type QueryResult = {
  ok: true;
  targetId: string;
  url: string;
  matches: Array<{
    index: number;
    tag: string;
    id?: string;
    className?: string;
    text?: string;
    value?: string;
    href?: string;
    outerHTML?: string;
  }>;
};

export type DomResult = {
  ok: true;
  targetId: string;
  url: string;
  format: "html" | "text";
  text: string;
};

export type SnapshotAriaNode = {
  ref: string;
  role: string;
  name: string;
  value?: string;
  description?: string;
  backendDOMNodeId?: number;
  depth: number;
};

export type SnapshotResult =
  | {
      ok: true;
      format: "aria";
      targetId: string;
      url: string;
      nodes: SnapshotAriaNode[];
    }
  | {
      ok: true;
      format: "domSnapshot";
      targetId: string;
      url: string;
      nodes: Array<{
        ref: string;
        parentRef: string | null;
        depth: number;
        tag: string;
        id?: string;
        className?: string;
        role?: string;
        name?: string;
        text?: string;
        href?: string;
        type?: string;
        value?: string;
      }>;
    }
  | {
      ok: true;
      format: "ai";
      targetId: string;
      url: string;
      snapshot: string;
    };

function unwrapCause(err: unknown): unknown {
  if (!err || typeof err !== "object") return null;
  const cause = (err as { cause?: unknown }).cause;
  return cause ?? null;
}

function enhanceBrowserFetchError(
  url: string,
  err: unknown,
  timeoutMs: number,
): Error {
  const cause = unwrapCause(err);
  const code =
    (cause && typeof cause === "object" && "code" in cause
      ? String((cause as { code?: unknown }).code ?? "")
      : "") ||
    (err && typeof err === "object" && "code" in err
      ? String((err as { code?: unknown }).code ?? "")
      : "");

  const hint =
    "Start (or restart) the Clawdis gateway (Clawdis.app menubar, or `clawdis gateway`) and try again.";

  if (code === "ECONNREFUSED") {
    return new Error(
      `Can't reach the clawd browser control server at ${url} (connection refused). ${hint}`,
    );
  }
  if (code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT") {
    return new Error(
      `Can't reach the clawd browser control server at ${url} (timed out after ${timeoutMs}ms). ${hint}`,
    );
  }

  const msg = String(err);
  if (msg.toLowerCase().includes("abort")) {
    return new Error(
      `Can't reach the clawd browser control server at ${url} (timed out after ${timeoutMs}ms). ${hint}`,
    );
  }

  return new Error(
    `Can't reach the clawd browser control server at ${url}. ${hint} (${msg})`,
  );
}

async function fetchJson<T>(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const timeoutMs = init?.timeoutMs ?? 5000;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: ctrl.signal } as RequestInit);
  } catch (err) {
    throw enhanceBrowserFetchError(url, err, timeoutMs);
  } finally {
    clearTimeout(t);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text ? `${res.status}: ${text}` : `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export function resolveBrowserControlUrl(overrideUrl?: string) {
  const cfg = loadConfig();
  const resolved = resolveBrowserConfig(cfg.browser);
  const url = overrideUrl?.trim() ? overrideUrl.trim() : resolved.controlUrl;
  return url.replace(/\/$/, "");
}

export async function browserStatus(baseUrl: string): Promise<BrowserStatus> {
  return await fetchJson<BrowserStatus>(`${baseUrl}/`, { timeoutMs: 1500 });
}

export async function browserStart(baseUrl: string): Promise<void> {
  await fetchJson(`${baseUrl}/start`, { method: "POST", timeoutMs: 15000 });
}

export async function browserStop(baseUrl: string): Promise<void> {
  await fetchJson(`${baseUrl}/stop`, { method: "POST", timeoutMs: 15000 });
}

export async function browserTabs(baseUrl: string): Promise<BrowserTab[]> {
  const res = await fetchJson<{ running: boolean; tabs: BrowserTab[] }>(
    `${baseUrl}/tabs`,
    { timeoutMs: 3000 },
  );
  return res.tabs ?? [];
}

export async function browserOpenTab(
  baseUrl: string,
  url: string,
): Promise<BrowserTab> {
  return await fetchJson<BrowserTab>(`${baseUrl}/tabs/open`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    timeoutMs: 15000,
  });
}

export async function browserFocusTab(
  baseUrl: string,
  targetId: string,
): Promise<void> {
  await fetchJson(`${baseUrl}/tabs/focus`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetId }),
    timeoutMs: 5000,
  });
}

export async function browserCloseTab(
  baseUrl: string,
  targetId: string,
): Promise<void> {
  await fetchJson(`${baseUrl}/tabs/${encodeURIComponent(targetId)}`, {
    method: "DELETE",
    timeoutMs: 5000,
  });
}

export async function browserScreenshot(
  baseUrl: string,
  opts: {
    targetId?: string;
    fullPage?: boolean;
  },
): Promise<ScreenshotResult> {
  const q = new URLSearchParams();
  if (opts.targetId) q.set("targetId", opts.targetId);
  if (opts.fullPage) q.set("fullPage", "true");
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return await fetchJson<ScreenshotResult>(`${baseUrl}/screenshot${suffix}`, {
    timeoutMs: 20000,
  });
}

export async function browserEval(
  baseUrl: string,
  opts: {
    js: string;
    targetId?: string;
    awaitPromise?: boolean;
  },
): Promise<EvalResult> {
  return await fetchJson<EvalResult>(`${baseUrl}/eval`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      js: opts.js,
      targetId: opts.targetId,
      await: Boolean(opts.awaitPromise),
    }),
    timeoutMs: 15000,
  });
}

export async function browserQuery(
  baseUrl: string,
  opts: {
    selector: string;
    targetId?: string;
    limit?: number;
  },
): Promise<QueryResult> {
  const q = new URLSearchParams();
  q.set("selector", opts.selector);
  if (opts.targetId) q.set("targetId", opts.targetId);
  if (typeof opts.limit === "number") q.set("limit", String(opts.limit));
  return await fetchJson<QueryResult>(`${baseUrl}/query?${q.toString()}`, {
    timeoutMs: 15000,
  });
}

export async function browserDom(
  baseUrl: string,
  opts: {
    format: "html" | "text";
    targetId?: string;
    maxChars?: number;
    selector?: string;
  },
): Promise<DomResult> {
  const q = new URLSearchParams();
  q.set("format", opts.format);
  if (opts.targetId) q.set("targetId", opts.targetId);
  if (typeof opts.maxChars === "number")
    q.set("maxChars", String(opts.maxChars));
  if (opts.selector) q.set("selector", opts.selector);
  return await fetchJson<DomResult>(`${baseUrl}/dom?${q.toString()}`, {
    timeoutMs: 20000,
  });
}

export async function browserSnapshot(
  baseUrl: string,
  opts: {
    format: "aria" | "domSnapshot" | "ai";
    targetId?: string;
    limit?: number;
  },
): Promise<SnapshotResult> {
  const q = new URLSearchParams();
  q.set("format", opts.format);
  if (opts.targetId) q.set("targetId", opts.targetId);
  if (typeof opts.limit === "number") q.set("limit", String(opts.limit));
  return await fetchJson<SnapshotResult>(
    `${baseUrl}/snapshot?${q.toString()}`,
    {
      timeoutMs: 20000,
    },
  );
}

export async function browserClickRef(
  baseUrl: string,
  opts: {
    ref: string;
    targetId?: string;
  },
): Promise<{ ok: true; targetId: string; url: string }> {
  return await fetchJson<{ ok: true; targetId: string; url: string }>(
    `${baseUrl}/click`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ref: opts.ref,
        targetId: opts.targetId,
      }),
      timeoutMs: 20000,
    },
  );
}

export async function browserTool(
  baseUrl: string,
  opts: {
    name: string;
    args?: Record<string, unknown>;
    targetId?: string;
  },
): Promise<BrowserToolResponse> {
  return await fetchJson<BrowserToolResponse>(`${baseUrl}/tool`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: opts.name,
      args: opts.args ?? {},
      targetId: opts.targetId,
    }),
    timeoutMs: 20000,
  });
}
