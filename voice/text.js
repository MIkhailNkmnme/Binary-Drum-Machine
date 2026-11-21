/* Text is expanded into our alphabet recipes, not a general language model. */
(function(root){
  'use strict';
  const MAX_CHARS=1200,MAX_SECONDS=240;
  const pairedConsonants='БВГДЗКЛМНПРСТФХ';
  const softenable=new Set(pairedConsonants);
  const consonants=new Set(Array.from('БВГДЖЗКЛМНПРСТФХЦЧШЩ'));
  const shortConsonants=new Set('БГДКПТЦЧ');
  const russianVowels=new Set('АЕЁИОУЫЭЮЯ');
  const MAX_HOLD_SECONDS=1.5;
  const softNext=new Set(Array.from('ЕЁЮЯИЬ'));
  const iotated=new Set(Array.from('ЕЁЮЯ'));
  function takeLetter(names,letters,index){
    // Consume a kana combination or a base letter with combining accents as one sign.
    for(let size=Math.min(3,letters.length-index);size>0;size--){
      const symbol=letters.slice(index,index+size).join('').normalize('NFC').toLowerCase();
      const recipe=names.get(symbol);
      if(recipe)return {recipe,size};
    }
    return null;
  }
  function plan({text,language,catalog,engine,settings,phones,prosody,spell=false}){
    const counting=root.VoiceDigits?.supports(language);
    if(typeof text!=='string'||!(['ru','en','de'].includes(language)||counting))throw Error('Выберите доступный язык чтения.');
    const raw=Array.from(text),rate=engine.limits.sampleRate,tail=engine.engineId==='robot'?Math.round(.018*rate):0;
    if(!raw.length||raw.length>MAX_CHARS)throw Error('Текст: от 1 до '+MAX_CHARS+' символов.');
    const prepared=root.VoiceProsody.prepare(text,language,prosody,spell),letters=prepared.letters;
    const wordStarts=new Map(prepared.words.map(word=>[word.start,word]));
    const names=spell?new Map(catalog.filter(r=>r.lang===language&&r.kind==='name')
      .map(r=>[r.symbol.normalize('NFC').toLowerCase(),r])):null;
    const sounds=new Map(catalog.filter(r=>r.lang===language&&r.kind==='sound').map(r=>[r.symbol.toUpperCase(),r]));
    const digits=new Map(catalog.filter(r=>r.lang===(language==='de'?'de':'ru')&&r.kind==='digit').map(r=>[r.symbol,r]));
    const characters=prepared.characters;let units=[],sounding=false;
    for(let index=0;index<letters.length;index++){
      const char=letters[index],upper=char.toUpperCase(),start=characters[prepared.rawIndices[index]].start;
      let score=[],boundary=false,length=1,english=null,counted=null,spoken=null,separate=false;
      if(/\s/u.test(char)){score=[{id:'_',duration:.10}];boundary=true;}
      else if(/[.,!?;:…—–\-()«»„“”‚‘’"']/u.test(char)||(counting&&/[、。]/u.test(char))){score=[{id:'_',duration:/[.!?…。]/u.test(char) ? 0.28 : /[,;:、]/u.test(char) ? 0.16 : 0.08}];boundary=true;}
      else if(names){
        const digit=/^[0-9]$/.test(char),word=wordStarts.get(index);
        if(counting&&(digit||!spell&&word))counted=root.VoiceDigits.read(language,digit?char:word.word);
        let recipe=counted;
        if(digit){
          recipe??=language==='en'?root.VoiceEnglish.take(letters,index):digits.get(char);
        }else if(counted){
          length=word.end-index;
          word.source='count-word';
        }else{
          const entry=takeLetter(names,letters,index);
          if(entry){recipe=entry.recipe;length=entry.size;}
          if(word){word.source='letter-name';word.stressIndex=null;}
        }
        if(!recipe)throw Error('Символ «'+char+'» в позиции '+(start+1)+' не поддерживается в '+language.toUpperCase()+'.');
        score=recipe.score.map(token=>({...token}));
        separate=true;
        sounding=true;
      }
      else if(counting){
        const digit=/^[0-9]$/.test(char),word=wordStarts.get(index);
        counted=digit?root.VoiceDigits.read(language,char):word&&word.source!=='manual'?root.VoiceDigits.read(language,word.word):null;
        if(counted){
          score=counted.score.map(token=>({...token}));
          length=digit?1:word.end-index;
          if(word)word.source='count-word';
        }else{
          spoken=root.VoiceLanguages.take(language,letters,index);
          if(!spoken)throw Error('Символ «'+char+'» в позиции '+(start+1)+' не поддерживается в '+language.toUpperCase()+'.');
          score=spoken.score.map(token=>({...token}));length=spoken.length;
          if(word&&word.source!=='manual'){
            word.source=language+'-'+spoken.source;
            word.stressIndex=spoken.stressIndex===null?null:prepared.rawIndices[spoken.stressIndex];
          }
        }
        if(score.some(token=>token.id!=='_'))sounding=true;
      }
      else{
        const german=language==='de'?root.VoiceGerman.take(letters,index):null;
        english=language==='en'?root.VoiceEnglish.take(letters,index):null;
        const recipe=language==='en'?(english?{kind:'sound',score:english.score}:null):language==='de'?(german?{kind:'sound',score:german.score}:null):digits.get(char)||sounds.get(upper);
        if(!recipe)throw Error('Символ «'+char+'» в позиции '+(start+1)+' не поддерживается в '+language.toUpperCase()+'.');
        if(german)length=german.length;
        if(english){
          length=english.length;
          const word=prepared.words.find(w=>index>=w.start&&index<w.end);
          if(word&&word.source!=='manual'){
            word.source=english.source==='digit'?'catalog':'en-'+english.source;
            word.stressIndex=english.source==='digit'||english.stressIndex===null?null:prepared.rawIndices[index+english.stressIndex];
          }
        }
        score=recipe.score.map(t=>({...t}));
        if(language==='ru'&&recipe.kind==='sound'){
          const previous=letters[index-1]?.toUpperCase();
          const vowel=russianVowels.has(upper);
          const isSound=vowel||upper==='Й'||consonants.has(upper);
          if(isSound&&score.length&&score.every(token=>!Object.hasOwn(phones??{},token.id))){
            let end=index+1;
            while(letters[end]?.toUpperCase()===upper)end++;
            const next=letters[end]?.toUpperCase();
            const softId=score[0].id+'j';
            const customSoft=softenable.has(upper)&&softNext.has(next)&&Object.hasOwn(phones??{},softId);
            // Preserve ordinary doubled vowels, such as the "оо" in "кооперация".
            if(!customSoft&&end-index>=(vowel?3:2))length=end-index;
          }
          const next=letters[index+length]?.toUpperCase();
          if(iotated.has(upper)&&consonants.has(previous)&&score[0]?.id==='j')score.shift();
          if(softenable.has(upper)&&softNext.has(next)&&score[0]){
            const id=score[0].id+'j';if(engine.phonemeIds.includes(id))score[0].id=id;
          }
          if(length>1&&!shortConsonants.has(upper)){
            // For an iotated vowel, keep the initial j short and sustain its vowel.
            const held=score.at(-1);
            held.duration=Math.min(MAX_HOLD_SECONDS,held.duration*length);
          }
        }
        if(score.some(t=>t.id!=='_'))sounding=true;
      }
      const cleanIndices=Array.from({length},(_,i)=>index+i),indices=cleanIndices.map(i=>prepared.rawIndices[i]);
      units.push({index:indices[0],indices,cleanIndices,score,boundary,separate,
        ...(english?{stressTokens:english.stressTokens,tokenLetters:english.tokenLetters.map(i=>index+i)}:spoken?{stressTokens:spoken.stressTokens,tokenLetters:spoken.tokenLetters}:counted?{stressTokens:counted.stressTokens}:{})});
      index+=length-1;
    }
    for(const index of prepared.markers)units.push({index,indices:[index],cleanIndices:[],score:[],boundary:false});units.sort((a,b)=>a.index-b.index);
    const wholeScore=units.flatMap(u=>u.score);
    let effectivePhones=root.VoiceGerman?root.VoiceGerman.resolve(engine,phones,wholeScore):phones;
    if(root.VoiceEnglish)effectivePhones=root.VoiceEnglish.resolve(engine,effectivePhones,wholeScore);
    if(counting)effectivePhones=root.VoiceLanguages.resolve(engine,effectivePhones,wholeScore);
    for(const unit of units)for(const token of unit.score)if(!engine.phonemeIds.includes(token.id)&&!Object.hasOwn(effectivePhones,token.id))throw Error('Движок не поддерживает токен '+token.id+'.');
    for(const unit of units)if(unit.tokenLetters){
      const marked=unit.cleanIndices.filter(i=>prepared.stressed.has(i));
      if(marked.length){
        unit.stressTokens=unit.score.flatMap((t,j)=>marked.includes(unit.tokenLetters[j])&&(effectivePhones[t.id]||engine.getPhone(t.id)).kind==='vowel'?[j]:[]);
        if(!unit.stressTokens.length)throw Error('Метка ударения попала на букву без отдельного гласного звука. Поставьте её перед произносимой гласной.');
      }
    }
    if(!sounding)throw Error('В тексте нет звучащих букв или цифр. Немые знаки и паузы не зацикливаются отдельно.');
    const annotation=root.VoiceProsody.apply(units,prepared,language,engine,effectivePhones,settings,spell);units=annotation.units;
    // Keep each word together. Separators belong to the preceding word; a
    // leading separator stays with the first word. No per-letter DSP restart.
    const words=[];let word=[];
    for(const unit of units){word.push(unit);if(unit.boundary||unit.separate){if(word.some(u=>!u.boundary)){words.push(word);word=[];}else if(words.length){words[words.length-1].push(...word);word=[];}}}
    if(word.length)words.push(word);
    const chunks=[];let chunk={score:[],marks:[],prosodySegments:[]},count=0,totalSamples=0;
    const duration=score=>score.reduce((sum,t)=>sum+Math.round(t.duration/settings.speed*rate),0);
    function finish(){if(!chunk.score.length)return;totalSamples+=count+tail;chunks.push(chunk);chunk={score:[],marks:[],prosodySegments:[]};count=0;}
    for(const group of words){
      const tokens=group.flatMap(u=>u.score),samples=duration(tokens);
      if(tokens.length>engine.limits.maxSegments||samples+tail>engine.limits.maxSeconds*rate)throw Error('Одно слово превышает лимит '+engine.limits.maxSegments+' сегментов или '+engine.limits.maxSeconds+' секунд. Увеличьте скорость или сократите слово.');
      if(chunk.score.length&&(chunk.score.length+tokens.length>engine.limits.maxSegments||count+samples+tail>engine.limits.maxSeconds*rate))finish();
      for(const unit of group){const from=chunk.score.length;chunk.score.push(...unit.score);if(unit.prosody)chunk.prosodySegments.push(...unit.prosody);chunk.marks.push({index:unit.index,indices:unit.indices,from,to:chunk.score.length});}
      count+=samples;
    }
    finish();
    if(totalSamples>MAX_SECONDS*rate)throw Error('Один круг текста превышает '+MAX_SECONDS+' секунд с текущей скоростью. Сократите текст или увеличьте скорость.');
    const spokenTotal=chunks.reduce((sum,c)=>sum+duration(c.score),0);let consumed=0;
    for(const part of chunks){
      const samples=duration(part.score);
      if(annotation.config.mode==='speech')part.prosody={version:1,segments:part.prosodySegments,transitionMs:annotation.config.transitionMs,
        rangeStart:consumed/spokenTotal,rangeEnd:(consumed+samples)/spokenTotal,...(language==='ru'?{articulatedFrication:true,smoothStopRelease:true,bandLimitedZ:true}:{})};
      consumed+=samples;delete part.prosodySegments;
    }
    return {characters,chunks,language,rate,phones:effectivePhones,prosody:{version:root.VoiceProsody.version,config:annotation.config,words:annotation.words,note:annotation.note}};
  }
  function tokenBoundaries(result){
    if(Array.isArray(result.segmentBoundaries)&&result.segmentBoundaries.length===result.score.length)return [0,...result.segmentBoundaries.map(s=>s.endSample)];
    const boundaries=[0];let seconds=0,count=0;
    for(const token of result.score){seconds+=token.duration;count=result.legacyExact?Math.ceil(seconds/result.settings.speed*result.sampleRate):count+Math.round(token.duration/result.settings.speed*result.sampleRate);boundaries.push(count);}
    return boundaries;
  }
  root.VoiceText=Object.freeze({plan,tokenBoundaries,maxCharacters:MAX_CHARS,maxSeconds:MAX_SECONDS,pairedConsonants});
})(globalThis);
