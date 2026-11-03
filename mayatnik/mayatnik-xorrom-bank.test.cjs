'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const bank=require('./mayatnik-xorrom-bank'),Music=require('./mayatnik-xorrom'),Core=require('./mayatnik-core'),Field=require('./mayatnik-xorrom-field'),Geometry=require('./mayatnik-xorrom-geometry');
const Work=require('./mayatnik-work-file');
const vm=require('node:vm');
const directory=path.join(__dirname,'audio-examples'),source=JSON.parse(fs.readFileSync(path.join(directory,'source-field.json'),'utf8'));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function validateHostFrame(parsed){
 const html=fs.readFileSync(path.join(__dirname,'Zerkalius-mayatnik.html'),'utf8');
 const start=html.indexOf('  function validateFrameWork(parsed)'),end=html.indexOf('  function frameWorkOnly',start);
 const Construction=require('./mayatnik-construction'),Flow=require('./mayatnik-edge-flow');
 const context={Int8Array,Uint8Array,Uint8ClampedArray,Uint32Array,parsed,gpuApi:false,GPU_URL:'',GPU_BIG:Infinity,MayatnikConstruction:Construction,
   animatrixOn:s=>!!s.animatrixOn,assertWorkEvolution:s=>{Flow.validate(s);Construction.assertCompatible(s);},
   fieldFrames:s=>Flow.limit(s),fieldGeometry:s=>Construction.geometry(s),
   MayatnikFaceTransform:require('./mayatnik-face-transform'),templatePaintValidate:value=>assert.equal(value,null)};
 vm.runInNewContext(html.slice(start,end)+'\nvalidateFrameWork(parsed);',context);
}
test('built-in bank contains four original complete, locally playable and importable examples',()=>{
 assert.equal(bank.length,4);assert.equal(new Set(bank.map(item=>item.id)).size,4);
 const robot=bank.find(item=>item.id==='electro-robot');assert.equal(robot.settings.timbre,'robot');assert.equal(robot.settings.source,'rgb');
 for(const entry of bank){
  assert.deepEqual(Music.validateSettings(entry.settings),entry.settings);assert.equal(Object.keys(entry.settings).length,42);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(__dirname,entry.preset),'utf8')),entry.settings);
  const bytes=fs.readFileSync(path.join(__dirname,entry.wav)),v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(v.getUint16(22,true),2);assert.equal(v.getUint32(24,true),22050);
  assert.equal(v.getUint32(40,true),bytes.length-44);assert.equal((bytes.length-44)/4/22050,entry.duration);
  let peak=0,square=0;for(let i=44;i<bytes.length;i+=2){const value=v.getInt16(i,true)/32768;peak=Math.max(peak,Math.abs(value));square+=value*value;}
  assert.equal(peak,entry.peak);assert.ok(peak>0&&peak<.999);assert.equal(Math.sqrt(square/((bytes.length-44)/2)),entry.rms);
  assert.ok(fs.statSync(path.join(__dirname,entry.audio)).size>1000);
 }
});
test('all four recorded WAVs reproduce byte for byte from the shipped XOR field and JSON presets',async()=>{
 const g=Core.geometry(source.mode,source.vertices,source.rows),field=Core.field(g.W,source.rows,source.background,g.anchor);
 for(let k=0;k<source.vertices;k++)Core.cone(field,g.anchor+Core.offset(source.mode,k),source.rows);
 assert.equal(g.W,source.width);assert.equal(g.anchor,source.anchor);
 for(let y=0;y<source.rows;y++)assert.equal(Array.from(field.val.slice(y*g.W,(y+1)*g.W),bit=>bit<0?'.':String(bit)).join(''),source.bits[y]);
 const snapshot=await Field.capture({width:g.W,height:source.rows,readBit:(x,y)=>field.val[y*g.W+x]});
 const geometry=await Geometry.analyze(snapshot,{connectivity:'sides',yieldTask:()=>Promise.resolve()});
 for(const entry of bank){
  const encoded=Buffer.from(entry.frame.base64,'base64');assert.equal(hash(encoded),hash(fs.readFileSync(path.join(__dirname,entry.work))));
  const saved=await Work.decode(new Blob([encoded]));assert.equal(saved.format,'mayatnik-work');assert.equal(saved.version,2);
  validateHostFrame(saved);
  assert.deepEqual(saved.data.field,field.val);assert.equal(saved.data.k,source.vertices);assert.equal(saved.data.st.bg,'empty');
  assert.deepEqual(saved.data.st.xorrom,entry.settings);assert.equal(saved.data.libraryKind,'frame');assert.ok(!('library' in saved.data));
  const wav=Music.renderWav(entry.settings.autoGeometry?geometry:snapshot,entry.settings,{maxSeconds:60});
  assert.equal(wav.truncated,false);assert.equal(hash(wav.bytes),hash(fs.readFileSync(path.join(__dirname,entry.wav))),entry.name);
 }
});
