# Architecture

Milton is a single Rust binary plus a few small data directories. There is no
service mesh, no message broker, no external state store. The orchestrator is
the binary; the binary is the orchestrator.

## Crates

| Crate | Responsibility |
|-------|----------------|
| `milton` | CLI entrypoint, top-level orchestration |
| `milton-net` | Network architecture, training, inference |
| `milton-mcts` | Monte Carlo Tree Search |
| `milton-selfplay` | Game generation |
| `milton-arena` | Match runner, promotion logic |
| `milton-lichess` | Lichess bot |
| `milton-coach` | LLM coach interface |
| `milton-record` | On-disk schema for games and samples |

## Data

| Path | Purpose |
|------|---------|
| `~/.milton/milton.toml` | Config |
| `data/iter_{N}/games.bin` | Self-play games |
| `data/iter_{N}/candidate.safetensors` | Trained candidate |
| `data/iter_{N}/arena.json` | Arena result |
| `data/champion.symlink` | Pointer to current champion |
