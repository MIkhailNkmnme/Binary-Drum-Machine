'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {DEFAULTS,normalizeSettings,validateSettings,renderWav,create}=require('./mayatnik-xorrom.js');
const rate=22050;
const row=(...codes)=>({ones:codes.length,colors:Uint32Array.from({length:8},(_,i)=>codes.filter(c=>c===i).length)});
const field=(...codes)=>({rows:codes.map(c=>Array.isArray(c)?row(...c):row(c))});
function channels(wav) {
  const view=new DataView(wav.bytes.buffer),count=view.getUint16(22,true),length=(wav.bytes.length-44)/(2*count);
  return Array.from({length:count},(_,c)=>Float64Array.from({length},(_,i)=>view.getInt16(44+(i*count+c)*2,true)));
}
const energy=(data,first=0,last=data.length)=>data.slice(first,last).reduce((sum,x)=>sum+x*x,0);
function rig(snapshot,settings) {
  let clock=0,serial=0,ctx;
  const sources=[],states=[],steps=[],timers=new Map();
  const node=()=>({outputs:[],connect(x){this.outputs.push(x);},disconnect(){this.disconnected=true;}});
  const parameter=()=>({value:1,setValueAtTime(){},linearRampToValueAtTime(){},setTargetAtTime(){}});
  const doc=new EventTarget();doc.hidden=false;
  class Context extends EventTarget {
    constructor(){super();ctx=this;this.state='running';this.destination=node();}
    get currentTime(){return clock/1000;}
    async resume(){this.state='running';}
    async close(){this.state='closed';}
    createGain(){return {...node(),gain:parameter()};}
    createBuffer(count,length,sampleRate){
      const data=Array.from({length:count},()=>new Float32Array(length));
      return {numberOfChannels:count,length,duration:length/sampleRate,getChannelData:(c=0)=>data[c]};
    }
    createBufferSource(){const source={...node(),start(at,offset=0){this.at=at;this.offset=offset;},stop(at){this.stopped=at;}};sources.push(source);return source;}
    createMediaStreamDestination(){return {...node(),stream:{getTracks:()=>[]}};}
  }
  const engine=create({settings,getSnapshot:()=>snapshot,AudioContext:Context,document:doc,
    onState:s=>states.push(s),onStep:s=>steps.push(s),setTimeout(fn,delay){timers.set(++serial,{fn,time:clock+delay});return serial;},clearTimeout(id){timers.delete(id);}});
  function advance(ms) {
    const end=clock+ms;
    for(;;) {
      const timer=[...timers].sort((a,b)=>a[1].time-b[1].time)[0];
      const source=sources.filter(s=>!s.ended&&s.stopped===undefined).sort((a,b)=>(a.at+a.buffer.duration-a.offset)-(b.at+b.buffer.duration-b.offset))[0];
      const sourceTime=source?(source.at+source.buffer.duration-source.offset)*1000:Infinity;
      const timerTime=timer?timer[1].time:Infinity;
      if(Math.min(timerTime,sourceTime)>end)break;
      if(sourceTime<=timerTime){clock=Math.max(clock,sourceTime);source.ended=true;source.onended?.();}
      else {clock=Math.max(clock,timerTime);timers.delete(timer[0]);timer[1].fn();}
    }
    clock=end;
  }
  function mix(frames) {
    const out=[new Float64Array(frames),new Float64Array(frames)];
    for(const source of sources) {
      const offset=Math.round((source.at-.035)*rate),from=Math.round(source.offset*rate),level=source.outputs[0].gain.value*settings.gain;
      for(let c=0;c<2;c++) {
        const data=source.buffer.getChannelData(Math.min(c,source.buffer.numberOfChannels-1));
        for(let i=from;i<data.length&&offset+i-from<frames;i++)if(offset+i-from>=0)out[c][offset+i-from]+=data[i]*level;
      }
    }
    return out;
  }
  return {engine,sources,states,steps,advance,mix,ctx:()=>ctx};
}

test('strict full JSON contract rejects missing, unknown, wrong-type, nonfinite, fractional integer and range violations',()=>{
  assert.equal(Object.keys(DEFAULTS).length,42);
  assert.deepEqual(validateSettings({...DEFAULTS}),DEFAULTS);
  for(const key of Object.keys(DEFAULTS)) {
    const missing={...DEFAULTS};delete missing[key];assert.throws(()=>validateSettings(missing),new RegExp(key));
    const invalid={...DEFAULTS,[key]:typeof DEFAULTS[key]==='number'?'1':typeof DEFAULTS[key]==='boolean'?1:null};
    assert.throws(()=>validateSettings(invalid),new RegExp(key));
  }
  for(const input of [null,[],1,'{}'])assert.throws(()=>validateSettings(input),/JSON/);
  assert.throws(()=>validateSettings({...DEFAULTS,unknown:1}),/unknown/);
  for(const value of [NaN,Infinity,-Infinity])assert.throws(()=>validateSettings({...DEFAULTS,cutoff:value}),/cutoff/);
  for(const [key,value]of Object.entries({bpm:0,division:2,chord:1.5,tonic:-1,attack:10.001,release:-1,sustain:1.01,cutoff:19,resonance:21,lfoRate:0,lfoDepth:-1,delayTime:3,delayFeedback:1,delayMix:2,reverbTime:6,reverbMix:-1,pan:2,arpGate:0,swing:1,filterType:'lowshelf',lfoTarget:'noise',arpMode:'random'}))
    assert.throws(()=>validateSettings({...DEFAULTS,[key]:value}),new RegExp(key));
  assert.deepEqual(normalizeSettings({attack:'2',envelopeOn:'yes',pan:99,lfoTarget:'bad'}),{...DEFAULTS,attack:2,pan:1});
});

test('inaudible new parameter changes retain historical mono bytes, pan creates real stereo with valid WAV headers',()=>{
  const snap=field(6,0),base={gain:1,timbre:'sine',bpm:120,division:4};
  const original=renderWav(snap,base);
  assert.deepEqual(renderWav(snap,{...base,attack:5,decay:6,sustain:0,release:9,cutoff:100,resonance:20,lfoRate:4,delayFeedback:.8,reverbTime:4,arpGate:.2,swing:0}).bytes,original.bytes);
  assert.equal(channels(original).length,1);
  const left=renderWav(snap,{...base,pan:-1}),right=renderWav(snap,{...base,pan:1});
  const [l,r]=channels(left),[rl,rr]=channels(right),view=new DataView(left.bytes.buffer);
  assert.equal(view.getUint16(22,true),2);assert.equal(view.getUint32(28,true),rate*4);assert.equal(view.getUint16(32,true),4);
  assert.ok(energy(l)>1e8);assert.equal(energy(r),0);assert.equal(energy(rl),0);assert.deepEqual(l,rr);
});

test('ADSR attack, sustain and release are real envelopes, release lengthens WAV and ends at zero',()=>{
  const snap=field(6),base={bpm:120,division:4,gain:1,timbre:'sine',pan:.01,envelopeOn:true,attack:.1,decay:.1,sustain:.5,release:.2};
  const wav=renderWav(snap,base),[pcm]=channels(wav);
  assert.ok(Math.abs(wav.duration-.63)<1/rate);
  assert.ok(energy(pcm,rate*.01,rate*.03)<energy(pcm,rate*.08,rate*.1));
  assert.ok(energy(pcm,rate*.44,rate*.50)>0);assert.equal(pcm.at(-1),0);
  const muted=channels(renderWav(snap,{...base,sustain:0,attack:0,decay:0}))[0];assert.equal(energy(muted),0);
  assert.ok(energy(channels(renderWav(snap,{...base,release:0}))[0])>0);
});

test('three actual biquad filters reject distant bands and changing resonance changes PCM',()=>{
  const snap=field(6),base={bpm:120,division:4,gain:1,timbre:'sine',pan:.01,resonance:.7};
  const run=patch=>channels(renderWav(snap,{...base,...patch}))[0];
  const pass=run({filterType:'lowpass',cutoff:4000}),low=run({filterType:'lowpass',cutoff:50});
  assert.ok(energy(low)<energy(pass)*.01);
  assert.ok(energy(run({filterType:'highpass',cutoff:4000}))<energy(run({filterType:'highpass',cutoff:50}))*.01);
  assert.ok(energy(run({filterType:'bandpass',cutoff:440}))>energy(run({filterType:'bandpass',cutoff:40}))*10);
  assert.notDeepEqual(run({filterType:'lowpass',cutoff:440,resonance:.7}),run({filterType:'lowpass',cutoff:440,resonance:5}));
});

test('every LFO target changes real audio; zero depth is byte-identical and pan modulation changes channel balance',()=>{
  const snap=field(6),base={bpm:60,division:4,gain:1,timbre:'sine',pan:.001};
  const plain=renderWav(snap,base).bytes;
  for(const lfoTarget of ['pitch','gain','pan']) {
    assert.deepEqual(renderWav(snap,{...base,lfoTarget,lfoDepth:0}).bytes,plain);
    assert.notDeepEqual(renderWav(snap,{...base,lfoTarget,lfoRate:4,lfoDepth:1}).bytes,plain);
  }
  const filterBase={...base,filterType:'lowpass',cutoff:300};
  assert.notDeepEqual(renderWav(snap,{...filterBase,lfoTarget:'filter',lfoDepth:1}).bytes,renderWav(snap,filterBase).bytes);
  const [l,r]=channels(renderWav(snap,{...base,lfoTarget:'pan',lfoDepth:1,lfoRate:2}));
  assert.ok(energy(r,rate*.05,rate*.15)>energy(l,rate*.05,rate*.15)*4);
  assert.ok(energy(l,rate*.30,rate*.4)>energy(r,rate*.30,rate*.4)*4);
});

test('delay has actual repeated echoes and feedback, reverb has stereo decay, silent fields stay silent',()=>{
  const snap=field(6),base={bpm:600,division:4,gain:1,timbre:'sine'};
  const echo=renderWav(snap,{...base,delayTime:.1,delayMix:1,delayFeedback:.5}),[pcm]=channels(echo);
  assert.equal(energy(pcm,0,rate*.099),0);assert.ok(energy(pcm,rate*.11,rate*.15)>0);
  assert.ok(energy(pcm,rate*.21,rate*.25)<energy(pcm,rate*.11,rate*.15));
  assert.ok(echo.duration>.5);assert.equal(pcm.at(-1),0);
  const verb=renderWav(snap,{...base,reverbMix:.8,reverbTime:1}),[l,r]=channels(verb);
  assert.ok(energy(l,rate*.15,rate*.5)>0);assert.notDeepEqual(l,r);
  const silent=channels(renderWav(field(0,0),{...base,envelopeOn:true,release:1,delayMix:1,reverbMix:1,filterType:'highpass',lfoTarget:'pitch',lfoDepth:1}));
  assert.ok(silent.every(c=>energy(c)===0));
  assert.equal(channels(renderWav(snap,{...base,pan:.1,delayTime:0,delayMix:1}))[0].length,channels(renderWav(snap,{...base,pan:.1}))[0].length);
});

test('arpeggiator sequences only row chord notes and gate creates real sub-step rests',async()=>{
  const snap=field([1,3,5]),base={bpm:60,division:4,chord:3,gain:1,timbre:'sine',arpGate:.5};
  for(const [arpMode,expected]of [['up',[261.63,329.63,392]],['down',[392,329.63,261.63]],['updown',[261.63,329.63,392,329.63]]]) {
    const wav=renderWav(snap,{...base,arpMode}),[pcm]=channels(wav),slot=rate/expected.length;
    for(let n=0;n<expected.length;n++) {
      const start=Math.round(n*slot),window=pcm.slice(start+100,start+Math.round(slot*.4));
      const crossing=window.slice(1).filter((x,i)=>x>0&&window[i]<=0).length;
      assert.ok(Math.abs(crossing/window.length*rate-expected[n])<20,arpMode+' note '+n);
      assert.equal(energy(pcm,start+Math.round(slot*.6),Math.round((n+1)*slot)),0);
    }
    const rigged=rig(snap,{...base,arpMode,loop:false});await rigged.engine.start();rigged.advance(50);
    assert.deepEqual(rigged.steps[0].notes.map(n=>n.midi),[60,64,67]);rigged.engine.stop();
  }
});

test('swing preserves paired duration, unpaired last step, stride and unequal geometry timing',async()=>{
  const snap=field(1,2,3),s={bpm:120,division:4,gain:1,swing:.5,loop:false};
  const r=rig(snap,s);await r.engine.start();r.advance(1550);
  assert.deepEqual(r.steps.map(e=>Math.round(e.time*1000)),[35,785,1035]);
  assert.equal(renderWav(snap,s).duration,1.5);
  const geometries=[{width:8,height:2},{width:2,height:8},{width:3,height:3}];
  const geometric={rows:snap.rows.map((row,i)=>({...row,geometry:{triangle:{...geometries[i],area:4,perimeter:8,symmetryHeight:3}}}))};
  const unswung=renderWav(geometric,{...s,swing:0,autoGeometry:true,geometrySource:'regions'});
  assert.equal(renderWav(geometric,{...s,autoGeometry:true,geometrySource:'regions'}).duration,unswung.duration);
  r.engine.stop();
});

test('live stereo buffers and WAV mix the identical DSP, tails, backing and sample boundaries; recorder takes same master bus',async()=>{
  const snap=field([1,3,5],0,6),s={...DEFAULTS,bpm:120,division:8,gain:.8,loop:false,envelopeOn:true,attack:.01,decay:.03,sustain:.7,release:.15,
    filterType:'lowpass',cutoff:2500,resonance:1.3,lfoTarget:'pitch',lfoDepth:.5,delayMix:.3,delayTime:.12,delayFeedback:.2,reverbMix:.2,reverbTime:.4,
    pan:-.3,arpMode:'updown',swing:.3,backing:'pad',backingRows:3,backingGain:.3};
  const wav=renderWav(snap,s),pcm=channels(wav),r=rig(snap,s);await r.engine.start();
  const stream=r.engine.getStream();assert.ok(stream);assert.equal(r.engine.getStream(),stream);
  r.advance((wav.duration+.1)*1000);
  assert.ok(r.sources.length>3);assert.ok(r.sources.every(v=>v.buffer.numberOfChannels===2&&v.buffer.duration<=1));
  const mixed=r.mix(pcm[0].length);
  for(let c=0;c<2;c++)for(let i=0;i<pcm[c].length;i++)assert.ok(Math.abs(pcm[c][i]-Math.round(mixed[c][i]*32767))<=1,'channel '+c+' sample '+i);
  const master=r.sources[0].outputs[0].outputs[0].outputs[0];
  assert.equal(master.outputs.length,2);assert.equal(r.engine.getState(),'stopped');await r.engine.dispose();
});

test('one-shot transport includes tails, pause/seek/refresh/stop cancel queued stereo effects and do not resurrect them',async()=>{
  const snap=field(6),s={...DEFAULTS,bpm:120,division:4,loop:false,envelopeOn:true,release:.3,delayTime:.2,delayFeedback:.3,delayMix:.5,reverbMix:.3,reverbTime:.5};
  const r=rig(snap,s);await r.engine.start();r.advance(600);assert.equal(r.engine.getState(),'playing');
  r.engine.pause();const old=r.sources.slice();assert.ok(old.filter(v=>!v.ended).every(v=>v.stopped!==undefined));
  const count=r.sources.length;old.forEach(v=>v.onended?.());assert.equal(r.sources.length,count);
  await r.engine.seek(0);assert.equal(r.engine.getState(),'paused');const before=r.sources.slice();
  r.engine.beginRefresh();r.engine.replaceSnapshot(field(0),{resume:true});assert.ok(before.filter(v=>!v.ended).every(v=>v.stopped!==undefined));
  r.engine.stop();const final=r.sources.length;r.sources.slice().forEach(v=>v.onended?.());assert.equal(r.sources.length,final);
  await r.engine.dispose();
});

test('enhanced frame replacement preserves oscillator, ADSR, LFO and effect history at the current sample',async()=>{
  const snap=field([1,3]),s={...DEFAULTS,gain:1,loop:true,bpm:120,division:4,envelopeOn:true,attack:.1,decay:.1,sustain:.7,release:.2,
    lfoTarget:'pitch',lfoDepth:.7,filterType:'lowpass',cutoff:2000,delayTime:.1,delayMix:.4,delayFeedback:.3,reverbMix:.2,reverbTime:.3,pan:.2};
  const r=rig(snap,s);await r.engine.start();r.advance(170);
  const original=r.sources[0].buffer,first=Math.round((r.ctx().currentTime-.035)*rate),count=r.sources.length;
  r.engine.beginRefresh();r.engine.replaceSnapshot(snap,{resume:true});
  const replacement=r.sources[count].buffer;
  for(let c=0;c<2;c++)for(let i=0;i<Math.min(2000,original.length-first,replacement.length);i++)
    assert.equal(replacement.getChannelData(c)[i],original.getChannelData(c)[first+i]);
  await r.engine.dispose();
});

test('slow enhanced beats stream bounded chunks, capped stereo WAV fades; pathological tempo/tail combinations fail clearly',async()=>{
  const snap=field(6),s={...DEFAULTS,bpm:.5,division:4,gain:1,loop:false,envelopeOn:true,attack:10,decay:10,sustain:1,release:10,reverbMix:.2,reverbTime:5};
  const r=rig(snap,s);await r.engine.start();assert.equal(r.sources.length,2);assert.ok(r.sources.every(v=>v.buffer.duration===1));
  r.advance(3100);assert.ok(r.sources.length<7);assert.ok(r.sources.every(v=>v.buffer.duration<=1));
  const wav=renderWav(snap,s,{maxSeconds:3}),pcm=channels(wav);assert.equal(wav.duration,3);assert.equal(wav.truncated,true);assert.ok(pcm.every(c=>c.at(-1)===0));
  r.engine.stop();
  for(const bpm of [Number.MAX_VALUE,Number.MIN_VALUE])assert.throws(()=>renderWav(snap,{...s,bpm},{maxSeconds:.01}),/звукового отсчёта/);
  assert.throws(()=>renderWav(snap,{...s,bpm:240000},{maxSeconds:.01}),/перекрывающихся хвостов/);
  const silent=renderWav(field(0),{...s,bpm:240000},{maxSeconds:.01});
  assert.ok(channels(silent).every(c=>energy(c)===0));
});

test('extreme valid synth combinations remain deterministic, finite and below clipping at both supported sample rates',()=>{
  const snap=field([1,2,3,4],7,6),s={...DEFAULTS,bpm:120,gain:1,chord:4,envelopeOn:true,attack:0,decay:0,sustain:1,release:1,
    filterType:'lowpass',cutoff:20,resonance:20,lfoTarget:'filter',lfoRate:40,lfoDepth:1,delayTime:.02,delayFeedback:.9,delayMix:.7,reverbMix:.7,reverbTime:1,pan:1,arpMode:'updown',arpGate:1,swing:.75,backing:'pad',backingGain:1};
  for(const sampleRate of [22050,44100]) {
    const wav=renderWav(snap,s,{sampleRate,maxSeconds:2}),pcm=channels(wav);
    assert.deepEqual(wav.bytes,renderWav(snap,s,{sampleRate,maxSeconds:2}).bytes);
    assert.ok(pcm.every(c=>c.every(x=>Number.isFinite(x)&&Math.abs(x)<32767)));
    assert.ok(pcm.some(c=>energy(c)>0));
  }
});
