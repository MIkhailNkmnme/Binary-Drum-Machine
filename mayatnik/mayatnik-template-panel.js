/* МАЯ-029. Library view subscribes to explicit changes; never to the drawing loop. */
(function(root){
  'use strict';
  if(!root.document)return;
  const doc=root.document,OPEN_KEY='mayatnik-template-panel-open';
  let panel,grid,crumbs,status,controls,engine,unsubscribe,store,current='',open=false,scheduled=false,libraryKey='',renderKey='',dragged=null;
  const cards=new Map(),previews=new Map();let observer;
  const identities=new WeakMap();let identityCounter=0;
  function token(value){if(value&&typeof value==='object'){if(!identities.has(value))identities.set(value,++identityCounter);return identities.get(value);}return String(value);}
  function organise(run){const before=store.snapshot(),result=run(),after=store.snapshot();if(JSON.stringify(before)!==JSON.stringify(after))engine?.recordExternal?.(before,after,value=>{store.restore(value);renderKey='';render();});render();return result;}
  function button(symbol,title,run,className='mtp-command'){
    const b=doc.createElement('button');b.type='button';b.className=className;b.textContent=symbol;b.title=title;b.setAttribute('aria-label',title);b.addEventListener('click',run);return b;
  }
  function message(value){if(status)status.textContent=String(value||'');}
  function reportError(e){message(e?.message||'Не удалось выполнить действие');}
  async function act(id,action,value){try{await engine?.action(id,action,value);schedule();}catch(e){reportError(e);}}
  function make(){
    if(panel)return;let storage;try{storage=root.localStorage;}catch(_){}
    store=root.MayatnikTemplateFolders.create(storage);
    panel=doc.createElement('aside');panel.id='mayatnikTemplatePanel';panel.hidden=true;panel.setAttribute('aria-label','Библиотека шаблонов');
    const head=doc.createElement('div');head.className='mtp-heading';const title=doc.createElement('strong');title.textContent='Шаблоны';
    head.append(title,button('＋▣','Создать папку в текущей папке',()=>{const name=root.prompt('Название новой папки','Папка');if(name)organise(()=>store.addFolder(name,current));}),button('×','Закрыть шаблоны',()=>setOpen(false)));
    head.dataset.noMini='';crumbs=doc.createElement('nav');crumbs.className='mtp-crumbs';crumbs.dataset.noMini='';crumbs.setAttribute('aria-label','Путь папки');
    const actions=doc.createElement('div');actions.className='mtp-selection';actions.dataset.noMini='';
    const colour=doc.createElement('input');colour.type='color';colour.value='#ff7f27';colour.title='Цвет всех найденных вхождений';colour.setAttribute('aria-label',colour.title);
    colour.addEventListener('change',async()=>{try{await engine?.colour(colour.value);schedule();}catch(e){reportError(e);}});
    actions.append(colour,button('×▧','Удалить все найденные вхождения с поля',async()=>{try{await engine?.removeMatches();schedule();}catch(e){reportError(e);}}));
    status=doc.createElement('output');status.className='mtp-status';status.setAttribute('aria-live','polite');
    grid=doc.createElement('div');grid.className='mtp-grid';grid.dataset.noMini='';grid.setAttribute('aria-label','Шаблоны и папки — перетащите для группировки');
    grid.addEventListener('dragover',e=>{if(dragged){e.preventDefault();e.dataTransfer.dropEffect='move';}});
    grid.addEventListener('drop',e=>{if(e.target===grid&&dragged){e.preventDefault();organise(()=>store.move(dragged.kind,dragged.id,current));dragged=null;}});
    const detail=doc.createElement('details');detail.className='mtp-controls';const summary=doc.createElement('summary');summary.dataset.noMini='';summary.textContent='⋯';summary.title='Прежние команды шаблонов';summary.setAttribute('aria-label',summary.title);controls=doc.createElement('div');controls.className='mtp-live-controls';detail.append(summary,controls);
    panel.append(head,crumbs,actions,status,grid,detail);doc.body.append(panel);
    if(root.IntersectionObserver)observer=new root.IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){const card=entry.target;observer.unobserve(card);drawPreview(card);}}, {root:panel,rootMargin:'160px'});
    panel.addEventListener('dragend',()=>{dragged=null;panel.querySelectorAll('.mtp-drop').forEach(n=>n.classList.remove('mtp-drop'));});
    panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();setOpen(false);doc.getElementById('bTemplatePanel')?.focus();}});
    try{open=storage?.getItem(OPEN_KEY)==='1';}catch(_){}
    bind(root.mayTemplateLibrary);if(open)setOpen(true,false);
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
    const choose=button('','Выделить все вхождения шаблона на поле',async()=>{try{await engine.select(item.id);schedule();}catch(e){reportError(e);}},'mtp-preview');
    const img=doc.createElement('img');img.className='mtp-image';img.alt='';img.draggable=false;choose.append(img);
    const name=doc.createElement('span');name.className='mtp-name';name.dataset.userLabel='';
    choose.append(name);choose.addEventListener('contextmenu',e=>{e.preventDefault();const value=root.prompt('Название шаблона',card._item.name);if(value)act(item.id,'rename',value);});
    const row=doc.createElement('div');row.className='mtp-card-actions';
    row.append(button('＋','Добавить копию шаблона на поле',()=>act(item.id,'insert')),button('↓','Скачать шаблон',()=>act(item.id,'download')),button('●','Изменить цвет шаблона',()=>act(item.id,'colour')),button('×','Удалить шаблон из библиотеки',()=>act(item.id,'delete-library')));
    const more=doc.createElement('details');more.className='mtp-more';const summary=doc.createElement('summary');summary.textContent='⋯';summary.title='Ещё действия с шаблоном';summary.setAttribute('aria-label',summary.title);
    const menu=doc.createElement('div');menu.className='mtp-more-menu';
    menu.append(button('💾','Сохранить изменения фигуры в этот шаблон',()=>act(item.id,'save')),button('◉','Показать или скрыть размещённые копии',()=>act(item.id,'visible')),button('✎','Переименовать шаблон',()=>{const value=root.prompt('Название шаблона',card._item.name);if(value)act(item.id,'rename',value);}));more.append(summary,menu);row.append(more);
    card.append(choose,row);return card;
  }
  function folderCard(node){
    const card=doc.createElement('article');card.className='mtp-card mtp-folder';card.draggable=true;card.addEventListener('dragstart',e=>beginDrag(e,'folder',node.id));dropTarget(card,'folder',node.id);
    const choose=button('📁','Открыть папку '+node.name,()=>{current=node.id;render();},'mtp-preview');const name=doc.createElement('span');name.className='mtp-name';name.dataset.userLabel='';name.textContent=node.name;choose.append(name);
    const row=doc.createElement('div');row.className='mtp-card-actions';row.append(button('✎','Переименовать папку',()=>{const value=root.prompt('Название папки',node.name);if(value)organise(()=>store.rename(node.id,value));}),button('×','Удалить папку, сохранив её содержимое на уровень выше',()=>organise(()=>store.removeFolder(node.id))));card.append(choose,row);return card;
  }
  function render(){
    if(!panel||!engine||!open)return;
    const list=engine.list(),byId=new Map(list.map(t=>[t.id,t]));const allIds=engine.allIds(),key=allIds.join('\u0000');if(key!==libraryKey){store.reconcile(allIds);libraryKey=key;}
    const snapshot=store.snapshot(),folders=new Map(snapshot.nodes.filter(n=>n.kind==='folder').map(n=>[n.id,n]));if(current&&!folders.has(current))current='';
    const nextKey=JSON.stringify([current,snapshot.nodes,list.map(t=>[t.id,t.name,t.hex,token(previewKey(t))])]);
    if(nextKey===renderKey){syncState();return;}renderKey=nextKey;
    crumbs.replaceChildren();const path=[];let p=current;while(p){const n=folders.get(p);if(!n)break;path.unshift(n);p=n.parent;}
    for(const node of [{id:'',name:'⌂'},...path]){const b=button(node.name,node.id?node.name:'Все шаблоны',()=>{current=node.id;render();},'mtp-path');b.dataset.userLabel='';dropTarget(b,'folder',node.id);crumbs.append(b);}
    const children=store.children(current),wanted=new Set();const fragment=doc.createDocumentFragment();
    for(const node of children){if(node.kind==='folder'){fragment.append(folderCard(node));continue;}const item=byId.get(node.id);if(!item)continue;wanted.add(item.id);let card=cards.get(item.id);if(!card){card=templateCard(item);cards.set(item.id,card);}const old=card._item;card._item=item;card.querySelector('.mtp-name').textContent=item.name;card.querySelector('.mtp-preview').title=item.name+' — выделить все вхождения';if(!old||previewKey(old)!==previewKey(item)){card.querySelector('.mtp-image').removeAttribute('src');if(observer)observer.observe(card);else drawPreview(card);}fragment.append(card);}
    grid.replaceChildren(fragment);if(observer)for(const id of wanted){const card=cards.get(id);if(!card.querySelector('.mtp-image').getAttribute('src'))observer.observe(card);}else for(const id of wanted)drawPreview(cards.get(id));
    for(const [id,card]of cards)if(!allIds.includes(id)){observer?.unobserve(card);cards.delete(id);previews.delete(id);}
    if(!wanted.size&&!children.some(n=>n.kind==='folder')){const empty=doc.createElement('p');empty.className='mtp-empty';empty.textContent='В текущих строках нет шаблонов из этой папки.';grid.append(empty);}
    syncState();
  }
  function syncState(){
    if(!engine||!panel)return;const state=engine.getState();for(const [id,card]of cards){const selected=id===state.selectedId;card.classList.toggle('mtp-selected',selected);card.querySelector('.mtp-preview').setAttribute('aria-pressed',String(selected));}
    panel.setAttribute('aria-busy',String(!!state.busy||!!state.filtering));message((store.persistenceError?'Папки не сохранены: хранилище браузера недоступно. ':'')+(state.filtering?'Проверка шаблонов в текущих строках…':state.message||(state.selectedId?'Найдено: '+(state.count||0):'Выберите шаблон — выделятся все его вхождения на поле.')));
    for(const n of panel.querySelectorAll('.mtp-selection button,.mtp-selection input'))n.disabled=!state.selectedId||!!state.busy;
  }
  function schedule(){if(!open||scheduled)return;scheduled=true;root.requestAnimationFrame(()=>{scheduled=false;render();});}
  function bind(api){if(!api||api===engine)return;unsubscribe?.();engine=api;unsubscribe=engine.subscribe(schedule);schedule();}
  function setOpen(value,persist=true){
    if(!panel){make();if(!panel)return;}const next=!!value,changed=next!==!panel.hidden;open=next;panel.hidden=!open;doc.body.classList.toggle('may-template-panel-open',open);
    if(persist)try{root.localStorage.setItem(OPEN_KEY,open?'1':'0');}catch(_){}
    engine?.refresh();if(open)render();if(changed){root.dispatchEvent(new CustomEvent('mayatnik-template-panel-change',{detail:{open}}));root.dispatchEvent(new Event('resize'));}
  }
  root.MayatnikTemplatePanel={toggle(){setOpen(!open);},setOpen,isOpen:()=>open,refresh:schedule,bind,attachControls(element){make();if(element&&element!==controls&&!controls.contains(element)){element.classList.add('mtp-source-controls');controls.append(element);}}};
  root.addEventListener('may-template-library-ready',()=>{make();bind(root.mayTemplateLibrary);});
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',make,{once:true});else make();
})(window);
