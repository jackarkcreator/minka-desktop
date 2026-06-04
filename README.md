# Minka Desktop

Thin Electron shell around the Minka admin web app (`staff.thinkopen.net/admin`).
It exists so the in-page Supabase Realtime listener can run continuously and fire
**native macOS notifications** the instant a comment lands on a ticket — clicking
the notification focuses the app and jumps straight to the ticket.

This app bundles **no web code**. It renders the live site, exactly like the
OpenPhone/Quo desktop app renders `my.quo.com`. Ship a web change → it's live here
on next reload. No app rebuild needed for web changes.

## How notifications work
1. The web app detects `window.minka?.isDesktop` (injected by `src/preload.js`).
2. It opens a Supabase Realtime channel (gated to staff via a short-lived JWT).
3. On a qualifying new comment it calls `new Notification(...)`.
4. `onclick` → `window.minka.focusWindow()` (raises this app) + routes to the ticket.

Notifications only fire while the app is running. It stays resident in the menu-bar
tray when you close the window; **Open at Login** is in the tray menu.

## Develop
```bash
npm install
npm start            # runs against staff.thinkopen.net/admin
MINKA_URL=http://localhost:3000/admin npm start   # point at local dev
```

## Build a distributable (.dmg + .zip)
```bash
npm run dist
# output in ./dist/Minka-<version>.dmg  and  Minka-<version>-mac.zip
```

The build is currently **unsigned** (`mac.identity: null`). First launch on another
Mac: right-click the app → **Open** (to clear Gatekeeper). For fleet distribution,
add an Apple Developer ID certificate + notarization (see `build.mac` in package.json).

## Config
- `MINKA_URL` — override the loaded URL (default `https://staff.thinkopen.net/admin`).
- App id: `net.thinkopen.minka` · Icon: `build/icon.icns` (navy ThinkOpen mark).
