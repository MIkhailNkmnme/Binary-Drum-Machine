'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const home=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(home,'sms.json'),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const ff=args=>execFileSync('ffmpeg',['-hide_banner','-loglevel','error',...args],{maxBuffer:16*1024*1024});
const report=[],waveforms=[];
assert.equal(manifest.signals.length,20);
for(const signal of manifest.signals){
 const recipe=signal.recipe,sourceText=fs.readFileSync(path.join(home,recipe.sourceScore),'utf8'),score=JSON.parse(sourceText);
 assert.equal(sha(sourceText.replace(/\r\n/g,'\n')),recipe.sourceScoreSha256);
 assert(recipe.notes.length===1||recipe.notes.length===2);
 for(const note of recipe.notes){assert.deepEqual(note.sourceEvent,score.events[note.sourceEventIndex]);assert.equal(note.midi,note.sourceEvent.midi);assert.equal(note.voice,note.sourceEvent.voice);}
 for(const relative of [signal.src,signal.wav]){
  const file=path.join(home,relative);
  const media=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,sample_rate,channels','-of','json',file],{encoding:'utf8'}));
  assert.equal(media.streams.length,1);assert.equal(media.streams[0].channels,1);assert.equal(Number(media.streams[0].sample_rate),44100);assert.equal(media.streams[0].codec_name,relative.endsWith('.mp3')?'mp3':'pcm_s16le');
  const pcm=ff(['-i',file,'-ar','44100','-ac','1','-f','f32le','pipe:1']);
  const sampleCount=pcm.length/4,duration=sampleCount/44100,values=new Float32Array(sampleCount);
  assert(duration<=.7&&duration>=.16);assert.equal(sampleCount,relative.endsWith('.mp3')?recipe.decodedMp3Samples:recipe.totalSamples);
  assert.equal(duration,relative.endsWith('.mp3')?signal.duration:recipe.wavDuration);
  let peak=0,squares=0,clipCount=0,first=-1,last=-1,maxAdjacentStep=0;
  for(let i=0;i<sampleCount;i++){const x=pcm.readFloatLE(i*4);assert(Number.isFinite(x));values[i]=x;peak=Math.max(peak,Math.abs(x));squares+=x*x;if(Math.abs(x)>=.999)clipCount++;if(Math.abs(x)>.001){if(first<0)first=i;last=i;}if(i)maxAdjacentStep=Math.max(maxAdjacentStep,Math.abs(values[i]-values[i-1]));}
  const leadingSilence=first/44100,trailingSilence=(sampleCount-1-last)/44100;
  assert.equal(clipCount,0);assert(peak<10**(-3/20));assert(first>=0&&leadingSilence<.012);assert(trailingSilence<.04);
  assert(Math.abs(values[0])<.003&&Math.abs(values.at(-1))<.003);
  const oversampled=ff(['-i',file,'-ar','176400','-ac','1','-f','f32le','pipe:1']);let oversampledPeak=0;
  for(let i=0;i<oversampled.length;i+=4)oversampledPeak=Math.max(oversampledPeak,Math.abs(oversampled.readFloatLE(i)));
  assert(oversampledPeak<10**(-3/20),'oversampled headroom '+relative);
  const row={file:relative,bytes:fs.statSync(file).size,sha256:sha(fs.readFileSync(file)),pcmSha256:sha(pcm),sampleCount,duration,sampleRate:44100,channels:1,media,peak,peakDb:20*Math.log10(peak),rmsDb:10*Math.log10(squares/sampleCount),clippedSamples:clipCount,leadingSilence,trailingSilence,firstSample:values[0],lastSample:values.at(-1),maxAdjacentStep,oversampledPeak,oversampledPeakDb:20*Math.log10(oversampledPeak),oversampleRate:176400};report.push(row);
  assert(row.rmsDb>-30,'audible '+relative);
  if(relative.endsWith('.wav'))waveforms.push({id:signal.id,values,hash:sha(pcm)});
  console.log('OK',relative,duration.toFixed(3)+'s',row.oversampledPeakDb.toFixed(2)+'dBFS');
 }
}
// Compare a common 140 ms window, rather than letting different lengths alone
// establish distinctness. Absolute normalized correlation catches phase inversion.
const pairs=[];
for(let a=0;a<waveforms.length;a++)for(let b=a+1;b<waveforms.length;b++){
 const x=waveforms[a],y=waveforms[b];assert.notEqual(x.hash,y.hash);let xy=0,xx=0,yy=0;
 for(let i=0;i<6174;i++){xy+=x.values[i]*y.values[i];xx+=x.values[i]**2;yy+=y.values[i]**2;}
 const correlation=Math.abs(xy/Math.sqrt(xx*yy));
 // Same source pitch in a single/double pair intentionally shares an attack;
 // that pair must instead differ beyond the second attack in the full waveform.
 let diffEnergy=0,totalEnergy=0;const end=Math.max(x.values.length,y.values.length);
 for(let i=0;i<end;i++){const v=x.values[i]||0,w=y.values[i]||0;diffEnergy+=(v-w)**2;totalEnergy+=v*v+w*w;}
 const differenceRatio=diffEnergy/totalEnergy;assert(differenceRatio>.025,'near duplicate '+x.id+' '+y.id);
 pairs.push({a:x.id,b:y.id,attackAbsCorrelation:correlation,fullDifferenceRatio:differenceRatio});
}
const result={passed:true,files:report.length,singleSignals:manifest.signals.filter(s=>s.recipe.notes.length===1).length,doubleSignals:manifest.signals.filter(s=>s.recipe.notes.length===2).length,checks:report,distinctness:{pairs:pairs.length,uniqueWavPcmHashes:new Set(waveforms.map(x=>x.hash)).size,minFullDifferenceRatio:Math.min(...pairs.map(x=>x.fullDifferenceRatio)),comparisons:pairs},sourceNoteChecks:'Every source event index, pitch, voice and complete event matches its referenced unchanged JSON score.',limits:{maxPcmSeconds:.7,minPcmSeconds:.16,maxPeakDb:-3,maxLeadingSilenceSeconds:.012,maxTrailingSilenceSeconds:.04,minFullDifferenceRatio:.025},limitations:'Инструментальные проверки. Пересчёт 176,4 кГц — практическая проверка межотсчётных пиков. Субъективное прослушивание и установка на физический телефон не выполнялись.'};
fs.writeFileSync(path.join(__dirname,'sms-checks.json'),JSON.stringify(result,null,2)+'\n');
console.log('PASS',report.length,'files;',pairs.length,'distinctness pairs; source notes verified.');
