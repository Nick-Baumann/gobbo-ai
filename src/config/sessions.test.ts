import { describe, expect, it } from "vitest";

import { deriveSessionKey, resolveSessionKey } from "./sessions.js";

describe("sessions", () => {
  it("returns normalized per-sender key", () => {
    expect(deriveSessionKey("per-sender", { From: "whatsapp:+1555" })).toBe(
      "+1555",
    );
  });

  it("falls back to unknown when sender missing", () => {
    expect(deriveSessionKey("per-sender", {})).toBe("unknown");
  });

  it("global scope returns global", () => {
    expect(deriveSessionKey("global", { From: "+1" })).toBe("global");
  });

  it("keeps group chats distinct", () => {
    expect(deriveSessionKey("per-sender", { From: "12345-678@g.us" })).toBe(
      "group:12345-678@g.us",
    );
  });

  it("collapses direct chats to main by default", () => {
    expect(resolveSessionKey("per-sender", { From: "+1555" })).toBe("main");
  });

  it("collapses direct chats to main even when sender missing", () => {
    expect(resolveSessionKey("per-sender", {})).toBe("main");
  });

  it("maps direct chats to main key when provided", () => {
    expect(
      resolveSessionKey("per-sender", { From: "whatsapp:+1555" }, "main"),
    ).toBe("main");
  });

  it("uses custom main key when provided", () => {
    expect(resolveSessionKey("per-sender", { From: "+1555" }, "primary")).toBe(
      "primary",
    );
  });

  it("keeps global scope untouched", () => {
    expect(resolveSessionKey("global", { From: "+1555" })).toBe("global");
  });

  it("leaves groups untouched even with main key", () => {
    expect(
      resolveSessionKey("per-sender", { From: "12345-678@g.us" }, "main"),
    ).toBe("group:12345-678@g.us");
  });
});
