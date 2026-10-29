const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'mayatnik-gpu.js'),'utf8'),start=source.indexOf('      async function read(into)'),end=source.indexOf('      // Картинка окна',start),readSource=source.slice(start,end);
function fixture({limit=1024,fail=false}={}){
  const buffers=[],values=Int8Array.from([1,0,-1,1,0,1,-1,0]),device={limits:{maxStorageBufferBindingSize:limit,maxBufferSize:limit},
    createBuffer(){const b={destroyed:false,unmapped:false,destroy(){this.destroyed=true;},unmap(){this.unmapped=true;},async mapAsync(){if(fail)throw Error('device lost');},getMappedRange:()=>values.buffer};buffers.push(b);return b;},
    createBindGroup:()=>({}),createCommandEncoder:()=>({beginComputePass:()=>({setPipeline(){},setBindGroup(){},dispatchWorkgroups(){},end(){}}),copyBufferToBuffer(){},finish:()=>({})}),queue:{submit(){}}};
  const c={W:4,H:2,device,GPUBufferUsage:{STORAGE:1,COPY_SRC:2,COPY_DST:4,MAP_READ:8},GPUMapMode:{READ:1},pipeUnpack:{getBindGroupLayout:()=>({})},pBuf:{},bitsBuf:{},hasBuf:{},grid:()=>[1,1],Int8Array};vm.createContext(c);vm.runInContext(readSource,c);return {c,buffers,values};
}
test('GPU unpack returns every signed cell and releases both staging buffers',async()=>{
  const {c,buffers,values}=fixture(),actual=await c.read();assert.deepEqual(actual,values);assert.notEqual(actual.buffer,values.buffer);assert.equal(buffers.length,2);assert.ok(buffers.every(b=>b.destroyed));assert.equal(buffers[1].unmapped,true);
});
test('GPU mapping failure releases both buffers and cannot mutate caller data',async()=>{
  const {c,buffers}=fixture({fail:true}),target=new Int8Array(8).fill(7);await assert.rejects(c.read(target),/device lost/);assert.deepEqual([...target],Array(8).fill(7));assert.ok(buffers.every(b=>b.destroyed));assert.equal(buffers[1].unmapped,false);
});
test('oversized full snapshots fail before allocation, without returning partial data',async()=>{
  const {c,buffers}=fixture({limit:4});await assert.rejects(c.read(),/Полный снимок.*Поиск не выполнен/);assert.equal(buffers.length,0);
});
test('wrong destination size fails before allocation',async()=>{
  const {c,buffers}=fixture();await assert.rejects(c.read(new Int8Array(7)),/Размер приёмника/);assert.equal(buffers.length,0);
});
