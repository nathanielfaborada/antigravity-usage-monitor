const vscode = require('vscode');
const { getAsciiProgressBar, getShortGroupName, getShortLimitName, formatResetTime, getStatusBadge } = require('../quota');
const { getDiagnosticsReport } = require('../diagnostics');

/**
 * Displays the interactive QuickPick dashboard with ASCII progress bars and actions.
 */
async function showDetails(state) {
  const quickPick = vscode.window.createQuickPick();
  quickPick.title = 'Antigravity Usage Dashboard & Models';
  quickPick.placeholder = 'Select an action, view quota limits, or copy model IDs';

  const items = [];

  // Quota items
  items.push({ kind: vscode.QuickPickItemKind.Separator, label: 'Quota Limits' });
  if (!state.lastParsedRows || state.lastParsedRows.length === 0) {
    items.push({
      label: '$(warning) No quota metrics loaded',
      description: 'Run "Refresh Quotas" to fetch metrics',
      action: 'refresh'
    });
  } else {
    for (const r of state.lastParsedRows) {
      const bar = getAsciiProgressBar(r.percent, 10);
      const groupName = getShortGroupName(r.group);
      const limitName = getShortLimitName(r.limit, r.window);
      const resetDesc = r.description ? r.description : `Resets ${formatResetTime(r.resetTime)}`;
      items.push({
        label: `[${bar}] ${r.percent}% — ${groupName} ${limitName}`,
        description: resetDesc,
        detail: `Group: ${r.group} • Limit: ${r.limit} • Status: ${getStatusBadge(r.percent)} • Click to copy info`,
        row: r
      });
    }
  }

  // Model catalog items
  if (state.lastModels && state.lastModels.length > 0) {
    items.push({ kind: vscode.QuickPickItemKind.Separator, label: 'Available Models' });
    for (const m of state.lastModels) {
      items.push({
        label: `$(symbol-misc) ${m.id}`,
        description: m.name,
        detail: 'Click to copy model ID to clipboard',
        modelId: m.id
      });
    }
  }

  // Actions items
  items.push({ kind: vscode.QuickPickItemKind.Separator, label: 'Actions' });
  for (const [label, command] of [
    ['Set Quota Reset Alarm', 'antigravity.setResetAlarm'],
    ['Test Alarm Sound', 'antigravity.testAlarmSound'],
    ['Stop Alarm Sound', 'antigravity.stopAlarmSound'],
    ['Clear Reset Alarms', 'antigravity.clearResetAlarms']
  ]) items.push({ label, command });
  items.push({
    label: '$(sync) Refresh Quotas',
    description: 'Fetch latest usage metrics',
    action: 'refresh'
  });
  items.push({
    label: '$(gear) Open Settings',
    description: 'Configure Antigravity extension settings',
    action: 'settings'
  });
  items.push({
    label: '$(copy) Copy Diagnostics',
    description: 'Copy system and quota diagnostics to clipboard',
    action: 'copyDiagnostics'
  });
  items.push({
    label: '$(output) Show Logs',
    description: 'View diagnostic execution logs in Output panel',
    action: 'showLogs'
  });

  quickPick.items = items;

  quickPick.onDidAccept(() => {
    const selected = quickPick.selectedItems[0];
    quickPick.hide();
    quickPick.dispose();
    if (!selected) return;

    if (selected.command) {
      vscode.commands.executeCommand(selected.command);
    } else if (selected.action === 'refresh') {
      vscode.commands.executeCommand('antigravity.refreshUsage');
    } else if (selected.action === 'settings') {
      vscode.commands.executeCommand('workbench.action.openSettings', 'antigravity');
    } else if (selected.action === 'copyDiagnostics') {
      const diag = getDiagnosticsReport(state);
      vscode.env.clipboard.writeText(diag);
      vscode.window.showInformationMessage('Antigravity diagnostics copied to clipboard!');
    } else if (selected.action === 'showLogs') {
      vscode.commands.executeCommand('antigravity.showLogs');
    } else if (selected.modelId) {
      vscode.env.clipboard.writeText(selected.modelId);
      vscode.window.showInformationMessage(`Copied model ID "${selected.modelId}" to clipboard!`);
    } else if (selected.row) {
      const summary = `${selected.row.group} ${selected.row.limit}: ${selected.row.percent}% remaining (${formatResetTime(selected.row.resetTime)})`;
      vscode.env.clipboard.writeText(summary);
      vscode.window.showInformationMessage(`Copied quota info: "${summary}" to clipboard!`);
    }
  });

  quickPick.onDidHide(() => {
    quickPick.dispose();
  });

  quickPick.show();
}

module.exports = { showDetails };
