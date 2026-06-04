; Minka (Staff) — NSIS installer customizations.
; electron-builder auto-includes build/installer.nsh (default nsis.include).

; DPI awareness — render CRISPLY on HiDPI / Retina (e.g. Parallels). Without this
; NSIS declares itself non-DPI-aware and Windows bitmap-upscales the whole
; installer window → soft / pixelated. customHeader is injected before any
; Section, where ManifestDPIAware must appear.
;
; NOTE: navy installer title-bar coloring was attempted on the Support app and
; abandoned — the only oneClick hook with the right timing (customCheckAppRunning)
; must re-insert the default running-app check, which fails to compile the
; uninstaller. Crisp DPI is kept; the title bar stays the OS default.
!macro customHeader
  ManifestDPIAware true
!macroend
