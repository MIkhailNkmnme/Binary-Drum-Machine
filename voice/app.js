/* ГОЛ-005: isolated engine profiles; explicit, cancellable rendering and playback. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id),R=globalThis.VoiceEngines;
  const KEY='zerkalius.voice.editor.v2',OLD='zerkalius.voice.editor.v1',clone=v=>JSON.parse(JSON.stringify(v));
  if(!R||!Array.isArray(globalThis.VoiceCatalog)){$('status').textContent='Движки или каталог не загружены. Обновите страницу после доставки файлов.';return;}
  const state={engineId:R.defaultId||'robot',profiles:{},library:[],languages:[],silent:false,kind:'sound',compareMode:'profiles',legacyDraft:null,speechText:'Привет, Зеркалиус! 0 1 2 3.',speechLanguage:'ru'};
  for(const item of R.list){const e=R.get(item.id);state.profiles[item.id]={settings:{...e.defaults},phones:{},userPhones:{}};}
  let E=R.get(state.engineId),worker=null,jobId=0,epoch=0,revision=0,importTicket=0;
  let context=null,source=null,sourceDone=null,current=null,selectedId='',restored=false;
  let candidates=[],comparisons=[],paused=false,sequencePlaying=false,hold=null;
  let robotManifest=null,alphabetManifest=null,originalError='';
  let textCache=null,textFrame=0,textBusy=false,textPlaying=false,textMarked=-1,textSpans=[];
  const nodes=new Map(),choices=new Map(),frames=[];
  const profile=()=>state.profiles[state.engineId],label=id=>R.list.find(x=>x.id===id)?.label||id;
  const status=text=>{$('status').textContent=text;},active=t=>t===epoch;
  const safeId=id=>typeof id==='string'&&/^[a-zA-Z_][a-zA-Z0-9_-]{0,31}$/.test(id)&&!['__proto__','prototype','constructor'].includes(id);
  function engine(id){if(!R.list.some(x=>x.id===id))throw Error('Неизвестный движок: '+id);return R.get(id);}
  function finite(v,min,max,name){const n=Number(v);if(v===''||!Number.isFinite(n)||n<min||n>max)throw Error(name+': допустимо '+min+'…'+max);return n;}
  function caption(id,text){const s=$(id).querySelector('.gz-nm');if(s)s.textContent=text;else $(id).textContent=text;}
  function button(text,action,title=text){const b=document.createElement('button'),s=document.createElement('span');b.type='button';b.className='gz-hx';b.title=title;b.setAttribute('aria-label',title);s.className='gz-nm';s.textContent=text;b.append(s);b.addEventListener('click',action);return b;}
  function option(select,value,text){const o=document.createElement('option');o.value=value;o.textContent=text;select.append(o);}
  function endHold(){if(hold){clearTimeout(hold.delay);clearInterval(hold.timer);hold=null;}}
  function cancelWorker(){if(worker){const old=worker;worker=null;old.terminate();old.reject(Error('Расчёт отменён.'));}}
  function retireSource(){if(source){const old=source;source=null;old.onended=null;try{old.stop();}catch{}old.disconnect();}if(sourceDone){const done=sourceDone;sourceDone=null;done();}}
  function pauseControls(enabled){for(const id of ['pause','compare-pause']){$(id).disabled=!enabled;caption(id,paused?'Продолжить':'Пауза');$(id).title=paused?'Продолжить последовательное прослушивание':'Приостановить последовательное прослушивание';$(id).setAttribute('aria-label',$(id).title);}}
  function stopAudio(except=null){stopTextUI();retireSource();sequencePlaying=false;paused=false;pauseControls(false);document.querySelectorAll('audio').forEach(a=>{if(a!==except)a.pause();});}
  function begin(except=null){epoch++;cancelWorker();stopAudio(except);return epoch;}
  function save(){try{localStorage.setItem(KEY,JSON.stringify({...state,editor:{title:$('title').value,symbol:$('symbol').value,lang:$('lang-code').value,scoreText:$('score').value},variation:{seed:$('variation-seed').value,spread:$('spread').value,count:$('variant-count').value,keys:[...choices].filter(([,n])=>n.checked).map(([key])=>key)}}));}catch{status('Браузер не сохранил настройки. Экспортируйте JSON.');}}
  function invalidate(text='Изменения сохранены. Для живого WAV заново нажмите «Слушать».'){revision++;importTicket++;begin();current=null;textCache=null;$('text-wav').disabled=true;$('wav').disabled=true;if(comparisons.length)$('compare-status').textContent='Ниже предыдущие снимки. Вычислите сравнение заново для текущих настроек.';status(text);save();}
  function settingsFrom(value,e=E){if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Неверные настройки.');const out={};for(const p of e.parameters){if(!Object.hasOwn(value,p.key))throw Error('Нет параметра '+p.key);out[p.key]=finite(value[p.key],p.min,p.max,p.label);}return e.normalize(out);}
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
  function recipeNow(){
    readControls();const p=profile(),lang=$('lang-code').value.trim().toLowerCase(),title=$('title').value.trim();if(!/^[a-z][a-z0-9-]{0,15}$/.test(lang)||!title)throw Error('Введите название и код языка (латинские буквы, цифры, дефис).');const silent=state.silent&&!$('score').value.trim();
    return {engineId:state.engineId,engineVersion:E.version,title:title.slice(0,100),symbol:$('symbol').value.slice(0,16),lang,kind:state.kind,silent,score:silent?[]:validateScore(parseText(),p.settings,p.phones),settings:clone(p.settings),phones:clone(p.phones),...(state.variationSeed!==undefined?{variationSeed:state.variationSeed}:{})};
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
    $('text-engine').textContent='Живой движок: '+label(state.engineId)+' · высота '+profile().settings.pitchStart+' → '+profile().settings.pitchEnd+' Гц · скорость '+profile().settings.speed+'. Выбор движка и регуляторы — в разделе «Голос и воспроизведение» ниже.';
  }
  function buildParameters(){
    const picked=new Map([...choices].map(([key,n])=>[key,n.checked]));endHold();for(const f of frames)f.dispose?.();frames.length=0;nodes.clear();choices.clear();$('parameters').replaceChildren();$('variation-fields').replaceChildren();
    for(const p of E.parameters){
      const wrap=document.createElement('div');wrap.className='parameter';const text=document.createElement('label');text.textContent=p.label;text.htmlFor='param-'+p.key;
      const number=document.createElement('input');Object.assign(number,{type:'number',id:text.htmlFor,min:p.min,max:p.max,step:p.step});number.setAttribute('aria-label',p.label);
      const host=document.createElement('div'),middle=document.createElement('div'),range=document.createElement('input'),output=document.createElement('output');Object.assign(range,{type:'range',min:p.min,max:p.max,step:p.step});range.setAttribute('aria-label',p.label);
      const update=value=>{try{profile().settings[p.key]=finite(value,p.min,p.max,p.label);profile().settings=E.normalize(profile().settings);syncParameters();invalidate();}catch(e){status(e.message);}},step=direction=>update(Math.min(p.max,Math.max(p.min,Number(profile().settings[p.key])+direction*p.step)));
      const left=button('◀',e=>{if(!e.detail)step(-1);},'Уменьшить: '+p.label),right=button('▶',e=>{if(!e.detail)step(1);},'Увеличить: '+p.label);left.classList.remove('gz-hx');right.classList.remove('gz-hx');middle.append(range,output);host.append(left,middle,right);wrap.append(text,number,host);$('parameters').append(wrap);
      const frame=ZerkControlFrame.attach(host,left,middle,right,{input:range,output,valueInThumb:true});frames.push(frame);nodes.set(p.key,{number,range,output,left,right,host,frame});number.addEventListener('input',()=>invalidate());number.addEventListener('change',()=>update(number.value));range.addEventListener('input',()=>update(range.value));
      const choice=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=picked.has(p.key)?picked.get(p.key):['pitchStart','pitchEnd','formantScale'].includes(p.key);choice.append(check,document.createTextNode(p.label));$('variation-fields').append(choice);choices.set(p.key,check);check.addEventListener('change',save);
      for(const [side,direction]of [[left,-1],[right,1]])side.addEventListener('pointerdown',e=>{if(e.button!==0||side.disabled)return;endHold();step(direction);hold={delay:null,timer:null};const mine=hold;mine.delay=setTimeout(()=>{if(hold!==mine)return;mine.timer=setInterval(()=>{if(side.disabled){endHold();return;}const before=profile().settings[p.key];step(direction);if(profile().settings[p.key]===before)endHold();},90);},350);});
    }
  }
  function switchEngine(id){engine(id);endHold();state.engineId=id;E=R.get(id);$('engine').value=id;buildParameters();refreshPhones();syncParameters();}
  function allRecipes(){const list=[...VoiceCatalog,...(globalThis.VoiceLegacyCatalog||[])],unique=[...new Map(list.map(r=>[r.id,r])).values()];return [...unique.map(r=>({...r,title:r.label,builtin:true})),...state.library];}
  function refreshLanguages(wanted=$('language').value||'ru'){const map=new Map([['ru','Русский'],['en','English']]);for(const x of state.languages)map.set(x.code,x.label);for(const r of allRecipes())if(!map.has(r.lang))map.set(r.lang,r.lang);$('language').replaceChildren();for(const [code,text]of map)option($('language'),code,text);$('language').value=map.has(wanted)?wanted:'ru';$('lang-name').value=map.get($('language').value);}
  function refreshRecipes(wanted=''){const select=$('recipe');select.replaceChildren();option(select,'','Выберите рецепт');for(const r of allRecipes().filter(r=>r.lang===$('language').value&&(r.own||r.kind==='digit'||r.kind===$('recipe-mode').value)))option(select,r.id,(r.symbol||'')+' · '+r.title+(r.silent?' · немая':'')+(r.own?' · '+label(r.engineId):''));if(state.legacyDraft)option(select,'legacy:v1','Черновик из v1 · Банк');if(state.engineId==='robot')for(const r of E.sourceProfiles||[])option(select,'source:'+r.id,'Исходный робот · '+r.label);select.value=wanted;$('delete-recipe').disabled=!state.library.some(r=>r.id===wanted);}
  function applyLegacyDraft(){
    const d=state.legacyDraft;if(!d)return;begin();switchEngine('bank');profile().settings=clone(d.settings);profile().phones=clone(d.phones);selectedId='legacy:v1';state.kind=d.kind;state.silent=d.silent;state.variationSeed=undefined;
    $('title').value=d.title;$('symbol').value=d.symbol;$('lang-code').value=d.lang;$('score').value=d.scoreText;$('recipe-mode').value=d.kind==='name'?'name':'sound';refreshLanguages(d.lang);refreshRecipes(selectedId);refreshPhones();syncParameters();updateOriginals();invalidate('Открыт сохранённый черновик v1 в Банке. Исходная копия остаётся в списке; звук не запущен.');
  }
  function applyRecipe(r,id=''){
    begin();if(!r.builtin){switchEngine(r.engineId);profile().settings=clone(r.settings);profile().phones=clone(r.phones);}else profile().phones=clone(profile().userPhones);
    selectedId=id;state.silent=r.silent===true;state.kind=r.kind||'sound';state.variationSeed=r.variationSeed;$('title').value=r.title||r.label||'';$('symbol').value=r.symbol||'';$('lang-code').value=r.lang||'ru';$('score').value=scoreText(r.score);if(r.kind==='name'||r.kind==='sound')$('recipe-mode').value=r.kind;
    refreshLanguages(r.lang);refreshRecipes(id);refreshPhones();syncParameters();updateOriginals();invalidate('Рецепт загружен · '+label(state.engineId)+'. Звук выключен до нажатия «Слушать».');if(r.engineVersion&&r.engineVersion!==E.version)status('Рецепт открыт в '+E.version+'; сохранён с '+r.engineVersion+'. Побайтное совпадение не обещается.');
  }
  function refreshPhones(wanted=$('phone').value){const p=profile(),ids=[...new Set([...E.phonemeIds,...Object.keys(p.userPhones),...Object.keys(p.phones)])];$('phone').replaceChildren();for(const id of ids)option($('phone'),id,id+' · '+(E.phoneLabels?.[id]||id)+(Object.hasOwn(p.phones,id)?' · свой':''));$('phone').value=ids.includes(wanted)?wanted:ids[0];showPhone();}
  function showPhone(){const id=$('phone').value,p=profile().phones[id]||profile().userPhones[id]||E.getPhone(id);if(!p)return;$('phone-id').value=id;$('phone-kind').value=p.kind;for(const key of ['formants','bandwidths','weights'])for(let i=0;i<4;i++)$(key+i).value=p[key][i];$('phone-voice').value=p.voice;$('phone-noise').value=p.noise;$('phone-status').textContent=label(state.engineId)+' · '+(E.phoneLabels?.[id]||id);}
  for(const k of E.kinds)option($('phone-kind'),k.id,k.label);
  for(let i=0;i<4;i++){const box=document.createElement('div');box.className='formant';box.id='formant-'+i;const title=document.createElement('strong');title.textContent='Форманта '+(i+1);box.append(title);for(const [key,text,min,max,step]of [['formants','Частота, Гц',20,9922.5,.5],['bandwidths','Полоса, Гц',20,4000,1],['weights','Вес',0,4,.01]]){const l=document.createElement('label');l.textContent=text;const n=document.createElement('input');Object.assign(n,{type:'number',id:key+i,min,max,step});l.append(n);box.append(l);}$('phone-formants').append(box);}
  function render(recipe){cancelWorker();const id=++jobId;return new Promise((resolve,reject)=>{const w=new Worker('render-worker.js?v=003');worker=w;w.reject=reject;w.onmessage=event=>{if(worker!==w||event.data.id!==id)return;worker=null;w.terminate();if(event.data.type==='error'){reject(Error(event.data.error?.message||'Ошибка синтеза.'));return;}const result=event.data.result;if(event.data.type!=='result'||result?.engineId!==recipe.engineId){reject(Error('Движок вернул несовместимый результат.'));return;}resolve(result);};w.onerror=event=>{if(worker===w)worker=null;w.terminate();reject(Error(event.message||'Worker не загрузился.'));};w.postMessage({id,engineId:recipe.engineId,score:recipe.score,settings:recipe.settings,phones:recipe.phones});});}
  async function unlock(){context ||= new (window.AudioContext||window.webkitAudioContext)();await context.resume();}
  function play(result){return new Promise(resolve=>{if(!context||context.state!=='running'){resolve();return;}retireSource();const buffer=context.createBuffer(1,result.samples.length,result.sampleRate);buffer.copyToChannel(result.samples,0);const node=context.createBufferSource();node.buffer=buffer;node.connect(context.destination);source=node;sourceDone=resolve;node.onended=()=>{node.disconnect();if(source===node){source=null;sourceDone=null;}resolve();};node.start();});}
  function snapshot(recipe,result){return {...clone(recipe),engineId:result.engineId,engineVersion:result.engineVersion,settings:clone(result.settings),phones:clone(result.phones)};}
  function markText(index){
    if(index===textMarked)return;if(textMarked>=0)textSpans[textMarked]?.classList.remove('speaking');textMarked=index;
    if(index>=0){textSpans[index]?.classList.add('speaking');$('text-position').textContent='Символ '+(index+1)+' / '+textSpans.length;}
    else $('text-position').textContent='';
  }
  function drawTextCursor(){
    textSpans=Array.from($('speech-text').value).map(char=>{const s=document.createElement('span');s.textContent=char;return s;});$('text-cursor').replaceChildren(...textSpans);textMarked=-1;
  }
  function textButton(on){caption('text-play',on?'Стоп':'Плей');$('text-play').setAttribute('aria-pressed',String(on));$('text-play').title=on?'Остановить расчёт или повтор текста':'Вычислить текст выбранным живым движком и повторять до остановки';$('text-play').setAttribute('aria-label',$('text-play').title);}
  function stopTextUI(){
    if(textFrame){cancelAnimationFrame(textFrame);textFrame=0;}if(textBusy||textPlaying)$('text-status').textContent='Текст остановлен.';textBusy=false;textPlaying=false;markText(-1);textButton(false);
  }
  async function prepareText(ticket){
    readControls();const e=E,engineId=state.engineId,settings=clone(profile().settings),phones=clone(profile().phones),text=$('speech-text').value,language=$('speech-language').value;
    const key=JSON.stringify({engineId,version:e.version,settings,phones,text,language});if(textCache?.key===key)return textCache;
    const plan=VoiceText.plan({text,language,catalog:[...VoiceCatalog,...(globalThis.VoiceLegacyCatalog||[])],engine:e,settings,phones});
    const pieces=[],timeline=[];let offset=0,actual=null;
    for(let i=0;i<plan.chunks.length;i++){
      if(!active(ticket))return null;const chunk=plan.chunks[i];$('text-status').textContent='Вычисляю текст · '+label(engineId)+' · часть '+(i+1)+' / '+plan.chunks.length;
      const result=await render({engineId,score:chunk.score,settings,phones});if(!active(ticket))return null;
      if(result.sampleRate!==plan.rate)throw Error('Изменилась частота дискретизации между частями текста.');const boundaries=VoiceText.tokenBoundaries(result);
      for(const mark of chunk.marks){const start=boundaries[mark.from],end=boundaries[mark.to];if(end>start)timeline.push({index:mark.index,start:offset+start,end:offset+end});}
      const end=boundaries[boundaries.length-1];if(result.samples.length>end)timeline.push({index:-1,start:offset+end,end:offset+result.samples.length});
      pieces.push(result.samples);offset+=result.samples.length;actual=result;
      if(offset>VoiceText.maxSeconds*plan.rate)throw Error('Готовый круг превысил лимит 60 секунд. Сократите текст.');
    }
    if(!offset||!actual)throw Error('Нет звучащего текста.');const samples=new Float32Array(offset);let at=0;for(const piece of pieces){samples.set(piece,at);at+=piece.length;}
    const cache={key,text,language,timeline,result:{samples,sampleRate:plan.rate,duration:offset/plan.rate,engineId,engineVersion:actual.engineVersion,settings:clone(actual.settings),phones:clone(actual.phones),seed:actual.seed}};
    if(!active(ticket))return null;textCache=cache;$('text-wav').disabled=false;return cache;
  }
  async function playText(){
    if(textBusy||textPlaying){begin();$('text-status').textContent='Текст остановлен.';return;}
    const ticket=begin();textBusy=true;textButton(true);drawTextCursor();
    try{
      // Plan before opening the audio device: silent signs and invalid text
      // never create an AudioContext, a zero-length buffer or a repeat task.
      readControls();VoiceText.plan({text:$('speech-text').value,language:$('speech-language').value,catalog:[...VoiceCatalog,...(globalThis.VoiceLegacyCatalog||[])],engine:E,settings:profile().settings,phones:profile().phones});
      await unlock();if(!active(ticket))return;const cache=await prepareText(ticket);if(!cache||!active(ticket))return;
      const result=cache.result,buffer=context.createBuffer(1,result.samples.length,result.sampleRate);buffer.copyToChannel(result.samples,0);retireSource();
      const node=context.createBufferSource();node.buffer=buffer;node.loop=true;node.connect(context.destination);source=node;
      const start=context.currentTime+.03;node.start(start);textBusy=false;textPlaying=true;textButton(true);
      $('text-status').textContent='Повтор текста · '+label(result.engineId)+' · '+result.duration.toFixed(2)+' с на круг · seed '+result.seed+'. Нажмите «Стоп», чтобы закончить.';
      const tick=()=>{
        textFrame=0;if(!active(ticket)||!textPlaying||source!==node)return;
        const elapsed=context.currentTime-start;if(elapsed<0)markText(-1);else{const sample=Math.floor((elapsed*result.sampleRate)%result.samples.length),mark=cache.timeline.find(m=>sample>=m.start&&sample<m.end);markText(mark?.index??-1);}
        textFrame=requestAnimationFrame(tick);
      };
      textFrame=requestAnimationFrame(tick);
    }catch(e){if(active(ticket)){stopTextUI();retireSource();$('text-status').textContent='Текст: '+e.message;}}
  }
  $('text-play').onclick=playText;$('text-stop').onclick=()=>{begin();$('text-status').textContent='Текст остановлен.';};
  $('speech-text').addEventListener('input',()=>{state.speechText=$('speech-text').value;invalidate('Текст изменён. Следующий «Плей» вычислит его заново.');drawTextCursor();});
  $('speech-language').onchange=()=>{state.speechLanguage=$('speech-language').value;invalidate('Язык текстового чтения изменён. Нажмите «Плей».');};
  $('text-wav').onclick=()=>{if(textCache)download('zerkalius-'+textCache.result.engineId+'-text-cycle.wav',wav(textCache.result));};
  async function listen(){const ticket=begin();try{const recipe=recipeNow();if(recipe.silent){current=null;$('wav').disabled=true;status('Немой знак: собственного звука нет; синтез и AudioContext не запускаются.');return;}await unlock();if(!active(ticket))return;status('Живой синтез · '+label(recipe.engineId)+'…');const result=await render(recipe);if(!active(ticket))return;current={recipe:snapshot(recipe,result),result};$('wav').disabled=false;status('Живой '+label(result.engineId)+' · '+result.duration.toFixed(2)+' с · '+result.engineVersion+' · seed '+result.seed+(result.legacyExact?' · точный исходный профиль':''));await play(result);}catch(e){if(active(ticket))status(e.message);}}
  async function listenSnapshot(card){const ticket=begin();try{await unlock();if(!active(ticket))return;status('Снимок · '+label(card.result.engineId)+' · '+card.recipe.title);await play(card.result);}catch(e){if(active(ticket))status(e.message);}}
  async function playSequence(cards,name){const ticket=begin();try{await unlock();if(!active(ticket))return;sequencePlaying=true;pauseControls(true);for(let i=0;i<cards.length&&active(ticket);i++){status(name+' '+(i+1)+' / '+cards.length+' · '+label(cards[i].result.engineId));await play(cards[i].result);}if(active(ticket)){sequencePlaying=false;pauseControls(false);status('Последовательное прослушивание завершено.');}}catch(e){if(active(ticket))status(e.message);}}
  function download(name,blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function wav(result){const n=result.samples.length,buffer=new ArrayBuffer(44+n*2),v=new DataView(buffer),text=(at,s)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i));};text(0,'RIFF');v.setUint32(4,36+n*2,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,result.sampleRate,true);v.setUint32(28,result.sampleRate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,n*2,true);for(let i=0;i<n;i++){const x=Math.max(-1,Math.min(1,result.samples[i]));v.setInt16(44+i*2,Math.round(x*(x<0?32768:32767)),true);}return new Blob([buffer],{type:'audio/wav'});}
  function saveOwn(recipe){if(state.library.length>=128)throw Error('В библиотеке уже 128 рецептов.');const valid=validateRecipe(recipe),id='own-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);state.library.push({...valid,id,own:true});selectedId=id;refreshLanguages(valid.lang);refreshRecipes(id);save();}
  function renderCards(hostId,cards){
    const host=$(hostId);host.replaceChildren();for(const [i,c]of cards.entries()){const row=document.createElement('article');row.className='candidate';const title=document.createElement('h3');title.textContent=c.label||'Вариант '+(i+1);const info=document.createElement('p');row.append(title);if(c.error){info.textContent='Не вычислен: '+c.error;row.append(info);host.append(row);continue;}
      const e=engine(c.result.engineId);info.textContent=label(c.result.engineId)+' ['+c.result.engineId+'] · '+c.result.engineVersion+' · seed '+c.result.seed+(c.variationSeed!==undefined?' · семя перебора '+c.variationSeed:'')+'. '+e.parameters.map(p=>p.label+': '+c.recipe.settings[p.key]).join(' · ')+'. Замены фонем: '+(Object.keys(c.recipe.phones).join(', ')||'нет');
      const actions=document.createElement('div');actions.className='commands';actions.append(button('Слушать',()=>listenSnapshot(c),'Прослушать снимок '+label(c.result.engineId)),button('Применить',()=>applyRecipe(c.recipe),'Применить рецепт и профиль '+label(c.result.engineId)),button('Сохранить',()=>{try{saveOwn({...c.recipe,title:(c.recipe.title+' · '+(c.label||'вариант')).slice(0,100)});status('Снимок сохранён с движком, настройками и фонемами.');}catch(err){status(err.message);}}));row.append(info,actions);host.append(row);
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
    for(const item of R.list){if(!active(ticket))return;const e=engine(item.id),p=state.profiles[item.id],recipe={...clone(base),engineId:item.id,engineVersion:e.version,settings:state.compareMode==='common'?e.normalize(base.settings):clone(p.settings),phones:clone(p.phones)};
      try{validateScore(recipe.score,recipe.settings,recipe.phones,e);$('compare-status').textContent='Вычисляю '+item.label;const result=await render(recipe);if(!active(ticket))return;comparisons.push({recipe:snapshot(recipe,result),result,label:item.label});}catch(err){if(!active(ticket))return;comparisons.push({label:item.label,error:err.message});}
      renderCards('engine-comparison',comparisons);$('compare-sequence').disabled=!comparisons.some(c=>c.result);
    }
    if(active(ticket))$('compare-status').textContent='Готовы снимки '+comparisons.filter(c=>c.result).length+' / '+R.list.length+'. Прослушивание запускается отдельно.';
  }catch(e){if(active(ticket))$('compare-status').textContent=e.message;}};
  $('listen').onclick=listen;$('stop').onclick=$('compare-stop').onclick=()=>{begin();status('Остановлено.');};$('sequence').onclick=()=>playSequence(candidates,'Вариант');$('compare-sequence').onclick=()=>playSequence(comparisons.filter(c=>c.result),'Сравнение');
  $('compare-mode').onchange=()=>{state.compareMode=$('compare-mode').value;invalidate('Режим сравнения изменён. Вычислите новые снимки.');};
  $('pause').onclick=$('compare-pause').onclick=async()=>{if(!sequencePlaying||!context)return;const ticket=epoch,next=!paused;pauseControls(false);try{if(next)await context.suspend();else await context.resume();if(!active(ticket))return;paused=next;pauseControls(true);}catch(e){if(active(ticket)){pauseControls(true);status(e.message);}}};
  $('wav').onclick=()=>{if(current)download('zerkalius-'+current.result.engineId+'-live.wav',wav(current.result));};
  for(const item of R.list)option($('engine'),item.id,item.label);
  $('engine').onchange=()=>{try{readControls();switchEngine($('engine').value);selectedId='';refreshRecipes();invalidate('Выбран живой '+label(state.engineId)+'. Его настройки и фонемы восстановлены.');}catch(e){$('engine').value=state.engineId;status(e.message);}};
  $('reset-profile').onclick=()=>{const p=profile();p.settings={...E.defaults};p.phones={};p.userPhones={};state.variationSeed=undefined;endHold();syncParameters();refreshPhones();invalidate('Исходный профиль '+label(state.engineId)+' восстановлен без запуска звука.');};
  $('recipe-mode').onchange=()=>refreshRecipes();$('language').onchange=()=>{if($('language').value==='en')$('recipe-mode').value='name';else if($('language').value==='ru')$('recipe-mode').value='sound';refreshRecipes();$('lang-code').value=$('language').value;$('lang-name').value=$('language').selectedOptions[0].textContent;updateOriginals();invalidate();};
  $('recipe').onchange=()=>{try{const id=$('recipe').value;if(id==='legacy:v1'){applyLegacyDraft();return;}if(id.startsWith('source:')){const r=E.sourceProfiles?.find(x=>x.id===id.slice(7));if(r)applyRecipe({...r,title:r.label,symbol:r.symbol||'',lang:'ru',kind:'name',silent:false,engineId:'robot',engineVersion:E.version},id);return;}const r=allRecipes().find(x=>x.id===id);if(r)applyRecipe(r,id);}catch(e){status(e.message);}};
  for(const id of ['title','symbol','lang-code','score'])$(id).addEventListener('input',()=>{if(id==='score')state.silent=false;if(id==='symbol'||id==='lang-code')updateOriginals();invalidate();});
  $('save-recipe').onclick=()=>{try{saveOwn(recipeNow());status('Свой рецепт сохранён локально.');}catch(e){status(e.message);}};
  $('delete-recipe').onclick=()=>{state.library=state.library.filter(r=>r.id!==selectedId);selectedId='';refreshRecipes();save();status('Свой рецепт удалён из библиотеки.');};
  $('save-language').onclick=()=>{try{const code=$('lang-code').value.trim().toLowerCase(),text=$('lang-name').value.trim();if(!/^[a-z][a-z0-9-]{0,15}$/.test(code)||!text||text.length>60)throw Error('Введите код языка и название до 60 знаков.');if(state.languages.length>=32&&!state.languages.some(x=>x.code===code))throw Error('Лимит: 32 своих языка.');state.languages=state.languages.filter(x=>x.code!==code);state.languages.push({code,label:text});refreshLanguages(code);refreshRecipes();save();status('Язык сохранён. Добавьте свои буквы.');}catch(e){status(e.message);}};
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
  $('insert-phone').onclick=()=>{try{const id=$('phone-id').value.trim();if(!safeId(id)||(!Object.hasOwn(profile().phones,id)&&!E.phonemeIds.includes(id)))throw Error('Сначала сохраните новый ID в активном рецепте.');const ms=finite($('token-ms').value,10,4000,'Длительность');$('score').value=$('score').value.trim()+($('score').value.trim()?' ':'')+id+':'+ms;state.silent=false;invalidate();}catch(e){$('phone-status').textContent=e.message;}};
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
  for(const b of document.querySelectorAll('button')){b.type='button';if(!b.title)b.title=b.textContent.trim();if(!b.hasAttribute('aria-label'))b.setAttribute('aria-label',b.title);if(!b.children.length){const s=document.createElement('span');s.className='gz-nm';s.textContent=b.textContent;b.replaceChildren(s);}}
  let stored=null,migrated=false,note='';
  try{const raw=localStorage.getItem(KEY),old=raw?null:localStorage.getItem(OLD);if(raw||old){stored=JSON.parse(raw||old);migrated=!raw;restored=true;
    if(migrated){state.engineId='robot';restored=false;state.profiles.bank={settings:settingsFrom(stored.settings,engine('bank')),phones:validatePhones(stored.phones||{},engine('bank')),userPhones:validatePhones(stored.userPhones||stored.phones||{},engine('bank'))};
      state.legacyDraft={title:String(stored.editor?.title||'Черновик из v1').slice(0,100),symbol:String(stored.editor?.symbol||'').slice(0,16),lang:String(stored.editor?.lang||'ru').slice(0,16),kind:stored.editor?.kind||'sound',silent:stored.editor?.silent===true,scoreText:typeof stored.scoreText==='string'?stored.scoreText.slice(0,20000):'',settings:clone(state.profiles.bank.settings),phones:clone(state.profiles.bank.phones)};
    }
    else{state.engineId=stored.engineId;engine(state.engineId);for(const item of R.list){const p=stored.profiles?.[item.id];if(p)state.profiles[item.id]={settings:settingsFrom(p.settings,engine(item.id)),phones:validatePhones(p.phones||{},engine(item.id)),userPhones:validatePhones(p.userPhones||{},engine(item.id))};}}
    state.library=Array.isArray(stored.library)?stored.library.slice(0,128).map(r=>({...validateRecipe(r,migrated||!r.engineId),id:String(r.id).slice(0,100),own:true})):[];state.languages=Array.isArray(stored.languages)?stored.languages.filter(x=>x&&/^[a-z][a-z0-9-]{0,15}$/.test(x.code)&&typeof x.label==='string'&&x.label.length<=60).slice(0,32):[];
    if(typeof stored.speechText==='string')state.speechText=Array.from(stored.speechText).slice(0,160).join('');state.speechLanguage=stored.speechLanguage==='en'?'en':'ru';
    if(!migrated){state.silent=stored.silent===true;state.kind=stored.kind||'sound';state.compareMode=stored.compareMode==='common'?'common':'profiles';state.variationSeed=stored.variationSeed;if(stored.editor){$('title').value=String(stored.editor.title||'').slice(0,100);$('symbol').value=String(stored.editor.symbol||'').slice(0,16);$('lang-code').value=String(stored.editor.lang||'ru').slice(0,16);}const text=stored.editor?.scoreText;if(typeof text==='string'&&text.length<20000)$('score').value=text;
      if(stored.legacyDraft){const d=stored.legacyDraft;state.legacyDraft={title:String(d.title||'Черновик из v1').slice(0,100),symbol:String(d.symbol||'').slice(0,16),lang:String(d.lang||'ru').slice(0,16),kind:['sound','name','digit'].includes(d.kind)?d.kind:'sound',silent:d.silent===true,scoreText:typeof d.scoreText==='string'?d.scoreText.slice(0,20000):'',settings:settingsFrom(d.settings,engine('bank')),phones:validatePhones(d.phones||{},engine('bank'))};}
    }else note='Первый запуск — Робот. Профиль и библиотека v1 перенесены в Банк; черновик доступен отдельно в списке. ';
  }}catch{note='Часть сохранённых данных не прочитана. ';if(!R.list.some(x=>x.id===state.engineId))state.engineId='robot';}
  $('speech-text').value=state.speechText;$('speech-language').value=state.speechLanguage;drawTextCursor();textButton(false);
  switchEngine(state.engineId);$('compare-mode').value=state.compareMode;$('recipe-mode').value=state.kind==='name'?'name':'sound';refreshLanguages($('lang-code').value||'ru');refreshRecipes();
  if(stored?.variation){$('variation-seed').value=stored.variation.seed??12345;$('spread').value=stored.variation.spread??15;$('variant-count').value=stored.variation.count??4;for(const [key,n]of choices)n.checked=Array.isArray(stored.variation.keys)&&stored.variation.keys.includes(key);}
  if(!$('score').value&&!restored){const first=VoiceCatalog.find(r=>r.lang==='ru'&&r.kind==='sound');if(first){$('score').value=scoreText(first.score);$('title').value=first.label;$('symbol').value=first.symbol;$('lang-code').value=first.lang;$('recipe').value=first.id;}}
  status(note+'Готово · '+label(state.engineId)+'. Звук выключен до вашего нажатия.');updateOriginals();save();
  for(const id of ['variation-seed','spread','variant-count'])$(id).addEventListener('change',save);
  window.addEventListener('pointerup',endHold);window.addEventListener('pointercancel',endHold);window.addEventListener('blur',endHold);window.addEventListener('pagehide',()=>{endHold();importTicket++;begin();context?.suspend().catch(()=>{});});
})();
