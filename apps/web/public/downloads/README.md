# Desktop installer (not committed — large binary)

After building the desktop app:

```powershell
cd ../..
npm run dist:desktop
Copy-Item apps/desktop/dist/Hexalyte-Setup-*.exe apps/web/public/downloads/Hexalyte-Setup.exe -Force
# Optional — upload to production:
# $env:HEXALYTE_SSH_PASS = '...'
# .\scripts\publish-desktop-download.ps1
```

Or set `NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL` to a CDN / GitHub Releases URL.

Web UI: Header **Desktop App** button → `/downloads/Hexalyte-Setup.exe`
Update check: `/downloads/desktop-version.json` (desktop shell + Help → Check for Updates)
