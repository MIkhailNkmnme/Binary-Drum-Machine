const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Space=require('./xor-space.js'),Seq=require('./xor-space-sequence.js');
const assignments=()=>Array.from({length:4},()=>({direction:'auto',roll:0,offset:[0,0,0]}));
const source=(points=Array.from({length:4},()=>[[0,0],[0,1]]))=>({points,order:[0,1,2,3],turn:[2,3,0,1],radius:0,offsets:Array.from({length:4},()=>({x:0,y:0})),mode:'union',selected:null});
test('fixed centres: all 24^4 configurations; shared pivots follow explicit policy',()=>{
 const s=source(),a=assignments();
 const allowed=Seq.enumerate(s,a,{allowSharedCentres:true});
 assert.equal(allowed.total,331776);assert.equal(allowed.codes.length,6*5*4*3*4**4);assert.equal(new Set(allowed.codes).size,allowed.codes.length);
 for(const code of allowed.codes){const directions=Seq.decode(code).map(n=>Math.floor(n/4));assert.equal(new Set(directions).size,4);}
 assert.equal(Seq.enumerate(s,a,{allowSharedCentres:false}).codes.length,0);
 for(let i=0;i<4;i++)a[i].offset=[i*40,0,0];
 assert.equal(Seq.enumerate(s,a,{allowSharedCentres:false}).codes.length,331776);
});
test('all generated orientations keep current world centres, including nonzero radius and custom offsets',()=>{
 const s=source(),a=assignments();s.radius=4;s.offsets=[{x:2,y:-1},{x:-1,y:3},{x:4,y:0},{x:0,y:-3}];a[1]={direction:'+Z',roll:3,offset:[-5,4,7]};
 const initial=Space.buildModel(s,a),prepared=Seq.prepare(s,a);
 for(let n=0;n<24;n++){
  const state=Seq.assignmentsAt(prepared,Seq.encode([n,n,n,n])),m=Space.buildModel(s,state);
  for(let i=0;i<4;i++)assert.deepEqual(m.figures[i].anchor,initial.figures[i].anchor);
 }
 assert.deepEqual(s.radius,4);assert.deepEqual(a[1].offset,[-5,4,7]);
});
test('body versus other pivot is a collision even when shared gray centres are allowed',()=>{
 const a={body:new Set(['1,0,0']),centre:'0,0,0'},b={body:new Set(['2,0,0']),centre:'1,0,0'};
 assert.equal(Seq.compatible(a,b,true),false);
 assert.equal(Seq.compatible(a,{body:new Set(['1,0,0']),centre:'2,0,0'},true),false);
 assert.equal(Seq.compatible(a,{body:new Set(['0,1,0']),centre:'0,0,0'},true),true);
});
test('real four masks: every accepted state has no body/body or body/pivot overlap',()=>{
 const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8'),masks=Function('return '+html.match(/const masks=(\[[\s\S]*?\n\]);/)[1])();
 const points=masks.map(rows=>{const x0=rows[0].indexOf('1');return rows.flatMap((r,y)=>[...r].flatMap((b,x)=>b==='1'?[[x-x0,y]]:[]));});
 const s=source(points),a=assignments(),prepared=Seq.prepare(s,a),result=Seq.enumerate(s,a,{allowSharedCentres:true});assert.ok(result.codes.length>0);
 for(const code of result.codes){const figures=Space.buildModel(s,Seq.assignmentsAt(prepared,code)).figures,occupied=new Set(),centres=new Set(figures.map(f=>f.anchor.join(',')));
  for(const f of figures)for(const p of f.cells){const k=p.join(',');assert.ok(!occupied.has(k));assert.ok(!centres.has(k));occupied.add(k);}
 }
 console.log('Actual masks: '+result.codes.length+' / '+result.total+' collision-free orientations');
});
