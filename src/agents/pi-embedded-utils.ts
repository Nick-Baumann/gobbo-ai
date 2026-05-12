import type { AssistantMessage } from "@mariozechner/pi-ai";

export function extractAssistantText(msg: AssistantMessage): string {
  const isTextBlock = (
    block: unknown,
  ): block is { type: "text"; text: string } => {
    if (!block || typeof block !== "object") return false;
    const rec = block as Record<string, unknown>;
    return rec.type === "text" && typeof rec.text === "string";
  };

  const blocks = Array.isArray(msg.content)
    ? msg.content
        .filter(isTextBlock)
        .map((c) => c.text.trim())
        .filter(Boolean)
    : [];
  return blocks.join("\n").trim();
}

export function inferToolMetaFromArgs(
  toolName: string,
  args: unknown,
): string | undefined {
  if (!args || typeof args !== "object") return undefined;
  const record = args as Record<string, unknown>;

  const p = typeof record.path === "string" ? record.path : undefined;
  const command =
    typeof record.command === "string" ? record.command : undefined;

  if (toolName === "read" && p) {
    const offset =
      typeof record.offset === "number" ? record.offset : undefined;
    const limit = typeof record.limit === "number" ? record.limit : undefined;
    if (offset !== undefined && limit !== undefined) {
      return `${p}:${offset}-${offset + limit}`;
    }
    return p;
  }
  if ((toolName === "edit" || toolName === "write") && p) return p;
  if (toolName === "bash" && command) return command;
  return p ?? command;
}
