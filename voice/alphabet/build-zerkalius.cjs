/* Produce the four-formant sound alphabet. This is artifact production, not a test. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
require(path.join(root,'voice/engine.js'));
require(path.join(root,'voice/catalog.js'));
const E=globalThis.ZerkaliusVoice,RATE=44100,LEAD=.2,GAP=.45;
const output=path.join(__dirname,'zerkalius');fs.mkdirSync(output,{recursive:true});
function pcm(signal){
  const buffer=Buffer.alloc(signal.length*2);
  for(let i=0;i<signal.length;i++){
    const value=signal[i];if(!Number.isFinite(value))throw Error('Non-finite production sample');
    buffer.writeInt16LE(Math.round(Math.max(-1,Math.min(1,value))*32767),i*2);
  }
  return buffer;
}
function write(name,signal){
  const payload=pcm(signal),header=Buffer.alloc(44);
  header.write('RIFF',0);header.writeUInt32LE(36+payload.length,4);header.write('WAVEfmt ',8);
  header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);
  header.writeUInt32LE(RATE,24);header.writeUInt32LE(RATE*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);
  header.write('data',36);header.writeUInt32LE(payload.length,40);
  const bytes=Buffer.concat([header,payload]);fs.writeFileSync(path.join(output,name),bytes);
  return {file:'zerkalius/'+name,sampleRate:RATE,channels:1,bitsPerSample:16,sampleCount:signal.length,
    duration:signal.length/RATE,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
}
function resample(samples){
  // Fixed x2 linear interpolation for a common WAV format, without pitch/time shifting.
  const result=new Float32Array(samples.length*2);
  for(let i=0;i<samples.length;i++){
    result[2*i]=samples[i];result[2*i+1]=(samples[i]+samples[Math.min(i+1,samples.length-1)])/2;
  }
  return result;
}
function sequence(name,clips){
  const lead=Math.round(LEAD*RATE),gap=Math.round(GAP*RATE);
  const signal=new Float32Array(lead+clips.reduce((sum,clip)=>sum+clip.samples.length+gap,0));
  let cursor=lead;const timeline=[];
  for(const clip of clips){signal.set(clip.samples,cursor);timeline.push({symbol:clip.record.symbol,file:clip.record.file,
    onset:cursor/RATE,onsetSample:cursor,sampleCount:clip.samples.length,duration:clip.samples.length/RATE});cursor+=clip.samples.length+gap;}
  return {...write(name,signal),leadSeconds:LEAD,gapSeconds:GAP,timeline};
}
function produce(recipes,kind){return recipes.map(recipe=>{
  const rendered=E.render({score:recipe.score,settings:E.defaults}),samples=resample(rendered.samples);
  const name=kind==='sound'?recipe.file:'digit-'+recipe.symbol+'.wav';
  const record={...write(name,samples),id:recipe.id,kind,symbol:recipe.symbol,label:recipe.label,
    score:rendered.score,settings:rendered.settings,seed:rendered.seed,effectiveSeed:rendered.effectiveSeed,
    sourceHarmonics:rendered.sourceHarmonics,resolvedPhones:rendered.resolvedPhones};
  return {record,samples};
});}
const alphabet=globalThis.VoiceCatalog.filter(item=>item.lang==='ru'&&item.kind==='sound');
const sounds=produce(alphabet.filter(item=>!item.silent),'sound');
const digits=produce(globalThis.VoiceCatalog.filter(item=>item.lang==='ru'&&item.kind==='digit'),'digit');
const metadata={id:'zerkalius',label:'Зеркалиус · четыре форманты',engineVersion:E.version,node:process.version,
  engineSource:'voice/engine.js',catalogSource:'voice/catalog.js',adaptation:'Explicit sound scores; letters are not pronounced as names.',
  resampling:'22050 → 44100 Hz, deterministic linear x2; native pitch and time preserved',
  alphabet:alphabet.map(item=>({id:item.id,symbol:item.symbol,label:item.label,silent:item.silent,score:item.score,
    file:item.file?'zerkalius/'+item.file:null,positional:item.positional})),
  items:[...sounds,...digits].map(clip=>clip.record),sequences:[sequence('alphabet.wav',sounds),sequence('digits.wav',digits)]};
fs.writeFileSync(path.join(output,'production.json'),JSON.stringify(metadata,null,2)+'\n');
console.log('Zerkalius: '+sounds.length+' sound WAVs, '+digits.length+' digit WAVs, two sequences.');
