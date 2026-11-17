/* Берлинский цикл · собственный эскиз, 32 такта / 96 BPM.
 * Два сочинённых ряда (8 и 7 нот), а не транскрипция записи-ориентира.
 * UMD: один исходник сцены, событий и PCM для браузера и сборки файлов.
 * Только сериализуемые поля f0/tau/tilt: их сохраняют WAV и кэш Music.
 */
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(
    () => node ? require('./mayatnik-synthesis-pendulums.js') : root.MayatnikSynthesisPendulums,
    () => node ? require('./mayatnik-synthesis-music.js') : root.MayatnikSynthesisMusic
  );
  if (node) module.exports = api;
  else root.MayatnikSynthesisBerlin = api;
})(typeof globalThis === 'object' ? globalThis : this, function (pendulums, music) {
  'use strict';
  const TAU = 2 * Math.PI;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const source = Object.freeze({ width: 129, height: 64, anchor: 64 });
  const pendulumOptions = Object.freeze({ sourceA: 'pend', sourceB: 'pendR', depth: 64,
    rateA: 1, rateB: 1, phaseB: 11, delayB: 0, transformB: 'identity', shiftX: 0,
    shiftY: 0, invertB: false, operation: 'xor', history: 'trail', trailLength: 6 });
  const musicOptions = Object.freeze({ style: 'berlin', tempo: 96, volume: .45, root: 48, scale: 'minor', density: 3 });
  const example = Object.freeze({ id: 'berlin-cycle', label: 'Берлинский цикл',
    settings: 'Два маятника · ряды 8 / 7 · 96 BPM · 32 такта',
    prefs: Object.freeze({ mode: 'pendulums', studioSection: 'music', musicStyle: 'berlin',
      tempo: 96, volume: .45, musicRoot: 48, musicScale: 'minor', density: 3,
      bitVoice: 'off', musicBars: 32, pendulumOptions, palette: 'nocturne', artStyle: 'bits' }) });
  const sequenceA = Object.freeze([0, 4, 7, 4, 2, 4, 6, 4]);
  const sequenceB = Object.freeze([7, 9, 7, 4, 6, 4, 2]);
  const scales = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], pentatonic: [0, 3, 5, 7, 10] };
  let registered = null;

  function createScene() {
    const sourceBits = new Int8Array(source.width * source.height).fill(-1);
    sourceBits[source.anchor] = 1;
    return { ...source, sourceBits, duet: pendulums().create({ ...source, sourceBits, options: pendulumOptions }) };
  }
  function toFrame(duet) {
    return { a: duet.a, b: duet.b, result: duet.output, output: duet.output,
      age: duet.age, changed: duet.changed, options: duet.options,
      width: duet.width, height: duet.height, anchor: duet.anchor, tick: duet.tick };
  }
  function fieldState(frame) {
    const bands = [0, 0, 0, 0], sizes = [0, 0, 0, 0];
    let ones = 0, occupied = 0, overlap = 0;
    for (let i = 0; i < frame.result.length; i++) {
      const bit = frame.result[i];
      if (bit !== 0 && bit !== 1) continue;
      const band = Math.min(3, Math.floor((i % frame.width) * 4 / frame.width));
      occupied++; sizes[band]++;
      if (bit === 1) { ones++; bands[band]++; }
      if (frame.a?.[i] === 1 && frame.b?.[i] === 1) overlap++;
    }
    return { density: ones / Math.max(1, occupied), overlap: overlap / Math.max(1, occupied),
      bands: bands.map((n, i) => n / Math.max(1, sizes[i])) };
  }

  // Band-limited additive waves; no raw saw discontinuities or random state.
  // Every buffer ends within duration + .08 s (Music reserves + .09 s).
  function renderVoice({ midi, duration, rate, voice, event }) {
    const pad = voice === 'berlinPad', bass = voice === 'berlinBass';
    const length = duration + .08, pcm = new Float32Array(Math.ceil(length * rate));
    const frequency = event?.f0 || 440 * 2 ** ((midi - 69) / 12);
    const colour = event?.tilt ?? .4, offset = event?.tau ?? 0;
    const attack = pad ? Math.min(.38, duration * .2) : bass ? .024 : .012;
    const release = pad ? Math.min(.8, length * .3) : .12;
    const gain = pad ? .115 : bass ? .29 : .19;
    const harmonic = n => frequency * n * 1.005 < rate / 2 ? 1 : 0;
    const h2 = harmonic(2), h3 = harmonic(3), h5 = harmonic(5);
    let phase = offset, noise = (Math.imul(midi + 1, 171313) + Math.round(offset * 1000)) >>> 0, low = 0;
    for (let i = 0; i < pcm.length; i++) {
      const t = i / rate;
      // Small continuous pitch drift, deterministic for the stored event.
      phase += TAU * frequency / rate * (1 + .0008 * Math.sin(TAU * .31 * t + offset));
      const cutoff = colour * (pad ? .75 + .15 * Math.sin(TAU * .19 * t + offset) : .3 + .7 * Math.exp(-t * 5));
      let sample = .76 * Math.sin(phase) + h2 * .23 * cutoff * Math.sin(phase * 2)
        + h3 * .13 * cutoff * cutoff * Math.sin(phase * 3) + h5 * .055 * cutoff * Math.sin(phase * 5);
      if (pad) {
        sample = .65 * sample + .23 * Math.sin(phase * 1.0014 + .3) + .12 * Math.sin(phase * .9988 - .3);
        noise = (Math.imul(1664525, noise) + 1013904223) >>> 0;
        const white = noise / 2147483648 - 1;
        low += .08 * (white - low);
        sample += .014 * (white - low); // Quiet synthetic tape-like hiss, no sampled recording.
      }
      const envelope = Math.min(1, t / attack) * Math.min(1, Math.max(0, (length - t) / release));
      const decay = pad || bass ? 1 : .28 + .72 * Math.exp(-t * 4);
      pcm[i] = sample * gain * envelope * decay;
    }
    return pcm;
  }
  function registerVoices() {
    const api = music();
    if (!api) throw new Error('Модуль музыки ещё не загружен.');
    if (registered === api) return;
    for (const [name, channel, program] of [['berlinA', 4, 80], ['berlinB', 5, 81], ['berlinBass', 6, 38], ['berlinPad', 7, 89]]) {
      api.registerVoice(name, { channel, program, gain: 1, render: renderVoice });
    }
    registered = api;
  }
  function frameEvents(frame, options = musicOptions) {
    if (!Number.isSafeInteger(frame?.tick) || frame.tick < 0 || !Number.isInteger(frame.width)
      || frame.width < 1 || !Number.isInteger(frame.height) || frame.height < 1
      || frame.result?.length !== frame.width * frame.height) return [];
    registerVoices();
    const settings = music().normalizeOptions(options), scale = scales[settings.scale];
    const tick = frame.tick, cycle = tick % 512, bar = Math.floor(cycle / 16);
    const field = fieldState(frame), events = [], root = settings.root;
    const degreeNote = (degree, octave = 0) => root + octave * 12
      + Math.floor(degree / scale.length) * 12 + scale[((degree % scale.length) + scale.length) % scale.length];
    // Four slow eight-bar regions. The second line enters in bar 5, rests
    // during bars 17–20, returns in 21 and thins out over the last four bars.
    const chord = [0, 5, 3, 0][Math.floor(bar / 8)];
    const arrival = Math.min(1, .45 + cycle / 96), ending = cycle < 448 ? 1 : 1 - .68 * (cycle - 448) / 64;
    const brightness = Math.round(clamp(.18 + .35 * field.density + .2 * Math.sin(Math.PI * cycle / 512), .1, .9) * 8) / 8;
    const pan = clamp((field.bands[2] + field.bands[3] - field.bands[0] - field.bands[1]) * .5, -.35, .35);
    function add(voice, degree, octave, duration, velocity, position, salt) {
      const midi = degreeNote(degree, octave);
      const cents = Math.round(3 * Math.sin(tick * .037 + salt));
      const f0 = Math.round(440 * 2 ** ((midi - 69 + cents / 100) / 12) * 1000) / 1000;
      const tau = Math.round(((tick * .019 + salt) % TAU) * 4) / 4;
      events.push({ beat: tick / 4, duration, midi, voice,
        velocity: clamp(velocity * arrival * ending, 0, 1), pan: clamp(position, -.8, .8),
        f0, tau, tilt: brightness });
    }
    const pulse = Math.floor(tick / 2);
    if (tick % 2 === 0 && (settings.density > 1 || tick % 4 === 0)) {
      const index = pulse % sequenceA.length;
      // The last note of each eight-note turn chooses its neighbour from
      // the left quarter's actual density. All other A notes retain the motif.
      const change = index === 7 && field.bands[0] > .5 ? 1 : 0;
      add('berlinA', chord + sequenceA[index] + change, 0, .65, .65, -.3 + pan, 0);
    }
    if (tick % 2 === 1 && bar >= 4 && !(bar >= 16 && bar < 20) && settings.density >= 2
      && (bar < 28 || tick % 4 === 1)) {
      const index = pulse % sequenceB.length;
      const change = index === 6 && field.bands[3] > .5 ? -1 : 0;
      add('berlinB', chord + sequenceB[index] + change, 0, .82, .42 + .12 * field.overlap, .3 + pan, 2);
    }
    if (tick % 8 === 0) add('berlinBass', chord, -1, 1.7, .64, pan * .25, 4);
    if (tick % 16 === 0) {
      add('berlinPad', chord, 0, 7.5, .58, -.42 + pan * .25, 1);
      if (settings.density >= 3) add('berlinPad', chord + 4, 0, 7.5, .46, .42 + pan * .25, 3);
    }
    return events;
  }
  return Object.freeze({ source, pendulumOptions, musicOptions, example, sequenceA, sequenceB,
    createScene, toFrame, frameEvents, registerVoices });
});
