/* Hub v0.193: exclusive menus, pinned groups and persistent promoted controls. */
(() => {
  'use strict';
  function init() {
    const toolbar = document.getElementById('hubFieldTools');
    if (!toolbar || toolbar.dataset.grouped) return;
    toolbar.dataset.grouped = 'true';
    // These actions already have controls in the field / in the 3D group.
    toolbar.querySelector('.hubViewRotationControl')?.remove();
    document.getElementById('hub3DQuick')?.remove();
    const items = [...toolbar.children];
    let saved = {};try { saved = JSON.parse(localStorage.getItem('zerk_hub_pins') || '{}') || {}; } catch (_) {}
    const pinnedGroups = new Set(Array.isArray(saved.groups) ? saved.groups : []);
    const pinnedControls = new Set(Array.isArray(saved.controls) ? saved.controls : []);
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
      else if (item.matches('.hubFlipControl,.hubFlipPlanes')) key = 'space';
      else if (item.matches('.hubMirrorSpinControl,.hubAxisScreenPin') || /Зеркало|Заворот|Магнит оси|Вращать ось|перетаскивание холста/.test(label)) key = 'axis';
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
