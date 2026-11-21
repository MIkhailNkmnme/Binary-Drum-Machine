/* ГОЛ-031. Letter names and kana with handwritten synthesis scores. */
(function(root){
  'use strict';
  const version='letter-recipes-v1.0.0';
  const spanish=[
    ['A','a','a:235'],
    ['B','be','b:75 e:225'],
    ['C','ce','s:97 e:220'],
    ['D','de','d:75 e:220'],
    ['E','e','e:235'],
    ['F','efe','e:185 f:103 e:130'],
    ['G','ge','de_ach:120 e:219'],
    ['H','hache','a:183 ch:128 e:135'],
    ['I','i','i:231'],
    ['J','jota','de_ach:114 o:174 t:75 a:133'],
    ['K','ka','k:75 a:225'],
    ['L','ele','e:186 l:84 e:133'],
    ['M','eme','e:185 m:88 e:134'],
    ['N','ene','e:185 n:87 e:136'],
    ['Ñ','eñe','e:182 nj:103 e:134'],
    ['O','o','o:230'],
    ['P','pe','p:77 e:224'],
    ['Q','cu','k:75 u:223'],
    ['R','erre','e:176 r:117 e:131'],
    ['S','ese','e:181 s:101 e:131'],
    ['T','te','t:73 e:230'],
    ['U','u','u:228'],
    ['V','uve','u:179 b:65 e:141'],
    ['W','uve doble','u:167 b:60 e:128 _:38 d:72 o:169 b:63 l:76 e:133'],
    ['X','equis','e:180 k:73 i:134 s:103'],
    ['Y','ye','j:83 e:216'],
    ['Z','zeta','s:98 e:173 t:73 a:136']
  ];
  for(const [symbol,vowel] of [['Á','a'],['É','e'],['Í','i'],['Ó','o'],['Ú','u']]){
    spanish.push([symbol,vowel+' con tilde',vowel+':181 _:35 k:67 o:110 n:85 t:69 i:156 l:76 d:68 e:121']);
  }
  spanish.push(['Ü','u con diéresis','u:181 _:35 k:67 o:111 n:82 d:62 j:54 e:159 r:46 e:114 s:86 i:115 s:92']);

  const french=[
    ['A','a','a:230'],
    ['B','bé','b:74 e:220'],
    ['C','cé','s:102 e:216'],
    ['D','dé','d:72 e:219'],
    ['E','e','ax:232'],
    ['F','effe','en_eh:190 f:120'],
    ['G','gé','zh:95 e:221'],
    ['H','ache','a:195 sh:127'],
    ['I','i','i:228'],
    ['J','ji','zh:97 i:217'],
    ['K','ka','k:75 a:217'],
    ['L','elle','en_eh:187 l:106'],
    ['M','emme','en_eh:185 m:110'],
    ['N','enne','en_eh:186 n:110'],
    ['O','o','o:232'],
    ['P','pé','p:77 e:221'],
    ['Q','ku','k:75 de_ue:221'],
    ['R','erre','en_eh:184 fr_r:98'],
    ['S','esse','en_eh:185 s:117'],
    ['T','té','t:73 e:223'],
    ['U','u','de_ue:230'],
    ['V','vé','v:92 e:221'],
    ['W','double vé','d:74 u:149 b:65 l:75 _:33 v:85 e:192'],
    ['X','ixe','i:180 k:75 s:110'],
    ['Y','i grec','i:174 _:34 g:70 fr_r:76 en_eh:167 k:79'],
    ['Z','zède','z:92 en_eh:183 d:82']
  ];
  const frMark={
    grave:['accent grave','a:114 k:69 s:91 a:110 n:70 g:72 fr_r:76 a:155 v:94'],
    circonflexe:['accent circonflexe','a:114 k:69 s:91 a:110 n:70 s:93 i:120 fr_r:74 k:70 o:109 n:70 f:90 l:69 en_eh:151 k:68 s:94'],
    aigu:['accent aigu','a:114 k:69 s:91 a:110 n:68 t:70 e:125 g:70 de_ue:162'],
    trema:['tréma','t:69 fr_r:74 e:138 m:76 a:167']
  };
  for(const [symbol,label,base,mark] of [
    ['À','a','a:176','grave'],['Â','a','a:176','circonflexe'],['Ä','a','a:176','trema'],
    ['È','e','ax:176','grave'],['É','e','ax:176','aigu'],['Ê','e','ax:176','circonflexe'],['Ë','e','ax:176','trema'],
    ['Î','i','i:176','circonflexe'],['Ï','i','i:176','trema'],['Ô','o','o:176','circonflexe'],
    ['Ù','u','de_ue:176','grave'],['Û','u','de_ue:176','circonflexe'],['Ü','u','de_ue:176','trema'],
    ['Ÿ','i grec','i:117 g:66 fr_r:74 en_eh:126 k:70','trema']
  ]){
    const [name,score]=frMark[mark];
    french.push([symbol,label+' '+name,base+' _:38 '+score]);
  }
  french.push(
    ['Ç','cé cédille','s:93 e:168 _:36 s:91 e:131 d:68 i:150 j:81'],
    ['Æ','a e liés','a:159 ax:142 _:34 l:70 j:59 e:170'],
    ['Œ','o e liés','o:159 ax:142 _:34 l:70 j:59 e:170']
  );

  const italian=[
    ['A','a','a:231'],
    ['B','bi','b:73 i:223'],
    ['C','ci','ch:120 i:218'],
    ['D','di','d:72 i:220'],
    ['E','e','e:232'],
    ['F','effe','en_eh:182 f:135 e:131'],
    ['G','gi','dzh:119 i:217'],
    ['H','acca','a:180 k:125 a:130'],
    ['I','i','i:232'],
    ['J','i lunga','i:175 _:38 l:78 u:173 en_ng:84 g:72 a:132'],
    ['K','cappa','k:71 a:178 p:123 a:131'],
    ['L','elle','en_eh:181 l:124 e:130'],
    ['M','emme','en_eh:180 m:132 e:130'],
    ['N','enne','en_eh:180 n:131 e:131'],
    ['O','o','o:231'],
    ['P','pi','p:73 i:223'],
    ['Q','cu','k:72 u:222'],
    ['R','erre','en_eh:176 r:122 e:130'],
    ['S','esse','en_eh:184 s:131 e:131'],
    ['T','ti','t:70 i:222'],
    ['U','u','u:230'],
    ['V','vu','v:89 u:221'],
    ['W','doppia vu','d:73 en_aw:166 p:125 j:60 a:123 _:37 v:87 u:179'],
    ['X','ics','i:177 k:75 s:110'],
    ['Y','ipsilon','i:153 p:73 s:91 i:123 l:71 o:120 n:83'],
    ['Z','zeta','d:53 z:73 en_eh:179 t:74 a:131']
  ];
  for(const [symbol,vowel,base,acute] of [
    ['À','a','a',false],['È','e','en_eh',false],['É','e','e',true],['Ì','i','i',false],
    ['Ò','o','en_aw',false],['Ó','o','o',true],['Ù','u','u',false]
  ]){
    italian.push([symbol,vowel+(acute?' acuta':' grave'),base+':176 _:37 '+(acute?'a:117 k:72 u:168 t:74 a:133':'g:72 r:45 a:170 v:83 e:132')]);
  }

  const hiragana=[
    ['あ','a','a:213'],['い','i','i:211'],['う','u','u:212'],['え','e','e:213'],['お','o','o:214'],
    ['か','ka','k:75 a:190'],['き','ki','kj:74 i:186'],['く','ku','k:75 u:184'],['け','ke','k:75 e:189'],['こ','ko','k:75 o:188'],
    ['さ','sa','s:100 a:188'],['し','shi','sh:106 i:182'],['す','su','s:101 u:178'],['せ','se','s:101 e:186'],['そ','so','s:101 o:188'],
    ['た','ta','t:73 a:189'],['ち','chi','ch:116 i:182'],['つ','tsu','ts:111 u:177'],['て','te','t:73 e:187'],['と','to','t:73 o:188'],
    ['な','na','n:82 a:189'],['に','ni','nj:81 i:183'],['ぬ','nu','n:81 u:179'],['ね','ne','n:82 e:186'],['の','no','n:82 o:188'],
    ['は','ha','h:85 a:189'],['ひ','hi','de_ich:92 i:180'],['ふ','fu','f:87 u:182'],['へ','he','h:83 e:187'],['ほ','ho','h:82 o:187'],
    ['ま','ma','m:81 a:189'],['み','mi','mj:80 i:183'],['む','mu','m:81 u:180'],['め','me','m:82 e:187'],['も','mo','m:81 o:189'],
    ['や','ya','j:69 a:190'],['ゆ','yu','j:69 u:184'],['よ','yo','j:69 o:189'],
    ['ら','ra','r:45 a:195'],['り','ri','rj:44 i:191'],['る','ru','r:44 u:187'],['れ','re','r:45 e:191'],['ろ','ro','r:45 o:193'],
    ['わ','wa','w:68 a:189'],['を','wo','o:212'],['ん','n','n:211'],
    ['が','ga','g:75 a:192'],['ぎ','gi','gj:74 i:188'],['ぐ','gu','g:74 u:184'],['げ','ge','g:74 e:190'],['ご','go','g:73 o:189'],
    ['ざ','za','z:92 a:191'],['じ','ji','dzh:112 i:185'],['ず','zu','z:91 u:183'],['ぜ','ze','z:91 e:187'],['ぞ','zo','z:91 o:189'],
    ['だ','da','d:72 a:190'],['ぢ','ji','dzh:112 i:185'],['づ','zu','z:91 u:183'],['で','de','d:72 e:188'],['ど','do','d:72 o:188'],
    ['ば','ba','b:73 a:191'],['び','bi','bj:73 i:186'],['ぶ','bu','b:73 u:183'],['べ','be','b:73 e:189'],['ぼ','bo','b:72 o:190'],
    ['ぱ','pa','p:77 a:190'],['ぴ','pi','pj:76 i:185'],['ぷ','pu','p:77 u:182'],['ぺ','pe','p:77 e:189'],['ぽ','po','p:77 o:189'],
    ['ゔ','vu','v:87 u:183']
  ];
  // Small kana have no independent mora. In isolation, read their names.
  for(const [symbol,label,sound] of [
    ['ぁ','a','a:183'],['ぃ','i','i:180'],['ぅ','u','u:178'],['ぇ','e','e:182'],['ぉ','o','o:183'],
    ['ゃ','ya','j:65 a:184'],['ゅ','yu','j:65 u:179'],['ょ','yo','j:65 o:184'],['っ','tsu','ts:110 u:178']
  ]){
    hiragana.push([symbol,'chiisai '+label,'ch:112 i:197 s:91 a:112 i:78 _:38 '+sound]);
  }
  for(const [head,label,onset] of [
    ['き','ky','kj:75'],['ぎ','gy','gj:75'],['し','sh','sh:106'],['じ','j','dzh:112'],
    ['ち','ch','ch:115'],['に','ny','nj:81'],['ひ','hy','de_ich:94'],['び','by','bj:74'],
    ['ぴ','py','pj:76'],['み','my','mj:81'],['り','ry','rj:45']
  ]){
    for(const [tail,vowel,ms] of [['ゃ','a',190],['ゅ','u',184],['ょ','o',190]]){
      hiragana.push([head+tail,label+vowel,onset+' '+vowel+':'+ms]);
    }
  }
  const katakana=hiragana.map(([symbol,label,score])=>[
    Array.from(symbol,char=>String.fromCodePoint(char.codePointAt(0)+0x60)).join(''),label,score
  ]);
  const catalog=Object.freeze(Object.entries({es:spanish,fr:french,it:italian,ja:[...hiragana,...katakana]}).flatMap(([lang,rows])=>rows.map(([symbol,label,phones])=>{
    const code=Array.from(symbol,c=>c.codePointAt(0).toString(16)).join('-');
    const score=Object.freeze(phones.split(' ').map(token=>{
      const [id,ms]=token.split(':');
      return Object.freeze({id,duration:Number(ms)/1000});
    }));
    return Object.freeze({id:lang+'-name-'+code,lang,kind:'name',symbol,label,score});
  })));
  root.VoiceLetters=Object.freeze({version,catalog});
})(globalThis);
