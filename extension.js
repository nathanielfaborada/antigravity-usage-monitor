const vscode = require('vscode');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Returns a health badge and label based on remaining percentage quota:
 * >= 50%: 🟢 Healthy
 * 20% - 49%: 🟡 Moderate
 * < 20%: 🔴 Critical
 */
function getStatusBadge(percent) {
  if (percent >= 50) {
    return '🟢 Healthy';
  } else if (percent >= 20) {
    return '🟡 Moderate';
  } else {
    return '🔴 Critical';
  }
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
 * Returns candidate commands and fallback paths to locate the agy CLI binary.
 */
function getCliCandidates() {
  const configPath = vscode.workspace.getConfiguration('antigravity').get('cliPath', 'agy');
  const configured = (typeof configPath === 'string' && configPath.trim()) ? configPath.trim() : 'agy';
  const candidates = [configured];

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    if (localAppData) {
      candidates.push(path.join(localAppData, 'agy', 'bin', 'agy.exe'));
    }
  } else {
    const home = process.env.HOME || '';
    if (home) {
      candidates.push(path.join(home, '.local', 'bin', 'agy'));
    }
    candidates.push('/usr/local/bin/agy');
  }

  return [...new Set(candidates.filter(Boolean))];
}

/**
 * Sequentially attempts to run candidate commands until one succeeds.
 */
function executeUsageCommand(candidates, callback) {
  if (!candidates || candidates.length === 0) {
    return callback(new Error('CLI binary not found or failed to execute'));
  }

  const [current, ...rest] = candidates;
  const isExplicitPath = current.includes('/') || current.includes('\\');

  if (isExplicitPath && !fs.existsSync(current)) {
    return executeUsageCommand(rest, callback);
  }

  const sanitized = current.replace(/^["']|["']$/g, '');
  const cmd = `"${sanitized}" -p "/usage"`;

  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      if (rest.length > 0) {
        return executeUsageCommand(rest, callback);
      }
      return callback(error, stdout, stderr);
    }
    return callback(null, stdout, stderr);
  });
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
    const candidates = getCliCandidates();

    executeUsageCommand(candidates, (error, stdout, stderr) => {
      if (error) {
        statusBarItem.text = '$(warning) Ag: CLI Missing';

        const errMd = new vscode.MarkdownString();
        errMd.isTrusted = true;
        errMd.supportThemeIcons = true;
        errMd.appendMarkdown(`### $(warning) Antigravity CLI Missing\n\n`);
        errMd.appendMarkdown(`Unable to find or execute the \`agy\` CLI binary.\n\n`);
        errMd.appendMarkdown(`**Troubleshooting:**\n`);
        errMd.appendMarkdown(`1. Ensure the Antigravity CLI (\`agy\`) is installed and authenticated.\n`);
        errMd.appendMarkdown(`2. Or specify the executable name/path in Settings: \`antigravity.cliPath\`.\n\n`);
        errMd.appendMarkdown(`---\n*$(sync) Click status bar item to retry.*`);

        statusBarItem.tooltip = errMd;
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

      md.appendMarkdown(`### $(dashboard) Antigravity Quotas\n\n`);
      md.appendMarkdown(`| Model | Remaining | Status | Reset Time |\n`);
      md.appendMarkdown(`| :--- | :---: | :---: | :---: |\n`);
      md.appendMarkdown(`| **Claude (5h)** | ${claude5h.percent}% | ${getStatusBadge(claude5h.percent)} | ${claude5h.time} |\n`);
      md.appendMarkdown(`| **Claude (Weekly)** | ${claudeWk.percent}% | ${getStatusBadge(claudeWk.percent)} | ${claudeWk.time} |\n`);
      md.appendMarkdown(`| **Gemini (5h)** | ${gemini5h.percent}% | ${getStatusBadge(gemini5h.percent)} | ${gemini5h.time} |\n`);
      md.appendMarkdown(`| **Gemini (Weekly)** | ${geminiWk.percent}% | ${getStatusBadge(geminiWk.percent)} | ${geminiWk.time} |\n\n`);
      md.appendMarkdown(`---\n*$(sync) Click status bar item to refresh immediately.*`);

      statusBarItem.tooltip = md;
    });
  }

  const refreshCmd = vscode.commands.registerCommand('antigravity.refreshUsage', () => {
    statusBarItem.text = '$(sync~spin) Ag: Refreshing...';
    fetchUsage();
  });

  const configListener = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('antigravity.cliPath')) {
      statusBarItem.text = '$(sync~spin) Ag: Checking...';
      fetchUsage();
    }
  });

  // Automatically refresh metrics every 60 seconds
  const timer = setInterval(fetchUsage, 60000);
  fetchUsage();

  context.subscriptions.push(statusBarItem, refreshCmd, configListener, {
    dispose: () => clearInterval(timer)
  });
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};