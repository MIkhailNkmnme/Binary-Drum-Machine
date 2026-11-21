/* ГОЛ-005: adjustable live adaptation of the bit-harmonic phone robot.
   Reuses only the source phone tables from robot/engine.js. Exact legacy profiles
   delegate to that original adapter; all other scores use the robot DSP below.
   No bank waveform, recordings, models, microphone or network audio. */
(function(root){
  'use strict';
  root.ZerkaliusRobotLiveFactory=function(C){
    const Original=root.ZerkaliusAlphabetRobot;
    if(!Original)throw Error('Не загружен исходный телефонный робот.');
    const VERSION='phone-robot-live-v1.2.5',RATE=44100,TAU=2*Math.PI,SIZE=2048,TAIL=.018;
    const bits=Array(8).fill(1),f0=440*2**((48-69)/12),raw=Original.phones();
    const profile=C.config({pitchStart:f0,pitchEnd:f0,vibratoDepth:0,vibratoRate:2.1,transitionMs:12,outputGain:.55,seed:Original.seedFor(bits,'zero')});
    const aliases={ax:'a-neutral',lj:'l-soft',dj:'d-soft',pj:'p-soft',tj:'t-soft',kj:'k-soft',sj:'s-soft',mj:'m-soft',vj:'v-soft',rj:'r-soft',shj:'sh-soft'};
    const targets=Object.create(null),known=new Set(C.phonemeIds);
    const clone=p=>({...p,frequencies:[...p.frequencies],bandwidths:[...p.bandwidths],weights:[...p.weights]});
    for(const id of C.phonemeIds){
      const alias=aliases[id]||id;if(Object.hasOwn(raw,alias))targets[id]=clone(raw[alias]);
    }
    // Explicit extensions for remaining bank-alphabet IDs. These are declared
    // recipes, never a fallback for unknown tokens.
    for(const id of ['bj','gj','zj','zhj','fj','hj','nj']){
      const p=clone(raw[id.slice(0,-1)]);p.frequencies[1]=Math.max(2100,p.frequencies[1]);p.frequencies[2]=Math.max(2900,p.frequencies[2]);targets[id]=p;
    }
    targets.ae=clone(raw.a);targets.ae.frequencies=[660,1750,2700,3550];
    targets.rr=clone(raw.r);targets.rr.frequencies=[380,1450,1950,3450];targets.rr.kind='rhotic';
    targets.w=clone(raw.u);targets.w.frequencies=[300,650,2300,3400];targets.w.kind='approximant';targets.w.voiced=.85;
    targets.dzh=clone(raw.ch);targets.dzh.voiced=.35;targets.dzh.noise=.7;
    targets._=clone(raw.a);Object.assign(targets._,{kind:'silence',voiced:0,noise:0,gain:0,bypass:0});
    const publicKind=kind=>kind==='stopD'||kind==='stopK'?'stop':['nasal','lateral','approximant'].includes(kind)?'sonorant':kind;
    function getPhone(id){
      if(!Object.hasOwn(targets,id))throw Error('Неизвестная фонема робота: '+id);
      const p=targets[id];return {kind:publicKind(p.kind),formants:[...p.frequencies],bandwidths:[...p.bandwidths],weights:[...p.weights],voice:p.voiced,noise:p.noise};
    }
    const legacyWords=Original.legacyWords();
    const sourceProfiles=Object.freeze(Object.entries(legacyWords).map(([id,word])=>Object.freeze({
      id,label:'Исходный робот · '+word.text,symbol:id==='zero'?'0':id==='one'?'1':'',lang:'ru',kind:'name',engineId:'robot',sourceProfile:id,
      score:word.sequence.map(([name,duration])=>({id:name==='l-soft'?'lj':name,duration})),
      settings:{...profile.defaults,seed:Original.seedFor(bits,id)},phones:{}
    })));
    function source(harmonics){
      const table=new Float64Array(SIZE);let total=0;
      for(let h=1;h<=harmonics;h++){const amplitude=1/Math.pow(h,1.12-.35*.82);total+=amplitude;
        for(let q=0;q<SIZE;q++)table[q]+=amplitude*Math.sin(TAU*h*q/SIZE);}
      const scale=1/Math.max(total,.001);for(let q=0;q<SIZE;q++)table[q]*=scale;return table;
    }
    function coefficients(frequency,bandwidth){
      const f=C.clamp(frequency,60,RATE*.43),bw=C.clamp(bandwidth,50,RATE*.25);
      const omega=TAU*f/RATE,quality=C.clamp(f/bw,.3,30),alpha=Math.sin(omega)/(2*quality),a0=1+alpha;
      return {b0:alpha/a0,b2:-alpha/a0,a1:-2*Math.cos(omega)/a0,a2:(1-alpha)/a0};
    }
    function render(request){
      if(!C.record(request))throw Error('Не задан запрос синтеза.');
      const settings=profile.normalize(request.settings),phones=C.overrides(request.phones);
      // The original robot biquad has 60 Hz frequency / 50 Hz bandwidth floors. Normalize saved
      // overrides as well as the scaled targets so returned metadata is truthful.
      for(const phone of Object.values(phones)){
        phone.formants=phone.formants.map(f=>Math.max(60,f));
        phone.bandwidths=phone.bandwidths.map(b=>Math.max(50,b));
      }
      const tail=Math.round(TAIL*RATE),{score,counts,total}=C.parseScore(request.score,settings,phones,known,RATE,tail);
      const dsp=root.VoiceProsodyDSP;
      const prosody=request.prosody===undefined?null:dsp.create(request.prosody,counts,RATE,settings);
      const softenNoise=prosody?dsp.createConsonantNoise(RATE):null;
      const resolved=score.map((token,index)=>{
        const custom=Object.hasOwn(phones,token.id);
        const target=custom?phones[token.id]:getPhone(token.id),native=targets[token.id];
        const speechTarget=prosody&&!custom?prosody.speechPhone(token.id,target,index):target;
        const p=C.scaled(speechTarget,settings,RATE,60);
        p.bandwidths=p.bandwidths.map(b=>Math.max(50,b));
        if(prosody&&!custom)p.noise=dsp.defaultSpeechNoise(p);
        const sameKind=!!native&&publicKind(native.kind)===p.kind;
        return {...p,id:token.id,gain:sameKind||speechTarget!==target?native.gain:1,bypass:sameKind?native.bypass*(p.noise/(native.noise||1)):0,
          robotKind:p.kind==='stop'?(p.voice>0?'stopD':'stopK'):p.kind};
      });
      const harmonics=Math.max(1,Math.min(96,Math.floor(RATE*.43/(prosody?prosody.maximumFrequency:Math.max(settings.pitchStart,settings.pitchEnd)+settings.vibratoDepth))));
      const common={sampleRate:RATE,settings,score,phones,resolvedPhones:resolved,seed:settings.seed,effectiveSeed:settings.seed||1,
        engineId:'robot',engineVersion:VERSION,sourceHarmonics:harmonics,bits:[...bits],tilt:.82,...(prosody?prosody.metadata():{})};
      const exact=!prosody&&!Object.keys(phones).length&&sourceProfiles.find(p=>JSON.stringify(p.score)===JSON.stringify(score)
        &&Object.keys(profile.defaults).every(key=>settings[key]===p.settings[key]));
      if(exact){
        const samples=Original.renderVoice({rate:RATE,midi:48,event:{robotWord:exact.id,bits,f0,tilt:.82}});
        return {...common,samples,duration:samples.length/RATE,sampleCount:samples.length,legacyExact:true,sourceProfile:exact.id,
          sourceEngineVersion:Original.VERSION};
      }
      const table=source(harmonics),samples=new Float32Array(total+tail),filters=Array.from({length:4},()=>({z1:0,z2:0,c:null}));
      const seconds=samples.length/RATE,speechSeconds=total/RATE;
      const fricationSources=resolved.map(({id,kind})=>!Object.hasOwn(phones,id)?prosody?.fricationSource(id,kind):null);
      const stopReleases=resolved.map(({id,kind},index)=>!Object.hasOwn(phones,id)?prosody?.stopRelease(id,kind,counts[index],.58):null);
      let rng=settings.seed||1,phase=0,segment=0,start=0,control=null,lastNoise=0,lastOutput=0,dc=0,peak=0;
      for(let sample=0;sample<samples.length;sample++){
        while(segment+1<score.length&&sample>=start+counts[segment]){start+=counts[segment];segment++;control=null;}
        const time=sample/RATE,local=(sample-start)/RATE,segmentDuration=counts[segment]/RATE,current=resolved[segment];
        const speech=prosody?prosody.at(sample,segment):null;
        if(!control||sample%16===0){
          const t=Math.min(settings.transitionMs/1000,segmentDuration*.2);let other=current,blend=0;
          if(t&&segment>0&&local<t){other=resolved[segment-1];blend=.5*(1-local/t);}
          else if(t&&segment+1<score.length&&segmentDuration-local<t){other=resolved[segment+1];blend=.5*(1-(segmentDuration-local)/t);}
          if(speech){other=resolved[speech.otherIndex];blend=current.kind==='silence'||other.kind==='silence'?0:speech.blend;}
          const mix=(a,b)=>a+(b-a)*blend;
          control={weights:current.weights.map((n,i)=>mix(n,other.weights[i])),voice:mix(current.voice,other.voice),
            noise:speech?dsp.blendSpeechNoise(current,other,blend):mix(current.noise,other.noise),
            gain:mix(current.gain,other.gain),bypass:speech?0:mix(current.bypass,other.bypass)};
          for(let band=0;band<4;band++)filters[band].c=coefficients(mix(current.formants[band],other.formants[band]),mix(current.bandwidths[band],other.bandwidths[band]));
        }
        const index=Math.floor(phase),fraction=phase-index,pulse=table[index]+fraction*(table[(index+1)%SIZE]-table[index]);
        let pitch=settings.pitchStart+(settings.pitchEnd-settings.pitchStart)*(prosody?prosody.progress(sample):Math.min(1,sample/Math.max(1,total)))
          +settings.vibratoDepth*Math.sin(TAU*settings.vibratoRate*time);
        if(speech)pitch=prosody.frequency(pitch,speech);
        phase+=pitch/RATE*SIZE;phase-=Math.floor(phase/SIZE)*SIZE;
        rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;
        const white=(rng>>>0)/2147483648-1,highNoise=(white-lastNoise)*.5;lastNoise=white;
        const softNoise=softenNoise?softenNoise(white):white;
        let voiced=control.voice*settings.voicing,noise=control.noise*settings.noise,bypass=control.bypass*settings.noise,envelope=1;
        const kind=current.robotKind;
        if(kind==='stopK'||kind==='stopD'){
          const stopRelease=stopReleases[segment],closedVoice=kind==='stopD' ? .055*settings.voicing : 0;
          if(stopRelease){
            voiced=closedVoice+(voiced-closedVoice)*stopRelease.voiceOpening(sample-start);
            noise*=stopRelease.noiseEnvelope(sample-start);
          }else{
            const release=segmentDuration*.58;
            if(local<release){noise=0;voiced=closedVoice;}
            else{const age=local-release;noise*=Math.exp(-age/.009);voiced*=C.clamp(age/.012,0,1);}
          }
        }else if(kind==='affricate'){
          const release=segmentDuration*.30;
          if(local<release){noise=0;voiced=0;bypass=0;}else{const opening=C.clamp((local-release)/.006,0,1);noise*=opening;bypass*=opening;}
        }else if(kind==='trill')envelope=.25+.75*Math.abs(Math.sin(TAU*32*local));
        if(time>=speechSeconds||kind==='silence'){voiced=0;noise=0;bypass=0;}
        const frication=fricationSources[segment];
        const excitation=frication?frication(white,(sample-start)/Math.max(1,counts[segment]-1))
          :speech&&dsp.isNoiseConsonant(current.kind)?softNoise:white;
        const input=pulse*voiced+excitation*noise*.22;let value=0;
        for(let band=0;band<4;band++){
          const filter=filters[band],c=filter.c,out=c.b0*input+filter.z1;
          filter.z1=-c.a1*out+filter.z2;filter.z2=c.b2*input-c.a2*out;value+=out*control.weights[band];
        }
        value=(value+highNoise*bypass*(time<speechSeconds?1:0))*control.gain*envelope;
        let speechEdge=1;
        if(speech){
          // Taper only real pauses. Keep voiced phoneme joins continuous.
          const attack=segment===0||resolved[segment-1].kind==='silence';
          const release=segment+1<resolved.length&&resolved[segment+1].kind==='silence';
          value*=speech.gain;
          speechEdge=Math.max(0,Math.min(1,attack?local/.004:1,release?(counts[segment]-1-(sample-start))/(RATE*.005):1));
        }
        const blocked=value-lastOutput+.995*dc;lastOutput=value;dc=blocked;
        const gate=Math.min(1,time/.006,Math.max(0,(seconds-time)/TAIL));
        samples[sample]=kind==='silence'?0:C.check(blocked*gate*speechEdge);peak=Math.max(peak,Math.abs(samples[sample]));
        if(kind==='silence'){for(const f of filters){f.z1=0;f.z2=0;}lastOutput=0;dc=0;}
      }
      const gain=settings.outputGain/Math.max(peak,.045);
      for(let i=0;i<samples.length;i++)samples[i]=C.check(Math.tanh(samples[i]*gain));
      prosody?.softenFrication(samples,resolved);
      return {...common,samples,duration:samples.length/RATE,sampleCount:samples.length,legacyExact:false,sourceProfile:null};
    }
    return Object.freeze({engineId:'robot',version:VERSION,label:'Телефонный робот · битовые гармоники',...profile,
      phonemeIds:C.phonemeIds,phoneLabels:C.phoneLabels,kinds:C.kinds,getPhone,render,sourceProfiles,
      limits:{...C.limits,minFrequency:60,minBandwidth:50,sampleRate:RATE},capabilities:Object.freeze({formantCount:4,disabledParameters:[],sampleRate:RATE,prosodyVersion:1,
        outputGainMeaning:'Коэффициент 0…0,9 перед tanh с исходным нижним порогом пика 0,045; это не точный конечный пик.',
        note:'Битовые гармоники 11111111, tilt 0,82, четыре biquad; частоты формант от 60 Гц, полосы от 50 Гц, включая результат масштабирования. При смене типа фонемы скрытые gain/bypass прежнего типа сбрасываются. Точные три исходных слова делегируются прежнему роботу при совпадении всех параметров.'})});
  };
})(globalThis);
