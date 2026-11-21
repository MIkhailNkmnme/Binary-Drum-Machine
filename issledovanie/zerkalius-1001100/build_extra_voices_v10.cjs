/* Original procedural audio only. Run: node build_extra_voices_v10.cjs */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),cp=require('child_process');
const out=__dirname,src=path.join(out,'voice-source-v10');
const repository=process.env.ZERKALIUS_REPOSITORY||process.cwd();
const sourceCommit='7325779241728a416ad78a9fa2f6a83bd3bf4e7d';
const files=['prosody-dsp.js','engine.js','robot/engine.js','robot-live.js','dsh-engine.js','engines.js','german.js','letters.js','english.js','digits.js','languages.js','catalog.js','prosody.js','text.js'];
const hashes={},context=vm.createContext({console});
for(const name of files){
  const snapshot=path.join(src,name);
  const code=fs.existsSync(snapshot)?fs.readFileSync(snapshot):cp.execFileSync('git',['show',sourceCommit+':voice/'+name],{cwd:repository,maxBuffer:16*1024*1024});
  const target=path.join(src,name);fs.mkdirSync(path.dirname(target),{recursive:true});
  if(fs.existsSync(target)){
    if(!fs.readFileSync(target).equals(code))throw Error('Existing source snapshot differs: '+target);
  }else fs.writeFileSync(target,code,{flag:'wx'});
  hashes[name]=crypto.createHash('sha256').update(code).digest('hex');
  vm.runInContext(code.toString('utf8'),context,{filename:name});
}
const original=JSON.parse(fs.readFileSync(path.join(out,'voice-timeline.json'),'utf8'));
const engine=context.VoiceEngines.get('robot');
const settings=engine.normalize({...original.settings}),prosody={...original.prosody};
const sets=[
  {language:'fr',base:210,lines:['La lumière reste avec moi.','Je respire dans le calme.'],title:'Zerkalius.',one:'un',zero:'zéro'},
  {language:'it',base:270,lines:['La notte ascolta con me.','Il ritmo torna piano.'],title:'Zerkalius.',one:'uno',zero:'zero'},
  {language:'es',base:330,lines:['Ya no estoy tan solo.','La luz sigue mi mano.'],title:'Zerkalius.',one:'uno',zero:'cero'},
  {language:'ja',base:390,lines:['まだ ここに いるよ。','しずかに あさを まとう。'],title:'ゼルカリウス。',one:'いち',zero:'ゼロ'}
];
function make(text,language,maxDuration){
  let params={...settings},samples,plan,parts;
  for(let attempt=0;attempt<5;attempt++){
    plan=context.VoiceText.plan({text,language,catalog:context.VoiceCatalog,engine,settings:params,phones:{},prosody});
    parts=plan.chunks.map(c=>engine.render({score:c.score,settings:params,phones:plan.phones,...(c.prosody?{prosody:c.prosody}:{})}));
    const count=parts.reduce((n,p)=>n+p.samples.length,0);samples=new Float32Array(count);let offset=0;
    for(const part of parts){samples.set(part.samples,offset);offset+=part.samples.length;}
    if(count/44100<=maxDuration)return {samples,params,plan,parts};
    params=engine.normalize({...params,speed:params.speed*(count/44100)/maxDuration*1.01});
  }
  throw Error('Could not fit '+language+' '+text+' within '+maxDuration+' seconds.');
}
function wav(name,samples){
  const b=Buffer.alloc(44+samples.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(44100,24);b.writeUInt32LE(88200,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples.length*2,40);
  for(let i=0;i<samples.length;i++)b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),44+i*2);
  fs.writeFileSync(path.join(out,name),b,{flag:'wx'});
}
const events=[];
for(const set of sets){
  const digits=Array.from('1001100',digit=>digit==='1'?set.one:set.zero);
  const items=[{text:set.lines[0],at:1.25,max:6.3,kind:'line'},{text:set.lines[1],at:8.75,max:6.3,kind:'line'},{text:set.title,at:16.25,max:1.9,kind:'title'},...digits.map((text,i)=>({text,at:18.75+[0,1,2,4,5,6,7][i]*1.25,max:1.05,kind:'digit',digitIndex:i}))];
  for(let i=0;i<items.length;i++){
    const item=items[i],r=make(item.text,set.language,item.max),file='voice-v10-'+set.language+'-'+i+'.wav';
    wav(file,r.samples);
    events.push({...item,language:set.language,start:set.base+item.at,duration:r.samples.length/44100,file,settings:r.params,score:r.plan.chunks.map(c=>c.score),phones:r.plan.phones,prosody:r.plan.prosody,chunks:r.plan.chunks.map(c=>({score:c.score,prosody:c.prosody})),sourceScores:r.parts.map(p=>p.score),sourceCommit});
  }
  console.log(set.language+': '+items.length+' procedural fragments generated');
}
const timeline={duration:450,engine:engine.version,sampleRate:44100,settings,prosody,source:'voice-source-v10',sourceCommit,hashes,events,notes:'Procedural synthesis from approved Glсъ v0.033 source. Own mathematical oscillators, noise, filters and handwritten phoneme recipes. No audio inputs, recordings, trained voices or external lexicons. French un recipe is 360 ms and includes approved noise flags. No external normalization or mixer gain applied here. Original RU/EN/DE files unchanged. Listening and visual acceptance not performed.'};
fs.writeFileSync(path.join(out,'extra-voice-timeline-v10.json'),JSON.stringify(timeline,null,2),{flag:'wx'});
