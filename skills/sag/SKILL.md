---
name: sag
description: ElevenLabs text-to-speech with mac-style say UX.
homepage: https://sag.sh
metadata: {"clawdis":{"emoji":"🗣️","requires":{"bins":["sag"],"env":["ELEVENLABS_API_KEY"]},"primaryEnv":"ELEVENLABS_API_KEY","install":[{"id":"brew","kind":"brew","formula":"steipete/tap/sag","bins":["sag"],"label":"Install sag (brew)"}]}}
---

# sag

Use `sag` for ElevenLabs TTS with local playback.

API key (required)
- `ELEVENLABS_API_KEY` (preferred)
- `SAG_API_KEY` also supported by the CLI

Quick start
- `sag "Hello there"`
- `sag speak -v "Roger" "Hello"`
- `sag voices`
- `sag prompting` (model-specific tips)

Model notes
- Default: `eleven_v3` (expressive)
- Stable: `eleven_multilingual_v2`
- Fast: `eleven_flash_v2_5`

Voice defaults
- `ELEVENLABS_VOICE_ID` or `SAG_VOICE_ID`

Confirm voice + speaker before long output.
