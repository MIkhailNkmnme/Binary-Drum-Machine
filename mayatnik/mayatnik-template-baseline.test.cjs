const test=require('node:test'),assert=require('node:assert/strict'),Baseline=require('./mayatnik-template-baseline.js');
function field(){const b=Baseline.create(),key='frame1:flat',paint=Uint32Array.of(10,20,30,40),bits=Int8Array.of(-1,-1,-1,-1);return {b,key,paint,bits,write(q,p,v){b.write(key,q,paint[q],bits[q],p,v);paint[q]=p;bits[q]=v;}};}
test('original masks, own bits, geometry, colour and manual axes remain immutable; derived copies vanish on Reset',()=>{
 const b=Baseline.create(),item={id:'original',hex:'#123456',view:{height:100,down:0,x:0},templateAxes:{manualH:{position:2,visible:true}},parts:[{p:0,ox:0,axis:3,mask:{x:1,y:2,width:2,height:2,data:Uint32Array.of(7,0,8,9)},bitsData:Int8Array.of(0,-1,1,0),sourceIndices:Uint32Array.of(0,1,2,3)}]};b.remember(item);
 item.parts[0].mask.data[0]=99;item.parts[0].bitsData[0]=1;item.view.down=8;item.view.height=250;item.hex='#ffffff';item.templateAxes.manualH.position=9;
 b.remember({...item,id:'mirror'},true);const reset=b.originals([item,{...item,id:'mirror'}]);assert.equal(reset.length,1);assert.equal(reset[0].hex,'#123456');assert.equal(reset[0].view.down,0);assert.equal(reset[0].view.height,100);assert.deepEqual([...reset[0].parts[0].mask.data],[7,0,8,9]);assert.deepEqual([...reset[0].parts[0].bitsData],[0,-1,1,0]);assert.equal(reset[0].templateAxes.manualH.position,2);
 reset[0].parts[0].mask.data.fill(0);assert.equal(b.originals()[0].parts[0].mask.data[0],7);
});
test('lift, cut, trail and repeated template writes roll back without touching source bits or unrelated paint',()=>{
 const f=field(),source=Int8Array.of(0,1,0,1),copy=source.slice();f.write(0,0,1);f.write(1,999,0);f.write(0,77,0);const result=f.b.clean(f.key,f.paint,f.bits);assert.deepEqual([...result.paint],[10,20,30,40]);assert.deepEqual([...result.bits],[-1,-1,-1,-1]);assert.deepEqual(source,copy);assert.deepEqual([...f.paint],[77,999,30,40]);
});
test('ordinary paint after a template write wins, including exactly the same displayed colour',()=>{
 for(const colour of [99,700]){const f=field();f.write(0,99,1);const entry={indices:Uint32Array.of(0),previous:Uint32Array.of(99),next:Uint32Array.of(colour)};f.paint[0]=colour;f.b.recordHistory(entry,f.key,f.paint,f.bits);const result=f.b.clean(f.key,f.paint,f.bits);assert.equal(result.paint[0],colour);assert.equal(result.bits[0],-1);assert.equal(result.paint[1],20);}
});
test('Undo/Redo of ordinary paint restores its clean rollback values, preserving chronology across template writes',()=>{
 const f=field();f.write(0,99,1);const own={indices:Uint32Array.of(0),previous:Uint32Array.of(10),next:Uint32Array.of(99)};f.b.recordHistory(own,f.key,f.paint,f.bits,true);
 const manual={indices:Uint32Array.of(0),previous:Uint32Array.of(99),next:Uint32Array.of(55)};f.paint[0]=55;f.b.recordHistory(manual,f.key,f.paint,f.bits);
 f.paint[0]=99;f.b.applyHistory(manual,false,f.key,f.paint,f.bits);assert.equal(f.b.clean(f.key,f.paint,f.bits).paint[0],10);
 f.paint[0]=55;f.b.applyHistory(manual,true,f.key,f.paint,f.bits);assert.equal(f.b.clean(f.key,f.paint,f.bits).paint[0],55);
 assert.equal(f.b.cleanHistory(own,f.key),null);const clean=f.b.cleanHistory(manual,f.key);assert.equal(clean.previous[0],10);assert.equal(clean.next[0],55);assert.equal(manual.previous[0],99);assert.equal(f.b.cleanHistory({transientView:{}},f.key),null);
});
test('ordinary bit edits, unrecorded auto paint and independent raster caches survive template cleanup',()=>{
 const f=field();f.write(0,99,1);const entry={indices:Uint32Array.of(0),previous:Uint32Array.of(99),next:Uint32Array.of(50),bitsPrevious:Int8Array.of(1),bitsNext:Int8Array.of(0)};f.paint[0]=50;f.bits[0]=0;f.b.recordHistory(entry,f.key,f.paint,f.bits);f.paint[1]=88;
 f.b.write('frame1:joined',0,5,-1,7,1);assert.deepEqual([...f.b.clean(f.key,f.paint,f.bits).paint],[50,88,30,40]);assert.equal(f.b.clean(f.key,f.paint,f.bits).bits[0],0);assert.equal(f.b.clean('frame1:joined',Uint32Array.of(7),Int8Array.of(1)).paint[0],5);
 f.b.clear();assert.equal(f.b.hasOriginals,false);assert.equal(f.b.hasEffects,false);
});
test('clearing the last painted pixels can drop arrays; cleanup recreates the complete raster without truncation',()=>{
 const b=Baseline.create();b.write('field',0,10,-1,0,-1,10);b.write('field',8,20,-1,0,-1,10);const clean=b.clean('field',null,null);assert.equal(clean.paint.length,10);assert.equal(clean.paint[0],10);assert.equal(clean.paint[8],20);assert.equal(clean.bits,null);
});
test('random chronological Undo/Redo agrees with independent replay excluding all template writes',()=>{
 let seed=71;const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 for(let trial=0;trial<80;trial++){
  const b=Baseline.create(),key='frame',initial=Uint32Array.from({length:8},(_,q)=>q+10),paint=initial.slice(),bits=new Int8Array(8).fill(-1),done=[],redo=[];
  for(let step=0;step<80;step++){
   const action=random(5);
   if(action===0&&done.length){const e=done.pop(),q=e.indices[0];paint[q]=e.previous[0];bits[q]=e.bitsPrevious[0];b.applyHistory(e,false,key,paint,bits);redo.push(e);}
   else if(action===1&&redo.length){const e=redo.pop(),q=e.indices[0];paint[q]=e.next[0];bits[q]=e.bitsNext[0];b.applyHistory(e,true,key,paint,bits);done.push(e);}
   else{const q=random(8),owned=!!random(2),next=random(40),bit=random(3)-1,e={indices:Uint32Array.of(q),previous:Uint32Array.of(paint[q]),next:Uint32Array.of(next),bitsPrevious:Int8Array.of(bits[q]),bitsNext:Int8Array.of(bit),owned};
    if(owned)b.write(key,q,paint[q],bits[q],next,bit,8);paint[q]=next;bits[q]=bit;b.recordHistory(e,key,paint,bits,owned);done.push(e);redo.length=0;}
   const expected=initial.slice(),expectedBits=new Int8Array(8).fill(-1);for(const e of done)if(!e.owned){expected[e.indices[0]]=e.next[0];expectedBits[e.indices[0]]=e.bitsNext[0];}
   const clean=b.clean(key,paint,bits);assert.deepEqual(clean.paint,expected,`paint trial${trial} step${step}`);assert.deepEqual(clean.bits,expectedBits,`bits trial${trial} step${step}`);
  }
 }
});
