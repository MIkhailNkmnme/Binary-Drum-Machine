const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(points=[],cell=null){
 const source=fs.readFileSync(__dirname+'/hub-mirror.js','utf8'),start=source.indexOf("function showAxisHint("),end=source.indexOf("root.addEventListener('contextmenu'",start),events={};
 const state={screenPin:true,on:true,x:.5,y:.5,angle:0,orbitRadius:.22},turn={getBoundingClientRect:()=>({x:840,y:390,width:20,height:20})},handle={},shift=[0,0],root={addEventListener:(k,fn)=>events[k]=fn,setPointerCapture(){},hasPointerCapture(){return true;},releasePointerCapture(){}};
 const context={locked:()=>false,state,turn,handle,root,line:{},tail:{},document:{},frame:{left:300,width:900,height:800},drag:null,dragHint:{hidden:true,dataset:{},style:{}},resumeSpin:false,matchMedia:()=>({matches:false}),scrollY:0,
 bitCenters:points,bitCell:cell,center:()=>[300+900*state.x,800*state.y],moveAxis:(x,y)=>{state.x=x;state.y=y;},window:{HubMirror:{},HubView:{scale:1,sourceShift:()=>shift,captureInverse:()=>((x,y)=>[x,y]),captureAxisInverse:()=>((x,y)=>[x,y]),rotation:0,repeatScrollRotation:()=>shift.push("repeat"),shiftSourceBy:(x,y)=>{shift[0]+=x;shift[1]+=y;}}},
 stopSpin(){},update(){},changed(){},save(){},rotate(){},snapAxisPosition(){},turnField:d=>state.angle+=d,turnAngle:a=>((a%(2*Math.PI))+2*Math.PI)%(2*Math.PI),snapAngle:a=>Math.round(a/(Math.PI/12))*Math.PI/12};
 vm.runInNewContext(source.slice(source.indexOf('  function magneticPoint('),source.indexOf('  const buffers')),context);
 vm.runInNewContext(source.slice(start,end),context);
 const emit=(type,x,y,target=turn,extra={})=>events[type]({...extra,type,pointerId:1,button:0,target,clientX:x,clientY:y,preventDefault(){},stopPropagation(){}});
 return {state,turn,handle,line:context.line,tail:context.tail,grab:context.window.HubMirror.grabAxis,shift,emit,hint:context.dragHint,snap:context.magneticPoint};
}
test('handle can switch radius to angle in one hold, without mixing actions',()=>{
 const f=fixture();f.emit('pointerdown',926,400);f.emit('pointermove',950,403);
 assert.equal(f.state.angle,0);assert.equal(f.state.orbitRadius,.25);
 f.emit('pointermove',950,480);assert.equal(f.state.orbitRadius,.25);assert.ok(Math.abs(f.state.angle-Math.atan2(80,200))<1e-10);
});
test('handle can switch angle to radius in one hold and keeps the angle',()=>{
 const f=fixture();f.emit('pointerdown',926,400);f.emit('pointermove',926,420);
 const angle=f.state.angle;assert.equal(f.state.orbitRadius,.22);
 f.emit('pointermove',1100,500);assert.ok(Math.abs(f.state.angle-angle)<1e-10);assert.ok(f.state.orbitRadius>.4);
});
test('line changes between along and across strokes without moving pinned axis',()=>{
 const f=fixture(),line={};f.emit('pointerdown',850,400,line);f.emit('pointermove',900,430,line);
 assert.deepEqual(f.shift,[50,0]);f.emit('pointermove',910,450,line);
 assert.ok(Math.abs(f.shift[0]-50)<1e-10);assert.ok(Math.abs(f.shift[1]-20)<1e-10);
 assert.deepEqual([f.state.x,f.state.y,f.state.angle,f.state.orbitRadius],[.5,.5,0,.22]);
 f.emit('pointermove',950,450,line);assert.ok(Math.abs(f.shift[0]-90)<1e-10);assert.ok(Math.abs(f.shift[1]-20)<1e-10);
});
test('small transverse jitter does not switch the active radial stroke',()=>{
 const f=fixture();f.emit('pointerdown',926,400);f.emit('pointermove',950,400);f.emit('pointermove',950,403);f.emit('pointermove',950,405);
 assert.equal(f.state.angle,0);assert.equal(f.state.orbitRadius,.25);
 f.emit('pointermove',950,408);assert.ok(f.state.angle>0);assert.equal(f.state.orbitRadius,.25);
});
test('releasing handle lets the next gesture choose another operation',()=>{
 const f=fixture();f.emit('pointerdown',926,400);f.emit('pointermove',950,400);f.emit('pointerup',950,400);
 f.emit('pointerdown',950,400);f.emit('pointermove',950,430);assert.equal(f.state.orbitRadius,.25);assert.ok(f.state.angle>0);
});

test('radial drag passes through zero, reverses the ray and can return in the same gesture',()=>{
 for(const on of [true,false])for(const magnet of [true,false]){
  const f=fixture();f.state.on=on;f.state.magnet=magnet;
  f.emit('pointerdown',926,400);f.emit('pointermove',800,400);f.emit('pointermove',750,400);
  assert.equal(f.state.orbitRadius,0);assert.equal(f.state.angle,0);
  f.emit('pointermove',650,400);assert.equal(f.state.orbitRadius,.125);assert.equal(f.state.angle,Math.PI);
  f.emit('pointermove',850,400);assert.equal(f.state.orbitRadius,.125);assert.equal(f.state.angle,0);assert.deepEqual(f.shift,[0,0]);
 }
});
test('a handle released at the center can be pulled out on the opposite side',()=>{
 const f=fixture();f.state.orbitRadius=0;f.state.angle=Math.PI/2;
 f.emit('pointerdown',750,400);f.emit('pointermove',751,300);
 assert.ok(Math.abs(f.state.orbitRadius-.125)<1e-10);assert.equal(f.state.angle,3*Math.PI/2);
});

test('wheel zones use the visible endpoint even when its old button is hidden',()=>{
 const source=fs.readFileSync(__dirname+'/hub-mirror.js','utf8'),start=source.indexOf('wheelAlong(delta)'),end=source.indexOf(', stopRotation:',start),axis=[],field=[],shift=[];
 const context={frame:{},handle:{},turn:{getBoundingClientRect:()=>({x:250,y:200,width:14,height:14})},state:{angle:Math.PI/2},center:()=>[100,100],matchMedia:()=>({matches:false}),document:{body:{classList:{contains:()=>false}}},window:{HubMirror:{},HubView:{scale:2,axisInverse:(x,y)=>[x/2,y/2],rotateBitsBy:d=>field.push(d),shiftSourceBy:(x,y)=>shift.push([x,y])}},rotate:d=>axis.push(d)};
 const api=vm.runInNewContext('({'+source.slice(start,end)+'})',context);
 assert.equal(api.wheelAt(200,200,120),true);assert.ok(Math.abs(axis[0]-Math.PI/36)<1e-12);assert.equal(field.length,0);
 assert.equal(api.wheelAt(257,207,-120),true);assert.deepEqual(field,[-5]);
 assert.equal(api.wheelZoneAt(220,200),'bits');assert.equal(api.wheelZoneAt(299,207),'bits');assert.equal(api.wheelZoneAt(300,207),false);
 assert.equal(api.wheelAt(400,400,120),false);api.wheelAlong(120);assert.ok(Math.abs(shift[0][0])<1e-12);assert.equal(shift[0][1],12);
});

test('line drag hint follows the active stroke and disappears on release',()=>{
 const f=fixture(),line=f.line;f.emit('pointerover',850,400,line);assert.equal(f.hint.hidden,false);assert.equal(f.hint.dataset.motion,'all');f.emit('pointerleave',850,400,line);assert.equal(f.hint.hidden,true);f.emit('pointerdown',850,400,line);assert.equal(f.hint.hidden,true);
 f.emit('pointermove',900,400,line);assert.equal(f.hint.hidden,false);assert.equal(f.hint.dataset.motion,'along');
 f.emit('pointermove',900,440,line);assert.equal(f.hint.dataset.motion,'across');assert.ok(f.hint.style.transform.includes('rotate(0rad)'));assert.equal(f.hint.style.top,'400px');
 f.emit('pointerup',900,440,line);assert.equal(f.hint.hidden,true);
});

test('background drag shares line constraints and projects its arrows onto the axis',()=>{
 const f=fixture(),target={};
 f.grab({pointerId:1,button:0,target,clientX:850,clientY:650,preventDefault(){},stopPropagation(){}});
 f.emit('pointermove',900,650,target);assert.deepEqual(f.shift,[50,0]);assert.equal(f.hint.dataset.motion,'along');assert.equal(f.hint.style.top,'400px');
 f.emit('pointermove',900,700,target);assert.deepEqual(f.shift,[50,50]);assert.equal(f.hint.dataset.motion,'across');
 f.emit('pointerup',900,700,target);assert.equal(f.hint.hidden,true);assert.equal(f.state.angle,0);
});
test('backward line extension shows the same hover arrows and starts a line drag',()=>{
 const f=fixture();f.emit('pointerover',500,400,f.tail);assert.equal(f.hint.hidden,false);assert.equal(f.hint.dataset.motion,'all');assert.equal(f.hint.style.left,'500px');
 f.emit('pointerdown',500,400,f.tail);f.emit('pointermove',540,400,f.tail);assert.deepEqual(f.shift,[40,0]);assert.equal(f.hint.dataset.motion,'along');
});

test('primary handle click repeats wheel rotation once; drag and cancellation do not',()=>{
 const f=fixture();f.emit('pointerdown',926,400);f.emit('pointerup',926,400);assert.deepEqual(f.shift,[0,0,'repeat']);
 f.emit('pointerdown',926,400);f.emit('pointermove',950,400);f.emit('pointerup',950,400);assert.deepEqual(f.shift,[0,0,'repeat']);
 f.emit('pointerdown',950,400);f.emit('pointercancel',950,400);assert.deepEqual(f.shift,[0,0,'repeat']);
});

test('magnetic axis snaps to rows and half gaps without changing the along coordinate',()=>{
 const f=fixture([370,390,410,430].map(y=>[750,y,'1']));f.state.screenPin=false;f.state.magnet=true;
 f.emit('pointerdown',850,400,f.line);f.emit('pointermove',850,407,f.line);
 assert.ok(Math.abs(f.state.y*800-410)<1e-10);assert.equal(f.state.x*900+300,750);
 f.emit('pointermove',850,417,f.line);assert.ok(Math.abs(f.state.y*800-420)<1e-10);
 f.emit('pointermove',850,424,f.line,{altKey:true});assert.ok(Math.abs(f.state.y*800-424)<1e-10);
});
test('pinned magnetic drag moves rows through and halfway across the fixed axis',()=>{
 const f=fixture([370,390,410,430].map(y=>[750,y,'1']));f.state.magnet=true;
 f.emit('pointerdown',850,400,f.line);f.emit('pointermove',850,407,f.line);assert.deepEqual(f.shift,[0,10]);
 f.emit('pointermove',850,417,f.line);assert.deepEqual(f.shift,[0,20]);
 assert.deepEqual([f.state.x,f.state.y],[.5,.5]);
 f.emit('pointermove',850,424,f.line,{altKey:true});assert.ok(Math.abs(f.shift[0])<1e-10);assert.equal(f.shift[1],24);
});
test('magnet continues projected rows and half gaps beyond both edges after rotation',()=>{
 const a=.71,co=Math.cos(a),si=Math.sin(a),p=u=>[u*co-17*si,u*si+17*co,'0'];
 const f=fixture([p(0),p(20),p(40)]);
 for(const [u,want] of [[8,10],[18,20],[31,30],[67,70],[-67,-70],[10003,10000]]){
  const got=f.snap(...p(u).slice(0,2),a);assert.ok(Math.abs(got[0]-(want*co-17*si))<1e-10);assert.ok(Math.abs(got[1]-(want*si+17*co))<1e-10);
 }
});

test('pinned magnetic drag keeps discrete steps outside the triangle; Alt still releases snapping',()=>{
 const f=fixture([370,390,410,430].flatMap(y=>[[740,y,'0'],[760,y,'1']]));f.state.magnet=true;
 f.emit('pointerdown',850,400,f.line);f.emit('pointermove',850,667,f.line);assert.deepEqual(f.shift,[0,270]);
 f.emit('pointermove',850,679,f.line);assert.ok(Math.abs(f.shift[0])<1e-9&&Math.abs(f.shift[1]-280)<1e-9);
 f.emit('pointermove',850,683,f.line,{altKey:true});assert.ok(Math.abs(f.shift[0])<1e-9&&Math.abs(f.shift[1]-283)<1e-9);
 assert.deepEqual([f.state.x,f.state.y],[.5,.5]);
});

test('one visible bit extends its lattice, while an empty field has no invented snapping',()=>{
 const f=fixture([[100,200,'1']],{width:20,height:40});
 const p=f.snap(100,247,Math.PI/2);assert.ok(Math.abs(p[0]-100)<1e-9);assert.equal(p[1],250);
 assert.deepEqual(Array.from(fixture().snap(100,247,Math.PI/2)),[100,247]);
});
