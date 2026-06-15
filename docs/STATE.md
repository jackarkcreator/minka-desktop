# Minka Desktop — Current State

> **Living doc.** Update this at the end of any session that changes the project, then commit. It round-trips between machines via git — it is how office-Claude and travel-Claude stay in sync. Keep it short and current; move durable rules to `CLAUDE.md`.

**Last updated:** 2026-06-15 · **Branch:** `main` · **HEAD:** `83c6877`
**Distribution:** GitHub Actions CI → public GitHub Releases at `github.com/jackarkcreator/minka-desktop`. Ships on `v*` tag push. `electron-updater` pulls `latest.yml` / `latest-mac.yml` from that feed. macOS auto-update is **signing-gated** (unsigned until notarized); Windows NSIS self-updates unsigned.

---

## Where we are

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

- **Code signing** (deferred by Keno):
  - **Windows:** Azure Trusted Signing (~$9.99/mo) — kills SmartScreen "Unknown Publisher"
  - **macOS:** notarize via Apple Developer account (`developer@thinkopen.net`) — also enables mac auto-update
- **Koban: domain/VPN fields** (`devices.domain`, `devices.vpn_active`) — columns provisioned in DB (mig 085) but agent collection NOT built yet. VPN heuristic (utun/WireGuard adapters) deferred.

## Next up

- Bump version to v1.0.8, tag, and push to trigger a CI release that includes the staged macOS absolute-path software-list fix (`@917943d`). Coordinate with Keno's manual mac .dmg install cycle (mac auto-update remains gated until notarized).
- Windows code signing (Azure Trusted Signing) — unblocks SmartScreen trust for client rollout.
- Mac notarization — enables mac auto-update fleet-wide.

## Open questions / watch items

- Keno verifies Windows VM (SYS) drawer shows posture fields (disk encryption, firewall, reboot-pending) after auto-update to v1.0.7.
- Keno's Macs (TKO) must be manually updated to v1.0.7 .dmg — confirm posture + all hardware/network drawer fields populate.
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
```
