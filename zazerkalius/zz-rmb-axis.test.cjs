const {test}=require('node:test'),assert=require('node:assert/strict');
const A=require('./zz-rmb-axis.js'),E=require('./zz-rmb-editor.js'),K=Math.sqrt(3)/2;
const geometry={hs:[0,0,0,0],u0:1,tw:20,ox:10,oy:15};
test('vertical mirror copies both zeros and ones; source side remains unchanged',()=>{
 const axis={a:[2,0],b:[2,4*K]},rows=['1010','1010'];
 assert.deepEqual(A.reflectRows(rows,geometry,axis,'positive').rows,['0110','0110']);
 assert.deepEqual(A.reflectRows(rows,geometry,axis,'negative').rows,['1001','1001']);assert.deepEqual(rows,['1010','1010']);
});
test('horizontal axis supports bottom to top and top to bottom',()=>{
 const axis={a:[0,2*K],b:[4,2*K]},rows=['1000','0100','0010','0001'];
 assert.deepEqual(A.reflectRows(rows,geometry,axis,'positive').rows,['0001','0010','0010','0001']);
 assert.deepEqual(A.reflectRows(rows,geometry,axis,'negative').rows,['1000','0100','0100','1000']);
 assert.equal(A.basis(axis).positive,'Низ');assert.equal(A.basis(axis).negative,'Верх');
});
test('reversing endpoints does not silently reverse selected source side',()=>{
 const axis={a:[2,0],b:[2,4*K]},rows=['1010','1010'];
 assert.deepEqual(A.reflectRows(rows,geometry,axis).rows,A.reflectRows(rows,geometry,{a:axis.b,b:axis.a}).rows);
 assert.equal(A.basis(axis).positive,'Право');
});
test('segment length limits reflection to its strip; whole-axis mode does not',()=>{
 const axis={a:[2,0],b:[2,K],segment:true},rows=['1010','1010'];
 assert.deepEqual(A.reflectRows(rows,geometry,axis).rows,['0110','1010']);
 assert.deepEqual(A.reflectRows(rows,geometry,{...axis,segment:false}).rows,['0110','0110']);
});
test('arbitrary-angle reflection is involutive and preserves projection and distance',()=>{
 const axis={a:[.5,0],b:[3,2*K]},b=A.basis(axis),p=[.3,2.4],q=A.reflected(p,axis),back=A.reflected(q,axis);
 assert.ok(Math.hypot(back[0]-p[0],back[1]-p[1])<1e-12);
 const signed=v=>(v[0]-axis.a[0])*b.nx+(v[1]-axis.a[1])*b.ny;
 assert.ok(Math.abs(signed(p)+signed(q))<1e-12);
 const along=v=>(v[0]-axis.a[0])*b.dx+(v[1]-axis.a[1])*b.dy;
 assert.ok(Math.abs(along(p)-along(q))<1e-12);
});
test('sampling outside source field is zero; degenerate axes are rejected',()=>{
 assert.deepEqual(A.reflectRows(['1111'],geometry,{a:[3.5,0],b:[3.5,3*K]}).rows,['0001']);
 assert.equal(A.reflectRows(['1'],geometry,{a:[0,0],b:[0,0]}).ok,false);
 assert.equal(A.basis({a:[],b:[]}),null);assert.equal(A.basis({a:[NaN,0],b:[0,1]}),null);
});
test('endpoints snap to actual rhomb vertices for both orientations',()=>{
 assert.deepEqual(A.snapVertex(['000'],{hs:[0],u0:1},[.01,.02]),[0,0]);
 assert.deepEqual(A.snapVertex(['000'],{hs:[0],u0:0},[.49,.02]),[.5,0]);
 assert.equal(A.snapVertex([],{hs:[],u0:0},[0,0]),null);
});
function fixture(){
 let rows=['1010','1010','1010','1010'],axes=[],enabled=true,locked=false,commits=0,saves=0;const events={},snapshots=[];
 const cv={style:{},setAttribute(){},focus(){},setPointerCapture(){},releasePointerCapture(){},getBoundingClientRect:()=>({left:0,top:0}),addEventListener:(t,f)=>(events[t]??=[]).push(f)};
 const cfg={rows:()=>rows,axes:()=>axes,setAxes:a=>axes=a,enabled:()=>enabled,locked:()=>locked,geometry:()=>geometry,redraw(){},save:()=>saves++,message(){},commit:n=>{snapshots.push(rows);rows=n;commits++;}};
 const api=A.mount(cv,cfg);const editor=E.mount(cv,{...cfg,polygon(){return [];},pan(){}});
 function fire(t,data={}){const e={button:0,pointerId:1,preventDefault(){},stopImmediatePropagation(){this.stopped=true;},...data};for(const f of events[t]||[]){f(e);if(e.stopped)break;}}
 const at=(x,y)=>({clientX:geometry.ox+x*geometry.tw,clientY:geometry.oy+y*geometry.tw});
 function line(a,b){fire('pointerdown',at(...a));fire('pointermove',at(...b));fire('pointerup',at(...b));}
 return {api,editor,fire,at,line,axes:()=>axes,rows:()=>rows,commits:()=>commits,saves:()=>saves,snapshots,lock:v=>locked=v};
}
test('axis drawing intercepts cell editor; apply makes exactly one undoable field change',()=>{
 const f=fixture();f.line([2,0],[2,2*K]);assert.equal(f.axes().length,1);assert.equal(f.commits(),0);assert.deepEqual(f.editor.selection(),[]);
 f.api.apply('positive');assert.equal(f.commits(),1);assert.deepEqual(f.rows(),['0110','0110','0110','0110']);assert.deepEqual(f.snapshots[0],['1010','1010','1010','1010']);
 f.api.apply('positive');assert.equal(f.commits(),1);
});
test('multiple axes, endpoint edit, cancellation, deletion, and lock keep data safe',()=>{
 const f=fixture();f.line([2,0],[2,2*K]);f.line([0,3*K],[4,3*K]);assert.equal(f.axes().length,2);
 f.api.toggleSegment();assert.equal(f.api.selected().segment,true);
 const before=JSON.stringify(f.axes());const a=f.api.selected().a;
 f.fire('pointerdown',f.at(...a));f.fire('pointermove',f.at(1,K));f.fire('keydown',{key:'Escape'});assert.equal(JSON.stringify(f.axes()),before);
 f.lock(true);f.api.apply('positive');assert.equal(f.commits(),0);
 f.fire('keydown',{key:'Delete'});assert.equal(f.axes().length,1);assert.equal(f.commits(),0);
});
test('touch chooses the nearest endpoint where the larger handle hit areas overlap',()=>{
 const f=fixture();f.line([1,0],[2,0]);const a=f.api.selected().a.slice();
 f.fire('pointerdown',{...f.at(1.85,0),pointerType:'touch'});f.fire('pointermove',{...f.at(3,0),pointerType:'touch'});f.fire('pointerup',{...f.at(3,0),pointerType:'touch'});
 assert.deepEqual(f.api.selected().a,a);assert.deepEqual(f.api.selected().b,[3,0]);assert.equal(f.commits(),0);
});
test('axis placement and direction preview leave bits untouched until Apply',()=>{
 const f=fixture(),before=f.rows().slice();f.line([2,0],[2,2*K]);assert.equal(f.api.pending(),true);
 f.api.preview('negative');assert.equal(f.commits(),0);assert.deepEqual(f.rows(),before);assert.deepEqual(f.api.previewResult().rows,['1001','1001','1001','1001']);
 f.api.preview('positive');const preview=f.api.previewResult().rows.slice();assert.equal(f.commits(),0);
 f.api.apply();assert.deepEqual(f.rows(),preview);assert.equal(f.commits(),1);assert.equal(f.api.pending(),false);assert.deepEqual(f.api.previewResult().rows,preview);
 f.api.apply();assert.equal(f.commits(),1);
});
test('moving, limiting and removing an axis updates only the preview',()=>{
 const f=fixture();f.line([2,0],[2,2*K]);f.api.toggleSegment();const before=f.rows().slice();
 f.fire('pointerdown',f.at(2,0));f.fire('pointermove',f.at(3,0));f.fire('pointerup',f.at(3,0));assert.deepEqual(f.rows(),before);assert.equal(f.commits(),0);
 f.api.remove();assert.equal(f.api.pending(),false);assert.deepEqual(f.api.previewResult().rows,before);
});
test('multiple mirrors compose original-cell color references and apply in one commit',()=>{
 const f=fixture();f.line([2,0],[2,2*K]);f.line([0,3*K],[4,3*K]);const before=f.rows().slice(),g=geometry;
 const first=A.reflectRows(before,g,f.axes()[0],'positive'),second=A.reflectRows(first.rows,g,f.axes()[1],'positive'),result=f.api.previewResult();assert.deepEqual(result.rows,second.rows);
 for(const [origin,target] of result.copies)assert.equal(result.rows[target[0]][target[1]],origin?before[origin[0]][origin[1]]:'0');
 f.api.apply();assert.equal(f.commits(),1);assert.deepEqual(f.rows(),result.rows);assert.equal(f.api.pending(),false);
});
test('locked grid permits preview but blocks applying mirrors',()=>{
 const f=fixture();f.line([2,0],[2,2*K]);f.lock(true);f.api.preview('negative');assert.equal(f.api.selected().side,'negative');f.api.apply();assert.equal(f.commits(),0);assert.equal(f.api.pending(),true);
 f.lock(false);f.api.apply();assert.equal(f.commits(),1);
});
