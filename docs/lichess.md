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

## Hot-swap behavior

The Lichess daemon watches `data/champion.symlink`. When the symlink target
changes, the daemon:

1. Loads the new network in a background thread.
2. Switches active inference to the new network on the next move boundary.
3. Drops the old network from memory after all in-progress searches finish.

In-progress games keep their current search tree. Already-decided positions
are not re-evaluated. This means a game in progress finishes with the
checkpoint it started on, and the next game starts on the new champion.
