## Tests

- `pnpm test:force`: Kills any lingering gateway process holding the default lock/port, removes stale lock files, runs the full Vitest suite with an isolated temporary gateway lock path so gateway server tests don’t collide with a running instance. Use this when a prior gateway run left `/tmp/clawdis-gateway.lock` or port 18789 occupied.
- `pnpm test:coverage`: Runs Vitest with V8 coverage. Global thresholds are 70% lines/functions/statements and 55% branches. Coverage excludes integration-heavy entrypoints (CLI wiring, gateway/telegram bridges, webchat static server) to keep the target focused on unit-testable logic.
