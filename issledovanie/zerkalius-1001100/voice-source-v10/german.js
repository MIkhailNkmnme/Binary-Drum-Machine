/* ГОЛ-006. Hand-designed phoneme goals and letter rules; no recorded input.
   The numbers are synthesis choices, not measured German reference speech. */
(function(root){
  'use strict';
  const version='german-recipes-v1.0.0',copy=v=>JSON.parse(JSON.stringify(v));
  const parse=text=>text.split(' ').map(t=>{const [id,ms]=t.split(':');return {id,duration:Number(ms)/1000};});
  const vowel=(f,b,w)=>({kind:'vowel',formants:f,bandwidths:b,weights:w,voice:1,noise:.012});
  const fricative=(f,b,w,noise)=>({kind:'fricative',formants:f,bandwidths:b,weights:w,voice:0,noise});
  const targets={
    bank:{
      de_ae:vowel([610,1750,2500,3500],[100,130,190,260],[1,1.1,.45,.15]),
      de_oe:vowel([420,1450,2250,3300],[85,120,180,250],[1,1,.45,.16]),
      de_ue:vowel([280,1750,2300,3300],[70,120,180,250],[1,1.2,.55,.18]),
      de_ich:fricative([2300,3600,5000,7000],[700,900,1300,1600],[.45,1,.75,.35],.85),
      de_ach:fricative([800,1400,2500,4000],[500,700,1000,1400],[.45,1,.55,.2],.9)
    },
    robot:{
      de_ae:vowel([600,1700,2450,3400],[100,140,210,280],[1,.95,.4,.15]),
      de_oe:vowel([430,1400,2200,3250],[90,130,200,260],[1,.95,.42,.15]),
      de_ue:vowel([300,1700,2250,3300],[75,130,200,260],[1,1.1,.5,.16]),
      de_ich:fricative([2400,3700,5100,7100],[750,950,1400,1700],[.45,1,.7,.3],.8),
      de_ach:fricative([850,1450,2600,4100],[550,750,1100,1500],[.5,1,.55,.2],.85)
    },
    dsh:{
      de_ae:vowel([600,1720,2500,3500],[100,140,200,260],[1,1.05,.45,0]),
      de_oe:vowel([420,1420,2250,3300],[90,130,190,250],[1,1,.5,0]),
      de_ue:vowel([285,1750,2350,3400],[75,125,190,250],[1,1.2,.6,0]),
      de_ich:fricative([2400,3700,5200,7000],[750,1000,1400,1600],[.5,1,.8,0],.85),
      de_ach:fricative([850,1450,2600,4000],[550,750,1100,1400],[.5,1,.6,0],.9)
    }
  };
  const phoneLabels={de_ae:'DE · ä, передний гласный',de_oe:'DE · ö, передний округлённый гласный',de_ue:'DE · ü, передний округлённый гласный',de_ich:'DE · ich-Laut [ç]',de_ach:'DE · ach-Laut [x]'};
  function getPhone(engineId,id){return Object.hasOwn(targets,engineId)&&Object.hasOwn(targets[engineId],id)?copy(targets[engineId][id]):undefined;}
  function resolve(engine,overrides,score){
    if(!Object.hasOwn(targets,engine.engineId))throw Error('Нет немецкого профиля движка '+engine.engineId+'.');
    const out={};for(const token of score)if(Object.hasOwn(targets[engine.engineId],token.id))out[token.id]=getPhone(engine.engineId,token.id);
    for(const [id,p]of Object.entries(overrides||{}))Object.defineProperty(out,id,{value:copy(p),enumerable:true,writable:true,configurable:true});
    if(Object.keys(out).length>engine.limits.maxPhones)throw Error('Немецкие цели и пользовательские фонемы превышают лимит '+engine.limits.maxPhones+'. Удалите ненужные замены.');
    return out;
  }
  const soundRows=[
    ['A','a','a:300'],['B','b','b:110'],['C','k / ts','k:110'],['D','d','d:110'],['E','e','e:280'],['F','f','f:190'],['G','g','g:110'],['H','h','h:170'],
    ['I','i','i:300'],['J','j','j:100'],['K','k','k:110'],['L','l','l:180'],['M','m','m:180'],['N','n','n:180'],['O','o','o:300'],['P','p','p:110'],
    ['Q','kv','k:100 v:140'],['R','r','r:180'],['S','s / z','s:190'],['T','t','t:110'],['U','u','u:300'],['V','f','f:190'],['W','v','v:180'],
    ['X','ks','k:100 s:170'],['Y','ü, приближённо','de_ue:280'],['Z','ts','ts:180'],['Ä','ä','de_ae:300'],['Ö','ö','de_oe:300'],['Ü','ü','de_ue:300'],['ß','s','s:220'],['ẞ','s','s:220']
  ];
  const nameRows=[
    ['A','A','a:320'],['B','Be','b:90 e:300'],['C','Ce','ts:120 e:300'],['D','De','d:90 e:300'],['E','E','e:320'],['F','Eff','e:190 f:180'],['G','Ge','g:90 e:300'],['H','Ha','h:100 a:300'],
    ['I','I','i:320'],['J','Jot','j:90 o:200 t:90'],['K','Ka','k:100 a:300'],['L','Ell','e:190 l:170'],['M','Emm','e:190 m:170'],['N','Enn','e:190 n:170'],['O','O','o:320'],['P','Pe','p:90 e:300'],
    ['Q','Ku','k:100 u:300'],['R','Err','e:190 r:180'],['S','Ess','e:190 s:190'],['T','Te','t:90 e:300'],['U','U','u:320'],['V','Vau','f:100 a:180 u:120'],['W','We','v:130 e:300'],
    ['X','Iks','i:150 k:90 s:170'],['Y','Ypsilon','de_ue:150 p:80 s:130 i:140 l:80 o:160 n:100'],['Z','Zett','ts:150 e:160 t:100'],
    ['Ä','Ä','de_ae:320'],['Ö','Ö','de_oe:320'],['Ü','Ü','de_ue:320'],['ß','Eszett','e:180 s:120 ts:100 e:180 t:80'],['ẞ','Eszett','e:180 s:120 ts:100 e:180 t:80']
  ];
  const digitRows=[
    ['0','null','n:100 u:220 l:140'],['1','eins','a:120 i:130 n:120 s:130'],['2','zwei','ts:120 v:120 a:120 i:130'],['3','drei','d:90 r:100 a:120 i:130'],['4','vier','f:140 i:280 r:100'],
    ['5','fünf','f:120 de_ue:200 n:100 f:120'],['6','sechs','z:130 e:200 k:90 s:120'],['7','sieben','z:130 i:280 b:80 ax:100 n:120'],['8','acht','a:220 de_ach:150 t:90'],['9','neun','n:120 o:130 de_ue:140 n:120']
  ];
  const rows=(values,kind)=>values.map(([symbol,label,text])=>Object.freeze({id:'de-'+kind+'-'+symbol.codePointAt(0).toString(16),lang:'de',kind,symbol,label,score:Object.freeze(parse(text).map(Object.freeze)),germanVersion:version}));
  const catalog=Object.freeze([...rows(soundRows,'sound'),...rows(nameRows,'name'),...rows(digitRows,'digit')]);
  const sounds=new Map(soundRows.map(([s,,text])=>[s.toLowerCase(),parse(text)])),digits=new Map(digitRows.map(([s,,text])=>[s,parse(text)]));
  const isLetter=c=>!!c&&/^[a-zäöüß]$/iu.test(c),vowels=new Set(Array.from('aeiouyäöü'));
  function take(chars,index){
    const lower=chars.map(c=>c.toLowerCase()),c=lower[index],rest=lower.slice(index,index+4).join(''),previous=lower[index-1];
    const match=(length,text)=>({length,score:parse(text)});
    if(digits.has(c))return {length:1,score:copy(digits.get(c))};
    if(rest.startsWith('tsch'))return match(4,'ch:220');
    if(rest.startsWith('sch'))return match(3,'sh:220');
    if(rest.startsWith('chs'))return match(3,'k:100 s:180');
    if(rest.startsWith('ch')){const pair=lower.slice(Math.max(0,index-2),index).join('');return match(2,!['eu','äu'].includes(pair)&&['a','o','u'].includes(previous)?'de_ach:200':'de_ich:200');}
    if(rest.startsWith('ei')||rest.startsWith('ai'))return match(2,'a:150 i:150');
    if(rest.startsWith('ie'))return match(2,'i:350');
    if(rest.startsWith('eu')||rest.startsWith('äu'))return match(2,'o:150 de_ue:150');
    if(rest.startsWith('au'))return match(2,'a:150 u:150');
    if(rest.startsWith('qu'))return match(2,'k:100 v:150');
    if(rest.startsWith('ph'))return match(2,'f:200');
    if(rest.startsWith('ck'))return match(2,'k:120');
    if(rest.startsWith('ss'))return match(2,'s:230');
    if(!isLetter(previous)&&(rest.startsWith('sp')||rest.startsWith('st')))return match(2,rest.startsWith('sp')?'sh:150 p:110':'sh:150 t:110');
    if(c==='c')return match(1,vowels.has(lower[index+1])&&['e','i','y','ä','ö','ü'].includes(lower[index+1])?'ts:180':'k:110');
    if(c==='s'&&vowels.has(lower[index+1])&&(!isLetter(previous)||vowels.has(previous)))return match(1,'z:180');
    if(!sounds.has(c))return null;return {length:1,score:copy(sounds.get(c))};
  }
  root.VoiceGerman=Object.freeze({version,catalog,phoneIds:Object.freeze(Object.keys(phoneLabels)),phoneLabels:Object.freeze(phoneLabels),getPhone,resolve,take});
})(globalThis);
