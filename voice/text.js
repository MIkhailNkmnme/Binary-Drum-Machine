/* Text is expanded into our alphabet recipes, not a general language model. */
(function(root){
  'use strict';
  const MAX_CHARS=1200,MAX_SECONDS=240;
  const softenable=new Set(Array.from('БВГДЗКЛМНПРСТФХ'));
  const consonants=new Set(Array.from('БВГДЖЗКЛМНПРСТФХЦЧШЩ'));
  const softNext=new Set(Array.from('ЕЁЮЯИЬ'));
  const iotated=new Set(Array.from('ЕЁЮЯ'));
  function plan({text,language,catalog,engine,settings,phones,prosody}){
    if(typeof text!=='string'||!['ru','en','de'].includes(language))throw Error('Выберите RU, EN или DE для текстового чтения.');
    const raw=Array.from(text),rate=engine.limits.sampleRate,tail=engine.engineId==='robot'?Math.round(.018*rate):0;
    if(!raw.length||raw.length>MAX_CHARS)throw Error('Текст: от 1 до '+MAX_CHARS+' символов.');
    const prepared=root.VoiceProsody.prepare(text,language,prosody),letters=prepared.letters;
    const sounds=new Map(catalog.filter(r=>r.lang===language&&r.kind==='sound').map(r=>[r.symbol.toUpperCase(),r]));
    const digits=new Map(catalog.filter(r=>r.lang===(language==='de'?'de':'ru')&&r.kind==='digit').map(r=>[r.symbol,r]));
    const characters=prepared.characters;let units=[],sounding=false;
    for(let index=0;index<letters.length;index++){
      const char=letters[index],upper=char.toUpperCase(),start=characters[prepared.rawIndices[index]].start;
      let score=[],boundary=false,length=1,english=null;
      if(/\s/u.test(char)){score=[{id:'_',duration:.10}];boundary=true;}
      else if(/[.,!?;:…—–\-()«»„“”‚‘’"']/u.test(char)){score=[{id:'_',duration:/[.!?…]/u.test(char) ? 0.28 : /[,;:]/u.test(char) ? 0.16 : 0.08}];boundary=true;}
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
          const previous=letters[index-1]?.toUpperCase(),next=letters[index+1]?.toUpperCase();
          if(iotated.has(upper)&&consonants.has(previous)&&score[0]?.id==='j')score.shift();
          if(softenable.has(upper)&&softNext.has(next)&&score[0]){
            const id=score[0].id+'j';if(engine.phonemeIds.includes(id))score[0].id=id;
          }
        }
        if(score.some(t=>t.id!=='_'))sounding=true;
      }
      const cleanIndices=Array.from({length},(_,i)=>index+i),indices=cleanIndices.map(i=>prepared.rawIndices[i]);
      units.push({index:indices[0],indices,cleanIndices,score,boundary,...(english?{enStressTokens:english.stressTokens,tokenLetters:english.tokenLetters.map(i=>index+i)}:{})});index+=length-1;
    }
    for(const index of prepared.markers)units.push({index,indices:[index],cleanIndices:[],score:[],boundary:false});units.sort((a,b)=>a.index-b.index);
    const wholeScore=units.flatMap(u=>u.score);
    let effectivePhones=root.VoiceGerman?root.VoiceGerman.resolve(engine,phones,wholeScore):phones;
    if(root.VoiceEnglish)effectivePhones=root.VoiceEnglish.resolve(engine,effectivePhones,wholeScore);
    for(const unit of units)for(const token of unit.score)if(!engine.phonemeIds.includes(token.id)&&!Object.hasOwn(effectivePhones,token.id))throw Error('Движок не поддерживает токен '+token.id+'.');
    for(const unit of units)if(unit.enStressTokens){
      const marked=unit.cleanIndices.filter(i=>prepared.stressed.has(i));
      if(marked.length){
        unit.enStressTokens=unit.score.flatMap((t,j)=>marked.includes(unit.tokenLetters[j])&&(effectivePhones[t.id]||engine.getPhone(t.id)).kind==='vowel'?[j]:[]);
        if(!unit.enStressTokens.length)throw Error('Метка ударения в английском слове попала на букву без отдельного гласного звука. Поставьте её перед произносимой гласной.');
      }
    }
    if(!sounding)throw Error('В тексте нет звучащих букв или цифр. Ъ, Ь и паузы не зацикливаются отдельно.');
    const annotation=root.VoiceProsody.apply(units,prepared,language,engine,effectivePhones,settings);units=annotation.units;
    // Keep each word together. Separators belong to the preceding word; a
    // leading separator stays with the first word. No per-letter DSP restart.
    const words=[];let word=[];
    for(const unit of units){word.push(unit);if(unit.boundary){if(word.some(u=>!u.boundary)){words.push(word);word=[];}else if(words.length){words[words.length-1].push(...word);word=[];}}}
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
        rangeStart:consumed/spokenTotal,rangeEnd:(consumed+samples)/spokenTotal,...(language==='ru'?{softenFrication:true}:{})};
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
  root.VoiceText=Object.freeze({plan,tokenBoundaries,maxCharacters:MAX_CHARS,maxSeconds:MAX_SECONDS});
})(globalThis);
