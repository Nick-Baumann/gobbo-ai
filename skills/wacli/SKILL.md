---
name: wacli
description: WhatsApp CLI for sync, search, and sending messages.
homepage: https://wacli.sh
metadata: {"clawdis":{"emoji":"📱","requires":{"bins":["wacli"]},"install":[{"id":"go","kind":"go","module":"github.com/steipete/wacli/cmd/wacli@latest","bins":["wacli"],"label":"Install wacli (go)"}]}}
---

# wacli

Use `wacli` for WhatsApp sync/search/send via WhatsApp Web protocol.

Auth + sync
- `wacli auth` (QR login + initial sync)
- `wacli sync --follow` (continuous sync)
- `wacli doctor`

Search + history
- `wacli messages search "query"`
- `wacli history backfill --chat <jid> --requests 5 --count 50`

Send
- Text: `wacli send text --to 1234567890 --message "hello"`
- File: `wacli send file --to 1234567890 --file /path/pic.jpg --caption "hi"`

Notes
- Store dir: `~/.wacli` (override with `--store`).
- Backfill requires your phone online; results are best-effort.
- Confirm recipient + message before sending.
