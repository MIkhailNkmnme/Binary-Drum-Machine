/* Маятник · Синтез 0.001. A bounded companion field; source v0.999 stays intact.
 * Source redraws are observations, never an animation clock. Only successive
 * source frames or explicit independent ticks advance experimental history. */
(function(root){
  'use strict';
  const KEY='synthesis-controls-v1',MAX=512;
  const defaults={mode:'trail',rule:'circuit',trailFrames:8,recoveryFrames:6,wrap:false,
    mix:'overlay',link:true,rate:8,colourOne:'#ffd35b',colourZero:'#5ce1e6',visible:true,expanded:false,
    weightsOpen:true,stateWeights:[0,1,2,1,0,0,1],positionWeights:[2,1,2,1,1,2,1,2]};
  const modes={trail:'След',waves:'Волны',recovery:'Восстановление',grow:'Отпечаток',weights:'Веса соседей'};
  const rules={circuit:'Circuit Genesis',fireworks:'Fireworks',replicator:'Replicator',weighted:'WG Rule084'};
  const autonomous=()=>prefs.mode==='grow'||prefs.mode==='weights';
  const cellular=()=>['waves','grow','weights'].includes(prefs.mode);
  let prefs={...defaults};
  function readPrefs(value){
    if(!value||typeof value!=='object')return {...defaults};
    const p={...defaults};
    for(const [key,allowed] of Object.entries({mode:Object.keys(modes),rule:Object.keys(rules),mix:['overlay','only','xor','and']}))if(allowed.includes(value[key]))p[key]=value[key];
    for(const key of ['wrap','link','visible','expanded','weightsOpen'])if(typeof value[key]==='boolean')p[key]=value[key];
    for(const [key,lo,hi] of [['trailFrames',1,64],['recoveryFrames',0,64],['rate',1,30]])if(Number.isInteger(value[key])&&value[key]>=lo&&value[key]<=hi)p[key]=value[key];
    for(const key of ['colourOne','colourZero'])if(/^#[0-9a-f]{6}$/i.test(value[key]||''))p[key]=value[key];
    for(const [key,n]of [['stateWeights',7],['positionWeights',8]])p[key]=Array.isArray(value[key])&&value[key].length===n&&value[key].every(v=>Number.isInteger(v)&&v>=0&&v<=10)?value[key].slice():defaults[key].slice();
    if(p.mode==='weights'){p.rule='weighted';p.link=false;}
    return p;
  }
  try{prefs=readPrefs(JSON.parse(localStorage.getItem(KEY)||'null'));}catch(_){}
  let engine=null,sourceBits=null,crop=null,sourceOwner=null,sourceMode='',sourceFrame=null,sourceSize='',
    panel=null,canvas=null,ctx=null,status=null,notice=null,toolbar=null,bindings=[],after=()=>{},timer=null,
    ticks=0,message='',pendingSave=null,dbPromise=null,restoring=true,detached=false,dirty=false,weightPanel=null,legend=null;
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
  function fail(error){message=error?.message||String(error);refresh();}
  function run(action){try{const result=action();if(result?.catch)result.catch(fail);}catch(error){fail(error);}}
  function remember(){try{localStorage.setItem(KEY,JSON.stringify(prefs));}catch(error){fail(Error('Настройки не сохранены: '+error.message));}}
  function engineOptions(){return {rule:prefs.rule,wrap:prefs.wrap,trailFrames:prefs.trailFrames,recoveryFrames:prefs.recoveryFrames,stateWeights:prefs.stateWeights,positionWeights:prefs.positionWeights};}
  function source(){return root.maySynthesisSource?.()||null;}
  function availableSource(){
    const s=source();if(!s)throw Error('Маятник ещё восстанавливает исходное поле. Повторите захват после загрузки.');
    if(s.gpu)throw Error('Для Синтеза выберите в исходном Маятнике CPU-поле до 512 строк. GPU-просмотр больших полей не передаёт полный массив битов.');
    return s;
  }
  function chooseCrop(s,selection=false){
    const r=selection?s.selection:null;
    if(selection&&s.selectionUnsupported)throw Error('Для захвата области выберите обычный прямоугольный вид без ромбов, стыка и объединённых копий.');
    if(selection&&!r)throw Error('Сначала выделите ячейки в исходном Маятнике.');
    const x=r?r.c0:Math.max(0,Math.min(s.W-MAX,Math.round(s.anchor-MAX/2)));
    const y=r?r.r0:0,w=r?r.c1-r.c0+1:Math.min(MAX,s.W),h=r?r.r1-r.r0+1:Math.min(MAX,s.H);
    if(w>MAX||h>MAX)throw Error('Область больше 512 × 512. Выделите меньшую область.');
    if(w<1||h<1||x<0||y<0||x+w>s.W||y+h>s.H)throw Error('Область не соответствует текущему полю.');
    return {x,y,w,h};
  }
  function readBits(s,rect){
    const bits=new Int8Array(rect.w*rect.h).fill(-1);
    for(let y=0;y<rect.h;y++)for(let x=0;x<rect.w;x++){
      const sx=x+rect.x,sy=y+rect.y;
      if(sx<s.W&&sy<s.H){const b=s.val[sy*s.W+sx];bits[y*rect.w+x]=b===0||b===1?b:-1;}
    }
    return bits;
  }
  function bindSource(s){sourceOwner=s.owner;sourceMode=s.mode;sourceFrame=s.k;sourceSize=s.W+'x'+s.H;}
  function build(bits,rect){
    crop=rect;sourceBits=bits.slice();engine=root.MayatnikSynthesisCore.create({width:rect.w,height:rect.h,...engineOptions()});
    engine.reset(bits);ticks=0;dirty=true;
  }
  function capture(selection=false){
    pause();const s=availableSource(),rect=chooseCrop(s,selection),bits=readBits(s,rect);
    build(bits,rect);bindSource(s);detached=false;
    if(autonomous())engine.seed(bits);
    message=(selection?'Захвачена область':'Захвачен кадр')+' '+s.k+'. '+(rect.w<s.W||rect.h<s.H?'Показана область '+rect.w+' × '+rect.h+' без уменьшения клеток.':'');
    render();scheduleSave();
  }
  function preset(kind){
    pause();const w=129,h=129,bits=new Int8Array(w*h),cx=64,cy=64;
    if(kind==='cross')for(let d=-12;d<=12;d++){bits[cy*w+cx+d]=1;bits[(cy+d)*w+cx]=1;}
    else bits[cy*w+cx]=1;
    prefs.mode='grow';prefs.link=false;detached=true;
    build(bits,{x:0,y:0,w,h});engine.seed(bits);sourceOwner=null;sourceFrame=null;sourceSize='';
    message=kind==='cross'?'Крест 25 × 25 · 49 единиц. Поле 129 × 129.':'Одна клетка в центре поля 129 × 129.';
    remember();render();scheduleSave();
  }
  function observeSource(){
    if(restoring||!panel||!prefs.link||autonomous()||detached)return;
    run(()=>{
      const s=source();if(!s)return;
      if(s.gpu){pause();message='GPU-просмотр: выберите CPU-поле до 512 строк для связи с Синтезом.';refresh();return;}
      if(!engine){capture(false);return;}
      if(sourceOwner===null){
        // Restored histories can only continue from the exact matching source.
        const candidate=readBits(s,crop);
        const matches=s.k===sourceFrame&&s.mode===sourceMode&&s.W+'x'+s.H===sourceSize&&candidate.every((b,i)=>b===sourceBits[i]);
        if(matches){sourceOwner=s.owner;return;}
        prefs.link=false;message='Сохранённый опыт открыт. Исходник отличается: связь отключена. «Кадр» начинает новый опыт.';remember();refresh();return;
      }
      if(s.owner!==sourceOwner||s.mode!==sourceMode||s.W+'x'+s.H!==sourceSize){capture(false);message='Исходное построение изменилось: история Синтеза начата заново.';refresh();return;}
      if(s.k===sourceFrame){
        const bits=readBits(s,crop);
        if(bits.some((b,i)=>b!==sourceBits[i])){sourceBits=bits;engine.reset(bits);ticks=0;dirty=true;message='Исходник изменён в том же кадре: начат новый отсчёт без ложной вспышки.';render();scheduleSave();}
        return;
      }
      if(s.k!==sourceFrame+1){capture(false);message='Перемотка: промежуточные события неизвестны, история начата с кадра '+s.k+'.';refresh();return;}
      sourceBits=readBits(s,crop);engine.observe(sourceBits,{advance:true});
      if(prefs.mode==='waves')engine.step({injectChanges:true});
      sourceFrame=s.k;ticks++;dirty=true;render();scheduleSave();
    });
  }
  function step(){
    if(!engine){capture(false);if(!engine)return;}
    if(prefs.link&&!autonomous())throw Error('Для отдельного шага отключите «Связь». При включённой связи используйте плеер исходного Маятника.');
    engine.observe(sourceBits,{advance:true});
    if(cellular())engine.step({injectChanges:false});
    ticks++;dirty=true;render();scheduleSave();
  }
  function pause(){if(timer!==null){clearInterval(timer);timer=null;}refresh();}
  function play(){
    if(timer!==null){pause();return;}
    if(prefs.link&&!autonomous())throw Error('Включена «Связь»: запустите плеер исходного Маятника или отключите связь для самостоятельного хода.');
    if(!engine)capture(false);
    timer=setInterval(()=>{try{step();}catch(error){pause();fail(error);}},1000/prefs.rate);refresh();
  }
  function setMode(mode){
    pause();prefs.mode=mode;
    if(autonomous())prefs.link=false;
    if(mode==='weights')prefs.rule='weighted';
    if(engine){engine.configure(engineOptions());engine.reset(sourceBits);ticks=0;if(autonomous())engine.seed(sourceBits);dirty=true;}
    message=mode==='recovery'?'Отдельное поле принимает изменение бита и удерживает его на время восстановления.':mode==='weights'?'Веса состояний × веса направлений. Рождение при сумме 5; сохранение при 5 или 6.':mode==='grow'?'Отпечаток развивается самостоятельно. Выберите правило и нажмите «Пуск».':'';
    remember();render();scheduleSave();
  }
  function setOption(key,value){
    const wasPlaying=timer!==null;
    if(key==='mode'){setMode(value);return;}
    if(key==='rule')pause();prefs[key]=value;
    if(engine){engine.configure(engineOptions());
      if(key==='rule'){engine.reset(sourceBits);ticks=0;if(autonomous())engine.seed(sourceBits);message='Правило изменено: история начата заново.';}
    }
    if(key==='link'){
      pause();if(value){detached=false;capture(false);}else message='Самостоятельный ход. Исходный кадр зафиксирован.';
    }
    if(key==='rate'&&wasPlaying){pause();play();}
    dirty=true;remember();render();scheduleSave();
  }
  const rgb=hex=>[1,3,5].map(n=>parseInt(hex.slice(n,n+2),16));
  function paintPixels(data){
    const one=rgb(prefs.colourOne),zero=rgb(prefs.colourZero),dark=[10,14,20],off=[25,33,45],light=[220,233,246];
    const states=engine.state,trail=engine.trail,direction=engine.direction,recovered=engine.recovered;
    const count=root.MayatnikSynthesisCore.rules[prefs.rule].states,lut=[dark,one];
    for(let s=2;s<count;s++){const t=(s-2)/Math.max(1,count-3);lut.push(one.map((v,i)=>Math.round((v*(1-t)+zero[i]*t)*(1-.8*t))));}
    for(let q=0;q<sourceBits.length;q++){
      const bit=sourceBits[q],base=bit===1?light:bit===0?off:dark;
      let b=0,col=dark,alpha=1;
      if(prefs.mode==='trail'){b=trail[q]>0?1:0;col=direction[q]?one:zero;alpha=Math.min(1,trail[q]/prefs.trailFrames);}
      else if(prefs.mode==='recovery'){b=recovered[q]===1?1:0;col=b?one:recovered[q]===0?off:dark;}
      else{b=states[q]===1?1:0;col=lut[states[q]];alpha=states[q]?1:0;}
      if(prefs.mix==='xor'||prefs.mix==='and'){
        const a=bit===1?1:0;col=(prefs.mix==='xor'?(a^b):(a&b))?one:dark;alpha=1;
      }else if(prefs.mix==='only'){
        if(prefs.mode!=='trail')alpha=1;
      }else if(prefs.mode==='recovery'){col=recovered[q]!==bit?(recovered[q]===1?one:zero):base;alpha=1;}
      for(let c=0;c<3;c++)data[q*4+c]=prefs.mix==='only'&&prefs.mode==='trail'?Math.round(col[c]*alpha):Math.round(base[c]*(1-alpha)+col[c]*alpha);
      data[q*4+3]=255;
    }
  }
  function render(){
    if(engine&&canvas){
      const w=engine.width,h=engine.height;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
      const img=ctx.createImageData(w,h),data=img.data;
      paintPixels(data);
      ctx.putImageData(img,0,0);canvas.style.aspectRatio=w+' / '+h;
    }
    refresh();
  }
  function refresh(){
    if(!panel)return;
    panel.hidden=!prefs.visible;panel.classList.toggle('synthesis-expanded',prefs.expanded);
    if(weightPanel){weightPanel.hidden=prefs.rule!=='weighted'||!cellular();weightPanel.open=prefs.weightsOpen;}
    if(legend)legend.textContent=prefs.mode==='trail'?'Цвет 1 — переход 0→1; цвет 0 — переход 1→0. Яркость показывает возраст.':prefs.mode==='recovery'?'Поверх: цветом показаны отличия от входного кадра. Отдельно: удерживаемые биты.':'Цвет 1 — активная клетка; цвет 0 — конец затухания. XOR / AND учитывают только состояние 1.';
    status.textContent=modes[prefs.mode]+' · '+(engine?engine.width+' × '+engine.height+' · шаг '+ticks:'ожидание поля')+(sourceFrame!==null?' · исходный кадр '+sourceFrame:'');
    notice.textContent=message;notice.hidden=!message;
    for(const binding of bindings){
      const {node,selected,disabled,caption,show}=binding;
      if(selected)node.setAttribute('aria-pressed',String(selected()));
      if(disabled)node.disabled=!!disabled();
      if(caption){const span=node.querySelector('.gz-nm');if(span)span.textContent=root.HubButtonText?.shortCaption(caption())||caption();}
      if(show)node.hidden=!show();
    }
  }
  function snapshot(){
    if(!engine)throw Error('Сначала захватите кадр или выберите начальную фигуру.');
    return {format:'zerkalius-synthesis',version:1,base:'0.999',prefs:{...prefs},engine:engine.snapshot(),sourceBits:Array.from(sourceBits),crop:{...crop},sourceFrame,sourceMode,sourceSize,ticks,detached};
  }
  function load(data){
    if(!data||data.format!=='zerkalius-synthesis'||data.version!==1)throw Error('Это не сохранённый опыт Маятника · Синтез.');
    const next=root.MayatnikSynthesisCore.create({width:1,height:1});next.restore(data.engine);
    if(!Array.isArray(data.sourceBits)||data.sourceBits.length!==next.width*next.height||data.sourceBits.some(b=>![-1,0,1].includes(b)))throw Error('Повреждён исходный кадр опыта.');
    if(data.sourceBits.some((b,i)=>b!==data.engine.previous[i]))throw Error('Исходник и история опыта не совпадают.');
    const r=data.crop;
    if(!r||!Number.isSafeInteger(r.x)||!Number.isSafeInteger(r.y)||r.x<0||r.y<0||r.w!==next.width||r.h!==next.height)throw Error('Повреждена область опыта.');
    if(!Number.isSafeInteger(data.ticks)||data.ticks<0||!(data.sourceFrame===null||Number.isSafeInteger(data.sourceFrame)&&data.sourceFrame>=0))throw Error('Повреждён номер шага.');
    pause();engine=next;sourceBits=Int8Array.from(data.sourceBits);crop={...r};prefs=readPrefs(data.prefs);
    const opt=next.options;prefs.rule=opt.rule;prefs.wrap=opt.wrap;prefs.trailFrames=Math.max(1,Math.min(64,opt.trailFrames));prefs.recoveryFrames=Math.min(64,opt.recoveryFrames);prefs.stateWeights=opt.stateWeights.slice();prefs.positionWeights=opt.positionWeights.slice();engine.configure(engineOptions());
    sourceFrame=data.sourceFrame;sourceMode=String(data.sourceMode||'');sourceSize=String(data.sourceSize||'');sourceOwner=null;
    ticks=data.ticks;detached=!!data.detached;dirty=false;message='Опыт восстановлен на паузе.';remember();render();
  }
  function database(){
    if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
      const req=indexedDB.open('mayatnik-synthesis-work',1);
      req.onupgradeneeded=()=>req.result.createObjectStore('works');
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(Error('Хранилище опыта заблокировано другой вкладкой.'));
    }).catch(error=>{dbPromise=null;throw error;});return dbPromise;
  }
  async function storeNow(){
    clearTimeout(pendingSave);pendingSave=null;if(!engine||!dirty)return;
    const value=snapshot();dirty=false;
    try{const db=await database();await new Promise((resolve,reject)=>{const tx=db.transaction('works','readwrite');tx.objectStore('works').put(value,'last');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>{};});}
    catch(error){dirty=true;throw Error('Опыт не сохранён в браузере: '+error.message);}
  }
  function scheduleSave(){if(pendingSave===null)pendingSave=setTimeout(()=>run(storeNow),1500);}
  function download(blob,name){const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  function png(){return new Promise((resolve,reject)=>{if(!engine){reject(Error('Нет рисунка для сохранения.'));return;}canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Не удалось создать PNG.')),'image/png');});}
  async function exportPNG(){download(await png(),'Маятник-Синтез-'+prefs.mode+'-'+ticks+'.png');}
  async function saveWork(){await storeNow();download(new Blob([JSON.stringify(snapshot())],{type:'application/json'}),'Маятник-Синтез-'+ticks+'.json');message='Опыт сохранён в браузере и скачан файлом JSON.';refresh();}
  async function toLibrary(){
    if(!root.ZerkBitoteka)throw Error('Битотека ещё не загружена.');
    const state=snapshot(),thumbnail=await png();
    const id=root.crypto.randomUUID(),openUrl=location.pathname+'#synthesis='+encodeURIComponent(id);
    const item=await root.ZerkBitoteka.save({id,kind:'work',name:'Синтез · '+modes[prefs.mode]+' · '+ticks,
      filename:'mayatnik-synthesis-'+ticks+'.json',blob:new Blob([JSON.stringify(state)],{type:'application/json'}),thumbnail,
      source:{name:'Маятник · Синтез',url:location.pathname},meta:{synthesis:true,rule:prefs.rule,frame:ticks,openUrl}});
    message='Опыт сохранён в Битотеке. Кнопка перехода в карточке возвращает к этому опыту.';refresh();return item;
  }
  function importWork(){
    const input=el('input');input.type='file';input.accept='.json,application/json';
    input.onchange=()=>run(async()=>{const file=input.files?.[0];if(!file)return;if(file.size>24000000)throw Error('Файл опыта больше 24 МБ.');load(JSON.parse(await file.text()));prefs.link=false;detached=true;dirty=true;remember();scheduleSave();message='Опыт открыт независимо от текущего исходника. Для нового захвата нажмите «Кадр».';refresh();});input.click();
  }
  function describe(node,title){node.title=title;node.setAttribute('aria-label',title);}
  function button(host,id,caption,title,action,options={}){
    const b=el('button','gz-hx synthesis-button');b.type='button';b.dataset.n='synthesis:'+id;
    b.append(el('span','gz-nm',root.HubButtonText?.shortCaption(caption)||caption));describe(b,title);
    b.addEventListener('click',()=>run(()=>{const result=action();refresh();after();return result;}));host.append(b);bindings.push({node:b,...options});return b;
  }
  function choices(host,id,title,items,key,show){
    const label=()=>items.find(it=>it.v===prefs[key])?.name||title;
    const b=button(host,id,label(),title,()=>{const i=items.findIndex(it=>it.v===prefs[key]);setOption(key,items[(i+1)%items.length].v);},{caption:label,show});
    b.dataset.listTitle=title;b.setAttribute('aria-haspopup','true');
    root.ZerkGrozd.listHover(b,{options:()=>items.map(it=>({key:it.v,name:it.name,on:prefs[key]===it.v,pick:()=>run(()=>{setOption(key,it.v);after();})}))});return b;
  }
  function colour(host,key,title){
    const input=el('input');input.type='color';input.value=prefs[key];input.className='synthesis-colour-input';
    describe(input,title);input.addEventListener('input',()=>setOption(key,input.value));
    const b=button(host,key,title,title,()=>{input.value=prefs[key];input.click();});b.append(input);
    input.addEventListener('click',e=>e.stopPropagation());
  }
  function mount({host,after:notify=()=>{}}){
    after=notify;host.classList.add('synthesis-controls');
    button(host,'visible','Результат','Показать отдельное поле Синтеза',()=>setOption('visible',!prefs.visible),{selected:()=>prefs.visible});
    choices(host,'mode','Этап Синтеза',Object.entries(modes).map(([v,name],i)=>({v,name:(i+1)+'. '+name})),'mode');
    choices(host,'rule','Клеточное правило',Object.entries(rules).map(([v,name])=>({v,name})),'rule',()=>prefs.mode==='waves'||prefs.mode==='grow');
    choices(host,'trail','Длина следа в кадрах',[4,8,16,32,64].map(v=>({v,name:'След '+v})),'trailFrames',()=>prefs.mode==='trail');
    choices(host,'recovery','Кадров восстановления',[0,1,2,4,6,8,16,19,32,64].map(v=>({v,name:'Пауза '+v})),'recoveryFrames',()=>prefs.mode==='recovery');
    choices(host,'mix','Совмещение результата с исходником',[{v:'overlay',name:'Поверх'},{v:'only',name:'Отдельно'},{v:'xor',name:'XOR'},{v:'and',name:'AND'}],'mix');
    button(host,'link','Связь','Один шаг Синтеза на каждый последовательный кадр Маятника',()=>setOption('link',!prefs.link),{selected:()=>prefs.link,disabled:autonomous});
    button(host,'wrap','Замкнуть','Соединить противоположные края экспериментального поля',()=>setOption('wrap',!prefs.wrap),{selected:()=>prefs.wrap,show:cellular});
    button(host,'frame','Кадр','Взять текущий кадр Маятника; для большого CPU-поля — центральная область до 512 × 512',()=>capture(false));
    button(host,'area','Область','Взять выделенные ячейки исходного Маятника размером до 512 × 512',()=>capture(true));
    button(host,'cross','Крест','Отпечаток: крест 25 × 25 из 49 единиц',()=>preset('cross'));
    button(host,'point','Точка','Отпечаток: одна единица в центре поля',()=>preset('point'));
    button(host,'play','Пуск','Пуск / пауза самостоятельного Синтеза',play,{caption:()=>timer!==null?'Пауза':'Пуск',selected:()=>timer!==null,disabled:()=>prefs.link&&!autonomous()});
    button(host,'step','Шаг','Один самостоятельный шаг Синтеза',step,{disabled:()=>prefs.link&&!autonomous()});
    choices(host,'rate','Самостоятельных шагов в секунду',[1,2,4,8,16,30].map(v=>({v,name:v+' шаг/с'})),'rate');
    colour(host,'colourOne','Цвет 1');colour(host,'colourZero','Цвет 0');
    button(host,'reset','Заново','Очистить историю и начать с захваченного исходника',()=>{pause();if(engine){engine.reset(sourceBits);ticks=0;if(autonomous())engine.seed(sourceBits);dirty=true;message='История очищена.';render();scheduleSave();}});
    button(host,'save','Сохранить','Скачать полный опыт JSON: исходник, клетки, следы, восстановление и настройки',saveWork);
    button(host,'open','Открыть','Открыть сохранённый опыт JSON',importWork);
    button(host,'png','PNG','Скачать текущее поле результата в точном размере клеток',exportPNG);
    button(host,'bitoteka','В Битотеку','Сохранить опыт с миниатюрой в общую Битотеку',toLibrary);
    button(host,'help','Инструкция','Описание пяти этапов, правила аналогов и ограничения',()=>root.open('synthesis-instruction.html','_blank','noopener'));
    createPanel();start();return {refresh};
  }
  function createPanel(){
    panel=el('aside','synthesis-panel');panel.id='synthesisPanel';panel.setAttribute('aria-label','Поле Маятника · Синтез');
    const head=el('div','synthesis-heading');head.append(el('strong','','Маятник · Синтез'));
    toolbar=el('div','synthesis-toolbar');
    button(toolbar,'expand','Размер','Развернуть или уменьшить поле Синтеза',()=>setOption('expanded',!prefs.expanded),{selected:()=>prefs.expanded});
    button(toolbar,'close','Скрыть','Скрыть результат; вернуть через группу Синтез',()=>setOption('visible',false));
    status=el('p','synthesis-status');status.setAttribute('aria-live','polite');notice=el('p','synthesis-notice');notice.setAttribute('role','status');
    canvas=el('canvas','synthesis-canvas');canvas.width=129;canvas.height=129;canvas.setAttribute('aria-label','Результат клеточного Синтеза');ctx=canvas.getContext('2d');
    const viewport=el('div','synthesis-viewport');viewport.append(canvas);
    legend=el('p','synthesis-legend');
    weightPanel=el('details','synthesis-weights');weightPanel.append(el('summary','','Веса соседей и состояний'));
    weightPanel.addEventListener('toggle',()=>{if(prefs.weightsOpen!==weightPanel.open){prefs.weightsOpen=weightPanel.open;dirty=true;remember();scheduleSave();}});
    weightPanel.append(el('p','','Вес соседа = вес его состояния × вес направления. Рождение: сумма 5. Сохранение: 5 или 6.'));
    const directions=el('div','synthesis-weight-grid');
    const names=['↖','↑','↗','←','→','↙','↓','↘'];
    function weightButton(container,key,index,name){
      const update=()=>{pause();prefs[key]=prefs[key].slice();prefs[key][index]=(prefs[key][index]+1)%11;
        if(engine){engine.configure(engineOptions());engine.reset(sourceBits);if(autonomous())engine.seed(sourceBits);ticks=0;}
        dirty=true;message='Вес изменён: расчёт начат с исходного отпечатка.';remember();render();scheduleSave();};
      const b=button(container,key+index,name+' '+prefs[key][index],'Вес '+name+' от 0 до 10; нажатие — следующий',update,{caption:()=>name+' '+prefs[key][index]});b.dataset.noMini='';
    }
    for(let i=0;i<8;i++){if(i===4)directions.append(el('span','synthesis-weight-center','·'));weightButton(directions,'positionWeights',i,names[i]);}
    weightPanel.append(directions,el('p','','Влияние каждой стадии 0…6:'));
    const states=el('div','synthesis-state-grid');for(let i=0;i<7;i++)weightButton(states,'stateWeights',i,'Состояние '+i);
    weightPanel.append(states);
    button(weightPanel,'weights-reset','WG084','Вернуть исходные веса WG Rule084',()=>{pause();prefs.stateWeights=defaults.stateWeights.slice();prefs.positionWeights=defaults.positionWeights.slice();if(engine){engine.configure(engineOptions());engine.reset(sourceBits);if(autonomous())engine.seed(sourceBits);ticks=0;}dirty=true;remember();render();scheduleSave();});
    panel.append(head,toolbar,status,viewport,notice,legend,weightPanel);document.body.append(panel);refresh();
  }
  async function start(){
    try{
      const libraryId=new URLSearchParams(location.hash.slice(1)).get('synthesis');
      if(libraryId){
        if(!root.ZerkBitoteka)throw Error('Битотека недоступна.');
        const item=await root.ZerkBitoteka.get(libraryId);if(!item?.blob||!item.meta?.synthesis)throw Error('Опыт не найден в Битотеке этого браузера.');
        load(JSON.parse(await item.blob.text()));prefs.link=false;detached=true;dirty=true;remember();scheduleSave();message='Опыт открыт из Битотеки на паузе.';
      }else{
        const db=await database(),saved=await new Promise((resolve,reject)=>{const req=db.transaction('works').objectStore('works').get('last');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});if(saved)load(saved);
      }
    }
    catch(error){message='Восстановление опыта недоступно: '+error.message;}
    restoring=false;refresh();observeSource();
    // Bootstrap has async source restore, and can finish without another draw.
    const ready=setInterval(()=>{if(source()){clearInterval(ready);observeSource();}},250);
    setTimeout(()=>clearInterval(ready),30000);
    addEventListener('pagehide',()=>{pause();run(storeNow);});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();run(storeNow);}});
  }
  root.MayatnikSynthesis={mount,observeSource};
})(window);
