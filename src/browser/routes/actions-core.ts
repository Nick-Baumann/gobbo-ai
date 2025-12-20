import type express from "express";

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
  typeViaPlaywright,
  waitForViaPlaywright,
} from "../pw-ai.js";
import type { BrowserRouteContext } from "../server-context.js";
import {
  jsonError,
  toBoolean,
  toNumber,
  toStringArray,
  toStringOrEmpty,
} from "./utils.js";

export type BrowserActionCore =
  | "back"
  | "click"
  | "close"
  | "dialog"
  | "drag"
  | "evaluate"
  | "fill"
  | "hover"
  | "navigate"
  | "press"
  | "resize"
  | "run"
  | "select"
  | "type"
  | "upload"
  | "wait";

type ActionCoreParams = {
  action: BrowserActionCore;
  args: Record<string, unknown>;
  targetId: string;
  cdpPort: number;
  ctx: BrowserRouteContext;
  res: express.Response;
};

export async function handleBrowserActionCore(
  params: ActionCoreParams,
): Promise<boolean> {
  const { action, args, targetId, cdpPort, ctx, res } = params;
  const target = targetId || undefined;

  switch (action) {
    case "close": {
      const tab = await ctx.ensureTabAvailable(target);
      await closePageViaPlaywright({ cdpPort, targetId: tab.targetId });
      res.json({ ok: true, targetId: tab.targetId, url: tab.url });
      return true;
    }
    case "resize": {
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
    case "dialog": {
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
    case "evaluate": {
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
    case "upload": {
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
    case "fill": {
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
    case "press": {
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
    case "type": {
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
    case "navigate": {
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
    case "back": {
      const tab = await ctx.ensureTabAvailable(target);
      const result = await navigateBackViaPlaywright({
        cdpPort,
        targetId: tab.targetId,
      });
      res.json({ ok: true, targetId: tab.targetId, ...result });
      return true;
    }
    case "run": {
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
    case "click": {
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
    case "drag": {
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
    case "hover": {
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
    case "select": {
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
    case "wait": {
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
