const {test}=require('node:test'),assert=require('node:assert/strict');
const T=require('./zz-rmb-touch.js'),E=require('./zz-rmb-editor.js'),A=require('./zz-rmb-axis.js');
test('pinch anchors the world point under the midpoint and clamps scale',()=>{
 const start=T.frame([{x:10,y:20},{x:30,y:20}]),current=T.frame([{x:30,y:50},{x:70,y:50}]);
 assert.deepEqual(T.transform(start,current,{s:20,ox:5,oy:10}),{s:40,ox:20,oy:30});
 assert.equal(T.transform(start,{...current,distance:10000},{s:20,ox:0,oy:0}).s,160);
 assert.equal(T.transform(start,{...current,distance:.1},{s:20,ox:0,oy:0}).s,2);
});
test('setView receives optional baseline and current midpoint without changing its legacy transform',()=>{
 const events={};let proposal,meta,view={s:20,ox:5,oy:10};
 const cv={getBoundingClientRect:()=>({left:0,top:0}),addEventListener:(t,f)=>(events[t]??=[]).push(f),setPointerCapture(){},releasePointerCapture(){}};
 T.mount(cv,{view:()=>view,setView:(v,g)=>{proposal=v;meta=g;},save(){},cancel(){}});
 const fire=(type,id,x,y)=>{for(const fn of events[type]||[])fn({pointerType:'touch',pointerId:id,clientX:x,clientY:y,preventDefault(){},stopImmediatePropagation(){}});};
 fire('pointerdown',1,10,20);fire('pointerdown',2,30,20);fire('pointermove',2,70,20);
 assert.deepEqual(meta,{start:{x:20,y:20,distance:20},current:{x:40,y:20,distance:60},view:{s:20,ox:5,oy:10}});
 assert.deepEqual(proposal,T.transform(meta.start,meta.current,meta.view));
 // Host mutations of metadata must not corrupt the next event's baseline.
 meta.start.x=999;meta.view.ox=999;fire('pointermove',2,70,20);assert.equal(meta.start.x,20);assert.equal(meta.view.ox,5);
});
function fixture(mode='edit'){
 let rows=['010100','000000','000000'],axes=[],view={s:20,ox:0,oy:0},commits=0,saves=0,cancels=0;const events={},options={};
 const cv={style:{},setAttribute(){},focus(){},setPointerCapture(){},releasePointerCapture(){},getBoundingClientRect:()=>({left:13,top:17}),addEventListener:(t,f)=>(events[t]??=[]).push(f)};
 let editor,axis;const touch=T.mount(cv,{view:()=>view,setView:v=>view=v,save:()=>saves++,cancel(){cancels++;editor?.cancelGesture();axis?.cancel();}});
 const cfg={rows:()=>rows,locked:()=>false,geometry:()=>({hs:[0,0,0],u0:1,tw:view.s,ox:view.ox,oy:view.oy}),redraw(){},save:()=>saves++,message(){},commit:r=>{rows=r;commits++;},pan(x,y){view.ox=x;view.oy=y;}};
 axis=A.mount(cv,{...cfg,enabled:()=>mode==='axis',axes:()=>axes,setAxes:v=>axes=v});
 editor=E.mount(cv,{...cfg,enabled:()=>mode==='edit',options:()=>options,polygon:()=>[]});
 function fire(type,id,x,y,extra={}){const e={button:0,pointerType:'touch',pointerId:id,clientX:x+13,clientY:y+17,preventDefault(){},stopImmediatePropagation(){this.stopped=true;},...extra};for(const fn of events[type]||[]){fn(e);if(e.stopped)break;}return e;}
 return {touch,editor,axis,fire,options,view:()=>view,rows:()=>rows,axes:()=>axes,commits:()=>commits,saves:()=>saves,cancels:()=>cancels};
}
test('one finger still creates a rhomb; second finger cancels a pending create or move',()=>{
 const f=fixture();f.fire('pointerdown',1,55,26);f.fire('pointerup',1,55,26);assert.equal(f.rows()[1],'001000');assert.equal(f.commits(),1);
 for(const start of [[35,9],[95,26]]){
  const before=f.rows().slice();f.fire('pointerdown',1,...start);f.fire('pointermove',1,75,9);f.fire('pointerdown',2,115,40);
  f.fire('pointermove',2,135,60);f.fire('pointerup',2,135,60);assert.equal(f.touch.active(),true);
  f.fire('pointermove',1,90,15);f.fire('pointerup',1,90,15);assert.equal(f.touch.active(),false);assert.deepEqual(f.rows(),before);assert.equal(f.commits(),1);
 }
 assert.equal(f.cancels(),2);assert.equal(f.saves(),2);
});
test('two fingers pan and scale in viewing mode without editing cells',()=>{
 const f=fixture('view');f.fire('pointerdown',1,10,20);f.fire('pointerdown',2,30,20);
 f.fire('pointermove',1,30,50);f.fire('pointermove',2,70,50);
 assert.deepEqual(f.view(),{s:40,ox:10,oy:10});assert.equal(f.commits(),0);
 f.fire('pointerup',1,30,50);f.fire('pointerup',2,70,50);assert.equal(f.saves(),1);
});
test('pinch cancels a provisional axis and preserves existing axes and rows',()=>{
 const f=fixture('axis');f.fire('pointerdown',1,0,0);f.fire('pointermove',1,40,35);f.fire('pointerdown',2,100,50);
 f.fire('pointermove',2,120,60);f.fire('pointerup',2,120,60);f.fire('pointerup',1,40,35);
 assert.equal(f.axes().length,0);assert.equal(f.commits(),0);
});
test('replacing a lifted finger rebases the pinch without a jump',()=>{
 const f=fixture();f.fire('pointerdown',1,10,20);f.fire('pointerdown',2,30,20);f.fire('pointermove',2,50,20);f.fire('pointerup',2,50,20);
 const before={...f.view()};f.fire('pointerdown',3,100,20);f.fire('pointermove',3,100,20);assert.deepEqual(f.view(),before);
 f.fire('pointercancel',1,10,20);f.fire('pointerup',3,100,20);assert.equal(f.saves(),1);assert.equal(f.commits(),0);
});
test('third finger and lost capture finish safely, then normal editing works again',()=>{
 const f=fixture();f.fire('pointerdown',1,10,20);f.fire('pointerdown',2,30,20);f.fire('pointerdown',3,60,20);
 f.fire('pointerup',1,10,20);const before={...f.view()};f.fire('pointermove',3,60,20);assert.deepEqual(f.view(),before);
 f.fire('lostpointercapture',2,30,20);f.fire('pointercancel',3,60,20);assert.equal(f.touch.active(),false);assert.equal(f.saves(),1);
 f.fire('pointerdown',4,55,26);f.fire('pointerup',4,55,26);assert.equal(f.commits(),1);
});
test('mobile multi-select, copy-drag, select-all and erase work without modifier keys',()=>{
 const f=fixture();f.options.multi=true;
 for(const x of [35,75]){f.fire('pointerdown',1,x,9);f.fire('pointerup',1,x,9);}assert.equal(f.editor.selection().length,2);
 f.options.multi=false;f.options.copy=true;f.fire('pointerdown',1,35,9);f.fire('pointermove',1,35,26);f.fire('pointerup',1,35,26);
 assert.deepEqual(f.rows(),['010100','010100','000000']);assert.equal(f.commits(),1);
 f.editor.selectAll();assert.equal(f.editor.selection().length,4);f.editor.erase();assert.deepEqual(f.rows(),['000000','000000','000000']);assert.equal(f.commits(),2);
});
