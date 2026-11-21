/* ГОЛ-004: alphabet adaptation of ../../mayatnik/mayatnik-phone-robot.js.
 * The original 13 phones, legacy word scores and DSP operations are preserved.
 * Added phones below are our new explicit recipes, not recorded voice fragments.
 * Original phoneme/formant robot voice: no recording, sampled speech or TTS.
 * This is not an emulation of POLAXIS Roboter, SC-02, or a particular speaker.
 * Source/filter and parallel voiced/noise resonators follow the general method
 * described by Praat's authors; the phoneme targets below are our own design:
 * https://www.fon.hum.uva.nl/praat/manual/Source-filter_synthesis.html
 * https://www.fon.hum.uva.nl/praat/manual/KlattGrid.html
 * Listening/intelligibility acceptance has not been performed.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ZerkaliusAlphabetRobot=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const TAU=2*Math.PI,TAIL=.018,TABLE_SIZE=2048;
  const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
  function finite(value,fallback,lo,hi){const n=Number(value);return value==null||!Number.isFinite(n)?fallback:clamp(n,lo,hi);}
  function bitsOf(input){
    if(!input||typeof input.length!=='number')return [0];
    const bits=[];for(let i=0;i<Math.min(32,input.length);i++)bits.push(input[i]===1||input[i]===true?1:0);
    return bits.length?bits:[0];
  }
  const WORDS=Object.freeze({
    zero:Object.freeze({text:'Ноль',sequence:Object.freeze([['n',.055],['o',.120],['l-soft',.075]].map(Object.freeze))}),
    one:Object.freeze({text:'Один',sequence:Object.freeze([['a',.075],['d',.055],['i',.140],['n',.065]].map(Object.freeze))}),
    zerkalius:Object.freeze({text:'Зеркалиус',sequence:Object.freeze([['z',.070],['e',.090],['r',.055],['k',.050],['a',.080],['l',.055],['i',.070],['u',.090],['s',.100]].map(Object.freeze))})
  });
  const WORD_DURATIONS=Object.freeze({zero:.268,one:.353,zerkalius:.678});
  const validWord=word=>typeof word==='string'&&Object.hasOwn(WORDS,word);
  function duration(word){if(!validWord(word))throw Error('Unknown robot word: '+word);return WORD_DURATIONS[word];}
  function describe(input,tick=0){
    const bits=bitsOf(input),ones=bits.reduce((sum,bit)=>sum+bit,0),n=Math.max(0,Math.trunc(finite(tick,0,0,Number.MAX_SAFE_INTEGER)));
    const word=n%64===0?'zerkalius':ones>bits.length/2?'one':'zero',entry=WORDS[word];
    return {word,text:entry.text,phonemes:entry.sequence.map(([phoneme,seconds])=>({phoneme,seconds})),
      duration:duration(word),voicedBits:bits,ones};
  }
  // F1..F4, bandwidths and relative branch amplitudes are deliberately fixed
  // targets, not measurements of a person. Speech pitch does not move formants.
  function phone(frequencies,bandwidths,weights,voiced=1,noise=0,gain=1,kind='vowel',bypass=0){
    return {frequencies,bandwidths,weights,voiced,noise,gain,kind,bypass};
  }
  const PHONES={
    a:phone([750,1250,2600,3500],[100,130,180,260],[1,.9,.42,.2]),
    o:phone([450,850,2500,3500],[85,110,190,280],[1,.9,.33,.14]),
    e:phone([500,1850,2600,3500],[90,150,200,280],[1,.9,.42,.18]),
    i:phone([270,2250,3000,3600],[75,160,200,300],[1,1.2,.55,.2]),
    u:phone([320,700,2400,3300],[80,105,190,280],[1,.85,.28,.12]),
    n:phone([250,1350,2450,3500],[85,220,290,350],[1,.14,.08,.035],.9,.012,.65,'nasal'),
    l:phone([350,1000,2500,3400],[110,160,240,300],[.9,.65,.35,.12],.85,.015,.85,'lateral'),
    'l-soft':phone([300,1950,2800,3500],[90,180,230,300],[.9,1,.45,.16],.9,.012,.85,'lateral'),
    r:phone([400,1350,2350,3400],[120,190,270,340],[.9,.7,.32,.12],.9,.025,.85,'trill'),
    d:phone([250,1900,3200,4600],[150,500,900,1200],[.5,.45,.35,.15],.22,.6,.8,'stopD'),
    k:phone([500,1800,3000,4700],[220,500,850,1300],[.12,.8,.6,.2],0,.95,.8,'stopK'),
    z:phone([250,1800,4000,6200],[140,550,950,1400],[.25,.12,.65,.4],.3,.65,.85,'fricative',.045),
    s:phone([600,2300,4500,6600],[300,600,1100,1500],[.025,.12,.75,.5],0,.9,.8,'fricative',.06)
  };
  // New alphabet targets. Source, biquads, coarticulation, DC filter and tanh
  // remain this robot's own pipeline; the separate bank engine is never used.
  const ADDED={
    y:phone([390,1450,2500,3500],[95,150,210,290],[1,.95,.38,.16]),
    'a-neutral':phone([480,1320,2550,3500],[110,160,210,290],[1,.8,.35,.15]),
    j:phone([280,2350,3100,3800],[80,170,220,300],[.8,1.15,.5,.18],.9,.01,.85,'approximant'),
    m:phone([250,1050,2400,3400],[85,200,280,340],[1,.18,.08,.035],.9,.012,.65,'nasal'),
    b:phone([280,750,2550,4300],[150,420,800,1100],[.55,.6,.3,.12],.24,.6,.8,'stopD'),
    p:phone([280,750,2550,4300],[150,420,800,1100],[.4,.6,.3,.12],0,.9,.8,'stopK'),
    t:phone([300,2050,3300,4900],[170,550,950,1300],[.1,.5,.55,.25],0,.95,.8,'stopK'),
    g:phone([400,1650,2850,4400],[200,450,800,1200],[.3,.8,.55,.18],.24,.65,.8,'stopD'),
    v:phone([300,1500,3600,5800],[160,750,1300,1700],[.4,.2,.45,.28],.5,.4,.85,'fricative',.025),
    f:phone([650,1800,3800,6000],[500,900,1500,1900],[.08,.22,.55,.32],0,.85,.8,'fricative',.06),
    h:phone([650,1250,2700,3900],[350,550,850,1200],[.45,.65,.4,.18],0,.8,.85,'fricative',.025),
    zh:phone([300,1800,3000,4800],[180,550,900,1300],[.3,.5,.75,.35],.4,.7,.85,'fricative',.04),
    sh:phone([900,2000,3200,5000],[400,600,950,1400],[.04,.65,.8,.32],0,.9,.8,'fricative',.05),
    'sh-soft':phone([1200,2800,4300,6300],[450,650,1050,1500],[.03,.7,.8,.3],0,.95,.8,'fricative',.045),
    ts:phone([600,2500,4700,6800],[300,650,1100,1500],[.025,.15,.8,.45],0,.95,.8,'affricate',.045),
    ch:phone([900,2700,4100,6000],[400,650,1000,1450],[.04,.7,.75,.3],0,.95,.8,'affricate',.04),
    'd-soft':phone([250,2250,3350,4700],[150,500,900,1200],[.5,.55,.4,.15],.22,.6,.8,'stopD'),
    'p-soft':phone([280,2100,3000,4400],[150,450,850,1200],[.3,.65,.45,.15],0,.9,.8,'stopK'),
    't-soft':phone([300,2400,3500,5100],[170,550,950,1350],[.1,.6,.55,.25],0,.95,.8,'stopK'),
    'k-soft':phone([450,2200,3200,4900],[200,500,900,1300],[.12,.8,.6,.2],0,.95,.8,'stopK'),
    's-soft':phone([600,3000,5000,7000],[300,650,1100,1500],[.025,.2,.8,.45],0,.9,.8,'fricative',.055),
    'm-soft':phone([250,1950,2800,3600],[85,220,290,350],[1,.22,.10,.04],.9,.012,.65,'nasal'),
    'v-soft':phone([300,2100,3900,6200],[160,750,1300,1700],[.4,.3,.5,.28],.5,.4,.85,'fricative',.025),
    'r-soft':phone([350,1950,2850,3600],[110,190,260,330],[.9,.85,.38,.14],.9,.025,.85,'trill')
  };
  Object.assign(PHONES,ADDED);
  function carrier(bits,f0,rate,tilt){
    const table=new Float64Array(TABLE_SIZE),harmonics=Math.max(1,Math.min(96,Math.floor(rate*.43/f0)));
    let total=0;
    for(let h=1;h<=harmonics;h++){
      // A quiet broadband voiced floor keeps vowels articulable even for 0000.
      // The actual field bits select which harmonics are strongly excited.
      const amplitude=(bits[(h-1)%bits.length]?1:.18)/Math.pow(h,1.12-.35*tilt);
      total+=amplitude;
      for(let q=0;q<TABLE_SIZE;q++)table[q]+=amplitude*Math.sin(TAU*h*q/TABLE_SIZE);
    }
    const scale=1/Math.max(total,.001);for(let q=0;q<TABLE_SIZE;q++)table[q]*=scale;
    return table;
  }
  function seedFor(bits,word){
    let state=2166136261;
    for(const character of word)state=Math.imul(state^character.charCodeAt(0),16777619);
    for(const bit of bits)state=Math.imul(state^bit,16777619);
    return (state>>>0)||1;
  }
  function targets(sequence,index,local){
    const [name,seconds]=sequence[index],current=PHONES[name];
    const transition=Math.min(.012,seconds*.2);let other=current,blend=0;
    if(index>0&&local<transition){other=PHONES[sequence[index-1][0]];blend=.5*(1-local/transition);}
    else if(index+1<sequence.length&&seconds-local<transition){other=PHONES[sequence[index+1][0]];blend=.5*(1-(seconds-local)/transition);}
    const mix=(a,b)=>a+(b-a)*blend;
    return {phone:current,
      frequencies:current.frequencies.map((n,i)=>mix(n,other.frequencies[i])),
      bandwidths:current.bandwidths.map((n,i)=>mix(n,other.bandwidths[i])),
      weights:current.weights.map((n,i)=>mix(n,other.weights[i])),
      voiced:mix(current.voiced,other.voiced),noise:mix(current.noise,other.noise),
      gain:mix(current.gain,other.gain),bypass:mix(current.bypass,other.bypass)};
  }
  function coefficients(frequency,bandwidth,rate){
    const f=clamp(frequency,60,rate*.43),bw=clamp(bandwidth,50,rate*.25);
    const omega=TAU*f/rate,quality=clamp(f/bw,.3,30),alpha=Math.sin(omega)/(2*quality),a0=1+alpha;
    // Constant-peak band-pass biquad, direct form II transposed.
    return {b0:alpha/a0,b2:-alpha/a0,a1:-2*Math.cos(omega)/a0,a2:(1-alpha)/a0};
  }
  function renderSequence({sequence,seedWord,duration:utteranceDuration,midi=48,rate=44100,event={}}={}){
    if(!Array.isArray(sequence)||!sequence.length||sequence.length>96)throw Error('Robot sequence must contain 1–96 segments');
    let sum=0;
    for(const entry of sequence){
      if(!Array.isArray(entry)||entry.length!==2||!Object.hasOwn(PHONES,entry[0])||typeof entry[1]!=='number'||!Number.isFinite(entry[1])||entry[1]<=0)throw Error('Invalid robot phoneme or duration');
      sum+=entry[1];
    }
    if(typeof seedWord!=='string'||!seedWord.length||seedWord.length>128)throw Error('Explicit robot seed label is required');
    const seconds=utteranceDuration===undefined?sum+TAIL:utteranceDuration;
    if(typeof seconds!=='number'||!Number.isFinite(seconds)||seconds>12||Math.abs(seconds-sum-TAIL)>1e-9)throw Error('Robot duration must equal score plus 18 ms tail, within 12 seconds');
    const sampleRate=Math.round(finite(rate,44100,8000,96000));
    const bits=bitsOf(event.bits),speechSeconds=seconds-TAIL;
    const note=finite(midi,48,0,127),f0=clamp(finite(event.f0,440*2**((note-69)/12),20,Math.min(2000,sampleRate/16)),20,Math.min(2000,sampleRate/16));
    const tilt=finite(event.tilt,.82,.1,1),table=carrier(bits,f0,sampleRate,tilt);
    const pcm=new Float32Array(Math.ceil(seconds*sampleRate)),filters=Array.from({length:4},()=>({z1:0,z2:0,c:null}));
    let seed=seedFor(bits,seedWord),phase=0,segment=0,segmentStart=0,control=null,peak=0;
    let lastNoise=0,lastOutput=0,dc=0;
    const phaseStep=f0/sampleRate*TABLE_SIZE;
    for(let sample=0;sample<pcm.length;sample++){
      const time=sample/sampleRate;
      while(segment+1<sequence.length&&time>=segmentStart+sequence[segment][1]){segmentStart+=sequence[segment][1];segment++;control=null;}
      const local=time-segmentStart,segmentDuration=sequence[segment][1];
      if(!control||sample%16===0){control=targets(sequence,segment,Math.min(local,segmentDuration));
        for(let band=0;band<4;band++)filters[band].c=coefficients(control.frequencies[band],control.bandwidths[band],sampleRate);
      }
      const index=Math.floor(phase),fraction=phase-index;
      const pulse=table[index]+fraction*(table[(index+1)%TABLE_SIZE]-table[index]);
      phase+=phaseStep;phase-=Math.floor(phase/TABLE_SIZE)*TABLE_SIZE;
      seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
      const white=(seed>>>0)/2147483648-1,highNoise=(white-lastNoise)*.5;lastNoise=white;
      let voiced=control.voiced,noise=control.noise,envelope=1,bypass=control.bypass;
      const kind=control.phone.kind;
      if(kind==='stopK'||kind==='stopD'){
        const release=segmentDuration*.58;
        if(local<release){noise=0;voiced=kind==='stopD' ? .055 : 0;}
        else {const age=local-release;noise*=Math.exp(-age/.009);voiced*=clamp(age/.012,0,1);}
      }else if(kind==='affricate'){
        // New only: closure then a sustained friction release for ц / ч.
        const release=segmentDuration*.30;
        if(local<release){noise=0;voiced=0;bypass=0;}
        else {const opening=clamp((local-release)/.006,0,1);noise*=opening;bypass*=opening;}
      }else if(kind==='trill')envelope=.25+.75*Math.abs(Math.sin(TAU*32*local));
      if(time>=speechSeconds){voiced=0;noise=0;}
      const input=pulse*voiced+white*noise*.22;
      let value=0;
      for(let band=0;band<4;band++){
        const filter=filters[band],c=filter.c,out=c.b0*input+filter.z1;
        filter.z1=-c.a1*out+filter.z2;filter.z2=c.b2*input-c.a2*out;
        value+=out*control.weights[band];
      }
      value=(value+highNoise*bypass*(time<speechSeconds?1:0))*control.gain*envelope;
      // Remove residual DC and softly open/close the complete utterance.
      const blocked=value-lastOutput+.995*dc;lastOutput=value;dc=blocked;
      const gate=Math.min(1,time/.006,Math.max(0,(seconds-time)/TAIL));
      pcm[sample]=blocked*gate;peak=Math.max(peak,Math.abs(pcm[sample]));
      if(!Number.isFinite(pcm[sample]))throw Error('Non-finite robot production sample');
    }
    // Word-level headroom preserves consonant/vowel ratios; no per-phoneme AGC.
    const gain=.55/Math.max(peak,.045);
    for(let sample=0;sample<pcm.length;sample++)pcm[sample]=Math.tanh(pcm[sample]*gain);
    return pcm;
  }
  function renderVoice({midi=48,duration:requestedDuration,rate=44100,event={}}={}){
    // Exact old sequences, duration literals and word seed labels. The legacy
    // requested musical duration remains intentionally ignored, like the source.
    const bits=bitsOf(event.bits),word=validWord(event.robotWord)?event.robotWord:describe(bits,1).word;
    return renderSequence({midi,rate,event,sequence:WORDS[word].sequence,seedWord:word,duration:duration(word)});
  }
  function registerVoice(Music){
    if(!Music||typeof Music.registerVoice!=='function')return false;
    return Music.registerVoice('phoneRobot',{channel:8,program:54,gain:.55,render:renderVoice});
  }
  return Object.freeze({VERSION:'phone-robot-alphabet-v1',WORD_DURATIONS,duration,describe,renderVoice,renderSequence,registerVoice,
    seedFor,bitsOf,TAIL,TABLE_SIZE,addedPhoneIds:Object.freeze(Object.keys(ADDED)),
    phones:()=>JSON.parse(JSON.stringify(PHONES)),legacyWords:()=>JSON.parse(JSON.stringify(WORDS))});
});
