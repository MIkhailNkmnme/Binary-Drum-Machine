const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {analyze,scene,compute}=require('./hub-composite-symmetry.js');
const reflection=a=>[Math.cos(2*a),Math.sin(2*a),Math.sin(2*a),-Math.cos(2*a),0,0];
test('the union has a new axis absent from the asymmetric source',()=>{
 const rows=['1','01','110','0111'],a=110*Math.PI/180,g={origin:[0,0],dw:1,dh:Math.sqrt(3),transforms:[[1,0,0,1,0,0]],axis:a,parallel:true},opts={minPairs:1,minRows:2};
 assert.equal(compute(rows,g,opts).segments.length,0);g.transforms.push(reflection(a));
 const result=compute(rows,g,opts);assert.ok(result.segments.some(s=>Math.abs(s.v)<1e-7&&s.rows>=2));
});
test('coincident layers keep multiplicity and bit values instead of XOR',()=>{
 const pts=[[-1,0,'0'],[1,0,'0'],[-1,1,'1'],[1,1,'1']],opt={minPairs:1,minRows:2};
 assert.ok(analyze(pts,opt).segments.length);const conflict=[...pts,[-1,0,'1']];assert.equal(analyze(conflict,opt).segments.length,0);
 assert.ok(analyze([...conflict,[1,0,'1']],opt).segments.length);assert.equal(analyze([...conflict,[-1,0,'0'],[1,0,'1']],opt).segments.length,0);
});
test('moving or rotating the mirror changes the combined motifs',()=>{
 const rows=Array.from({length:12},(_,r)=>'01'.repeat(r+1).slice(0,r+1)),g={origin:[0,0],dw:1,dh:Math.sqrt(3),transforms:[[1,0,0,1,0,0],reflection(Math.PI/2)],axis:Math.PI/2},opts={minPairs:1,minRows:2};
 const a=compute(rows,g,opts);g.transforms[1]=reflection(Math.PI/3);g.axis=Math.PI/3;const b=compute(rows,g,opts);assert.notDeepEqual(a.segments,b.segments);
 g.transforms[1][4]+=1.7;assert.notDeepEqual(b.segments,compute(rows,g,opts).segments);
});
test('all retained pair centres reflect exactly including a common translation',()=>{
 const pts=[];for(let y=0;y<6;y++)for(const x of [-3,-2,-1,1,2,3])pts.push([x+12,y-4,String(Math.abs(x)%2)]);
 const r=analyze(pts,{minPairs:2,minRows:4});assert.ok(r.segments.length);
 for(const s of r.segments){const n=[-Math.sin(s.angle),Math.cos(s.angle)];for(const [x,y,b]of pts){const d=x*n[0]+y*n[1]-s.v;assert.ok(pts.some(([xx,yy,bb])=>bb===b&&Math.hypot(xx-x+2*d*n[0],yy-y+2*d*n[1])<1e-6));}}
});
test('worker queue keeps only newest geometry and never returns a stale result',()=>{
 const sent=[],workers=[],events=[],ctx={URL,document:{currentScript:{src:'http://localhost/hub-composite-symmetry.js'}},window:{dispatchEvent:e=>events.push(e.type)},Event:class{constructor(type){this.type=type;}},Worker:class{constructor(){workers.push(this);}postMessage(m){sent.push(m);}terminate(){}}};
 vm.runInNewContext(fs.readFileSync(__dirname+'/hub-composite-symmetry.js','utf8'),ctx);const api=ctx.HubCompositeSymmetry;
 assert.equal(api.request('a',[],{},{}),null);api.request('b',[],{},{});api.request('c',[],{},{});assert.equal(sent.length,1);
 workers[0].onmessage({data:{key:'a',result:{segments:['old']}}});assert.equal(sent[1].key,'c');assert.equal(api.request('c',[],{},{}),null);
 workers[0].onmessage({data:{key:'c',result:{segments:['new']}}});assert.equal(api.request('c',[],{},{}).segments[0],'new');assert.equal(events.length,2);
});
