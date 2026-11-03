'use strict';
// node build-video.cjs [--ffmpeg C:/ffmpeg/bin/ffmpeg.exe] [--id electro-robot]
// The canonical bit renderer is captured as rectangle commands. Python only
// rasterizes those commands and encodes their media-clock sequence with FFmpeg.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const Visual=require('../mayatnik-xorrom-visual'),bank=require('../mayatnik-xorrom-bank');
const width=1280,height=720,fps=30,root=path.resolve(__dirname,'../..');
const work=path.join(root,'.git','carpet-video-work');fs.mkdirSync(work,{recursive:true});
const option=(key,fallback)=>{const i=process.argv.indexOf(key);return i<0?fallback:process.argv[i+1];};
function commands(prepared,time){
 const result=[],ctx={canvas:{width,height},fillStyle:'#000',strokeStyle:'#000',lineWidth:1,
  fillRect(x,y,w,h){result.push(['fill',this.fillStyle,x,y,w,h]);},
  strokeRect(x,y,w,h){result.push(['stroke',this.strokeStyle,x,y,w,h,this.lineWidth]);}};
 Visual.draw(ctx,prepared,time,{width,height});return result;
}
async function main(){
 const ffmpeg=option('--ffmpeg','ffmpeg'),filter=option('--id',null),results=[];
 for(const entry of bank.filter(e=>!filter||e.id===filter)){
  const prepared=await Visual.prepare(entry),base=commands(prepared,-1),position=Visual.layout(prepared.source,{width,height});
  const steps=prepared.timeline.map(step=>({...step,overlay:commands(prepared,(step.start+step.end)/2).slice(base.length)}));
  const frameCount=Math.ceil(prepared.duration*fps),frames=Array.from({length:frameCount},(_,i)=>Visual.stateAt(prepared,i/fps)?.index??null);
  const config={id:entry.id,name:entry.name,description:entry.description,width,height,fps,duration:prepared.duration,source:{width:prepared.source.width,height:prepared.source.height,bits:Array.from(prepared.source.bits)},position,palette:Visual.palette,base,steps,frames,
   audio:path.resolve(__dirname,entry.id+'.wav'),output:path.resolve(__dirname,entry.id+'.mp4'),work,ffmpeg};
  const file=path.join(work,entry.id+'.json');fs.writeFileSync(file,JSON.stringify(config));
  cp.execFileSync(option('--python','python'),[path.join(__dirname,'render-video.py'),file],{stdio:'inherit'});
  results.push({id:entry.id,name:entry.name,path:'audio-examples/'+entry.id+'.mp4',duration:entry.duration,width,height,fps,sourceRows:prepared.source.height,readingSteps:steps.length,scoreEnd:steps.at(-1).end});
 }
 if(!filter)fs.writeFileSync(path.join(__dirname,'videos.json'),JSON.stringify({version:1,renderer:'MayatnikXorromVisual',clock:'WAV sample-aligned scoreTimeline',items:results},null,2)+'\n');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
