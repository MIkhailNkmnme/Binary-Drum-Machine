/* ГОЛ-003/004: sound alphabet first; the original 69 names remain explicitly legacy.
   Scores are descriptions, not sampled audio. Durations are seconds in the public API.
   Е/Ё/Ю/Я use an isolated initial j+vowel; this is not a contextual reading rule. */
(function(root){
  'use strict';
  const russian=[
    ['А','а','a:350'],['Б','бэ','b:75 e:290'],['В','вэ','v:130 e:290'],
    ['Г','гэ','g:85 e:290'],['Д','дэ','d:75 e:290'],['Е','е','j:100 e:280'],
    ['Ё','ё','j:100 o:280'],['Ж','жэ','zh:150 e:290'],['З','зэ','z:150 e:290'],
    ['И','и','i:350'],['Й','и краткое','i:190 _:55 k:70 r:70 a:190 t:55 k:65 ax:80 j:60 e:100'],
    ['К','ка','k:85 a:290'],['Л','эль','e:260 lj:150'],['М','эм','e:260 m:150'],
    ['Н','эн','e:260 n:150'],['О','о','o:350'],['П','пэ','p:85 e:290'],
    ['Р','эр','e:260 r:150'],['С','эс','e:260 s:180'],['Т','тэ','t:80 e:290'],
    ['У','у','u:350'],['Ф','эф','e:260 f:180'],['Х','ха','h:140 a:290'],
    ['Ц','цэ','ts:155 e:290'],['Ч','че','ch:155 e:290'],['Ш','ша','sh:170 a:290'],
    ['Щ','ща','shj:190 a:290'],
    ['Ъ','твёрдый знак','t:55 vj:85 o:180 r:70 d:55 y:90 j:45 _:55 z:90 n:65 a:160 k:85'],
    ['Ы','ы','y:350'],['Ь','мягкий знак','mj:85 j:50 a:160 h:55 kj:65 i:90 j:45 _:55 z:90 n:65 a:160 k:85'],
    ['Э','э','e:350'],['Ю','ю','j:100 u:280'],['Я','я','j:100 a:280']
  ];
  const english=[
    ['A','ay','e:220 i:110'],['B','bee','b:75 i:290'],['C','cee','s:150 i:290'],
    ['D','dee','d:75 i:290'],['E','ee','i:350'],['F','ef','e:240 f:170'],
    ['G','gee','dzh:130 i:290'],['H','aitch','e:180 i:90 ch:170'],['I','eye','a:210 i:150'],
    ['J','jay','dzh:130 e:210 i:90'],['K','kay','k:90 e:220 i:90'],['L','el','e:250 l:140'],
    ['M','em','e:250 m:150'],['N','en','e:250 n:150'],['O','oh','o:240 u:100'],
    ['P','pee','p:85 i:290'],['Q','cue','k:90 j:85 u:250'],['R','ar','a:270 rr:150'],
    ['S','ess','e:240 s:180'],['T','tee','t:80 i:290'],['U','you','j:100 u:280'],
    ['V','vee','v:120 i:290'],['W','double u','d:65 a:160 b:65 ax:95 l:90 _:55 j:80 u:230'],
    ['X','ex','e:220 k:65 s:150'],['Y','why','w:110 a:200 i:130'],['Z','zee','z:140 i:290']
  ];
  const digits=[
    ['0','ноль','n:100 o:260 lj:130'],['1','один','ax:130 dj:75 i:250 n:120'],
    ['2','два','d:65 v:100 a:300'],['3','три','t:70 rj:90 i:290'],
    ['4','четыре','ch:110 i:90 t:65 y:220 rj:75 e:110'],
    ['5','пять','pj:80 j:60 a:270 tj:90'],['6','шесть','sh:150 e:270 s:95 tj:80'],
    ['7','семь','sj:135 e:270 mj:130'],['8','восемь','v:95 o:220 sj:100 i:95 mj:110'],
    ['9','девять','dj:75 e:200 vj:85 i:100 tj:85']
  ];
  const soundRows=[
    ['А','а','a:320','a'],['Б','б','b:110','b'],['В','в','v:180','v'],
    ['Г','г','g:110','g'],['Д','д','d:110','d'],['Е','й + е','j:80 e:260','e'],
    ['Ё','й + о','j:80 o:260','yo'],['Ж','ж','zh:200','zh'],['З','з','z:180','z'],
    ['И','и','i:320','i'],['Й','короткий й','j:80','j'],['К','к','k:110','k'],
    ['Л','л','l:180','l'],['М','м','m:180','m'],['Н','н','n:180','n'],
    ['О','о','o:320','o'],['П','п','p:110','p'],['Р','р','r:180','r'],
    ['С','с','s:200','s'],['Т','т','t:110','t'],['У','у','u:320','u'],
    ['Ф','ф','f:200','f'],['Х','х','h:200','h'],['Ц','ц','ts:180','ts'],
    ['Ч','ч','ch:180','ch'],['Ш','ш','sh:200','sh'],['Щ','щ','shj:220','shch'],
    ['Ъ','без собственного звука','',''],['Ы','ы','y:320','y'],
    ['Ь','без собственного звука','',''],['Э','э','e:320','eh'],
    ['Ю','й + у','j:80 u:260','yu'],['Я','й + а','j:80 a:260','ya']
  ];
  function parse(text){return Object.freeze(text?text.split(' ').map(token=>{const [id,ms]=token.split(':');return Object.freeze({id,duration:Number(ms)/1000});}):[]);}
  function group(rows,lang,kind){return rows.map(([symbol,label,text])=>Object.freeze({
    id:lang+'-'+kind+'-'+symbol.codePointAt(0).toString(16),lang,kind,symbol,label,
    score:parse(text)
  }));}
  const legacy=Object.freeze([...group(russian,'ru','letter'),...group(digits,'ru','digit'),...group(english,'en','letter')]
    .map(item=>Object.freeze({...item,kind:item.kind==='letter'?'name':'digit',legacy:true})));
  let soundingIndex=0;
  const sounds=soundRows.map(([symbol,label,text,slug],index)=>Object.freeze({
    id:'ru-sound-'+symbol.codePointAt(0).toString(16),lang:'ru',kind:'sound',symbol,label,
    silent:!text,alphabetIndex:index+1,score:parse(text),
    file:text?String(++soundingIndex).padStart(2,'0')+'-'+slug+'.wav':null,
    positional:['Е','Ё','Ю','Я'].includes(symbol)?'Изолированный начальный вариант й + гласный; внутри слова возможен иной звук.':null
  }));
  root.VoiceLegacyCatalog=legacy;
  root.VoiceCatalog=Object.freeze([...sounds,...legacy.filter(item=>item.kind==='digit'||item.lang==='en'),...(root.VoiceGerman?.catalog||[]),...(root.VoiceLetters?.catalog||[])]);
})(globalThis);
