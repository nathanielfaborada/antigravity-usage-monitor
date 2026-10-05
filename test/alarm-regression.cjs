const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AlarmScheduler } = require('../src/alarmScheduler');

test('persists, fires once after restart, snoozes and clears', async () => {
  let now = 1000000;
  let stored = [];
  const notifications = [];
  const options = { now: () => now, save: async a => { stored = JSON.parse(JSON.stringify(a)); },
    ring: a => notifications.push(a) };
  let scheduler = new AlarmScheduler(options);
  const row = { bucketId: 'gemini-5h', group: 'Gemini Models', window: '5h', resetTime: new Date(now + 600000).toISOString() };
  await scheduler.arm(row, 5);
  scheduler = new AlarmScheduler({ ...options, alarms: stored });
  now += 300000;
  await scheduler.tick();
  await scheduler.tick();
  assert.equal(notifications.length, 1);
  await scheduler.snooze(notifications[0]);
  now += 299999;
  await scheduler.tick();
  assert.equal(notifications.length, 1);
  now++;
  await scheduler.tick();
  assert.equal(notifications.length, 2);
  scheduler = new AlarmScheduler({ ...options, alarms: stored });
  await scheduler.tick();
  assert.equal(notifications.length, 2);
  await scheduler.clear();
  assert.equal(scheduler.next(), undefined);
  assert.deepEqual(stored, []);
});

test('reschedules changed resets, preserves snooze and keeps groups separate', async () => {
  const now = 1000000;
  const scheduler = new AlarmScheduler({ now: () => now, save: async () => {}, ring: () => {} });
  const row = { bucketId: 'gemini-weekly', group: 'Gemini Models', window: 'weekly', resetTime: new Date(now + 600000).toISOString() };
  await scheduler.arm(row, 0);
  await scheduler.arm({ ...row, bucketId: '3p-weekly', group: 'Claude and GPT models' }, 0);
  await scheduler.sync([{ ...row, resetTime: new Date(now + 1200000).toISOString() }]);
  assert.equal(scheduler.alarms[0].due, now + 1200000);
  assert.equal(scheduler.alarms[1].due, now + 600000);
  await scheduler.snooze([scheduler.alarms[0]]);
  await scheduler.sync([{ ...row, resetTime: new Date(now + 1800000).toISOString() }]);
  assert.equal(scheduler.alarms[0].due, now + 300000);
  await assert.rejects(scheduler.arm({ ...row, resetTime: 'invalid' }, 0), /future/);
});
