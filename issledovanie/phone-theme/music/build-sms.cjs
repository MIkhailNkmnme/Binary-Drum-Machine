'use strict';
// Short isolated-note adaptations of the existing scores; not audio excerpts.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const home=path.resolve(__dirname,'..'),rate=44100;
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
const plans=[
 {source:'eight-winds-pulse',titles:['Тик','Искра','Свет','Пик','Два импульса'],pitches:[74,77,81,84],lengths:[.18,.21,.24,.28],double:.42,gap:.13},
 {source:'copper-orbit',titles:['Медь','Знак','Луч','Блик','Двойная медь'],pitches:[72,75,79,82],lengths:[.19,.22,.26,.30],double:.46,gap:.15},
 {source:'letter-of-two-rivers',titles:['Капля','Нота','Кристалл','Стекло','Две капли'],pitches:[76,79,84,88],lengths:[.20,.23,.27,.31],double:.50,gap:.17},
 {source:'thin-ice-nocturne',titles:['Льдинка','Точка','Снежинка','Звезда','Два кристалла'],pitches:[74,77,82,86],lengths:[.21,.25,.29,.33],double:.54,gap:.19}
];
function writeWav(samples){
 const b=Buffer.alloc(44+samples.length*2);b.write('RIFF',0);b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples.length*2,40);
 for(let i=0;i<samples.length;i++)b.writeInt16LE(Math.round(samples[i]*32767),44+i*2);
 return b;
}
function noteWave(voice,midi,time){
 const phase=time*2*Math.PI*440*2**((midi-69)/12),s=Math.sin,e=Math.exp;
 if(voice==='lead')return (.62*s(phase+.07*s(2*Math.PI*5.1*time)+.91*e(-time*7)*s(phase*2))+.19*s(phase*1.003)+.13*s(phase*3+Math.PI/4))*(.82+.18*e(-time*5));
 return .64*s(phase)*e(-time*2.2)+.24*s(phase*2.003)*e(-time*4.1)+.17*s(phase*3.009)*e(-time*7)+.1*s(phase*4.018)*e(-time*13)+.042*s(phase*7.06)*e(-time*31);
}
const manifest={version:1,signals:[]};
for(const plan of plans){
 const sourcePath='music/'+plan.source+'-score.json',sourceText=fs.readFileSync(path.join(home,sourcePath),'utf8'),score=JSON.parse(sourceText);
 const voice=score.style==='techno'?'lead':'piano';
 const candidates=score.events.map((event,index)=>({event,index})).filter(x=>x.event.voice===voice&&x.event.midi>=60&&(voice==='lead'||x.event.pan!==-.22)).sort((a,b)=>a.event.beat-b.event.beat);
 for(let j=0;j<5;j++){
  const double=j===4,requested=plan.pitches[double?0:j];
  const first=candidates.find(x=>x.event.midi===requested&&x.event.beat>=16);
  if(!first)throw new Error('Missing source note '+requested);
  const chosen=[first];
  if(double){const second=candidates.find(x=>x.event.beat>first.event.beat&&x.event.midi!==first.event.midi);if(!second)throw new Error('Missing second note');chosen.push(second);}
  const totalSamples=Math.round((double?plan.double:plan.lengths[j])*rate),duration=totalSamples/rate;
  const id='sms-'+String(manifest.signals.length+1).padStart(2,'0');
  const guard=441/rate; // 10 ms inside the existing duration, to contain MP3 pre-echo.
  const notes=chosen.map((x,k)=>({sourceEventIndex:x.index,sourceBeat:x.event.beat,sourceSeconds:x.event.beat*60/score.bpm,sourceEvent:x.event,onset:(k?Math.round(plan.gap*rate)/rate:0)+guard,midi:x.event.midi,voice,gain:k?.88:1,duration:k?duration-Math.round(plan.gap*rate)/rate-guard:double?Math.round((plan.gap+.055)*rate)/rate:duration-guard}));
  const envelope={attackSeconds:.003,releaseSeconds:.018,exponentialDecay:4.8,formula:'min(1,t/attack) * exp(-4.8*t/noteDuration) * sin(pi/2 * min(1,(noteDuration-t)/release))^2'};
  const pcm=new Float64Array(totalSamples);
  for(const n of notes){const offset=Math.round(n.onset*rate),count=Math.round(n.duration*rate);for(let i=0;i<count&&offset+i<pcm.length;i++){const t=i/rate,remaining=(count-1-i)/rate;const env=Math.min(1,t/envelope.attackSeconds)*Math.exp(-envelope.exponentialDecay*t/n.duration)*Math.sin(Math.PI/2*Math.min(1,remaining/envelope.releaseSeconds))**2;pcm[offset+i]+=noteWave(n.voice,n.midi,t)*env*n.gain;}}
  let peak=0;for(const x of pcm)peak=Math.max(peak,Math.abs(x));const gain=.60/peak;for(let i=0;i<pcm.length;i++)pcm[i]*=gain;
  const wav='audio/'+id+'.wav',src='audio/'+id+'.mp3';fs.writeFileSync(path.join(home,wav),writeWav(pcm));
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',path.join(home,wav),'-c:a','libmp3lame','-q:a','0','-metadata','title='+plan.titles[j],'-metadata','artist=Zerkalius · короткие SMS',path.join(home,src)]);
  const decodedMp3Samples=execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-i',path.join(home,src),'-f','f32le','pipe:1']).length/4;
  manifest.signals.push({id,title:plan.titles[j],duration:decodedMp3Samples/rate,src,wav,sourceTitle:score.title,description:(double?'Две короткие атаки':'Одиночная короткая атака')+(voice==='lead'?' синтетического lead.':' синтетического фортепиано.'),recipe:{kind:'isolated-score-note-adaptation',sourceId:score.id,sourceScore:sourcePath,sourceScoreSha256:sha(sourceText.replace(/\r\n/g,'\n')),sourceHashNormalization:'LF',sourceInstrument:'mayatnik/mayatnik-synthesis-music.js',method:'Высоты и тип тембра взяты из конкретных событий партитуры. Пересинтез с новой короткой огибающей; сопровождение и эхо отсутствуют. Не вырезка из готового MP3.',sampleRate:rate,channels:1,totalSamples,wavDuration:duration,decodedMp3Samples,notes,envelope,normalization:{samplePeakTarget:.60,gain},effects:[]}});
  console.log(id,duration.toFixed(3)+'s',notes.map(n=>n.midi).join('+'),voice);
 }
}
fs.writeFileSync(path.join(home,'sms.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Built 20 short SMS signals, 40 files.');
