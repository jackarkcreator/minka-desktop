// Minka Desktop — thin Electron shell around the Minka admin web app.
// Loads staff.thinkopen.net/admin, stays resident in the dock/tray so the
// in-page Supabase Realtime listener can fire native macOS notifications.

const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  shell,
  ipcMain,
  nativeImage,
  session,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { autoUpdater } = require("electron-updater");

// ---- Config ---------------------------------------------------------------
const APP_URL =
  process.env.MINKA_URL || "https://staff.thinkopen.net/admin";

// Auto-update pulls from the app's public GitHub Releases feed (configured in
// package.json build.publish). Windows (NSIS) self-updates even unsigned; macOS
// auto-update requires a signed/notarized build, so until we sign it the mac
// check is a logged no-op (errors are swallowed, never fatal).
function initAutoUpdates() {
  autoUpdater.autoDownload = true;
  autoUpdater.on("error", (err) => {
    console.warn("[autoUpdater]", err == null ? "unknown error" : err.message || err);
  });

  // New version downloaded → tell the web app to show its branded "Update ready"
  // modal. Skip macOS until signed/notarized (quitAndInstall fails unsigned, so
  // we don't show a button that can't work; it lights up on mac once we sign).
  autoUpdater.on("update-downloaded", (info) => {
    if (process.platform === "darwin") return;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("minka:update-ready", {
        version: info && info.version,
        releaseName: info && info.releaseName,
        releaseNotes:
          info && typeof info.releaseNotes === "string" ? info.releaseNotes : null,
      });
    }
  });

  // "Install & Restart" from the modal → close, install, relaunch.
  ipcMain.handle("minka:install-update", () => {
    setImmediate(() => autoUpdater.quitAndInstall());
  });

  // We own the update UI now → checkForUpdates (not ...AndNotify, which would
  // also pop a native OS notification that double-ups with the modal).
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  setTimeout(check, 8000);
  setInterval(check, 6 * 60 * 60 * 1000);
}

// Hosts we keep INSIDE the app window (app itself + OAuth identity providers).
// Everything else opens in the user's default browser.
const INTERNAL_HOSTS = [
  "staff.thinkopen.net",
  "support.thinkopen.net",
  "thinkopen.net",
  "login.microsoftonline.com",
  "login.live.com",
  "login.windows.net",
  "accounts.google.com",
];

const isInternalHost = (urlStr) => {
  try {
    const h = new URL(urlStr).hostname;
    return INTERNAL_HOSTS.some((d) => h === d || h.endsWith("." + d));
  } catch {
    return false;
  }
};

// ---- Window-state persistence (tiny, no extra deps) -----------------------
const stateFile = () => path.join(app.getPath("userData"), "window-state.json");
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), "utf8"));
  } catch {
    return { width: 1440, height: 900 };
  }
}
function saveState(win) {
  if (!win || win.isDestroyed()) return;
  try {
    const b = win.getBounds();
    fs.writeFileSync(stateFile(), JSON.stringify(b));
  } catch {
    /* non-fatal */
  }
}

let mainWindow = null;
let tray = null;

// Single-instance lock — second launch just focuses the existing window.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => showWindow());
}

function createWindow() {
  const state = loadState();
  const userAgentSuffix = ` MinkaDesktop/${app.getVersion()}`;
  const isMac = process.platform === "darwin";

  mainWindow = new BrowserWindow({
    width: state.width || 1440,
    height: state.height || 900,
    x: state.x,
    y: state.y,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#0A2540", // ThinkOpen navy — avoids white flash on load
    title: "Minka",
    // Quo-style clean chrome: no title strip, the web app paints its own navy
    // (#0A2540) title bar (h-10 = 40px). We hide the OS frame so that navy bar
    // IS the window title bar on every platform:
    //   macOS  → hiddenInset, traffic lights inset over the navy bar (draggable).
    //   Win/Linux → hidden + titleBarOverlay so the native min/max/close buttons
    //     paint navy with white glyphs inside the 40px navy bar. hiddenInset is a
    //     macOS-only no-op on Windows — using it there left the OS's own frame +
    //     menu bar showing with the web's navy bar stranded as a redundant strip.
    autoHideMenuBar: !isMac,
    titleBarStyle: isMac ? "hiddenInset" : "hidden",
    ...(isMac
      ? { trafficLightPosition: { x: 18, y: 13 } }
      : { titleBarOverlay: { color: "#0A2540", symbolColor: "#ffffff", height: 40 } }),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
      additionalArguments: [`--minka-version=${app.getVersion()}`],
    },
  });

  // Append a desktop marker to the UA so the web app knows it's us.
  mainWindow.webContents.setUserAgent(
    mainWindow.webContents.getUserAgent() + userAgentSuffix
  );

  mainWindow.loadURL(APP_URL, {
    userAgent: mainWindow.webContents.getUserAgent(),
  });

  // External links / new windows -> default browser (except OAuth + our hosts).
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternalHost(url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: { autoHideMenuBar: true },
      };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Top-level navigations to non-internal hosts also bounce to the browser.
  mainWindow.webContents.on("will-navigate", (e, url) => {
    if (!isInternalHost(url)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  ["resize", "move"].forEach((evt) =>
    mainWindow.on(evt, () => saveState(mainWindow))
  );

  // Close = hide the window (keeps the app + Realtime alive). The dock icon
  // stays put; real quit goes through the tray or Cmd+Q.
  mainWindow.on("close", (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    } else {
      saveState(mainWindow);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function showWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

function buildTray() {
  const img = nativeImage.createFromPath(
    path.join(__dirname, "..", "assets", "trayTemplate.png")
  );
  img.setTemplateImage(true);
  tray = new Tray(img);
  tray.setToolTip("Minka");
  refreshTrayMenu();
  tray.on("click", () => showWindow());
}

function refreshTrayMenu() {
  if (!tray) return;
  const loginOn = app.getLoginItemSettings().openAtLogin;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open Minka", click: () => showWindow() },
      { type: "separator" },
      {
        label: "Open at Login",
        type: "checkbox",
        checked: loginOn,
        click: (item) => {
          app.setLoginItemSettings({ openAtLogin: item.checked });
          refreshTrayMenu();
        },
      },
      {
        label: "Reload",
        click: () => mainWindow && mainWindow.webContents.reload(),
      },
      { type: "separator" },
      {
        label: "Quit Minka",
        accelerator: "Command+Q",
        click: () => {
          app.isQuitting = true;
          app.quit();
        },
      },
    ])
  );
}

function buildAppMenu() {
  // Minimal menu so copy/paste/select-all/reload/devtools work natively.
  const template = [
    { role: "appMenu" },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---- IPC from preload (notification click + dock badge) -------------------
ipcMain.on("minka:focus-window", () => showWindow());
ipcMain.on("minka:set-badge", (_e, count) => {
  if (process.platform === "darwin") {
    app.dock.setBadge(count && count > 0 ? String(count) : "");
  }
});

// ---- Lifecycle ------------------------------------------------------------
app.whenReady().then(() => {
  // Auto-grant notification permission (the OS still governs delivery).
  session.defaultSession.setPermissionRequestHandler(
    (_wc, permission, callback) => {
      callback(permission === "notifications");
    }
  );
  session.defaultSession.setPermissionCheckHandler((_wc, permission) =>
    permission === "notifications"
  );

  buildAppMenu();
  createWindow();
  buildTray();
  initAutoUpdates();

  app.on("activate", () => showWindow());
});

app.on("before-quit", () => {
  app.isQuitting = true;
  saveState(mainWindow);
});

// Keep running when all windows are "closed" (hidden to tray).
app.on("window-all-closed", () => {
  // On macOS we intentionally stay alive in the tray.
  if (process.platform !== "darwin") app.quit();
});
