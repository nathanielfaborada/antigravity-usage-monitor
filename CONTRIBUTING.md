# Development

Use Node.js 24 and npm. Install dependencies from the lockfile:

```sh
npm ci
```

Open the repo in VS Code and press `F5` to launch an Extension Development Host.

## Code layout

`extension.js` is the entry point. It also exports helpers used by the existing tests.

| Location | Responsibility |
| --- | --- |
| `src/monitor.js` | Activation, commands, refresh state, and polling |
| `src/api.js`, `src/credentials.js` | HTTP requests and native Windows credential access |
| `src/cli.js`, `src/process.js` | Legacy manual CLI checks |
| `src/parsers.js`, `src/quota.js` | Response parsing, quota calculations, and formatting |
| `src/alerts.js`, `src/logger.js`, `src/diagnostics.js` | Notifications and diagnostics |
| `src/ui/` | Status bar, tooltip, sidebar, and dashboard |

## Checks

```sh
npm run lint
npm run test:process
npm test
```

The process regression checks run without a VS Code window. `npm test` runs the extension-host suite and may download a VS Code test build.

For a live API check on Windows with an existing Antigravity login:

```sh
node tools/test-api.cjs
```

This sends a read-only request using your saved login. It blocks child-process launches and prints quota counts without printing credentials. Do not add credential values or raw authenticated responses to test output.

## Package a Windows x64 build

```sh
npx @vscode/vsce package --target win32-x64 --out agy-quota-monitor.vsix
code --install-extension agy-quota-monitor.vsix --force
```

Keep runtime dependencies in the package: `koffi` provides native credential access. After installation, run **Developer: Reload Window**.
