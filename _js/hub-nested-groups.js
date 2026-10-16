/* Hub v0.209: nested diamond menus by theme; promotion keeps the original control node.
   Pult (cross on the right) holds all rotations; colours moved to the top bar; settings of a switched-off branch are hidden. */
(() => {
  'use strict';
  window.HubNestedGroups={init(){
    const toolbar=document.getElementById('hubFieldTools');if(!toolbar||toolbar.dataset.grouped)return;
    toolbar.dataset.grouped='true';toolbar.dataset.nested='true';
    toolbar.querySelector('.hubViewRotationControl')?.remove();document.getElementById('hub3DQuick')?.remove();
    const source=document.createElement('div');source.hidden=true;source.id='hubMenuSources';
    const items=[...toolbar.children];items.forEach(n=>source.append(n));toolbar.append(source);
    let saved={};try{saved=JSON.parse(localStorage.getItem('zerk_hub_pins')||'{}')||{};}catch(_){}
    const pins=new Set(saved.groups||[]),promoted=new Set(saved.controls||[]),records=new Map(),groups=[];let renderStamp='';
    const persist=()=>{try{localStorage.setItem('zerk_hub_pins',JSON.stringify({groups:[...pins],controls:[...promoted]}));}catch(_){}};
    const labelOf=n=>n.id||n.getAttribute('aria-label')||n.querySelector('[aria-label]')?.getAttribute('aria-label')||n.title;
    const createBranch=(group,id,icon,name,children,existing=null)=>{
      const node=existing||document.createElement('details');node.className='hubTreeBranch hubFieldGroup';node.dataset.branch=id;node.dataset.nested='true';
      let head=node.querySelector(':scope > summary');if(!head){head=document.createElement('summary');node.append(head);const mark=document.createElement('b'),caption=document.createElement('small');mark.textContent=icon;caption.textContent=name;head.append(mark,caption);}
      head.className='hubRhomb';if(!existing)head.setAttribute('aria-label',(id===group.key?'Группа: ':'Подгруппа: ')+name);
      head.title=name+' · ПКМ — '+(id===group.key?'закрепить группу':'поднять / вернуть');
      const record={id,node,children,group};records.set(id,record);
      head.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(record.action){record.action();if(e.pointerType!=='mouse')openBranch(record,true);render();}else openBranch(record,!node.open);});
      head.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')openBranch(record,true);});
      head.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();openBranch(record,e.key==='ArrowRight');}});
      node.addEventListener('toggle',()=>{if(id===group.key&&pins.has(id))node.open=true;render();});
      return record;
    };
    function ancestors(record){const found=new Set();for(let n=record;n;n=n.parent)found.add(n.id);return found;}
    function openBranch(record,on){
      if(on){const path=ancestors(record);for(const r of records.values())if(r.children&&!path.has(r.id)&&!pins.has(r.group.key))r.node.open=false;}
      record.node.open=on;render();
    }
    function render(){
      for(const r of records.values())if(r.active){const value=r.active();if(value!==null)r.node.querySelector('summary').setAttribute('aria-pressed',String(value));}
      const stamp=JSON.stringify([[...pins],[...promoted],[...records.values()].map(r=>[r.id,r.node.open,r.node.hidden,r.gate&&r.active?r.active():0,r.dep?.active?.()])]);if(stamp===renderStamp)return;renderStamp=stamp;
      for(const r of records.values())if(r.wrap&&r.node.parentElement!==r.wrap)r.wrap.append(r.node);
      for(const group of groups){
        const entries=[...records.values()].filter(r=>r.group===group),shut=[];for(const r of entries)if(r.gate&&r.active&&r.active()===false){const all=n=>n.children?.forEach(c=>{shut.push(c.id);all(c);});all(r);}for(const r of entries)if(r.dep?.active?.()===false){shut.push(r.id);const all=n=>n.children?.forEach(c=>{shut.push(c.id);all(c);});all(r);}
        const plan=HubMenuTree.layout(group.root,{promoted:[...promoted],open:entries.filter(r=>r.children&&r.node.open).map(r=>r.id),hidden:[...entries.filter(r=>!r.children&&r.node.hidden&&!promoted.has(r.id)).map(r=>r.id),...shut]});
        const positions=new Map(plan.cells.map(c=>[c.id,c]));
        for(const r of entries){const p=positions.get(r.id);r.wrap.hidden=!p;if(p){r.wrap.style.gridColumn=String(p.column+1);const top=r.id===group.key||promoted.has(r.id);r.wrap.style.gridRow=String(p.row+1);r.wrap.dataset.header=String(!!p.head);r.wrap.style.setProperty('--tree-x',String(p.column*52));r.wrap.dataset.pyrX=p.pyr?String(p.pyr[0]*24):'';r.wrap.dataset.pyrY=p.pyr?String(p.pyr[1]*24):'';}r.node.dataset.controlPinned=String(promoted.has(r.id));}
        group.slot.style.setProperty('--tree-columns',String(plan.columns));group.root.node.dataset.groupPinned=String(pins.has(group.key));
      }
      toolbar.dataset.hasPins=String(pins.size+promoted.size>0);
      requestAnimationFrame(()=>{
        const occupied=[];
        for(const group of groups)if(group.fixed){const z=document.getElementById('hubZoom')?.getBoundingClientRect();if(z){group.slot.style.left=Math.round(z.left+(z.width-48)/2)+'px';group.slot.style.top=Math.round(z.bottom-132+42)+'px';}}
        for(const group of groups){
          const rect=group.slot.getBoundingClientRect(),width=Number(group.slot.style.getPropertyValue('--tree-columns'))*52-4,reverse=rect.left+width>innerWidth-8;
          const left=reverse?rect.left-width+48:rect.left,right=left+width;
          const cells=[...group.slot.children].filter(n=>!n.hidden&&n.dataset.header!=='true');let offset=0;
          const height=cells.length?Math.max(...cells.map(n=>(Number(n.style.gridRow)-1)*52+48+(Number(n.dataset.pyrY)||0))):0;
          for(const box of occupied)if(left<box.right&&right>box.left&&rect.top+52+offset<box.bottom)offset=box.bottom-rect.top-52+8;
          for(const cell of group.slot.children){const x=Number(cell.style.getPropertyValue('--tree-x'))||0;const px=Number(cell.dataset.pyrX)||0,py=Number(cell.dataset.pyrY)||0;cell.style.transform='translate('+(-2*x*(reverse?1:0)+px)+'px,'+((cell.dataset.header==='true'?0:offset)+py)+'px)';}
          if(height)occupied.push({left,right,bottom:rect.top+height+offset});
        }
        for(const r of records.values())if(!r.children&&r.node.matches('details[open]')){
          const x=r.wrap.getBoundingClientRect().left;r.node.style.setProperty('--menu-left',Math.max(8-x,Math.min(0,innerWidth-188-x))+'px');
        }
      });
    }
    function leaf(group,node){
      const id=group.key+'|'+labelOf(node);if(records.has(id))return records.get(id);
      node.dataset.pinControl=id;const tip=node.matches('details')?node.querySelector('summary'):node;
      tip.title+=(tip.title?' · ':'')+'ПКМ — поднять / вернуть';
      const record={id,node,group};records.set(id,record);return record;
    }
    const roots=[['bits','01','Биты'],['symmetry','∥','Симм.'],['axis','↗','Ось'],['space','3D','Объём'],['file','▧','Файл'],['flow','↓','Поток']];
    for(const [key,icon,name] of roots){const group={key,icon,name,leaves:[]};groups.push(group);}
    const owner=key=>groups.find(g=>g.key===key);
    for(const item of items){
      const label=item.getAttribute('aria-label')||item.title||'';let key='bits';
      if(item.matches('.hubFlowControls'))key='flow';
      else if(item.matches('.hubBitSymmetry,.hubSymmetryMinimum')||label.includes('Симметрия параллельно'))key='symmetry';
      else if(item.matches('.hubImageTools,.hubPresetControls'))key='file';
      else if(item.matches('.hubFlipControl,.hubFlipPlanes,.hubAutoZoomControl'))key='space';
      else if(item.matches('.hubMirrorSpinControl,.hubAxisScreenPin,.hubCenterBitPin')||/Зеркало|Заворот|Магнит оси|Вращать ось|перетаскивание холста/.test(label))key='axis';
      const group=owner(key),selector='button.hubRhomb,label.hubRhomb,details.hubTilt';
      const nodes=item.matches(selector)?[item]:[...item.querySelectorAll(selector)];
      for(const node of nodes){if(node.closest('details.hubTilt')&&node.closest('details.hubTilt')!==node)continue;group.leaves.push(leaf(group,node));}
      for(const speed of item.querySelectorAll('label.hubMirrorSpeedControl')){
        const node=document.createElement('details');node.className='hubTilt';node.id=key==='axis'?'hubAxisSpeed':'hubFlipSpeed';
        const head=document.createElement('summary');head.textContent='×\nСкорость';head.setAttribute('aria-label',key==='axis'?'Скорость вращения оси':'Скорость 3D-вращения');node.append(head,speed);group.leaves.push(leaf(group,node));
      }
    }
    const sub=(g,id,icon,name,children)=>children.length?createBranch(g,g.key+'|branch:'+id,icon,name,children):null;
    for(const g of groups){
      const take=pattern=>{const found=g.leaves.filter(r=>pattern.test(r.id));g.leaves=g.leaves.filter(r=>!found.includes(r));return found;};
      let children=[];
      if(g.key==='bits')children=[sub(g,'pattern','△','Рисунок',take(/Узор|hubRowCount/)),sub(g,'turn','↻','Поворот',take(/Наклон|Сброс наклона|hubBitFreeRotation/)),sub(g,'music','♪','Движение',take(/./))];
      if(g.key==='symmetry')children=[sub(g,'search','∥','Поиск',take(/Зеркальные оси|Симметрия параллельно/)),sub(g,'limits','≡','Минимумы',take(/./))];
      if(g.key==='axis')children=[sub(g,'position','⊙','Положение',take(/Зеркало$|hubCenterBitPin|Магнит оси/)),sub(g,'turn','↻','Вращение',take(/Вращать ось|hubAxisSpeed/)),...take(/./)];
      if(g.key==='space')children=[sub(g,'zoom','⊙','Автозум',take(/автозума|Автозум/)),sub(g,'planes','3D','Плоскости',take(/./))];
      if(g.key==='file')children=[sub(g,'presets','▤','Состояния',take(/hubSaveState|hubPresetList/)),sub(g,'image','▧','Картинка',take(/./))];
      if(g.key==='flow'){
        const optics=sub(g,'light-settings','⚙','Настройки',[
          sub(g,'light-zero','0','Бит 0',take(/hubLightRule-0-/)),sub(g,'light-one','1','Бит 1',take(/hubLightRule-1-/)),...take(/hubLightLoss/)
        ].filter(Boolean));
        const style=sub(g,'light-style','01','Вид света',take(/Свет в виде|Размер битов света/));
        const sun=sub(g,'sun','☀','Солнце',take(/Свет из солнца|Радиус солнца/));
        children=[sub(g,'light','А','Свет',[...take(/А — свет|Скорость света/),optics,style,sun].filter(Boolean)),sub(g,'snow','Б','Снег',take(/Б — мокрый|Скорость снега/)),sub(g,'water','В','Вода',take(/В — вода|Скорость воды|Вода: стороны/)),...take(/./)];
      }
      g.root=createBranch(g,g.key,g.icon,g.name,children.filter(Boolean));
    }
    const view=document.querySelector('.hubBitView'),packing=document.getElementById('hubBitPacking');
    const bits=owner('bits'),detach=r=>{for(const g of groups){const walk=n=>{if(n?.children){n.children=n.children.filter(c=>c!==r);n.children.forEach(walk);}};walk(g.root);}};
    const regroup=(r,g)=>{r.group=g;r.children?.forEach(c=>regroup(c,g));};
    // Вид битов, «встык» и прозрачные 0 / 1 — подгруппа «Битов».
    if(view){
      const options=[...view.querySelectorAll('button[data-view]')].map(n=>leaf(bits,n));
      if(packing)options.push(leaf(bits,packing));
      bits.root.children.splice(1,0,createBranch(bits,'view','','Вид битов',options,view));
    }
    // ✦ — в «Симметрию»; PNG и видео — в «Файл».
    const gold=document.querySelector('.hubColorGroup [aria-label^="Золото"]'),sym=owner('symmetry');
    if(gold){const r=leaf(sym,gold),search=records.get('symmetry|branch:search');(search||sym.root).children.unshift(r);}
    const file=owner('file'),img=records.get('file|branch:image');
    for(const id of ['hubPNG','hubRec']){const n=document.getElementById(id);if(n)(img||file.root).children.push(leaf(file,n));}
    // Цвета — своя группа наверху, весь ромб цветов одной кнопкой.
    const palette=document.querySelector('.hubColorGroup');
    if(palette){
      const colour={key:'colour',name:'Цвет'};groups.splice(groups.indexOf(sym),0,colour);
      palette.id=palette.id||'hubColorPanel';const r=leaf(colour,palette);r.wide=true;
      colour.root=createBranch(colour,'colour','🎨','Цвет',[r]);
    }
    // Пульт движений (крест справа): все вращения — битов, оси, 3D и автозум.
    const motion={key:'motion',name:'Пульт движений'},moving=['bits|branch:turn','axis|branch:turn','space|branch:zoom'].map(id=>records.get(id)).filter(Boolean);
    moving.forEach(r=>{detach(r);regroup(r,motion);});
    const flipSpeed=[...records.values()].find(r=>r.id==='space|hubFlipSpeed');if(flipSpeed)detach(flipSpeed);
    groups.push(motion);
    const turn3d=createBranch(motion,'motion|branch:3d','3D','3D',flipSpeed?[flipSpeed]:[]);if(flipSpeed)regroup(flipSpeed,motion);
    // v0.212: магнит оси (шаги 15° при вращении) — тоже в пульте.
    const magnet=[...records.values()].find(r=>!r.children&&r.id.startsWith('axis|Магнит оси'));if(magnet){detach(magnet);regroup(magnet,motion);}
    motion.root=createBranch(motion,'motion','↻','Вращ.',[...moving.slice(0,2),turn3d,...moving.slice(2),...(magnet?[magnet]:[])]);
    motion.fixed=true;
    // A first diamond performs the main action as well as opening its children.
    // Reuse the actual original controls; do not duplicate handlers or state.
    const bindAction=(id,find,description)=>{
      const branch=records.get(id),primary=[...records.values()].find(r=>!r.children&&find(r.id));if(!branch||!primary)return;
      const remove=r=>{if(r.children){r.children=r.children.filter(c=>c!==primary);r.children.forEach(remove);}};groups.forEach(g=>remove(g.root));
      records.delete(primary.id);source.append(primary.node);
      branch.action=()=>{const input=primary.node.querySelector('input[type=checkbox]');(input||primary.node).click();};
      branch.active=()=>{const input=primary.node.querySelector('input[type=checkbox]');return input?input.checked:primary.node.hasAttribute('aria-pressed')?primary.node.getAttribute('aria-pressed')==='true':null;};
      branch.node.dataset.hasAction='true';const head=branch.node.querySelector('summary');head.setAttribute('role','button');head.setAttribute('aria-description',description);head.title=description+' · Наведение / → — настройки · ПКМ — закрепить / вернуть';
      if(promoted.delete(primary.id)&&id!==branch.group.key)promoted.add(id);
    };
    bindAction('bits',id=>id.endsWith('|Пуск / пауза битов'),'Биты — пуск / пауза');
    bindAction('symmetry',id=>id.endsWith('|Зеркальные оси и парные биты'),'Симметрия — включить / выключить');
    bindAction('axis',id=>id.endsWith('|Зеркало'),'Ось зеркала — включить / выключить');
    bindAction('space',id=>id.endsWith('|Переворот вокруг оси зеркала в 3D'),'3D-вращение — пуск / пауза');
    bindAction('file',id=>id.endsWith('|hubPresetList'),'Открыть список шаблонов');
    bindAction('flow|branch:light',id=>id.includes('|А — свет:'),'Свет — включить / выключить');
    bindAction('flow|branch:snow',id=>id.includes('|Б — мокрый снег'),'Снег — включить / выключить');
    bindAction('flow|branch:water',id=>id.includes('|В — вода:'),'Вода — включить / выключить');
    const space3d=records.get('space');if(space3d&&space3d.action){turn3d.action=space3d.action;turn3d.active=space3d.active;turn3d.node.dataset.hasAction='true';const h=turn3d.node.querySelector('summary');h.setAttribute('role','button');h.title='3D-вращение — пуск / пауза · Наведение / → — скорость';}
    // Пока выключено — зависимые кнопки скрыты.
    for(const id of ['symmetry','axis','space','flow|branch:light','flow|branch:snow','flow|branch:water','motion|branch:3d'])if(records.get(id))records.get(id).gate=true;
    // v0.212: вращение оси в пульте видно, только пока ось (зеркало) включена.
    if(records.get('axis|branch:turn'))records.get('axis|branch:turn').dep=records.get('axis');
    const flow=owner('flow').root;flow.action=()=>window.HubFlow.togglePause();flow.active=()=>window.HubFlow.playing;flow.node.dataset.hasAction='true';flow.node.querySelector('summary').setAttribute('role','button');flow.node.querySelector('summary').title='Потоки — общая пауза / продолжение · Наведение / → — настройки';
    const locks={key:'locks',name:'Замок'};groups.push(locks);
    const lockItems=[['zoom','⊙','Масштаб'],['turn','↻','Треуг.'],['zero','0','Биты 0'],['one','1','Биты 1'],['pan','✥','Сдвиг'],['axis','↗','Ось'],['depth','3D','Наклон']].map(([key,icon,name])=>{
      const b=document.createElement('button');b.type='button';b.id='hubLock-'+key;b.className='hubRhomb';b.textContent=icon+'\n'+name;b.setAttribute('aria-label','Замок: '+({turn:'поворот треугольника',pan:'перемещение',axis:'положение и поворот оси',depth:'3D-наклон'}[key]||name.toLowerCase()));b.title=b.getAttribute('aria-label');
      b.onclick=()=>window.HubLocks.toggle(key);const r=leaf(locks,b);r.lockKey=key;return r;
    });
    locks.root=createBranch(locks,'locks','🔒','Замок',lockItems);locks.root.action=()=>window.HubLocks.toggleAll();locks.root.active=()=>window.HubLocks.all?true:window.HubLocks.any?'mixed':false;locks.root.node.dataset.hasAction='true';
    const lockHead=locks.root.node.querySelector('summary');lockHead.setAttribute('role','button');lockHead.title='Замкнуть всё / снять все замки · Наведение / → — отдельные замки';
    const syncLocks=()=>{for(const r of lockItems)r.node.setAttribute('aria-pressed',String(window.HubLocks.has(r.lockKey)));lockHead.setAttribute('aria-pressed',window.HubLocks.all?'true':window.HubLocks.any?'mixed':'false');};
    window.addEventListener('hublocks',()=>{render();syncLocks();});syncLocks();
    for(const group of groups){
      const slot=document.createElement('div');slot.className='hubFieldSlot hubTreeGrid';slot.dataset.group=group.key;slot.setAttribute('role','group');slot.setAttribute('aria-label',group.name);group.slot=slot;toolbar.append(slot);
      const mount=(r,parent)=>{r.parent=parent;const wrap=document.createElement('div');wrap.className='hubTreeItem';wrap.dataset.treeKey=r.id;wrap.append(r.node);slot.append(wrap);r.wrap=wrap;r.children?.forEach(c=>mount(c,r));};mount(group.root,null);
      group.root.node.dataset.group=group.key;if(pins.has(group.key))group.root.node.open=true;
    }
    if(view){view.querySelector('.hubBitViewOptions')?.remove();view.querySelector('.hubBitViewArrows')?.remove();}
    for(const id of [...promoted])if(!records.has(id))promoted.delete(id);
    toolbar.addEventListener('contextmenu',e=>{
      const wrap=e.target.closest('[data-tree-key]'),r=records.get(wrap?.dataset.treeKey);if(!r)return;e.preventDefault();e.stopPropagation();
      if(r.id===r.group.key){if(pins.has(r.id))pins.delete(r.id);else{pins.add(r.id);r.node.open=true;}}
      else if(promoted.has(r.id))promoted.delete(r.id);else promoted.add(r.id);
      persist();render();
    });
    toolbar.addEventListener('toggle',e=>{if(e.target.matches('.hubTilt')&&e.target.open){toolbar.querySelectorAll('.hubTilt[open]').forEach(n=>{if(n!==e.target)n.open=false;});render();}},true);
    const close=()=>{for(const r of records.values())if(r.children&&!pins.has(r.group.key))r.node.open=false;render();};
    document.addEventListener('pointerdown',e=>{if(!toolbar.contains(e.target))close();},true);
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
    for(const event of ['hubmirror','hubimage','hubmusic','hubflowstate','hubview'])window.addEventListener(event,render);
    window.addEventListener('resize',()=>{renderStamp='';render();});
    window.HubMenuLayout={snapshot:()=>({groups:[...pins],controls:[...promoted],open:[...records.values()].filter(r=>r.children&&r.node.open).map(r=>r.id)}),restore:s=>{for(const r of records.values())if(r.children)r.node.open=(s?.open||[]).includes(r.id)||(r.id===r.group.key&&pins.has(r.group.key));render();}};
    persist();render();syncLocks();
  }};
})();
