const test=require('node:test'),assert=require('node:assert/strict'),Isolated=require('./mayatnik-isolated-bits.js');
const field=(width,rows)=>({width,height:rows.length,data:Int8Array.from(rows.flat())});
const selected=r=>Array.from({length:r.size},(_,q)=>q).filter(q=>Isolated.has(r.mask,q));
function oracle(f,bit,topology){
 const cells=Array.from(f.data,(value,q)=>({value,q,x:q%f.width,y:Math.floor(q/f.width)}));
 return cells.filter(a=>a.value===bit&&!cells.some(b=>b.q!==a.q&&b.value===bit&&(topology==='square'?Math.abs(b.x-a.x)+Math.abs(b.y-a.y)===1:Math.abs(b.x-a.x)===1&&Math.abs(b.y-a.y)===1))).map(c=>c.q);
}
test('square sides join but corner contact does not; borders and empty cells are valid boundaries',async()=>{
 const f=field(4,[[1,0,-1,1],[0,1,-1,1],[-1,-1,0,0]]),before=f.data.slice();
 assert.deepEqual(selected(await Isolated.findGrid(f,{bit:1})),[0,5]);
 assert.deepEqual(selected(await Isolated.findGrid(f,{bit:0})),[1,4]);assert.deepEqual(f.data,before);
 for(const bit of [0,1])assert.deepEqual(selected(await Isolated.findGrid(field(1,[[bit]]),{bit})),[0]);
});
test('diamond side contact is diagonal; same-row and same-column corners do not join',async()=>{
 const f=field(4,[[1,1,-1,0],[-1,-1,1,0],[0,-1,-1,-1]]);
 assert.deepEqual(selected(await Isolated.findGrid(f,{bit:1,topology:'diamond'})),[0]);
 assert.deepEqual(selected(await Isolated.findGrid(f,{bit:0,topology:'diamond'})),[3,7,8]);
 const edge=field(3,[[0,-1,1],[1,-1,0]]);assert.deepEqual(selected(await Isolated.findGrid(edge,{bit:1,topology:'diamond'})),[2,3],'indices at row edges must not wrap');
});
test('grid search matches independent geometric oracle for 640 mixed 0/1/empty cases',async()=>{
 let seed=18441;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 for(let i=0;i<160;i++){const W=1+rand(10),H=1+rand(8),f={width:W,height:H,data:Int8Array.from({length:W*H},()=>rand(3)-1)};
  for(const bit of [0,1])for(const topology of ['square','diamond']){const r=await Isolated.findGrid(f,{bit,topology}),expected=oracle(f,bit,topology);assert.deepEqual(selected(r),expected,JSON.stringify({i,bit,topology,W,H}));assert.equal(r.count,expected.length);}
 }
});
test('every full-field cell is scanned beyond any viewport, including the final row and column',async()=>{
 const width=1025,height=257,data=new Int8Array(width*height).fill(-1),indices=[0,32,201*width+900,data.length-1];for(const q of indices)data[q]=1;
 const r=await Isolated.findGrid({width,height,data},{bit:1,budgetMs:0,yieldTask:async()=>{}});assert.deepEqual(selected(r),indices);assert.equal(r.scanned,data.length);assert.ok(r.yields>0);
});
test('visible fragment graph uses supplied shared sides, accepts one-way edges and ignores corner proximity',async()=>{
 // Nodes may belong to reflected or split source cells; source ownership does
 // not collapse distinct visible fragments or infer a nonexistent side.
 const nodes=[{bit:1,sourceQ:9,x:0,y:0,edges:[1]},{bit:1,sourceQ:9,x:1,y:1,edges:[]},{bit:1,sourceQ:9,x:2,y:2,edges:[]},{bit:0,edges:[4]},{bit:0,edges:[]},{bit:0,edges:[6]},{bit:-1,edges:[]}],saved=JSON.stringify(nodes);
 assert.deepEqual(selected(await Isolated.findGraph({nodes},{bit:1})),[2]);assert.deepEqual(selected(await Isolated.findGraph({nodes},{bit:0})),[5]);assert.equal(JSON.stringify(nodes),saved);
});
test('graph adjacency agrees with both lattice searches, with each undirected side stored only once',async()=>{
 const f=field(5,[[1,0,1,1,-1],[0,1,-1,0,1],[1,0,1,0,0],[0,-1,1,1,0]]);
 for(const topology of ['square','diamond']){const nodes=Array.from(f.data,(bit,q)=>({bit,edges:[]}));for(let a=0;a<nodes.length;a++)for(let b=a+1;b<nodes.length;b++){const dx=Math.abs(a%f.width-b%f.width),dy=Math.abs(Math.floor(a/f.width)-Math.floor(b/f.width));if(topology==='square'?dx+dy===1:dx===1&&dy===1)nodes[a].edges.push(b);}
  for(const bit of [0,1])assert.deepEqual(selected(await Isolated.findGraph({nodes},{bit})),selected(await Isolated.findGrid(f,{bit,topology})));
 }
});
test('one immutable colour delta changes only selected paint, preserves semantic bits and supports exact undo/redo',async()=>{
 const f=field(3,[[1,0,1],[0,1,0]]),bits=f.data.slice(),paint=Uint32Array.from([0,0xff112233,0xffabcdef,0,0xff334455,0]),before=paint.slice(),colour=0xffabcdef;
 const r=await Isolated.findGrid(f,{bit:1}),delta=await Isolated.colourDelta(r,paint,colour);assert.deepEqual([...delta.indices],[0,4]);assert.deepEqual([...delta.previous],[0,0xff334455]);assert.deepEqual([...delta.next],[colour,colour]);assert.equal(delta.bytes,24);assert.deepEqual(paint,before);assert.deepEqual(f.data,bits);
 const apply=values=>delta.indices.forEach((q,i)=>paint[q]=values[i]);apply(delta.next);const after=paint.slice();apply(delta.previous);assert.deepEqual(paint,before);apply(delta.next);assert.deepEqual(paint,after);assert.equal((await Isolated.colourDelta(r,paint,colour)).indices.length,0);assert.deepEqual(f.data,bits);
});
test('cancelled grid, graph and colour preparation never mutate inputs or return a partial transaction',async()=>{
 const data=new Int8Array(20000).fill(1),f={width:20000,height:1,data},nodes=Array.from(data,bit=>({bit,edges:[]})),paint=new Uint32Array(data.length),selection={size:data.length,mask:new Uint8Array(Math.ceil(data.length/8)).fill(255)};
 for(const run of [options=>Isolated.findGrid(f,{...options,bit:1}),options=>Isolated.findGraph({nodes},{...options,bit:1}),options=>Isolated.colourDelta(selection,paint,0xff123456,options)]){let cancelled=false,yields=0;await assert.rejects(run({budgetMs:0,cancelled:()=>cancelled,yieldTask:async()=>{yields++;cancelled=true;}}),e=>e.name==='AbortError');assert.equal(yields,1);assert.ok(paint.every(x=>x===0));assert.ok(data.every(x=>x===1));}
 await assert.rejects(Isolated.findGrid(f,{bit:1,cancelled:()=>true}),e=>e.name==='AbortError');
});
test('invalid dimensions, topology, bit and graph edges fail before any colour transaction',async()=>{
 await assert.rejects(Isolated.findGrid({width:2,height:2,data:[1]},{bit:1}),/снимка/);await assert.rejects(Isolated.findGrid(field(1,[[1]]),{bit:2}),/бит/);await assert.rejects(Isolated.findGrid(field(1,[[1]]),{bit:1,topology:'eight'}),/соседство/);
 await assert.rejects(Isolated.findGraph({nodes:[{bit:1,edges:[3]}]},{bit:1}),/Ребро/);await assert.rejects(Isolated.colourDelta({size:2,mask:new Uint8Array(1)},new Uint32Array(1),0),/Размер/);await assert.rejects(Isolated.colourDelta({size:0,mask:new Uint8Array()},new Uint32Array(),-1),/цвет/);
});
