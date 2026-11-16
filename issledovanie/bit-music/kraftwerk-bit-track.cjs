/* Крафтверк из битов: трек на синтезе МАЯ-683.
 *
 * Исходник — маски шрифта Крафтверка (issledovanie/kraftwerk-shrift/digits.json),
 * поле 5×6. Строка глифа читается как число (бит 0 — младший) и становится нотой,
 * столбец даёт ритм. Барабаны — прежние голоса движка.
 *
 * Запуск: node kraftwerk-bit-track.cjs <выходной-каталог>
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MAYATNIK = path.join(ROOT, 'mayatnik');
const Bit = require(path.join(MAYATNIK, 'mayatnik-bit-synthesis.js'));
const Music = require(path.join(MAYATNIK, 'mayatnik-synthesis-music.js'));

// Маски шрифта: 1 — включённая клетка, 0 — выключенная.
const GLYPHS = {
  1: ['00110', '01110', '00110', '00110', '00110', '11111'],
  2: ['11111', '00001', '00010', '00100', '01000', '11111'],
  3: ['11111', '00001', '01111', '00001', '00001', '11111'],
  4: ['00010', '00110', '01110', '11010', '11111', '00010'],
  5: ['11111', '10000', '11111', '00001', '00001', '11111'],
  6: ['11111', '10000', '11111', '10001', '10001', '11111'],
  7: ['11111', '00001', '00010', '00100', '00100', '00100'],
  8: ['11111', '10001', '11111', '10001', '10001', '11111']
};
const TEMPO = 124;
const BARS = 48;
const TICKS = BARS * 16;

const bitsOf = text => Array.from(text, cell => (cell === '1' ? 1 : 0));
const rowOf = (digit, row) => bitsOf(GLYPHS[digit][((row % 6) + 6) % 6]);

// Секции: что звучит в каждом отрезке тактов.
function sectionOf(bar) {
  if (bar < 12) return 'intro';       // 0–11:  бочка, хэт, бас
  if (bar < 24) return 'main';        // 12–23: + снейр, + лид
  if (bar < 32) return 'break';       // 24–31: без бочки, Шеппард, редкий хэт
  if (bar < 44) return 'main2';       // 32–43: полный набор
  return 'outro';                     // 44–47: бас и щелчок, затухание
}

// Порядок цифр: 1–8, затем снова, чтобы тема повторялась как у Крафтверка.
const sequence = [1, 2, 3, 4, 5, 6, 7, 8, 3, 5, 7, 1];
const sequenceLead = [8, 7, 6, 5, 4, 3, 2, 1, 6, 4, 2, 8];

const events = [];
// Лад вместо хроматики: число даёт ступень. Октав не больше двух — иначе
// длинные столбцы уводят лид в писк, а бас в чужой регистр.
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const degreeMidi = (n, root, octaves = 2) => {
  const degree = n % (MINOR.length * octaves);
  return root + Math.floor(degree / MINOR.length) * 12 + MINOR[degree % MINOR.length];
};
const midiOfBass = n => degreeMidi(n, 36, 2);
const midiOfLead = n => degreeMidi(n, 60, 2);

for (let tick = 0; tick < TICKS; tick++) {
  const bar = Math.floor(tick / 16);
  const step = tick % 16;
  const section = sectionOf(bar);
  const digit = sequence[bar % sequence.length];
  const digitLead = sequenceLead[bar % sequenceLead.length];
  const beat = tick / 4;
  const fade = section === 'outro' ? Math.max(.15, 1 - (bar - 44) / 4) : 1;

  // Барабаны: механическая сетка, как в «Транс-Европа Экспресс».
  const drums = section === 'intro' || section === 'main' || section === 'main2';
  if (drums && step % 4 === 0) {
    events.push({ beat, duration: .4, midi: 36, velocity: .85 * fade, voice: 'kick', pan: 0 });
  }
  if ((section === 'main' || section === 'main2') && (step === 4 || step === 12)) {
    events.push({ beat, duration: .3, midi: 38, velocity: .5, voice: 'snare', pan: -.05 });
  }
  if (drums && step % 4 === 2) {
    events.push({ beat, duration: .12, midi: 46, velocity: .32, voice: 'hat', pan: .3 });
  }
  if (section === 'break' && step === 8) {
    events.push({ beat, duration: .1, midi: 42, velocity: .18, voice: 'hat', pan: -.3 });
  }

  // Бас: каждая восьмая — строка глифа как число.
  if (step % 2 === 0) {
    const row = rowOf(digit, tick / 2);
    const n = Bit.bitsToNumber(row);
    const midi = step % 8 === 0 ? 36 : midiOfBass(n);   // сильная доля — всегда тоника
    const ones = row.reduce((sum, bit) => sum + bit, 0);
    events.push({
      beat, duration: .34, midi,
      velocity: (.42 + .12 * ones) * fade,
      voice: 'bitsHarmonic', pan: -.12,
      bits: row, f0: Bit.midiToHz(midi), tau: .13
    });
  }

  // Лид: синкопа на четвёртой доле, столбец глифа как число.
  if ((section === 'main' || section === 'main2') && (step === 6 || step === 14)) {
    const column = [];
    for (let y = 0; y < 6; y++) column.push(bitsOf(GLYPHS[digitLead][y])[(step / 2 + y) % 5]);
    const n = Bit.bitsToNumber(column);
    const midi = midiOfLead(n);
    events.push({
      beat, duration: .28, midi,
      velocity: .34, voice: 'bitsHarmonic', pan: .28,
      bits: column, f0: Bit.midiToHz(midi), tau: .09
    });
  }

  // Шеппард в проигрыше: медленная подложка через каждые четыре шага.
  if (section === 'break' && step % 8 === 0) {
    const row = rowOf(digit, Math.floor(tick / 8));
    const n = Bit.bitsToNumber(row);
    const midi = 48 + n;
    events.push({
      beat, duration: 1.6, midi, velocity: .3, voice: 'bitsShepard', pan: .2,
      bits: row, f0: Bit.midiToHz(midi), tau: 1.1
    });
  }
}

const seconds = TICKS * 60 / TEMPO / 4 + 3;
const options = { tempo: TEMPO, volume: .82 };
const wav = Music.renderWav(events, options, { durationSeconds: seconds, sampleRate: 44100 });
const midi = Music.exportMidi(events, options);

const out = process.argv[2] || __dirname;
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'kraftwerk-bits.wav'), Buffer.from(wav));
fs.writeFileSync(path.join(out, 'kraftwerk-bits.mid'), Buffer.from(midi));
console.log('событий:', events.length, '| секунд:', seconds.toFixed(1), '| WAV байт:', wav.length, '| MIDI байт:', midi.length);
