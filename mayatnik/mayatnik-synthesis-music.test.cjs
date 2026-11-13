const test = require('node:test');
const assert = require('node:assert/strict');
const Music = require('./mayatnik-synthesis-music.js');

function frame(tick, bits = [1, 0, 1, 0, 1, 1, 0, 0]) {
  const result = Int8Array.from(bits);
  return {
    tick,
    width: 4,
    height: 2,
    a: Uint8Array.from(bits, bit => bit === 1),
    b: Uint8Array.from(bits, (_, index) => index % 2),
    result
  };
}

function composition(style, ticks = 128) {
  return Array.from({ length: ticks }, (_, tick) => Music.frameEvents(frame(tick), { style })).flat();
}

test('normalizes musical options and rejects malformed grids', () => {
  assert.deepEqual(Music.normalizeOptions({
    style: 'CLASSIC', tempo: '200', volume: -1, root: 45, scale: 'toString', density: 6
  }), { style: 'techno', tempo: 180, volume: 0, root: 48, scale: 'minor', density: 4 });
  assert.deepEqual(Music.frameEvents({ ...frame(0), width: 8 }), []);
  assert.deepEqual(Music.frameEvents(frame(-1)), []);
});

test('repeats motifs within a section and varies harmony, phrase and instrumentation across bars', () => {
  for (const style of ['techno', 'classic']) {
    const opts = { style };
    const events = composition(style, 512);
    assert.deepEqual(events, composition(style, 512));
    assert.ok(events.every(event => event.beat * 4 % 1 === 0 && event.midi >= 0 && event.midi <= 127));
    const pitches = tick => Music.frameEvents(frame(tick), opts).map(event => event.midi);
    assert.notDeepEqual(pitches(0), pitches(16));
    assert.deepEqual(pitches(32), pitches(32 + 512));
    assert.notDeepEqual(pitches(0), pitches(128));
    assert.ok(Math.max(...Array.from({ length: 512 }, (_, tick) => Music.frameEvents(frame(tick), opts).length)) <= 5);
  }
  assert.deepEqual(new Set(composition('techno', 256).map(event => event.voice)),
    new Set(['kick', 'bass', 'lead', 'hat', 'snare', 'strings']));
  assert.deepEqual(new Set(composition('classic').map(event => event.voice)), new Set(['piano', 'strings']));
});

test('bit bands drive melodic variations and spatial placement at a fixed tick', () => {
  const left = frame(6, [0, 1, 0, 0, 1, 1, 0, 0]);
  const right = frame(6, [0, 0, 1, 0, 0, 0, 1, 1]);
  const lead = input => Music.frameEvents(input, { density: 4 }).find(event => event.voice === 'lead');
  assert.equal(lead(left).beat, lead(right).beat);
  assert.notEqual(lead(left).midi, lead(right).midi);
  assert.ok(lead(left).pan < 0 && lead(right).pan > 0);

  const adjacent = frame(13, [1, 1, 0, 0, 1, 1, 0, 0]);
  const alternating = frame(13, [1, 0, 1, 0, 1, 0, 1, 0]);
  const hat = input => Music.frameEvents(input).find(event => event.voice === 'hat');
  assert.ok(hat(alternating).velocity > hat(adjacent).velocity);
});

function readMidi(bytes) {
  const view = new DataView(bytes.buffer);
  assert.equal(Buffer.from(bytes.subarray(0, 4)).toString(), 'MThd');
  assert.equal(view.getUint32(4), 6);
  assert.equal(view.getUint16(8), 1);
  assert.equal(view.getUint16(12), 480);
  const tracks = [];
  let offset = 14;
  const variable = () => {
    let value = 0;
    let byte;
    do {
      byte = bytes[offset++];
      value = value * 128 + (byte & 127);
    } while (byte >= 128);
    return value;
  };
  for (let index = 0; index < view.getUint16(10); index++) {
    assert.equal(Buffer.from(bytes.subarray(offset, offset + 4)).toString(), 'MTrk');
    const end = offset + 8 + view.getUint32(offset + 4);
    offset += 8;
    const track = [];
    let time = 0;
    while (offset < end) {
      time += variable();
      const status = bytes[offset++];
      const type = status >> 4;
      let data;
      if (status === 255) {
        const meta = bytes[offset++];
        const length = variable();
        data = [meta, ...bytes.subarray(offset, offset + length)];
        offset += length;
      } else {
        assert.ok([8, 9, 11, 12].includes(type));
        data = type === 12 ? [bytes[offset++]] : [bytes[offset++], bytes[offset++]];
      }
      track.push({ status, data, time });
    }
    assert.equal(offset, end);
    assert.deepEqual(track.at(-1).data, [47]);
    tracks.push(track);
  }
  assert.equal(offset, bytes.length);
  return tracks;
}

test('MIDI contains tempo, drums, patches and balanced note on/off messages', () => {
  const notes = composition('techno');
  const tracks = readMidi(Music.exportMidi(notes, { tempo: 120, volume: .5 }));
  assert.deepEqual(tracks[0][0].data, [81, 7, 161, 32]);
  assert.ok(tracks.some(track => track.some(({ status, data }) => status === 153 && data[0] === 36)));
  assert.ok(tracks.some(track => track.some(({ status, data }) => status === 193 && data[0] === 81)));
  for (const track of tracks.slice(1)) {
    const playing = new Set();
    assert.ok(track.some(({ status, data }) => status >> 4 === 11 && data[0] === 7 && data[1] === 64));
    for (const { status, data } of track) {
      if (status >> 4 === 9) {
        assert.ok(!playing.has(data[0]));
        playing.add(data[0]);
      }
      if (status >> 4 === 8) assert.ok(playing.delete(data[0]));
    }
    assert.equal(playing.size, 0);
  }
});

test('MIDI merges coincident notes on one channel before writing note-offs', () => {
  const note = { beat: 0, duration: 1, midi: 60, velocity: .5, voice: 'piano' };
  const [, track] = readMidi(Music.exportMidi([note, { ...note, duration: 2, velocity: 1 }]));
  assert.deepEqual(track.filter(({ status }) => [8, 9].includes(status >> 4)), [
    { status: 146, data: [60, 127], time: 0 },
    { status: 130, data: [60, 0], time: 960 }
  ]);
});

test('WAV is deterministic stereo PCM, respects volume and cannot hard clip', () => {
  const notes = composition('classic');
  const opts = { style: 'classic' };
  const format = { durationSeconds: 1.5, sampleRate: 22050 };
  const bytes = Music.renderWav(notes, opts, format);
  assert.deepEqual(bytes, Music.renderWav(notes, opts, format));
  assert.notDeepEqual(bytes, Music.renderWav(composition('techno'), opts, format));
  const view = new DataView(bytes.buffer);
  assert.equal(Buffer.from(bytes.subarray(0, 4)).toString(), 'RIFF');
  assert.equal(view.getUint32(4, true), bytes.length - 8);
  assert.equal(Buffer.from(bytes.subarray(8, 16)).toString(), 'WAVEfmt ');
  assert.equal(view.getUint16(20, true), 1);
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(24, true), 22050);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(Buffer.from(bytes.subarray(36, 40)).toString(), 'data');
  assert.equal(view.getUint32(40, true), 4 * 22050 * 1.5);
  assert.ok(bytes.slice(44).some(value => value !== 0));
  assert.ok(Music.renderWav(notes, { volume: 0 }, format).slice(44).every(value => value === 0));
  assert.deepEqual(Array.from(bytes.slice(-4)), [0, 0, 0, 0]);
  for (let offset = 44; offset < bytes.length; offset += 2) {
    assert.ok(Math.abs(view.getInt16(offset, true)) < 32767);
  }
});

test('player creates audio only on enable and disconnects all voices on silence', async () => {
  let contexts = 0;
  let active = 0;
  const property = () => ({ value: 0, setTargetAtTime() {} });
  const node = () => ({ connect() {}, disconnect() {} });
  class AudioContext {
    constructor() {
      contexts++;
      this.state = 'suspended';
      this.sampleRate = 8000;
      this.currentTime = 0;
      this.destination = node();
    }
    createGain() { return { ...node(), gain: property() }; }
    createStereoPanner() { return { ...node(), pan: property() }; }
    createDynamicsCompressor() {
      return {
        ...node(), threshold: property(), knee: property(), ratio: property(),
        attack: property(), release: property()
      };
    }
    createBuffer(_channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    createBufferSource() {
      return {
        ...node(),
        start() { active++; },
        stop() { active--; }
      };
    }
    async resume() { this.state = 'running'; }
    async suspend() { this.state = 'suspended'; }
  }

  const original = globalThis.AudioContext;
  globalThis.AudioContext = AudioContext;
  try {
    const player = Music.createPlayer();
    assert.deepEqual(player.playFrame(frame(0)), []);
    assert.equal(contexts, 0);
    assert.equal(await player.enable({ tempo: 150 }), true);
    assert.equal(contexts, 1);
    assert.equal(player.playFrame(frame(0)).length, active);
    assert.ok(active > 0);
    player.silence();
    assert.equal(active, 0);
    assert.equal(player.enabled, true);
    player.playFrame(frame(1));
    player.disable();
    assert.equal(active, 0);
    assert.equal(player.enabled, false);
    assert.equal(await player.enable(), true);
    assert.equal(contexts, 1);
    player.disable();
  } finally {
    if (original === undefined) delete globalThis.AudioContext;
    else globalThis.AudioContext = original;
  }
});
