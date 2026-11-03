'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Visual=require('./mayatnik-xorrom-visual'),Music=require('./mayatnik-xorrom'),bank=require('./mayatnik-xorrom-bank');
function canvas(){const fills=[],strokes=[];return {fills,strokes,canvas:{width:1280,height:720},fillRect(x,y,w,h){fills.push({colour:this.fillStyle,x,y,w,h});},strokeRect(x,y,w,h){strokes.push({colour:this.strokeStyle,x,y,w,h});}};}
test('contiguous logical ones are one run, zero and absent cells split the highlight',()=>{
 assert.deepEqual(Visual.runs(Int8Array.of(1,1,1,0,0,1,1),7,0),[[0,3],[5,2]]);
 assert.deepEqual(Visual.runs(Int8Array.of(1,-1,1,0,1),5,0),[[0,1],[2,1],[4,1]]);
});
test('canonical score timing honours stride, swing, geometry and sample-exact boundaries',()=>{
 const source={rows:Array.from({length:6},(_,index)=>({ones:1,colors:Uint32Array.of(0,1,0,0,0,0,0,0),geometry:{triangle:{width:index===0?8:2,height:index===0?2:8,area:4,perimeter:8,symmetryHeight:4}}}))};
 const settings={bpm:120,division:8,stride:2,swing:.5,autoGeometry:true,geometrySource:'regions'},timeline=Music.scoreTimeline(source,settings);
 assert.deepEqual(timeline.map(step=>step.index),[0,2,4]);assert.deepEqual(timeline.map(step=>Math.round((step.end-step.start)*22050)),[12403,1378,2757]);
 const prepared={timeline};for(const step of timeline){assert.equal(Visual.stateAt(prepared,step.start).index,step.index);assert.equal(Visual.stateAt(prepared,(step.start+step.end)/2).index,step.index);}
 assert.equal(Visual.stateAt(prepared,timeline.at(-1).end),null);assert.equal(Visual.stateAt(prepared,-1),null);assert.equal(Visual.stateAt(prepared,NaN),null);
});
test('all four saved scores highlight exactly their actual one cells and clear during effect tails',async()=>{
 for(const entry of bank){const prepared=await Visual.prepare(entry),source=prepared.source;
  assert.equal(source.width,285);assert.equal(source.height,128);assert.equal(prepared.timeline.length,Math.ceil(128/entry.settings.stride));
  for(const step of prepared.timeline){const c=canvas(),time=(step.start+step.end)/2,l=Visual.draw(c,prepared,time,{width:1280,height:720}),active=c.fills.filter(fill=>fill.colour===Visual.palette.active);
   assert.equal(l.index,step.index);assert.deepEqual(active.map(fill=>[(fill.x-l.left)/l.scale,fill.w/l.scale]),step.onesRuns);
   const bright=new Set();for(const fill of active){assert.equal(fill.y,l.top+step.index*l.scale);assert.equal(fill.h,l.scale);for(let x=(fill.x-l.left)/l.scale;x<(fill.x+fill.w-l.left)/l.scale;x++)bright.add(x);}
   for(let x=0;x<source.width;x++)assert.equal(bright.has(x),source.bits[step.index*source.width+x]===1,entry.id+' row '+step.index+' cell '+x);
  }
  const c=canvas();Visual.draw(c,prepared,prepared.timeline.at(-1).end,{width:1280,height:720});assert.ok(!c.fills.some(fill=>fill.colour===Visual.palette.active));
 }
});
