import path from "node:path";

import { CONFIG_DIR, resolveUserPath } from "../utils.js";

const DEFAULT_AGENT_DIR = path.join(CONFIG_DIR, "agent");

export function resolveGobboAgentDir(): string {
  const override =
    process.env.GOBBO_AGENT_DIR?.trim() ||
    process.env.PI_CODING_AGENT_DIR?.trim() ||
    DEFAULT_AGENT_DIR;
  return resolveUserPath(override);
}

export function ensureGobboAgentEnv(): string {
  const dir = resolveGobboAgentDir();
  if (!process.env.GOBBO_AGENT_DIR) process.env.GOBBO_AGENT_DIR = dir;
  if (!process.env.PI_CODING_AGENT_DIR) process.env.PI_CODING_AGENT_DIR = dir;
  return dir;
}
