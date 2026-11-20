/* ГОЛ-005: live JavaScript adaptation of tools/voice/formant_voice.py and
   voice/alphabet/build.py's explicitly attributed alphabet additions.
   The original DeepSeek source is unchanged. Impulse source + parallel
   resonators are retained. Gaussian noise is Box–Muller/xorshift32, NOT NumPy's
   generator: no byte-identity claim. No recordings, bank DSP, TTS or models. */
(function(root){
  'use strict';
  root.ZerkaliusDshFactory=function(C){
    const VERSION='deepseek-formant-live-v1.2.3',RATE=44100,TAU=2*Math.PI;
    const profile=C.config({pitchStart:112,pitchEnd:96,vibratoDepth:0,vibratoRate:2.1,transitionMs:0,outputGain:.7,seed:7},['transitionMs']);
    // Возраст: 0 — ребёнок, 50 — взрослый, 100 — старик. Меняет длину речевого
    // тракта (форманты), высоту, дрожание и придыхание, не трогая таблицу фонем.
    const AGE={key:'age',id:'age',label:'Возраст голоса',min:0,max:100,step:1,default:50};
    const clampAge=value=>{const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(100,n)):AGE.default;};
    function ageShape(age){
      return {
        tract:1+(50-age)*.003,          // 0 лет → 1,15 · 100 лет → 0,85
        pitch:1+(50-age)*.005,          // 0 лет → 1,25 · 100 лет → 0,75
        tremor:age>65?(age-65)/35*.5:0,
        breath:age>60?1+(age-60)/40*.8:1,
        rateBoost:age>65?(age-65)/35*2.4:0
      };
    }
    const table=Object.create(null),known=new Set(C.phonemeIds);
    function entry(id,kind,f,b,w,voice,noise,loud=1,extra={}){
      table[id]={kind,formants:[...f,3500],bandwidths:[...b,250],weights:[...w,0],voice,noise,loud,...extra};
    }
    // Original DeepSeek vowel formants/loudness. The fourth slot is a stored
    // editor placeholder and is not a fourth synthesis resonator.
    for(const [id,f,loud] of [
      ['a',[700,1300,2500],1],['o',[500,900,2400],.95],['u',[320,800,2300],.9],
      ['e',[600,1800,2500],.95],['i',[300,2200,3000],.85],['y',[400,1500,2500],.9]
    ])entry(id,'vowel',f,[90,110,160],[1,.6,.3],1,0,loud);
    // Explicit new vowel/English targets, not silent fallback to another engine.
    entry('ax','vowel',[500,1350,2500],[90,110,160],[1,.6,.3],1,0,.95);
    entry('ae','vowel',[680,1750,2600],[90,110,160],[1,.6,.3],1,0,.95);
    const consonants=[
      ['d','stop',[350,1700,2600],.55],['t','stop',[380,1800,2700],.50],
      ['k','stop',[300,1500,2400],.45],['p','stop',[300,900,2200],.45],
      ['b','stop',[300,900,2200],.55],['g','stop',[300,1400,2300],.50],
      ['v','sonorant',[300,1200,2300],.55],['z','fricative',[320,1600,2600],.35],
      ['s','fricative',[320,1800,2800],.35],['sh','fricative',[300,1500,2400],.35],
      ['f','fricative',[300,1000,2200],.30],['h','fricative',[300,1200,2300],.30],
      ['ch','affricate',[320,1900,2700],.40],['ts','affricate',[320,1800,2600],.40],
      ['n','sonorant',[250,1200,2300],.50],['m','sonorant',[250,1000,2200],.50],
      ['l','sonorant',[350,1100,2400],.55],['r','trill',[400,1300,2400],.55],
      ['j','sonorant',[280,2200,2900],.45]
    ];
    for(const [id,kind,f,loud] of consonants){
      const nasal=id==='n'||id==='m',noisy=['stop','affricate','fricative'].includes(kind);
      const bandwidths=kind==='fricative'?[90,1800,160]:kind==='stop'||kind==='affricate'?[90,900,160]
        :nasal?[120,200,160]:kind==='trill'?[90,200,160]:[160,200,160];
      const weights=noisy||kind==='trill'?[0,1,0]:nasal?[.8,.2,0]:[.5,1,0];
      entry(id,kind,f,bandwidths,weights,noisy?0:1,noisy?1:0,loud,{nasal});
    }
    // The alphabet adapter's new Ж / Щ branches. Ж deliberately routes its
    // periodic source to branch 1 and noise to branches 2/3, as that adapter does.
    entry('zh','fricative',[300,2400,3600],[160,900,1200],[.3,1,.3],1,1,1,{sources:['voice','noise','noise']});
    entry('shj','fricative',[3200,4800,6500],[700,1000,1300],[1,.5,.25],0,1,1);
    entry('rr','rhotic',[380,1450,1900],[160,200,200],[.5,1,.3],1,0,.55);
    entry('w','sonorant',[300,650,2300],[160,200,160],[.5,1,0],1,0,.5);
    entry('dzh','affricate',[300,2400,3600],[160,900,1200],[.3,1,.3],.4,1,.6);
    // Explicit, documented palatalized adaptations: the historical Python
    // source removed ь and did not offer these separate targets.
    for(const id of ['pj','bj','tj','dj','kj','gj','sj','zj','zhj','fj','vj','hj','mj','nj','lj','rj']){
      const base=table[id.slice(0,-1)];table[id]={...base,formants:[...base.formants],bandwidths:[...base.bandwidths],weights:[...base.weights]};
      table[id].formants[1]=Math.max(1950,table[id].formants[1]);table[id].formants[2]=Math.max(2700,table[id].formants[2]);
    }
    entry('_','silence',[500,1300,2500],[90,110,160],[0,0,0],0,0,0);
    function getPhone(id){
      if(!Object.hasOwn(table,id))throw Error('Неизвестная фонема DeepSeek live: '+id);
      const p=table[id];return {kind:p.kind,formants:[...p.formants],bandwidths:[...p.bandwidths],weights:[...p.weights],voice:p.voice,noise:p.noise};
    }
    function gaussian(seed){
      let state=seed||1,spare=null;
      function uniform(){state^=state<<13;state^=state>>>17;state^=state<<5;return ((state>>>0)+1)/4294967297;}
      return ()=>{
        if(spare!==null){const value=spare;spare=null;return value;}
        const radius=Math.sqrt(-2*Math.log(uniform())),angle=TAU*uniform();
        spare=radius*Math.sin(angle);return radius*Math.cos(angle);
      };
    }
    function coefficient(f,b){
      const r=Math.exp(-Math.PI*b/RATE),theta=TAU*f/RATE;
      return [(1-r)*Math.sqrt(Math.max(0,1-2*r*Math.cos(2*theta)+r*r)),2*r*Math.cos(theta),-r*r];
    }
    const voicedSpeechTargets=new Set(['b','bj','d','dj','g','gj','z','zj']);
    function renderSpeech({settings,phones,score,counts,total,prosody,shape}){
      const dsp=root.VoiceProsodyDSP,softenNoise=dsp.createConsonantNoise(RATE);
      const resolvedPhones=score.map(({id})=>{
        const native=table[id],custom=Object.hasOwn(phones,id);
        const p=C.scaled(custom?phones[id]:getPhone(id),settings,RATE),sameKind=native?.kind===p.kind;
        let branchSources=sameKind?native.sources||null:null;
        if(!custom&&voicedSpeechTargets.has(id)){
          // The low formant carries voicing independently of the release/friction.
          p.voice=.8;
          p.noise*=.7;
          p.weights[0]=.65;
          branchSources=['voice','noise','noise'];
        }
        if(shape)for(let band=0;band<3;band++)p.formants[band]=Math.min(C.limits.maxFrequency,p.formants[band]*shape.tract);
        if(shape)p.noise=Math.min(3,p.noise*shape.breath);
        return {id,...p,activeFormants:3,loudness:sameKind?native.loud:1,branchSources};
      });
      const samples=new Float32Array(total),glottal=new Float64Array(total),normal=gaussian(settings.seed);
      let cursor=0,phase=0,peak=0;
      // Optional speech path only: phase and impulse tails continue between
      // phonemes, while pauses suppress excitation. There is no time resampling.
      for(let segment=0;segment<score.length;segment++){
        const p=resolvedPhones[segment],count=counts[segment];
        for(let index=0;index<count;index++){
          const at=cursor+index,speech=prosody.at(at,segment);
          const base=settings.pitchStart+(settings.pitchEnd-settings.pitchStart)*prosody.progress(at)
            +settings.vibratoDepth*Math.sin(TAU*settings.vibratoRate*at/RATE);
          phase+=prosody.frequency(base,speech)/RATE;
          if(phase>=1){phase-=1;if(p.kind!=='silence')for(let k=0;k<48&&at+k<total;k++)glottal[at+k]+=Math.exp(-k/6);}
        }
        cursor+=count;
      }
      const filters=Array.from({length:3},()=>({c:null,last:0,older:0}));cursor=0;
      // Наклон спектра: гасит верх возбудителя, из-за которого голос «жужжал».
      let tilt=0;
      for(let i=0;i<total;i++){tilt+=.42*(glottal[i]-tilt);glottal[i]=tilt;}
      for(let segment=0;segment<score.length;segment++){
        const p=resolvedPhones[segment],count=counts[segment];
        const stop=p.kind==='stop',affricate=p.kind==='affricate',burst=stop||affricate;
        const noiseConsonant=dsp.isNoiseConsonant(p.kind),releaseAt=Math.floor(count*(stop ? .55 : .28));
        const frication=!Object.hasOwn(phones,p.id)?prosody.fricationSource(p.id,p.kind):null;
        if(p.kind==='silence'){for(const f of filters){f.last=0;f.older=0;}cursor+=count;continue;}
        for(let index=0;index<count;index++){
          const at=cursor+index,speech=prosody.at(at,segment),other=resolvedPhones[speech.otherIndex];
          const mix=(a,b)=>a+(b-a)*speech.blend;
          if(index===0||at%16===0)for(let band=0;band<3;band++)filters[band].c=coefficient(mix(p.formants[band],other.formants[band]),mix(p.bandwidths[band],other.bandwidths[band]));
          const tremolo=p.kind==='trill'?1+.75*Math.sin(TAU*26*index/RATE):1;
          const voice=glottal[at]*tremolo*mix(p.voice,other.voice)*settings.voicing;
          const rawNoise=normal(),softNoise=softenNoise(rawNoise);
          const afterRelease=index-releaseAt;
          let noiseEnvelope=1;
          if(stop)noiseEnvelope=afterRelease<0?0:Math.exp(-afterRelease/(RATE*.012));
          else if(affricate)noiseEnvelope=C.clamp(afterRelease/(RATE*.006),0,1)*(1-.7*index/Math.max(1,count-1));
          const noiseSource=frication?frication(rawNoise,index/Math.max(1,count-1)):noiseConsonant?softNoise:rawNoise;
          const noise=noiseSource*noiseEnvelope*dsp.blendSpeechNoise(p,other,speech.blend)*settings.noise;
          let value=0;
          for(let band=0;band<3;band++){
            const f=filters[band],[gain,a1,a2]=f.c;
            const input=p.branchSources?.[band]==='voice'?voice:p.branchSources?.[band]==='noise'?noise:voice+noise;
            const out=gain*input+a1*f.last+a2*f.older;f.older=f.last;f.last=out;
            value+=out*mix(p.weights[band],other.weights[band]);
          }
          const attack=burst||segment===0||resolvedPhones[segment-1].kind==='silence';
          const release=burst||segment===score.length-1||resolvedPhones[segment+1].kind==='silence';
          const edge=Math.max(0,Math.min(1,attack?index/(RATE*(burst ? .002 : .01)):1,release?(count-1-index)/(RATE*.02):1));
          samples[at]=C.check(value*mix(p.loudness,other.loudness)*speech.gain*edge);peak=Math.max(peak,Math.abs(samples[at]));
        }
        cursor+=count;
      }
      const gain=settings.outputGain/Math.max(peak,1e-9);
      for(let i=0;i<samples.length;i++)samples[i]=C.check(C.clamp(samples[i]*gain,-.9,.9));
      prosody.softenFrication(samples,resolvedPhones);
      return {engineId:'dsh',engineVersion:VERSION,samples,sampleRate:RATE,sampleCount:samples.length,duration:samples.length/RATE,
        settings,score,phones,resolvedPhones,seed:settings.seed,effectiveSeed:settings.seed||1,legacyExact:false,...prosody.metadata(),
        noiseAlgorithm:'xorshift32 + Box–Muller Gaussian, continuous in optional speech mode',
        adaptation:'Optional global pitch/phase and three-resonator transitions; original DSH path remains separate.'};
    }
    function render(request){
      if(!C.record(request))throw Error('Не задан запрос синтеза.');
      const settings=profile.normalize(request.settings),phones=C.overrides(request.phones);
      const age=clampAge(request.settings?.age),shape=ageShape(age);
      settings.age=age;
      const voiced={...settings,pitchStart:settings.pitchStart*shape.pitch,pitchEnd:settings.pitchEnd*shape.pitch,
        vibratoDepth:settings.vibratoDepth+shape.tremor,vibratoRate:settings.vibratoRate+shape.rateBoost};
      const {score,counts,total}=C.parseScore(request.score,settings,phones,known,RATE);
      if(request.prosody!==undefined){
        const prosody=root.VoiceProsodyDSP.create(request.prosody,counts,RATE,voiced);
        const result=renderSpeech({settings:voiced,phones,score,counts,total,prosody,shape});
        result.settings={...settings};return result;
      }
      const samples=new Float32Array(total),resolvedPhones=[];let cursor=0,peak=0,tiltState=0;
      for(let segment=0;segment<score.length;segment++){
        const id=score[segment].id,count=counts[segment],native=table[id];
        const p=C.scaled(Object.hasOwn(phones,id)?phones[id]:getPhone(id),settings,RATE);
        for(let band=0;band<3;band++)p.formants[band]=Math.min(C.limits.maxFrequency,p.formants[band]*shape.tract);
        p.noise=Math.min(3,p.noise*shape.breath);
        const sameKind=native?.kind===p.kind,loud=sameKind?native.loud:1;
        const branchSources=sameKind&&native.sources?native.sources:null;
        resolvedPhones.push({id,...p,activeFormants:3,loudness:loud,branchSources});
        if(p.kind==='silence'){cursor+=count;continue;}
        const glottal=new Float64Array(count);let phase=0;
        for(let index=0;index<count;index++){
          // The original DSH contour restarts at each phoneme, unlike the robot.
          const pitch=voiced.pitchStart+(voiced.pitchEnd-voiced.pitchStart)*index/count
            +voiced.vibratoDepth*Math.sin(TAU*voiced.vibratoRate*(cursor+index)/RATE);
          phase+=pitch/RATE;
          if(phase>=1){phase-=1;for(let k=0;k<48&&index+k<count;k++)glottal[index+k]+=Math.exp(-k/6);}
        }
        for(let index=0;index<count;index++){tiltState+=.42*(glottal[index]-tiltState);glottal[index]=tiltState;}
        const normal=gaussian(settings.seed),filters=p.formants.slice(0,3).map((f,i)=>({c:coefficient(f,p.bandwidths[i]),last:0,older:0}));
        const kind=p.kind,burst=kind==='stop'||kind==='affricate';
        const attack=kind==='vowel' ? .02 : burst ? .002 : .01;
        const release=kind==='vowel' ? .04 : ['fricative','stop','affricate'].includes(kind) ? .02 : .03;
        const attackCount=Math.min(count,Math.max(1,Math.floor(attack*RATE))),releaseCount=Math.min(count,Math.max(1,Math.floor(release*RATE)));
        for(let index=0;index<count;index++){
          const tremolo=kind==='trill'?1+.75*Math.sin(TAU*26*index/RATE):1;
          const voice=glottal[index]*tremolo*p.voice*settings.voicing;
          const noise=normal()*(burst?1-.9*index/Math.max(1,count-1):1)*p.noise*settings.noise;
          let value=0;
          for(let band=0;band<3;band++){
            const filter=filters[band],[gain,a1,a2]=filter.c;
            const input=branchSources?.[band]==='voice'?voice:branchSources?.[band]==='noise'?noise:voice+noise;
            const out=gain*input+a1*filter.last+a2*filter.older;
            filter.older=filter.last;filter.last=out;value+=out*p.weights[band];
          }
          // Safe overlapping ramps for user-authored short phonemes; unlike
          // NumPy's fixed slices this also handles segments shorter than 40 ms.
          const fadeIn=index<attackCount?index/Math.max(1,attackCount-1):1;
          const fadeOut=index>=count-releaseCount?(count-1-index)/Math.max(1,releaseCount-1):1;
          samples[cursor+index]=C.check(value*loud*Math.min(fadeIn,fadeOut));
          peak=Math.max(peak,Math.abs(samples[cursor+index]));
        }
        cursor+=count;
      }
      const gain=settings.outputGain/Math.max(peak,1e-9);
      for(let i=0;i<samples.length;i++)samples[i]=C.check(C.clamp(samples[i]*gain,-.9,.9));
      return {engineId:'dsh',engineVersion:VERSION,samples,sampleRate:RATE,sampleCount:samples.length,duration:samples.length/RATE,
        settings,score,phones,resolvedPhones,seed:settings.seed,effectiveSeed:settings.seed||1,legacyExact:false,
        noiseAlgorithm:'xorshift32 + Box–Muller Gaussian, reset per segment; not NumPy byte-identical',
        adaptation:'Three DSH resonators, impulse source; explicit new soft/English targets and alphabet Ж/Щ additions.'};
    }
    return Object.freeze({engineId:'dsh',version:VERSION,label:'DeepSeek · импульсный live-синтез',...profile,
      parameters:Object.freeze([...profile.parameters,Object.freeze({...AGE})]),
      defaults:Object.freeze({...profile.defaults,age:AGE.default}),
      normalize(input={}){const next=profile.normalize(input||{});next.age=clampAge(input?.age);return next;},
      phonemeIds:C.phonemeIds,phoneLabels:C.phoneLabels,kinds:C.kinds,getPhone,render,limits:{...C.limits,sampleRate:RATE},
      capabilities:Object.freeze({formantCount:3,disabledParameters:['transitionMs'],sampleRate:RATE,prosodyVersion:1,
        outputGainMeaning:'Пик всей фразы после суммирования сегментов.',
        note:'Три резонатора; четвёртые частота/полоса/вес хранятся, но не звучат. Без просодии переходы не смешиваются, высота начинается заново в каждой фонеме. Просодия включает непрерывные высоту/фазу и переходы в пределах сегментов. Возраст 0–100 двигает длину тракта, высоту, дрожание и придыхание в обоих путях. Наклон спектра гасит жужжание возбудителя. Шум JS отличается от NumPy.'})});
  };
})(globalThis);
