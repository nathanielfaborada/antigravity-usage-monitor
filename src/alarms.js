const vscode = require('vscode');
const { AlarmScheduler } = require('./alarmScheduler');
const { startSound, stopSound } = require('./alarmSound');
const { getShortLimitName } = require('./quota');
const { log } = require('./logger');

function createAlarms(context, getRows, onChange) {
  let disposed = false;
  let soundTimer;
  let chain = Promise.resolve();
  const run = action => {
    chain = chain.then(() => disposed ? undefined : action()).catch(error => {
      log(`Quota alarm: ${error.message}`, 'WARN');
      if (!disposed) vscode.window.showWarningMessage(`Quota alarm: ${error.message}`);
    });
    return chain;
  };
  const stop = () => {
    clearTimeout(soundTimer);
    stopSound();
  };
  const play = () => {
    stop();
    const config = vscode.workspace.getConfiguration('antigravity');
    if (!config.get('alarmSound', true)) return;
    try {
      const repeat = config.get('alarmRepeat', false);
      startSound(config.get('alarmVolume', 70), repeat);
      // Cap repeated sound so an unattended editor cannot ring indefinitely.
      soundTimer = setTimeout(stop, repeat ? 60000 : 4000);
    } catch (error) {
      vscode.window.showWarningMessage(error.message);
    }
  };
  const scheduler = new AlarmScheduler({
    alarms: context.globalState.get('quotaAlarms', []),
    save: async alarms => {
      await context.globalState.update('quotaAlarms', alarms);
      if (!disposed) onChange();
    },
    ring: alarms => {
      play();
      const names = alarms.map(a => `${a.group} (${getShortLimitName('', a.window)})`).join(', ');
      const before = alarms.some(a => Date.parse(a.resetTime) > Date.now());
      const message = before ? `Quota reset reminder: ${names}. Check reset times in Details.`
        : `Scheduled quota reset time reached: ${names}. Refresh to confirm remaining quota.`;
      vscode.window.showInformationMessage(message, 'Refresh Usage', 'Snooze 5 minutes', 'Dismiss').then(choice => {
        if (disposed) return;
        stop();
        if (choice === 'Snooze 5 minutes') run(() => scheduler.snooze(alarms));
        if (choice === 'Refresh Usage') vscode.commands.executeCommand('antigravity.refreshUsage');
      });
    }
  });
  const commands = [
    vscode.commands.registerCommand('antigravity.setResetAlarm', async () => {
      const rows = getRows().filter(r => Date.parse(r.resetTime) > Date.now());
      if (!rows.length) return vscode.window.showInformationMessage('Refresh Usage first to load upcoming quota resets.');
      const chosen = await vscode.window.showQuickPick(rows.map(row => ({
        label: `${row.group} (${getShortLimitName(row.limit, row.window)})`,
        description: new Date(row.resetTime).toLocaleString(), row
      })), { title: 'Choose quota reset alarm' });
      if (!chosen || disposed) return;
      const when = await vscode.window.showQuickPick([
        { label: 'At reset time', minutes: 0 }, { label: '5 minutes before reset', minutes: 5 }
      ], { title: 'When should the alarm ring?' });
      if (!when || disposed) return;
      await run(async () => {
        await scheduler.arm(chosen.row, when.minutes);
        vscode.window.showInformationMessage(`Alarm set for ${chosen.label}. Keep VS Code open and your PC awake.`);
      });
    }),
    vscode.commands.registerCommand('antigravity.testAlarmSound', () => {
      play();
      vscode.window.showInformationMessage('Testing quota alarm sound.', 'Stop Sound').then(stop);
    }),
    vscode.commands.registerCommand('antigravity.stopAlarmSound', stop),
    vscode.commands.registerCommand('antigravity.clearResetAlarms', () => run(async () => {
      stop();
      await scheduler.clear();
      vscode.window.showInformationMessage('Quota reset alarms cleared.');
    }))
  ];
  const timer = setInterval(() => run(() => scheduler.tick()), 1000);
  run(() => scheduler.tick());
  context.subscriptions.push(...commands, { dispose: () => {
    disposed = true;
    clearInterval(timer);
    stop();
  } });
  return { sync: rows => run(() => scheduler.sync(rows)), next: () => scheduler.next() };
}

module.exports = { createAlarms };
