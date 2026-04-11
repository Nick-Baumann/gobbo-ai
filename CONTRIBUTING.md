# Contributing

Milton is research-grade software. Patches welcome, especially around the loop, the network architecture, and the LLM coach interface.

## Workflow

1. Fork and clone.
2. `cargo build` and `cargo test` should both pass before any PR is opened.
3. Run `cargo fmt` and `cargo clippy --all-targets -- -D warnings`.
4. Keep PRs scoped. One concern per PR.

## Areas of interest

- MCTS hot-path optimization
- Replay buffer prioritization schemes
- Coach prompt iteration
- Lichess client robustness
