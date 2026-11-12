/* An independently scored video for a saved continuation GIF. */
(() => {
  'use strict';
  const RATE = 48000;
  const BEAT = 60 / 108;
  const TICK = BEAT / 2;
  const CHORDS = [[38, 50, 57, 60, 64], [34, 46, 53, 57, 60], [43, 50, 58, 62, 65], [45, 52, 55, 62, 64]];

  function countOnes(context, width, height, tick, palette) {
    const count = Math.min(13, width);
    const row = Math.min(height - 1, Math.floor(height * (.24 + ((tick * 13) % 53) / 100)));
    const start = Math.round((width - count) * (.38 + ((tick * 19) % 25) / 100));
    const pixels = context.getImageData(start, row, count, 1).data;
    const [zero, one] = palette;
    let ones = 0;
    for (let p = 0; p < pixels.length; p += 4) {
      if (!(pixels[p] | pixels[p + 1] | pixels[p + 2])) continue;
      let a = 0, b = 0;
      for (let c = 0; c < 3; c++) {
        a += (pixels[p + c] - zero[c]) ** 2;
        b += (pixels[p + c] - one[c]) ** 2;
      }
      if (b < a) ones++;
    }
    return ones;
  }

  function cuesFor(counts, variant) {
    const cues = [];
    function add(note, time, duration, level, pan, bell) {
      cues.push({ start: Math.round(time * RATE), length: Math.round(duration * RATE),
        phase: 2 * Math.PI * 440 * 2 ** ((note - 69) / 12) / RATE,
        left: level * Math.cos((pan + 1) * Math.PI / 4), right: level * Math.sin((pan + 1) * Math.PI / 4), bell });
    }
    counts.forEach((ones, i) => {
      const start = i * TICK, chord = CHORDS[Math.floor(i / 8) % CHORDS.length];
      if (i % 8 === 0) {
        add(chord[0], start, BEAT * 4, .16, 0, false);
        for (let j = 1; j < chord.length; j++) add(chord[j], start, BEAT * 4.4, .044, (j - 2.5) * .32, false);
      }
      if (i % 4 !== 0 && ones % 3 === 0) return;
      const note = chord[1 + (ones + i + variant) % 4] + ((i + variant) % 5 ? 12 : 24);
      const pan = (i % 2 ? -1 : 1) * (.25 + .07 * (ones % 5));
      add(note, start, 1.05, .13, pan, true);
      add(note, start + .75 * BEAT, .85, .034, -pan, true);
    });
    return cues.sort((a, b) => a.start - b.start);
  }

  async function addAudio(source, counts, duration, signal, variant) {
    const total = Math.max(1, Math.round(duration * RATE)), cues = cuesFor(counts, variant);
    let first = 0;
    for (let start = 0; start < total; start += RATE) {
      signal?.throwIfAborted();
      const length = Math.min(RATE, total - start), end = start + length;
      const buffer = new AudioBuffer({ length, sampleRate: RATE, numberOfChannels: 2 });
      const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
      while (first < cues.length && cues[first].start + cues[first].length <= start) first++;
      for (let j = first; j < cues.length && cues[j].start < end; j++) {
        const cue = cues[j], attack = RATE * (cue.bell ? .012 : .14), release = RATE * (cue.bell ? .27 : .53);
        const from = Math.max(start, cue.start), to = Math.min(end, cue.start + cue.length);
        for (let sample = from; sample < to; sample++) {
          const offset = sample - cue.start, phase = cue.phase * offset;
          const envelope = Math.min(1, offset / attack, (cue.length - offset) / release);
          const wave = cue.bell ? Math.exp(-2.1 * offset / RATE) * (Math.sin(phase + .25 * Math.sin(phase * 2)) + .23 * Math.sin(phase * 2.006))
            : Math.sin(phase) + .18 * Math.sin(phase * 2);
          left[sample - start] += envelope * wave * cue.left;
          right[sample - start] += envelope * wave * cue.right;
        }
      }
      for (let i = 0; i < length; i++) {
        const fade = Math.min(1, (start + i) / (RATE * .1), (total - start - i) / (RATE * .28));
        left[i] = Math.tanh(left[i]) * fade;
        right[i] = Math.tanh(right[i]) * fade;
      }
      await source.add(buffer);
    }
  }

  async function video(gif, { palette, signal, progress, variant = 0 }) {
    const M = window.Mediabunny;
    if (!M || typeof ImageDecoder !== 'function' || !ImageDecoder.isTypeSupported || !await ImageDecoder.isTypeSupported('image/gif'))
      throw Error('Этот браузер не умеет собирать видео из GIF.');
    const decoder = new ImageDecoder({ type: 'image/gif', data: gif.stream() });
    let output;
    try {
      await decoder.completed;
      await decoder.tracks.ready;
      signal?.throwIfAborted();
      const count = decoder.tracks.selectedTrack?.frameCount;
      if (!count) throw Error('В GIF нет кадров.');
      const canvas = document.createElement('canvas'), G = canvas.getContext('2d', { willReadFrequently: true });
      const counts = [];
      let time = 0, videoTrack, audioTrack, target, mp4;
      for (let i = 0; i < count; i++) {
        signal?.throwIfAborted();
        const { image } = await decoder.decode({ frameIndex: i });
        try {
          const width = image.displayWidth, height = image.displayHeight;
          if (!output) {
            canvas.width = width + width % 2;
            canvas.height = height + height % 2;
            const videoOpts = { width: canvas.width, height: canvas.height, bitrate: 4e6 };
            const audioOpts = { numberOfChannels: 2, sampleRate: RATE, bitrate: 128000 };
            mp4 = await M.canEncodeVideo('avc', videoOpts) && await M.canEncodeAudio('aac', audioOpts);
            if (!mp4 && !(await M.canEncodeVideo('vp8', videoOpts) && await M.canEncodeAudio('opus', audioOpts)))
              throw Error('Этот браузер не умеет кодировать видео со звуком.');
            target = new M.BufferTarget();
            output = new M.Output({ format: mp4 ? new M.Mp4OutputFormat() : new M.WebMOutputFormat(), target });
            videoTrack = new M.CanvasSource(canvas, { codec: mp4 ? 'avc' : 'vp8', bitrate: videoOpts.bitrate });
            audioTrack = new M.AudioBufferSource({ codec: mp4 ? 'aac' : 'opus', bitrate: audioOpts.bitrate });
            output.addVideoTrack(videoTrack);
            output.addAudioTrack(audioTrack);
            await output.start();
          }
          signal?.throwIfAborted();
          G.fillStyle = '#000';
          G.fillRect(0, 0, canvas.width, canvas.height);
          G.drawImage(image, 0, 0);
          const duration = Math.max(.01, (image.duration || 100000) / 1e6);
          while (counts.length * TICK < time + duration - 1e-8)
            counts.push(countOnes(G, width, height, counts.length + 17 * variant, palette));
          await videoTrack.add(time, duration);
          time += duration;
          progress?.(i + 1, count);
        } finally {
          image.close();
        }
      }
      videoTrack.close();
      await addAudio(audioTrack, counts, time, signal, variant);
      audioTrack.close();
      signal?.throwIfAborted();
      await output.finalize();
      return { blob: new Blob([target.buffer], { type: mp4 ? 'video/mp4' : 'video/webm' }), extension: mp4 ? 'mp4' : 'webm' };
    } catch (error) {
      try { await output?.cancel(); } catch (_) {}
      throw error;
    } finally {
      decoder.close();
    }
  }

  window.MayatnikContinuationMusic = { video };
})();
