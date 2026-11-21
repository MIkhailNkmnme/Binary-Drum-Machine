/* ГОЛ-005: isolated engine profiles; explicit, cancellable rendering and playback. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id),R=globalThis.VoiceEngines;
  const KEY='zerkalius.voice.editor.v2',OLD='zerkalius.voice.editor.v1',clone=v=>JSON.parse(JSON.stringify(v));
  const SHARED_KEY=KEY+'.library',LAST_ENGINE_KEY=KEY+'.current-engine';
  const TEXT_FADE=.004;
  const engineStorageKey=id=>KEY+'.engine.'+id;
  if(!R||!globalThis.VoiceEnglish||!globalThis.VoiceDigits||!globalThis.VoiceLetters||!globalThis.VoiceLanguages||!globalThis.VoiceProsody||!globalThis.VoiceText||!globalThis.VoiceWaveform||!Array.isArray(globalThis.VoiceCatalog)){$('status').textContent='Компоненты редактора не загрузились. Обновите страницу после доставки файлов.';return;}
  const speechField=$('speech-text');
  const speechHighlight=$('text-cursor');
  const waveform=VoiceWaveform({
    track:$('speech-wave'),canvas:$('speech-wave-canvas'),seek:$('speech-wave-seek'),
    head:$('speech-wave-head'),highlight:$('speech-wave-range'),time:$('speech-wave-time'),
    zoom:$('speech-wave-zoom'),full:$('speech-wave-full'),clear:$('speech-wave-clear'),
    onSeek:seekTextWave,onRange:changeTextAudioRange
  });
  const DEFAULT_SPEECH=speechField.value;
  const PLAIN_RUSSIAN_EXAMPLE=DEFAULT_SPEECH.split('\n',1)[0].replace(/\u0301/g,'');
  const RUSSIAN_NAMES_START=DEFAULT_SPEECH.lastIndexOf('\n')+1;
  const PREVIOUS_RUSSIAN_EXAMPLE=DEFAULT_SPEECH.slice(0,RUSSIAN_NAMES_START)+'Б В Г Д Ж З Й К Л М Н П Р С Т Ф Х Ц Ч Ш Щ';
  const engineTabs=[...$('engine-tabs').querySelectorAll('[data-engine]')];
  const topicTabs=[...$('voice-tabs').querySelectorAll('[role="tab"]')];
  const enginePages={};
  const SPEECH_EXAMPLES={...VoiceLanguages.examples,ru:DEFAULT_SPEECH,en:VoiceEnglish.example,de:'9876543210 Hallo Welt! Am frühen Morgen öffnet Käthe die Tür und grüßt den Bäcker. Draußen zwitschern Vögel, während ein weißer Fuchs über die grüne Wiese läuft. Jürgen trägt süße Äpfel, frisches Brot und zwölf kleine Bücher zur großen Mühle. Am klaren Quellbach malt Julia ein Quadrat, und Felix spielt Xylophon. Sylvia hört die fröhliche Musik und übt später Yoga. Max und Yvonne erzählen vom Zoo, von hübschen Häusern und einem heißen Sommer. Zum Abschied winken alle freundlich und wünschen sich viel Glück, Wärme und schöne Träume.'};
  const speechCatalog=[...VoiceCatalog,...(globalThis.VoiceLegacyCatalog||[])];
  const alphabetExamples=Object.fromEntries(Object.keys(SPEECH_EXAMPLES).map(language=>{
    const symbols=speechCatalog.filter(r=>r.lang===language&&r.kind==='name'&&Array.from(r.symbol).length===1)
      .map(r=>r.symbol);
    return [language,[...new Set(symbols)].join(' ')];
  }));
  const PREVIOUS_EXAMPLES={fr:[VoiceDigits.example],it:[VoiceDigits.example],es:[VoiceDigits.example],ja:[VoiceDigits.example],en:['Hello! 0 1 2 3.'],ru:['Привет, Зеркалиус! 0 1 2 3.','0123456789 Текст для проверки голоса. Утром 0 юный фотограф 1 Фёдор поднялся на холм, где 2 жёлтый фургон стоял у въезда. Рыжий ёж 3 шуршал в траве, а маленький щенок 4 прыгал через лужи. В центре двора 5 музыкант объяснял, как звучат флейта, цимбалы и бубен. Затем 6 Юлия и Яков съели хлеб, выпили чай и ещё раз произнесли фразу. Эхо 7 отвечало из чащи: «Здравствуй, мир!» Вечером 8 экскурсовод проверил объём ящика, а 9 белый конь спокойно ждал у двери.'],de:['Ich heiße Zerkalius. Schön! 0 1 2 3.']};
  const russianLetterNames=(globalThis.VoiceLegacyCatalog||[]).filter(entry=>entry.lang==='ru'&&entry.kind==='name');
  function letterTrial(count,separator,previous=false){
    return russianLetterNames.filter(({symbol})=>previous||!['Ъ','Ь'].includes(symbol)).map(({symbol,label})=>{
      const name=label[0].toUpperCase()+label.slice(1),letter=symbol.toLowerCase();
      const repeated=!previous&&!separator&&symbol==='Ю'?'й'+'у'.repeat(count):Array(count).fill(letter).join(separator);
      const line=name+', '+repeated;
      if(previous)return line;
      if(VoiceText.pairedConsonants.includes(symbol))return line+', '+letter+'ъ, '+letter+'ь';
      if('ЖШЦ'.includes(symbol))return line+', '+letter+'ъ';
      if('ЙЧЩ'.includes(symbol))return line+', '+letter+'ь';
      return line;
    }).join('\n');
  }
  const LETTER_TRIALS={joined:letterTrial(22,''),spaced:letterTrial(10,' ')};
  const OLD_LETTER_TRIALS={joined:letterTrial(22,'',true),spaced:letterTrial(10,' ',true)};
  const isFactoryText=(text,language)=>text===SPEECH_EXAMPLES[language]
    ||(language==='ru'&&(text===PLAIN_RUSSIAN_EXAMPLE||text===PREVIOUS_RUSSIAN_EXAMPLE))
    ||(PREVIOUS_EXAMPLES[language]||[]).includes(text);
  const state={engineId:R.defaultId||'robot',profiles:{},library:[],languages:[],silent:false,kind:'sound',compareMode:'profiles',legacyDraft:null,speechText:DEFAULT_SPEECH,speechLanguage:'ru',speechSpell:false,speechProsody:{...VoiceProsody.defaults},speechPlayback:{rate:1,volume:1},speechCaret:0};
  for(const item of R.list){const e=R.get(item.id);state.profiles[item.id]={settings:{...e.defaults},phones:{},userPhones:{}};}
  let E=R.get(state.engineId),worker=null,jobId=0,epoch=0,revision=0,importTicket=0;
  let context=null,source=null,sourceDone=null,textOutput=null,textLevel=null,current=null,selectedId='';
  let activeTopic='tab-text',compactTabs=new Set();
  let candidates=[],comparisons=[],paused=false,sequencePlaying=false,hold=null;
  let robotManifest=null,alphabetManifest=null,originalError='';
  let textCache=null,wholeTextCache=null,textRun=null,textFrame=0,textBusy=false,textMarked=-1,textSpans=[];
  let speechSelectionEnd=0,pendingTextSeek=null;
  const nodes=new Map(),choices=new Map(),frames=[];
  const fadingTextSources=new Map();
  const textPlaybackControls=new Map();
  const profile=()=>state.profiles[state.engineId],label=id=>R.list.find(x=>x.id===id)?.label||id;
  const status=text=>{$('status').textContent=text;},active=t=>t===epoch;
  const safeId=id=>typeof id==='string'&&/^[a-zA-Z_][a-zA-Z0-9_-]{0,31}$/.test(id)&&!['__proto__','prototype','constructor'].includes(id);
  function engine(id){if(!R.list.some(x=>x.id===id))throw Error('Неизвестный движок: '+id);return R.get(id);}
  function finite(v,min,max,name){const n=Number(v);if(v===''||!Number.isFinite(n)||n<min||n>max)throw Error(name+': допустимо '+min+'…'+max);return n;}
  function decorateCommand(command){
    if(command.matches('button'))command.type='button';
    if(!command.title)command.title=command.textContent.trim();
    if(!command.hasAttribute('aria-label'))command.setAttribute('aria-label',command.title);
    const name=document.createElement('span');
    name.className='gz-nm';
    name.textContent=command.textContent;
    const icon=document.createElement('span');
    icon.className='gz-ic';
    icon.setAttribute('aria-hidden','true');
    const mask=document.createElement('span');
    mask.className='gz-mask';
    icon.append(mask);
    command.replaceChildren(icon,name);
    commandIcon(command,command.dataset.miIcon);
  }
  function commandIcon(command,kind){
    if(kind)command.dataset.miIcon=kind;
    const mask=command.querySelector('.gz-mask');
    if(mask&&globalThis.ZerkMenuIcons)mask.style.setProperty('--gz-mask',ZerkMenuIcons.iconFor(command));
  }
  function caption(id,text){const command=$(id);(command.querySelector('.gz-nm')||command).textContent=text;}
  function button(text,action,title=text,icon){
    const command=document.createElement('button');
    command.className='gz-hx';
    command.textContent=text;
    command.title=title;
    if(icon)command.dataset.miIcon=icon;
    decorateCommand(command);
    command.addEventListener('click',action);
    return command;
  }
  function option(select,value,text){const o=document.createElement('option');o.value=value;o.textContent=text;select.append(o);}
  function endHold(){if(hold){clearTimeout(hold.delay);clearInterval(hold.timer);hold=null;}}
  function cancelWorker(){if(worker){const old=worker;worker=null;old.terminate();old.reject(Error('Расчёт отменён.'));}}
  function retireSource(fade=true){
    if(!fade)for(const [old,disconnect] of fadingTextSources){
      try{old.stop();}catch{}
      disconnect();
    }
    if(source){
      const old=source,output=textOutput;
      source=null;textOutput=null;old.onended=null;
      const disconnect=()=>{
        fadingTextSources.delete(old);
        old.onended=null;
        old.disconnect();
        output?.node.disconnect();
      };
      if(fade&&output&&context.state==='running'){
        const now=context.currentTime,end=now+TEXT_FADE,gain=output.node.gain;
        const level=Math.max(0,Math.min(1,(now-output.startedAt)/TEXT_FADE));
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(level,now);
        gain.linearRampToValueAtTime(0,end);
        fadingTextSources.set(old,disconnect);
        old.onended=disconnect;
        try{old.stop(end);}catch{disconnect();}
      }else{
        try{old.stop();}catch{}
        disconnect();
      }
    }
    if(sourceDone){const done=sourceDone;sourceDone=null;done();}
  }
  function pauseControls(enabled){for(const id of ['pause','compare-pause']){$(id).disabled=!enabled;caption(id,paused?'Продолжить':'Пауза');$(id).title=paused?'Продолжить последовательное прослушивание':'Приостановить последовательное прослушивание';$(id).setAttribute('aria-label',$(id).title);commandIcon($(id),paused?'play':'pause');}}
  function stopAudio(except=null){stopTextUI();retireSource();sequencePlaying=false;paused=false;pauseControls(false);document.querySelectorAll('audio').forEach(a=>{if(a!==except)a.pause();});}
  function begin(except=null){epoch++;cancelWorker();stopAudio(except);return epoch;}
  function capturePage(){
    const {speechText,speechLanguage,speechSpell,speechProsody,speechPlayback,speechCaret,kind,silent,compareMode,variationSeed}=state;
    return {
      speechText,speechLanguage,speechSpell,speechProsody,speechPlayback:{...speechPlayback},speechCaret,kind,silent,compareMode,variationSeed,
      topic:activeTopic,compactTabs:[...compactTabs],
      editor:{title:$('title').value,symbol:$('symbol').value,lang:$('lang-code').value,langName:$('lang-name').value,
        scoreText:$('score').value,recipeId:selectedId,recipeMode:$('recipe-mode').value,recipeLanguage:$('language').value,
        phone:$('phone').value,tokenMs:$('token-ms').value},
      variation:{seed:$('variation-seed').value,spread:$('spread').value,count:$('variant-count').value,
        keys:[...choices].filter(([,n])=>n.checked).map(([key])=>key)}
    };
  }
  function save(){
    const page=capturePage();
    enginePages[state.engineId]=page;
    try{
      localStorage.setItem(engineStorageKey(state.engineId),JSON.stringify({page,profile:profile()}));
      localStorage.setItem(LAST_ENGINE_KEY,state.engineId);
    }
    catch{status('Браузер не сохранил настройки. Экспортируйте JSON.');}
  }
  function saveLibrary(){
    const {library,languages,legacyDraft}=state;
    try{localStorage.setItem(SHARED_KEY,JSON.stringify({library,languages,legacyDraft}));}
    catch{status('Браузер не сохранил библиотеку. Экспортируйте JSON.');}
  }
  function readEngineStorage(id){
    const stored=JSON.parse(localStorage.getItem(engineStorageKey(id)));
    if(!stored)return;
    const current=stored.profile,e=engine(id);
    state.profiles[id]={settings:settingsFrom(current.settings,e),phones:validatePhones(current.phones||{},e),userPhones:validatePhones(current.userPhones||{},e)};
    if(stored.page&&typeof stored.page==='object')enginePages[id]=stored.page;
  }
  function invalidate(text='Изменения сохранены. Для живого WAV заново нажмите «Слушать».'){revision++;importTicket++;begin();current=null;textCache=null;wholeTextCache=null;waveform.setResult(null);$('text-wav').disabled=true;$('text-json').disabled=true;$('wav').disabled=true;$('prosody-note').textContent='Параметры изменены. Нажмите «Плей» для нового разбора.';$('prosody-trace').replaceChildren();if(comparisons.length)$('compare-status').textContent='Ниже предыдущие снимки. Вычислите сравнение заново для текущих настроек.';status(text);save();}
  function settingsFrom(value,e=E){if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Неверные настройки.');const out={};for(const p of e.parameters){if(!Object.hasOwn(value,p.key))throw Error('Нет параметра '+p.key);out[p.key]=finite(value[p.key],p.min,p.max,p.label);}return e.normalize(out);}
  function languagePhones(e,overrides,score){const phones=globalThis.VoiceGerman?VoiceGerman.resolve(e,overrides,score):clone(overrides);return VoiceLanguages.resolve(e,VoiceEnglish.resolve(e,phones,score),score);}
  function validatePhone(value,e=E){
    if(!value||typeof value!=='object'||Array.isArray(value)||!e.kinds.some(k=>k.id===value.kind))throw Error('Неизвестный тип фонемы.');const l=e.limits,out={kind:value.kind};
    for(const [key,min,max]of [['formants',l.minFrequency,l.maxFrequency],['bandwidths',l.minBandwidth,l.maxBandwidth],['weights',0,l.maxWeight]]){if(!Array.isArray(value[key])||value[key].length!==4)throw Error('Нужны четыре значения '+key);out[key]=value[key].map(v=>finite(v,min,max,key));}
    out.voice=finite(value.voice,0,l.maxVoice,'Голос');out.noise=finite(value.noise,0,l.maxNoise,'Шум');return out;
  }
  function validatePhones(value,e=E){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>e.limits.maxPhones)throw Error('Неверный словарь фонем или превышен лимит.');const out={};for(const [id,p]of Object.entries(value)){if(!safeId(id))throw Error('Неверный ID фонемы: '+id);out[id]=validatePhone(p,e);}return out;}
  function validateScore(value,settings,phones,e=E){
    if(!Array.isArray(value)||!value.length||value.length>e.limits.maxSegments)throw Error('Партитура: от 1 до '+e.limits.maxSegments+' сегментов.');let samples=0;
    return value.map(t=>{if(!t||!safeId(t.id)||(!e.phonemeIds.includes(t.id)&&!Object.hasOwn(phones,t.id)))throw Error(label(e.engineId||state.engineId)+': неизвестная фонема '+t?.id);const duration=finite(t.duration,.01,4,'Длительность');samples+=Math.round(duration/settings.speed*e.limits.sampleRate);if(samples>e.limits.maxSeconds*e.limits.sampleRate)throw Error('После применения скорости звучание превышает '+e.limits.maxSeconds+' секунд.');return {id:t.id,duration};});
  }
  function parseText(){const text=$('score').value.trim();if(!text)throw Error('Добавьте токены в партитуру.');return text.split(/\s+/).map(t=>{const m=/^([a-zA-Z_][a-zA-Z0-9_-]*):(\d+(?:\.\d+)?)$/.exec(t);if(!m)throw Error('Ожидается токен:миллисекунды: '+t);return {id:m[1],duration:Number(m[2])/1000};});}
  function readControls(){profile().settings=settingsFrom(Object.fromEntries([...nodes].map(([key,n])=>[key,n.number.value])));}
  function readSpeechProsody(){return VoiceProsody.normalize({mode:$('speech-mode').value,expressiveness:finite($('speech-expression').value,0,100,'Выразительность'),contour:$('speech-contour').value,transitionMs:finite($('speech-coherence').value,0,80,'Связность речи')});}
  function syncSpeechProsody(){const p=state.speechProsody;$('speech-mode').value=p.mode;$('speech-expression').value=p.expressiveness;$('speech-contour').value=p.contour;$('speech-coherence').value=p.transitionMs;for(const id of ['speech-expression','speech-contour','speech-coherence'])$(id).disabled=p.mode==='original';}
  function recipeNow(){
    readControls();const p=profile(),lang=$('lang-code').value.trim().toLowerCase(),title=$('title').value.trim();if(!/^[a-z][a-z0-9-]{0,15}$/.test(lang)||!title)throw Error('Введите название и код языка (латинские буквы, цифры, дефис).');const silent=state.silent&&!$('score').value.trim();
    const score=silent?[]:parseText(),phones=languagePhones(E,p.phones,score);
    return {engineId:state.engineId,engineVersion:E.version,title:title.slice(0,100),symbol:$('symbol').value.slice(0,16),lang,kind:state.kind,silent,score:silent?[]:validateScore(score,p.settings,phones),settings:clone(p.settings),phones:clone(phones),...(state.variationSeed!==undefined?{variationSeed:state.variationSeed}:{})};
  }
  function validateRecipe(v,legacy=false){
    if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Неверный рецепт.');const engineId=legacy?'bank':v.engineId,e=engine(engineId);
    if(typeof v.title!=='string'||!v.title.trim()||v.title.length>100||typeof v.symbol!=='string'||v.symbol.length>16||typeof v.lang!=='string'||!/^[a-z][a-z0-9-]{0,15}$/.test(v.lang))throw Error('Неверное название, символ или язык.');
    const settings=settingsFrom(v.settings,e),phones=validatePhones(v.phones||{},e),silent=v.silent===true&&Array.isArray(v.score)&&!v.score.length;
    return {engineId,engineVersion:typeof v.engineVersion==='string'?v.engineVersion.slice(0,100):e.version,title:v.title,symbol:v.symbol,lang:v.lang,kind:['sound','name','digit'].includes(v.kind)?v.kind:'sound',silent,settings,phones,score:silent?[]:validateScore(v.score,settings,phones,e),...(v.variationSeed!==undefined?{variationSeed:finite(v.variationSeed,0,4294967295,'Семя перебора')}:{})};
  }
  function scoreText(score){return score.map(t=>t.id+':'+Number((t.duration*1000).toFixed(3))).join(' ');}
  function syncParameters(){
    const disabled=new Set(E.capabilities?.disabledParameters||[]);for(const p of E.parameters){const n=nodes.get(p.key),v=profile().settings[p.key],off=disabled.has(p.key);n.number.value=v;n.range.value=v;n.output.textContent=v;for(const control of [n.number,n.range,n.left,n.right])control.disabled=off;choices.get(p.key).disabled=off;n.host.title=off?'Этот параметр не действует в выбранном движке.':p.label;n.frame.sync();}
    const count=E.capabilities?.formantCount||4;for(let i=0;i<4;i++){const box=$('formant-'+i);box.hidden=i>=count;for(const n of box.querySelectorAll('input'))n.disabled=i>=count;$('bandwidths'+i).min=E.limits.minBandwidth;$('formants'+i).min=E.limits.minFrequency;}
    $('engine-info').textContent=label(state.engineId)+' · '+E.version+' · '+count+' форманты. '+(E.capabilities?.outputGainMeaning||'')+' '+(E.capabilities?.note||'')+(count===3?' Четвёртая форманта не используется и скрыта.':'');
    $('text-engine').textContent=label(state.engineId)+' · высота '+profile().settings.pitchStart+' → '+profile().settings.pitchEnd+' Гц · скорость '+profile().settings.speed;
  }
  function buildParameters(){
    const picked=new Map([...choices].map(([key,n])=>[key,n.checked]));endHold();for(const f of frames)f.dispose?.();frames.length=0;nodes.clear();choices.clear();$('parameters').replaceChildren();$('variation-fields').replaceChildren();
    for(const p of E.parameters){
      const wrap=document.createElement('div');wrap.className='parameter';const text=document.createElement('label');text.textContent=p.label;text.htmlFor='param-'+p.key;
      const number=document.createElement('input');Object.assign(number,{type:'number',id:text.htmlFor,min:p.min,max:p.max,step:p.step});number.setAttribute('aria-label',p.label);
      const host=document.createElement('div'),middle=document.createElement('div'),range=document.createElement('input'),output=document.createElement('output');Object.assign(range,{type:'range',min:p.min,max:p.max,step:p.step});range.setAttribute('aria-label',p.label);
      const update=value=>{try{profile().settings[p.key]=finite(value,p.min,p.max,p.label);profile().settings=E.normalize(profile().settings);syncParameters();invalidate();}catch(e){status(e.message);}},step=direction=>update(Math.min(p.max,Math.max(p.min,Number(profile().settings[p.key])+direction*p.step)));
      const arrow=(symbol,direction,title)=>{
        const control=document.createElement('button');
        control.type='button';control.textContent=symbol;control.title=title;
        control.setAttribute('aria-label',title);
        control.addEventListener('click',event=>{if(!event.detail)step(direction);});
        return control;
      };
      const left=arrow('◀',-1,'Уменьшить: '+p.label),right=arrow('▶',1,'Увеличить: '+p.label);middle.append(range,output);host.append(left,middle,right);wrap.append(text,number,host);$('parameters').append(wrap);
      const frame=ZerkControlFrame.attach(host,left,middle,right,{input:range,output,valueInThumb:true});frames.push(frame);nodes.set(p.key,{number,range,output,left,right,host,frame});number.addEventListener('input',()=>invalidate());number.addEventListener('change',()=>update(number.value));range.addEventListener('input',()=>update(range.value));
      const choice=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=picked.has(p.key)?picked.get(p.key):['pitchStart','pitchEnd','formantScale'].includes(p.key);choice.append(check,document.createTextNode(p.label));$('variation-fields').append(choice);choices.set(p.key,check);check.addEventListener('change',save);
      for(const [side,direction]of [[left,-1],[right,1]])side.addEventListener('pointerdown',e=>{if(e.button!==0||side.disabled)return;endHold();step(direction);hold={delay:null,timer:null};const mine=hold;mine.delay=setTimeout(()=>{if(hold!==mine)return;mine.timer=setInterval(()=>{if(side.disabled){endHold();return;}const before=profile().settings[p.key];step(direction);if(profile().settings[p.key]===before)endHold();},90);},350);});
    }
  }
  function switchEngine(id){
    E=engine(id);endHold();state.engineId=id;
    $('voice-layout').dataset.engine=id;
    for(const tab of engineTabs){
      if(tab.dataset.engine===id)tab.setAttribute('aria-current','page');
      else tab.removeAttribute('aria-current');
    }
    document.title=label(id)+' · '+$('voice-name').textContent+' '+$('voice-version').textContent;
    buildParameters();refreshPhones();syncParameters();
  }
  function allRecipes(){const unique=[...new Map(speechCatalog.map(r=>[r.id,r])).values()];return [...unique.map(r=>({...r,title:r.label,builtin:true})),...state.library];}
  function refreshLanguages(wanted=$('language').value||'ru'){const map=new Map([['ru','Русский'],['en','English'],['de','Deutsch'],['fr','Français'],['it','Italiano'],['es','Español'],['ja','日本語']]);for(const x of state.languages)map.set(x.code,x.label);for(const r of allRecipes())if(!map.has(r.lang))map.set(r.lang,r.lang);$('language').replaceChildren();for(const [code,text]of map)option($('language'),code,text);$('language').value=map.has(wanted)?wanted:'ru';$('lang-name').value=map.get($('language').value);}
  function refreshRecipes(wanted=''){const select=$('recipe');select.replaceChildren();option(select,'','Выберите рецепт');for(const r of allRecipes().filter(r=>r.lang===$('language').value&&(r.own||r.kind==='digit'||r.kind===$('recipe-mode').value)))option(select,r.id,(r.symbol||'')+' · '+r.title+(r.silent?' · немая':'')+(r.own?' · '+label(r.engineId):''));if(state.legacyDraft)option(select,'legacy:v1','Черновик из v1 · Банк');if(state.engineId==='robot')for(const r of E.sourceProfiles||[])option(select,'source:'+r.id,'Исходный робот · '+r.label);select.value=wanted;$('delete-recipe').disabled=!state.library.some(r=>r.id===wanted);}
  function applyLegacyDraft(){
    const d=state.legacyDraft;if(!d)return;begin();openEngine('bank',{navigate:true});selectTopic('tab-score');profile().settings=clone(d.settings);profile().phones=clone(d.phones);selectedId='legacy:v1';state.kind=d.kind;state.silent=d.silent;state.variationSeed=undefined;
    $('title').value=d.title;$('symbol').value=d.symbol;$('lang-code').value=d.lang;$('score').value=d.scoreText;$('recipe-mode').value=d.kind==='name'?'name':'sound';refreshLanguages(d.lang);refreshRecipes(selectedId);refreshPhones();syncParameters();updateOriginals();invalidate('Открыт сохранённый черновик v1 в Банке. Исходная копия остаётся в списке; звук не запущен.');
  }
  function applyRecipe(r,id=''){
    begin();if(!r.builtin){const changed=r.engineId!==state.engineId;openEngine(r.engineId,{navigate:true});if(changed)selectTopic('tab-score');profile().settings=clone(r.settings);profile().phones=clone(r.phones);}else profile().phones=clone(profile().userPhones);
    selectedId=id;state.silent=r.silent===true;state.kind=r.kind||'sound';state.variationSeed=r.variationSeed;$('title').value=r.title||r.label||'';$('symbol').value=r.symbol||'';$('lang-code').value=r.lang||'ru';$('score').value=scoreText(r.score);if(r.kind==='name'||r.kind==='sound')$('recipe-mode').value=r.kind;
    refreshLanguages(r.lang);refreshRecipes(id);refreshPhones();syncParameters();updateOriginals();invalidate('Рецепт загружен · '+label(state.engineId)+'. Звук выключен до нажатия «Слушать».');if(r.engineVersion&&r.engineVersion!==E.version)status('Рецепт открыт в '+E.version+'; сохранён с '+r.engineVersion+'. Побайтное совпадение не обещается.');
  }
  function refreshPhones(wanted=$('phone').value){const p=profile(),ids=[...new Set([...E.phonemeIds,...(globalThis.VoiceGerman?.phoneIds||[]),...VoiceEnglish.phoneIds,...VoiceLanguages.phoneIds,...Object.keys(p.userPhones),...Object.keys(p.phones)])];$('phone').replaceChildren();for(const id of ids)option($('phone'),id,id+' · '+(E.phoneLabels?.[id]||globalThis.VoiceGerman?.phoneLabels[id]||VoiceEnglish.phoneLabels[id]||VoiceLanguages.phoneLabels[id]||id)+(Object.hasOwn(p.phones,id)?' · свой':''));$('phone').value=ids.includes(wanted)?wanted:ids[0];showPhone();}
  function showPhone(){const id=$('phone').value,p=profile().phones[id]||profile().userPhones[id]||globalThis.VoiceGerman?.getPhone(state.engineId,id)||VoiceEnglish.getPhone(state.engineId,id)||VoiceLanguages.getPhone(state.engineId,id)||E.getPhone(id);if(!p)return;$('phone-id').value=id;$('phone-kind').value=p.kind;for(const key of ['formants','bandwidths','weights'])for(let i=0;i<4;i++)$(key+i).value=p[key][i];$('phone-voice').value=p.voice;$('phone-noise').value=p.noise;$('phone-status').textContent=label(state.engineId)+' · '+(E.phoneLabels?.[id]||globalThis.VoiceGerman?.phoneLabels[id]||VoiceEnglish.phoneLabels[id]||VoiceLanguages.phoneLabels[id]||id);}
  for(const k of E.kinds)option($('phone-kind'),k.id,k.label);
  for(let i=0;i<4;i++){const box=document.createElement('div');box.className='formant';box.id='formant-'+i;const title=document.createElement('strong');title.textContent='Форманта '+(i+1);box.append(title);for(const [key,text,min,max,step]of [['formants','Частота, Гц',20,9922.5,.5],['bandwidths','Полоса, Гц',20,4000,1],['weights','Вес',0,4,.01]]){const l=document.createElement('label');l.textContent=text;const n=document.createElement('input');Object.assign(n,{type:'number',id:key+i,min,max,step});l.append(n);box.append(l);}$('phone-formants').append(box);}
  function render(recipe){cancelWorker();const id=++jobId;return new Promise((resolve,reject)=>{const w=new Worker('render-worker.js?v=027');worker=w;w.reject=reject;w.onmessage=event=>{if(worker!==w||event.data.id!==id)return;worker=null;w.terminate();if(event.data.type==='error'){reject(Error(event.data.error?.message||'Ошибка синтеза.'));return;}const result=event.data.result;if(event.data.type!=='result'||result?.engineId!==recipe.engineId){reject(Error('Движок вернул несовместимый результат.'));return;}resolve(result);};w.onerror=event=>{if(worker===w)worker=null;w.terminate();reject(Error(event.message||'Worker не загрузился.'));};w.postMessage({id,engineId:recipe.engineId,score:recipe.score,settings:recipe.settings,phones:recipe.phones,...(recipe.prosody?{prosody:recipe.prosody}:{})});});}
  async function unlock(){context ||= new (window.AudioContext||window.webkitAudioContext)();await context.resume();}
  function play(result){return new Promise(resolve=>{if(!context||context.state!=='running'){resolve();return;}retireSource();const buffer=context.createBuffer(1,result.samples.length,result.sampleRate);buffer.copyToChannel(result.samples,0);const node=context.createBufferSource();node.buffer=buffer;node.connect(context.destination);source=node;sourceDone=resolve;node.onended=()=>{node.disconnect();if(source===node){source=null;sourceDone=null;}resolve();};node.start();});}
  function snapshot(recipe,result){return {...clone(recipe),engineId:result.engineId,engineVersion:result.engineVersion,settings:clone(result.settings),phones:clone(result.phones)};}
  function markText(index){
    if(index===textMarked)return;if(textMarked>=0)textSpans[textMarked]?.classList.remove('speaking');textMarked=index;
    const currentSpan=textSpans[index];
    if(currentSpan){
      currentSpan.classList.add('speaking');
      if(document.activeElement!==speechField&&speechHighlight.clientHeight){
        const bounds=currentSpan.getBoundingClientRect(),view=speechHighlight.getBoundingClientRect();
        const topDelta=bounds.top-view.top,bottomDelta=bounds.bottom-view.bottom;
        if(topDelta<0)speechField.scrollTop+=topDelta;
        else if(bottomDelta>0)speechField.scrollTop+=bottomDelta;
        syncSpeechHighlightScroll();
      }
    }
    showSpeechPosition();
  }
  function speechCharacterIndex(position=state.speechCaret){return Array.from(speechField.value.slice(0,position)).length;}
  function speechSelection(){
    return speechSelectionEnd>state.speechCaret?{start:state.speechCaret,end:speechSelectionEnd}:null;
  }
  function sameSpeechSelection(a,b){return a?.start===b?.start&&a?.end===b?.end;}
  function showSpeechPosition(){
    const at=$('text-position');
    if(!textSpans.length){at.textContent='';return;}
    if(textMarked>=0){at.textContent=(textRun?.node?'Звучит символ ':'Пауза на символе ')+(textMarked+1)+' / '+textSpans.length;return;}
    if(speechSelection()){
      at.textContent='Повтор выделения · '+(speechCharacterIndex()+1)+'–'+speechCharacterIndex(speechSelectionEnd)+' / '+textSpans.length;
      return;
    }
    at.textContent=state.speechCaret===speechField.value.length?'Курсор в конце · пуск с начала':'Пуск с символа '+(speechCharacterIndex()+1)+' / '+textSpans.length;
  }
  function rememberSpeechCaret(persist=true){
    const {selectionStart,selectionEnd}=speechField;
    const moved=selectionStart!==state.speechCaret;
    if(!moved&&selectionEnd===speechSelectionEnd)return;
    state.speechCaret=selectionStart;
    speechSelectionEnd=selectionEnd;
    showSpeechPosition();
    if(persist){
      if(!textRun){pendingTextSeek=null;waveform.clearRange();}
      seekPausedText();
      textButton();
      if(moved)save();
    }
  }
  function restoreSpeechCaret(position){
    state.speechCaret=Number.isInteger(position)?Math.max(0,Math.min(position,speechField.value.length)):0;
    speechSelectionEnd=state.speechCaret;
    speechField.setSelectionRange(state.speechCaret,speechSelectionEnd);
  }
  function accentedExampleCaret(position){
    if(!Number.isInteger(position))return 0;
    let offset=0;
    for(const char of DEFAULT_SPEECH){
      if(char!=='\u0301'){
        if(position<=0)break;
        position-=char.length;
      }
      offset+=char.length;
    }
    return offset;
  }
  function consonantNameCaret(position){
    if(!Number.isInteger(position)||position<=RUSSIAN_NAMES_START)return position;
    // The old row alternated one letter and one space. Keep the same letter
    // and side of its name, even when that name contains several words.
    const previousOffset=Math.min(position,PREVIOUS_RUSSIAN_EXAMPLE.length)-RUSSIAN_NAMES_START;
    const ordinal=Math.floor(previousOffset/2);
    const names=DEFAULT_SPEECH.slice(RUSSIAN_NAMES_START).split(', ');
    const before=names.slice(0,ordinal).reduce((offset,name)=>offset+name.length+2,RUSSIAN_NAMES_START);
    return before+(previousOffset%2?names[ordinal].length:0);
  }
  function syncSpeechHighlightScroll(){
    speechHighlight.scrollTop=speechField.scrollTop;
    speechHighlight.scrollLeft=speechField.scrollLeft;
  }
  function syncSpeechHighlight(){
    speechHighlight.style.width=speechField.clientWidth+'px';
    speechHighlight.style.height=speechField.clientHeight+'px';
    syncSpeechHighlightScroll();
  }
  function drawTextCursor(){
    const elements=[];
    textSpans=[];
    for(const char of speechField.value){
      // Keep the accent and its vowel in the same highlight box.
      if(char==='\u0301'&&elements.length){
        const previous=elements.at(-1);
        previous.textContent+=char;
        textSpans.push(previous);
      }else{
        const span=document.createElement('span');
        span.textContent=char;
        textSpans.push(span);
        elements.push(span);
      }
    }
    // The textarea reserves a blank line after a final newline.
    if(speechField.value.endsWith('\n'))elements.push('\u200b');
    speechHighlight.replaceChildren(...elements);
    textMarked=-1;
    syncSpeechHighlight();
    showSpeechPosition();
  }
  function textButton(){
    const command=$('text-play'),playing=Boolean(textRun?.node);
    if(command.dataset.playing==='true'&&!playing&&command.matches(':hover'))command.classList.add('quiet-hover');
    caption('text-play',playing?'Пауза':'Плей');
    command.dataset.playing=String(playing);
    command.setAttribute('aria-disabled',String(textBusy));
    const selection=speechSelection();
    const continuing=textRun&&sameSpeechSelection(selection,textRun.selection);
    command.title=playing?'Пауза · приостановить чтение':textBusy?'Плей · подготовка звука'
      :continuing?'Плей · продолжить чтение':selection?'Плей · повторять выделение':'Плей · начать чтение с курсора';
    command.setAttribute('aria-label',command.title);
    commandIcon(command,playing?'pause':'play');
    waveform.setEnabled(Boolean(textCache)&&!textBusy);
  }
  function cancelTextFrame(){
    if(textFrame)cancelAnimationFrame(textFrame);
    textFrame=0;
  }
  function stopTextUI(){
    cancelTextFrame();
    if(textBusy||textRun)$('text-status').textContent='Текст остановлен.';
    textBusy=false;
    textRun=null;
    pendingTextSeek=null;
    waveform.setPosition(0);
    markText(-1);
    textButton();
  }
  function showProsodyTrace(trace,duration=null,parts=0){
    const p=trace.config,sources={manual:'вручную',yo:'ё',dict:'открытый словарь',unknown:'неизвестно, нейтрально',catalog:'каталожная цифра','count-word':'название цифры','letter-name':'названия букв или слоги','en-dictionary':'EN · словарь произношения','en-rules':'EN · приближённые правила',...Object.fromEntries(['fr','it','es','ja'].flatMap(lang=>[[lang+'-dictionary',lang.toUpperCase()+' · ручной рецепт'],[lang+'-rules',lang.toUpperCase()+' · приближённые правила']]))},contours={auto:'по знакам препинания',flat:'без добавочного контура',question:'вопрос',statement:'утверждение'};
    $('prosody-note').textContent=(p.mode==='original'?'Исходно, без наложения просодии. ':'Речь · выразительность '+p.expressiveness+' · контур '+contours[p.contour]+' · связность '+p.transitionMs+' мс. ')+trace.note+(duration===null?'':' Фактически: '+duration.toFixed(3)+' с, частей '+parts+'. Параметры каждой части доступны в паспорте JSON.');
    const list=$('prosody-trace');list.replaceChildren();for(const word of trace.words){const item=document.createElement('li');item.textContent=word.word+' — '+(sources[word.source]||word.source)+(word.stressIndex===null?'':'; ударная гласная в позиции '+(word.stressIndex+1));list.append(item);}
  }
  async function prepareText(ticket,text){
    readControls();const e=E,engineId=state.engineId,settings=clone(profile().settings),phones=clone(profile().phones),language=state.speechLanguage,spell=state.speechSpell,prosody=readSpeechProsody();
    const key=JSON.stringify({engineId,version:e.version,germanVersion:globalThis.VoiceGerman?.version,englishVersion:VoiceEnglish.version,digitsVersion:VoiceDigits.version,lettersVersion:VoiceLetters.version,languagesVersion:VoiceLanguages.version,spell,plannerVersion:VoiceProsody.version,prosody,settings,phones,text,language});
    const cached=[textCache,wholeTextCache].find(entry=>entry?.key===key);
    if(cached){
      textCache=cached;
      showProsodyTrace(cached.trace,cached.result.duration,cached.passport.parts.length);
      return cached;
    }
    const plan=VoiceText.plan({text,language,spell,catalog:speechCatalog,engine:e,settings,phones,prosody});showProsodyTrace(plan.prosody);
    const pieces=[],timeline=[],parts=[];let offset=0,actual=null;
    for(let i=0;i<plan.chunks.length;i++){
      if(!active(ticket))return null;const chunk=plan.chunks[i];$('text-status').textContent='Вычисляю текст · '+label(engineId)+' · часть '+(i+1)+' / '+plan.chunks.length;
      const result=await render({engineId,score:chunk.score,settings,phones:plan.phones,...(chunk.prosody?{prosody:chunk.prosody}:{})});if(!active(ticket))return null;
      if(result.sampleRate!==plan.rate)throw Error('Изменилась частота дискретизации между частями текста.');const boundaries=VoiceText.tokenBoundaries(result);
      for(const mark of chunk.marks){const start=boundaries[mark.from],end=boundaries[mark.to],indices=mark.indices||[mark.index];if(end>start)for(let j=0;j<indices.length;j++)timeline.push({index:indices[j],start:offset+start+Math.floor((end-start)*j/indices.length),end:offset+start+Math.floor((end-start)*(j+1)/indices.length)});}
      const end=boundaries[boundaries.length-1];if(result.samples.length>end)timeline.push({index:-1,start:offset+end,end:offset+result.samples.length});
      pieces.push(result.samples);offset+=result.samples.length;actual=result;
      parts.push({score:clone(result.score),settings:clone(result.settings),appliedProsody:result.appliedProsody?clone(result.appliedProsody):null,diagnosticLimits:result.diagnosticLimits?clone(result.diagnosticLimits):null,segmentBoundaries:result.segmentBoundaries?clone(result.segmentBoundaries):null,sampleCount:result.samples.length,duration:result.duration,legacyExact:result.legacyExact===true});
      if(offset>VoiceText.maxSeconds*plan.rate)throw Error('Готовый круг превысил лимит '+VoiceText.maxSeconds+' секунд. Сократите текст.');
    }
    if(!offset||!actual)throw Error('Нет звучащего текста.');const samples=new Float32Array(offset);let at=0;for(const piece of pieces){samples.set(piece,at);at+=piece.length;}
    const passport={format:'zerkalius-voice-text',version:1,text,language,engineId,engineVersion:actual.engineVersion,plannerVersion:VoiceProsody.version,germanVersion:globalThis.VoiceGerman?.version,englishVersion:VoiceEnglish.version,digitsVersion:VoiceDigits.version,lettersVersion:VoiceLetters.version,languagesVersion:VoiceLanguages.version,spell,controls:clone(prosody),settings:clone(actual.settings),phones:clone(actual.phones),stressTrace:clone(plan.prosody.words),parts,sampleRate:plan.rate,sampleCount:offset,duration:offset/plan.rate,timeline:clone(timeline)};
    const cache={key,text,language,timeline,trace:plan.prosody,passport,result:{samples,sampleRate:plan.rate,duration:offset/plan.rate,engineId,engineVersion:actual.engineVersion,settings:clone(actual.settings),phones:clone(actual.phones),seed:actual.seed}};
    if(!active(ticket))return null;
    textCache=cache;
    if(text===speechField.value)wholeTextCache=cache;
    $('text-wav').disabled=false;$('text-json').disabled=false;
    showProsodyTrace(plan.prosody,cache.result.duration,parts.length);
    return cache;
  }
  function runningTextSample(run,now=context.currentTime){
    const start=run.audioRange?.start??0;
    const elapsed=Math.max(0,now-run.rateAt)*run.buffer.sampleRate*run.rate;
    return start+(run.offset-start+Math.floor(elapsed))%run.loopBuffer.length;
  }
  function setTextAudioRange(run,range){
    run.audioRange=range;
    run.loopBuffer=run.buffer;
    if(!range)return;
    if(range.start===0&&range.end===run.buffer.length)return;
    // Taper only the preview clip. Keep the original waveform and WAV intact.
    const rate=run.buffer.sampleRate,length=range.end-range.start;
    const loop=context.createBuffer(1,length,rate);
    loop.copyToChannel(run.cache.result.samples.subarray(range.start,range.end),0);
    const samples=loop.getChannelData(0),fade=Math.min(Math.round(rate*.003),Math.floor((length-1)/2));
    for(let i=0;i<fade;i++){
      const weight=i/fade;
      samples[i]*=weight;
      samples[length-1-i]*=weight;
    }
    run.loopBuffer=loop;
  }
  function markTextSample(run,sample){
    waveform.setPosition(sample);
    const mark=run.cache.timeline.find(entry=>sample>=entry.start&&sample<entry.end);
    markText(mark&&mark.index>=0?mark.index+run.characterOffset:-1);
  }
  function sampleAtCaret(cache,caretIndex){
    return cache.timeline.find(mark=>mark.index>=caretIndex&&mark.end>mark.start)?.start??0;
  }
  function seekPausedText(){
    const run=textRun;
    if(!run||run.node)return;
    const selection=speechSelection();
    if(!sameSpeechSelection(selection,run.selection)){
      markText(-1);
      $('text-status').textContent=selection?'Пауза. «Плей» повторит выделенный фрагмент.':'Пауза. «Плей» начнёт с курсора.';
      return;
    }
    if(!selection){
      const offset=sampleAtCaret(run.cache,speechCharacterIndex());
      clearAudioRangeOutside(run,offset);
      run.offset=offset;
    }
    markTextSample(run,run.offset);
    $('text-status').textContent=selection?'Пауза. «Плей» продолжит выделенный фрагмент.':'Пауза. «Плей» начнёт с нового места.';
  }
  function pauseText(run){
    run.offset=runningTextSample(run);
    run.node=null;
    cancelTextFrame();
    retireSource();
    markTextSample(run,run.offset);
    showSpeechPosition();
    textButton();
    $('text-status').textContent='Пауза. Можно переставить курсор или изменить выделение.';
  }
  function startTextRun(run,ticket,delay=.03){
    const node=context.createBufferSource(),output=context.createGain();
    node.buffer=run.loopBuffer;
    node.loop=true;
    node.connect(output);
    if(!textLevel){
      textLevel=context.createGain();
      textLevel.gain.value=state.speechPlayback.volume;
      textLevel.connect(context.destination);
    }
    output.connect(textLevel);
    run.startedAt=context.currentTime+delay;
    run.rateAt=run.startedAt;
    run.rate=state.speechPlayback.rate;
    node.playbackRate.value=run.rate;
    output.gain.setValueAtTime(0,run.startedAt);
    output.gain.linearRampToValueAtTime(1,run.startedAt+TEXT_FADE);
    source=run.node=node;
    textOutput={node:output,startedAt:run.startedAt};
    node.start(run.startedAt,(run.offset-(run.audioRange?.start??0))/run.buffer.sampleRate);
    textBusy=false;
    textButton();
    markTextSample(run,run.offset);
    const {result,passport}=run.cache;
    const duration=run.loopBuffer.length/run.buffer.sampleRate;
    const repeat=run.audioRange?'Повтор участка дорожки':run.selection?'Повтор выделения':'Повтор текста';
    $('text-status').textContent=repeat+' · '+(passport.controls.mode==='speech'?'Речь':'Исходно')+' · '+label(result.engineId)+' · '+duration.toFixed(2)+' с на круг · seed '+result.seed+'.';
    const tick=()=>{
      textFrame=0;
      if(!active(ticket)||source!==node)return;
      if(context.currentTime>=run.startedAt)markTextSample(run,runningTextSample(run));
      textFrame=requestAnimationFrame(tick);
    };
    textFrame=requestAnimationFrame(tick);
  }
  function moveTextRun(run,offset){
    run.offset=offset;
    if(run.node){
      cancelTextFrame();
      retireSource();
      startTextRun(run,epoch,0);
    }else{
      markTextSample(run,offset);
      $('text-status').textContent='Пауза. «Плей» продолжит с позиции на дорожке.';
    }
  }
  function outsideAudioRange(range,offset){
    return range&&(offset<range.start||offset>=range.end);
  }
  function clearAudioRangeOutside(run,offset){
    if(!outsideAudioRange(run.audioRange,offset))return;
    waveform.clearRange();
    setTextAudioRange(run,null);
  }
  function seekTextWave(offset){
    if(textBusy)return;
    const run=textRun;
    if(!run){
      if(!textCache)return;
      if(outsideAudioRange(waveform.getRange(),offset))waveform.clearRange();
      pendingTextSeek={result:textCache.result,offset};
      waveform.setPosition(offset);
      return;
    }
    clearAudioRangeOutside(run,offset);
    moveTextRun(run,offset);
  }
  function changeTextAudioRange(range){
    if(textBusy)return;
    const run=textRun;
    if(!run){
      if(range){
        pendingTextSeek=null;
        waveform.setPosition(range.start);
      }
      return;
    }
    const offset=range?.start??(run.node?runningTextSample(run):run.offset);
    setTextAudioRange(run,range);
    moveTextRun(run,offset);
  }
  function seekPlayingText(){
    rememberSpeechCaret();
    const run=textRun;
    if(!run){pendingTextSeek=null;waveform.clearRange();return;}
    if(!run.node||speechSelection())return;
    if(run.selection){
      cancelTextFrame();
      retireSource();
      // A plain click ends the fragment loop and uses the full text.
      run.node=null;
      void playText();
      return;
    }
    seekTextWave(sampleAtCaret(run.cache,speechCharacterIndex()));
  }
  async function playText(){
    if(textBusy)return;
    if(document.activeElement!==speechField){
      const {selectionStart,selectionEnd,selectionDirection}=speechField;
      speechField.focus({preventScroll:true});
      speechField.setSelectionRange(selectionStart,selectionEnd,selectionDirection);
    }
    rememberSpeechCaret();
    const heldRun=textRun;
    if(heldRun?.node){pauseText(heldRun);return;}
    const selection=speechSelection();
    const resume=heldRun&&sameSpeechSelection(selection,heldRun.selection);
    const queuedSeek=pendingTextSeek;
    const ticket=resume?epoch:begin();
    textBusy=true;
    textButton();
    try{
      if(resume){
        await unlock();
        if(active(ticket))startTextRun(heldRun,ticket);
        return;
      }
      // Slice before synthesis so the loop contains only the selected text.
      // Convert the field's UTF-16 offset for the Unicode highlight timeline.
      const text=selection?speechField.value.slice(selection.start,selection.end):speechField.value;
      const caretIndex=speechCharacterIndex();
      drawTextCursor();
      // Plan before opening the audio device: silent signs and invalid text
      // never create an AudioContext, a zero-length buffer or a repeat task.
      readControls();const preflight=VoiceText.plan({text,language:state.speechLanguage,spell:state.speechSpell,catalog:speechCatalog,engine:E,settings:profile().settings,phones:profile().phones,prosody:readSpeechProsody()});showProsodyTrace(preflight.prosody);
      await unlock();if(!active(ticket))return;const cache=await prepareText(ticket,text);if(!cache||!active(ticket))return;
      const result=cache.result,buffer=context.createBuffer(1,result.samples.length,result.sampleRate);
      buffer.copyToChannel(result.samples,0);
      textRun={buffer,cache,selection,characterOffset:selection?caretIndex:0,offset:selection?0:sampleAtCaret(cache,caretIndex)};
      waveform.setResult(result);
      const range=waveform.getRange();
      setTextAudioRange(textRun,range);
      if(queuedSeek?.result===result)textRun.offset=queuedSeek.offset;
      else if(range)textRun.offset=range.start;
      startTextRun(textRun,ticket);
    }catch(e){if(active(ticket)){stopTextUI();retireSource();$('text-status').textContent='Текст: '+e.message;}}
  }
  function applyTextPlayback(key,value){
    state.speechPlayback[key]=value;
    if(key==='volume'){
      if(textLevel)textLevel.gain.setTargetAtTime(value,context.currentTime,.012);
      return;
    }
    const run=textRun;
    if(!run?.node)return;
    const now=context.currentTime;
    run.offset=runningTextSample(run,now);
    run.rateAt=Math.max(now,run.startedAt);
    run.rate=value;
    run.node.playbackRate.setValueAtTime(value,run.rateAt);
  }
  function buildTextPlaybackControls(){
    for(const [key,name,min,max,step,format] of [
      ['rate','Скорость',.25,3,.05,value=>value.toFixed(2)+'×'],
      ['volume','Громкость',0,1,.01,value=>Math.round(value*100)+'%']
    ]){
      const host=document.createElement('div'),middle=document.createElement('div');
      const range=document.createElement('input'),output=document.createElement('output');
      host.className='voice-number-slider';
      Object.assign(range,{type:'range',id:'speech-playback-'+key,min,max,step,value:1,title:name+' прослушивания'});
      range.setAttribute('aria-label',range.title);
      output.setAttribute('aria-hidden','true');
      const placeValue=()=>{
        const width=middle.clientWidth,natural=output.offsetWidth;
        if(!width||!natural)return;
        // The 14 px native thumb travels between its half-width insets.
        const marker=7+(width-14)*(range.valueAsNumber-min)/(max-min),gap=5;
        const left=marker-gap,right=width-marker-gap;
        const before=natural<=left||(natural>right&&left>=right);
        const room=before?left:right,scale=Math.min(1,room/natural);
        output.style.left=(before?left-natural*scale:marker+gap)+'px';
        output.style.transform='scaleX('+scale+')';
      };
      const arrow=(direction,symbol)=>{
        const side=document.createElement('button');
        side.type='button';side.textContent=symbol;side.title=(direction<0?'Уменьшить ':'Увеличить ')+name.toLowerCase();
        side.setAttribute('aria-label',side.title);
        const nudge=()=>{
          const previous=range.valueAsNumber;
          if(direction<0)range.stepDown();else range.stepUp();
          if(range.valueAsNumber===previous)return false;
          update();save();return true;
        };
        side.addEventListener('click',event=>{if(!event.detail)nudge();});
        side.addEventListener('pointerdown',event=>{
          if(event.button!==0)return;
          endHold();
          if(!nudge())return;
          hold={delay:null,timer:null};
          const mine=hold;
          mine.delay=setTimeout(()=>{
            if(hold===mine)mine.timer=setInterval(()=>{if(!nudge())endHold();},90);
          },350);
        });
        return side;
      };
      const update=()=>{
        const value=range.valueAsNumber;
        output.textContent=format(value);
        range.setAttribute('aria-valuetext',output.textContent);
        placeValue();
        applyTextPlayback(key,value);
      };
      const left=arrow(-1,'‹'),right=arrow(1,'›');
      middle.append(range,output);host.append(left,middle,right);
      $('speech-playback-controls').append(host);
      ZerkControlFrame.attach(host,left,middle,right,{input:range,output});
      for(const side of [left,right])side.querySelector('.zcf-outline path').setAttribute('d','M12 .7 23.3 12 12 23.3 .7 12Z');
      if(globalThis.ResizeObserver)new ResizeObserver(placeValue).observe(middle);
      range.addEventListener('input',update);
      range.addEventListener('change',save);
      textPlaybackControls.set(key,{range,update});
    }
  }
  buildTextPlaybackControls();
  $('text-play').onclick=playText;$('text-stop').onclick=()=>{begin();$('text-status').textContent='Текст остановлен.';};
  $('text-play').addEventListener('mousedown',event=>{
    if(event.button===0&&document.activeElement===speechField)event.preventDefault();
  });
  $('text-play').addEventListener('pointerleave',()=>$('text-play').classList.remove('quiet-hover'));
  speechField.addEventListener('scroll',syncSpeechHighlightScroll,{passive:true});
  if(globalThis.ResizeObserver)new ResizeObserver(syncSpeechHighlight).observe(speechField);
  for(const name of ['selectionchange','select','keyup','pointerup','blur'])speechField.addEventListener(name,()=>rememberSpeechCaret());
  speechField.addEventListener('click',seekPlayingText);
  speechField.addEventListener('input',()=>{state.speechText=speechField.value;rememberSpeechCaret(false);invalidate('Текст изменён. Следующий «Плей» вычислит его заново.');drawTextCursor();});
  function useSpeechExample(text=SPEECH_EXAMPLES[state.speechLanguage]){
    state.speechText=text;
    speechField.value=state.speechText;
    restoreSpeechCaret(0);
    speechField.scrollTop=0;
    speechField.scrollLeft=0;
    drawTextCursor();
  }
  function setSpeechSpell(spell){
    state.speechSpell=spell;
    $('speech-reading').value=spell?'letters':'default';
  }
  function isSpeechSample(text,language){
    return isFactoryText(text,language)||text===alphabetExamples[language]
      ||language==='ru'&&Object.values(LETTER_TRIALS).includes(text);
  }
  $('speech-language').onchange=()=>{
    const text=speechField.value,language=state.speechLanguage;
    const factory=isSpeechSample(text,language);
    state.speechLanguage=$('speech-language').value;
    if(factory)useSpeechExample(state.speechSpell?alphabetExamples[state.speechLanguage]:undefined);
    invalidate('Язык текстового чтения изменён. Нажмите «Плей».');
  };
  $('speech-reading').onchange=()=>{
    const factory=isSpeechSample(speechField.value,state.speechLanguage);
    setSpeechSpell($('speech-reading').value==='letters');
    if(factory)useSpeechExample(state.speechSpell?alphabetExamples[state.speechLanguage]:undefined);
    invalidate('Способ чтения изменён. Нажмите «Плей».');
  };
  $('text-alphabet').onclick=()=>{
    setSpeechSpell(true);
    useSpeechExample(alphabetExamples[state.speechLanguage]);
    invalidate('Алфавит выбранного языка вставлен.');
    $('text-status').textContent='Нажмите «Плей», чтобы прослушать алфавит, или выделите часть.';
    speechField.focus({preventScroll:true});
  };
  $('text-example').onclick=()=>{
    setSpeechSpell(false);
    useSpeechExample();
    invalidate('Исходный пример выбранного языка восстановлен.');
    $('text-status').textContent='Исходный текст восстановлен.';
  };
  function loadLetterTrial(mode){
    $('speech-language').value=state.speechLanguage='ru';
    setSpeechSpell(false);
    useSpeechExample(LETTER_TRIALS[mode]);
    invalidate('В поле 31 строка пробы русских букв.');
    $('text-status').textContent='Проба букв. Нажмите «Плей» или выделите одну строку.';
    speechField.focus({preventScroll:true});
  }
  $('text-letters-joined').onclick=()=>loadLetterTrial('joined');
  $('text-letters-spaced').onclick=()=>loadLetterTrial('spaced');
  $('text-wav').onclick=()=>{if(textCache)download('zerkalius-'+textCache.result.engineId+'-text-cycle.wav',wav(textCache.result));};
  $('text-json').onclick=()=>{if(textCache)download('zerkalius-'+textCache.result.engineId+'-text-cycle.json',new Blob([JSON.stringify(textCache.passport,null,2)],{type:'application/json'}));};
  for(const id of ['speech-mode','speech-expression','speech-contour','speech-coherence'])$(id).addEventListener(id==='speech-expression'||id==='speech-coherence'?'input':'change',()=>{
    try{state.speechProsody=id==='speech-mode'&&$('speech-mode').value==='original'?{...state.speechProsody,mode:'original'}:readSpeechProsody();syncSpeechProsody();invalidate('Просодия изменена. Следующий «Плей» вычислит новый круг.');}
    catch(e){invalidate('Проверьте настройки просодии.');$('text-status').textContent=e.message;}
  });
  async function listen(){const ticket=begin();try{const recipe=recipeNow();if(recipe.silent){current=null;$('wav').disabled=true;status('Немой знак: собственного звука нет; синтез и AudioContext не запускаются.');return;}await unlock();if(!active(ticket))return;status('Живой синтез · '+label(recipe.engineId)+'…');const result=await render(recipe);if(!active(ticket))return;current={recipe:snapshot(recipe,result),result};$('wav').disabled=false;status('Живой '+label(result.engineId)+' · '+result.duration.toFixed(2)+' с · '+result.engineVersion+' · seed '+result.seed+(result.legacyExact?' · точный исходный профиль':''));await play(result);}catch(e){if(active(ticket))status(e.message);}}
  async function listenSnapshot(card){const ticket=begin();try{await unlock();if(!active(ticket))return;status('Снимок · '+label(card.result.engineId)+' · '+card.recipe.title);await play(card.result);}catch(e){if(active(ticket))status(e.message);}}
  async function playSequence(cards,name){const ticket=begin();try{await unlock();if(!active(ticket))return;sequencePlaying=true;pauseControls(true);for(let i=0;i<cards.length&&active(ticket);i++){status(name+' '+(i+1)+' / '+cards.length+' · '+label(cards[i].result.engineId));await play(cards[i].result);}if(active(ticket)){sequencePlaying=false;pauseControls(false);status('Последовательное прослушивание завершено.');}}catch(e){if(active(ticket))status(e.message);}}
  function download(name,blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function wav(result){const n=result.samples.length,buffer=new ArrayBuffer(44+n*2),v=new DataView(buffer),text=(at,s)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i));};text(0,'RIFF');v.setUint32(4,36+n*2,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,result.sampleRate,true);v.setUint32(28,result.sampleRate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,n*2,true);for(let i=0;i<n;i++){const x=Math.max(-1,Math.min(1,result.samples[i]));v.setInt16(44+i*2,Math.round(x*(x<0?32768:32767)),true);}return new Blob([buffer],{type:'audio/wav'});}
  function saveOwn(recipe){if(state.library.length>=128)throw Error('В библиотеке уже 128 рецептов.');const valid=validateRecipe(recipe),id='own-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);state.library.push({...valid,id,own:true});selectedId=id;refreshLanguages(valid.lang);refreshRecipes(id);saveLibrary();save();}
  function renderCards(hostId,cards){
    const host=$(hostId);host.replaceChildren();for(const [i,c]of cards.entries()){const row=document.createElement('article');row.className='candidate';const title=document.createElement('h3');title.textContent=c.label||'Вариант '+(i+1);const info=document.createElement('p');row.append(title);if(c.error){info.textContent='Не вычислен: '+c.error;row.append(info);host.append(row);continue;}
      const e=engine(c.result.engineId);info.textContent=label(c.result.engineId)+' ['+c.result.engineId+'] · '+c.result.engineVersion+' · seed '+c.result.seed+(c.variationSeed!==undefined?' · семя перебора '+c.variationSeed:'')+'. '+e.parameters.map(p=>p.label+': '+c.recipe.settings[p.key]).join(' · ')+'. Замены фонем: '+(Object.keys(c.recipe.phones).join(', ')||'нет');
      const actions=document.createElement('div');actions.className='commands';actions.append(button('Слушать',()=>listenSnapshot(c),'Прослушать снимок '+label(c.result.engineId),'play'),button('Применить',()=>applyRecipe(c.recipe),'Применить рецепт и профиль '+label(c.result.engineId),'copy'),button('Сохранить',()=>{try{saveOwn({...c.recipe,title:(c.recipe.title+' · '+(c.label||'вариант')).slice(0,100)});status('Снимок сохранён с движком, настройками и фонемами.');}catch(err){status(err.message);}},'Сохранить снимок рецепта','save'));row.append(info,actions);host.append(row);
    }
  }
  function rng(seed){let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
  $('generate').onclick=async()=>{const ticket=begin();try{
    const base=recipeNow();if(base.silent)throw Error('Немой знак не имеет звуковых вариантов.');const e=engine(base.engineId),seed=finite($('variation-seed').value,0,4294967295,'Семя')>>>0,spread=finite($('spread').value,0,100,'Размах')/100,count=Math.trunc(finite($('variant-count').value,1,8,'Число вариантов')),keys=[...choices].filter(([,n])=>n.checked&&!n.disabled).map(([key])=>key);if(!keys.length)throw Error('Выберите действующий параметр для перебора.');candidates=[];renderCards('candidates',candidates);$('sequence').disabled=true;const random=rng(seed);
    for(let i=0;i<count&&active(ticket);i++){const settings={...base.settings};for(const key of keys){const p=e.parameters.find(p=>p.key===key),v=Math.max(p.min,Math.min(p.max,settings[key]+(random()*2-1)*(p.max-p.min)*spread));settings[key]=Math.max(p.min,Math.min(p.max,Number((p.min+Math.round((v-p.min)/p.step)*p.step).toFixed(8))));}const recipe={...clone(base),settings:e.normalize(settings),variationSeed:seed};validateScore(recipe.score,recipe.settings,recipe.phones,e);$('variant-status').textContent='Вычисляю '+(i+1)+' / '+count;const result=await render(recipe);if(!active(ticket))return;candidates.push({recipe:snapshot(recipe,result),result,variationSeed:seed,label:'Вариант '+(i+1)});renderCards('candidates',candidates);$('sequence').disabled=false;}
    if(active(ticket)){$('variant-status').textContent='Готово '+candidates.length+' снимков · '+label(base.engineId)+'. Прослушивание запускается отдельно.';save();}
  }catch(e){if(active(ticket))$('variant-status').textContent=e.message;}};
  $('compare-render').onclick=async()=>{const ticket=begin();try{
    const base=recipeNow();if(base.silent)throw Error('Немой знак не имеет собственного звука ни в одном движке.');comparisons=[];renderCards('engine-comparison',comparisons);$('compare-sequence').disabled=true;
    for(const item of R.list){if(!active(ticket))return;const e=engine(item.id),p=state.profiles[item.id],recipe={...clone(base),engineId:item.id,engineVersion:e.version,settings:state.compareMode==='common'?e.normalize(base.settings):clone(p.settings),phones:{}};
      try{recipe.phones=languagePhones(e,p.phones,recipe.score);validateScore(recipe.score,recipe.settings,recipe.phones,e);$('compare-status').textContent='Вычисляю '+item.label;const result=await render(recipe);if(!active(ticket))return;comparisons.push({recipe:snapshot(recipe,result),result,label:item.label});}catch(err){if(!active(ticket))return;comparisons.push({label:item.label,error:err.message});}
      renderCards('engine-comparison',comparisons);$('compare-sequence').disabled=!comparisons.some(c=>c.result);
    }
    if(active(ticket))$('compare-status').textContent='Готовы снимки '+comparisons.filter(c=>c.result).length+' / '+R.list.length+'. Прослушивание запускается отдельно.';
  }catch(e){if(active(ticket))$('compare-status').textContent=e.message;}};
  $('listen').onclick=listen;$('stop').onclick=$('compare-stop').onclick=()=>{begin();status('Остановлено.');};$('sequence').onclick=()=>playSequence(candidates,'Вариант');$('compare-sequence').onclick=()=>playSequence(comparisons.filter(c=>c.result),'Сравнение');
  $('compare-mode').onchange=()=>{state.compareMode=$('compare-mode').value;invalidate('Режим сравнения изменён. Вычислите новые снимки.');};
  $('pause').onclick=$('compare-pause').onclick=async()=>{if(!sequencePlaying||!context)return;const ticket=epoch,next=!paused;pauseControls(false);try{if(next)await context.suspend();else await context.resume();if(!active(ticket))return;paused=next;pauseControls(true);}catch(e){if(active(ticket)){pauseControls(true);status(e.message);}}};
  $('wav').onclick=()=>{if(current)download('zerkalius-'+current.result.engineId+'-live.wav',wav(current.result));};
  $('reset-profile').onclick=()=>{const p=profile();p.settings={...E.defaults};p.phones={};p.userPhones={};state.variationSeed=undefined;endHold();syncParameters();refreshPhones();invalidate('Исходный профиль '+label(state.engineId)+' восстановлен без запуска звука.');};
  $('recipe-mode').onchange=()=>{selectedId='';refreshRecipes();save();};$('language').onchange=()=>{if($('language').value==='en')$('recipe-mode').value='name';else if(['ru','de'].includes($('language').value))$('recipe-mode').value='sound';selectedId='';refreshRecipes();$('lang-code').value=$('language').value;$('lang-name').value=$('language').selectedOptions[0].textContent;updateOriginals();invalidate();};
  $('recipe').onchange=()=>{try{const id=$('recipe').value;if(!id){selectedId='';$('delete-recipe').disabled=true;save();return;}if(id==='legacy:v1'){applyLegacyDraft();return;}if(id.startsWith('source:')){const r=E.sourceProfiles?.find(x=>x.id===id.slice(7));if(r)applyRecipe({...r,title:r.label,symbol:r.symbol||'',lang:'ru',kind:'name',silent:false,engineId:'robot',engineVersion:E.version},id);return;}const r=allRecipes().find(x=>x.id===id);if(r)applyRecipe(r,id);}catch(e){status(e.message);}};
  for(const id of ['title','symbol','lang-code','score'])$(id).addEventListener('input',()=>{if(id==='score')state.silent=false;if(id==='symbol'||id==='lang-code')updateOriginals();invalidate();});
  for(const id of ['lang-name','token-ms'])$(id).addEventListener('input',save);
  $('phone').addEventListener('change',save);
  $('save-recipe').onclick=()=>{try{saveOwn(recipeNow());status('Свой рецепт сохранён локально.');}catch(e){status(e.message);}};
  $('delete-recipe').onclick=()=>{state.library=state.library.filter(r=>r.id!==selectedId);selectedId='';refreshRecipes();saveLibrary();save();status('Свой рецепт удалён из библиотеки.');};
  $('save-language').onclick=()=>{try{const code=$('lang-code').value.trim().toLowerCase(),text=$('lang-name').value.trim();if(!/^[a-z][a-z0-9-]{0,15}$/.test(code)||!text||text.length>60)throw Error('Введите код языка и название до 60 знаков.');if(state.languages.length>=32&&!state.languages.some(x=>x.code===code))throw Error('Лимит: 32 своих языка.');state.languages=state.languages.filter(x=>x.code!==code);state.languages.push({code,label:text});selectedId='';refreshLanguages(code);refreshRecipes();saveLibrary();save();status('Язык сохранён. Добавьте свои буквы.');}catch(e){status(e.message);}};
  $('export-recipe').onclick=()=>{try{const recipe=recipeNow();download('zerkalius-'+recipe.engineId+'-recipe.json',new Blob([JSON.stringify({format:'zerkalius-voice-recipe',version:2,engineId:recipe.engineId,engineVersion:E.version,recipe},null,2)],{type:'application/json'}));}catch(e){status(e.message);}};
  $('import-recipe').onclick=()=>$('import-file').click();$('import-file').onchange=async()=>{
    const file=$('import-file').files[0];$('import-file').value='';if(!file)return;const ticket=++importTicket,at=revision,action=epoch;
    try{
      if(file.size>1024*1024)throw Error('JSON больше 1 МиБ.');const text=await file.text();if(ticket!==importTicket||at!==revision||!active(action))return;
      const data=JSON.parse(text);if(data.format!=='zerkalius-voice-recipe'||![1,2].includes(data.version))throw Error('Неизвестная схема рецепта.');
      if(data.version===2&&(data.engineId!==data.recipe?.engineId||typeof data.engineVersion!=='string'||!data.engineVersion||data.engineVersion!==data.recipe?.engineVersion))throw Error('Движок или версия паспорта не совпадают с рецептом.');
      const input=data.version===1?{...data.recipe,engineVersion:data.engineVersion||data.recipe?.engineVersion}:data.recipe;
      const recipe=validateRecipe(input,data.version===1);if(ticket!==importTicket||at!==revision||!active(action))return;applyRecipe(recipe);
      status('JSON v'+data.version+' импортирован как '+label(recipe.engineId)+' без запуска звука.'+(recipe.engineVersion!==E.version?' Внимание: сохранён с '+recipe.engineVersion+', открыт в '+E.version+'; побайтное совпадение не обещается.':''));
    }catch(e){if(ticket===importTicket&&active(action))status('Импорт: '+e.message);}
  };
  $('phone').onchange=showPhone;$('save-phone').onclick=()=>{try{const id=$('phone-id').value.trim(),p=profile();if(!safeId(id))throw Error('ID: буква или _, затем латинские буквы/цифры/_/-; до 32 знаков.');if(Object.keys(p.phones).length>=E.limits.maxPhones&&!Object.hasOwn(p.phones,id))throw Error('Достигнут лимит активных фонем.');if(Object.keys(p.userPhones).length>=E.limits.maxPhones&&!Object.hasOwn(p.userPhones,id))throw Error('Достигнут лимит банка фонем.');const value={kind:$('phone-kind').value,voice:$('phone-voice').value,noise:$('phone-noise').value};for(const key of ['formants','bandwidths','weights'])value[key]=[0,1,2,3].map(i=>$(key+i).value);const phone=validatePhone(value);p.phones[id]=phone;p.userPhones[id]=clone(phone);refreshPhones(id);invalidate();$('phone-status').textContent='Фонема '+id+' сохранена в профиле '+label(state.engineId)+'.';}catch(e){$('phone-status').textContent=e.message;}};
  $('reset-phone').onclick=()=>{const id=$('phone-id').value.trim();delete profile().phones[id];delete profile().userPhones[id];refreshPhones(id);invalidate();$('phone-status').textContent='Замена удалена только из текущего движка.';};
  $('insert-phone').onclick=()=>{try{const id=$('phone-id').value.trim();if(!safeId(id)||(!Object.hasOwn(profile().phones,id)&&!E.phonemeIds.includes(id)&&!globalThis.VoiceGerman?.getPhone(state.engineId,id)&&!VoiceEnglish.getPhone(state.engineId,id)))throw Error('Сначала сохраните новый ID в активном рецепте.');const ms=finite($('token-ms').value,10,4000,'Длительность');$('score').value=$('score').value.trim()+($('score').value.trim()?' ':'')+id+':'+ms;state.silent=false;invalidate();}catch(e){$('phone-status').textContent=e.message;}};
  function audioOwner(audio){audio.addEventListener('play',()=>{begin(audio);status('Оригинал WAV · '+(audio.dataset.label||'сохранённый файл')+'. Регуляторы не меняют эту запись.');});}
  document.querySelectorAll('audio').forEach(audioOwner);
  function updateOriginals(){
    const host=$('originals');host.querySelectorAll('audio').forEach(a=>a.pause());host.replaceChildren();const symbol=$('symbol').value.trim().toUpperCase();
    if($('lang-code').value.trim().toLowerCase()!=='ru'||!['sound','digit'].includes(state.kind)){$('original-status').textContent='Для этого языка или названия буквы отдельного эталона нет. Доступен живой синтез партитуры.';return;}
    if(['Ъ','Ь'].includes(symbol)){$('original-status').textContent=symbol+' — немой знак, файла произношения нет.';return;}
    if(!robotManifest||!alphabetManifest){$('original-status').textContent=originalError||'Загружаю перечень оригиналов…';return;}
    const robot=robotManifest.items?.find(x=>x.symbol===symbol),list=alphabetManifest.engines||[],bank=list.find(x=>x.id==='zerkalius')?.items?.find(x=>x.symbol===symbol),dsh=list.find(x=>x.id==='deepseek-adapted')?.items?.find(x=>x.symbol===symbol);let count=0;
    for(const [name,item,base]of [['Робот',robot,'robot/'],['Банк',bank,'alphabet/'],['DSH',dsh,'alphabet/']]){if(!item?.file||item.kind!==state.kind)continue;const path=base+item.file;if(!/^(robot|alphabet)\/[a-zA-Z0-9_./-]+\.wav$/.test(path)||path.includes('..'))continue;const figure=document.createElement('figure'),cap=document.createElement('figcaption'),audio=document.createElement('audio'),a=document.createElement('a');cap.textContent='Эталон '+(state.kind==='digit'?'цифры ':'буквы ')+symbol+' · '+name;audio.controls=true;audio.preload='none';audio.src=path;audio.dataset.label=name+' · '+symbol;audioOwner(audio);a.href=path;a.download='';a.textContent='Скачать оригинал WAV';figure.append(cap,audio,a);host.append(figure);count++;}
    $('original-status').textContent=count?'Эталон символа «'+symbol+'». Партитура вашего рецепта может отличаться.':'Для этого символа отдельного эталона нет. Доступен живой синтез текущей партитуры.';
  }
  Promise.all([fetch('robot/manifest.json').then(r=>{if(!r.ok)throw Error();return r.json();}),fetch('alphabet/manifest.json').then(r=>{if(!r.ok)throw Error();return r.json();})]).then(([robot,alphabet])=>{robotManifest=robot;alphabetManifest=alphabet;updateOriginals();}).catch(()=>{originalError='Перечень оригиналов не загрузился. Полные наборы WAV доступны ниже.';updateOriginals();});
  for(const command of document.querySelectorAll('.gz-hx'))decorateCommand(command);

  function selectTopic(id){
    activeTopic=topicTabs.some(tab=>tab.id===id)?id:topicTabs[0].id;
    for(const tab of topicTabs){
      const selected=tab.id===activeTopic;
      tab.setAttribute('aria-selected',String(selected));
      tab.tabIndex=selected?0:-1;
      $(tab.getAttribute('aria-controls')).hidden=!selected;
    }
    if(activeTopic==='tab-profile')for(const frame of frames)frame.sync();
  }
  function restoreEnginePage(page={}){
    const editor=page.editor;
    state.kind=['sound','name','digit'].includes(page.kind)?page.kind:'sound';
    state.silent=page.silent===true;
    state.compareMode=page.compareMode==='common'?'common':'profiles';
    state.variationSeed=page.variationSeed;
    for(const [key,{range,update}] of textPlaybackControls){
      const value=page.speechPlayback?.[key];
      range.value=Number.isFinite(value)?value:1;
      update();
    }
    state.speechLanguage=Object.hasOwn(SPEECH_EXAMPLES,page.speechLanguage)?page.speechLanguage:'ru';
    const savedText=page.speechText;
    const currentText=typeof savedText==='string'&&(!isFactoryText(savedText,state.speechLanguage)||savedText===SPEECH_EXAMPLES[state.speechLanguage]);
    const oldTrial=state.speechLanguage==='ru'?Object.keys(OLD_LETTER_TRIALS).find(key=>savedText===OLD_LETTER_TRIALS[key]):null;
    state.speechText=oldTrial?LETTER_TRIALS[oldTrial]:currentText?Array.from(savedText).slice(0,VoiceText.maxCharacters).join(''):SPEECH_EXAMPLES[state.speechLanguage];
    speechField.value=state.speechText;
    state.speechText=speechField.value;
    let caret=currentText&&!oldTrial?page.speechCaret:0;
    if(state.speechLanguage==='ru'){
      if(savedText===PLAIN_RUSSIAN_EXAMPLE)caret=accentedExampleCaret(page.speechCaret);
      else if(savedText===PREVIOUS_RUSSIAN_EXAMPLE)caret=consonantNameCaret(page.speechCaret);
    }
    restoreSpeechCaret(caret);
    $('speech-language').value=state.speechLanguage;
    setSpeechSpell(page.speechSpell===true);
    try{state.speechProsody=VoiceProsody.normalize(page.speechProsody??undefined);}
    catch{state.speechProsody=VoiceProsody.normalize();}
    syncSpeechProsody();drawTextCursor();textButton();
    $('text-status').textContent='Поставьте курсор или выделите фрагмент и нажмите «Плей».';

    const first=!editor&&VoiceCatalog.find(r=>r.lang==='ru'&&r.kind==='sound');
    $('title').value=String(editor?.title??first?.label??'Моя буква').slice(0,100);
    $('symbol').value=String(editor?.symbol??first?.symbol??'А').slice(0,16);
    $('lang-code').value=String(editor?.lang??first?.lang??'ru').slice(0,16);
    $('score').value=typeof editor?.scoreText==='string'?editor.scoreText.slice(0,20000):first?scoreText(first.score):'';
    $('recipe-mode').value=editor?.recipeMode==='name'||(!editor?.recipeMode&&state.kind==='name')?'name':'sound';
    refreshLanguages(editor?.recipeLanguage||$('lang-code').value||'ru');
    if(typeof editor?.langName==='string')$('lang-name').value=editor.langName.slice(0,60);
    refreshRecipes(editor?.recipeId||first?.id||'');
    selectedId=$('recipe').value;
    if(!selectedId)$('recipe').value='';
    refreshPhones(editor?.phone||'');
    $('token-ms').value=editor?.tokenMs??180;
    $('compare-mode').value=state.compareMode;
    $('variation-seed').value=page.variation?.seed??12345;
    $('spread').value=page.variation?.spread??15;
    $('variant-count').value=page.variation?.count??4;
    const keys=Array.isArray(page.variation?.keys)?page.variation.keys:['pitchStart','pitchEnd','formantScale'];
    for(const [key,choice] of choices)choice.checked=keys.includes(key);

    compactTabs=new Set(Array.isArray(page.compactTabs)?page.compactTabs:[]);
    for(const tab of topicTabs)tab.classList.toggle('is-compact',compactTabs.has(tab.id));
    selectTopic(page.topic);
    updateOriginals();
  }
  function engineUrl(id,keepHash=false){
    const url=new URL(location.href);
    url.searchParams.set('engine',id);
    if(!keepHash)url.hash='';
    return url;
  }
  function engineInUrl(){
    const id=new URLSearchParams(location.search).get('engine');
    return engineTabs.some(tab=>tab.dataset.engine===id)?id:null;
  }
  function openEngine(id,{navigate=false}={}){
    if(id===state.engineId)return;
    rememberSpeechCaret();
    begin();
    candidates=[];comparisons=[];
    for(const host of ['candidates','engine-comparison','variant-status','compare-status','phone-status'])$(host).replaceChildren();
    $('sequence').disabled=true;$('compare-sequence').disabled=true;
    try{readEngineStorage(id);}catch{}
    switchEngine(id);
    restoreEnginePage(enginePages[id]);
    if(navigate)history.pushState(null,'',engineUrl(id));
    invalidate('Открыт '+label(id)+'.');
  }
  function revealHash(){
    const id=location.hash.slice(1);
    const target=$(id),panel=target?.closest('[role="tabpanel"]');
    if(!panel)return;
    selectTopic(panel.getAttribute('aria-labelledby'));
    target.scrollIntoView();
    save();
  }
  for(const tab of engineTabs)tab.addEventListener('click',event=>{
    if(event.button||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    event.preventDefault();
    openEngine(tab.dataset.engine,{navigate:true});
  });
  for(const tab of topicTabs)tab.addEventListener('click',()=>{
    selectTopic(tab.id);
    if(location.hash)history.replaceState(null,'',engineUrl(state.engineId));
    save();
  });
  $('voice-tabs').addEventListener('keydown',event=>{
    const index=topicTabs.indexOf(event.target);
    if(index<0)return;
    const last=topicTabs.length-1;
    const next={ArrowLeft:index===0?last:index-1,ArrowRight:index===last?0:index+1,Home:0,End:last}[event.key];
    if(!Number.isInteger(next))return;
    event.preventDefault();
    topicTabs[next].click();
    topicTabs[next].focus();
  });
  for(const tab of topicTabs)tab.addEventListener('contextmenu',event=>{
    event.preventDefault();
    const id=tab.id;
    if(compactTabs.has(id))compactTabs.delete(id);else compactTabs.add(id);
    tab.classList.toggle('is-compact',compactTabs.has(id));
    save();
  });
  window.addEventListener('popstate',()=>{const id=engineInUrl();if(id)openEngine(id);revealHash();});
  window.addEventListener('hashchange',revealHash);

  function restoreLibrary(stored,migrated=false){
    state.library=Array.isArray(stored.library)?stored.library.slice(0,128).map(r=>({...validateRecipe(r,migrated||!r.engineId),id:String(r.id).slice(0,100),own:true})):[];
    state.languages=Array.isArray(stored.languages)?stored.languages.filter(x=>x&&/^[a-z][a-z0-9-]{0,15}$/.test(x.code)&&typeof x.label==='string'&&x.label.length<=60).slice(0,32):[];
    const d=stored.legacyDraft;
    if(d)state.legacyDraft={title:String(d.title||'Черновик из v1').slice(0,100),symbol:String(d.symbol||'').slice(0,16),lang:String(d.lang||'ru').slice(0,16),kind:['sound','name','digit'].includes(d.kind)?d.kind:'sound',silent:d.silent===true,scoreText:typeof d.scoreText==='string'?d.scoreText.slice(0,20000):'',settings:settingsFrom(d.settings,engine('bank')),phones:validatePhones(d.phones||{},engine('bank'))};
  }
  let stored=null,migrated=false,librarySaved=false,note='';
  try{const raw=localStorage.getItem(KEY),old=raw?null:localStorage.getItem(OLD);if(raw||old){stored=JSON.parse(raw||old);migrated=!raw;
    if(migrated){state.engineId='robot';state.profiles.bank={settings:settingsFrom(stored.settings,engine('bank')),phones:validatePhones(stored.phones||{},engine('bank')),userPhones:validatePhones(stored.userPhones||stored.phones||{},engine('bank'))};
      state.legacyDraft={title:String(stored.editor?.title||'Черновик из v1').slice(0,100),symbol:String(stored.editor?.symbol||'').slice(0,16),lang:String(stored.editor?.lang||'ru').slice(0,16),kind:stored.editor?.kind||'sound',silent:stored.editor?.silent===true,scoreText:typeof stored.scoreText==='string'?stored.scoreText.slice(0,20000):'',settings:clone(state.profiles.bank.settings),phones:clone(state.profiles.bank.phones)};
    }
    else{state.engineId=stored.engineId;engine(state.engineId);for(const item of R.list){const p=stored.profiles?.[item.id];if(p)state.profiles[item.id]={settings:settingsFrom(p.settings,engine(item.id)),phones:validatePhones(p.phones||{},engine(item.id)),userPhones:validatePhones(p.userPhones||{},engine(item.id))};}}
    enginePages[state.engineId]={speechText:stored.speechText,speechLanguage:stored.speechLanguage,speechProsody:stored.speechProsody,
      speechCaret:stored.speechCaret,editor:migrated?undefined:stored.editor,variation:stored.variation,kind:stored.kind,
      silent:!migrated&&stored.silent,compareMode:stored.compareMode,variationSeed:stored.variationSeed};
    restoreLibrary(stored,migrated);
  }}catch{note='Часть сохранённых данных не прочитана. ';if(!R.list.some(x=>x.id===state.engineId))state.engineId='robot';}
  let lastEngine=state.engineId;
  try{
    const shared=JSON.parse(localStorage.getItem(SHARED_KEY));
    if(shared){restoreLibrary(shared);librarySaved=true;}
    const last=localStorage.getItem(LAST_ENGINE_KEY);
    if(engineTabs.some(tab=>tab.dataset.engine===last))lastEngine=last;
  }catch{note='Часть сохранённых данных не прочитана. ';}
  for(const tab of engineTabs){
    try{readEngineStorage(tab.dataset.engine);}
    catch{note='Часть сохранённых данных не прочитана. ';}
  }
  if(migrated&&!librarySaved&&!note)note='Профиль и библиотека v1 перенесены в Банк. Черновик v1 доступен в списке рецептов. ';
  switchEngine(engineInUrl()||lastEngine);
  restoreEnginePage(enginePages[state.engineId]);
  if(!engineInUrl())history.replaceState(null,'',engineUrl(state.engineId,true));
  status(note+'Готово · '+label(state.engineId)+'.');
  if(!librarySaved&&!note.startsWith('Часть'))saveLibrary();
  revealHash();save();
  for(const id of ['variation-seed','spread','variant-count'])$(id).addEventListener('change',save);
  window.addEventListener('storage',event=>{
    if(event.key===SHARED_KEY&&event.newValue){
      try{
        restoreLibrary(JSON.parse(event.newValue));
        const language=$('language').value,name=$('lang-name').value;
        refreshLanguages(language);
        if($('language').value===language)$('lang-name').value=name;
        refreshRecipes(selectedId);
        selectedId=$('recipe').value;
        if(!selectedId)$('recipe').value='';
      }catch{}
    }
    for(const tab of engineTabs){
      const id=tab.dataset.engine;
      if(id===state.engineId||event.key!==engineStorageKey(id))continue;
      try{readEngineStorage(id);}catch{}
    }
  });
  window.addEventListener('pointerup',endHold);window.addEventListener('pointercancel',endHold);window.addEventListener('blur',endHold);
  window.addEventListener('pagehide',()=>{
    rememberSpeechCaret();
    endHold();
    importTicket++;
    retireSource(false);
    begin();
    context?.suspend().catch(()=>{});
  });
})();
