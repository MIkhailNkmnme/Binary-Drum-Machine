/* Зеркалиус · бесшовная петля «Kraftwerk Bits».
 *
 * Отличие от трека: нет вступления и затухания, а хвосты последних нот
 * заворачиваются в начало. Для точной стыковки темп выбран так, чтобы такт
 * был целым числом семплов: 125 BPM → такт 1,92 с = 84 672 семпла при 44,1 кГц.
 *
 * Метод: считаем три цикла подряд, берём средний. Хвосты первого цикла
 * попадают в начало среднего, хвосты второго — в его конец, поэтому стык
 * получается без щелчка и без обрыва.
 *
 * Запуск: node zerkalius-loop.cjs <выходной-каталог>
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const Bit = require(path.join(ROOT, 'mayatnik', 'mayatnik-bit-synthesis.js'));
const Music = require(path.join(ROOT, 'mayatnik', 'mayatnik-synthesis-music.js'));

const DIGITS = {
  1: ['00110', '01110', '00110', '00110', '00110', '11111'],
  2: ['11111', '00001', '00010', '00100', '01000', '11111'],
  3: ['11111', '00001', '01111', '00001', '00001', '11111'],
  4: ['00010', '00110', '01110', '11010', '11111', '00010'],
  5: ['11111', '10000', '11111', '00001', '00001', '11111'],
  6: ['11111', '10000', '11111', '10001', '10001', '11111'],
  7: ['11111', '00001', '00010', '00100', '00100', '00100'],
  8: ['11111', '10001', '11111', '10001', '10001', '11111']
};
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const degreeMidi = (n, root, octaves = 2) => {
  const span = MINOR.length * octaves;
  const degree = ((n % span) + span) % span;
  return root + Math.floor(degree / MINOR.length) * 12 + MINOR[degree % MINOR.length];
};
const bitsOf = text => Array.from(text, cell => (cell === '1' ? 1 : 0));

const TEMPO = 125;                 // такт = 84 672 семпла при 44,1 кГц
const RATE = 44100;
const BARS = 24;                   // длина петли
const CYCLES = 3;                  // три прогона, берём средний
const SAMPLE_RATE_PER_BAR = Math.round(RATE * 60 / TEMPO * 4);
const CYCLE_SAMPLES = BARS * SAMPLE_RATE_PER_BAR;

const digits = [1, 2, 3, 4, 5, 6, 7, 8, 3, 5, 7, 1];
const events = [];

function compose(tick) {
  const bar = Math.floor(tick / 16);
  const step = tick % 16;
  const cycleBar = bar % BARS;
  const beat = tick / 4;
  const digit = digits[cycleBar % digits.length];
  const section = cycleBar < 8 ? 'a' : cycleBar < 16 ? 'b' : 'c';

  // Бочка — всегда: пульс не должен пропадать ни на такт.
  if (step % 4 === 0) {
    events.push({ beat, duration: .4, midi: 36, velocity: .84, voice: 'kick', pan: 0 });
  }
  if (step === 4 || step === 12) {
    events.push({ beat, duration: .3, midi: 38, velocity: .46, voice: 'snare', pan: -.05 });
  }
  if (step % 4 === 2) {
    events.push({ beat, duration: .12, midi: 46, velocity: .3, voice: 'hat', pan: .3 });
  }
  // В разделе «c» добавляются шестнадцатые — плотность растёт к концу цикла.
  if (section === 'c' && step % 2 === 1) {
    events.push({ beat, duration: .07, midi: 42, velocity: .16, voice: 'hat', pan: -.28 });
  }
  // Переход в новый круг: заливка в последних двух шагах.
  if (cycleBar === BARS - 1 && step >= 12) {
    // Последняя доля должна быть плотной: иначе на стыке слышен провал.
    const duration = step === 15 ? .12 : .08;
    events.push({ beat, duration, midi: 46, velocity: .3 + .07 * (step - 12), voice: 'hat', pan: .2 });
    if (step === 14) {
      events.push({ beat, duration: .22, midi: 38, velocity: .52, voice: 'snare', pan: .06 });
    }
    if (step === 15) {
      events.push({ beat, duration: .3, midi: 36, velocity: .72, voice: 'kick', pan: 0 });
    }
  }

  // Бас: восьмые из строк цифры, сильная доля — тоника.
  if (step % 2 === 0) {
    const row = bitsOf(DIGITS[digit][(tick / 2) % 6]);
    const n = Bit.bitsToNumber(row);
    const midi = step % 8 === 0 ? 36 : degreeMidi(n, 36, 2);
    const ones = row.reduce((sum, bit) => sum + bit, 0);
    // В последнем такте бас тянется ровно до границы петли: иначе перед стыком дыра.
    const tailToEdge = cycleBar === BARS - 1 && step === 14;
    events.push({
      beat, duration: tailToEdge ? .5 : .34, midi, velocity: .42 + .1 * ones,
      voice: 'bitsHarmonic', pan: -.12, bits: row,
      f0: Bit.midiToHz(midi), tau: tailToEdge ? .22 : .13,
      tilt: section === 'a' ? .78 : section === 'b' ? .84 : .9
    });
  }

  // Лид входит со второго раздела: сначала редкие ноты, потом чаще.
  const leadSteps = section === 'b' ? [6, 14] : section === 'c' ? [2, 6, 10, 14] : [];
  if (leadSteps.includes(step)) {
    const column = [];
    for (let y = 0; y < 6; y++) column.push(bitsOf(DIGITS[digits[(cycleBar + 1) % digits.length]][y])[(step / 2 + y) % 5]);
    const n = Bit.bitsToNumber(column);
    const midi = degreeMidi(n, 60, 2);
    events.push({
      beat, duration: .24, midi, velocity: .3, voice: 'bitsHarmonic', pan: .28,
      bits: column, f0: Bit.midiToHz(midi), tau: .1, tilt: .88
    });
  }

  // Подложка на каждый четвёртый такт — держит гармонию по кругу.
  if (step === 0 && cycleBar % 4 === 0) {
    const root = 48 + MINOR[(cycleBar / 4) % MINOR.length];
    events.push({ beat, duration: 3.6, midi: root, velocity: .22, voice: 'strings', pan: -.3 });
  }
}

for (let tick = 0; tick < BARS * 16 * CYCLES; tick++) compose(tick);

// Рендер: три цикла плюс запас на хвосты.
const seconds = (CYCLE_SAMPLES * CYCLES) / RATE + 2;
const options = { tempo: TEMPO, volume: .84 };
const wav = Music.renderWav(events, options, { durationSeconds: seconds, sampleRate: RATE });

// Вырезаем средний цикл из PCM.
const pcm = Buffer.from(wav.buffer, wav.byteOffset + 44, wav.byteLength - 44);
const frameBytes = 4;                       // стерео 16 бит
const start = CYCLE_SAMPLES * frameBytes;
const loopPcm = pcm.subarray(start, start + CYCLE_SAMPLES * frameBytes);

function writeWav(file, data) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([header, data]));
}

const out = process.argv[2] || __dirname;
fs.mkdirSync(out, { recursive: true });
writeWav(path.join(out, 'zerkalius-loop.wav'), loopPcm);

// Проверка стыка: скачок между последним и первым семплом против обычного шага.
const samples = new Int16Array(loopPcm.buffer, loopPcm.byteOffset, loopPcm.length / 2);
const left = [];
for (let i = 0; i < samples.length; i += 2) left.push(samples[i]);
const jumps = [];
for (let i = 1; i < left.length; i++) jumps.push(Math.abs(left[i] - left[i - 1]));
jumps.sort((x, y) => x - y);
// Дыра перед стыком: ищем последний звук от конца.
let gap = 0;
for (let i = left.length - 1; i >= 0; i--) {
  if (Math.abs(left[i]) > 330) break;   // −60 dBFS
  gap = (left.length - i) / RATE;
}
console.log('дыра перед стыком, мс:', (gap * 1000).toFixed(1));
const seam = Math.abs(left[0] - left[left.length - 1]);
const p99 = jumps[Math.floor(jumps.length * .99)];
console.log('петля:', (CYCLE_SAMPLES / RATE).toFixed(3), 'с | семплов:', CYCLE_SAMPLES);
console.log('скачок на стыке:', seam, '| 99-й процентиль обычного шага:', p99, '| стык не хуже обычного:', seam <= p99);
console.log('событий:', events.length, '| WAV байт:', loopPcm.length + 44);

// Длинная версия: точное повторение петли, без склейки внахлёст.
const REPEATS = 13;                          // 13 × 46,08 с ≈ 10 минут
const parts = [];
for (let i = 0; i < REPEATS; i++) parts.push(loopPcm);
writeWav(path.join(out, 'zerkalius-loop-10min.wav'), Buffer.concat(parts));
console.log('длинная версия:', (CYCLE_SAMPLES * REPEATS / RATE).toFixed(1), 'с');
