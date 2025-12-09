import { describe, expect, test } from "vitest";
import { emitAgentEvent, onAgentEvent } from "./agent-events.js";

describe("agent-events sequencing", () => {
  test("maintains monotonic seq per runId", async () => {
    const seen: Record<string, number[]> = {};
    const stop = onAgentEvent((evt) => {
      const list = seen[evt.runId] ?? [];
      seen[evt.runId] = list;
      list.push(evt.seq);
    });

    emitAgentEvent({ runId: "run-1", stream: "job", data: {} });
    emitAgentEvent({ runId: "run-1", stream: "job", data: {} });
    emitAgentEvent({ runId: "run-2", stream: "job", data: {} });
    emitAgentEvent({ runId: "run-1", stream: "job", data: {} });

    stop();

    expect(seen["run-1"]).toEqual([1, 2, 3]);
    expect(seen["run-2"]).toEqual([1]);
  });
});
