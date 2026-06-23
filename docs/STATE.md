# Minka Desktop — Current State

> **Living doc.** Update this at the end of any session that changes the project, then commit. It round-trips between machines via git — it is how office-Claude and travel-Claude stay in sync. Keep it short and current; move durable rules to `CLAUDE.md`.

**Last updated:** 2026-06-23 · **Branch:** `main` — *state reflects the milestones below; run `git log` for live HEAD (no pinned SHA here — it self-invalidates on the next commit).*
**Distribution:** GitHub Actions CI → public GitHub Releases at `github.com/jackarkcreator/minka-desktop`. Ships on `v*` tag push. `electron-updater` pulls `latest.yml` / `latest-mac.yml` from that feed. **macOS is now SIGNED + NOTARIZED (v1.0.8+) → mac auto-update is LIVE.** Windows NSIS still self-updates unsigned (Azure Trusted Signing deferred).

---

## Where we are

- **v1.0.8** (`@20d3069`) — **macOS code-signing + notarization SHIPPED + verified** (2026-06-23). Mac build block flipped from `identity:null`/`hardenedRuntime:false` to the proven Arqos config (`hardenedRuntime:true` + `gatekeeperAssess:false` + `build/entitlements.mac.plist` + `notarize:true`). CI `release.yml` build step split by OS (Windows must NOT receive `CSC_LINK` — on win it names a Windows cert). 6 repo secrets set (`CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_API_KEY_B64`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, `APPLE_TEAM_ID`). Verified on the published dmg: `spctl -a -vv -t install` → **"accepted, source=Notarized Developer ID"**, chain → Apple Root, `flags=0x10000(runtime)`, `.app` stapled. Also folds in the staged `@917943d` absolute-path software-list fix. **Unblocks mac auto-update fleet-wide.** (.dmg wrapper itself isn't stapled — only the .app inside is; matches Arqos, Gatekeeper assesses the .app, fine.)
- **v1.0.7** (`@83c6877`) — Koban security posture + domain-join collection shipped. `collectPosture()` reads FileVault/firewall/AD-bind (mac) and BitLocker/firewall/domain/reboot-pending (win) via absolute-path native commands; all fields degrade to null (never block). This is the current latest release on GitHub Releases (mac universal .dmg + win x64 .exe).
- **v1.0.6** (`@c736fd2`) — Expanded Koban hardware/network facts: `localIp`, `primaryMac`, `manufacturer`, `model`, `biosVersion`, `biosVendor`, `bootTime`, `timezone` via `systeminformation`.
- **v1.0.5** (`@d9756e4`) — Koban presence agent live: `collectPresence()` via `powerMonitor`, tray-resident, `backgroundThrottling:false`, autostart-default-on (marker file), `launchedHidden()` → starts in tray at login.
- **v1.0.4** (`@6b8616e`) — Koban inventory agent bridge: `collectInventory()` full hardware/software snapshot, `minka:get-inventory` IPC, preload `getInventory`.
- **v1.0.3** (`@9bcea7c`) — DPI-aware NSIS installer (`build/installer.nsh` + `ManifestDPIAware true`). Navy installer title bar ABANDONED (hard NSIS/oneClick limit — do not retry).
- **v1.0.2** (`@d0bdee3`) — Silent oneClick installer (`oneClick:true`, no wizard, no UAC, per-user install).
- **v1.0.1** (`@a3c9124`) — Windows navy title bar (platform-gated `titleBarStyle:'hidden'` + `titleBarOverlay` on win) + branded auto-update modal bridge.
- **v1.0.0** (`@2016352`) — Initial release: universal mac + win CI pipeline, auto-update wired.
- **CI race fix** (`@fd4cd6c`) — `max-parallel: 1` serializes mac→win matrix to prevent publish-race 422. Load-bearing; do not change.
- **macOS absolute-path software fix** (`@917943d`) — `collectSoftware()` uses `/usr/sbin/system_profiler` (absolute). Committed without a tag; ships in the next version bump.

## In flight / not done

- **Windows code signing** — Azure Trusted Signing (~$9.99/mo) — kills SmartScreen "Unknown Publisher". (macOS signing DONE in v1.0.8.)
- **Koban: domain/VPN fields** (`devices.domain`, `devices.vpn_active`) — columns provisioned in DB (mig 085) but agent collection NOT built yet. VPN heuristic (utun/WireGuard adapters) deferred.

## Next up

- Windows code signing (Azure Trusted Signing) — unblocks SmartScreen trust for client rollout.
- **First mac auto-update hop is the real test:** a machine on v1.0.7 (unsigned) won't auto-update TO v1.0.8 (the v1.0.7 build's update handler is still signing-gated). v1.0.8 → v1.0.9 will be the first true mac auto-update. Install v1.0.8 manually once to cross the gate.

## Open questions / watch items

- Keno verifies Windows VM (SYS) drawer shows posture fields (disk encryption, firewall, reboot-pending) after auto-update to v1.0.7.
- Keno's Macs (TKO): install the **signed v1.0.8 .dmg** manually (download page) — confirms no Gatekeeper warning on first launch + posture/hardware drawer fields populate. After that, mac auto-update carries forward.
- JC/TRC `activity_enabled` flip is gated on client disclosure verification — tracked in Koban memory, not here.

## How to build / release

```bash
# Local mac build (dev check)
npm install
npm run dist          # → dist/Minka-<version>-mac-universal.dmg

# CI release (authoritative — builds both platforms)
# 1. Bump version in package.json
# 2. Commit as luis.ramos@thinkopen.net
git config user.email "luis.ramos@thinkopen.net"
git log -1 --format='%an <%ae>'   # verify
git tag v1.0.X
git push origin v1.0.X            # NOT --follow-tags; lightweight tags need explicit push

# 3. Watch CI + verify 8 release assets exist
gh run watch
gh release view v1.0.X --repo jackarkcreator/minka-desktop

# 4. PROVE notarization (don't trust a green CI — "built" ≠ "notarized")
gh release download v1.0.X -p '*mac-universal.dmg'
hdiutil attach minka-desktop-mac-universal.dmg -nobrowse
spctl -a -vv -t install "/Volumes/Minka 1.0.X/Minka.app"   # expect: accepted, source=Notarized Developer ID
hdiutil detach "/Volumes/Minka 1.0.X"
```

**Signing is automatic in CI** via 6 repo secrets (`CSC_LINK`, `CSC_KEY_PASSWORD`,
`APPLE_API_KEY_B64`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, `APPLE_TEAM_ID`). Cert =
`Developer ID Application: ThinkOpen LLC (7C63B47XSL)`; notarization reuses the iOS App
Store Connect API key (`AuthKey_J4574BB8M5`, issuer `62cc9a04-…`). To re-create `CSC_LINK`
on a new machine: `security export -t identities -f pkcs12 -P <pw> -o devid.p12` (approve
the keychain dialog), then `base64 -i devid.p12 | gh secret set CSC_LINK`.
