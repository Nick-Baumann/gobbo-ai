import { loadConfig } from "../config/config.js";
import { loadSessionStore, resolveStorePath } from "../config/sessions.js";
import { info } from "../globals.js";
import type { RuntimeEnv } from "../runtime.js";
import { resolveHeartbeatSeconds } from "../web/reconnect.js";
import {
  getWebAuthAgeMs,
  logWebSelfId,
  webAuthExists,
} from "../web/session.js";

const formatAge = (ms: number | null | undefined) => {
  if (!ms || ms < 0) return "unknown";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

export async function statusCommand(
  opts: { json?: boolean },
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

  const summary = {
    web: {
      linked,
      authAgeMs,
    },
    heartbeatSeconds,
    sessions: {
      path: storePath,
      count: sessions.length,
      recent,
    },
  } as const;

  if (opts.json) {
    runtime.log(JSON.stringify(summary, null, 2));
    return;
  }

  runtime.log(
    `Web session: ${linked ? "linked" : "not linked"}${linked ? ` (last refreshed ${formatAge(authAgeMs)})` : ""}`,
  );
  if (linked) {
    logWebSelfId(runtime, true);
  }
  runtime.log(info(`Heartbeat: ${heartbeatSeconds}s`));
  runtime.log(info(`Session store: ${storePath}`));
  runtime.log(info(`Active sessions: ${sessions.length}`));
  if (recent.length > 0) {
    runtime.log("Recent sessions:");
    for (const r of recent) {
      runtime.log(
        `- ${r.key} (${r.updatedAt ? formatAge(Date.now() - r.updatedAt) : "no activity"})`,
      );
    }
  } else {
    runtime.log("No session activity yet.");
  }
}
