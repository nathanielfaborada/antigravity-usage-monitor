class AlarmScheduler {
  constructor({ alarms = [], save, ring, now = Date.now }) {
    this.alarms = alarms;
    this.save = save;
    this.ring = ring;
    this.now = now;
  }

  async arm(row, minutesBefore) {
    const reset = Date.parse(row.resetTime);
    const due = reset - minutesBefore * 60000;
    if (!Number.isFinite(due) || due <= this.now()) throw new Error('Choose a reset with a reminder time in the future.');
    const alarm = { bucketId: row.bucketId, group: row.group, window: row.window, resetTime: row.resetTime,
      minutesBefore, due, status: 'pending' };
    const old = this.alarms.findIndex(a => a.bucketId === row.bucketId);
    if (old >= 0) this.alarms.splice(old, 1);
    this.alarms.push(alarm);
    await this.save(this.alarms);
  }

  async sync(rows) {
    let changed = false;
    for (const alarm of this.alarms) {
      if (alarm.status !== 'pending' || alarm.snoozed || alarm.due <= this.now()) continue;
      const row = rows.find(r => r.bucketId === alarm.bucketId);
      if (row && row.resetTime !== alarm.resetTime && Number.isFinite(Date.parse(row.resetTime))) {
        alarm.resetTime = row.resetTime;
        alarm.due = Date.parse(row.resetTime) - alarm.minutesBefore * 60000;
        changed = true;
      }
    }
    if (changed) await this.save(this.alarms);
  }

  async tick() {
    const due = this.alarms.filter(a => a.status === 'pending' && a.due <= this.now());
    if (!due.length) return;
    for (const alarm of due) alarm.status = 'fired';
    await this.save(this.alarms);
    this.ring(due);
  }

  async snooze(alarms) {
    for (const alarm of alarms) {
      alarm.status = 'pending';
      alarm.snoozed = true;
      alarm.due = this.now() + 5 * 60000;
    }
    await this.save(this.alarms);
  }

  async clear() {
    this.alarms = [];
    await this.save(this.alarms);
  }

  next() {
    return this.alarms.filter(a => a.status === 'pending').sort((a, b) => a.due - b.due)[0];
  }
}

module.exports = { AlarmScheduler };
