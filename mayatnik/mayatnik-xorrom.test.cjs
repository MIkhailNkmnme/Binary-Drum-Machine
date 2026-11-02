'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {DEFAULTS, normalizeSettings, frequency, notesForRow, renderWav, create} = require('./mayatnik-xorrom.js');

const rgb = (code, count = 1) => ({ones: 1, colors: Uint32Array.from({length: 8}, (_, i) => i === code ? count : 0)});
const field = (...codes) => ({rows: codes.map(code => rgb(code))});
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}
test('persistable numeric and enum settings, mute, false and end sentinel survive normalization', () => {
  assert.deepEqual(normalizeSettings(), DEFAULTS);
  assert.deepEqual(normalizeSettings({bpm: 4, division:'16', gain:0, live:true, loop:false, stride:-20,
    scale:'__proto__', octave:null, last:-17}), {...DEFAULTS, bpm:60, division:16, gain:0, live:true, loop:false});
  assert.deepEqual(normalizeSettings(JSON.parse(JSON.stringify(DEFAULTS))), DEFAULTS);
});
test('семь RGB классов, мажор до, чёрная пауза, верхние три класса с устойчивой ничьей', () => {
  assert.deepEqual(Array.from({length:7}, (_, i) => notesForRow(rgb(i+1), i)[0].midi), [60,62,64,65,67,69,71]);
  assert.deepEqual(notesForRow(rgb(0), 0), []);
  assert.equal(frequency(69), 440);
  const row = {colors: new Uint32Array([100,1,5,5,6,0,7,0])};
  assert.deepEqual(notesForRow(row, 0).map(n => n.code), [6,4,2]);
  assert.deepEqual(notesForRow(row, 0, {chord:4}).map(n => n.code), [6,4,2,3]);
  assert.equal(notesForRow(rgb(7), 0, {scale:'pentatonic', tonic:2, octave:3})[0].midi, 64);
});
test('сумма единиц и нулевая строка; удары по трём дорожкам пропускают скрытые ячейки', () => {
  const melody = {source:'melody'};
  assert.deepEqual(notesForRow({ones:0}, 3, melody), []);
  assert.equal(notesForRow({ones:1}, 0, melody)[0].degree, 2);
  assert.equal(notesForRow({ones:7}, 0, melody)[0].degree, 1);
  const row = {ones:2, bits:Int8Array.from([-1,1,0,0,0,1])};
  assert.deepEqual(notesForRow(row, 0, {source:'rhythm'}).map(n => n.drum), ['snare','hat']);
});
function samples(bytes) {
  const out = [], view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i=44; i<bytes.length; i+=2) out.push(view.getInt16(i, true));
  return out;
}
test('WAV is deterministic mono PCM, with real notes, rests and the live pitch A4', () => {
  const snap = field(6,0), settings = {bpm:120, division:4, timbre:'sine', gain:1};
  const a = renderWav(snap, settings);
  assert.deepEqual(renderWav(snap, settings).bytes, a.bytes);
  assert.equal(Buffer.from(a.bytes.subarray(0,4)).toString(), 'RIFF');
  assert.equal(Buffer.from(a.bytes.subarray(8,12)).toString(), 'WAVE');
  assert.equal(new DataView(a.bytes.buffer).getUint32(24,true), 22050);
  assert.equal(a.duration,1); assert.equal(a.steps,2); assert.equal(a.truncated,false);
  const pcm = samples(a.bytes);
  const crossings = pcm.slice(1,2206).filter((s,i) => s > 0 && pcm[i] <= 0).length;
  assert.ok(Math.abs(crossings-44) <= 1);
  assert.ok(pcm.slice(11025).every(s => s === 0));
  assert.ok(samples(renderWav(snap,{...settings,gain:0}).bytes).every(s => s === 0));
});
test('WAV respects row bounds and stride, fades a capped final step and rejects an empty field', () => {
  const a = renderWav(field(0,6,0,6,0), {bpm:120, division:4, first:1,last:3,stride:2},
    {sampleRate:44100,maxSeconds:0.55});
  assert.equal(a.steps,2); assert.equal(a.duration,0.55); assert.equal(a.truncated,true);
  const pcm = samples(a.bytes);
  assert.ok(pcm.slice(-800).some(x => x > 0)); assert.equal(pcm.at(-1),0);
  assert.throws(() => renderWav({rows:[]}), /строк/);
});
function rig(getSnapshot = () => field(1,2,3), settings = {}) {
  let ms = 0, serial = 0, ctx;
  const events = [], states = [], sources = [], timers = new Map();
  const param = () => ({value:1, setValueAtTime(){}, linearRampToValueAtTime(){}, setTargetAtTime(){}});
  const node = () => ({connect(){},disconnect(){this.disconnected = true;}});
  const doc = new EventTarget(); doc.hidden = false;
  class Context extends EventTarget {
    constructor() { super(); ctx = this; this.destination = node(); this.state = 'suspended'; }
    get currentTime() { return ms / 1000; }
    async resume() { this.state = 'running'; }
    async close() { this.state = 'closed'; }
    createGain() { return {...node(), gain:param()}; }
    createBuffer(channels, length, rate) {
      const data = new Float32Array(length);
      return {getChannelData:()=>data, duration:length/rate};
    }
    createMediaStreamDestination() { return {...node(), stream:{getTracks:()=>[]}}; }
    createBufferSource() {
      const source = {...node(), start(at){this.at = at;},stop(at){this.stopped = at;}};
      sources.push(source); return source;
    }
  }
  function advance(delta) {
    const end = ms + delta;
    for (;;) {
      const entry = [...timers].sort((a,b) => a[1].ms - b[1].ms)[0];
      if (!entry || entry[1].ms > end) break;
      ms = entry[1].ms; timers.delete(entry[0]); entry[1].fn();
    }
    ms = end;
  }
  const engine = create({AudioContext:Context, document:doc, getSnapshot, settings, onState:s=>states.push(s),
    onStep:e=>events.push({...e, observed:ms/1000}),
    setTimeout(fn,delay){timers.set(++serial,{ms:ms+delay,fn});return serial;}, clearTimeout(id){timers.delete(id);} });
  return {engine, doc, sources, states, events, advance, stall(delta){ms += delta;}, timers,
    wakeLate(){const [id,event] = [...timers][0]; timers.delete(id); event.fn();}, ctx:()=>ctx};
}
test('audio clock schedules notes in advance, UI sees actual onset and one-shot finishes', async () => {
  const r = rig(() => field(1,2,3),{bpm:120,division:8,loop:false});
  assert.equal(await r.engine.start(),true);
  assert.equal(r.events.length,0); assert.equal(r.sources[0].at,0.035);
  assert.ok(r.sources[0].buffer.getChannelData().some(n => n !== 0));
  r.advance(800);
  assert.deepEqual(r.events.map(e=>e.index),[0,1,2]);
  assert.deepEqual(r.sources.map(s=>Math.round(s.at*1000)),[35,285,535]);
  for (const e of r.events) assert.ok(e.observed >= e.time && e.observed - e.time < 0.002);
  assert.deepEqual(r.states,['playing','stopped']);
  assert.equal(r.timers.size,0);
});
test('pause cancels queued voices, resumes same unplayed row, stop takes a fresh snapshot on restart', async () => {
  let captures = 0;
  const r = rig(() => {captures++;return field(1,2,3,4);},{bpm:180,division:16});
  await r.engine.start(); r.advance(74);
  assert.equal(r.sources.length,2);
  r.engine.pause(); const n = r.events.length;
  assert.ok(r.sources[1].stopped < r.sources[1].at);
  r.advance(1000); assert.equal(r.events.length,n);
  await r.engine.start(); r.advance(40);
  assert.deepEqual(r.events.map(e=>e.index),[0,1]); assert.equal(captures,1);
  r.engine.stop(); await r.engine.start(); r.advance(40);
  assert.equal(r.events.at(-1).index,0); assert.equal(captures,2);
});
test('pending field acquisition cannot resurrect playback after stop or hiding the tab', async () => {
  const d = deferred(), r = rig(() => d.promise);
  const started = r.engine.start(); await Promise.resolve();
  r.engine.stop(); d.resolve(field(1)); assert.equal(await started,false);
  assert.deepEqual(r.states,[]); assert.equal(r.sources.length,0);
  const d2=deferred(), r2=rig(()=>d2.promise);
  const started2=r2.engine.start(); await Promise.resolve();
  r2.doc.hidden=true; r2.doc.dispatchEvent(new Event('visibilitychange')); r2.doc.hidden=false;
  d2.resolve(field(3)); assert.equal(await started2,false); assert.equal(r2.timers.size,0);
});
test('async live snapshot taken only on wrap; pending refresh is invalidated by stop', async () => {
  const d = deferred(); let count=0;
  const r = rig(()=>(++count===1?field(1,2):d.promise),{live:true,bpm:120,division:8});
  await r.engine.start(); r.advance(300);
  assert.equal(count,1); assert.deepEqual(r.events.map(e=>e.notes[0].code),[1,2]);
  r.advance(400); assert.equal(count,2); assert.equal(r.events.length,2);
  d.resolve(field(7)); await Promise.resolve(); r.advance(60);
  assert.equal(r.events.at(-1).notes[0].code,7);
  r.engine.stop();r.advance(1000);assert.equal(r.timers.size,0);
});
test('hidden, suspended or stalled audio does not cause a burst or unwanted auto-resume', async () => {
  const r = rig(); await r.engine.start(); r.advance(40);
  r.stall(4000); r.wakeLate(); r.advance(3);
  assert.equal(r.events.length,2); assert.ok(r.sources.at(-1).at >= 4);
  r.ctx().state='suspended';r.ctx().dispatchEvent(new Event('statechange'));
  assert.equal(r.engine.getState(),'paused');r.advance(3000);assert.equal(r.events.length,2);
  r.ctx().state='running'; await r.engine.start();
  r.doc.hidden=true;r.doc.dispatchEvent(new Event('visibilitychange'));r.doc.hidden=false;
  r.advance(1000);assert.equal(r.engine.getState(),'paused');
  const stream=r.engine.getStream();assert.equal(stream,r.engine.getStream());
  await r.engine.dispose();assert.equal(await r.engine.start(),false);
});

test('late live refresh cannot replace the snapshot after a stop and new play', async () => {
  const pending = deferred(); let count = 0;
  const r = rig(() => [field(1),pending.promise,field(7)][count++], {live:true, bpm:180,division:16});
  await r.engine.start();r.advance(75);assert.equal(count,2);
  r.engine.stop();await r.engine.start({loop:false});pending.resolve(field(2));await Promise.resolve();
  r.advance(200);assert.deepEqual(r.events.map(e=>e.notes[0].code),[1,7]);
  assert.equal(r.engine.getState(),'stopped');
});
test('pause in the last milliseconds before onset silences the scheduled source immediately', async () => {
  const r=rig();await r.engine.start();r.advance(34);r.engine.pause();
  assert.ok(r.sources[0].stopped < r.sources[0].at);
  assert.equal(r.events.length,0);
});
test('a rejected capture propagates on first play, empty captures stop cleanly', async () => {
  const failure=rig(async()=>{throw new Error('Лимит поля');});
  await assert.rejects(failure.engine.start(),/Лимит поля/);assert.equal(failure.timers.size,0);
  assert.equal(await rig(()=>field()).engine.start(),false);
});
