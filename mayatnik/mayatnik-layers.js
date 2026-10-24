/* Маятник v0.490 · МАЯ-019. Display layers; field bits and source canvases are never edited. */
(function(root){
  'use strict';
  function tintPixels(bytes,hex){
    const out=new Uint8ClampedArray(bytes);if(!hex)return out;
    const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
    // Relative brightness: white becomes the chosen colour, zero stays black; alpha/empty cells stay intact.
    for(let i=0;i<out.length;i+=4){if(!out[i+3])continue;const y=(.2126*out[i]+.7152*out[i+1]+.0722*out[i+2])/255;
      for(let j=0;j<3;j++)out[i+j]=rgb[j]*y;
    }return out;
  }
  function create(options={}){
    const make=options.canvas||(()=>document.createElement('canvas')),items=new Map(),listeners=new Set();let selected=null,serial=0;
    let stored={};try{stored=options.load?.()||{};}catch(_){}
    const settings=d=>({visible:d.visible,opacity:d.opacity,tint:d.tint,x:d.x,y:d.y,order:d.order});
    const ready=i=>!!(i?.source&&i.rect&&i.enabled!==false);
    const desc=i=>i?{id:i.id,name:i.name,kind:i.kind,...settings(i),removable:i.removable,capturable:ready(i)}:null;
    const ordered=()=>[...items.values()].sort((a,b)=>a.order-b.order);
    const persist=()=>{const prefs={...stored};for(const i of items.values())if(i.kind!=='snapshot')prefs[i.id]=settings(i);stored=prefs;try{options.save?.(prefs);}catch(_){}};
    const notify=()=>{persist();for(const fn of listeners)fn();};
    function normalize(p={}){p=p||{};const q={};if(typeof p.visible==='boolean')q.visible=p.visible;if(Number.isFinite(p.opacity))q.opacity=Math.max(0,Math.min(100,p.opacity));
      if(p.tint===null||/^#[\da-f]{6}$/i.test(p.tint||''))q.tint=p.tint?.toLowerCase()||null;
      for(const k of ['x','y'])if(Number.isFinite(p[k]))q[k]=Math.max(-1e6,Math.min(1e6,p[k]));return q;}
    function draw(i){
      if(!i.node||!i.source||!i.rect)return;
      const c=i.node,r=i.rect,clip=options.viewport?.();
      if(i.dirty){c.width=i.source.width;c.height=i.source.height;const g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);g.imageSmoothingEnabled=false;g.drawImage(i.source,0,0);
        if(i.tint){const image=g.getImageData(0,0,c.width,c.height);image.data.set(tintPixels(image.data,i.tint));g.putImageData(image,0,0);}i.dirty=false;}
      const x=r.left+(i.geometryApplied?0:i.x),y=r.top+(i.geometryApplied?0:i.y);
      Object.assign(c.style,{position:'fixed',pointerEvents:'none',margin:'0',background:'transparent',imageRendering:'pixelated',left:x+'px',top:y+'px',width:r.width+'px',height:r.height+'px',opacity:String(i.opacity/100),display:i.visible&&i.enabled!==false?'':'none',zIndex:String(ordered().indexOf(i)+1)});
      c.style.clipPath=clip?'inset('+Math.max(0,clip.top-y)+'px '+Math.max(0,x+r.width-clip.left-clip.width)+'px '+Math.max(0,y+r.height-clip.top-clip.height)+'px '+Math.max(0,clip.left-x)+'px)':'';
    }
    function redraw(){for(const i of ordered())draw(i);}
    function add(id,meta={}){
      if(items.has(id)){const i=items.get(id);if(meta.name&&i.name!==meta.name){i.name=meta.name;notify();}return i;}
      const i={id,name:meta.name||id,kind:meta.kind||'snapshot',visible:true,opacity:100,tint:null,x:0,y:0,order:Math.max(-1,...[...items.values()].map(i=>i.order))+1,removable:meta.removable!==false,...normalize(meta)};
      if(i.kind!=='snapshot'){Object.assign(i,normalize(stored[id]||{}));if(Number.isFinite(stored[id]?.order))i.order=stored[id].order;}
      i.geometryApplied=!!meta.geometryApplied;i.node=make();i.node.width=0;i.node.height=0;i.node.style.display='none';i.node.className='may-layer-content';i.node.dataset&&(i.node.dataset.layerId=id);options.mount?.(i.node);items.set(id,i);if(!selected)selected=id;notify();return i;
    }
    const api={
      list:()=>ordered().map(desc),selected:()=>selected,get:(id=selected)=>desc(items.get(id)),
      select(id){if(!items.has(id))return null;if(selected!==id){selected=id;notify();}options.select?.(id);return desc(items.get(id));},
      set(id,patch){const i=items.get(id);if(!i)return null;const p=normalize(patch),before=desc(i);let changed=false;
        for(const k in p)if(i[k]!==p[k]){i[k]=p[k];changed=true;if(k==='tint')i.dirty=true;}
        if(changed){options.change?.(desc(i),before);draw(i);notify();}return desc(i);},
      move(id,delta){if(!Number.isFinite(delta))return false;const a=ordered(),n=a.findIndex(i=>i.id===id),j=Math.max(0,Math.min(a.length-1,n+Math.sign(delta)));if(n<0||n===j)return false;
        [a[n],a[j]]=[a[j],a[n]];a.forEach((i,k)=>i.order=k);redraw();notify();return true;},
      remove(id=selected){const i=items.get(id);if(!i||!i.removable)return false;items.delete(id);i.node?.remove?.();if(selected===id)selected=ordered()[0]?.id||null;options.remove?.(id,i.kind);redraw();notify();return true;},
      reset(id=selected){return api.set(id,{visible:true,opacity:100,tint:null,x:0,y:0});},
      capture(id=selected){const i=items.get(id);if(!i?.source||!i.rect||i.enabled===false)return null;
        const raw=make();raw.width=i.source.width;raw.height=i.source.height;raw.getContext('2d').drawImage(i.source,0,0);
        const key='snapshot:'+(++serial),copy=add(key,{name:'Фиксация '+serial,kind:'snapshot',opacity:i.opacity,tint:i.tint});
        const dx=i.geometryApplied?0:i.x,dy=i.geometryApplied?0:i.y;
        copy.source=raw;copy.origin=i.origin||id;copy.rect={...i.rect,left:i.rect.left+dx,top:i.rect.top+dy};copy.pivot=i.pivot?{...i.pivot,x:i.pivot.x+dx,y:i.pivot.y+dy}:null;copy.dirty=true;draw(copy);api.select(key);options.capture?.(key,id);return key;},
      subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
      // Rendering adapter API. Frames do not emit UI/settings events and cannot mutate source pixels.
      _add:add,_frame(id,frame){const i=items.get(id);if(!i)return;const before=ready(i);Object.assign(i,frame);i.dirty=true;draw(i);if(ready(i)!==before)notify();},
      _enabled(id,value){const i=items.get(id);if(i){const before=ready(i);i.enabled=!!value;draw(i);if(ready(i)!==before)notify();}},
      _entry:id=>items.get(id),_redraw:redraw,
      _drop(id){const i=items.get(id);if(!i)return;i.node?.remove?.();items.delete(id);if(selected===id)selected=ordered()[0]?.id||null;redraw();notify();},
      _pivot(id){const i=items.get(id);return i?.pivot?{...i.pivot,x:i.pivot.x+(i.geometryApplied?0:i.x),y:i.pivot.y+(i.geometryApplied?0:i.y)}:null;},
      _paint(g,L,T){for(const i of ordered()){if(!i.source||!i.rect||!i.visible||i.enabled===false||!i.opacity)continue;draw(i);const r=i.rect;
          g.save();g.globalAlpha=i.opacity/100;g.imageSmoothingEnabled=false;g.drawImage(i.node,r.left+(i.geometryApplied?0:i.x)-L,r.top+(i.geometryApplied?0:i.y)-T,r.width,r.height);g.restore();}},
    };return api;
  }
  const api={create,tintPixels};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MayatnikLayers=api;
})(typeof window!=='undefined'?window:globalThis);
