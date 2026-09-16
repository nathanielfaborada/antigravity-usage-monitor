# Antigravity Usage Monitor

A lightweight VS Code extension that monitors your Google Antigravity token limits and quota remaining in real-time directly from the status bar.

![Status Bar Preview](https://res.cloudinary.com/diwwqfwjb/image/upload/v1789523048/d57043d1-0510-4157-9825-b4f5eceb4662.png)

## Features

- **📅 Daily Budget Planner**: Automatically divides your weekly remaining quota by the number of days left until reset — so you always know your per-day spending allowance (e.g. Weekly 70% ÷ 5 days left = 🟢 14%/day). Displayed in the hover tooltip alongside your current 5-hour remaining quota.
- **Structured JSON Engine & Robust Parsing**: Leverages `agy -p "/usage" --output-format json` for official bucket IDs, accurate fractions, and human refresh times, with fallback to tabular output.
- **Customizable Status Bar Formats**: Choose between `compact`, `lowestOnly`, `detailed`, and `iconOnly` displays via `antigravity.statusBarFormat`.
- **Native Visual Health Tinting**: Status bar background and text visually tint to Warning or Error colors when quotas run low.
- **Quota Depletion Alert Notifications**: Optional toast alerts notify you when quotas cross below your configured critical threshold.
- **Interactive QuickPick Dashboard & Model Catalog**: Click the status bar item to view ASCII progress bars, inspect available models (`agy models`), copy model IDs, and run diagnostic actions.
- **Dedicated Activity Bar TreeView**: Clutter-free sidebar panel organizing quota buckets, real-time countdowns, and available models.
- **Rich Markdown Tooltip**: Hover over the status bar item to view color-coded badges (🟢 Healthy, 🟡 Moderate, 🔴 Critical), localized reset times, and the Daily Budget Planner — all with embedded action links.
- **Diagnostics Output Channel**: Inspect CLI resolution logs, execution latencies, and debug telemetry via `antigravity.showLogs`.
- **No Terminal Flash on Windows**: Uses a `spawn`-based approach with full `CREATE_NO_WINDOW` suppression so no console window ever flashes when querying the `agy` CLI.

## Prerequisites

Before using this extension, make sure:
1. **Antigravity CLI (`agy`)** is installed on your system.
2. The CLI is authenticated and functional. You can test this by running the following command in your terminal:
   ```bash
   agy -p "/usage"
   ```

## Installation

### Option 1: Install from VS Code Marketplace

Search for **Antigravity Usage Monitor** in the VS Code Extensions Marketplace (`Ctrl + Shift + X`) and click **Install**.

### Option 2: Install via VSIX

1. Download the latest `.vsix` file from the [Releases](https://github.com/nathanielfaborada/antigravity-usage-monitor/releases) page.
2. Install it into VS Code using either method:
   - **Via VS Code UI**:
     1. Open VS Code and go to the Extensions view (`Ctrl + Shift + X`).
     2. Click the `...` (More Actions) menu at the top-right of the Extensions panel.
     3. Select **Install from VSIX...** and choose the downloaded file.
   - **Via Terminal**:
     ```bash
     code --install-extension agy-quota-monitor-0.1.3.vsix
     ```

### Option 3: Build & Install from Source

```bash
# Clone the repository
git clone https://github.com/nathanielfaborada/antigravity-usage-monitor.git
cd antigravity-usage-monitor

# Package the VSIX
npx vsce package --no-dependencies

# Install into VS Code
code --install-extension agy-quota-monitor-0.1.3.vsix --force
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
| `antigravity.showDailyBudget` | `boolean` | `true` | Show the Daily Budget Planner in the tooltip — divides weekly remaining quota by days left until reset. |

### Daily Budget Planner

When `antigravity.showDailyBudget` is enabled (default), hovering over the status bar shows a **Daily Budget Planner** section:

```
> 📅 Daily Budget Planner
> Claude — Weekly quota ÷ 5 days left = 🟢 14%/day · 5h remaining: 87%
> Gemini — Weekly quota ÷ 4 days left = 🟡 10%/day · 5h remaining: 62%
```

The weekly remaining quota is also shown as a **📅 X%/day** column in the main quota table.

**Health indicators:**
- 🟢 ≥ 15% per day — you're well within budget
- 🟡 7–14% per day — moderate, use carefully
- 🔴 < 7% per day — very tight, quota almost exhausted

### Path Fallbacks

If `antigravity.cliPath` is not set or defaults to `"agy"`, the extension automatically resolves the CLI binary in this order:

**Windows** (checks full paths first to avoid console window flashes):
1. `%LOCALAPPDATA%\agy\bin\agy.exe`
2. `%USERPROFILE%\.gemini\antigravity-cli\bin\agy.exe`
3. `agy.exe` (PATH lookup)
4. `agy` (PATH lookup)

**macOS / Linux**:
1. `~/.local/bin/agy`
2. `/usr/local/bin/agy`
3. `/opt/homebrew/bin/agy`
4. `/home/linuxbrew/.linuxbrew/bin/agy`

## Commands

- **Antigravity: Show Quota Details & Models** (`antigravity.showDetails`): Opens the interactive QuickPick dashboard with ASCII progress bars and available model catalog.
- **Antigravity: Refresh Usage** (`antigravity.refreshUsage`): Immediately triggers a fresh check of token limits and updates the status bar and sidebar view.
- **Antigravity: Show Diagnostics Logs** (`antigravity.showLogs`): Opens the Output panel with diagnostic execution traces and latencies.
- **Antigravity: Copy Model ID** (`antigravity.copyModelId`): Copies an available model ID to the clipboard or prompts with a QuickPick selector.

## License

MIT
