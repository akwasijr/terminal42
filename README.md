# Terminal 42

An AI-powered terminal and design studio built on Electron.

Terminal 42 wraps the GitHub Copilot CLI with a full desktop experience — terminal sessions, a design workspace with live canvas, brain/memory system, activity dashboard, and more.

![Terminal 42](build/icon.png)

## Features

- **Terminal** — Full xterm.js terminal with Copilot CLI integration, search (⌘F), zoom (⌘+/⌘-), customizable fonts and cursor
- **Design Studio** — Create, import, and iterate on web designs with AI. Canvas preview, brain check, annotate, edit, export to Figma
- **Brain** — Persistent memory for your preferences, rules, and project context. Applied automatically or on demand
- **Activity** — Dashboard tracking sessions, designs, tasks, and token usage
- **Import** — Open existing projects from local folders or clone from Git
- **Model Picker** — Switch between Anthropic (Claude) and OpenAI (GPT) models

## Install

### Download

Grab the latest release from the [Releases page](https://github.com/akwasijr/terminal42/releases):

- **Mac** — `Terminal42-x.x.x-arm64.dmg`
- **Windows** — `Terminal42-Setup-x.x.x.exe`

### Mac — fix "damaged" warning

macOS Gatekeeper blocks unsigned apps. After installing, open Terminal and run:

```bash
xattr -cr /Applications/Terminal42.app
```

Then open the app normally.

### Prerequisites

- [GitHub Copilot CLI](https://docs.github.com/en/copilot/github-copilot-in-the-cli) installed and authenticated
- [GitHub CLI](https://cli.github.com/) (`gh`) for Git import and GitHub features
- Node.js 20+ (for development only)

## Development

```bash
# Install dependencies
npm install

# Run in dev mode
npm run dev

# Build for production
npm run build

# Run tests
npm test              # Vitest unit tests (lib logic)
npm run test:e2e      # Playwright smoke test (requires `npm run build` first)

# Package for your platform
npm run package:mac    # Mac DMG + ZIP
npm run package:win    # Windows NSIS installer
npm run package:linux  # Linux AppImage
```

## Packaging & code signing

By default the build is **unsigned** (`electron-builder.yml` sets `identity: '-'`,
`hardenedRuntime: false`, `notarize: false` on macOS). Unsigned builds run fine
but trigger OS security warnings on other machines.

### macOS — ship a signed & notarized build

Unsigned `.app`s are quarantined by Gatekeeper, which is why end users need the
`xattr -cr` workaround above. To distribute without that, sign and notarize:

1. Join the Apple Developer Program and create a **Developer ID Application**
   certificate; install it in your login keychain.
2. Update `electron-builder.yml` under `mac:`:
   ```yaml
   mac:
     hardenedRuntime: true
     gatekeeperAssess: false
     notarize: true
     identity: 'Developer ID Application: Your Name (TEAMID)'
   ```
3. Provide notarization credentials via environment variables (electron-builder
   reads these automatically — never commit them):
   ```bash
   export APPLE_ID="you@example.com"
   export APPLE_APP_SPECIFIC_PASSWORD="abcd-efgh-ijkl-mnop"   # appleid.apple.com
   export APPLE_TEAM_ID="TEAMID"
   npm run package:mac
   ```
   electron-builder signs with the Developer ID cert, submits to Apple for
   notarization, and staples the ticket. The resulting `.dmg` opens with no
   warning and **no `xattr` step required**.

### Windows — sign the installer

The NSIS installer is unsigned, so SmartScreen shows an "unknown publisher"
prompt. To sign, supply a code-signing certificate via environment variables:

```bash
export CSC_LINK="/path/to/certificate.pfx"   # or a base64 string
export CSC_KEY_PASSWORD="your-cert-password"
npm run package:win
```

For an EV certificate on a hardware token, configure `win.signtoolOptions` in
`electron-builder.yml` per the
[electron-builder code-signing docs](https://www.electron.build/code-signing).

### Native modules

`node-pty` and `better-sqlite3` are native and are unpacked from the asar
(`asarUnpack` in `electron-builder.yml`). `postinstall` rebuilds them against
the bundled Electron via `electron-rebuild`; rerun `npm install` if you switch
Node or Electron versions.

## Tech Stack

- **Electron 39** (Chromium 142, Node 22)
- **React 18** + TypeScript
- **Vite** (via electron-vite)
- **xterm.js** with search addon
- **Tailwind CSS**
- **better-sqlite3** for local storage
- **node-pty** for terminal sessions

## License

MIT
