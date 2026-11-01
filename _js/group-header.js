/* Shared group header view v2. Controllers own opening, persistence and dragging. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ZerkGroupHeader=api;})(globalThis,function(){
  'use strict';
  const PIN='M10.5 1.5l4 4-1.6.4-2.6 2.6.3 3.2-1.4 1.4-2.5-2.5-4 4-.7-.7 4-4L3.5 7.4l1.4-1.4 3.2.3 2.6-2.6z';
  const views=new WeakMap();
  const set=(node,key,value)=>{value=String(value);if(node.getAttribute(key)!==value)node.setAttribute(key,value);};
  function create(options={}){
    const doc=options.document||document;
    const make=(tag,classes)=>{const n=doc.createElement(tag);n.className=classes;return n;};
    const head=make('div','zgh-head '+(options.className||''));head.setAttribute('role','button');head.tabIndex=0;
    const title=make('span','zgh-title '+(options.titleClass||''));title.textContent=options.title||'';
    const pin=make('span','zgh-pin '+(options.pinClass||''));pin.setAttribute('role','button');pin.tabIndex=0;
    const icon=make('span','zgh-icon '+(options.iconClass||''));icon.textContent=options.icon||'';icon.setAttribute('aria-hidden','true');
    const arrow=make('span','zgh-arrow '+(options.arrowClass||''));arrow.hidden=true;arrow.setAttribute('aria-hidden','true');
    const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg'),path=doc.createElementNS(svg.namespaceURI,'path');svg.setAttribute('viewBox','0 0 16 16');svg.setAttribute('aria-hidden','true');path.setAttribute('d',PIN);svg.append(path);pin.append(svg);
    // All view variants have the same direct children, without a rail-only wrapper.
    head.append(title,pin,icon,arrow);const pins=[pin];
    if(options.dualPins){
      head.classList.add('zgh-dual-pin');pin.classList.add('zgh-pin-right');
      path.setAttribute('d','M1 12 12 1 19 17Z');svg.setAttribute('viewBox','0 0 22 20');
      const left=pin.cloneNode(true);left.classList.remove('zgh-pin-right');left.classList.add('zgh-pin-left');head.append(left);pins.push(left);
      left.addEventListener('pointerdown',e=>e.stopPropagation());
      left.addEventListener('click',e=>{e.stopPropagation();pin.click();});
      left.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();if(!e.repeat)pin.click();}});
      left.addEventListener('keyup',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();}});
      head.addEventListener('dblclick',e=>{e.preventDefault();e.stopPropagation();if(!e.target.closest('.zgh-pin')&&!head.dataset.dragged)pin.click();});
    }
    const view={head,title,pin,pins,icon,arrow,sync:state=>sync(head,state)};views.set(head,view);
    pin.addEventListener('pointerdown',e=>e.stopPropagation());
    pin.addEventListener('click',e=>{e.stopPropagation();options.onPin?.(e);});
    pin.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();if(!e.repeat)pin.click();}});
    pin.addEventListener('keyup',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();}});
    head.addEventListener('keydown',e=>{if(!head.onkeydown&&e.target===head&&(e.key==='Enter'||e.key===' ')){e.preventDefault();if(!e.repeat)head.click();}});
    if(options.onToggle)head.addEventListener('click',options.onToggle);
    sync(head,{pinned:false,mini:false,open:false});return view;
  }
  function sync(head,state={}){
    const view=views.get(head);if(!view)return;
    if('pinned' in state){const on=!!state.pinned;const label=on?'Открепить: разрешить закрытие списка':'Закрепить: список остаётся открытым';for(const pin of view.pins){set(pin,'aria-pressed',on);set(pin,'aria-label',label);if(pin.title!==label)pin.title=label;}}
    if('open' in state)set(head,'aria-expanded',!!state.open);
    if('mini' in state){head.classList.toggle('zgh-mini',!!state.mini);for(const pin of view.pins)pin.tabIndex=state.mini?-1:0;}
  }
  function parts(head){return views.get(head)||null;}
  return {version:2,create,sync,parts};
});
