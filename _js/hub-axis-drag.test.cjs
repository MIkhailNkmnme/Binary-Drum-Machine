const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const source=fs.readFileSync(__dirname+'/hub-mirror.js','utf8'),start=source.indexOf("root.addEventListener('pointerdown'"),end=source.indexOf("root.addEventListener('contextmenu'",start),events={};
 const state={screenPin:true,on:true,x:.5,y:.5,angle:0,orbitRadius:.22},turn={},handle={},shift=[0,0],root={addEventListener:(k,fn)=>events[k]=fn,setPointerCapture(){},hasPointerCapture(){return true;},releasePointerCapture(){}};
 const context={state,turn,handle,root,frame:{left:300,width:900,height:800},drag:null,resumeSpin:false,matchMedia:()=>({matches:false}),scrollY:0,
 window:{HubView:{captureInverse:()=>((x,y)=>[x,y]),captureAxisInverse:()=>((x,y)=>[x,y]),rotation:0,shiftSourceBy:(x,y)=>{shift[0]+=x;shift[1]+=y;}}},
 stopSpin(){},update(){},changed(){},save(){},rotate(){},turnField:d=>state.angle+=d,turnAngle:a=>((a%(2*Math.PI))+2*Math.PI)%(2*Math.PI),snapAngle:a=>Math.round(a/(Math.PI/12))*Math.PI/12};
 vm.runInNewContext(source.slice(start,end),context);
 const emit=(type,x,y,target=turn)=>events[type]({type,pointerId:1,button:0,target,clientX:x,clientY:y,preventDefault(){},stopPropagation(){}});
 return {state,turn,handle,shift,emit};
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
 const context={frame:{},handle:{},turn:{getBoundingClientRect:()=>({x:250,y:200,width:14,height:14})},state:{angle:Math.PI/2},center:()=>[100,100],matchMedia:()=>({matches:false}),document:{body:{classList:{contains:()=>false}}},window:{HubView:{scale:2,axisInverse:(x,y)=>[x/2,y/2],rotateBy:d=>field.push(d),shiftSourceBy:(x,y)=>shift.push([x,y])}},rotate:d=>axis.push(d)};
 const api=vm.runInNewContext('({'+source.slice(start,end)+'})',context);
 assert.equal(api.wheelAt(220,200,120),true);assert.ok(Math.abs(axis[0]-Math.PI/36)<1e-12);assert.equal(field.length,0);
 assert.equal(api.wheelAt(257,207,-120),true);assert.deepEqual(field,[-5]);
 assert.equal(api.wheelAt(400,400,120),false);api.wheelAlong(120);assert.ok(Math.abs(shift[0][0])<1e-12);assert.equal(shift[0][1],12);
});
