import { afterEach, describe, expect, it, vi } from "vitest";

import { buildStatusMessage } from "./status.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildStatusMessage", () => {
  it("summarizes agent readiness and context usage", () => {
    const text = buildStatusMessage({
      reply: {
        mode: "command",
        command: ["echo", "{{Body}}"],
        agent: { kind: "pi", model: "pi:opus", contextTokens: 32_000 },
        session: { scope: "per-sender" },
      },
      sessionEntry: {
        sessionId: "abc",
        updatedAt: 0,
        totalTokens: 16_000,
        contextTokens: 32_000,
        thinkingLevel: "low",
        verboseLevel: "on",
      },
      sessionKey: "main",
      sessionScope: "per-sender",
      storePath: "/tmp/sessions.json",
      resolvedThink: "medium",
      resolvedVerbose: "off",
      now: 10 * 60_000, // 10 minutes later
      webLinked: true,
      webAuthAgeMs: 5 * 60_000,
      heartbeatSeconds: 45,
    });

    expect(text).toContain("⚙️ Status");
    expect(text).toContain("Agent: ready");
    expect(text).toContain("Context: 16k/32k (50%)");
    expect(text).toContain("Session: main");
    expect(text).toContain("Web: linked");
    expect(text).toContain("heartbeat 45s");
    expect(text).toContain("thinking=medium");
    expect(text).toContain("verbose=off");
  });

  it("handles missing agent command gracefully", () => {
    const text = buildStatusMessage({
      reply: {
        mode: "command",
        command: [],
        session: { scope: "per-sender" },
      },
      sessionScope: "per-sender",
      webLinked: false,
    });

    expect(text).toContain("Agent: check");
    expect(text).toContain("not set");
    expect(text).toContain("Context:");
    expect(text).toContain("Web: not linked");
  });
});
