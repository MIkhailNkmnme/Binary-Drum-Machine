/* Hub v0.193: exclusive menus, pinned groups and persistent promoted controls. */
(() => {
  'use strict';
  function initSidebar() {
    const menu=document.querySelector('.hub'),logo=document.getElementById('hubLogo');if(!menu||document.getElementById('hubSidebarToggle'))return;
    menu.id=menu.id||'hubSidebarMenu';
    let collapsed=false;try{collapsed=localStorage.getItem('zerk_hub_sidebar_collapsed')==='true';}catch(_){}
    const desktop=matchMedia('(min-width:1101px)'),toggle=document.createElement('button');
    toggle.id='hubSidebarToggle';toggle.type='button';toggle.setAttribute('aria-controls',menu.id);document.body.append(toggle);
    const sync=()=>{
      const hidden=desktop.matches&&collapsed;document.body.classList.toggle('hubSidebarCollapsed',hidden);
      menu.inert=hidden;menu.setAttribute('aria-hidden',String(hidden));if(logo){logo.inert=hidden;logo.setAttribute('aria-hidden',String(hidden));}
      toggle.textContent=hidden?'»':'«';toggle.setAttribute('aria-expanded',String(!hidden));
      toggle.title=hidden?'Развернуть левое меню':'Свернуть левое меню в полоску';toggle.setAttribute('aria-label',toggle.title);
    };
    toggle.onclick=()=>{collapsed=!collapsed;try{localStorage.setItem('zerk_hub_sidebar_collapsed',String(collapsed));}catch(_){}sync();};
    desktop.addEventListener('change',sync);sync();
  }
  function initZen() {
    if(document.getElementById('hubZenToggle'))return;
    const toggle=document.createElement('button');toggle.id='hubZenToggle';toggle.type='button';toggle.className='hubRhomb';toggle.textContent='Q\nДзен';toggle.setAttribute('aria-keyshortcuts','Q');toggle.setAttribute('aria-pressed','false');toggle.setAttribute('aria-label','Дзен-режим — Q');toggle.title='Дзен-режим — Q';document.body.append(toggle);
    let zen=false,previousScroll=0;
    const set=on=>{zen=on;document.body.classList.toggle('hubZen',zen);toggle.setAttribute('aria-pressed',String(zen));toggle.textContent=zen?'Q\nМеню':'Q\nДзен';toggle.title=zen?'Вернуть меню — Q или Escape':'Дзен-режим — Q';toggle.setAttribute('aria-label',toggle.title);if(zen){previousScroll=scrollY;if(matchMedia('(max-width:1100px)').matches)window.scrollTo(0,0);}else if(matchMedia('(max-width:1100px)').matches)window.scrollTo(0,previousScroll);toggle.focus({preventScroll:true});};
    toggle.onclick=()=>set(!zen);
    document.addEventListener('keydown',e=>{if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,textarea,select,[contenteditable]:not([contenteditable=false])'))return;if(e.code==='KeyQ'||e.key.toLowerCase()==='q'){e.preventDefault();set(!zen);}else if(zen&&e.key==='Escape'){e.preventDefault();set(false);}});
  }
  function init() {
    initSidebar();initZen();
    const toolbar = document.getElementById('hubFieldTools');
    if (!toolbar || toolbar.dataset.grouped) return;
    toolbar.dataset.grouped = 'true';
    // These actions already have controls in the field / in the 3D group.
    toolbar.querySelector('.hubViewRotationControl')?.remove();
    document.getElementById('hub3DQuick')?.remove();
    const items = [...toolbar.children];
    let saved = {};try { saved = JSON.parse(localStorage.getItem('zerk_hub_pins') || '{}') || {}; } catch (_) {}
    const pinnedGroups = new Set(Array.isArray(saved.groups) ? saved.groups : []);
    const renamedPins = {
      'flow|А — свет сверху: включить / выключить':'flow|А — свет: включить / выключить',
      'flow|Б — вода сверху: включить / выключить':'flow|Б — мокрый снег сверху: включить / выключить',
      'flow|Очистить свет и воду, остановить потоки':'flow|Очистить свет, снег и воду, остановить потоки'
    };
    const pinnedControls = new Set((Array.isArray(saved.controls) ? saved.controls : []).map(key=>renamedPins[key]||key));
    const records = new Map();
    const persist = () => {try { localStorage.setItem('zerk_hub_pins', JSON.stringify({groups:[...pinnedGroups],controls:[...pinnedControls]})); } catch (_) {}};
    const closeOthers = except => {
      for (const box of toolbar.querySelectorAll('details[open]')) {
        if (box === except || box.contains(except) || box.closest('[data-group-pinned=true]')) continue;
        box.open = false;
      }
    };
    const fitMenus = () => {
      for(const box of toolbar.querySelectorAll('.hubFieldGroup,.hubPinnedControl')){
        const x=box.getBoundingClientRect().left,width=box.classList.contains('hubPinnedControl')?180:204;
        box.style.setProperty('--menu-left',Math.max(8-x,Math.min(0,innerWidth-8-x-width))+'px');
      }
    };
    const open = box => {closeOthers(box);box.open = true;fitMenus();};
    const slotFor = box => {const slot=document.createElement('div');slot.className='hubFieldSlot';box.before(slot);slot.append(box);return slot;};
    const refresh = () => {toolbar.dataset.hasPins = String(pinnedGroups.size + pinnedControls.size > 0);requestAnimationFrame(fitMenus);};
    const bindGroup = (box,key,slot) => {
      const head=box.querySelector(':scope > summary');
      box.dataset.pinGroup=key;
      const update=()=>{box.dataset.groupPinned=String(pinnedGroups.has(key));if(pinnedGroups.has(key))box.open=true;refresh();};
      head.title += ' · ПКМ — закрепить / открепить группу';
      head.addEventListener('contextmenu', e=>{e.preventDefault();e.stopPropagation();if(pinnedGroups.has(key))pinnedGroups.delete(key);else pinnedGroups.add(key);update();persist();});
      update();return {box,key,slot};
    };
    const groups = [
      ['bits', '01', 'Биты'], ['symmetry', '∥', 'Симм.'],
      ['axis', '↗', 'Ось'], ['space', '3D', 'Объём'], ['file', '▧', 'Файл'], ['flow', '↓', 'Поток']
    ].map(([key, icon, name]) => {
      const box = document.createElement('details'); box.className = 'hubFieldGroup'; box.dataset.group = key;
      const head = document.createElement('summary'); head.className = 'hubRhomb';
      head.setAttribute('aria-label', 'Группа: ' + name); head.title = name;
      const mark = document.createElement('b'), caption = document.createElement('small');
      mark.textContent = icon; caption.textContent = name; head.append(mark, caption);
      const body = document.createElement('div'); body.className = 'hubFieldGroupBody';
      body.setAttribute('role', 'group'); body.setAttribute('aria-label', name);
      box.append(head, body); toolbar.append(box);
      box.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') open(box); });
      box.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch' && !pinnedGroups.has(key) && !box.contains(document.activeElement)) box.open = false; });
      head.addEventListener('click', e => {e.preventDefault();if(e.pointerType !== 'mouse' && box.open && !pinnedGroups.has(key))box.open=false;else open(box);});
      const slot=slotFor(box);bindGroup(box,key,slot);
      return { key, box, body, slot };
    });
    const body = key => groups.find(g => g.key === key).body;
    for (const item of items) {
      const label = item.getAttribute('aria-label') || item.title || '';
      let key = 'bits';
      if (item.matches('.hubFlowControls')) key = 'flow';
      else if (item.matches('.hubBitSymmetry,.hubSymmetryMinimum') || label.includes('Симметрия параллельно')) key = 'symmetry';
      else if (item.matches('.hubImageTools')) key = 'file';
      else if (item.matches('.hubFlipControl,.hubFlipPlanes,.hubAutoZoomControl')) key = 'space';
      else if (item.matches('.hubMirrorSpinControl,.hubAxisScreenPin,.hubCenterBitPin') || /Зеркало|Заворот|Магнит оси|Вращать ось|перетаскивание холста/.test(label)) key = 'axis';
      body(key).append(item);
    }
    // Composite wrappers keep their event handlers; their buttons join the same grid.
    toolbar.querySelectorAll('.hubFlipPlanes,.hubImageTools,.hubFlowControls').forEach(el => el.classList.add('hubFieldContents'));
    // Keep original DOM nodes and their listeners; placeholders restore the exact old position.
    const registerControls = (owner, container) => {
      for (const node of container.querySelectorAll('button.hubRhomb,label.hubRhomb,details.hubTilt')) {
        if(node.closest('details.hubTilt') && node.closest('details.hubTilt') !== node && !node.dataset.view)continue;
        const label=node.id || node.getAttribute('aria-label') || node.querySelector('[aria-label]')?.getAttribute('aria-label') || node.title || node.querySelector('summary')?.title;
        if(!label)continue;
        const key=owner.key+'|'+label,placeholder=document.createComment('pin: '+key);
        node.before(placeholder);node.dataset.pinControl=key;
        const tip=node.matches('details')?node.querySelector('summary'):node;
        tip.title += ' · ПКМ — вынести к заголовку / вернуть в группу';
        records.set(key,{node,placeholder,owner});
      }
    };
    for(const group of groups)registerControls(group,group.body);
    const view=document.querySelector('.hubBitView'),packing=document.getElementById('hubBitPacking');
    if(view){
      toolbar.append(view);const slot=slotFor(view),owner=bindGroup(view,'view',slot);
      registerControls(owner,view.querySelector('.hubBitViewOptions'));
      view.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')open(view);});
      view.querySelector(':scope > summary').addEventListener('click',()=>closeOthers(view));
    }
    if(packing)toolbar.append(packing);
    function promote(key,on){
      const record=records.get(key);if(!record)return;
      const {node,placeholder,owner}=record;
      if(on){
        pinnedControls.add(key);node.dataset.controlPinned='true';
        const wrap=document.createElement('div');wrap.className='hubPinnedControl';wrap.append(node);owner.slot.append(wrap);record.wrap=wrap;
      }else{
        pinnedControls.delete(key);delete node.dataset.controlPinned;placeholder.after(node);record.wrap?.remove();record.wrap=null;
      }
      refresh();
    }
    for(const key of [...pinnedControls])if(records.has(key))promote(key,true);else pinnedControls.delete(key);
    toolbar.addEventListener('contextmenu',e=>{
      const node=e.target.closest('[data-pin-control]');if(!node)return;
      e.preventDefault();e.stopPropagation();promote(node.dataset.pinControl,!pinnedControls.has(node.dataset.pinControl));persist();
    });
    // toggle also catches keyboard/native disclosure and nested sliders.
    toolbar.addEventListener('toggle',e=>{if(e.target.open){closeOthers(e.target);fitMenus();}else if(e.target.dataset.groupPinned==='true')e.target.open=true;},true);
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeOthers(null);});
    document.addEventListener('pointerdown',e=>{if(!toolbar.contains(e.target))closeOthers(null);},true);
    window.addEventListener('resize',fitMenus);
    refresh();

  }
  // Existing modules populate the toolbar during DOMContentLoaded.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0), { once: true });
  else setTimeout(init, 0);
})();
