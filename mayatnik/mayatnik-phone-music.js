/* Phone scenes: the same bit-driven score for live playback and exported media. */
(function(root,factory){
  if(typeof module==='object'&&module.exports) module.exports=factory(require('./mayatnik-synthesis-music.js'),require('./mayatnik-bit-synthesis.js'),require('./mayatnik-phone-robot.js'));
  else root.MayatnikPhoneMusic=factory(root.MayatnikSynthesisMusic,root.MayatnikBitSynthesis,root.MayatnikPhoneRobot);
})(globalThis,function(Music,Bit,Robot){
  'use strict';
  const DEFAULT_TEMPO=137, DEFAULT_STEPS=128;
  const SCALE=[0,2,3,5,7,8,10];
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
  function tempo(value){return clamp(Math.round(Number(value)||DEFAULT_TEMPO),60,180);}
  function tickOf(frame){return Math.max(0,Math.floor(Number(frame.tick??frame.k)||0));}
  // Sixteen horizontal bands. A band is active when any source cell is 1.
  // Empty rows are skipped cyclically; an entirely empty field stays silent.
  function readRow(frame,tick,channel){
    const width=frame.width|0,height=frame.height|0;
    const bits=Array(16).fill(0);
    if(width<1||height<1) return {bits,row:0,ones:0};
    const source=frame.values||frame.result;
    for(let attempt=0;attempt<height;attempt++){
      const row=(tick+attempt)%height;
      bits.fill(0);
      for(let x=0;x<width;x++){
        const i=row*width+x;
        const active=channel&&frame.rgbCodes ? frame.rgbCodes[i]>=0&&!!(frame.rgbCodes[i]&channel) : source?.[i]===1;
        if(active) bits[Math.min(15,Math.floor(x*16/width))]=1;
      }
      const ones=bits.reduce((a,b)=>a+b,0);
      if(ones) return {bits:bits.slice(),row,ones};
    }
    return {bits,row:tick%height,ones:0};
  }
  function frameEvents(frame,options={}){
    if(!frame) return [];
    const tick=tickOf(frame),step=tick%16,beat=tick/4;
    const events=[],rgb=!!frame.rgbCodes;
    const row=readRow(frame,tick,0),density=row.ones/16;
    if(!row.ones) return events;
    const add=(voice,midi,duration,velocity,pan=0,extra={})=>events.push({beat,voice,midi,duration,velocity,pan,...extra});
    // A composed four-on-the-floor framework; the field controls accents and all melodic partials.
    if(step%4===0) add('kick',36,.36,.72+.12*density);
    if(step===4||step===12) add('snare',38,.18,.27+.13*density,-.06);
    if(step%2===0) add('hat',step%4===2?46:42,.09,.12+.11*density,.25);
    const voice=(data,root,velocity,pan,duration)=>{
      if(!data.ones) return;
      const n=Bit.bitsToNumber(data.bits),degree=n%14;
      const midi=root+SCALE[degree%7]+12*Math.floor(degree/7);
      add('bitsHarmonic',midi,duration,velocity,pan,{bits:data.bits,f0:Bit.midiToHz(midi),tau:.095+.055*data.ones/16,tilt:.72+.16*data.ones/16});
    };
    if(step%4===0||step%4===3) voice(row,36,.49,0,step%4===3?.23:.42);
    if(tick%2===0){
      const channel=rgb?[4,2,1][Math.floor(tick/2)%3]:0;
      const upper=readRow(frame,tick*3+7,channel);
      voice(upper,60,.27,channel===4?-.42:channel===1?.42:.05,.28);
    }
    if(options.voice==='bits') return events;
    // The rhythmic accompaniment is retained, with space left for the spoken bits.
    for(const event of events) if(event.voice==='bitsHarmonic')event.velocity*=.38;
    if(step%4===0&&tick%64!==4){
      const channel=rgb?[4,2,1][Math.floor(tick/4)%3]:0;
      const spoken=readRow(frame,tick*3+7,channel);
      const index=Math.floor(tick/4)%16;
      const robotWord=tick%64===0?'zerkalius':spoken.bits[index]?'one':'zero';
      const value=Bit.bitsToNumber(spoken.bits)||0,midi=48+SCALE[value%7];
      add('phoneRobot',midi,robotWord==='zerkalius'?1.8:.95,.83,channel===4?-.18:channel===1?.18:0,
        {bits:spoken.bits,robotWord,f0:Bit.midiToHz(midi)});
    }
    return events;
  }
  function createPlayer(){
    Bit.registerVoices(Music);
    Robot.registerVoice(Music);
    let options={tempo:DEFAULT_TEMPO,volume:.55,voice:'robot'};
    const player=Music.createPlayer(frame=>frameEvents(frame,options));
    return {
      enable(next={}){options={...options,...next,tempo:tempo(next.tempo??options.tempo)};return player.enable(options);},
      configure(next={}){options={...options,...next,tempo:tempo(next.tempo??options.tempo)};player.configure(options);},
      disable(){player.disable();},silence(){player.silence();},
      playFrame(frame){return player.playFrame({...frame,tick:tickOf(frame)});},
      getStream(){return player.getStream();},
      get enabled(){return player.enabled;}
    };
  }
  function score(scene,options={}){
    const bpm=tempo(options.tempo),steps=clamp(Math.floor(Number(options.steps)||DEFAULT_STEPS),1,1024);
    const start=Math.max(0,Math.floor(Number(options.start??scene.baseFrame)||0));
    const maximum=Math.max(0,Math.floor(scene.maxFrames));
    const events=[],frames=[];
    for(let tick=0;tick<steps;tick++){
      const k=(start+tick)%(maximum+1),frame=scene.frame(k);
      frames.push(k);
      events.push(...frameEvents({...frame,tick:k}, {tempo:bpm,voice:options.voice==='bits'?'bits':'robot'}).map(event=>({...event,beat:tick/4})));
    }
    const duration=steps*60/bpm/4;
    // Finish the excerpt between words; never cut a final consonant in half.
    const complete=events.filter(event=>event.voice!=='phoneRobot'||event.beat*60/bpm+Robot.duration(event.robotWord)<=duration);
    return {id:scene.id,voice:options.voice==='bits'?'bits':'robot',tempo:bpm,start,steps,frames,events:complete,secondsPerStep:60/bpm/4,duration};
  }
  function renderWav(scene,options={}){
    Bit.registerVoices(Music);
    Robot.registerVoice(Music);
    const composition=score(scene,options);
    return {...composition,bytes:Music.renderWav(composition.events,{tempo:composition.tempo,volume:options.volume??.55},{durationSeconds:composition.duration,sampleRate:44100})};
  }
  return {DEFAULT_TEMPO,DEFAULT_STEPS,frameEvents,readRow,createPlayer,score,renderWav};
});
