# Hexalyte Desktop

Native Windows shell for the full Hexalyte web app. Opens directly at [login](https://app.hexalyte.com/login) — no marketing landing page.

## Requirements

- Node.js 20+
- Windows x64 (installer / portable)

## Develop

From the monorepo root:

```bash
npm install --workspace=apps/desktop
npm run dev:desktop
```

Or:

```bash
cd apps/desktop
npm install
npm run dev
```

Optional local URL override:

```powershell
$env:HEXALYTE_DESKTOP_URL = "http://localhost:3000/login"
npm run dev
```

## Build installer

```bash
npm run dist:desktop
```

Outputs under `apps/desktop/dist/`:

- `Hexalyte-Setup-1.0.0.exe` — NSIS installer (Start Menu + desktop shortcut)
- `Hexalyte-Portable-1.0.0.exe` — portable single file

## Notes

- Sessions and data stay on the Hexalyte cloud (same as the browser).
- External links open in the system browser.
- If the cloud is unreachable, a simple offline retry page is shown.
