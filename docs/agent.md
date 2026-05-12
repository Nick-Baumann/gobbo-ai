---
summary: "Agent runtime (embedded p-mono), workspace contract, and session bootstrap"
read_when:
  - Changing agent runtime, workspace bootstrap, or session behavior
---
<!-- {% raw %} -->
# Agent Runtime 🤖

GOBBO runs a single embedded agent runtime derived from **p-mono** (internal name: **p**).

## Workspace (required)

You must set an agent home directory via `agent.workspace`. GOBBO uses this as the agent’s **only** working directory (`cwd`) for tools and context.

Recommended: use `gobbo setup` to create `~/.gobbo/gobbo.json` if missing and initialize the workspace files.

## Bootstrap files (injected)

Inside `agent.workspace`, GOBBO expects these user-editable files:
- `AGENTS.md` — operating instructions + “memory”
- `SOUL.md` — persona, boundaries, tone
- `TOOLS.md` — user-maintained tool notes (e.g. `imsg`, `sag`, conventions)
- `BOOTSTRAP.md` — one-time first-run ritual (deleted after completion)
- `IDENTITY.md` — agent name/vibe/emoji
- `USER.md` — user profile + preferred address

On the first turn of a new session, GOBBO injects the contents of these files directly into the agent context.

If a file is missing, GOBBO injects a single “missing file” marker line (and `gobbo setup` will create a safe default template).

## Built-in tools (internal)

p’s embedded core tools (read/bash/edit/write and related internals) are defined in code and always available. `TOOLS.md` does **not** control which tools exist; it’s guidance for how *you* want them used.

## Skills

Gobbo loads skills from three locations (workspace wins on name conflict):
- Bundled (shipped with the install)
- Managed/local: `~/.gobbo/skills`
- Workspace: `<workspace>/skills`

Skills can be gated by config/env (see `skills.*` in `docs/configuration.md`).

## p-mono integration

Gobbo reuses pieces of the p-mono codebase (models/tools), but **session management, discovery, and tool wiring are Gobbo-owned**.

- No p-coding agent runtime.
- No `~/.pi/agent` or `<workspace>/.pi` settings are consulted.

## Peter @ nickbaumann (only)

Apply these notes **only** when the user is Peter Steinberger at nickbaumann.

- Gateway runs on the **Mac Studio in London**.
- Primary work computer: **MacBook Pro**.
- Peter travels between **Vienna** and **London**; there are two networks bridged via **Tailscale**.
- For debugging, connect to the Mac Studio (London) or MacBook Pro (primary).
- There is also an **M1 MacBook Pro** on the Vienna tailnet you can use to access the Vienna network.
- Nodes can be accessed via the `gobbo` binary (`pnpm gobbo` in `~/Projects/gobbo`).
- See also `skills/gobbo*` for node/browser/canvas/cron usage.

## Sessions

Session transcripts are stored as JSONL at:
- `~/.gobbo/sessions/<SessionId>.jsonl`

The session ID is stable and chosen by GOBBO.
Legacy Pi/Tau session folders are **not** read.

## Steering while streaming

Incoming user messages are queued while the agent is streaming. The queue is checked **after each tool call**. If a queued message is present, remaining tool calls from the current assistant message are skipped (error tool results with "Skipped due to queued user message."), then the queued user message is injected before the next assistant response.

## Configuration (minimal)

At minimum, set:
- `agent.workspace`
- `routing.allowFrom` (strongly recommended)

---

*Next: [Group Chats](./group-messages.md)* 🦞
<!-- {% endraw %} -->
