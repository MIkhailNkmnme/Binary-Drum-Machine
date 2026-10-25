/* Opt-in group opening sequence. Opacity only: layout and bevel geometry stay unchanged. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ZerkGroupReveal=api;})(globalThis,function(){
 'use strict';
 const defaults={groups:'.pt-g,.gz-group',header:':scope > .pt-l,:scope > .gz-head',content:':scope > .pt-r,:scope > .may-rail-list,:scope > .gz-soty,:scope > .gz-wide',cells:'.gz-pair,.gz-control,.pt-b,.gz-hx,label.may-slide,.zerk-range-wrap',duration:160,step:25,maxDelay:220};
 function plan(cells,header,options={}){
  const config={...defaults,...options},hy=header.top+header.height/2;
  const rows=cells.map((cell,index)=>({cell,index,rect:cell.getBoundingClientRect()})).filter(row=>row.rect.width>0&&row.rect.height>0);
  const up=rows.length>0&&rows.reduce((sum,row)=>sum+row.rect.top+row.rect.height/2-hy,0)<0;
  rows.sort((a,b)=>(up?b.rect.bottom-a.rect.bottom:a.rect.top-b.rect.top)||a.rect.left-b.rect.left||a.index-b.index);
  const step=Math.min(config.step,config.maxDelay/Math.max(1,rows.length-1));
  return rows.map((row,index)=>({...row,delay:index*step,direction:up?'up':'down'}));
 }
 function init(root,options={}){
  const config={...defaults,...options},doc=root.nodeType===9?root:root.ownerDocument,win=doc.defaultView;
  const states=new WeakMap(),jobs=new Map(),pending=new Map();let disconnected=false;
  const media=win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const isOpen=group=>group.matches('.pt-open,.gz-open');
  const groups=()=>[...root.querySelectorAll(config.groups)];
  function cancel(group){const frame=pending.get(group);if(frame!=null)win.cancelAnimationFrame(frame);pending.delete(group);for(const animation of jobs.get(group)||[])animation.cancel();jobs.delete(group);}
  function reveal(group){
   cancel(group);if(disconnected||media?.matches||!isOpen(group))return;
   const frame=win.requestAnimationFrame(()=>{pending.delete(group);if(disconnected||media?.matches||!group.isConnected||!isOpen(group))return;
    const header=group.querySelector(config.header);if(!header)return;
    const candidates=new Set();for(const host of group.querySelectorAll(config.content))for(const cell of host.querySelectorAll(config.cells)){const rect=cell.getBoundingClientRect();if(rect.width&&rect.height)candidates.add(cell);}
    const cells=[...candidates].filter(cell=>{for(let parent=cell.parentElement;parent&&parent!==group;parent=parent.parentElement)if(candidates.has(parent))return false;return true;});
    const animations=[];jobs.set(group,animations);
    for(const row of plan(cells,header.getBoundingClientRect(),config)){
     if(typeof row.cell.animate!=='function')continue;
     const opacity=win.getComputedStyle(row.cell).opacity||'1';
     const animation=row.cell.animate([{opacity:0},{opacity}],{duration:config.duration,delay:row.delay,easing:'ease-out',fill:'backwards'});animations.push(animation);
     animation.onfinish=()=>{const live=jobs.get(group);if(!live)return;const index=live.indexOf(animation);if(index>=0)live.splice(index,1);if(!live.length)jobs.delete(group);};
    }
    if(!animations.length)jobs.delete(group);
   });pending.set(group,frame);
  }
  function sync(){if(disconnected)return;const current=new Set(groups());
   for(const group of current){const on=isOpen(group),before=states.get(group);states.set(group,on);if(before===false&&on)reveal(group);else if(!on)cancel(group);}
   for(const group of new Set([...jobs.keys(),...pending.keys()]))if(!current.has(group))cancel(group);
  }
  // Restored open groups establish a baseline; only subsequent closed-to-open edges animate.
  for(const group of groups())states.set(group,isOpen(group));
  const observer=new win.MutationObserver(records=>{if(records.some(record=>record.type==='childList'||record.target.matches?.(config.groups)))sync();});
  observer.observe(root,{subtree:true,attributes:true,attributeFilter:['class'],childList:true});
  const reduce=()=>{if(media.matches)for(const group of new Set([...jobs.keys(),...pending.keys()]))cancel(group);};media?.addEventListener?.('change',reduce);
  return{disconnect(){disconnected=true;observer.disconnect();media?.removeEventListener?.('change',reduce);for(const group of new Set([...jobs.keys(),...pending.keys()]))cancel(group);},sync};
 }
 return{init,plan};
});
