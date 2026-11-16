const test = require('node:test');
const assert = require('node:assert/strict');
const Bit = require('./mayatnik-bit-synthesis.js');
const Music = require('./mayatnik-synthesis-music.js');

function frame(tick, bits, width = bits.length, height = 1) {
  return {
    tick,
    width,
    height,
    a: Uint8Array.from(bits, bit => bit === 1),
    b: Uint8Array.from(bits, () => 0),
    result: Int8Array.from(bits)
  };
}

// Амплитуда на заданной частоте: алгоритм Гёрцеля, без внешних зависимостей.
function magnitude(pcm, rate, frequency) {
  const coefficient = 2 * Math.cos(2 * Math.PI * frequency / rate);
  let previous = 0;
  let before = 0;
  for (let index = 0; index < pcm.length; index++) {
    const current = pcm[index] + coefficient * previous - before;
    before = previous;
    previous = current;
  }
  return Math.sqrt(previous * previous + before * before - coefficient * previous * before) / pcm.length;
}

function peaks(pcm, rate, f0, harmonics = 24) {
  const values = [];
  for (let harmonic = 1; harmonic <= harmonics; harmonic++) {
    values.push({ harmonic, value: magnitude(pcm, rate, f0 * harmonic) });
  }
  const top = Math.max(...values.map(item => item.value));
  return values.filter(item => item.value > top * .2).map(item => item.harmonic);
}

test('bitsToNumber: младший бит первый, битые входы отклоняются', () => {
  assert.equal(Bit.bitsToNumber([1]), 1);
  assert.equal(Bit.bitsToNumber([0, 1]), 2);
  assert.equal(Bit.bitsToNumber([1, 1]), 3);
  assert.equal(Bit.bitsToNumber([1, 0, 0, 0]), 1);   // индекс 0 — младший бит
  assert.equal(Bit.bitsToNumber([0, 0, 0, 1]), 8);   // индекс 3 — вес 2³
  assert.equal(Bit.bitsToNumber(new Array(8).fill(0)), 0);
  assert.equal(Bit.bitsToNumber(new Array(8).fill(1)), 255);
  assert.equal(Bit.bitsToNumber([1, 0, 1]), 5);
  assert.equal(Bit.bitsToNumber([]), null);
  assert.equal(Bit.bitsToNumber([2, 0]), null);
  assert.equal(Bit.bitsToNumber(null), null);
  assert.equal(Bit.binaryOf(20, 8), '00010100');
  assert.equal(Bit.binaryOf(0, 4), '0000');
});

test('numberToMidi: 0…63 дают 64 разные высоты и остаются в MIDI-диапазоне', () => {
  const notes = Array.from({ length: 64 }, (_, n) => Bit.numberToMidi(n));
  assert.equal(new Set(notes).size, 64);
  assert.ok(notes.every(note => Number.isInteger(note) && note >= 0 && note <= 127));
  assert.deepEqual(notes.map((note, index) => note - index), new Array(64).fill(notes[0]));
  // лад переносится октавами и не выходит за 0…127 даже на большом n
  for (const n of [0, 7, 28, 63, 255]) {
    const note = Bit.numberToMidi(n, { root: 48, scale: 'minor' });
    assert.ok(Number.isInteger(note) && note >= 0 && note <= 127);
  }
  assert.equal(Bit.numberToMidi(-1), null);
});

test('rowToBits и bitsToPartials: строка кадра и число партиал', () => {
  const bits = Bit.rowToBits(frame(0, [1, 0, 1, 1], 4, 1));
  assert.deepEqual(bits, [1, 0, 1, 1]);
  const partials = Bit.bitsToPartials(bits, { tilt: .5 });
  assert.deepEqual(partials.map(partial => partial.harmonic), [1, 3, 4]);
  assert.deepEqual(partials.map(partial => partial.amplitude), [1, .25, .125]);
  assert.equal(Bit.bitsToPartials([0, 0, 0]).length, 0);
  assert.deepEqual(Bit.rowToBits({ tick: 0, width: 4, height: 2, result: new Int8Array(2) }), []);
});

test('audiblePartials отбрасывает всё выше 0,45·rate', () => {
  const partials = Bit.bitsToPartials(new Array(32).fill(1));
  const audible = Bit.audiblePartials(partials, 1000, 44100);
  assert.equal(audible.length, 19);          // 19 · 1000 = 19000 < 19845, 20 · 1000 уже нет
  assert.equal(Bit.audiblePartials(partials, 2000, 44100).length, 9);
  assert.equal(Bit.audiblePartials(partials, 60, 8000).length, 32);
});

test('renderBitVoice: детерминизм, тишина на пустой строке, потолок по усилению', () => {
  const options = { bits: [1, 0, 1], f0: 220, rate: 22050, duration: 1, tau: 1.2, gain: .5 };
  const first = Bit.renderBitVoice(options);
  const second = Bit.renderBitVoice(options);
  assert.deepEqual(first, second);
  assert.equal(first.length, 22050);
  assert.ok(first.some(sample => sample !== 0));
  assert.ok(Math.max(...first.map(Math.abs)) <= .5 + 1e-6);

  assert.equal(Bit.renderBitVoice({ ...options, bits: [0, 0, 0] }).every(sample => sample === 0), true);
  assert.equal(Bit.renderBitVoice({ ...options, bits: [] }).every(sample => sample === 0), true);
  assert.notDeepEqual(Bit.renderBitVoice({ ...options, bits: [1, 1, 0] }), first);
});

test('спектр: число пиков равно числу включённых битов, частоты кратны f₀', () => {
  const rate = 22050, f0 = 150;
  const cases = [[1, 0, 0], [1, 1, 0, 0], [1, 0, 1, 1]];
  for (const bits of cases) {
    const pcm = Bit.renderBitVoice({ bits, f0, rate, duration: 1.5, tau: 3, gain: .5 });
    const found = peaks(pcm, rate, f0);
    assert.equal(found.length, bits.filter(bit => bit === 1).length, `биты ${bits.join('')}`);
    assert.deepEqual(found, bits.map((bit, index) => (bit ? index + 1 : 0)).filter(Boolean));
    // между партиалами тишина: на частоте соседней гармоники энергии нет
    assert.ok(magnitude(pcm, rate, f0 * 7) < magnitude(pcm, rate, f0) * .2);
  }
});

test('bitFrameEvents: сетка, форма события и биты внутри', () => {
  const bits = [1, 0, 1, 1];
  const events = Bit.bitFrameEvents(frame(4, bits, 4, 1), { tempo: 120 });
  assert.equal(events.length, 1);
  const [event] = events;
  assert.equal(event.beat, 1);
  assert.equal(event.midi, Bit.numberToMidi(13));
  assert.equal(event.voice, 'bitsHarmonic');
  assert.deepEqual(event.bits, bits);
  assert.ok(event.duration > 0 && event.velocity > 0 && event.velocity <= 1);
  assert.deepEqual(Bit.bitFrameEvents(frame(1, bits, 4, 1)), []);
  assert.deepEqual(Bit.bitFrameEvents({ tick: 0, width: 4, height: 1, result: new Int8Array(3) }), []);
});

test('describeFrame даёт параметры для таблицы', () => {
  const info = Bit.describeFrame(frame(0, [1, 1, 0, 0, 0], 5, 1), { root: 24, rate: 44100 });
  assert.equal(info.n, 3);
  assert.equal(info.binary, '00011');
  assert.equal(info.partials, 2);
  assert.ok(info.f0 > 20 && info.f0 <= 2000);
  assert.equal(info.voice, 'bitsHarmonic');
});

test('голоса битов работают через renderWav и exportMidi существующего движка', () => {
  const events = [];
  for (let tick = 0; tick < 32; tick++) {
    events.push(...Bit.bitFrameEvents(frame(tick, [1, 0, 1, 1], 4, 1), { tempo: 120 }));
  }
  assert.ok(events.length >= 8);

  const format = { durationSeconds: 2, sampleRate: 22050 };
  const bytes = Music.renderWav(events, { tempo: 120, volume: .8 }, format);
  assert.deepEqual(bytes, Music.renderWav(events, { tempo: 120, volume: .8 }, format));
  const view = new DataView(bytes.buffer);
  assert.equal(Buffer.from(bytes.subarray(0, 4)).toString(), 'RIFF');
  assert.equal(view.getUint32(24, true), 22050);
  assert.ok(bytes.slice(44).some(value => value !== 0));
  for (let offset = 44; offset < bytes.length; offset += 2) {
    assert.ok(Math.abs(view.getInt16(offset, true)) < 32767);
  }

  const midi = Music.exportMidi(events, { tempo: 120 });
  assert.equal(Buffer.from(midi.subarray(0, 4)).toString(), 'MThd');
  assert.equal(Buffer.from(midi.subarray(14, 18)).toString(), 'MTrk');
});

test('регистрация не трогает прежние голоса', () => {
  assert.equal(typeof Music.registerVoice, 'function');
  const ok = Bit.registerVoices(Music);
  assert.equal(ok, true);
  assert.equal(Music.registerVoice('', {}), false);
  assert.equal(Music.registerVoice('x', null), false);

  const base = { voice: 'bass', midi: 40, duration: .5, velocity: .6, beat: 0, pan: 0 };
  const bytes = Music.renderWav([base], { tempo: 120, volume: .7 }, { durationSeconds: 1, sampleRate: 22050 });
  assert.ok(bytes.slice(44).some(value => value !== 0));
});
