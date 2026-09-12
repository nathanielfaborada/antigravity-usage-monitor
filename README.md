# Antigravity Usage Monitor

A lightweight VS Code extension that monitors your Google Antigravity token limits and quota remaining in real-time directly from the status bar.

![Status Bar Preview](https://raw.githubusercontent.com/nathanielfaborada/antigravity-usage-monitor/main/.vscode/preview.png)

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
