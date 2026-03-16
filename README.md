<p align="center">
  <img src="https://cdn.prod.website-files.com/69082c5061a39922df8ed3b6/69b88b355cf35e13745104a0_Mar%2016%2C%202026%2C%2010_58_53%20PM.png" alt="CLAWDIS" width="140" />
</p>

<h1 align="center">CLAWDIS</h1>

<p align="center">
  <strong>Multi-Surface Autonomous AI Assistant -- Always On, Always Local, Always Listening.</strong>
  <br/>
  <em>stay connected.</em>
</p>

<p align="center">
  <a href="https://x.com/clawdisAI"><img src="https://img.shields.io/badge/Twitter-@clawdisAI-1DA1F2?style=flat-square&logo=x&logoColor=white" alt="Twitter" /></a>
  <a href="https://x.com/belimad"><img src="https://img.shields.io/badge/Creator-@belimad-1DA1F2?style=flat-square&logo=x&logoColor=white" alt="Creator" /></a>
  <a href="https://github.com/mbelinky"><img src="https://img.shields.io/badge/GitHub-mbelinky-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub" /></a>
  <img src="https://img.shields.io/badge/Node-%E2%89%A522-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node 22+" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Platform-macOS%20%7C%20iOS%20%7C%20Android-999?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="MIT" />
</p>

<p align="center">
  <code>Contract Address: 2yDL2okKMtkxtSomVWVfr6Y8JDBuidRX3e4Qx8hBBAGS</code>
</p>

---

## Abstract

Clawdis is a single-user, multi-surface AI assistant runtime designed to operate as a persistent control plane across every device you own. Unlike cloud-hosted assistants that route your data through third-party servers, Clawdis runs locally on your hardware -- your Mac Mini, your iPhone, your Android device -- and connects to you through the messaging surfaces you already use: WhatsApp, Telegram, Discord, and native apps.

The architecture is built around a central Gateway that owns all state, sessions, and provider routing. Every other component -- iOS nodes, Android nodes, CLI tools, WebChat, voice pipelines -- connects as a thin client over WebSocket or TCP Bridge. The result is an assistant that feels like a single entity across every surface, with shared memory, shared context, and zero cloud dependency for the control plane.

---

## Architecture

```
                        Messaging Surfaces
                    (WhatsApp / Telegram / Discord)
                               |
                               v
        +----------------------------------------------+
        |              GATEWAY (Control Plane)         |
        |          ws://127.0.0.1:18789                |
        |                                              |
        |  +----------+  +----------+  +------------+ |
        |  | Session  |  | Provider |  | Cron        | |
        |  | Manager  |  | Router   |  | Scheduler   | |
        |  +----------+  +----------+  +------------+ |
        |  +----------+  +----------+  +------------+ |
        |  | Presence |  | Voice    |  | Idempotency | |
        |  | Engine   |  | Wake     |  | Cache       | |
        |  +----------+  +----------+  +------------+ |
        +------------------+---------------------------+
                           |
              +------------+------------+
              |            |            |
              v            v            v
        +---------+  +---------+  +-----------+
        | macOS   |  |  iOS    |  | Android   |
        | Menu Bar|  |  Node   |  | Node      |
        | + Voice |  | +Canvas |  | +Camera   |
        | + Web   |  | +Voice  |  | +Screen   |
        +---------+  +---------+  +-----------+
              |            |            |
              v            v            v
        +----------------------------------------------+
        |           TCP BRIDGE (Optional)              |
        |     Newline-delimited JSON / RPC frames      |
        |     tcp://0.0.0.0:18790                      |
        +----------------------------------------------+
```

---

## Gateway Internals

The Gateway is the single source of truth. Every session, every provider binding, every cron job, every voice wake event flows through it. Nothing else owns state.

### Frame Validation Pipeline

All WebSocket frames are validated at ingress against TypeBox schemas via AJV. The first frame on any connection must be `connect`. Malformed frames are rejected before they reach the handler layer.

```typescript
// src/gateway/protocol/validate.ts
import { Type, Static } from '@sinclair/typebox';
import Ajv from 'ajv';

const ConnectFrame = Type.Object({
  type: Type.Literal('connect'),
  clientId: Type.String({ minLength: 1 }),
  capabilities: Type.Array(Type.String()),
  version: Type.String({ pattern: '^\\d+\\.\\d+\\.\\d+$' }),
});

const SendFrame = Type.Object({
  type: Type.Literal('send'),
  to: Type.String(),
  message: Type.String({ maxLength: 16384 }),
  idempotencyKey: Type.String({ format: 'uuid' }),
});

type ConnectPayload = Static<typeof ConnectFrame>;
type SendPayload = Static<typeof SendFrame>;

const ajv = new Ajv({ allErrors: true, coerceTypes: false });
const validators = {
  connect: ajv.compile(ConnectFrame),
  send: ajv.compile(SendFrame),
} as const;

export function validateFrame(raw: unknown): { valid: boolean; errors?: string[] } {
  const type = (raw as any)?.type;
  const validator = validators[type as keyof typeof validators];
  if (!validator) return { valid: false, errors: ['Unknown frame type: ' + type] };
  const valid = validator(raw);
  return valid ? { valid: true } : { valid: false, errors: validator.errors?.map(e => e.message!) };
}
```

### Idempotency Layer

Every mutation (`send`, `agent`, `chat.send`) requires an idempotency key. The Gateway maintains a TTL cache (5 min, cap 1000) to prevent double-sends on reconnects or retries. Duplicate keys return the cached response without re-execution.

```typescript
// src/gateway/idempotency.ts
interface CacheEntry {
  result: unknown;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 1000;

export function checkIdempotency(key: string): CacheEntry | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry;
}

export function recordIdempotency(key: string, result: unknown): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = [...cache.entries()]
      .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  cache.set(key, { result, timestamp: Date.now() });
}
```

### Event System

The Gateway emits structured events over WebSocket to all connected surfaces. Handshake returns a full snapshot (presence map, health status, active sessions), then streams incremental events in real time.

| Event Type | Payload | Trigger |
|------------|---------|---------|
| `agent` | Response chunks, tool calls, thinking | Agent invocation |
| `chat` | Message delivered/received | Inbound or outbound message |
| `presence` | Node connect/disconnect, surface status | Bridge state change |
| `tick` | Cron execution result | Scheduled task fires |
| `health` | CPU, memory, uptime, provider latency | Periodic (30s) |
| `voicewake.changed` | Wake word config update | Settings mutation |
| `node.pair.*` | Pairing request/confirm/reject | Node discovery |

---

## Multi-Surface Routing

Clawdis treats every messaging platform as a thin transport layer. The routing engine normalizes inbound messages into a canonical format, dispatches to the agent runtime, and routes responses back through the originating surface.

```typescript
// src/gateway/router.ts
interface CanonicalMessage {
  surface: 'whatsapp' | 'telegram' | 'discord' | 'webchat' | 'voice';
  senderId: string;
  content: string;
  mediaUrls?: string[];
  groupId?: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}

interface RouteDecision {
  allow: boolean;
  reason?: string;
  activationMode: 'always' | 'mention';
  sessionId: string;
}

export function routeInbound(
  msg: CanonicalMessage, config: RoutingConfig
): RouteDecision {
  if (!config.allowFrom.includes(msg.senderId)) {
    return {
      allow: false,
      reason: 'sender_not_allowlisted',
      activationMode: 'mention',
      sessionId: '',
    };
  }

  if (msg.groupId) {
    const groupConfig = config.groups?.[msg.groupId];
    const mode = groupConfig?.activation ?? 'mention';
    const mentioned = msg.content.includes('@' + config.botName);
    if (mode === 'mention' && !mentioned) {
      return {
        allow: false,
        reason: 'mention_required',
        activationMode: mode,
        sessionId: '',
      };
    }
  }

  const sessionId = resolveSession(msg.surface, msg.senderId, msg.groupId);
  return { allow: true, activationMode: 'always', sessionId };
}
```

---

## Node Runtime (iOS / Android)

Companion devices connect as nodes via the TCP Bridge. Each node advertises its capabilities on handshake and receives `invoke` commands from the Gateway.

```typescript
// Capability advertisement (node handshake)
{
  type: 'hello',
  nodeId: 'iphone-14-pro',
  platform: 'ios',
  capabilities: ['canvas', 'screen', 'camera', 'voiceWake'],
  version: '1.2.0',
  pairingToken: 'keychain://clawdis.pairing.token'
}
```

### Canvas Runtime

The Canvas is a live visual workspace rendered in a WKWebView (iOS) or WebView (Android). The Gateway can push arbitrary HTML/JS/CSS to the Canvas surface via the A2UI postMessage bridge, enabling real-time data visualization, interactive controls, and agent-driven UI generation.

```typescript
// Canvas command flow
// Gateway -> Bridge -> Node -> WKWebView

// Agent pushes a live dashboard
{
  type: 'invoke',
  command: 'canvas.render',
  payload: {
    html: '<div id="metrics">...</div>',
    js: 'setInterval(() => fetch("/health").then(render), 5000)',
    snapshot: true
  }
}
```

---

## Voice Pipeline

Voice wake detection runs locally on macOS and iOS. Audio is processed on-device -- no cloud STT for the wake word. Once triggered, the transcript is forwarded to the Gateway as a `voice.transcript` event, which dispatches to the agent runtime.

```
Microphone -> Local VAD -> Wake Word Detection -> On-Device STT
                                                       |
                                                       v
                                              voice.transcript event
                                                       |
                                                       v
                                              Gateway -> Agent Runtime
```

The voice pipeline supports both continuous wake word listening and push-to-talk overlay mode. Configuration is synced across nodes via `voicewake.get` and `voicewake.changed` events.

---

## Agent Runtime

The agent operates within a sandboxed workspace rooted at `~/clawd`. Injected prompt files (`AGENTS.md`, `SOUL.md`, `TOOLS.md`) define the agent's identity, capabilities, and behavioral constraints. Skills are loaded from `~/clawd/skills/<skill>/SKILL.md`.

```
~/clawd/
  AGENTS.md          # Identity and behavioral directives
  SOUL.md            # Personality and response style
  TOOLS.md           # Available tool definitions
  skills/
    browser/
      SKILL.md       # Browser automation skill
    media/
      SKILL.md       # Media processing skill
    search/
      SKILL.md       # Search and retrieval skill
  memory/
    sessions.json    # Persistent session state
    context.json     # Long-term memory store
```

---

## Configuration

Minimal setup -- single file at `~/.clawdis/clawdis.json`:

```json5
{
  routing: {
    allowFrom: ["+1234567890"],
    botName: "clawdis"
  },
  agent: {
    workspace: "~/clawd",
    thinking: "high",
    provider: "anthropic"
  },
  gateway: {
    port: 18789,
    bind: "loopback"    // loopback | lan | tailnet | auto
  },
  bridge: {
    enabled: true,
    port: 18790
  },
  telegram: {
    botToken: "env:TELEGRAM_BOT_TOKEN"
  },
  discord: {
    token: "env:DISCORD_BOT_TOKEN"
  },
  browser: {
    enabled: true,
    controlUrl: "http://127.0.0.1:18791"
  }
}
```

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/mbelinky/clawdis.git
cd clawdis
pnpm install && pnpm build && pnpm ui:build

# Link WhatsApp (stores creds in ~/.clawdis/credentials)
pnpm clawdis login

# Start the Gateway
pnpm clawdis gateway --port 18789 --verbose

# Dev loop (auto-reload on TS changes)
pnpm gateway:watch

# Send a message
pnpm clawdis send --to +1234567890 --message "Hello from Clawdis"

# Invoke the agent directly
pnpm clawdis agent --message "Run diagnostics" --thinking high
```

---

## Chat Commands

Available across all surfaces (WhatsApp, Telegram, Discord, WebChat):

| Command | Description | Scope |
|---------|-------------|-------|
| `/status` | Health, session info, activation mode | All |
| `/new` / `/reset` | Reset the current session | All |
| `/think <level>` | Set thinking depth (off/minimal/low/medium/high) | All |
| `/verbose on\|off` | Toggle verbose output | All |
| `/restart` | Restart the Gateway process | Owner |
| `/activation mention\|always` | Group activation mode | Groups |

---

## Companion Apps

### macOS (Clawdis.app)

The macOS app is the primary control surface. It runs the menu-bar control plane, owns local TCC permissions, hosts Voice Wake, exposes WebChat and debug tools, and coordinates local/remote gateway mode.

```bash
./scripts/restart-mac.sh    # Build, package, and launch
```

### iOS Node

Pairs as a node via the Bridge. Exposes Canvas, voice trigger forwarding, camera capture, and screen recording. Controlled via `clawdis nodes` CLI.

### Android Node

Same Bridge pairing flow as iOS. Exposes Canvas, camera, and screen capture commands.

---

## Security Model

- **Loopback-first**: Gateway binds to `127.0.0.1` by default. No public exposure.
- **Allowlist routing**: Only explicitly allowlisted senders can interact with the agent.
- **Pairing tokens**: Node connections require Keychain-stored pairing tokens.
- **No cloud dependency**: The control plane never leaves your network.
- **Frame validation**: Every WebSocket frame is schema-validated before processing.
- **Idempotency**: Mutation operations are deduplicated to prevent double-execution.

---

## Documentation

| Document | Description |
|----------|-------------|
| [`docs/index.md`](docs/index.md) | Architecture overview |
| [`docs/configuration.md`](docs/configuration.md) | Full configuration reference |
| [`docs/gateway.md`](docs/gateway.md) | Gateway internals |
| [`docs/agent.md`](docs/agent.md) | Agent runtime and skills |
| [`docs/discovery.md`](docs/discovery.md) | Bonjour discovery protocol |
| [`docs/group-messages.md`](docs/group-messages.md) | Group chat behavior |
| [`docs/discord.md`](docs/discord.md) | Discord integration |
| [`docs/webhook.md`](docs/webhook.md) | Webhooks and external triggers |
| [`docs/gmail-pubsub.md`](docs/gmail-pubsub.md) | Gmail event hooks |
| [`docs/security.md`](docs/security.md) | Security model |
| [`docs/ios/connect.md`](docs/ios/connect.md) | iOS node setup |
| [`docs/clawdis-mac.md`](docs/clawdis-mac.md) | macOS app guide |

---

<p align="center">
  <sub>Built by <a href="https://github.com/mbelinky">mbelinky</a>. Follow development at <a href="https://x.com/clawdisAI">@clawdisAI</a>.</sub><br/>
  <sub>A local-first, multi-surface AI assistant runtime. One user. One identity. Every device.</sub>
</p>

---

## Bags Hackathon

<p align="center">
  <a href="https://bags.fm/2yDL2okKMtkxtSomVWVfr6Y8JDBuidRX3e4Qx8hBBAGS">
    <img src="https://cdn.prod.website-files.com/69082c5061a39922df8ed3b6/69b890e3d8a9d85211b0b160_HCx_bWaXcAAyC4s.jpg" alt="Bags Hackathon" width="720" />
  </a>
</p>

Clawdis is participating in **[The Bags Hackathon](https://bags.fm/2yDL2okKMtkxtSomVWVfr6Y8JDBuidRX3e4Qx8hBBAGS)** -- $4,000,000 in funding for developers building on Bags.fm.

- **$1M in grants** distributed to 100 teams that ship real products with real traction
- **$3M Bags Fund** for ongoing builder support with capital, distribution, and more
- Winners selected based on **real traction**: onchain performance, app usage, and growth potential
- Early traction and growth trajectory weigh heavily in evaluation
- Applications reviewed on a rolling basis

Build good tech, win cash, start companies.

**[Apply now](https://bags.fm/2yDL2okKMtkxtSomVWVfr6Y8JDBuidRX3e4Qx8hBBAGS)** to be accepted into the first cohort.
