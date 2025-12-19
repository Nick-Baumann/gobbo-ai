import type express from "express";

import type { BrowserRouteContext } from "../server-context.js";
import { registerBrowserBasicRoutes } from "./basic.js";
import { registerBrowserInspectRoutes } from "./inspect.js";
import { registerBrowserTabRoutes } from "./tabs.js";
import { registerBrowserToolRoutes } from "./tool.js";

export function registerBrowserRoutes(
  app: express.Express,
  ctx: BrowserRouteContext,
) {
  registerBrowserBasicRoutes(app, ctx);
  registerBrowserTabRoutes(app, ctx);
  registerBrowserInspectRoutes(app, ctx);
  registerBrowserToolRoutes(app, ctx);
}
