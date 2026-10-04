const vscode = require('vscode');
const { sortGroups, getShortGroupName, getShortLimitName, getGroupCode } = require('../quota');

/**
 * Formats the status bar text according to the user's selected format:
 * - compact: $(dashboard) Claude: 100% | Gem: 55%
 * - lowestOnly: $(dashboard) Gem: 55% (5h)
 * - detailed: $(dashboard) C: 100%/67% | G: 55%/14%
 * - iconOnly: $(dashboard)
 */
function formatStatusBarText(parsedRows, format = 'compact') {
  if (!Array.isArray(parsedRows) || parsedRows.length === 0) {
    return '$(dashboard) Ag: No Data';
  }

  if (format === 'iconOnly') {
    return '$(dashboard)';
  }

  if (format === 'lowestOnly') {
    const sorted = [...parsedRows].sort((a, b) => a.percent - b.percent);
    const lowest = sorted[0];
    const groupName = getShortGroupName(lowest.group);
    const limitName = getShortLimitName(lowest.limit, lowest.window);
    return `$(dashboard) ${groupName}: ${lowest.percent}% (${limitName})`;
  }

  if (format === 'detailed') {
    const groups = sortGroups(parsedRows.map(r => r.group));
    const parts = [];
    for (const group of groups) {
      const groupRows = parsedRows.filter(r => r.group === group);
      const code = getGroupCode(group);
      const fiveHour = groupRows.find(r => /five\s*hour|5\s*h/i.test(r.limit) || (r.window && /5h/i.test(r.window)));
      const weekly = groupRows.find(r => /weekly/i.test(r.limit) || (r.window && /weekly/i.test(r.window)));
      if (fiveHour && weekly) {
        parts.push(`${code}: ${fiveHour.percent}%/${weekly.percent}%`);
      } else {
        parts.push(`${code}: ${groupRows.map(r => `${r.percent}%`).join('/')}`);
      }
    }
    return `$(dashboard) ${parts.join(' | ')}`;
  }

  // Default: 'compact'
  const claude5h = parsedRows.find(r => /claude/i.test(r.group) && (/five\s*hour|5\s*h/i.test(r.limit) || (r.window && /5h/i.test(r.window))));
  const gemini5h = parsedRows.find(r => /gemini/i.test(r.group) && (/five\s*hour|5\s*h/i.test(r.limit) || (r.window && /5h/i.test(r.window))));
  const allGroups = sortGroups(parsedRows.map(r => r.group));
  const onlyClaudeAndGemini = allGroups.length <= 2 && allGroups.every(g => /gemini|claude/i.test(g));

  if (onlyClaudeAndGemini && claude5h && gemini5h) {
    return `$(dashboard) Claude: ${claude5h.percent}% | Gem: ${gemini5h.percent}%`;
  } else {
    const groupSummaries = [];
    for (const group of allGroups) {
      const groupRows = parsedRows.filter(r => r.group === group);
      const shortRow = groupRows.find(r => /five\s*hour|5\s*h|hourly|short/i.test(r.limit) || (r.window && /5h/i.test(r.window))) || groupRows[0];
      const shortName = getShortGroupName(group);
      groupSummaries.push(`${shortName}: ${shortRow.percent}%`);
    }
    return `$(dashboard) ${groupSummaries.join(' | ')}`;
  }
}

/**
 * Updates status bar colors with native visual health tinting.
 */
function updateStatusBarVisuals(statusBarItem, minPercent, criticalThreshold = 20) {
  const safePercent = Number(minPercent);
  if (!isFinite(safePercent) || isNaN(safePercent)) {
    statusBarItem.backgroundColor = undefined;
    statusBarItem.color = undefined;
    return;
  }

  if (safePercent < criticalThreshold) {
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    statusBarItem.color = new vscode.ThemeColor('statusBarItem.errorForeground');
  } else if (safePercent < 50) {
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
  } else {
    statusBarItem.backgroundColor = undefined;
    statusBarItem.color = undefined;
  }
}

module.exports = { formatStatusBarText, updateStatusBarVisuals };
