const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const out=__dirname, src=path.join(__dirname,'voice-source');
const context=vm.createContext({console});
const files=['prosody-dsp.js','engine.js','robot/engine.js','robot-live.js','dsh-engine.js','engines.js','catalog.js','german.js','english.js','prosody.js','text.js'];
const hashes={};
for(const name of files){let code=fs.readFileSync(path.join(src,name),'utf8');hashes[name]=crypto.createHash('sha256').update(code).digest('hex');
 if(name==='english.js')code=code.replace('const dictionary=new Map(rows.map',`rows.push(
 ['my',1,'m0 a1 en_ih1'],['finger',1,'f0 en_ih1 en_ng2 g3 ax4 rr4'],
 ['taps',1,'t0 ae1 p2 s3'],['same',1,'s0 e1 en_ih1 m2'],
 ['rhythm',2,'rr0 en_ih2 en_dh3 ax4 m5'],['i',0,'a0 en_ih0'],
 ['wait',1,'w0 e1 en_ih1 t3'],['in',null,'en_ih0 n1'],
 ['zerkalius',4,'z0 en_eh1 rr2 k3 a4 l5 i6 ax7 s8']);
 const dictionary=new Map(rows.map`);
 vm.runInContext(code,context,{filename:name});
}
// Explicit German word scores for this small text; no recorded speech inputs.
vm.runInContext(`{
const parse=s=>s.split(' ').map(t=>{let [id,ms]=t.split(':');return {id,duration:+ms/1000};});
const scores={dann:'d:85 a:230 n:105',antwortet:'a:220 n:100 t:85 v:110 o:165 r:65 t:80 ax:110 t:70',
eine:'a:150 i:90 n:95 ax:100',leise:'l:95 a:170 i:85 z:110 ax:100',stimme:'sh:110 t:75 i:210 m:110 ax:110',
ich:'i:170 de_ich:150',bin:'b:80 i:170 n:95',noch:'n:100 o:180 de_ach:140',hier:'h:85 i:240 ax:95',
eins:'a:170 i:95 n:100 s:130',null:'n:100 u:220 l:120',zerkalius:'ts:120 e:150 r:65 k:90 a:220 l:85 i:120 u:120 s:120'};
const old=VoiceGerman;globalThis.VoiceGerman={...old,take(chars,index){const word=chars.slice(index).join('').match(/^[a-zäöüß]+/i)?.[0];if(word&&scores[word.toLowerCase()])return {length:word.length,score:parse(scores[word.toLowerCase()])};return old.take(chars,index);}};
}`,context);
const engine=context.VoiceEngines.get('robot');
const settings=engine.normalize({...engine.defaults,pitchStart:119,pitchEnd:109,speed:.75,vibratoDepth:.25,voicing:.82,noise:1.02,transitionMs:30,outputGain:.55,seed:1001100});
const prosody={mode:'speech',expressiveness:28,contour:'statement',transitionMs:30};
const sets=[
 {lang:'ru',base:30,lines:['Н+очью л+ампа на п+ульте миг+ает.','С+емь +импульсов. И сн+ова тишин+а.'],title:'Зерк+алиус.',digits:['Од+ин','н+оль','н+оль','од+ин','од+ин','н+оль','н+оль']},
 {lang:'en',base:90,lines:['My finger taps the same rhythm.','I wait in the quiet.'],title:'Zerkalius.',digits:['One','zero','zero','one','one','zero','zero']},
 {lang:'de',base:150,lines:['Dann antwortet eine leise Stimme.','Ich bin noch hier.'],title:'Zerkalius.',digits:['Eins','null','null','eins','eins','null','null']}
];
function make(text,language,maxDuration){
 let params={...settings},result,plan;
 for(let attempt=0;attempt<3;attempt++){
  plan=context.VoiceText.plan({text,language,catalog:[...context.VoiceCatalog,...context.VoiceGerman.catalog],engine,settings:params,phones:{},prosody});
  const parts=plan.chunks.map(c=>engine.render({score:c.score,settings:params,phones:plan.phones,...(c.prosody?{prosody:c.prosody}:{})}));
  const n=parts.reduce((a,p)=>a+p.samples.length,0); result=new Float32Array(n);let offset=0;
  for(const part of parts){result.set(part.samples,offset);offset+=part.samples.length;}
  if(n/44100<=maxDuration)break;
  params.speed*=n/44100/maxDuration*1.01;
 }
 return {samples:result,params,plan};
}
function wav(name,samples){const b=Buffer.alloc(44+samples.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(44100,24);b.writeUInt32LE(88200,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples.length*2,40);samples.forEach((v,i)=>b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+2*i));fs.writeFileSync(path.join(out,name),b);}
const events=[];
for(const set of sets){const items=[{text:set.lines[0],at:1.25,max:6.3,kind:'line'},{text:set.lines[1],at:8.75,max:6.3,kind:'line'},{text:set.title,at:16.25,max:1.9,kind:'title'},...set.digits.map((text,i)=>({text,at:18.75+[0,1,2,4,5,6,7][i]*1.25,max:1.05,kind:'digit',digitIndex:i}))];
 for(let i=0;i<items.length;i++){const item=items[i],r=make(item.text,set.lang,item.max),file='voice-'+set.lang+'-'+i+'.wav';wav(file,r.samples);events.push({...item,text:item.text.replaceAll('+',''),language:set.lang,start:set.base+item.at,duration:r.samples.length/44100,file,settings:r.params,score:r.plan.chunks.map(c=>c.score),phones:r.plan.phones});}
 console.log(set.lang+': '+items.length+' spoken fragments generated');
}
fs.writeFileSync(path.join(out,'voice-timeline.json'),JSON.stringify({duration:210,engine:engine.version,sampleRate:44100,settings,prosody,source:src,hashes,events,notes:'Original procedural synthesis. Local explicit English and German word scores; Russian stress marks. No recordings or trained voices.'},null,2));
