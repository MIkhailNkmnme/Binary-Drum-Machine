'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {DEFAULTS, normalizeSettings, effectiveSettings, frequency, notesForRow, renderWav, create} = require('./mayatnik-xorrom.js');

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
    scale:'__proto__', octave:null, last:-17}), {...DEFAULTS, bpm:4, division:16, gain:0, live:true, loop:false});
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
test('positive finite BPM survives normalization and round-trip with fractional or extreme values',()=>{
  for(const bpm of [.5,1,30,250,999,123.45,Number.MIN_VALUE,Number.MAX_VALUE]){
    assert.equal(normalizeSettings(JSON.parse(JSON.stringify({bpm}))).bpm,bpm);
  }
  for(const bpm of [0,-2,'',null,Infinity,NaN])assert.equal(normalizeSettings({bpm}).bpm,DEFAULTS.bpm);
  assert.throws(()=>renderWav(field(1),{bpm:Number.MAX_VALUE}),/звукового отсчёта/);
  assert.throws(()=>renderWav(field(1),{bpm:Number.MIN_VALUE}),/звукового отсчёта/);
  const slow={division:4,bpm:60*22050/(Number.MAX_SAFE_INTEGER*.75),backing:'bass',backingRows:2};
  assert.throws(()=>renderWav(field(1,2),slow,{maxSeconds:.01}),/фоновой фразы/);
  assert.throws(()=>renderWav(field(1),slow,{sampleRate:44100,maxSeconds:.01}),/фоновой фразы/);
  assert.equal(renderWav(field(1,2),{bpm:250,division:4}).duration,.48);
});
test('long held backing is streamed across sample-exact chunk boundaries; WAV renders only its requested window',async()=>{
  const settings={bpm:.5,division:4,backing:'bass',backingRows:4,backingGain:.5,gain:1,loop:false},snap=field(1,2,3,4);
  const r=rig(()=>snap,settings);await r.engine.start();
  const first=r.sources[1],second=r.sources[2],rate=22050;
  assert.equal(first.buffer.duration,1);assert.equal(second.at,first.at+1);
  first.onended();const third=r.sources[3];assert.equal(third.at,first.at+2);assert.equal(third.buffer.duration,1);
  const wav=renderWav(snap,settings,{maxSeconds:3}),mixed=mixScheduled(r,3*rate),pcm=samples(wav.bytes);
  assert.equal(wav.truncated,true);assert.equal(wav.duration,3);
  for(const i of [rate-1,rate,rate+1,2*rate-1,2*rate,2*rate+1]){
    assert.ok(Math.abs(pcm[i]-Math.round(mixed[i]*32767))<=1,'continuous sample '+i);
  }
  r.advance(120);r.engine.setSettings({bpm:250});r.advance(550);
  assert.ok(r.events.some(e=>e.index>0),'editing a slow beat releases its previous long deadline');
  const length=r.sources.length;r.engine.stop();second.onended();assert.equal(r.sources.length,length);
});
test('a high but sample-representable tempo schedules bounded batches and skips a stalled clock interval',async()=>{
  const r=rig(()=>field(1,2,3),{bpm:240000,division:16});await r.engine.start();
  assert.equal(r.sources.length,64);r.advance(40);r.stall(5000);
  const count=r.sources.length;r.wakeLate();assert.ok(r.sources.length-count<=64);
  assert.ok(r.sources.slice(count).every(v=>v.at>=r.ctx().currentTime-1e-10));r.engine.stop();
});
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

test('restart on each 16 ms frame sounds both parts immediately from selected first; paused and hidden replacements are silent',async()=>{
  const snap=field(1,2,3,4,5,6),r=rig(()=>snap,{first:1,last:5,stride:2,backing:'pad',backingRows:2});
  assert.equal(await r.engine.start(),true);
  for(let i=0;i<12;i++){
    r.advance(16);r.engine.beginRefresh();
    const count=r.sources.length,now=r.ctx().currentTime;
    assert.equal(r.engine.replaceSnapshot(snap,{index:5,resume:true,restart:true}),1);
    const played=r.events.at(-1),voices=r.sources.slice(count);
    assert.equal(played.index,1);assert.equal(played.time,now);assert.ok(played.notes.length&&played.backing.notes.length);
    assert.equal(voices.length,played.notes.length+played.backing.notes.length);
    assert.ok(voices.every(v=>v.at===now&&v.offset===0));
  }
  r.engine.beginRefresh();const count=r.sources.length;
  r.engine.replaceSnapshot(snap,{index:1,resume:false,restart:true});assert.equal(r.engine.getState(),'paused');
  r.doc.hidden=true;r.engine.replaceSnapshot(snap,{index:1,resume:true,restart:true});
  assert.equal(r.engine.getState(),'paused');assert.equal(r.sources.length,count);r.engine.stop();
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

const hole = Object.freeze({id:21, bit:0, orientation:'down', triangleScore:1, exterior:false,
  width:16, height:8, area:72, perimeter:48, symmetryHeight:8});
const spike = Object.freeze({id:22, bit:1, orientation:'up', triangleScore:1, exterior:false,
  width:2, height:4, area:5, perimeter:12, symmetryHeight:1});
const section = (code, zero, one) => ({...rgb(code), geometry:{zero,one}});
test('region parameters stay fixed across an inverted zero triangle down to its tip', () => {
  const settings = Object.freeze({...DEFAULTS, autoGeometry:true, gain:.8});
  const rows = [section(1, hole, spike), section(2, hole, null), section(0, hole, {...spike, area:512})];
  const expected = effectiveSettings(settings, rows[0]);
  for (const row of rows) assert.deepEqual(effectiveSettings(settings, row), expected);
  assert.deepEqual([expected.tonic, expected.division, expected.timbre, expected.chord, expected.scale, expected.octave],
    [6,4,'softsquare',4,'major',5]);
  assert.equal(expected.gain, .8 * (.4 + .6 * 72/128));
  assert.deepEqual(notesForRow(rows[2], 2, settings), []);
  for (const source of ['rgb','melody','rhythm'])
    assert.deepEqual(notesForRow({...rows[0],ones:0},0,{...settings,source}),[]);
  assert.equal(effectiveSettings({...settings,gain:0}, rows[0]).gain, 0);
  assert.deepEqual(effectiveSettings(DEFAULTS, rows[0]), DEFAULTS);
  assert.deepEqual(effectiveSettings(settings, {geometry:{triangle:hole, zero:null, one:spike}}), expected);
  assert.deepEqual(effectiveSettings(settings, rgb(3)), settings);
  assert.equal(normalizeSettings({autoGeometry:'true',geometrySource:'bad',geometryConnectivity:'bad'}).autoGeometry, false);
  for (const mode of ['sides','corners','diagonal','chess0','bit'])
    assert.equal(normalizeSettings({geometryConnectivity:mode}).geometryConnectivity, mode);
});

test('geometry source changes only the controls driven by that measurement', () => {
  const row = section(4, null, spike);
  const base = {...DEFAULTS, autoGeometry:true};
  const groups = {regions:['division','timbre'], areas:['tonic','gain','chord'], symmetry:['octave','scale']};
  const all = effectiveSettings(base,row);
  for (const [geometrySource, keys] of Object.entries(groups)) {
    const settings = {...base,geometrySource}, effective = effectiveSettings(settings,row);
    for (const key of Object.keys(settings)) assert.equal(effective[key], keys.includes(key) ? all[key] : settings[key], key);
  }
});

test('mixed geometry uses the same onset, pitch, PCM, gain and duration for playback, audition and WAV', async () => {
  const rows = [section(1,hole,spike), section(6,null,spike), section(7,hole,null)];
  const settings = {...DEFAULTS,bpm:120,autoGeometry:true,gain:.7,loop:false}, snap = {rows};
  const r = rig(() => snap, settings);
  await r.engine.start(); r.advance(1140);
  assert.deepEqual(r.events.map(e => +e.time.toFixed(3)), [.035,.535,.660]);
  assert.deepEqual(r.events.map(e => e.geometry), [hole,spike,hole]);
  const wav = renderWav(snap,settings), pcm = samples(wav.bytes);
  assert.equal(wav.bytes.length, 44+2*Math.round(1.125*wav.sampleRate));
  for (const [i, event] of r.events.entries()) {
    assert.deepEqual(event.effective, effectiveSettings(settings,rows[i]));
    const source = r.sources[i], tone = source.buffer.getChannelData();
    const gain = source.outputs[0].gain.value * settings.gain;
    assert.ok(Math.abs(gain-event.effective.gain) < 1e-10);
    const offset = Math.round((event.time-.035)*wav.sampleRate);
    for (const j of [1,10,100,200]) assert.equal(pcm[offset+j], Math.round(tone[j]*gain*32767));
  }
  await r.engine.start(); await r.engine.seek(1);
  const manual = r.events.at(-1);
  assert.equal(manual.geometry,spike);
  assert.deepEqual(manual.effective,r.events[1].effective);
  assert.deepEqual(manual.notes,r.events[1].notes);
  assert.deepEqual(r.sources.at(-1).buffer.getChannelData(),r.sources[1].buffer.getChannelData());
  assert.equal(renderWav(snap,settings,{maxSeconds:.625}).steps,2);
  assert.equal(renderWav(snap,settings,{maxSeconds:.625}).truncated,true);
});

test('frame replacement keeps fractional progress when geometry shortens the sounding beat', async () => {
  const original={rows:[section(1,hole,null),section(1,hole,null)]};
  const fresh={rows:[section(7,null,spike),section(3,hole,null)]};
  const r=rig(() => original,{autoGeometry:true,bpm:120,loop:true});
  await r.engine.start(); r.advance(270);
  r.engine.beginRefresh(); r.advance(15);
  assert.equal(r.engine.replaceSnapshot(fresh,{resume:true}),0);
  const now = r.ctx().currentTime, preview = r.sources.findLast(s => s.at === now);
  assert.ok(Math.abs(preview.offset - .0625)<1e-9);
  assert.equal(r.events.at(-1).geometry,spike);
  assert.equal(r.events.at(-1).notes[0].code,7);
  // A second rebuild before the deadline must keep the same musical phase.
  r.advance(20);r.engine.beginRefresh();r.advance(8);
  assert.equal(r.engine.replaceSnapshot(fresh,{resume:true}),0);
  r.advance(70);
  assert.equal(r.events.at(-1).geometry,hole);
  assert.ok(Math.abs(r.events.at(-1).time-.3475)<1e-9);
});


const electroKinds=['bass','pulse','metal','robot'];
test('electronic voices persist, sound deterministically, stay bounded, honour mute and rest, and remain distinct',()=>{
 const hashes=new Set(),crypto=require('node:crypto');
 for(const timbre of electroKinds){assert.equal(normalizeSettings({timbre}).timbre,timbre);
  for(const sampleRate of [22050,44100]){
   const settings={timbre,bpm:120,division:8,gain:1,chord:1},a=renderWav(field(1,0),settings,{sampleRate}),pcm=samples(a.bytes);assert.deepEqual(renderWav(field(1,0),settings,{sampleRate}).bytes,a.bytes);assert.ok(pcm.some(s=>Math.abs(s)>100));assert.ok(pcm.every(s=>Number.isFinite(s)&&Math.abs(s)<32767));assert.equal(pcm[0],0);assert.ok(pcm.slice(Math.round(sampleRate*.25)).every(s=>s===0));assert.ok(samples(renderWav(field(1),{...settings,gain:0},{sampleRate}).bytes).every(s=>s===0));
   if(sampleRate===22050)hashes.add(crypto.createHash('sha256').update(a.bytes).digest('hex'));
  }
 }
 assert.equal(hashes.size,4);
});
test('the four previous timbres retain their 0.859 PCM byte-for-byte',()=>{
 const expected={sine:'fd237a0d877cf15e91134ffab0c764847b4427a36b21b03456fd8841c8b76a4f',triangle:'5eff8068b8473d2d7d19658390ef8044b50fc8d2140a7fb2b1aa385b8d04a065',pluck:'e651931feecc075656efc57b516c6ce6d78082edcbde2c38da0027c7e5708957',softsquare:'6fc2b5c2272083e2526c60b58b4ce1bac978cce02f54b6f6feb4ede50f2e6058'},crypto=require('node:crypto');
 for(const [timbre,wanted]of Object.entries(expected)){const r=renderWav(field(1,2,3,4,5,6,7,0),{bpm:120,division:16,timbre,gain:.25,chord:1});assert.equal(crypto.createHash('sha256').update(r.bytes).digest('hex'),wanted);}
});
test('live, seek and WAV share exactly the same electronic PCM',async()=>{
 for(const timbre of electroKinds){const settings={...require('./mayatnik-xorrom.js').ELECTRO_PRESET,timbre,division:8,loop:false},snap=field(2),r=rig(()=>snap,settings);await r.engine.start();r.advance(40);const tone=r.sources[0].buffer.getChannelData(),pcm=samples(renderWav(snap,settings).bytes);
  for(let i=0;i<tone.length;i++)assert.equal(pcm[i],Math.round(tone[i]*settings.gain*32767)||0);await r.engine.seek(0);assert.deepEqual(r.sources.at(-1).buffer.getChannelData(),tone);await r.engine.dispose();}
});
test('robot formants follow RGB category even when two settings give the same MIDI pitch',async()=>{
 const r=rig(()=>field(2,4),{timbre:'robot',loop:false});await r.engine.start();r.advance(40);const first=r.sources[0].buffer.getChannelData(),pitch=r.events[0].notes[0].midi;r.engine.pause();r.engine.setSettings({tonic:9,octave:3});await r.engine.seek(1);assert.equal(r.events.at(-1).notes[0].midi,pitch);assert.notDeepEqual(r.sources.at(-1).buffer.getChannelData(),first);await r.engine.dispose();
});


test('backing settings validate independently and older links default to one instrument',()=>{
 assert.deepEqual(normalizeSettings({backing:'bad',backingTimbre:'robot',backingRows:99,backingGain:-1}),{...DEFAULTS,backingRows:16,backingGain:0});
 for(const backing of ['off','pad','bass','counter'])assert.equal(normalizeSettings({backing}).backing,backing);
 assert.equal(normalizeSettings({source:'rgb',timbre:'pulse'}).backing,'off');
});

test('second instrument holds over melodic rests, stays silent for an empty phrase and preserves solo PCM when muted',()=>{
 const snap=field(1,0,0,0,0,0,0,0),base={bpm:120,division:8,gain:1,timbre:'pulse',loop:false};
 const solo=renderWav(snap,base),muted=renderWav(snap,{...base,backing:'pad',backingGain:0});
 assert.deepEqual(muted.bytes,solo.bytes);
 for(const backing of ['pad','bass','counter']){
  const s={...base,backing,backingGain:.5,backingRows:4},wav=renderWav(snap,s),pcm=samples(wav.bytes);
  assert.ok(pcm.slice(11025,18000).some(v=>v!==0));assert.ok(pcm.slice(22050).every(v=>v===0));
  assert.deepEqual(renderWav(snap,s).bytes,wav.bytes);assert.equal(pcm.at(-1),0);
 }
 assert.ok(samples(renderWav(field(0,0,0,0),{...base,backing:'pad'}).bytes).every(v=>v===0));
});

test('all backing waves mix bounded PCM at full gain with chords and capped exports fade both layers',()=>{
 const row={ones:7,colors:Uint32Array.from([0,1,1,1,1,1,1,1])},snap={rows:Array(8).fill(row)};
 const signatures=new Set();
 for(const backing of ['pad','bass','counter'])for(const backingTimbre of ['sine','triangle','softsquare']){
  const s={backing,backingTimbre,backingGain:1,gain:1,chord:4,timbre:'metal',bpm:120,division:4};
  for(const sampleRate of [22050,44100]){
   const pcm=samples(renderWav(snap,s,{sampleRate,maxSeconds:.55}).bytes);assert.equal(pcm.at(-1),0);assert.ok(pcm.some(v=>v!==0));assert.ok(pcm.every(v=>Math.abs(v)<32767));
   if(sampleRate===22050)signatures.add(require('node:crypto').createHash('sha256').update(Buffer.from(Int16Array.from(pcm).buffer)).digest('hex'));
  }
 }
 assert.equal(signatures.size,9);
});

function mixScheduled(r,length,rate=22050){
 const mixed=new Float32Array(length);
 for(const source of r.sources){
  const gain=source.outputs[0].gain.value,pcm=source.buffer.getChannelData(),offset=Math.round((source.at-.035)*rate),start=Math.round(source.offset*rate);
  for(let i=start;i<pcm.length&&offset+i-start<length;i++)if(offset+i-start>=0)mixed[offset+i-start]+=pcm[i]*gain;
 }
 return mixed;
}
test('live two-layer mix equals WAV and the held instrument schedules once per phrase, including loop boundaries',async()=>{
 const snap=field(1,2,3,4,5,6,7,1);
 for(const backing of ['pad','bass','counter']){
  const s={backing,backingTimbre:'triangle',backingGain:.4,backingRows:4,gain:1,bpm:120,division:8,loop:false};
  const r=rig(()=>snap,s);await r.engine.start();r.advance(1850);
  const backgrounds=r.sources.filter(v=>v.buffer.duration>.25);assert.equal(backgrounds.length,backing==='pad'?4:2);
  assert.ok(backgrounds.every(v=>v.buffer.duration===1));
  const wav=samples(renderWav(snap,s).bytes),mixed=mixScheduled(r,wav.length);
  for(let i=0;i<wav.length;i++)assert.ok(Math.abs(wav[i]-Math.round(mixed[i]*32767))<=1,backing+' sample '+i);
  assert.ok(r.engine.getStream());r.engine.stop();assert.ok(r.sources.every(v=>v.stopped!==undefined));
 }
 const r=rig(()=>field(1,2),{backing:'pad',bpm:120,division:8});await r.engine.start();r.advance(600);
 assert.equal(r.sources.filter(v=>v.buffer.duration===.5).length,4);r.engine.stop();
});

test('backing phrases honour selected first/last/stride and seek resumes their exact PCM position',async()=>{
 const snap=field(7,1,7,2,7,3,7,4),s={backing:'counter',backingRows:2,bpm:120,division:8,first:1,last:7,stride:2,loop:false};
 const r=rig(()=>snap,s);await r.engine.start();r.advance(40);await r.engine.seek(3);
 const background=r.sources.at(-1);assert.equal(background.buffer.duration,.5);assert.equal(background.offset,.25);assert.equal(r.events.at(-1).backing.first,1);
 await r.engine.start();r.advance(550);assert.deepEqual(r.events.slice(-3).map(e=>e.index),[3,5,7]);
 const wav=renderWav(snap,s);assert.equal(wav.duration,1);assert.equal(wav.steps,4);r.engine.stop();
});

test('frame refresh preserves held-note phase, empty replacement kills both layers and toggling backing stops only that instrument',async()=>{
 const s={backing:'pad',backingRows:4,bpm:120,division:8},snap=field(1,2,3,4,5,6,7,1),r=rig(()=>snap,s);
 await r.engine.start();r.advance(410);const old=r.sources.slice();r.engine.beginRefresh();r.engine.replaceSnapshot(snap,{resume:true});
 assert.ok(old.every(v=>v.stopped!==undefined));const held=r.sources.at(-1);assert.ok(Math.abs(held.offset-.375)<.001);
 const before=r.sources.length;r.engine.setSettings({backing:'off'});assert.notEqual(held.stopped,undefined);assert.equal(r.sources.at(-3).stopped,undefined);
 r.advance(150);assert.ok(r.sources.length>before);assert.ok(r.sources.slice(before).every(v=>v.buffer.duration<.25));
 r.engine.setSettings({backing:'pad'});r.advance(250);const active=r.sources.slice();r.engine.beginRefresh();const n=r.sources.length;r.engine.replaceSnapshot(field(0,0,0,0),{resume:true});r.advance(200);
 assert.ok(active.every(v=>v.stopped!==undefined));assert.equal(r.sources.length,n);r.engine.stop();
});


test('geometry-driven unequal steps and gains keep the held layer aligned with live/WAV and recorder bus',async()=>{
 const snap={rows:[section(1,hole,spike),section(6,null,spike),section(7,hole,null),section(2,null,spike)]};
 const s={autoGeometry:true,backing:'pad',backingRows:3,backingGain:.3,bpm:120,gain:1,loop:false},r=rig(()=>snap,s),wav=renderWav(snap,s),pcm=samples(wav.bytes);
 await r.engine.start();r.advance(wav.duration*1000-25);const mixed=mixScheduled(r,pcm.length);
 for(let i=0;i<pcm.length;i++)assert.ok(Math.abs(pcm[i]-Math.round(mixed[i]*32767))<=1,'unequal-step sample '+i);
 const held=r.sources.filter(v=>v.buffer.duration>1);assert.equal(held.length,2);assert.equal(held[0].buffer.duration,Math.round(1.125*22050)/22050);
 r.engine.getStream();const master=held[0].outputs[0].outputs[0].outputs[0];assert.equal(master.outputs.length,2);assert.ok(r.sources.every(v=>v.outputs[0].outputs[0].outputs[0]===master));r.engine.stop();
});
