'use strict';
// Production bridge: serialize newly computed samples, no audio-file inputs.
const Robot = require('../../mayatnik/mayatnik-phone-robot.js');
const rate = 44100;
const midi = 48;
const f0 = 440 * 2 ** ((midi - 69) / 12);
const bits = Array(8).fill(1);
const tilt = .82;
const words = ['zero', 'one'].map(robotWord => {
  const settings = {rate, midi, event: {robotWord, bits, f0, tilt}};
  const samples = Robot.renderVoice(settings);
  return {word: robotWord, settings, samples: Array.from(samples)};
});
process.stdout.write(JSON.stringify({node: process.version, words}));
