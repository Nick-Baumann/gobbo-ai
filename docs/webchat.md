# Web Chat architecture (local + remote)

Date: 2025-12-08 · Status: draft plan

## Goal
- Serve the Clawdis Web Chat UI from the Node relay (loopback-only HTTP), while the macOS app keeps the same UX by embedding it in a WKWebView.
- Keep remote mode working: when Clawdis runs on a remote host via SSH, the mac app should still show the web chat backed by that remote relay (via an SSH tunnel).

## Proposed architecture
1) **Server location**
   - A tiny HTTP server lives in the Node relay process.
   - Bind to 127.0.0.1 on a chosen port (fixed or random with discovery endpoint).
   - Serve static assets for `/webchat/` and a JSON RPC endpoint for sending messages.

2) **Endpoints**
   - `GET /webchat/*`: serves bundled web assets (current WebChat build, moved from mac bundle into the Node package, e.g., `src/webchat/dist`).
   - `GET /webchat/info`: returns `{ baseUrl, token? }` for the mac app to embed (token optional; see security below).
   - `POST /webchat/rpc`: accepts `{ text, session, thinking?, deliver?, to? }` and replies with `{ ok, payloads?, error? }`. Internally calls the same agent pipeline that `clawdis rpc` uses today (in-process, no subprocess).
   - (Optional) `GET /webchat/history?session=<key>`: returns pre-serialized message history so the mac app doesn’t scrape JSONL. Can be folded into `/webchat/info` as an `initialMessages` field.

3) **Sessions & history**
   - Use the relay’s own session store (default `~/.clawdis/sessions/sessions.json` on the relay host). No SSH file reads from the mac app anymore.
   - When the page loads, it receives `initialMessages` from the server (either embedded in `info` or via a history endpoint).
   - Remote mode automatically shows the remote session because the remote relay owns that store.

4) **Mac app embedding**
   - On WebChatWindow init, the mac app calls `/webchat/info`:
     - Local mode: directly over loopback (127.0.0.1:port chosen by relay).
     - Remote mode: establish/reuse an SSH tunnel forwarding the relay’s webchat port to a local ephemeral port, then call `/webchat/info` through the tunnel and load the returned `baseUrl`.
   - WKWebView loads `baseUrl` (e.g., `http://127.0.0.1:<forward>/webchat/`).
   - Web page sends messages to `/webchat/rpc` (same origin as the static assets), so no extra mac plumbing.

5) **Security**
   - Bind to loopback only. For extra hardening, issue a random short-lived token in `/webchat/info` and require it as a header/query on `/webchat/rpc` and history.
   - Remote mode relies on SSH port forwarding; no WAN exposure.

6) **Failure handling**
   - If `/webchat/info` fails, show an in-app error (“Web chat server unreachable”).
   - Log the chosen port/URL and tunnel target in mac logs for debugging.
   - History fetch failures fall back to an empty transcript but keep sending enabled.

7) **Migration steps**
   - Move WebChat bundle into the Node project (e.g., `src/webchat/dist`) and serve statically.
   - Add the loopback HTTP server and `/webchat` routes to the relay startup.
   - Expose `/webchat/info` (port + token + optional initialMessages).
   - Mac app: replace local asset load with the fetched `baseUrl`; use SSH tunnel in remote mode.
   - Remove mac-side JSONL scraping and `AgentRPC` usage for web chat; keep other agent uses intact.
   - Tests: webchat loads + sends in local and remote modes; tunnel discovery works; history returns non-empty when sessions exist.

8) **Current behavior (for reference, to be replaced)**
   - Mac app reads remote session files over SSH (`clawdis sessions --json`, then `cat` the `.jsonl`) and injects history; sends via `clawdis rpc` subprocess. This document tracks the plan to move both pieces into the relay server instead.

## Open questions
- Fixed port vs random per run? (Random + info endpoint is safer.)
- Token enforcement default on/off? (Recommended on when remote tunneling isn’t used.)
- Should `/webchat/rpc` also expose typing/streaming? (Nice-to-have; not required for parity.)
