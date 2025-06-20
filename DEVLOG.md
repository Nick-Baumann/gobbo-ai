# Development Log

A running notebook of changes, observations, and small experiments.

- 2025-05-12: 1.4x throughput on inference
- 2025-05-12: fixed an off-by-one in the buffer iter
- 2025-05-13: engine learned to fianchetto
- 2025-05-13: moved a cargo dep to workspace
- 2025-05-14: candidate failed gate, archived
- 2025-05-14: switched to AdamW
- 2025-05-15: tightened type signatures
- 2025-05-15: swapped to a faster hashmap
- 2025-05-16: lowered batch size for stability
- 2025-05-17: fixed a flaky lichess reconnect
- 2025-05-17: added one more validation check
- 2025-05-19: added a regression test
- 2025-05-21: discovered another sicilian line
- 2025-05-21: noticed a slow path in the encoder
- 2025-05-23: noticed a slow path in MCTS expand
- 2025-05-24: dropped a buggy feature flag
- 2025-05-26: renamed a confusing field
- 2025-05-27: coach output is now strict JSON
- 2025-06-02: swapped to a faster hashmap
- 2025-06-02: candidate passed at 56%
- 2025-06-03: discovered another sicilian line
- 2025-06-03: no regression in selfplay time
- 2025-06-05: switched to AdamW
- 2025-06-05: added a quick benchmark
- 2025-06-06: fixed a panic on empty PGN
- 2025-06-06: engine learned to fianchetto
- 2025-06-07: added schema validation on coach output
- 2025-06-08: coach output is now strict JSON
- 2025-06-10: promoted
- 2025-06-11: kept Adam, AdamW was worse here
- 2025-06-16: noticed a slow path in MCTS expand
- 2025-06-18: added more telemetry
- 2025-06-19: trained for 6 epochs instead of 8
- 2025-06-20: candidate passed at 56%