import type express from "express";

import type { BrowserRouteContext } from "../server-context.js";
import { jsonError } from "./utils.js";

export function registerBrowserBasicRoutes(
  app: express.Express,
  ctx: BrowserRouteContext,
) {
  app.get("/", async (_req, res) => {
    let current: ReturnType<typeof ctx.state>;
    try {
      current = ctx.state();
    } catch {
      return jsonError(res, 503, "browser server not started");
    }

    const reachable = await ctx.isReachable(300);
    res.json({
      enabled: current.resolved.enabled,
      controlUrl: current.resolved.controlUrl,
      running: reachable,
      pid: current.running?.pid ?? null,
      cdpPort: current.cdpPort,
      chosenBrowser: current.running?.exe.kind ?? null,
      userDataDir: current.running?.userDataDir ?? null,
      color: current.resolved.color,
      headless: current.resolved.headless,
      attachOnly: current.resolved.attachOnly,
    });
  });

  app.post("/start", async (_req, res) => {
    try {
      await ctx.ensureBrowserAvailable();
      res.json({ ok: true });
    } catch (err) {
      jsonError(res, 500, String(err));
    }
  });

  app.post("/stop", async (_req, res) => {
    try {
      const result = await ctx.stopRunningBrowser();
      res.json({ ok: true, stopped: result.stopped });
    } catch (err) {
      jsonError(res, 500, String(err));
    }
  });
}
