/* «Numbers», набросок: минимальный бит 90 BPM и счёт цифрами поверх.
 * Музыка без голоса — голос подмешивается отдельным шагом (mix_numbers.py).
 * Запуск: node numbers-sketch.cjs <каталог>
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const Bit = require(path.join(ROOT, 'mayatnik', 'mayatnik-bit-synthesis.js'));
const Music = require(path.join(ROOT, 'mayatnik', 'mayatnik-synthesis-music.js'));

const TEMPO = Math.max(40, Math.min(200, Number(process.argv[2]) || 90));
const BARS = 32;
const RATE = 44100;
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const degreeMidi = (n, root) => {
  const degree = ((n % 14) + 14) % 14;
  return root + Math.floor(degree / 7) * 12 + MINOR[degree % 7];
};

// Остинато: номер такта задаёт число, число — ступень. Рисунок повторяется каждые восемь тактов.
const PATTERN = [0, 3, 5, 3, 0, 3, 7, 5];
const events = [];
for (let bar = 0; bar < BARS; bar++) {
  for (let step = 0; step < 16; step++) {
    const beat = bar * 4 + step / 4;
    // Бочка на каждой доле, снейр на 2 и 4, хэт на слабой восьмой.
    if (step % 4 === 0) {
      events.push({ beat, duration: .4, midi: 36, velocity: .8, voice: 'kick', pan: 0 });
    }
    if (step === 4 || step === 12) {
      events.push({ beat, duration: .3, midi: 38, velocity: .44, voice: 'snare', pan: -.04 });
    }
    if (step % 4 === 2) {
      events.push({ beat, duration: .1, midi: 46, velocity: .26, voice: 'hat', pan: .26 });
    }
    // Бас: восьмые по рисунку, ступень из лада.
    if (step % 2 === 0) {
      const degree = PATTERN[bar % PATTERN.length];
      const midi = degreeMidi(degree + (step === 0 ? 0 : 0), 36);
      events.push({
        beat, duration: .36, midi, velocity: .52, voice: 'bitsHarmonic', pan: -.1,
        bits: [1, 0, 1, 0, 1, 1, 0, 0], f0: Bit.midiToHz(midi), tau: .16, tilt: .8
      });
    }
    // Длинный аккорд на каждый второй такт: две ноты, чтобы был «холод».
    if (step === 0 && bar % 2 === 0) {
      events.push({ beat, duration: 7.4, midi: 48 + MINOR[bar % MINOR.length], velocity: .18, voice: 'strings', pan: -.32 });
      events.push({ beat, duration: 7.4, midi: 55 + MINOR[(bar + 4) % MINOR.length], velocity: .14, voice: 'strings', pan: .32 });
    }
  }
}

const seconds = BARS * 4 * 60 / TEMPO + 2;
const wav = Music.renderWav(events, { tempo: TEMPO, volume: .8 }, { durationSeconds: seconds, sampleRate: RATE });
const out = process.argv[3] || __dirname;
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'numbers-bed.wav'), Buffer.from(wav));
console.log('тактов:', BARS, '| событий:', events.length, '| секунд:', seconds.toFixed(1), '| WAV байт:', wav.length);
