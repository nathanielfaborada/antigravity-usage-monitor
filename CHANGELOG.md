# Change Log

All notable changes to the "agy-quota-monitor" (Antigravity Usage Monitor) extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.1.1] - 2026-09-16

- Fix: Eliminated Windows terminal/console flash on startup by prioritizing known absolute `.exe` paths before generic PATH lookups in CLI candidate resolution.
- Fix: Added `stdio: 'pipe'` to all `execFile` calls to fully suppress any residual console window on Windows.

## [0.1.0] - 2026-09-14

- Security hardening: Restricted `antigravity.cliPath` scope to `machine`, declared Workspace Trust restrictions, switched from `exec` to `execFile` with `windowsHide: true` to eliminate Windows terminal/console popup flashes.
- Reliability & discovery: Stripped enclosing quotes before checking path existence, added Homebrew fallback paths (`/opt/homebrew/bin/agy`, `/home/linuxbrew/.linuxbrew/bin/agy`).
- Stability: Added execution timeout (10s) and concurrency guard (`isFetching`).
- Output parsing: Safe buffer handling, dynamic model tier parsing, robust error state handling.
- UX improvements: Configurable refresh interval (`antigravity.refreshInterval`), relative reset countdowns, interactive command links in tooltips.
- Feature 1: Structured JSON Engine (`--output-format json`) with dynamic bucket telemetry and human refresh descriptions.
- Feature 2: Native Visual Health Tinting based on remaining quota thresholds (Healthy / Warning / Error).
- Feature 3: Customizable Status Bar Formats (`compact`, `lowestOnly`, `detailed`, `iconOnly`).
- Feature 4: Quota Depletion Alert Notifications with transition deduplication and quick dashboard navigation.
- Feature 5: Interactive QuickPick Dashboard with ASCII progress bars, model catalog (`agy models`), clipboard copy, and diagnostic actions.
- Feature 6: Dedicated Activity Bar TreeView (`antigravity.quotaView`) displaying structured quota buckets and model groups.
- Feature 7: Diagnostics OutputChannel (`Antigravity Usage`) and `antigravity.showLogs` command.