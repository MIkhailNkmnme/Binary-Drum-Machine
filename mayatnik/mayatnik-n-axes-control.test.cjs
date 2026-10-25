const test=require('node:test'),assert=require('node:assert/strict'),Control=require('./mayatnik-n-axes-control.js');
function fixture(saved={}){
 const handlers={},keys={addEventListener:(type,fn)=>handlers[type]=fn,removeEventListener(){}},element={ownerDocument:{defaultView:keys},addEventListener:(type,fn)=>handlers[type]=fn,removeEventListener(){}};
 const state=structuredClone(saved),history=[];let savedCount=0,redraws=0,activations=0;
 const host={element,state:()=>state,pick:(x,y)=>x<0?null:{row:Math.floor((y-20)/10),left:-6,center:0,right:6},geometry:()=>({left:100,top:20,scale:10,height:20,center:8}),activate:()=>activations++,save:()=>savedCount++,redraw:()=>redraws++,history:(before,after,apply)=>history.push({before,after,apply})};
 const api=Control.mount(host),event=(extra={})=>({button:0,clientX:180,clientY:45,target:{closest:()=>null},preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra});
 return {api,state,history,host,handlers,event,click(extra){const e=event(extra);handlers.pointerdown(e);return e;},key(key,extra){const e=event({key,...extra});handlers.keydown(e);return e;},counts:()=>({savedCount,redraws,activations})};
}
test('click creates multiple independent sets, leaves mode enabled, and persists only data',()=>{
 const f=fixture();assert.deepEqual(f.api.get(),{enabled:false,n:3,count:0,selectedId:null});f.api.toggle();assert.equal(f.counts().activations,1);
 assert.ok(f.click().stopped);f.click({clientY:75});assert.equal(f.api.get().count,2);assert.equal(f.api.get().enabled,true);assert.deepEqual(f.state.nAxisSets.map(s=>s.row),[2,5]);assert.notEqual(f.state.nAxisSets[0].id,f.state.nAxisSets[1].id);
 assert.deepEqual(Object.keys(f.state).sort(),['nAxesN','nAxisSets']);assert.equal(f.history.length,2);
});
test('disabled diamond selects, empty click clears without consumption, controls are ignored',()=>{
 const f=fixture();f.api.toggle();f.click();const id=f.api.get().selectedId;f.api.toggle(false);f.click({clientX:0});assert.equal(f.api.get().selectedId,null);
 assert.ok(f.click().stopped);assert.equal(f.api.get().selectedId,id);const empty=f.click({clientX:300});assert.equal(empty.stopped,undefined);assert.equal(f.api.get().selectedId,null);
 f.api.toggle(true);assert.equal(f.click({target:{closest:()=>({})}}).stopped,undefined);assert.equal(f.state.nAxisSets.length,1);
});
test('N updates selected and default; undo redo restore full independent snapshot',()=>{
 const f=fixture();f.api.toggle();f.click();f.click({clientY:75});const old=f.state.nAxisSets[0].n;f.api.setN(4);assert.equal(f.state.nAxesN,4);assert.equal(f.state.nAxisSets[0].n,old);assert.equal(f.state.nAxisSets[1].n,4);
 const edit=f.history.at(-1);edit.apply(edit.before);assert.equal(f.state.nAxesN,3);edit.apply(edit.after);assert.equal(f.state.nAxisSets[1].n,4);
 f.api.toggle(false);f.click();assert.equal(f.api.get().n,3,'selection exposes its own N');assert.equal(f.state.nAxesN,4,'selecting does not overwrite default');
 f.api.cancel();f.api.setN(8);assert.equal(f.state.nAxisSets[1].n,4);assert.equal(f.state.nAxesN,8);
 const reloaded=fixture(JSON.parse(JSON.stringify(f.state)));assert.equal(reloaded.api.get().count,2);assert.equal(reloaded.api.get().n,8);assert.equal(reloaded.api.get().enabled,false);
});
test('Delete removes selected only, protects editing/IME, and supports undo',()=>{
 const f=fixture();f.api.toggle();f.click();f.click({clientY:75});const ids=f.state.nAxisSets.map(s=>s.id);
 assert.equal(f.key('Delete',{isComposing:true}).stopped,undefined);assert.equal(f.key('Delete',{target:{closest:()=>({})}}).stopped,undefined);assert.equal(f.state.nAxisSets.length,2);
 const del=f.key('Delete');assert.ok(del.prevented&&del.stopped);assert.deepEqual(f.state.nAxisSets.map(s=>s.id),[ids[0]]);assert.equal(f.api.get().selectedId,null);
 f.history.at(-1).apply(f.history.at(-1).before);assert.equal(f.state.nAxisSets.length,2);assert.ok(f.key('Escape').stopped);assert.equal(f.api.get().enabled,false);
});
test('draw uses current logical-to-screen transform, skips unavailable rows, and touches no data',()=>{
 const f=fixture({nAxisSets:[{id:'a',row:2,left:-6,center:0,right:6,n:3},{id:'b',row:30,left:-1,center:0,right:1,n:1}]});const before=JSON.stringify(f.state),moves=[],ends=[];
 const ctx={save(){},restore(){},setLineDash(){},beginPath(){},moveTo:(...p)=>moves.push(p),lineTo:(...p)=>ends.push(p),stroke(){},fill(){},closePath(){}};
 f.api.draw(ctx,{left:10,top:5,scale:2,height:20,center:8});assert.equal(moves.length,8);assert.deepEqual(moves[0],[14,5]);assert.deepEqual(ends[0],[14,45]);assert.deepEqual(moves[7],[26,6]);assert.equal(JSON.stringify(f.state),before);
 f.api.toggle(true);assert.equal(f.click({clientX:-1}).stopped,undefined);assert.equal(f.state.nAxisSets.length,2);
});
