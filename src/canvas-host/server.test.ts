import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { defaultRuntime } from "../runtime.js";
import { injectCanvasLiveReload, startCanvasHost } from "./server.js";

describe("canvas host", () => {
  it("injects live reload script", () => {
    const out = injectCanvasLiveReload("<html><body>Hello</body></html>");
    expect(out).toContain("/__clawdis/ws");
    expect(out).toContain("location.reload");
    expect(out).toContain("clawdisCanvasA2UIAction");
    expect(out).toContain("clawdisSendUserAction");
  });

  it("creates a default index.html when missing", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "clawdis-canvas-"));

    const server = await startCanvasHost({
      runtime: defaultRuntime,
      rootDir: dir,
      port: 0,
      listenHost: "127.0.0.1",
      allowInTests: true,
    });

    try {
      const res = await fetch(`http://127.0.0.1:${server.port}/`);
      const html = await res.text();
      expect(res.status).toBe(200);
      expect(html).toContain("Interactive test page");
      expect(html).toContain("clawdisSendUserAction");
      expect(html).toContain("/__clawdis/ws");
    } finally {
      await server.close();
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("serves HTML with injection and broadcasts reload on file changes", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "clawdis-canvas-"));
    const index = path.join(dir, "index.html");
    await fs.writeFile(index, "<html><body>v1</body></html>", "utf8");

    const server = await startCanvasHost({
      runtime: defaultRuntime,
      rootDir: dir,
      port: 0,
      listenHost: "127.0.0.1",
      allowInTests: true,
    });

    try {
      const res = await fetch(`http://127.0.0.1:${server.port}/`);
      const html = await res.text();
      expect(res.status).toBe(200);
      expect(html).toContain("v1");
      expect(html).toContain("/__clawdis/ws");

      const ws = new WebSocket(`ws://127.0.0.1:${server.port}/__clawdis/ws`);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("ws open timeout")),
          2000,
        );
        ws.on("open", () => {
          clearTimeout(timer);
          resolve();
        });
        ws.on("error", (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });

      const msg = new Promise<string>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("reload timeout")),
          4000,
        );
        ws.on("message", (data) => {
          clearTimeout(timer);
          resolve(String(data));
        });
      });

      await fs.writeFile(index, "<html><body>v2</body></html>", "utf8");
      expect(await msg).toBe("reload");
      ws.close();
    } finally {
      await server.close();
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
