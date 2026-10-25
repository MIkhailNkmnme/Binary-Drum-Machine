/* Сетки: адаптер живых исходных контролов к общему меню Маятника. */
(() => {
  'use strict';
  const mount = () => {
    const source = document.getElementById('gridsToolbar'), host = document.getElementById('mayatnikRail');
    if (!source || !host || !window.ZerkGrozd || !window.ZerkGroupHeader || host.dataset.setkaMenu) return;
    host.dataset.setkaMenu = '1';
    const bindings = [], lists = [];
    let rail, dock, refreshing = false, pending = 0;
    const placePopups = () => {
      for(const group of rail.el.querySelectorAll(':scope > .gz-group')){
        const body=group.querySelector('.setka-menu-body');if(!body||!group.classList.contains('gz-open'))continue;
        const h=group.querySelector('.gz-head').getBoundingClientRect(),edge=group.dataset.dockEdge||'top';
        const width=120,gap=3,below=innerHeight-h.bottom-8,above=h.top-8;
        let x=h.left,y=h.bottom+gap,max=below;
        if(edge==='bottom'){max=above;y=Math.max(4,h.top-gap-Math.min(body.scrollHeight,max));}
        const set=(k,v)=>{const property=k==='maxHeight'?'max-height':k;if(body.style.getPropertyValue(property)!==v)body.style.setProperty(property,v,'important');};
        set('left',Math.max(4,Math.min(x,innerWidth-width-4))+'px');set('top',Math.max(4,y)+'px');set('maxHeight',Math.max(24,max)+'px');
      }
    };
    const label = e => e.textContent.trim() || e.getAttribute('aria-label') || e.title || e.id;
    const tip = e => e.title || e.getAttribute('aria-label') || e.closest('label')?.title || label(e);
    const inactive = e => e.disabled || e.getAttribute('aria-disabled') === 'true';
    const hidden = e => {
      for (let p = e; p && p !== source; p = p.parentElement) if (p.hidden || p.style.display === 'none') return true;
      return false;
    };
    const fire = e => { e.dispatchEvent(new Event('input', {bubbles:true})); e.dispatchEvent(new Event('change', {bubbles:true})); };
    const request = () => { if (!pending) pending = requestAnimationFrame(() => { pending = 0; refresh(); }); };
    const proxy = e => {
      const binding = {source:e, key:'setka-' + bindings.length};
      bindings.push(binding);
      const base = {name:label(e), tip:tip(e), pan:binding.key, col:0, disabled:()=>inactive(e)};
      if (e.tagName === 'BUTTON') return {...base, type:'toggle', nameNow:()=>label(e),
        on:()=>e.matches('.on,[aria-pressed="true"]'), click:()=>{if(!inactive(e)){e.click();request();}}};
      if (e.tagName === 'SELECT') {
        const item = {...base, type:'list', name:e.getAttribute('aria-label') || e.title || 'Выбор', options:[], get:()=>e.value,
          set:v=>{if(!inactive(e)&&![...e.options].find(o=>o.value===v)?.disabled){e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}));request();}}};
        binding.item = item; lists.push(binding);
        item.options = [...e.options].map(o=>({v:o.value,name:o.textContent}));
        return item;
      }
      if (e.type === 'color') return {...base,type:'color',name:e.closest('label')?.textContent.trim() || 'Цвет',get:()=>e.value,
        set:v=>{if(!inactive(e)){e.value=v;fire(e);request();}}};
      // A native editable clone keeps number/range/text input semantics; the original owns all page handlers.
      const field=e.cloneNode(true), wrap=document.createElement('label');
      field.removeAttribute('id'); field.removeAttribute('name'); field.removeAttribute('oninput'); field.removeAttribute('onchange');
      field.title=tip(e);field.setAttribute('aria-label',tip(e));
      const caption=e.closest('label')?.textContent.trim();if(caption)wrap.append(document.createTextNode(caption+' '));
      wrap.append(field);binding.field=field;
      for(const type of ['input','change'])field.addEventListener(type,()=>{if(inactive(e))return;e.value=field.value;e.checked=field.checked;e.dispatchEvent(new Event(type,{bubbles:true}));request();});
      return {...base,type:'control',node:wrap};
    };
    const groups=[...source.querySelectorAll('.grids-toolgroup')].map(g=>({
      id:g.dataset.gridGroup,title:g.querySelector('.grids-toolheading').textContent.trim(),
      color:g.style.getPropertyValue('--grid-group-color').trim() || '#71c5ff',
      items:[...g.querySelectorAll('button,input,select,textarea')].filter(e=>e.id!=='bRmbSettings').map(proxy)
    }));
    rail=ZerkGrozd.rail(host,{key:'setka',groups,oneCol:true,onToggle:request,
      headerFactory:g=>ZerkGroupHeader.create({title:g.title,className:'gz-hx gz-head',titleClass:'gz-nm',pinClass:'gz-pin',iconClass:'gz-mico',arrowClass:'gz-ar'})});
    for(const binding of bindings){
      binding.node=rail.el.querySelector('[data-pan="'+binding.key+'"]');
      binding.node.dataset.source=binding.source.id || binding.key;
      binding.node.title=tip(binding.source);
      binding.node.addEventListener('click',e=>{if(inactive(binding.source)){e.preventDefault();e.stopImmediatePropagation();}},true);
      if(binding.node.gzList){binding.node.gzList.col=()=>binding.node.closest('.setka-menu-body');delete binding.node.gzList.placement;}
    }
    // Keep original order in one scrollable column, including controls originally in the wide container.
    for(const group of rail.el.querySelectorAll(':scope > .gz-group')){
      const body=document.createElement('div');body.className='may-rail-list setka-menu-body';
      for(const b of bindings)if(b.node.closest('.gz-group')===group)body.append(b.node);
      group.querySelectorAll(':scope > .gz-soty,:scope > .gz-wide').forEach(e=>e.remove());group.append(body);
    }
    function refresh(){
      if(refreshing)return;refreshing=true;
      try{
        for(const b of lists)b.item.options=[...b.source.options].filter(o=>!o.hidden).map(o=>({v:o.value,name:o.textContent}));
        rail.refresh();
        for(const b of bindings){
          const e=b.source,n=b.node,off=inactive(e);n.hidden=hidden(e);n.classList.toggle('gz-off-dis',off);
          n.setAttribute('aria-disabled',String(off));n.title=tip(e);n.setAttribute('aria-label',tip(e));
          if(n.getAttribute('role')==='button')n.setAttribute('aria-pressed',String(e.matches('.on,[aria-pressed="true"]')));
          if(b.field){b.field.disabled=off;if(document.activeElement!==b.field)b.field.value=e.value;b.field.checked=e.checked;}
          const color=n.querySelector('input[type=color]');if(color)color.disabled=off;
        }
        for(const button of document.querySelectorAll('#pageUndo,#pageRedo,#pageHelp,#gridsRowsPane .tools button,#gridsRowsLock,#rmbTouchActions button,#rmbTextStats button:not([data-rmb-letter])')){
          button.classList.add('gz-hx','setka-direct');
          button.classList.toggle('gz-on',button.matches('.on,[aria-pressed="true"]'));
          button.classList.toggle('gz-off-dis',button.disabled);
          if(!button.querySelector(':scope > .gz-nm')){const name=document.createElement('span');name.className='gz-nm';name.textContent=button.textContent;button.replaceChildren(name);}
        }
        dock?.refresh();placePopups();window.mayButtonStandardRefresh?.();
      }finally{refreshing=false;}
    }
    window.setkaMenuRefresh=request;
    source.hidden=true;
    document.body.classList.add('mayatnik-menu-ready','setka-menu-ready');
    dock=window.MayatnikMenuDock?.mount({storageKey:'setka-menu-dock-v1',defaultEdge:'top',stackSides:false,
      groups:()=>[...rail.el.querySelectorAll(':scope > .gz-group')],idOf:g=>g.dataset.id,
      header:document.querySelector('.setka-title'),tools:host,footer:document.getElementById('setkaFooter'),rail:rail.el,leftEdge:()=>4,rightEdge:()=>innerWidth,
      moveToTools:()=>{},onLayout:()=>{placePopups();window.mayButtonStandardRefresh?.();}});
    host.addEventListener('scroll',placePopups,{passive:true});
    for(const head of rail.el.querySelectorAll('.gz-head'))head.style.touchAction='none';
    host.addEventListener('click',request);host.addEventListener('input',request);host.addEventListener('change',request);
    addEventListener('resize',request);
    refresh();
  };
  window.setkaMenuInit=mount;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
