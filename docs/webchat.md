---
summary: "Loopback WebChat server and SSH tunnel usage for chat UI"
read_when:
  - Debugging or configuring WebChat access
---
# WebChat (loopback + SSH tunnel)

Updated: 2025-12-09

## What it is
- A local web UI for chatting with the Gateway.
- Static assets served by the WebChat HTTP server (default port **18788**, configurable).
- The WebChat backend holds a single WebSocket connection to the Gateway (`ws://127.0.0.1:18789` by default) for all control/data: history fetch, sends, agent runs, presence.
- Trust model: access is granted by being on localhost or inside your SSH/Tailscale tunnel. No additional auth prompts once you can reach the box.
- `webchat.gatewayPort` config can point at a non-default Gateway port if needed.

## Endpoints
- UI is now served at the root: `http://127.0.0.1:<port>/` (legacy `/webchat/` still works).
- `GET /webchat/info?session=<key>` (alias `/info`) → `{ port, sessionId, initialMessages, basePath }` plus history from the Gateway session store.
- `GET /` (or `/webchat/*`) → static assets.
- `POST /webchat/rpc` (alias `/rpc`) → proxies a chat/agent action through the Gateway connection and returns `{ ok, payloads?, error? }`.

## How it connects
- On startup, the WebChat server dials the Gateway WebSocket and performs the mandatory `hello` handshake; the `hello-ok` snapshot seeds presence + health immediately.
- All outgoing sends/agent calls are requests on that WS; streamed events (`agent`, `presence`, `tick`) are forwarded to the browser client.
- If a seq gap is detected in Gateway events, WebChat auto-refreshes health + presence and broadcasts a `gateway-refresh` to connected browsers.
- If the Gateway WS is unavailable, WebChat fails fast and surfaces the error in the UI.

## Remote use
- SSH tunnel example: `ssh -N -L 18788:127.0.0.1:18788 -L 18789:127.0.0.1:18789 user@host`.
- Browse to `http://127.0.0.1:18788/webchat/?session=<key>` through the tunnel; the backend WS also rides the tunnel.

## Config
- `webchat.enabled` (default true)
- `webchat.port` (default 18788)
- Gateway WS port is set by `clawdis gateway --port`; WebChat expects it at 18789 unless overridden.

## Failure handling
- Clear UI error when the Gateway handshake fails or the WS drops.
- WebChat does not attempt fallback transports; the Gateway WS is required.

## Dev notes
- Assets live in `apps/macos/Sources/Clawdis/Resources/WebChat`.
- Server implementation: `src/webchat/server.ts`.
- macOS glue: `WebChatWindow.swift` + `WebChatTunnel` for SSH -L helpers.
