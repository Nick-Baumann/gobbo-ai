---
name: clawdis-browser
description: Control clawd's dedicated browser (tabs, snapshots, actions) via the clawdis CLI.
homepage: https://clawdis.ai
metadata: {"clawdis":{"emoji":"🧭","requires":{"config":["browser.enabled"]}}}
---

# Clawdis Browser

Use the clawd-managed Chrome/Chromium instance through `clawdis browser`.
Only available when `browser.enabled` is true.

Core flow
- `clawdis browser status`
- `clawdis browser start` (if stopped)
- `clawdis browser tabs`
- `clawdis browser open <url>`

Inspection
- `clawdis browser snapshot --format ai|aria [--limit N]`
- `clawdis browser screenshot [--full-page]`

Actions
- `clawdis browser click <ref>`
- `clawdis browser type <ref> "text" --submit`
- `clawdis browser press Enter`
- `clawdis browser navigate <url>`
- `clawdis browser wait --text "Done"`

Notes
- This is a dedicated profile; do not use the user's personal browser.
- If disabled, ask the user to enable `browser.enabled` in `~/.clawdis/clawdis.json`.
