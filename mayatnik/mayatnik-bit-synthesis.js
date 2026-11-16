/* Зеркалиус · Синтез звука через биты (МАЯ-683).
 *
 * Битовая строка превращается в число, число — в высоту, биты — в партиалы.
 * Отличие от mayatnik-synthesis-music.js: там биты выбирают, когда и какой голос
 * играет, а формулы голосов постоянны. Здесь наоборот — биты задают саму форму
 * волны: x(t) = Σ a_k sin(2π k f₀ t) · e^(−t/τ), где a_k включается битом.
 *
 * Договорённость о порядке битов: индекс 0 — МЛАДШИЙ бит (n = Σ bⱼ2ʲ).
 * Менять её нельзя: от неё зависят высоты, тесты и совместимость с сохранёнными кадрами.
 *
 * Голоса регистрируются в mayatnik-synthesis-music.js через registerVoice, поэтому
 * renderWav / exportMidi / createPlayer работают с ними без изменений.
 */
(function (root, factory) {
  const bit = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = bit;
  else root.MayatnikBitSynthesis = bit;
})(typeof globalThis === 'object' ? globalThis : this, function (root) {
  'use strict';

  const SCALES = {
    minor: [0, 2, 3, 5, 7, 8, 10],
    major: [0, 2, 4, 5, 7, 9, 11],
    pentatonic: [0, 3, 5, 7, 10]
  };
  const LIMITS = {
    partials: 32,      // столько партиал максимум: 32 бита = 32 синуса
    bits: 32,          // длина битовой строки, больше не читаем
    minF0: 20,
    maxF0: 2000,
    minTau: .004,
    maxTau: 2,
    nyquist: .45       // партиал выше 0,45·rate отбрасывается
  };
  const TAU = 2 * Math.PI;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const number = (value, fallback, min, max) => {
    const parsed = Number(value);
    return value == null || !Number.isFinite(parsed) ? fallback : clamp(parsed, min, max);
  };

  /** биты → число: индекс 0 — младший бит. Битые входные данные → null. */
  function bitsToNumber(bits) {
    if (!Array.isArray(bits) && !(bits && typeof bits.length === 'number')) return null;
    if (!bits.length || bits.length > LIMITS.bits) return null;
    let value = 0;
    for (let index = 0; index < bits.length; index++) {
      const bit = bits[index];
      if (bit !== 0 && bit !== 1 && bit !== true && bit !== false) return null;
      if (bit) value += 2 ** index;
    }
    return Number.isSafeInteger(value) ? value : null;
  }

  /** число → двоичная запись для таблицы параметров, старший бит слева. */
  function binaryOf(n, width = 0) {
    if (!Number.isSafeInteger(n) || n < 0) return '';
    const text = n.toString(2);
    return width > text.length ? text.padStart(width, '0') : text;
  }

  /**
   * число → MIDI.
   * chromatic (по умолчанию): ступень = полутон, 0…63 дают 64 различные высоты.
   * scale: ступень идёт по ладу и переносится октавами; при больших n возможны
   * повторы, потому что MIDI ограничен 0…127 — это осознанно, а не ошибка.
   */
  function numberToMidi(n, options = {}) {
    if (!Number.isSafeInteger(n) || n < 0) return null;
    const rootNote = Math.round(number(options.root, 24, 0, 127));
    const scale = SCALES[options.scale];
    if (!scale) return clamp(rootNote + n, 0, 127);
    const size = scale.length;
    let midi = rootNote + Math.floor(n / size) * 12 + scale[n % size];
    while (midi > 127) midi -= 12;
    while (midi < 0) midi += 12;
    return midi;
  }

  /** MIDI → герцы (A4 = 440). */
  const midiToHz = midi => 440 * 2 ** ((midi - 69) / 12);

  /** кадр → биты: строка (row), столбец (column) или весь result. */
  function rowToBits(frame, options = {}) {
    if (!frame || !frame.result) return [];
    const width = Math.floor(frame.width), height = Math.floor(frame.height);
    if (!(width > 0) || !(height > 0) || frame.result.length !== width * height) return [];
    if (options.mode === 'all') return Array.from(frame.result, bit => (bit === 1 ? 1 : 0));
    if (options.mode === 'column') {
      const x = Math.floor(number(options.column, 0, 0, width - 1));
      const bits = [];
      for (let y = 0; y < height; y++) bits.push(frame.result[y * width + x] === 1 ? 1 : 0);
      return bits;
    }
    const y = Math.floor(number(options.row, 0, 0, height - 1));
    const bits = [];
    for (let x = 0; x < width && bits.length < LIMITS.bits; x++) bits.push(frame.result[y * width + x] === 1 ? 1 : 0);
    return bits;
  }

  /** включённые биты → партиалы: k-й партиал включается k-м битом, вес падает наклоном. */
  function bitsToPartials(bits, options = {}) {
    if (!bits || !bits.length) return [];
    const tilt = number(options.tilt, .82, .1, 1);
    const partials = [];
    for (let index = 0; index < bits.length && partials.length < LIMITS.partials; index++) {
      if (bits[index] === 1 || bits[index] === true) {
        partials.push({ harmonic: index + 1, amplitude: tilt ** index });
      }
    }
    return partials;
  }

  /** какие партиалы реально попадут в звук при данной f₀ и частоте дискретизации. */
  function audiblePartials(partials, f0, rate) {
    const limit = LIMITS.nyquist * rate;
    return (partials || []).filter(partial => partial.harmonic * f0 < limit);
  }

  /**
   * Один голос: сумма синусов по включённым партиалам.
   * Возвращает Float32Array; пустая строка битов и отсутствие слышимых партиал → тишина нулевой длины.
   */
  function renderBitVoice(input = {}) {
    const rate = Math.round(number(input.rate, 44100, 8000, 48000));
    const bits = input.bits;
    const partials = bitsToPartials(bits, input);
    const midi = Number.isFinite(input.midi) ? input.midi : 24;
    const f0 = clamp(number(input.f0, midiToHz(midi), LIMITS.minF0, LIMITS.maxF0), LIMITS.minF0, LIMITS.maxF0);
    const decay = number(input.tau, .18, LIMITS.minTau, LIMITS.maxTau);
    const gain = number(input.gain, .5, 0, 1);
    const duration = number(input.duration, decay + .08, .002, 8);
    const audible = audiblePartials(partials, f0, rate);
    const length = Math.ceil(Math.min(duration, 8) * rate);
    const pcm = new Float32Array(length);
    if (!audible.length || !(length > 0) || gain <= 0) return pcm;

    const total = audible.reduce((sum, partial) => sum + partial.amplitude, 0) || 1;
    const normalizer = gain / total;
    const attack = Math.min(.004, duration / 4);
    const attackSamples = Math.max(1, Math.round(attack * rate));
    for (let sample = 0; sample < length; sample++) {
      const time = sample / rate;
      const envelope = Math.exp(-time / decay);
      const fade = Math.min(1, (length - 1 - sample) / Math.max(1, rate * .008));
      let signal = 0;
      for (const partial of audible) {
        signal += partial.amplitude * Math.sin(TAU * partial.harmonic * f0 * time);
      }
      const start = sample < attackSamples ? sample / attackSamples : 1;
      pcm[sample] = signal * normalizer * envelope * fade * start;
    }
    return pcm;
  }

  /** Что показать в таблице параметров: число, двоичная запись, частота, огибающая, партиалы. */
  function describeFrame(frame, options = {}) {
    const bits = rowToBits(frame, options);
    const n = bitsToNumber(bits);
    if (n === null) return null;
    const midi = numberToMidi(n, options);
    const f0 = clamp(number(options.f0, midiToHz(midi), LIMITS.minF0, LIMITS.maxF0), LIMITS.minF0, LIMITS.maxF0);
    const partials = audiblePartials(bitsToPartials(bits, options), f0, number(options.rate, 44100, 8000, 48000));
    return {
      bits,
      n,
      binary: binaryOf(n, bits.length),
      midi,
      f0: Number(f0.toFixed(2)),
      tau: Number(number(options.tau, .18, LIMITS.minTau, LIMITS.maxTau).toFixed(4)),
      partials: partials.length,
      gain: Number(number(options.gain, .5, 0, 1).toFixed(2)),
      voice: options.voice || 'bitsHarmonic'
    };
  }

  /**
   * Кадр → музыкальные события в форме mayatnik-synthesis-music.js.
   * Ритм — ровная сетка 16 шагов; на каждой четверти звучит строка битов,
   * её номер сдвигается от шага к шагу, поэтому мелодия читается как счёт.
   */
  function bitFrameEvents(frame, options = {}) {
    if (!frame || !Number.isSafeInteger(frame.tick) || frame.tick < 0) return [];
    const width = Math.floor(frame.width), height = Math.floor(frame.height);
    if (!(width > 0) || !(height > 0) || !frame.result || frame.result.length !== width * height) return [];
    const step = frame.tick % 16;
    if (step % 4 !== 0) return [];

    const active = rowToBits(frame, {
      mode: options.mode,
      row: Math.floor(frame.tick / 4) % height,
      column: options.column
    });
    const n = bitsToNumber(active);
    if (n === null) return [];

    const ones = active.reduce((sum, bit) => sum + bit, 0);
    const density = active.length ? ones / active.length : 0;
    const midi = numberToMidi(n, options);
    const secondsPerBeat = 60 / Math.round(number(options.tempo, 120, 60, 180));
    return [{
      beat: frame.tick / 4,
      duration: Math.max(.12, Math.min(1.2, .45 + .3 * density)),
      midi,
      velocity: clamp(.42 + .5 * density, .05, 1),
      voice: options.voice || 'bitsHarmonic',
      pan: clamp((density - .5) * .6, -.3, .3),
      bits: Array.from(active),
      f0: clamp(number(options.f0, midiToHz(midi), LIMITS.minF0, LIMITS.maxF0), LIMITS.minF0, LIMITS.maxF0),
      tau: number(options.tau, secondsPerBeat * .5, LIMITS.minTau, LIMITS.maxTau)
    }];
  }

  const VOICE_SPECS = {
    bitsHarmonic: { channel: 5, program: 81, gain: .42, tau: .16, tilt: .82 },
    bitsShepard: { channel: 6, program: 91, gain: .38, tau: .9, tilt: .93 },
    bitsClick: { channel: 7, program: 119, gain: .3, tau: .035, tilt: .6 }
  };

  /** Регистрация трёх голосов в движке музыки, если он уже загружен. */
  function registerVoices(music) {
    const target = music || root.MayatnikSynthesisMusic;
    if (!target || typeof target.registerVoice !== 'function') return false;
    for (const [name, spec] of Object.entries(VOICE_SPECS)) {
      target.registerVoice(name, {
        channel: spec.channel,
        program: spec.program,
        gain: spec.gain,
        render: ({ midi, duration, rate, event }) => renderBitVoice({
          bits: event?.bits,
          midi,
          duration,
          rate,
          tau: event?.tau ?? spec.tau,
          tilt: event?.tilt ?? spec.tilt,
          gain: spec.gain,
          f0: event?.f0
        })
      });
    }
    return true;
  }

  if (typeof module === 'object' && module.exports) {
    try { registerVoices(require('./mayatnik-synthesis-music.js')); } catch (_) { /* движок не обязателен */ }
  } else if (root.MayatnikSynthesisMusic) {
    registerVoices(root.MayatnikSynthesisMusic);
  }

  return {
    LIMITS,
    SCALES,
    bitsToNumber,
    binaryOf,
    numberToMidi,
    midiToHz,
    rowToBits,
    bitsToPartials,
    audiblePartials,
    renderBitVoice,
    describeFrame,
    bitFrameEvents,
    registerVoices
  };
});
