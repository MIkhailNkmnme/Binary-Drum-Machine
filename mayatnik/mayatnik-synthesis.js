/* Маятник · Синтез 0.006. Exact pendulum duet, score and computational art.
 * Source redraws are observations, never an animation clock. Only successive
 * source frames or explicit independent ticks advance experimental history. */
(function(root){
  'use strict';
  const KEY='synthesis-controls-v1',MAX=512;
  const defaults={mode:'pendulums',rule:'circuit',trailFrames:8,recoveryFrames:6,wrap:false,
    mix:'only',link:false,rate:8,colourOne:'#ffd35b',colourZero:'#5ce1e6',visible:true,
    weightsOpen:true,stateWeights:[0,1,2,1,0,0,1],positionWeights:[2,1,2,1,1,2,1,2],
    studioSection:'sources',palette:'nocturne',artStyle:'bits',musicStyle:'techno',tempo:120,volume:0.45,musicRoot:48,musicScale:'minor',density:3,musicBars:16,recipe:'',pendulumOptions:{}};
  const modes={pendulums:'Маятники A + B',trail:'След',waves:'Волны',recovery:'Восстановление',grow:'Отпечаток',weights:'Веса соседей'};
  const duetMode=()=>prefs.mode==='pendulums';
  const rules={circuit:'Circuit Genesis',fireworks:'Fireworks',replicator:'Replicator',weighted:'WG Rule084'};
  const autonomous=()=>prefs.mode==='grow'||prefs.mode==='weights';
  const cellular=()=>['waves','grow','weights'].includes(prefs.mode);
  let prefs={...defaults};
  function readPrefs(value){
    if(!value||typeof value!=='object')return {...defaults};
    const p={...defaults};
    for(const [key,allowed] of Object.entries({mode:Object.keys(modes),rule:Object.keys(rules),mix:['overlay','only','xor','and']}))if(allowed.includes(value[key]))p[key]=value[key];
    for(const key of ['wrap','link','visible','weightsOpen'])if(typeof value[key]==='boolean')p[key]=value[key];
    for(const [key,lo,hi] of [['trailFrames',1,64],['recoveryFrames',0,64],['rate',1,30]])if(Number.isInteger(value[key])&&value[key]>=lo&&value[key]<=hi)p[key]=value[key];
    for(const key of ['colourOne','colourZero'])if(/^#[0-9a-f]{6}$/i.test(value[key]||''))p[key]=value[key];
    for(const [key,n]of [['stateWeights',7],['positionWeights',8]])p[key]=Array.isArray(value[key])&&value[key].length===n&&value[key].every(v=>Number.isInteger(v)&&v>=0&&v<=10)?value[key].slice():defaults[key].slice();
    for(const [key,allowed]of Object.entries({studioSection:['sources','motion','combine','music','art','files'],palette:['nocturne','ember','vellum','polar','orchid'],artStyle:['bits','weave','strokes'],musicStyle:['techno','classic'],musicScale:['minor','major','pentatonic']}))if(allowed.includes(value[key]))p[key]=value[key];
    for(const [key,lo,hi]of [['tempo',60,180],['musicRoot',48,72],['density',1,4],['musicBars',4,32]])if(Number.isInteger(value[key])&&value[key]>=lo&&value[key]<=hi)p[key]=value[key];
    if(Number.isFinite(value.volume)&&value.volume>=0&&value.volume<=1)p.volume=value.volume;
    p.pendulumOptions=root.MayatnikSynthesisPendulums?.normalizeOptions(value.pendulumOptions||{})||{};
    if(typeof value.recipe==='string')p.recipe=value.recipe.slice(0,80);
    if(p.mode==='weights'){p.rule='weighted';p.link=false;}
    return p;
  }
  try{prefs=readPrefs(JSON.parse(localStorage.getItem(KEY)||'null'));}catch(_){}
  let engine=null,sourceBits=null,crop=null,sourceOwner=null,sourceMode='',sourceFrame=null,sourceSize='',
    panel=null,canvas=null,ctx=null,status=null,notice=null,bindings=[],after=()=>{},timer=null,
    ticks=0,message='',pendingSave=null,dbPromise=null,restoring=true,detached=false,dirty=false,weightPanel=null,legend=null,workInput=null,layerData=null,
    duet=null,music=null,exporting=false;
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
    if(duetMode())createDuet();else duet=null;
  }
  function createDuet(saved){
    if(!engine)return;
    const relative=(source()?.anchor??(crop.x+Math.floor(engine.width/2)))-crop.x;
    const anchor=relative>=0&&relative<engine.width?Math.round(relative):Math.floor(engine.width/2);
    duet=root.MayatnikSynthesisPendulums.create({width:engine.width,height:engine.height,anchor,sourceBits,options:prefs.pendulumOptions});
    if(saved)duet.restore(saved);
    prefs.pendulumOptions={...duet.options};ticks=duet.tick;
  }
  function musicOptions(){return {style:prefs.musicStyle,tempo:prefs.tempo,volume:prefs.volume,root:prefs.musicRoot,scale:prefs.musicScale,density:prefs.density};}
  function musicFrame(){return {a:duet.a,b:duet.b,result:duet.output,output:duet.output,age:duet.age,changed:duet.changed,options:duet.options,anchor:duet.anchor,width:duet.width,height:duet.height,tick:duet.tick};}
  function soundFrame(){if(duetMode()&&duet&&music?.enabled)music.playFrame(musicFrame());}
  function duetOption(key,value){
    pause();if(!engine)capture(false);if(!duet)createDuet();
    duet.configure({[key]:value});prefs.pendulumOptions={...duet.options};prefs.recipe='';ticks=duet.tick;
    message='Параметры изменены: новый отсчёт от исходного построения.';dirty=true;remember();render();scheduleSave();
  }
  function applyRecipe(id){
    const recipe=root.MayatnikSynthesisPendulums.recipes.find(r=>r.id===id);if(!recipe)throw Error('Неизвестный опыт.');
    pause();prefs.mode='pendulums';prefs.link=false;prefs.visible=true;prefs.mix='only';prefs.pendulumOptions=root.MayatnikSynthesisPendulums.normalizeOptions(recipe.options);
    const s=availableSource(),w=Math.min(385,s.W),h=Math.min(128,s.H),x=Math.max(0,Math.min(s.W-w,Math.round(s.anchor-(w-1)/2)));
    build(readBits(s,{x,y:0,w,h}),{x,y:0,w,h});bindSource(s);detached=false;
    prefs.recipe=id;message=recipe.description;dirty=true;remember();render();scheduleSave();root.maySynthesisFocus?.(crop);
  }
  function toCellular(mode){
    if(!duet)throw Error('Сначала создайте дуэт маятников.');
    const bits=duet.output.slice();pause();prefs.link=false;setMode(mode);sourceBits=bits;engine.reset(bits);if(autonomous()||mode==='waves')engine.seed(bits);
    detached=true;sourceOwner=null;sourceFrame=null;sourceMode='duet';sourceSize='';ticks=0;duet=null;dirty=true;
    message='Результат дуэта стал исходником опыта. Для «Волн» включите самостоятельный пуск; для живого входа снова захватите кадр.';
    remember();render();scheduleSave();
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
    const anchor=source()?.anchor||0;build(bits,{x:Math.max(0,Math.round(anchor-w/2)),y:0,w,h});engine.seed(bits);sourceOwner=null;sourceFrame=null;sourceSize='';
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
        if(bits.some((b,i)=>b!==sourceBits[i])){sourceBits=bits;engine.reset(bits);if(duetMode()){duet.updateSource(bits);ticks=duet.tick;}else ticks=0;dirty=true;message='Исходник изменён в том же кадре; музыкальный такт не продвинут.';render();scheduleSave();}
        return;
      }
      if(s.k!==sourceFrame+1){capture(false);message='Перемотка: промежуточные события неизвестны, история начата с кадра '+s.k+'.';refresh();return;}
      sourceBits=readBits(s,crop);engine.observe(sourceBits,{advance:true});
      if(duetMode()){duet.step(sourceBits);ticks=duet.tick;sourceFrame=s.k;dirty=true;soundFrame();render();scheduleSave();return;}
      if(prefs.mode==='waves')engine.step({injectChanges:true});
      sourceFrame=s.k;ticks++;dirty=true;render();scheduleSave();
    });
  }
  function step(){
    if(!engine){capture(false);if(!engine)return;}
    if(prefs.link&&!autonomous())throw Error('Для отдельного шага отключите «Связь». При включённой связи используйте плеер исходного Маятника.');
    if(duetMode()){if(!duet)createDuet();duet.step();ticks=duet.tick;dirty=true;soundFrame();render();scheduleSave();return;}
    engine.observe(sourceBits,{advance:true});
    if(cellular())engine.step({injectChanges:false});
    ticks++;dirty=true;render();scheduleSave();
  }
  function pause(){if(timer!==null){clearInterval(timer);timer=null;}music?.silence();refresh();}
  function play(){
    if(timer!==null){pause();return;}
    if(prefs.link&&!autonomous())throw Error('Включена «Связь»: запустите плеер исходного Маятника или отключите связь для самостоятельного хода.');
    if(!engine)capture(false);
    if(duetMode())soundFrame();
    timer=setInterval(()=>{try{step();}catch(error){pause();fail(error);}},duetMode()?60000/prefs.tempo/4:1000/prefs.rate);refresh();
  }
  function setMode(mode){
    pause();prefs.mode=mode;
    if(autonomous()||duetMode())prefs.link=false;
    if(mode==='weights')prefs.rule='weighted';
    if(engine){engine.configure(engineOptions());engine.reset(sourceBits);ticks=0;if(autonomous())engine.seed(sourceBits);dirty=true;}
    if(duetMode()){if(!engine)capture(false);else createDuet();prefs.mix='only';prefs.visible=true;}else{duet=null;music?.disable();}
    message=mode==='recovery'?'Слой Синтеза принимает изменение бита и удерживает его на время восстановления.':mode==='weights'?'Веса состояний × веса направлений. Рождение при сумме 5; сохранение при 5 или 6.':mode==='grow'?'Отпечаток развивается самостоятельно. Выберите правило и нажмите «Пуск».':'';
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
    if(['rate','tempo'].includes(key)&&wasPlaying){pause();play();}
    if(['musicStyle','tempo','volume','musicRoot','musicScale','density'].includes(key))music?.configure(musicOptions());
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
      if(duetMode()&&duet){
        root.MayatnikSynthesisArt.render(canvas,musicFrame(),{palette:prefs.palette,style:'bits',scale:1,transparent:prefs.mix==='overlay'});
        layerData=ctx.getImageData(0,0,w,h).data;
        refresh();root.maySynthesisPresent?.();return;
      }
      const img=ctx.createImageData(w,h),data=img.data;
      paintPixels(data);
      ctx.putImageData(img,0,0);
      if(!layerData||layerData.length!==data.length)layerData=new Uint8ClampedArray(data.length);
      if(prefs.mix!=='overlay')layerData.set(data);else paintLayerPixels(layerData);
    }
    refresh();
    root.maySynthesisPresent?.();
  }
  function paintLayerPixels(data){
    data.fill(0);
    const one=rgb(prefs.colourOne),zero=rgb(prefs.colourZero),count=root.MayatnikSynthesisCore.rules[prefs.rule].states,lut=[[0,0,0],one];
    for(let s=2;s<count;s++){const t=(s-2)/Math.max(1,count-3);lut.push(one.map((v,i)=>Math.round((v*(1-t)+zero[i]*t)*(1-.8*t))));}
    for(let q=0;q<sourceBits.length;q++){
      let col,alpha;
      if(prefs.mode==='trail'){col=engine.direction[q]?one:zero;alpha=Math.min(1,engine.trail[q]/prefs.trailFrames);}
      else if(prefs.mode==='recovery'){col=engine.recovered[q]===1?one:zero;alpha=engine.recovered[q]!==sourceBits[q]?1:0;}
      else{col=lut[engine.state[q]];alpha=engine.state[q]?1:0;}
      const p=q*4;data[p]=col[0];data[p+1]=col[1];data[p+2]=col[2];data[p+3]=Math.round(alpha*255);
    }
  }
  function getLayer(){
    return !prefs.visible||!engine||!layerData?null:{width:engine.width,height:engine.height,crop:{...crop},data:layerData,only:prefs.mix==='only'};
  }
  function refresh(){
    if(!panel)return;
    if(weightPanel){weightPanel.hidden=prefs.rule!=='weighted'||!cellular();weightPanel.open=prefs.weightsOpen;}
    if(legend)legend.textContent=duetMode()?'A · B · '+(duet?.options.operation||'XOR').toUpperCase()+(music?.enabled?' · ♫':''):prefs.mode==='trail'?'Цвет 1 — переход 0→1; цвет 0 — переход 1→0. Яркость показывает возраст.':prefs.mode==='recovery'?'Поверх: цветом показаны отличия от входного кадра. Только Синтез: удерживаемые биты.':'Цвет 1 — активная клетка; цвет 0 — конец затухания. XOR / AND учитывают только состояние 1.';
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
    return {format:'zerkalius-synthesis',version:2,base:'0.999',prefs:{...prefs},engine:engine.snapshot(),sourceBits:Array.from(sourceBits),crop:{...crop},sourceFrame,sourceMode,sourceSize,ticks,detached,duet:duetMode()&&duet?duet.snapshot():null};
  }
  function load(data){
    if(!data||data.format!=='zerkalius-synthesis'||![1,2].includes(data.version))throw Error('Это не сохранённый опыт Маятника · Синтез.');
    const next=root.MayatnikSynthesisCore.create({width:1,height:1});next.restore(data.engine);
    if(!Array.isArray(data.sourceBits)||data.sourceBits.length!==next.width*next.height||data.sourceBits.some(b=>![-1,0,1].includes(b)))throw Error('Повреждён исходный кадр опыта.');
    if(data.sourceBits.some((b,i)=>b!==data.engine.previous[i]))throw Error('Исходник и история опыта не совпадают.');
    const r=data.crop;
    if(!r||!Number.isSafeInteger(r.x)||!Number.isSafeInteger(r.y)||r.x<0||r.y<0||r.w!==next.width||r.h!==next.height)throw Error('Повреждена область опыта.');
    if(!Number.isSafeInteger(data.ticks)||data.ticks<0||!(data.sourceFrame===null||Number.isSafeInteger(data.sourceFrame)&&data.sourceFrame>=0))throw Error('Повреждён номер шага.');
    const nextPrefs=readPrefs(data.prefs);let nextDuet=null;
    if(nextPrefs.mode==='pendulums'){
      if(!data.duet)throw Error('В опыте отсутствует состояние двух маятников.');
      nextDuet=root.MayatnikSynthesisPendulums.create({width:next.width,height:next.height,anchor:data.duet.anchor,sourceBits:data.sourceBits});nextDuet.restore(data.duet);
      if(nextDuet.width!==next.width||nextDuet.height!==next.height||nextDuet.tick!==data.ticks)throw Error('Размер или время маятников не совпадает с опытом.');
      if(data.duet.source.some((b,i)=>b!==data.sourceBits[i]))throw Error('Источники маятников не совпадают с сохранённым кадром.');
      nextPrefs.pendulumOptions={...nextDuet.options};
    }
    pause();music?.disable();engine=next;sourceBits=Int8Array.from(data.sourceBits);crop={...r};prefs=nextPrefs;duet=nextDuet;
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
  async function exportArt(type){
    if(!duet)throw Error('Сначала откройте опыт двух маятников.');
    const title='Маятниковый атлас · '+(prefs.recipe||duet.options.operation)+' · '+ticks;
    const options={palette:prefs.palette,style:prefs.artStyle,title,poster:true,scale:4};
    if(type==='svg')download(new Blob([root.MayatnikSynthesisArt.svg(musicFrame(),options)],{type:'image/svg+xml'}),'Маятник-Картина-'+ticks+'.svg');
    else{const art=document.createElement('canvas');root.MayatnikSynthesisArt.render(art,musicFrame(),options);const blob=await new Promise(resolve=>art.toBlob(resolve,'image/png'));if(!blob)throw Error('Не удалось сохранить картину.');download(blob,'Маятник-Картина-'+ticks+'.png');}
  }
  async function toggleSound(){
    if(!music)music=root.MayatnikSynthesisMusic.createPlayer();
    if(music.enabled)music.disable();else await music.enable(musicOptions());
    message=music.enabled?'Звук включён. «Пуск» проигрывает построение; «Шаг» — один музыкальный такт.':'Звук выключен.';refresh();
  }
  async function exportMusic(type){
    if(!duet||exporting)return;
    exporting=true;pause();message='Собирается композиция…';refresh();
    try{
      const saved=duet.snapshot(),copy=root.MayatnikSynthesisPendulums.create({width:duet.width,height:duet.height,anchor:saved.anchor});copy.restore(saved);
      const events=[],options=musicOptions(),steps=prefs.musicBars*16;
      for(let i=0;i<steps;i++){
        events.push(...root.MayatnikSynthesisMusic.frameEvents({a:copy.a,b:copy.b,result:copy.output,width:copy.width,height:copy.height,tick:i},options));copy.step();
        if(i%8===0){message='Композиция '+Math.round(i/steps*100)+'%';refresh();await new Promise(resolve=>setTimeout(resolve,0));}
      }
      const bytes=type==='midi'?root.MayatnikSynthesisMusic.exportMidi(events,options):root.MayatnikSynthesisMusic.renderWav(events,options,{durationSeconds:steps*15/options.tempo+3,sampleRate:44100});
      download(new Blob([bytes],{type:type==='midi'?'audio/midi':'audio/wav'}),'Маятник-'+prefs.musicStyle+'-'+prefs.musicBars+'-тактов.'+(type==='midi'?'mid':'wav'));
      message='Композиция сохранена: '+prefs.musicBars+' тактов. Исходный опыт остался на прежнем шаге.';
    }finally{exporting=false;refresh();}
  }
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
    workInput.value='';workInput.click();
  }
  function describe(node,title){node.title=title;node.setAttribute('aria-label',title);}
  function button(host,id,caption,title,action,options={}){
    const b=el('button','gz-hx synthesis-button');b.type='button';b.dataset.n='synthesis:'+id;
    const icons={play:'play',step:'forward',sound:'sound',save:'save',open:'load',png:'image','art-png':'image','art-svg':'image',gallery:'image',help:'help',focus:'target',wav:'sound',midi:'sound',bitoteka:'save',reset:'reset'};
    b.dataset.miIcon=icons[id]||'field';
    if(root.ZerkMenuIcons){const icon=el('span','gz-ic synthesis-icon');icon.setAttribute('aria-hidden','true');icon.style.setProperty('--synthesis-icon',root.ZerkMenuIcons.iconFor(b));b.append(icon);}
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
  function mountStudio(host){
    const section=name=>()=>duetMode()&&prefs.studioSection===name;
    choices(host,'studio-section','Раздел мастерской',[['sources','Исходники'],['motion','Движение'],['combine','Сочетание'],['music','Музыка'],['art','Картины'],['files','Сохранение']].map(([v,name])=>({v,name})),'studioSection',duetMode);
    button(host,'focus','К построению','Поместить область Синтеза в экран крупно',()=>root.maySynthesisFocus?.(crop),{show:duetMode});
    const recipeLabel=()=>root.MayatnikSynthesisPendulums.recipes.find(r=>r.id===prefs.recipe)?.name||'Опыты';
    const recipeButton=button(host,'recipes',recipeLabel(),'Готовые опыты: исходные построения и их синтез',()=>applyRecipe(root.MayatnikSynthesisPendulums.recipes[(root.MayatnikSynthesisPendulums.recipes.findIndex(r=>r.id===prefs.recipe)+1)%root.MayatnikSynthesisPendulums.recipes.length].id),{show:duetMode,caption:recipeLabel});
    recipeButton.setAttribute('aria-haspopup','true');root.ZerkGrozd.listHover(recipeButton,{options:()=>root.MayatnikSynthesisPendulums.recipes.map(r=>({key:r.id,name:r.name,on:prefs.recipe===r.id,pick:()=>run(()=>{applyRecipe(r.id);after();})}))});
    function option(key,title,items,group){
      const value=()=>duet?.options[key]??prefs.pendulumOptions[key];
      const label=()=>title+' '+(items.find(i=>i.v===value())?.name??String(value()??''));
      const pick=v=>{duetOption(key,v);after();};
      const b=button(host,'duet-'+key,label(),title,()=>pick(items[(items.findIndex(i=>i.v===value())+1)%items.length].v),{show:section(group),caption:label});
      b.setAttribute('aria-haspopup','true');root.ZerkGrozd.listHover(b,{options:()=>items.map(i=>({key:String(i.v),name:i.name,on:value()===i.v,pick:()=>run(()=>pick(i.v))}))});
    }
    const sources=[['source','Текущий кадр'],['memory','Память'],['pend','Маятник ←'],['pendR','Маятник →'],['left','Влево'],['right','Вправо'],['pair','Пара вершин'],['cone','Конус'],['feedback','Обратная связь']].map(([v,name])=>({v,name}));
    option('sourceA','A',sources,'sources');option('sourceB','B',sources,'sources');
    option('depth','Строк',[16,32,64,128].map(v=>({v,name:String(v)})),'sources');
    button(host,'memory','Запомнить','Сохранить текущий захваченный кадр в отдельном источнике «Память»',()=>{if(!duet)return;duet.setMemory(sourceBits);dirty=true;message='Захваченный кадр сохранён в памяти A/B.';render();scheduleSave();},{show:section('sources')});
    option('rateA','Ход A',[0,.5,1,1.5,2,3].map(v=>({v,name:v===0?'Стоп':String(v)+'×'})),'motion');
    option('rateB','Ход B',[0,.5,1,1.5,2,3].map(v=>({v,name:v===0?'Стоп':String(v)+'×'})),'motion');
    option('phaseB','Фаза B',[0,1,2,4,8,16,32,64,96,127].map(v=>({v,name:String(v)})),'motion');
    option('delayB','Задержка',[0,1,2,4,8,16].map(v=>({v,name:String(v)})),'motion');
    option('transformB','Вид B',[['identity','Прямой'],['mirrorX','Зеркало ↔'],['mirrorY','Зеркало ↕'],['rotate180','Поворот 180°']].map(([v,name])=>({v,name})),'combine');
    option('shiftX','Сдвиг X',[-128,-64,-32,-16,-8,-1,0,1,8,16,32,64,128].map(v=>({v,name:String(v)})),'combine');
    option('shiftY','Сдвиг Y',[-128,-64,-32,-16,-8,-1,0,1,8,16,32,64,128].map(v=>({v,name:String(v)})),'combine');
    button(host,'invert-b','Инверсия B','Инвертировать 0 и 1 источника B; пустые клетки сохранить',()=>duetOption('invertB',!duet.options.invertB),{show:section('combine'),selected:()=>!!duet?.options.invertB});
    option('operation','Операция',[['xor','XOR'],['and','AND'],['or','Объединение'],['subtract','A − B'],['mask','Маска B'],['a','Только A'],['b','Только B']].map(([v,name])=>({v,name})),'combine');
    option('history','Память',[['none','Текущий'],['trail','След'],['accumulate','Накопить XOR']].map(([v,name])=>({v,name})),'combine');
    option('trailLength','След',[2,4,8,16,32,64].map(v=>({v,name:String(v)})),'combine');
    for(const [mode,name]of [['grow','В Отпечаток'],['waves','В Волны'],['recovery','В Удержание']])button(host,'send-'+mode,name,'Передать результат двух маятников в режим '+modes[mode],()=>toCellular(mode),{show:section('combine')});
    button(host,'sound','Звук','Включить / выключить звук; без автоматического воспроизведения после открытия',toggleSound,{show:duetMode,selected:()=>!!music?.enabled});
    choices(host,'music-style','Музыкальное развитие',[{v:'techno',name:'Робо-техно'},{v:'classic',name:'Классика'}],'musicStyle',section('music'));
    choices(host,'tempo','Темп: один шаг — шестнадцатая нота',[60,72,84,96,108,120,128,140,160,180].map(v=>({v,name:v+' BPM'})),'tempo',duetMode);
    choices(host,'scale','Музыкальный лад',[{v:'minor',name:'Минор'},{v:'major',name:'Мажор'},{v:'pentatonic',name:'Пентатоника'}],'musicScale',section('music'));
    choices(host,'root','Тоника и регистр',[48,50,52,53,55,57,59,60,62,64,65,67,69,71,72].map(v=>({v,name:'Нота '+v})),'musicRoot',section('music'));
    choices(host,'volume','Громкость',[0,.15,.3,.45,.6,.8,1].map(v=>({v,name:Math.round(v*100)+'%'})),'volume',section('music'));
    choices(host,'density','Плотность музыкальных событий',[1,2,3,4].map(v=>({v,name:'Голоса '+v})),'density',section('music'));
    choices(host,'bars','Длина законченной композиции',[4,8,16,32].map(v=>({v,name:v+' тактов'})),'musicBars',section('music'));
    button(host,'wav','WAV','Собрать и скачать композицию из текущего опыта, стерео 44,1 кГц',()=>exportMusic('wav'),{show:section('music'),disabled:()=>exporting});
    button(host,'midi','MIDI','Скачать ноты, темп и инструменты композиции для музыкального редактора',()=>exportMusic('midi'),{show:section('music'),disabled:()=>exporting});
    choices(host,'palette','Палитра построения',root.MayatnikSynthesisArt.palettes.map(p=>({v:p.id,name:p.name})),'palette',section('art'));
    choices(host,'art-style','Художественный вариант экспорта',[{v:'bits',name:'Точные биты'},{v:'weave',name:'Ткань'},{v:'strokes',name:'Живопись'}],'artStyle',section('art'));
    button(host,'art-png','Картина PNG','Скачать картину в выбранном художественном варианте',()=>exportArt('png'),{show:section('art')});
    button(host,'art-svg','Картина SVG','Скачать масштабируемую картину с описанием опыта',()=>exportArt('svg'),{show:section('art')});
    button(host,'gallery','Галерея','Маятниковый атлас: готовые картины, робо-техно и классика',()=>root.open('synthesis-gallery.html','_blank','noopener'),{show:duetMode});
  }
  function mount({host,after:notify=()=>{}}){
    after=notify;host.classList.add('synthesis-controls');
    button(host,'visible','Результат','Показать результат Синтеза на основном поле Маятника',()=>setOption('visible',!prefs.visible),{selected:()=>prefs.visible});
    choices(host,'mode','Режим Синтеза',Object.entries(modes).map(([v,name])=>({v,name})),'mode');
    mountStudio(host);
    choices(host,'rule','Клеточное правило',Object.entries(rules).map(([v,name])=>({v,name})),'rule',()=>prefs.mode==='waves'||prefs.mode==='grow');
    choices(host,'trail','Длина следа в кадрах',[4,8,16,32,64].map(v=>({v,name:'След '+v})),'trailFrames',()=>prefs.mode==='trail');
    choices(host,'recovery','Кадров восстановления',[0,1,2,4,6,8,16,19,32,64].map(v=>({v,name:'Пауза '+v})),'recoveryFrames',()=>prefs.mode==='recovery');
    choices(host,'mix','Совмещение результата с исходником',[{v:'overlay',name:'Поверх'},{v:'only',name:'Только Синтез'},{v:'xor',name:'XOR'},{v:'and',name:'AND'}],'mix',()=>!duetMode());
    button(host,'link','Связь','Один шаг Синтеза на каждый последовательный кадр Маятника',()=>setOption('link',!prefs.link),{selected:()=>prefs.link,disabled:autonomous});
    button(host,'wrap','Замкнуть','Соединить противоположные края экспериментального поля',()=>setOption('wrap',!prefs.wrap),{selected:()=>prefs.wrap,show:cellular});
    button(host,'frame','Кадр','Взять текущий кадр Маятника; для большого CPU-поля — центральная область до 512 × 512',()=>capture(false));
    button(host,'area','Область','Взять выделенные ячейки исходного Маятника размером до 512 × 512',()=>capture(true));
    button(host,'cross','Крест','Отпечаток: крест 25 × 25 из 49 единиц',()=>preset('cross'),{show:()=>!duetMode()});
    button(host,'point','Точка','Отпечаток: одна единица в центре поля',()=>preset('point'),{show:()=>!duetMode()});
    button(host,'play','Пуск','Пуск / пауза самостоятельного Синтеза',play,{caption:()=>timer!==null?'Пауза':'Пуск',selected:()=>timer!==null,disabled:()=>prefs.link&&!autonomous()});
    button(host,'step','Шаг','Один самостоятельный шаг Синтеза',step,{disabled:()=>prefs.link&&!autonomous()});
    choices(host,'rate','Самостоятельных шагов в секунду',[1,2,4,8,16,30].map(v=>({v,name:v+' шаг/с'})),'rate',()=>!duetMode());
    colour(host,'colourOne','Цвет 1');colour(host,'colourZero','Цвет 0');
    button(host,'reset','Заново','Очистить историю и начать с захваченного исходника',()=>{pause();if(engine){engine.reset(sourceBits);ticks=0;if(duetMode())duet.reset(sourceBits);if(autonomous())engine.seed(sourceBits);dirty=true;message='История очищена.';render();scheduleSave();}});
    button(host,'save','Сохранить','Скачать полный опыт JSON: исходник, клетки, следы, восстановление и настройки',saveWork);
    button(host,'open','Открыть','Открыть сохранённый опыт JSON',importWork);
    button(host,'png','PNG','Скачать текущее поле результата в точном размере клеток',exportPNG);
    button(host,'bitoteka','В Битотеку','Сохранить опыт с миниатюрой в общую Битотеку',toLibrary);
    button(host,'help','Инструкция','Полный план, построения A/B, музыка, картины и прежние режимы',()=>root.open('synthesis-instruction.html','_blank','noopener'));
    for(const binding of bindings){
      const id=binding.node.dataset.n;
      if(['synthesis:save','synthesis:open','synthesis:png','synthesis:bitoteka'].includes(id))binding.show=()=>!duetMode()||prefs.studioSection==='files';
      if(['synthesis:colourOne','synthesis:colourZero'].includes(id))binding.show=()=>!duetMode();
      if(['synthesis:frame','synthesis:area','synthesis:link'].includes(id))binding.show=()=>!duetMode()||prefs.studioSection==='sources';
    }
    createPanel(host);start();return {refresh};
  }
  function createPanel(host){
    workInput=el('input');workInput.id='synthesisWorkInput';workInput.type='file';workInput.accept='.json,application/json';workInput.hidden=true;
    workInput.addEventListener('change',()=>run(async()=>{const file=workInput.files?.[0];if(!file)return;if(file.size>80*1024*1024)throw Error('Файл опыта больше 80 МиБ.');load(JSON.parse(await file.text()));prefs.link=false;detached=true;dirty=true;remember();scheduleSave();message='Опыт открыт независимо от текущего исходника. Для нового захвата нажмите «Кадр».';refresh();}));
    document.body.append(workInput);
    panel=el('section','synthesis-info');panel.id='synthesisPanel';panel.setAttribute('aria-label','Сведения и настройки Синтеза');
    status=el('p','synthesis-status');status.setAttribute('aria-live','polite');notice=el('p','synthesis-notice');notice.setAttribute('role','status');
    canvas=el('canvas','synthesis-canvas');canvas.width=129;canvas.height=129;canvas.setAttribute('aria-label','Результат клеточного Синтеза');ctx=canvas.getContext('2d');
    legend=el('p','synthesis-legend');
    weightPanel=el('details','synthesis-weights');weightPanel.append(el('summary','','Веса соседей и состояний'));
    weightPanel.addEventListener('toggle',()=>{if(prefs.weightsOpen!==weightPanel.open){prefs.weightsOpen=weightPanel.open;dirty=true;remember();scheduleSave();}after();});
    weightPanel.append(el('p','','Вес соседа = вес его состояния × вес направления. Рождение: сумма 5. Сохранение: 5 или 6.'));
    const directions=el('div','synthesis-weight-grid');
    const names=['↖','↑','↗','←','→','↙','↓','↘'];
    function weightButton(container,key,index,name){
      const update=()=>{pause();prefs[key]=prefs[key].slice();prefs[key][index]=(prefs[key][index]+1)%11;
        if(engine){engine.configure(engineOptions());engine.reset(sourceBits);if(autonomous())engine.seed(sourceBits);ticks=0;}
        dirty=true;message='Вес изменён: расчёт начат с исходного отпечатка.';remember();render();scheduleSave();};
      const b=button(container,key+index,name+' '+prefs[key][index],'Вес '+name+' от 0 до 10; нажатие — следующий',update,{caption:()=>name+' '+prefs[key][index]});b.dataset.noMini='';
    }
    for(let i=0;i<8;i++){weightButton(directions,'positionWeights',i,names[i]);}
    weightPanel.append(directions,el('p','','Влияние каждой стадии 0…6:'));
    const states=el('div','synthesis-state-grid');for(let i=0;i<7;i++)weightButton(states,'stateWeights',i,'Состояние '+i);
    weightPanel.append(states);
    button(weightPanel,'weights-reset','WG084','Вернуть исходные веса WG Rule084',()=>{pause();prefs.stateWeights=defaults.stateWeights.slice();prefs.positionWeights=defaults.positionWeights.slice();if(engine){engine.configure(engineOptions());engine.reset(sourceBits);if(autonomous())engine.seed(sourceBits);ticks=0;}dirty=true;remember();render();scheduleSave();});
    panel.append(status,notice,legend,weightPanel);host.append(panel);refresh();
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
    let initialised=false;
    const initialise=()=>{
      if(initialised||!source())return;initialised=true;
      run(()=>{
        const query=new URLSearchParams(location.search),recipe=query.get('synthRecipe');
        if(recipe){
          applyRecipe(recipe);const patch={};
          if(query.has('synthDepth')&&[16,32,64,128].includes(Number(query.get('synthDepth'))))patch.depth=Number(query.get('synthDepth'));
          if(['identity','mirrorX','mirrorY','rotate180'].includes(query.get('synthTransform')))patch.transformB=query.get('synthTransform');
          for(const [param,key]of [['synthShiftX','shiftX'],['synthShiftY','shiftY']])if(query.has(param)){const n=Number(query.get(param));if(Number.isInteger(n)&&n>=-128&&n<=128)patch[key]=n;}
          duet.configure(patch);prefs.pendulumOptions={...duet.options};
          if(root.MayatnikSynthesisArt.palettes.some(p=>p.id===query.get('synthPalette')))prefs.palette=query.get('synthPalette');
          if(['bits','weave','strokes'].includes(query.get('synthArtStyle')))prefs.artStyle=query.get('synthArtStyle');
          const target=Number(query.get('synthTick'));if(Number.isInteger(target)&&target>=0&&target<=512)for(let i=0;i<target;i++)duet.step();
          ticks=duet.tick;dirty=true;remember();render();scheduleSave();after();
          // A recipe link is an opening instruction. Reload restores subsequent work.
          for(const key of ['synthRecipe','synthDepth','synthTick','synthTransform','synthShiftX','synthShiftY','synthPalette','synthArtStyle'])query.delete(key);
          history.replaceState(null,'',location.pathname+(query.size?'?'+query.toString():'')+location.hash);
        }else if(!engine&&duetMode()){applyRecipe('canon');after();}else observeSource();
      });
    };
    initialise();const ready=setInterval(()=>{initialise();if(initialised)clearInterval(ready);},250);
    setTimeout(()=>clearInterval(ready),30000);
    addEventListener('pagehide',()=>{pause();run(storeNow);});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();run(storeNow);}});
  }
  root.MayatnikSynthesis={mount,observeSource,getLayer,snapshot};
})(window);
