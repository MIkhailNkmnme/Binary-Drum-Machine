const test=require('node:test'),assert=require('node:assert/strict');
const R=require('./mayatnik-rombo.js'),Grid=require('./mayatnik-pixel-grid.js'),Projection=require('./mayatnik-xorrom-projection.js'),Field=require('./mayatnik-xorrom-field.js'),Music=require('./mayatnik-xorrom.js');
function fixture(width=31,height=8){const bits=Int8Array.from({length:width*height},(_,q)=>q%11===0?-1:q%3?1:0);return {bits,width,height,readBit:(x,y)=>bits[y*width+x],readRGB:(x,y)=>{const code=(y*width+x)%8;return [0,3,5].includes(code)?code:-1;},current:()=>true};}
function expected(plan,source,ratio,x,y,flip,width,height){const p=plan.pick({x:((flip?width-1-x:x)+.5)/ratio,y:((flip?height-1-y:y)+.5)/ratio});if(!p)return [-1,-1];const sx=Math.floor(p.x),sy=Math.floor(p.y),bit=source.readBit(sx,sy),color=bit<0?-1:source.readRGB?.(sx,sy);return [color===-1?-1:bit,color];}
test('every Rombo assembly, angle and whole-view half turn follows exact native bits and RGB categories',async()=>{
 const source=fixture();
 for(const {id:assembly}of R.variants)for(let angle=0;angle<360;angle+=45)for(const flip of [false,true]){
  const plan=R.plan(source.width,source.height,{assembly,angle},{sides:true}),p=Grid.policy({width:plan.outputWidth,height:plan.outputHeight,angle,halfCells:assembly!==16}),ratio=p.minScale;
  const score=await Projection.capture(plan,source,{ratio,flip,yieldTask:()=>Promise.resolve()});assert.equal(score.projection.kind,'rombo');
  for(let y=0;y<score.height;y++){let ones=0,total=0;const colors=new Uint32Array(8);
   for(let x=0;x<score.width;x++){const [bit,color]=expected(plan,source,ratio,x,y,flip,score.width,score.height);assert.equal(score.rows[y].bits[x],bit);if(bit>=0){ones+=bit;total++;colors[color]++;}}
   assert.equal(score.rows[y].ones,ones);assert.equal(score.rows[y].total,total);assert.deepEqual(score.rows[y].colors,colors);
  }
 }
});
test('gaps stay missing and silent; cache reuses addresses while reading the new frame',async()=>{
 const source=fixture(),plan=R.plan(31,8,{assembly:1},{sides:true}),original=plan.pick;let calls=0;plan.pick=p=>{calls++;return original(p);};
 const a=await Projection.capture(plan,source,{ratio:2}),count=calls;assert.ok(a.rows.some(row=>row.bits.includes(-1)));source.bits.fill(0);source.readRGB=()=>0;
 const b=await Projection.capture(plan,source,{ratio:2,flip:true});assert.equal(calls,count);assert.ok(b.rows.every(row=>!row.ones));assert.ok(b.rows.every((row,i)=>!Music.notesForRow(row,i,{source:'rgb'}).length));
 assert.ok(a.rows.some(row=>row.ones));
});
test('mapping outlives a cancelled old frame but never reads its stale bits',async()=>{
 const source=fixture(511,130),plan=R.plan(511,130,{assembly:16},{sides:true});let live=true,reads=0,calls=0;source.current=()=>live;source.readBit=()=>{reads++;return 1;};const pick=plan.pick;plan.pick=p=>{calls++;return pick(p);};
 const pending=Projection.capture(plan,source);live=false;await assert.rejects(pending,{name:'AbortError'});assert.equal(reads,0);const built=calls;live=true;await Projection.capture(plan,source,{yieldTask:()=>Promise.resolve()});assert.equal(calls,built);assert.ok(reads>0);
});
test('a changed projection cancels its mapping and can rebuild when selected again',async()=>{
 const source=fixture(511,130),plan=R.plan(511,130,{assembly:16},{sides:true});let valid=true;const pending=Projection.capture(plan,source,{geometryCurrent:()=>valid});valid=false;await assert.rejects(pending,{name:'AbortError'});valid=true;const score=await Projection.capture(plan,source,{geometryCurrent:()=>valid,yieldTask:()=>Promise.resolve()});assert.ok(score.height>0);
 await assert.rejects(Projection.capture(plan,source,{cancelled:()=>true}),{name:'AbortError'});
});
test('bit-mode neighbour notes and WAV describe the projected rows, not the unassembled field',async()=>{
 const source=fixture(15,4);delete source.readRGB;const plan=R.plan(15,4,{assembly:16,angle:45},{sides:true}),ratio=Math.SQRT2,score=await Projection.capture(plan,source,{ratio});
 const direct=await Field.capture({width:score.width,height:score.height,readBit:(x,y)=>expected(plan,source,ratio,x,y,false,score.width,score.height)[0]});
 assert.deepEqual(score.rows,direct.rows);const settings={source:'melody',gain:.2,loop:false};assert.deepEqual(Music.renderWav(score,settings).bytes,Music.renderWav(direct,settings).bytes);assert.ok(score.rows.some((row,i)=>Music.notesForRow(row,i,settings).length));
});
test('invalid or oversized assembled scores fail without sampling or modifying source bits',async()=>{
 const source=fixture(),before=source.bits.slice();await assert.rejects(Projection.capture({...R.plan(31,8),available:false},source),/доступная сборка/);
 await assert.rejects(Projection.capture({...R.plan(31,8),outputWidth:1e9},source),/слишком большая/);assert.deepEqual(source.bits,before);await assert.rejects(Projection.capture({},{}),/исходных клеток/);
});
