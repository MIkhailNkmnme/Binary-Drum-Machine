/* Independent colour clocks. Host calls advance once per real build/frame, then applies
   its returned changes. No synthetic input/change events and no redraw/build calls.
   register(inputOrGetter, stableKey) also accepts a getter returning several inputs.
   adaptPalette(elementOrGetter, key, get, set, {paint:false}) connects a visible
   swatch; paint:false leaves its existing background untouched. The first
   custom set for a key is its canonical writer. setWriter explicitly replaces it.
   Setters receive (hex, {key, silent:true, auto:true}). Keep them free of builds.
   Manual input keeps the clock enabled and continues from the nearest rainbow hue.
   Modes/index/last colour persist independently of the host's ordinary settings. */
(() => {
  'use strict';
  const STORAGE_KEY = 'mayatnik-colour-auto-v1';
  const MODES = ['off', 'build', 'frame'];
  const LABELS = ['Выкл', 'На построение', 'На кадр'];
  const palette = Object.freeze(Array.from({length:32}, (_, i) => {
    const h = i * 6 / 32, x = Math.round(255 * (1 - Math.abs(h % 2 - 1)));
    const rgb = h < 1 ? [255,x,0] : h < 2 ? [x,255,0] : h < 3 ? [0,255,x] : h < 4 ? [0,x,255] : h < 5 ? [x,0,255] : [255,0,x];
    return '#' + rgb.map(v => v.toString(16).padStart(2,'0')).join('');
  }));
  const hex = value => /^#[\da-f]{6}$/i.test(value || '') ? value.toLowerCase() : null;
  function nearest(value) {
    const c = hex(value); if (!c) return 0;
    const rgb = [1,3,5].map(i => parseInt(c.slice(i,i+2),16));
    let result = 0, best = Infinity;
    palette.forEach((p,i) => { const d = [1,3,5].reduce((s,n,j) => s + (parseInt(p.slice(n,n+2),16)-rgb[j]) ** 2,0); if(d < best){best=d;result=i;} });
    return result;
  }
  function create(options = {}) {
    const doc = options.document || window.document;
    let storage = options.storage;
    if (storage === undefined) { try { storage = window.localStorage; } catch {} }
    const storageKey = options.storageKey || STORAGE_KEY, entries = new Map();
    let saved = {};
    try { const raw = JSON.parse(storage?.getItem(storageKey) || '{}'); if(raw && typeof raw === 'object' && !Array.isArray(raw)) saved=raw; } catch {}
    const seen = {build:new Set(),frame:new Set()};
    let portal, mini, menu, active = null, hideTimer = 0, destroyed = false;
    const listeners = [];
    const listen = (target,type,fn,capture=false) => { target.addEventListener(type,fn,capture); listeners.push(() => target.removeEventListener(type,fn,capture)); };
    const nodes = adapter => {
      const value = typeof adapter.target === 'function' ? adapter.target() : adapter.target;
      return value ? (value.nodeType ? [value] : Array.from(value)) : [];
    };
    function persist() {
      const value = Object.assign(Object.create(null), saved);
      entries.forEach((e,k) => { value[k] = {mode:e.mode,index:e.index,color:e.color}; });
      saved = value;
      try { storage?.setItem(storageKey,JSON.stringify(value)); } catch {}
    }
    function state(e) { return {key:e.key,mode:e.mode,index:e.index,color:e.color}; }
    function entry(key, color) {
      if (typeof key !== 'string' || !key.trim()) throw new TypeError('Colour auto needs a stable key');
      if (!entries.has(key)) {
        const old = Object.prototype.hasOwnProperty.call(saved,key) ? saved[key] || {} : {};
        const initial = hex(color) || '#ff0000';
        entries.set(key,{key,mode:MODES.includes(old.mode)?old.mode:'off',index:Number.isInteger(old.index)&&old.index>=0&&old.index<32?old.index:nearest(initial),color:hex(old.color)||initial,adapters:new Set(),writer:null});
      }
      return entries.get(key);
    }
    function paint(e, callWriter) {
      if (callWriter && e.writer) e.writer(e.color,{key:e.key,silent:true,auto:true});
      for (const a of e.adapters) for (const node of nodes(a)) {
        if (node.matches?.('input[type="color"]')) node.value=e.color;
        else {
          if (a.options.paint !== false) node.style.backgroundColor=e.color;
          node.style.setProperty('--may-auto-colour',e.color);
          if (!node.matches?.('button,input,select,textarea,a[href],[tabindex]')) node.tabIndex=0;
          if (!node.hasAttribute('role')) node.setAttribute('role','button');
          if (!node.hasAttribute('aria-label')) node.setAttribute('aria-label',node.title || 'Цвет');
        }
        node.dataset.colourAutoMode=e.mode;
        if (!node.hasAttribute('aria-keyshortcuts')) node.setAttribute('aria-keyshortcuts','ArrowRight Alt+A');
      }
      if(active?.entry === e) syncUI();
    }
    function bind(target,key,get,set,adapterOptions={}) {
      const adapter = {target,get,options:adapterOptions};
      const initialNode = nodes(adapter)[0];
      const initial = get ? get() : initialNode?.value;
      const e = entry(key,initial);
      // Ordinary saved colours are owned by the host while the clock is off.
      if (!e.adapters.size && e.mode === 'off' && hex(initial)) { e.color=hex(initial); e.index=nearest(e.color); }
      e.adapters.add(adapter);
      if (set && !e.writer) e.writer=set;
      paint(e,false);
      return {key, getState:() => state(e), setMode:mode => setMode(key,mode), refresh:() => paint(e,false), unregister:() => { e.adapters.delete(adapter); if(active?.adapter===adapter) hide(); }};
    }
    function setMode(key,mode) {
      if (!MODES.includes(mode)) throw new TypeError('Unknown colour auto mode: '+mode);
      const e=entry(key); e.mode=mode; persist(); paint(e,false);
      doc?.dispatchEvent(new window.CustomEvent('mayatnik:colour-auto-mode',{detail:state(e)}));
      return state(e);
    }
    function manual(key,color) {
      const e=entries.get(key), c=hex(color); if(!e || !c) return null;
      e.color=c; e.index=nearest(c); persist(); paint(e,false); return state(e);
    }
    function advance(kind,eventId,steps=1) {
      if(kind !== 'build' && kind !== 'frame') throw new TypeError('Unknown colour clock: '+kind);
      if(!Number.isSafeInteger(steps) || steps < 1) throw new TypeError('Colour clock steps must be a positive safe integer');
      // Keep a bounded recent-id window, including out-of-order redraw repeats.
      if(eventId !== undefined && eventId !== null) {
        if(seen[kind].has(eventId)) return [];
        seen[kind].add(eventId); if(seen[kind].size>256) seen[kind].delete(seen[kind].values().next().value);
      }
      const changes=[];
      entries.forEach(e => { if(e.mode===kind){ e.index=(e.index+steps%32)%32;e.color=palette[e.index];paint(e,true);changes.push(state(e)); } });
      if(changes.length) persist(); return changes;
    }
    function find(node) {
      if(!node?.nodeType) return null;
      for(const e of entries.values()) for(const adapter of e.adapters) for(const el of nodes(adapter)) {
        if(el===node || el.contains(node)) return {entry:e,adapter,element:el};
      }
      return null;
    }
    function cancelHide(){ clearTimeout(hideTimer); }
    function hide(){const group=active?.element.closest?.('.pt-g,.gz-group');cancelHide();if(portal)portal.hidden=true;active=null;group?._popupLeave?.();}
    function later(){ cancelHide();hideTimer=setTimeout(() => {if(!portal?.contains(doc.activeElement))hide();},300); }
    function button(label){ const b=doc.createElement('button');b.type='button';b.className='gz-hx';b.title=label;b.setAttribute('aria-label',label);const span=doc.createElement('span');span.className='gz-nm';span.textContent=label;b.append(span);return b; }
    function ensureUI(){
      if(portal || !doc?.body) return;
      portal=doc.createElement('div');portal.className='may-colour-auto gz-ladder';portal.hidden=true;
      mini=button('Авто');mini.classList.add('may-colour-auto-mini');mini.setAttribute('aria-haspopup','menu');mini.setAttribute('aria-expanded','false');portal.append(mini);
      menu=doc.createElement('div');menu.className='may-colour-auto-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label','Автоматическая смена цвета');menu.hidden=true;
      LABELS.forEach((label,i) => {const b=button(label);b.setAttribute('role','menuitemradio');b.dataset.mode=MODES[i];b.addEventListener('click',()=>{if(!active)return;setMode(active.entry.key,MODES[i]);syncUI();b.focus();});menu.append(b);});
      portal.append(menu);doc.body.append(portal);
      portal.addEventListener('pointerenter',cancelHide);portal.addEventListener('pointerleave',later);
      portal.addEventListener('focusin',cancelHide);portal.addEventListener('focusout',()=>{setTimeout(()=>{if(!portal.contains(doc.activeElement)&&doc.activeElement!==active?.element)later();},0);});
      mini.addEventListener('click',()=>{menu.hidden=!menu.hidden;syncUI();place();});
      portal.addEventListener('keydown',e=>{
        if(e.key==='Escape'){const source=active?.element;source?.focus();hide();e.preventDefault();e.stopPropagation();return;}
        if(e.key==='ArrowDown'||e.key==='ArrowUp'||e.key==='Home'||e.key==='End'){
          e.preventDefault();menu.hidden=false;const items=Array.from(menu.children),current=items.indexOf(doc.activeElement);
          const index=e.key==='Home'?0:e.key==='End'?2:current<0?(e.key==='ArrowUp'?2:0):(current+(e.key==='ArrowUp'?2:1))%3;
          syncUI();place();items[index].focus();
        }
      });
    }
    function syncUI(){
      if(!active||!mini)return;
      const mode=active.entry.mode, color=window.getComputedStyle?.(active.element).getPropertyValue('--c').trim();
      portal.style.setProperty('--c',color||'#5aa9ff');
      mini.classList.toggle('gz-on',mode!=='off');mini.setAttribute('aria-expanded',String(!menu.hidden));
      mini.title='Автоматическая смена цвета: '+LABELS[MODES.indexOf(mode)];
      for(const b of menu.children){const selected=b.dataset.mode===mode;b.classList.toggle('gz-on',selected);b.setAttribute('aria-checked',String(selected));}
    }
    function place(){
      if(!active||!portal)return;
      const r=active.element.getBoundingClientRect(), margin=4, gap=2;
      const w=portal.offsetWidth||56,h=portal.offsetHeight||28;
      const vw=doc.documentElement.clientWidth||window.innerWidth,vh=doc.documentElement.clientHeight||window.innerHeight;
      let x=r.right+gap;if(x+w>vw-margin)x=r.left-w-gap;
      x=Math.max(margin,Math.min(x,vw-w-margin));
      const y=Math.max(margin,Math.min(r.top,vh-h-margin));
      portal.style.left=Math.round(x)+'px';portal.style.top=Math.round(y)+'px';
      portal.style.maxWidth=Math.max(0,vw-2*margin)+'px';portal.style.maxHeight=Math.max(0,vh-2*margin)+'px';
      if(!menu.hidden){
        const mw=menu.offsetWidth||124,mh=menu.offsetHeight||80;
        const mx=Math.max(margin,Math.min(x,vw-mw-margin));
        let my=y+h+gap;if(my+mh>vh-margin)my=y-mh-gap;
        my=Math.max(margin,Math.min(my,vh-mh-margin));
        Object.assign(menu.style,{left:Math.round(mx)+'px',top:Math.round(my)+'px',maxWidth:Math.max(0,vw-2*margin)+'px',maxHeight:Math.max(0,vh-2*margin)+'px'});
      }
    }
    function show(found){
      if(!found || found.element.disabled || found.element.closest('[inert],[hidden]')) return;
      ensureUI();if(!portal)return;cancelHide();
      if(active?.element!==found.element)menu.hidden=true;
      active=found;portal.hidden=false;syncUI();place();
    }
    if(doc){
      listen(doc,'pointerover',e=>{const found=find(e.target);if(found)show(found);});
      listen(doc,'pointerout',e=>{if(find(e.target)&&!portal?.contains(e.relatedTarget)&&!find(e.relatedTarget))later();});
      listen(doc,'focusin',e=>{const found=find(e.target);if(found)show(found);else if(!portal?.contains(e.target))later();});
      listen(doc,'focusout',e=>{if(find(e.target))later();});
      listen(doc,'pointerdown',e=>{if(portal?.contains(e.target))return;const found=find(e.target);if(found)show(found);else hide();},true);
      listen(doc,'keydown',e=>{const found=find(e.target);if(found&&(e.key==='ArrowRight'||(e.altKey&&e.key.toLowerCase()==='a'))){show(found);mini?.focus();e.preventDefault();}else if(e.key==='Escape'&&active)hide();});
      const input=e=>{const found=find(e.target);if(found)manual(found.entry.key,found.adapter.get?found.adapter.get():e.target.value);};
      listen(doc,'input',input);listen(doc,'change',input);
      listen(window,'resize',()=>{if(active)place();});
      listen(doc,'scroll',()=>{if(active)hide();},true);
    }
    return {palette,register:(target,key)=>bind(target,key),adaptPalette:bind,advance,setMode,
      contains:(group,target)=>!!(active&&portal&&!portal.hidden&&group?.contains(active.element)&&(target?portal.contains(target):portal.matches(':hover'))),
      getState:key=>entries.has(key)?state(entries.get(key)):null,
      setWriter:(key,writer)=>{entry(key).writer=writer;},manual,
      refresh:()=>entries.forEach(e=>paint(e,false)),
      destroy:()=>{if(destroyed)return;destroyed=true;hide();portal?.remove();listeners.forEach(off=>off());entries.clear();}
    };
  }
  window.MayatnikColourAuto=Object.assign(create(),{create});
})();
