import { beforeEach, describe, expect, it, vi } from "vitest";

const sendCommand = vi.fn();
const statusCommand = vi.fn();
const loginWeb = vi.fn();
const startWebChatServer = vi.fn(async () => ({ port: 18788 }));
const ensureWebChatServerFromConfig = vi.fn(async () => ({ port: 18788 }));

const runtime = {
  log: vi.fn(),
  error: vi.fn(),
  exit: vi.fn(() => {
    throw new Error("exit");
  }),
};

vi.mock("../commands/send.js", () => ({ sendCommand }));
vi.mock("../commands/status.js", () => ({ statusCommand }));
vi.mock("../runtime.js", () => ({ defaultRuntime: runtime }));
vi.mock("../provider-web.js", () => ({
  loginWeb,
}));
vi.mock("../webchat/server.js", () => ({
  startWebChatServer,
  ensureWebChatServerFromConfig,
  getWebChatServer: () => null,
}));
vi.mock("./deps.js", () => ({
  createDefaultDeps: () => ({}),
}));

const { buildProgram } = await import("./program.js");

describe("cli program", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs send with required options", async () => {
    const program = buildProgram();
    await program.parseAsync(["send", "--to", "+1", "--message", "hi"], {
      from: "user",
    });
    expect(sendCommand).toHaveBeenCalled();
  });

  it("runs status command", async () => {
    const program = buildProgram();
    await program.parseAsync(["status"], { from: "user" });
    expect(statusCommand).toHaveBeenCalled();
  });

  it("starts webchat server and prints json", async () => {
    const program = buildProgram();
    runtime.log.mockClear();
    await program.parseAsync(["webchat", "--json"], { from: "user" });
    expect(startWebChatServer).toHaveBeenCalled();
    expect(runtime.log).toHaveBeenCalledWith(
      JSON.stringify({ port: 18788, basePath: "/webchat/", host: "127.0.0.1" }),
    );
  });
});
