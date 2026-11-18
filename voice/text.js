/* Text is expanded into our alphabet recipes, not a general language model. */
(function(root){
  'use strict';
  const MAX_CHARS=160,MAX_SECONDS=60;
  const softenable=new Set(Array.from('БВГДЗКЛМНПРСТФХ'));
  const consonants=new Set(Array.from('БВГДЖЗКЛМНПРСТФХЦЧШЩ'));
  const softNext=new Set(Array.from('ЕЁЮЯИЬ'));
  const iotated=new Set(Array.from('ЕЁЮЯ'));
  function plan({text,language,catalog,engine,settings,phones}){
    if(typeof text!=='string'||!['ru','en','de'].includes(language))throw Error('Выберите RU, EN или DE для текстового чтения.');
    const letters=Array.from(text),rate=engine.limits.sampleRate,tail=engine.engineId==='robot'?Math.round(.018*rate):0;
    if(!letters.length||letters.length>MAX_CHARS)throw Error('Текст: от 1 до '+MAX_CHARS+' символов.');
    const sounds=new Map(catalog.filter(r=>r.lang===language&&r.kind===(language==='en'?'name':'sound')).map(r=>[r.symbol.toUpperCase(),r]));
    const digits=new Map(catalog.filter(r=>r.lang===(language==='de'?'de':'ru')&&r.kind==='digit').map(r=>[r.symbol,r]));
    const characters=[],units=[];let utf16=0,sounding=false;
    for(const char of letters){const start=utf16;utf16+=char.length;characters.push({text:char,start,end:utf16});}
    for(let index=0;index<letters.length;index++){
      const char=letters[index],upper=char.toUpperCase(),start=characters[index].start;
      let score=[],boundary=false,length=1;
      if(/\s/u.test(char)){score=[{id:'_',duration:.10}];boundary=true;}
      else if(/[.,!?;:…—–\-()«»„“”‚‘’"']/u.test(char)){score=[{id:'_',duration:/[.!?…]/u.test(char) ? 0.28 : /[,;:]/u.test(char) ? 0.16 : 0.08}];boundary=true;}
      else{
        const german=language==='de'?root.VoiceGerman.take(letters,index):null;
        const recipe=language==='de'?(german?{kind:'sound',score:german.score}:null):digits.get(char)||sounds.get(upper);
        if(!recipe)throw Error('Символ «'+char+'» в позиции '+(start+1)+' не поддерживается в '+language.toUpperCase()+'.');
        if(german)length=german.length;
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
      units.push({index,indices:Array.from({length},(_,i)=>index+i),score,boundary});index+=length-1;
    }
    const effectivePhones=root.VoiceGerman?root.VoiceGerman.resolve(engine,phones,units.flatMap(u=>u.score)):phones;
    for(const unit of units)for(const token of unit.score)if(!engine.phonemeIds.includes(token.id)&&!Object.hasOwn(effectivePhones,token.id))throw Error('Движок не поддерживает токен '+token.id+'.');
    if(!sounding)throw Error('В тексте нет звучащих букв или цифр. Ъ, Ь и паузы не зацикливаются отдельно.');
    // Keep each word together. Separators belong to the preceding word; a
    // leading separator stays with the first word. No per-letter DSP restart.
    const words=[];let word=[];
    for(const unit of units){word.push(unit);if(unit.boundary){if(word.some(u=>!u.boundary)){words.push(word);word=[];}else if(words.length){words[words.length-1].push(...word);word=[];}}}
    if(word.length)words.push(word);
    const chunks=[];let chunk={score:[],marks:[]},count=0,totalSamples=0;
    const duration=score=>score.reduce((sum,t)=>sum+Math.round(t.duration/settings.speed*rate),0);
    function finish(){if(!chunk.score.length)return;totalSamples+=count+tail;chunks.push(chunk);chunk={score:[],marks:[]};count=0;}
    for(const group of words){
      const tokens=group.flatMap(u=>u.score),samples=duration(tokens);
      if(tokens.length>engine.limits.maxSegments||samples+tail>engine.limits.maxSeconds*rate)throw Error('Одно слово превышает лимит '+engine.limits.maxSegments+' сегментов или '+engine.limits.maxSeconds+' секунд. Увеличьте скорость или сократите слово.');
      if(chunk.score.length&&(chunk.score.length+tokens.length>engine.limits.maxSegments||count+samples+tail>engine.limits.maxSeconds*rate))finish();
      for(const unit of group){const from=chunk.score.length;chunk.score.push(...unit.score);chunk.marks.push({index:unit.index,indices:unit.indices,from,to:chunk.score.length});}
      count+=samples;
    }
    finish();
    if(totalSamples>MAX_SECONDS*rate)throw Error('Один круг текста превышает '+MAX_SECONDS+' секунд с текущей скоростью. Сократите текст или увеличьте скорость.');
    return {characters,chunks,language,rate,phones:effectivePhones};
  }
  function tokenBoundaries(result){
    const boundaries=[0];let seconds=0,count=0;
    for(const token of result.score){seconds+=token.duration;count=result.legacyExact?Math.ceil(seconds/result.settings.speed*result.sampleRate):count+Math.round(token.duration/result.settings.speed*result.sampleRate);boundaries.push(count);}
    return boundaries;
  }
  root.VoiceText=Object.freeze({plan,tokenBoundaries,maxCharacters:MAX_CHARS,maxSeconds:MAX_SECONDS});
})(globalThis);
