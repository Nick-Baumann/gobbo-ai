# Changelog

## 0.4.2 - Unreleased

### Features
- LLM coach: structured weakness reports drive replay buffer reweighting.
- Lichess client hot-swaps the champion network without dropping games.

### Fixes
- MCTS: fixed a virtual-loss leak when a simulation hit a terminal node.
- Trainer: prevent NaN gradients when the buffer is unusually small.

## 0.4.1

### Features
- Arena: 55% promotion threshold, color alternation, tree reuse within game.
- Self-play: temperature schedule (1.0 for first 30 plies, 0.0 after).

### Fixes
- Self-play: resignation requires both engines to agree.

## 0.4.0

Initial public release. Self-play, training, arena, deployment.
