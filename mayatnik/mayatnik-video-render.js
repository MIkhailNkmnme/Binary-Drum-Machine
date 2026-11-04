// Local video export. Browser bundle: mayatnik/vendor/mediabunny-1.65.0.min.js (MPL-2.0).
// Unmodified library and TypeScript sources: https://registry.npmjs.org/mediabunny/-/mediabunny-1.65.0.tgz
(function (root) {
  'use strict';
  const RATE = 48000;
  const CHANNELS = 2;
  const BLOCK = 4096;
  const metadata = new WeakMap();

  function library() {
    if (!root.Mediabunny) throw new Error('Модуль обработки видео не загружен.');
    return root.Mediabunny;
  }

  function openInput(blob) {
    const mb = library();
    return new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(blob) });
  }

  async function tracks(input) {
    const video = await input.getPrimaryVideoTrack();
    if (!video) throw new Error('В файле нет видеодорожки.');
    return { video, audio: await input.getPrimaryAudioTrack() };
  }

  async function inspect(blob) {
    if (!metadata.has(blob)) {
      const input = openInput(blob);
      try {
        const { video, audio } = await tracks(input);
        const [duration, width, height] = await Promise.all([
          input.computeDuration(audio ? [video, audio] : [video]), video.getDisplayWidth(), video.getDisplayHeight()
        ]);
        if (!Number.isFinite(duration) || duration <= 0 || !(width > 0 && height > 0)) {
          throw new Error('Не удалось определить длительность или размеры видео.');
        }
        metadata.set(blob, { duration, width, height, hasAudio: !!audio });
      } finally { input.dispose(); }
    }
    return { ...metadata.get(blob) };
  }

  async function codecs(mb, width, height, hasAudio) {
    for (const [video, audio, extension] of [['avc', 'aac', 'mp4'], ['vp9', 'opus', 'webm'], ['vp8', 'opus', 'webm']]) {
      if (await mb.canEncodeVideo(video, { width, height, quality: mb.QUALITY_HIGH }) &&
          (!hasAudio || await mb.canEncodeAudio(audio, { numberOfChannels: CHANNELS, sampleRate: RATE, bitrate: 160000 }))) {
        return { video, audio, extension, mime: 'video/' + extension };
      }
    }
    throw new Error(hasAudio ? 'Браузер не поддерживает экспорт видео со звуком в MP4 или WebM.' :
      'Браузер не поддерживает экспорт видео в MP4 или WebM.');
  }

  // Muxers seek back to update headers. Keep compressed pages as immutable Blobs, including late patches.
  function fileTarget(mb) {
    const pageSize = 1024 * 1024;
    const pages = [];
    const target = new mb.StreamTarget(new WritableStream({
      write({ position, data }) {
        for (let i = 0; i < data.length;) {
          const page = Math.floor(position / pageSize);
          const offset = position % pageSize;
          const count = Math.min(data.length - i, pageSize - offset);
          const old = pages[page] || new Blob();
          const prefix = old.size >= offset ? old.slice(0, offset) : new Blob([old, new Uint8Array(offset - old.size)]);
          pages[page] = new Blob([prefix, data.subarray(i, i + count), old.slice(offset + count)]);
          i += count;
          position += count;
        }
      }
    }), { chunked: true, chunkSize: pageSize });
    return { target, blob: type => new Blob(pages, { type }) };
  }

  function check(signal) {
    if (signal && signal.aborted) throw new DOMException('Экспорт отменён.', 'AbortError');
  }

  // Coordinates refer to the displayed (pixel-aspect-corrected, rotated) frame.
  // Round both edges to the nearest pixel and retain at least one pixel per axis.
  function cropRect(crop, width, height) {
    if (crop == null) return { left: 0, top: 0, width, height };
    if (typeof crop !== 'object' || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(crop[key])) ||
        crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0 ||
        crop.x + crop.width > 1 || crop.y + crop.height > 1) {
      throw new Error('Недопустимые границы обрезки кадра.');
    }
    const left = Math.min(width - 1, Math.round(crop.x * width));
    const top = Math.min(height - 1, Math.round(crop.y * height));
    const right = Math.max(left + 1, Math.min(width, Math.round((crop.x + crop.width) * width)));
    const bottom = Math.max(top + 1, Math.min(height, Math.round((crop.y + crop.height) * height)));
    return { left, top, width: right - left, height: bottom - top };
  }

  async function* videoSamples(mb, track, clip, width, height, signal) {
    const { start, end, offset } = clip;
    let previous = null;
    let from = start;
    async function* emit(until) {
      if (until <= from) return;
      check(signal);
      let frame;
      if (!previous) {
        frame = new mb.VideoSample(new Uint8Array(width * height * 4), {
          format: 'RGBX', codedWidth: width, codedHeight: height, timestamp: 0
        });
      } else if (!clip.crop && previous.codedWidth === width && previous.codedHeight === height &&
          previous.displayWidth === width && previous.displayHeight === height && !previous.rotation && !previous.flip &&
          !previous.hasAlpha && previous.visibleRect.width === width && previous.visibleRect.height === height) {
        frame = previous.clone();
      } else {
        // Mediabunny crops after its own rotation/flip handling, before contain scaling.
        const crop = clip.crop && cropRect(clip.crop, previous.displayWidth, previous.displayHeight);
        frame = await previous.transform({ width, height, fit: 'contain', alpha: 'discard', ...(crop && { crop }) });
      }
      try {
        frame.setTimestamp(offset + (from - start));
        frame.setDuration(until - from);
        yield frame;
      } finally { frame.close(); }
      from = until;
    }
    // The sink includes the displayed frame at start, even when start falls between two presentation timestamps.
    try {
      for await (const sample of new mb.VideoSampleSink(track).samples(start, end)) {
        try {
          yield* emit(Math.max(from, Math.min(end, sample.timestamp)));
        } finally {
          previous?.close();
          previous = sample;
        }
      }
      if (!previous && start >= await track.getFirstTimestamp()) throw new Error('Не удалось декодировать кадр фрагмента.');
      yield* emit(end);
    } finally { previous?.close(); }
  }

  // Stereo PCM on one sample clock for all clips. Mono is duplicated; centre/surround content is retained in the mix.
  function stereoPCM(sample) {
    const channels = sample.numberOfChannels;
    const src = new Float32Array(sample.numberOfFrames * channels);
    sample.copyTo(src, { format: 'f32', planeIndex: 0 });
    if (channels === CHANNELS) return src;
    const data = new Float32Array(sample.numberOfFrames * CHANNELS);
    for (let f = 0; f < sample.numberOfFrames; f++) {
      const i = f * channels;
      let shared = 0;
      for (let c = 2; c < channels; c++) shared += src[i + c] / (channels - 2);
      const k = channels > 2 ? 0.5 : 1;
      data[f * 2] = (src[i] + shared) * k;
      data[f * 2 + 1] = (src[i + (channels === 1 ? 0 : 1)] + shared) * k;
    }
    return data;
  }

  async function* audioSamples(mb, track, clip, signal) {
    const { start, end, offset } = clip;
    let cursor = Math.round(offset * RATE);
    const limit = Math.round((offset + (end - start)) * RATE);
    async function* emit(to, pcm, origin, sourceRate) {
      while (cursor < to) {
        check(signal);
        const count = Math.min(BLOCK, to - cursor);
        const data = new Float32Array(count * CHANNELS);
        if (pcm) {
          const last = pcm.length / CHANNELS - 1;
          for (let n = 0; n < count; n++) {
            const pos = Math.max(0, Math.min(last, ((cursor + n) / RATE - origin) * sourceRate));
            const a = Math.floor(pos), b = Math.min(last, a + 1), mix = pos - a;
            for (let c = 0; c < CHANNELS; c++) {
              const left = pcm[a * CHANNELS + c];
              data[n * CHANNELS + c] = left + (pcm[b * CHANNELS + c] - left) * mix;
            }
          }
        }
        const sample = new mb.AudioSample({ data, timestamp: cursor / RATE, format: 'f32', numberOfChannels: CHANNELS, sampleRate: RATE });
        cursor += count;
        try { yield sample; } finally { sample.close(); }
      }
    }
    if (track) {
      let decoded = false;
      for await (const sample of new mb.AudioSampleSink(track).samples(start, end)) {
        decoded = true;
        try {
          const origin = offset + (sample.timestamp - start);
          yield* emit(Math.min(limit, Math.round(origin * RATE)));
          const to = Math.min(limit, Math.round((origin + sample.numberOfFrames / sample.sampleRate) * RATE));
          if (to > cursor) yield* emit(to, stereoPCM(sample), origin, sample.sampleRate);
        } finally { sample.close(); }
      }
      if (!decoded && Math.min(end, await track.computeDuration()) > Math.max(start, await track.getFirstTimestamp())) {
        throw new Error('Не удалось декодировать звук фрагмента.');
      }
    }
    yield* emit(limit);
  }

  async function render({ clips, onProgress, signal }) {
    check(signal);
    if (!Array.isArray(clips) || !clips.length) throw new Error('Нет фрагментов для экспорта.');
    const mb = library();
    const plan = [];
    let duration = 0, hasAudio = false;
    for (const { blob, start, end, crop } of clips) {
      const info = await inspect(blob);
      check(signal);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > info.duration + 0.000001 ||
          Math.min(end, info.duration) <= start) throw new Error('Недопустимые границы видеофрагмента.');
      const stop = Math.min(end, info.duration);
      const rect = cropRect(crop, info.width, info.height);
      plan.push({ blob, start, end: stop, offset: duration, crop: crop == null ? null : { ...crop }, rect });
      duration += stop - start;
      hasAudio ||= info.hasAudio;
    }
    const { width, height } = plan[0].rect;
    const codec = await codecs(mb, width, height, hasAudio);
    const file = fileTarget(mb);
    const format = codec.extension === 'mp4' ? new mb.Mp4OutputFormat({ fastStart: false }) : new mb.WebMOutputFormat();
    const output = new mb.Output({ format, target: file.target });
    const videoOut = new mb.VideoSampleSource({ codec: codec.video, quality: mb.QUALITY_HIGH });
    const audioOut = hasAudio && new mb.AudioSampleSource({ codec: codec.audio, bitrate: 160000 });
    let activeInput;
    function abort() {
      activeInput?.dispose();
      if (output.state === 'started') void output.cancel().catch(() => {});
    }
    signal?.addEventListener('abort', abort);
    try {
      check(signal);
      output.addVideoTrack(videoOut);
      if (audioOut) output.addAudioTrack(audioOut);
      await output.start();
      onProgress?.(0);
      for (const clip of plan) {
        check(signal);
        activeInput = openInput(clip.blob);
        try {
          const { video, audio } = await tracks(activeInput);
          if (!await video.canDecode()) throw new Error('Браузер не может декодировать видеодорожку файла.');
          if (audio && !await audio.canDecode()) throw new Error('Браузер не может декодировать звуковую дорожку файла.');
          const sounds = audioOut && audioSamples(mb, audio, clip, signal);
          try {
            let next = sounds && await sounds.next();
            for await (const frame of videoSamples(mb, video, clip, width, height, signal)) {
              check(signal);
              while (next && !next.done && next.value.timestamp < frame.timestamp) {
                await audioOut.add(next.value);
                next = await sounds.next();
              }
              await videoOut.add(frame);
              onProgress?.(Math.min(0.99, frame.timestamp / duration));
            }
            while (next && !next.done) {
              await audioOut.add(next.value);
              next = await sounds.next();
            }
          } finally { if (sounds) await sounds.return(); }
        } finally {
          activeInput.dispose();
          activeInput = null;
        }
      }
      videoOut.close();
      if (audioOut) audioOut.close();
      check(signal);
      await output.finalize();
      check(signal);
      const blob = file.blob(codec.mime);
      onProgress?.(1);
      return { blob, mime: codec.mime, extension: codec.extension, width, height, duration };
    } catch (err) {
      if (output.state !== 'finalized') await output.cancel().catch(() => {});
      check(signal);
      throw err;
    } finally { signal?.removeEventListener('abort', abort); }
  }

  const api = { inspect, render, cropRect };
  root.MayatnikVideoRender = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
