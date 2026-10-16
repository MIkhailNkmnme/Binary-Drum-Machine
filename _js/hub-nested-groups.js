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
      head.addEventListener('pointerenter',e=>{if(e.pointerType==='touch')return;
        // v0.229: наведение на ветку без видимых кнопок (выключена или пустая) не закрывает уже раскрытую соседку.
        if(record.gate&&record.active?.()===false)return;if(!record.children.some(c=>c.children||!c.node.hidden))return;openBranch(record,true);});
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
      for(const r of records.values())if(r.active){const value=r.active();if(value!==null){const h=r.node.querySelector('summary');if(h.getAttribute('aria-pressed')!==String(value))h.setAttribute('aria-pressed',String(value));}}
      // v0.226: «все включённые сразу вверх и не скрывать» — включённая кнопка встаёт первой в своей ветке.
      const on=n=>n.getAttribute('aria-pressed')==='true'||!!n.querySelector?.(':scope > input[type=checkbox]:checked');
      const lead=[...records.values()].filter(r=>r.children?(r.action&&r.active?.()===true):on(r.node)).map(r=>r.id);
      const stamp=JSON.stringify([lead,[...pins],[...promoted],[...records.values()].map(r=>[r.id,r.node.open,r.node.hidden,r.gate&&r.active?r.active():0,r.dep?.active?.()])]);if(stamp===renderStamp)return;renderStamp=stamp;
      for(const r of records.values())if(r.wrap&&r.node.parentElement!==r.wrap)r.wrap.append(r.node);
      for(const group of groups){
        const entries=[...records.values()].filter(r=>r.group===group),shut=[];for(const r of entries)if(r.gate&&r.active&&r.active()===false){const all=n=>n.children?.forEach(c=>{if(c.free)return;shut.push(c.id);all(c);});all(r);}for(const r of entries)if(r.dep?.active?.()===false){shut.push(r.id);const all=n=>n.children?.forEach(c=>{shut.push(c.id);all(c);});all(r);}
        const plan=HubMenuTree.layout(group.root,{lead,grow:!!group.grow,promoted:[...promoted],open:entries.filter(r=>r.children&&r.node.open).map(r=>r.id),hidden:[...entries.filter(r=>!r.children&&r.node.hidden&&!promoted.has(r.id)).map(r=>r.id),...shut]});
        const positions=new Map(plan.cells.map(c=>[c.id,c]));
        for(const r of entries){const p=positions.get(r.id);r.wrap.hidden=!p;if(p){r.wrap.style.gridColumn='1';r.wrap.style.gridRow='1';r.wrap.dataset.header=String(!!p.head);r.wrap.dataset.pyrX=String(p.pyr[0]*24);r.wrap.dataset.pyrY=String(p.pyr[1]*24);}r.node.dataset.controlPinned=String(promoted.has(r.id));}
        group.slot.dataset.lo=String(plan.span[0]*24);group.slot.dataset.hi=String(plan.span[1]*24);group.slot.style.setProperty('--tree-columns','1');group.root.node.dataset.groupPinned=String(pins.has(group.key));
      }
      toolbar.dataset.hasPins=String(pins.size+promoted.size>0);
      requestAnimationFrame(()=>{
        const occupied=[];
        for(const group of groups)if(group.fixed){const z=document.getElementById('hubZoom')?.getBoundingClientRect();if(z){group.slot.style.left=Math.round(z.left+(z.width-48)/2)+'px';group.slot.style.top=Math.round(z.bottom-132+42)+'px';}}
        for(const group of groups){
          // v0.214: все ряды — одна ромбическая решётка от вершины; не влезает в экран — ряды сдвигаются целыми ромбами.
          const rect=group.slot.getBoundingClientRect(),lo=Number(group.slot.dataset.lo)||0,hi=Number(group.slot.dataset.hi)||0;
          let dx=0;if(rect.left+hi+48>innerWidth-8)dx=-Math.ceil((rect.left+hi+48-innerWidth+8)/48)*48;if(rect.left+lo+dx<8)dx+=Math.ceil((8-rect.left-lo-dx)/48)*48;
          const left=rect.left+lo+dx,right=rect.left+hi+dx+48;
          const cells=[...group.slot.children].filter(n=>!n.hidden&&n.dataset.header!=='true');let offset=document.body.classList.contains('hubMobButtons')?24:0;   // v0.223: на телефоне группы стоят вплотную — дерево ниже ряда корней
          const height=cells.length?Math.max(...cells.map(n=>(Number(n.dataset.pyrY)||0)+48)):0;
          for(const box of occupied)if(left<box.right&&right>box.left&&rect.top+24+offset<box.bottom&&rect.top+24+offset+height>box.top)offset=box.bottom-rect.top-24+4;
          for(const cell of group.slot.children){const head=cell.dataset.header==='true',px=(Number(cell.dataset.pyrX)||0)+(head?0:dx),py=(Number(cell.dataset.pyrY)||0)+(head?0:offset);cell.style.transform='translate('+px+'px,'+py+'px)';}
          if(height&&!group.fixed)occupied.push({left,right,top:rect.top+24+offset,bottom:rect.top+height+offset});
        }
        for(const r of records.values())if(!r.children&&r.node.matches('details[open]')){
          const x=r.wrap.getBoundingClientRect().left;r.node.style.setProperty('--menu-left',Math.max(8-x,Math.min(0,innerWidth-188-x))+'px');
        }
      });
    }
    function leaf(group,node){
      const id=group.key+'|'+labelOf(node);if(records.has(id))return records.get(id);
      node.dataset.pinControl=id;const tip=node.matches('details')?node.querySelector('summary'):node;
      tip.title+=(tip.title?' · ':'')+'ПКМ — поднять / вернуть · зажать ПКМ и вести — переставить';
      const record={id,node,group};records.set(id,record);return record;
    }
    const roots=[['bits','01','Биты'],['symmetry','∥','Симм.'],['axis','↗','Ось'],['space','3D','Объём'],['file','▧','Файл'],['flow','↓','Поток']];
    for(const [key,icon,name] of roots){const group={key,icon,name,leaves:[]};groups.push(group);}
    const owner=key=>groups.find(g=>g.key===key);
    for(const item of items){
      const label=item.getAttribute('aria-label')||item.title||'';let key='bits';
      if(item.matches('.hubFlowControls'))key='flow';
      else if(item.matches('.hubBitSymmetry,.hubSymmetryMinimum')||label.includes('Симметрия параллельно'))key='symmetry';
      else if(label==='Зеркало')key='symmetry';
      else if(item.matches('.hubImageTools,.hubPresetControls'))key='file';
      else if(item.matches('.hubFlipControl,.hubFlipPlanes,.hubAutoZoomControl'))key='space';
      else if(item.matches('.hubMirrorSpinControl,.hubAxisScreenPin,.hubCenterBitPin,#hubAxisShow')||/Зеркало|Заворот|Магнит оси|Вращать ось|перетаскивание холста/.test(label))key='axis';
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
      if(g.key==='symmetry')children=[...take(/\|Зеркало$/),sub(g,'search','∥','Поиск',take(/Зеркальные оси|Симметрия параллельно/)),sub(g,'limits','≡','Минимумы',take(/./))];
      if(g.key==='axis')children=[sub(g,'position','⊙','Положение',take(/hubCenterBitPin|Магнит оси/)),sub(g,'turn','↻','Вращение',take(/Вращать ось|hubAxisSpeed/)),...take(/./)];
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
      // v0.219: «сразу все пресеты показывает без отдельного скрытия, всё треугольником из ромбов» — каждый образец и цвет своим ромбом;
      // цвет подсветки симметрии — в «Симм.».
      palette.id=palette.id||'hubColorPanel';palette.hidden=true;
      // v0.220: «отражённ и заворот тоже к симметр» — цвета отражения, заворота и подсветки симметрии — в «Симм.»; первые два видны и без симметрии.
      const symSlots=['Цвет отражённых','Цвет заворота','Цвет подсветки симметрии'].map(t=>palette.querySelector('input[aria-label^="'+t+'"]')?.closest('label')).filter(Boolean);
      symSlots.forEach((n,i)=>{n.classList.add('hubTreeColor');const r=leaf(sym,n);if(i<2)r.free=true;sym.root.children.splice(1+i,0,r);});
      const swatches=[...palette.querySelectorAll('.hubPaletteList button[data-i]')];
      for(const b of swatches){b.style.left=b.style.top='';b.classList.add('hubSwatch');}
      const slots=[...palette.querySelectorAll('label.hubColorSlot')].filter(n=>!symSlots.includes(n));slots.forEach(n=>n.classList.add('hubTreeColor'));
      const items=[...palette.querySelectorAll('.hubDigitToggle'),...slots,...swatches].map(n=>leaf(colour,n));
      colour.root=createBranch(colour,'colour','🎨','Цвет',items);colour.grow=true;
    }
    // v0.217: «Точно» — пока включено, обычное колесо крутит биты шагом до точных линий (как Shift + колесо).
    {const b=document.createElement('button');b.type='button';b.id='hubExactTilt';b.className='hubRhomb';b.textContent='⟋\nТочно';
      let on=false;try{on=localStorage.getItem('zerk_hub_exact_tilt')==='true';}catch(_){}
      window.HubExactTilt={get on(){return on;},set(v){on=!!v;b.setAttribute('aria-pressed',String(on));try{localStorage.setItem('zerk_hub_exact_tilt',String(on));}catch(_){}}};
      b.title='Точный шаг колеса: колесо крутит биты до ближайшей точной линии, как Shift + колесо';b.setAttribute('aria-label',b.title);
      b.onclick=()=>window.HubExactTilt.set(!on);window.HubExactTilt.set(on);
      const turn=records.get('bits|branch:turn');if(turn)turn.children.push(leaf(bits,b));}
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
    bindAction('axis',id=>id.endsWith('|hubAxisShow'),'Ось — показать / спрятать');
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
    if(records.get('symmetry|Зеркало'))records.get('symmetry|Зеркало').free=true;
    const flow=owner('flow').root;flow.action=()=>window.HubFlow.togglePause();flow.active=()=>window.HubFlow.playing;flow.node.dataset.hasAction='true';flow.node.querySelector('summary').setAttribute('role','button');flow.node.querySelector('summary').title='Потоки — общая пауза / продолжение · Наведение / → — настройки';
    const locks={key:'locks',name:'Замок'};groups.push(locks);
    const lockItems=[['zoom','⊙','Масштаб'],['turn','↻','Треуг.'],['zero','0','Биты 0'],['one','1','Биты 1'],['pan','✥','Сдвиг'],['axis','↗','Ось'],['depth','3D','Наклон']].map(([key,icon,name])=>{
      const b=document.createElement('button');b.type='button';b.id='hubLock-'+key;b.className='hubRhomb';b.textContent=icon+'\n'+name;b.setAttribute('aria-label','Замок: '+({turn:'поворот треугольника',pan:'перемещение',axis:'положение и поворот оси',depth:'3D-наклон'}[key]||name.toLowerCase()));b.title=b.getAttribute('aria-label');
      b.onclick=()=>window.HubLocks.toggle(key);const r=leaf(locks,b);r.lockKey=key;return r;
    });
    locks.root=createBranch(locks,'locks','🔒','Замок',lockItems);locks.root.action=()=>window.HubLocks.toggleAll();locks.root.active=()=>window.HubLocks.all?true:window.HubLocks.any?'mixed':false;locks.root.node.dataset.hasAction='true';
    const lockHead=locks.root.node.querySelector('summary');lockHead.setAttribute('role','button');lockHead.title='Замкнуть всё / снять все замки · Наведение / → — отдельные замки';
    const syncLocks=()=>{for(const r of lockItems)r.node.setAttribute('aria-pressed',String(window.HubLocks.has(r.lockKey)));lockHead.setAttribute('aria-pressed',window.HubLocks.all?'true':window.HubLocks.any?'mixed':'false');};
    window.addEventListener('hublocks',()=>{syncLocks();render();});syncLocks();
    // v0.226: кнопка включилась / выключилась — сразу пересобрать порядок (включённые первыми).
    {let q=0;new MutationObserver(()=>{if(!q)q=requestAnimationFrame(()=>{q=0;render();});}).observe(toolbar,{subtree:true,attributes:true,attributeFilter:['aria-pressed']});toolbar.addEventListener('change',()=>requestAnimationFrame(render),true);}
    // v0.225: «Сброс» — первым прямо под головой своей группы (3D, Поток) или своей ветки (наклон битов).
    for(const [pre,to] of [['space|Сбросить только 3D','space'],['flow|Очистить свет','flow'],['bits|Сброс наклона',null]]){
      const r=[...records.values()].find(x=>x.id.startsWith(pre));if(!r)continue;
      const from=[...records.values()].find(x=>x.children?.includes(r));const dest=to?records.get(to):from;if(!from||!dest)continue;
      from.children.splice(from.children.indexOf(r),1);dest.children.unshift(r);
    }
    // v0.225: порядок кнопок внутри групп — правой кнопкой мыши перетаскивают (zerk_hub_order: {родитель: [дети]}).
    let order={};try{order=JSON.parse(localStorage.getItem('zerk_hub_order')||'{}')||{};}catch(_){}
    for(const r of records.values())if(r.children&&Array.isArray(order[r.id])){const at=new Map(order[r.id].map((id,i)=>[id,i])),was=new Map(r.children.map((c,i)=>[c,i]));r.children.sort((a,b)=>(at.has(a.id)?at.get(a.id):1e3+was.get(a))-(at.has(b.id)?at.get(b.id):1e3+was.get(b)));}
    for(const group of groups){
      const slot=document.createElement('div');slot.className='hubFieldSlot hubTreeGrid';slot.dataset.group=group.key;slot.setAttribute('role','group');slot.setAttribute('aria-label',group.name);group.slot=slot;toolbar.append(slot);
      const mount=(r,parent)=>{r.parent=parent;const wrap=document.createElement('div');wrap.className='hubTreeItem';wrap.dataset.treeKey=r.id;wrap.append(r.node);slot.append(wrap);r.wrap=wrap;r.children?.forEach(c=>mount(c,r));};mount(group.root,null);
      group.root.node.dataset.group=group.key;if(pins.has(group.key))group.root.node.open=true;
    }
    if(view){view.querySelector('.hubBitViewOptions')?.remove();view.querySelector('.hubBitViewArrows')?.remove();}
    for(const id of [...promoted])if(!records.has(id))promoted.delete(id);
    // Правая кнопка: щелчок — закрепить / поднять (как было), зажать и вести — переставить кнопку среди соседей.
    let rdrag=null,rdragEnd=0;
    const pinToggle=r=>{if(r.id===r.group.key){if(pins.has(r.id))pins.delete(r.id);else{pins.add(r.id);r.node.open=true;}}else if(promoted.has(r.id))promoted.delete(r.id);else promoted.add(r.id);persist();render();};
    const recAt=(x,y)=>{const n=document.elementFromPoint(x,y)?.closest?.('#hubFieldTools [data-tree-key]');return n?records.get(n.dataset.treeKey):null;};
    toolbar.addEventListener('pointerdown',e=>{
      if(e.button!==2||e.pointerType==='touch')return;const r=recAt(e.clientX,e.clientY);if(!r)return;
      rdrag={r,x:e.clientX,y:e.clientY,moved:false,pending:null,over:null};
      const mv=ev=>{if(!rdrag)return;if(!rdrag.moved&&Math.hypot(ev.clientX-rdrag.x,ev.clientY-rdrag.y)<8)return;
        if(!rdrag.moved){if(!rdrag.r.parent){rdrag=null;return;}rdrag.moved=true;rdrag.r.wrap.classList.add('hubReorderSrc');document.body.classList.add('hubReordering');}
        const t=recAt(ev.clientX,ev.clientY),ok=t&&t!==rdrag.r&&t.parent===rdrag.r.parent?t:null;
        if(rdrag.over!==ok){rdrag.over?.wrap.classList.remove('hubReorderOver');ok?.wrap.classList.add('hubReorderOver');rdrag.over=ok;}};
      const up=ev=>{document.removeEventListener('pointermove',mv,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',up,true);
        const d=rdrag;rdrag=null;if(!d)return;document.body.classList.remove('hubReordering');d.r.wrap.classList.remove('hubReorderSrc');d.over?.wrap.classList.remove('hubReorderOver');
        if(d.moved){rdragEnd=Date.now();if(d.over&&ev.type==='pointerup'){const list=d.r.parent.children,to=list.indexOf(d.over);list.splice(list.indexOf(d.r),1);list.splice(to,0,d.r);
          order[d.r.parent.id]=list.map(c=>c.id);try{localStorage.setItem('zerk_hub_order',JSON.stringify(order));}catch(_){}renderStamp='';render();}}
        else if(d.pending)pinToggle(d.pending);};
      document.addEventListener('pointermove',mv,true);document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',up,true);
    });
    toolbar.addEventListener('contextmenu',e=>{
      const wrap=e.target.closest('[data-tree-key]'),r=records.get(wrap?.dataset.treeKey);if(!r)return;e.preventDefault();e.stopPropagation();
      if(rdrag){if(!rdrag.moved)rdrag.pending=r;return;}if(Date.now()-rdragEnd<400)return;
      pinToggle(r);
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
