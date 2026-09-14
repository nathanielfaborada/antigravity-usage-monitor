# Antigravity Usage Monitor

A lightweight VS Code extension that monitors your Google Antigravity token limits and quota remaining in real-time directly from the status bar.

![Status Bar Preview](https://res.cloudinary.com/diwwqfwjb/image/upload/v1789193578/Screenshot_1_b4yqj7.png)

## Features

- **Structured JSON Engine & Robust Parsing**: Leverages `agy -p "/usage" --output-format json` for official bucket IDs, accurate fractions, and human refresh times, with fallback to tabular output.
- **Customizable Status Bar Formats**: Choose between `compact`, `lowestOnly`, `detailed`, and `iconOnly` displays via `antigravity.statusBarFormat`.
- **Native Visual Health Tinting**: Status bar background and text visually tint to Warning or Error colors when quotas run low.
- **Quota Depletion Alert Notifications**: Optional toast alerts notify you when quotas cross below your configured critical threshold.
- **Interactive QuickPick Dashboard & Model Catalog**: Click the status bar item to view ASCII progress bars, inspect available models (`agy models`), copy model IDs, and run diagnostic actions.
- **Dedicated Activity Bar TreeView**: Clutter-free sidebar panel organizing quota buckets, real-time countdowns, and available models.
- **Rich Markdown Tooltip**: Hover over the status bar item to view color-coded badges (🟢 Healthy, 🟡 Moderate, 🔴 Critical) and localized reset times with embedded action links.
- **Diagnostics Output Channel**: Inspect CLI resolution logs, execution latencies, and debug telemetry via `antigravity.showLogs`.

## Prerequisites

Before using this extension, make sure:
1. **Antigravity CLI (`agy`)** is installed on your system.
2. The CLI is authenticated and functional. You can test this by running the following command in your terminal:
   ```bash
   agy -p "/usage"
   ```

## Installation

### Option 1: Install via VSIX (Recommended)

1. Download the latest `.vsix` file from the [Releases](https://github.com/nathanielfaborada/antigravity-usage-monitor/releases) page.
2. Install it into VS Code using either method:
   - **Via VS Code UI**:
     1. Open VS Code and go to the Extensions view (`Ctrl + Shift + X`).
     2. Click the `...` (More Actions) menu at the top-right of the Extensions panel.
     3. Select **Install from VSIX...** and choose the downloaded file.
   - **Via Terminal**:
     ```bash
     code --install-extension agy-quota-monitor-0.0.1.vsix
     ```

### Option 2: Build & Install from Source

```bash
# Clone the repository
git clone https://github.com/nathanielfaborada/antigravity-usage-monitor.git
cd antigravity-usage-monitor

# Package the VSIX
npx @vscode/vsce package --no-yarn --allow-missing-repository

# Install into VS Code
code --install-extension agy-quota-monitor-0.0.1.vsix --force
```

## Configuration

This extension can be customized through your VS Code Settings (`settings.json` or UI):

| Setting | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `antigravity.cliPath` | `string` | `"agy"` | Executable name or absolute path to the `agy` CLI binary. |
| `antigravity.refreshInterval` | `integer` | `60` | Interval in seconds between automatic usage quota refreshes (0 to disable). |
| `antigravity.statusBarFormat` | `string` | `"compact"` | Format of status bar item (`compact`, `lowestOnly`, `detailed`, `iconOnly`). |
| `antigravity.notifyOnCritical` | `boolean` | `true` | Show toast notifications when quota drops below critical threshold. |
| `antigravity.criticalThreshold` | `integer` | `20` | Percentage threshold below which quota status is considered critical. |

### Path Fallbacks
If `antigravity.cliPath` is not set or defaults to `"agy"`, the extension will look in your system `PATH` first, and then check standard installation directories:
- **Windows**: `%LOCALAPPDATA%\agy\bin\agy.exe`, `%USERPROFILE%\.gemini\antigravity-cli\bin\agy.exe`
- **macOS / Linux**: `~/.local/bin/agy`, `/usr/local/bin/agy`, `/opt/homebrew/bin/agy`, or `/home/linuxbrew/.linuxbrew/bin/agy`

## Commands

- **Antigravity: Show Quota Details & Models** (`antigravity.showDetails`): Opens the interactive QuickPick dashboard with ASCII progress bars and available model catalog.
- **Antigravity: Refresh Usage** (`antigravity.refreshUsage`): Immediately triggers a fresh check of token limits and updates the status bar and sidebar view.
- **Antigravity: Show Diagnostics Logs** (`antigravity.showLogs`): Opens the Output panel with diagnostic execution traces and latencies.
- **Antigravity: Copy Model ID** (`antigravity.copyModelId`): Copies an available model ID to the clipboard or prompts with a QuickPick selector.

## License

MIT
