import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  type BrowserConsoleMessage,
  type BrowserNetworkRequest,
  ensurePageState,
  getPageForTargetId,
  refLocator,
} from "./pw-session.js";

const STATIC_RESOURCE_TYPES = new Set(["image", "font", "stylesheet", "media"]);

const tracingContexts = new WeakSet<unknown>();

function consolePriority(level: string) {
  switch (level) {
    case "error":
      return 3;
    case "warning":
      return 2;
    case "info":
    case "log":
      return 1;
    case "debug":
      return 0;
    default:
      return 1;
  }
}

export async function startTracingViaPlaywright(opts: {
  cdpPort: number;
  targetId?: string;
}): Promise<void> {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  const context = page.context();
  if (tracingContexts.has(context)) throw new Error("Tracing already started");
  await context.tracing.start({
    screenshots: true,
    snapshots: true,
    sources: true,
  });
  tracingContexts.add(context);
}

export async function stopTracingViaPlaywright(opts: {
  cdpPort: number;
  targetId?: string;
}): Promise<{ buffer: Buffer }> {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  const context = page.context();
  if (!tracingContexts.has(context)) throw new Error("Tracing not started");
  const fileName = `clawd-trace-${crypto.randomUUID()}.zip`;
  const filePath = path.join(os.tmpdir(), fileName);
  await context.tracing.stop({ path: filePath });
  tracingContexts.delete(context);
  const buffer = await fs.readFile(filePath);
  await fs.rm(filePath).catch(() => {});
  return { buffer };
}

export async function getConsoleMessagesViaPlaywright(opts: {
  cdpPort: number;
  targetId?: string;
  level?: string;
}): Promise<BrowserConsoleMessage[]> {
  const page = await getPageForTargetId(opts);
  const state = ensurePageState(page);
  if (!opts.level) return [...state.console];
  const min = consolePriority(opts.level);
  return state.console.filter((msg) => consolePriority(msg.type) >= min);
}

export async function getNetworkRequestsViaPlaywright(opts: {
  cdpPort: number;
  targetId?: string;
  includeStatic?: boolean;
}): Promise<BrowserNetworkRequest[]> {
  const page = await getPageForTargetId(opts);
  const state = ensurePageState(page);
  if (opts.includeStatic) return [...state.network];
  return state.network.filter(
    (req) => !req.resourceType || !STATIC_RESOURCE_TYPES.has(req.resourceType),
  );
}

export async function mouseMoveViaPlaywright(opts: {
  cdpPort: number;
  targetId?: string;
  x: number;
  y: number;
}): Promise<void> {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  await page.mouse.move(opts.x, opts.y);
}

export async function mouseClickViaPlaywright(opts: {
  cdpPort: number;
  targetId?: string;
  x: number;
  y: number;
  button?: "left" | "right" | "middle";
}): Promise<void> {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  await page.mouse.click(opts.x, opts.y, {
    button: opts.button,
  });
}

export async function mouseDragViaPlaywright(opts: {
  cdpPort: number;
  targetId?: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}): Promise<void> {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  await page.mouse.move(opts.startX, opts.startY);
  await page.mouse.down();
  await page.mouse.move(opts.endX, opts.endY);
  await page.mouse.up();
}

export async function verifyElementVisibleViaPlaywright(opts: {
  cdpPort: number;
  targetId?: string;
  role: string;
  accessibleName: string;
}): Promise<void> {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  const locator = page.getByRole(opts.role as never, {
    name: opts.accessibleName,
  });
  if ((await locator.count()) === 0) throw new Error("element not found");
  if (!(await locator.first().isVisible()))
    throw new Error("element not visible");
}

export async function verifyTextVisibleViaPlaywright(opts: {
  cdpPort: number;
  targetId?: string;
  text: string;
}): Promise<void> {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  const locator = page.getByText(opts.text).filter({ visible: true });
  if ((await locator.count()) === 0) throw new Error("text not found");
}

export async function verifyListVisibleViaPlaywright(opts: {
  cdpPort: number;
  targetId?: string;
  ref: string;
  items: string[];
}): Promise<void> {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  const locator = refLocator(page, opts.ref);
  for (const item of opts.items) {
    const itemLocator = locator.getByText(item);
    if ((await itemLocator.count()) === 0)
      throw new Error(`item "${item}" not found`);
  }
}

export async function verifyValueViaPlaywright(opts: {
  cdpPort: number;
  targetId?: string;
  ref: string;
  type: string;
  value: string;
}): Promise<void> {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  const locator = refLocator(page, opts.ref);
  if (opts.type === "checkbox" || opts.type === "radio") {
    const checked = await locator.isChecked();
    const expected = opts.value === "true";
    if (checked !== expected)
      throw new Error(`expected ${opts.value}, got ${String(checked)}`);
    return;
  }
  const value = await locator.inputValue();
  if (value !== opts.value)
    throw new Error(`expected ${opts.value}, got ${value}`);
}

export function generateLocatorForRef(ref: string) {
  return `locator('aria-ref=${ref}')`;
}
