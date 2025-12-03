export const TOOL_RESULT_DEBOUNCE_MS = 1000;

function shortenPath(p: string): string {
  const home = process.env.HOME;
  if (home && (p === home || p.startsWith(`${home}/`))) return p.replace(home, "~");
  return p;
}

export function shortenMeta(meta: string): string {
  if (!meta) return meta;
  const colonIdx = meta.indexOf(":");
  if (colonIdx === -1) return shortenPath(meta);
  const base = meta.slice(0, colonIdx);
  const rest = meta.slice(colonIdx);
  return `${shortenPath(base)}${rest}`;
}

export function formatToolAggregate(
  toolName?: string,
  metas?: string[],
): string {
  const filtered = (metas ?? []).filter(Boolean).map(shortenMeta);
  const label = toolName?.trim() || "tool";
  const prefix = `[🛠️ ${label}]`;
  if (!filtered.length) return prefix;

  // Group by directory and brace-collapse filenames
  const grouped: Record<string, string[]> = {};
  for (const m of filtered) {
    const parts = m.split("/");
    if (parts.length > 1) {
      const dir = parts.slice(0, -1).join("/");
      const base = parts.at(-1) ?? m;
      (grouped[dir] ||= []).push(base);
    } else {
      (grouped["."] ||= []).push(m);
    }
  }

  const segments = Object.entries(grouped).map(([dir, files]) => {
    const brace = files.length > 1 ? `{${files.join(", ")}}` : files[0];
    if (dir === ".") return brace;
    return `${dir}/${brace}`;
  });

  return `${prefix} ${segments.join("; ")}`;
}

export function formatToolPrefix(toolName?: string, meta?: string) {
  const label = toolName?.trim() || "tool";
  const extra = meta?.trim() ? shortenMeta(meta) : undefined;
  return extra ? `[🛠️ ${label} ${extra}]` : `[🛠️ ${label}]`;
}

export function createToolDebouncer(
  onFlush: (toolName: string | undefined, metas: string[]) => void,
  windowMs = TOOL_RESULT_DEBOUNCE_MS,
) {
  let pendingTool: string | undefined;
  let pendingMetas: string[] = [];
  let timer: NodeJS.Timeout | null = null;

  const flush = () => {
    if (!pendingTool && pendingMetas.length === 0) return;
    onFlush(pendingTool, pendingMetas);
    pendingTool = undefined;
    pendingMetas = [];
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const push = (toolName?: string, meta?: string) => {
    if (pendingTool && toolName && pendingTool !== toolName) flush();
    if (!pendingTool) pendingTool = toolName;
    if (meta) pendingMetas.push(meta);
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, windowMs);
  };

  return { push, flush };
}
