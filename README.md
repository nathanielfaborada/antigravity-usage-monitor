# Antigravity Usage Monitor

A lightweight VS Code extension that monitors your Google Antigravity token limits and quota remaining in real-time directly from the status bar.

![Status Bar Preview](https://res.cloudinary.com/diwwqfwjb/image/upload/v1789193578/Screenshot_1_b4yqj7.png)

## Features

- **Compact Status Bar Indicator**: Displays your 5-hour quota remaining for Claude and Gemini models at a glance.
- **Rich Markdown Tooltip**: Hover over the status bar item to view a detailed breakdown table with color-coded threshold badges (🟢 Healthy, 🟡 Moderate, 🔴 Critical) and localized reset times.
- **Auto-Refresh & Manual Trigger**: Automatically refreshes metrics every 60 seconds or on-demand by clicking the status bar item.
- **Cross-Platform & Portable**: Works seamlessly across Windows, macOS, and Linux with built-in path discovery and fallback detection.

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
     code --install-extension antigravity-usage-monitor-0.0.1.vsix
     ```

### Option 2: Build & Install from Source

```bash
# Clone the repository
git clone https://github.com/nathanielfaborada/antigravity-usage-monitor.git
cd antigravity-usage-monitor

# Package the VSIX
npx @vscode/vsce package --no-yarn --allow-missing-repository

# Install into VS Code
code --install-extension antigravity-usage-monitor-0.0.1.vsix --force
```

## Configuration

This extension can be customized through your VS Code Settings (`settings.json` or UI):

| Setting | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `antigravity.cliPath` | `string` | `"agy"` | Executable name or absolute path to the `agy` CLI binary. |

### Path Fallbacks
If `antigravity.cliPath` is not set or defaults to `"agy"`, the extension will look in your system `PATH` first, and then check standard installation directories:
- **Windows**: `%LOCALAPPDATA%\agy\bin\agy.exe`
- **macOS / Linux**: `~/.local/bin/agy` or `/usr/local/bin/agy`

## Commands

- **Antigravity: Refresh Usage** (`antigravity.refreshUsage`): Immediately triggers a fresh check of token limits and updates the status bar.

## License

MIT
