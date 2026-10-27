const test=require('node:test'),assert=require('node:assert/strict');
const M=require('./mayatnik-triangle-map.js'),D=require('./mayatnik-triangle-map-data.js'),C=require('./mayatnik-core.js');
function field(k=2){const g=C.geometry('pend',512,512),f=C.field(g.W,512,'empty',g.anchor);for(let i=0;i<k;i++)C.cone(f,g.anchor+C.offset('pend',i),512);return {f,anchor:g.anchor};}
test('source counts and inclusive time domain are exact, no extrapolation',()=>{
  assert.equal(M.records(D,'static',0).length,1093);assert.equal(M.records(D,'time',1).length,1093);assert.equal(M.records(D,'time',2).length,2186);
  assert.equal(M.records(D,'time',178).length,2);assert.equal(M.records(D,'time',179).length,1);
  for(const frame of [180,500])assert.equal(M.records(D,'time',frame).length,0);
  for(const frame of [0,501,1.5])assert.throws(()=>M.records(D,'time',frame),/1–500/);
  assert.equal(Array.from({length:500},(_,i)=>M.records(D,'time',i+1).length).reduce((a,b)=>a+b),12320);
});
test('one-based original rows become exact cell-centre bases and mirror planes',()=>{
  const {f,anchor}=field(),a=M.build(D,{source:'static',field:f,anchor});
  assert.deepEqual(a.triangles[0],{id:1,p:0,x:anchor,base:256,tip:510,h:255});
  assert.deepEqual(a.axes[0],{kind:'h',p:0,id:1,a:[anchor-253.5,256.5],b:[anchor+254.5,256.5]});
  assert.equal(a.mirrors[256*f.W+anchor],-1);assert.equal(a.mirrors[258*f.W+anchor],254*f.W+anchor);
});
test('mask membership uses only the triangle own lattice, including base/tip',()=>{
  const {f,anchor}=field(),a=M.build(D,{source:'static',field:f,anchor});
  for(let r=0;r<f.H;r+=7)for(let c=0;c<f.W;c+=11){const expected=a.triangles.some(t=>M.contains(t,c,r,anchor));assert.equal(!!a.blocked[r*f.W+c],expected);}
  assert.equal(a.blocked[256*f.W+anchor],1);assert.equal(a.blocked[257*f.W+anchor],0);assert.equal(a.blocked[510*f.W+anchor],1);
});
test('all retained time records match maximal checkerboard zero DP on real fields',()=>{
  const {f,anchor}=field(0);let checked=0;
  for(let frame=1;frame<=179;frame++){
    C.cone(f,anchor+C.offset('pend',frame-1),512);const dp=new Uint16Array(f.W*f.H);
    for(let r=0;r<f.H;r++)for(let c=0;c<f.W;c++)if(f.val[r*f.W+c]===0)dp[r*f.W+c]=1+(r&&c&&c<f.W-1?Math.min(dp[(r-1)*f.W+c-1],dp[(r-1)*f.W+c+1]):0);
    for(const t of M.records(D,'time',frame,anchor)){assert.equal(dp[t.tip*f.W+t.x],t.h);assert.equal(((t.x-t.tip-anchor)%2+2)%2,t.p);checked++;}
  }
  assert.equal(checked,12320);
});
test('snapshot reflection never cascades and leaves bases and source bits unchanged',()=>{
  const {f,anchor}=field(),before=f.val.slice(),a=M.build(D,{source:'static',field:f,anchor}),pixels=Uint32Array.from({length:f.W*f.H},(_,q)=>q+1),original=pixels.slice();
  M.reflect(pixels,a.mirrors,{width:f.W,height:f.H,sourceWidth:f.W});let mapped=0,cascadeWitness=0;
  for(let q=0;q<pixels.length;q++){const source=a.mirrors[q];assert.equal(pixels[q],source<0?original[q]:original[source]);if(source>=0){mapped++;if(a.mirrors[source]>=0)cascadeWitness++;assert.equal(((q%f.W-Math.floor(q/f.W))%2+2)%2,((source%f.W-Math.floor(source/f.W))%2+2)%2);}}
  assert.ok(mapped>10000);assert.ok(cascadeWitness>100);assert.deepEqual(f.val,before);
});
test('a different step allocation changes anchor only, not reference geometry',()=>{
  const {f,anchor}=field(),a=M.records(D,'time',36,anchor),g=C.geometry('pend',40,512),b=M.records(D,'time',36,g.anchor);
  assert.deepEqual(a.map(t=>({...t,x:t.x-anchor})),b.map(t=>({...t,x:t.x-g.anchor})));
  assert.throws(()=>M.build(D,{field:{...f,H:256},anchor}),/512/);
});
