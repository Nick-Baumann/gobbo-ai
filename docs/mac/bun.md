# Host Node/Bun runtime (mac app)

Date: 2025-12-08 · Owner: steipete · Scope: packaged mac app runtime

## What we require
- The mac menu-bar app no longer ships an embedded runtime. We expect **Node ≥22.0.0 or Bun ≥1.3.0** to be present on the host.
- The bundle still carries `dist/` output, production `node_modules/`, and the root `package.json`/`pnpm-lock.yaml` so we avoid on-device installs; we simply reuse the host runtime.
- Launchd jobs export a PATH that includes `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Users/steipete/Library/pnpm` so Homebrew/PNPM installs are found even under the minimal launchd environment.

## Build/packaging flow
- Run `scripts/package-mac-app.sh`.
  - Ensures deps via `pnpm install`, builds JS with `pnpm exec tsc`, then builds the Swift app.
  - Stages `dist/`, production `node_modules`, and metadata into `Contents/Resources/Relay/` (no bundled bun binary).
  - Prunes optional tooling and non-macOS sharp vendors; only `sharp-darwin-arm64` + `sharp-libvips-darwin-arm64` remain for size/signing.
- Architecture: **arm64 only**. Host runtime must also be arm64 or Rosetta-compatible.

## Runtime behavior
- `CommandResolver` picks the runtime via `CLAWDIS_RUNTIME` (`bun`/`node`) or defaults to Bun then Node; it enforces the version gates and prints a clear error (with PATH) if requirements are not met.
- Relay processes run inside the bundled relay directory so native deps resolve, but the runtime itself comes from the host.

## Testing the bundle
- After packaging: `cd dist/Clawdis.app/Contents/Resources/Relay && bun dist/index.js --help` **or** `node dist/index.js --help` should print CLI help. If you see a runtime error, install/upgrade Node or Bun on the host.
- If sharp fails to load, confirm the remaining `@img/sharp-darwin-arm64` + `@img/sharp-libvips-darwin-arm64` directories exist and are codesigned.

## Notes / limits
- Dev/CI continues to use pnpm + Node; the packaged app simply reuses the host runtime instead of embedding Bun.
- Missing or too-old runtimes will surface as an immediate CLI error with install hints; update the host rather than rebuilding the app.
