---
summary: "macOS Skills settings UI and gateway-backed status"
read_when:
  - Updating the macOS Skills settings UI
  - Changing skills gating or install behavior
---
# Skills (macOS)

The macOS app surfaces Gobbo skills via the gateway; it does not parse skills locally.

## Data source
- `skills.status` (gateway) returns all skills plus eligibility and missing requirements.
- Requirements are derived from `metadata.gobbo.requires` in each `SKILL.md`.

## Install actions
- `metadata.gobbo.install` defines install options (brew/node/go/uv).
- The app calls `skills.install` to run installers on the gateway host.
- The gateway surfaces only one preferred installer when multiple are provided (brew when available, otherwise node manager from `skillsInstall`, default npm).

## Env/API keys
- The app stores keys in `~/.gobbo/gobbo.json` under `skills.<skillKey>`.
- `skills.update` patches `enabled`, `apiKey`, and `env`.

## Remote mode
- Install + config updates happen on the gateway host (not the local Mac).
