'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Core=require('./mayatnik-animatrix-core.js');
const Source=require('./mayatnik-animatrix-source.js');

function state(source,extra={}){
  return {...Source.defaults(),animatrixOn:true,animatrixAlgorithm:'copyRows',animatrixCopyRowsLayout:'mirrorGaps',animatrixSourceKind:'clean',animatrixSource:source,rows:source.height,animatrixCycleMode:'infinite',...extra};
}
function reference(seed,direction,frames){
  const bits=Array.from(seed.bits),present=Array.from(seed.present),protectedCells=Array.from(seed.present),marks=Array(bits.length).fill(0);
  const {width,height}=seed;
  for(let frame=0;frame<frames;frame++){
    const boundary=direction==='up'?height-2-frame%(height-1):frame%(height-1);
    const beforeBits=bits.slice(),beforePresent=present.slice();
    for(let y=0;y<height;y++){
      if(direction==='up'?y<=boundary:y>boundary)continue;
      const targetRow=2*boundary+1-y;
      if(targetRow<0||targetRow>=height)continue;
      for(let x=0;x<width;x++){
        const a=y*width+x,b=targetRow*width+x;
        if(!beforePresent[a]||protectedCells[b])continue;
        bits[b]=(present[b]?bits[b]:0)^beforeBits[a];present[b]=1;marks[b]=beforeBits[a]?1:2;
      }
    }
  }
  return {bits,present,marks};
}
function bytesOwned(...roots){
  const objects=new Set(),buffers=new Set();
  function visit(value){
    if(!value||typeof value!=='object'||objects.has(value))return;
    objects.add(value);
    if(ArrayBuffer.isView(value)){buffers.add(value.buffer);return;}
    for(const key of Object.getOwnPropertyNames(value))visit(value[key]);
  }
  roots.forEach(visit);return [...buffers].reduce((sum,buffer)=>sum+buffer.byteLength,0);
}

test('gap reflections match an independent whole-portion oracle in both directions over cycles and rewind',()=>{
  const width=9,height=8,seed={width,height,bits:new Uint8Array(width*height),present:new Uint8Array(width*height)};
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if((x*3+y*5)%7<3){const q=y*width+x;seed.present[q]=1;seed.bits[q]=(x+y)%2;}
  for(const direction of ['down','up']){
    const s=state(Source.encode(seed),{animatrixDirection:direction}),engine=Source.create(s);
    for(let frame=0;frame<=3*(height-1);frame++){
      const expected=reference(seed,direction,frame);
      assert.deepEqual(Array.from(engine.bits),expected.bits,`${direction} bits ${frame}`);
      assert.deepEqual(Array.from(engine.present),expected.present,`${direction} presence ${frame}`);
      assert.deepEqual(Array.from(engine.copyMarks),expected.marks,`${direction} marks ${frame}`);
      assert.equal(engine.copyAxis,direction==='up'?height-1.5-frame%(height-1):.5+frame%(height-1));
      Source.advance(engine);
    }
    Source.seek(engine,9);const expected=reference(seed,direction,9);
    assert.deepEqual(Array.from(engine.bits),expected.bits);
    assert.deepEqual(Array.from(engine.present),expected.present);
    assert.notEqual(Source.stateKey(s),Source.stateKey({...s,animatrixDirection:direction==='up'?'down':'up'}));
  }
});

test('gap zero landing materializes a cell and mark-only landing reports the changed row and cell',()=>{
  const seed={width:1,height:3,bits:[0,0,0],present:[1,0,0]};
  const engine=Core.create(seed,{algorithm:'copyRows',copyRowsGaps:true});
  engine.trackChanges=true;
  const first=Core.advance(engine);assert.equal(engine.present[1],1);assert.equal(engine.bits[1],0);
  assert.deepEqual(first.dirtyRows,[1]);assert.deepEqual(first.changedCells,[1]);
  Core.advance(engine);engine.copyMarks[1]=1;
  const again=Core.advance(engine);assert.equal(engine.copyMarks[1],2);
  assert.deepEqual(again.dirtyRows,[1]);assert.deepEqual(again.changedCells,[1]);
});

test('copyRows checkpoints and forks share immutable metadata but isolate mutable state',()=>{
  for(const layout of [undefined,'mirror','mirrorByAxis','mirrorExtend','mirrorWrap','mirrorExcel','mirrorGaps']){
    const engine=Source.create(state(Source.demo(16,'clean','copyRows'),{animatrixCopyRowsLayout:layout}));
    const procedural=Source.resizeRows(Source.demo(4096,'clean','copyRows'),16,'copyRows');
    const generated=Source.create(state(procedural,{animatrixCopyRowsLayout:layout}));
    assert.ok(Core.sameState(engine,generated),`${layout} generated initial state`);
    const snapshot=Core.snapshot(engine),fork=Core.forkInitial(engine);
    for(const key of ['colours','bold','automatic','fills','filled','selection']){
      assert.equal(engine[key],snapshot[key],`${layout} snapshot ${key}`);
      assert.equal(engine[key],fork[key],`${layout} fork ${key}`);
    }
    for(const key of ['bits','present','copyMarks']){assert.notEqual(engine[key],snapshot[key]);assert.notEqual(engine[key],fork[key]);}
    assert.ok(Core.sameState(engine,snapshot));Source.advance(engine,7);Source.advance(generated,7);
    assert.ok(Core.sameState(engine,generated),`${layout} generated advanced state`);
    assert.ok(Core.sameState(snapshot,fork));
    Source.reset(engine);assert.ok(Core.sameState(engine,snapshot));
  }
});

test('quiet copyRows replay preserves exact state, cycles, recurrence and reset while explicitly omitting dirty reports',()=>{
  for(const layout of [undefined,'mirror','mirrorByAxis','mirrorExtend','mirrorWrap','mirrorExcel','mirrorGaps']){
    for(const direction of layout==='mirrorGaps'?['down','up']:['down']){
      const s=state(Source.demo(8,'clean','copyRows'),{animatrixCopyRowsLayout:layout,animatrixDirection:direction,animatrixCycleMode:'repeat'});
      const normal=Source.create(s),quiet=Source.create(s);quiet.trackDirtyRows=false;
      for(let frame=1;frame<=Source.cycleFrames(s)*6;frame++){
        Source.advance(normal);const report=Source.advance(quiet);
        assert.equal(report.dirtyTracking,false);assert.equal(report.changed,null);assert.equal(report.dirtyRows,null);
        assert.ok(Core.sameState(normal,quiet),`${layout}/${direction} ${frame}`);
        assert.deepEqual(Source.repeatInfo(normal),Source.repeatInfo(quiet));
      }
      Source.reset(normal);Source.reset(quiet);assert.ok(Core.sameState(normal,quiet));
      Source.advance(normal,Source.cycleFrames(s)*3);const batch=Source.advance(quiet,Source.cycleFrames(s)*3);
      assert.equal(batch.changed,null);assert.equal(batch.dirtyRows,null);assert.ok(Core.sameState(normal,quiet));
      quiet.trackDirtyRows=true;
      assert.deepEqual(Source.advance(quiet),Source.advance(normal),'normal reporting resumes exactly');
    }
  }
  const engine=Core.create({width:1,height:3,bits:[0,0,0],present:[1,0,0]},{algorithm:'copyRows',copyRowsGaps:true});
  engine.trackDirtyRows=false;engine.trackChanges=true;
  const tracked=Core.advance(engine);assert.equal(tracked.dirtyTracking,undefined);assert.deepEqual(tracked.dirtyRows,[1]);assert.deepEqual(tracked.changedCells,[1]);
  const ordinary=Core.create(Source.decode(Source.demo(8,'clean','two')),{algorithm:'two',scan:true});ordinary.trackDirtyRows=false;
  assert.ok(Array.isArray(Core.advance(ordinary).dirtyRows),'other algorithms retain dirty reports');
});

test('procedural source validates geometry, survives JSON and retains exact version1 capture limits',()=>{
  // Exact key recorded from the unmodified v1 module: saved source references
  // must survive introducing the separate procedural generator contract.
  const legacy=state(Source.demo(8,'clean','copyRows'),{animatrixCycleMode:'finite'});
  assert.equal(Source.stateKey(legacy),'animatrix-v1:693:dae66002:954210b2:copyRows:rows:down:1:finite:mirrorGaps');
  const source=Source.demo(4096,'clean','copyRows');
  assert.equal(source.version,2);assert.equal(source.width,8191);assert.equal(source.anchor,4095);
  assert.ok(JSON.stringify(source).length<160);assert.equal(Source.assertSource(source),source);
  const s=state(source),restored=state(JSON.parse(JSON.stringify(source)));
  assert.equal(Source.stateKey(s),Source.stateKey(restored));
  for(const change of [{width:511},{height:4097},{anchor:1},{generator:'other'},{words:{mode:'raw',data:''}}])assert.throws(()=>Source.assertSource({...source,...change}));
  assert.throws(()=>Source.normalize({...s,animatrixAlgorithm:'two'}));
  assert.throws(()=>Source.encode({width:8191,height:4096}));
  assert.equal(Source.demo(4096,'clean','two').width,511);
  const resized=Source.resizeRows(source,32,'copyRows');assert.equal(resized.width,63);assert.equal(resized.anchor,31);
  const actual=Source.decode(resized),expected=Source.decode(Source.demo(32,'clean','copyRows'));
  for(const key of ['bits','present','colours','selection','filled'])assert.deepEqual(actual[key],expected[key]);
  assert.deepEqual(actual.areas,expected.areas);
  const captured=Source.encode({width:7,height:8,bits:new Uint8Array(56),present:new Uint8Array(56)});
  assert.equal(Source.resizeRows(captured,16,'copyRows').width,7);
});

test('4096-row reflection retains both triangle corners and uses less than 1GB with checkpoints and fork',t=>{
  const source=Source.demo(4096,'clean','copyRows'),s=state(source),engine=Source.create(s);
  assert.deepEqual(Source.geometry(s),{W:8191,H:4096,anchor:4095});
  for(let row=0;row<4096;row++)for(const x of [4095-row,4095+row]){
    const q=row*8191+x;assert.equal(engine.present[q],1);assert.equal(engine.bits[q],1);
  }
  const snapshot=Core.snapshot(engine),fork=Core.forkInitial(engine),bytes=bytesOwned(engine,snapshot,fork);
  assert.ok(bytes<1_000_000_000,`typed arrays consume ${bytes} bytes`);
  t.diagnostic(`Unique typed array buffers, including seed, live engine, repeat checkpoint, explicit checkpoint and fork: ${bytes} bytes`);
  const quietReplay=process.env.MAYATNIK_GAPS_QUIET_REPLAY==='1';
  const frames=process.env.MAYATNIK_GAPS_LONG_CHECK==='1'||quietReplay?1390:3;
  const started=performance.now();
  if(quietReplay){
    engine.trackDirtyRows=false;
    for(let frame=0;frame<frames;frame++){
      const report=Source.advance(engine,1);assert.equal(report.changed,null);assert.equal(report.dirtyRows,null);
    }
    delete engine.trackDirtyRows;
  }else Source.advance(engine,frames);
  t.diagnostic(`4096-row ${quietReplay?'quiet single-frame replay':'advance'} to frame ${frames}: ${Math.round(performance.now()-started)} ms`);
  for(let row=0;row<4096;row++)for(let x=0;x<=row;x++){
    const q=row*8191+4095-row+2*x;
    assert.equal(engine.present[q],1);assert.equal(engine.bits[q],Number((x&(row-x))===0));
  }
  assert.equal(engine.present[8191+4095],1,'first reflection occupies the opposite parity');
  assert.equal(snapshot.present[8191+4095],0);assert.equal(fork.present[8191+4095],0);
});
