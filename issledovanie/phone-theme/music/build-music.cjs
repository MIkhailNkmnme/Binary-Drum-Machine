'use strict';
// Reproducible phone collection. Requires Node.js, ffmpeg and ffprobe on PATH.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const home = path.resolve(__dirname, '..');
const repo = path.resolve(home, '../..');
const M = require(path.join(repo, 'mayatnik/mayatnik-synthesis-music.js'));
const E = require(path.join(repo, 'mayatnik/mayatnik-synthesis-pendulums.js'));
const G = require(path.join(repo, 'mayatnik/synthesis-gallery.js'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zerk-phone-'));
const audio = path.join(home, 'audio');
fs.mkdirSync(audio, {recursive:true});
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ff = args => execFileSync('ffmpeg', ['-hide_banner','-loglevel','error','-y',...args], {maxBuffer:256*1024*1024});
const probe = file => JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,sample_rate,channels','-of','json',file],{encoding:'utf8'}));
const write = (file,data) => fs.writeFileSync(path.join(home,file), JSON.stringify(data,null,2)+'\n');
const clipsOnly = process.argv.includes('--clips-only');
const manifest = clipsOnly ? JSON.parse(fs.readFileSync(path.join(home,'music.json'),'utf8')) : {version:1, tracks:[], notifications:[]};
manifest.notifications=[];
const plans = [
 {id:'eight-winds-pulse',title:'Импульс восьми ветров',description:'Техно с ясным трёхнотным зовом, воздушной серединой и возвращением полного ритма.',bpm:126,root:50,scale:'minor',style:'techno',work:'eight-winds',bars:40,ringBar:8,ringBars:12,motif:[0,4,7,6,4,2,0,4],rhythm:[0,3,6,8,10,12,14,15]},
 {id:'copper-orbit',title:'Медная орбита',description:'Более медленный пружинистый грув: короткий вопрос, ответ в верхнем регистре и медное эхо.',bpm:118,root:48,scale:'minor',style:'techno',work:'copper-echo',bars:40,ringBar:8,ringBars:12,motif:[4,2,0,2,4,7,6,4],rhythm:[0,2,5,7,10,12,14,15]},
 {id:'letter-of-two-rivers',title:'Письмо двух рек',description:'Камерная пьеса для синтетического фортепиано и струнных: плавная тема, тихий ответ и светлая реприза.',bpm:88,root:53,scale:'major',style:'classic',work:'two-rivers',bars:28,ringBar:4,ringBars:8,motif:[2,4,7,6,4,5,4,2],rhythm:[0,4,6,8,12,14]},
 {id:'thin-ice-nocturne',title:'Тонкий лёд',description:'Спокойный минорный ноктюрн: редкие высокие ноты над прозрачным арпеджио, затем тёплый ответ.',bpm:76,root:50,scale:'minor',style:'classic',work:'thin-ice',bars:24,ringBar:4,ringBars:8,motif:[7,4,2,0,2,4,3,2],rhythm:[0,4,8,10,12,14]}
];
const scales={minor:[0,2,3,5,7,8,10],major:[0,2,4,5,7,9,11]};
const degreeNote=(p,d)=>p.root+Math.floor(d/7)*12+scales[p.scale][((d%7)+7)%7];
const constructions=[];
function section(p,bar) {
 if (p.style==='techno') return bar<4?'Вступление':bar<12?'Тема A':bar<20?'Ответ B':bar<24?'Разрежение':bar<36?'Реприза A′':'Кода';
 return bar<4?'Вступление':bar<12?'Тема A':bar<(p.bars===28?20:16)?'Ответ B':bar<p.bars-4?'Реприза A′':'Кода';
}
function pcmStats(buf, channels=2, rate=44100) {
 let peak=0,sum=0,clipped=0,first=-1,last=-1;
 const count=buf.length/4;
 for(let i=0;i<count;i++){const x=buf.readFloatLE(i*4),a=Math.abs(x);assert(Number.isFinite(x));peak=Math.max(peak,a);sum+=x*x;if(a>=.999)clipped++;if(a>.001){if(first<0)first=i;last=i;}}
 return {duration:count/channels/rate,peak,peakDb:20*Math.log10(peak||1e-12),rmsDb:10*Math.log10(sum/count||1e-12),clipped,leadingSilence:first<0?count/channels/rate:first/channels/rate,trailingSilence:last<0?count/channels/rate:(count-1-last)/channels/rate,firstSample:buf.readFloatLE(0),lastSample:buf.readFloatLE(buf.length-4)};
}
function encode(input, output, filter, title, extra=[]) {
 const ext=path.extname(output);
 const codec=ext==='.mp3'?['-c:a','libmp3lame','-q:a','2']:ext==='.m4r'?['-c:a','aac','-b:a','192k','-f','ipod']:['-c:a','pcm_s16le'];
 ff(['-i',input,'-af',filter,...extra,...codec,'-metadata','title='+title,'-metadata','artist=Zerkalius · Синтез',output]);
}
for(const p of (clipsOnly ? [] : plans)){
 console.log('Composing',p.title);
 const work=G.works.find(x=>x.id===p.work), model=G.engineFor(E,work,0);
 const options={style:p.style,tempo:p.bpm,root:p.root,scale:p.scale,density:4,volume:.59};
 const events=[], trace=[], fieldDigest=crypto.createHash('sha256');
 const harmony=p.scale==='major'?[0,4,5,3,0,3,4,4]:[0,5,2,6,0,5,3,4];
 const steps=p.bars*16;
 for(let tick=0;tick<steps;tick++){
  const bar=Math.floor(tick/16), step=tick%16, sec=section(p,bar);
  const frame={a:model.a,b:model.b,result:model.output,width:model.width,height:model.height,tick};
  fieldDigest.update(model.output);
  const base=M.frameEvents(frame,options), isTech=p.style==='techno';
  const baseMelody=base.find(e=>isTech?e.voice==='lead':e.voice==='piano'&&e.pan!==-.22);
  let ones=0,occupied=0;for(const x of model.output){if(x>=0)occupied++;if(x===1)ones++;}
  const ratio=ones/Math.max(1,occupied);
  if(step===0)trace.push({bar:bar+1,engineTick:model.tick,ones,occupied,ratio,section:sec,fieldSha256:crypto.createHash('sha256').update(model.output).digest('hex')});
  for(const e0 of base){
   if(isTech?e0.voice==='lead':e0.voice==='piano'&&e0.pan!==-.22)continue;
   const e={...e0};
   if(sec==='Вступление'&&isTech&&(e.voice==='snare'||(bar<2&&e.voice==='kick')))continue;
   if(sec==='Разрежение'&&['kick','snare','hat'].includes(e.voice))continue;
   if(sec==='Кода'&&isTech&&['hat','snare'].includes(e.voice))continue;
   if(sec==='Кода'&&bar===p.bars-1&&step>=8)continue;
   e.velocity*=isTech?(e.voice==='bass'?.86:1):.72;
   if(sec==='Вступление'||sec==='Ответ B')e.velocity*=.84;
   if(sec==='Кода')e.velocity*=.75;
   events.push(e);
  }
  const index=p.rhythm.indexOf(step);
  if(index>=0 && !(sec==='Вступление'&&bar<2&&index%2) && !(sec==='Кода'&&bar===p.bars-1)){
   // A deliberately composed motif and harmony. Field occupancy shapes dynamics,
   // the original sonifier shapes stereo; neither is described as physical harmony.
   let motifIndex=(index+(bar%2?2:0))%p.motif.length;
   if(sec==='Ответ B')motifIndex=(p.motif.length-1-motifIndex+p.motif.length)%p.motif.length;
   let degree=p.motif[motifIndex]+harmony[bar%8];
   if(bar%8===7&&step>=12)degree=step===14?6:8;
   const duration=isTech?(index===0?.62:.31):(step===0||step===8?1.35:.70);
   const dynamic=(isTech?.66:.78)*(.8+.2*ratio)*(sec==='Ответ B'?.86:1)*(sec==='Кода'?.72:1);
   const note={beat:tick/4,duration,midi:degreeNote(p,degree)+12,velocity:dynamic,voice:isTech?'lead':'piano',pan:baseMelody?.pan||0};
   events.push(note);
   if(sec==='Реприза A′'&&index===0)events.push({...note,midi:note.midi+12,velocity:note.velocity*.22,pan:.25});
   if(sec==='Ответ B'&&!isTech&&index===0)events.push({...note,beat:note.beat+1,midi:note.midi-12,velocity:.28,pan:-.3});
  }
  model.step();
 }
 const cadenceBeat=p.bars*4-2;
 for(const [i,n] of [0,2,4,7].entries())events.push({beat:cadenceBeat,duration:2.6,midi:degreeNote(p,n),velocity:i===0?.55:.37,voice:p.style==='techno'?'strings':'piano',pan:(i-1.5)*.18});
 const duration=p.bars*240/p.bpm+2;
 const raw=path.join(temp,p.id+'-raw.wav'), master=path.join(temp,p.id+'.wav');
 fs.writeFileSync(raw,M.renderWav(events,options,{durationSeconds:duration,sampleRate:44100}));
 const effects=p.style==='techno'?'highpass=f=32,aecho=0.88:0.90:119|238:0.10|0.045':'highpass=f=45,aecho=0.85:0.90:37|79|137:0.13|0.09|0.045';
 const pcm=ff(['-i',raw,'-af',effects,'-t',String(duration),'-ar','44100','-ac','2','-f','f32le','pipe:1']);
 const stats=pcmStats(pcm), target=p.style==='techno'?-17.5:-20;
 const gain=Math.min(10**((target-stats.rmsDb)/20),.70/stats.peak,3.5);
 const mastering=effects+',volume='+gain+',afade=t=in:d=0.025,afade=t=out:st='+(duration-.65)+':d=0.65,atrim=duration='+duration;
 encode(raw,master,mastering,p.title);
 const mp3='audio/'+p.id+'.mp3';encode(master,path.join(home,mp3),'anull',p.title);
 const ringStart=p.ringBar*240/p.bpm, ringDuration=p.ringBars*240/p.bpm;
 const ringtone={mp3:'audio/'+p.id+'-ringtone.mp3',m4r:'audio/'+p.id+'-ringtone.m4r',duration:ringDuration,start:ringStart,end:ringStart+ringDuration};
 const ringFilter='atrim=start='+ringStart+':end='+(ringStart+ringDuration)+',asetpts=PTS-STARTPTS,afade=t=in:d=0.025,afade=t=out:st='+(ringDuration-.65)+':d=0.65';
 for(const ext of ['mp3','m4r'])encode(path.join(home,mp3),path.join(home,ringtone[ext]),ringFilter,p.title+' · звонок');
 const recipe='music/'+p.id+'-score.json';
 const sourceFiles=['mayatnik/mayatnik-core.js','mayatnik/mayatnik-synthesis-pendulums.js','mayatnik/mayatnik-synthesis-music.js','mayatnik/synthesis-gallery.js','mayatnik/synthesis-album/construction-parameters.json'].map(file=>({file,normalization:'LF',sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,file),'utf8').replace(/\r\n/g,'\n')).digest('hex')}));
 const score={version:1,...p,options,duration,field:{width:model.width,height:model.height,anchor:model.anchor,options:model.options,initialTick:0,tickPerSixteenth:1,sha256:fieldDigest.digest('hex')},sourceFiles,form:trace.filter((x,i)=>i===0||x.section!==trace[i-1].section).map(x=>({title:x.section,startBar:x.bar,startSeconds:(x.bar-1)*240/p.bpm})),mapping:'Авторские мотив, лад, гармонический цикл и форма; поле маятников задаёт часть событий сопровождения через frameEvents, плотность единиц задаёт динамику новой темы, поле задаёт стереопозицию через исходный сонификатор. Гармония не выведена из физики.',motifDegrees:p.motif,harmonyDegrees:harmony,mastering:{filter:mastering,rawStats:stats,gain,targetRmsDb:target},ringtone:{...ringtone,filter:ringFilter,source:mp3},barTrace:trace,events};
 write(recipe,score);fs.writeFileSync(path.join(__dirname,p.id+'.mid'),M.exportMidi(events,options));
 manifest.tracks.push({id:p.id,title:p.title,description:p.description,bpm:p.bpm,duration,src:mp3,ringtone,recipe});
 constructions.push(score);
 console.log('Rendered',p.id,duration.toFixed(3),events.length,'events');
}
const sources=[
 {id:'pendulum-drive',title:'Маятниковый привод',src:'../../mayatnik/synthesis-album/pendulum-drive.mp3',bpm:128},
 {id:'two-shores-canon',title:'Канон двух берегов',src:'../../mayatnik/synthesis-album/two-shores-canon.mp3',bpm:84},
 ...manifest.tracks
];
const clipPlans=[
 [0,'Первый импульс',8,0,2.0],[0,'Привод',12,1,1.5],[0,'Двойной шаг',20,2,2.5],[0,'Искра',28,0,1.25],
 [1,'Два берега',4,0,2.8],[1,'Капля',8,2,1.6],[1,'Ответ реки',12,0,3.2],[1,'Тихий канон',16,2,2.4],
 [2,'Восемь ветров',8,0,2.4],[2,'Порыв',12,1.5,1.5],[2,'Возвращение',26,0,3.0],
 [3,'Медь',8,0,2.2],[3,'Орбита',14,1.25,1.6],[3,'Медный ответ',26,0,3.2],
 [4,'Письмо',4,0,2.8],[4,'Светлая нота',8,1.5,1.4],[4,'Встреча',20,0,3.4],
 [5,'Лёд',4,0,3.0],[5,'Хрусталь',8,2,1.8],[5,'Сумерки',16,0,3.6]
];
for(const [i,plan]of clipPlans.entries()){
 const [sourceIndex,title,bar,beat,length]=plan, source=sources[sourceIndex];
 const start=(bar*4+beat)*60/source.bpm,end=start+length,id='notice-'+String(i+1).padStart(2,'0');
 const src='audio/'+id+'.mp3',wav='audio/'+id+'.wav';
 const filter='atrim=start='+start+':end='+end+',asetpts=PTS-STARTPTS,pan=mono|c0=0.5*c0+0.5*c1,afade=t=in:d=0.018,afade=t=out:st='+(length-.16)+':d=0.16';
 const sourceFile=path.join(home,source.src);
 encode(sourceFile,path.join(home,src),filter,title,['-ac','1','-ar','44100']);
 encode(sourceFile,path.join(home,wav),filter,title,['-ac','1','-ar','22050']);
 manifest.notifications.push({id,title,duration:length,src,wav,sourceTitle:source.title,sourceId:source.id,start,end,source:source.src,sourceSha256:sha(sourceFile),filter});
}
write('music.json',manifest);
write('music/source-index.json',{sourceTracks:sources.map(s=>({...s,sha256:sha(path.join(home,s.src))})),codec:{mp3:'libmp3lame quality 2',m4r:'AAC 192 kbit/s stereo',notificationWav:'PCM 16 bit / 22050 Hz / mono'},created:'2026-11-13',buildCommand:'node issledovanie/phone-theme/music/build-music.cjs'});
console.log('Built',manifest.tracks.length,'tracks and',manifest.notifications.length,'notifications');
console.log('Temporary uncompressed masters:',temp);
