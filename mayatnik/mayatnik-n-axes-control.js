/* N-axis interaction adapter. Field hit-testing, history and drawing belong to the host. */
(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./mayatnik-n-axes.js'):root.MayatnikNAxes,typeof module==='object'&&module.exports?require('./mayatnik-axis-style.js'):root.MayatnikAxisStyle);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikNAxesControl=api;
})(typeof globalThis==='object'?globalThis:this,function(A,Style){
  'use strict';
  function mount(host){
    const element=host.element,doc=element.ownerDocument,keys=doc?.defaultView||element;
    const listeners=new Set();let enabled=false,selectedId=null,sequence=0;
    const state=()=>host.state(),sets=()=>A.normaliseSets(state().nAxisSets);
    const snapshot=()=>({n:A.normaliseN(state().nAxesN),sets:sets()});
    const clone=value=>({n:value.n,sets:value.sets.map(s=>({...s}))});
    const get=()=>{const items=sets();return {enabled,n:items.find(s=>s.id===selectedId)?.n??A.normaliseN(state().nAxesN),count:items.length,selectedId};};
    const emit=()=>{const value=get();for(const fn of listeners)fn(value);};
    function syncSelection(){if(!sets().some(s=>s.id===selectedId))selectedId=null;}
    function apply(value){const s=state(),next=clone(value);s.nAxesN=A.normaliseN(next.n);s.nAxisSets=A.normaliseSets(next.sets);syncSelection();host.save();host.redraw();emit();}
    function change(next){const before=snapshot();if(JSON.stringify(before)===JSON.stringify(next))return false;apply(next);host.history?.(clone(before),clone(next),apply);return true;}
    const editing=target=>!!target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
    const controls=target=>!!target?.closest?.('button,input,textarea,select,a,[role="button"],[contenteditable]:not([contenteditable="false"]),.gz-hx,.gz-head');
    const consume=e=>{e.preventDefault();e.stopImmediatePropagation();};
    const valid=g=>g&&[g.left,g.top,g.scale,g.height,g.center].every(Number.isFinite)&&g.scale>0&&g.height>0;
    function handleAt(x,y){const g=host.geometry();if(!valid(g))return null;
      const candidates=sets().filter(s=>s.row<g.height).map(s=>({s,d:Math.abs(x-(g.left+(s.center+g.center)*g.scale))+Math.abs(y-(g.top+(s.row+.5)*g.scale))})).filter(v=>v.d<=9);
      candidates.sort((a,b)=>a.d-b.d);return candidates[0]?.s||null;
    }
    function pointerDown(e){
      if(e.button!==0||e.isPrimary===false||controls(e.target))return;
      if(enabled){const pick=host.pick(e.clientX,e.clientY);if(pick){
        const before=snapshot(),ids=new Set(before.sets.map(s=>s.id));let id;do{id='n-axis-'+(++sequence);}while(ids.has(id));
        const set=A.createSet({...pick,id,n:before.n});if(set){consume(e);selectedId=id;change({...before,sets:[...before.sets,set]});return;}
      }}else{const set=handleAt(e.clientX,e.clientY);if(set){consume(e);selectedId=set.id;host.redraw();emit();return;}}
      if(selectedId!==null){selectedId=null;host.redraw();emit();}
    }
    function toggle(value){const next=typeof value==='boolean'?value:!enabled;if(next===enabled)return get();enabled=next;if(next)host.activate();host.redraw();emit();return get();}
    function cancel(){enabled=false;selectedId=null;host.redraw();emit();}
    function setN(value){const before=snapshot(),n=A.normaliseN(value);return change({n,sets:before.sets.map(s=>s.id===selectedId?{...s,n}:s)});}
    function removeSelected(){if(selectedId===null)return false;const before=snapshot(),filtered=before.sets.filter(s=>s.id!==selectedId);return change({...before,sets:filtered});}
    function keydown(e){if(e.isComposing||e.keyCode===229||editing(e.target))return;
      if(e.key==='Escape'&&(enabled||selectedId!==null)){consume(e);cancel();}
      else if(e.key==='Delete'&&selectedId!==null){consume(e);removeSelected();}
    }
    function draw(ctx,g){if(!valid(g))return;syncSelection();ctx.save();ctx.lineWidth=1;ctx.setLineDash?.([]);
      for(const set of sets()){if(set.row>=g.height)continue;const selected=set.id===selectedId;ctx.strokeStyle=selected?'#fff1a8':'#d8ad43';ctx.lineWidth=selected?1.5:1;ctx.globalAlpha=selected?1:.72;
        ctx.beginPath();for(const x of A.positions(set)){const sx=g.left+(x+g.center)*g.scale;ctx.moveTo(sx,g.top);ctx.lineTo(sx,g.top+g.height*g.scale);}Style.stroke(ctx,{mode:state().axisPalette});
        const x=g.left+(set.center+g.center)*g.scale,y=g.top+(set.row+.5)*g.scale,r=selected?5:4;
        ctx.globalAlpha=1;ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r,y);ctx.closePath();ctx.fillStyle=selected?'#fff1a8':'#d8ad43';ctx.fill();ctx.stroke();
      }ctx.restore();
    }
    // Normalise persisted values without adding transient selection/mode to storage.
    const initial=snapshot();state().nAxesN=initial.n;state().nAxisSets=initial.sets;
    element.addEventListener('pointerdown',pointerDown,true);keys.addEventListener('keydown',keydown,true);
    return {get,toggle,setN,removeSelected,cancel,draw,pointerDown,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},destroy(){element.removeEventListener('pointerdown',pointerDown,true);keys.removeEventListener('keydown',keydown,true);listeners.clear();}};
  }
  return {mount};
});
