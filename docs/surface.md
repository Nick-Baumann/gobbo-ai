# Surfaces & Routing

Updated: 2025-12-07

Goal: make replies deterministic per channel while keeping one shared context for direct chats.

- **Surfaces** (channel labels): `whatsapp`, `webchat`, `telegram`, `voice`, etc. Add `Surface` to inbound `MsgContext` so templates/agents can log which channel a turn came from. Routing is fixed: replies go back to the origin surface; the model doesn’t choose.
- **Canonical direct session:** All direct chats collapse into the single `main` session by default (no config needed). Groups stay `group:<jid>`, so they remain isolated.
- **Session store:** Keys are resolved via `resolveSessionKey(scope, ctx, mainKey)`; the Tau JSONL path still lives under `~/.clawdis/sessions/<SessionId>.jsonl`.
- **WebChat:** Always attaches to `main`, loads the full Tau transcript so desktop reflects cross-surface history, and writes new turns back to the same session.
- **Implementation hints:**
  - Set `Surface` in each ingress (WhatsApp relay, WebChat bridge, future Telegram). 
  - Keep routing deterministic: originate → same surface. Use IPC/web senders accordingly.
  - Do not let the agent emit “send to X” decisions; keep that policy in the host code.
