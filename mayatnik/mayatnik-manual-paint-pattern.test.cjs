const test=require('node:test'),assert=require('node:assert/strict'),Pattern=require('./mayatnik-manual-paint-pattern.js');
const red=0xff1133aa,blue=0xffdd4422,green=0xff22cc11;
const field=(width,height,values)=>({width,height,data:Int8Array.from(values)});
const sample=(f,cells)=>Pattern.record(null,cells.map(([q,colour])=>({q,bit:f.data[q],colour})),f);
function oracle(f,s,mode,axisX){
 const colours=new Map(s.cells.map(c=>[c.q,c.colour])),paint=new Uint32Array(f.data.length),conflicts=new Set();let matches=0;
 const put=(q,colour)=>{const fixed=colours.get(q);if(fixed&&fixed!==colour)conflicts.add(q);if(paint[q]&&paint[q]!==colour)conflicts.add(q);if(!paint[q])paint[q]=fixed||colour;};
 if(mode==='mirror')for(const c of s.cells){const r=Math.floor(c.q/f.width),x=2*axisX-1-c.q%f.width;if(x>=0&&x<f.width&&Number.isInteger(x)&&f.data[r*f.width+x]===c.bit){matches++;put(r*f.width+x,c.colour);}}
 else{
  const cols=s.cells.map(c=>c.q%f.width),rows=s.cells.map(c=>Math.floor(c.q/f.width)),minX=Math.min(...cols),maxX=Math.max(...cols),minY=Math.min(...rows),maxY=Math.max(...rows);
  for(let row=0;row<=f.height-(maxY-minY+1);row++)for(let col=0;col<=f.width-(maxX-minX+1);col++){
   const mapped=s.cells.map(c=>({q:(row+Math.floor(c.q/f.width)-minY)*f.width+col+c.q%f.width-minX,source:c}));
   if(mapped.every(({q,source})=>f.data[q]===source.bit)){matches++;for(const {q,source}of mapped)put(q,source.colour);}
  }
 }
 return {paint,matches,collisions:conflicts.size,selectedCount:paint.filter(Boolean).length};
}
test('manual provenance is immutable, last manual colour wins, erasing removes ownership and old files infer nothing',async()=>{
 const f=field(4,2,[0,1,0,1,1,0,1,0]),a=sample(f,[[1,red],[4,blue]]),saved=JSON.stringify(a),b=Pattern.record(a,[{q:1,bit:1,colour:green},{q:4,colour:0}]);
 assert.equal(JSON.stringify(a),saved);assert.deepEqual(b.cells,[{q:1,bit:1,colour:green}]);assert.deepEqual(Pattern.record(b,[{q:1,colour:0}]).cells,[]);
 await assert.rejects(Pattern.find(f,null),/Нет образца ручной краски/);
 assert.throws(()=>Pattern.record(a,[{q:9,bit:1,colour:red}]),/Неверная клетка/);assert.equal(JSON.stringify(a),saved);
});
test('same pattern matches exact mixed 0/1, preserves individual colours and ignores unpainted holes',async()=>{
 const f=field(8,3,[0,1,1,0,1,0,1,0, 0,-1,1,0,1,1,1,0, 1,0,1,0,0,1,1,0]),s=sample(f,[[0,red],[2,blue]]),before=f.data.slice(),original=JSON.stringify(s);
 const r=await Pattern.find(f,s),e=oracle(f,s);assert.deepEqual(r.paint,e.paint);assert.equal(r.matches,e.matches);assert.ok(r.paint[8]&&r.paint[10],'an empty unpainted hole is not a mismatch');assert.deepEqual(f.data,before);assert.equal(JSON.stringify(s),original);
 const mixed=sample(f,[[0,red],[1,blue]]),m=await Pattern.find(f,mixed);assert.equal(m.paint[16],0,'inverted 10 must not match 01');
});
test('all rows and columns are searched, including matches beyond a hypothetical cropped display',async()=>{
 const f=field(41,29,new Int8Array(41*29).fill(-1));for(const [x,y]of [[1,1],[30,26],[0,28],[39,28]]){f.data[y*41+x]=0;f.data[y*41+x+1]=1;}
 const s=sample(f,[[42,red],[43,blue]]),r=await Pattern.find(f,s);assert.equal(r.matches,4);assert.equal(r.selectedCount,8);assert.equal(r.paint[28*41],red);assert.equal(r.paint[28*41+40],blue);
});
test('symmetry uses the actual continuous axis, same rows and matching bits only for even and odd widths',async()=>{
 for(const W of [6,7,8,9])for(const axisX of [W/2,1.5,2,4.5]){
  const f=field(W,3,Array.from({length:W*3},(_,q)=>(q+Math.floor(q/W))%2)),s=sample(f,[[0,red],[W+1,blue],[2*W+W-1,green]]),r=await Pattern.find(f,s,{mode:'mirror',axisX}),e=oracle(f,s,'mirror',axisX);
  assert.deepEqual(r.paint,e.paint,JSON.stringify({W,axisX}));assert.equal(r.matches,e.matches);for(let q=0;q<r.paint.length;q++)if(r.paint[q])assert.ok(s.cells.some(c=>Math.floor(c.q/W)===Math.floor(q/W)&&f.data[q]===c.bit&&q%W===2*axisX-1-c.q%W));
 }
 const f=field(8,1,[1,1,1,1,1,1,1,1]),s=sample(f,[[0,red]]);assert.equal((await Pattern.find(f,s,{mode:'mirror',axisX:2.5})).paint[4],red);assert.equal((await Pattern.find(f,s,{mode:'mirror',axisX:4})).paint[7],red);
 await assert.rejects(Pattern.find(f,s,{mode:'mirror',axisX:2.25}),/Ось должна/);
});
test('manual source colours have priority, other overlaps use first row-major match and repetitions never grow the sample',async()=>{
 const f=field(7,2,new Int8Array(14).fill(1)),s=sample(f,[[2,red],[3,blue]]),before=JSON.stringify(s),a=await Pattern.find(f,s),b=await Pattern.find(f,s);
 assert.equal(a.matches,12);assert.deepEqual(a.paint,b.paint);assert.equal(a.paint[2],red);assert.equal(a.paint[3],blue);assert.equal(a.paint[8],blue,'first match at row 1 col 0 wins over the second match');assert.ok(a.collisions>0);assert.equal(JSON.stringify(s),before);assert.equal(s.cells.length,2);
 assert.deepEqual(a.paint,oracle(f,s).paint);assert.equal(a.collisions,oracle(f,s).collisions);
});
test('same and mirror match an independent exhaustive oracle over mixed shapes, empties, offsets and multiple colours',async()=>{
 let seed=13843;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 for(let i=0;i<120;i++){
  const W=3+rand(8),H=2+rand(6),f=field(W,H,Array.from({length:W*H},()=>rand(3)-1)),qs=[];for(let q=0;q<f.data.length;q++)if(f.data[q]>=0&&rand(5)===0)qs.push(q);if(!qs.length){f.data[0]=1;qs.push(0);}
  const s=sample(f,qs.slice(0,6).map(q=>[q,[red,blue,green][rand(3)]]));
  for(const mode of ['same','mirror']){const axisX=rand(2*W+1)/2,r=await Pattern.find(f,s,{mode,axisX}),e=oracle(f,s,mode,axisX);assert.deepEqual(r.paint,e.paint,JSON.stringify({i,W,H,mode,axisX}));assert.equal(r.matches,e.matches);assert.equal(r.selectedCount,e.selectedCount);assert.equal(r.collisions,e.collisions);}
 }
});
test('yielded preparation aborts on frame/source changes without mutating input or publishing a partial result',async()=>{
 const f=field(257,129,new Int8Array(257*129).fill(1)),s=sample(f,[[0,red],[1,blue]]),before=f.data.slice();let invalid=false,yields=0;
 await assert.rejects(Pattern.find(f,s,{budgetMs:0,cancelled:()=>invalid,yieldTask:async()=>{yields++;invalid=true;}}),e=>e.name==='AbortError');assert.equal(yields,1);assert.deepEqual(f.data,before);assert.equal(s.cells.length,2);
 const complete=await Pattern.find(f,s,{budgetMs:0,yieldTask:async()=>{}});assert.equal(complete.matches,256*129);assert.equal(complete.selectedCount,f.data.length);assert.ok(complete.yields>0);
});

test('raster samples move by complete RK steps and reflected panels keep their own actual axis',async()=>{
 const f=field(12,6,new Int8Array(72).fill(1)),s=sample(f,[[13,red],[14,blue],[25,red],[26,blue]]),r=await Pattern.find(f,s,{step:3});
 assert.equal(r.matches,8);for(let q=0;q<r.paint.length;q++)if(r.paint[q])assert.ok([1,2].includes(q%12%3)&&[1,2].includes(Math.floor(q/12)%3));
 const sides=sample(f,[[1,red],[8,blue],[61,red],[68,blue]]),mirror=await Pattern.find(f,sides,{mode:'mirror',axisX:(x,y)=>x<6?(y<3?3:2):(y<3?9:10)});
 assert.equal(mirror.paint[4],red);assert.equal(mirror.paint[9],blue);assert.equal(mirror.paint[62],red);assert.equal(mirror.paint[71],blue);assert.equal(mirror.selectedCount,4);
});
