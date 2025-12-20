---
name: peekaboo
description: Capture and automate macOS UI with the Peekaboo CLI.
metadata: {"clawdis":{"requires":{"bins":["peekaboo"]},"install":[{"id":"brew","kind":"brew","formula":"steipete/tap/peekaboo","bins":["peekaboo"],"label":"Install Peekaboo (brew)"}]}}
---

# Peekaboo

Peekaboo is a full macOS UI automation CLI: capture/inspect screens, target UI
elements, drive input, and manage apps/windows/menus. Commands share a snapshot
cache and most support `--json-output` for scripting. Run `peekaboo` or
`peekaboo <cmd> --help` for flags; `peekaboo --version` prints build metadata.
Tip: run via `polter peekaboo` to ensure fresh builds.

## Features (all CLI capabilities, excluding agent/MCP)

Core
- `bridge`: inspect Peekaboo Bridge host connectivity
- `capture`: live capture or video ingest + frame extraction
- `clean`: prune snapshot cache and temp files
- `config`: init/show/edit/validate, providers, models, credentials
- `image`: capture screenshots (screen/window/menu bar regions)
- `learn`: print the full agent guide + tool catalog
- `list`: apps, windows, screens, menubar, permissions
- `permissions`: check Screen Recording/Accessibility status
- `run`: execute `.peekaboo.json` scripts
- `sleep`: pause execution for a duration
- `tools`: list available tools with filtering/display options

Interaction
- `click`: target by ID/query/coords with smart waits
- `drag`: drag & drop across elements/coords/Dock
- `hotkey`: modifier combos like `cmd,shift,t`
- `move`: cursor positioning with optional smoothing
- `paste`: set clipboard → paste → restore
- `press`: special-key sequences with repeats
- `scroll`: directional scrolling (targeted + smooth)
- `swipe`: gesture-style drags between targets
- `type`: text + control keys (`--clear`, delays)

System
- `app`: launch/quit/relaunch/hide/unhide/switch/list apps
- `clipboard`: read/write clipboard (text/images/files)
- `dialog`: click/input/file/dismiss/list system dialogs
- `dock`: launch/right-click/hide/show/list Dock items
- `menu`: click/list application menus + menu extras
- `menubar`: list/click status bar items
- `open`: enhanced `open` with app targeting + JSON payloads
- `space`: list/switch/move-window (Spaces)
- `visualizer`: exercise Peekaboo visual feedback animations
- `window`: close/minimize/maximize/move/resize/focus/list

Vision
- `see`: annotated UI maps, snapshot IDs, optional analysis

Global runtime flags
- `--json`/`-j`, `--verbose`/`-v`, `--log-level <level>`
- `--no-remote`, `--bridge-socket <path>`

Notes
- Requires Screen Recording + Accessibility permissions.
- Use `peekaboo see --annotate` to identify targets before clicking.
