# Minka Desktop — Project Operating Doc

**Canonical knowledge lives in git, not in any one machine's `~/.claude` memory. Read this file + `docs/STATE.md` before acting. `docs/STATE.md` = where the project is now; this file = how it works + rules that don't change. If a doc disagrees with live state, trust live state and fix the doc.**

---

## What it is

Thin Electron shell around the Minka staff admin web app (`staff.thinkopen.net/admin`). It exists so that:

1. **Native notifications** — the Supabase Realtime channel runs continuously in a resident app, fires native macOS/Windows OS notifications on new tickets and comments, and clicking the notification focuses the app and routes to the ticket.
2. **Koban inventory agent** — `collectInventory()` gathers a one-shot hardware/software/posture snapshot from the OS (`systeminformation` + platform shims) and exposes it to the web app via IPC. The web app owns the entitlement gate and the authenticated POST.
3. **Koban presence agent** — `collectPresence()` reports live session state (user, idle seconds, lock state) ~every 60s. The web app owns the activity entitlement gate and the authenticated POST.

The app bundles **no web code**. It renders the live site. Ship a web change → it's live on next reload. No app rebuild needed for web changes.

## Stack

| Layer | What |
|---|---|
| **Electron** v33 | Shell process, BrowserWindow, Tray, ipcMain, powerMonitor, autoUpdater |
| **electron-updater** v6 | Auto-update via GitHub Releases feed (`latest.yml` / `latest-mac.yml`) |
| **systeminformation** v5 | Cross-platform hardware/network/BIOS/uptime facts for Koban inventory |
| **electron-builder** v25 | Packages `.dmg`+`.zip` (mac universal) and `.exe` NSIS (win x64) |
| **GitHub Actions** | CI release pipeline — builds both platforms on `v*` tag push |

## Layout

| Path | What |
|---|---|
| `src/main.js` | Electron main process — window, tray, IPC handlers, Koban agent fns, auto-update |
| `src/preload.js` | Context bridge: exposes `window.minka.{isDesktop, app, version, platform, focusWindow, setBadge, onUpdateReady, installUpdate, getInventory, getPresence}` |
| `build/` | Icons (`icon.icns`, `icon.png`, `trayTemplate.png`@1x+@2x), `installer.nsh` (DPI-aware NSIS manifest) |
| `assets/` | Same tray icons (runtime path for the main process) |
| `.github/workflows/release.yml` | CI: on `v*` tag, builds mac universal + win x64 sequentially (`max-parallel: 1`), publishes to this repo's GitHub Releases |

## Hard rules (load-bearing — violating these has burned us)

- **Commit author MUST be `luis.ramos@thinkopen.net` for any release tag.** Verify before tagging:
  ```bash
  git config user.email "luis.ramos@thinkopen.net"
  git log -1 --format='%an <%ae>'
  ```
- **Ship a new version by bumping `version` in `package.json`, then:**
  ```bash
  git tag vX.Y.Z && git push origin vX.Y.Z
  ```
  Lightweight tags require explicit `git push origin vX.Y.Z` — `git push --follow-tags` will NOT push them. CI fires on the tag push and publishes the release.
- **`max-parallel: 1` in `.github/workflows/release.yml` is load-bearing.** The mac and win jobs MUST run sequentially. Parallel jobs both call `electron-builder --publish always`, which races to CREATE the GitHub release for the tag; the loser gets HTTP 422 and its platform assets are silently missing. Do NOT change `max-parallel`.
- **After any release, verify the full 8-asset set is present** on GitHub Releases: `latest.yml`, `latest-mac.yml`, `minka-desktop-mac-universal.dmg` + `.blockmap`, `minka-desktop-mac-universal.zip` + `.blockmap`, `minka-desktop-win-x64.exe` + `.blockmap`. `gh run watch --exit-status` is NOT reliable for matrix jobs — check the release assets directly.
- **macOS auto-update is signing-gated.** The `update-downloaded` handler returns early on darwin until the app is notarized. Windows (NSIS) self-updates unsigned.
- **Absolute paths for all spawned OS binaries.** Packaged Electron runs with a stripped PATH; bare command names fail silently. macOS: `/usr/sbin/system_profiler`, `/usr/bin/fdesetup`, `/usr/libexec/ApplicationFirewall/socketfilterfw`, `/usr/sbin/dsconfigad`. Windows: `powershell.exe` (in PATH on Win). The macOS software-list bug (v1.0.4: 0 apps) was caused by a bare `system_profiler` failing to resolve.
- **macOS firewall detection:** `defaults read com.apple.alf globalstate` is dead (key does not exist). Use `/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate` and parse `"State = 1"` or `"State = 2"`.
- **`backgroundThrottling: false` on the BrowserWindow is required** so the ~60s Koban presence heartbeat fires at full fidelity while the window is hidden in the tray.
- **Do not install the DPI-aware installer change (`build/installer.nsh`) back to a bare `customHeader` block that adds NSIS DWM navy-caption code.** The navy installer title bar approach was exhaustively diagnosed as a hard NSIS/oneClick limit (see memory). Keep `installer.nsh` as DPI-only.
- **Web-side changes go in `~/Ccode/thinkopen-net`.** This repo is the Electron shell only. The `KobanAgent` component, notification subscription code, and update modal all live in `thinkopen-net`.

## Verify before "done"

- `npm run dist` (local mac build) confirms the process runs without obvious errors. CI is the authoritative build test for win.
- After a tag push: watch GitHub Actions (`gh run watch`) and then check the release has all 8 expected assets.
- Koban inventory: connect to a running instance, open DevTools → Console, trigger `window.minka.getInventory()` — confirm it returns a populated object (hardwareUuid, hostname, cpuModel, software array, posture fields).
- Auto-update: a version hop is the real test. Keno's Windows VM (Parallels) is the browser-lane for verifying win auto-update (mac is unsigned = no auto-update until notarized).
