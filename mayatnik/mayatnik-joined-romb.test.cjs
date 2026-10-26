const test=require('node:test'),assert=require('node:assert/strict'),Joined=require('./mayatnik-joined-romb.js');

test('flipY joins p0 and p1 with a single display parity and exact inverse',()=>{
 for(const width of [1,2,7,8])for(const height of [1,2,5])for(const anchor of [0,3,8]){
  const g=Joined.create({width,height,origin:2,fieldWidth:width+5,anchor});
  assert.equal(g.width,width);assert.equal(g.height,2*height);
  const visited=new Set();
  for(let r=0;r<height;r++)for(let c=2;c<2+width;c++){
   const cell=g.forward(c,r);assert.equal((cell.x-g.anchor-cell.y)&1,0);assert.equal(cell.p,(c-anchor-r)&1);
   assert.equal(cell.x,c-2);assert.equal(cell.y,cell.p?2*height-1-r:r);
   assert.deepEqual(g.inverse(cell.x,cell.y),cell);assert.deepEqual(g.fromSource(cell.q),cell);assert.deepEqual(g.fromDisplay(cell.displayQ),cell);
   assert.deepEqual(g.hit(cell.x+.5,cell.y+.5),cell);assert.ok(!visited.has(cell.displayQ));visited.add(cell.displayQ);
  }
  assert.equal(visited.size,width*height);
 }
});

test('rotate180 uses an even reflection and one extra display column only for even widths',()=>{
 for(const width of [1,2,7,8])for(const height of [1,4])for(const anchor of [0,3]){
  const g=Joined.create({width,height,origin:2,fieldWidth:width+5,anchor,rotate:true});
  assert.equal(g.reflection%2,0);assert.equal(g.width,width+(width%2===0?1:0));
  for(let r=0;r<height;r++)for(let c=2;c<2+width;c++){
   const cell=g.forward(c,r);assert.equal((cell.x-g.anchor-cell.y)&1,0);
   assert.equal(cell.x,cell.p?g.reflection-(c-2):c-2);assert.deepEqual(g.inverse(cell.x,cell.y),cell);
   assert.deepEqual(g.hit(cell.x+.5,cell.y+.5),cell);
  }
 }
});

test('seam neighbours share diamond sides, map to opposite source parities and never repeat a source cell',()=>{
 for(const rotate of [false,true])for(const width of [8,9]){
  const height=4,g=Joined.create({width,height,anchor:4,rotate});let joins=0;
  for(let x=1;x<g.width-1;x++){
   const a=g.inverse(x,height-1);if(!a)continue;
   for(const dx of [-1,1]){const b=g.inverse(x+dx,height);if(!b)continue;
    assert.equal(a.p,0);assert.equal(b.p,1);assert.equal(a.r,height-1);assert.equal(b.r,height-1);assert.notEqual(a.q,b.q);joins++;
    // The midpoint lies on their common side; small normal offsets pick each side.
    const mx=x+.5+dx*.5,my=height,epsilon=.01;
    assert.equal(g.hit(mx-dx*epsilon,my-epsilon).q,a.q);assert.equal(g.hit(mx+dx*epsilon,my+epsilon).q,b.q);
   }
  }
  assert.ok(joins>0);
 }
});

test('canvas transforms map cell centres and axis endpoints through the identical geometry',()=>{
 for(const rotate of [false,true])for(const width of [8,9]){
  const g=Joined.create({width,height:4,origin:3,fieldWidth:width+3,anchor:6,rotate});
  for(let r=0;r<4;r++)for(let c=3;c<width+3;c++){
   const cell=g.forward(c,r);assert.deepEqual(g.point(c-3+.5,r+.5,cell.p),{x:cell.x+.5,y:cell.y+.5});
  }
  assert.deepEqual(g.point(0,4,0),{x:0,y:4});
  assert.deepEqual(g.point(0,4,1),{x:rotate?g.reflection+1:0,y:4});
  assert.equal(g.parts[1].matrix[3],-1);assert.equal(g.point(1,2,2),null);
 }
});
test('lattice footprint encloses exactly the source diamonds, including seam tips, using boundary-sized geometry',()=>{
 for(const width of [1,2,7,8])for(const height of [1,2,5])for(const p of [0,1]){
  const g=Joined.create({width,height,anchor:3}),loops=g.footprint(p);let cells=0;
  for(let r=0;r<height;r++)for(let c=0;c<width;c++)if(((c-3-r)&1)===p)cells++;
  const area=loops.reduce((sum,loop)=>sum+loop.slice(1).reduce((a,v,i)=>a+loop[i][0]*v[1]-v[0]*loop[i][1],0)/2,0);
  assert.equal(area,cells*2);for(const loop of loops)assert.deepEqual(loop[0],loop.at(-1));
  assert.ok(loops.reduce((n,l)=>n+l.length,0)<=8*(width+height));
 }
});

test('snapshot is one continuous searchable field with compact reversible mapping and preserved source bits',()=>{
 for(const rotate of [false,true]){
  const g=Joined.create({width:8,height:4,origin:2,fieldWidth:12,anchor:5,rotate}),val=new Int8Array(48).fill(0),before=val.slice();
  const path=[[4,1],[3,2],[4,3],[5,4],[4,5]].map(([x,y])=>g.inverse(x,y));assert.ok(path.every(Boolean));
  path.forEach((cell,i)=>{val[cell.q]=i%2;});const wanted=val.slice();
  const snap=g.snapshot({val}),map=Joined.create(snap.mapping);
  assert.equal(snap.halves,1);assert.deepEqual(snap.parities,[0]);assert.equal(snap.height,8);
  assert.deepEqual(path.map(c=>snap.val[c.displayQ]),[0,1,0,1,0]);
  assert.deepEqual(path.map(c=>map.fromDisplay(c.displayQ).q),path.map(c=>c.q));
  assert.deepEqual(path.map(c=>map.fromDisplay(c.displayQ).p),[0,0,0,1,1]);assert.deepEqual(val,wanted);
  assert.ok(snap.val.some(v=>v===-1));assert.equal(snap.qMap,undefined);
  const hidden=g.snapshot({val,allowed:(r,c,p)=>p===0});assert.ok(path.slice(3).every(c=>hidden.val[c.displayQ]===-1));
  assert.deepEqual(val,wanted);assert.equal(before.length,val.length);
 }
});

test('out-of-bounds, unused parity and even-width margin do not alias valid cells',()=>{
 const g=Joined.create({width:4,height:3,rotate:true});
 for(const [x,y]of [[-1,0],[0,-1],[5,0],[0,6],[.5,0],[1,0],[4,0],[0,3]])assert.equal(g.inverse(x,y),null);
 for(const [x,y]of [[-1,0],[NaN,0],[0,Infinity],[5,0],[0,6]])assert.equal(g.hit(x,y),null);
 assert.equal(g.fromSource(-1),null);assert.equal(g.fromSource(12),null);assert.equal(g.fromDisplay(30),null);
});

test('invalid source geometry or non-binary snapshot values are rejected without mutations',()=>{
 for(const options of [{width:0,height:1},{width:2,height:0},{width:2.5,height:2},{width:2,height:2,origin:-1},{width:2,height:2,origin:1,fieldWidth:2}])assert.throws(()=>Joined.create(options),RangeError);
 const g=Joined.create({width:2,height:2});assert.throws(()=>g.snapshot({val:Int8Array.of(1)}),RangeError);
 const val=Int8Array.of(0,1,-1,2);assert.throws(()=>g.snapshot({val}),RangeError);assert.deepEqual(Array.from(val),[0,1,-1,2]);
});
