/* ГОЛ-004: audio artifact production plus the explicitly requested zero/one
   origin comparison. No playback, browser, syntax-check or other test suite. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const Robot=require('./engine.js');
require(path.join(root,'voice/catalog.js'));
const RATE=44100,MIDI=48,F0=440*2**((MIDI-69)/12),BITS=Array(8).fill(1),TILT=.82,LEAD=.2,GAP=.45;
const settings={rate:RATE,midi:MIDI,event:{bits:BITS,f0:F0,tilt:TILT}};
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const sourceHash=file=>({file,encoding:'UTF-8, LF',sha256:hash(Buffer.from(fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n'),'utf8'))});
function json(name,value){fs.writeFileSync(path.join(__dirname,name),JSON.stringify(value,null,2)+'\n');}
function floatBytes(samples){const bytes=Buffer.alloc(samples.length*4);for(let i=0;i<samples.length;i++)bytes.writeFloatLE(samples[i],i*4);return bytes;}
function writeWav(name,samples){
  const bytes=Buffer.alloc(44+samples.length*2);
  bytes.write('RIFF',0);bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);
  bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(RATE,24);bytes.writeUInt32LE(RATE*2,28);
  bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(samples.length*2,40);
  let peak=0;
  for(let i=0;i<samples.length;i++){
    if(!Number.isFinite(samples[i]))throw Error('Non-finite production sample');
    peak=Math.max(peak,Math.abs(samples[i]));
    bytes.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),44+i*2);
  }
  fs.writeFileSync(path.join(__dirname,name),bytes);
  return {file:name,sampleRate:RATE,channels:1,bitsPerSample:16,sampleCount:samples.length,duration:samples.length/RATE,
    floatPeak:peak,float32Sha256:hash(floatBytes(samples)),sha256:hash(bytes)};
}
// The source bank contributes score durations only. Its audio/DSP is not used.
const aliases={ax:'a-neutral',lj:'l-soft',dj:'d-soft',rj:'r-soft',pj:'p-soft',tj:'t-soft',kj:'k-soft',sj:'s-soft',mj:'m-soft',vj:'v-soft',shj:'sh-soft'};
const convert=score=>score.map(({id,duration})=>[aliases[id]||id,duration]);
const words=Robot.legacyWords();
const alphabet=globalThis.VoiceCatalog.filter(item=>item.lang==='ru'&&item.kind==='sound').map(item=>({
  id:item.id,symbol:item.symbol,label:item.label,silent:item.silent,file:item.file,
  alphabetIndex:item.alphabetIndex,sequence:convert(item.score),seedWord:item.id,positional:item.positional
}));
const digits=globalThis.VoiceCatalog.filter(item=>item.lang==='ru'&&item.kind==='digit').map(item=>{
  const legacy=item.symbol==='0'?'zero':item.symbol==='1'?'one':null;
  return {id:'robot-digit-'+item.symbol,symbol:item.symbol,label:item.label,file:'digit-'+item.symbol+'.wav',
    sequence:legacy?words[legacy].sequence:convert(item.score),seedWord:legacy||'ru-digit-'+item.symbol,
    legacyWord:legacy,legacyDuration:legacy?Robot.duration(legacy):null};
});
const catalog={version:1,engineVersion:Robot.VERSION,settings,alphabet,digits,phonemes:Robot.phones(),
  addedPhoneIds:Robot.addedPhoneIds,legacyWords:words,
  origin:'Adaptation of mayatnik/mayatnik-phone-robot.js; new explicit alphabet targets; no audio input.'};
json('catalog.json',catalog);

// This narrow numerical origin confirmation was explicitly requested by the
// user. Both sides are freshly calculated; no WAV recording is an input.
const Original=require(path.join(root,'mayatnik/mayatnik-phone-robot.js'));
const originComparison=['zero','one'].map(word=>{
  const options={...settings,event:{...settings.event,robotWord:word}};
  const original=Original.renderVoice(options),adapted=Robot.renderVoice(options);
  let maxAbsoluteDifference=original.length===adapted.length?0:null;
  if(maxAbsoluteDifference!==null)for(let i=0;i<original.length;i++)maxAbsoluteDifference=Math.max(maxAbsoluteDifference,Math.abs(original[i]-adapted[i]));
  const originalSha256=hash(floatBytes(original)),adaptedSha256=hash(floatBytes(adapted));
  const record={word,settings:options,sequence:words[word].sequence,seed:Robot.seedFor(BITS,word),
    originalSamples:original.length,adaptedSamples:adapted.length,originalFloat32Sha256:originalSha256,
    adaptedFloat32Sha256:adaptedSha256,maxAbsoluteDifference,byteIdentical:originalSha256===adaptedSha256&&maxAbsoluteDifference===0};
  if(!record.byteIdentical)throw Error('Requested origin confirmation differs for '+word+': '+JSON.stringify(record));
  return record;
});
json('origin-comparison.json',{scope:'Only legacy zero/one with the old scores, duration literals and seeds; explicitly user-authorized.',
  encoding:'Raw IEEE-754 Float32 little-endian, no WAV header or quantization',node:process.version,results:originComparison,
  meaning:'Numerical identity in this build environment, not a listening or human-quality assessment.'});

function produce(entry,kind){
  const samples=Robot.renderSequence({...settings,sequence:entry.sequence,seedWord:entry.seedWord,
    ...(entry.legacyDuration!==null&&entry.legacyDuration!==undefined?{duration:entry.legacyDuration}:{})});
  const record={...writeWav(entry.file,samples),id:entry.id,kind,symbol:entry.symbol,label:entry.label,
    sequence:entry.sequence,seedWord:entry.seedWord,noiseSeed:Robot.seedFor(BITS,entry.seedWord),legacyWord:entry.legacyWord||null};
  return {record,samples};
}
const soundClips=alphabet.filter(item=>!item.silent).map(item=>produce(item,'sound'));
const digitClips=digits.map(item=>produce(item,'digit'));
function sequence(name,clips){
  const lead=Math.round(LEAD*RATE),gap=Math.round(GAP*RATE);
  const samples=new Float32Array(lead+clips.reduce((sum,clip)=>sum+clip.samples.length+gap,0));
  let cursor=lead;const timeline=[];
  for(const clip of clips){samples.set(clip.samples,cursor);timeline.push({symbol:clip.record.symbol,file:clip.record.file,
    onsetSample:cursor,onset:cursor/RATE,duration:clip.samples.length/RATE,sampleCount:clip.samples.length});cursor+=clip.samples.length+gap;}
  return {...writeWav(name,samples),leadSeconds:LEAD,gapSeconds:GAP,timeline};
}
const sequences=[sequence('alphabet.wav',soundClips),sequence('digits.wav',digitClips)];
const sourceFiles=['voice/robot/engine.js','voice/robot/build.cjs','voice/robot/build.py','voice/catalog.js',
  'mayatnik/mayatnik-phone-robot.js','mayatnik/mayatnik-synthesis-music.js'];
const manifest={version:1,release:'2026-11-18',title:'Телефонный робот: полный русский алфавит звуков',
  engineVersion:Robot.VERSION,command:'python voice/robot/build.py --node node',node:process.version,
  settings,carrier:{tableSize:Robot.TABLE_SIZE,harmonics:Math.min(96,Math.floor(RATE*.43/F0)),tilt:TILT,bits:BITS,f0:F0},
  utteranceTail:Robot.TAIL,alphabet,silentSigns:['Ъ','Ь'],addedPhoneIds:Robot.addedPhoneIds,
  phonemeParameters:Robot.phones(),items:[...soundClips,...digitClips].map(clip=>clip.record),sequences,
  sourceFiles:sourceFiles.map(sourceHash),originComparison,
  processing:{source:'Mathematical bit-selected harmonic sum + deterministic xorshift32 noise',
    filters:'Four parallel constant-peak band-pass biquads, DF-II transposed; original arithmetic preserved',
    transitions:'At phoneme edges: min(12ms,0.2*segment); mix reaches 0.5 at the boundary; control refresh 16 samples',
    dc:'value-lastValue+0.995*previousDC',gate:'min(1,time/0.006,max(0,(seconds-time)/0.018))',
    gain:'0.55/max(peak,0.045), then tanh per sample',extraNormalization:false,resampling:false,
    distinction:'The previous music/voices/phone.wav applies an additional common phrase peak of 0.7. These files preserve native robot output level.'},
  provenance:{audioInputs:[],recordings:[],microphone:[],tts:[],systemVoices:[],trainedModels:[],networkAudio:[],
    note:'All outputs freshly computed. The three-word source is unchanged. Only recipes/durations are taken from voice/catalog.js; its separate synthesis engine is not loaded.'},
  limits:{pronunciation:'31 isolated sounds; no э/а suffix on consonants; Й j80ms; Е/Ё/Ю/Я initial j+vowel; Ъ/Ь have no file.',
    quality:'New phoneme intelligibility and human likeness are unverified; user listening required.',
    verification:'Production metadata plus explicitly authorized legacy zero/one byte comparison only. No other tests, syntax checks, browser or listening.'}};
json('manifest.json',manifest);
for(const item of originComparison)console.log('Origin '+item.word+': byteIdentical='+item.byteIdentical+', maxAbsDiff='+item.maxAbsoluteDifference+', Float32 SHA256='+item.adaptedFloat32Sha256);
console.log('Produced '+soundClips.length+' alphabet sounds + '+digitClips.length+' digits + '+sequences.length+' sequences.');
for(const item of sequences)console.log(item.file+': '+item.duration.toFixed(6)+' s, SHA256 '+item.sha256);
