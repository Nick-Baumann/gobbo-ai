---
name: gog
description: Google Workspace CLI for Gmail, Calendar, Drive, and Contacts.
homepage: https://gogcli.sh
metadata: {"clawdis":{"emoji":"🎮","requires":{"bins":["gog"]},"install":[{"id":"brew","kind":"brew","formula":"steipete/tap/gogcli","bins":["gog"],"label":"Install gog (brew)"}]}}
---

# gog

Use `gog` for Gmail/Calendar/Drive/Contacts. Requires OAuth setup.

Setup (once)
- `gog auth credentials /path/to/client_secret.json`
- `gog auth add you@gmail.com --services gmail,calendar,drive,contacts`
- `gog auth list`

Common commands
- Gmail search: `gog gmail search 'newer_than:7d' --max 10`
- Gmail send: `gog gmail send --to a@b.com --subject "Hi" --body "Hello"`
- Calendar: `gog calendar events <calendarId> --from <iso> --to <iso>`
- Drive: `gog drive search "query" --max 10`
- Contacts: `gog contacts list --max 20`

Notes
- Set `GOG_ACCOUNT=you@gmail.com` to avoid repeating `--account`.
- Confirm before sending mail or creating events.
