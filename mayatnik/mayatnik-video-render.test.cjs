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
  const log = { video: [], audio: [], transforms: [], encoders: [], inputs: 0, samples: 0, canceled: 0 };
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
      log.transforms.push({ id: this.id, ...options });
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

test('crop rounds display-space edges, keeps one pixel, rejects malformed rectangles before encoding', async () => {
  const { renderer, clip, log } = mock();
  assert.deepEqual({ ...renderer.cropRect(null, 9, 7) }, { left: 0, top: 0, width: 9, height: 7 });
  assert.deepEqual({ ...renderer.cropRect({ x: .2, y: .25, width: .5, height: .5 }, 9, 7) },
    { left: 2, top: 2, width: 4, height: 3 });
  assert.deepEqual({ ...renderer.cropRect({ x: .999, y: .999, width: .001, height: .001 }, 9, 7) },
    { left: 8, top: 6, width: 1, height: 1 });
  for (const crop of [{}, 'bad', { x: 0, y: 0, width: NaN, height: 1 },
    { x: 0, y: 0, width: Infinity, height: 1 }, { x: -.1, y: 0, width: 1, height: 1 },
    { x: 0, y: 0, width: 0, height: 1 }, { x: .8, y: 0, width: .3, height: 1 }]) {
    await assert.rejects(renderer.render({ clips: [{ blob: clip('bad', true), start: 0, end: 1, crop }] }), /обрезки/);
  }
  assert.equal(log.encoders.length, 0); assert.equal(log.inputs, 0);
});

test('per-clip crops precede contain scaling and leave trimmed audio on the same clock', async () => {
  const { renderer, clip, log } = mock();
  const a = clip('A', true, 10, 8), b = clip('B', false, 8, 12);
  const result = await renderer.render({ clips: [
    { blob: a, start: .1, end: .4, crop: { x: .2, y: .25, width: .5, height: .5 } },
    { blob: b, start: .2, end: .5, crop: { x: .5, y: 0, width: .5, height: 1 } },
    { blob: a, start: .5, end: .7 }
  ] });
  assert.equal(result.width, 5); assert.equal(result.height, 4);
  assert.deepEqual({ ...log.transforms[0].crop }, { left: 2, top: 2, width: 5, height: 4 });
  assert.deepEqual({ ...log.transforms.find(t => t.id === 'B').crop }, { left: 4, top: 0, width: 4, height: 12 });
  assert.ok(log.transforms.every(t => t.width === 5 && t.height === 4));
  assert.equal(log.audio.reduce((n, [, data]) => n + data.length / 2, 0), 38400);
  assert.ok(Math.abs(log.audio[0][1][0] - .1) < .00001);
  assert.equal(log.inputs, 0); assert.equal(log.samples, 0);
});

test('Chromium exports and decodes display-oriented crops, mixed aspect ratios and trimmed sound', { timeout: 60000 }, async t => {
  let chromium;
  try { ({ chromium } = require('playwright-core')); } catch { t.skip('Playwright unavailable'); return; }
  const { existsSync } = require('node:fs');
  const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  if (!existsSync(chrome)) { t.skip('Chromium unavailable'); return; }
  const server = require('node:http').createServer((req, res) => res.end('<!doctype html><title>Video crop test</title>'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: chrome, headless: true });
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.addScriptTag({ path: vendor });
    await page.addScriptTag({ content: code });
    const result = await page.evaluate(async () => {
      const mb = Mediabunny;
      async function source(width, height, rotation) {
        const target = new mb.BufferTarget();
        const output = new mb.Output({ format: new mb.Mp4OutputFormat(), target });
        const video = new mb.VideoSampleSource({ codec: 'avc', quality: mb.QUALITY_HIGH });
        const audio = new mb.AudioSampleSource({ codec: 'aac', bitrate: 160000 });
        output.addVideoTrack(video, { rotation }); output.addAudioTrack(audio);
        await output.start();
        const canvas = new OffscreenCanvas(width, height), ctx = canvas.getContext('2d');
        for (const [x, y, color] of [[0, 0, '#ff0000'], [1, 0, '#00ff00'], [0, 1, '#0000ff'], [1, 1, '#ffff00']]) {
          ctx.fillStyle = color; ctx.fillRect(x * width / 2, y * height / 2, width / 2, height / 2);
        }
        for (let n = 0; n < 8; n++) {
          const sample = new mb.VideoSample(canvas, { timestamp: n / 8, duration: 1 / 8 });
          try { await video.add(sample); } finally { sample.close(); }
        }
        const pcm = Float32Array.from({ length: 48000 }, (_, n) => .2 * Math.sin(n * 2 * Math.PI * 440 / 48000));
        const sound = new mb.AudioSample({ data: pcm, format: 'f32', numberOfChannels: 1, sampleRate: 48000, timestamp: 0 });
        try { await audio.add(sound); } finally { sound.close(); }
        video.close(); audio.close(); await output.finalize();
        return new Blob([target.buffer], { type: 'video/mp4' });
      }
      const a = await source(64, 48, 90), b = await source(80, 48, 0);
      const rendered = await MayatnikVideoRender.render({ clips: [
        { blob: a, start: .125, end: .5, crop: { x: 0, y: 0, width: .5, height: .5 } },
        { blob: b, start: .25, end: .75, crop: { x: .5, y: 0, width: .5, height: .5 } }
      ] });
      const odd = await MayatnikVideoRender.render({ clips: [
        { blob: a, start: 0, end: .125, crop: { x: 0, y: 0, width: 25 / 48, height: 33 / 64 } }
      ] });
      const oddInfo = await MayatnikVideoRender.inspect(odd.blob);
      const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(rendered.blob) });
      try {
        const track = await input.getPrimaryVideoTrack(), audio = await input.getPrimaryAudioTrack();
        const sink = new mb.VideoSampleSink(track);
        async function pixels(time, points) {
          const sample = await sink.getSample(time);
          try {
            const canvas = new OffscreenCanvas(24, 32), ctx = canvas.getContext('2d'); sample.draw(ctx, 0, 0);
            return points.map(([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data).slice(0, 3));
          } finally { sample.close(); }
        }
        let audioFrames = 0, energy = 0;
        for await (const sample of new mb.AudioSampleSink(audio).samples()) {
          try {
            const data = new Float32Array(sample.numberOfFrames);
            sample.copyTo(data, { format: 'f32-planar', planeIndex: 0 });
            audioFrames += sample.numberOfFrames;
            for (const v of data) energy += v * v;
          } finally { sample.close(); }
        }
        return { width: await track.getDisplayWidth(), height: await track.getDisplayHeight(),
          duration: await track.computeDuration(), source: await MayatnikVideoRender.inspect(a),
          first: await pixels(.1, [[3, 3], [20, 28]]), second: await pixels(.6, [[12, 16], [12, 2], [12, 29]]),
          audioFrames, energy, odd: oddInfo };
      } finally { input.dispose(); }
    });
    assert.equal(result.source.width, 48); assert.equal(result.source.height, 64);
    assert.equal(result.width, 24); assert.equal(result.height, 32);
    assert.ok(Math.abs(result.duration - .875) < .00001);
    for (const [r, g, b] of result.first) assert.ok(b > 220 && r < 25 && g < 25, 'display top-left crop is blue');
    const [r, g, b] = result.second[0]; assert.ok(g > 220 && r < 25 && b < 25, 'second crop is green');
    for (const rgb of result.second.slice(1)) assert.ok(rgb.every(v => v < 20), 'contain adds black bars');
    assert.ok(result.audioFrames >= 42000 && result.audioFrames < 45000);
    assert.ok(result.energy > 100, 'trimmed sound survives export');
    assert.equal(result.odd.width, 25); assert.equal(result.odd.height, 33);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
