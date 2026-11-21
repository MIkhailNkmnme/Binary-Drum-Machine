/* ГОЛ-032. Own approximate spelling rules and handwritten word scores.
   No audio input, external dictionary, learned model or measured speaker.
   FR liaison/schwa, IT open vowels, ES regional variants and JA pitch accent
   are deliberately approximate. Kanji require a declared reading; unknown
   kanji fail explicitly. These recipes do not establish intelligibility. */
(function(root){
  'use strict';
  const version='language-recipes-v1.0.0',copy=v=>JSON.parse(JSON.stringify(v));
  const supported=new Set(['fr','it','es','ja']);
  const vowels=new Set(['a','e','i','o','u','ax','en_eh','en_aw','de_ue','de_oe','fr_un','fr_in','fr_an','fr_on']);
  const targets={
    fr_un:{kind:'vowel',formants:[270,500,1440,2470],bandwidths:[90,135,210,280],weights:[.62,1,.68,.2],voice:1,noise:.012},
    fr_in:{kind:'vowel',formants:[270,575,1810,2580],bandwidths:[90,135,210,280],weights:[.61,1,.76,.23],voice:1,noise:.012},
    fr_r:{kind:'fricative',formants:[660,1300,2360,3970],bandwidths:[480,690,1050,1400],weights:[.6,1,.42,.17],voice:.52,noise:.48},
    fr_an:{kind:'vowel',formants:[280,730,1240,2580],bandwidths:[95,145,220,290],weights:[.6,1,.66,.22],voice:1,noise:.012},
    fr_on:{kind:'vowel',formants:[270,520,930,2520],bandwidths:[95,140,215,285],weights:[.62,1,.62,.21],voice:1,noise:.012}
  };
  const phoneLabels={fr_un:'FR · un [œ̃], цель синтеза',fr_in:'FR · in [ɛ̃], цель синтеза',fr_r:'FR · r [ʁ], цель синтеза',fr_an:'FR · an [ɑ̃], цель синтеза',fr_on:'FR · on [ɔ̃], цель синтеза'};
  const getPhone=(engineId,id)=>Object.hasOwn(targets,id)?copy(targets[id]):undefined;
  function resolve(engine,overrides,score){
    let out={};
    if(root.VoiceGerman)out=root.VoiceGerman.resolve(engine,out,score);
    if(root.VoiceEnglish)out=root.VoiceEnglish.resolve(engine,out,score);
    if(root.VoiceDigits)out=root.VoiceDigits.resolve(engine,out,score);
    for(const {id} of score)if(Object.hasOwn(targets,id))out[id]=copy(targets[id]);
    for(const [id,phone] of Object.entries(overrides||{}))Object.defineProperty(out,id,{value:copy(phone),enumerable:true,writable:true,configurable:true});
    if(Object.keys(out).length>engine.limits.maxPhones)throw Error('Языковые цели превышают лимит фонем '+engine.limits.maxPhones+'.');
    return out;
  }
  const duration=id=>vowels.has(id)?.19:['p','b','t','d','k','g'].includes(id)?.075:['ch','dzh','ts'].includes(id)?.12:id==='r'?.048:.095;
  function recipe(){return {score:[],tokenLetters:[],stressTokens:[]};}
  function emit(out,ids,at,scale=1){
    for(const id of ids.split(' ').filter(Boolean)){out.score.push({id,duration:duration(id)*scale});out.tokenLetters.push(at);}
  }
  function finish(out,length,source,stressIndex){
    out.stressTokens=out.score.flatMap((t,i)=>vowels.has(t.id)&&out.tokenLetters[i]===stressIndex?[i]:[]);
    return {...out,length,source,stressIndex};
  }
  // @ offsets are source letters, not token positions; accents stay attached.
  const dictionaries={fr:new Map(),it:new Map(),es:new Map()};
  function word(lang,text,stress,phones){
    const out=recipe();
    for(const token of phones.split(' ')){const [id,at]=token.split('@');emit(out,id,+at);}
    dictionaries[lang].set(text,{...out,stressIndex:stress});
  }
  const rows={
    fr:[
      ['la',1,'l@0 a@1'],['lumière',4,'l@0 de_ue@1 m@2 j@3 en_eh@4 fr_r@5'],
      ['reste',1,'fr_r@0 en_eh@1 s@2 t@3'],['avec',2,'a@0 v@1 en_eh@2 k@3'],
      ['moi',1,'m@0 w@1 a@1'],['je',1,'zh@0 ax@1'],['respire',4,'fr_r@0 en_eh@1 s@2 p@3 i@4 fr_r@5'],
      ['dans',1,'d@0 fr_an@1'],['le',1,'l@0 ax@1'],['calme',1,'k@0 a@1 l@2 m@3'],
      ['zerkalius',4,'z@0 en_eh@1 fr_r@2 k@3 a@4 l@5 j@6 de_ue@7 s@8']
    ],
    it:[
      ['la',1,'l@0 a@1'],['notte',1,'n@0 en_aw@1 t@2 t@3 e@4'],
      ['ascolta',3,'a@0 s@1 k@2 en_aw@3 l@4 t@5 a@6'],['con',1,'k@0 o@1 n@2'],['me',1,'m@0 e@1'],
      ['il',0,'i@0 l@1'],['ritmo',1,'r@0 i@1 t@2 m@3 o@4'],['torna',1,'t@0 en_aw@1 r@2 n@3 a@4'],
      ['piano',2,'p@0 j@1 a@2 n@3 o@4'],['zerkalius',4,'d@0 z@0 e@1 r@2 k@3 a@4 l@5 j@6 u@7 s@8']
    ],
    es:[
      ['ya',1,'j@0 a@1'],['no',1,'n@0 o@1'],['estoy',3,'e@0 s@1 t@2 o@3 i@4'],
      ['tan',1,'t@0 a@1 n@2'],['solo',1,'s@0 o@1 l@2 o@3'],['la',1,'l@0 a@1'],
      ['luz',1,'l@0 u@1 s@2'],['sigue',1,'s@0 i@1 g@2 e@4'],['mi',1,'m@0 i@1'],
      ['mano',1,'m@0 a@1 n@2 o@3'],['zerkalius',4,'s@0 e@1 r@2 k@3 a@4 l@5 j@6 u@7 s@8']
    ]
  };
  for(const [lang,entries] of Object.entries(rows))for(const row of entries)word(lang,...row);
  const latin=/^[a-zà-öø-ÿœæ]$/iu;
  // Normalize a base plus combining marks while retaining raw source indices.
  function normalizedRun(chars,index,accept){
    const letters=[],origins=[];let end=index;
    while(accept(chars[end])){
      const start=end;let cluster=chars[end++];
      while(chars[end]&&/^\p{M}$/u.test(chars[end]))cluster+=chars[end++];
      for(const char of Array.from(cluster.normalize('NFC').toLowerCase())){letters.push(char);origins.push(start);}
    }
    return {letters,origins,end};
  }
  const latinSounds={
    fr:{a:'a',b:'b',c:'k',d:'d',e:'ax',f:'f',g:'g',h:'',i:'i',j:'zh',k:'k',l:'l',m:'m',n:'n',o:'o',p:'p',q:'k',r:'fr_r',s:'s',t:'t',u:'de_ue',v:'v',w:'w',x:'k s',y:'i',z:'z',à:'a',â:'a',ä:'a',è:'en_eh',é:'e',ê:'en_eh',ë:'en_eh',î:'i',ï:'i',ô:'o',ö:'o',ù:'de_ue',û:'de_ue',ü:'de_ue',ÿ:'i',ç:'s',æ:'en_eh',œ:'de_oe'},
    it:{a:'a',b:'b',c:'k',d:'d',e:'e',f:'f',g:'g',h:'',i:'i',j:'j',k:'k',l:'l',m:'m',n:'n',o:'o',p:'p',q:'k',r:'r',s:'s',t:'t',u:'u',v:'v',w:'w',x:'k s',y:'i',z:'d z',à:'a',è:'en_eh',é:'e',ì:'i',ò:'en_aw',ó:'o',ù:'u'},
    es:{a:'a',b:'b',c:'k',d:'d',e:'e',f:'f',g:'g',h:'',i:'i',j:'de_ach',k:'k',l:'l',m:'m',n:'n',ñ:'nj',o:'o',p:'p',q:'k',r:'r',s:'s',t:'t',u:'u',v:'b',w:'w',x:'k s',y:'j',z:'s',á:'a',é:'e',í:'i',ó:'o',ú:'u',ü:'u'}
  };
  function latinWord(lang,chars,index){
    if(!latin.test(chars[index]||''))return null;
    const {letters,origins:rawOrigins,end}=normalizedRun(chars,index,c=>latin.test(c||''));
    const text=letters.join(''),known=dictionaries[lang].get(text);
    if(known){const out=copy(known);out.tokenLetters=out.tokenLetters.map(i=>rawOrigins[i]);return finish(out,end-index,'dictionary',rawOrigins[out.stressIndex]);}
    const out=recipe(),at=i=>rawOrigins[i];
    for(let i=0;i<letters.length;i++){
      const c=letters[i],next=letters[i+1]||'',tail=letters.slice(i).join('');let ids=null,size=1;
      const match=(pattern,phones)=>{if(ids===null&&tail.startsWith(pattern)){ids=phones;size=pattern.length;}};
      if(lang==='fr'){
        if(/^(er|ez)$/.test(tail)&&i>0){ids='e';size=2;}
        if(ids===null&&/^(ain|ein|aim)/.test(tail)&&!/[aeiouyàâéèêëîïôùûü]/.test(letters[i+3]||'')){ids='fr_in';size=3;}
        for(const [s,p] of [['eaux','o'],['eau','o'],['œu','de_oe'],['oeu','de_oe'],['ch','sh'],['ph','f'],['gn','nj'],['ou','u'],['oi','w a'],['au','o'],['ai','en_eh'],['ei','en_eh'],['eu','de_oe'],['qu','k']])match(s,p);
        if(ids===null&&tail.startsWith('gu')&&/[eiéèêëiy]/.test(letters[i+2]||'')){ids='g';size=2;}
        if(ids===null&&/[aeiouy]/.test(c)&&next==='n'&&!/[nmaeiouyàâéèêëîïôùûü]/.test(letters[i+2]||'')){
          ids=({a:'fr_an',e:'fr_an',i:'fr_in',o:'fr_on',u:'fr_un',y:'fr_in'})[c];size=2;
        }
        if(ids===null&&/[ae]/.test(c)&&next==='m'&&/[bp]/.test(letters[i+2]||'')){ids='fr_an';size=2;}
        if(ids===null&&c==='c'&&/[eiéèêëiy]/.test(next))ids='s';
        if(ids===null&&c==='g'&&/[eiéèêëiy]/.test(next))ids='zh';
        if(ids===null&&c==='s'&&/[aeiouy]/.test(letters[i-1]||'')&&/[aeiouy]/.test(next))ids='z';
        if(i===letters.length-1&&letters.length>1&&/[estdxzp]/.test(c))ids='';
      }else if(lang==='it'){
        if(tail.startsWith('gli')){ids=/[aeou]/.test(letters[i+3]||'')?'lj':'lj i';size=3;}
        if(tail.startsWith('sci')){ids=/[aeou]/.test(letters[i+3]||'')?'sh':'sh i';size=3;}
        for(const [s,p] of [['gn','nj'],['sch','s k'],['sce','sh e'],['ch','k'],['gh','g'],['qu','k w']])match(s,p);
        if(ids===null&&/[cg]/.test(c)&&/[ei]/.test(next)){
          ids=c==='c'?'ch':'dzh';
          if(next==='i'&&/[aou]/.test(letters[i+2]||''))size=2;
        }
        if(ids===null&&c==='i'&&/[aou]/.test(next))ids='j';
      }else{
        for(const [s,p] of [['ch','ch'],['ll','j'],['rr','r'],['que','k e'],['qui','k i'],['gue','g e'],['gui','g i'],['güe','g w e'],['güi','g w i']])match(s,p);
        if(ids===null&&c==='c'&&/[eiéí]/.test(next))ids='s';
        if(ids===null&&c==='g'&&/[eiéí]/.test(next))ids='de_ach';
        if(ids===null&&c==='y'&&i===letters.length-1)ids='i';
      }
      if(ids===null){ids=latinSounds[lang][c];if(ids===undefined)throw Error('Нет правила '+lang.toUpperCase()+' для «'+c+'».');}
      // Source origins preserve explicit stress on the vowel of a grapheme.
      const span=letters.slice(i,i+size),origins=span.flatMap((c,j)=>/[aeiouyàâäèéêëîïôöùûüÿáíóúæœ]/.test(c)?[at(i+j)]:[]);
      if(lang==='es'&&/^(que|qui|gue|gui)$/.test(span.join('')))origins.shift();
      const before=out.score.length;emit(out,ids,at(i),lang==='es'&&tail.startsWith('rr')?2:1);
      let v=0;for(let j=before;j<out.score.length;j++)if(vowels.has(out.score[j].id)&&origins.length)out.tokenLetters[j]=origins[Math.min(v++,origins.length-1)];
      i+=size-1;
    }
    let candidates=out.score.flatMap((t,i)=>vowels.has(t.id)?[out.tokenLetters[i]]:[]);candidates=[...new Set(candidates)];
    const accent=letters.findIndex(c=>/[áéíóúàèìòù]/.test(c));
    const stress=lang==='fr'?candidates.at(-1):accent>=0?at(accent):lang==='es'&&!/[aeiounsáéíóú]$/.test(text)?candidates.at(-1):candidates.at(-2)??candidates.at(-1);
    return finish(out,end-index,'rules',stress??null);
  }
  const kana=new Map();
  const hira=text=>Array.from(text,c=>{const n=c.codePointAt(0);return n>=0x30a1&&n<=0x30f6?String.fromCodePoint(n-0x60):c;}).join('');
  for(const row of root.VoiceLetters?.catalog||[])if(row.lang==='ja'&&!row.label.startsWith('chiisai '))kana.set(hira(row.symbol),copy(row.score));
  for(const [symbol,ids] of Object.entries({'ぁ':'a','ぃ':'i','ぅ':'u','ぇ':'e','ぉ':'o','ゃ':'j a','ゅ':'j u','ょ':'j o','ゎ':'w a','ゐ':'i','ゑ':'e','てぃ':'t i','でぃ':'d i','とぅ':'t u','どぅ':'d u','ふぁ':'f a','ふぃ':'f i','ふぇ':'f e','ふぉ':'f o','うぃ':'w i','うぇ':'w e','うぉ':'w o','ゔぁ':'v a','ゔぃ':'v i','ゔぇ':'v e','ゔぉ':'v o','しぇ':'sh e','じぇ':'dzh e','ちぇ':'ch e'})){
    const out=recipe();emit(out,ids,0);kana.set(symbol,out.score);
  }
  const kanaChar=c=>!!c&&/^[\p{Script=Hiragana}\p{Script=Katakana}ー]$/u.test(c);
  function japanese(chars,index){
    const first=chars[index]||'';
    if(/\p{Script=Han}/u.test(first))throw Error('Для кандзи «'+first+'» нет объявленного чтения. Введите кана.');
    if(!kanaChar(first))return null;
    const run=normalizedRun(chars,index,kanaChar),end=run.end;
    if(/\p{Script=Han}/u.test(chars[end]||''))throw Error('Неизвестное чтение кандзи «'+chars[end]+'». Введите слово кана.');
    const out=recipe(),letters=Array.from(hira(run.letters.join(''))),at=i=>run.origins[i];
    for(let i=0;i<letters.length;i++){
      const char=letters[i];
      if(char==='っ'){
        if(!letters[i+1]||'あいうえおぁぃぅぇぉんー'.includes(letters[i+1]))throw Error('Маленькое っ требует следующего согласного.');
        out.score.push({id:'_',duration:.10});out.tokenLetters.push(at(i));continue;
      }
      if(char==='ー'){
        const previous=out.score.at(-1);if(!previous||!vowels.has(previous.id))throw Error('Знак ー требует предшествующего гласного.');
        previous.duration+=.18;continue;
      }
      const pair=letters.slice(i,i+2).join(''),size=kana.has(pair)?2:1,score=kana.get(size===2?pair:char);
      if(!score)throw Error('Нет правила кана для «'+char+'».');
      for(const token of score){out.score.push({...token});out.tokenLetters.push(at(i));}
      i+=size-1;
    }
    // Kana durations are mora based; no invented lexical pitch/stress accent.
    return finish(out,end-index,'rules',null);
  }
  function take(language,chars,index){
    if(!supported.has(language))return null;
    return language==='ja'?japanese(chars,index):latinWord(language,chars,index);
  }
  const catalog=[];
  function entry(lang,symbol,label,score,extra={}){
    catalog.push(Object.freeze({id:lang+'-sound-'+Array.from(symbol,c=>c.codePointAt(0).toString(16)).join('-'),lang,kind:'sound',symbol,label,score:Object.freeze(score.map(t=>Object.freeze({...t}))),...extra}));
  }
  for(const [lang,table] of Object.entries(latinSounds))for(const [symbol,ids] of Object.entries(table)){
    const out=recipe();emit(out,ids,0);entry(lang,symbol.toUpperCase(),ids?'изолированно: '+ids+'; в слове по контексту':'не произносится',out.score,ids?{}:{silent:true});
  }
  for(const [symbol,score] of kana){
    entry('ja',symbol,symbol,score);
    const katakana=Array.from(symbol,c=>String.fromCodePoint(c.codePointAt(0)+0x60)).join('');entry('ja',katakana,katakana,score);
  }
  for(const symbol of ['っ','ッ'])entry('ja',symbol,'смычка перед согласным',[{id:'_',duration:.10}],{contextual:true});
  entry('ja','ー','продлевает предыдущий гласный; отдельно не звучит',[],{contextual:true,silent:true});
  const examples=Object.freeze({
    fr:'La lumière reste avec moi. Je respire dans le calme. Zerkalius. Un, zéro, zéro… un, un, zéro, zéro.',
    it:'La notte ascolta con me. Il ritmo torna piano. Zerkalius. Uno, zero, zero… uno, uno, zero, zero.',
    es:'Ya no estoy tan solo. La luz sigue mi mano. Zerkalius. Uno, cero, cero… uno, uno, cero, cero.',
    ja:'まだ ここに いるよ。しずかに あさを まとう。ゼルカリウス。いち、ゼロ、ゼロ…いち、いち、ゼロ、ゼロ。'
  });
  root.VoiceLanguages=Object.freeze({version,supports:lang=>supported.has(lang),take,resolve,catalog:Object.freeze(catalog),phoneIds:Object.freeze(Object.keys(targets)),phoneLabels:Object.freeze(phoneLabels),getPhone,examples});
})(globalThis);
