'use strict';
// Checks decoded signals, oversampled peaks, lengths, tails and clip provenance.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const home=path.resolve(__dirname,'..'),repo=path.resolve(home,'../..');
const manifest=JSON.parse(fs.readFileSync(path.join(home,'music.json'),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const ff=args=>execFileSync('ffmpeg',['-hide_banner','-loglevel','error',...args],{maxBuffer:256*1024*1024});
const list=[];
assert.equal(manifest.tracks.length,4);assert.equal(manifest.notifications.length,20);
for(const t of manifest.tracks){assert(t.duration>=60&&t.duration<=100);assert(t.ringtone.duration>=20&&t.ringtone.duration<=30);list.push([t.src,t.duration,'track'],[t.ringtone.mp3,t.ringtone.duration,'ringtone'],[t.ringtone.m4r,t.ringtone.duration,'ringtone']);}
for(const n of manifest.notifications){assert(n.duration>=1&&n.duration<=4);list.push([n.src,n.duration,'notification'],[n.wav,n.duration,'notification']);}
function measure(pcm,rate,channels){
 const count=pcm.length/4, windowFrames=Math.round(rate*.02), windowSize=windowFrames*channels;
 let peak=0,sum=0,clipped=0,first=-1,last=-1,silent=0,longest=0,windowSum=0;
 for(let i=0;i<count;i++){
  const x=pcm.readFloatLE(i*4),abs=Math.abs(x);assert(Number.isFinite(x));peak=Math.max(peak,abs);sum+=x*x;windowSum+=x*x;
  if(abs>=.999)clipped++;if(abs>.001){if(first<0)first=i;last=i;}
  if(i%windowSize===windowSize-1){silent=windowSum/windowSize<1e-6?silent+.02:0;longest=Math.max(longest,silent);windowSum=0;}
 }
 return {duration:count/rate/channels,peak,peakDb:20*Math.log10(peak||1e-12),rmsDb:10*Math.log10(sum/count||1e-12),clippedSamples:clipped,leadingSilence:first<0?count/rate/channels:first/rate/channels,trailingSilence:last<0?count/rate/channels:(count-1-last)/rate/channels,longestQuietWindow:longest,firstSample:pcm.readFloatLE(0),lastSample:pcm.readFloatLE(pcm.length-4)};
}
const report=[];
for(const [relative,expected,kind]of list){
 const file=path.join(home,relative);
 const info=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,sample_rate,channels','-of','json',file],{encoding:'utf8'}));
 const stream=info.streams[0];assert.equal(info.streams.length,1);
 const pcm=ff(['-i',file,'-f','f32le','pipe:1']);
 const m=measure(pcm,Number(stream.sample_rate),stream.channels);
 assert(Math.abs(m.duration-expected)<.05,relative+' duration '+m.duration+' expected '+expected);
 assert(m.peak<.94,relative+' peak');assert.equal(m.clippedSamples,0);assert(m.rmsDb>-35,relative+' audible');
 assert(m.leadingSilence<.15,relative+' start silence');assert(m.trailingSilence<(kind==='track'?3.1:.3),relative+' trailing silence');
 assert(m.longestQuietWindow<(kind==='track'?3.1:.3),relative+' interior silence');
 assert(Math.abs(m.firstSample)<.007&&Math.abs(m.lastSample)<.007,relative+' smooth boundaries');
 const oversampled=ff(['-i',file,'-ar','176400','-f','f32le','pipe:1']);
 let overPeak=0;for(let i=0;i<oversampled.length;i+=4)overPeak=Math.max(overPeak,Math.abs(oversampled.readFloatLE(i)));
 assert(overPeak<.98,relative+' oversampled peak');
 report.push({file:relative,kind,bytes:fs.statSync(file).size,sha256:sha(fs.readFileSync(file)),codec:stream,...m,oversampledPeak:overPeak,oversampledPeakDb:20*Math.log10(overPeak),oversamplingRate:176400});
 console.log('OK',relative,m.duration.toFixed(3)+'s',m.peakDb.toFixed(2)+'dBFS');
}
const clipChecks=[];
for(const n of manifest.notifications){
 const source=path.join(home,n.source);assert.equal(sha(fs.readFileSync(source)),n.sourceSha256);
 const reconstructed=ff(['-i',source,'-af',n.filter,'-ac','1','-ar','22050','-c:a','pcm_s16le','-f','s16le','pipe:1']);
 const delivered=ff(['-i',path.join(home,n.wav),'-c:a','pcm_s16le','-f','s16le','pipe:1']);
 assert(reconstructed.equals(delivered),n.id+' source extraction mismatch');
 clipChecks.push({id:n.id,source:n.source,start:n.start,end:n.end,pcmSha256:sha(delivered),reconstructedPcmIdentical:true});
}
for(const t of manifest.tracks){
 const score=JSON.parse(fs.readFileSync(path.join(home,t.recipe),'utf8'));
 for(const source of score.sourceFiles)assert.equal(sha(fs.readFileSync(path.join(repo,source.file),'utf8').replace(/\r\n/g,'\n')),source.sha256,'source engine changed');
 assert(score.events.length>100);assert.equal(score.barTrace.length,score.bars);
}
const output={passed:true,files:report.length,tracks:4,ringtones:4,notifications:20,clipProvenanceChecks:clipChecks,checks:report,limits:{samplePeak:.94,oversampledPeak:.98,headSeconds:.15,trackTailSeconds:3.1,clipTailSeconds:.3,durationToleranceSeconds:.05},limitations:'Инструментальные проверки аудио. Субъективная музыкальная оценка и установка звонков на физических телефонах не выполнялись.'};
fs.writeFileSync(path.join(__dirname,'audio-checks.json'),JSON.stringify(output,null,2)+'\n');
console.log('PASS:',report.length,'audio files;',clipChecks.length,'exact PCM extraction checks.');
