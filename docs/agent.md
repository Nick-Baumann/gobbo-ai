---
summary: "Agent runtime (embedded Pi), workspace contract, and session bootstrap"
read_when:
  - Changing agent runtime, workspace bootstrap, or session behavior
---
<!-- {% raw %} -->
# Agent Runtime 🤖

CLAWDIS runs a single agent runtime: **Pi (embedded, in-process)**.

## Workspace (required)

You must set an agent home directory via `inbound.workspace`. CLAWDIS uses this as the agent’s **only** working directory (`cwd`) for tools and context.

Recommended: use `clawdis setup` to create `~/.clawdis/clawdis.json` if missing and initialize the workspace files.

## Bootstrap files (injected)

Inside `inbound.workspace`, CLAWDIS expects these user-editable files:
- `AGENTS.md` — operating instructions + “memory”
- `SOUL.md` — persona, boundaries, tone
- `TOOLS.md` — user-maintained tool notes (e.g. `imsg`, `sag`, conventions)
- `BOOTSTRAP.md` — one-time first-run ritual (deleted after completion)
- `IDENTITY.md` — agent name/vibe/emoji
- `USER.md` — user profile + preferred address

On the first turn of a new session, CLAWDIS injects the contents of these files directly into the agent context.

If a file is missing, CLAWDIS injects a single “missing file” marker line (and `clawdis setup` will create a safe default template).

## Built-in tools (internal)

Pi’s embedded core tools (read/bash/edit/write and related internals) are defined in code and always available. `TOOLS.md` does **not** control which tools exist; it’s guidance for how *you* want them used.

## Skills

Clawdis loads skills from three locations (workspace wins on name conflict):
- Bundled (shipped with the install)
- Managed/local: `~/.clawdis/skills`
- Workspace: `<workspace>/skills`

Skills can be gated by config/env (see `skills.*` in `docs/configuration.md`).

## SDK integration

The embedded agent uses the `@mariozechner/pi-coding-agent` SDK for sessions and discovery.
- Hooks, custom tools, and slash commands are discovered via the SDK (from `~/.pi/agent` and `<workspace>/.pi` settings).
- Bootstrap files are injected as SDK project context (see “Project Context” in the system prompt).

## Peter @ steipete (only)

Apply these notes **only** when the user is Peter Steinberger at steipete.

- Gateway runs on the **Mac Studio in London**.
- Primary work computer: **MacBook Pro**.
- Peter travels between **Vienna** and **London**; there are two networks bridged via **Tailscale**.
- For debugging, connect to the Mac Studio (London) or MacBook Pro (primary).
- There is also an **M1 MacBook Pro** on the Vienna tailnet you can use to access the Vienna network.
- Nodes can be accessed via the `clawdis` binary (`pnpm clawdis` in `~/Projects/clawdis`).
- See also `skills/clawdis*` for node/browser/canvas/cron usage.

## Sessions

Session transcripts are stored as JSONL at:
- `~/.clawdis/sessions/<SessionId>.jsonl`

The session ID is stable and chosen by CLAWDIS.

## Steering while streaming

Incoming user messages are queued while the agent is streaming. The queue is checked **after each tool call**. If a queued message is present, remaining tool calls from the current assistant message are skipped (error tool results with "Skipped due to queued user message."), then the queued user message is injected before the next assistant response.

## Configuration (minimal)

At minimum, set:
- `inbound.workspace`
- `inbound.allowFrom` (strongly recommended)

---

*Next: [Group Chats](./group-messages.md)* 🦞
<!-- {% endraw %} -->
