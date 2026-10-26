/* МАЯ-029. Library view subscribes to explicit changes; never to the drawing loop. */
(function(root){
  'use strict';
  if(!root.document)return;
  const doc=root.document,OPEN_KEY='mayatnik-template-panel-open',WIDTH_KEY='mayatnik-template-panel-width',TAB_KEY='mayatnik-library-tab',LAYOUT_KEY='mayatnik-library-layout';
  let panel,grid,crumbs,status,engine,unsubscribe,store,current='',open=false,scheduled=false,libraryKey='',renderKey='',dragged=null;
  let libraryWindow=null,folderUnsubscribe,sequencePane,sequenceView;
  const cards=new Map(),previews=new Map(),metricsCache=new WeakMap();let observer;
  const identities=new WeakMap();let identityCounter=0;
  const metricTasks=new Map();let metricTimer=0,metricActive=null;
  let activeTab='templates',templatePane,folderButton,layerPane,layerGrid,layerApi,layerUnsubscribe,layout='tiles';const layoutButtons=new Map();
  function setLayout(value,persist=true){layout=value==='list'?'list':'tiles';panel.dataset.layout=layout;for(const [key,b]of layoutButtons)b.setAttribute('aria-pressed',String(key===layout));if(persist)try{root.localStorage.setItem(LAYOUT_KEY,layout);}catch(_){}queueVisibleMetrics();}
  const captureLibraries=new Map([
    ['frames',{key:'frames',title:'Кадры',word:'кадр',genitive:'кадра',plural:'кадров',scope:'весь маятник целиком с текущим масштабом и положением поля',apiName:'mayFrameLibrary'}],
    ['settings',{key:'settings',title:'Настройки',word:'набор',genitive:'набора',plural:'настроек',scope:'включённые режимы, цвета, масштаб и инструменты (текущий кадр и его геометрия сохраняются)',apiName:'maySettingsLibrary'}]
  ]);
  const tabButtons=new Map();
  let templateLimitButton;
  let templateLimitNotice,templateLimitTimer;
  function showTemplateLimitNotice(event){
    if(!templateLimitNotice){templateLimitNotice=doc.createElement('output');templateLimitNotice.className='may-template-limit-notice';templateLimitNotice.setAttribute('role','status');doc.body.append(templateLimitNotice);}
    templateLimitNotice.textContent=event.detail?.message||'Шаблон превышает максимальную площадь';templateLimitNotice.hidden=false;
    root.clearTimeout(templateLimitTimer);templateLimitTimer=root.setTimeout(()=>{templateLimitNotice.hidden=true;},4000);
  }
  function syncTemplateLimit(){if(!templateLimitButton)return;const api=root.mayTemplateLimit;templateLimitButton.disabled=!api;
    templateLimitButton.textContent='▣ Площадь ≤ '+(api?.get()??4096).toLocaleString('ru-RU')+' бит';}
  function editTemplateLimit(){const api=root.mayTemplateLimit;if(!api)return;
    const value=root.prompt('Максимальная площадь выделяемого шаблона в битах (ширина × высота, включая промежутки). От 1 до 1048576.',String(api.get()));
    if(value===null)return;const n=Number(value.trim());
    if(!Number.isInteger(n)||n<1||n>1048576){root.alert('Введите целое число от 1 до 1048576.');return;}
    api.set(n);syncTemplateLimit();}
  let folderTree,address,upButton,sectionSave,renameButton,deleteButton,searchInput,query='',folderSelection='';
  const sectionTitle=()=>activeTab==='templates'?'Шаблоны':activeTab==='layers'?'Слои':activeTab==='sequences'?'Послед-ти':captureLibraries.get(activeTab)?.title||'';
  const matches=name=>!query||String(name||'').toLocaleLowerCase().includes(query);
  function folderNodes(){return store?.snapshot().nodes.filter(n=>n.kind==='folder')||[];}
  function navigateFolder(id){current=id;folderSelection=id;renderKey='';selectTab('templates');}
  function selectedEntry(){
    if(activeTab==='templates')return folderSelection?folderNodes().find(n=>n.id===folderSelection):engine?.list().find(n=>n.id===engine.getState().selectedId);
    if(activeTab==='layers')return layerApi?.get(layerApi.selected());
    const library=captureLibraries.get(activeTab);return library?.api?.list().find(n=>n.id===library.api.getState().selectedId);
  }
  function selectedAction(action){const entry=selectedEntry();if(!entry)return;
    if(action==='rename'){const value=root.prompt('Название',entry.name);if(!value?.trim())return;
      if(activeTab==='templates'){if(folderSelection)organise(()=>store.rename(entry.id,value.trim()));else act(entry.id,'rename',value.trim());}
      else if(activeTab!=='layers')captureAction(captureLibraries.get(activeTab),'rename',entry.id,value.trim());
    }else{
      if(!root.confirm('Удалить «'+entry.name+'»'+(folderSelection&&activeTab==='templates'?'? Содержимое папки останется на уровень выше.':'?')))return;
      if(activeTab==='templates'){if(folderSelection){folderSelection='';organise(()=>store.removeFolder(entry.id));}else act(entry.id,'delete-library');}
      else if(activeTab==='layers')layerApi.remove(entry.id);
      else captureAction(captureLibraries.get(activeTab),'remove',entry.id);
    }syncExplorer();
  }
  function syncExplorer(){if(!address)return;
    const folders=new Map(folderNodes().map(n=>[n.id,n])),path=[];let id=activeTab==='templates'?current:'';const seen=new Set();
    while(id&&folders.has(id)&&!seen.has(id)){seen.add(id);const n=folders.get(id);path.unshift(n);id=n.parent;}
    address.textContent=['Библиотека',sectionTitle(),...path.map(n=>n.name)].join(' / ');address.title=address.textContent;
    upButton.disabled=activeTab!=='templates'||!current;folderButton.hidden=activeTab!=='templates';
    const library=captureLibraries.get(activeTab),entry=selectedEntry(),busy=activeTab==='templates'?!!engine?.getState().busy:activeTab==='layers'?false:!!library?.pending||!!library?.api?.getState().busy;
    sectionSave.disabled=busy||(activeTab==='templates'?!!saveButton?.disabled:activeTab==='layers'?!entry?.capturable:activeTab==='sequences'?!root.maySequences:!library?.api);
    sectionSave.title=activeTab==='templates'?'Сохранить выбранную фигуру в библиотеку':activeTab==='layers'?'Создать фиксацию выбранного слоя':activeTab==='sequences'?'Применить строки из редактора':library?'Сохранить '+library.scope:'';
    renameButton.disabled=busy||!entry||activeTab==='layers';deleteButton.disabled=busy||!entry||(activeTab==='layers'&&!entry.removable);
    searchInput.placeholder='Поиск: '+sectionTitle();
    const fragment=doc.createDocumentFragment();
    const add=(parent,depth)=>{for(const n of folders.values())if(n.parent===parent){const b=button('📁 '+n.name,n.name,()=>navigateFolder(n.id));b.dataset.folderId=n.id;b.dataset.userLabel='';b.style.setProperty('--mtp-depth',String(depth));b.setAttribute('aria-pressed',String(activeTab==='templates'&&current===n.id));dropTarget(b,'folder',n.id);fragment.append(b);add(n.id,depth+1);}};
    add('',0);folderTree.replaceChildren(fragment);
  }

  function selectTab(tab,persist=true){if(tab==='views')tab='frames';activeTab=tab==='layers'||tab==='sequences'||captureLibraries.has(tab)?tab:'templates';if(!panel)return;
    templatePane.hidden=activeTab!=='templates';sequencePane.hidden=activeTab!=='sequences';panel.querySelector('.mtp-viewbar').hidden=activeTab==='sequences';layerPane.hidden=activeTab!=='layers';for(const library of captureLibraries.values())library.pane.hidden=activeTab!==library.key;folderButton.hidden=activeTab!=='templates';
    for(const [key,b]of tabButtons){b.setAttribute('aria-selected',String(key===activeTab));b.setAttribute('aria-pressed',String(key===activeTab));b.tabIndex=key===activeTab?0:-1;}
    if(persist)try{root.localStorage.setItem(TAB_KEY,activeTab);}catch(_){}
    syncExplorer();if(activeTab!=='templates'){metricTasks.clear();metricActive=null;renderActive();}else{engine?.refresh();renderKey='';render();}
  }
  function renderActive(){if(activeTab==='sequences'){if(!sequenceView&&root.maySequences)sequenceView=root.MayatnikSequences.mount(sequencePane,root.maySequences);sequenceView?.refresh();syncExplorer();}else if(activeTab==='layers')renderLayers();else renderCapture(captureLibraries.get(activeTab));}
  function renderLayers(){if(!layerGrid||!open||activeTab!=='layers')return;const layers=layerApi?.list()||[],selected=layerApi?.selected();
    panel.setAttribute('aria-busy','false');syncExplorer();const signature=JSON.stringify([query,selected,layers.map(l=>[l.id,l.name,l.visible,l.opacity,l.kind])]);if(layerGrid.dataset.signature===signature)return;layerGrid.dataset.signature=signature;
    const fragment=doc.createDocumentFragment();
    for(const layer of layers.filter(l=>matches(l.name))){const row=doc.createElement('article');row.className='mtp-layer-row';row.dataset.layerId=layer.id;row.classList.toggle('mtp-selected',layer.id===selected);
      const choose=button(layer.name,'Выбрать слой: '+layer.name,()=>layerApi.select(layer.id));choose.dataset.userLabel='';choose.setAttribute('aria-pressed',String(layer.id===selected));
      const info=doc.createElement('span');info.className='mtp-layer-opacity';info.textContent=layer.opacity+'%';
      const visible=button(layer.visible?'◉':'○',layer.visible?'Скрыть слой':'Показать слой',()=>{const current=layerApi.get(layer.id);if(current)layerApi.set(layer.id,{visible:!current.visible});});visible.setAttribute('aria-pressed',String(layer.visible));visible.dataset.layerVisibility='';row.append(choose,info,visible);fragment.append(row);
    }
    if(!layers.filter(l=>matches(l.name)).length){const empty=doc.createElement('p');empty.className='mtp-empty';empty.textContent=query?'Поиск не дал результатов.':'На поле пока нет слоёв.';fragment.append(empty);}layerGrid.replaceChildren(fragment);
  }
  function bindLayers(api){if(!api||api===layerApi)return;layerUnsubscribe?.();layerApi=api;layerUnsubscribe=api.subscribe(renderLayers);if(layerGrid)delete layerGrid.dataset.signature;renderLayers();}
  async function captureAction(library,method,...args){if(!library.api||library.pending||library.api.getState().busy)return;library.pending=true;library.error='';renderCapture(library);
    try{await library.api[method](...args);}catch(e){library.error=e?.message||'Не удалось выполнить действие';}finally{library.pending=false;renderCapture(library);}}
  function renderCapture(library){if(!library?.pane||!open||activeTab!==library.key)return;const state=library.api?.getState()||{},busy=library.pending||!!state.busy,list=library.api?.list()||[];
    library.save.disabled=!library.api||busy;library.pane.setAttribute('aria-busy',String(busy));panel.setAttribute('aria-busy',String(busy));library.status.textContent=library.error||state.message||(!library.api?'Библиотека '+library.plural+' загружается…':'Сохранить '+library.word+': '+library.scope+'.');
    syncExplorer();syncTemplateLimit();const fragment=doc.createDocumentFragment();for(const entry of list.filter(n=>matches(n.name))){
      const card=doc.createElement('article');card.className='mtp-card mtp-capture-card';card.dataset[library.key==='settings'?'settingsId':'frameId']=entry.id;card.classList.toggle('mtp-selected',entry.id===state.selectedId);
      const choose=button('','Открыть '+library.word+' '+entry.name+(library.key==='frames'?' с сохранённым масштабом и положением поля':''),()=>captureAction(library,'open',entry.id),'mtp-preview');choose.disabled=busy;choose.setAttribute('aria-pressed',String(entry.id===state.selectedId));
      const image=doc.createElement('img');image.className='mtp-image';image.alt=library.key==='frames'?(entry.previewKind==='view'?'Прежнее превью кадра':'Весь маятник целиком'):'';if(library.key==='frames'&&entry.previewKind==='view')image.title='Прежнее превью; обновится при открытии кадра';image.draggable=false;if(entry.thumbnail)image.src=entry.thumbnail;const name=doc.createElement('span');name.className='mtp-name';name.dataset.userLabel='';name.textContent=entry.name;choose.append(image,name);
      const rename=()=>{if(busy)return;const next=root.prompt('Название '+library.genitive,entry.name);if(next?.trim())captureAction(library,'rename',entry.id,next.trim());};choose.addEventListener('contextmenu',e=>{e.preventDefault();rename();});
      const actions=doc.createElement('div');actions.className='mtp-card-actions mtp-frame-actions';actions.append(button('✎','Переименовать '+library.word,rename),button('↓','Скачать '+library.word,()=>captureAction(library,'download',entry.id)),button('×','Удалить сохранённый '+library.word,()=>{if(root.confirm('Удалить сохранённый '+library.word+' «'+entry.name+'» из библиотеки?'))captureAction(library,'remove',entry.id);}));
      const metadata=doc.createElement('span');metadata.className='mtp-capture-metrics';metadata.textContent=[entry.summary||[entry.rows!=null?entry.rows+' строк':'',entry.frame!=null?'Кадр '+entry.frame:''].filter(Boolean).join(' · '),library.key==='frames'&&entry.previewKind==='view'?'Прежнее превью':''].filter(Boolean).join(' · ');if(library.key==='frames'&&entry.previewKind==='view')metadata.title='Прежнее превью; обновится при открытии кадра';for(const b of actions.querySelectorAll('button'))b.disabled=busy;card.append(choose,metadata,actions);fragment.append(card);
    }
    if(!list.filter(n=>matches(n.name)).length){const empty=doc.createElement('p');empty.className='mtp-empty';empty.textContent=query?'Поиск не дал результатов.':'Сохранённых '+library.plural+' пока нет. «Сохранить '+library.word+'» добавит '+library.scope+'.';fragment.append(empty);}library.grid.replaceChildren(fragment);
  }
  function bindCapture(library,api){if(!api||api===library.api)return;library.unsubscribe?.();library.api=api;library.unsubscribe=api.subscribe(()=>renderCapture(library));Promise.resolve(api.ready).then(()=>{if(api===library.api)renderCapture(library);},e=>{library.error=e?.message||'Не удалось загрузить библиотеку';renderCapture(library);});renderCapture(library);}
  function capturePane(library){const pane=doc.createElement('section');pane.className='mtp-pane '+(library.key==='settings'?'mtp-settings-pane':'mtp-frame-pane');pane.id=library.key==='settings'?'maySettingsPane':'mayFramePane';pane.setAttribute('role','tabpanel');
    const save=button('Сохранить '+library.word,'Сохранить '+library.scope+' в библиотеку '+library.plural,()=>{if(library.key==='settings'){const name=root.prompt('Название набора настроек','Набор '+((library.api?.list().length||0)+1));if(name?.trim())captureAction(library,'save',name.trim());}else captureAction(library,'save');});save.dataset[library.key==='settings'?'settingsSave':'frameSave']='';const output=doc.createElement('output');output.className='mtp-status';output.setAttribute('aria-live','polite');const list=doc.createElement('div');list.className='mtp-grid';pane.append(save,output,list);if(library.key==='settings'){templateLimitButton=button('','Максимальная площадь выделяемого шаблона, бит',editTemplateLimit);templateLimitButton.dataset.templateLimit='';templateLimitButton.style.width='100%';pane.prepend(templateLimitButton);syncTemplateLimit();}Object.assign(library,{pane,save,status:output,grid:list});return pane;}
  let resizeHandle,widthPreference=null,resizeDrag=null,widthFrame=0,saveButton;
  function syncSave(){if(saveButton)saveButton.disabled=!doc.getElementById('bTemplateSave')||doc.getElementById('bTemplateSave').disabled;syncExplorer();}
  const widthBounds=()=>{const viewport=Math.max(1,root.innerWidth||doc.documentElement.clientWidth||800),max=Math.max(1,viewport-58);return {viewport,min:Math.min(240,Math.floor(viewport/2),max),max};};
  function panelWidth(){const {viewport,min,max}=widthBounds();return Math.max(min,Math.min(max,widthPreference??viewport/2));}
  function applyWidth(notify=false){
    const width=Math.round(panelWidth()),{min,max}=widthBounds();doc.body.style.setProperty('--may-template-panel-width',width+'px');
    if(resizeHandle){resizeHandle.style.right=width+'px';resizeHandle.setAttribute('aria-valuemin',String(min));resizeHandle.setAttribute('aria-valuemax',String(max));resizeHandle.setAttribute('aria-valuenow',String(width));resizeHandle.setAttribute('aria-valuetext',width+' пикселей');}
    if(notify&&!widthFrame)widthFrame=root.requestAnimationFrame(()=>{widthFrame=0;root.dispatchEvent(new Event('resize'));});
  }
  function saveWidth(){try{root.localStorage.setItem(WIDTH_KEY,String(widthPreference));}catch(_){} }
  function finishResize(cancel=false){if(!resizeDrag)return;const drag=resizeDrag;resizeDrag=null;
    if(cancel)widthPreference=drag.preference;else saveWidth();
    try{resizeHandle.releasePointerCapture(drag.id);}catch(_){}doc.body.classList.remove('may-template-panel-resizing');applyWidth(true);
  }
  function makeResizer(storage){
    try{const saved=Number(storage?.getItem(WIDTH_KEY));if(Number.isFinite(saved)&&saved>0)widthPreference=saved;}catch(_){}
    resizeHandle=doc.createElement('div');resizeHandle.className='mtp-resize';resizeHandle.hidden=true;resizeHandle.tabIndex=0;resizeHandle.setAttribute('role','separator');resizeHandle.setAttribute('aria-orientation','vertical');resizeHandle.setAttribute('aria-controls',panel.id);resizeHandle.setAttribute('aria-label','Ширина панели шаблонов');resizeHandle.title='Тянуть левую границу · ← шире · → уже · Home минимум · End максимум';
    resizeHandle.addEventListener('pointerdown',e=>{if(e.button!==0||resizeDrag)return;e.preventDefault();e.stopPropagation();resizeDrag={id:e.pointerId,x:e.clientX,width:panelWidth(),preference:widthPreference};resizeHandle.focus({preventScroll:true});try{resizeHandle.setPointerCapture(e.pointerId);}catch(_){}doc.body.classList.add('may-template-panel-resizing');});
    resizeHandle.addEventListener('pointermove',e=>{if(!resizeDrag||resizeDrag.id!==e.pointerId)return;e.preventDefault();const {min,max}=widthBounds();widthPreference=Math.max(min,Math.min(max,resizeDrag.width+resizeDrag.x-e.clientX));applyWidth(true);});
    resizeHandle.addEventListener('pointerup',e=>{if(resizeDrag?.id===e.pointerId)finishResize();});
    for(const type of ['pointercancel','lostpointercapture'])resizeHandle.addEventListener(type,e=>{if(resizeDrag?.id===e.pointerId)finishResize(true);});
    resizeHandle.addEventListener('keydown',e=>{if(e.key==='Escape'&&resizeDrag){e.preventDefault();finishResize(true);return;}const {min,max}=widthBounds(),step=e.shiftKey?40:10;
      const value=e.key==='ArrowLeft'?panelWidth()+step:e.key==='ArrowRight'?panelWidth()-step:e.key==='Home'?min:e.key==='End'?max:null;
      if(value===null)return;e.preventDefault();e.stopPropagation();widthPreference=Math.max(min,Math.min(max,value));applyWidth(true);saveWidth();});
    root.addEventListener('blur',()=>finishResize(true));root.addEventListener('resize',()=>applyWidth());doc.body.append(resizeHandle);applyWidth();
  }
  function token(value){if(value&&typeof value==='object'){if(!identities.has(value))identities.set(value,++identityCounter);return identities.get(value);}return String(value);}
  function organise(run){const before=store.snapshot(),result=run(),after=store.snapshot();if(JSON.stringify(before)!==JSON.stringify(after))engine?.recordExternal?.(before,after,store.restore.bind(store));render();return result;}
  function button(symbol,title,run,className='mtp-command'){
    const b=doc.createElement('button');b.type='button';b.className=className;b.textContent=symbol;b.title=title;b.setAttribute('aria-label',title);b.addEventListener('click',run);return b;
  }
  function message(value){if(status)status.textContent=String(value||'');}
  function reportError(e){message(e?.message||'Не удалось выполнить действие');}
  async function act(id,action,value){try{await engine?.action(id,action,value);schedule();}catch(e){reportError(e);}}
  function openWindow(){
    if(libraryWindow&&!libraryWindow.closed){showDetached();setOpen(false);return;}
    const url=new URL('mayatnik-library.html',doc.baseURI);url.searchParams.set('v','555');url.searchParams.set('tab',activeTab);
    libraryWindow=root.open(url.href,'mayatnik-library-'+Date.now(),'popup=yes,width=760,height=820,resizable=yes,scrollbars=yes');
    if(!libraryWindow){const notice=panel.querySelector('[data-window-notice]');notice.hidden=false;notice.textContent='Разрешите всплывающие окна для этого сайта и нажмите «Окно» снова.';return;}panel.querySelector('[data-window-notice]').hidden=true;libraryWindow.focus();setOpen(false);
  }
  function showDetached(){
    if(root.MayatnikLibraryDetached||!libraryWindow||libraryWindow.closed)return false;
    libraryWindow.MayatnikTemplatePanel?.openTab(activeTab);libraryWindow.focus();return true;
  }
  function make(){
    if(panel)return;let storage;try{storage=root.localStorage;}catch(_){}
    store=root.MayatnikTemplateFolderStore||root.MayatnikTemplateFolders.create(storage);folderUnsubscribe=store.subscribe?.(()=>{renderKey='';schedule();});
    panel=doc.createElement('aside');panel.id='mayatnikTemplatePanel';panel.hidden=true;panel.setAttribute('aria-label','Библиотека последовательностей, слоёв, шаблонов, кадров и настроек');
    const head=doc.createElement('div');head.className='mtp-heading';const title=doc.createElement('strong');title.textContent='Библиотека';
    folderButton=button('＋ Новая папка','Создать папку в текущей папке',()=>{const name=root.prompt('Название новой папки','Папка');if(name)organise(()=>store.addFolder(name,current));});head.append(title,button('×','Закрыть библиотеку',()=>root.MayatnikLibraryDetached?root.close():setOpen(false)));
    const toolbar=doc.createElement('div');toolbar.className='mtp-toolbar';toolbar.dataset.noMini='';folderButton.dataset.libraryFolder='';const detached=button('↗ Окно','Открыть библиотеку в отдельном окне браузера',openWindow);detached.dataset.libraryWindow='';detached.hidden=!!root.MayatnikLibraryDetached;const notice=doc.createElement('output');notice.dataset.windowNotice='';notice.hidden=true;notice.setAttribute('role','status');head.insertBefore(detached,head.lastChild);toolbar.append(notice);
    const fileCommands=doc.createElement('div');fileCommands.className='mtp-file-commands';fileCommands.setAttribute('role','group');fileCommands.setAttribute('aria-label','Резервная копия, восстановление и облачный файл');toolbar.append(fileCommands);
    for(const [symbol,title,short,action]of [['💾','Сохранить все библиотеки и текущую работу в один файл','Резрвъ','save'],['↑','Восстановить полную копию Маятника','Возстнвть','restore'],['☁','Подключить файл в облачной папке','к Облку','file']]){const b=button(symbol+' '+short,title,()=>root.MayatnikBackupUI?.open(action));b.dataset.backupAction=action;fileCommands.append(b);}
    const tabs=doc.createElement('div');tabs.className='mtp-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Раздел библиотеки');
    const layouts=doc.createElement('div');layouts.className='mtp-layout';layouts.setAttribute('role','group');layouts.setAttribute('aria-label','Вид библиотеки');
    for(const [key,label]of [['tiles','Плитки'],['list','Список']]){const b=button(label,'Вид библиотеки: '+label,()=>setLayout(key));b.dataset.libraryLayout=key;b.classList.add('mtp-layout-diamond');b.textContent='';b.dataset.noMini='';
      const ns='http://www.w3.org/2000/svg',svg=doc.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 48 48');svg.setAttribute('aria-hidden','true');
      const edge=doc.createElementNS(ns,'path');edge.setAttribute('d','M24 1 47 24 24 47 1 24Z');edge.setAttribute('class','mtp-layout-edge');svg.append(edge);
      const icon=doc.createElementNS(ns,'path');icon.setAttribute('d',key==='tiles'?'M17 17h5v5h-5zM26 17h5v5h-5zM17 26h5v5h-5zM26 26h5v5h-5z':'M17 18h2M22 18h9M17 24h2M22 24h9M17 30h2M22 30h9');icon.setAttribute('class','mtp-layout-icon');svg.append(icon);b.append(svg);layoutButtons.set(key,b);layouts.append(b);}
    let savedLayout;try{savedLayout=storage?.getItem(LAYOUT_KEY);}catch(_){}setLayout(savedLayout,false);
    templatePane=doc.createElement('section');templatePane.className='mtp-pane mtp-template-pane';templatePane.id='mayTemplatePane';templatePane.setAttribute('role','tabpanel');
    layerPane=doc.createElement('section');layerPane.className='mtp-pane mtp-layer-pane';layerPane.id='mayLayerPane';layerPane.setAttribute('role','tabpanel');layerGrid=doc.createElement('div');layerGrid.className='mtp-layer-list';layerPane.append(layerGrid);
    sequencePane=doc.createElement('section');sequencePane.className='mtp-pane';sequencePane.id='maySequencePane';sequencePane.setAttribute('role','tabpanel');
    const sections=[['templates','Шаблоны',templatePane],['layers','Слои',layerPane],...[...captureLibraries.values()].map(library=>[library.key,library.title,capturePane(library)]),['sequences','Послед-ти',sequencePane]],tabKeys=sections.map(s=>s[0]);
    for(const [key,label,pane]of sections){const b=button(label,label,()=>selectTab(key));b.dataset.libraryTab=key;b.setAttribute('role','tab');b.id='mayLibraryTab-'+key;b.setAttribute('aria-controls',pane.id);pane.setAttribute('aria-labelledby',b.id);b.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?tabKeys[0]:e.key==='End'?tabKeys.at(-1):tabKeys[(tabKeys.indexOf(key)+(e.key==='ArrowRight'?1:tabKeys.length-1))%tabKeys.length];selectTab(next);tabButtons.get(next).focus();}});tabButtons.set(key,b);tabs.append(b);}
    const navigation=doc.createElement('details');navigation.className='mtp-navigation';navigation.open=true;const navTitle=doc.createElement('summary');navTitle.className='mtp-command';navTitle.textContent='☰ Разделы';folderTree=doc.createElement('nav');folderTree.className='mtp-folder-tree';folderTree.setAttribute('aria-label','Папки шаблонов');navigation.append(navTitle,tabs,folderTree);
    const workspace=doc.createElement('div');workspace.className='mtp-workspace';const main=doc.createElement('div');main.className='mtp-main';
    const location=doc.createElement('div');location.className='mtp-location';upButton=button('↑ Вверх','На уровень выше',()=>{const parent=folderNodes().find(n=>n.id===current)?.parent||'';navigateFolder(parent);});upButton.dataset.libraryUp='';address=doc.createElement('output');address.className='mtp-address';address.setAttribute('aria-label','Текущий путь');location.append(upButton,address);
    const commands=doc.createElement('div');commands.className='mtp-section-commands';sectionSave=button('💾 Сохранить','Сохранить в текущий раздел',()=>{if(activeTab==='templates')saveButton.click();else if(activeTab==='layers')layerApi?.capture();else if(activeTab==='sequences')sequenceView?.save();else captureLibraries.get(activeTab)?.save.click();});sectionSave.dataset.sectionSave='';renameButton=button('✎ Переименовать','Переименовать выбранный элемент',()=>selectedAction('rename'));renameButton.dataset.sectionRename='';deleteButton=button('× Удалить','Удалить выбранный элемент',()=>selectedAction('delete'));deleteButton.dataset.sectionDelete='';commands.append(sectionSave,folderButton,renameButton,deleteButton);
    const viewbar=doc.createElement('div');viewbar.className='mtp-viewbar';searchInput=doc.createElement('input');searchInput.type='search';searchInput.className='mtp-search';searchInput.setAttribute('aria-label','Поиск в текущем разделе');searchInput.addEventListener('input',()=>{query=searchInput.value.trim().toLocaleLowerCase();renderKey='';if(layerGrid)delete layerGrid.dataset.signature;activeTab==='templates'?render():renderActive();});viewbar.append(layouts,searchInput);
    head.dataset.noMini='';crumbs=doc.createElement('nav');crumbs.className='mtp-crumbs';crumbs.dataset.noMini='';crumbs.setAttribute('aria-label','Путь папки');
    const actions=doc.createElement('div');actions.className='mtp-selection';actions.dataset.noMini='';
    const colour=doc.createElement('input');colour.type='color';colour.value='#ff7f27';colour.title='Цвет всех найденных вхождений';colour.setAttribute('aria-label',colour.title);
    colour.addEventListener('change',async()=>{try{await engine?.colour(colour.value);schedule();}catch(e){reportError(e);}});
    saveButton=button('💾','Сохранить выбранную фигуру в библиотеку',()=>{const source=doc.getElementById('bTemplateSave');if(source&&!source.disabled)source.click();});saveButton.dataset.librarySave='';
    actions.append(saveButton,colour,button('×▧','Удалить все найденные вхождения с поля',async()=>{try{await engine?.removeMatches();schedule();}catch(e){reportError(e);}}));
    const saveSource=doc.getElementById('bTemplateSave');if(saveSource&&root.MutationObserver)new root.MutationObserver(syncSave).observe(saveSource,{attributes:true,attributeFilter:['disabled']});syncSave();
    status=doc.createElement('output');status.className='mtp-status';status.setAttribute('aria-live','polite');
    grid=doc.createElement('div');grid.className='mtp-grid';grid.dataset.noMini='';grid.setAttribute('aria-label','Шаблоны и папки — перетащите для группировки');
    grid.addEventListener('dragover',e=>{if(dragged){e.preventDefault();e.dataTransfer.dropEffect='move';}});
    grid.addEventListener('drop',e=>{if(e.target===grid&&dragged){e.preventDefault();organise(()=>store.move(dragged.kind,dragged.id,current));dragged=null;}});
    const listHead=doc.createElement('div');listHead.className='mtp-list-head';for(const label of ['Название','Размер · 1/0','Кнопки']){const cell=doc.createElement('span');cell.textContent=label;listHead.append(cell);}
    templatePane.append(crumbs,actions,status,listHead,grid);main.append(location,commands,viewbar,...sections.map(s=>s[2]));workspace.append(navigation,main);panel.append(head,toolbar,workspace);doc.body.append(panel);makeResizer(storage);
    if(root.IntersectionObserver)observer=new root.IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){const card=entry.target;observer.unobserve(card);drawPreview(card);queueMetrics(card);}}, {root:panel,rootMargin:'160px'});
    else panel.addEventListener('scroll',queueVisibleMetrics,{passive:true});
    panel.addEventListener('dragend',()=>{dragged=null;panel.querySelectorAll('.mtp-drop').forEach(n=>n.classList.remove('mtp-drop'));});
    panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();if(root.MayatnikLibraryDetached){root.close();return;}setOpen(false);doc.getElementById('bTemplatePanel')?.focus();}});
    try{open=storage?.getItem(OPEN_KEY)==='1';}catch(_){}
    try{let saved=storage?.getItem(TAB_KEY);if(saved==='views'){saved='frames';storage?.setItem(TAB_KEY,saved);}storage?.setItem('mayatnik-library-tabs-v2','1');activeTab=saved==='layers'||saved==='sequences'||captureLibraries.has(saved)?saved:'templates';}catch(_){}
    bindLayers(root.mayLayers);bind(root.mayTemplateLibrary);for(const library of captureLibraries.values())bindCapture(library,root[library.apiName]);selectTab(activeTab,false);if(!root.MayatnikLibraryDetached&&root.maySequences?.snapshot().matches.enabled){selectTab('sequences');setOpen(true);}else if(open)setOpen(true,false);
  }
  function beginDrag(e,kind,id){dragged={kind,id};e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('application/x-mayatnik-template',JSON.stringify(dragged));}
  function dropTarget(node,kind,id){
    node.addEventListener('dragover',e=>{if(!dragged)return;e.preventDefault();e.stopPropagation();node.classList.add('mtp-drop');e.dataTransfer.dropEffect='move';});
    node.addEventListener('dragleave',()=>node.classList.remove('mtp-drop'));
    node.addEventListener('drop',e=>{
      e.preventDefault();e.stopPropagation();node.classList.remove('mtp-drop');const source=dragged;dragged=null;if(!source||source.kind===kind&&source.id===id)return;
      organise(()=>{if(kind==='folder'){
        const r=node.getBoundingClientRect();
        if(node.classList.contains('mtp-card')&&e.clientX-r.left<r.width*.24)store.move(source.kind,source.id,current,id,'folder');else store.move(source.kind,source.id,id);
      }
      else{
        const r=node.getBoundingClientRect();
        // Drop at left edge reorders; drop on the picture groups both references.
        if(e.clientX-r.left<r.width*.24)store.move(source.kind,source.id,current,id,'template');
        else{const folder=store.addFolder('Папка',current);if(folder){store.move('template',id,folder);store.move(source.kind,source.id,folder);}}
      }
      });
    });
  }
  function previewKey(item){return item.previewKey??item.parts;}
  function darkPreview(hex){if(!/^#[0-9a-f]{6}$/i.test(hex||''))return false;const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722<.16;}
  function* templateMetricSteps(item){
    const key=previewKey(item),rk=Math.max(1,Number(item.rk??key?.rk)||1),cached=key&&typeof key==='object'?metricsCache.get(key):null;if(cached?.rk===rk)return cached;
    let ones=0,zeros=0;const dimensions=[];
    for(const part of item.parts||[]){if(!(part.width>0&&part.height>0&&part.data))continue;
      const width=Math.max(1,Math.round(part.width/rk)),height=Math.max(1,Math.round(part.height/rk)),N=width*height,data=new Uint8Array(N),outside=new Uint8Array(N),queue=new Uint32Array(N);let head=0,tail=0;
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){const q=y*width+x;data[q]=part.data[Math.min(part.height-1,Math.floor((y+.5)*rk))*part.width+Math.min(part.width-1,Math.floor((x+.5)*rk))]?1:0;ones+=data[q];if((q&16383)===16383)yield;}
      const visit=q=>{if(!data[q]&&!outside[q]){outside[q]=1;queue[tail++]=q;}};
      for(let x=0;x<width;x++){visit(x);visit((height-1)*width+x);}for(let y=0;y<height;y++){visit(y*width);visit(y*width+width-1);}
      while(head<tail){const q=queue[head++],x=q%width,y=Math.floor(q/width);if(x)visit(q-1);if(x+1<width)visit(q+1);if(y)visit(q-width);if(y+1<height)visit(q+width);if((head&16383)===0)yield;}
      for(let q=0;q<N;q++){if(!data[q]&&!outside[q])zeros++;if((q&16383)===16383)yield;}dimensions.push(width+'×'+height);
    }
    const result={rk,ones,zeros,size:dimensions.join(' · ')};if(key&&typeof key==='object')metricsCache.set(key,result);return result;
  }
  function templateMetrics(item){const steps=templateMetricSteps(item);let next;do{next=steps.next();}while(!next.done);return next.value;}
  function templateName(name){return /^#[0-9a-f]{6} · \d+×\d+$/i.test(name||'')?name.slice(0,7):name;}
  function syncTemplateCard(card,item){const key=previewKey(item),metrics=key&&typeof key==='object'?metricsCache.get(key):null,rk=Math.max(1,Number(item.rk??key?.rk)||1);
    card.classList.toggle('mtp-dark-preview',darkPreview(item.hex));card.querySelector('.mtp-name').textContent=templateName(item.name);
    const size=metrics?.size??(item.parts||[]).filter(p=>p.width>0&&p.height>0).map(p=>Math.max(1,Math.round(p.width/rk))+'×'+Math.max(1,Math.round(p.height/rk))).join(' · ');
    card.querySelector('.mtp-size').textContent=size;card.querySelector('.mtp-bits').textContent=metrics?'1('+metrics.ones+') · 0('+metrics.zeros+')':'1(…) · 0(…)';card.querySelector('.mtp-preview').title=item.name+' — выделить все вхождения. '+size+'. 1 — заполненные клетки; 0 — замкнутые внутренние пустоты. Внешние выемки и фон не учитываются.';}
  function metricsPump(){metricTimer=0;if(!open||activeTab!=='templates'){metricTasks.clear();metricActive=null;return;}
    if(!metricActive){const first=metricTasks.entries().next().value;if(!first)return;metricTasks.delete(first[0]);metricActive={card:first[0],key:first[1],steps:templateMetricSteps(first[0]._item)};}
    const job=metricActive;if(!job.card.isConnected||previewKey(job.card._item)!==job.key){metricActive=null;}else{
      const began=root.performance.now();let next;do{next=job.steps.next();}while(!next.done&&root.performance.now()-began<6);
      if(next.done){syncTemplateCard(job.card,job.card._item);metricActive=null;}
    }
    if(metricActive||metricTasks.size)metricTimer=root.setTimeout(metricsPump,0);
  }
  function queueMetrics(card){if(!card?._item||!open||activeTab!=='templates')return;const key=previewKey(card._item);if(key&&typeof key==='object'&&metricsCache.has(key))return;
    if(metricActive?.card===card&&metricActive.key===key)return;metricTasks.set(card,key);if(!metricTimer)metricTimer=root.setTimeout(metricsPump,0);}
  function queueVisibleMetrics(){if(!panel||!open||activeTab!=='templates')return;const area=panel.getBoundingClientRect();for(const card of grid.querySelectorAll('[data-template-id]')){const r=card.getBoundingClientRect();if(r.bottom>=area.top&&r.top<=area.bottom)queueMetrics(card);}}
  function drawPreview(card){
    const item=card._item;if(!item||!card.isConnected)return;const img=card.querySelector('.mtp-image');const key=previewKey(item),cached=previews.get(item.id);
    if(cached?.key===key){img.src=cached.url;return;}
    const parts=item.parts||[],side=96,canvas=doc.createElement('canvas');canvas.width=canvas.height=side;const ctx=canvas.getContext('2d');if(!ctx)return;
    const valid=parts.filter(p=>p.width>0&&p.height>0&&p.data),total=valid.reduce((n,p)=>n+p.width,0),height=Math.max(1,...valid.map(p=>p.height));
    const scale=Math.min((side-8)/Math.max(1,total),(side-8)/height);let left=(side-total*scale)/2;
    // Sample into the bounded preview, never allocate a source-sized canvas or clone its pixels.
    for(const p of valid){const w=Math.max(1,Math.round(p.width*scale)),h=Math.max(1,Math.round(p.height*scale)),pixels=ctx.createImageData(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const v=p.data[Math.min(p.height-1,Math.floor(y/h*p.height))*p.width+Math.min(p.width-1,Math.floor(x/w*p.width))]>>>0,i=(y*w+x)*4;
      pixels.data[i]=v&255;pixels.data[i+1]=(v>>>8)&255;pixels.data[i+2]=(v>>>16)&255;pixels.data[i+3]=(v>>>24)&255;
    }ctx.putImageData(pixels,Math.round(left),Math.round((side-h)/2));left+=p.width*scale;}
    const url=canvas.toDataURL();previews.set(item.id,{key,url});img.src=url;
  }
  function templateCard(item){
    const card=doc.createElement('article');card.className='mtp-card';card.draggable=true;card.dataset.templateId=item.id;
    card.addEventListener('dragstart',e=>beginDrag(e,'template',item.id));dropTarget(card,'template',item.id);
    const choose=button('','Выделить все вхождения шаблона на поле',async()=>{try{folderSelection='';await engine.select(item.id);schedule();}catch(e){reportError(e);}},'mtp-preview');
    const img=doc.createElement('img');img.className='mtp-image';img.alt='';img.draggable=false;choose.append(img);
    const name=doc.createElement('span');name.className='mtp-name';name.dataset.userLabel='';
    const metrics=doc.createElement('span');metrics.className='mtp-metrics';const size=doc.createElement('span');size.className='mtp-size';size.title='Размер частей шаблона в клетках';const bits=doc.createElement('span');bits.className='mtp-bits';bits.title='1 — заполненные клетки; 0 — замкнутые внутренние пустоты, без внешнего фона';metrics.append(size,bits);
    choose.addEventListener('contextmenu',e=>{e.preventDefault();const value=root.prompt('Название шаблона',card._item.name);if(value)act(item.id,'rename',value);});
    const row=doc.createElement('div');row.className='mtp-card-actions';
    const visibility=button('◉','Скрыть шаблон с поля',()=>act(item.id,'visible'));visibility.dataset.templateVisibility='';
    const skip=button('↛','Пропуск выделения на поле',()=>act(item.id,'skip-selection'));skip.dataset.templateSkip='';row.append(visibility,skip);
    row.append(button('＋','Добавить копию шаблона на поле',()=>act(item.id,'insert')),button('↓','Скачать шаблон',()=>act(item.id,'download')),button('●','Изменить цвет шаблона',()=>act(item.id,'colour')),button('×','Удалить шаблон из библиотеки',()=>act(item.id,'delete-library')));
    const more=doc.createElement('details');more.className='mtp-more';const summary=doc.createElement('summary');summary.textContent='⋯';summary.title='Ещё действия с шаблоном';summary.setAttribute('aria-label',summary.title);
    const menu=doc.createElement('div');menu.className='mtp-more-menu';
    menu.append(button('💾','Сохранить изменения фигуры в этот шаблон',()=>act(item.id,'save')),button('✎','Переименовать шаблон',()=>{const value=root.prompt('Название шаблона',card._item.name);if(value)act(item.id,'rename',value);}));more.append(summary,menu);row.append(more);
    card.append(name,choose,metrics,row);return card;
  }
  function folderCard(node){
    const card=doc.createElement('article');card.className='mtp-card mtp-folder';card.draggable=true;card.addEventListener('dragstart',e=>beginDrag(e,'folder',node.id));dropTarget(card,'folder',node.id);
    const choose=button('📁','Открыть папку '+node.name,()=>navigateFolder(node.id),'mtp-preview');const name=doc.createElement('span');name.className='mtp-name';name.dataset.userLabel='';name.textContent=node.name;choose.append(name);
    const row=doc.createElement('div');row.className='mtp-card-actions';row.append(button('✎','Переименовать папку',()=>{const value=root.prompt('Название папки',node.name);if(value)organise(()=>store.rename(node.id,value));}),button('×','Удалить папку, сохранив её содержимое на уровень выше',()=>organise(()=>store.removeFolder(node.id))));card.append(choose,row);return card;
  }
  function render(){
    if(!panel||!engine||!open||activeTab!=='templates')return;
    const list=engine.list(),byId=new Map(list.map(t=>[t.id,t]));const allIds=engine.allIds(),key=allIds.join('\u0000');if(key!==libraryKey){store.reconcile(allIds);libraryKey=key;}
    const snapshot=store.snapshot(),folders=new Map(snapshot.nodes.filter(n=>n.kind==='folder').map(n=>[n.id,n]));if(current&&!folders.has(current))current='';
    const nextKey=JSON.stringify([query,current,snapshot.nodes,list.map(t=>[t.id,t.name,t.hex,token(previewKey(t))])]);
    if(nextKey===renderKey){syncState();return;}renderKey=nextKey;
    crumbs.replaceChildren();const path=[];let p=current;while(p){const n=folders.get(p);if(!n)break;path.unshift(n);p=n.parent;}
    for(const node of [{id:'',name:'⌂'},...path]){const b=button(node.name,node.id?node.name:'Все шаблоны',()=>navigateFolder(node.id),'mtp-path');b.dataset.userLabel='';dropTarget(b,'folder',node.id);crumbs.append(b);}
    syncExplorer();const children=store.children(current).filter(n=>matches(n.kind==='folder'?n.name:byId.get(n.id)?.name)),wanted=new Set();const fragment=doc.createDocumentFragment();
    for(const node of children){if(node.kind==='folder'){fragment.append(folderCard(node));continue;}const item=byId.get(node.id);if(!item)continue;wanted.add(item.id);let card=cards.get(item.id);if(!card){card=templateCard(item);cards.set(item.id,card);}const old=card._item;card._item=item;syncTemplateCard(card,item);if(!old||previewKey(old)!==previewKey(item)){card.querySelector('.mtp-image').removeAttribute('src');if(observer)observer.observe(card);else drawPreview(card);}fragment.append(card);}
    grid.replaceChildren(fragment);if(observer)for(const id of wanted){const card=cards.get(id);if(!card.querySelector('.mtp-image').getAttribute('src')||!metricsCache.has(previewKey(card._item)))observer.observe(card);}else{for(const id of wanted)drawPreview(cards.get(id));queueVisibleMetrics();}
    for(const [id,card]of cards)if(!allIds.includes(id)){observer?.unobserve(card);cards.delete(id);previews.delete(id);}
    if(!wanted.size&&!children.some(n=>n.kind==='folder')){const empty=doc.createElement('p');empty.className='mtp-empty';empty.textContent=query?'Поиск не дал результатов.':'В текущих строках нет шаблонов из этой папки.';grid.append(empty);}
    syncState();
  }
  function syncState(){
    if(!engine||!panel)return;const state=engine.getState();for(const [id,card]of cards){const selected=id===state.selectedId;card.classList.toggle('mtp-selected',selected);card.querySelector('.mtp-preview').setAttribute('aria-pressed',String(selected));const view=engine.visibility?.(id)||{placed:0,visible:false,skipSelection:false},visible=card.querySelector('[data-template-visibility]'),skip=card.querySelector('[data-template-skip]');
      if(visible){visible.disabled=!view.placed||!!state.busy;visible.setAttribute('aria-pressed',String(!!view.visible));visible.textContent=view.visible?'◉':'○';visible.title=!view.placed?'На поле нет размещённых копий этого шаблона':view.visible?'Скрыть все копии шаблона с поля':'Показать все копии шаблона на поле';visible.setAttribute('aria-label',visible.title);}
      if(skip){skip.disabled=!!state.busy;skip.setAttribute('aria-pressed',String(!!view.skipSelection));skip.title=view.skipSelection?'Пропуск выделения включён — разрешить выбор на поле':'Пропуск выделения — не выбирать этот шаблон кликом по полю';skip.setAttribute('aria-label',skip.title);}}
    panel.setAttribute('aria-busy',String(!!state.busy||!!state.filtering));message((store.persistenceError?'Папки не сохранены: хранилище браузера недоступно. ':'')+(state.filtering?'Проверка шаблонов в текущих строках…':state.message||(state.selectedId?'Найдено: '+(state.count||0):'Выберите шаблон — выделятся все его вхождения на поле.')));
    for(const n of templatePane.querySelectorAll('.mtp-selection button:not([data-library-save]),.mtp-selection input'))n.disabled=!state.selectedId||!!state.busy;syncSave();syncExplorer();
  }
  function schedule(){if(!open||scheduled)return;scheduled=true;root.requestAnimationFrame(()=>{scheduled=false;activeTab!=='templates'?renderActive():render();});}
  function bind(api){if(!api||api===engine)return;unsubscribe?.();engine=api;unsubscribe=engine.subscribe(schedule);schedule();}
  function setOpen(value,persist=true){
    if(value&&showDetached())return;
    if(!panel){make();if(!panel)return;}const next=!!value,changed=next!==!panel.hidden;open=next;panel.hidden=!open;doc.body.classList.toggle('may-template-panel-open',open);
    if(!open)finishResize(true);resizeHandle.hidden=!open;applyWidth();
    if(persist)try{root.localStorage.setItem(OPEN_KEY,open?'1':'0');}catch(_){}
    engine?.refresh();if(open){if(activeTab!=='templates')renderActive();else render();}if(changed){root.dispatchEvent(new CustomEvent('mayatnik-template-panel-change',{detail:{open}}));root.dispatchEvent(new Event('resize'));}
  }
  root.MayatnikTemplatePanel={toggle(){setOpen(!open);},setOpen,isOpen:()=>open,refresh:schedule,bind,getFolderStore:()=>store,hasWindow:()=>!!libraryWindow&&!libraryWindow.closed,openTab(tab){make();bindLayers(root.mayLayers);selectTab(tab);setOpen(true);}};
  root.addEventListener('may-template-limit-change',syncTemplateLimit);
  root.addEventListener('may-template-limit-rejected',showTemplateLimitNotice);
  root.addEventListener('may-layers-ready',()=>{make();bindLayers(root.mayLayers);});
  root.addEventListener('may-template-library-ready',()=>{make();bind(root.mayTemplateLibrary);});
  for(const library of captureLibraries.values())root.addEventListener(library.key==='settings'?'may-settings-library-ready':'may-frame-library-ready',()=>{make();bindCapture(library,root[library.apiName]);});
  root.addEventListener('may-template-saved',e=>{make();bind(root.mayTemplateLibrary);if(!engine)return;store.reconcile(engine.allIds());const id=String(e.detail?.id||'');folderSelection='';current=store.snapshot().nodes.find(n=>n.kind==='template'&&n.id===id)?.parent||'';renderKey='';selectTab('templates');setOpen(true);render();cards.get(id)?.scrollIntoView?.({block:'nearest',inline:'nearest'});});
  root.addEventListener('pagehide',()=>{unsubscribe?.();layerUnsubscribe?.();folderUnsubscribe?.();sequenceView?.destroy();for(const library of captureLibraries.values())library.unsubscribe?.();observer?.disconnect();},{once:true});
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',make,{once:true});else make();
})(window);
