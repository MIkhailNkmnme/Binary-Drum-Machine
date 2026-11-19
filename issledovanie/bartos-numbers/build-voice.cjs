'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const enginePath = '../../voice/engine.js';
const germanPath = '../../voice/german.js';
require(enginePath);
require(germanPath);

const bank = { ...globalThis.ZerkaliusVoice, engineId: 'bank' };
const german = globalThis.VoiceGerman;
const bpm = 67;
const pulses = ['1', '2', '3', '4', null, '5', '6', '7', '8', null];
const sampleRate = bank.limits.sampleRate;
const seed = 0x5a45524b;
const settings = {
  ...bank.defaults, pitchStart: 118, pitchEnd: 102, vibratoDepth: 0.7, outputGain: 0.72, seed,
};

function wav(samples) {
  const bytes = Buffer.alloc(44 + samples.length * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(2 * sampleRate, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(2 * samples.length, 40);
  for (let i = 0; i < samples.length; i++) bytes.writeInt16LE(Math.round(samples[i] * 32767), 44 + 2 * i);
  return bytes;
}

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const digits = new Map(german.catalog.filter(recipe => recipe.kind === 'digit').map(recipe => [recipe.symbol, recipe]));
const starts = Array.from({ length: pulses.length + 1 }, (_, pulse) => Math.round(pulse * 60 / bpm * sampleRate));
const samples = new Float32Array(starts.at(-1));
const words = [];
for (const [pulse, digit] of pulses.entries()) {
  if (digit === null) continue;
  const recipe = digits.get(digit);
  const phones = german.resolve(bank, {}, recipe.score);
  const wordSettings = { ...settings, seed: (seed + pulse) >>> 0 };
  const rendered = bank.render({ score: recipe.score, phones, settings: wordSettings });
  const startSample = starts[pulse];
  if (startSample + rendered.samples.length > starts[pulse + 1]) {
    throw Error('Word exceeds its pulse: ' + recipe.label);
  }
  samples.set(rendered.samples, startSample);
  words.push({
    pulse: pulse + 1, digit, text: recipe.label, recipe: recipe.id, score: recipe.score, phones,
    seed: wordSettings.seed, startSample, sampleCount: rendered.samples.length,
  });
}
const audio = wav(samples);
const filename = 'count-de-procedural.wav';
fs.writeFileSync(path.join(__dirname, filename), audio);
const manifest = {
  title: 'Немецкий счёт на сетке 67 BPM', language: 'de', bpm, pulses, sampleRate,
  duration: samples.length / sampleRate, sourceAudio: [],
  renderer: 'Ядро Codex', engineVersion: bank.version, germanVersion: german.version, node: process.version,
  sources: [enginePath, germanPath].map(file => ({ path: file, sha256: hash(fs.readFileSync(path.join(__dirname, file))) })),
  settings, words, file: filename, sha256: hash(audio),
};
fs.writeFileSync(path.join(__dirname, 'voice-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(filename + ' · ' + manifest.duration.toFixed(3) + ' s · ' + manifest.sha256);
