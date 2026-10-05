const fs = require('fs');
const path = require('path');

let playSound;
let activeBuffer;

function stopSound() {
  if (playSound) playSound(null, null, 0);
  activeBuffer = undefined;
}

function startSound(volume = 70, repeat = false) {
  if (process.platform !== 'win32') throw new Error('Alarm sound currently supports Windows only.');
  if (!playSound) {
    const koffi = require('koffi');
    playSound = koffi.load('winmm.dll').func('int __stdcall PlaySoundW(const void *sound, void *module, uint32 flags)');
  }
  stopSound();
  activeBuffer = fs.readFileSync(path.join(__dirname, '../resources/alarm.wav'));
  const gain = Math.max(0, Math.min(100, volume)) / 100;
  for (let offset = 44; offset + 1 < activeBuffer.length; offset += 2) {
    activeBuffer.writeInt16LE(Math.round(activeBuffer.readInt16LE(offset) * gain), offset);
  }
  // PlaySound retains the memory pointer during asynchronous playback.
  if (!playSound(activeBuffer, null, 0x1 | 0x4 | 0x2 | (repeat ? 0x8 : 0))) {
    activeBuffer = undefined;
    throw new Error('Windows could not play the alarm sound. Check your audio output.');
  }
}

module.exports = { startSound, stopSound };
