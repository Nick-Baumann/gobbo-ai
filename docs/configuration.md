---
summary: "All configuration options for ~/.clawdis/clawdis.json with examples"
read_when:
  - Adding or modifying config fields
---
# Configuration 🔧

CLAWDIS uses a JSON configuration file at `~/.clawdis/clawdis.json`.

## Minimal Config

```json
{
  "inbound": {
    "allowFrom": ["+15555550123"],
    "reply": {
      "mode": "command",
      "command": ["tau", "{{Body}}"]
    }
  }
}
```

## Full Configuration

```json
{
  "logging": {
    "level": "info",
    "file": "/tmp/clawdis/clawdis.log"
  },
  "inbound": {
    "allowFrom": [
      "+15555550123",
      "+447700900123"
    ],
    "groupChat": {
      "requireMention": true,
      "mentionPatterns": [
        "@clawd",
        "clawdbot",
        "clawd"
      ],
      "historyLimit": 50
    },
    "timestampPrefix": "Europe/London",
    "reply": {
      "mode": "command",
      "agent": {
        "kind": "pi",
        "format": "json",
        "model": "claude-opus-4-5",
        "contextTokens": 200000
      },
      "cwd": "/Users/you/clawd",
      "command": [
        "tau",
        "--mode", "json",
        "{{BodyStripped}}"
      ],
      "session": {
        "scope": "per-sender",
        "idleMinutes": 10080,
        "sessionIntro": "You are Clawd. Be a good lobster."
      },
      "heartbeatMinutes": 10,
      "heartbeatBody": "HEARTBEAT",
      "timeoutSeconds": 1800
    }
  }
}
```

## Configuration Options

### `logging`

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `level` | string | `"info"` | Log level: trace, debug, info, warn, error |
| `file` | string | `/tmp/clawdis/clawdis.log` | Log file path |

### `inbound.allowFrom`

Array of E.164 phone numbers allowed to trigger the AI. Use `["*"]` to allow everyone (dangerous!).

```json
"allowFrom": ["+15555550123", "+447700900123"]
```

### `inbound.groupChat`

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `requireMention` | boolean | `true` | Only respond when mentioned |
| `mentionPatterns` | string[] | `[]` | Regex patterns that trigger response |
| `historyLimit` | number | `50` | Max messages to include as context |

### `inbound.reply`

| Key | Type | Description |
|-----|------|-------------|
| `mode` | string | `"command"` for CLI agents |
| `command` | string[] | Command and args. Use `{{Body}}` for message |
| `cwd` | string | Working directory for the agent |
| `timeoutSeconds` | number | Max time for agent to respond |
| `heartbeatMinutes` | number | Interval for heartbeat pings |
| `heartbeatBody` | string | Message sent on heartbeat |
| `agent.kind` | string | Only `"pi"` is supported |
| `agent.model` | string | Optional model name to annotate sessions (defaults to `claude-opus-4-5`) |
| `agent.contextTokens` | number | Optional context window size; used for session token % reporting (defaults to ~200,000 for Opus 4.5) |

> Quick start: If you omit `inbound.reply`, CLAWDIS falls back to the bundled `@mariozechner/pi-coding-agent` with `--mode rpc`, per-sender sessions, and a 200k-token window. No extra install or config needed to get a reply.

### `cron`

Cron is a Gateway-owned scheduler for wakeups and scheduled jobs. See `docs/cron.md` for the full RFC and CLI examples.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `enabled` | boolean | `true` | Enable the cron scheduler inside the Gateway (set to `false` to disable) |
| `store` | string | `~/.clawdis/cron/jobs.json` | Override the cron job store path |
| `maxConcurrentRuns` | number | `1` | Max concurrent isolated cron runs (command-queue lane `"cron"`) |

Run history:
- The Gateway appends a JSONL run ledger on each job completion (see `docs/cron.md`). Location is derived from `cron.store` / the resolved store path.

Example:

```json5
{
  cron: {
    enabled: true,
    maxConcurrentRuns: 2
  }
}
```

### Template Variables

Use these in your command:

| Variable | Description |
|----------|-------------|
| `{{Body}}` | Full message body |
| `{{BodyStripped}}` | Message without mention |
| `{{From}}` | Sender phone number |
| `{{SessionId}}` | Current session UUID |

## Session Configuration

```json
"session": {
  "scope": "per-sender",
  "resetTriggers": ["/new"],
  "idleMinutes": 10080,
  "sessionIntro": "You are Clawd.",
  "sessionArgNew": ["--session", "{{SessionId}}.jsonl"],
  "sessionArgResume": ["--session", "{{SessionId}}.jsonl", "--continue"]
}
```

| Key | Type | Description |
|-----|------|-------------|
| `scope` | string | `"per-sender"` or `"global"` |
| `resetTriggers` | string[] | Messages that start a new session |
| `idleMinutes` | number | Session timeout |
| `sessionIntro` | string | System prompt for new sessions |

## Environment Variables

Some settings can also be set via environment:

```bash
export CLAWDIS_LOG_LEVEL=debug
export CLAWDIS_CONFIG_PATH=~/.clawdis/clawdis.json
```

## Migrating from Clawdis

If you're upgrading from the old `clawdis` name:

```bash
# Move config
mv ~/.clawdis ~/.clawdis
mv ~/.clawdis/clawdis.json ~/.clawdis/clawdis.json

# Update any hardcoded paths in your config
sed -i '' 's/clawdis/clawdis/g' ~/.clawdis/clawdis.json
```

---

*Next: [Agent Integration](./agents.md)* 🦞
