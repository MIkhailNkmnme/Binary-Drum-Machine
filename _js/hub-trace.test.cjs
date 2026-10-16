const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');

test('seven trails start with all seven notes and keep moving inside the triangle',()=>{
  const code=html.slice(html.indexOf('const TRACE ='),html.indexOf('const traceDraw ='));
  const ctx={window:{HubView:{sourceShift:()=>[0,0]},HubMirror:{state:{on:false},bitAngle:()=>0}},music:{play(){}}};
  vm.createContext(ctx);vm.runInContext(code+';this.trace=TRACE;this.step=traceStep;this.tris=traceTris;this.out=traceOut;',ctx);
  ctx.trace.geo={N:64,dw:10,dh:17.32,X:(r,j)=>400-r*5+j*10,Y:r=>20+r*8.66,len:r=>r+1,bit:()=>'1'};
  ctx.step(0);
  assert.deepEqual(Array.from(ctx.trace.balls,b=>b.t),[0,1,2,3,4,5,6]);
  const start=ctx.trace.balls.map(b=>[b.x,b.y]);
  const cells=Array.from(ctx.trace.balls,b=>{const r=Math.round((b.y-20)/8.66);return [r,Math.round((b.x-(400-r*5))/10)];});
  const [r0,j0]=cells[0];assert.deepEqual(cells.map(([r,j])=>[r-r0,j-j0]),[[0,0],[1,0],[1,1],[2,0],[2,1],[2,2],[3,2]]);
  assert.ok(Math.abs(r0-2*63/3)<=2);

  for(let t=50;t<=20000;t+=50)ctx.step(t);
  assert.equal(ctx.trace.balls.length,7);
  ctx.trace.balls.forEach((b,i)=>{
    assert.equal(ctx.out(ctx.tris()[0],b.x,b.y),null);
    assert.ok(Math.hypot(b.x-start[i][0],b.y-start[i][1])>1);
  });
});

test('trail toggle restarts animation after the previous loop has stopped',()=>{
  const code=html.slice(html.indexOf('const noteLoop ='),html.indexOf('const reflectNotes ='));
  const pending=new Map(),events={};let seq=0,draws=0;
  const TRACE={paused:false,last:0},NOTES={raf:0,H:800,on:new Set()},window={scrollY:0,HubMirror:{state:{trace:false}},addEventListener:(type,fn)=>events[type]=fn};
  vm.runInNewContext(code,{TRACE,NOTES,window,performance:{now:()=>100},noteDraw(){draws++;return window.HubMirror.state.trace&&!TRACE.paused;},requestAnimationFrame(fn){const id=++seq;pending.set(id,fn);return id;}});
  const tick=()=>{const callbacks=[...pending.values()];pending.clear();callbacks.forEach(fn=>fn(100));};
  for(let n=0;n<3;n++){
    window.HubMirror.state.trace=true;events.hubmirror();tick();
    assert.equal(pending.size,1);assert.notEqual(NOTES.raf,0);
    window.HubMirror.state.trace=false;events.hubmirror();tick();
    assert.equal(pending.size,0);assert.equal(NOTES.raf,0);
  }
  assert.equal(draws,6);
  window.HubMirror.state.trace=true;events.hubmirror();tick();
  events.hubmotionpause({detail:{paused:true}});tick();assert.equal(pending.size,0);assert.equal(TRACE.paused,true);
  events.hubmotionpause({detail:{paused:false}});tick();assert.equal(pending.size,1);assert.equal(TRACE.last,100);
});


test('zero and one guide differently, use their own tilt, and apply it once per entered cell',()=>{
 const code=html.slice(html.indexOf('const TRACE ='),html.indexOf('const traceDraw ='));
 let bit='0',zero=0,one=0;
 const ctx={window:{HubView:{sourceShift:()=>[0,0]},HubMirror:{state:{on:false,angle:Math.PI/2},bitAngle:b=>b==='0'?zero:one,point:(x,y)=>[800-x,y]}},music:{play(){}}};
 vm.createContext(ctx);vm.runInContext(code+';this.trace=TRACE;this.guide=traceGuide;',ctx);
 ctx.trace.geo={N:64,dw:10,dh:17.32,X:(r,j)=>400-r*5+j*10,Y:r=>20+r*8.66,len:r=>r+1,bit:()=>bit};
 const fresh=()=>({x:400,y:20+10*8.66,vx:0,vy:60,tri:0});
 const left=fresh();ctx.guide(left);assert.ok(left.vx<0&&left.vy>0);
 bit='1';const right=fresh();ctx.guide(right);assert.ok(right.vx>0&&right.vy>0);
 const speed=Math.hypot(right.vx,right.vy);assert.ok(Math.abs(speed-60)<1e-9);
 one=Math.PI/6;const tilted=fresh();ctx.guide(tilted);assert.ok(Math.abs(tilted.vx)<.01);
 bit='0';const unchanged=fresh();ctx.guide(unchanged);assert.ok(Math.abs(unchanged.vx-left.vx)<1e-9);
 // A boundary bounce inside the same bit must survive the next sample.
 unchanged.vx=-unchanged.vx;unchanged.vy=-unchanged.vy;const bounce=[unchanged.vx,unchanged.vy];ctx.guide(unchanged);
 assert.deepEqual([unchanged.vx,unchanged.vy],bounce);
 // Enter another bit: its own angle is applied again.
 zero=-Math.PI/6;unchanged.y+=8.66;ctx.guide(unchanged);assert.ok(Math.abs(unchanged.vx)<.01);
 bit='1';one=0;const reflected=fresh();reflected.tri=1;ctx.guide(reflected);assert.ok(reflected.vx<0&&reflected.vy>0);
});
