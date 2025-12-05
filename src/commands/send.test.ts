import { describe, expect, it, vi } from "vitest";

import type { CliDeps } from "../cli/deps.js";
import type { RuntimeEnv } from "../runtime.js";
import { sendCommand } from "./send.js";

const sendViaIpcMock = vi.fn().mockResolvedValue(null);
vi.mock("../web/ipc.js", () => ({
  sendViaIpc: (...args: unknown[]) => sendViaIpcMock(...args),
}));

const runtime: RuntimeEnv = {
  log: vi.fn(),
  error: vi.fn(),
  exit: vi.fn(() => {
    throw new Error("exit");
  }),
};

const makeDeps = (overrides: Partial<CliDeps> = {}): CliDeps => ({
  sendMessageWeb: vi.fn(),
  ...overrides,
});

describe("sendCommand", () => {
  it("skips send on dry-run", async () => {
    const deps = makeDeps();
    await sendCommand(
      {
        to: "+1",
        message: "hi",
        dryRun: true,
      },
      deps,
      runtime,
    );
    expect(deps.sendMessageWeb).not.toHaveBeenCalled();
  });

  it("uses IPC when available", async () => {
    sendViaIpcMock.mockResolvedValueOnce({ success: true, messageId: "ipc1" });
    const deps = makeDeps();
    await sendCommand(
      {
        to: "+1",
        message: "hi",
      },
      deps,
      runtime,
    );
    expect(deps.sendMessageWeb).not.toHaveBeenCalled();
    expect(runtime.log).toHaveBeenCalledWith(expect.stringContaining("ipc1"));
  });

  it("falls back to direct send when IPC fails", async () => {
    sendViaIpcMock.mockResolvedValueOnce({ success: false, error: "nope" });
    const deps = makeDeps({
      sendMessageWeb: vi.fn().mockResolvedValue({ messageId: "direct1" }),
    });
    await sendCommand(
      {
        to: "+1",
        message: "hi",
        media: "pic.jpg",
      },
      deps,
      runtime,
    );
    expect(deps.sendMessageWeb).toHaveBeenCalled();
  });

  it("emits json output", async () => {
    sendViaIpcMock.mockResolvedValueOnce(null);
    const deps = makeDeps({
      sendMessageWeb: vi.fn().mockResolvedValue({ messageId: "direct2" }),
    });
    await sendCommand(
      {
        to: "+1",
        message: "hi",
        json: true,
      },
      deps,
      runtime,
    );
    expect(runtime.log).toHaveBeenCalledWith(
      expect.stringContaining('"provider": "web"'),
    );
  });
});
