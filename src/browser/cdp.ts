import WebSocket from "ws";

type CdpResponse = {
  id: number;
  result?: unknown;
  error?: { message?: string };
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
};

type CdpSendFn = (
  method: string,
  params?: Record<string, unknown>,
) => Promise<unknown>;

function createCdpSender(ws: WebSocket) {
  let nextId = 1;
  const pending = new Map<number, Pending>();

  const send: CdpSendFn = (
    method: string,
    params?: Record<string, unknown>,
  ) => {
    const id = nextId++;
    const msg = { id, method, params };
    ws.send(JSON.stringify(msg));
    return new Promise<unknown>((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
  };

  const closeWithError = (err: Error) => {
    for (const [, p] of pending) p.reject(err);
    pending.clear();
    try {
      ws.close();
    } catch {
      // ignore
    }
  };

  ws.on("message", (data) => {
    try {
      const parsed = JSON.parse(String(data)) as CdpResponse;
      if (typeof parsed.id !== "number") return;
      const p = pending.get(parsed.id);
      if (!p) return;
      pending.delete(parsed.id);
      if (parsed.error?.message) {
        p.reject(new Error(parsed.error.message));
        return;
      }
      p.resolve(parsed.result);
    } catch {
      // ignore
    }
  });

  ws.on("close", () => {
    closeWithError(new Error("CDP socket closed"));
  });

  return { send, closeWithError };
}

async function fetchJson<T>(url: string, timeoutMs = 1500): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

export async function captureScreenshotPng(opts: {
  wsUrl: string;
  fullPage?: boolean;
}): Promise<Buffer> {
  return await captureScreenshot({
    wsUrl: opts.wsUrl,
    fullPage: opts.fullPage,
    format: "png",
  });
}

export async function captureScreenshot(opts: {
  wsUrl: string;
  fullPage?: boolean;
  format?: "png" | "jpeg";
  quality?: number; // jpeg only (0..100)
}): Promise<Buffer> {
  const ws = new WebSocket(opts.wsUrl, { handshakeTimeout: 5000 });
  const { send, closeWithError } = createCdpSender(ws);

  const openPromise = new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", (err) => reject(err));
  });

  await openPromise;

  await send("Page.enable");

  let clip:
    | { x: number; y: number; width: number; height: number; scale: number }
    | undefined;
  if (opts.fullPage) {
    const metrics = (await send("Page.getLayoutMetrics")) as {
      cssContentSize?: { width?: number; height?: number };
      contentSize?: { width?: number; height?: number };
    };
    const size = metrics?.cssContentSize ?? metrics?.contentSize;
    const width = Number(size?.width ?? 0);
    const height = Number(size?.height ?? 0);
    if (width > 0 && height > 0) {
      clip = { x: 0, y: 0, width, height, scale: 1 };
    }
  }

  const format = opts.format ?? "png";
  const quality =
    format === "jpeg"
      ? Math.max(0, Math.min(100, Math.round(opts.quality ?? 85)))
      : undefined;

  const result = (await send("Page.captureScreenshot", {
    format,
    ...(quality !== undefined ? { quality } : {}),
    fromSurface: true,
    captureBeyondViewport: true,
    ...(clip ? { clip } : {}),
  })) as { data?: string };

  const base64 = result?.data;
  if (!base64) {
    closeWithError(new Error("Screenshot failed: missing data"));
    throw new Error("Screenshot failed: missing data");
  }

  try {
    ws.close();
  } catch {
    // ignore
  }

  return Buffer.from(base64, "base64");
}

export async function createTargetViaCdp(opts: {
  cdpPort: number;
  url: string;
}): Promise<{ targetId: string }> {
  const version = await fetchJson<{ webSocketDebuggerUrl?: string }>(
    `http://127.0.0.1:${opts.cdpPort}/json/version`,
    1500,
  );
  const wsUrl = String(version?.webSocketDebuggerUrl ?? "").trim();
  if (!wsUrl) throw new Error("CDP /json/version missing webSocketDebuggerUrl");

  const ws = new WebSocket(wsUrl, { handshakeTimeout: 5000 });
  const { send, closeWithError } = createCdpSender(ws);

  const openPromise = new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", (err) => reject(err));
  });

  await openPromise;

  const created = (await send("Target.createTarget", { url: opts.url })) as {
    targetId?: string;
  };
  const targetId = String(created?.targetId ?? "").trim();
  if (!targetId) {
    closeWithError(new Error("CDP Target.createTarget returned no targetId"));
    throw new Error("CDP Target.createTarget returned no targetId");
  }

  try {
    ws.close();
  } catch {
    // ignore
  }

  return { targetId };
}
