# Lichess Bot

The current champion is always live on Lichess as `@magnusgrok`. Deployment is
a hot swap: the daemon watches `data/champion.symlink` and reloads on change
without dropping in-progress games.

## Settings

| Field | Value |
|-------|-------|
| Account | @magnusgrok |
| Variants | standard |
| Time controls | 1+0 to 30+0 |
| Concurrent games | 8 |
