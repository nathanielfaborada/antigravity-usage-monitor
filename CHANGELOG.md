# Changelog

## [0.1.6] - 2026-10-04

- Rewrite the README with setup, usage, settings, and troubleshooting instructions.
- Split the extension into focused modules under `src/`.
- Add direct API quota refresh using the existing Windows Antigravity login. API refresh does not launch a terminal or CLI process.
- Preserve the selected status bar format when showing stale quota readings.
- Add API and process regression coverage; remove the obsolete audit report.

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

- Feature: **Daily Budget Planner**: weekly quota is divided by the number of days until reset, with the current five-hour quota shown alongside it.
- Feature: Add the `antigravity.showDailyBudget` setting and a daily budget column in the quota table.

## [0.1.2] - 2026-09-16

- Fix: Replace `execFile` with a `spawnHidden` helper that applies `CREATE_NO_WINDOW` to directly launched console programs on Windows.

## [0.1.1] - 2026-09-16

- Fix: Resolve known Windows CLI paths before PATH lookups to reduce console window flashes.
- Fix: Pipe CLI output and hide directly launched process windows.

## [0.1.0] - 2026-09-14

- Add structured quota parsing, status bar formats, low-quota notifications, a quota dashboard, model list, sidebar, and diagnostics output.
- Restrict credential-related CLI settings to machine scope and disable credential access in untrusted workspaces.
