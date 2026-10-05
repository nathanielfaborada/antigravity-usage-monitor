const vscode = require('vscode');
const { sortGroups, computeDailyBudget, getShortGroupName, formatModelLabel, getStatusBadge, formatResetTime } = require('../quota');

function createUsageTooltip(parsedRows, nextAlarm) {
  const md = new vscode.MarkdownString();
  md.isTrusted = true;
  md.supportThemeIcons = true;

  const showDailyBudget = vscode.workspace.getConfiguration('antigravity').get('showDailyBudget', true);

  md.appendMarkdown(`### $(dashboard) Antigravity Quotas\n\n`);
  if (nextAlarm) {
    md.appendText(`Next alarm: ${nextAlarm.group} (${nextAlarm.window}) at ${new Date(nextAlarm.due).toLocaleString()}`);
    md.appendMarkdown('\n\n');
  }
  md.appendMarkdown('[Set Reset Alarm](command:antigravity.setResetAlarm) | [Test Sound](command:antigravity.testAlarmSound) | [Stop Sound](command:antigravity.stopAlarmSound) | [Clear Alarms](command:antigravity.clearResetAlarms)\n\n');

  if (showDailyBudget) {
    const groups = sortGroups(parsedRows.map(r => r.group));
    let hasBudgetSection = false;

    for (const group of groups) {
      const groupRows = parsedRows.filter(r => r.group === group);
      const weeklyRow = groupRows.find(r => r.window === 'weekly');
      const fiveHourRow = groupRows.find(r => r.window === '5h');
      const budget = computeDailyBudget(weeklyRow);

      if (budget) {
        if (!hasBudgetSection) {
          md.appendMarkdown(`> **$(calendar) Daily Budget Planner**\n>\n`);
          hasBudgetSection = true;
        }
        const shortGroup = getShortGroupName(group);
        const budgetBadge = budget.dailyBudgetPercent >= 15 ? '🟢' : budget.dailyBudgetPercent >= 7 ? '🟡' : '🔴';
        const fiveHourNote = fiveHourRow
          ? ` · 5h remaining: **${fiveHourRow.percent}%**`
          : '';
        md.appendMarkdown(`> **${shortGroup}** — Weekly quota ÷ ${budget.daysRemaining} day${budget.daysRemaining !== 1 ? 's' : ''} left = ${budgetBadge} **${budget.dailyBudgetPercent}% per day**${fiveHourNote}\n>\n`);
      }
    }

    if (hasBudgetSection) {
      md.appendMarkdown(`\n`);
    }
  }

  md.appendMarkdown(`| Model | Remaining | Status | Reset Time |${showDailyBudget ? ' Daily Budget |' : ''}\n`);
  md.appendMarkdown(`| :--- | :---: | :---: | :---: |${showDailyBudget ? ' :---: |' : ''}\n`);

  for (const row of parsedRows) {
    const label = formatModelLabel(row.group, row.limit);
    const badge = getStatusBadge(row.percent);
    const resetStr = formatResetTime(row.resetTime);

    let dailyBudgetCell = '';
    if (showDailyBudget) {
      if (row.window === 'weekly') {
        const budget = computeDailyBudget(row);
        dailyBudgetCell = budget
          ? ` 📅 **${budget.dailyBudgetPercent}%**/day |`
          : ' — |';
      } else {
        dailyBudgetCell = ' — |';
      }
    }

    md.appendMarkdown(`| ${label} | ${row.percent}% | ${badge} | ${resetStr} |${dailyBudgetCell}\n`);
  }

  md.appendMarkdown(`\n---\n* [$(sync) Refresh](command:antigravity.refreshUsage) &nbsp;|&nbsp; [$(list-selection) Details](command:antigravity.showDetails) &nbsp;|&nbsp; [$(output) Logs](command:antigravity.showLogs) &nbsp;|&nbsp; [$(gear) Settings](command:workbench.action.openSettings?%22antigravity%22)*\n`);


  return md;
}

module.exports = { createUsageTooltip };
