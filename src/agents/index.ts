import { piSpec } from "./pi.js";
import type { AgentKind, AgentSpec } from "./types.js";

const specs: Record<AgentKind, AgentSpec> = {
  pi: piSpec,
};

export function getAgentSpec(kind: AgentKind): AgentSpec {
  return specs[kind];
}

export type { AgentKind, AgentMeta, AgentParseResult } from "./types.js";
