# Antigravity Usage Monitor

See your remaining Antigravity quota in the VS Code status bar. Hover for five-hour and weekly limits, reset times, and a daily budget estimate. Set a reset alarm with sound so you know when to check your quota again.

![Status bar preview](https://res.cloudinary.com/diwwqfwjb/image/upload/v1791197299/7227ada0-764e-4dd3-abba-c2d13609967d.png)

![Set Reset Alarm](https://res.cloudinary.com/diwwqfwjb/image/upload/v1791197373/d704c618-f3d8-4a93-9054-e3661de87d19.png)

## Getting started

The default API mode requires Windows, VS Code 1.137.0 or later, and an existing Antigravity CLI (`agy`) login saved in Windows Credential Manager. The local VSIX build targets Windows x64.

1. Sign in through `agy` if you haven't already.
2. Open Extensions with `Ctrl+Shift+X`. Search for **Antigravity Usage Monitor** or `nathaniel-faborada`, then select **Antigravity Usage Monitor** by **nathaniel-faborada** and click **Install**. Confirm the name and publisher rather than relying on search order.
3. Open a trusted workspace. The extension checks your quota on startup and refreshes every 60 seconds by default.

For a manual check, open the Command Palette with `Ctrl+Shift+P` and run **Antigravity: Refresh Usage**.

For the local **0.1.9** build, choose **Install from VSIX...** in the Extensions menu and select `agy-quota-monitor-0.1.9.vsix`. After installation, run **Developer: Reload Window**. Local installation does not publish the update to the Marketplace.

API mode makes HTTP requests without launching a terminal, CLI, or PowerShell process. If an API request fails, the extension shows an error rather than switching to the CLI.

## Reading your quota

`Claude: 100% | Gem: 97%` means those groups have 100% and 97% of their five-hour quota remaining. These percentages show remaining quota, not token counts. Models in the same group share that group's quota.

Hover over the status bar to see weekly limits and reset times in your local time zone. Open the Antigravity icon in the Activity Bar for the sidebar view, or click the status bar to browse quota details and models.

The daily budget estimate divides your remaining weekly quota by the days left until reset. For example, 70% remaining with five days left gives an estimate of 14% per day. This helps you pace usage; it does not change your account's limits.

If a refresh fails, the extension keeps previous readings and marks them **stale**. Automatic retries slow down after repeated failures, up to a one-hour delay. A manual refresh bypasses that delay.

## Quota reset alarms

Run **Antigravity: Set Quota Reset Alarm** from the Command Palette, dashboard, or tooltip. Choose a quota and either its reset time or five minutes before reset. Each alarm is for one reset cycle; setting another alarm for the same quota replaces it.

Alarms survive window reloads and follow changed reset times from successful quota refreshes. They run independently of background quota polling. Keep VS Code open and your PC awake; overdue alarms appear when the extension runs again. A reset-time notification is a reminder, so use **Refresh Usage** to confirm the quota actually reset.

On Windows, alarms play a bundled sound. Use **Antigravity: Test Alarm Sound** to check your output and **Antigravity: Stop Alarm Sound** to silence playback. The notification offers **Refresh Usage**, **Snooze 5 minutes**, and **Dismiss**. **Antigravity: Clear Reset Alarms** removes all saved alarms. Multiple editor windows can each show an alarm.

Configure `antigravity.alarmVolume` (0–100, default 70), `antigravity.alarmSound` (default on), and `antigravity.alarmRepeat` (default off). Repeated sound stops on dismissal or after 60 seconds; system volume also applies.

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
| `antigravity.alarmSound` | `true` | Plays the Windows alarm sound for reset reminders. |
| `antigravity.alarmVolume` | `70` | Alarm volume from 0 to 100; system volume also applies. |
| `antigravity.alarmRepeat` | `false` | Repeats the sound until stopped or dismissed, up to 60 seconds. |

## Commands

Run these from the Command Palette:

- **Antigravity: Refresh Usage** checks quotas and updates the model list.
- **Antigravity: Show Quota Details & Models** opens the dashboard.
- **Antigravity: Show Diagnostics Logs** opens the extension's Output channel.
- **Antigravity: Copy Model ID** lets you choose a model ID to copy.
- **Antigravity: Set Quota Reset Alarm** lets you select a quota and reminder time.
- **Antigravity: Test Alarm Sound** plays the configured alarm sound.
- **Antigravity: Stop Alarm Sound** stops current playback.
- **Antigravity: Clear Reset Alarms** removes all saved reset alarms.

## Troubleshooting

### Quota unavailable or login expired

Sign in again through Antigravity, then run **Antigravity: Refresh Usage**. The extension reads your existing login but does not renew it independently. If the error continues, open **Antigravity: Show Diagnostics Logs**. The extension uses Google's internal API, which may change.

### A terminal window opens

Check that `antigravity.usageSource` is set to `api`. Legacy `cli` mode can open a terminal during a manual refresh. After installing an updated VSIX, run **Developer: Reload Window** to load the new extension code.

### Using macOS or Linux

Direct credential access currently supports Windows only. If `agy` is installed and signed in, select `cli` as the usage source and run manual refreshes. CLI mode never checks on startup or polls in the background. Set `antigravity.cliPath` if the executable cannot be found.

### Alarm has no sound

Run **Antigravity: Test Alarm Sound**. Check that `antigravity.alarmSound` is enabled, `antigravity.alarmVolume` is above zero, and your Windows output device is unmuted. Sound currently supports Windows only. VS Code must stay open and the PC must stay awake for an alarm to ring on time.

## Login data

API mode reads the access token from the Antigravity login in Windows Credential Manager and sends it to Google's quota and model endpoints. The extension does not log the token or write it to workspace files.

For source setup, tests, and packaging, see [CONTRIBUTING.md](CONTRIBUTING.md).

Licensed under [MIT](LICENSE).
