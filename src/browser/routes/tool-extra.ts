import path from "node:path";

import type express from "express";

import { ensureMediaDir, saveMediaBuffer } from "../../media/store.js";
import {
  generateLocatorForRef,
  getConsoleMessagesViaPlaywright,
  getNetworkRequestsViaPlaywright,
  mouseClickViaPlaywright,
  mouseDragViaPlaywright,
  mouseMoveViaPlaywright,
  pdfViaPlaywright,
  startTracingViaPlaywright,
  stopTracingViaPlaywright,
  verifyElementVisibleViaPlaywright,
  verifyListVisibleViaPlaywright,
  verifyTextVisibleViaPlaywright,
  verifyValueViaPlaywright,
} from "../pw-ai.js";
import type { BrowserRouteContext } from "../server-context.js";
import {
  jsonError,
  toBoolean,
  toNumber,
  toStringArray,
  toStringOrEmpty,
} from "./utils.js";

type ToolExtraParams = {
  name: string;
  args: Record<string, unknown>;
  targetId: string;
  cdpPort: number;
  ctx: BrowserRouteContext;
  res: express.Response;
};

export async function handleBrowserToolExtra(
  params: ToolExtraParams,
): Promise<boolean> {
  const { name, args, targetId, cdpPort, ctx, res } = params;
  const target = targetId || undefined;

  switch (name) {
    case "browser_console_messages": {
      const level = toStringOrEmpty(args.level) || undefined;
      const tab = await ctx.ensureTabAvailable(target);
      const messages = await getConsoleMessagesViaPlaywright({
        cdpPort,
        targetId: tab.targetId,
        level,
      });
      res.json({ ok: true, messages, targetId: tab.targetId });
      return true;
    }
    case "browser_network_requests": {
      const includeStatic = toBoolean(args.includeStatic) ?? false;
      const tab = await ctx.ensureTabAvailable(target);
      const requests = await getNetworkRequestsViaPlaywright({
        cdpPort,
        targetId: tab.targetId,
        includeStatic,
      });
      res.json({ ok: true, requests, targetId: tab.targetId });
      return true;
    }
    case "browser_pdf_save": {
      const tab = await ctx.ensureTabAvailable(target);
      const pdf = await pdfViaPlaywright({
        cdpPort,
        targetId: tab.targetId,
      });
      await ensureMediaDir();
      const saved = await saveMediaBuffer(
        pdf.buffer,
        "application/pdf",
        "browser",
        pdf.buffer.byteLength,
      );
      res.json({
        ok: true,
        path: path.resolve(saved.path),
        targetId: tab.targetId,
        url: tab.url,
      });
      return true;
    }
    case "browser_start_tracing": {
      const tab = await ctx.ensureTabAvailable(target);
      await startTracingViaPlaywright({
        cdpPort,
        targetId: tab.targetId,
      });
      res.json({ ok: true });
      return true;
    }
    case "browser_stop_tracing": {
      const tab = await ctx.ensureTabAvailable(target);
      const trace = await stopTracingViaPlaywright({
        cdpPort,
        targetId: tab.targetId,
      });
      await ensureMediaDir();
      const saved = await saveMediaBuffer(
        trace.buffer,
        "application/zip",
        "browser",
        trace.buffer.byteLength,
      );
      res.json({
        ok: true,
        path: path.resolve(saved.path),
        targetId: tab.targetId,
        url: tab.url,
      });
      return true;
    }
    case "browser_verify_element_visible": {
      const role = toStringOrEmpty(args.role);
      const accessibleName = toStringOrEmpty(args.accessibleName);
      if (!role || !accessibleName) {
        jsonError(res, 400, "role and accessibleName are required");
        return true;
      }
      const tab = await ctx.ensureTabAvailable(target);
      await verifyElementVisibleViaPlaywright({
        cdpPort,
        targetId: tab.targetId,
        role,
        accessibleName,
      });
      res.json({ ok: true });
      return true;
    }
    case "browser_verify_text_visible": {
      const text = toStringOrEmpty(args.text);
      if (!text) {
        jsonError(res, 400, "text is required");
        return true;
      }
      const tab = await ctx.ensureTabAvailable(target);
      await verifyTextVisibleViaPlaywright({
        cdpPort,
        targetId: tab.targetId,
        text,
      });
      res.json({ ok: true });
      return true;
    }
    case "browser_verify_list_visible": {
      const ref = toStringOrEmpty(args.ref);
      const items = toStringArray(args.items);
      if (!ref || !items?.length) {
        jsonError(res, 400, "ref and items are required");
        return true;
      }
      const tab = await ctx.ensureTabAvailable(target);
      await verifyListVisibleViaPlaywright({
        cdpPort,
        targetId: tab.targetId,
        ref,
        items,
      });
      res.json({ ok: true });
      return true;
    }
    case "browser_verify_value": {
      const ref = toStringOrEmpty(args.ref);
      const type = toStringOrEmpty(args.type);
      const value = toStringOrEmpty(args.value);
      if (!ref || !type) {
        jsonError(res, 400, "ref and type are required");
        return true;
      }
      const tab = await ctx.ensureTabAvailable(target);
      await verifyValueViaPlaywright({
        cdpPort,
        targetId: tab.targetId,
        ref,
        type,
        value,
      });
      res.json({ ok: true });
      return true;
    }
    case "browser_mouse_move_xy": {
      const x = toNumber(args.x);
      const y = toNumber(args.y);
      if (x === undefined || y === undefined) {
        jsonError(res, 400, "x and y are required");
        return true;
      }
      const tab = await ctx.ensureTabAvailable(target);
      await mouseMoveViaPlaywright({
        cdpPort,
        targetId: tab.targetId,
        x,
        y,
      });
      res.json({ ok: true });
      return true;
    }
    case "browser_mouse_click_xy": {
      const x = toNumber(args.x);
      const y = toNumber(args.y);
      if (x === undefined || y === undefined) {
        jsonError(res, 400, "x and y are required");
        return true;
      }
      const button = toStringOrEmpty(args.button) || undefined;
      const tab = await ctx.ensureTabAvailable(target);
      await mouseClickViaPlaywright({
        cdpPort,
        targetId: tab.targetId,
        x,
        y,
        button,
      });
      res.json({ ok: true });
      return true;
    }
    case "browser_mouse_drag_xy": {
      const startX = toNumber(args.startX);
      const startY = toNumber(args.startY);
      const endX = toNumber(args.endX);
      const endY = toNumber(args.endY);
      if (
        startX === undefined ||
        startY === undefined ||
        endX === undefined ||
        endY === undefined
      ) {
        jsonError(res, 400, "startX, startY, endX, endY are required");
        return true;
      }
      const tab = await ctx.ensureTabAvailable(target);
      await mouseDragViaPlaywright({
        cdpPort,
        targetId: tab.targetId,
        startX,
        startY,
        endX,
        endY,
      });
      res.json({ ok: true });
      return true;
    }
    case "browser_generate_locator": {
      const ref = toStringOrEmpty(args.ref);
      if (!ref) {
        jsonError(res, 400, "ref is required");
        return true;
      }
      const locator = generateLocatorForRef(ref);
      res.json({ ok: true, locator });
      return true;
    }
    default:
      return false;
  }
}
