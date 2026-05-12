# Operations

## Running the loop

```
milton loop --config ~/.milton/milton.toml
```

The process is intentionally foreground. Wrap it with `launchd` or `tmux` if
you want it to survive logout.

## Halt and resume

`Ctrl-C` or `SIGTERM` halts at the next stage boundary. The orchestrator
writes its progress to `~/.milton/state.json` so a subsequent `milton loop`
picks up cleanly.

## Inspecting an iteration

```
milton inspect data/iter_42
```

Shows: sample count, training loss curve, arena result, time per stage,
hardware utilization. Outputs JSON if `--json` is passed.
