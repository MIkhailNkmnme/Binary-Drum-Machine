'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Core=require('./mayatnik-animatrix-core.js');
const Source=require('./mayatnik-animatrix-source.js');
const state=(extra={})=>({...Source.defaults(),animatrixOn:true,animatrixSource:Source.demo(8,'example'),rows:8,...extra});
function oracle(s,max=512){
  const e=Core.create(Source.decode(s.animatrixSource),{algorithm:s.animatrixAlgorithm,direction:s.animatrixTiming==='rows'?'down':s.animatrixDirection,scan:s.animatrixTiming==='rows'});
  const seen=[Core.snapshot(e)],length=Source.cycleFrames(s);
  for(let cycle=1;cycle<=max;cycle++){
    Core.advance(e,length);
    for(let i=0;i<seen.length;i++)if(Core.sameState(e,seen[i]))return {firstCycle:i,periodCycles:cycle-i};
    seen.push(Core.snapshot(e));
  }
  return null;
}
test('finite files retain their limit; infinite windows extend without changing source identity',()=>{
  const finite=state({animatrixCycles:3});assert.equal(Source.frames(finite),21);
  const old={...finite};delete old.animatrixCycleMode;delete old.animatrixFrameMax;
  assert.equal(Source.normalize(old).animatrixCycleMode,'finite');
  assert.throws(()=>Source.advance(Source.create(finite),Infinity));
});
test('unlimited source continues beyond 64 cycles and range growth does not reset identity',()=>{
  const s=state({animatrixCycleMode:'infinite'}),key=Source.stateKey(s),e=Source.create(s);
  Object.assign(s,Source.extend(s,700));assert.equal(Source.frames(s),700);assert.equal(Source.stateKey(s),key);
  Source.advance(e,700);assert.equal(e.sourceFrame,700);assert.equal(e.cycle,100);
  assert.throws(()=>Source.normalize({...s,animatrixCycleMode:'unknown'}));
  assert.throws(()=>Source.extend(s,Infinity));
});
test('Brent exact recurrence agrees with independent saved-state oracle',()=>{
  let comparisons=0;
  for(const algorithm of Core.algorithms)for(const timing of ['rows','matrix'])for(const direction of timing==='rows'?['down']:Core.directions){
    const s=state({animatrixSource:Source.demo(8,'example',algorithm),animatrixAlgorithm:algorithm,animatrixTiming:timing,animatrixDirection:direction,animatrixCycleMode:'repeat'});
    const expected=oracle(s);if(!expected)continue;
    const e=Source.create(s);let info;
    for(let i=0;i<12000;i++){Source.advance(e);info=Source.repeatInfo(e);if(info.complete)break;}
    assert.equal(info.complete,true,algorithm+'/'+timing+'/'+direction);
    assert.equal(info.firstCycle,expected.firstCycle,algorithm+'/'+timing+'/'+direction+' start');
    assert.equal(info.periodCycles,expected.periodCycles,algorithm+'/'+timing+'/'+direction+' period');
    assert.equal(info.repeatFrame,(info.firstCycle+info.periodCycles)*Source.cycleFrames(s));
    comparisons++;
  }
  assert.ok(comparisons>=25,'oracle must cover all six algorithms, scans and four matrix directions');
});
test('seek and chunked advance preserve recurrence; reset discards the previous result',()=>{
  const s=state({animatrixCycleMode:'repeat'}),a=Source.create(s),b=Source.create(s);
  Source.advance(a,1000);Source.seek(b,1000);
  assert.ok(Core.sameState(a,b));assert.deepEqual(Source.repeatInfo(a),Source.repeatInfo(b));
  Source.reset(a);assert.equal(a.sourceFrame,0);assert.equal(Source.repeatInfo(a).complete,false);
  Source.advance(a,1000);assert.deepEqual(Source.repeatInfo(a),Source.repeatInfo(b));
});
test('recurrence comparison includes styling, empty fills, selection and Areas order',()=>{
  const a=Core.create(Source.decode(Source.demo(8,'example'))),b=Core.snapshot(a);
  assert.ok(Core.sameState(a,b));
  for(const key of ['colours','filled','fills','bold','automatic','selection','present','bits']){
    const before=b[key][0];b[key][0]^=1;assert.equal(Core.sameState(a,b),false,key);b[key][0]=before;
  }
  b.areas[0].x++;assert.equal(Core.sameState(a,b),false);
});
test('optional flash changes include actual cells and ignore selection-only changes',()=>{
  const s=state({animatrixCycleMode:'infinite'}),e=Source.create(s);
  assert.equal(Source.advance(e).changedCells,undefined);
  Source.reset(e);e.trackChanges=true;
  const before=Core.snapshot(e),report=Source.advance(e);
  assert.ok(report.changedCells.length>0);
  assert.equal(report.changedCells.includes(5),false,'deselected top seed without a visual change is not a flash');
  for(const q of report.changedCells)assert.ok(['bits','present','colours','bold','automatic','fills','filled'].some(key=>before[key][q]!==e[key][q]));
  Source.reset(e);const combined=Source.advance(e,15);
  assert.equal(new Set(combined.changedCells).size,combined.changedCells.length);
});
