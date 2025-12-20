import type { Command } from "commander";

import { danger } from "../globals.js";
import { defaultRuntime } from "../runtime.js";
import { registerBrowserActionInputCommands } from "./browser-cli-actions-input.js";
import { registerBrowserActionObserveCommands } from "./browser-cli-actions-observe.js";
import {
  browserActionExamples,
  browserCoreExamples,
} from "./browser-cli-examples.js";
import { registerBrowserInspectCommands } from "./browser-cli-inspect.js";
import { registerBrowserManageCommands } from "./browser-cli-manage.js";

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
      `\nExamples:\n  ${[...browserCoreExamples, ...browserActionExamples].join("\n  ")}\n`,
    )
    .action(() => {
      browser.outputHelp();
      defaultRuntime.error(
        danger('Missing subcommand. Try: "clawdis browser status"'),
      );
      defaultRuntime.exit(1);
    });

  const parentOpts = (cmd: Command) =>
    cmd.parent?.opts?.() as { url?: string; json?: boolean };

  registerBrowserManageCommands(browser, parentOpts);
  registerBrowserInspectCommands(browser, parentOpts);
  registerBrowserActionInputCommands(browser, parentOpts);
  registerBrowserActionObserveCommands(browser, parentOpts);
}
