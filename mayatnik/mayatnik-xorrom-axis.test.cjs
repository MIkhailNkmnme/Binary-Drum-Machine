const test=require('node:test');
const assert=require('node:assert/strict');
const Axis=require('./mayatnik-xorrom-axis.js');
const Field=require('./mayatnik-xorrom-field.js');

const field=(width,height)=>Field.capture({width,height,readBit:(x,y)=>(x+y)%2});
const spec=(x1,y1,x2,y2,extra)=>({x1,y1,x2,y2,...extra});
const addresses=score=>score.rows.map(row=>[...row.indices]);
test('horizontal partial segment cycles from its authored row in either normal direction',async()=>{
  const src=await field(5,4),s=spec(1,2,3,2);
  const out=await Axis.project(src,s);
  assert.deepEqual(addresses(out),[[11,12,13],[16,17,18],[1,2,3],[6,7,8]]);
  assert.deepEqual(addresses(await Axis.project(src,{...s,reverse:true})),[[11,12,13],[6,7,8],[1,2,3],[16,17,18]]);
  assert.deepEqual(out.axis.segment(0),{x1:1,y1:2,x2:3,y2:2});
  assert.equal(out.axis.nearest(1000,1),3);
  assert.equal(out.axis.segment(4),null);
});
test('vertical, directed reverse and offset move complete columns rather than individual cells',async()=>{
  const src=await field(4,3);
  assert.deepEqual(addresses(await Axis.project(src,spec(2,0,2,2))),[[2,6,10],[1,5,9],[0,4,8],[3,7,11]]);
  assert.deepEqual(addresses(await Axis.project(src,spec(2,2,2,0,{offset:1}))),[[11,7,3],[8,4,0],[9,5,1],[10,6,2]]);
});
test('diagonal parallels cover each cell once with clipped finite endpoints and reversible order',async()=>{
  const src=await field(4,4);
  for(const s of [spec(0,0,3,3),spec(3,0,0,3),spec(3,3,0,0),spec(0,3,3,0)]){
    const out=await Axis.project(src,s);
    assert.equal(out.height,7);
    assert.deepEqual(addresses(out).flat().sort((a,b)=>a-b),Array.from({length:16},(_,i)=>i));
    for(const [i,row] of out.rows.entries()){
      const seg=out.axis.segment(i);
      assert.ok(seg);
      assert.ok(Math.abs((seg.x2-seg.x1)*(s.y2-s.y1)-(seg.y2-seg.y1)*(s.x2-s.x1))<1e-9);
      for(const q of row.indices)assert.equal(out.axis.nearest(q%4,Math.floor(q/4)),i);
    }
  }
});
test('fractional and oblique segments agree with an independent per-cell digital sweep',async()=>{
  const width=8,height=6,src=await field(width,height);
  for(const [x1,y1,x2,y2] of [[0,0,6,3],[1,1,3,5],[6,4,-2,0],[1.25,-2,6.25,1],[3.25,4.25,3.5,4.75],[3,2,-6,-9]]){
    const dx=x2-x1,dy=y2-y1,m=Math.max(Math.abs(dx),Math.abs(dy)),nx=-dy/m,ny=dx/m,den=nx*nx+ny*ny;
    const byX=Math.abs(dx)>=Math.abs(dy),slope=byX?dy/dx:dx/dy;
    const lines=new Map();
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const u=byX?x:y,v=byX?y:x,begin=byX?x1:y1,end=byX?x2:y2,base=(byX?y1:x1)+(u-begin)*slope;
      const k=(v-Math.round(base))*(byX?ny:nx);
      const a=Math.round(begin+k*(byX?nx:ny)/den),b=Math.round(end+k*(byX?nx:ny)/den);
      if(u<Math.min(a,b)||u>Math.max(a,b))continue;
      if(!lines.has(k))lines.set(k,[]);
      lines.get(k).push(y*width+x);
    }
    const out=await Axis.project(src,spec(x1,y1,x2,y2));
    assert.equal(out.height,lines.size);
    for(const [k,values] of lines){
      const q=values[0],i=out.axis.nearest(q%width,Math.floor(q/width));
      assert.deepEqual([...out.rows[i].indices].sort((a,b)=>a-b),values,'offset '+k);
    }
  }
});
test('fixed segment uses fresh bits at the same addresses; drag ignores tangent motion',async()=>{
  const src=await field(4,4),s=spec(1,1,2,2,{fixed:true,reverse:true});
  assert.equal(Axis.translate(s,3,3).offset,0);
  const shifted=Axis.translate(s,-1,1);
  assert.equal(shifted.offset,2);
  const a=await Axis.project(src,shifted);
  assert.deepEqual(addresses(a),[[8,13]]);
  const next=await Field.capture({width:4,height:4,readBit:()=>1});
  const b=await Axis.project(next,shifted);
  assert.deepEqual(addresses(a),addresses(b));
  assert.deepEqual([...b.rows[0].bits],[1,1]);
  assert.equal(a.rows[0].ones,0);
  assert.equal(a.axis.nearest(3,3),0);
});
test('punctures preserve addresses, break RGB triplets, use first closest visible cell for geometry',async()=>{
  const grid=[[0,1],[0,-1],[0,1],[0,0]];
  const src=await Field.capture({width:2,height:4,readBit:(x,y)=>grid[y][x]});
  src.rows.forEach((r,y)=>r.geometry={y});
  const s=spec(1,0,1,3,{fixed:true}),{rows:[r]}=await Axis.project(src,s);
  assert.deepEqual([...r.bits],[1,-1,1,0]);
  assert.deepEqual([...r.colors],[0,0,1,0,2,0,0,0]);
  assert.equal(r.ones,2);assert.equal(r.total,3);assert.equal(r.rgb,null);
  assert.equal(r.geometry,src.rows[2].geometry);
  src.rows.forEach((r,y)=>r.rgb=Int8Array.from([5,[2,-1,7,-1][y]]));
  const {rows:[rgb]}=await Axis.project(src,s);
  assert.deepEqual([...rgb.rgb],[2,-1,7,-1]);
  assert.deepEqual([...rgb.bits],[1,-1,1,-1]);
  assert.equal(rgb.total,2);
  assert.deepEqual([...rgb.colors],[0,0,1,0,0,0,0,1]);
});
test('off-field finite segments, point, invalid input, and long endpoints outside the grid',async()=>{
  const src=await field(3,3);
  const empty=await Axis.project(src,spec(10,-20,15,-20));
  assert.equal(empty.height,0);assert.equal(empty.axis.nearest(0,0),-1);
  const fixed=await Axis.project(src,spec(0,1,2,1,{fixed:true,offset:-10}));
  assert.equal(fixed.height,1);assert.equal(fixed.rows[0].total,0);assert.equal(fixed.axis.segment(0),null);
  assert.deepEqual(addresses(await Axis.project(src,spec(1,1,1,1))),[[4],[7],[1]]);
  assert.deepEqual(addresses(await Axis.project(src,spec(-1e9,-1e9,1e9,1e9,{fixed:true}))),[[0,4,8]]);
  assert.deepEqual(Axis.normalize({x1:NaN,x2:Infinity,offset:Infinity}),Axis.normalize(null));
});
test('projection can be cancelled before setup or during a long virtual row',async()=>{
  const src=await field(65536,1),s=spec(0,0,65535,0);
  await assert.rejects(Axis.project(src,s,{cancelled:()=>true}),{name:'AbortError'});
  let stop=false;
  await assert.rejects(Axis.project(src,s,{yieldTask:async()=>{stop=true;},cancelled:()=>stop}),{name:'AbortError'});
});

test('wide source rotates to arbitrary many addressable short rows without eager cell reads',async()=>{
  const width=65536,height=2;
  let reads=0;
  const src={width,height,rows:Array.from({length:2},()=>({get bits(){reads++;return values;}}))};
  const values=new Int8Array(width);values[width-1]=1;
  const out=await Axis.project(src,spec(0,0,0,1));
  assert.equal(out.height,width);assert.equal(out.width,2);assert.equal(reads,0);
  assert.deepEqual(out.rows.slice(0,2).map(r=>[...r.indices]),[[0,width],[width-1,2*width-1]]);
  assert.deepEqual([...out.rows[1].bits],[1,1]);assert.equal(reads,4);
  assert.equal(out.axis.nearest(width-1,1),1);
  assert.ok(Array.isArray(out.rows));assert.equal(65535 in out.rows,true);
});
test('every playable offset has a geometric overlay inside the field even for fractional off-grid endpoints',async()=>{
  const src=await field(8,6),out=await Axis.project(src,spec(-2.5,5,-3,8.5));
  assert.ok(out.height>0);
  for(let i=0;i<out.height;i++){
    const seg=out.axis.segment(i);
    assert.ok(seg);
    for(const x of [seg.x1,seg.x2])assert.ok(x>=-.5-1e-8&&x<=7.5+1e-8);
    for(const y of [seg.y1,seg.y2])assert.ok(y>=-.5-1e-8&&y<=5.5+1e-8);
  }
});
test('long oblique offset enumeration yields to cancellation before reading source cells',async()=>{
  const src={width:262144,height:1,rows:[{get bits(){throw Error('unexpected read');}}]};
  let stop=false;
  await assert.rejects(Axis.project(src,spec(0,0,200000,50000),{cancelled:()=>stop,yieldTask:async()=>{stop=true;}}),
    {name:'AbortError'});
});
