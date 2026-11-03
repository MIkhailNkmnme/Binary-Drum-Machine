'use strict';
// Original demonstrations made only with the shipped Mayatnik/Xorrom engines.
// node build.cjs [--ffmpeg C:/ffmpeg/bin/ffmpeg.exe]
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const Core=require('../mayatnik-core'),Field=require('../mayatnik-xorrom-field'),Geometry=require('../mayatnik-xorrom-geometry'),Music=require('../mayatnik-xorrom');
const Work=require('../mayatnik-work-file'),Reset=require('../mayatnik-reset-state'),Animatrix=require('../mayatnik-animatrix-source');
const OUT=__dirname,H=128,K=31,mode='pend',background='empty';
const specs=[
 {id:'electro-robot',name:'Электро-робот',description:'Ровный машинный шаг, гласноподобный тембр Робот и низкий синтетический бас. Оригинальный пример в духе ранней роботизированной электроники.',patch:{
   source:'rgb',bpm:116,division:16,tonic:0,scale:'minor',octave:3,timbre:'robot',gain:.95,chord:1,backing:'bass',backingGain:.38,backingTimbre:'softsquare',backingRows:4,
   filterType:'lowpass',cutoff:4200,resonance:1.1,lfoTarget:'filter',lfoRate:1,lfoDepth:.12,delayTime:240/16/116*2,delayFeedback:.22,delayMix:.12,reverbMix:.03,reverbTime:.35}},
 {id:'xor-pulse',name:'XOR-пульс',description:'Число единиц каждой строки управляет короткими басовыми импульсами. Небольшой swing и вторая партия выделяют ритм рисунка.',patch:{
   source:'melody',bpm:124,division:16,tonic:9,scale:'minor',octave:3,timbre:'pulse',gain:.95,chord:1,backing:'counter',backingGain:.3,backingTimbre:'triangle',backingRows:8,
   envelopeOn:true,attack:.002,decay:.055,sustain:.3,release:.025,filterType:'lowpass',cutoff:1700,resonance:.9,swing:.16}},
 {id:'glass-arpeggio',name:'Стеклянные ступени',description:'Два частых RGB-цвета звучат по очереди щипками в пентатонике. Эхо и мягкая вторая партия дают объём.',patch:{
   source:'rgb',bpm:108,division:8,tonic:2,scale:'pentatonic',octave:4,timbre:'pluck',gain:.95,chord:2,stride:2,backing:'pad',backingGain:.16,backingTimbre:'sine',backingRows:8,
   arpMode:'updown',arpGate:.64,delayTime:240/8/108*1.5,delayFeedback:.25,delayMix:.2,reverbMix:.12,reverbTime:1.2,pan:-.08}},
 {id:'triangle-space',name:'Пространство треугольника',description:'Медленное чтение каждой четвёртой строки. Симметрия области меняет лад и октаву; синус, плавная огибающая и созвучие создают спокойный фон.',patch:{
   source:'melody',bpm:72,division:8,tonic:5,scale:'pentatonic',octave:4,timbre:'sine',gain:.95,chord:1,stride:4,autoGeometry:true,geometrySource:'symmetry',geometryConnectivity:'sides',
   backing:'pad',backingGain:.45,backingTimbre:'triangle',backingRows:8,envelopeOn:true,attack:.075,decay:.14,sustain:.7,release:.42,
   filterType:'lowpass',cutoff:2800,resonance:.7,lfoTarget:'gain',lfoRate:.7,lfoDepth:.15,reverbMix:.22,reverbTime:1.8}}
];
async function main(){
 const g=Core.geometry(mode,K,H),field=Core.field(g.W,H,background,g.anchor);
 for(let k=0;k<K;k++)Core.cone(field,g.anchor+Core.offset(mode,k),H);
 const score=await Field.capture({width:g.W,height:H,readBit:(x,y)=>field.val[y*g.W+x]});
 const geometry=await Geometry.analyze(score,{connectivity:'sides',yieldTask:()=>Promise.resolve()});
 const source={mode,rows:H,vertices:K,background,view:'bits',colourFilter:[],direction:'top-down',width:g.W,anchor:g.anchor,first:0,last:H-1};
 const sourceRows=Array.from({length:H},(_,y)=>Array.from(field.val.slice(y*g.W,(y+1)*g.W),bit=>bit<0?'.':String(bit)).join(''));
 fs.writeFileSync(path.join(OUT,'source-field.json'),JSON.stringify({...source,bits:sourceRows},null,2)+'\n');
 const paths=[0,1].map(bit=>{let d='';for(let y=0;y<H;y++)for(let x=0;x<g.W;){if(field.val[y*g.W+x]!==bit){x++;continue;}const first=x;while(x<g.W&&field.val[y*g.W+x]===bit)x++;d+='M'+first+' '+y+'h'+(x-first)+'v1H'+first+'z';}return '<path fill="'+(bit?'#e8edf5':'#5b6475')+'" d="'+d+'"/>';});
 fs.writeFileSync(path.join(OUT,'source-field.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="'+g.W+'" height="'+H+'" viewBox="0 0 '+g.W+' '+H+'" shape-rendering="crispEdges"><title>Исходный кадр Маятника: 128 строк, 31 вершина</title><rect width="100%" height="100%" fill="#000"/>'+paths.join('')+'</svg>\n');
 const ffmpegIndex=process.argv.indexOf('--ffmpeg'),ffmpeg=ffmpegIndex<0?'ffmpeg':process.argv[ffmpegIndex+1];
 const bank=[];
 for(const spec of specs){
  const settings=Music.validateSettings({...Music.DEFAULTS,...spec.patch,last:H-1,loop:true});
  const wav=Music.renderWav(settings.autoGeometry?geometry:score,settings,{maxSeconds:60});assert.equal(wav.truncated,false);
  const view=new DataView(wav.bytes.buffer,wav.bytes.byteOffset,wav.bytes.byteLength);let peak=0,squares=0;
  for(let i=44;i<wav.bytes.length;i+=2){const sample=view.getInt16(i,true)/32768;peak=Math.max(peak,Math.abs(sample));squares+=sample*sample;}
  const rms=Math.sqrt(squares/((wav.bytes.length-44)/2));assert.ok(peak>0&&peak<.999);assert.ok(rms>0);
  fs.writeFileSync(path.join(OUT,spec.id+'.wav'),wav.bytes);fs.writeFileSync(path.join(OUT,spec.id+'.json'),JSON.stringify(settings,null,2)+'\n');
  cp.execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-i',path.join(OUT,spec.id+'.wav'),'-c:a','libmp3lame','-b:a','160k',path.join(OUT,spec.id+'.mp3')]);
  const state={...Reset.defaults(),...Animatrix.defaults(),constructionEvolution:1,rows:H,steps:K,mode,bg:background,view:'bits',zoom:'fit',zMid:false,ztop:false,zBot:false,xorrom:settings};
  const data={schema:2,libraryKind:'frame',st:state,k:K,field:field.val.slice(),width:g.W,height:H,frameBounds:{left:0,top:0,width:g.W,height:H},
    colour:'#ff8800',mirror:false,fill:null,paintBits:null,face:null,templatePaint:null,templateMatches:null,manualPattern:null,paintRepeat:null,columns:[],colourAuto:{},
    templates:[],pickedTemplates:[],offsetX:0,returnTo:null,paintBit:null,visible:false,options:{height:1,down:0,alpha:100,proportional:true,trail:false},mirrors:{live:false,xor:false,base:null},
    frameHost:{version:1,controls:{},layers:[{id:'original',kind:'original',name:'Поле',order:0,visible:true,opacity:100,x:0,y:0,tint:null}],overlay:null,frozen:null,locks:null,third:null,lastShown:null,
      chess:{layer:null,previous:null,next:0},replay:[],viewport:{left:0,top:0},state:{fillMode:false,autoVertical:0,chessLive:false,mirrorLine:false,rulerMode:false,templateMove:false,templateAxisUnlocked:false,templateTransfer:false}}};
  const work=new Uint8Array(await (await Work.encode(data)).arrayBuffer());
  fs.writeFileSync(path.join(OUT,spec.id+'.mayatnik'),work);
  const entry={id:spec.id,name:spec.name,description:spec.description,settings,thumbnail:'audio-examples/source-field.svg',audio:'audio-examples/'+spec.id+'.mp3',wav:'audio-examples/'+spec.id+'.wav',preset:'audio-examples/'+spec.id+'.json',work:'audio-examples/'+spec.id+'.mayatnik',
    frame:{format:'mayatnik-work',version:2,base64:Buffer.from(work).toString('base64'),rows:H,k:K,width:g.W,height:H},source:{...source,stride:settings.stride},duration:wav.duration,peak,rms};
  bank.push(entry);console.log(JSON.stringify({id:spec.id,duration:wav.duration,peak,rms,channels:view.getUint16(22,true)}));
 }
 fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify({version:1,engine:'0.865',source,items:bank},null,2)+'\n');
 fs.writeFileSync(path.join(OUT,'../mayatnik-xorrom-bank.js'),'/* Original built-in Xorrom audio demonstrations. Generated by audio-examples/build.cjs. */\n(function(root,factory){if(typeof module===\'object\'&&module.exports)module.exports=factory();else root.MayatnikXorromBank=factory();})(globalThis,function(){return '+JSON.stringify(bank,null,2)+';});\n');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
