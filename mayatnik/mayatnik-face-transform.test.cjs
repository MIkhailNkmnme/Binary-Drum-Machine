const test=require('node:test'),assert=require('node:assert/strict');
const F=require('./mayatnik-face-transform.js');
function apply(input,mapping){const out=input.slice();for(let n=0;n<mapping.indices.length;n++)out[mapping.indices[n]]=input[mapping.source[n]];return out;}
test('both selected-face operations match independently arranged example and preserve surroundings',()=>{
  const input=Uint32Array.from({length:30},(_,i)=>i),selection={r0:1,r1:3,c0:1,c1:3};
  const expected={rotate180:[21,20,19,15,14,13,9,8,7],flipY:[19,20,21,13,14,15,7,8,9]};
  for(const mode of Object.keys(expected)){
    const m=F.permutation(selection,6,5,mode),out=apply(input,m);assert.deepEqual(Array.from(m.indices,q=>out[q]),expected[mode]);
    for(let q=0;q<input.length;q++)if(!m.indices.includes(q))assert.equal(out[q],input[q]);
    assert.deepEqual(apply(out,m),input);
  }
});
test('all rectangles on many small fields are bijections and self-inverse',()=>{
  for(let h=1;h<=9;h++)for(let w=1;w<=10;w++)for(let y=0;y<h;y++)for(let x=0;x<w;x++)for(const mode of ['rotate180','flipY']){
    const m=F.permutation({r0:y,c0:x,r1:h-1,c1:w-1},w,h,mode),input=Uint32Array.from({length:w*h},(_,i)=>i+1);
    assert.deepEqual([...m.source].sort((a,b)=>a-b),[...m.indices]);assert.deepEqual(apply(apply(input,m),m),input);
  }
});
test('snapshot copies source colours and empty/zero/one bits before any destination write',()=>{
  const colours=new Uint32Array([0xff100001,0xff200002,0xff300003,0xff400004]),bits=new Int8Array([-1,0,1,-1]);
  const m=F.permutation({r0:0,r1:1,c0:0,c1:1},2,2,'rotate180'),s=F.snapshot(m,q=>colours[q],q=>bits[q]);
  colours.fill(0);bits.fill(0);assert.deepEqual([...s.colours],[0xff400004,0xff300003,0xff200002,0xff100001]);assert.deepEqual([...s.bits],[-1,1,0,-1]);
});
test('inclusive cell selection becomes clipped raster bounds without changing unselected pixels',()=>{
  assert.deepEqual(F.bounds({r0:3,r1:1,c0:4,c1:2},20,15,2),{x0:4,y0:2,x1:10,y1:8,width:6,height:6});
  assert.equal(F.bounds(null,10,10),null);assert.equal(F.bounds({r0:15,r1:20,c0:0,c1:1},10,10),null);
  assert.throws(()=>F.permutation({r0:0,r1:0,c0:0,c1:0},1,1,'transpose'),RangeError);
});
test('sparse face layer merges overlapping selections without touching other entries',()=>{
  const first=F.snapshot(F.permutation({r0:0,r1:1,c0:0,c1:1},4,4,'rotate180'),q=>q+100,q=>q%3-1);
  const a=F.merge(null,first,4,4,q=>q+500,q=>q%2);
  const next=F.snapshot(F.permutation({r0:1,r1:2,c0:1,c1:2},4,4,'flipY'),q=>q+1000,q=>q%2);
  const b=F.merge(a,next,4,4,q=>q+900,q=>-1);F.validate(b,4,4);
  assert.deepEqual([...b.indices],[0,1,4,5,6,9,10]);assert.equal(b.colours[F.find(b,0)],a.colours[F.find(a,0)]);assert.equal(b.colours[F.find(b,5)],next.colours[0]);
  assert.equal(b.paint[F.find(b,5)],905);assert.equal(b.bitsBefore[F.find(b,5)],-1);assert.equal(F.find(b,2),-1);
  assert.deepEqual([...a.indices],[0,1,4,5]);assert.throws(()=>F.validate({...b,bits:new Int8Array([7])},4,4));
  assert.throws(()=>F.validate({...b,indices:Uint32Array.from([0,1,4,5,6,9,99])},4,4));
});
