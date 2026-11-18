'use strict';
// ЗВК-001: new, fully documented teaching sounds; no audio inputs.
// Run from repository root: node mayatnik/instruction/assets/build-xorrom-demos.cjs
// This is production only: no tests, listening, or validation suite is run.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Field = require('../../mayatnik-xorrom-field.js');
const Music = require('../../mayatnik-xorrom.js');
const ROOT = path.resolve(__dirname, '../../..');
const RATE = 44100;
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function rule90(height) {
  const width = height * 2 - 1, rows = [];
  let row = Array(width).fill(0);
  row[height - 1] = 1;
  for (let y = 0; y < height; y++) {
    rows.push(row.join(''));
    row = row.map((_, x) => (row[x - 1] || 0) ^ (row[x + 1] || 0));
  }
  return {width, height, anchor: height - 1, rows,
    rule: 'B[0,anchor]=1; other initial cells=0; B[y+1,x]=B[y,x-1] XOR B[y,x+1]; outside=0',
    input: 'Own mathematical field; no image, audio, MIDI or external dataset input'};
}

// All effects are explicitly disabled to preserve the timing in the instruction.
const common = {...Music.DEFAULTS, source: 'rgb', chord: 1, gain: .25,
  first: 0, stride: 1, loop: false, live: false, autoGeometry: false,
  backing: 'off', backingGain: .3, backingTimbre: 'sine', backingRows: 4,
  envelopeOn: false, filterType: 'off', lfoTarget: 'off', lfoDepth: 0,
  delayMix: 0, reverbMix: 0, pan: 0, arpMode: 'off', swing: 0};
const electro = {...Music.ELECTRO_PRESET};
const specs = [
  {id: 'xorrom-serpinski', title: 'Серпинский: одна ведущая нота', height: 32,
    description: '32 строки Rule 90, RGB, одна нота, До-мажор, октава 4, 120 BPM, 1/8, треугольник; 8 секунд.',
    parts: [{label: 'Треугольник', patch: {bpm: 120, division: 8, tonic: 0, scale: 'major', octave: 4, timbre: 'triangle'}}]},
  {id: 'xorrom-electro', title: 'Четыре электронных тембра', height: 16,
    description: 'Один 16-строчный Rule 90 повторён четырежды: Пульс → Бас → Металл → Робот; 112 BPM, 1/16, До-минор, октава 3.',
    parts: ['pulse', 'bass', 'metal', 'robot'].map(timbre => ({label: timbre, patch: {...electro, timbre}}))},
  {id: 'xorrom-layers', title: 'Основная партия и фон', height: 32,
    description: 'Один 32-строчный Rule 90 повторён трижды: без фона → созвучие → вторая мелодия; каждый фрагмент около 4,29 с.',
    parts: [
      {label: 'Без фона', patch: {...electro, backing: 'off'}},
      {label: 'Созвучие, синус, 30%, фраза 4 строки', patch: {...electro, backing: 'pad', backingRows: 4}},
      {label: 'Вторая мелодия, синус, 30%, фраза 8 строк', patch: {...electro, backing: 'counter', backingRows: 8}}
    ]}
];

function monoWav(payload) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + payload.length, 4);
  header.write('WAVEfmt ', 8); header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24); header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(payload.length, 40);
  return Buffer.concat([header, payload]);
}

async function main() {
  const items = [];
  for (const spec of specs) {
    const field = rule90(spec.height);
    const snapshot = await Field.capture({width: field.width, height: field.height,
      readBit: (x, y) => Number(field.rows[y][x])});
    const parts = [], payloads = [];
    let cursor = 0;
    for (const part of spec.parts) {
      const settings = Music.normalizeSettings({...common, ...part.patch, last: field.height - 1, loop: false});
      const wav = Music.renderWav(snapshot, settings, {sampleRate: RATE, maxSeconds: 30});
      // With the explicitly disabled effects above, Xorrom emits mono PCM16.
      // Concatenate newly rendered PCM; never read a previous WAV from disk.
      const payload = Buffer.from(wav.bytes.subarray(44));
      const frames = payload.length / 2;
      payloads.push(payload);
      parts.push({label: part.label, startFrame: cursor, frames, startSeconds: cursor / RATE,
        durationSeconds: frames / RATE, settings,
        mainNotes: Music.scoreTimeline(snapshot, settings, {sampleRate: RATE}),
        renderer: {steps: wav.steps, truncated: wav.truncated}});
      cursor += frames;
    }
    const bytes = monoWav(Buffer.concat(payloads));
    const file = spec.id + '.wav';
    fs.writeFileSync(path.join(__dirname, file), bytes);
    const item = {id: spec.id, title: spec.title, description: spec.description, file,
      sampleRate: RATE, channels: 1, bitsPerSample: 16, frames: cursor,
      durationSeconds: cursor / RATE, sha256: sha(bytes), field, parts,
      assembly: 'Concatenated fresh mono PCM segments without gaps, audio inputs, normalization or external effects'};
    items.push(item);
    console.log(`${file}: ${cursor} frames; ${(cursor / RATE).toFixed(6)} s; SHA256 ${item.sha256}`);
  }
  const sourceFiles = ['mayatnik/instruction/assets/build-xorrom-demos.cjs',
    'mayatnik/mayatnik-xorrom.js', 'mayatnik/mayatnik-xorrom-field.js'].map(file => ({file,
      hashEncoding: 'UTF-8, LF', sha256: sha(fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n'))}));
  const manifest = {version: 1, release: '2026-11-18', task: 'ЗВК-001',
    command: 'node mayatnik/instruction/assets/build-xorrom-demos.cjs',
    environment: {node: process.version, platform: process.platform, architecture: process.arch, dependencies: 'Node standard library; two repository Xorrom modules'},
    provenance: {audioInputs: [], externalMelodies: [], importedMidi: [], trainedModels: [],
      melody: 'RGB categories of own Rule 90 fields, mapped to scales by Xorrom; no transcribed melody',
      waveform: 'Xorrom mathematical harmonic oscillators and envelopes; no recordings',
      noiseSeed: null, noiseNote: 'These tonal presets do not request a noise/percussion source',
      replacementReason: 'New documented editions replace earlier teaching WAVs with incomplete build recipes; no claim that old WAVs used borrowed sound'},
    status: 'Produced from source; no automated tests, syntax check, browser check or listening performed',
    sourceFiles, items};
  fs.writeFileSync(path.join(__dirname, 'xorrom-demos.json'), JSON.stringify(manifest, null, 2) + '\n');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
