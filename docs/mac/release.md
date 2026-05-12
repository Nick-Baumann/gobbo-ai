---
summary: "Gobbo macOS release checklist (Sparkle feed, packaging, signing)"
read_when:
  - Cutting or validating a Gobbo macOS release
  - Updating the Sparkle appcast or feed assets
---

# Gobbo macOS release (Sparkle)

This app now ships Sparkle auto-updates. Release builds must be Developer ID–signed, zipped, and published with a signed appcast entry.

## Prereqs
- Developer ID Application cert installed (`Developer ID Application: Peter Steinberger (Y5PE65HELJ)` is expected).
- Sparkle private key path set in the environment as `SPARKLE_PRIVATE_KEY_FILE`; key lives in `/Users/nickbaumann/Library/CloudStorage/Dropbox/Backup/Sparkle` (same key as Trimmy; public key baked into Info.plist).
- Notary credentials (keychain profile or API key) for `xcrun notarytool` if you want Gatekeeper-safe DMG/zip distribution.
  - We use a Keychain profile named `gobbo-notary`, created from App Store Connect API key env vars in your shell profile:
    - `APP_STORE_CONNECT_API_KEY_P8`, `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`
    - `echo "$APP_STORE_CONNECT_API_KEY_P8" | sed 's/\\n/\n/g' > /tmp/gobbo-notary.p8`
    - `xcrun notarytool store-credentials "gobbo-notary" --key /tmp/gobbo-notary.p8 --key-id "$APP_STORE_CONNECT_KEY_ID" --issuer "$APP_STORE_CONNECT_ISSUER_ID"`
- `pnpm` deps installed (`pnpm install --config.node-linker=hoisted`).
- Sparkle tools are fetched automatically via SwiftPM at `apps/macos/.build/artifacts/sparkle/Sparkle/bin/` (`sign_update`, `generate_appcast`, etc.).

## Build & package
```bash
# From repo root; set release IDs so Sparkle feed is enabled
BUNDLE_ID=com.nickbaumann.gobbo \
APP_VERSION=0.1.0 \
APP_BUILD=0.1.0 \
BUILD_CONFIG=release \
SIGN_IDENTITY="Developer ID Application: Peter Steinberger (Y5PE65HELJ)" \
scripts/package-mac-app.sh

# Zip for distribution (includes resource forks for Sparkle delta support)
ditto -c -k --sequesterRsrc --keepParent dist/Gobbo.app dist/Gobbo-0.1.0.zip

# Optional: also build a styled DMG for humans (drag to /Applications)
scripts/create-dmg.sh dist/Gobbo.app dist/Gobbo-0.1.0.dmg

# Recommended: build + notarize/staple zip + DMG
# First, create a keychain profile once:
#   xcrun notarytool store-credentials "gobbo-notary" \
#     --apple-id "<apple-id>" --team-id "<team-id>" --password "<app-specific-password>"
NOTARIZE=1 NOTARYTOOL_PROFILE=gobbo-notary \
BUNDLE_ID=com.nickbaumann.gobbo \
APP_VERSION=0.1.0 \
APP_BUILD=0.1.0 \
BUILD_CONFIG=release \
SIGN_IDENTITY="Developer ID Application: Peter Steinberger (Y5PE65HELJ)" \
scripts/package-mac-dist.sh

# Optional: ship dSYM alongside the release
ditto -c -k --keepParent apps/macos/.build/release/Gobbo.app.dSYM dist/Gobbo-0.1.0.dSYM.zip
```

## Appcast entry
Use the release note generator so Sparkle renders formatted HTML notes:
```bash
SPARKLE_PRIVATE_KEY_FILE=/Users/nickbaumann/Library/CloudStorage/Dropbox/Backup/Sparkle/ed25519-private-key scripts/make_appcast.sh dist/Gobbo-0.1.0.zip   https://raw.githubusercontent.com/nickbaumann/gobbo/main/appcast.xml
```
Generates HTML release notes from `CHANGELOG.md` (via `scripts/changelog-to-html.sh`) and embeds them in the appcast entry.
Commit the updated `appcast.xml` alongside the release assets (zip + dSYM) when publishing.

## Publish & verify
- Upload `Gobbo-0.1.0.zip` (and `Gobbo-0.1.0.dSYM.zip`) to the GitHub release for tag `v0.1.0`.
- Ensure the raw appcast URL matches the baked feed: `https://raw.githubusercontent.com/nickbaumann/gobbo/main/appcast.xml`.
- Sanity checks:
  - `curl -I https://raw.githubusercontent.com/nickbaumann/gobbo/main/appcast.xml` returns 200.
  - `curl -I <enclosure url>` returns 200 after assets upload.
  - On a previous public build, run “Check for Updates…” from the About tab and verify Sparkle installs the new build cleanly.

Definition of done: signed app + appcast are published, update flow works from an older installed version, and release assets are attached to the GitHub release.
