const test=require('node:test'),assert=require('node:assert/strict');
const M=require('./mayatnik-template-matcher.js');global.MayatnikTemplateMatcher=M;
const Engine=require('./mayatnik-template-engine.js');
const ring={width:5,height:5,data:Array.from({length:25},(_,q)=>q%5===0||q%5===4||q<5||q>=20?1:0)};
const compile=part=>M.compile(part,1,{silhouette:true});
test('reported 6x6 figure finds its own source despite three unrelated black cells',async()=>{
 const part={width:6,height:6,data:['001100','111110','001111','000110','000110','011100'].join('').split('').map(Number)};
 const field={width:6,height:6,data:Int8Array.from(part.data,v=>v^1)};
 for(const q of [18,24,35])field.data[q]=0;
 assert.equal((await M.find(field,[M.compile(part)])).count,0);
 const result=await M.find(field,[compile(part)]);assert.equal(result.count,1);assert.equal(result.selectedCount,18);
 for(const q of [18,24,35])assert.equal(result.selected[q],0);
});
function ringField(inverse=0,padding=1){
 const width=5+2*padding,data=new Int8Array(width*width).fill(inverse);
 for(let y=0;y<5;y++)for(let x=0;x<5;x++)data[(y+padding)*width+x+padding]=ring.data[y*5+x]^inverse;
 data[(2+padding)*width+2+padding]=1^inverse; // A separate island inside the bounding box.
 return {width,height:width,data};
}
test('silhouette ignores a disconnected island while rectangular API remains exact',async()=>{
 for(const inverse of [0,1]){
  const field=ringField(inverse),before=field.data.slice(),result=await M.find(field,[compile(ring)]);
  assert.equal(result.count,1);assert.equal(result.selectedCount,16);assert.equal(result.selected[3*7+3],0);
  assert.equal((await M.find(field,[M.compile(ring)])).count,0);assert.deepEqual(field.data,before);
 }
});
test('silhouette rejects attached cells inside and outside the bounding box',async()=>{
 for(const q of [1*7+0,2*7+2]){const field=ringField();field.data[q]=1;assert.equal((await M.find(field,[compile(ring)])).count,0);}
});
test('field edges and empty cells terminate the silhouette without wrapping rows',async()=>{
 for(const inverse of [0,1])assert.equal((await M.find(ringField(inverse,0),[compile(ring)])).count,1);
 const field=ringField();for(let q=0;q<field.data.length;q++)if(q<7||q>=42||q%7===0||q%7===6)field.data[q]=-1;
 assert.equal((await M.find(field,[compile(ring)])).count,1);
 const lastColumn={width:3,height:2,data:Int8Array.from([-1,-1,1,1,-1,-1])};
 assert.equal((await M.find(lastColumn,[compile({width:1,height:1,data:[1]})])).count,2);
});
test('arbitrary disconnected masks retain every filled cell and allow corner contact',async()=>{
 const part={width:3,height:1,data:[1,0,1]},field={width:3,height:2,data:Int8Array.from([1,0,1,-1,1,-1])};
 const result=await M.find(field,[compile(part)]);assert.equal(result.count,1);assert.deepEqual([...result.selected],[1,0,1,0,0,0]);
 field.data[2]=0;assert.equal((await M.find(field,[compile(part)])).count,0);
});
test('engine opts saved and unsaved shapes into silhouette matching and existence filtering',async()=>{
 const field=ringField(),shape={rk:1,parts:[ring]},entry={id:'ring',name:'Ring',shape};
 const api=Engine.create({entries:()=>[entry],field:async()=>field,current:f=>f===field,instances:()=>[],shapeInstances:()=>[],scope:()=> 'fixed',visibleInstances:()=>false,stop(){},choose(){},redrawSelection(){}});
 api.refresh();await api.whenFiltered();assert.deepEqual(api.list().map(t=>t.id),['ring']);
 assert.equal((await api.select('ring')).count,1);assert.equal((await api.selectShape(shape)).count,1);
 assert.equal(api.getSelection().selectedCount,16);
});
test('silhouette agrees with independent connected-component enumeration, including inversion and voids',async()=>{
 let seed=741;const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed>>>8)%n;};
 for(let run=0;run<50;run++){
  const width=9,height=7,field={width,height,data:Int8Array.from({length:63},()=>random(3)-1)},seen=new Set(),components=[];
  for(let q=0;q<63;q++){
   if(seen.has(q)||field.data[q]<0)continue;const cells=[q];seen.add(q);
   for(let i=0;i<cells.length;i++){const v=cells[i],x=v%width,y=Math.floor(v/width);for(const [xx,yy]of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const n=yy*width+xx;if(xx>=0&&xx<width&&yy>=0&&yy<height&&!seen.has(n)&&field.data[n]===field.data[q]){seen.add(n);cells.push(n);}}}
   const xs=cells.map(v=>v%width),ys=cells.map(v=>Math.floor(v/width)),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x+1,h=Math.max(...ys)-y+1;
   const data=new Uint8Array(w*h);for(const v of cells)data[(Math.floor(v/width)-y)*w+v%width-x]=1;
   components.push({x,y,width:w,height:h,data,cells});
  }
  const chosen=components[random(components.length)],expected=components.filter(c=>c.width===chosen.width&&c.height===chosen.height&&c.data.every((v,i)=>v===chosen.data[i])),result=await M.find(field,[compile(chosen)]),selected=new Uint8Array(63);
  for(const c of expected)for(const q of c.cells)selected[q]=1;
  assert.equal(result.count,expected.length);assert.deepEqual(result.selected,selected);
 }
});
test('silhouette scans still yield and cancel without returning partial selections',async()=>{
 const field={width:1024,height:512,data:new Int8Array(1024*512)};let cancel=false;
 await assert.rejects(M.find(field,[compile(ring)],{budgetMs:0,cancelled:()=>cancel,yieldTask:async()=>{cancel=true;}}),{name:'AbortError'});
});
