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
  const node = () => ({outputs:[],connect(output){this.outputs.push(output);},disconnect(){this.disconnected = true;}});
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
      const source = {...node(), start(at,offset=0){this.at = at;this.offset=offset;},stop(at){this.stopped = at;}};
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

test('manual audition uses the frozen row immediately, cancels the clock, and feeds the existing recording stream', async () => {
  let captures = 0;
  const snap = field(1, 2, 3);
  const r = rig(() => { captures++; return snap; }, {bpm:180, division:16});
  assert.equal(await r.engine.seek(1), false);
  assert.equal(captures, 0);
  await r.engine.start();
  const stream = r.engine.getStream();
  r.advance(74);
  const queued = r.sources.at(-1);
  assert.ok(queued.at > r.ctx().currentTime);
  assert.equal(await r.engine.seek(2), true);
  assert.ok(queued.stopped < queued.at);
  assert.equal(r.engine.getState(), 'paused');
  assert.equal(r.timers.size, 0);
  const preview = r.sources.at(-1), event = r.events.at(-1);
  assert.equal(preview.at, r.ctx().currentTime);
  assert.ok(preview.buffer.getChannelData().some(n => n !== 0));
  assert.equal(preview.outputs[0].outputs[0].outputs[0].outputs.some(out => out.stream === stream), true);
  assert.equal(event.manual, true); assert.equal(event.index, 2); assert.equal(event.row, snap.rows[2]);
  assert.equal(event.notes[0].code, 3);
  const before = r.sources.length;
  await r.engine.seek(2);
  assert.equal(r.sources.length, before + 1); assert.ok(preview.stopped <= preview.at + 0.01);
  r.advance(2000);
  assert.deepEqual(r.events.map(e => e.index), [0, 2, 2]);
  assert.equal(captures, 1); assert.equal(r.engine.getStream(), stream);
});

test('manual seek clamps to the active range and resumes from an off-stride row', async () => {
  const r = rig(() => field(1,2,3,4,5,6,7), {first:1, last:5, stride:2, bpm:180, division:16, loop:false});
  await r.engine.start(); r.engine.pause();
  assert.equal(await r.engine.seek(NaN), false);
  assert.equal(await r.engine.seek(Infinity), false);
  const before = r.sources.length;
  await r.engine.seek(-5, {audition:false});
  await r.engine.seek(99, {audition:false});
  r.engine.setSettings({last:100});
  await r.engine.seek(99, {audition:false});
  assert.deepEqual(r.events.map(e => e.index), [1, 5, 6]);
  assert.equal(r.sources.length, before);
  await r.engine.seek(2);
  const preview = r.sources.at(-1);
  await r.engine.start();
  assert.ok(preview.stopped < r.sources.at(-1).at);
  r.advance(360);
  assert.deepEqual(r.events.filter(e => !e.manual).map(e => e.index), [2,4,6]);
  assert.equal(r.engine.getState(), 'stopped');
});

test('only the latest drag row may sound after asynchronous AudioContext resume', async () => {
  const r = rig(); await r.engine.start(); r.engine.pause();
  const d = deferred(); r.ctx().state = 'suspended';
  r.ctx().resume = async () => { await d.promise; r.ctx().state = 'running'; };
  const before = r.sources.length;
  const older = r.engine.seek(1), newer = r.engine.seek(2);
  d.resolve();
  assert.deepEqual(await Promise.all([older, newer]), [false, true]);
  assert.deepEqual(r.events.map(e => e.index), [2]); assert.equal(r.sources.length, before + 1);
  assert.equal(r.engine.getState(), 'paused');
});

test('pause, stop, hide, suspension and restart supersede a pending or sounding audition', async () => {
  const actions = {
    pause: r => r.engine.pause(), stop: r => r.engine.stop(),
    hide: r => { r.doc.hidden = true; r.doc.dispatchEvent(new Event('visibilitychange')); },
    suspend: r => { r.ctx().state = 'suspended'; r.ctx().dispatchEvent(new Event('statechange')); },
    restart: r => r.engine.start(), dispose: r => r.engine.dispose()
  };
  for (const [name, act] of Object.entries(actions)) {
    const r = rig(); await r.engine.start(); await r.engine.seek(1);
    const preview = r.sources.at(-1);
    await act(r);
    assert.ok(Number.isFinite(preview.stopped), name);

    const pending = rig(); await pending.engine.start(); pending.engine.pause();
    const d = deferred(); pending.ctx().state = 'suspended';
    pending.ctx().resume = async () => { await d.promise; pending.ctx().state = 'running'; };
    const seek = pending.engine.seek(2), next = act(pending);
    d.resolve();
    assert.equal(await seek, false, name);
    await next;
    pending.advance(40);
    assert.deepEqual(pending.events.map(e => [e.index, !!e.manual]), name === 'restart' ? [[2,false]] : [], name);
  }
});

test('a new silent frame immediately cancels old notes and resumes at the last sounding row', async () => {
  let captures = 0;
  const r = rig(() => { captures++; return field(1,2,3,4); }, {bpm:180, division:16});
  await r.engine.start(); r.advance(155);
  assert.equal(r.events.at(-1).index, 1);
  const oldQueue = r.sources.at(-1);
  assert.ok(oldQueue.at > r.ctx().currentTime);
  const before = r.sources.length, silent = field(0,0,0);
  assert.equal(r.engine.replaceSnapshot(silent), 1);
  assert.equal(r.engine.getState(), 'paused'); assert.equal(r.timers.size, 0);
  assert.ok(oldQueue.stopped < oldQueue.at);
  assert.equal(r.events.at(-1).row, silent.rows[1]); assert.deepEqual(r.events.at(-1).notes, []);
  const count = r.events.length;
  await r.engine.start(); r.advance(300);
  assert.equal(captures, 1); assert.equal(r.sources.length, before);
  assert.deepEqual(r.events.slice(count).map(e => e.index), [1,2,0,1]);
  assert.ok(r.events.slice(count).every(e => !e.notes.length));
});

test('replacing a paused score clamps the selection, stops a preview and invalidates pending seek', async () => {
  const r = rig(() => field(1,2,3,4,5), {first:1, last:4});
  await r.engine.start(); await r.engine.seek(4);
  const previous = r.sources.at(-1), shorter = field(1,7,6);
  assert.equal(r.engine.replaceSnapshot(shorter), 2); assert.ok(Number.isFinite(previous.stopped));
  assert.equal(r.events.at(-1).notes[0].code, 6); assert.equal(r.events.at(-1).manual, true);
  const d = deferred(); r.ctx().state = 'suspended';
  r.ctx().resume = async () => { await d.promise; r.ctx().state = 'running'; };
  const obsolete = r.engine.seek(1);
  assert.equal(r.engine.replaceSnapshot(field(3,4), {index:-9}), 1);
  d.resolve(); assert.equal(await obsolete, false);
  assert.equal(r.events.at(-1).notes[0].code, 4);
  assert.equal(r.engine.replaceSnapshot(field()), -1);
  assert.equal(r.engine.getState(), 'stopped');
  assert.equal(r.engine.replaceSnapshot(shorter), -1);
});

test('frame replacements every 16ms keep the original musical beat and sample position', async () => {
  const r = rig(() => field(1,2,3,4), {bpm:120, division:16, loop:true});
  await r.engine.start();
  for (let frame = 1; frame <= 40; frame++) {
    r.advance(13);
    r.engine.beginRefresh();
    const oldCount = r.sources.length;
    r.advance(3);
    const now = r.ctx().currentTime, step = 0.125;
    const silent = frame % 4 === 0;
    const fresh = silent ? field(0,0,0,0) : field(7,6,5,4);
    const beat = Math.max(0, Math.floor((now - 0.035) / step));
    const index = r.engine.replaceSnapshot(fresh, {resume:true});
    assert.equal(index, beat % 4, 'frame ' + frame);
    assert.equal(r.engine.getState(), 'playing');
    const newSources = r.sources.slice(oldCount);
    if (silent) assert.equal(newSources.length, 0);
    if (now < 0.035) continue;
    assert.equal(r.events.at(-1).row, fresh.rows[index]);
    const offset = now - (0.035 + beat * step);
    const active = newSources.filter(s => s.at === now);
    if (silent || offset >= step * 0.86) { assert.equal(active.length, 0); continue; }
    assert.equal(active.length, 1);
    assert.ok(Math.abs(active[0].offset - offset) < 1e-6);
  }
  assert.deepEqual([...new Set(r.events.map(e => e.index))], [0,1,2,3]);
});

test('slow and coalesced frame replacements respect a non-looping score and user transport overrides', async () => {
  const r = rig(() => field(1,2,3,4,5,6), {first:1, last:5, stride:2, bpm:120, division:16, loop:false});
  await r.engine.start();
  r.advance(40); r.engine.beginRefresh(); r.advance(120); r.engine.beginRefresh(); r.advance(130);
  assert.equal(r.engine.replaceSnapshot(field(0,1,2,3,4,5), {resume:true}), 5);
  assert.equal(r.events.at(-1).notes[0].code, 5);
  r.engine.beginRefresh(); r.advance(200);
  assert.equal(r.engine.replaceSnapshot(field(0,1,2,3,4,5), {resume:true}), -1);
  assert.equal(r.engine.getState(), 'stopped');

  for (const interrupt of [r => r.engine.pause(), r => r.engine.seek(2), r => r.engine.stop(),
    r => { r.doc.hidden = true; r.doc.dispatchEvent(new Event('visibilitychange')); r.doc.hidden = false; }]) {
    const t = rig();
    await t.engine.start(); t.advance(50); t.engine.beginRefresh();
    await interrupt(t);
    t.engine.replaceSnapshot(field(7,6,5), {resume:true});
    assert.notEqual(t.engine.getState(), 'playing'); assert.equal(t.timers.size, 0);
  }
});
