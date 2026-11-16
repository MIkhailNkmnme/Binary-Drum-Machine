'use strict';
// Asset production only: no application, syntax, browser or visual tests.
// NODE_PATH=<directory containing sharp> node build-live.cjs [--id ID] [--resume]
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawn,execFileSync}=require('node:child_process');
const sharp=require('sharp');
const Scenes=require('../../mayatnik/mayatnik-phone-scenes.js');
const Render=require('../../mayatnik/mayatnik-phone-render.js');
const PhoneMusic=require('../../mayatnik/mayatnik-phone-music.js');
const Music=require('../../mayatnik/mayatnik-synthesis-music.js');
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(__dirname,'live');
const TEMP=path.resolve(__dirname,'../../../phone-live-build');
const WIDTH=720,HEIGHT=1600,FPS=30;
const option=(key,fallback)=>{const i=process.argv.indexOf(key);return i<0?fallback:process.argv[i+1];};
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const engines=['mayatnik-phone-scenes.js','mayatnik-phone-catalog.js','mayatnik-phone-render.js','mayatnik-phone-music.js','mayatnik-phone-robot.js','mayatnik-synthesis-music.js','mayatnik-bit-synthesis.js','mayatnik-synthesis-pendulums.js','mayatnik-animatrix-source.js','mayatnik-animatrix-core.js'];
const sources=Object.fromEntries(engines.map(name=>[name,sha(fs.readFileSync(path.join(ROOT,'mayatnik',name)))]));
const fingerprint=sha(JSON.stringify({sources,width:WIDTH,height:HEIGHT,fps:FPS,tempo:PhoneMusic.DEFAULT_TEMPO,steps:PhoneMusic.DEFAULT_STEPS,builder:sha(fs.readFileSync(__filename))}));
const visualEngines=['mayatnik-phone-scenes.js','mayatnik-phone-catalog.js','mayatnik-phone-render.js','mayatnik-synthesis-pendulums.js','mayatnik-animatrix-source.js','mayatnik-animatrix-core.js'];
function visualSignature(record){return sha(JSON.stringify({sources:Object.fromEntries(visualEngines.map(name=>[name,record.sources?.[name]])),width:record.width,height:record.height,fps:record.fps,tempo:record.tempo,steps:record.steps}));}
const visualFingerprint=visualSignature({sources,width:WIDTH,height:HEIGHT,fps:FPS,tempo:PhoneMusic.DEFAULT_TEMPO,steps:PhoneMusic.DEFAULT_STEPS});
const fileInfo=name=>{const bytes=fs.readFileSync(path.join(OUT,name));return {path:'live/'+name,bytes:bytes.length,sha256:sha(bytes)};};
async function encode(scene,composition,wav,output){
  const child=spawn(option('--ffmpeg','ffmpeg'),['-hide_banner','-loglevel','error','-y','-f','image2pipe','-vcodec','png','-framerate',composition.tempo+'/15','-i','pipe:0','-i',wav,'-t',composition.duration.toFixed(9),'-r',String(FPS),'-c:v','libx264','-preset','veryfast','-crf','21','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart',output],{stdio:['pipe','ignore','pipe'],windowsHide:true});
  let errorText='',pipeError;
  child.stderr.on('data',chunk=>{errorText=(errorText+chunk).slice(-8000);});
  child.stdin.on('error',error=>{pipeError=error;});
  const ended=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error('FFmpeg '+code+': '+errorText)));});
  // Attach a handler immediately while SVG rasterization is in progress.
  ended.catch(()=>{});
  try{
    for(const k of composition.frames){
      const frame=scene.frame(k);
      const svg=Render.svg(frame,{width:WIDTH,height:HEIGHT});
      const png=await sharp(Buffer.from(svg)).png({compressionLevel:1}).toBuffer();
      if(pipeError) throw pipeError;
      if(!child.stdin.write(png)) await new Promise((resolve,reject)=>{
        const cleanup=()=>{child.stdin.off('drain',drain);child.stdin.off('error',fail);child.off('close',closed);};
        const drain=()=>{cleanup();resolve();},fail=e=>{cleanup();reject(e);},closed=()=>fail(new Error(errorText||'Encoder stopped'));
        child.stdin.once('drain',drain);child.stdin.once('error',fail);child.once('close',closed);
      });
    }
    child.stdin.end();await ended;
  }catch(error){child.stdin.destroy();child.kill();await ended.catch(()=>{});throw error;}
}
async function main(){
  fs.mkdirSync(OUT,{recursive:true});fs.mkdirSync(TEMP,{recursive:true});
  const manifestPath=path.join(OUT,'manifest.json');
  let previous={items:[]};
  if(fs.existsSync(manifestPath))previous=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const items=previous.fingerprint===fingerprint?previous.items:[];
  const oldItems=previous.items||[];
  const reuseVideo=visualSignature(previous)===visualFingerprint;
  const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'wallpapers.json'),'utf8')).wallpapers;
  const selected=option('--id',null),resume=process.argv.includes('--resume');
  const save=()=>fs.writeFileSync(manifestPath,JSON.stringify({version:2,width:WIDTH,height:HEIGHT,fps:FPS,tempo:PhoneMusic.DEFAULT_TEMPO,steps:PhoneMusic.DEFAULT_STEPS,voice:'robot',fingerprint,visualFingerprint,sources,
    tempoNote:'137 BPM is a working setting, informed by the Beatport catalogue reference; it is not a user-mandated tempo or our audio measurement.',
    method:'Actual recipe evolution. Image and melodic partials use the same frame. Original formant speech says Russian zero, one and Zerkalius; it is inspired by the Roboter reference, not an emulation or a recording. Percussion rhythm and scale are composed.',
    acceptance:'Application, syntax, browser, visual and listening acceptance: user. Media generated by Node, Sharp and FFmpeg.',
    items:catalog.map(work=>items.find(item=>item.id===work.id)).filter(Boolean)},null,2)+'\n');
  for(const work of catalog){
    if(selected&&work.id!==selected)continue;
    const existing=items.find(item=>item.id===work.id);
    if(resume&&existing&&['video','audio','midi','score'].every(kind=>fs.existsSync(path.join(__dirname,existing[kind].path)))){console.log('Keep '+work.id);continue;}
    const scene=Scenes.create(work.id);
    const composition=PhoneMusic.renderWav(scene);
    const wav=path.join(TEMP,work.id+'.wav');fs.writeFileSync(wav,composition.bytes);
    const midi=work.id+'.mid',score=work.id+'.json',audio=work.id+'.mp3',video=work.id+'.mp4';
    fs.writeFileSync(path.join(OUT,midi),Music.exportMidi(composition.events,{tempo:composition.tempo,volume:.55}));
    fs.writeFileSync(path.join(OUT,score),JSON.stringify({id:work.id,title:work.title,voice:composition.voice,tempo:composition.tempo,duration:composition.duration,start:composition.start,steps:composition.steps,frames:composition.frames,events:composition.events,sources},null,2)+'\n');
    execFileSync(option('--ffmpeg','ffmpeg'),['-hide_banner','-loglevel','error','-y','-i',wav,'-c:a','libmp3lame','-b:a','160k',path.join(OUT,audio)],{windowsHide:true});
    const old=oldItems.find(item=>item.id===work.id);
    if(reuseVideo&&old&&fs.existsSync(path.join(OUT,video))){
      const next=path.join(TEMP,work.id+'-remux.mp4');
      execFileSync(option('--ffmpeg','ffmpeg'),['-hide_banner','-loglevel','error','-y','-i',path.join(OUT,video),'-i',wav,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','160k','-t',composition.duration.toFixed(9),'-movflags','+faststart',next],{windowsHide:true});
      fs.renameSync(next,path.join(OUT,video));
    }else await encode(scene,composition,wav,path.join(OUT,video));
    const item={id:work.id,title:work.title,variant:work.variant,category:work.category||'atlas',voice:composition.voice,duration:composition.duration,start:composition.start,steps:composition.steps,
      source:'../../mayatnik/Zerkalius-mayatnik.html?phoneScene='+encodeURIComponent(work.id),video:fileInfo(video),audio:fileInfo(audio),midi:fileInfo(midi),score:fileInfo(score)};
    const index=items.findIndex(entry=>entry.id===work.id);if(index<0)items.push(item);else items[index]=item;
    save();console.log('Produced '+work.id+' '+(item.video.bytes/1048576).toFixed(2)+' MiB · '+items.length+'/'+catalog.length);
  }
  save();
}
main().catch(error=>{console.error(error);process.exitCode=1;});
