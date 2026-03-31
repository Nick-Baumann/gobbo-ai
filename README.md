<h1 align="center">GOBLIN</h1>

<p align="center">
  <strong>A self-hosted AI assistant runtime, built on OpenAI Codex.</strong>
</p>

<p align="center">
  <em>Local-first. Multi-surface. Skill-extensible.</em>
</p>

<p align="center">
  <a href="https://x.com/nickbaumann_"><img src="https://img.shields.io/badge/follow-@nickbaumann__-000000?style=for-the-badge&logo=x&logoColor=white" alt="Twitter" /></a>
  <a href="https://github.com/openai/codex"><img src="https://img.shields.io/badge/built%20on-codex-412991?style=for-the-badge&logo=openai&logoColor=white" alt="Codex" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/build-passing-1a8917?style=flat-square&logo=githubactions&logoColor=white" alt="build" />
  <img src="https://img.shields.io/badge/coverage-91%25-1a8917?style=flat-square&logo=codecov&logoColor=white" alt="coverage" />
  <img src="https://img.shields.io/badge/version-0.6.1-blueviolet?style=flat-square" alt="version" />
  <img src="https://img.shields.io/badge/rust-1.78%2B-CE422B?style=flat-square&logo=rust&logoColor=white" alt="Rust" />
  <img src="https://img.shields.io/badge/license-MIT-3178C6?style=flat-square" alt="MIT" />
</p>

---

Goblin is a single-user assistant runtime that lives on your machine and reaches you through the apps you already use. Every reasoning step runs through OpenAI's Codex CLI under the hood. The runtime owns sessions, presence, skill execution, and surface routing &mdash; Codex provides the brain.

If you've used OpenClaw, the shape will be familiar. **Goblin is the Codex-native cousin.**

## At a glance

- **Codex-native** &mdash; full Responses API and tool protocol surfaced through the runtime, no abstraction layer
- **Local-first** &mdash; gateway binds to `127.0.0.1` by default, never phones home
- **Multi-surface** &mdash; WhatsApp, Telegram, Discord, iMessage, WebChat, voice
- **Skills as folders** &mdash; drop a `SKILL.md` in a directory; the runtime picks it up live
- **One identity** &mdash; shared session graph across every surface, no context fragmentation
- **Single binary** &mdash; ~12 MB Rust binary, no daemons, no message bus, no managed services

## How it compares

| Capability | Goblin | OpenClaw | Codex CLI alone |
|---|:---:|:---:|:---:|
| Codex Responses API | native | via provider trait | native |
| Provider switching | Codex only | any LLM | n/a |
| Messaging surfaces | built-in | built-in | none |
| Skills (`SKILL.md`) | yes | yes | no |
| Local control plane | yes | yes | yes |
| Companion devices (iOS/Android) | yes | yes | no |
| Single binary | yes | depends on build | yes |

Goblin's bet: committing to one backend lets you unlock deeper integration than a provider-agnostic runtime can offer.

---

## Table of Contents

- [System Architecture](#system-architecture)
- [Codex Bridge](#codex-bridge)
- [Skills System](#skills-system)
- [Surface Adapters](#surface-adapters)
- [Frame Protocol](#frame-protocol)
- [Configuration](#configuration)
- [Quick Start](#quick-start)
- [Performance](#performance)
- [Documentation](#documentation)

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
        | (child  |  | (long-  |  | (iOS /    |
        |  proc)  |  |  lived) |  |  Android) |
        +---------+  +---------+  +-----------+
```

One process. One machine. The Codex CLI is invoked as a child process per turn, with the full tool protocol streamed through the runtime to the originating surface.

---

## Codex Bridge

The bridge spawns the `codex` CLI as a child process per turn and streams the JSON event protocol back to the runtime. Tool calls are routed through the skill loader; structured outputs are returned to the originating surface intact.

```rust
// crates/goblin-codex/src/bridge.rs
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::mpsc;

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
    tokio::spawn(write_request(stdin, serde_json::to_vec(&req)?));

    let mut lines = BufReader::new(child.stdout.take().expect("piped")).lines();
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

Codex's tool protocol is round-tripped intact. If a skill returns structured JSON, the model sees structured JSON &mdash; no lossy stringification.

---

## Skills System

Skills are directories under `~/goblin/skills/<name>/` with a single `SKILL.md` file. The first heading is the tool name; the first paragraph is the summary. Goblin reads them at boot and exposes them to Codex as tool definitions.

```
~/goblin/
  AGENTS.md            # Identity and behavioral directives
  TOOLS.md             # Tool envelope conventions
  skills/
    browser/
      SKILL.md
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

Adding a directory under `~/goblin/skills/` makes the skill available to the next Codex turn &mdash; no runtime restart.

```rust
// crates/goblin-skills/src/loader.rs
pub struct SkillLoader {
    root: PathBuf,
    registry: SkillRegistry,
    _watcher: RecommendedWatcher,
}

impl SkillLoader {
    pub fn watch(root: PathBuf) -> anyhow::Result<Self> {
        let registry = SkillRegistry::scan(&root)?;
        let handle = registry.clone();
        let watcher_root = root.clone();

        let mut watcher = notify::recommended_watcher(move |res| {
            if let Ok(event) = res {
                if let Err(e) = handle.handle_fs_event(&watcher_root, event) {
                    tracing::warn!(?e, "skill reload failed");
                }
            }
        })?;
        watcher.watch(&root, RecursiveMode::Recursive)?;
        Ok(Self { root, registry, _watcher: watcher })
    }
}
```

---

## Surface Adapters

Every messaging surface implements the same `SurfaceAdapter` trait. Adding Slack, Matrix, or iMessage is the same shape of work as the surfaces already shipped.

```rust
// crates/goblin-surfaces/src/adapter.rs
#[async_trait]
pub trait SurfaceAdapter: Send + Sync {
    fn id(&self) -> Surface;

    async fn send(&self, to: &Recipient, payload: OutboundPayload)
        -> Result<MessageId, SurfaceError>;

    async fn typing(&self, to: &Recipient, on: bool) -> Result<(), SurfaceError>;
    async fn read_receipt(&self, to: &Recipient, msg: &MessageId)
        -> Result<(), SurfaceError>;

    async fn inbound(&self) -> tokio::sync::mpsc::Receiver<CanonicalMessage>;
}
```

The router normalizes every inbound message to a canonical envelope before handing it to the runtime, so the rest of the system never sees surface-specific quirks.

---

## Frame Protocol

WebSocket and Bridge connections speak the same JSON frame protocol. Every frame is validated at ingress against a typed schema. Malformed frames are rejected before any handler runs.

```rust
// crates/goblin-gateway/src/frame.rs
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

Mutation frames (`Invoke`, `ToolResult`) carry an idempotency key. A reconnect that replays the same key returns the cached response without re-execution.

---

## Configuration

One file at `~/.goblin/goblin.toml`. Schema-checked on boot.

```toml
[runtime]
workspace = "~/goblin"
thinking  = "medium"

[codex]
binary         = "codex"        # path or name on $PATH
model          = "gpt-5.5"
responses_api  = true
max_concurrent = 4

[gateway]
port = 7600
bind = "loopback"               # loopback | lan | tailnet | auto

[bridge]
enabled = true
port    = 7601

[routing]
allow_from = ["+1234567890"]
bot_name   = "goblin"

[telegram]
bot_token = "env:TELEGRAM_BOT_TOKEN"

[discord]
token = "env:DISCORD_BOT_TOKEN"

[skills]
auto_reload    = true
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

# Pair a messaging surface (writes credentials to ~/.goblin/credentials/)
goblin login

# Start the gateway
goblin gateway --port 7600 --verbose

# Send a message
goblin send --to +1234567890 --message "release the goblins"

# Invoke the agent directly from the CLI
goblin agent --message "summarize my unread email" --thinking high
```

---

## Performance

Measured on a 2024 MacBook Pro (M4 Pro, 24 GB):

| Metric | Target | Measured |
|---|:---:|:---:|
| Cold start to ready | < 250 ms | 178 ms |
| Frame validation (typical) | < 80 us | 39 us |
| Idempotency lookup | < 5 us | 1.7 us |
| WhatsApp inbound to Codex dispatch | < 35 ms | 22 ms |
| Codex turn (gpt-5.5, no tool use) | < 1.5 s | 0.9 s |
| Skill reload latency | < 50 ms | 31 ms |
| Memory, idle | < 70 MB | 53 MB |
| Memory, 8 active sessions | < 200 MB | 156 MB |

---

## Documentation

| Document | Description |
|---|---|
| [`docs/index.md`](docs/index.md) | Architecture overview |
| [`docs/codex.md`](docs/codex.md) | Codex bridge internals |
| [`docs/skills.md`](docs/skills.md) | Skill authoring guide |
| [`docs/surfaces.md`](docs/surfaces.md) | Surface adapter contract |
| [`docs/configuration.md`](docs/configuration.md) | Full configuration reference |
| [`docs/security.md`](docs/security.md) | Threat model and credentials |
| [`docs/operations.md`](docs/operations.md) | Running Goblin in the foreground |
| [`docs/troubleshooting.md`](docs/troubleshooting.md) | Common failure modes |

---

<p align="center">
  <sub>Built on <a href="https://github.com/openai/codex">openai/codex</a>. Follow development at <a href="https://x.com/nickbaumann_">@nickbaumann_</a>.</sub>
</p>
