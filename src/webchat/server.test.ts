import type { AddressInfo } from "node:net";
import { describe, expect, test } from "vitest";
import { WebSocket } from "ws";
import {
  __forceWebChatSnapshotForTests,
  startWebChatServer,
  stopWebChatServer,
} from "./server.js";

async function getFreePort(): Promise<number> {
  const { createServer } = await import("node:net");
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      const port = address.port as number;
      server.close((err: Error | null) => (err ? reject(err) : resolve(port)));
    });
  });
}

type SnapshotMessage = {
  type?: string;
  snapshot?: { stateVersion?: { presence?: number } };
};
type SessionMessage = { type?: string };

describe("webchat server", () => {
  test(
    "hydrates snapshot to new sockets (offline mock)",
    { timeout: 8000 },
    async () => {
      const wPort = await getFreePort();
      await startWebChatServer(wPort, undefined, { disableGateway: true });
      const ws = new WebSocket(
        `ws://127.0.0.1:${wPort}/webchat/socket?session=test`,
      );
      const messages: unknown[] = [];
      ws.on("message", (data) => {
        try {
          messages.push(JSON.parse(String(data)));
        } catch {
          /* ignore */
        }
      });

      try {
        await new Promise<void>((resolve) => ws.once("open", resolve));

        __forceWebChatSnapshotForTests({
          presence: [],
          health: {},
          stateVersion: { presence: 1, health: 1 },
          uptimeMs: 0,
        });

        const waitFor = async <T>(
          pred: (m: unknown) => m is T,
          label: string,
        ): Promise<T> => {
          const start = Date.now();
          while (Date.now() - start < 3000) {
            const found = messages.find((m): m is T => {
              try {
                return pred(m);
              } catch {
                return false;
              }
            });
            if (found) return found;
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
          throw new Error(`timeout waiting for ${label}`);
        };

        const isSessionMessage = (m: unknown): m is SessionMessage =>
          typeof m === "object" &&
          m !== null &&
          (m as SessionMessage).type === "session";
        const isSnapshotMessage = (m: unknown): m is SnapshotMessage =>
          typeof m === "object" &&
          m !== null &&
          (m as SnapshotMessage).type === "gateway-snapshot";

        await waitFor(isSessionMessage, "session");
        const snap = await waitFor(isSnapshotMessage, "snapshot");
        expect(snap.snapshot?.stateVersion?.presence).toBe(1);
      } finally {
        ws.close();
        await stopWebChatServer();
      }
    },
  );
});
