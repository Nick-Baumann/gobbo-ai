import type express from "express";

import type { BrowserRouteContext } from "../server-context.js";
import { registerBrowserActionRoutes } from "./actions.js";
import { registerBrowserBasicRoutes } from "./basic.js";
import { registerBrowserInspectRoutes } from "./inspect.js";
import { registerBrowserTabRoutes } from "./tabs.js";

export function registerBrowserRoutes(
  app: express.Express,
  ctx: BrowserRouteContext,
) {
  registerBrowserBasicRoutes(app, ctx);
  registerBrowserTabRoutes(app, ctx);
  registerBrowserInspectRoutes(app, ctx);
  registerBrowserActionRoutes(app, ctx);
}
