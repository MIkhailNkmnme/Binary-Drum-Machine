'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const vendor = join(__dirname, 'vendor', 'mediabunny-1.65.0.min.js');
const code = readFileSync(join(__dirname, 'mayatnik-video-render.js'), 'utf8');

function api(mb) {
  const ctx = { Mediabunny: mb, Blob, DOMException, WritableStream, Uint8Array, Float32Array };
  vm.runInNewContext(code, ctx);
  return ctx.MayatnikVideoRender;
}

function mock({ videoCodecs = ['avc'], audioCodecs = ['aac'], decoder = true, emptyAudio = false } = {}) {
  const log = { video: [], audio: [], encoders: [], inputs: 0, samples: 0, canceled: 0 };
  class Input {
    constructor({ source }) { this.src = source; this.open = true; log.inputs++; }
    getPrimaryVideoTrack() { return this.src; }
    getPrimaryAudioTrack() { return this.src.audio ? this.src.audio : null; }
    computeDuration() { return 1; }
    dispose() { if (this.open) { this.open = false; log.inputs--; } }
  }
  function clip(id, sound, width = 8, height = 4) {
    return {
      id, audio: sound && { id, canDecode: () => decoder, computeDuration: () => 1, getFirstTimestamp: () => 0 }, width, height, canDecode: () => true,
      getDisplayWidth: () => width, getDisplayHeight: () => height, getFirstTimestamp: () => 0
    };
  }
  class Sample {
    constructor(props) { this.open = true; Object.assign(this, props); log.samples++; }
    close() { assert.ok(this.open, 'double close'); this.open = false; log.samples--; }
    setTimestamp(time) { this.timestamp = time; }
    setDuration(time) { this.duration = time; }
    clone() { return new Sample({ id: this.id, stamp: this.timestamp }); }
    transform(options) {
      assert.equal(options.fit, 'contain'); assert.equal(options.alpha, 'discard');
      return new Sample({ id: this.id, stamp: this.timestamp, fit: [options.width, options.height] });
    }
  }
  class VideoSink {
    constructor(track) { this.track = track; }
    async *samples(start, end) {
      const t = this.track;
      for (let frame = Math.floor(start * 4); frame / 4 < end; frame++) {
        yield new Sample({ id: t.id, timestamp: frame / 4, codedWidth: t.width, codedHeight: t.height,
          displayWidth: t.width, displayHeight: t.height, visibleRect: { width: t.width, height: t.height } });
      }
    }
  }
  class AudioSink {
    constructor(track) { this.track = track; }
    async *samples() {
      if (emptyAudio) return;
      yield new Sample({ timestamp: 0, sampleRate: 1000, numberOfFrames: 1000, numberOfChannels: 1,
        copyTo: data => { for (let i = 0; i < data.length; i++) data[i] = i / 1000; } });
    }
  }
  const mb = {
    Input, BlobSource: class { constructor(blob) { return blob; } },
    VideoSampleSink: VideoSink, AudioSampleSink: AudioSink, AudioSample: Sample,
    VideoSampleSource: class {
      constructor({ codec }) { log.encoders.push(codec); }
      async add(frame) { assert.ok(frame.open); log.video.push([frame.id, frame.stamp, frame.timestamp, frame.duration, frame.fit]); }
      close() {}
    },
    AudioSampleSource: class {
      constructor({ codec }) { log.encoders.push(codec); }
      async add(sample) { assert.ok(sample.open); log.audio.push([sample.timestamp, sample.data]); }
      close() {}
    },
    Output: class {
      constructor({ target }) { this.target = target; this.state = 'pending'; }
      addVideoTrack() {} addAudioTrack() {}
      async start() { this.state = 'started'; }
      async cancel() { if (this.state !== 'canceled') log.canceled++; this.state = 'canceled'; }
      async finalize() {
        const writer = this.target.getWriter();
        await writer.write({ position: 0, data: Uint8Array.of(1, 2, 3, 4) });
        await writer.write({ position: 1, data: Uint8Array.of(9) });
        await writer.close();
        this.state = 'finalized';
      }
    },
    StreamTarget: class { constructor(stream) { return stream; } }, Mp4OutputFormat: class {}, WebMOutputFormat: class {},
    canEncodeVideo: codec => videoCodecs.includes(codec), canEncodeAudio: codec => audioCodecs.includes(codec)
  };
  return { renderer: api(mb), clip, log };
}

test('VFR cut between frames, rate conversion, a silent file, letterbox, and reuse of the first file', async () => {
  const { clip, log, renderer } = mock();
  const a = clip('A', true), b = clip('B', false, 4, 8);
  const clips = [{ blob: a, start: .12, end: .55 }, { blob: b, start: .35, end: .61 }, { blob: a, start: .7, end: .8 }];
  const progress = [];
  const result = await renderer.render({ clips, onProgress: x => progress.push(x) });
  assert.equal(result.mime, 'video/mp4');
  assert.deepEqual([...new Uint8Array(await result.blob.arrayBuffer())], [1, 9, 3, 4]);
  const ms = n => Math.round(n * 1000);
  assert.deepEqual(log.video.map(([id, origin, at, len]) => [id, ms(origin), ms(at), ms(len)]), [
    ['A', 0, 0, 130], ['A', 250, 130, 250], ['A', 500, 380, 50],
    ['B', 250, 430, 150], ['B', 500, 580, 110], ['A', 500, 690, 50], ['A', 750, 740, 50]
  ]);
  assert.deepEqual([...log.video[3][4]], [8, 4]);
  let frames = 0;
  for (const [time, data] of log.audio) {
    assert.equal(Math.round(time * 48000), frames);
    assert.ok(data.length <= 4096 * 2);
    const t = ms(time);
    if (t >= 430 && t < 690) assert.ok(data.every(v => v === 0));
    else assert.ok(Math.abs(data[0] - (time < .43 ? .12 + time : .7 + time - .69)) < .00001);
    assert.ok(data[0] === data[1]);
    frames += data.length / 2;
  }
  assert.equal(frames, 37920);
  assert.ok(progress.every((x, i) => !i || x >= progress[i - 1])); assert.equal(progress.at(-1), 1);
  assert.equal(log.inputs, 0); assert.equal(log.samples, 0);
});

test('requires encoders for both tracks, tries VP9 then VP8, allows video-only MP4', async () => {
  for (const fallback of ['vp9', 'vp8']) {
    const { renderer, clip, log } = mock({ videoCodecs: ['avc', fallback], audioCodecs: ['opus'] });
    const result = await renderer.render({ clips: [{ blob: clip('A', true), start: 0, end: 1 }] });
    assert.deepEqual(log.encoders, [fallback, 'opus']); assert.equal(result.extension, 'webm');
  }
  const { renderer, clip, log } = mock({ audioCodecs: [] });
  await assert.rejects(renderer.render({ clips: [{ blob: clip('A', true), start: 0, end: 1 }] }), /со звуком/);
  await renderer.render({ clips: [{ blob: clip('B', false), start: .1, end: .2 }] });
  assert.deepEqual(log.encoders, ['avc']);
});

test('rejects invalid cuts and an unreadable audio track, closes output on cancellation', async () => {
  const { renderer, clip, log } = mock({ decoder: false });
  const blob = clip('A', true);
  for (const [start, end] of [[-1,.1],[.2,.2],[NaN,.4],[.1,1.2]]) {
    await assert.rejects(renderer.render({ clips: [{ blob, start, end }] }), /границы/);
  }
  await assert.rejects(renderer.render({ clips: [{ blob, start: 0, end: 1 }] }), /звуковую/);
  const empty = mock({ emptyAudio: true });
  await assert.rejects(empty.renderer.render({ clips: [{ blob: empty.clip('A', true), start: 0, end: 1 }] }), /декодировать звук/);
  assert.equal(empty.log.samples, 0); assert.equal(empty.log.inputs, 0);
  const normal = mock();
  const ctrl = new AbortController();
  await assert.rejects(normal.renderer.render({ clips: [{ blob: normal.clip('B', true), start: 0, end: .9 }],
    signal: ctrl.signal, onProgress: x => { if (x > .1) ctrl.abort(); } }), { name: 'AbortError' });
  assert.equal(normal.log.canceled, 1); assert.equal(normal.log.inputs, 0); assert.equal(normal.log.samples, 0);
  assert.equal(log.inputs, 0);
});

test('bundled library demuxes WebM track metadata locally', async () => {
  const mb = require(vendor);
  const target = new mb.BufferTarget();
  const output = new mb.Output({ format: new mb.WebMOutputFormat(), target });
  const track = new mb.EncodedVideoPacketSource('vp8');
  output.addVideoTrack(track);
  await output.start();
  await track.add(new mb.EncodedPacket(Uint8Array.of(16,0,0,157,1,42,16,0,8,0), 'key', 0, .25),
    { decoderConfig: { codec: 'vp8', codedWidth: 16, codedHeight: 8 } });
  await output.finalize();
  const result = await api(mb).inspect(new Blob([target.buffer]));
  assert.deepEqual({ ...result }, { width: 16, height: 8, duration: .25, hasAudio: false });
});
