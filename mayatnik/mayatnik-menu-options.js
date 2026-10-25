/* Icon diamonds with stable list titles and a preview caption in the owner. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikMenuOptions=api;})(globalThis,function(){
  'use strict';
  const SIZE=48,STEP=50,HEADER=26,FOOT=14,hovered=new WeakMap();
  // Two down on the right, two down on the left, then the next pair of rows.
  function slot(index,cols=2){return cols===1?{row:index+1,column:1}:{row:Math.floor(index/4)*2+index%2+1,column:Math.floor(index/2)%2?1:2};}
  function layout(count,owner,column,right,height){
    count=Math.max(1,count);const maxRows=Math.max(1,Math.floor((height-28-HEADER-FOOT+2)/STEP));
    const width=Math.min(120,Math.max(48,right-8)),cols=count>2&&width>=110?2:1,rows=cols===1?count:Math.floor((count-1)/4)*2+Math.min(2,(count-1)%4+1),h=Math.min(rows,maxRows)*STEP-2+HEADER+FOOT;
    const side=column.right+6+width<=right-4?'right':column.left-width-6>=4?'left':right-column.right>=column.left?'right':'left';
    const x=side==='right'?column.right+6:column.left-width-6;
    return {side,rows,cols,width,left:Math.max(4,Math.min(x,right-width-4)),top:Math.max(14,Math.min(owner.top,height-h-14)),maxHeight:maxRows*STEP-2+HEADER+FOOT,scroll:rows>maxRows};
  }
  function options(owner){return owner.gzList?.options?.()||[];}
  function caption(owner,index){
    const opts=options(owner),selected=opts.findIndex(o=>o.on),item=opts[index??(selected<0?0:selected)],label=owner.querySelector(':scope > .may-list-label');
    const name=String(item?.name||owner.dataset.listTitle||'Варианты');if(label&&label.dataset.optionCaption!==name){label.dataset.optionCaption=name;label.textContent=name;}
    if(label&&owner.dataset.n==='layerSelect')label.setAttribute('data-user-label','');
    const aria=(owner.dataset.listTitle||'Варианты')+': '+name;if(owner.getAttribute?.('aria-label')!==aria)owner.setAttribute('aria-label',aria);
  }
  function restore(owner){if(!owner)return;hovered.delete(owner);caption(owner);}
  function syncOwner(owner){const h=hovered.get(owner);if(h?.list.isConnected)caption(owner,h.index);else{hovered.delete(owner);caption(owner);}}
  function glyph(name,index){
    if(/выкл/i.test(name))return '○';if(/левая|лево/i.test(name))return '◀';if(/правая|право/i.test(name))return '▶';if(/обе/i.test(name))return '◈';
    if(/шахм/i.test(name))return '▦';if(/цвет|краск/i.test(name))return '◒';if(/оригинал/i.test(name))return '◇';if(/налож/i.test(name))return '▱';
    return (String(name).match(/[\p{L}\p{N}]+/u)?.[0]||String(index+1)).slice(0,2);
  }
  function decorate(list,owner){
    list.classList.add('may-diamond-options');const opts=options(owner),rows=[...list.querySelectorAll(':scope > .gz-hx')];
    rows.forEach((row,index)=>{const name=String(opts[index]?.name||row.title||row.querySelector('.gz-nm')?.textContent||index+1);
      const cell=slot(index,+list.dataset.optionColumns||(rows.length>2?2:1));row.style.gridRow=String(cell.row);row.style.gridColumn=String(cell.column);
      row.classList.add('may-option-diamond');row.dataset.noMini='';row.setAttribute('aria-label',name);row.title=name;
      if(!row.dataset.mayOptionReady){row.dataset.mayOptionReady='1';row.setAttribute('role','button');row.setAttribute('tabindex','0');
        row.addEventListener('keydown',e=>{if(e.target===row&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.stopPropagation();row.click();}});
        row.addEventListener('pointerenter',()=>{hovered.set(owner,{list,index});caption(owner,index);});
        row.addEventListener('focusin',()=>{hovered.set(owner,{list,index});caption(owner,index);});
        row.addEventListener('pointerleave',()=>restore(owner));row.addEventListener('focusout',()=>restore(owner));
      }
      const icon=row.querySelector('.gz-ic'),font=owner.dataset.n==='fontCycle';
      if(icon&&row.classList.contains('may-view-palette'))icon.style.removeProperty('display');
      if(font||!icon||!icon.children.length&&!icon.style.backgroundImage&&(!icon.textContent?.trim()||icon.textContent.trim()==='·')){
        let symbol=row.querySelector(':scope > .may-option-symbol');if(!symbol){symbol=document.createElement('span');symbol.className='may-option-symbol';row.append(symbol);}
        row.classList.add('may-option-fallback');const text=font?'Aa':glyph(name,index);if(symbol.textContent!==text)symbol.textContent=text;
        if(font){const families=["var(--mono,monospace)","Consolas,'Cascadia Mono',monospace","'Courier New',Courier,monospace","'Segoe UI',Arial,sans-serif","Georgia,'Times New Roman',serif"];symbol.style.fontFamily=families[index]||'monospace';}
      }
    });
    if(!list.dataset.mayOptionReady){list.dataset.mayOptionReady='1';list.addEventListener('pointerleave',()=>restore(owner));}
    syncOwner(owner);
  }
  return {SIZE,STEP,slot,layout,decorate,caption,syncOwner,restore,glyph};
});
