# CLI API Surface

| Command | Description |
|---------|-------------|
| `milton init` | Create a fresh run directory |
| `milton loop` | Run the four-stage loop until interrupted |
| `milton selfplay` | Run a single self-play iteration |
| `milton train` | Train against the latest sample window |
| `milton arena` | Run an ad-hoc arena match |
| `milton lichess` | Connect the current champion to Lichess |
| `milton inspect` | Inspect an iteration directory |
| `milton config` | Print the resolved configuration |

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Generic error |
| 2 | Configuration error |
| 3 | I/O error |
| 4 | Network / Lichess error |
| 5 | Promotion gate failed (only when `--require-promotion` is set) |
