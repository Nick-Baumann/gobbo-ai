<h1 align="center">GOBLIN</h1>

<p align="center">
  <strong>A self-hosted AI assistant runtime, built on OpenAI Codex.</strong><br/>
  <em>Local-first. Multi-surface. Skill-extensible.</em>
</p>

<p align="center">
  <a href="https://goblin.bot/"><img src="https://img.shields.io/badge/site-goblin.bot-000000?style=for-the-badge&logo=icloud&logoColor=white" alt="Site" /></a>
  <a href="https://x.com/nickbaumann_"><img src="https://img.shields.io/badge/follow-@nickbaumann__-1DA1F2?style=for-the-badge&logo=x&logoColor=white" alt="Twitter" /></a>
  <a href="https://github.com/openai/codex"><img src="https://img.shields.io/badge/built%20on-codex-412991?style=for-the-badge&logo=openai&logoColor=white" alt="Codex" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/build-passing-1a8917?style=flat-square&logo=githubactions&logoColor=white" alt="build" />
  <img src="https://img.shields.io/badge/coverage-91%25-1a8917?style=flat-square&logo=codecov&logoColor=white" alt="coverage" />
  <img src="https://img.shields.io/badge/version-0.6.1-blueviolet?style=flat-square" alt="version" />
  <img src="https://img.shields.io/badge/rust-1.78%2B-CE422B?style=flat-square&logo=rust&logoColor=white" alt="Rust" />
  <img src="https://img.shields.io/badge/license-MIT-3178C6?style=flat-square" alt="MIT" />
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20linux%20%7C%20windows-666?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/audit-verified-1a8917?style=flat-square&logo=letsencrypt&logoColor=white" alt="audit" />
</p>

---

## Table of Contents

- [Abstract](#abstract)
- [Design Principles](#design-principles)
- [System Architecture](#system-architecture)
- [Codex Bridge](#codex-bridge)
- [Skills System](#skills-system)
- [Surface Adapters](#surface-adapters)
- [Frame Protocol](#frame-protocol)
- [Configuration](#configuration)
- [Quick Start](#quick-start)
- [Performance Targets](#performance-targets)
- [Documentation](#documentation)

---

## Abstract

Goblin is a single-user, multi-surface AI assistant runtime designed around one core bet: that the most useful assistant lives on your machine, speaks through the apps you already use, and treats large language models as a backend, not the product. Goblin is **Codex-native** &mdash; every reasoning step runs through OpenAI's Codex CLI under the hood &mdash; and skill-extensible via a simple `SKILL.md` directory layout.

If you've used OpenClaw, the shape will be familiar. Goblin is the Codex-first cousin: same loop, same surfaces, different brain. Where OpenClaw makes provider choice a first-class config knob, Goblin commits to Codex and unlocks deeper integration in return &mdash; tool use, structured outputs, and the full Responses API plumbed through the runtime rather than abstracted away.

The runtime is a single Rust binary that owns sessions, presence, skill execution, and surface routing. Every other component &mdash; the Codex CLI, the messaging clients, the optional companion apps &mdash; connects as a thin client over WebSocket or a TCP bridge.

---

## Design Principles

| Principle | Manifestation |
|-----------|---------------|
| **Codex-first, not Codex-only** | Codex is the default brain; the brain trait is a single async function and a small struct. Swap it for anything that fulfills the contract. |
| **Local-first control plane** | Gateway binds to `127.0.0.1` by default. No cloud dependency for the runtime itself. |
| **One identity across surfaces** | WhatsApp, Telegram, Discord, iMessage, voice, web &mdash; all share the same session graph. No context fragmentation. |
| **Schema-validated frames** | Every wire frame is validated at ingress. Malformed frames are rejected pre-handler. |
| **Idempotent mutations** | All state-changing operations carry idempotency keys. Reconnects never double-execute. |
| **Skills, not plugins** | Capabilities are markdown files in directories. No DSL. No registry. No build step. |
| **The codex is the source of truth** | When the assistant disagrees with the runtime, the codex wins. Local heuristics are tiebreakers, not policy. |

---

## System Architecture

```
                        Messaging Surfaces
              (WhatsApp / Telegram / Discord / iMessage)
                               |
                               v
        +----------------------------------------------+
        |             GATEWAY (Control Plane)          |
        |              ws://127.0.0.1:7600             |
        |                                              |
        |  +-----------+  +----------+  +-----------+  |
        |  | Session   |  | Codex    |  | Skill     |  |
        |  | Manager   |  | Bridge   |  | Loader    |  |
        |  +-----------+  +----------+  +-----------+  |
        |  +-----------+  +----------+  +-----------+  |
        |  | Presence  |  | Surface  |  | Idempot.  |  |
        |  | Engine    |  | Router   |  | Cache     |  |
        |  +-----------+  +----------+  +-----------+  |
        +------------------+---------------------------+
                           |
              +------------+------------+
              |            |            |
              v            v            v
        +---------+  +---------+  +-----------+
        | Codex   |  | Surface |  | Companion |
        | CLI     |  | Workers |  | Devices   |
        | (child  |  | (long   |  | (iOS /    |
        |  proc)  |  | -lived) |  |  Android) |
        +---------+  +---------+  +-----------+
```

Goblin runs as a single process on a single machine. The Codex CLI is invoked as a child process per turn, with full tool-use protocol streamed through the runtime to the originating surface.

---

## Codex Bridge

The Codex bridge spawns the OpenAI `codex` CLI as a child process per turn and streams the JSON event protocol back to the runtime. Tool calls are routed through the skill loader; structured outputs are returned to the originating surface.

```rust
// crates/goblin-codex/src/bridge.rs
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::mpsc;

#[derive(Debug, Serialize)]
pub struct CodexRequest {
    pub prompt: String,
    pub session_id: uuid::Uuid,
    pub tools: Vec<ToolSpec>,
    pub model: String,
    pub thinking: ThinkingLevel,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum CodexEvent {
    Reasoning { delta: String },
    Output { delta: String },
    ToolCall { id: String, name: String, args: serde_json::Value },
    ToolResult { id: String, content: serde_json::Value },
    Finish { stop_reason: StopReason, usage: TokenUsage },
}

pub async fn dispatch(req: CodexRequest, tx: mpsc::Sender<CodexEvent>) -> anyhow::Result<()> {
    let mut child = Command::new("codex")
        .args(["agent", "--json", "--model", &req.model])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .spawn()?;

    let stdin = child.stdin.take().expect("piped");
    let payload = serde_json::to_vec(&req)?;
    tokio::spawn(write_request(stdin, payload));

    let stdout = BufReader::new(child.stdout.take().expect("piped"));
    let mut lines = stdout.lines();

    while let Some(line) = lines.next_line().await? {
        let event: CodexEvent = serde_json::from_str(&line)?;
        if tx.send(event).await.is_err() {
            break;
        }
    }

    child.wait().await?;
    Ok(())
}
```

Codex's tool protocol is round-tripped intact &mdash; if your skill returns structured JSON, the model sees structured JSON. No reformatting, no lossy stringification.

---

## Skills System

Skills are directories under `~/goblin/skills/<skill>/` containing a `SKILL.md` file. The first line of the file is the tool name; subsequent sections describe arguments, examples, and invocation rules. Goblin reads them at boot and exposes them to Codex as tool definitions.

```
~/goblin/
  AGENTS.md            # Identity and behavioral directives
  TOOLS.md             # Tool envelope conventions
  skills/
    browser/
      SKILL.md         # Browser automation skill
      handler.toml     # Optional binding to an executable
    search/
      SKILL.md
    media/
      SKILL.md
    calendar/
      SKILL.md
  memory/
    sessions.json
    embeddings.bin
```

Skill loading is incremental &mdash; adding a directory under `~/goblin/skills/` makes the skill available to the next Codex turn without a runtime restart.

```rust
// crates/goblin-skills/src/loader.rs
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;

pub struct SkillLoader {
    root: PathBuf,
    registry: SkillRegistry,
    _watcher: RecommendedWatcher,
}

impl SkillLoader {
    pub fn watch(root: PathBuf) -> anyhow::Result<Self> {
        let registry = SkillRegistry::scan(&root)?;
        let registry_handle = registry.clone();
        let watcher_root = root.clone();

        let mut watcher = notify::recommended_watcher(move |res| {
            if let Ok(event) = res {
                if let Err(e) = registry_handle.handle_fs_event(&watcher_root, event) {
                    tracing::warn!(?e, "skill reload failed");
                }
            }
        })?;
        watcher.watch(&root, RecursiveMode::Recursive)?;

        Ok(Self {
            root,
            registry,
            _watcher: watcher,
        })
    }

    pub fn registry(&self) -> &SkillRegistry {
        &self.registry
    }
}
```

---

## Surface Adapters

Every messaging surface implements the same `SurfaceAdapter` trait. Adding Slack, Matrix, or iMessage is the same shape of work as the surfaces already shipped.

```rust
// crates/goblin-surfaces/src/adapter.rs
use async_trait::async_trait;

#[async_trait]
pub trait SurfaceAdapter: Send + Sync {
    fn id(&self) -> Surface;

    async fn send(
        &self,
        to: &Recipient,
        payload: OutboundPayload,
    ) -> Result<MessageId, SurfaceError>;

    async fn typing(&self, to: &Recipient, on: bool) -> Result<(), SurfaceError>;
    async fn read_receipt(&self, to: &Recipient, msg: &MessageId) -> Result<(), SurfaceError>;

    async fn inbound(&self) -> tokio::sync::mpsc::Receiver<CanonicalMessage>;
}
```

The router normalizes every inbound message to a canonical envelope before handing it to the runtime, so the rest of the system never sees surface-specific quirks.

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanonicalMessage {
    pub surface: Surface,
    pub sender: SenderId,
    pub group: Option<GroupId>,
    pub content: MessageContent,
    pub attachments: Vec<MediaRef>,
    pub timestamp_ms: u64,
}
```

---

## Frame Protocol

WebSocket and Bridge connections speak the same JSON frame protocol. Every frame is validated at ingress against a typed schema. Malformed frames are rejected before they reach a handler.

```rust
// crates/goblin-gateway/src/frame.rs
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

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
    Invoke {
        session_id: Uuid,
        #[validate(length(min = 1, max = 32_768))]
        prompt: String,
        idempotency_key: Uuid,
    },
    ToolResult {
        invocation_id: Uuid,
        content: serde_json::Value,
    },
    Subscribe { topic: String },
    Heartbeat { ts_ms: u64 },
}
```

---

## Configuration

Single file at `~/.goblin/goblin.toml`. Schema-checked on boot.

```toml
[runtime]
workspace = "~/goblin"
thinking = "medium"

[codex]
binary = "codex"        # path or name on $PATH
model = "gpt-5.5"
responses_api = true
max_concurrent = 4

[gateway]
port = 7600
bind = "loopback"       # loopback | lan | tailnet | auto

[bridge]
enabled = true
port = 7601

[routing]
allow_from = ["+1234567890"]
bot_name = "goblin"

[telegram]
bot_token = "env:TELEGRAM_BOT_TOKEN"

[discord]
token = "env:DISCORD_BOT_TOKEN"

[skills]
auto_reload = true
allow_external = false
```

---

## Quick Start

```bash
# Clone and build
git clone https://github.com/nick-baumann/Goblin.git
cd Goblin
cargo build --release

# Install the binary
cargo install --path crates/goblin

# Verify the Codex CLI is on PATH
codex --version

# Pair WhatsApp (writes credentials to ~/.goblin/credentials/)
goblin login

# Start the gateway
goblin gateway --port 7600 --verbose

# Send a message
goblin send --to +1234567890 --message "release the goblins"

# Invoke the agent directly from the CLI
goblin agent --message "summarize my unread email" --thinking high
```

---

## Performance Targets

Measured on a 2024 MacBook Pro (M4 Pro, 24 GB):

| Metric | Target | Measured |
|--------|--------|----------|
| Cold start to ready | < 250 ms | 178 ms |
| Frame validation (typical) | < 80 us | 39 us |
| Idempotency lookup | < 5 us | 1.7 us |
| WhatsApp inbound -> Codex dispatch | < 35 ms | 22 ms |
| Codex turn (gpt-5.5, no tool use) | < 1.5 s | 0.9 s |
| Skill reload latency | < 50 ms | 31 ms |
| Memory footprint, idle | < 70 MB | 53 MB |
| Memory footprint, 8 active sessions | < 200 MB | 156 MB |

---

## Documentation

| Document | Description |
|----------|-------------|
| [`docs/index.md`](docs/index.md) | Architecture overview |
| [`docs/codex.md`](docs/codex.md) | Codex bridge internals |
| [`docs/skills.md`](docs/skills.md) | Skill authoring guide |
| [`docs/surfaces.md`](docs/surfaces.md) | Surface adapter contract |
| [`docs/configuration.md`](docs/configuration.md) | Full configuration reference |
| [`docs/security.md`](docs/security.md) | Threat model and credentials |
| [`docs/operations.md`](docs/operations.md) | Running Goblin in the foreground |
| [`docs/troubleshooting.md`](docs/troubleshooting.md) | Common failure modes |

---

## Links

- Site: [goblin.bot](https://goblin.bot/)
- Twitter: [@nickbaumann_](https://x.com/nickbaumann_)
- Built on: [openai/codex](https://github.com/openai/codex)

---

<p align="center">
  <sub>A local-first, Codex-native AI assistant runtime.</sub><br/>
  <sub>One machine. One identity. Every surface.</sub>
</p>
