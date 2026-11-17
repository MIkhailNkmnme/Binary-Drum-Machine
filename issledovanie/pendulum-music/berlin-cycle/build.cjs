/* ИСС-117 · Produce the original Berlin-cycle sketch from the live module.
 * This is an authoring command, not an application or listening test. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const berlin = require(path.join(root, 'mayatnik/mayatnik-synthesis-berlin.js'));
const music = require(path.join(root, 'mayatnik/mayatnik-synthesis-music.js'));
const steps = 512;
const scene = berlin.createScene();
const options = {...berlin.musicOptions};
const initial = scene.duet.snapshot();
const events = [];
for (let tick = 0; tick < steps; tick++) {
  events.push(...berlin.frameEvents(berlin.toFrame(scene.duet), options));
  scene.duet.step();
}
const secondsPerBeat = 60 / options.tempo;
const musicalSeconds = steps / 4 * secondsPerBeat;
const durationSeconds = Math.max(musicalSeconds, ...events.map(e => (e.beat + e.duration) * secondsPerBeat + .1));
const wavPath = path.join(__dirname, 'berlin-cycle.wav');
const mp3Path = path.join(__dirname, 'berlin-cycle.mp3');
const midiPath = path.join(__dirname, 'berlin-cycle.mid');
fs.writeFileSync(wavPath, music.renderWav(events, options, {durationSeconds, sampleRate:44100}));
fs.writeFileSync(midiPath, music.exportMidi(events, options));
const encoded = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-hide_banner','-loglevel','error','-y','-i',wavPath,'-codec:a','libmp3lame','-b:a','192k',mp3Path], {stdio:'inherit'});
if (encoded.error) throw encoded.error;
if (encoded.status !== 0) throw new Error('FFmpeg exited with '+encoded.status);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const asset = file => { const bytes=fs.readFileSync(file);return {path:path.basename(file),bytes:bytes.length,sha256:hash(bytes)}; };
const sourceFiles = ['mayatnik/mayatnik-synthesis-berlin.js','mayatnik/mayatnik-synthesis-music.js','mayatnik/mayatnik-synthesis-pendulums.js'];
const score = {
  title:'Берлинский цикл · Зеркалиус',version:1,created:'2026-11-17',
  kind:'Original generative sketch; no samples or melody taken from KOBTRAX',
  reference:'https://www.youtube.com/watch?v=f-dUVYPt1Pk',
  referenceBasis:'Author description supplied by the user: imaginary 1975, evolving sequences, analog drift, tape-like noise. Reference audio has not been analysed.',
  listeningAcceptance:'User. Not listened to or browser-tested by the implementers.',
  steps,bars:32,musicalSeconds,durationSeconds,sampleRate:44100,options,
  source:{width:scene.width,height:scene.height,anchor:scene.anchor,initial},
  sources:Object.fromEntries(sourceFiles.map(file=>[file,hash(fs.readFileSync(path.join(root,file)))])),
  files:{wav:asset(wavPath),mp3:asset(mp3Path),midi:asset(midiPath)},
  midiNote:'MIDI preserves note events; PCM drift, noise and timbres belong to the Zerkalius synth.',
  events
};
fs.writeFileSync(path.join(__dirname,'score.json'), JSON.stringify(score,null,2)+'\n');
console.log(JSON.stringify({title:score.title,events:events.length,bars:32,tempo:options.tempo,durationSeconds,files:score.files}));
