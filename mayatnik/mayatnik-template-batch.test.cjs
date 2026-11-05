const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Batch=require('./mayatnik-template-batch.js'),Matcher=require('./mayatnik-template-matcher.js');
const entry=(id,rows)=>({id,name:'Фигура '+id,shape:{rk:1,parts:[{width:rows[0].length,height:rows.length,data:rows.flatMap(row=>Array.from(row,c=>c==='1'?0xff123456:0))}]}});
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function setup(entries,data,width,extra={}){
  const owner={},published=[],errors=[];let key=0,field={width,height:data.length/width,data};
  const api=Batch.create({matcher:Matcher,entries:()=>entries,capture:()=>({owner,key}),field:async()=>field,current:f=>f===field,result:r=>{if(r)published.push(r);},error:e=>errors.push(e),yieldTask:turn,...extra});
  return {api,published,errors,next(data2=data){key++;field={...field,data:data2};},get field(){return field;}};
}
// Independent coordinate oracle: filled cells are uniform, their four side
// neighbours must differ. Transparent pixels beyond that boundary are irrelevant.
function oracle(entries,field){
  const hits=[],mask=Array(field.data.length).fill(0),{width:W,height:H,data}=field;
  for(const e of entries){const p=e.shape.parts[0],variants=[],seen=new Set();
    for(const reflect of [false,true]){const cells=[];for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)if(p.data[y*p.width+x])cells.push([reflect?p.width-1-x:x,y]);
      const stamp=cells.map(([x,y])=>y*p.width+x).sort((a,b)=>a-b).join(',');if(seen.has(stamp))continue;seen.add(stamp);variants.push(cells);}
    for(let pi=0;pi<variants.length;pi++){const cells=variants[pi],occupied=new Set(cells.map(c=>c.join(',')));
      for(let y=0;y<=H-p.height;y++)for(let x=0;x<=W-p.width;x++){
        const bit=data[(y+cells[0][1])*W+x+cells[0][0]];if(bit<0)continue;
        const good=cells.every(([dx,dy])=>data[(y+dy)*W+x+dx]===bit&&[[-1,0],[1,0],[0,-1],[0,1]].every(([sx,sy])=>{
          const a=dx+sx,b=dy+sy;if(occupied.has(a+','+b))return true;const xx=x+a,yy=y+b;return xx<0||xx>=W||yy<0||yy>=H||data[yy*W+xx]!==bit;
        }));
        if(good){hits.push([e.id,x,y,pi,bit]);for(const [dx,dy] of cells)mask[(y+dy)*W+x+dx]=1;}
      }
    }
  }
  return {hits:hits.sort(),mask};
}
test('all entries run on every new frame, zero hits remain complete, redraws do not repeat',async()=>{
  const entries=[entry('dot',['1']),entry('bar',['11'])],data=Int8Array.from([0,0,0,0,1,0,0,0,0]);
  let reads=0;const s=setup(entries,data,3,{field:async()=>{reads++;return s.field;}});s.api.enable();
  const first=s.api.ensure();assert.equal(s.api.ensure(),first);await first;
  assert.equal(s.api.complete,true);assert.deepEqual(s.published[0].entries.map(e=>[e.id,e.count]),[['dot',1],['bar',0]]);
  await s.api.ensure();assert.equal(reads,1);s.next(new Int8Array(9));assert.equal(s.api.getSelection(),null);await s.api.ensure();
  assert.deepEqual(s.published[1].entries.map(e=>e.count),[0,0]);assert.equal(s.api.complete,true);
  s.next(data);await s.api.ensure();assert.equal(s.published[2].entries[0].count,1);assert.equal(reads,3);
});
test('chunked silhouettes agree with independent oracle across boundaries, reflections, empty cells and colours',async()=>{
  const entries=[entry('L',['10','11']),entry('dot',['1']),entry('bar',['11']),entry('tall',Array(35).fill('1'))];
  let seed=123;const data=Int8Array.from({length:9*77},()=>{seed=(seed*1664525+1013904223)>>>0;return seed%7===0?-1:seed%3===0?1:0;});
  for(let y=18;y<53;y++){data[y*9+3]=1;data[y*9+2]=0;data[y*9+4]=0;}data[17*9+3]=data[53*9+3]=0;
  const before=Array.from(data),shapes=JSON.stringify(entries),s=setup(entries,data,9);s.api.enable();await s.api.ensure();
  assert.equal(s.errors.length,0);const actual=s.published[0],expected=oracle(entries,s.field);
  assert.deepEqual(actual.matches.map(m=>[m.entryId,m.x,m.y,m.patternIndex,m.bit]).sort(),expected.hits);
  assert.deepEqual(Array.from(actual.selected),expected.mask);assert.equal(actual.selectedCount,expected.mask.reduce((a,b)=>a+b,0));
  assert.deepEqual(Array.from(data),before);assert.equal(JSON.stringify(entries),shapes);assert.deepEqual(actual.instances,[]);
  assert.ok(actual.entries.find(e=>e.id==='tall').matches.some(m=>m.y===18));
});
test('duplicate selected IDs collapse, equivalent silhouettes keep separate entry boundaries',async()=>{
  const entries=[entry('a',['1']),entry('b',['1'])],s=setup(entries,Int8Array.from([0,0,0,0,1,0,0,0,0]),3);
  s.api.enable(['a','a','b']);await s.api.ensure();assert.deepEqual(s.api.snapshot().entryIds,['a','b']);
  assert.equal(s.published[0].count,2);assert.equal(s.published[0].selectedCount,1);assert.deepEqual(s.published[0].entries.map(e=>e.count),[1,1]);
});
test('stale asynchronous fields never publish; newer frames serialize behind cancellation',async()=>{
  const gate=deferred(),s=setup([entry('a',['1'])],Int8Array.from([1]),1);let calls=0,active=0,maxActive=0;
  const api=Batch.create({matcher:Matcher,entries:()=>[entry('a',['1'])],capture:()=>({owner:s,key:s.field}),field:async()=>{calls++;active++;maxActive=Math.max(maxActive,active);const f=s.field;if(calls===1)await gate.promise;active--;return f;},current:f=>f===s.field,result:r=>{if(r)s.published.push(r);},yieldTask:turn});
  api.enable();const a=api.ensure();await turn();s.next(Int8Array.from([0]));const b=api.ensure();await turn();assert.equal(calls,1);
  gate.resolve();await Promise.all([a,b]);assert.equal(maxActive,1);assert.equal(calls,2);assert.equal(s.published.length,1);assert.equal(s.published[0].field,s.field);assert.equal(api.complete,true);
});
test('OFF and restore cancel late work; idle drains cancelled work',async()=>{
  const gate=deferred(),data=Int8Array.from([1]),s=setup([entry('a',['1'])],data,1,{field:async()=>{await gate.promise;return s.field;}});
  s.api.enable(['a']);const job=s.api.ensure();await turn();s.api.off();let drained=false;s.api.idle().then(()=>drained=true);await turn();assert.equal(drained,false);
  gate.resolve();await job;assert.equal(s.published.length,0);assert.equal(s.api.on,false);assert.equal(s.api.busy,false);
  s.api.restore({on:true,entryIds:['a']});await s.api.ensure();assert.equal(s.published.length,1);assert.equal(s.api.complete,true);
  s.api.invalidate();assert.equal(s.api.complete,false);assert.equal(s.api.getSelection(),null);await s.api.ensure();assert.equal(s.published.length,2);
});
test('errors block their exact frame without marking completion; invalidate permits retry',async()=>{
  let fail=true;const s=setup([entry('a',['1'])],Int8Array.from([1]),1,{field:async()=>{if(fail)throw Error('readback failed');return s.field;}});
  s.api.enable();await s.api.ensure();assert.equal(s.api.blocked,true);assert.equal(s.api.complete,false);assert.equal(s.published.length,0);await s.api.ensure();assert.equal(s.errors.length,1);
  fail=false;s.api.invalidate();await s.api.ensure();assert.equal(s.api.blocked,false);assert.equal(s.api.complete,true);
});
test('missing entries, duplicate library IDs and exact metadata limit never publish partial results',async()=>{
  for(const kind of ['missing','duplicate','limit']){
    const entries=[entry('a',['1'])];if(kind==='duplicate')entries.push(entry('a',['11']));
    const s=setup(entries,Int8Array.from([1,0,1,0,1,0,1,0,1]),3,{maxMatches:2});s.api.enable(kind==='missing'?['lost']:['a']);await s.api.ensure();
    assert.equal(s.api.blocked,true,kind);assert.equal(s.api.complete,false,kind);assert.equal(s.errors.length,1,kind);assert.equal(s.published.length,0,kind);
  }
});
test('persisted selection is copied, validated and available in the browser namespace',()=>{
  const ids=['a'],state=Batch.normalize({on:true,entryIds:ids});ids.push('b');assert.deepEqual(state.entryIds,['a']);
  assert.deepEqual(Batch.normalize(null),{on:false,entryIds:[]});assert.throws(()=>Batch.normalize({on:true,entryIds:[]}));assert.throws(()=>Batch.normalize({on:true,entryIds:[2]}));
  const context={};vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/mayatnik-template-batch.js','utf8'),context);assert.equal(typeof context.MayatnikTemplateBatch.create,'function');
});
