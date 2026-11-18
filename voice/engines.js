/* ГОЛ-005: shared contract and registry. Load after the three engine scripts.
   Validation is shared; waveform generation stays inside each distinct engine. */
(function(root){
  'use strict';
  const Bank=root.ZerkaliusVoice;
  if(!Bank||!root.ZerkaliusRobotLiveFactory||!root.ZerkaliusDshFactory)throw Error('Не загружены все движки голоса.');
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const validId=id=>typeof id==='string'&&/^[a-zA-Z_][a-zA-Z0-9_-]{0,31}$/.test(id)&&!['__proto__','prototype','constructor'].includes(id);
  const kinds=Bank.kinds,kindIds=new Set(kinds.map(k=>k.id));
  const limits=Object.freeze({maxSegments:96,maxSeconds:12,maxPhones:128,minFrequency:20,maxFrequency:9922.5,
    minBandwidth:20,maxBandwidth:4000,maxWeight:4,maxVoice:3,maxNoise:3});
  function finite(value,label){if(typeof value!=='number'||!Number.isFinite(value))throw Error(label+': требуется конечное число.');return value;}
  function config(values,disabledParameters=[]){
    const defaults=Object.freeze({...Bank.defaults,...values});
    const parameters=Object.freeze(Bank.parameters.map(p=>Object.freeze({...p,
      label:p.key==='outputGain'?'Выходной уровень':p.label,default:defaults[p.key],disabled:disabledParameters.includes(p.key)})));
    function normalize(input={}){
      if(!record(input))throw Error('Настройки должны быть объектом.');
      const output={};
      for(const p of parameters){const value=input[p.key]===undefined?defaults[p.key]:finite(input[p.key],p.label);
        output[p.key]=p.disabled?defaults[p.key]:clamp(value,p.min,p.max);}
      output.seed=Math.trunc(output.seed)>>>0;return output;
    }
    return {defaults,parameters,normalize};
  }
  function validatePhone(value,id){
    if(!record(value)||!kindIds.has(value.kind))throw Error('Фонема '+id+': неверный тип.');
    const vector=(key,min,max)=>{
      if(!Array.isArray(value[key])||value[key].length!==4)throw Error('Фонема '+id+': нужны четыре числа '+key+'.');
      return value[key].map(n=>{finite(n,id+'.'+key);if(n<min||n>max)throw Error(id+'.'+key+': вне диапазона '+min+'…'+max);return n;});
    };
    const level=key=>{const n=finite(value[key],id+'.'+key);if(n<0||n>3)throw Error(id+'.'+key+': вне диапазона 0…3');return n;};
    return {kind:value.kind,formants:vector('formants',20,9922.5),bandwidths:vector('bandwidths',20,4000),
      weights:vector('weights',0,4),voice:level('voice'),noise:level('noise')};
  }
  function overrides(value={}){
    if(!record(value)||Object.keys(value).length>128)throw Error('Нужен объект не более 128 пользовательских фонем.');
    const output=Object.create(null);
    for(const [id,phone] of Object.entries(value)){if(!validId(id))throw Error('Недопустимый ID фонемы: '+id);output[id]=validatePhone(phone,id);}
    return output;
  }
  function parseScore(input,settings,phones,known,rate,tail=0){
    let list=input;
    if(typeof input==='string'){
      if(input.length>8192)throw Error('Слишком длинная партитура.');
      list=input.trim()?input.trim().split(/\s+/).map(token=>{
        const m=/^([a-zA-Z_][a-zA-Z0-9_-]{0,31}):(\d+(?:\.\d+)?)$/.exec(token);
        if(!m)throw Error('Неверный сегмент: '+token);return {id:m[1],duration:Number(m[2])/1000};
      }):[];
    }
    if(!Array.isArray(list)||!list.length||list.length>96)throw Error('Партитура: от 1 до 96 сегментов.');
    let total=0;const counts=[];
    const score=list.map((item,index)=>{
      if(!record(item)||!validId(item.id)||(!known.has(item.id)&&!Object.hasOwn(phones,item.id)))throw Error('Неизвестная фонема: '+item?.id);
      const duration=finite(item.duration,'Длительность '+(index+1)),count=Math.round(duration/settings.speed*rate);
      if(duration<=0||count<1)throw Error('Сегмент '+(index+1)+' должен длиться хотя бы один отсчёт.');
      total+=count;if(!Number.isSafeInteger(total)||total+tail>12*rate)throw Error('Фраза с хвостом не должна превышать 12 секунд после изменения скорости.');
      counts.push(count);return {id:item.id,duration};
    });
    return {score,counts,total};
  }
  function check(value){if(!Number.isFinite(value)||Math.abs(value)>1e30)throw Error('Синтез остановлен: нечисловой или неустойчивый отсчёт.');return value;}
  function scaled(phone,settings,rate,minFrequency=20){return {...phone,
    formants:phone.formants.map(f=>clamp(f*settings.formantScale,minFrequency,Math.min(9922.5,rate*.43))),
    bandwidths:phone.bandwidths.map(b=>clamp(b*settings.bandwidthScale,20,4000)),weights:[...phone.weights]};}
  const common=Object.freeze({Bank,clamp,record,finite,config,kinds,limits,overrides,parseScore,check,scaled,
    phonemeIds:Bank.phonemeIds,phoneLabels:Bank.phoneLabels});
  const bank=Object.freeze({...Bank,engineId:'bank',label:'Банк Зеркалиуса · четыре форманты',
    parameters:Object.freeze(Bank.parameters.map(p=>Object.freeze({...p,label:p.key==='outputGain'?'Выходной уровень':p.label}))),
    capabilities:Object.freeze({formantCount:4,disabledParameters:[],sampleRate:22050,prosodyVersion:1,outputGainMeaning:'Пик всей фразы до конечного затухания.',
      note:'Исходная браузерная адаптация банка. Старые рецепты v1 относятся к этому движку.'}),
    render(request){return {...Bank.render(request),engineId:'bank',engineVersion:Bank.version,legacyExact:false};}});
  const robot=root.ZerkaliusRobotLiveFactory(common),dsh=root.ZerkaliusDshFactory(common);
  const entries=Object.freeze({robot,bank,dsh});
  root.VoiceEngines=Object.freeze({defaultId:'robot',
    list:Object.freeze(['robot','bank','dsh'].map(id=>{const e=entries[id];return Object.freeze({id,engineId:id,label:e.label,version:e.version,capabilities:e.capabilities});})),
    get(id){if(typeof id!=='string'||!Object.hasOwn(entries,id))throw Error('Неизвестный движок: '+id);return entries[id];}});
})(globalThis);
