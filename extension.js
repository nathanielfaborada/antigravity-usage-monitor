const vscode = require('vscode');
const { exec } = require('child_process');

/**
 * Builds a visual progress bar using Unicode block characters.
 * Example: [██████░░░░]
 */
function createProgressBar(percent, totalBlocks = 10) {
  const filledBlocks = Math.round((percent / 100) * totalBlocks);
  const emptyBlocks = totalBlocks - filledBlocks;
  return `[${'█'.repeat(Math.max(0, filledBlocks))}${'░'.repeat(Math.max(0, emptyBlocks))}]`;
}

/**
 * Converts a UTC ISO timestamp (e.g., 2026-09-12T08:27:43Z)
 * into a local 12-hour time format (e.g., 04:27 PM).
 */
function formatLocalTime(isoString) {
  if (!isoString) return '--:--';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );

  statusBarItem.text = '$(sync~spin) Ag: Checking...';
  statusBarItem.tooltip = 'Click to refresh Antigravity usage limits';
  statusBarItem.command = 'antigravity.refreshUsage';
  statusBarItem.show();

  function fetchUsage() {
    exec('agy -p "/usage"', (error, stdout, stderr) => {
      if (error) {
        statusBarItem.text = '$(warning) Ag: Offline';
        statusBarItem.tooltip = 'Unable to invoke agy CLI binary.';
        return;
      }

      const raw = (stdout || stderr).toString();

      // Regular expression helper for percentage and reset timestamp extraction
      const parseRow = (label) => {
        const regex = new RegExp(`${label}\\s+(\\d+)%\\s+([\\d\\-T:Z]+)`, 'i');
        const match = raw.match(regex);
        if (!match) return { percent: 0, time: '--:--' };
        return {
          percent: parseInt(match[1], 10),
          time: formatLocalTime(match[2])
        };
      };

      const gemini5h = parseRow('Gemini Models\\s+Five Hour Limit Remaining');
      const geminiWk = parseRow('Gemini Models\\s+Weekly Limit Remaining');
      const claude5h = parseRow('Claude and GPT models\\s+Five Hour Limit Remaining');
      const claudeWk = parseRow('Claude and GPT models\\s+Weekly Limit Remaining');

      // Status Bar Display (Compact)
      statusBarItem.text = `$(dashboard) Claude: ${claude5h.percent}% | Gem: ${gemini5h.percent}%`;

      // Styled Markdown UI Tooltip
      const md = new vscode.MarkdownString();
      md.isTrusted = true;
      md.supportThemeIcons = true;

      md.appendMarkdown(`### $(dashboard) Antigravity Quota Overview\n\n`);
      md.appendMarkdown(`| Model | Quota | Remaining | Reset Time |\n`);
      md.appendMarkdown(`| :--- | :--- | :---: | :---: |\n`);
      md.appendMarkdown(`| **Claude (5-Hour)** | \`${createProgressBar(claude5h.percent)}\` | **${claude5h.percent}%** | ${claude5h.time} |\n`);
      md.appendMarkdown(`| **Claude (Weekly)** | \`${createProgressBar(claudeWk.percent)}\` | **${claudeWk.percent}%** | ${claudeWk.time} |\n`);
      md.appendMarkdown(`| **Gemini (5-Hour)** | \`${createProgressBar(gemini5h.percent)}\` | **${gemini5h.percent}%** | ${gemini5h.time} |\n`);
      md.appendMarkdown(`| **Gemini (Weekly)** | \`${createProgressBar(geminiWk.percent)}\` | **${geminiWk.percent}%** | ${geminiWk.time} |\n\n`);
      md.appendMarkdown(`---\n*$(sync) Click status bar item to refresh immediately.*`);

      statusBarItem.tooltip = md;
    });
  }

  const refreshCmd = vscode.commands.registerCommand('antigravity.refreshUsage', () => {
    statusBarItem.text = '$(sync~spin) Ag: Refreshing...';
    fetchUsage();
  });

  // Automatically refresh metrics every 60 seconds
  const timer = setInterval(fetchUsage, 60000);
  fetchUsage();

  context.subscriptions.push(statusBarItem, refreshCmd, {
    dispose: () => clearInterval(timer)
  });
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};