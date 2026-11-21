const fs=require('fs'),path=require('path'),vm=require('vm');
const P=__dirname,context=vm.createContext({console});
for(const name of ['prosody-dsp.js','engine.js','robot/engine.js','robot-live.js','dsh-engine.js','engines.js'])vm.runInContext(fs.readFileSync(path.join(P,'voice-source',name),'utf8'),context,{filename:name});
const old=JSON.parse(fs.readFileSync(path.join(P,'voice-timeline.json'),'utf8'));
const engine=context.VoiceEngines.get('robot');
const settings=engine.normalize({...old.settings,speed:1});
// Short unstressed a, soft d, clearly longer stressed i, final n. No syllable pause.
const score=[{id:'a',duration:.070},{id:'dj',duration:.075},{id:'i',duration:.270},{id:'n',duration:.105}];
const prosody={version:1,transitionMs:22,rangeStart:0,rangeEnd:1,articulatedFrication:true,smoothStopRelease:true,bandLimitedZ:true,
 segments:[{pitchStartSemitones:0,pitchEndSemitones:0,gain:.78},{pitchStartSemitones:0,pitchEndSemitones:.3,gain:1},
 {pitchStartSemitones:.6,pitchEndSemitones:0,gain:1.15},{pitchStartSemitones:0,pitchEndSemitones:-.4,gain:.88}]};
const r=engine.render({score,settings,phones:{},prosody});
const b=Buffer.alloc(44+r.samples.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(r.sampleRate,24);b.writeUInt32LE(r.sampleRate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(r.samples.length*2,40);
r.samples.forEach((v,i)=>b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+2*i));
fs.writeFileSync(path.join(P,'voice-adin-v3.wav'),b);
fs.writeFileSync(path.join(P,'voice-adin-v3.json'),JSON.stringify({text:'один',pronunciation:'а-ди́н',source:'Procedural formant synthesis; no recordings.',score,settings,prosody,duration:r.duration,sampleRate:r.sampleRate},null,2));
console.log('Short stressed a-din generated: '+r.duration.toFixed(3)+' seconds');
