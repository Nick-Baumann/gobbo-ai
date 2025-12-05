import type { CliDeps } from "../cli/deps.js";
import { info, success } from "../globals.js";
import type { RuntimeEnv } from "../runtime.js";
import { sendViaIpc } from "../web/ipc.js";

export async function sendCommand(
  opts: {
    to: string;
    message: string;
    json?: boolean;
    dryRun?: boolean;
    media?: string;
  },
  deps: CliDeps,
  runtime: RuntimeEnv,
) {
  if (opts.dryRun) {
    runtime.log(
      `[dry-run] would send via web -> ${opts.to}: ${opts.message}${opts.media ? ` (media ${opts.media})` : ""}`,
    );
    return;
  }

  // Try to send via IPC to running relay first (avoids Signal session corruption)
  const ipcResult = await sendViaIpc(opts.to, opts.message, opts.media);
  if (ipcResult) {
    if (ipcResult.success) {
      runtime.log(
        success(`✅ Sent via relay IPC. Message ID: ${ipcResult.messageId}`),
      );
      if (opts.json) {
        runtime.log(
          JSON.stringify(
            {
              provider: "web",
              via: "ipc",
              to: opts.to,
              messageId: ipcResult.messageId,
              mediaUrl: opts.media ?? null,
            },
            null,
            2,
          ),
        );
      }
      return;
    }
    // IPC failed but relay is running - warn and fall back
    runtime.log(
      info(
        `IPC send failed (${ipcResult.error}), falling back to direct connection`,
      ),
    );
  }

  // Fall back to direct connection (creates new Baileys socket)
  const res = await deps
    .sendMessageWeb(opts.to, opts.message, {
      verbose: false,
      mediaUrl: opts.media,
    })
    .catch((err) => {
      runtime.error(`❌ Web send failed: ${String(err)}`);
      throw err;
    });
  if (opts.json) {
    runtime.log(
      JSON.stringify(
        {
          provider: "web",
          via: "direct",
          to: opts.to,
          messageId: res.messageId,
          mediaUrl: opts.media ?? null,
        },
        null,
        2,
      ),
    );
  }
}
