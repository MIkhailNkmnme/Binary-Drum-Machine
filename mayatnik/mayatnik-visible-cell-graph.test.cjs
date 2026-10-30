const test=require('node:test'),assert=require('node:assert/strict'),Graph=require('./mayatnik-visible-cell-graph.js'),Isolated=require('./mayatnik-isolated-bits.js'),Mirror=require('./mayatnik-manual-mirror-raster.js');
function snapshot(width,height,scale,read){const bits=new Int8Array(width*height),visibleMask=new Uint8Array(bits.length);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const p=read((x+.5)/scale,(y+.5)/scale);bits[y*width+x]=p?.bit??-1;visibleMask[y*width+x]=+(bits[y*width+x]>=0);}return {width,height,scale,bits,visibleMask,geometryExact:true,current:()=>true,cellAt(x,y){return read((x+.5)/scale,(y+.5)/scale);}};}
const build=(s,o={})=>Graph.build(s,{geometry:'half-grid',...o});
function atlas(cols,rows,K,values){
 const points=[],triangles=[],centres=[[.25,1/12],[5/12,.25],[.25,5/12],[1/12,.25]];
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const corners=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]],middle=[x+.5,y+.5];for(let t=0;t<4;t++){triangles.push([corners[t],corners[(t+1)%4],middle]);points.push([(x/2+centres[t][0])*K,(y/2+centres[t][1])*K]);}}
 const cells=new Map(values.filter(v=>v>=0).map(v=>[v,{x:v/4,y:v/4,bit:v%2}]));
 const read=(x,y)=>{const tx=Math.floor(x*2),ty=Math.floor(y*2),lx=x*2-tx,ly=y*2-ty,t=ly<=lx&&ly<=1-lx?0:lx>=ly&&lx>=1-ly?1:ly>=lx&&ly>=1-lx?2:3;return cells.get(values[(ty*cols+tx)*4+t])||null;};
 return {snapshot:snapshot(cols*K/2,rows*K/2,K,read),points,triangles,values};
}
function atlasOracle(a){
 // Independent polygon-edge matching, then graph traversal of equal ownership.
 const edgeMap=new Map(),edges=a.triangles.map(()=>new Set());
 for(let i=0;i<a.triangles.length;i++)for(let j=0;j<3;j++){const edge=[a.triangles[i][j].join(','),a.triangles[i][(j+1)%3].join(',')].sort().join('|'),other=edgeMap.get(edge);if(other!=null){edges[i].add(other);edges[other].add(i);}else edgeMap.set(edge,i);}
 const components=[],owners=new Int32Array(a.values.length).fill(-1);
 for(let i=0;i<a.values.length;i++)if(a.values[i]>=0&&owners[i]<0){const id=components.length,stack=[i],part=[];owners[i]=id;while(stack.length){const q=stack.pop();part.push(q);for(const j of edges[q])if(owners[j]<0&&a.values[j]===a.values[q]){owners[j]=id;stack.push(j);}}components.push(part);}
 const graph=components.map(()=>new Set());edges.forEach((set,q)=>{for(const j of set)if(owners[q]>=0&&owners[j]>=0&&owners[q]!==owners[j])graph[owners[q]].add(owners[j]);});return {components,owners,graph};
}
test('shared-side graph matches polygon-edge oracle; disconnected fragments with one centre stay separate',async()=>{
 let seed=54811;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 for(let i=0;i<100;i++){const cols=1+rand(5),rows=1+rand(4),K=[8,12,16][i%3],a=atlas(cols,rows,K,Array.from({length:cols*rows*4},()=>rand(5)-1)),g=await build(a.snapshot),e=atlasOracle(a);assert.equal(g.nodes.length,e.components.length);
  const ids=e.components.map(part=>g.hit(...a.points[part[0]]));assert.equal(new Set(ids).size,ids.length);
  e.components.forEach((part,id)=>{for(const q of part)assert.equal(g.hit(...a.points[q]),ids[id]);assert.deepEqual(g.nodes[ids[id]].edges.map(n=>ids.indexOf(n)).sort((a,b)=>a-b),[...e.graph[id]].sort((a,b)=>a-b));});
  for(let q=0;q<a.values.length;q++)if(a.values[q]<0)assert.equal(g.hit(...a.points[q]),-1);
 }
});
test('opposite triangles touch at a corner only; identical bits across a shared side are neighbours',async()=>{
 const a=atlas(1,1,8,[0,-1,2,-1]),g=await build(a.snapshot);assert.equal(g.nodes.length,2);assert.deepEqual(g.nodes.map(n=>n.edges),[[],[]]);assert.equal((await Isolated.findGraph(g,{bit:0})).count,2);
 const b=await build(atlas(1,1,8,[0,2,-1,-1]).snapshot);assert.equal((await Isolated.findGraph(b,{bit:0})).count,0);
});
test('diamond cells have four diagonal shared sides and no horizontal/vertical corner edges',async()=>{
 const read=(x,y)=>{const i=Math.round((x+y-1)/2),j=Math.round((x-y)/2),cx=i+j+.5,cy=i-j+.5;return {x:cx,y:cy,bit:(i+j)&1};},g=await build(snapshot(64,64,8,read));
 for(const node of g.nodes)for(const q of node.edges){const other=g.nodes[q];assert.equal(Math.abs(node.x-other.x),1);assert.equal(Math.abs(node.y-other.y),1);}
 const centre=g.nodes.find(n=>n.x===4.5&&n.y===4.5);assert.equal(centre.edges.length,4);
});
test('actual COPY h/v/d/e mirror composition preserves each visible pixel owner and graph bit',async()=>{
 const W=48,H=48,K=8,read=(x,y)=>{const i=Math.round((x+y-1)/2),j=Math.round((x-y)/2);return {x:i+j+.5,y:i-j+.5,bit:(i^j)&1};},base=snapshot(W,H,K,read);
 for(const axes of [[{k:'h',p:2,m:1}],[{k:'v',p:0,m:2}],[{k:'d',p:0,m:1}],[{k:'e',p:0,m:1}],[{k:'h',p:2.5,m:1},{k:'d',p:0,m:2},{k:'v',p:.5,m:1}]]){
  const pixels=Int8Array.from(base.bits),result=Mirror.apply(pixels,{width:W,height:H,scale:K,anchor:2,axes,trace:true,cellAt:base.cellAt,put(q,value){pixels[q]=value;return true;}}),s={...base,bits:pixels,cellAt:result.cellAt},g=await build(s);
  for(let q=0;q<pixels.length;q++){const id=g.rasterOwnerIds[q],node=g.nodes[id],p=result.cellAt(q%W,Math.floor(q/W));assert.equal(node.bit,pixels[q]);assert.equal(node.x,p.x);assert.equal(node.y,p.y);}
 }
});
test('XOR-like subcell bit changes make separate semantic fragments without decoding paint colours',async()=>{
 const s=snapshot(8,8,8,(x,y)=>({x:.5,y:.5,bit:x<.5?0:1})),before=s.bits.slice(),g=await build(s);assert.equal(g.nodes.length,2);assert.deepEqual(g.nodes.map(n=>[n.x,n.y]),[[.5,.5],[.5,.5]]);assert.deepEqual(g.nodes.map(n=>n.edges),[[1],[0]]);assert.deepEqual(s.bits,before);
});
test('pixel ownership supports selecting and colouring the entire fragment, not just its centre',async()=>{
 const a=atlas(2,1,8,[0,0,0,0,1,1,1,1]),g=await build(a.snapshot),selection=await Isolated.findGraph(g,{bit:0}),mask=new Uint8Array(Math.ceil(g.rasterOwnerIds.length/8));
 for(let q=0;q<g.rasterOwnerIds.length;q++){const node=g.rasterOwnerIds[q];if(node>=0&&Isolated.has(selection.mask,node))mask[q>>>3]|=1<<(q&7);}
 const delta=await Isolated.colourDelta({size:g.rasterOwnerIds.length,mask},new Uint32Array(g.rasterOwnerIds.length),0xff123456);assert.equal(delta.indices.length,16);for(const q of delta.indices)assert.equal(q%8<4,true);
 assert.equal(g.hit(-1,0),-1);assert.equal(g.hit(g.width,0),-1);assert.equal(g.hit(0,g.height),-1);
});
test('unsupported geometry, insufficient sampling, excessive memory and non-lattice cuts fail atomically',async()=>{
 const s=snapshot(16,16,8,(x,y)=>({x:.5,y:.5,bit:0}));
 await assert.rejects(Graph.build(s),/подтверждённой/);await assert.rejects(build({...s,geometryExact:false}),/подтверждённой/);await assert.rejects(build({...s,scale:4}),/8 пикселей/);await assert.rejects(build(s,{maxPixels:100}),/бюджет/);await assert.rejects(build(s,{maxBytes:1}),/бюджет/);
 await assert.rejects(build(snapshot(16,16,8,(x,y)=>({x:.5,y:.5,bit:x<.3?0:1}))),/решётк/);
 await assert.rejects(build({...s,visibleMask:new Uint8Array(1)}),/Неполный/);
});
test('snapshot change during async preparation returns no graph and leaves inputs untouched',async()=>{
 const s=snapshot(256,256,8,(x,y)=>({x:Math.floor(x)+.5,y:Math.floor(y)+.5,bit:0})),before=s.bits.slice();let current=true,yields=0;s.current=()=>current;
 await assert.rejects(build(s,{budgetMs:0,yieldTask:async()=>{yields++;current=false;}}),e=>e.name==='AbortError');assert.equal(yields,1);assert.deepEqual(s.bits,before);
});
