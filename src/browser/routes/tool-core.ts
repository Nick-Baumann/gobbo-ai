import path from "node:path";

import type express from "express";

import { ensureMediaDir, saveMediaBuffer } from "../../media/store.js";
import {
  clickViaPlaywright,
  closePageViaPlaywright,
  dragViaPlaywright,
  evaluateViaPlaywright,
  fileUploadViaPlaywright,
  fillFormViaPlaywright,
  handleDialogViaPlaywright,
  hoverViaPlaywright,
  navigateBackViaPlaywright,
  navigateViaPlaywright,
  pressKeyViaPlaywright,
  resizeViewportViaPlaywright,
  runCodeViaPlaywright,
  selectOptionViaPlaywright,
  snapshotAiViaPlaywright,
  takeScreenshotViaPlaywright,
  typeViaPlaywright,
  waitForViaPlaywright,
} from "../pw-ai.js";
import {
  DEFAULT_BROWSER_SCREENSHOT_MAX_BYTES,
  DEFAULT_BROWSER_SCREENSHOT_MAX_SIDE,
  normalizeBrowserScreenshot,
} from "../screenshot.js";
import type { BrowserRouteContext } from "../server-context.js";
import {
  jsonError,
  toBoolean,
  toNumber,
  toStringArray,
  toStringOrEmpty,
} from "./utils.js";

type ToolCoreParams = {
  name: string;
  args: Record<string, unknown>;
  targetId: string;
  cdpPort: number;
  ctx: BrowserRouteContext;
  res: express.Response;
};

export async function handleBrowserToolCore(
  params: ToolCoreParams,
): Promise<boolean> {
  const { name, args, targetId, cdpPort, ctx, res } = params;
  const target = targetId || undefined;

  switch (name) {
    case "browser_close": {
      const tab = await ctx.ensureTabAvailable(target);
      await closePageViaPlaywright({ cdpPort, targetId: tab.targetId });
      res.json({ ok: true, targetId: tab.targetId, url: tab.url });
      return true;
    }
    case "browser_resize": {
      const width = toNumber(args.width);
      const height = toNumber(args.height);
      if (!width || !height) {
        jsonError(res, 400, "width and height are required");
        return true;
      }
      const tab = await ctx.ensureTabAvailable(target);
      await resizeViewportViaPlaywright({
        cdpPort,
        targetId: tab.targetId,
        width,
        height,
      });
      res.json({ ok: true, targetId: tab.targetId, url: tab.url });
      return true;
    }
    case "browser_handle_dialog": {
      const accept = toBoolean(args.accept);
      if (accept === undefined) {
        jsonError(res, 400, "accept is required");
        return true;
      }
      const promptText = toStringOrEmpty(args.promptText) || undefined;
      const tab = await ctx.ensureTabAvailable(target);
      const result = await handleDialogViaPlaywright({
        cdpPort,
        targetId: tab.targetId,
        accept,
        promptText,
      });
      res.json({ ok: true, ...result });
      return true;
    }
    case "browser_evaluate": {
      const fn = toStringOrEmpty(args.function);
      if (!fn) {
        jsonError(res, 400, "function is required");
        return true;
      }
      const ref = toStringOrEmpty(args.ref) || undefined;
      const tab = await ctx.ensureTabAvailable(target);
      const result = await evaluateViaPlaywright({
        cdpPort,
        targetId: tab.targetId,
        fn,
        ref,
      });
      res.json({ ok: true, result });
      return true;
    }
    case "browser_file_upload": {
      const paths = toStringArray(args.paths) ?? [];
      const tab = await ctx.ensureTabAvailable(target);
      await fileUploadViaPlaywright({
        cdpPort,
        targetId: tab.targetId,
        paths: paths.length ? paths : undefined,
      });
      res.json({ ok: true, targetId: tab.targetId });
      return true;
    }
    case "browser_fill_form": {
      const fields = Array.isArray(args.fields)
        ? (args.fields as Array<Record<string, unknown>>)
        : null;
      if (!fields?.length) {
        jsonError(res, 400, "fields are required");
        return true;
      }
      const tab = await ctx.ensureTabAvailable(target);
      await fillFormViaPlaywright({
        cdpPort,
        targetId: tab.targetId,
        fields,
      });
      res.json({ ok: true, targetId: tab.targetId });
      return true;
    }
    case "browser_install": {
      res.json({
        ok: true,
        message:
          "clawd browser uses system Chrome/Chromium; no Playwright install needed.",
      });
      return true;
    }
    case "browser_press_key": {
      const key = toStringOrEmpty(args.key);
      if (!key) {
        jsonError(res, 400, "key is required");
        return true;
      }
      const tab = await ctx.ensureTabAvailable(target);
      await pressKeyViaPlaywright({
        cdpPort,
        targetId: tab.targetId,
        key,
      });
      res.json({ ok: true, targetId: tab.targetId });
      return true;
    }
    case "browser_type": {
      const ref = toStringOrEmpty(args.ref);
      const text = toStringOrEmpty(args.text);
      if (!ref || !text) {
        jsonError(res, 400, "ref and text are required");
        return true;
      }
      const submit = toBoolean(args.submit) ?? false;
      const slowly = toBoolean(args.slowly) ?? false;
      const tab = await ctx.ensureTabAvailable(target);
      await typeViaPlaywright({
        cdpPort,
        targetId: tab.targetId,
        ref,
        text,
        submit,
        slowly,
      });
      res.json({ ok: true, targetId: tab.targetId });
      return true;
    }
    case "browser_navigate": {
      const url = toStringOrEmpty(args.url);
      if (!url) {
        jsonError(res, 400, "url is required");
        return true;
      }
      const tab = await ctx.ensureTabAvailable(target);
      const result = await navigateViaPlaywright({
        cdpPort,
        targetId: tab.targetId,
        url,
      });
      res.json({ ok: true, targetId: tab.targetId, ...result });
      return true;
    }
    case "browser_navigate_back": {
      const tab = await ctx.ensureTabAvailable(target);
      const result = await navigateBackViaPlaywright({
        cdpPort,
        targetId: tab.targetId,
      });
      res.json({ ok: true, targetId: tab.targetId, ...result });
      return true;
    }
    case "browser_run_code": {
      const code = toStringOrEmpty(args.code);
      if (!code) {
        jsonError(res, 400, "code is required");
        return true;
      }
      const tab = await ctx.ensureTabAvailable(target);
      const result = await runCodeViaPlaywright({
        cdpPort,
        targetId: tab.targetId,
        code,
      });
      res.json({ ok: true, result });
      return true;
    }
    case "browser_take_screenshot": {
      const type = args.type === "jpeg" ? "jpeg" : "png";
      const ref = toStringOrEmpty(args.ref) || undefined;
      const fullPage = toBoolean(args.fullPage) ?? false;
      const element = toStringOrEmpty(args.element) || undefined;
      const filename = toStringOrEmpty(args.filename) || undefined;
      const tab = await ctx.ensureTabAvailable(target);
      const snap = await takeScreenshotViaPlaywright({
        cdpPort,
        targetId: tab.targetId,
        ref,
        element,
        fullPage,
        type,
      });
      const normalized = await normalizeBrowserScreenshot(snap.buffer, {
        maxSide: DEFAULT_BROWSER_SCREENSHOT_MAX_SIDE,
        maxBytes: DEFAULT_BROWSER_SCREENSHOT_MAX_BYTES,
      });
      await ensureMediaDir();
      const saved = await saveMediaBuffer(
        normalized.buffer,
        normalized.contentType ?? `image/${type}`,
        "browser",
        DEFAULT_BROWSER_SCREENSHOT_MAX_BYTES,
      );
      res.json({
        ok: true,
        path: path.resolve(saved.path),
        filename,
        targetId: tab.targetId,
        url: tab.url,
      });
      return true;
    }
    case "browser_snapshot": {
      const filename = toStringOrEmpty(args.filename) || undefined;
      const tab = await ctx.ensureTabAvailable(target);
      const snap = await snapshotAiViaPlaywright({
        cdpPort,
        targetId: tab.targetId,
      });
      if (filename) {
        await ensureMediaDir();
        const saved = await saveMediaBuffer(
          Buffer.from(snap.snapshot, "utf8"),
          "text/plain",
          "browser",
        );
        res.json({
          ok: true,
          path: path.resolve(saved.path),
          filename,
          targetId: tab.targetId,
          url: tab.url,
        });
        return true;
      }
      res.json({
        ok: true,
        snapshot: snap.snapshot,
        targetId: tab.targetId,
        url: tab.url,
      });
      return true;
    }
    case "browser_click": {
      const ref = toStringOrEmpty(args.ref);
      if (!ref) {
        jsonError(res, 400, "ref is required");
        return true;
      }
      const doubleClick = toBoolean(args.doubleClick) ?? false;
      const button = toStringOrEmpty(args.button) || undefined;
      const modifiers = Array.isArray(args.modifiers)
        ? (args.modifiers as string[])
        : undefined;
      const tab = await ctx.ensureTabAvailable(target);
      await clickViaPlaywright({
        cdpPort,
        targetId: tab.targetId,
        ref,
        doubleClick,
        button,
        modifiers,
      });
      res.json({ ok: true, targetId: tab.targetId, url: tab.url });
      return true;
    }
    case "browser_drag": {
      const startRef = toStringOrEmpty(args.startRef);
      const endRef = toStringOrEmpty(args.endRef);
      if (!startRef || !endRef) {
        jsonError(res, 400, "startRef and endRef are required");
        return true;
      }
      const tab = await ctx.ensureTabAvailable(target);
      await dragViaPlaywright({
        cdpPort,
        targetId: tab.targetId,
        startRef,
        endRef,
      });
      res.json({ ok: true, targetId: tab.targetId });
      return true;
    }
    case "browser_hover": {
      const ref = toStringOrEmpty(args.ref);
      if (!ref) {
        jsonError(res, 400, "ref is required");
        return true;
      }
      const tab = await ctx.ensureTabAvailable(target);
      await hoverViaPlaywright({
        cdpPort,
        targetId: tab.targetId,
        ref,
      });
      res.json({ ok: true, targetId: tab.targetId });
      return true;
    }
    case "browser_select_option": {
      const ref = toStringOrEmpty(args.ref);
      const values = toStringArray(args.values);
      if (!ref || !values?.length) {
        jsonError(res, 400, "ref and values are required");
        return true;
      }
      const tab = await ctx.ensureTabAvailable(target);
      await selectOptionViaPlaywright({
        cdpPort,
        targetId: tab.targetId,
        ref,
        values,
      });
      res.json({ ok: true, targetId: tab.targetId });
      return true;
    }
    case "browser_tabs": {
      const action = toStringOrEmpty(args.action);
      const index = toNumber(args.index);
      if (!action) {
        jsonError(res, 400, "action is required");
        return true;
      }
      if (action === "list") {
        const reachable = await ctx.isReachable(300);
        if (!reachable) {
          res.json({ ok: true, tabs: [] });
          return true;
        }
        const tabs = await ctx.listTabs();
        res.json({ ok: true, tabs });
        return true;
      }
      if (action === "new") {
        await ctx.ensureBrowserAvailable();
        const tab = await ctx.openTab("about:blank");
        res.json({ ok: true, tab });
        return true;
      }
      if (action === "close") {
        const tabs = await ctx.listTabs();
        const targetTab = typeof index === "number" ? tabs[index] : tabs.at(0);
        if (!targetTab) {
          jsonError(res, 404, "tab not found");
          return true;
        }
        await ctx.closeTab(targetTab.targetId);
        res.json({ ok: true, targetId: targetTab.targetId });
        return true;
      }
      if (action === "select") {
        if (typeof index !== "number") {
          jsonError(res, 400, "index is required");
          return true;
        }
        const tabs = await ctx.listTabs();
        const targetTab = tabs[index];
        if (!targetTab) {
          jsonError(res, 404, "tab not found");
          return true;
        }
        await ctx.focusTab(targetTab.targetId);
        res.json({ ok: true, targetId: targetTab.targetId });
        return true;
      }
      jsonError(res, 400, "unknown tab action");
      return true;
    }
    case "browser_wait_for": {
      const time = toNumber(args.time);
      const text = toStringOrEmpty(args.text) || undefined;
      const textGone = toStringOrEmpty(args.textGone) || undefined;
      const tab = await ctx.ensureTabAvailable(target);
      await waitForViaPlaywright({
        cdpPort,
        targetId: tab.targetId,
        time,
        text,
        textGone,
      });
      res.json({ ok: true, targetId: tab.targetId });
      return true;
    }
    default:
      return false;
  }
}
