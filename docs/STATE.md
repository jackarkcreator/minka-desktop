# Minka Desktop — Current State

> **Living doc.** Update this at the end of any session that changes the project, then commit. It round-trips between machines via git — it is how office-Claude and travel-Claude stay in sync. Keep it short and current; move durable rules to `CLAUDE.md`.

**Last updated:** 2026-06-25 · **Branch:** `main` — *state reflects the milestones below; run `git log` for live HEAD (no pinned SHA here — it self-invalidates on the next commit).*
**Distribution:** GitHub Actions CI → public GitHub Releases at `github.com/jackarkcreator/minka-desktop`. Ships on `v*` tag push. `electron-updater` pulls `latest.yml` / `latest-mac.yml` from that feed. **macOS is now SIGNED + NOTARIZED (v1.0.8+) → mac auto-update is LIVE.** Windows NSIS still self-updates unsigned (Azure Trusted Signing deferred).

---

## Where we are

- **v1.0.14** (`@8472999`) — **`window.minka.getSystemIdleSeconds()` bridge added** (`powerMonitor.getSystemIdleTime()` over `ipcMain.handle("minka:system-idle-seconds")`, failures → null). Exists because the web timer widget's idle auto-pause measured only window-scoped input, and with `backgroundThrottling:false` occlusion never flips `visibilityState` — so working in another app read as "idle" and the 1s tick killed live timers in the background (Keno lost 4 entries at 0 min on 20260703-001). Web side (`thinkopen-net` `timer-widget.tsx`, deployed 2026-07-03): folds system-wide idle into the activity clock on shells ≥1.0.14, resets the idle clock at timer start (mount-time-stale ref was auto-pausing brand-new timers within seconds), and skips in-window idle enforcement entirely on older shells. Release verified: 8/8 assets on GitHub.
- **v1.0.13** (`@e4b8118`) — **"Check for Updates…" added** (macOS app-menu + tray; Help menu on Win) with visible status (Up to date / Downloading / Restart) and a native restart prompt. mac auto-update was already ENABLED since v1.0.10 but silent (background download → web modal, errors swallowed) — this adds a manual trigger AND surfaces the otherwise-swallowed error so a stalled mac update is diagnosable. Keno's v1.0.10 wasn't updating: most likely the app wasn't in `/Applications` (translocation blocks self-replace). Confirmed working on Keno's Mac (reported "You're up to date"). Doc note `@f9de300` corrected the stale "mac auto-update signing-gated" line.
- **v1.0.12** — **Koban presence consent now works for hidden-to-tray launches.** The presence POST was gated behind a localStorage ack (`koban.activityAck.v1`) set ONLY by the in-window web modal `<DesktopActivityGate>`. A user whose app auto-launches hidden at login (`startHidden`) never saw that modal, so presence (`device_presence`) never reported even with `activity_enabled=true` (GRU's Mac.lan: inventory flowing, zero presence rows). Fix: the native tray **"Privacy & Activity…"** is now an actionable consent center (`openActivityCenter()`) — reads live entitlement + ack from the renderer via `executeJavaScript`, then **Enable / Not now** (sets the same ack + fires a `koban:activity-ack` event the web `<KobanAgent>` listens for → instant beat; the 30s loop reports regardless), a **Turn off reporting** revoke once on, or the read-only notice when there's nothing to toggle. Plus: a **hidden launch auto-surfaces** the consent once (`maybePromptActivityConsent`, 12s after settle, gated on `launchedHidden()`) so presence starts without ever opening the window. Visible launches still use the web modal (no double-prompt). Consent UX still shows what's collected before enabling (CA / Mexico LFPDPPP). **Web side:** `koban-agent.tsx` listens for `koban:activity-ack` — ships independently via Vercel; the shell fix works without it via the existing 30s loop.
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

## 2026-07-19 — v1.1.1: Okvia branding, ORIGINAL appId restored (update-loop fix)
v1.1.0 (Okvia rebrand) changed appId to io.okvia.* — Squirrel.Mac silently rejects cross-bundle-id updates, stranding macOS installs in an Install&Restart loop (Windows NSIS would have installed side-by-side). v1.1.0 re-drafted on both repos; v1.1.1 keeps ALL Okvia branding but restores appId (net.thinkopen.minka / net.thinkopen.support). Published 2026-07-19 eve, feeds verified 1.1.1, mac artifact Info.plist verified (bundleId original, name Okvia).
🧨 STANDING RULE: never change appId in a release meant to flow through auto-update. The io.okvia.* identity migration is a dedicated future release WITH a feed-migration plan (new repo/feed or manual reinstall step), not a version bump. On disk the mac bundle stays Minka.app / ThinkOpen Support.app (folder name) while displaying as Okvia — cosmetic, fix in that same future migration.

## 2026-08-19 — v1.1.3: autostart asserts real OS state instead of trusting a marker file
**Symptom (prod, Keno's MacBook):** Okvia never auto-started at login and could not self-heal. The macOS login item had drifted to a stale `dist/` build of a *different* app bundle (`io.okvia.support`, thinkopen-support-desktop) while `ensureAutostartDefault()`'s `autostart-initialized` marker was already stamped — so the guard returned early forever. Manual fix was deleting the marker and relaunching.

**Root cause:** the marker recorded *that we ran the code*, never *what the OS actually did*. Any OS-side drift after first launch was permanent.

**Fix (`src/main.js`):** the marker is replaced by `autostart.json` in `userData`, which records the **decision** (`userDisabled`) and the **bundle we registered** (`registeredFor`); the OS **state** is asserted on every launch via `app.getLoginItemSettings()`:
- `userDisabled: true` (set only by the tray checkbox) → never overridden. A deliberate opt-out still sticks across updates.
- `status === "requires-approval"` (macOS 13+ SMAppService — user/MDM disabled us in System Settings) → recorded, not fought.
- healthy = `openAtLogin === true` **AND** `registeredFor === ` the running `.app` bundle → no-op. We do **not** blindly re-register every launch.
- anything else (not registered, `not-found`, item points at another/moved bundle, or a marker-era profile with no pref) → re-apply + re-stamp, and retire the legacy marker.
- `!app.isPackaged` → return early. `npm start` used to be able to register the **Electron dev binary** as the login item — the same "item points at some other bundle" failure class.
- Tray toggle now routes through `setAutostartEnabled()`; re-enabling had been dropping `openAsHidden`/`args:["--hidden"]`, so a toggle-off→on cycle produced a login item that launched **visible** and stole focus at login.

**Migration tradeoff (deliberate):** a profile with the old marker and no pref has *unverifiable* state, so v1.1.3 asserts the default ONCE. A user who opted out pre-1.1.3 gets autostart re-enabled one time; their next toggle-off is recorded in `autostart.json` and permanent. Narrowing this by treating `openAtLogin === false` as "they opted out" was rejected — that is exactly the state the prod bug presents as, and it would leave the bug unhealed.

**Same fix ported** to `thinkopen-support-desktop` (v1.1.3) and `arqos-desktop` (v1.0.3) — identical block, all three carried the marker pattern.

**Verified:** 20-assertion suite over the 9 real state combinations (fresh install, steady state, the prod bug shape, drifted bundle, opt-out persistence across relaunches, tray re-enable args, requires-approval, dev run, app moved) — the harness slices the functions out of `src/main.js` at runtime and evaluates them against stubs, so the test cannot drift from what ships. **NOT yet verified on a real install** — the delete-login-item → relaunch → re-registers-to-/Applications/Okvia.app check needs a packaged build on a live desktop session.
