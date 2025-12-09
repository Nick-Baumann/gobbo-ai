export type AgentEnvelopeParams = {
  surface: string;
  from?: string;
  timestamp?: number | Date;
  host?: string;
  ip?: string;
  body: string;
};

function formatTimestamp(ts?: number | Date): string | undefined {
  if (!ts) return undefined;
  const date = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(date.getTime())) return undefined;
  // Compact ISO-like format with minutes precision.
  return date.toISOString().slice(0, 16).replace("T", " ");
}

export function formatAgentEnvelope(params: AgentEnvelopeParams): string {
  const surface = params.surface?.trim() || "Surface";
  const parts: string[] = [surface];
  if (params.from?.trim()) parts.push(params.from.trim());
  if (params.host?.trim()) parts.push(params.host.trim());
  if (params.ip?.trim()) parts.push(params.ip.trim());
  const ts = formatTimestamp(params.timestamp);
  if (ts) parts.push(ts);
  const header = `[${parts.join(" ")}]`;
  return `${header} ${params.body}`;
}
