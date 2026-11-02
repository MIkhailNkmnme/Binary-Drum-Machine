/* Хорром. The visible field is captured by the host, independently of its animation. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MayatnikXorrom = api;
})(globalThis, function (root) {
  'use strict';

  const DEFAULTS = Object.freeze({
    source: 'rgb', bpm: 96, division: 8, tonic: 0, scale: 'major', octave: 4,
    timbre: 'triangle', gain: 0.25, chord: 3, first: 0, last: -1, stride: 1,
    loop: true, live: false
  });
  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10],
    pentatonic: [0, 2, 4, 7, 9]
  };
  const DRUMS = ['kick', 'snare', 'hat'];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function normalizeSettings(input) {
    const raw = input || {};
    const pick = (key, values) => values.includes(raw[key]) ? raw[key] : DEFAULTS[key];
    function number(key, lo, hi, integer = true) {
      const value = raw[key];
      if ((typeof value !== 'number' && typeof value !== 'string') || value === '' || !Number.isFinite(+value)) return DEFAULTS[key];
      return clamp(integer ? Math.round(+value) : +value, lo, hi);
    }
    const flag = key => typeof raw[key] === 'boolean' ? raw[key] : DEFAULTS[key];
    return {
      source: pick('source', ['melody', 'rgb', 'rhythm']), bpm: number('bpm', 60, 180),
      division: [4, 8, 16].includes(+raw.division) ? +raw.division : DEFAULTS.division,
      tonic: number('tonic', 0, 11), scale: pick('scale', Object.keys(SCALES)), octave: number('octave', 1, 7),
      timbre: pick('timbre', ['sine', 'triangle', 'pluck', 'softsquare']), gain: number('gain', 0, 1, false),
      chord: number('chord', 1, 4), first: number('first', 0, 2147483647), last: number('last', -1, 2147483647),
      stride: number('stride', 1, 65536), loop: flag('loop'), live: flag('live')
    };
  }

  function frequency(midi) { return 440 * 2 ** ((midi - 69) / 12); }
  function notesForRow(row, index, settings) {
    if (!row) return [];
    const s = normalizeSettings(settings), scale = SCALES[s.scale];
    function pitch(degree, code) {
      const midi = 12 * (s.octave + 1 + Math.floor(degree / scale.length)) + s.tonic + scale[degree % scale.length];
      return { midi, frequency: frequency(midi), degree: degree + 1, code, velocity: 0.75 };
    }
    if (s.source === 'rgb') {
      const codes = [1, 2, 3, 4, 5, 6, 7].filter(code => row.colors && row.colors[code] > 0);
      return codes.sort((a, b) => row.colors[b] - row.colors[a] || a - b)
        .slice(0, s.chord).map(code => pitch(code - 1, code));
    }
    const ones = Math.max(0, Math.floor(+row.ones || 0));
    if (!ones) return [];
    if (s.source === 'melody') return [pitch(ones % 7, null)];

    // Columns repeat three percussion lanes. A lane with any set bit sounds once.
    const lanes = [false, false, false];
    if (row.bits && row.bits.length) {
      for (let x = 0; x < row.bits.length; x++) if (+row.bits[x] === 1) lanes[x % 3] = true;
    } else {
      lanes[(Math.max(0, Math.floor(index || 0)) + ones - 1) % 3] = true;
    }
    return lanes.flatMap((active, lane) => {
      if (!active) return [];
      const midi = [36, 50, 90][lane];
      return [{ midi, frequency: frequency(midi), degree: 0, code: null, drum: DRUMS[lane], velocity: 0.75 }];
    });
  }

  function stepSeconds(s) { return 60 / s.bpm * 4 / s.division; }
  function bounds(snapshot, s) {
    const end = (snapshot && snapshot.rows ? snapshot.rows.length : 0) - 1;
    const first = Math.min(s.first, end);
    return { first, last: s.last < 0 ? end : clamp(s.last, first, end) };
  }

  // A single PCM synthesizer serves playback and WAV. Every voice starts and
  // finishes at zero. Harmonics above Nyquist are omitted at synthesis time.
  const SAMPLE_RATE = 22050;
  const PARTIALS = {
    sine: [[1, 1]],
    triangle: [[1, 1], [3, -1/9], [5, 1/25], [7, -1/49]],
    pluck: [[1, 0.75], [2, 0.4], [3, 0.15], [4, 0.1]],
    softsquare: [[1, 1], [3, 0.28], [5, 0.12], [7, 0.05]],
    kick: [[1, 1]],
    snare: [[1, 0.5], [2.73, 0.45], [4.1, 0.32], [9.37, 0.28], [18.6, 0.2]],
    hat: [[1.79, 0.4], [2.53, 0.55], [3.17, 0.36], [4.43, 0.45]]
  };
  function cacheTone(build) {
    const cache = new Map();
    return (note, step, timbre, rate) => {
      const key = [note.drum || timbre, note.midi, step, rate].join('/');
      if (!cache.has(key)) {
        if (cache.size >= 48) cache.delete(cache.keys().next().value);
        cache.set(key, build(note, step, timbre, rate));
      }
      return cache.get(key);
    };
  }
  function synthesize(note, step, timbre, rate) {
    const kind = note.drum || timbre;
    const duration = Math.min(step * 0.86, ({kick: 0.22, snare: 0.14, hat: 0.065})[kind] || 2);
    const samples = new Float32Array(Math.max(2, Math.round(duration * rate)));
    const startHz = note.frequency * (kind === 'kick' ? 2.4 : 1);
    const endHz = note.frequency * (kind === 'kick' || kind === 'snare' ? 0.65 : 1);
    const partials = PARTIALS[kind].filter(([harmonic]) => harmonic * startHz < rate / 2);
    const amplitude = partials.reduce((sum, [,weight]) => sum + Math.abs(weight), 0) || 1;
    const pitchChange = (endHz / startHz) ** (1 / samples.length);
    let phase = 0, increment = 2 * Math.PI * startHz / rate;
    const attack = Math.max(1, Math.round(Math.min(duration * 0.12, 0.008) * rate));
    const decay = note.drum || kind === 'pluck' ? 5 : 1.5;
    for (let i = 0; i < samples.length - 1; i++) {
      const progress = i / (samples.length - 1);
      const level = Math.min(1, i / attack) * (1 - progress) ** decay;
      let value = 0;
      for (const [harmonic, weight] of partials) value += weight * Math.sin(phase * harmonic);
      samples[i] = value * level * 0.7 * note.velocity / amplitude;
      phase += increment;
      increment *= pitchChange;
    }
    return samples;
  }
  function renderWav(snapshot, settings, options = {}) {
    const s = normalizeSettings(settings), range = bounds(snapshot, s);
    if (range.first < 0) throw new Error('В снимке нет строк для WAV.');
    const sampleRate = options.sampleRate === 44100 ? 44100 : SAMPLE_RATE;
    const maxSeconds = Number.isFinite(options.maxSeconds) ? clamp(options.maxSeconds, 1/sampleRate, 60) : 60;
    const step = stepSeconds(s);
    const rowCount = Math.floor((range.last - range.first) / s.stride) + 1;
    const fullLength = Math.round(rowCount * step * sampleRate);
    const length = Math.min(fullLength, Math.max(1, Math.round(maxSeconds * sampleRate)));
    const truncated = length < fullLength;
    const bytes = new Uint8Array(44 + 2 * length), view = new DataView(bytes.buffer);
    function tag(offset, text) { for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i); }
    tag(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); tag(8, 'WAVE');
    tag(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true);
    view.setUint16(34, 16, true); tag(36, 'data'); view.setUint32(40, length * 2, true);
    const toneFor = cacheTone(synthesize);
    let steps = 0;
    for (let index = range.first; index <= range.last; index += s.stride) {
      const offset = Math.round(steps * step * sampleRate);
      if (offset >= length) break;
      steps++;
      const notes = notesForRow(snapshot.rows[index], index, s);
      const tones = notes.map(note => toneFor(note, step, s.timbre, sampleRate));
      const frames = Math.min(length - offset, Math.max(0, ...tones.map(tone => tone.length)));
      for (let i = 0; i < frames; i++) {
        let sample = 0;
        for (const tone of tones) sample += tone[i] || 0;
        const fade = truncated ? Math.min(1, (length - 1 - offset - i) / (sampleRate * 0.008)) : 1;
        view.setInt16(44 + 2 * (offset + i), Math.round(sample * s.gain * fade * 32767 / tones.length), true);
      }
    }
    return {bytes, duration: length / sampleRate, steps, truncated, sampleRate};
  }

  function create(options = {}) {
    const timer = options.setTimeout || root.setTimeout.bind(root);
    const clear = options.clearTimeout || root.clearTimeout.bind(root);
    const doc = options.document || root.document;
    let settings = normalizeSettings(options.settings), state = 'stopped', sequence = 0, pendingStart = false;
    let ctx, master, streamNode, bus, snapshot, wake, nextTime, cursor = 0, disposed = false;
    let queued = [], refreshing = false;
    const voices = new Map();
    const audioBuffer = cacheTone((note, step, timbre, rate) => {
      const samples = synthesize(note, step, timbre, rate);
      const buffer = ctx.createBuffer(1, samples.length, rate);
      buffer.getChannelData(0).set(samples);
      return buffer;
    });
    function changeState(next) {
      if (next === state) return;
      state = next;
      if (options.onState) options.onState(next);
    }
    function setSettings(patch) {
      settings = normalizeSettings({...settings, ...patch});
      if (master) master.gain.setTargetAtTime(settings.gain, ctx.currentTime, 0.01);
      return {...settings};
    }
    function halt(next) {
      ++sequence;
      pendingStart = false;
      clear(wake);
      if (next === 'paused' && queued.length) {
        const upcoming = queued.find(event => event.time > ctx.currentTime);
        if (upcoming) { cursor = upcoming.index; snapshot = upcoming.snapshot; }
      }
      queued = [];
      refreshing = false;
      if (bus) {
        const oldBus = bus, active = [...voices];
        const now = ctx.currentTime;
        oldBus.gain.setValueAtTime(1, now);
        oldBus.gain.linearRampToValueAtTime(0, now + 0.008);
        let remaining = active.length;
        if (!remaining) oldBus.disconnect();
        for (const [source, startTime] of active) {
          const ended = source.onended;
          source.onended = () => { ended(); if (--remaining === 0) oldBus.disconnect(); };
          source.stop(startTime > now ? now : now + 0.009);
        }
        voices.clear();
        bus = null;
      }
      if (next === 'stopped') { snapshot = null; cursor = 0; }
      changeState(next);
    }
    function stop() { halt('stopped'); }
    function pause() {
      if (state === 'playing') halt('paused');
      else if (pendingStart) halt(state);
    }
    function contextStateChanged() {
      if (ctx.state !== 'running' && state === 'playing') pause();
    }
    function visibilityChanged() { if (doc && doc.hidden) pause(); }
    if (doc) doc.addEventListener('visibilitychange', visibilityChanged);

    function reportError(error) {
      stop();
      if (options.onError) options.onError(error);
    }
    function tick(run) {
      if (sequence !== run || state !== 'playing') return;
      try {
        if (ctx.state !== 'running' || (doc && doc.hidden)) { pause(); return; }
        const now = ctx.currentTime;
        // A stalled UI can miss a wakeup. Publish only the most recent due step.
        let due;
        while (queued.length && queued[0].time <= now) due = queued.shift();
        if (due && now - due.time < 0.10 && options.onStep) {
          options.onStep({index: due.index, row: due.row, notes: due.notes, time: due.time});
        }
        if (sequence !== run) return;
        if (nextTime < now) nextTime = now;
        const horizon = now + 0.10;
        while (nextTime < horizon) {
          const range = bounds(snapshot, settings);
          if (cursor > range.last) {
            if (!settings.loop) {
              if (nextTime <= now) { stop(); return; }
              break;
            }
            if (settings.live) {
              if (!refreshing) {
                refreshing = true;
                Promise.resolve(options.getSnapshot()).then(fresh => {
                  if (sequence !== run) return;
                  snapshot = fresh;
                  cursor = bounds(snapshot, settings).first;
                  refreshing = false;
                }).catch(error => { if (sequence === run) reportError(error); });
              }
              break;
            }
            cursor = range.first;
          }
          if (range.first < 0) { stop(); return; }
          cursor = Math.max(range.first, cursor);
          const row = snapshot.rows[cursor], step = stepSeconds(settings);
          const notes = notesForRow(row, cursor, settings);
          for (const note of notes) {
            const source = ctx.createBufferSource(), gain = ctx.createGain();
            source.buffer = audioBuffer(note, step, settings.timbre, SAMPLE_RATE);
            gain.gain.value = 1 / notes.length;
            source.connect(gain);
            gain.connect(bus);
            voices.set(source, nextTime);
            source.onended = () => { voices.delete(source); source.disconnect(); gain.disconnect(); };
            source.start(nextTime);
          }
          queued.push({index: cursor, row, notes, time: nextTime, snapshot});
          cursor += settings.stride;
          nextTime += step;
        }
        const nextWake = queued.length ? Math.min(0.025, queued[0].time - ctx.currentTime) : 0.025;
        wake = timer(() => tick(run), Math.max(1, Math.ceil(nextWake * 1000)));
      } catch (error) { reportError(error); }
    }

    async function start(patch) {
      if (disposed) return false;
      if (patch) setSettings(patch);
      if (state === 'playing') return true;
      if (doc && doc.hidden) return false;
      const run = ++sequence;
      pendingStart = true;
      try {
        if (!ctx) {
          const Context = options.AudioContext || root.AudioContext || root.webkitAudioContext;
          if (!Context) throw new Error('Web Audio недоступно в этом браузере.');
          ctx = new Context();
          master = ctx.createGain();
          master.gain.value = settings.gain;
          master.connect(ctx.destination);
          ctx.addEventListener('statechange', contextStateChanged);
        }
        if (ctx.state !== 'running') await ctx.resume();
        if (sequence !== run) return false;
        if (ctx.state !== 'running' || (doc && doc.hidden)) { pendingStart = false; return false; }
        if (state !== 'paused') {
          const fresh = await options.getSnapshot();
          if (sequence !== run) return false;
          snapshot = fresh;
          cursor = bounds(snapshot, settings).first;
        }
        pendingStart = false;
        if (ctx.state !== 'running' || (doc && doc.hidden)) return false;
        if (bounds(snapshot, settings).first < 0) { stop(); return false; }
        bus = ctx.createGain();
        bus.connect(master);
        nextTime = ctx.currentTime + 0.035;
        changeState('playing');
        tick(run);
        return state === 'playing';
      } catch (error) {
        if (sequence !== run) return false;
        stop();
        throw error;
      }
    }
    function getStream() {
      if (!master || !ctx.createMediaStreamDestination || disposed) return null;
      if (!streamNode) { streamNode = ctx.createMediaStreamDestination(); master.connect(streamNode); }
      return streamNode.stream;
    }
    function dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      if (doc) doc.removeEventListener('visibilitychange', visibilityChanged);
      if (streamNode) for (const track of streamNode.stream.getTracks()) track.stop();
      if (ctx) {
        ctx.removeEventListener('statechange', contextStateChanged);
        return ctx.close();
      }
    }
    return { start, pause, stop, setSettings, getState: () => state, getStream, dispose };
  }

  return { DEFAULTS, normalizeSettings, frequency, notesForRow, renderWav, create };
});
