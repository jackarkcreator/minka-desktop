// Preload — exposes a tiny, safe bridge to the web app. The window chrome
// (navy title bar, draggable region, traffic-light clearance) is now owned by
// the web app itself (it renders a navy bar gated to window.minka.isDesktop),
// so this no longer injects any DOM/CSS.

const { contextBridge, ipcRenderer } = require("electron");

const versionArg =
  (process.argv.find((a) => a.startsWith("--minka-version=")) || "").split(
    "="
  )[1] || "";

contextBridge.exposeInMainWorld("minka", {
  isDesktop: true,
  version: versionArg,
  focusWindow: () => ipcRenderer.send("minka:focus-window"),
  setBadge: (count) => ipcRenderer.send("minka:set-badge", count),
});
