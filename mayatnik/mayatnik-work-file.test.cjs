const test=require('node:test'),assert=require('node:assert/strict'),F=require('./mayatnik-work-file.js');
test('ternary packing preserves all lengths and uses exactly two bits per cell',()=>{
  for(const n of [0,1,2,3,4,5,4096]){const a=Int8Array.from({length:n},(_,i)=>i%3-1),p=F.pack(a);assert.equal(p.length,Math.ceil(n/4));assert.deepEqual(F.unpack(p,n),a);}
  assert.throws(()=>F.unpack(Uint8Array.of(3),1));
});
test('whole-work file restores bits, colours, masks, library, mirror baseline and frame preview',async()=>{
  const data={schema:2,k:36,st:{rows:512,userLines:[[1,2,8,2],[1,2,4,5]],symTriangles:true},field:Int8Array.from([-1,0,1,1,0]),
    fill:Uint32Array.from([0,0xff123456,0xffffffff]),paintBits:Int8Array.from([-1,1,0]),templates:[{name:'Вложенный',parts:[{mask:{data:Uint32Array.of(0xffaabbcc,0)}}],view:{x:3,down:7,visible:true}}],
    library:[{name:'Свой',shape:{parts:[{data:[0,0xffffffff]}]}}],mirrors:{live:true,xor:true,base:{bits:Int8Array.of(-1,0),paint:Uint32Array.of(1,2)}},
    frameView:{image:{pixels:Uint8ClampedArray.of(0,1,254,255)},overlay:Uint8ClampedArray.of(1,2,3,255)}};
  const file=await F.encode(data),decoded=await F.decode(file);assert.equal(decoded.format,'mayatnik-work');assert.deepEqual(decoded.data,data);
});
test('legacy JSON opens and truncated or invalid binary files fail',async()=>{
  const old=new Blob([JSON.stringify({format:'mayatnik-paint',version:1,data:{field:{array:'i8',data:[-1,0,1]}}})]);
  assert.deepEqual((await F.decode(old)).data.field,Int8Array.of(-1,0,1));
  const file=await F.encode({field:Int8Array.of(0,1)});await assert.rejects(F.decode(file.slice(0,file.size-5)));
  await assert.rejects(F.decode(new Blob(['MYTW0002'])));
});
