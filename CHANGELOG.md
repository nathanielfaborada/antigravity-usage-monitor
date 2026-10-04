# Changelog

## Unreleased

- Rewrite setup and troubleshooting instructions; move development notes to CONTRIBUTING.md.
- Remove superseded audit reports and the PowerShell API probe.
- Parse refresh responses once and preserve the selected status bar format when readings become stale.
- Keep previous readings when a response contains no usable quota data.

## [0.1.5] - 2026-10-04

- Fix: Refresh quota directly from Google's API using the existing Windows Antigravity login. Credential access uses native Windows calls; API refresh launches no CLI, shell, or PowerShell process.
- Feature: API background refresh is enabled by default. Legacy CLI mode is an explicit manual-only option; API failures never trigger CLI fallback.
- Fix: Keep previous quota values marked stale on API failures. Expired login shows a sign-in message and uses polling backoff.
- Limitation: Silent credential access currently supports Windows. The API is internal; login renewal is managed by Antigravity, not this extension.

## [0.1.4] - 2026-10-04

- Refactor: Split CLI execution, parsing, quota calculations, alerts, diagnostics, and UI into modules under `src/`. Keep `extension.js` as the entry point with compatible exports.
- Fix: Background CLI queries are disabled by default, preventing automatic terminal popups on startup and quota polling. Use **Antigravity: Refresh Usage**, or enable `antigravity.backgroundRefresh` to opt into automatic checks.
- Fix: Cache the working usage executable and legacy output mode; only retry legacy output when JSON options are unsupported.
- Fix: Back off automatic refreshes after failures and prevent overlapping model queries.
- Clarification: Window suppression applies to the directly launched CLI; processes launched internally by the CLI may still create windows during manual or opted-in automatic checks.

## [0.1.3] - 2026-09-16

- Feature: **Daily Budget Planner** — Weekly quota is automatically divided by the number of days remaining until reset, giving you a clear per-day spending allowance (e.g. Weekly 70% ÷ 5 days = 🟢 14%/day).
- Feature: Daily Budget Planner also shows the current 5-hour remaining quota alongside each group's daily allowance.
- Feature: New setting `antigravity.showDailyBudget` (default: `true`) to toggle the Daily Budget Planner on or off.
- Feature: Weekly rows in the quota table now include a 📅 Daily Budget column.

## [0.1.2] - 2026-09-16

- Fix: Replaced `execFile` with a `spawn`-based `spawnHidden` helper that properly applies `CREATE_NO_WINDOW` to console-subsystem `.exe` files like `agy.exe`, to suppress the directly launched console window. Child processes could still open windows.

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
