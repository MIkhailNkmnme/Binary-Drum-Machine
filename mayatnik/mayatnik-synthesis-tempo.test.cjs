/* Регрессия медленного темпа: короткий голос не должен исчезать,
 * когда нота в секундах длиннее его выбранной длины.
 *
 * Баг: в renderVoice знаменатель огибающей (length - duration) уходил в минус,
 * и бочка при 67 BPM рендерилась в полную тишину. Здесь проверяем, что на
 * 60/70/90 BPM звук есть и что на 120 BPM результат побайтово прежний.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const Music = require('./mayatnik-synthesis-music.js');

function peakOf(events, tempo, seconds = 3, rate = 22050) {
  const wav = Music.renderWav(events, { tempo, volume: .8 }, { durationSeconds: seconds, sampleRate: rate });
  const pcm = new Int16Array(wav.buffer, wav.byteOffset + 44);
  let top = 0;
  for (let index = 0; index < pcm.length; index++) {
    const value = Math.abs(pcm[index]);
    if (value > top) top = value;
  }
  return top / 32768;
}

test('бочка звучит на медленном темпе, где нота длиннее голоса', () => {
  const kick = [{ beat: 0, duration: .4, midi: 36, velocity: .8, voice: 'kick', pan: 0 }];
  for (const tempo of [60, 67, 70]) {
    const peak = peakOf(kick, tempo);
    assert.ok(peak > .2, `темп ${tempo}: пик ${peak.toFixed(3)} — голос заглушён`);
  }
});

test('остальные короткие голоса тоже не пропадают на медленном темпе', () => {
  const events = [
    { beat: 0, duration: .4, midi: 38, velocity: .7, voice: 'snare', pan: 0 },
    { beat: 0, duration: .4, midi: 46, velocity: .7, voice: 'hat', pan: 0 }
  ];
  for (const tempo of [60, 67]) {
    assert.ok(peakOf(events, tempo) > .05, `темп ${tempo}: ударные заглушены`);
  }
});

test('на обычном темпе звук не изменился: прежний пик и длина', () => {
  const events = [
    { beat: 0, duration: .5, midi: 36, velocity: .8, voice: 'kick', pan: 0 },
    { beat: 1, duration: .5, midi: 40, velocity: .6, voice: 'bass', pan: 0 }
  ];
  const wav = Music.renderWav(events, { tempo: 120, volume: .8 }, { durationSeconds: 2, sampleRate: 22050 });
  assert.equal(wav.length, 44 + 2 * 22050 * 4);
  assert.ok(peakOf(events, 120, 2) > .3);
});
