/* Зеркалиус · «Глифы»: второй трек на синтезе из битов.
 *
 * Два источника:
 *  - цифры шрифта Крафтверка 5×6 (issledovanie/kraftwerk-shrift/digits.json) — бас;
 *  - графы глифов 8×12 (issledovanie/kraftwerk-glyph15/analysis.json) — лид:
 *    клетка считается включённой, если у неё есть хоть одно ребро.
 *
 * Секции, заливки, автоматизация яркости (tilt) и октавный «Шеппард» — здесь.
 * Запуск: node zerkalius-glyph-track.cjs <выходной-каталог>
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
  const degree = ((n % (MINOR.length * octaves)) + MINOR.length * octaves) % (MINOR.length * octaves);
  return root + Math.floor(degree / MINOR.length) * 12 + MINOR[degree % MINOR.length];
};
const bitsOf = text => Array.from(text, cell => (cell === '1' ? 1 : 0));

// Графы глифов 8×12 → строки по 8 бит.
function loadGlyphRows() {
  const file = path.join(ROOT, 'issledovanie', 'kraftwerk-glyph15', 'analysis.json');
  if (!fs.existsSync(file)) return [];
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const graphs = (data.graphs || []).filter(graph => graph.stable && graph.edges.length);
  return graphs.map(graph => {
    const edges = new Set(graph.edges);
    const rows = [];
    for (let y = 0; y < 12; y++) {
      const row = [];
      for (let x = 0; x < 8; x++) {
        const on = edges.has('H' + x + ',' + y) || edges.has('H' + x + ',' + (y + 1))
          || edges.has('V' + x + ',' + y) || edges.has('V' + (x + 1) + ',' + y);
        row.push(on ? 1 : 0);
      }
      rows.push(row);
    }
    return { id: graph.id, rows };
  });
}

const GLYPHS = loadGlyphRows();
const TEMPO = 124;
const BARS = 88;
const TICKS = BARS * 16;
const BEAT = 60 / TEMPO;

function sectionOf(bar) {
  if (bar < 16) return 'intro';
  if (bar < 32) return 'build';
  if (bar < 48) return 'main';
  if (bar < 56) return 'break';
  if (bar < 80) return 'main2';
  return 'outro';
}
// Яркость тембра: от тёмного вступления к открытой середине и обратно.
const TILT = { intro: .68, build: .78, main: .86, break: .94, main2: .9, outro: .72 };

const digits = [1, 2, 3, 4, 5, 6, 7, 8, 3, 5, 7, 1];
const events = [];
const midiOfBass = n => degreeMidi(n, 36, 2);
const midiOfLead = n => degreeMidi(n, 60, 2);

for (let tick = 0; tick < TICKS; tick++) {
  const bar = Math.floor(tick / 16);
  const step = tick % 16;
  const section = sectionOf(bar);
  const beat = tick / 4;
  const tilt = TILT[section];
  const digit = digits[bar % digits.length];
  const fade = section === 'outro' ? Math.max(.12, 1 - (bar - 80) / 8) : 1;

  const drums = section === 'intro' || section === 'build' || section === 'main' || section === 'main2';
  const fillBar = bar % 8 === 7;

  if (drums) {
    if (step % 4 === 0 && !(section === 'build' && bar % 8 === 6 && step === 0)) {
      events.push({ beat, duration: .4, midi: 36, velocity: .82 * fade, voice: 'kick', pan: 0 });
    }
    if ((section === 'build' || section === 'main' || section === 'main2') && (step === 4 || step === 12)) {
      events.push({ beat, duration: .3, midi: 38, velocity: .48, voice: 'snare', pan: -.06 });
    }
    if (step % 4 === 2) {
      events.push({ beat, duration: .12, midi: 46, velocity: .3, voice: 'hat', pan: .3 });
    }
    if ((section === 'main2' || section === 'main') && step % 2 === 1) {
      events.push({ beat, duration: .07, midi: 42, velocity: .16, voice: 'hat', pan: -.28 });
    }
    if (fillBar && step >= 12) {
      events.push({
        beat, duration: .08, midi: 46,
        velocity: .2 + .06 * (step - 12), voice: 'hat', pan: .2
      });
    }
  }

  // Бас: восьмые из строк цифры.
  if (step % 2 === 0) {
    const row = bitsOf(DIGITS[digit][(tick / 2) % 6]);
    const n = Bit.bitsToNumber(row);
    const midi = step % 8 === 0 ? 36 : midiOfBass(n);
    const ones = row.reduce((sum, bit) => sum + bit, 0);
    events.push({
      beat, duration: .34, midi, velocity: (.4 + .1 * ones) * fade,
      voice: 'bitsHarmonic', pan: -.12, bits: row, f0: Bit.midiToHz(midi), tau: .13, tilt
    });
  }

  // Лид: строки графа глифа 8×12, по одной на восьмую.
  if ((section === 'main' || section === 'main2') && step % 2 === 0 && GLYPHS.length) {
    const graph = GLYPHS[(bar * 7 + Math.floor(step / 4)) % GLYPHS.length];
    const row = graph.rows[(step / 2 + bar) % 12];
    const n = Bit.bitsToNumber(row);
    const midi = midiOfLead(n);
    events.push({
      beat, duration: .22, midi, velocity: .3, voice: 'bitsHarmonic', pan: .28,
      bits: row, f0: Bit.midiToHz(midi), tau: .1, tilt
    });
  }

  // Подложка: терции и квинты на сильной доле, с подъёма.
  if (tick === bar * 16 && ['build', 'main', 'main2', 'outro'].includes(section)) {
    for (const [degree, gain] of [[0, .3], [2, .22], [4, .18]]) {
      events.push({
        beat, duration: 3.4, midi: 48 + MINOR[(bar + degree) % MINOR.length],
        velocity: gain * fade, voice: 'strings', pan: degree === 0 ? -.3 : .3
      });
    }
  }

  // Проигрыш: октавный «Шеппард» — три слоя одного тона через октаву.
  if (section === 'break' && step % 8 === 0) {
    const row = GLYPHS.length ? GLYPHS[bar % GLYPHS.length].rows[Math.floor(tick / 8) % 12] : bitsOf(DIGITS[digit][(tick / 8) % 6]);
    const midi = 48 + (Bit.bitsToNumber(row) % 12);
    for (const octave of [0, 12, 24]) {
      events.push({
        beat, duration: 2.2, midi: midi + octave, velocity: .22, voice: 'bitsShepard',
        pan: octave ? .3 : -.3, bits: row, f0: Bit.midiToHz(midi + octave), tau: 1.4
      });
    }
  }
}

// Явная громкость секций: без неё вступление звучит как основа.
const GAIN = { intro: .72, build: .86, main: 1, break: .78, main2: 1, outro: 1 };
for (const event of events) {
  event.velocity = Math.min(1, event.velocity * GAIN[sectionOf(Math.floor(event.beat / 4))]);
}

const seconds = TICKS * BEAT / 4 + 3;
const options = { tempo: TEMPO, volume: .84 };
const wav = Music.renderWav(events, options, { durationSeconds: seconds, sampleRate: 44100 });
const midiFile = Music.exportMidi(events, options);

const out = process.argv[2] || __dirname;
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'zerkalius-glyphs.wav'), Buffer.from(wav));
fs.writeFileSync(path.join(out, 'zerkalius-glyphs.mid'), Buffer.from(midiFile));
console.log('графов глифов:', GLYPHS.length, '| событий:', events.length,
  '| секунд:', seconds.toFixed(1), '| WAV байт:', wav.length);
