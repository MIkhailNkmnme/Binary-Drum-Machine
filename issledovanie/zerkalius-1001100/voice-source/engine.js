/* ГОЛ-003 · Browser adaptation of our procedural-formant-v1 Python generator.
   Original: ../mayatnik/sign-voice/generate_procedural_bank.py
   Mathematical excitation only: no recordings, audio inputs, TTS, weights or network.
   This is a phoneme-score instrument, not a general text-to-speech model.
   JavaScript arithmetic, explicit seed, configurable peak and harmonic cutoff mean
   the output is not promised to be byte-identical to the original Python bank. */
(function(root){
  'use strict';
  const VERSION='procedural-formant-browser-v1.2.5';
  const RATE=22050,TAU=2*Math.PI,TABLE_SIZE=4096,MAX_SECONDS=12,MAX_SEGMENTS=96;
  const MAX_FREQUENCY=RATE*.45,MAX_BANDWIDTH=4000;
  const definitions=[
    ['pitchStart','Начальная частота голоса, Гц',50,450,1,124],
    ['pitchEnd','Конечная частота голоса, Гц',50,450,1,107],
    ['vibratoDepth','Глубина вибрато, Гц',0,20,.1,1.8],
    ['vibratoRate','Частота вибрато, Гц',0,12,.1,2.1],
    ['speed','Скорость произнесения',.25,3,.05,1],
    ['formantScale','Масштаб частот формант',.5,2,.01,1],
    ['bandwidthScale','Масштаб полос формант',.3,3,.01,1],
    ['voicing','Уровень периодического источника',0,2,.05,1],
    ['noise','Уровень шумового источника',0,2,.05,1],
    ['transitionMs','Переход между формантами, мс',0,150,1,30],
    ['outputGain','Пиковый уровень всей фразы',0,.9,.01,.7],
    ['seed','Семя шума, uint32',0,4294967295,1,0x5A45524B]
  ];
  const parameters=Object.freeze(definitions.map(([key,label,min,max,step,value])=>Object.freeze({key,id:key,label,min,max,step,default:value})));
  const defaults=Object.freeze(Object.fromEntries(parameters.map(p=>[p.key,p.default])));
  const kinds=Object.freeze([
    ['vowel','Гласный'],['sonorant','Сонорный'],['stop','Смычный'],
    ['fricative','Щелевой'],['affricate','Аффриката'],['trill','Дрожащий'],
    ['rhotic','Ротический'],['silence','Пауза']
  ].map(([id,label])=>Object.freeze({id,label})));
  const kindIds=new Set(kinds.map(item=>item.id));
  const vowels={
    a:[[760,1200,2600,3500],[95,120,180,240],[1,.85,.45,.18]],
    e:[[530,1900,2600,3500],[85,130,170,240],[1,1.15,.45,.16]],
    i:[[290,2300,3000,3700],[65,130,190,250],[1,1.6,.65,.16]],
    o:[[480,850,2450,3500],[75,100,180,240],[1,.9,.3,.12]],
    u:[[320,700,2300,3400],[65,90,170,240],[1,.75,.25,.10]],
    y:[[390,1450,2450,3500],[75,120,180,240],[1,1.05,.4,.14]],
    ax:[[500,1300,2500,3500],[100,130,180,240],[1,.75,.3,.12]],
    ae:[[680,1750,2600,3500],[95,130,180,240],[1,1.05,.45,.15]]
  };
  const consonants=['p','b','t','d','k','g','s','z','sh','zh','f','v','h','m','n','l','r'];
  const phonemeIds=Object.freeze([...Object.keys(vowels),...consonants,...consonants.map(id=>id+'j'),'ts','ch','dzh','rr','j','w','_']);
  const knownPhones=new Set(phonemeIds);
  const names={a:'А',e:'Э',i:'И',o:'О',u:'У',y:'Ы',ax:'Нейтральный гласный',ae:'Открытый передний гласный',
    p:'П',b:'Б',t:'Т',d:'Д',k:'К',g:'Г',s:'С',z:'З',sh:'Ш',zh:'Ж',f:'Ф',v:'В',h:'Х',m:'М',n:'Н',l:'Л',r:'Р',
    ts:'Ц',ch:'Ч',dzh:'Дж',rr:'Английское r',j:'Й',w:'Английское w',_:'Пауза'};
  const phoneLabels=Object.freeze(Object.fromEntries(phonemeIds.map(id=>[id,names[id]||(names[id.slice(0,-1)]+' мягкий')])));
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  function finite(value,label){
    if(typeof value!=='number'||!Number.isFinite(value))throw new Error(label+': требуется конечное число.');
    return value;
  }
  function normalize(settings={}){
    if(!record(settings))throw new Error('Настройки должны быть объектом.');
    const result={};
    for(const p of parameters){
      const value=settings[p.key]===undefined?p.default:finite(settings[p.key],p.label);
      result[p.key]=clamp(value,p.min,p.max);
    }
    result.seed=Math.trunc(result.seed)>>>0;
    return result;
  }
  function getPhone(id,nextVowel='e'){
    if(!knownPhones.has(id))throw new Error('Неизвестная фонема: '+id);
    if(!Object.hasOwn(vowels,nextVowel))throw new Error('Неизвестный следующий гласный: '+nextVowel);
    const vowel=Object.hasOwn(vowels,id),[f,b,a]=vowels[vowel?id:nextVowel];
    const shape={kind:vowel?'vowel':'sonorant',formants:[...f],bandwidths:[...b],weights:[...a],voice:vowel?1:.8,noise:vowel ? .012 : .015};
    if(vowel)return shape;
    const soft=id.endsWith('j')&&id!=='j',base=soft?id.slice(0,-1):id;
    const put=(formants,bandwidths,weights,voice,noise,kind)=>Object.assign(shape,{formants,bandwidths,weights,voice,noise,kind});
    if(id==='_')Object.assign(shape,{voice:0,noise:0,kind:'silence'});
    else if(['p','b','t','d','k','g'].includes(base)){
      const locus={p:700,b:700,t:1800,d:1800,k:2300,g:2300}[base];
      put([260,soft?2200:locus,3000,4100],[160,450,600,800],[.5,.8,.7,.45],['b','d','g'].includes(base) ? .36 : 0,1.7,'stop');
    }else if(['s','z','sh','zh','f','v','h'].includes(base)||['ts','ch','dzh'].includes(id)){
      let frequencies,bandwidths,weights;
      if(['f','v'].includes(base)){
        frequencies=[900,2300,4300,6800];bandwidths=[800,1200,1600,1900];weights=[.15,.3,.55,.35];
      }else if(base==='h'){
        frequencies=[...f];bandwidths=[300,400,550,700];weights=[.8,.8,.4,.1];
      }else if(['sh','zh'].includes(base)||['ch','dzh'].includes(id)){
        frequencies=!soft&&id!=='ch'?[2000,3100,4400,6200]:[2700,4100,5600,7200];
        bandwidths=[500,800,1000,1400];weights=[1,.65,.35,.2];
      }else{
        frequencies=soft?[3600,5100,6700,8200]:[4200,5700,7200,8600];
        bandwidths=[650,800,1100,1400];weights=[.75,1,.55,.2];
      }
      put(frequencies,bandwidths,weights,(['z','zh','v'].includes(base)||id==='dzh') ? .45 : 0,
        ['f','v','h'].includes(base) ? .8 : 1.05,['ts','ch','dzh'].includes(id)?'affricate':'fricative');
    }else if(['m','n'].includes(base)){
      put([250,soft?1950:base==='m'?1050:1450,2400,3400],[80,180,260,350],[1,.22,.13,.06],.8,.015,'sonorant');
    }else if(base==='l'){
      put([360,soft?2050:1050,2800,3500],[85,140,190,250],[1,.75,.35,.12],.85,.015,'sonorant');
    }else if(base==='r'||id==='rr'){
      put([380,soft?1850:1450,id==='rr'?1900:2600,3500],[100,160,200,260],[1,.8,.5,.12],.8,.015,id==='rr'?'rhotic':'trill');
    }else if(id==='j'){
      put([270,2350,3050,3800],[75,150,200,260],[1,1.5,.6,.15],.85,.015,'sonorant');
    }else if(id==='w')Object.assign(shape,{formants:[300,650,2300,3400],voice:.85});
    return shape;
  }
  function validId(id){return typeof id==='string'&&/^[a-zA-Z_][a-zA-Z0-9_-]{0,31}$/.test(id)&&!['__proto__','prototype','constructor'].includes(id);}
  function validatePhone(value,id){
    if(!record(value)||!kindIds.has(value.kind))throw new Error('Фонема '+id+': неизвестный тип.');
    const vector=(key,min,max)=>{
      if(!Array.isArray(value[key])||value[key].length!==4)throw new Error('Фонема '+id+': '+key+' должен содержать четыре числа.');
      return value[key].map((item,index)=>{
        finite(item,id+'.'+key+'['+index+']');
        if(item<min||item>max)throw new Error('Фонема '+id+': '+key+' вне диапазона '+min+'…'+max+'.');
        return item;
      });
    };
    const level=key=>{const n=finite(value[key],id+'.'+key);if(n<0||n>3)throw new Error('Фонема '+id+': '+key+' вне диапазона 0…3.');return n;};
    return {kind:value.kind,formants:vector('formants',20,MAX_FREQUENCY),bandwidths:vector('bandwidths',20,MAX_BANDWIDTH),
      weights:vector('weights',0,4),voice:level('voice'),noise:level('noise')};
  }
  function resolveOverrides(phones){
    if(phones===undefined)return Object.create(null);
    if(!record(phones))throw new Error('Пользовательские фонемы должны быть объектом по идентификаторам.');
    const entries=Object.entries(phones);
    if(entries.length>128)throw new Error('Допускается не более 128 пользовательских фонем.');
    const result=Object.create(null);
    for(const [id,value] of entries){if(!validId(id))throw new Error('Некорректный идентификатор фонемы: '+id);result[id]=validatePhone(value,id);}
    return result;
  }
  function parseScore(value,settings,phones){
    let list=value;
    if(typeof value==='string'){
      if(value.length>8192)throw new Error('Слишком длинная запись партитуры.');
      list=value.trim()?value.trim().split(/\s+/).map(token=>{
        const match=/^([a-zA-Z_][a-zA-Z0-9_-]{0,31}):(\d+(?:\.\d+)?)$/.exec(token);
        if(!match)throw new Error('Неверный сегмент «'+token+'»: используйте id:миллисекунды.');
        return {id:match[1],duration:Number(match[2])/1000};
      }):[];
    }
    if(!Array.isArray(list)||!list.length||list.length>MAX_SEGMENTS)throw new Error('Партитура: от 1 до '+MAX_SEGMENTS+' сегментов.');
    let total=0;
    const score=list.map((item,index)=>{
      if(!record(item)||!validId(item.id))throw new Error('Сегмент '+(index+1)+': неверный идентификатор.');
      if(!knownPhones.has(item.id)&&!Object.hasOwn(phones,item.id))throw new Error('Неизвестная фонема: '+item.id+'. Добавьте её полное описание.');
      const duration=finite(item.duration,'Длительность сегмента '+(index+1));
      if(duration<=0)throw new Error('Длительность должна быть положительной.');
      const count=Math.round(duration/settings.speed*RATE);
      if(count<1)throw new Error('Сегмент '+(index+1)+' короче одного отсчёта при выбранной скорости.');
      total+=count;
      if(!Number.isSafeInteger(total)||total>MAX_SECONDS*RATE)throw new Error('После изменения скорости фраза не должна превышать '+MAX_SECONDS+' секунд.');
      return {id:item.id,duration};
    });
    return {score,total};
  }
  function sourceTable(harmonics){
    const source=new Float64Array(TABLE_SIZE);
    for(let n=0;n<TABLE_SIZE;n++)for(let h=1;h<=harmonics;h++)source[n]+=Math.sin(TAU*h*n/TABLE_SIZE)*Math.exp(-h/40)/h;
    return source;
  }
  function resonator(frequency,bandwidth){
    // H(z)=gain/(1-2r*cos(w)*z^-1+r²*z^-2), unit magnitude at w.
    const r=Math.exp(-Math.PI*bandwidth/RATE),w=TAU*frequency/RATE;
    const gain=(1-r)*Math.sqrt(Math.max(0,1-2*r*Math.cos(2*w)+r*r));
    return [gain,2*r*Math.cos(w),-r*r];
  }
  function render(request){
    if(!record(request))throw new Error('Не задан запрос синтеза.');
    const settings=normalize(request.settings),phones=resolveOverrides(request.phones);
    const {score,total}=parseScore(request.score,settings,phones);
    const dsp=root.VoiceProsodyDSP;
    const prosody=request.prosody===undefined?null:dsp.create(request.prosody,score.map(t=>Math.round(t.duration/settings.speed*RATE)),RATE,settings);
    const softenNoise=prosody?dsp.createConsonantNoise(RATE):null;
    const shapeFor=(token,index)=>{
      const nextVowel=score.slice(index+1).find(t=>Object.hasOwn(vowels,t.id))?.id||'e';
      const custom=Object.hasOwn(phones,token.id),target=custom?phones[token.id]:getPhone(token.id,nextVowel);
      const p=prosody&&!custom?prosody.speechPhone(token.id,target,index):target;
      return {...p,noise:prosody&&!custom?dsp.defaultSpeechNoise(p):p.noise,
        formants:p.formants.map(f=>clamp(f*settings.formantScale,20,MAX_FREQUENCY)),bandwidths:p.bandwidths.map(b=>clamp(b*settings.bandwidthScale,20,MAX_BANDWIDTH))};
    };
    const speechShapes=prosody?score.map(shapeFor):null;
    const sourceHarmonics=Math.min(60,Math.floor(RATE*.43/(prosody?prosody.maximumFrequency:Math.max(settings.pitchStart,settings.pitchEnd)+settings.vibratoDepth)));
    const source=sourceTable(sourceHarmonics),samples=new Float32Array(total);
    const states=Array.from({length:4},()=>[0,0]);
    // xorshift32 has an all-zero trap; explicit seed 0 uses state 1.
    let rng=settings.seed||1,phase=0,cursor=0,previousDC=0,previousOut=0,previousShape=null,peak=0;
    const resolvedPhones=[];
    for(let tokenIndex=0;tokenIndex<score.length;tokenIndex++){
      const token=score[tokenIndex],{id,duration}=token,count=Math.round(duration/settings.speed*RATE);
      const current=speechShapes?.[tokenIndex]||shapeFor(token,tokenIndex);
      const noiseConsonant=prosody&&dsp.isNoiseConsonant(current.kind);
      const nativeSpeech=prosody&&!Object.hasOwn(phones,id);
      const frication=nativeSpeech?prosody.fricationSource(id,current.kind):null;
      const stopRelease=nativeSpeech?prosody.stopRelease(id,current.kind,count,.62):null;
      resolvedPhones.push({id,...current,weights:[...current.weights]});
      if(!previousShape)previousShape=current;
      let coefficients=[];
      for(let index=0;index<count;index++){
        const progress=index/Math.max(1,count-1);
        const speech=prosody?prosody.at(cursor,tokenIndex):null,other=speech?speechShapes[speech.otherIndex]:null;
        // A pause has no vocal tract target. Fade at its edge instead of
        // pulling the neighbouring phoneme towards the silence recipe.
        const blend=speech&&current.kind!=='silence'&&other.kind!=='silence'?speech.blend:0;
        if(index%32===0){
          let transition=settings.transitionMs?Math.min(1,index/(RATE*settings.transitionMs/1000)):1;
          transition=transition*transition*(3-2*transition);
          coefficients=current.formants.map((f,k)=>resonator(previousShape.formants[k]*(1-transition)+f*transition,
            previousShape.bandwidths[k]*(1-transition)+current.bandwidths[k]*transition));
          if(speech)coefficients=current.formants.map((f,k)=>resonator(f+(other.formants[k]-f)*blend,
            current.bandwidths[k]+(other.bandwidths[k]-current.bandwidths[k])*blend));
        }
        let f0=settings.pitchStart+(settings.pitchEnd-settings.pitchStart)*cursor/Math.max(1,total)
          +settings.vibratoDepth*Math.sin(TAU*settings.vibratoRate*cursor/RATE);
        if(speech)f0=prosody.frequency(settings.pitchStart+(settings.pitchEnd-settings.pitchStart)*prosody.progress(cursor)
          +settings.vibratoDepth*Math.sin(TAU*settings.vibratoRate*cursor/RATE),speech);
        phase=(phase+f0/RATE)%1;
        const position=phase*TABLE_SIZE,sourceIndex=Math.floor(position),fraction=position-sourceIndex;
        const periodic=source[sourceIndex]*(1-fraction)+source[(sourceIndex+1)%TABLE_SIZE]*fraction;
        rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;rng>>>=0;
        const noise=rng/2147483648-1,softNoise=softenNoise?softenNoise(noise):noise;
        let voiced=current.voice*settings.voicing,noisy=current.noise*settings.noise;
        if(speech){voiced=(current.voice+(other.voice-current.voice)*blend)*settings.voicing;
          noisy=dsp.blendSpeechNoise(current,other,blend)*settings.noise;}
        if(current.kind==='stop'){
          if(stopRelease){
            voiced*=.22+.13*stopRelease.voiceOpening(index);
            noisy*=stopRelease.noiseEnvelope(index);
          }else if(progress<.62){voiced*=.22;noisy=0;}else{noisy*=Math.exp(-(progress-.62)*13);voiced*=.35;}
        }else if(current.kind==='affricate'){
          if(progress<.23){voiced*=.15;noisy=0;}else noisy*=Math.min(1,(progress-.23)/.06);
        }else if(current.kind==='trill')voiced*=.35+.65*(.5+.5*Math.cos(TAU*29*index/RATE))**2;
        const noiseSource=frication?frication(noise,progress):noiseConsonant?softNoise:noise;
        const excitation=periodic*voiced+noiseSource*noisy;
        let value=0;
        for(let k=0;k<4;k++){
          const [gain,feedback1,feedback2]=coefficients[k],[last,older]=states[k];
          const filtered=gain*excitation+feedback1*last+feedback2*older;
          states[k][0]=filtered;states[k][1]=last;value+=filtered*(speech?current.weights[k]+(other.weights[k]-current.weights[k])*blend:current.weights[k]);
        }
        if((current.kind==='fricative'||current.kind==='affricate')&&voiced)value+=.13*voiced*Math.sin(TAU*phase);
        let speechEdge=1;
        if(!speech)value*=Math.max(0,Math.min(1,index/(RATE*.004),(count-1-index)/(RATE*.005)));
        else{
          // Stops already have closure/release excitation above. A second
          // forced zero at every consonant edge cuts connected syllables.
          const attack=tokenIndex===0||speechShapes[tokenIndex-1].kind==='silence';
          const release=tokenIndex===score.length-1||speechShapes[tokenIndex+1].kind==='silence';
          value*=speech.gain;
          speechEdge=Math.max(0,Math.min(1,attack?index/(RATE*.004):1,release?(count-1-index)/(RATE*.005):1));
        }
        if(current.kind==='silence'){value=0;for(const state of states)state.fill(0);}
        const dcRemoved=value-previousDC+.995*previousOut;
        previousDC=value;previousOut=dcRemoved;
        const sample=current.kind==='silence'?0:dcRemoved*speechEdge;
        if(!Number.isFinite(sample)||Math.abs(sample)>1e30)throw new Error('Расчёт остановлен: неустойчивый или нечисловой отсчёт.');
        samples[cursor]=sample;peak=Math.max(peak,Math.abs(samples[cursor]));cursor++;
        if(speech&&current.kind==='silence'){previousDC=0;previousOut=0;}
      }
      previousShape=current;
    }
    const gain=settings.outputGain/Math.max(peak,1e-9),fade=Math.round(.008*RATE);
    for(let index=0;index<samples.length;index++){
      const value=samples[index]*gain*Math.min(1,index/fade,(samples.length-1-index)/fade);
      if(!Number.isFinite(value))throw new Error('Нечисловой отсчёт при нормализации.');
      samples[index]=clamp(value,-.9,.9);
    }
    prosody?.softenFrication(samples,resolvedPhones);
    return {samples,sampleRate:RATE,duration:samples.length/RATE,sampleCount:samples.length,settings,score,
      phones, resolvedPhones,seed:settings.seed,effectiveSeed:settings.seed||1,sourceHarmonics,engineVersion:VERSION,...(prosody?prosody.metadata():{})};
  }
  root.ZerkaliusVoice=Object.freeze({version:VERSION,defaults,parameters,phonemeIds,phoneLabels,kinds,getPhone,normalize,render,
    limits:Object.freeze({maxSegments:MAX_SEGMENTS,maxSeconds:MAX_SECONDS,maxPhones:128,sampleRate:RATE,
      minFrequency:20,maxFrequency:MAX_FREQUENCY,minBandwidth:20,maxBandwidth:MAX_BANDWIDTH,maxWeight:4,maxVoice:3,maxNoise:3})});
})(globalThis);
