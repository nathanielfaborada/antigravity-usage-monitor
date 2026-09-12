const vscode = require('vscode');
const { exec } = require('child_process');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );

  statusBarItem.text = '$(sync~spin) Ag: Checking...';
  statusBarItem.tooltip = 'Click para i-refresh ang Antigravity usage';
  statusBarItem.command = 'antigravity.refreshUsage';
  statusBarItem.show();

  function fetchUsage() {
    exec('agy -p "/usage"', (error, stdout, stderr) => {
      if (error) {
        statusBarItem.text = '$(warning) Ag: Offline';
        statusBarItem.tooltip = 'Hindi matawag ang agy CLI.';
        return;
      }

      const raw = (stdout || stderr).toString();

      // I-parse ang 5-hour limits gamit ang regex
      const claudeFiveHour = raw.match(/Claude and GPT models\s+Five Hour Limit Remaining\s+(\d+%)/i);
      const geminiFiveHour = raw.match(/Gemini Models\s+Five Hour Limit Remaining\s+(\d+%)/i);

      const claudeVal = claudeFiveHour ? claudeFiveHour[1] : 'N/A';
      const geminiVal = geminiFiveHour ? geminiFiveHour[1] : 'N/A';

      // Status bar display: hal. "Ag: Claude 67% | Gem 0%"
      statusBarItem.text = `$(dashboard) Ag: Claude ${claudeVal} | Gem ${geminiVal}`;

      // Buong breakdown kapag itinapat ang mouse cursor (hover tooltip)
      statusBarItem.tooltip = new vscode.MarkdownString(
        `**Antigravity Quota Overview**\n\n` +
        `\`\`\`\n${raw.trim()}\n\`\`\`\n\n` +
        `*Click para mag-refresh agad.*`
      );
    });
  }

  const refreshCmd = vscode.commands.registerCommand('antigravity.refreshUsage', () => {
    statusBarItem.text = '$(sync~spin) Ag: Refreshing...';
    fetchUsage();
  });

  // Regular check kada 60 segundo para hindi mag-spam ng process
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