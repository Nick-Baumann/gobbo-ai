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

export async function fetchBrowserJson<T>(
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
