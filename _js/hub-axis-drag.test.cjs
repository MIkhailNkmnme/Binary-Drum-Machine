const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const source=fs.readFileSync(__dirname+'/hub-mirror.js','utf8'),start=source.indexOf("root.addEventListener('pointerdown'"),end=source.indexOf("root.addEventListener('contextmenu'",start),events={};
 const state={screenPin:true,on:true,x:.5,y:.5,angle:0,orbitRadius:.22},turn={},handle={},shift=[0,0],root={addEventListener:(k,fn)=>events[k]=fn,setPointerCapture(){},hasPointerCapture(){return true;},releasePointerCapture(){}};
 const context={state,turn,handle,root,frame:{left:300,width:900,height:800},drag:null,resumeSpin:false,matchMedia:()=>({matches:false}),scrollY:0,
 window:{HubView:{captureInverse:()=>((x,y)=>[x,y]),captureAxisInverse:()=>((x,y)=>[x,y]),rotation:0,shiftSourceBy:(x,y)=>{shift[0]+=x;shift[1]+=y;}}},
 stopSpin(){},update(){},changed(){},save(){},rotate(){},turnField:d=>state.angle+=d,snapAngle:a=>Math.round(a/(Math.PI/12))*Math.PI/12};
 vm.runInNewContext(source.slice(start,end),context);
 const emit=(type,x,y,target=turn)=>events[type]({type,pointerId:1,button:0,target,clientX:x,clientY:y,preventDefault(){},stopPropagation(){}});
 return {state,turn,handle,shift,emit};
}
test('radial gesture cannot turn the axis even after later sideways pointer motion',()=>{
 const f=fixture();f.emit('pointerdown',926,400);f.emit('pointermove',950,403);f.emit('pointermove',950,480);
 assert.equal(f.state.angle,0);assert.equal(f.state.orbitRadius,.25);f.emit('pointerup',950,480);
});
test('angular gesture cannot change radius even after later radial pointer motion',()=>{
 const f=fixture();f.emit('pointerdown',926,400);f.emit('pointermove',926,420);f.emit('pointermove',1100,500);
 assert.equal(f.state.orbitRadius,.22);assert.ok(Math.abs(f.state.angle-Math.atan2(100,350))<1e-10);
});
test('line gesture translates source incrementally without moving or rotating pinned axis',()=>{
 const f=fixture(),line={};f.emit('pointerdown',850,400,line);f.emit('pointermove',900,430,line);f.emit('pointermove',910,450,line);
 assert.deepEqual(f.shift,[60,50]);assert.deepEqual([f.state.x,f.state.y,f.state.angle,f.state.orbitRadius],[.5,.5,0,.22]);
});
test('releasing handle lets the next gesture choose another operation',()=>{
 const f=fixture();f.emit('pointerdown',926,400);f.emit('pointermove',950,400);f.emit('pointerup',950,400);
 f.emit('pointerdown',950,400);f.emit('pointermove',950,430);assert.equal(f.state.orbitRadius,.25);assert.ok(f.state.angle>0);
});
