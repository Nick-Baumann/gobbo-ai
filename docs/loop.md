# The Loop

Milton runs an infinite four-stage cycle. Every iteration produces a new
candidate, gates it against the reigning champion, and promotes only if the
candidate clears a 55% win-rate threshold.

1. Self-play
2. Training
3. Arena
4. Deployment

See the README for the high-level diagram. Each stage is described in detail in
its own document under `docs/`.

## Cadence

A typical iteration completes in roughly 70 minutes on a Mac Mini M4. The
orchestrator persists progress between stages so a kill-and-restart picks up
cleanly.

| Stage | Wall time |
|-------|-----------|
| Self-play | 28 min |
| Training | 14 min |
| Arena | 26 min |
| Deployment | <1 sec |

## Failure modes

If a stage crashes, the orchestrator records the failure and retries up to 3
times before halting. Halts surface to the dashboard as a red event card.

## Restart safety

Each stage writes a stage-complete marker to `~/.milton/state.json` before
moving to the next. Killing the process mid-stage is safe: the next launch
detects the missing marker and re-runs the affected stage from scratch.

The only state that cannot be reconstructed is the in-flight self-play games
themselves; those are dropped on restart and the iteration restarts its
self-play stage with zero games. This is acceptable because self-play is the
cheapest stage to redo.
