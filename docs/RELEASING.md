# Building and releasing

## Build an installer locally

On Windows (recommended):

```bash
npm install
npm run dist
```

This writes `dist/Veya-Setup-<version>-x64.exe` (about 110 MB), its `.blockmap` and `latest.yml`. `dist/win-unpacked/` is the same app without the installer, useful for a quick test.

From Linux or macOS, electron-builder needs Wine (64‑ and 32‑bit) to edit the exe's icon and version info and to generate the uninstaller: on Ubuntu, `dpkg --add-architecture i386 && apt-get install wine wine32:i386`. The release workflow builds on Windows so none of this is needed there.

### What the installer does

- Installs for the current user under `%LOCALAPPDATA%\Programs\Veya`, so no admin prompt. The install folder can be changed on the second page.
- Adds Start menu and desktop shortcuts, and registers the app identity `com.veya.messenger`, so Windows notifications show "Veya" with its icon.
- Uninstalling keeps your sessions and settings in `%APPDATA%\Veya`. Remove them first in **Settings → Privacy & data → Clear everything**, or delete that folder.

### Hardening in installed builds

These Electron fuses are set when packaging (`electronFuses` in `electron-builder.yml`):

| Fuse | Effect |
|---|---|
| `runAsNode: false` | The exe can't be used as a plain Node.js runtime via `ELECTRON_RUN_AS_NODE`. |
| `enableCookieEncryption: true` | Cookies on disk are encrypted with a key protected by Windows DPAPI, like Chrome. |
| `enableNodeOptionsEnvironmentVariable: false`, `enableNodeCliInspectArguments: false` | No code injection through `NODE_OPTIONS` or `--inspect`. |
| `enableEmbeddedAsarIntegrityValidation: true`, `onlyLoadAppFromAsar: true` | The app refuses to start from a modified `app.asar`. |
| `grantFileProtocolExtraPrivileges: false` | `file://` pages get no special powers. The UI is served from `app://shell/` instead, which only the app's own window can reach. |

## Releases and automatic updates

Installed builds check the GitHub release feed configured under `publish` in `electron-builder.yml`: shortly after launch, then every 6 hours (Settings → About, can be turned off). They never download on their own. When a newer version exists, About shows **Download**, then **Restart and update**. A downloaded update also installs when you quit. The installer is verified against the SHA‑512 in `latest.yml` before it runs, and a failed check or download leaves the installed version untouched.

To release:

1. Bump `version` in `package.json` and commit.
2. Tag and push: `git tag v0.2.0 && git push origin v0.2.0`.
3. The **Release** workflow builds on Windows and uploads the installer, `.blockmap` and `latest.yml` to a **draft** release.
4. Check the draft, then publish it. Installed apps see the update from that moment.

You can also run `npm run release` locally with a `GH_TOKEN` that has `contents: write` on the repository.

**The repository must be public for updates to reach users.** electron-updater reads releases anonymously; with a private repository every check fails, and the app says it couldn't check. Other options: publish releases from a separate public repository (change `owner`/`repo` under `publish`), or host the files on any HTTPS server with `provider: generic`.

Development builds and builds without a feed (`app-update.yml` absent) show why updates are unavailable instead of pretending to check.

## Code signing

Unsigned installers work, but Windows SmartScreen warns "Windows protected your PC" until the file builds reputation, and some antivirus tools are stricter with unsigned apps.

To sign, get a code signing certificate (OV or EV) from a CA, or use Azure Trusted Signing. For a `.pfx` file:

- Set `WIN_CSC_LINK` (a path, or the file's base64) and `WIN_CSC_KEY_PASSWORD`. For the release workflow, add them as repository secrets with those names. electron-builder then signs the app exe, the installer and the uninstaller, with an RFC 3161 timestamp.
- Add `publisherName: <the certificate's subject CN>` under `win.signtoolOptions`. Installed apps then refuse updates that aren't signed by the same publisher. Don't set it while releases are unsigned, or every update would be rejected.

EV certificates on hardware tokens, and Azure Trusted Signing, need `win.azureSignOptions` or a custom `sign` script instead; see the [electron-builder docs](https://www.electron.build/code-signing-win).

## Windows on ARM

Builds are x64 only for now; Windows on ARM runs them under emulation. `electron-builder --win --arm64` produces a native build, but adding arm64 to the default target makes electron-builder ship one combined installer for both architectures at twice the size. Separate per‑architecture update feeds are the cleaner fix once there are arm64 users to test with.
