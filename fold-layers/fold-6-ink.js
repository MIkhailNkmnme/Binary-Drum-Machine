/* Cell annotations are separate from source bits and travel with the Fold chain work file. */
(() => {
  'use strict';
  const L = document.getElementById('rows');
  if (!L) return;
  const viewport = document.getElementById('screenCanvas');
  const ns = 'http://www.w3.org/2000/svg', bar = document.createElement('div');
  bar.id = 'rowInkBar'; bar.hidden = true;
  bar.innerHTML = `<div class="ink-tools"><button id="inkText" data-tool="text" title="Выбрать клетку и написать пометку поверх бита">✎ Текст</button><button id="inkEdge" data-tool="edge" title="Веди мышью вдоль краёв клеток: непрерывная обводка, в том числе спираль">⌑ Обводка</button><button id="inkBox" data-tool="box" title="Протяни от первой клетки до последней — внешняя рамка">□ Рамка</button><button id="inkSlash" data-tool="slash" title="Диагональ клетки снизу слева вверх вправо">/ Косая</button><button id="inkBack" data-tool="back" title="Диагональ клетки сверху слева вниз вправо">\\ Косая</button><button id="inkTop" data-tool="top" title="Верхняя горизонтальная грань клетки (NumPad 5)">⎺ Верх</button><button id="inkBottom" data-tool="bottom" title="Нижняя горизонтальная грань клетки (NumPad 0)">⎽ Низ</button><button id="inkErase" data-tool="erase" title="Стереть все пометки в клетке">⌫ Ластик</button><button id="inkUndo" title="Отменить последнее действие разметки">↶ Отмена</button><button id="inkRedo" title="Вернуть отменённое действие разметки">↷ Повтор</button><button id="inkSave" title="Скачать все цепочки с битами и разметкой в JSON">💾 Файл</button><label>Цвет <input id="inkColor" type="color" value="#ffcf48" aria-label="Цвет разметки"></label></div><div class="ink-entry"><span id="inkAddress">Выбери клетку</span><input id="inkValue" type="text" maxlength="100" placeholder="Пометка; Enter — записать" aria-label="Текст клетки"><button id="inkWrite" title="Записать текст в выбранную клетку">✓ Записать</button><button id="inkHorr" title="Новая цепочка: 128 неизменяемых строк Хоррохориуса; прежняя цепочка сохраняется">▲ Хоррохориус 128</button></div><div id="inkHint">Обводка — веди по граням клеток. / и \\ — диагонали. 1: / · 2: \\ · NumPad 5: верх · NumPad 0: низ. ПКМ — убрать косые. Колесо — масштаб; Alt+колесо — прокрутка. Ctrl+Z — отмена, Esc — выйти. Пометки сохраняются вместе с цепочкой в JSON.</div>`;
  viewport.before(bar);
  const toggle = document.createElement('button'); toggle.id = 'bRowInk'; toggle.title = 'Разметка клеток как в Excel: текст, обводка спиралей, рамки и обе диагонали'; toggle.textContent = '✎ Клетки';
  document.getElementById('bAddTab').after(toggle);
  const overlay = document.createElementNS(ns, 'svg'); overlay.id = 'rowInkOverlay'; overlay.setAttribute('aria-hidden','true'); document.body.append(overlay);
  let tabId = null;
  const tabState = () => st.tabs[st.activeTab];
  let active = false, tool = 'edge', selected = null, cells = [], drag = null, raf = 0, undo = [], redo = [], observedRoot = null;
  const $ = id => document.getElementById(id), key = c => `${c.l}:${c.r}:${c.j}`;
  const marks = () => tabState().rowInk && typeof tabState().rowInk === 'object' && !Array.isArray(tabState().rowInk) ? tabState().rowInk : (tabState().rowInk = {});
  const color = () => $('inkColor').value;
  const snapshotInk = () => JSON.stringify(marks());
  function checkpoint(){ undo.push(snapshotInk()); if(undo.length>100)undo.shift(); redo=[]; }
  function history(from,to){if(!from.length)return;to.push(snapshotInk());tabState().rowInk=JSON.parse(from.pop());saveCache();queue();}
  function element(name, attrs){const el=document.createElementNS(ns,name);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));return el;}
  function queue(){if(!raf)raf=requestAnimationFrame(draw);}
  function collect(){
    const bounds=viewport.getBoundingClientRect(), result=[];
    for(const bx of L.querySelectorAll('.ln[data-idx] > .bits > span:first-child')){
      const br=bx.getBoundingClientRect();if(br.bottom<bounds.top||br.top>bounds.bottom||br.right<bounds.left||br.left>bounds.right)continue;
      const row=bx.closest('.ln'),r=+row.dataset.idx,l=0,rr=bx.parentElement.getBoundingClientRect();
      const walker=document.createTreeWalker(bx,NodeFilter.SHOW_TEXT);let n,j=0;
      while((n=walker.nextNode()))for(let q=0;q<n.length;q++){
        if(!/[01]/.test(n.data[q]))continue;
        const range=document.createRange();range.setStart(n,q);range.setEnd(n,q+1);const b=range.getBoundingClientRect(),col=j++;
        if(b.width>0&&b.right>=bounds.left&&b.left<=bounds.right)result.push({l,r,j:col,x:b.left,y:rr.top,w:b.width,h:rr.height});
      }
    }
    return result;
  }
  function draw(){
    raf=0;if(tabId!==tabState()?.id){tabId=tabState()?.id;undo=[];redo=[];selected=null;}const state=marks(),changes=new Map((tabState().rowAnim?.last||[]).map(c=>[`0:${c.r}:${c.j}`,c.to]));overlay.replaceChildren();if(!active&&!Object.keys(state).length&&!changes.size)return;
    cells=collect();const bounds=viewport.getBoundingClientRect();overlay.setAttribute('width',innerWidth);overlay.setAttribute('height',innerHeight);
    const defs=element('defs',{}),clip=element('clipPath',{id:'rowInkClip'});clip.append(element('rect',{x:Math.max(0,bounds.left),y:Math.max(0,bounds.top),width:Math.max(0,Math.min(innerWidth,bounds.right)-Math.max(0,bounds.left)-viewport.offsetWidth+viewport.clientWidth),height:Math.max(0,Math.min(innerHeight,bounds.bottom)-Math.max(0,bounds.top))}));defs.append(clip);overlay.append(defs);
    const g=element('g',{'clip-path':'url(#rowInkClip)'});overlay.append(g);
    for(const c of cells){
      const m=state[key(c)],{x,y,w,h}=c;
      if(changes.has(key(c)))g.append(element('rect',{x,y,width:w,height:h,fill:changes.get(key(c))?'#ffd35b':'#5ce1e6','fill-opacity':'.38'}));
      if(active)g.append(element('rect',{x,y,width:w,height:h,fill:'none',stroke:'#90a6bd','stroke-opacity':'.2','stroke-width':'.6'}));
      if(m){
        let d='';if(m.edges&1)d+=`M${x} ${y}h${w}`;if(m.edges&2)d+=`M${x+w} ${y}v${h}`;if(m.edges&4)d+=`M${x} ${y+h}h${w}`;if(m.edges&8)d+=`M${x} ${y}v${h}`;
        if(m.slash)d+=`M${x} ${y+h}L${x+w} ${y}`;if(m.back)d+=`M${x} ${y}L${x+w} ${y+h}`;
        const ink=/^#[\da-f]{6}$/i.test(m.color)?m.color:'#ffcf48';if(d)g.append(element('path',{d,stroke:ink,'stroke-width':1.7,fill:'none','stroke-linecap':'square'}));
        if(m.text){g.append(element('rect',{x:x+1,y:y+1,width:Math.max(0,w-2),height:Math.max(0,h-2),fill:'var(--bg, #10151c)'}));const t=element('text',{x:x+w/2,y:y+h/2,fill:ink,'font-size':Math.max(7,Math.min(h*.65,w*1.3/Math.max(1,m.text.length*.6))),'font-family':'monospace','text-anchor':'middle','dominant-baseline':'central'});t.textContent=m.text;g.append(t);}
      }
      if(active&&selected&&key(c)===key(selected))g.append(element('rect',{x:x+1,y:y+1,width:Math.max(0,w-2),height:Math.max(0,h-2),stroke:'#7be7ff','stroke-width':2,fill:'none'}));
    }
    $('inkUndo').disabled=!undo.length;$('inkRedo').disabled=!redo.length;
    const root=L;if(root!==observedRoot){observedRoot=root;if(root)sizeObserver.observe(root);}
  }
  function hit(e){return cells.find(c=>e.clientX>=c.x&&e.clientX<c.x+c.w&&e.clientY>=c.y&&e.clientY<c.y+c.h);}
  function select(c){selected=c;$('inkAddress').textContent=`Строка ${c.r} · бит ${c.j+1}`;$('inkValue').value=marks()[key(c)]?.text||'';queue();}
  function paint(c,e){
    const id=key(c);if(tool==='erase'){delete marks()[id];return;}
    const m=marks()[id]||(marks()[id]={});m.color=color();
    if(tool==='edge'){
      const distances=[Math.abs(e.clientY-c.y),Math.abs(e.clientX-c.x-c.w),Math.abs(e.clientY-c.y-c.h),Math.abs(e.clientX-c.x)];
      const edge=1<<distances.indexOf(Math.min(...distances));m.edges=(m.edges||0)|edge;
    }else if(tool==='top'||tool==='bottom')m.edges=(m.edges||0)|(tool==='top'?1:4);
    else if(tool==='slash'||tool==='back')m[tool]=true;
  }
  function write(){if(!selected)return;checkpoint();const m=marks()[key(selected)]||(marks()[key(selected)]={});m.text=$('inkValue').value.slice(0,100);m.color=color();saveCache();queue();}
  function enabled(on){active=on;bar.hidden=!on;document.body.classList.toggle('fold-ink-open',on);toggle.classList.toggle('on',on);L.classList.toggle('row-ink-active',on);if(on){setTool(tool);queue();}else{drag=null;queue();}}
  function setTool(t){tool=t;bar.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool===t));}
  toggle.onclick=()=>enabled(!active);bar.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
  $('inkSave').onclick=()=>exportAllTabs();
  $('inkUndo').onclick=()=>history(undo,redo);$('inkRedo').onclick=()=>history(redo,undo);$('inkWrite').onclick=write;
  $('inkValue').onkeydown=e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();write();}if(e.key==='Escape')$('inkValue').blur();};
  window.addEventListener('pointerdown',e=>{
    if(!active||e.button!==0||!viewport.contains(e.target))return;const c=hit(e);if(!c)return;
    e.preventDefault();e.stopImmediatePropagation();getSelection()?.removeAllRanges();select(c);
    if(tool==='text'){$('inkValue').focus();$('inkValue').select();return;}
    checkpoint();drag={start:c,last:c,x:e.clientX,y:e.clientY};if(tool!=='box')paint(c,e);queue();
  },true);
  window.addEventListener('pointermove',e=>{
    if(!drag)return;e.preventDefault();e.stopImmediatePropagation();
    // Interpolate pointer samples so a fast stroke does not leave skipped cell edges.
    const n=Math.max(1,Math.ceil(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)/2));
    for(let i=1;i<=n;i++){const p={clientX:drag.x+(e.clientX-drag.x)*i/n,clientY:drag.y+(e.clientY-drag.y)*i/n},c=hit(p);if(c){drag.last=c;if(tool!=='box')paint(c,p);}}
    drag.x=e.clientX;drag.y=e.clientY;queue();
  },true);
  function finish(e){if(!drag)return;e.preventDefault();e.stopImmediatePropagation();
    if(tool==='box'){
      const a=drag.start,b=drag.last,r0=Math.min(a.r,b.r),r1=Math.max(a.r,b.r),x0=Math.min(a.x,b.x),x1=Math.max(a.x+a.w,b.x+b.w);
      for(let r=r0;r<=r1;r++){
        const row=cells.filter(c=>c.r===r&&c.x+c.w/2>=x0&&c.x+c.w/2<=x1).sort((a,b)=>a.x-b.x);
        row.forEach((c,i)=>{const edges=(r===r0?1:0)|(r===r1?4:0)|(i===0?8:0)|(i===row.length-1?2:0);if(!edges)return;const m=marks()[key(c)]||(marks()[key(c)]={});m.edges=(m.edges||0)|edges;m.color=color();});
      }
    }
    drag=null;saveCache();queue();
  }
  window.addEventListener('pointerup',finish,true);window.addEventListener('pointercancel',finish,true);
  for(const type of ['click','dblclick'])window.addEventListener(type,e=>{if(active&&viewport.contains(e.target)&&hit(e)){e.preventDefault();e.stopImmediatePropagation();}},true);
  window.addEventListener('contextmenu',e=>{
    if(!viewport.contains(e.target))return;
    cells=collect();const c=hit(e);if(!c)return;
    const m=marks()[key(c)];if(!active&&!m?.slash&&!m?.back)return;
    e.preventDefault();e.stopImmediatePropagation();
    if(!m?.slash&&!m?.back)return;
    checkpoint();delete m.slash;delete m.back;
    if(!m.edges&&!m.text)delete marks()[key(c)];
    saveCache();queue();
  },true);
  window.addEventListener('keydown',e=>{
    if(!active||e.target.closest('input,textarea,select,[contenteditable]'))return;
    const shortcut=!e.ctrlKey&&!e.metaKey&&!e.altKey&&({Digit1:'slash',Numpad1:'slash',Digit2:'back',Numpad2:'back',Numpad5:'top',Numpad0:'bottom'})[e.code];
    if(shortcut){e.preventDefault();e.stopImmediatePropagation();setTool(shortcut);return;}
    if(e.key==='Escape'){enabled(false);e.preventDefault();e.stopImmediatePropagation();return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.stopImmediatePropagation();e.shiftKey?history(redo,undo):history(undo,redo);return;}
    if(selected&&e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();e.stopImmediatePropagation();setTool('text');$('inkValue').value=e.key;$('inkValue').focus();}
  },true);
  const sizeObserver=new ResizeObserver(queue);sizeObserver.observe(L);
  new ResizeObserver(()=>{document.body.style.setProperty('--fold-ink-h',bar.getBoundingClientRect().height+'px');queue();}).observe(bar);
  new MutationObserver(queue).observe(L,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['style','class']});
  viewport.addEventListener('scroll',queue,{passive:true});window.addEventListener('resize',queue);document.addEventListener('scroll',queue,true);
  $('inkHorr').onclick=()=>{
    const payload=window.ZZ_HORROHORIUS_128;if(!payload){say('Не удалось загрузить биты Хоррохориуса. Обнови страницу.');return;}
    saveActiveTabState();
    const next=createDefaultTabState('Хоррохориус 128 · неизменные');
    next.uiSettings={...next.uiSettings,align:'center',lh:'1.2',fs:'19'};
    Object.assign(next,{rows:['',...payload.rows],tplRows:['',...payload.rows],used:Array(129).fill(false),pats:[],tplPats:[],step:0,aIdx:0,bIdx:1,topBuilt:0,horizonRow:0,selectedRows:[],rowDividers:[],rowGroups:[],rowGroupsL:[],rowGroupsR:[],pastes:[],undo:[],newBits:[],rowInk:{},rowInkSource:payload.meta});
    st.tabs.push(next);loadTabState(st.tabs.length-1);st.align='center';render();saveCache();enabled(true);
    $('inkHint').textContent=`128 строк · шаги ${payload.meta.previousStep} и ${payload.meta.step} совпадают. Все биты этой области неизменяемы. 1: / · 2: \\ · NumPad 5/0: верх/низ. ПКМ — убрать косые. Колесо — масштаб.`;
    say('Хоррохориус: 128 неизменяемых строк, 16 384 бита.');
  };
  window.ZZRowInk={refresh:queue,open:()=>enabled(true),selected:()=>selected?{r:selected.r,j:selected.j}:null};queue();
})();
