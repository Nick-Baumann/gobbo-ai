import type express from "express";

import type { BrowserRouteContext } from "../server-context.js";
import { handleBrowserToolCore } from "./tool-core.js";
import { handleBrowserToolExtra } from "./tool-extra.js";
import { jsonError, toStringOrEmpty } from "./utils.js";

type ToolRequestBody = {
  name?: unknown;
  args?: unknown;
  targetId?: unknown;
};

function toolArgs(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function registerBrowserToolRoutes(
  app: express.Express,
  ctx: BrowserRouteContext,
) {
  app.post("/tool", async (req, res) => {
    const body = req.body as ToolRequestBody;
    const name = toStringOrEmpty(body?.name);
    if (!name) return jsonError(res, 400, "name is required");
    const args = toolArgs(body?.args);
    const targetId = toStringOrEmpty(body?.targetId || args?.targetId);

    try {
      let cdpPort: number;
      try {
        cdpPort = ctx.state().cdpPort;
      } catch {
        return jsonError(res, 503, "browser server not started");
      }

      const handledCore = await handleBrowserToolCore({
        name,
        args,
        targetId,
        cdpPort,
        ctx,
        res,
      });
      if (handledCore) return;

      const handledExtra = await handleBrowserToolExtra({
        name,
        args,
        targetId,
        cdpPort,
        ctx,
        res,
      });
      if (handledExtra) return;

      return jsonError(res, 400, "unknown tool name");
    } catch (err) {
      const mapped = ctx.mapTabError(err);
      if (mapped) return jsonError(res, mapped.status, mapped.message);
      jsonError(res, 500, String(err));
    }
  });
}
