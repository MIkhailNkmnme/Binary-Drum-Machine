(function (root, factory) {
  const music = factory();
  if (typeof module === 'object' && module.exports) module.exports = music;
  else root.MayatnikSynthesisMusic = music;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const SCALES = {
    minor: [0, 2, 3, 5, 7, 8, 10],
    major: [0, 2, 4, 5, 7, 9, 11],
    pentatonic: [0, 3, 5, 7, 10]
  };
  const VOICES = {
    kick: { channel: 9, gain: .81 },
    snare: { channel: 9, gain: .42 },
    hat: { channel: 9, gain: .23 },
    bass: { channel: 0, program: 38, gain: .46 },
    lead: { channel: 1, program: 81, gain: .25 },
    piano: { channel: 2, program: 0, gain: .35 },
    strings: { channel: 3, program: 48, gain: .13 }
  };
  const MAX_SECONDS = 180;
  const TAU = 2 * Math.PI;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const positiveMod = (value, size) => ((value % size) + size) % size;
  const number = (value, fallback, min, max) => {
    const parsed = Number(value);
    return value == null || !Number.isFinite(parsed) ? fallback : clamp(parsed, min, max);
  };

  function normalizeOptions(input = {}) {
    return {
      style: input.style === 'classic' ? 'classic' : 'techno',
      tempo: Math.round(number(input.tempo, 120, 60, 180)),
      volume: number(input.volume, .55, 0, 1),
      root: Math.round(number(input.root, 48, 48, 72)),
      scale: Object.hasOwn(SCALES, input.scale) ? input.scale : 'minor',
      density: Math.round(number(input.density, 3, 1, 4))
    };
  }

  function readFrame(frame) {
    const width = Math.floor(frame.width);
    const height = Math.floor(frame.height);
    const size = width * height;
    const bands = [0, 0, 0, 0];
    const bandSizes = [0, 0, 0, 0];
    let ones = 0;
    let overlap = 0;
    let pairs = 0;
    let changes = 0;
    let occupied = 0;
    const { a, b, result } = frame;
    for (let index = 0; index < size; index++) {
      const x = index % width;
      const band = Math.min(3, Math.floor(4 * x / width));
      const bit = result?.[index];
      if (bit === 0 || bit === 1) {
        occupied++;
        bandSizes[band]++;
        if (bit === 1) {
          ones++;
          bands[band]++;
        }
        if (x && (result[index - 1] === 0 || result[index - 1] === 1)) {
          pairs++;
          if (bit !== result[index - 1]) changes++;
        }
      }
      if (a?.[index] === 1 && b?.[index] === 1) overlap++;
    }
    return {
      bands: bands.map((value, band) => value / Math.max(1, bandSizes[band])),
      ones: ones / Math.max(1, occupied),
      overlap: overlap / size,
      transitions: changes / Math.max(1, pairs)
    };
  }

  function note(scale, root, degree) {
    return root + Math.floor(degree / scale.length) * 12 + scale[positiveMod(degree, scale.length)];
  }

  function frameEvents(frame, options) {
    if (!Number.isSafeInteger(frame?.tick) || frame.tick < 0
      || !Number.isInteger(frame.width) || frame.width < 1
      || !Number.isInteger(frame.height) || frame.height < 1
      || !frame.result || frame.result.length !== frame.width * frame.height) return [];

    const settings = normalizeOptions(options);
    const scale = SCALES[settings.scale];
    const { root, density } = settings;
    const field = readFrame(frame);
    const step = frame.tick % 16;
    const bar = Math.floor(frame.tick / 16) % 8;
    const section = Math.floor(frame.tick / 128) % 4;
    const harmony = settings.scale === 'major'
      ? [0, 4, 5, 3, 0, 3, 4, 4]
      : settings.scale === 'pentatonic'
        ? [0, 3, 4, 2, 0, 1, 3, 3]
        : [0, 5, 2, 6, 0, 5, 3, 4];
    const chord = harmony[bar];
    const third = settings.scale === 'pentatonic' ? 1 : 2;
    const fifth = settings.scale === 'pentatonic' ? 3 : 4;
    const beat = frame.tick / 4;
    const energy = .81 + .19 * field.ones;
    const band = field.bands[Math.floor(step / 4)];
    const pan = clamp((field.bands[3] + field.bands[2] - field.bands[1] - field.bands[0]) * .28, -.52, .52);
    const events = [];
    function add(voice, midi, duration, velocity, stereo = 0) {
      events.push({ beat, duration, midi, velocity: clamp(velocity * energy, 0, 1), voice, pan: stereo });
    }

    if (settings.style === 'techno') {
      const breakdown = section === 2 && bar < 4;
      const fill = bar === 3 || bar === 7;
      if (step % 4 === 0 && (!breakdown || step % 8 === 0)) {
        add('kick', 36, .47, step === 0 ? 1 : .9);
      }
      if (step === 4 || step === 12 || (density >= 3 && fill && step === 15)) {
        add('snare', 38, step === 15 ? .19 : .34, step === 15 ? .34 : .77, -.09);
      }
      if (step % 4 === 2 || (density >= 3 && !breakdown && step % 2 === 1 && (step >= 11 || field.transitions > .45))) {
        add('hat', step % 4 === 2 ? 46 : 42, step % 4 === 2 ? .2 : .09, .32 + .2 * field.transitions, .25);
      }
      const bassDegree = [0, 0, fifth, 0, 0, 0, third, 0][step / 2];
      if (step % 4 === 2 || (density >= 2 && !breakdown && step % 4 === 0)
        || (density >= 4 && step === 15 && band > .25)) {
        const register = step === 14 && band > .55 ? 0 : -12;
        add('bass', note(scale, root + register, chord + (bassDegree ?? 0)), step % 4 === 0 ? .31 : .36, .67 + .18 * field.overlap);
      }
      const leadSteps = section === 0 && bar < 2 ? [0, 6, 10] : [0, 3, 6, 10, 12, 14];
      const phrase = [fifth, third, 0, third, fifth, 0];
      const index = leadSteps.indexOf(step);
      if (index >= 0 && (density >= 2 || index % 2 === 0)) {
        let degree = phrase[index];
        if (step !== 0 && step !== 12) degree += band > .62 ? 1 : 0;
        if (bar === 7 && step >= 12) degree = step === 14 ? -1 : 0;
        add('lead', note(scale, root + 12 + (section === 3 && step === 12 ? 12 : 0), chord + degree),
          step === 0 || step === 10 ? .63 : .27, .53 + .2 * band, pan);
      }
      if (density >= 3 && (section === 1 || section === 3) && step === 0) {
        add('strings', note(scale, root + 12, chord + third), 3.5, .44, -.24);
        add('strings', note(scale, root + 12, chord + fifth), 3.5, .44, .24);
      }
    } else {
      const arpeggio = [0, fifth, third, fifth, scale.length, fifth, third, fifth];
      const index = step / 2;
      if (step % (density === 1 ? 4 : 2) === 0) {
        const inversion = section === 1 || section === 3 ? third : 0;
        const degree = arpeggio[index] + (step === 0 ? 0 : inversion);
        const rootOctave = step === 0 || step === 8 ? -12 : 0;
        add('piano', note(scale, root + rootOctave, chord + degree),
          step === 0 ? 1.3 : .58, (step % 4 === 0 ? .61 : .42) + .12 * field.overlap, -.22);
      }
      const steps = [0, 4, 6, 8, 12, 14];
      const phrase = [third, fifth, fifth + 1, scale.length, fifth, third];
      const melody = steps.indexOf(step);
      if (melody >= 0 && (density >= 3 || melody !== 2 && melody !== 5)) {
        let degree = phrase[melody];
        if (section === 1 || section === 3) degree = phrase[(melody + 3) % phrase.length];
        if (step === 6 || step === 14) degree += band > .63 ? 1 : field.transitions > .55 ? -1 : 0;
        if (bar === 7 && step >= 12) degree = step === 12 ? third : -1;
        const length = step === 0 || step === 8 ? .94 : step % 4 === 0 ? .43 : .34;
        add('piano', note(scale, root + 12, chord + degree), length, .66 + .22 * band, pan);
      }
      if (step === 0 && density >= 2) {
        add('strings', note(scale, root, chord), 3.9, .62, -.38);
        add('strings', note(scale, root, chord + fifth), 3.9, .57, .34);
        if (density >= 4) add('strings', note(scale, root, chord + third), 3.9, .51, .09);
      }
      if (density === 4 && step === 15 && bar % 4 !== 3 && field.transitions > .32) {
        add('piano', note(scale, root + 12, chord + fifth), .2, .37, pan);
      }
    }
    return events;
  }

  function voiceLength(voice, duration, midi) {
    if (voice === 'kick') return Math.min(.34, duration + .15);
    if (voice === 'snare') return Math.min(.22, duration + .1);
    if (voice === 'hat') return Math.min(midi === 46 ? .22 : .082, duration + .065);
    if (voice === 'strings') return duration + .22;
    return duration + (voice === 'piano' ? .31 : .09);
  }

  function renderVoice(voice, midi, duration, rate) {
    const length = voiceLength(voice, duration, midi);
    const pcm = new Float32Array(Math.ceil(length * rate));
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const angular = TAU * frequency;
    const attack = voice === 'strings' ? .11 : voice === 'bass' ? .01 : voice === 'lead' ? .018 : .004;
    const pi = Math.PI;
    const sine = Math.sin;
    const exp = Math.exp;
    const gain = VOICES[voice].gain;
    let noiseState = (midi + 1) * 171313;
    let noiseLow = 0;
    for (let i = 0; i < pcm.length; i++) {
      const time = i / rate;
      const phase = time * angular;
      const tail = Math.max(0, (length - time) / (length - duration || length));
      const release = clamp(tail, 0, 1) ** 1.9;
      const endFade = Math.min(1, (pcm.length - 1 - i) / (rate * .009));
      const start = Math.min(1, time / attack);
      let signal;
      switch (voice) {
        case 'kick': {
          const pitchSweep = TAU * (47 * time + 4.25 * (1 - exp(-time * 34)));
          signal = Math.tanh(1.7 * sine(pitchSweep)) * exp(-time * 11)
            + .1 * sine(TAU * 1800 * time) * exp(-time * 100);
          break;
        }
        case 'snare':
        case 'hat': {
          noiseState = (Math.imul(1664525, noiseState) + 1013904223) >>> 0;
          const white = noiseState / 2147483648 - 1;
          noiseLow += (voice === 'hat' ? .35 : .09) * (white - noiseLow);
          if (voice === 'hat') {
            const metal = sine(TAU * 4373 * time) * sine(TAU * 6827 * time);
            signal = (.69 * (white - noiseLow) + .31 * metal) * exp(-time * (midi === 46 ? 19 : 48));
          } else {
            signal = .73 * (white - .38 * noiseLow) * exp(-time * 22)
              + .35 * sine(TAU * (178 * time + 1.7 * (1 - exp(-time * 65)))) * exp(-time * 35);
          }
          break;
        }
        case 'bass': {
          const bite = exp(-time * 11);
          signal = .66 * sine(phase) + .27 * sine(phase * 2) + .18 * bite * sine(phase * 3)
            + .07 * bite * sine(phase * 5);
          break;
        }
        case 'lead': {
          const vibrato = .07 * sine(TAU * 5.1 * time);
          signal = .62 * sine(phase + vibrato + .91 * exp(-time * 7) * sine(phase * 2))
            + .19 * sine(phase * 1.003) + .13 * sine(phase * 3 + pi / 4);
          signal *= .82 + .18 * exp(-time * 5);
          break;
        }
        case 'piano':
          signal = .64 * sine(phase) * exp(-time * 2.2)
            + .24 * sine(phase * 2.003) * exp(-time * 4.1)
            + .17 * sine(phase * 3.009) * exp(-time * 7)
            + .1 * sine(phase * 4.018) * exp(-time * 13)
            + .042 * sine(phase * 7.06) * exp(-time * 31);
          break;
        default: {
          const vibrato = .12 * sine(TAU * 4.6 * time);
          signal = .42 * sine(phase * .998 + vibrato) + .28 * sine(phase * 1.002 - vibrato)
            + .17 * sine(phase * 2) + .13 * sine(phase * 3) + .06 * sine(phase * 4.008);
        }
      }
      pcm[i] = signal * gain * start * release * endFade;
    }
    return pcm;
  }

  function cleanEvents(events, maxBeat) {
    const cleaned = [];
    for (const event of events) {
      if (!event || !Object.hasOwn(VOICES, event.voice)
        || !Number.isFinite(event.beat) || event.beat < 0 || event.beat >= maxBeat
        || !Number.isFinite(event.duration) || event.duration <= 0
        || !Number.isInteger(event.midi) || event.midi < 0 || event.midi > 127
        || !Number.isFinite(event.velocity) || event.velocity <= 0) continue;
      cleaned.push({
        beat: event.beat,
        duration: Math.min(event.duration, 8, maxBeat - event.beat),
        midi: event.midi,
        velocity: clamp(event.velocity, 0, 1),
        voice: event.voice,
        pan: number(event.pan, 0, -1, 1)
      });
    }
    return cleaned;
  }

  function writeText(bytes, offset, value) {
    for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i);
  }

  function renderWav(events, options, { durationSeconds, sampleRate } = {}) {
    const settings = normalizeOptions(options);
    const secondsPerBeat = 60 / settings.tempo;
    const rate = Math.round(number(sampleRate, 44100, 8000, 48000));
    const notes = cleanEvents(events, MAX_SECONDS / secondsPerBeat);
    let end = .1;
    for (const event of notes) {
      end = Math.max(end, event.beat * secondsPerBeat + voiceLength(event.voice, event.duration * secondsPerBeat, event.midi));
    }
    const length = Math.ceil(number(durationSeconds, Math.min(MAX_SECONDS, end), .01, MAX_SECONDS) * rate);
    const left = new Float32Array(length);
    const right = new Float32Array(length);
    const cache = new Map();
    for (const event of notes) {
      const start = Math.round(event.beat * secondsPerBeat * rate);
      if (start >= length) continue;
      const duration = event.duration * secondsPerBeat;
      const key = [event.voice, event.midi, event.duration].join(':');
      let pcm = cache.get(key);
      if (!pcm) {
        pcm = renderVoice(event.voice, event.midi, duration, rate);
        if (cache.size < 160) cache.set(key, pcm);
      }
      const position = (event.pan + 1) * Math.PI / 4;
      const level = event.velocity * settings.volume;
      const l = level * Math.cos(position);
      const r = level * Math.sin(position);
      const size = Math.min(pcm.length, length - start);
      for (let i = 0; i < size; i++) {
        left[start + i] += l * pcm[i];
        right[start + i] += r * pcm[i];
      }
    }

    const bytes = new Uint8Array(44 + length * 4);
    const wav = new DataView(bytes.buffer);
    writeText(bytes, 0, 'RIFF');
    wav.setUint32(4, bytes.length - 8, true);
    writeText(bytes, 8, 'WAVEfmt ');
    wav.setUint32(16, 16, true);
    wav.setUint16(20, 1, true);
    wav.setUint16(22, 2, true);
    wav.setUint32(24, rate, true);
    wav.setUint32(28, rate * 4, true);
    wav.setUint16(32, 4, true);
    wav.setUint16(34, 16, true);
    writeText(bytes, 36, 'data');
    wav.setUint32(40, length * 4, true);
    for (let i = 0; i < length; i++) {
      const fade = Math.min(1, (length - 1 - i) / (rate * .012));
      wav.setInt16(44 + i * 4, Math.round(32200 * Math.tanh(1.42 * left[i]) * fade), true);
      wav.setInt16(46 + i * 4, Math.round(32200 * Math.tanh(1.42 * right[i]) * fade), true);
    }
    return bytes;
  }

  function createPlayer() {
    let context;
    let master;
    let compressor;
    let enabled = false;
    let request = 0;
    let settings = normalizeOptions();
    let previousTick = -1;
    let previousTime = 0;
    const sources = new Map();
    const buffers = new Map();

    function silence() {
      previousTick = -1;
      for (const [source, nodes] of sources) {
        source.onended = null;
        try { source.stop(); } catch {}
        for (const node of nodes) node.disconnect();
      }
      sources.clear();
    }

    function configure(options) {
      const next = normalizeOptions(options);
      if (next.tempo !== settings.tempo || next.style !== settings.style) silence();
      if (next.tempo !== settings.tempo) buffers.clear();
      settings = next;
      if (master) master.gain.setTargetAtTime(settings.volume, context.currentTime, .025);
    }

    function disable() {
      request++;
      enabled = false;
      silence();
      if (context?.state === 'running') context.suspend().catch(() => {});
    }

    async function enable(options = settings) {
      const turn = ++request;
      configure(options);
      if (!context) {
        const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Audio) throw new Error('Web Audio API is unavailable');
        context = new Audio();
        master = context.createGain();
        master.gain.value = settings.volume;
        compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -13;
        compressor.knee.value = 12;
        compressor.ratio.value = 5;
        compressor.attack.value = .003;
        compressor.release.value = .15;
        master.connect(compressor);
        compressor.connect(context.destination);
      }
      await context.resume();
      if (turn === request) enabled = context.state === 'running';
      return enabled;
    }

    function playFrame(frame) {
      if (!enabled || context.state !== 'running') return [];
      const events = frameEvents(frame, settings);
      const now = context.currentTime;
      const secondsPerBeat = 60 / settings.tempo;
      const predicted = previousTime + secondsPerBeat / 4;
      const sequential = previousTick >= 0 && frame.tick === previousTick + 1;
      const start = sequential && predicted >= now && predicted < now + .15 ? predicted : now + .012;
      previousTick = frame.tick;
      previousTime = start;
      for (const event of events) {
        if (sources.size >= 32) break;
        const key = [event.voice, event.midi, event.duration].join(':');
        let buffer = buffers.get(key);
        if (!buffer) {
          const pcm = renderVoice(event.voice, event.midi, event.duration * secondsPerBeat, context.sampleRate);
          buffer = context.createBuffer(1, pcm.length, context.sampleRate);
          buffer.getChannelData(0).set(pcm);
          if (buffers.size === 160) buffers.delete(buffers.keys().next().value);
          buffers.set(key, buffer);
        }
        const source = context.createBufferSource();
        const level = context.createGain();
        source.buffer = buffer;
        level.gain.value = event.velocity;
        source.connect(level);
        const nodes = [source, level];
        if (typeof context.createStereoPanner === 'function') {
          const panner = context.createStereoPanner();
          panner.pan.value = event.pan;
          level.connect(panner);
          panner.connect(master);
          nodes.push(panner);
        } else {
          level.connect(master);
        }
        sources.set(source, nodes);
        source.onended = () => {
          for (const node of nodes) node.disconnect();
          sources.delete(source);
        };
        source.start(start);
      }
      return events;
    }

    return { enable, disable, silence, configure, playFrame, get enabled() { return enabled; } };
  }

  function variableLength(value) {
    const result = [value & 127];
    for (value >>>= 7; value > 0; value >>>= 7) result.unshift((value & 127) | 128);
    return result;
  }

  function exportMidi(events, options) {
    const settings = normalizeOptions(options);
    const division = 480;
    const tempo = Math.round(60000000 / settings.tempo);
    const tracks = [[0, 255, 81, 3, tempo >> 16, (tempo >> 8) & 255, tempo & 255,
      0, 255, 88, 4, 4, 2, 24, 8, 0, 255, 47, 0]];
    const channelNotes = new Map();
    for (const event of cleanEvents(events, MAX_SECONDS * settings.tempo / 60)) {
      const voice = VOICES[event.voice];
      if (!channelNotes.has(voice.channel)) {
        channelNotes.set(voice.channel, { program: voice.program, notes: [] });
      }
      channelNotes.get(voice.channel).notes.push(event);
    }
    for (const [channel, { program, notes }] of channelNotes) {
      const body = [];
      if (program !== undefined) body.push(0, 192 | channel, program);
      body.push(0, 176 | channel, 7, Math.round(settings.volume * 127));
      const messages = [];
      const previousNotes = new Map();
      notes.sort((a, b) => a.beat - b.beat);
      for (const event of notes) {
        const start = Math.round(event.beat * division);
        const end = Math.max(start + 1, Math.round((event.beat + event.duration) * division));
        const velocity = Math.max(1, Math.round(event.velocity * 127));
        const previous = previousNotes.get(event.midi);
        if (previous?.start.tick === start) {
          previous.start.velocity = Math.max(previous.start.velocity, velocity);
          previous.stop.tick = Math.max(previous.stop.tick, end);
          continue;
        }
        if (previous?.stop.tick > start) previous.stop.tick = start;
        const on = { tick: start, on: true, midi: event.midi, velocity };
        const stop = { tick: end, on: false, midi: event.midi, velocity: 0 };
        messages.push(on, stop);
        previousNotes.set(event.midi, { start: on, stop });
      }
      messages.sort((a, b) => a.tick - b.tick || Number(a.on) - Number(b.on));
      let tick = 0;
      for (const message of messages) {
        body.push(...variableLength(message.tick - tick), (message.on ? 144 : 128) | channel, message.midi, message.velocity);
        tick = message.tick;
      }
      body.push(0, 255, 47, 0);
      tracks.push(body);
    }
    const bytes = new Uint8Array(14 + tracks.reduce((sum, track) => sum + 8 + track.length, 0));
    const midi = new DataView(bytes.buffer);
    writeText(bytes, 0, 'MThd');
    midi.setUint32(4, 6);
    midi.setUint16(8, 1);
    midi.setUint16(10, tracks.length);
    midi.setUint16(12, division);
    let offset = 14;
    for (const track of tracks) {
      writeText(bytes, offset, 'MTrk');
      midi.setUint32(offset + 4, track.length);
      bytes.set(track, offset + 8);
      offset += 8 + track.length;
    }
    return bytes;
  }

  return { normalizeOptions, frameEvents, createPlayer, renderWav, exportMidi };
});
