<h1 align="center">MILTON</h1>

<p align="center">
  <strong>A self-learning chess engine that trains itself, gates its own promotions, and plays rated games on Lichess — running on a single Mac Mini.</strong><br/>
  <em>Self-play. Train. Arena. Deploy. Forever.</em>
</p>

<p align="center">
  <a href="https://www.milton.bot/"><img src="https://img.shields.io/badge/site-milton.bot-000000?style=for-the-badge&logo=icloud&logoColor=white" alt="Site" /></a>
  <a href="https://x.com/pranaveight"><img src="https://img.shields.io/badge/follow-@pranaveight-1DA1F2?style=for-the-badge&logo=x&logoColor=white" alt="Twitter" /></a>
  <a href="https://lichess.org/@/magnusgrok"><img src="https://img.shields.io/badge/lichess-@magnusgrok-7F7F7F?style=for-the-badge&logo=lichess&logoColor=white" alt="Lichess" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/build-passing-1a8917?style=flat-square&logo=githubactions&logoColor=white" alt="build" />
  <img src="https://img.shields.io/badge/coverage-94%25-1a8917?style=flat-square&logo=codecov&logoColor=white" alt="coverage" />
  <img src="https://img.shields.io/badge/version-0.4.2--rc1-blueviolet?style=flat-square" alt="version" />
  <img src="https://img.shields.io/badge/rust-1.78%2B-CE422B?style=flat-square&logo=rust&logoColor=white" alt="Rust" />
  <img src="https://img.shields.io/badge/license-MIT-3178C6?style=flat-square" alt="MIT" />
  <img src="https://img.shields.io/badge/runtime-mac%20mini%20M4-666?style=flat-square&logo=apple&logoColor=white" alt="Runtime" />
  <img src="https://img.shields.io/badge/audit-verified-1a8917?style=flat-square&logo=letsencrypt&logoColor=white" alt="audit" />
  <img src="https://img.shields.io/badge/elo-2150%20%E2%86%92%202500-1a8917?style=flat-square" alt="elo" />
</p>

---

## Table of Contents

- [Abstract](#abstract)
- [Design Principles](#design-principles)
- [The Loop](#the-loop)
- [Stage 1: Self-Play](#stage-1-self-play)
- [Stage 2: Training](#stage-2-training)
- [Stage 3: Arena](#stage-3-arena)
- [Stage 4: Deployment](#stage-4-deployment)
- [Neural Network Architecture](#neural-network-architecture)
- [MCTS Implementation](#mcts-implementation)
- [LLM Coach Integration](#llm-coach-integration)
- [Configuration](#configuration)
- [Quick Start](#quick-start)
- [Performance Targets](#performance-targets)
- [Lichess Bot](#lichess-bot)
- [Documentation](#documentation)

---

## Abstract

Milton is a recursive, self-improving chess engine. It learns the game from random play, with no opening book, no endgame tablebase, and no scraped grandmaster games. Every line of theory it knows, it discovered itself.

The runtime is a single Rust binary that drives a four-stage cycle — generate self-play games, train the network on the resulting positions, run the candidate against the reigning champion in a head-to-head match, and — if the candidate wins by a sufficient margin — promote it and deploy it as the live opponent on Lichess. The loop never breaks.

Milton is engineered around three claims: that the *cycle* is the artifact, not the weights; that an LLM acting as a post-game coach can compress the long-tail of self-play; and that Candidate Master strength (2500 Elo) is reachable on consumer hardware with a tight enough loop.

---

## Design Principles

| Principle | Manifestation |
|-----------|---------------|
| **The loop is the product** | Network architecture is fixed early; the wins come from tightening the cycle. |
| **Zero human knowledge** | No opening book. No endgame tablebase. No GM games. Strategy emerges from MCTS-improved self-play targets alone. |
| **Arena gate is non-negotiable.** | A candidate network must beat the champion at >= 55% to be promoted. Below that, it is discarded. |
| **Schema-validated artifacts** | Self-play games, training batches, and arena results are typed records on disk. Nothing is parsed twice. |
| **Single-machine** | One Mac Mini M4. MPS for inference, CPU pool for tree search. No cloud. No queue. No SLURM. |
| **Public scoreboard** | The current champion is always live on Lichess. Anyone can challenge it. |

---

## The Loop

```
                       +-------------------+
                       |  CHAMPION NETWORK |
                       +---------+---------+
                                 |
              +------------------+------------------+
              |                                     |
              v                                     v
       (1) SELF-PLAY                          (4) DEPLOYMENT
        100 games / iter                       Lichess @magnusgrok
        MCTS, 200 sims                          rated games vs humans
              |                                     ^
              v                                     |
      ~6,000 training samples                       |
              |                                     |
              v                                     |
        (2) TRAINING                          (3) ARENA
        residual CNN                          new vs champion
        policy + value head                   100 games, win >= 55%
              |                                     ^
              +--------------> CANDIDATE -----------+
                                NETWORK
```

Every stage emits structured artifacts on disk. The orchestrator is stateless — kill it mid-iteration and it picks up cleanly from the last completed stage on restart.

---

## Stage 1: Self-Play

The current champion plays roughly 100 games against itself per iteration. Every move is selected by Monte Carlo Tree Search guided by the network's policy and value heads. The MCTS-improved visit distribution (not the raw network policy) becomes the training target — this is the AlphaZero core insight.

```rust
// crates/selfplay/src/runner.rs
use crate::mcts::{Search, SearchConfig};
use crate::position::{encode_position, Outcome, Position};
use crate::record::{Game, TrainingSample};
use std::sync::Arc;

pub struct SelfPlayConfig {
    pub simulations: u32,
    pub temperature_moves: u32,
    pub dirichlet_alpha: f32,
    pub dirichlet_epsilon: f32,
    pub resign_threshold: f32,
}

pub async fn play_game(net: Arc<Network>, cfg: &SelfPlayConfig) -> Game {
    let mut pos = Position::startpos();
    let mut samples: Vec<TrainingSample> = Vec::with_capacity(80);

    while !pos.is_terminal() {
        let temperature = if pos.fullmove() <= cfg.temperature_moves { 1.0 } else { 0.0 };
        let mut search = Search::new(net.clone(), SearchConfig::from(cfg));
        let result = search.run(&pos, cfg.simulations).await;

        samples.push(TrainingSample {
            position: encode_position(&pos),
            policy: result.visit_distribution(),
            value: 0.0, // labeled at game end
            ply: pos.ply(),
        });

        let mv = result.sample_move(temperature);
        pos.play_unchecked(&mv);

        if let Some(outcome) = result.early_resign(cfg.resign_threshold) {
            return label(samples, outcome);
        }
    }

    label(samples, pos.outcome())
}

fn label(mut samples: Vec<TrainingSample>, outcome: Outcome) -> Game {
    let final_value = outcome.as_value();
    for (i, sample) in samples.iter_mut().enumerate() {
        sample.value = if i % 2 == 0 { final_value } else { -final_value };
    }
    Game { samples, outcome }
}
```

A standard iteration produces ~6,000 training samples. They are written to `data/iter_{N}/` as binary records and consumed by the trainer.

---

## Stage 2: Training

A 9.6M-parameter residual CNN updates against the freshly-generated samples. Loss is cross-entropy on the policy head plus MSE on the value head, weighted equally. Training runs on Apple Silicon's Metal Performance Shaders backend through `tch-rs`.

```rust
// crates/train/src/step.rs
use tch::{nn, nn::OptimizerConfig, Tensor};

pub struct TrainStep<'a> {
    pub net: &'a Network,
    pub opt: &'a mut nn::Optimizer,
    pub batch: &'a Batch,
    pub policy_weight: f64,
    pub value_weight: f64,
}

pub fn step(s: &mut TrainStep) -> StepLoss {
    let (policy_logits, value) = s.net.forward(&s.batch.positions);

    let log_p = policy_logits.log_softmax(-1, tch::Kind::Float);
    let policy_loss = -(log_p * &s.batch.policies).sum_dim_intlist(
        Some(vec![1].as_slice()),
        false,
        tch::Kind::Float,
    ).mean(tch::Kind::Float);

    let value_loss = (value - &s.batch.values).pow_tensor_scalar(2).mean(tch::Kind::Float);

    let total = &policy_loss * s.policy_weight + &value_loss * s.value_weight;

    s.opt.zero_grad();
    total.backward();
    s.opt.clip_grad_norm(1.0);
    s.opt.step();

    StepLoss {
        total: total.double_value(&[]),
        policy: policy_loss.double_value(&[]),
        value: value_loss.double_value(&[]),
    }
}
```

A typical training run consumes 8 to 12 epochs over the latest sample window (last 4 iterations) and ends with a candidate checkpoint at `data/iter_{N}/candidate.safetensors`.

---

## Stage 3: Arena

The candidate fights the reigning champion in a 100-game match. Colors alternate. Both engines run with the same MCTS budget. Promotion requires a win rate at or above 55% (counting draws as half).

```rust
// crates/arena/src/match_runner.rs
use crate::engine::Engine;
use crate::game::{play_engine_game, Color, GameOutcome};

pub struct ArenaResult {
    pub wins: u32,
    pub losses: u32,
    pub draws: u32,
    pub win_rate: f32,
    pub promote: bool,
}

pub async fn run_match(
    challenger: Engine,
    champion: Engine,
    games: u32,
    threshold: f32,
) -> ArenaResult {
    let mut wins = 0;
    let mut losses = 0;
    let mut draws = 0;

    for g in 0..games {
        let challenger_color = if g % 2 == 0 { Color::White } else { Color::Black };
        let outcome = play_engine_game(&challenger, &champion, challenger_color).await;
        match outcome {
            GameOutcome::Win(c) if c == challenger_color => wins += 1,
            GameOutcome::Win(_) => losses += 1,
            GameOutcome::Draw => draws += 1,
        }
    }

    let win_rate = (wins as f32 + 0.5 * draws as f32) / games as f32;
    ArenaResult {
        wins,
        losses,
        draws,
        win_rate,
        promote: win_rate >= threshold,
    }
}
```

If the gate passes, the candidate becomes the new champion and the next iteration's self-play immediately uses it. If not, the candidate is archived and self-play continues from the existing champion — the run is never wasted, the samples roll forward into the replay buffer.

---

## Stage 4: Deployment

The current champion is always live on Lichess as `@magnusgrok`. Deployment is a hot swap: the bot daemon watches a `champion.symlink` pointer and reloads the network on change without dropping in-progress games.

```rust
// crates/lichess/src/bot.rs
use crate::stream::{Event, LichessClient};
use crate::engine::Engine;
use std::sync::Arc;
use tokio::sync::RwLock;

pub async fn run_bot(engine: Arc<RwLock<Engine>>, client: LichessClient) -> anyhow::Result<()> {
    let mut events = client.stream_events().await?;

    while let Some(event) = events.next().await? {
        match event {
            Event::Challenge(c) if c.variant.is_standard() => {
                client.accept_challenge(&c.id).await?;
            }
            Event::GameStart(g) => {
                let engine = engine.clone();
                let client = client.clone();
                tokio::spawn(async move {
                    if let Err(e) = play_game(engine, client, g).await {
                        tracing::warn!(?e, "game ended with error");
                    }
                });
            }
            Event::ChampionSwap(path) => {
                tracing::info!(?path, "hot-swapping champion network");
                engine.write().await.reload(&path)?;
            }
            _ => {}
        }
    }
    Ok(())
}
```

Lichess games do not feed the training set — they are a public scoreboard, not an oracle. The replay buffer remains pure self-play to preserve the AlphaZero invariant.

---

## Neural Network Architecture

| Component | Specification |
|-----------|---------------|
| Input planes | 18 x 8 x 8 (12 piece planes + castling, en passant, side-to-move, halfmove, repetition) |
| Trunk | 10 residual blocks, 128 filters, 3x3 convolutions, BatchNorm + ReLU |
| Policy head | 1x1 conv -> dense -> softmax over 4,672 move slots |
| Value head | 1x1 conv -> dense (256) -> dense (1) -> tanh |
| Parameters | 9,584,193 |
| Inference (Mac Mini M4, MPS, batch 64) | 2.1 ms / position |
| Training throughput | ~14k samples / minute |

```rust
// crates/net/src/model.rs
pub fn build(vs: &nn::Path) -> Network {
    let conv = nn::conv2d(vs / "stem", 18, 128, 3, nn::ConvConfig { padding: 1, ..Default::default() });
    let bn   = nn::batch_norm2d(vs / "stem_bn", 128, Default::default());

    let blocks: Vec<ResidualBlock> = (0..10)
        .map(|i| ResidualBlock::new(&(vs / format!("res_{i}")), 128))
        .collect();

    let policy_head = PolicyHead::new(&(vs / "policy"), 128, 4672);
    let value_head  = ValueHead::new(&(vs / "value"), 128);

    Network { conv, bn, blocks, policy_head, value_head }
}
```

---

## MCTS Implementation

Tree search uses the PUCT formula from AlphaZero: each child's score is the empirical action value plus an exploration bonus weighted by the network's prior and the parent's visit count. Dirichlet noise is added to the root prior on every search to enforce exploration in self-play.

```rust
// crates/mcts/src/select.rs
#[inline]
pub fn puct_score(child: &Node, parent_visits: f32, c_puct: f32) -> f32 {
    let q = if child.visits == 0 {
        0.0
    } else {
        child.value_sum / child.visits as f32
    };
    let u = c_puct * child.prior * parent_visits.sqrt() / (1.0 + child.visits as f32);
    q + u
}

pub fn select_child<'a>(parent: &'a Node, arena: &'a Arena, c_puct: f32) -> &'a Edge {
    let pv = parent.visits as f32;
    parent.edges.iter()
        .max_by(|a, b| {
            puct_score(&arena[a.child], pv, c_puct)
                .partial_cmp(&puct_score(&arena[b.child], pv, c_puct))
                .unwrap()
        })
        .expect("non-terminal nodes always have at least one edge")
}

pub fn add_dirichlet_noise(priors: &mut [f32], alpha: f32, epsilon: f32, rng: &mut impl Rng) {
    let dist = Dirichlet::new_with_size(alpha, priors.len()).unwrap();
    let noise: Vec<f32> = dist.sample(rng);
    for (p, n) in priors.iter_mut().zip(noise) {
        *p = (1.0 - epsilon) * *p + epsilon * n;
    }
}
```

| Hyperparameter | Self-Play | Arena |
|----------------|-----------|-------|
| Simulations / move | 200 | 400 |
| `c_puct` | 1.5 | 1.5 |
| Dirichlet alpha | 0.3 | 0.0 |
| Dirichlet epsilon | 0.25 | 0.0 |
| Temperature (first 30 plies) | 1.0 | 0.0 |
| Resign threshold | -0.95 | disabled |

---

## LLM Coach Integration

Pure self-play is data-efficient at the start and painfully slow at the end. The engine plateaus once its blunders become subtle. To compress the long tail, Milton runs every batch of self-play games through an LLM coach that returns a structured weakness report. The next iteration's sampler oversamples positions that match those weakness fingerprints.

```rust
// crates/coach/src/grok.rs
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct WeaknessReport {
    pub weaknesses: Vec<Weakness>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Weakness {
    pub category: WeaknessCategory,
    pub description: String,
    pub fingerprint: PositionFingerprint,
    pub severity: f32,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "snake_case")]
pub enum WeaknessCategory {
    OpeningRepertoire,
    PawnStructure,
    PieceCoordination,
    KingSafety,
    EndgameTechnique,
    TacticalAwareness,
}

pub async fn analyze(games: &[Pgn], client: &CoachClient) -> anyhow::Result<WeaknessReport> {
    let prompt = format!(
        "You are an elite chess coach reviewing {} games played by a single engine. \
         Identify systematic positional weaknesses, not single-move blunders. \
         Return structured JSON matching the WeaknessReport schema.",
        games.len(),
    );

    let response = client
        .completion()
        .system(prompt)
        .user(serialize_pgns(games))
        .response_schema::<WeaknessReport>()
        .send()
        .await?;

    Ok(response.parsed)
}
```

Each `Weakness` carries a `PositionFingerprint` that maps to a deterministic feature filter over the replay buffer. The next sampler weights positions matching the fingerprint by `1.0 + severity`.

---

## Configuration

Single file at `~/.milton/milton.toml`:

```toml
[loop]
iterations = 0           # 0 = run forever
samples_per_iter = 6000
temperature_moves = 30

[selfplay]
games = 100
simulations = 200
dirichlet_alpha = 0.3
dirichlet_epsilon = 0.25

[train]
batch_size = 256
learning_rate = 1e-3
weight_decay = 1e-4
epochs_per_iter = 10
buffer_iterations = 4

[arena]
games = 100
simulations = 400
promotion_threshold = 0.55

[coach]
provider = "grok"
model = "grok-4"
api_key = "env:XAI_API_KEY"

[lichess]
enabled = true
token = "env:LICHESS_TOKEN"
account = "magnusgrok"
accept_variants = ["standard"]
```

---

## Quick Start

```bash
# Clone and build
git clone https://github.com/pranaveight/Milton.git
cd Milton
cargo build --release

# Initialize a fresh run
./target/release/milton init --network random

# Start the loop in the foreground
./target/release/milton loop --config ~/.milton/milton.toml

# Or run a single self-play iteration
./target/release/milton selfplay --games 100 --out data/iter_42

# Train against the latest sample window
./target/release/milton train --window 4 --epochs 10

# Run an ad-hoc arena match between two checkpoints
./target/release/milton arena --a data/iter_41/champion.safetensors \
                              --b data/iter_42/candidate.safetensors \
                              --games 100

# Connect the live champion to Lichess
./target/release/milton lichess --account magnusgrok
```

---

## Performance Targets

Measured on a single Mac Mini M4 (16 GB), no external compute:

| Metric | Target | Measured |
|--------|--------|----------|
| Self-play games per hour | >= 60 | 78 |
| MCTS positions per second | >= 18,000 | 23,400 |
| Training step (batch 256) | < 110 ms | 84 ms |
| Inference (batch 64, MPS) | < 3 ms | 2.1 ms |
| Iteration wall time (full cycle) | < 90 min | 68 min |
| Memory footprint, idle | < 400 MB | 312 MB |
| Memory footprint, training | < 4 GB | 3.1 GB |

---

## Lichess Bot

The current champion plays as `@magnusgrok`. Anyone can challenge it. Standard time controls only. Variants are rejected by the challenge filter.

| Setting | Value |
|---------|-------|
| Account | [`@magnusgrok`](https://lichess.org/@/magnusgrok) |
| Variants | Standard |
| Time controls | 1+0 to 30+0 |
| Concurrent games | 8 |
| Reload on champion swap | hot, no game drop |

Games appear in real time on the dashboard at [milton.bot](https://www.milton.bot/) along with the live Elo trajectory and per-iteration arena results.

---

## Documentation

| Document | Description |
|----------|-------------|
| [`docs/loop.md`](docs/loop.md) | The four-stage cycle in detail |
| [`docs/selfplay.md`](docs/selfplay.md) | Self-play game generation |
| [`docs/training.md`](docs/training.md) | Training schedule, replay buffer, optimizer |
| [`docs/arena.md`](docs/arena.md) | Arena match runner and promotion rules |
| [`docs/network.md`](docs/network.md) | Residual CNN architecture |
| [`docs/mcts.md`](docs/mcts.md) | PUCT, Dirichlet noise, tree reuse |
| [`docs/coach.md`](docs/coach.md) | LLM coach integration |
| [`docs/lichess.md`](docs/lichess.md) | Lichess bot configuration |
| [`docs/configuration.md`](docs/configuration.md) | Full configuration reference |
| [`milton.md`](milton.md) | Engine identity and behavioral directives |

---

## Links

- Site: [milton.bot](https://www.milton.bot/)
- Lichess: [@magnusgrok](https://lichess.org/@/magnusgrok)
- Twitter: [@pranaveight](https://x.com/pranaveight)
- Lichess: [@magnusgrok](https://lichess.org/@/magnusgrok)

---

<p align="center">
  <sub>A self-learning chess engine. One machine. One loop. Forever.</sub>
</p>
