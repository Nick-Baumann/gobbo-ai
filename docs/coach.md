# LLM Coach

Self-play is data-efficient at the start and slow at the end. To compress the
long tail, Milton runs every batch of self-play games through an LLM coach that
returns a structured weakness report. Subsequent self-play oversamples
positions matching the reported fingerprints.

Default provider is xAI Grok. The interface is a simple trait, swapping
providers is a matter of implementing one method.

## Weakness fingerprint format

Each `Weakness` carries a `PositionFingerprint` -- a compact spec that maps to
a deterministic feature filter over the replay buffer.

| Field | Meaning |
|-------|---------|
| `material_signature` | Piece-count tuple, both sides. |
| `pawn_structure_hash` | Murmur64 of the pawn-only bitboards. |
| `phase` | `opening`, `middlegame`, or `endgame`. |
| `king_safety_class` | `castled`, `centralized`, `exposed`. |

Fingerprints are designed to be cheap to compute (under 1us per position) so
the buffer reweighting pass over 24k positions completes in well under a
second.
