/* ГОЛ-007. Explicit stress, a small declared dictionary and bounded contours.
   No speech model, recordings or automatic judgement of intelligibility. */
(function(root){
  'use strict';
  const version='text-prosody-v1.0.0';
  const defaults=Object.freeze({mode:'speech',expressiveness:55,contour:'auto',transitionMs:20});
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function normalize(value={}){
    const number=(key,min,max)=>{const n=Number(value[key]??defaults[key]);if(!Number.isFinite(n))throw Error('Неверная настройка просодии: '+key);return clamp(n,min,max);};
    return {mode:value.mode==='original'?'original':'speech',expressiveness:number('expressiveness',0,100),contour:['auto','flat','question','statement'].includes(value.contour)?value.contour:'auto',transitionMs:number('transitionMs',0,80)};
  }
  const vowels={ru:new Set(Array.from('аеёиоуыэюя')),de:new Set(Array.from('aeiouyäöü')),en:new Set(Array.from('aeiouy'))};
  const dictionary={ru:new Map(),de:new Map()};
  const patterns={
    ru:['прив+ет','м+ир','г+олос','т+екст','б+уква','б+уквы','спас+ибо','пож+алуйста','здр+авствуйте','хорош+о','сег+одня','+это','р+обот','н+овый','пр+осто','сл+ово','од+ин','н+оль','дв+а','тр+и','чет+ыре','п+ять','ш+есть','с+емь','в+осемь','д+евять'],
    de:['hall+o','sch+ön','+ich','h+eiße','g+uten','t+ag','d+anke','b+itte','w+elt','st+imme','spr+ache','+eins','zw+ei','dr+ei','v+ier','f+ünf','s+echs','s+ieben','+acht','n+eun','n+ull','gr+üße','+über','b+ücher']
  };
  for(const language of ['ru','de'])for(const pattern of patterns[language]){const chars=Array.from(pattern),stress=chars.indexOf('+');dictionary[language].set(chars.filter(c=>c!=='+').join(''),stress);}
  const isWord=c=>!!c&&/^[a-zа-яёäöüß0-9]$/iu.test(c);
  function prepare(text,language,options){
    const config=normalize(options),raw=Array.from(text),letters=[],rawIndices=[],markers=[],manual=new Map(),characters=[];let offset=0;
    for(const char of raw){characters.push({text:char,start:offset,end:offset+char.length});offset+=char.length;}
    const isVowel=c=>vowels[language]?.has(c?.toLowerCase());
    for(let i=0;i<raw.length;i++){
      const char=raw[i];
      if(char==='+'){
        if(!isVowel(raw[i+1]))throw Error('Метка + ставится непосредственно перед гласной: зам+ок или з+амок.');
        if(manual.has(letters.length))throw Error('Повторная метка ударения у одной гласной.');manual.set(letters.length,true);markers.push(i);continue;
      }
      if(char==='\u0301'){
        const at=letters.length-1;if(!isVowel(letters[at])||rawIndices[at]!==i-1)throw Error('Знак ударения ставится сразу после гласной.');
        if(manual.has(at))throw Error('Повторная метка ударения у одной гласной.');manual.set(at,true);markers.push(i);continue;
      }
      rawIndices.push(i);letters.push(char);
    }
    const words=[],stressed=new Set();let start=0;
    while(start<letters.length){
      if(!isWord(letters[start])){start++;continue;}let end=start+1;while(end<letters.length&&isWord(letters[end]))end++;
      const chars=letters.slice(start,end),word=chars.join(''),lower=word.toLowerCase(),explicit=[];for(let j=start;j<end;j++)if(manual.has(j))explicit.push(j);
      if(explicit.length>1)throw Error('В слове «'+word+'» допускается одна явная ударная гласная.');
      let at=null,source='unknown';
      if(explicit.length){at=explicit[0];source='manual';}
      else if(language==='ru'&&chars.filter(c=>c.toLowerCase()==='ё').length===1){at=start+chars.findIndex(c=>c.toLowerCase()==='ё');source='yo';}
      else if(dictionary[language]?.has(lower)){at=start+dictionary[language].get(lower);source='dict';}
      else if(/^\d+$/.test(word))source='catalog';
      else if(language==='en')source='names';
      if(at!==null)stressed.add(at);
      words.push({word,start,end,source,stressIndex:at===null?null:rawIndices[at],rawStart:rawIndices[start],rawEnd:rawIndices[end-1]+1});start=end;
    }
    return {config,letters,rawIndices,markers,characters,words,stressed};
  }
  const digitStress={ru:[[1],[2],[2],[2],[3],[2],[1],[1],[1],[1]],de:[[1],[0,1],[2,3],[2,3],[1],[1],[1],[1],[0],[1,2]]};
  function apply(units,prepared,language,engine,phones,settings){
    const config=prepared.config,amount=config.expressiveness/100;
    if(config.mode==='original')return {units,config,words:prepared.words,note:'Исходные длительности и путь DSP; метки ударения сами не звучат.'};
    const kind=id=>(phones[id]||engine.getPhone(id)).kind;
    const result=units.map(u=>({...u,score:u.score.map(t=>({...t})),prosody:[],kinds:u.score.map(t=>kind(t.id))}));
    const wordFor=index=>prepared.words.find(w=>index>=w.start&&index<w.end);
    for(const unit of result){
      const word=wordFor(unit.cleanIndices?.[0]),marked=(unit.cleanIndices||[]).some(i=>prepared.stressed.has(i));
      const char=prepared.letters[unit.cleanIndices?.[0]],numeric=/^[0-9]$/.test(char||''),numericStress=numeric?digitStress[language==='de'?'de':'ru'][Number(char)]:[];
      unit.stresses=[];
      for(let j=0;j<unit.score.length;j++){
        const token=unit.score[j],k=unit.kinds[j],stress=k==='vowel'&&(marked||numericStress.includes(j));unit.stresses.push(stress);
        const factor={vowel:.72,stop:.80,affricate:.82,fricative:.80,sonorant:.82,trill:.82,rhotic:.82,silence:1}[k]||1;
        if(k==='silence'){
          const punctuation=unit.indices.map(i=>prepared.characters[i]?.text||'').join('');token.duration=/[.!?…]/u.test(punctuation) ? .24+.10*amount : /[,;:]/u.test(punctuation) ? .12+.05*amount : /\s/u.test(punctuation) ? .07 : .06;
        }else token.duration*=factor*(stress ? 1.25+.20*amount : k==='vowel'&&word&&word.source!=='unknown' ? .93 : 1);
        token.duration=Number(Math.max(.01,token.duration).toFixed(6));
      }
    }
    // Determine phrase boundaries before packing into 12-second worker chunks.
    const phrases=[];let phrase=[];
    for(const unit of result){phrase.push(unit);if(unit.indices.some(i=>/[.!?…]/u.test(prepared.characters[i]?.text||''))){phrases.push(phrase);phrase=[];}}
    if(phrase.length)phrases.push(phrase);
    const contourValue=(type,t)=>type==='flat'?0:type==='question'?amount*(.3-.6*t+4*Math.max(0,(t-.65)/.35)):amount*(.9-3.1*t);
    for(const group of phrases){
      const punctuation=group.flatMap(u=>u.indices).map(i=>prepared.characters[i]?.text||'').join(''),type=config.contour==='auto'?(punctuation.includes('?')?'question':'statement'):config.contour;
      let final=null;for(const u of group)for(let j=0;j<u.score.length;j++)if(u.kinds[j]==='vowel')final=[u,j];
      if(final){const [u,j]=final;u.score[j].duration=Number((u.score[j].duration*(1.10+.10*amount)).toFixed(6));}
      let total=0,running=0;for(const u of group)for(let j=0;j<u.score.length;j++){running+=Math.round(u.score[j].duration/settings.speed*engine.limits.sampleRate);if(u.kinds[j]!=='silence')total=running;}
      // Progress is computed globally per phrase with the actual rounded counts.
      let elapsed=0;
      for(const u of group)for(let j=0;j<u.score.length;j++){
        const token=u.score[j],count=Math.round(token.duration/settings.speed*engine.limits.sampleRate),from=total?Math.min(1,elapsed/total):0,to=total?Math.min(1,(elapsed+count)/total):1,k=u.kinds[j],stress=u.stresses[j];
        const accent=config.contour==='flat'?0:stress?1.5*amount:0;
        u.prosody.push({pitchStartSemitones:clamp(contourValue(type,from)+accent,-12,12),pitchEndSemitones:clamp(contourValue(type,to)+accent*.35,-12,12),gain:k==='silence'?0:stress?1+.18*amount:k==='fricative' ? .96 : 1});elapsed+=count;
      }
    }
    const unknown=prepared.words.filter(w=>w.source==='unknown').map(w=>w.word),unique=[...new Set(unknown)];
    return {units:result,config,words:prepared.words,note:unique.length?'Без автоматического ударения: '+unique.slice(0,8).join(', ')+(unique.length>8?' … ('+unique.length+' слов)':'')+'. Эти слова читаются нейтрально.':'Ударения: явные метки, ё или небольшой открытый словарь. EN остаётся чтением названий букв.'};
  }
  root.VoiceProsody=Object.freeze({version,defaults,normalize,prepare,apply});
})(globalThis);
