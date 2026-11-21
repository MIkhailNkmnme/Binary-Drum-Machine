/* ГОЛ-030. Handwritten digit names and original phoneme durations. */
(function(root){
  'use strict';
  const version='counting-recipes-v1.0.0';
  const example='1, 0, 0… 1, 1, 0, 0.';
  // First ten rows map to 0–9. Further rows give alternate pronunciations
  // by name only. A plus marks the stressed vowel in the phoneme score.
  const rows={
    es:[
      ['cero','s:95 +e:190 r:48 o:138'],
      ['uno','+u:204 n:82 o:140'],
      ['dos','d:75 +o:210 s:108'],
      ['tres','t:68 r:45 +e:199 s:110'],
      ['cuatro','k:71 w:63 +a:199 t:70 r:45 o:132'],
      ['cinco','s:95 +i:174 en_ng:80 k:75 o:130'],
      ['seis','s:96 +e:175 i:85 s:101'],
      ['siete','s:96 j:60 +e:179 t:74 e:133'],
      ['ocho','+o:188 ch:122 o:141'],
      ['nueve','n:77 w:62 +e:190 v:80 e:134']
    ],
    fr:[
      ['zéro zero','z:87 e:125 fr_r:78 +o:195'],
      ['un','+fr_un:219'],
      ['deux','d:72 +de_oe:216'],
      ['trois','t:67 fr_r:76 w:61 +a:183'],
      ['quatre','k:72 +a:174 t:62 fr_r:79'],
      ['cinq','s:101 +fr_in:176 k:82'],
      ['six','s:101 +i:174 s:112'],
      ['sept','s:97 +en_eh:174 t:79'],
      ['huit','de_ue:73 +i:175 t:79'],
      ['neuf','n:84 +de_oe:184 f:106']
    ],
    it:[
      ['zero','d:50 z:74 +en_eh:194 r:47 o:138'],
      ['uno','+u:205 n:83 o:138'],
      ['due','d:77 +u:199 e:126'],
      ['tre','t:71 r:47 +e:215'],
      ['quattro','k:71 w:65 +a:179 t:126 r:47 o:128'],
      ['cinque','ch:118 +i:168 en_ng:85 k:75 w:63 e:119'],
      ['sei','s:99 +en_eh:193 i:105'],
      ['sette','s:102 +en_eh:175 t:123 e:129'],
      ['otto','+en_aw:182 t:122 o:135'],
      ['nove','n:81 +en_aw:178 v:90 e:131']
    ],
    ja:[
      ['ゼロ ぜろ zero','z:85 e:133 r:46 o:143'],
      ['いち イチ 一 ichi','i:134 ch:114 i:83'],
      ['に ニ 二 ni','n:72 i:161'],
      ['さん サン 三 san','s:94 a:137 n:106'],
      ['よん ヨン 四 yon','j:65 o:132 n:107'],
      ['ご ゴ 五 go','g:68 o:166'],
      ['ろく ロク 六 roku','r:43 o:131 k:74 u:91'],
      ['なな ナナ 七 nana','n:71 a:133 n:70 a:142'],
      ['はち ハチ 八 hachi','h:79 a:128 ch:116 i:79'],
      ['きゅう キュウ 九 kyuu kyū kyu','kj:68 u:236'],
      ['れい レイ 零 〇 rei','r:44 e:189 i:56'],
      ['し シ shi','sh:100 i:137'],
      ['しち シチ shichi','sh:90 i:101 ch:112 i:83'],
      ['く ク ku','k:69 u:149']
    ]
  };
  const recipes=new Map(Object.entries(rows).map(([language,entries])=>{
    const names=new Map();
    const digits=entries.map(([aliases,phonemes])=>{
      const stressTokens=[];
      const score=phonemes.split(' ').map((token,index)=>{
        const [phone,ms]=token.split(':');
        if(phone.startsWith('+'))stressTokens.push(index);
        return {id:phone.replace(/^\+/,''),duration:Number(ms)/1000};
      });
      const recipe={score,stressTokens};
      for(const name of aliases.split(' '))names.set(name,recipe);
      return recipe;
    }).slice(0,10);
    return [language,{digits,names}];
  }));
  // Nasal resonances and uvular frication are design targets for the
  // procedural voice. They are not measurements of a recorded speaker.
  const targets={
    fr_un:{kind:'vowel',formants:[270,500,1440,2470],bandwidths:[90,135,210,280],weights:[.62,1,.68,.2],voice:1,noise:.012},
    fr_in:{kind:'vowel',formants:[270,575,1810,2580],bandwidths:[90,135,210,280],weights:[.61,1,.76,.23],voice:1,noise:.012},
    fr_r:{kind:'fricative',formants:[660,1300,2360,3970],bandwidths:[480,690,1050,1400],weights:[.6,1,.42,.17],voice:.52,noise:.48}
  };
  function read(language,word){
    const table=recipes.get(language);
    return /^[0-9]$/.test(word)?table.digits[Number(word)]:table.names.get(word.normalize('NFC').toLowerCase());
  }
  function resolve(engine,phones,score){
    const defaults={};
    for(const {id} of score)if(Object.hasOwn(targets,id))defaults[id]=targets[id];
    const resolved={...defaults,...phones};
    if(Object.keys(resolved).length>engine.limits.maxPhones)throw Error('Фонемы счёта и пользовательские замены превышают лимит '+engine.limits.maxPhones+'. Удалите ненужные замены.');
    return resolved;
  }
  root.VoiceDigits=Object.freeze({version,example,supports:language=>recipes.has(language),read,resolve});
})(globalThis);
