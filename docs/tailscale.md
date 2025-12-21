---
summary: "Integrated Tailscale Serve/Funnel for the Gateway dashboard"
read_when:
  - Exposing the Gateway Control UI outside localhost
  - Automating tailnet or public dashboard access
---
# Tailscale (Gateway dashboard)

Clawdis can auto-configure Tailscale **Serve** (tailnet) or **Funnel** (public) for the
Gateway dashboard and WebSocket port. This keeps the Gateway bound to loopback while
Tailscale provides HTTPS, routing, and (for Serve) identity headers.

## Modes

- `serve`: Tailnet-only HTTPS via `tailscale serve`. The gateway stays on `127.0.0.1`.
- `funnel`: Public HTTPS via `tailscale funnel`. Requires auth.
- `off`: Default (no Tailscale automation).

## Auth

Set `gateway.auth.mode` to control the handshake:

- `token` (default when `CLAWDIS_GATEWAY_TOKEN` is set)
- `password` (shared secret via `CLAWDIS_GATEWAY_PASSWORD` or config)
- `system` (PAM, validates your OS password)

When `tailscale.mode = "serve"`, the gateway trusts Tailscale identity headers by
default unless you force `gateway.auth.mode` to `password`/`system` or set
`gateway.auth.allowTailscale: false`.

## Config examples

### Tailnet-only (Serve)

```json5
{
  gateway: {
    bind: "loopback",
    tailscale: { mode: "serve" }
  }
}
```

Open: `https://<magicdns>/ui/`

### Public internet (Funnel + system password)

```json5
{
  gateway: {
    bind: "loopback",
    tailscale: { mode: "funnel" },
    auth: { mode: "system" }
  }
}
```

Open: `https://<magicdns>/ui/` (public)

### Public internet (Funnel + shared password)

```json5
{
  gateway: {
    bind: "loopback",
    tailscale: { mode: "funnel" },
    auth: { mode: "password", password: "replace-me" }
  }
}
```

Prefer `CLAWDIS_GATEWAY_PASSWORD` over committing a password to disk.

## CLI examples

```bash
clawdis gateway --tailscale serve
clawdis gateway --tailscale funnel --auth system
```

## Notes

- Tailscale Serve/Funnel requires the `tailscale` CLI to be installed and logged in.
- System auth uses the optional `authenticate-pam` native module; install if missing.
- `tailscale.mode: "funnel"` refuses to start without auth to avoid public exposure.
- Set `gateway.tailscale.resetOnExit` if you want Clawdis to undo `tailscale serve`
  or `tailscale funnel` configuration on shutdown.
