# mac signing (debug builds)

This app is usually built from `scripts/package-mac-app.sh`, which now:

- sets a stable debug bundle identifier: `com.steipete.clawdis.debug`
- writes the Info.plist with that bundle id (override via `BUNDLE_ID=...`)
- calls `scripts/codesign-mac-app.sh` to sign the main binary, bundled CLI, and app bundle so macOS treats each rebuild as the same signed bundle and keeps TCC permissions (notifications, accessibility, screen recording, mic, speech). Defaults to ad‑hoc; set `SIGN_IDENTITY="Developer ID Application: …"` to use a real cert.
- injects build metadata into Info.plist: `ClawdisBuildTimestamp` (UTC) and `ClawdisGitCommit` (short hash) so the About pane can show build, git, and debug/release channel.

## Usage

```bash
# from repo root
scripts/package-mac-app.sh               # ad-hoc signing
SIGN_IDENTITY="Developer ID Application: Your Name" scripts/package-mac-app.sh   # real cert
```

If you need a different bundle id (e.g. release build):

```bash
BUNDLE_ID=com.steipete.clawdis scripts/package-mac-app.sh
```

## Build metadata for About

`package-mac-app.sh` stamps the bundle with:
- `ClawdisBuildTimestamp`: ISO8601 UTC at package time
- `ClawdisGitCommit`: short git hash (or `unknown` if unavailable)

The About tab reads these keys to show version, build date, git commit, and whether it’s a debug build (via `#if DEBUG`). Run the packager to refresh these values after code changes.

## Why

TCC permissions are tied to the bundle identifier *and* code signature. Unsigned debug builds with changing UUIDs were causing macOS to forget grants after each rebuild. Signing the binaries (ad‑hoc by default) and keeping a fixed bundle id/path (`dist/Clawdis.app`) preserves the grants between builds, matching the VibeTunnel approach.
