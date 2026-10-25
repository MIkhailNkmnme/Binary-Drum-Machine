const {test}=require('node:test');const assert=require('node:assert/strict');
const E=require('./zz-rmb-editor.js');
test('hit testing follows rhomb slant, row offsets, pan and zoom',()=>{
 for(const u0 of [0,1]){const rows=['000','000'],g={hs:[-3,-2],tw:20,ox:80,oy:15,u0};
  for(let r=0;r<2;r++)for(let c=0;c<3;c++){const h=20*Math.sqrt(3)/2,x=80+g.hs[r]*10+c*20+15,y=15+(r+.5)*h;assert.deepEqual(E.hit(rows,g,x,y),[r,c]);}
  assert.equal(E.hit(rows,g,-100,-100),null);assert.deepEqual(E.hit(rows,g,-100,-100,true),[0,0]);}
});
test('overlapping move clears sources first and preserves every moved cell',()=>{
 const rows=['01100'];const r=E.apply(rows,[[0,1],[0,2]],{dc:1});assert.deepEqual(r.rows,['00110']);assert.deepEqual(rows,['01100']);assert.deepEqual(r.selection,[[0,2],[0,3]]);
});
test('copy, create, delete, and no-op preserve expected source bits',()=>{
 assert.deepEqual(E.apply(['01000'],[[0,1]],{dc:2,copy:true}).rows,['01010']);
 assert.deepEqual(E.apply(['00000'],[[0,2]],{create:true}).rows,['00100']);
 assert.deepEqual(E.apply(['01100'],[[0,1],[0,2]],{erase:true}).rows,['00000']);
 assert.equal(E.apply(['01000'],[[0,1]],{}).changed,false);
});
test('out-of-bounds moves and pastes are rejected atomically, never clipped',()=>{
 const rows=['010'];assert.equal(E.apply(rows,[[0,1]],{dc:2}).ok,false);
 const paste=E.apply(rows,[[0,0],[0,3]],{create:true});assert.equal(paste.ok,false);assert.equal(paste.rows,rows);
});
test('marquee chooses only filled cells, with reversed drag and ragged rows supported',()=>{
 assert.deepEqual(E.rectangle(['0101','11','001'],[2,3],[0,1]),[[0,1],[0,3],[1,1],[2,2]]);
});
function fixture(initial=['010000','000000','000000'],options={}){
 let rows=initial.slice(),locked=false,enabled=true,commits=0,saves=0,draws=0;const snapshots=[],events={},messages=[];
 const g={hs:[0,0,0],tw:20,ox:0,oy:0,u0:1};
 const cv={style:{},setAttribute(){},focus(){},setPointerCapture(){},releasePointerCapture(){},getBoundingClientRect:()=>({left:0,top:0}),addEventListener:(t,f)=>(events[t]??=[]).push(f)};
 const api=E.mount(cv,{options:()=>options,rows:()=>rows,enabled:()=>enabled,locked:()=>locked,geometry:()=>g,redraw:()=>draws++,save:()=>saves++,message:m=>messages.push(m),pan:(x,y)=>{g.ox=x;g.oy=y;},commit:n=>{snapshots.push(rows);rows=n;commits++;},polygon(){return [];}});
 function fire(t,data={}){const e={button:0,pointerId:1,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...data};for(const f of events[t]||[]){f(e);if(e.stopped)break;}return e;}
 const at=(r,c,extra={})=>({clientX:g.ox+c*20+15,clientY:g.oy+(r+.5)*20*Math.sqrt(3)/2,...extra});
 const click=(r,c,extra={})=>{fire('pointerdown',at(r,c,extra));fire('pointerup',at(r,c,extra));};
 return {api,fire,at,click,rows:()=>rows,commits:()=>commits,saves:()=>saves,snapshots,g,messages,lock:v=>locked=v,enabled:v=>enabled=v};
}
test('click on zero creates a selected rhomb; Delete clears it with one undo step each',()=>{
 const f=fixture();f.click(1,2);assert.equal(f.rows()[1],'001000');assert.deepEqual(f.api.selection(),[[1,2]]);assert.equal(f.commits(),1);
 f.fire('keydown',{key:'Delete'});assert.equal(f.rows()[1],'000000');assert.equal(f.commits(),2);assert.equal(f.snapshots[1][1],'001000');
});
test('drag and Ctrl-drag move/copy, pointer cancellation and Escape leave rows intact',()=>{
 const f=fixture();f.fire('pointerdown',f.at(0,1));f.fire('pointermove',f.at(1,2));assert.equal(f.commits(),0);f.fire('pointerup',f.at(1,2));assert.deepEqual(f.rows(),['000000','001000','000000']);assert.equal(f.commits(),1);
 f.fire('pointerdown',f.at(1,2,{ctrlKey:true}));f.fire('pointermove',f.at(2,3,{ctrlKey:true}));f.fire('pointerup',f.at(2,3,{ctrlKey:true}));assert.equal(f.rows()[1],'001000');assert.equal(f.rows()[2],'000100');assert.equal(f.commits(),2);
 f.fire('pointerdown',f.at(2,3));f.fire('pointermove',f.at(0,4));f.fire('pointercancel',f.at(0,4));assert.equal(f.commits(),2);
 f.fire('pointerdown',f.at(2,3));f.fire('pointermove',f.at(0,4));f.fire('keydown',{key:'Escape'});assert.equal(f.commits(),2);
});
test('Shift selection, group movement and internal copy/paste use the focused canvas',()=>{
 const f=fixture(['010100','000000','000000']);f.click(0,1);f.click(0,3,{shiftKey:true});assert.equal(f.api.selection().length,2);
 f.fire('keydown',{key:'ArrowDown'});assert.deepEqual(f.rows(),['000000','010100','000000']);
 f.fire('keydown',{key:'c',ctrlKey:true});f.fire('pointermove',f.at(2,1));f.fire('keydown',{key:'v',ctrlKey:true});assert.equal(f.rows()[2],'010100');assert.equal(f.rows()[1],'010100');
});
test('locked rows and disabled editor prevent edits; Space drag pans without history',()=>{
 const f=fixture();f.lock(true);f.click(1,1);assert.equal(f.commits(),0);f.lock(false);f.enabled(false);f.click(1,1);assert.equal(f.commits(),0);f.enabled(true);
 f.fire('keydown',{key:' '});f.fire('pointerdown',f.at(1,1));f.fire('pointermove',{clientX:55,clientY:70});f.fire('pointerup',{clientX:55,clientY:70});f.fire('keyup',{key:' '});assert.notEqual(f.g.ox,0);assert.equal(f.commits(),0);assert.equal(f.saves(),1);
});

test('Ctrl+A selects all filled rhombs and Delete clears them in one history step',()=>{const f=fixture(['010100','100001','000000']);f.fire('keydown',{key:'a',ctrlKey:true});assert.equal(f.api.selection().length,4);f.fire('keydown',{key:'Delete'});assert.deepEqual(f.rows(),['000000','000000','000000']);assert.equal(f.commits(),1);});

test('plain drag pans unselected cells and background without changing bits; click still selects/creates',()=>{
 const f=fixture(undefined,{panUnselected:true}),before=f.rows().slice(),a=f.at(0,1);
 f.fire('pointerdown',a);f.fire('pointermove',{clientX:a.clientX+40,clientY:a.clientY+25});f.fire('pointerup',a);
 assert.equal(f.g.ox,40);assert.ok(Math.abs(f.g.oy-25)<1e-10);assert.deepEqual(f.rows(),before);assert.equal(f.commits(),0);assert.equal(f.saves(),1);
 f.click(0,1);assert.deepEqual(f.api.selection(),[[0,1]]);f.fire('pointerdown',f.at(0,1));f.fire('pointermove',f.at(1,2));f.fire('pointerup',f.at(1,2));assert.equal(f.rows()[1],'001000');assert.equal(f.commits(),1);
 f.click(2,3);assert.equal(f.rows()[2],'000100');assert.equal(f.commits(),2);
 f.fire('pointerdown',{clientX:-50,clientY:-50});f.fire('pointermove',{clientX:-30,clientY:-20});f.fire('pointercancel');assert.equal(f.g.ox,40);assert.ok(Math.abs(f.g.oy-25)<1e-10);assert.equal(f.commits(),2);
});
test('pan works while locked, Shift retains selection frame and Ctrl retains direct copy',()=>{
 const f=fixture(undefined,{panUnselected:true});f.lock(true);const a=f.at(1,2);f.fire('pointerdown',a);f.fire('pointermove',{clientX:a.clientX+10,clientY:a.clientY+20});f.fire('pointerup');assert.equal(f.g.ox,10);assert.ok(Math.abs(f.g.oy-20)<1e-10);assert.equal(f.commits(),0);
 f.lock(false);f.fire('pointerdown',f.at(0,0,{shiftKey:true}));f.fire('pointermove',f.at(1,3,{shiftKey:true}));f.fire('pointerup');assert.deepEqual(f.api.selection(),[[0,1]]);
 f.api.clear();f.fire('pointerdown',f.at(0,1,{ctrlKey:true}));f.fire('pointermove',f.at(1,2,{ctrlKey:true}));f.fire('pointerup');assert.equal(f.rows()[0],'010000');assert.equal(f.rows()[1],'001000');assert.equal(f.commits(),1);
});
