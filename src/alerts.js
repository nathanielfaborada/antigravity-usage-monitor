const vscode = require('vscode');
const { log } = require('./logger');
const { getShortLimitName, formatModelLabel } = require('./quota');

/**
 * Checks for critical quota thresholds and shows notifications when quota enters critical boundary.
 */
function checkCriticalAlerts(parsedRows, config = {}, state = {}) {
  const { notifyOnCritical = true, criticalThreshold = 20 } = config;
  if (!state.alertedKeys) {
    state.alertedKeys = new Set();
  }
  const alertedKeys = state.alertedKeys;
  const notifyFn = state.notifyFn || ((msg) => vscode.window.showWarningMessage(msg, 'View Details', 'Dismiss'));

  if (!notifyOnCritical || !Array.isArray(parsedRows) || parsedRows.length === 0) {
    return [];
  }

  const newAlerts = [];
  for (const row of parsedRows) {
    const normLimit = getShortLimitName(row.limit, row.window);
    const key = `${row.group || ''}::${normLimit}`;
    if (row.percent < criticalThreshold) {
      if (!alertedKeys.has(key)) {
        alertedKeys.add(key);
        newAlerts.push(row);
      }
    } else {
      alertedKeys.delete(key);
    }
  }

  if (newAlerts.length > 0) {
    let msg = '';
    if (newAlerts.length === 1) {
      const a = newAlerts[0];
      const modelLabel = formatModelLabel(a.group, a.limit).replace(/\*/g, '');
      msg = `Antigravity quota critical: ${modelLabel} is at ${a.percent}%!`;
    } else {
      const summaries = newAlerts.map(a => `${formatModelLabel(a.group, a.limit).replace(/\*/g, '')} (${a.percent}%)`).join(', ');
      msg = `Antigravity quota critical for multiple limits: ${summaries}`;
    }

    log(`Quota critical alert triggered: ${msg}`, 'WARN');
    try {
      const res = notifyFn(msg, newAlerts);
      if (res && typeof res.then === 'function') {
        res.then(choice => {
          if (choice === 'View Details') {
            vscode.commands.executeCommand('antigravity.showDetails');
          }
        }).catch(err => {
          log(`Critical alert action failed: ${err.message}`, 'WARN');
        });
      }
    } catch (err) {
      log(`Failed to trigger notification: ${err.message}`, 'WARN');
    }
  }

  return newAlerts;
}

module.exports = { checkCriticalAlerts };
