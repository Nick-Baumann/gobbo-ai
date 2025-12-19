import type { Command } from "commander";

import {
  browserClickRef,
  browserCloseTab,
  browserDom,
  browserEval,
  browserFocusTab,
  browserOpenTab,
  browserQuery,
  browserScreenshot,
  browserSnapshot,
  browserStart,
  browserStatus,
  browserStop,
  browserTabs,
  browserTool,
  resolveBrowserControlUrl,
} from "../browser/client.js";
import { danger, info } from "../globals.js";
import { defaultRuntime } from "../runtime.js";

export function registerBrowserCli(program: Command) {
  const browser = program
    .command("browser")
    .description("Manage clawd's dedicated browser (Chrome/Chromium)")
    .option(
      "--url <url>",
      "Override browser control URL (default from ~/.clawdis/clawdis.json)",
    )
    .option("--json", "Output machine-readable JSON", false)
    .addHelpText(
      "after",
      `
Examples:
  clawdis browser status
  clawdis browser start
  clawdis browser tabs
  clawdis browser open https://example.com
  clawdis browser screenshot                # emits MEDIA:<path>
  clawdis browser screenshot <targetId> --full-page
  clawdis browser eval "location.href"
  clawdis browser query "a" --limit 5
  clawdis browser dom --format text --max-chars 5000
  clawdis browser snapshot --format aria --limit 200
  clawdis browser snapshot --format ai
  clawdis browser click 76
  clawdis browser tool browser_file_upload --args '{"paths":["/tmp/file.txt"]}'
`,
    )
    .action(() => {
      defaultRuntime.error(
        danger('Missing subcommand. Try: "clawdis browser status"'),
      );
      defaultRuntime.exit(1);
    });

  const parentOpts = (cmd: Command) =>
    cmd.parent?.opts?.() as { url?: string; json?: boolean };

  browser
    .command("status")
    .description("Show browser status")
    .action(async (_opts, cmd) => {
      const parent = parentOpts(cmd);
      const baseUrl = resolveBrowserControlUrl(parent?.url);
      try {
        const status = await browserStatus(baseUrl);
        if (parent?.json) {
          defaultRuntime.log(JSON.stringify(status, null, 2));
          return;
        }
        defaultRuntime.log(
          [
            `enabled: ${status.enabled}`,
            `running: ${status.running}`,
            `controlUrl: ${status.controlUrl}`,
            `cdpPort: ${status.cdpPort}`,
            `browser: ${status.chosenBrowser ?? "unknown"}`,
            `profileColor: ${status.color}`,
          ].join("\n"),
        );
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  browser
    .command("start")
    .description("Start the clawd browser (no-op if already running)")
    .action(async (_opts, cmd) => {
      const parent = parentOpts(cmd);
      const baseUrl = resolveBrowserControlUrl(parent?.url);
      try {
        await browserStart(baseUrl);
        const status = await browserStatus(baseUrl);
        if (parent?.json) {
          defaultRuntime.log(JSON.stringify(status, null, 2));
          return;
        }
        defaultRuntime.log(info(`🦞 clawd browser running: ${status.running}`));
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  browser
    .command("stop")
    .description("Stop the clawd browser (best-effort)")
    .action(async (_opts, cmd) => {
      const parent = parentOpts(cmd);
      const baseUrl = resolveBrowserControlUrl(parent?.url);
      try {
        await browserStop(baseUrl);
        const status = await browserStatus(baseUrl);
        if (parent?.json) {
          defaultRuntime.log(JSON.stringify(status, null, 2));
          return;
        }
        defaultRuntime.log(info(`🦞 clawd browser running: ${status.running}`));
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  browser
    .command("tabs")
    .description("List open tabs")
    .action(async (_opts, cmd) => {
      const parent = parentOpts(cmd);
      const baseUrl = resolveBrowserControlUrl(parent?.url);
      try {
        const tabs = await browserTabs(baseUrl);
        if (parent?.json) {
          defaultRuntime.log(JSON.stringify({ tabs }, null, 2));
          return;
        }
        if (tabs.length === 0) {
          defaultRuntime.log("No tabs (browser closed or no targets).");
          return;
        }
        defaultRuntime.log(
          tabs
            .map(
              (t, i) =>
                `${i + 1}. ${t.title || "(untitled)"}\n   ${t.url}\n   id: ${t.targetId}`,
            )
            .join("\n"),
        );
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  browser
    .command("open")
    .description("Open a URL in a new tab")
    .argument("<url>", "URL to open")
    .action(async (url: string, cmd) => {
      const parent = parentOpts(cmd);
      const baseUrl = resolveBrowserControlUrl(parent?.url);
      try {
        const tab = await browserOpenTab(baseUrl, url);
        if (parent?.json) {
          defaultRuntime.log(JSON.stringify(tab, null, 2));
          return;
        }
        defaultRuntime.log(`opened: ${tab.url}\nid: ${tab.targetId}`);
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  browser
    .command("focus")
    .description("Focus a tab by target id (or unique prefix)")
    .argument("<targetId>", "Target id or unique prefix")
    .action(async (targetId: string, cmd) => {
      const parent = parentOpts(cmd);
      const baseUrl = resolveBrowserControlUrl(parent?.url);
      try {
        await browserFocusTab(baseUrl, targetId);
        if (parent?.json) {
          defaultRuntime.log(JSON.stringify({ ok: true }, null, 2));
          return;
        }
        defaultRuntime.log(`focused tab ${targetId}`);
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  browser
    .command("close")
    .description("Close a tab by target id (or unique prefix)")
    .argument("<targetId>", "Target id or unique prefix")
    .action(async (targetId: string, cmd) => {
      const parent = parentOpts(cmd);
      const baseUrl = resolveBrowserControlUrl(parent?.url);
      try {
        await browserCloseTab(baseUrl, targetId);
        if (parent?.json) {
          defaultRuntime.log(JSON.stringify({ ok: true }, null, 2));
          return;
        }
        defaultRuntime.log(`closed tab ${targetId}`);
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  browser
    .command("screenshot")
    .description("Capture a screenshot (MEDIA:<path>)")
    .argument("[targetId]", "CDP target id (or unique prefix)")
    .option("--full-page", "Capture full scrollable page", false)
    .action(async (targetId: string | undefined, opts, cmd) => {
      const parent = parentOpts(cmd);
      const baseUrl = resolveBrowserControlUrl(parent?.url);
      try {
        const result = await browserScreenshot(baseUrl, {
          targetId: targetId?.trim() || undefined,
          fullPage: Boolean(opts.fullPage),
        });
        if (parent?.json) {
          defaultRuntime.log(JSON.stringify(result, null, 2));
          return;
        }
        defaultRuntime.log(`MEDIA:${result.path}`);
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  browser
    .command("eval")
    .description("Run JavaScript in the active tab")
    .argument("<js>", "JavaScript expression")
    .option("--target-id <id>", "CDP target id (or unique prefix)")
    .option("--await", "Await promise result", false)
    .action(async (js: string, opts, cmd) => {
      const parent = parentOpts(cmd);
      const baseUrl = resolveBrowserControlUrl(parent?.url);
      try {
        const result = await browserEval(baseUrl, {
          js,
          targetId: opts.targetId?.trim() || undefined,
          awaitPromise: Boolean(opts.await),
        });
        if (parent?.json) {
          defaultRuntime.log(JSON.stringify(result, null, 2));
          return;
        }
        defaultRuntime.log(JSON.stringify(result.result, null, 2));
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  browser
    .command("query")
    .description("Query selector matches")
    .argument("<selector>", "CSS selector")
    .option("--target-id <id>", "CDP target id (or unique prefix)")
    .option("--limit <n>", "Max matches (default: 20)", (v: string) =>
      Number(v),
    )
    .action(async (selector: string, opts, cmd) => {
      const parent = parentOpts(cmd);
      const baseUrl = resolveBrowserControlUrl(parent?.url);
      try {
        const result = await browserQuery(baseUrl, {
          selector,
          targetId: opts.targetId?.trim() || undefined,
          limit: Number.isFinite(opts.limit) ? opts.limit : undefined,
        });
        if (parent?.json) {
          defaultRuntime.log(JSON.stringify(result, null, 2));
          return;
        }
        defaultRuntime.log(JSON.stringify(result.matches, null, 2));
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  browser
    .command("dom")
    .description("Dump DOM (html or text) with truncation")
    .option("--format <html|text>", "Output format (default: html)", "html")
    .option("--target-id <id>", "CDP target id (or unique prefix)")
    .option("--selector <css>", "Optional CSS selector to scope the dump")
    .option(
      "--max-chars <n>",
      "Max characters (default: 200000)",
      (v: string) => Number(v),
    )
    .option("--out <path>", "Write output to a file")
    .action(async (opts, cmd) => {
      const parent = parentOpts(cmd);
      const baseUrl = resolveBrowserControlUrl(parent?.url);
      const format = opts.format === "text" ? "text" : "html";
      try {
        const result = await browserDom(baseUrl, {
          format,
          targetId: opts.targetId?.trim() || undefined,
          maxChars: Number.isFinite(opts.maxChars) ? opts.maxChars : undefined,
          selector: opts.selector?.trim() || undefined,
        });
        if (opts.out) {
          const fs = await import("node:fs/promises");
          await fs.writeFile(opts.out, result.text, "utf8");
          if (parent?.json) {
            defaultRuntime.log(
              JSON.stringify({ ok: true, out: opts.out }, null, 2),
            );
          } else {
            defaultRuntime.log(opts.out);
          }
          return;
        }
        if (parent?.json) {
          defaultRuntime.log(JSON.stringify(result, null, 2));
          return;
        }
        defaultRuntime.log(result.text);
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  browser
    .command("snapshot")
    .description("Capture an AI-friendly snapshot (aria, domSnapshot, or ai)")
    .option(
      "--format <aria|domSnapshot|ai>",
      "Snapshot format (default: aria)",
      "aria",
    )
    .option("--target-id <id>", "CDP target id (or unique prefix)")
    .option("--limit <n>", "Max nodes (default: 500/800)", (v: string) =>
      Number(v),
    )
    .option("--out <path>", "Write snapshot to a file")
    .action(async (opts, cmd) => {
      const parent = parentOpts(cmd);
      const baseUrl = resolveBrowserControlUrl(parent?.url);
      const format =
        opts.format === "domSnapshot"
          ? "domSnapshot"
          : opts.format === "ai"
            ? "ai"
            : "aria";
      try {
        const result = await browserSnapshot(baseUrl, {
          format,
          targetId: opts.targetId?.trim() || undefined,
          limit: Number.isFinite(opts.limit) ? opts.limit : undefined,
        });

        if (opts.out) {
          const fs = await import("node:fs/promises");
          if (result.format === "ai") {
            await fs.writeFile(opts.out, result.snapshot, "utf8");
          } else {
            const payload = JSON.stringify(result, null, 2);
            await fs.writeFile(opts.out, payload, "utf8");
          }
          if (parent?.json) {
            defaultRuntime.log(
              JSON.stringify({ ok: true, out: opts.out }, null, 2),
            );
          } else {
            defaultRuntime.log(opts.out);
          }
          return;
        }

        if (parent?.json) {
          defaultRuntime.log(JSON.stringify(result, null, 2));
          return;
        }

        if (result.format === "ai") {
          defaultRuntime.log(result.snapshot);
          return;
        }

        if (result.format === "domSnapshot") {
          defaultRuntime.log(JSON.stringify(result, null, 2));
          return;
        }

        const nodes = "nodes" in result ? result.nodes : [];
        defaultRuntime.log(
          nodes
            .map((n) => {
              const indent = "  ".repeat(Math.min(20, n.depth));
              const name = n.name ? ` "${n.name}"` : "";
              const value = n.value ? ` = "${n.value}"` : "";
              return `${indent}- ${n.role}${name}${value}`;
            })
            .join("\n"),
        );
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  browser
    .command("click")
    .description("Click an element by ref from an ai snapshot (e.g. 76)")
    .argument("<ref>", "Ref id from ai snapshot")
    .option("--target-id <id>", "CDP target id (or unique prefix)")
    .action(async (ref: string, opts, cmd) => {
      const parent = parentOpts(cmd);
      const baseUrl = resolveBrowserControlUrl(parent?.url);
      try {
        const result = await browserClickRef(baseUrl, {
          ref,
          targetId: opts.targetId?.trim() || undefined,
        });
        if (parent?.json) {
          defaultRuntime.log(JSON.stringify(result, null, 2));
          return;
        }
        defaultRuntime.log(`clicked ref ${ref} on ${result.url}`);
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  browser
    .command("tool")
    .description("Call a Playwright MCP-style browser tool by name")
    .argument("<name>", "Tool name (browser_*)")
    .option("--args <json>", "JSON arguments for the tool")
    .option("--target-id <id>", "CDP target id (or unique prefix)")
    .action(async (name: string, opts, cmd) => {
      const parent = parentOpts(cmd);
      const baseUrl = resolveBrowserControlUrl(parent?.url);
      let args: Record<string, unknown> = {};
      if (opts.args) {
        try {
          args = JSON.parse(String(opts.args));
        } catch (err) {
          defaultRuntime.error(
            danger(`Invalid JSON for --args: ${String(err)}`),
          );
          defaultRuntime.exit(1);
        }
      }
      try {
        const result = await browserTool(baseUrl, {
          name,
          args,
          targetId: opts.targetId?.trim() || undefined,
        });
        if (parent?.json) {
          defaultRuntime.log(JSON.stringify(result, null, 2));
          return;
        }
        defaultRuntime.log(JSON.stringify(result, null, 2));
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });
}
