<p align="center"><img src="docs/logo.png" alt="Veya" width="128" height="128"></p>

# Veya

Veya is an all‑in‑one messaging app for Windows: WhatsApp, Messenger, Instagram, Discord, Telegram, Slack, Teams, Google Chat, Gmail, Reddit and X in one window, each account in its own isolated, sandboxed session. No servers, no analytics.

![Dashboard](docs/screenshots/dashboard-dark.png)

Architecture, stack decision, third‑party limitations and roadmap: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Status

All five phases are done: foundation, service management, unified notifications, performance (sleeping services), and the Windows installer with automatic updates. See the roadmap for what's next; features from later phases are labelled in the UI rather than faked.

## Run it

Requirements: Node.js 20+ and npm. Windows 10/11 is the target; it also runs on macOS and Linux for development.

```bash
npm install
npm run dev        # development with hot reload (separate "Veya (dev)" profile)
npm run build      # production build into out/
npm start          # run the production build
npm run typecheck
```

Optional environment variables (see `.env.example`): `VEYA_LOG_LEVEL`, `VEYA_OPEN_DEVTOOLS=1`, `VEYA_USER_DATA_DIR`.

`npm run dist` builds the Windows installer into `dist/`. Signing, releases and automatic updates are described in [docs/RELEASING.md](docs/RELEASING.md).

## Shortcuts

| Keys | Action |
|---|---|
| Ctrl+K | Search services, settings, commands |
| Ctrl+1…9 | Go to service 1…9 |
| Ctrl+Tab / Ctrl+Shift+Tab | Next / previous service |
| Ctrl+R | Reload service |
| Alt+Left / Alt+Right | Back / forward |
| Ctrl+, | Settings |
| Ctrl+Shift+H | Home |
| Ctrl+Shift+M | Mute notifications |
| Ctrl+B | Collapse/expand sidebar |
| Alt+↑ / Alt+↓ | Move the focused sidebar service up / down |

## Where your data lives

`%APPDATA%\Veya\` – `config.json` (settings, no secrets), `sessions\<service>\<account>\` (each account's private browser profile), `logs\`. Settings › Privacy shows the exact paths and has per‑account log out, cache clearing and "clear everything".

## Screenshots

| | |
|---|---|
| ![Search](docs/screenshots/search-palette.png) | ![Add service](docs/screenshots/add-service.png) |
| ![Performance](docs/screenshots/settings-performance.png) | ![Crash recovery](docs/screenshots/service-crashed.png) |
| ![Services and accounts](docs/screenshots/settings-services.png) | ![Account switcher](docs/screenshots/account-switcher.png) |
| ![Recent notifications](docs/screenshots/recent-notifications.png) | ![Sleeping service](docs/screenshots/service-asleep.png) |
