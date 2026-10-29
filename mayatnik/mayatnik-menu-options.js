/* Standard button options with permanent semantic list titles. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikMenuOptions=api;})(globalThis,function(root){
  'use strict';
  const SIZE=120,HEIGHT=24,STEP=26,SINGLE_STEP=STEP,HEADER=26,FOOT=14;
  function slot(index){return {row:index+1,column:1};}
  function geometry(count){count=Math.max(1,Math.floor(Number(count)||1));
    return {count,cols:1,rows:count,step:STEP,chainWidth:SIZE,chainHeight:HEIGHT+(count-1)*STEP,gridTemplateColumns:SIZE+'px',gridTemplateRows:'repeat('+count+','+HEIGHT+'px)'};
  }
  function layout(count,owner,column,right,height){
    const width=Math.min(SIZE,Math.max(1,right-8)),maxHeight=Math.max(HEADER+FOOT+HEIGHT,Math.floor(height-28)),g=geometry(count);
    const contentHeight=g.chainHeight+HEADER+FOOT,h=Math.min(contentHeight,maxHeight);
    const side=column.right+6+width<=right-4?'right':column.left-width-6>=4?'left':right-column.right>=column.left?'right':'left';
    const x=side==='right'?column.right+6:column.left-width-6;
    return {...g,side,width,left:Math.max(4,Math.min(x,right-width-4)),top:Math.max(14,Math.min(owner.top,height-h-14)),maxHeight,scroll:contentHeight>maxHeight,scrollX:width<SIZE};
  }
  function options(owner){return owner.gzList?.options?.()||[];}
  const STORAGE_KEY='mayatnik-list-exclusions-v1',bound=new WeakSet(),rowsByOwner=new WeakMap();
  let excluded=new Map();
  try{const data=JSON.parse(root.localStorage?.getItem(STORAGE_KEY)||'[]');if(Array.isArray(data))for(const pair of data)if(Array.isArray(pair)&&typeof pair[0]==='string'&&Array.isArray(pair[1]))excluded.set(pair[0],new Set(pair[1].filter(k=>typeof k==='string')));}catch(_){}
  function ownerKey(owner){
    const explicit=owner.gzList?.key??owner.dataset.optionOwner??owner.dataset.n??owner.id;
    if(explicit)return String(explicit);
    const group=owner.closest('[data-id],.pt-g'),scope=group?.dataset.id||group?.dataset.k||group?.id||'';
    return scope+':'+String(owner.dataset.listTitle||owner.querySelector('.gz-nm')?.textContent?.trim()||owner.title||'');
  }
  function optionKey(option){const value=option?.key??option?.id??option?.v??option?.value;return value!=null?'value:'+String(value):'name:'+String(option?.name||'');}
  function isExcluded(owner,option){return !!excluded.get(ownerKey(owner))?.has(optionKey(option));}
  function saveExcluded(){try{root.localStorage?.setItem(STORAGE_KEY,JSON.stringify([...excluded].map(([key,set])=>[key,[...set]])));}catch(_){} }
  function syncExcluded(owner){const opts=options(owner);for(const row of rowsByOwner.get(owner)||[]){const option=opts.find(o=>optionKey(o)===row.dataset.optionKey),off=!!option&&isExcluded(owner,option);row.classList.toggle('may-option-excluded',off);row.setAttribute('aria-disabled',String(off));}}
  function toggle(owner,option){const key=ownerKey(owner),token=optionKey(option),set=excluded.get(key)||new Set();if(set.has(token))set.delete(token);else set.add(token);if(set.size)excluded.set(key,set);else excluded.delete(key);saveExcluded();
    for(const other of root.document?.querySelectorAll('.gz-lst')||[])if(ownerKey(other)===key)syncExcluded(other);syncExcluded(owner);return set.has(token);
  }
  function nextIndex(opts,current,direction,skip){for(let step=1;step<=opts.length;step++){const index=((current<0?(direction<0?0:-1):current)+step*(direction<0?-1:1)+opts.length*2)%opts.length;if(!skip(opts[index]))return index;}return -1;}
  function cycle(owner,direction=1){const opts=options(owner),current=opts.findIndex(o=>o.on),index=nextIndex(opts,current,direction,o=>isExcluded(owner,o)||o.disabled===true);if(index<0||index===current)return false;opts[index].pick?.();owner.gzList.after?.();syncOwner(owner);return true;}
  function install(owner){if(!owner?.gzList||bound.has(owner))return;bound.add(owner);
    const intercept=(event,direction)=>{if(owner.disabled||owner.getAttribute('aria-disabled')==='true'||owner.classList.contains('gz-off-dis')||event.target.closest?.('.may-view-swatch,input,select,textarea,[contenteditable]'))return;if(!options(owner).some(o=>isExcluded(owner,o)))return;event.preventDefault();event.stopImmediatePropagation();cycle(owner,direction);};
    owner.addEventListener('click',event=>{if(event.button&&event.button!==0)return;intercept(event,1);},true);
    owner.addEventListener('wheel',event=>{if(!event.deltaY&&!event.deltaX)return;intercept(event,(event.deltaY||event.deltaX)>0?1:-1);},{capture:true,passive:false});
    // The page's document capture retains whole-button context folding.
    owner.addEventListener('contextmenu',event=>intercept(event,-1),true);
  }
  function caption(owner){
    const title=owner.dataset.listTitle||'Варианты',item=options(owner).find(o=>o.on),label=owner.querySelector(':scope > .may-list-label');
    if(label&&label.dataset.optionCaption!==title){label.dataset.optionCaption=title;label.textContent=title;}
    // Only option rows contain user layer names; the owner is always «Слои».
    if(label&&owner.dataset.n==='layerSelect')delete label.dataset.userLabel;
    const aria=title+(item?.name?': '+item.name:'');if(owner.getAttribute?.('aria-label')!==aria)owner.setAttribute('aria-label',aria);
  }
  function restore(owner){if(owner)caption(owner);}
  function syncOwner(owner){caption(owner);}
  function glyph(name,index){
    if(/выкл/i.test(name))return '○';if(/левая|лево/i.test(name))return '◀';if(/правая|право/i.test(name))return '▶';if(/обе/i.test(name))return '◈';
    if(/шахм/i.test(name))return '▦';if(/цвет|краск/i.test(name))return '◒';if(/оригинал/i.test(name))return '◇';if(/налож/i.test(name))return '▱';
    return (String(name).match(/[\p{L}\p{N}]+/u)?.[0]||String(index+1)).slice(0,2);
  }
  function decorate(list,owner){
    install(owner);list.classList.remove('may-diamond-options');list.classList.add('may-button-options');const opts=options(owner),rows=[...list.querySelectorAll(':scope > .gz-hx')],g=geometry(rows.length);list.style.gridTemplateColumns=g.gridTemplateColumns;list.style.gridTemplateRows=g.gridTemplateRows;
    rows.forEach((row,index)=>{const name=String(opts[index]?.name||row.title||row.querySelector('.gz-nm')?.textContent||index+1);
      const cell=slot(index,g.cols);row.style.gridRow=String(cell.row);row.style.gridColumn=String(cell.column);
      row.dataset.optionKey=optionKey(opts[index]);
      row.classList.remove('may-option-diamond');row.classList.add('may-option-button');row.dataset.noMini='';row.setAttribute('aria-label',name);row.title=name;
      let label=row.querySelector(':scope > .gz-nm');if(!label){label=document.createElement('span');label.className='gz-nm';label.textContent=name;row.append(label);}
      if(owner.dataset.n==='layerSelect')label.setAttribute('data-user-label','');
      if(!row.dataset.mayOptionReady){row.dataset.mayOptionReady='1';row.setAttribute('role','button');row.setAttribute('tabindex','0');
        const palette=target=>target.closest?.('.may-view-swatch,input,select,textarea,[contenteditable]');
        row.addEventListener('contextmenu',event=>{if(palette(event.target))return;event.preventDefault();event.stopImmediatePropagation();const option=options(owner).find(o=>optionKey(o)===row.dataset.optionKey);if(option)toggle(owner,option);},true);
        row.addEventListener('click',event=>{if(!row.classList.contains('may-option-excluded'))return;const option=options(owner).find(o=>optionKey(o)===row.dataset.optionKey);if(palette(event.target)&&option?.on)return;event.preventDefault();event.stopImmediatePropagation();},true);
        row.addEventListener('keydown',e=>{if(e.target===row&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.stopPropagation();row.click();}});
      }
      const icon=row.querySelector('.gz-ic'),font=owner.dataset.n==='fontCycle';
      if(icon&&row.classList.contains('may-view-palette'))icon.style.setProperty('display','none','important');
      if(font||!icon||!icon.children.length&&!icon.style.backgroundImage&&(!icon.textContent?.trim()||icon.textContent.trim()==='·')){
        let symbol=row.querySelector(':scope > .may-option-symbol');if(!symbol){symbol=document.createElement('span');symbol.className='may-option-symbol';row.append(symbol);}
        row.classList.add('may-option-fallback');const text=font?'Aa':glyph(name,index);if(symbol.textContent!==text)symbol.textContent=text;
        if(font){const families=["var(--mono,monospace)","Consolas,'Cascadia Mono',monospace","'Courier New',Courier,monospace","'Segoe UI',Arial,sans-serif","Georgia,'Times New Roman',serif"];symbol.style.fontFamily=families[index]||'monospace';}
      }
    });
    rowsByOwner.set(owner,rows);syncExcluded(owner);syncOwner(owner);
  }
  return {STORAGE_KEY,ownerKey,optionKey,isExcluded,toggle,nextIndex,cycle,install,SIZE,HEIGHT,STEP,SINGLE_STEP,slot,geometry,layout,decorate,caption,syncOwner,restore,glyph};
});
