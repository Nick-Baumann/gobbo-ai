# Configuration

Single file at `~/.milton/milton.toml`. Schema is checked on startup.

## Sections

| Section | Purpose |
|---------|---------|
| `[loop]` | Iteration limits and sampling controls |
| `[selfplay]` | Game count, MCTS budget, exploration |
| `[train]` | Optimizer, batch size, schedule |
| `[arena]` | Match size, promotion threshold |
| `[coach]` | LLM provider and credentials |
| `[lichess]` | Bot account, accepted variants |
