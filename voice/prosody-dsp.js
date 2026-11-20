/* ГОЛ-007: optional synthesis-domain prosody. No audio input or resampling.
   Segment boundaries are immutable; transitions occupy at most one quarter
   of each adjacent segment. An absent request never creates this controller. */
(function(root){
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const isNoiseConsonant=kind=>kind==='stop'||kind==='fricative'||kind==='affricate';
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
        pitchEndSemitones:number(p.pitchEndSemitones,'pitchEndSemitones',-12,12),gain:number(p.gain,'gain',0,2)};
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
    const appliedProsody={version:1,segments,transitionMs,rangeStart,rangeEnd};
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
      metadata:()=>({appliedProsody,diagnosticLimits,segmentBoundaries:boundaries})};
  }
  root.VoiceProsodyDSP=Object.freeze({version:1,create,isNoiseConsonant,defaultSpeechNoise,blendSpeechNoise,createConsonantNoise});
})(globalThis);
