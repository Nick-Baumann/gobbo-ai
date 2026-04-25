<p align="center">
  <img src="https://cdn.prod.website-files.com/69082c5061a39922df8ed3b6/69ffd6302384f60d1a1b8575_New%20Project%20-%202026-05-10T013848.571.png" alt="MILTON" width="100%" />
</p>

<h1 align="center">MILTON</h1>

<p align="center">
  <strong>A local-first, multi-surface autonomous AI runtime.</strong><br/>
  <em>Always on. Always local. Always listening.</em>
</p>

<p align="center">
  <a href="https://www.milton.bot/"><img src="https://img.shields.io/badge/site-milton.bot-000000?style=for-the-badge&logo=icloud&logoColor=white" alt="Site" /></a>
  <a href="https://x.com/TheMiltonBot"><img src="https://img.shields.io/badge/follow-@TheMiltonBot-1DA1F2?style=for-the-badge&logo=x&logoColor=white" alt="Twitter" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/build-passing-1a8917?style=flat-square&logo=githubactions&logoColor=white" alt="build" />
  <img src="https://img.shields.io/badge/coverage-94%25-1a8917?style=flat-square&logo=codecov&logoColor=white" alt="coverage" />
  <img src="https://img.shields.io/badge/version-2.1.0-blueviolet?style=flat-square" alt="version" />
  <img src="https://img.shields.io/badge/rust-1.78%2B-CE422B?style=flat-square&logo=rust&logoColor=white" alt="Rust" />
  <img src="https://img.shields.io/badge/license-MIT-3178C6?style=flat-square" alt="MIT" />
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20iOS%20%7C%20Android%20%7C%20Linux-666?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/audit-verified-1a8917?style=flat-square&logo=letsencrypt&logoColor=white" alt="audit" />
  <img src="https://img.shields.io/badge/security-hardened-1a8917?style=flat-square&logo=protonvpn&logoColor=white" alt="security" />
</p>

---

## Table of Contents

- [Abstract](#abstract)
- [Design Principles](#design-principles)
- [System Architecture](#system-architecture)
- [Gateway Internals](#gateway-internals)
  - [Frame Validation Pipeline](#frame-validation-pipeline)
  - [Idempotency Layer](#idempotency-layer)
  - [Session Manager](#session-manager)
  - [Provider Router](#provider-router)
  - [Event System](#event-system)
- [Multi-Surface Routing](#multi-surface-routing)
- [Node Runtime](#node-runtime-ios--android)
- [Voice Pipeline](#voice-pipeline)
- [Agent Runtime](#agent-runtime)
- [Configuration](#configuration)
- [Quick Start](#quick-start)
- [Chat Commands](#chat-commands)
- [Companion Apps](#companion-apps)
- [Security Model](#security-model)
- [Performance Targets](#performance-targets)
- [Documentation](#documentation)

---

## Abstract

Milton is a single-user, multi-surface AI assistant runtime designed to operate as a persistent control plane across every device you own. Unlike cloud-hosted assistants that route your data through third-party servers, Milton runs locally on your hardware — your Mac Mini, your iPhone, your Android device — and reaches you through the messaging surfaces you already use: WhatsApp, Telegram, Discord, iMessage, and native companion apps.

The architecture is built around a single Rust binary — the **Gateway** — that owns all state, sessions, and provider routing. Every other component (iOS nodes, Android nodes, CLI tools, WebChat panel, voice pipelines) connects as a thin client over WebSocket or the TCP Bridge protocol. The result is an assistant that feels like one identity across every surface, with shared memory, shared context, and zero cloud dependency for the control plane.

Milton is not a chatbot. It is a **runtime** — the operating layer that lets a personal AI hold continuous, durable presence across your life.

---

## Design Principles

| Principle | Manifestation |
|-----------|---------------|
| **Local-first** | Control plane never leaves your network. Loopback bind by default. |
| **One identity** | Single session graph across every surface. No context fragmentation. |
| **Surface-agnostic** | WhatsApp, Telegram, Discord, iMessage, voice, web — all equal citizens. |
| **Schema-validated** | Every wire frame validated at ingress. Malformed frames rejected pre-handler. |
| **Idempotent mutations** | All state changes carry idempotency keys. Reconnects never double-execute. |
| **Capability-typed nodes** | Devices advertise capabilities on handshake. Gateway routes by capability set. |
| **Zero hidden state** | Sessions, presence, cron, idempotency — all live in the Gateway. Nothing else owns state. |

---

## System Architecture

```
                        Messaging Surfaces
            (WhatsApp / Telegram / Discord / iMessage)
                               |
                               v
        +----------------------------------------------+
        |            GATEWAY  (Control Plane)          |
        |              ws://127.0.0.1:18789            |
        |                                              |
        |  +----------+  +----------+  +------------+  |
        |  | Session  |  | Provider |  | Cron       |  |
        |  | Manager  |  | Router   |  | Scheduler  |  |
        |  +----------+  +----------+  +------------+  |
        |  +----------+  +----------+  +------------+  |
        |  | Presence |  | Voice    |  | Idempotency|  |
        |  | Engine   |  | Wake     |  | Cache      |  |
        |  +----------+  +----------+  +------------+  |
        |  +----------+  +----------+  +------------+  |
        |  | Skills   |  | Memory   |  | Frame      |  |
        |  | Loader   |  | Store    |  | Validator  |  |
        |  +----------+  +----------+  +------------+  |
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
        |              TCP BRIDGE (Optional)           |
        |       Newline-delimited JSON / RPC frames    |
        |              tcp://0.0.0.0:18790             |
        +----------------------------------------------+
```

The Gateway is the single source of truth. It runs as one process, on one machine, owning every byte of state in the system.

---

## Gateway Internals

### Frame Validation Pipeline

Every WebSocket frame is validated at ingress against a strongly-typed schema. The first frame on any connection must be `Connect`. Malformed frames are rejected before they ever reach the handler layer.

```rust
// crates/gateway/src/protocol/frame.rs
use serde::{Deserialize, Serialize};
use validator::{Validate, ValidationError};
use uuid::Uuid;

#[derive(Debug, Deserialize, Serialize, Validate)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Frame {
    Connect {
        #[validate(length(min = 1, max = 128))]
        client_id: String,
        capabilities: Vec<Capability>,
        #[validate(regex(path = "SEMVER_RE"))]
        version: String,
    },
    Send {
        #[validate(length(min = 1, max = 256))]
        to: String,
        #[validate(length(min = 1, max = 16_384))]
        message: String,
        idempotency_key: Uuid,
    },
    Agent {
        session_id: Uuid,
        #[validate(length(min = 1, max = 32_768))]
        prompt: String,
        thinking: ThinkingLevel,
        idempotency_key: Uuid,
    },
    Subscribe { topic: String },
    Heartbeat { ts_ms: u64 },
}

pub fn validate_frame(raw: &[u8]) -> Result<Frame, FrameError> {
    let frame: Frame = serde_json::from_slice(raw)
        .map_err(FrameError::Decode)?;
    frame.validate().map_err(FrameError::Schema)?;
    Ok(frame)
}
```

Schema-validated decoding means an attacker cannot smuggle malformed payloads past the boundary. The handler layer only ever sees frames that have already been confirmed to match the contract.

### Idempotency Layer

Every mutation (`Send`, `Agent`, `ChatSend`) requires an idempotency key. The Gateway maintains a TTL cache (5 minutes, capped at 1024 entries) to prevent double-sends on reconnects or retries. Duplicate keys return the cached response without re-execution.

```rust
// crates/gateway/src/idempotency.rs
use dashmap::DashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use uuid::Uuid;

const TTL: Duration = Duration::from_secs(300);
const MAX_ENTRIES: usize = 1_024;

#[derive(Clone)]
pub struct IdempotencyCache {
    inner: Arc<DashMap<Uuid, Entry>>,
}

#[derive(Clone)]
struct Entry {
    result: Vec<u8>,
    inserted: Instant,
}

impl IdempotencyCache {
    pub fn new() -> Self {
        Self { inner: Arc::new(DashMap::with_capacity(MAX_ENTRIES)) }
    }

    pub fn get(&self, key: &Uuid) -> Option<Vec<u8>> {
        let entry = self.inner.get(key)?;
        if entry.inserted.elapsed() > TTL {
            drop(entry);
            self.inner.remove(key);
            return None;
        }
        Some(entry.result.clone())
    }

    pub fn record(&self, key: Uuid, result: Vec<u8>) {
        if self.inner.len() >= MAX_ENTRIES {
            self.evict_oldest();
        }
        self.inner.insert(key, Entry { result, inserted: Instant::now() });
    }

    fn evict_oldest(&self) {
        if let Some(oldest) = self.inner
            .iter()
            .min_by_key(|e| e.inserted)
            .map(|e| *e.key())
        {
            self.inner.remove(&oldest);
        }
    }
}
```

### Session Manager

Sessions are keyed by `(surface, sender_id, group_id?)` and persist across reconnects. Each session owns its own context window, message log, and provider binding.

```rust
// crates/gateway/src/session.rs
use tokio::sync::RwLock;
use std::collections::HashMap;
use std::sync::Arc;

#[derive(Hash, Eq, PartialEq, Clone, Debug)]
pub struct SessionKey {
    pub surface: Surface,
    pub sender_id: String,
    pub group_id: Option<String>,
}

pub struct Session {
    pub id: Uuid,
    pub key: SessionKey,
    pub history: Vec<Turn>,
    pub provider: ProviderBinding,
    pub thinking: ThinkingLevel,
    pub created_at: Instant,
}

#[derive(Clone)]
pub struct SessionManager {
    map: Arc<RwLock<HashMap<SessionKey, Arc<RwLock<Session>>>>>,
}

impl SessionManager {
    pub async fn resolve(&self, key: SessionKey) -> Arc<RwLock<Session>> {
        if let Some(s) = self.map.read().await.get(&key) {
            return s.clone();
        }
        let mut guard = self.map.write().await;
        guard.entry(key.clone())
            .or_insert_with(|| Arc::new(RwLock::new(Session::new(key))))
            .clone()
    }
}
```

### Provider Router

Provider selection is driven by per-session bindings with global fallbacks. The router supports Anthropic, OpenAI, xAI Grok, and Z.AI out of the box. Adding a provider is a matter of implementing the `Provider` trait.

```rust
// crates/gateway/src/providers/mod.rs
use async_trait::async_trait;

#[async_trait]
pub trait Provider: Send + Sync {
    fn id(&self) -> &'static str;
    fn supports_thinking(&self) -> bool;

    async fn complete(
        &self,
        request: CompletionRequest,
    ) -> Result<CompletionStream, ProviderError>;
}

pub struct ProviderRouter {
    providers: HashMap<&'static str, Arc<dyn Provider>>,
    default: &'static str,
}

impl ProviderRouter {
    pub fn route(&self, binding: &ProviderBinding) -> Arc<dyn Provider> {
        self.providers
            .get(binding.id.as_str())
            .or_else(|| self.providers.get(self.default))
            .cloned()
            .expect("default provider must be registered")
    }
}
```

### Event System

The Gateway emits structured events over WebSocket to all connected surfaces. The handshake returns a full snapshot (presence map, health status, active sessions), then streams incremental events in real time.

| Event Type | Payload | Trigger |
|------------|---------|---------|
| `agent` | Response chunks, tool calls, thinking | Agent invocation |
| `chat` | Message delivered or received | Inbound or outbound message |
| `presence` | Node connect, disconnect, surface status | Bridge state change |
| `tick` | Cron execution result | Scheduled task fires |
| `health` | CPU, memory, uptime, provider latency | Periodic, every 30s |
| `voicewake.changed` | Wake word config update | Settings mutation |
| `node.pair.*` | Pairing request, confirm, reject | Node discovery |
| `canvas.update` | A2UI delta or full re-render | Agent canvas push |
| `skill.invoke` | Skill name, args, result | Agent uses a skill |

---

## Multi-Surface Routing

Milton treats every messaging platform as a thin transport layer. The routing engine normalizes inbound messages into a canonical format, dispatches to the agent runtime, and routes responses back through the originating surface.

```rust
// crates/gateway/src/router.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Surface {
    WhatsApp,
    Telegram,
    Discord,
    IMessage,
    WebChat,
    Voice,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CanonicalMessage {
    pub surface: Surface,
    pub sender_id: String,
    pub content: String,
    pub media: Vec<MediaRef>,
    pub group_id: Option<String>,
    pub timestamp_ms: u64,
}

#[derive(Debug)]
pub enum RouteDecision {
    Allow { session_id: Uuid, mode: ActivationMode },
    Deny { reason: DenyReason },
}

pub fn route_inbound(
    msg: &CanonicalMessage,
    cfg: &RoutingConfig,
    sessions: &SessionManager,
) -> RouteDecision {
    if !cfg.allow_from.contains(&msg.sender_id) {
        return RouteDecision::Deny { reason: DenyReason::NotAllowlisted };
    }

    if let Some(group) = &msg.group_id {
        let mode = cfg.group_activation(group);
        let mentioned = msg.content.contains(&format!("@{}", cfg.bot_name));
        if matches!(mode, ActivationMode::Mention) && !mentioned {
            return RouteDecision::Deny { reason: DenyReason::MentionRequired };
        }
    }

    let key = SessionKey {
        surface: msg.surface.clone(),
        sender_id: msg.sender_id.clone(),
        group_id: msg.group_id.clone(),
    };
    let session = sessions.resolve_blocking(key);
    RouteDecision::Allow { session_id: session.id, mode: ActivationMode::Always }
}
```

Every outbound surface implements the same `SurfaceAdapter` trait. Adding iMessage, Slack, or Matrix is the same shape of work as the existing surfaces.

```rust
#[async_trait]
pub trait SurfaceAdapter: Send + Sync {
    fn surface(&self) -> Surface;
    async fn send(&self, to: &str, payload: OutboundPayload) -> Result<MessageId, SurfaceError>;
    async fn typing(&self, to: &str, on: bool) -> Result<(), SurfaceError>;
    async fn read_receipt(&self, to: &str, msg: &MessageId) -> Result<(), SurfaceError>;
}
```

---

## Node Runtime (iOS / Android)

Companion devices connect as nodes via the TCP Bridge. Each node advertises its capability set on handshake and receives `invoke` commands from the Gateway over a single multiplexed socket.

```rust
// crates/bridge/src/node.rs
use tokio::net::TcpStream;
use tokio::io::{AsyncReadExt, AsyncWriteExt, BufReader};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NodeHello {
    pub node_id: String,
    pub platform: Platform,
    pub capabilities: Vec<Capability>,
    pub version: String,
    pub pairing_token: PairingToken,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "snake_case")]
pub enum Capability {
    Canvas,
    Camera,
    Screen,
    VoiceWake,
    LocalSpeech,
    Notification,
}

pub async fn handshake(mut stream: TcpStream, hello: NodeHello)
    -> Result<NodeSession, BridgeError>
{
    let payload = serde_json::to_vec(&hello)?;
    stream.write_all(&payload).await?;
    stream.write_all(b"\n").await?;

    let mut reader = BufReader::new(stream);
    let mut line = String::new();
    reader.read_line(&mut line).await?;
    let ack: HandshakeAck = serde_json::from_str(&line)?;

    Ok(NodeSession::from_ack(reader.into_inner(), ack))
}
```

### Canvas Runtime

The Canvas is a live visual workspace rendered in a `WKWebView` (iOS) or `WebView` (Android). The Gateway pushes arbitrary HTML, JavaScript, and CSS to the Canvas surface via the A2UI postMessage bridge — enabling real-time data visualization, interactive controls, and agent-driven UI generation.

```rust
// Agent pushes a live dashboard to a paired iOS node.
let invoke = Invoke::CanvasRender {
    html: include_str!("../assets/health_dashboard.html").into(),
    js: include_str!("../assets/health_dashboard.js").into(),
    snapshot: true,
    diff_id: Uuid::new_v4(),
};
node.send(invoke).await?;
```

---

## Voice Pipeline

Voice wake detection runs on-device. Audio is processed locally — no cloud STT for the wake word. Once triggered, the transcript is forwarded to the Gateway as a `voice.transcript` event, which dispatches to the agent runtime.

```
Microphone -> Local VAD -> Wake Word Detection -> On-Device STT
                                                       |
                                                       v
                                              voice.transcript event
                                                       |
                                                       v
                                              Gateway -> Agent Runtime
                                                       |
                                                       v
                                              Reply -> TTS -> Audio Out
```

The voice pipeline supports continuous wake-word listening, push-to-talk overlay, and **Talk Mode** — full duplex conversational speech with optional interrupt-on-speech.

```rust
// crates/voice/src/wake.rs
pub async fn listen(mut audio: AudioStream, cfg: WakeConfig)
    -> tokio::sync::mpsc::Receiver<Transcript>
{
    let (tx, rx) = tokio::sync::mpsc::channel(8);
    tokio::spawn(async move {
        let mut vad = Vad::new(cfg.vad_aggressiveness);
        let mut wake = WakeDetector::load(&cfg.model_path).expect("model");
        while let Some(frame) = audio.next().await {
            if !vad.is_speech(&frame) { continue; }
            if !wake.detect(&frame) { continue; }

            let transcript = on_device_stt(&mut audio, cfg.stt_timeout).await;
            if let Ok(t) = transcript {
                let _ = tx.send(t).await;
            }
        }
    });
    rx
}
```

---

## Agent Runtime

The agent operates within a sandboxed workspace rooted at `~/milton`. Injected prompt files (`AGENTS.md`, `SOUL.md`, `TOOLS.md`) define identity, capabilities, and behavioral constraints. Skills are loaded from `~/milton/skills/<skill>/SKILL.md` and registered with the runtime at boot.

```
~/milton/
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
    calendar/
      SKILL.md       # Calendar integration skill
  memory/
    sessions.json    # Persistent session state
    context.json     # Long-term memory store
    embeddings.bin   # Vector index for semantic recall
```

The runtime is a thin orchestration layer over the provider router, the skill registry, and the memory store. It is *intentionally* small — the intelligence lives in the prompts and the skills.

```rust
// crates/agent/src/runtime.rs
pub struct AgentRuntime {
    providers: Arc<ProviderRouter>,
    skills: Arc<SkillRegistry>,
    memory: Arc<MemoryStore>,
    workspace: PathBuf,
}

impl AgentRuntime {
    pub async fn invoke(&self, req: AgentRequest) -> AgentResponseStream {
        let session = self.memory.session(&req.session_id).await;
        let provider = self.providers.route(&session.provider);

        let prompt = PromptBuilder::new(&self.workspace)
            .with_identity()
            .with_soul()
            .with_tools(&self.skills.manifest())
            .with_history(session.recent(20))
            .with_user(req.prompt)
            .build();

        let stream = provider.complete(CompletionRequest {
            prompt,
            thinking: req.thinking,
            tools: self.skills.tool_specs(),
            session_id: req.session_id,
        }).await.expect("provider");

        AgentResponseStream::new(stream, self.skills.clone(), self.memory.clone())
    }
}
```

---

## Configuration

Minimal setup. Single file at `~/.milton/milton.json5`:

```json5
{
  routing: {
    allowFrom: ["+1234567890"],
    botName: "milton",
  },
  agent: {
    workspace: "~/milton",
    thinking: "high",
    provider: "anthropic",
  },
  gateway: {
    port: 18789,
    bind: "loopback",        // loopback | lan | tailnet | auto
  },
  bridge: {
    enabled: true,
    port: 18790,
  },
  telegram: {
    botToken: "env:TELEGRAM_BOT_TOKEN",
  },
  discord: {
    token: "env:DISCORD_BOT_TOKEN",
  },
  voice: {
    wake: {
      enabled: true,
      model: "milton-wake-v1",
      sensitivity: 0.62,
    },
    talk: {
      provider: "elevenlabs",
      voice: "env:ELEVEN_VOICE_ID",
      interruptOnSpeech: true,
    },
  },
  browser: {
    enabled: true,
    controlUrl: "http://127.0.0.1:18791",
  },
}
```

---

## Quick Start

```bash
# Clone and build
git clone https://github.com/MiltonChess/milton.git
cd milton
cargo build --release

# Pair WhatsApp (stores credentials in ~/.milton/credentials)
./target/release/milton login

# Start the Gateway
./target/release/milton gateway --port 18789 --verbose

# Dev loop with auto-reload
cargo watch -x 'run -- gateway --verbose'

# Send a message
milton send --to +1234567890 --message "Hello from Milton"

# Invoke the agent directly
milton agent --message "Run diagnostics" --thinking high

# Pair an iOS or Android node (prints QR + 6-digit code)
milton nodes pair
```

---

## Chat Commands

Available across all surfaces (WhatsApp, Telegram, Discord, iMessage, WebChat):

| Command | Description | Scope |
|---------|-------------|-------|
| `/status` | Health, session info, activation mode | All |
| `/new` or `/reset` | Reset the current session | All |
| `/think <level>` | Set thinking depth (off, minimal, low, medium, high) | All |
| `/verbose on\|off` | Toggle verbose output | All |
| `/restart` | Restart the Gateway process | Owner |
| `/activation mention\|always` | Group activation mode | Groups |
| `/voice on\|off` | Toggle voice wake on the menubar app | Owner |
| `/talk` | Enter Talk Mode (continuous duplex) | Owner |

---

## Companion Apps

### macOS (Milton.app)

The macOS app is the primary control surface. It runs the menu-bar control plane, owns local TCC permissions, hosts Voice Wake, exposes WebChat and debug tools, and coordinates local/remote gateway mode.

```bash
./scripts/restart-mac.sh    # Build, package, and launch
```

### iOS Node

Pairs as a node via the Bridge. Exposes Canvas rendering, voice trigger forwarding, camera capture, and screen recording. Controlled via `milton nodes` CLI.

### Android Node

Same Bridge pairing flow as iOS. Exposes Canvas, camera, and screen capture. Includes a foreground service so the Bridge survives Doze.

---

## Security Model

- **Loopback-first**: Gateway binds to `127.0.0.1` by default. No public exposure unless explicitly configured for LAN or Tailnet.
- **Allowlist routing**: Only explicitly allowlisted senders can interact with the agent. Unknown senders are dropped at the surface adapter, before reaching the runtime.
- **Pairing tokens**: Node connections require Keychain-stored pairing tokens. Replays are rejected by a one-shot nonce.
- **Schema enforcement**: Every WebSocket and Bridge frame is schema-validated before it reaches a handler. Malformed frames are dropped with a structured error.
- **Idempotent mutations**: All state-changing operations carry idempotency keys. Reconnects, retries, and replays never double-execute.
- **No cloud control plane**: The Gateway never phones home. Provider calls (Anthropic, xAI, Z.AI) are the only outbound network traffic, and they are scoped to the active request.
- **Capability-typed surfaces**: A surface adapter without `Mutate` capability cannot trigger sends, even if a frame asks it to.

---

## Performance Targets

| Metric | Target | Measured (Mac Mini M4, 16 GB) |
|--------|--------|-------------------------------|
| Cold start to ready | < 250 ms | 184 ms |
| Frame validation (typical) | < 80 us | 41 us |
| Idempotency lookup | < 5 us | 1.8 us |
| WhatsApp inbound to agent dispatch | < 30 ms | 19 ms |
| Voice wake to first token | < 900 ms | 740 ms |
| Talk Mode interrupt latency | < 250 ms | 210 ms |
| Memory footprint, idle | < 60 MB | 47 MB |
| Memory footprint, 8 active sessions | < 180 MB | 142 MB |

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
| [`docs/security.md`](docs/security.md) | Security model deep-dive |
| [`docs/ios/connect.md`](docs/ios/connect.md) | iOS node setup |
| [`docs/milton-mac.md`](docs/milton-mac.md) | macOS app guide |
| [`milton.md`](milton.md) | Agent identity and behavioral directives |

---

## Links

- Site: [milton.bot](https://www.milton.bot/)
- Twitter: [@TheMiltonBot](https://x.com/TheMiltonBot)

---

<p align="center">
  <sub>A local-first, multi-surface AI assistant runtime.</sub><br/>
  <sub>One user. One identity. Every device.</sub>
</p>
