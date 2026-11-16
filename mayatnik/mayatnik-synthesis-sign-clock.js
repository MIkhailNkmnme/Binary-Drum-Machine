(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MayatnikSynthesisSignClock = api;
})(typeof globalThis === 'object' ? globalThis : this, function (root) {
  'use strict';

  const DEFAULT_BASE = (function () {
    const script = root.document?.currentScript;
    return script?.src ? new URL('sign-voice/', script.src).href : 'sign-voice/';
  })();
  const VALID_SIGN = /^[А-ЯЁA-Z0-9 ]$/;
  const CACHE = new Map();

  function abortError() {
    try { return new DOMException('Playback stopped', 'AbortError'); }
    catch (_) { const error = new Error('Playback stopped'); error.name = 'AbortError'; return error; }
  }

  function create(options = {}) {
    const baseUrl = options.baseUrl || DEFAULT_BASE;
    let context = null;
    let generation = 0;
    let active = null;
    let bufferPromise = null;

    function getContext() {
      const Audio = root.AudioContext || root.webkitAudioContext;
      if (!Audio) throw new Error('Этот браузер не поддерживает Web Audio.');
      if (!context) context = new Audio();
      return context;
    }

    function getBuffer(ctx) {
      if (bufferPromise) return bufferPromise;
      const directory = new URL(baseUrl.endsWith('/') ? baseUrl : baseUrl + '/', root.location?.href);
      const key = directory.href;
      if (CACHE.has(key)) {
        bufferPromise = CACHE.get(key).then(async ({ manifest, bytes }) => ({
          manifest,
          buffer: await ctx.decodeAudioData(bytes.slice(0))
        }));
        bufferPromise.catch(() => { bufferPromise = null; });
        return bufferPromise;
      }
      const entry = (async () => {
        const manifestUrl = new URL('sign-bank.json', directory).href;
        const wavUrl = new URL('sign-bank.wav', directory).href;
        const [manifestResponse, wavResponse] = await Promise.all([fetch(manifestUrl), fetch(wavUrl)]);
        if (!manifestResponse.ok) throw new Error(`Не удалось загрузить описание голосов (${manifestResponse.status}).`);
        if (!wavResponse.ok) throw new Error(`Не удалось загрузить голоса (${wavResponse.status}).`);
        const manifest = await manifestResponse.json();
        const bytes = await wavResponse.arrayBuffer();
        if (manifest?.version !== 1 || !manifest.clips || typeof manifest.clips !== 'object') {
          throw new Error('Неподдерживаемый формат описания голосов.');
        }
        return { manifest, bytes };
      })();
      CACHE.set(key, entry);
      entry.catch(() => { if (CACHE.get(key) === entry) CACHE.delete(key); });
      bufferPromise = entry.then(async ({ manifest, bytes }) => ({
        manifest,
        buffer: await ctx.decodeAudioData(bytes.slice(0))
      }));
      bufferPromise.catch(() => { bufferPromise = null; });
      return bufferPromise;
    }

    function dispose(run) {
      if (run.raf != null) root.cancelAnimationFrame?.(run.raf);
      run.nodes.forEach(node => {
        try { node.stop(); } catch (_) {}
        try { node.disconnect(); } catch (_) {}
      });
    }

    function stop() {
      generation++;
      const old = active;
      active = null;
      if (!old) return;
      old.stopped = true;
      dispose(old);
      old.reject(abortError());
    }

    function play(input = {}) {
      stop();
      const runId = generation;
      const signs = input.signs;
      if (!Array.isArray(signs) || signs.some(sign => typeof sign !== 'string' || !VALID_SIGN.test(sign))) {
        return Promise.reject(new TypeError('Допустимы буквы, цифры и пробелы.'));
      }
      const start = Number(input.start ?? 0);
      const count = Number(input.count ?? Math.max(0, signs.length - start));
      const bpm = Number(input.bpm ?? 120);
      if (!Number.isSafeInteger(start) || start < 0 || !Number.isSafeInteger(count) || count < 0
        || start + count > signs.length || !Number.isFinite(bpm) || bpm <= 0) {
        return Promise.reject(new RangeError('Неверная позиция или темп голоса.'));
      }
      const beats = 60 / bpm;
      const result = new Promise((resolve, reject) => {
        active = { runId, nodes: [], stopped: false, reject };
        (async () => {
          const current = active;
          try {
            const ctx = getContext();
            await ctx.resume();
            if(ctx.state !== 'running')throw new Error('Браузер не запустил звук. Повторите «Пуск».');
            const { manifest, buffer } = await getBuffer(ctx);
            if (generation !== runId || current.stopped) throw abortError();
            const selected = signs.slice(start, start + count);
            const clips = selected.map(sign => sign === ' ' ? null : manifest.clips[sign]);
            if (clips.some((clip, index) => selected[index] !== ' ' && (!Array.isArray(clip) || clip.length < 2
              || !Number.isFinite(Number(clip[0])) || !Number.isFinite(Number(clip[1]))
              || Number(clip[0]) < 0 || Number(clip[1]) <= 0
              || Number(clip[0]) + Number(clip[1]) > buffer.duration + .002))) {
              throw new Error('Для одного из знаков нет корректной записи голоса.');
            }
            const timeline = ctx.currentTime + 0.10;
            function audibleTime() {
              const stamp = ctx.getOutputTimestamp?.();
              if (stamp && Number.isFinite(stamp.contextTime) && stamp.performanceTime > 0) {
                return stamp.contextTime + (root.performance.now() - stamp.performanceTime) / 1000;
              }
              return ctx.currentTime - (ctx.baseLatency || 0) - (ctx.outputLatency || 0);
            }

            selected.forEach((sign, offset) => {
              const onset = timeline + offset * beats;
              if (sign !== ' ') {
                const [clipStart, clipDuration] = clips[offset].map(Number);
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.playbackRate.value = Math.max(1, clipDuration / (beats * .86));
                source.connect(ctx.destination);
                source.start(onset, clipStart, clipDuration);
                current.nodes.push(source);
              }
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.frequency.value = 1250;
              gain.gain.setValueAtTime(0.0001, onset);
              gain.gain.exponentialRampToValueAtTime(0.035, onset + 0.001);
              gain.gain.exponentialRampToValueAtTime(0.0001, onset + 0.012);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start(onset);
              osc.stop(onset + 0.014);
              current.nodes.push(osc, gain);
            });

            if (!count) {
              if (generation === runId && active === current) {
                active = null;
                input.onFinish?.();
                resolve();
              }
              return;
            }
            let lastBeat = -1;
            const finishAt = timeline + count * beats;
            function fail(error) {
              if (generation === runId && active === current) {
                active = null;
                dispose(current);
                reject(error);
              }
            }
            function pump() {
              if (generation !== runId || active !== current || current.stopped) return;
              try {
                const now = audibleTime();
                const beat = Math.min(count - 1, Math.floor((now - timeline) / beats));
                if (beat > lastBeat) {
                  lastBeat = beat;
                  input.onBeat?.(start + beat);
                }
                if (now >= finishAt) {
                  dispose(current);
                  active = null;
                  try { input.onFinish?.(); resolve(); } catch (error) { reject(error); }
                  return;
                }
              } catch (error) { fail(error); return; }
              current.raf = root.requestAnimationFrame(pump);
            }
            current.raf = root.requestAnimationFrame(pump);
          } catch (error) {
            if (generation === runId && active === current) {
              active = null;
              dispose(current);
            }
            reject(error);
          }
        })();
      });
      return result;
    }

    return {
      play,
      stop,
      get running() { return active !== null; }
    };
  }

  return { create };
});
