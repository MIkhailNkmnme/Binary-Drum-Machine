const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const sceneMath=require('../_js/mirror-scene.js');
const source=fs.readFileSync(__dirname+'/zz-zerkalius.js','utf8');
test('shared axis speed supports zero, x1000 and existing saved rates',()=>{
  const ctx={clamp:(v,a,b)=>Math.max(a,Math.min(b,v))};vm.createContext(ctx);
  vm.runInContext(source.split('\n').filter(line=>/^  function motionRate(FromStep|Step)\(/.test(line)).join('\n'),ctx);
  assert.equal(ctx.motionRateFromStep(0),0);assert.equal(ctx.motionRateFromStep(401),1000);
  for(const rate of [0,.1,.5,1,2,10,100,1000])assert(Math.abs(ctx.motionRateFromStep(ctx.motionRateStep(rate))-rate)<1e-9);
  for(let step=1;step<=401;step++)assert(ctx.motionRateFromStep(step)>=ctx.motionRateFromStep(step-1));
});
function functions(names){const ctx={ZZBitSymmetry:require('../_js/bit-symmetry.js'),sceneMath,drawW:1000,drawH:800,state:{bitsOnly:false,netDigits:true,font:'monospace',net:{up:'#4dd4ff',down:'#e8b64a'}},fieldAxisTargets:()=>[],visibleWorld:()=>[-Infinity,-Infinity,Infinity,Infinity]};vm.createContext(ctx);for(const name of names){const begin=source.indexOf('  function '+name+'('),next=source.indexOf('\n  function ',begin+1),win=source.indexOf('\n  window.',begin+1),end=win>=0&&win<next?win:next;assert(begin>=0);vm.runInContext(source.slice(begin,end),ctx);}return ctx;}
const math=functions(['nearestBit','magneticPosition','netCell','netFaces']);

test('rotation keeps either anchor and square spacing, including signed spans and angle wrap',()=>{
  const W=1000,H=800,diag=Math.hypot(W,H),points=m=>{const span=m.turnGrip==null?Math.min(W,H)*.18:m.turnGrip*diag;return [[m.x*W,m.y*H],[m.x*W+span*Math.cos(m.angle),m.y*H+span*Math.sin(m.angle)]];};
  for(const turnGrip of [null,.2,-.2])for(const anchor of [0,1])for(const delta of [-190,-5,5,190]){
    const m={x:.52,y:.48,angle:178*Math.PI/180,turnGrip},before=points(m),next={...m,...sceneMath.axisRotate(m,delta*Math.PI/180,W,H,anchor)},after=points(next);
    assert(Math.hypot(...after[anchor].map((v,i)=>v-before[anchor][i]))<1e-9);
    assert(Math.abs(Math.hypot(...after[1].map((v,i)=>v-after[0][i]))-Math.hypot(...before[1].map((v,i)=>v-before[0][i])))<1e-9);
    const a=before[1-anchor].map((v,i)=>v-before[anchor][i]),c=Math.cos(delta*Math.PI/180),s=Math.sin(delta*Math.PI/180),expected=[a[0]*c-a[1]*s,a[0]*s+a[1]*c];
    assert(Math.hypot(...after[1-anchor].map((v,i)=>v-after[anchor][i]-expected[i]))<1e-9);
  }
});

test('classic mirror fixes its axis and reflects twice to the original, ignoring old glide offsets',()=>{
  const ctx=functions(['translateMirror','reflectedCopies']);ctx.ZZMirrorGeometry=require('../_js/mirror-geometry.js');
  for(const angle of [0,.1,Math.PI/4,Math.PI/2,2.3]){
    const m={x:.4,y:.5,angle,on:true,figureOffset:[.1,-.2],copyOffsets:Array.from({length:8},()=>[.3,.4])};ctx.state.mirrors=[m];
    const matrix=ctx.reflectedCopies()[1].matrix;
    for(const distance of [-200,0,137]){const p=[400+distance*Math.cos(angle),400+distance*Math.sin(angle)],q=sceneMath.point(matrix,...p);assert(Math.hypot(q[0]-p[0],q[1]-p[1])<1e-9);}
    const p=[123,-87],q=sceneMath.point(matrix,...sceneMath.point(matrix,...p));assert(Math.hypot(q[0]-p[0],q[1]-p[1])<1e-9);
    const before=structuredClone(m),point=sceneMath.point(matrix,137,-83);
    ctx.translateMirror(m,before,m.x+37*Math.cos(angle)/1000,m.y+37*Math.sin(angle)/800);
    const along=sceneMath.point(ctx.reflectedCopies()[1].matrix,137,-83);assert(Math.hypot(along[0]-point[0],along[1]-point[1])<1e-9);
    const dx=-19*Math.sin(angle),dy=19*Math.cos(angle);ctx.translateMirror(m,before,before.x+dx/1000,before.y+dy/800);
    const normal=sceneMath.point(ctx.reflectedCopies()[1].matrix,137,-83);assert(Math.hypot(normal[0]-point[0]-2*dx,normal[1]-point[1]-2*dy)<1e-9);assert.equal(m.angle,angle);
  }
});

test('canvas centre wins over a more distant bit',()=>{const r=math.magneticPosition(500,400,[],1,[[502,406]]);assert.equal(r.label,'центр холста');assert.equal(r.x,500);assert.equal(r.y,400);});
test('a genuinely closer bit remains magnetic',()=>{const r=math.magneticPosition(507,400,[],1,[[507,401]]);assert.equal(r.label,'центр бита');assert.equal(r.x,507);assert.equal(r.y,401);});
test('axis restriction skips off-axis bits and finds the next valid bit',()=>{const r=math.magneticPosition(701,600,[],1,[[701,601],[705,600]],{x:700,y:600,angle:0});assert.equal(r.x,705);assert.equal(r.y,600);});
test('snap threshold remains ten screen pixels while zoomed',()=>{const r=math.magneticPosition(700,600,[],6,[[703,600]]);assert.equal(r.snapped,false);});
test('movable field axes attract a pivot at their intersection',()=>{math.fieldAxisTargets=()=>[{x:.7,y:.6,angle:0},{x:.7,y:.6,angle:Math.PI/2}];const r=math.magneticPosition(704,484,[],1,[]);assert.equal(r.x,700);assert.equal(r.y,480);assert.equal(r.snapped,true);math.fieldAxisTargets=()=>[];});
test('two axis points keep the opposite anchor exact across angle wrapping',()=>{for(const [p,q] of [[[500,400],[600,500]],[[500,400],[400,300]],[[100,100],[100,500]],[[100,500],[100,100]]]){const a=sceneMath.axisFromPoints(p,q,1000,800),span=a.turnGrip*Math.hypot(1000,800);assert.equal(a.x*1000,p[0]);assert.equal(a.y*800,p[1]);assert(Math.hypot(a.x*1000+span*Math.cos(a.angle)-q[0],a.y*800+span*Math.sin(a.angle)-q[1])<1e-9);}});
test('coincident axis points do not corrupt the angle',()=>{assert.equal(sceneMath.axisFromPoints([1,1],[1,1],1000,800),null);});
test('a point on another mirror remains an exact magnetic target',()=>{const r=math.magneticPosition(700,300,[{x:.5,y:.5,angle:Math.atan2(-100,200),turnGrip:Math.hypot(200,100)/Math.hypot(1000,800)}],1,[]);assert.equal(r.snapped,true);assert(Math.abs(r.x-700)<1e-9);assert(Math.abs(r.y-300)<1e-9);});
test('rhombi and edge triangles tile the entire face',()=>{const f={P:[[0,0],[1,0],[0,1]]},area=p=>Math.abs(p.reduce((a,v,i)=>{const w=p[(i+1)%p.length];return a+v[0]*w[1]-w[0]*v[1]},0))/2;for(const R of [1,2,3,8,64,71]){let sum=0;for(let r=0;r<R;r++)for(let k=0;k<=r;k++){const cell=math.netCell(f,r,k,R);sum+=area(cell.P);assert.equal(cell.P.length,r===R-1?3:4);for(const p of cell.P)assert(p[0]>=0&&p[1]>=0&&p[0]+p[1]<=1+1e-12);}assert(Math.abs(sum-.5)<1e-12);}});
test('digit switch controls numbers with filled cells and with digits-only view',()=>{const calls=[],ctx={globalAlpha:1,beginPath(){},moveTo(){},lineTo(){},closePath(){},stroke(){},fill(){},save(){},restore(){},translate(){},scale(){},fillText(v){calls.push(v);}},model={faces:[{up:true,P:[[0,0],[1,0],[0,1]]}]};for(const bitsOnly of [false,true])for(const digits of [false,true]){math.state.bitsOnly=bitsOnly;math.state.netDigits=digits;calls.length=0;math.netFaces(ctx,model,[[1]],100,false);assert.equal(calls.length,digits?1:0);}});
test('row lattice holds every bit of triangular and uneven rows',()=>{
  const {rowsLattice}=functions(['rowsLattice']),dw=12,dh=dw*Math.sqrt(3);
  for(const R of [['1','01','101','0110','11011'],['','1','10','101'],['101','1','10011','11']]){
    const L=rowsLattice(R,dw),det=L.e1[0]*L.e2[1]-L.e1[1]*L.e2[0];
    for(let r=0;r<R.length;r++)for(let j=0;j<R[r].length;j++){
      const v=[-(R[r].length-1)*dw/2+j*dw-L.o[0],r*dh/2-L.o[1]],c=[(v[0]*L.e2[1]-v[1]*L.e2[0])/det,(L.e1[0]*v[1]-L.e1[1]*v[0])/det];
      for(const x of c)assert(Math.abs(x-Math.round(x))<1e-9);
    }
  }
  const tri=rowsLattice(['1','01','101'],dw),half=rowsLattice(['101','1'],dw);assert.equal(tri.e1[0],dw);assert.equal(half.e1[0],dw/2);   // массивы из vm — другого realm, deepEqual их не сравнит
});
test('glide magnet lands the reflected lattice on the still one and keeps off-grid axes free',()=>{
  const {glideSnap}=functions(['glideSnap']),dw=12,b={o:[100,50],e1:[dw,0],e2:[dw/2,dw*Math.sqrt(3)/2]},u=[Math.cos(Math.PI/3),Math.sin(Math.PI/3)];
  const node=[b.o[0]+2*b.e1[0]+3*b.e2[0],b.o[1]+2*b.e1[1]+3*b.e2[1]],p=[node[0]+.37*dw*u[0],node[1]+.37*dw*u[1]];
  const t=glideSnap([{p,b}],u,0,10,1.5);assert(Math.abs(t+.37*dw)<1e-9);
  assert(Math.abs(glideSnap([{p,b}],u,8,10,1.5)-(1-.37)*dw)<1e-9);
  assert.equal(glideSnap([{p,b}],u,0,3,1.5),null);
  const n=[-u[1],u[0]],between=[p[0]+n[0]*dw*Math.sqrt(3)/4,p[1]+n[1]*dw*Math.sqrt(3)/4];
  assert.equal(glideSnap([{p:between,b}],u,0,10,1.5),null);
});
