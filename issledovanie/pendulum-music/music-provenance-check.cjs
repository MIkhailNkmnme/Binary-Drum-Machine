const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repo = process.argv[2] ?? path.resolve(__dirname, '../..');
const moduleFor = name => require(path.join(repo, 'mayatnik', name));
const Engine = moduleFor('mayatnik-synthesis-pendulums.js');
const Music = moduleFor('mayatnik-synthesis-music.js');
const Gallery = moduleFor('synthesis-gallery.js');
const output = path.resolve(process.argv[3] ?? path.join(repo, 'mayatnik/synthesis-album'));
const { music, art } = JSON.parse(fs.readFileSync(path.join(output, 'construction-parameters.json')));
const comparisons = ['empty', 'zero', 'ones', 'other', 'mirror'];
const traits = ['midi', 'velocity', 'pan', 'duration'];
const different = (a, b) => Math.abs(a - b) > 1e-10;
const counts = () => ({ matched: 0, realOnly: 0, controlOnly: 0, midi: 0, velocity: 0, pan: 0, duration: 0, unchanged: 0, maxDelta: { midi: 0, velocity: 0, pan: 0, duration: 0 } });

function model(id) {
  const work = Gallery.works.find(work => work.id === id);
  const engine = Gallery.engineFor(Engine, work, 0);
  assert.deepEqual(engine.options, art.find(work => work.id === id).options);
  return engine;
}

function frame(engine) {
  return {
    a: engine.a, b: engine.b, result: engine.output,
    width: engine.width, height: engine.height, tick: engine.tick
  };
}

function fixed(engine, value) {
  const field = new Int8Array(engine.width * engine.height).fill(value);
  return { a: field, b: field, result: field };
}

function mirrorFrame(input) {
  const mirror = values => {
    const flipped = new Int8Array(values.length);
    for (let index = 0; index < values.length; index += input.width) {
      flipped.set(values.slice(index, index + input.width).reverse(), index);
    }
    return flipped;
  };
  return { ...input, a: mirror(input.a), b: mirror(input.b), result: mirror(input.result) };
}

function tally(count, real, control) {
  if (!real) { count.controlOnly++; return; }
  if (!control) { count.realOnly++; return; }
  assert.equal(real.beat, control.beat);
  count.matched++;
  let unchanged = true;
  for (const trait of traits) {
    if (different(real[trait], control[trait])) {
      count[trait]++;
      count.maxDelta[trait] = Math.max(count.maxDelta[trait], Math.abs(real[trait] - control[trait]));
      unchanged = false;
    }
  }
  if (unchanged) count.unchanged++;
}

function compare(real, control, summary) {
  const voices = new Set([...real, ...control].map(event => event.voice));
  for (const voice of voices) {
    const a = real.filter(event => event.voice === voice);
    const b = control.filter(event => event.voice === voice);
    summary.byVoice[voice] ??= counts();
    for (let index = 0; index < Math.max(a.length, b.length); index++) {
      tally(summary.all, a[index], b[index]);
      tally(summary.byVoice[voice], a[index], b[index]);
    }
  }
}

const report = [];
for (const track of music) {
  const { options, steps, seconds } = track;
  const actual = model(track.work);
  const other = model(music.find(item => item !== track).work);
  const constants = { empty: fixed(actual, -1), zero: fixed(actual, 0), ones: fixed(actual, 1) };
  const summary = Object.fromEntries(comparisons.map(name => [name, { all: counts(), byVoice: {} }]));
  const realEvents = [];
  let pitchExample;
  for (let tick = 0; tick < steps; tick++) {
    const realFrame = frame(actual);
    assert.equal(realFrame.tick, tick);
    const real = Music.frameEvents(realFrame, options);
    const controls = { other: frame(other), mirror: mirrorFrame(realFrame) };
    for (const [name, constant] of Object.entries(constants)) controls[name] = { ...realFrame, ...constant };
    for (const name of comparisons) {
      const controlEvents = Music.frameEvents(controls[name], options);
      compare(real, controlEvents, summary[name]);
      if (name !== 'empty' || pitchExample) continue;
      const voice = options.style === 'techno' ? 'lead' : 'piano';
      const actualMelody = real.filter(event => event.voice === voice).at(-1);
      const controlMelody = controlEvents.filter(event => event.voice === voice).at(-1);
      if (actualMelody && controlMelody && actualMelody.midi !== controlMelody.midi) {
        pitchExample = { tick, seconds: tick * 15 / options.tempo, real: actualMelody, empty: controlMelody };
      }
    }
    realEvents.push(...real);
    actual.step();
    other.step();
  }
  const cadence = [0, 7, 12].map(offset => ({
    beat: steps / 4, duration: 2.4, midi: options.root + offset, velocity: .4,
    voice: options.style === 'techno' ? 'strings' : 'piano', pan: (offset - 7) / 20
  }));
  for (const name of comparisons) compare(cadence, cadence, summary[name]);
  realEvents.push(...cadence);
  assert.equal(realEvents.length, track.events);
  const midiMatches = fs.existsSync(path.join(output, track.file + '.mid')) ? Buffer.from(Music.exportMidi(realEvents, options))
    .equals(fs.readFileSync(path.join(output, track.file + '.mid'))) : null;
  const wavMatches = fs.existsSync(path.join(output, track.file + '.wav')) ? Buffer.from(Music.renderWav(realEvents, options, { durationSeconds: seconds, sampleRate: 44100 }))
    .equals(fs.readFileSync(path.join(output, track.file + '.wav'))) : null;
  report.push({ ...track, cadence, midiMatches, wavMatches, summary, pitchExample });
}
if (process.argv[4]) fs.writeFileSync(path.resolve(process.argv[4]), JSON.stringify(report, null, 2));
for (const { file, midiMatches, wavMatches, summary } of report) {
  console.log(file, 'MIDI', midiMatches, 'WAV', wavMatches);
  for (const name of comparisons) console.log(name, JSON.stringify(summary[name].all));
}
