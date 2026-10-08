# AIO Messenger: architecture, limitations and roadmap

This document covers the first six items of the brief: requirements analysis, stack choice, architecture, project structure, third‑party limitations and the roadmap. Phases 1 and 2 are implemented in this repository; see [Phase status](#6-roadmap).

---

## 1. Requirements analysis

What the product really is: a **window manager for third‑party web apps**, with a native shell around them that adds what the web apps can't (one sidebar, account isolation, unified badges and notifications, tray, shortcuts, privacy controls).

The hard requirements that shape everything else:

| Requirement | Consequence |
|---|---|
| WhatsApp, Messenger, Instagram, Discord, Slack, Teams… with no usable public messaging API for personal accounts | Each service runs its **official web client** in an embedded browser view. Native API integrations are an optional extra per service (Telegram, Gmail) later, not the foundation. |
| Multiple accounts of the same service, never sharing sessions | Every account gets its **own on‑disk browser profile** (cookies, IndexedDB, cache). No shared default session, ever. |
| A crash in one service must not affect others | Every account runs in its **own sandboxed renderer process**; the shell watches for crashes and shows a reload panel. |
| 10+ services must stay responsive | Services are **created lazily** on first open, hidden ones are throttled, and (Phase 4) idle ones are unloaded entirely. |
| Unified notifications/badges | Read what each web app already exposes (page title, the Web Notifications API it calls). No scraping of message content for our own storage. |
| Privacy: no backend, no analytics, no plaintext passwords | The app never handles passwords; services log in on their own pages. No server, no telemetry. Config and sessions are separate files. |
| Native Windows feel: tray, startup, toasts, title bar | Needs mature Windows integration: Window Controls Overlay title bar, tray, login items, AppUserModelID for toasts, NSIS installer, auto‑update. |
| Don't fake features | Unified *message* search and "recent conversations" are not possible from web clients today. They are designed as extension points and the UI says so. |

## 2. Technology choice: Electron + TypeScript + React

**Decision: Electron.** Not because it is popular, but because this specific app is a multi‑profile, multi‑webview browser, and that is the one area where Tauri is still clearly weaker.

| Need | Electron | Tauri 2 (WebView2 on Windows) |
|---|---|---|
| Many independent web views in one window | `WebContentsView`, first‑class and stable | Multi‑webview is still behind an `unstable` feature flag |
| One isolated, persistent profile **per account** | `session.fromPath(dir)` per account, unlimited | WebView2 supports profiles, but Tauri exposes only a data directory per *webview environment*; many isolated profiles in one window is not a supported path |
| Per‑service user agent, permission policy, request interception, popups for OAuth | Full control per session | Limited and platform‑specific |
| Crash isolation and reporting per service | `render-process-gone` per view | Limited visibility |
| Same Chromium version everywhere | Bundled; every service sees a modern Chrome | Depends on the user's installed WebView2 (Evergreen, so usually fine) |
| Packaging, signing, auto‑update | electron‑builder + electron‑updater, very mature | Good |
| RAM | Shell costs ~150–180 MB extra | Shell is lighter (~30–60 MB) |

The RAM gap is real but smaller than it looks for *this* app: the bulk of memory is the web apps themselves (WhatsApp, Discord, Slack each take 150–500 MB in any Chromium), and WebView2 spawns comparable renderer processes per page. We win back far more through lazy loading and sleeping services than Tauri would save on the shell. Ferdium, Rambox and Franz all use Electron for the same reasons; Beeper's desktop app is Electron too.

Rest of the stack:

- **TypeScript (strict)** everywhere: main, preload, renderer, integrations.
- **React 19** for the shell UI, with a tiny external store (`useSyncExternalStore` + selectors) instead of a state library, so components re-render only for the slice they read.
- **electron‑vite** for building main/preload/renderer with one config and fast HMR.
- No UI framework: hand‑written CSS with design tokens (Fluent‑inspired), to keep the bundle small and the look specific.
- Runtime dependencies: **react and react‑dom only.** Config storage, logging, validation and IPC typing are small in‑house modules.

ARM64: Electron ships win‑arm64 builds; electron‑builder can target `--arm64` with no code changes.

## 3. Architecture

```
┌──────────────────────────────── BrowserWindow (frameless, native caption buttons) ─┐
│ Shell renderer (React, sandboxed, CSP)                                             │
│  ├ TitleBar  ├ Sidebar  ├ Dashboard / Settings / dialogs                           │
│  └ "content card" div ── its bounds are sent to main ──┐                           │
│                                                        ▼                           │
│  WebContentsView per account (sandboxed, own process, own session folder)          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                                            │
│  │ WhatsApp │ │ WhatsApp │ │ Discord  │  …  only the active one is visible;        │
│  │ Personal │ │ Work     │ │ Main     │     never-opened ones don't exist yet      │
│  └──────────┘ └──────────┘ └──────────┘                                            │
└────────────────────────────────────────────────────────────────────────────────────┘
          ▲  typed, allow-listed IPC (preload bridge)       ▲ events: title, favicon,
          │                                                 │ crash, load failure
┌─────────┴──────────────────────── Main process ───────────┴────────────────────────┐
│ ConfigStore ─ ServiceViewManager ─ ServiceView ─ NavigationPolicy ─ Permissions    │
│ ShortcutMatcher ─ Tray ─ LoginItem ─ Metrics ─ UpdaterService ─ Logger ─ Cleanup   │
└────────────────────────────────────────────────────────────────────────────────────┘
```

**Why service pages are native views placed over the shell, not `<webview>` tags or iframes:** each one is a real Chromium page with its own process and session, the shell cannot be reached from it (no preload, no IPC), and Electron discourages `<webview>`. The trade‑off is that shell UI can't float *over* a service page; dialogs and settings temporarily hide the page and show a blurred snapshot of it instead.

### Key components (main process)

- **ServiceDefinition** (`src/shared/types/service.ts`) – the integration contract. Declarative, not a class: URL, allowed domains, user‑agent policy, permissions, badge policy, capabilities, and user‑facing limitations. The host owns the lifecycle so an integration can't break the app.
  - This replaces the `MessagingService` class interface from the brief. For web‑hosted services `login()`, `logout()`, `getAccounts()` are identical for all services (login happens on the page; logout clears that account's session; accounts are `ServiceInstance`s), so putting them in every integration would just be duplicated code. Service‑specific behaviour (DOM badge readers, notification parsing, native APIs) plugs in as optional capabilities in later phases.
- **ServiceInstance** – one configured account: `{ id, type, label, enabled, notifications }`.
- **ServiceView** – one running account: creates the `WebContentsView` lazily in its own session, wires load/crash/title/favicon events, enforces navigation policy, context menu, shortcuts.
- **ServiceViewManager** – reconciles running views with config, decides which view is attached/visible and where, handles occlusion and per‑process metrics.
- **ConfigStore** – validated, debounced, atomic JSON persistence. Unknown/invalid keys are dropped, a corrupt file is moved aside and defaults are used.
- **ShortcutMatcher** – resolves shortcuts in `before-input-event` for both the shell and every service page, so Ctrl+1…9 work even when WhatsApp has focus.
- **UpdaterService** – full lifecycle (check → download → ready → install, with error state) behind an `UpdateProvider` interface. Today the provider honestly reports "not configured"; Phase 5 plugs in electron‑updater.

### Isolation and storage

```
%APPDATA%\AIO Messenger\
  config.json                      settings + service list (no secrets)
  window-state.json
  sessions\whatsapp\<account-id>\  Chromium profile for that account only
  sessions\discord\<account-id>\
  logs\main.log                    no message content, hosts only
  pending-cleanup.json             folders to delete at next start
```

- Removing an account deletes its session folder at the next start (Windows locks files Chromium has open).
- "Clear all application data" schedules a full wipe and restarts.
- Development builds use a separate `AIO Messenger (dev)` profile.

### Security model

- All renderers: `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`.
- Service pages get **no preload and no IPC**. They are just websites.
- Shell IPC: fixed allow‑list in the preload; main only answers the shell's top‑level frame; every argument is validated.
- Shell CSP: `script-src 'self'`, no remote images (favicons are fetched through the service's own session and inlined as data URLs, so the shell never contacts third parties).
- Permissions: deny by default. A service gets only what its definition lists (e.g. camera/mic for Discord), only for its own domains, and notifications only while enabled globally and for that account.
- Navigation: https pages may load in the view (sign‑in flows go through unpredictable identity‑provider domains), but off‑site pages get no permissions and the title bar shows them with a "Back to <service>" chip. Non‑https schemes are opened externally (http, mailto) or blocked (custom app protocols, file).
- `<webview>` attachment is blocked app‑wide.

## 4. Project structure

```
src/
├── main/                    Electron main process
│   ├── main.ts              bootstrap and wiring
│   ├── env.ts, logger.ts
│   ├── windows/             main window, title bar overlay, window state
│   ├── services/            ServiceView, manager, navigation, permissions, UA, context menu
│   ├── storage/             paths, config store, sanitising, atomic JSON, cleanup
│   ├── security/            IPC guard + validators, app-wide hardening
│   ├── system/              shortcuts, tray, login item, metrics
│   ├── updater/             update lifecycle + provider interface
│   ├── notifications/       (Phase 3)
│   └── ipc/                 handler registration
├── preload/shell.ts         the only bridge, allow-listed channels
├── renderer/                shell UI (React)
│   └── src/{components,pages,hooks,stores,services,styles}
├── shared/                  types, constants, pure utils used by both sides
└── integrations/            one folder per service + registry (index.ts)
```

## 5. Third‑party limitations (the honest part)

| Service | Public API for personal messaging? | What we do | Notable limits |
|---|---|---|---|
| WhatsApp | No (Business API only, for businesses) | WhatsApp Web | QR login via phone; linked‑device limit; no calls in WhatsApp Web; title shows unread *chats* |
| Messenger | No | messenger.com / facebook.com/messages | Meta may redirect or add login checks |
| Instagram | Only Business/Creator via Meta Graph | instagram.com/direct | Login challenges on new devices |
| Discord | Bots only; automating user accounts violates ToS | discord.com/app, unmodified | Screen share needs our picker (later) |
| Telegram | **Yes** (TDLib/MTProto) | Telegram Web A now | A native integration is possible later |
| Slack | Needs a workspace‑installed app | app.slack.com | Title gives an activity marker, not a count |
| Teams | Graph API needs org app registration + admin consent | teams.microsoft.com | Orgs may block web Teams via Conditional Access |
| Google Chat | Bot/Workspace API only | chat.google.com | Google may block sign‑in from embedded browsers |
| Gmail | **Yes** (Gmail API, needs a Google‑verified OAuth app) | mail.google.com | Same embedded sign‑in risk |
| Reddit | Chat not covered by the public API | reddit.com/chat | Title may carry no count |
| X | DM API needs a paid tier | x.com/messages | Count mixes notifications and DMs |

Cross‑cutting:

- **Google sign‑in in embedded browsers.** Google can refuse with "This browser or app may not be secure". We present an honest Chrome user agent (Electron token removed); there is no legitimate bypass if Google still refuses. Services that offer "Sign in with Google" inherit this.
- **Unread counts** come from what each web app exposes. Title‑based counts are implemented now; per‑service DOM readers (Phase 3) will be more precise, and can break when a service ships a redesign, so each reader is isolated in its integration folder and fails soft to "unknown".
- **Unified message search** is not possible from web clients: none of them expose search to other apps, and scraping their DOM would be unreliable and invasive. The `capabilities.search` slot exists for services with real APIs (Telegram, Gmail) later. The search palette today searches services, settings and commands, and says so.
- **Recent conversations** on the dashboard: only possible from notifications the services themselves emit (sender + preview). Planned for Phase 3; not shown before then.
- **Terms of service:** we load each service's official client without modifying its behaviour. Custom CSS is cosmetic only; no custom JavaScript ships in Phase 1.

## 6. Roadmap

| Phase | Scope | Status |
|---|---|---|
| **1. Foundation** | Window with custom title bar, sidebar (compact/expanded), service registry with 11 integrations, lazy per‑account `WebContentsView`s with isolated sessions, crash/error panels, navigation & permission policy, context menu, settings (all categories), themes + accent, persistent validated config, shortcuts, tray, close/minimize to tray, start with Windows (packaged builds), live performance metrics, privacy actions, add/remove/disable/rename/log out per account, Ctrl+K palette | **Done** |
| 2. Service management | Drag‑to‑reorder in sidebar and settings (plus arrows, Alt+↑/↓ and context‑menu Move up/down), account switcher in the title bar when a service has several accounts, "Add another account" from the context menu, switcher and settings, export/import of the service list (never sessions; duplicates skipped). Verified: order and sessions persist across restarts, and one account's cookies are invisible to another account of the same service | **Done** |
| 3. Notifications | Inject a minimal, isolated‑world script per service to intercept `new Notification()`; route through a unified manager → Windows toasts with service icon, sender, preview, click‑to‑open; per‑service sound/preview settings; DND; taskbar overlay badge; DOM badge readers where titles are insufficient; "recent conversations" from notifications | Planned |
| 4. Performance | Suspend inactive services after N minutes (destroy view, keep session), restore on click; background throttling profiles; memory pressure handling; per‑service resource view with "unload" button | Planned |
| 5. Packaging | electron‑builder NSIS installer (x64, then arm64), code signing, Electron fuses (cookie encryption, no `ELECTRON_RUN_AS_NODE`, asar integrity), electron‑updater with GitHub Releases provider, staged rollout and rollback to previous version on failed install | Planned |

Later: per‑account custom icon/colour, screen‑share picker, native Telegram/Gmail integrations with real search, configurable shortcuts, i18n, spell‑check language picker.

## 7. What was verified, and what wasn't

Verified in a Linux container with Electron 44 under a virtual display: the app builds, type‑checks, launches, renders dashboard/settings/dialogs in light and dark, creates service views lazily, shows the "Unable to load" panel on network failure, shows the crash panel when a service's renderer is killed, displays a live page in a service view, and reports real per‑process metrics.

Not verifiable from Linux, needs a check on Windows 10/11: native caption buttons colours in the title bar overlay, tray icon look, start with Windows (packaged builds only), and the actual sign‑in flows of each service (the container's network blocks those sites).
