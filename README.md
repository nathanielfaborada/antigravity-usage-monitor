# Antigravity Usage Monitor

See your remaining Antigravity quota in the VS Code status bar. Hover for five-hour and weekly limits, reset times, and a daily budget estimate. Click to open quota details and the available model list.

![Status bar preview](https://res.cloudinary.com/diwwqfwjb/image/upload/v1789523048/d57043d1-0510-4157-9825-b4f5eceb4662.png)

## Getting started

The default API mode requires Windows, VS Code 1.137.0 or later, and an existing Antigravity CLI (`agy`) login saved in Windows Credential Manager. The local VSIX build targets Windows x64.

1. Sign in through `agy` if you haven't already.
2. Open Extensions with `Ctrl+Shift+X`, search for **Antigravity Usage Monitor**, and install it. If you have a `.vsix` file, use the Extensions menu's **Install from VSIX...** option instead.
3. Open a trusted workspace. The extension checks your quota on startup and refreshes every 60 seconds by default.

For a manual check, open the Command Palette with `Ctrl+Shift+P` and run **Antigravity: Refresh Usage**.

API mode makes HTTP requests without launching a terminal, CLI, or PowerShell process. If an API request fails, the extension shows an error rather than switching to the CLI.

## Reading your quota

`Claude: 100% | Gem: 97%` means those groups have 100% and 97% of their five-hour quota remaining. These percentages show remaining quota, not token counts. Models in the same group share that group's quota.

Hover over the status bar to see weekly limits and reset times in your local time zone. Open the Antigravity icon in the Activity Bar for the sidebar view, or click the status bar to browse quota details and models.

The daily budget estimate divides your remaining weekly quota by the days left until reset. For example, 70% remaining with five days left gives an estimate of 14% per day. This helps you pace usage; it does not change your account's limits.

If a refresh fails, the extension keeps previous readings and marks them **stale**. Automatic retries slow down after repeated failures, up to a one-hour delay. A manual refresh bypasses that delay.

## Settings

Open Settings and search for `antigravity`.

| Setting | Default | What it does |
| --- | --- | --- |
| `antigravity.usageSource` | `api` | Uses the Windows login for silent refresh. `cli` enables legacy manual checks. |
| `antigravity.backgroundRefresh` | `true` | Refreshes automatically in API mode. Turn off for manual checks only. |
| `antigravity.refreshInterval` | `60` | Seconds between automatic checks. Set to `0` to disable them. |
| `antigravity.statusBarFormat` | `compact` | Choose `compact`, `lowestOnly`, `detailed`, or `iconOnly`. |
| `antigravity.notifyOnCritical` | `true` | Shows a notification when quota crosses below the critical threshold. |
| `antigravity.criticalThreshold` | `20` | Remaining percentage below which quota is critical. |
| `antigravity.showDailyBudget` | `true` | Shows the daily budget estimate in the tooltip. |
| `antigravity.cliPath` | `agy` | Executable name or full path for legacy CLI mode. API mode ignores it. |

## Commands

Run these from the Command Palette:

- **Antigravity: Refresh Usage** checks quotas and updates the model list.
- **Antigravity: Show Quota Details & Models** opens the dashboard.
- **Antigravity: Show Diagnostics Logs** opens the extension's Output channel.
- **Antigravity: Copy Model ID** lets you choose a model ID to copy.

## Troubleshooting

### Quota unavailable or login expired

Sign in again through Antigravity, then run **Antigravity: Refresh Usage**. The extension reads your existing login but does not renew it independently. If the error continues, open **Antigravity: Show Diagnostics Logs**. The extension uses Google's internal API, which may change.

### A terminal window opens

Check that `antigravity.usageSource` is set to `api`. Legacy `cli` mode can open a terminal during a manual refresh. After installing an updated VSIX, run **Developer: Reload Window** to load the new extension code.

### Using macOS or Linux

Direct credential access currently supports Windows only. If `agy` is installed and signed in, select `cli` as the usage source and run manual refreshes. CLI mode never checks on startup or polls in the background. Set `antigravity.cliPath` if the executable cannot be found.

## Login data

API mode reads the access token from the Antigravity login in Windows Credential Manager and sends it to Google's quota and model endpoints. The extension does not log the token or write it to workspace files.

For source setup, tests, and packaging, see [CONTRIBUTING.md](CONTRIBUTING.md).

Licensed under [MIT](LICENSE).
