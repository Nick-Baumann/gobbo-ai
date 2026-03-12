<h1 align="center">GOBBY</h1>

<p align="center">
  <strong>An always-on AI assistant for your Mac Mini, built on OpenAI Codex.</strong>
</p>

<p align="center">
  <em>Local-first. Multi-surface. Skill-extensible.</em>
</p>

<p align="center">
  <a href="https://x.com/nickbaumann_"><img src="https://img.shields.io/badge/follow-@nickbaumann__-000000?style=for-the-badge&logo=x&logoColor=white" alt="Twitter" /></a>
  <a href="https://github.com/openai/codex"><img src="https://img.shields.io/badge/built%20on-codex-412991?style=for-the-badge&logo=openai&logoColor=white" alt="Codex" /></a>
  <img src="https://img.shields.io/badge/runs%20on-mac%20mini-A2AAAD?style=for-the-badge&logo=apple&logoColor=white" alt="Mac Mini" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/build-passing-1a8917?style=flat-square&logo=githubactions&logoColor=white" alt="build" />
  <img src="https://img.shields.io/badge/coverage-91%25-1a8917?style=flat-square&logo=codecov&logoColor=white" alt="coverage" />
  <img src="https://img.shields.io/badge/version-0.6.1-blueviolet?style=flat-square" alt="version" />
  <img src="https://img.shields.io/badge/rust-1.78%2B-CE422B?style=flat-square&logo=rust&logoColor=white" alt="Rust" />
  <img src="https://img.shields.io/badge/license-MIT-3178C6?style=flat-square" alt="MIT" />
  <img src="https://img.shields.io/badge/apple%20silicon-native-000000?style=flat-square&logo=apple&logoColor=white" alt="Apple Silicon" />
</p>

---

GOBBY is a single-user assistant runtime designed to live on a **Mac Mini M4** sitting on your desk. Always on. Always reachable. Every reasoning step runs through OpenAI's Codex CLI under the hood. The Mac Mini is the body; Codex is the brain.

It's opinionated: one backend (Codex), one hardware target (the Mini), one identity across every messaging surface you already use.

## At a glance

- **Designed for Mac Mini M4** &mdash; native arm64, fanless on the base M4, ~10W idle
- **Codex-native** &mdash; full Responses API and tool protocol surfaced through the runtime, no abstraction layer
- **Local-first** &mdash; gateway binds to `127.0.0.1` by default, never phones home
- **Multi-surface** &mdash; WhatsApp, Telegram, Discord, iMessage, WebChat, voice
- **Always on** &mdash; ships with a `launchd` LaunchAgent template; survives logout, sleep, and reboots
- **Skills as folders** &mdash; drop a `SKILL.md` in a directory; the runtime picks it up live
- **One identity** &mdash; shared session graph across every surface, no context fragmentation

## Why a Mac Mini

GOBBY is engineered around a specific hardware target. The Mac Mini M4 is the cheapest piece of hardware that gives you a 24/7 personal assistant without any compromises:

| Property | Why it matters |
|---|---|
| **Fanless on the base M4** | Lives on a desk or shelf without a single moving part. No noise, no dust pull. |
| **~10W idle / ~25W active** | Costs roughly $12/year to run 24/7 at typical US power rates. |
| **Apple Silicon native** | Codex CLI, GOBBY, and skill executables all run as arm64 with no Rosetta. |
| **Unified memory** | A 16 GB Mini holds the runtime, the Codex child process, browser automation, and a media transcoder in headroom. |
| **macOS Keychain** | All credentials (Codex API, Telegram, Discord, surfaces) live in Keychain, never on disk in plaintext. |
| **launchctl** | The official supervisor. GOBBY ships a LaunchAgent that handles restart, log rotation, and sleep/wake. |
| **TCC** | Microphone, camera, screen, and notification permissions follow Apple's permission model, not a custom prompt. |
| **Small physical footprint** | 5x5 inches; sits behind a monitor, on top of a router, inside a media cabinet. |

You can run GOBBY on any Linux machine, but it's tuned for the Mini. Numbers in this README are measured on a base M4 (16 GB, fanless).

## How it compares

| Capability | GOBBY | Generic agent runtime | Codex CLI alone |
|---|:---:|:---:|:---:|
| Codex Responses API | native | via provider trait | native |
| Provider switching | Codex only | any LLM | n/a |
| Messaging surfaces | built-in | varies | none |
| Skills as folders | yes | rare | no |
| Local control plane | yes | varies | yes |
| Apple Silicon tuned | yes | platform-agnostic | yes |
| Mac Mini LaunchAgent | shipped | manual | manual |
| Keychain credentials | yes | platform-agnostic | n/a |

GOBBY's bet: committing to one backend and one hardware target lets you unlock deeper integration than a portable runtime can offer.

---

## Table of Contents

- [System Architecture](#system-architecture)
- [Codex Bridge](#codex-bridge)
- [Skills System](#skills-system)
- [Surface Adapters](#surface-adapters)
- [Frame Protocol](#frame-protocol)
- [macOS Integration](#macos-integration)
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
        |       MAC MINI M4  (GOBBY Gateway)          |
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
        |  +-----------+  +----------+  +-----------+  |
        |  | Keychain  |  | LaunchD  |  | TCC       |  |
        |  | (creds)   |  | (super)  |  | (perms)   |  |
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

The entire stack runs as a single Rust process on the Mac Mini. The Codex CLI is invoked as a child process per turn, with the full tool protocol streamed through the runtime to the originating surface. macOS supplies the supervisor (`launchd`), the credential store (Keychain), and the permission model (TCC).

---

## Codex Bridge

The bridge spawns the `codex` CLI as a child process per turn and streams the JSON event protocol back to the runtime. Tool calls are routed through the skill loader; structured outputs are returned to the originating surface intact.

```rust
// crates/GOBBY-codex/src/bridge.rs
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

Skills are directories under `~/GOBBY/skills/<name>/` with a single `SKILL.md` file. The first heading is the tool name; the first paragraph is the summary. GOBBY reads them at boot and exposes them to Codex as tool definitions.

```
~/GOBBY/
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

Adding a directory under `~/GOBBY/skills/` makes the skill available to the next Codex turn &mdash; no runtime restart.

```rust
// crates/GOBBY-skills/src/loader.rs
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
// crates/GOBBY-surfaces/src/adapter.rs
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
// crates/GOBBY-gateway/src/frame.rs
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

## macOS Integration

GOBBY treats macOS as a first-class platform, not a Unix variant. Three system services are used directly:

**Keychain** &mdash; All credentials (Codex API key, Telegram bot token, Discord token, WhatsApp pairing tokens) are stored in the user's login Keychain. They never live in `GOBBY.toml` or on disk in plaintext.

```rust
// crates/GOBBY-surfaces/src/macos/keychain.rs
pub fn read_secret(account: &str) -> Result<String, KeychainError> {
    let output = Command::new("security")
        .args(["find-generic-password", "-s", "GOBBY", "-a", account, "-w"])
        .output()?;
    if !output.status.success() {
        return Err(KeychainError::NotFound);
    }
    Ok(String::from_utf8(output.stdout)?.trim().to_string())
}
```

**launchd** &mdash; A LaunchAgent plist (`~/Library/LaunchAgents/bot.GOBBY.gateway.plist`) supervises the gateway. It restarts on crash, survives logout, and gets a clean `PATH` that includes Homebrew and the Codex CLI.

**TCC** &mdash; Microphone, camera, screen recording, and notification permissions are requested through the macOS prompt the first time a skill asks for them. GOBBY caches the decision and re-requests if the user revokes.

The full plist template ships at [`docs/macos/LaunchAgent.plist.example`](docs/macos/LaunchAgent.plist.example).

---

## Configuration

One file at `~/.GOBBY/GOBBY.toml`. Schema-checked on boot.

```toml
[runtime]
workspace = "~/GOBBY"
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
bot_name   = "GOBBY"

[macos]
launchd_label = "bot.GOBBY.gateway"
keychain_service = "GOBBY"
log_dir = "~/Library/Logs/GOBBY"

[telegram]
bot_token = "keychain:telegram_bot"

[discord]
token = "keychain:discord_bot"

[skills]
auto_reload    = true
allow_external = false
```

---

## Quick Start

```bash
# Clone and build on the Mac Mini
git clone https://github.com/nick-baumann/GOBBY.git
cd GOBBY
cargo build --release

# Install the binary
cargo install --path crates/GOBBY

# Verify the Codex CLI is on PATH
codex --version

# Store Codex API key in Keychain
security add-generic-password -s GOBBY -a codex_api -w "$YOUR_KEY"

# Pair a messaging surface (writes credentials to Keychain)
GOBBY login

# Install the LaunchAgent (auto-start on login)
GOBBY install --launch-agent

# Or start the gateway in the foreground
GOBBY gateway --port 7600 --verbose

# Send a message
GOBBY send --to +1234567890 --message "release the goblins"

# Invoke the agent directly from the CLI
GOBBY agent --message "summarize my unread email" --thinking high
```

---

## Performance

Measured on a base Mac Mini M4 (16 GB, fanless):

| Metric | Target | Measured |
|---|:---:|:---:|
| Cold start to ready | < 250 ms | 194 ms |
| Frame validation (typical) | < 80 us | 41 us |
| Idempotency lookup | < 5 us | 1.7 us |
| WhatsApp inbound to Codex dispatch | < 35 ms | 24 ms |
| Codex turn (gpt-5.5, no tool use) | < 1.5 s | 1.0 s |
| Skill reload latency | < 50 ms | 33 ms |
| Memory, idle | < 80 MB | 58 MB |
| Memory, 8 active sessions | < 250 MB | 168 MB |
| Power draw, idle | < 12 W | 9.8 W |
| Power draw, active Codex turn | < 30 W | 24 W |
| Sustained CPU, 24h | < 4 % | 2.6 % |

Two interesting properties of the Mini specifically: the fanless base M4 stays silent even during sustained sessions, and the 24h average power draw works out to roughly $12/year at US average electricity rates.

---

## Documentation

| Document | Description |
|---|---|
| [`docs/index.md`](docs/index.md) | Architecture overview |
| [`docs/codex.md`](docs/codex.md) | Codex bridge internals |
| [`docs/skills.md`](docs/skills.md) | Skill authoring guide |
| [`docs/surfaces.md`](docs/surfaces.md) | Surface adapter contract |
| [`docs/macos.md`](docs/macos.md) | macOS integration deep-dive (Keychain, launchd, TCC) |
| [`docs/mac-mini-setup.md`](docs/mac-mini-setup.md) | First-time Mac Mini provisioning |
| [`docs/configuration.md`](docs/configuration.md) | Full configuration reference |
| [`docs/security.md`](docs/security.md) | Threat model and credentials |
| [`docs/operations.md`](docs/operations.md) | Running GOBBY in the foreground or via launchd |
| [`docs/troubleshooting.md`](docs/troubleshooting.md) | Common failure modes |

---

<p align="center">
  <sub>GOBBY is a goblin. The name's a nickname; the mascot is the rest of the joke.</sub>
</p>

<p align="center">
  <sub>Built on <a href="https://github.com/openai/codex">openai/codex</a>. Follow development at <a href="https://x.com/nickbaumann_">@nickbaumann_</a>.</sub>
</p>
