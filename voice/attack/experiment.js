/* Blind A/B of two mathematical onset recipes using the same Codex Bank. */
(() => {
  'use strict';

  const bank = globalThis.ZerkaliusVoice;
  const buttons = ['play-a', 'play-b'].map(id => document.getElementById(id));
  const stopButton = document.getElementById('stop');
  const status = document.getElementById('play-status');
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!bank || !globalThis.VoiceProsodyDSP || !AudioContextClass) {
    status.textContent = 'Для пробы требуется Банк и поддержка Web Audio.';
    return;
  }

  const rate = bank.limits.sampleRate;
  const samplesAt = ms => Math.round(ms * rate / 1000);
  const vowelStart = samplesAt(70);
  const sampleCount = samplesAt(305);
  const settings = {...bank.defaults, pitchStart: 130, pitchEnd: 130, vibratoDepth: 0};
  const segment = (id, samples) => ({id, duration: samples / rate});
  const vowel = segment('e', sampleCount - vowelStart);
  const methods = ['Текущая атака', 'Раздельная смычка, раскрытие и переход'];
  const order = crypto.getRandomValues(new Uint8Array(1))[0] & 1 ? [1, 0] : [0, 1];
  const syllables = {
    g: {voiced: true, closureMs: 38, releaseMs: 48,
        release: [280, 1970, 2220, 3800], onset: [365, 2110, 2310]},
    t: {voiced: false, closureMs: 44, releaseMs: 54,
        release: [350, 2300, 3550, 5200], onset: [390, 1750, 2740]}
  };

  function render(score, phones = {}) {
    return bank.render({
      score, settings, phones,
      prosody: {
        version: 1, transitionMs: 20,
        segments: score.map(() => ({pitchStartSemitones: 0, pitchEndSemitones: 0, gain: 1})),
        articulatedFrication: true, smoothStopRelease: true,
        softVoicedConsonants: true, voicedVelarRelease: true
      }
    }).samples;
  }

  function renderStaged({voiced, closureMs, releaseMs, release, onset}) {
    const closureEnd = samplesAt(closureMs), releaseEnd = samplesAt(releaseMs);
    const baseVowel = bank.getPhone('e');
    const phones = {
      closure: {kind: 'sonorant', formants: [255, 1100, 2500, 3500],
        bandwidths: [105, 350, 500, 700], weights: [.8, 0, 0, 0],
        voice: voiced ? .22 : 0, noise: 0},
      release: {kind: 'sonorant', formants: release, bandwidths: [135, 420, 520, 840],
        weights: voiced ? [.28, .9, .85, .10] : [.02, .45, .8, .72],
        voice: voiced ? .12 : 0, noise: voiced ? .48 : .85},
      onset: {...baseVowel, formants: [...onset, baseVowel.formants[3]], voice: .86}
    };
    return render([
      segment('closure', closureEnd),
      segment('release', releaseEnd - closureEnd),
      segment('onset', vowelStart - releaseEnd),
      vowel
    ], phones);
  }

  function levelOf(samples) {
    const from = samplesAt(140), to = samplesAt(245);
    let energy = 0, peak = 0;
    for (let i = 0; i < samples.length; i++) {
      const value = samples[i];
      peak = Math.max(peak, Math.abs(value));
      if (i >= from && i < to) energy += value * value;
    }
    return {samples, gain: .14 / Math.max(1e-9, Math.sqrt(energy / (to - from))), peak};
  }

  function makePairs() {
    const ids = Object.keys(syllables);
    const clips = [
      ids.map(id => levelOf(render([segment(id, vowelStart), vowel]))),
      ids.map(id => levelOf(renderStaged(syllables[id])))
    ];
    // A shared peak ceiling preserves the equal vowel level across all clips.
    const largestPeak = Math.max(...clips.flat().map(({gain, peak}) => gain * peak));
    const ceiling = Math.min(1, .9 / Math.max(1e-9, largestPeak));
    const step = sampleCount + samplesAt(300);
    return clips.map(pair => {
      const result = new Float32Array(step + sampleCount);
      pair.forEach(({samples, gain}, index) => {
        const offset = index * step;
        for (let i = 0; i < samples.length; i++) result[offset + i] = samples[i] * gain * ceiling;
      });
      return result;
    });
  }

  let context, pairs, playing, revision = 0;

  function clearPlayback() {
    for (const button of buttons) button.setAttribute('aria-pressed', 'false');
    stopButton.disabled = true;
  }

  function stopPlayback() {
    const source = playing;
    playing = null;
    if (source) {
      source.onended = null;
      source.stop();
      source.disconnect();
    }
    clearPlayback();
  }

  async function play(index) {
    const request = ++revision;
    stopPlayback();
    try {
      context ??= new AudioContextClass();
      await context.resume();
      if (request !== revision) return;
      pairs ??= makePairs();
      const samples = pairs[order[index]];
      const buffer = context.createBuffer(1, samples.length, rate);
      buffer.copyToChannel(samples, 0);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.onended = () => {
        source.disconnect();
        if (playing !== source) return;
        playing = null;
        clearPlayback();
        status.textContent = 'Готово.';
      };
      source.start();
      playing = source;
      buttons[index].setAttribute('aria-pressed', 'true');
      stopButton.disabled = false;
      status.textContent = 'Играет вариант ' + ['A', 'B'][index] + '.';
    } catch (error) {
      if (request !== revision) return;
      stopPlayback();
      status.textContent = error instanceof Error ? error.message : String(error);
    }
  }

  buttons.forEach((button, index) => {
    button.addEventListener('click', () => play(index));
    button.disabled = false;
  });
  stopButton.addEventListener('click', () => {
    revision++;
    stopPlayback();
    status.textContent = 'Остановлено.';
  });
  document.getElementById('answer').textContent = order.map((method, index) =>
    ['A', 'B'][index] + ' — ' + methods[method].toLowerCase() + '.').join(' ');
  status.textContent = 'Готово к прослушиванию.';
})();
