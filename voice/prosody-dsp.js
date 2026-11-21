/* ГОЛ-007: optional synthesis-domain prosody. No audio input or resampling.
   Segment boundaries are immutable; transitions occupy at most one quarter
   of each adjacent segment. An absent request never creates this controller. */
(function(root){
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const isNoiseConsonant=kind=>kind==='stop'||kind==='fricative'||kind==='affricate';
  const fricationProfiles=new Map([
    ['zh',{durationScale:.70,cutoffHz:2600,lowGain:.94,highGain:.18}],
    ['s',{durationScale:.66,cutoffHz:3800,lowGain:.72,highGain:.20}],
    ['f',{durationScale:.67,cutoffHz:2800,lowGain:.65,highGain:.12}],
    ['h',{durationScale:.69,cutoffHz:3000,lowGain:.65,highGain:.14}],
    ['ts',{durationScale:.76,cutoffHz:3700,lowGain:.73,highGain:.20}],
    ['ch',{durationScale:.75,cutoffHz:2850,lowGain:.72,highGain:.16}],
    ['sh',{durationScale:.68,cutoffHz:2800,lowGain:.68,highGain:.15}],
    ['shj',{durationScale:.74,cutoffHz:3000,lowGain:.70,highGain:.16}]
  ]);
  // Each noise source is concentrated in its own band before the vocal tract.
  // The values are centre frequency, bandwidth (Hz), and passband gain.
  const speechFricationBands=new Map([
    ['zh',[1750,1150,.55]],['z',[3400,1300,.4]],['s',[3650,1600,.32]],['f',[1150,650,.7]],['h',[750,950,.7]],
    ['ts',[3300,1750,.4]],['ch',[2400,1150,.48]],['sh',[2100,1100,.43]],['shj',[2850,1500,.45]]
  ]);
  function phoneProfile(profiles,id){
    return profiles.get(id)??(id.endsWith('j')?profiles.get(id.slice(0,-1)):null);
  }
  const voicedStops=new Set(['b','bj','g','gj','d','dj']);
  const softenedVoicing=new Set([...voicedStops,'v','vj']);
  function createConsonantVoicing(score,overrides,rate){
    // Two low-pass stages round the periodic source before the vocal tract.
    // Keep the filter running across phonemes so a vowel enters smoothly.
    const targets=score.map(({id})=>id==='_'||Object.hasOwn(overrides,id)?null:Number(softenedVoicing.has(id)));
    if(!targets.includes(1))return null;
    const step=1-Math.exp(-2*Math.PI*700/rate);
    let first=0,second=0;
    function filter(sample,index,otherIndex,blend){
      first+=step*(sample-first);
      second+=step*(first-second);
      const target=targets[index];
      if(target===null)return sample;
      const other=targets[otherIndex]??target;
      return sample+(second-sample)*(target+(other-target)*blend);
    }
    filter.reset=()=>{first=0;second=0;};
    return filter;
  }
  const voicedVelars=new Set(['g','gj']);
  function speechPhone(id,phone,closedVoicedStop,isolatedZ,voicedVelar){
    if(isolatedZ&&phone.kind==='fricative'){
      return {...phone,kind:'sonorant',voice:.60,noise:0,
        formants:[300,id==='zj'?Math.max(2150,phone.formants[1]):1650,...phone.formants.slice(2)],bandwidths:[145,...phone.bandwidths.slice(1)],
        weights:[.65,.18,.035,0]};
    }
    if(voicedVelar&&phone.kind==='stop'){
      const soft=id==='gj';
      // The adjacent F2 and F3 concentrate the release in the mid band.
      // F1 supports voicing in the closure and on both sides of the release.
      return {...phone,voice:.82,noise:.48,
        formants:[255,soft?2300:1900,soft?2650:2250,4100],bandwidths:[125,430,440,800],
        weights:[.82,.8,.63,.06]};
    }
    if(closedVoicedStop&&phone.kind==='stop'&&voicedStops.has(id)){
      // An isolated stop is the low periodic closure, with no release noise.
      return {...phone,kind:'sonorant',voice:.42,noise:0,
        formants:[250,...phone.formants.slice(1)],bandwidths:[120,...phone.bandwidths.slice(1)],
        weights:[.7,.1,.025,0]};
    }
    if((id!=='v'&&id!=='vj')||phone.kind!=='fricative')return phone;
    // Use a periodic approximation with a low resonance and a weaker second one.
    return {...phone,kind:'sonorant',voice:.75,noise:0,
      formants:[320,id==='vj'?2150:1250,...phone.formants.slice(2)],
      weights:[.65,.30,.075,0]};
  }
  function createFricationSource(id,kind,rate){
    if(kind!=='fricative'&&kind!=='affricate')return null;
    const band=phoneProfile(speechFricationBands,id);
    if(!band)return null;
    const [center,width,level]=band,angle=2*Math.PI*center/rate;
    const alpha=Math.sin(angle)*width/(2*center),scale=1/(1+alpha);
    const b0=alpha*scale,a1=-2*Math.cos(angle)*scale,a2=(1-alpha)*scale;
    let state1=0,state2=0;
    return (noise,progress)=>{
      const out=b0*noise+state1;
      state1=state2-a1*out;
      state2=-b0*noise-a2*out;
      const edge=clamp(Math.min(progress/.12,(1-progress)/.20),0,1);
      return out*level*edge*edge*(3-2*edge);
    };
  }
  const russianStops=new Set(['b','bj','g','gj','d','dj','k','kj','p','pj','t','tj']);
  function smooth(value){
    const t=clamp(value,0,1);
    return t*t*(3-2*t);
  }
  function createStopRelease(count,rate,fraction,voicedVelar){
    const last=count-1,start=Math.ceil(last*(voicedVelar ? .52 : fraction)),span=count-start;
    const attack=Math.max(1,Math.min(rate*.004,span/3));
    const tail=Math.max(1,Math.min(rate*.006,span/3));
    const opening=Math.max(1,Math.min(rate*(voicedVelar ? .006 : .012),span*.6));
    const decay=rate*(voicedVelar ? .0045 : .008);
    return {
      voiceOpening:index=>smooth((index-start)/opening),
      noiseEnvelope:index=>{
        if(index<=start||index>=last)return 0;
        const age=index-start;
        return .60*smooth(age/attack)*Math.exp(-age/decay)*smooth((last-index)/tail);
      }
    };
  }
  function fricationProfile(id,kind){
    if(kind!=='fricative'&&kind!=='affricate')return null;
    return phoneProfile(fricationProfiles,id);
  }
  const fricationDurationScale=(id,kind)=>fricationProfile(id,kind)?.durationScale??1;
  function applyFrication(samples,phones,boundaries,rate){
    for(const {index,startSample,endSample} of boundaries){
      const {id,kind}=phones[index],profile=fricationProfile(id,kind);
      if(!profile)continue;
      const {cutoffHz,lowGain,highGain}=profile;
      const step=1-Math.exp(-2*Math.PI*cutoffHz/rate);
      const fade=Math.max(1,Math.min(Math.round(.005*rate),Math.floor((endSample-startSample)/2)));
      let first=samples[startSample],second=first;
      for(let at=startSample;at<endSample;at++){
        const sample=samples[at];
        first+=step*(sample-first);
        second+=step*(first-second);
        const softened=highGain*sample+(lowGain-highGain)*second;
        // Fade the correction inside the segment without filtering its neighbours.
        const weight=Math.min(1,(at-startSample)/fade,(endSample-1-at)/fade);
        samples[at]=sample+(softened-sample)*weight;
      }
    }
  }
  function defaultSpeechNoise(phone){
    return phone.kind==='vowel'||isNoiseConsonant(phone.kind)?phone.noise:0;
  }
  function blendSpeechNoise(current,other,blend){
    if(!isNoiseConsonant(current.kind))return current.noise;
    if(isNoiseConsonant(other.kind))return current.noise+(other.noise-current.noise)*blend;
    // Fade friction within its own consonant. A voiced neighbour has no copy of its noise.
    return current.noise*(1-2*blend);
  }
  function createConsonantNoise(rate){
    const step=1-Math.exp(-2*Math.PI*4800/rate);
    let first=0,second=0;
    return sample=>{
      first+=step*(sample-first);
      second+=step*(first-second);
      // Keep some of the upper spectrum that distinguishes sibilants.
      return .82*second+.18*sample;
    };
  }
  function number(v,name,min,max){
    if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error('Просодия: '+name+' должен быть в диапазоне '+min+'…'+max+'.');
    return v;
  }
  function create(input,counts,rate,settings){
    if(!object(input)||input.version!==1)throw Error('Просодия: требуется объект version:1.');
    if(!Array.isArray(counts)||!counts.length||counts.length>96||counts.some(n=>!Number.isSafeInteger(n)||n<1))throw Error('Просодия: неверные длины сегментов.');
    if(!Array.isArray(input.segments)||input.segments.length!==counts.length)throw Error('Просодия: число сегментов должно совпадать с партитурой.');
    const transitionMs=input.transitionMs===undefined?20:number(input.transitionMs,'transitionMs',0,80);
    const rangeStart=input.rangeStart===undefined?0:number(input.rangeStart,'rangeStart',0,1);
    const rangeEnd=input.rangeEnd===undefined?1:number(input.rangeEnd,'rangeEnd',0,1);
    if(rangeStart>rangeEnd)throw Error('Просодия: rangeStart не может превышать rangeEnd.');
    const segments=input.segments.map((p,i)=>{
      if(!object(p))throw Error('Просодия: неверный сегмент '+(i+1));
      return {pitchStartSemitones:number(p.pitchStartSemitones,'pitchStartSemitones',-12,12),
        pitchEndSemitones:number(p.pitchEndSemitones,'pitchEndSemitones',-12,12),gain:number(p.gain,'gain',0,2),
        ...(p.closedVoicedStop===true?{closedVoicedStop:true}:{}),...(p.isolatedZ===true?{isolatedZ:true}:{})};
    });
    let total=0;const boundaries=counts.map((count,index)=>{const startSample=total;total+=count;return {index,startSample,endSample:total};});
    if(total>12*rate)throw Error('Просодия: превышен предел 12 секунд.');
    const windows=counts.slice(1).map((count,i)=>Math.max(0,Math.min(transitionMs*rate/1000,(counts[i]-1)/4,(count-1)/4)));
    const offsets=segments.flatMap(p=>[p.pitchStartSemitones,p.pitchEndSemitones]);
    const requestedMin=(Math.min(settings.pitchStart,settings.pitchEnd)-settings.vibratoDepth)*2**(Math.min(...offsets)/12);
    const requestedMax=(Math.max(settings.pitchStart,settings.pitchEnd)+settings.vibratoDepth)*2**(Math.max(...offsets)/12);
    const floor=20,ceiling=Math.min(2000,rate*.43),maximumFrequency=clamp(requestedMax,floor,ceiling);
    function at(sample,index){
      const local=clamp(sample-boundaries[index].startSample,0,counts[index]-1),p=segments[index];
      let semitones=p.pitchStartSemitones+(p.pitchEndSemitones-p.pitchStartSemitones)*local/Math.max(1,counts[index]-1);
      let gain=p.gain,otherIndex=index,blend=0,neighborPitch=semitones;
      if(index>0&&windows[index-1]>0&&local<windows[index-1]){
        const t=1-local/windows[index-1];blend=.5*t*t*(3-2*t);otherIndex=index-1;neighborPitch=segments[otherIndex].pitchEndSemitones;
      }else if(index+1<counts.length&&windows[index]>0&&counts[index]-1-local<windows[index]){
        const t=1-(counts[index]-1-local)/windows[index];blend=.5*t*t*(3-2*t);otherIndex=index+1;neighborPitch=segments[otherIndex].pitchStartSemitones;
      }
      semitones+=(neighborPitch-semitones)*blend;gain+=(segments[otherIndex].gain-gain)*blend;
      return {pitchMultiplier:2**(semitones/12),gain,otherIndex,blend};
    }
    const softenRussianFrication=input.softenFrication===true;
    const articulatedFrication=input.articulatedFrication===true;
    const smoothStopRelease=input.smoothStopRelease===true;
    const bandLimitedZ=input.bandLimitedZ===true;
    const softVoicedConsonants=input.softVoicedConsonants===true;
    const voicedVelarRelease=input.voicedVelarRelease===true;
    const hasVelarRelease=id=>voicedVelarRelease&&voicedVelars.has(id);
    const appliedProsody={version:1,segments,transitionMs,rangeStart,rangeEnd,
      ...(softenRussianFrication?{softenFrication:true}:{}),...(articulatedFrication?{articulatedFrication:true}:{}),
      ...(smoothStopRelease?{smoothStopRelease:true}:{}),...(bandLimitedZ?{bandLimitedZ:true}:{}),
      ...(softVoicedConsonants?{softVoicedConsonants:true}:{}),...(voicedVelarRelease?{voicedVelarRelease:true}:{})};
    const diagnosticLimits={semitones:[-12,12],segmentGain:[0,2],transitionMs:[0,80],frequencyHz:[floor,ceiling],
      requestedMinimumFrequency:requestedMin,requestedMaximumFrequency:requestedMax,
      effectiveMinimumFrequency:clamp(requestedMin,floor,ceiling),effectiveMaximumFrequency:maximumFrequency,
      frequencyBounds:'Conservative synthesis limits, not measured extrema of the output waveform.',
      frequencyClamped:requestedMin<floor||requestedMax>ceiling,
      effectiveBoundaryTransitionMs:windows.map(n=>n/rate*1000),
      transitionWindow:'Maximum duration on each side of a boundary; no overlap or change in segment lengths.',
      segmentDurationsChanged:false,segmentsOverlap:false,shortSegmentPolicy:'A one-sample segment has no transition window.'};
    return {at,maximumFrequency,progress:sample=>rangeStart+(rangeEnd-rangeStart)*clamp(sample/Math.max(1,total),0,1),
      frequency:(base,control)=>clamp(base*control.pitchMultiplier,floor,ceiling),
      speechPhone:(id,phone,index)=>{
        const closed=segments[index]?.closedVoicedStop===true&&voicedStops.has(id);
        const isolatedZ=segments[index]?.isolatedZ===true&&(id==='z'||id==='zj');
        const voicedVelar=hasVelarRelease(id);
        return articulatedFrication||closed||isolatedZ||voicedVelar?speechPhone(id,phone,closed,isolatedZ,voicedVelar):phone;
      },
      consonantVoicing:(score,overrides)=>softVoicedConsonants?createConsonantVoicing(score,overrides,rate):null,
      fricationSource:(id,kind)=>articulatedFrication&&(bandLimitedZ||(id!=='z'&&id!=='zj'))?createFricationSource(id,kind,rate):null,
      stopRelease:(id,kind,count,fraction)=>smoothStopRelease&&kind==='stop'&&russianStops.has(id)
        ?createStopRelease(count,rate,fraction,hasVelarRelease(id)):null,
      softenFrication:(samples,phones)=>{
        if(softenRussianFrication&&!articulatedFrication)applyFrication(samples,phones,boundaries,rate);
      },
      metadata:()=>({appliedProsody,diagnosticLimits,segmentBoundaries:boundaries})};
  }
  root.VoiceProsodyDSP=Object.freeze({version:1,create,isNoiseConsonant,defaultSpeechNoise,blendSpeechNoise,createConsonantNoise,fricationDurationScale});
})(globalThis);
