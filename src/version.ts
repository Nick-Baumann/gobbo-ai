import { createRequire } from "node:module";

declare const __GOBBO_VERSION__: string | undefined;

function readVersionFromPackageJson(): string | null {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require("../package.json") as { version?: string };
    return pkg.version ?? null;
  } catch {
    return null;
  }
}

// Single source of truth for the current gobbo version.
// - Embedded/bundled builds: injected define or env var.
// - Dev/npm builds: package.json.
export const VERSION =
  (typeof __GOBBO_VERSION__ === "string" && __GOBBO_VERSION__) ||
  process.env.GOBBO_BUNDLED_VERSION ||
  readVersionFromPackageJson() ||
  "0.0.0";
