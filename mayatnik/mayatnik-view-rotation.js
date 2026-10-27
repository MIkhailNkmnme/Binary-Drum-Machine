/* The field has one screen-space half turn. Source geometry and all tools keep
 * their original coordinates. Hooks belong only to this mounted field; no DOM
 * or Event prototype is changed. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikViewRotation=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const LAYERS='#cv,#cvGpu,#cvBoth,#bitDigits,#colourTemplate,#symAxes,#geomCenterCanvas,#fillPreview,#cellInkCanvas,#cellLineCanvas,.may-anchor-ov,.may-fix-ov,.may-sectors,.may-row-lab,.may-flash,.may-area-frz,.may-ovl,.may-contour,.may-mir,.may-zl-ov,.may-layer-scene,.may-layer-service,.mcsv-canvas,.mcsv-seams,#mayLineMeasures,#mayCenterHover,#mayFieldCaption,#zTopLine,.zl-hd,.may-both-div';
  function center(rect){return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};}
  function point(p,c){return {x:2*c.x-p.x,y:2*c.y-p.y};}
  function rect(r,c){const p=point({x:r.left+r.width,y:r.top+r.height},c);return {x:p.x,y:p.y,left:p.x,top:p.y,right:p.x+r.width,bottom:p.y+r.height,width:r.width,height:r.height};}
  function turnCanvas(canvas,makeCanvas){
    const copy=makeCanvas?makeCanvas():canvas.ownerDocument.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;
    const g=copy.getContext('2d');g.translate(copy.width,copy.height);g.scale(-1,-1);g.drawImage(canvas,0,0);return copy;
  }
  function mount(options){
    const host=options.host,doc=host.ownerDocument,win=doc.defaultView,selector=options.selector||LAYERS;
    const records=new Map(),events=new WeakMap(),activePointers=new Set(),listeners=[];
    const originalHostRotate=host.style.rotate,originalHostOrigin=host.style.transformOrigin;
    let enabled=false,destroyed=false,frame=0,captureCanvas=null,pivot=center(host.getBoundingClientRect());
    function physicalRect(node){const r=records.get(node);return r?r.native():node.getBoundingClientRect();}
    function transformed(node){return enabled&&(host.contains(node)||!!node.closest?.('.may-rotation-world'));}
    function register(node){
      if(!node||records.has(node)||node===host)return;
      const own=Object.getOwnPropertyDescriptor(node,'getBoundingClientRect'),native=node.getBoundingClientRect.bind(node);
      const record={node,own,native,world:null,marker:null};records.set(node,record);
      Object.defineProperty(node,'getBoundingClientRect',{configurable:true,value(){const value=native();return transformed(node)?rect(value,pivot):value;}});
    }
    function move(record){
      const node=record.node;if(record.world||!node.isConnected)return;
      // Only independent layers get a world. Descendants inherit their parent's
      // world, avoiding a second half turn and preserving DOM-local controls.
      if(node.closest('.may-rotation-world'))return;
      const style=win.getComputedStyle(node);
      if(host.contains(node)&&style.position!=='fixed')return;
      const ancestor=node.parentElement?.closest(selector);if(ancestor&&ancestor!==host&&records.has(ancestor))return;
      const marker=doc.createComment('field layer position'),world=doc.createElement('div');world.className='may-rotation-world';
      world.style.cssText='position:fixed;inset:0;pointer-events:none;margin:0;padding:0;background:transparent;';
      world.style.zIndex=style.zIndex==='auto'?'0':style.zIndex;
      world.style.transformOrigin=pivot.x+'px '+pivot.y+'px';world.style.rotate='180deg';
      node.before(marker);doc.body.append(world);world.append(node);record.marker=marker;record.world=world;
    }
    function scan(){
      for(const node of doc.querySelectorAll(selector))register(node);
      if(enabled)for(const record of records.values())move(record);
      // Capture code reads canvases inside a composite layer directly.
      for(const record of [...records.values()])for(const node of record.node.querySelectorAll?.('canvas,svg')||[])register(node);
    }
    function restoreWorlds(){for(const record of records.values())if(record.world){if(record.node.isConnected&&record.marker.isConnected)record.marker.replaceWith(record.node);else record.marker.remove();record.world.remove();record.world=record.marker=null;}}
    function refresh(){
      pivot=center(host.getBoundingClientRect());
      for(const record of records.values())if(record.world){const origin=pivot.x+'px '+pivot.y+'px';if(record.world.style.transformOrigin!==origin)record.world.style.transformOrigin=origin;}
    }
    function tick(){frame=0;if(!enabled||destroyed)return;refresh();frame=win.requestAnimationFrame(tick);}
    function set(value){
      const next=!!value;if(next===enabled)return enabled;
      enabled=next;activePointers.clear();
      if(enabled){refresh();host.style.transformOrigin='50% 50%';host.style.rotate='180deg';scan();frame=win.requestAnimationFrame(tick);}
      else{if(frame)win.cancelAnimationFrame(frame);frame=0;host.style.rotate=originalHostRotate;host.style.transformOrigin=originalHostOrigin;restoreWorlds();}
      return enabled;
    }
    function fieldTarget(target){return target===host||host.contains(target)||[...records.keys()].some(node=>node===target||node.contains(target));}
    function input(event){
      if(!enabled||events.has(event))return;
      const active=activePointers.has(event.pointerId),field=fieldTarget(event.target);
      if(!active&&!field)return;
      // Menus can have transparent backings over the field. Consult their
      // existing geometry guard before replacing screen coordinates.
      if(!active&&options.ownsMenu?.(event))return;
      if(!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY))return;
      refresh();const physical={x:event.clientX,y:event.clientY},logical=point(physical,pivot);events.set(event,physical);
      for(const [key,value]of Object.entries({clientX:logical.x,clientY:logical.y,x:logical.x,y:logical.y,pageX:logical.x+win.scrollX,pageY:logical.y+win.scrollY,movementX:-event.movementX||0,movementY:-event.movementY||0}))Object.defineProperty(event,key,{configurable:true,value});
      if(event.type==='pointerdown')activePointers.add(event.pointerId);
      if(event.type==='pointerup'||event.type==='pointercancel')activePointers.delete(event.pointerId);
    }
    for(const type of ['pointerdown','pointermove','pointerup','pointercancel','pointerover','pointerout','pointerenter','pointerleave','mousedown','mousemove','mouseup','click','dblclick','contextmenu','wheel']){win.addEventListener(type,input,{capture:true,passive:true});listeners.push(type);}
    const observer=new win.MutationObserver(changes=>{if(changes.some(change=>[...change.addedNodes].some(node=>node.nodeType===1&&(node.matches(selector)||node.querySelector(selector)||node.closest('.may-rotation-world')))))scan();});observer.observe(doc.body,{childList:true,subtree:true});scan();
    return {
      set,refresh,scan,register,physicalRect,logicalPoint:p=>enabled?point(p,pivot):p,
      physicalPoint:event=>events.get(event)||{x:event.clientX,y:event.clientY},isFieldEvent:event=>events.has(event),
      get enabled(){return enabled;},get center(){return {...pivot};},
      capture:canvas=>enabled?turnCanvas(canvas,()=>captureCanvas||(captureCanvas=doc.createElement('canvas'))):canvas,
      destroy(){set(false);destroyed=true;observer.disconnect();for(const type of listeners)win.removeEventListener(type,input,true);for(const {node,own}of records.values()){if(own)Object.defineProperty(node,'getBoundingClientRect',own);else delete node.getBoundingClientRect;}records.clear();}
    };
  }
  return {LAYERS,center,point,rect,turnCanvas,mount};
});
