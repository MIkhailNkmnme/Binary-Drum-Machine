const test=require('node:test'),assert=require('node:assert/strict'),C=require('./mayatnik-fold-compare.js');
const field=rows=>({W:rows[0].length,H:rows.length,val:Int8Array.from(rows.join(''),x=>x==='.'?-1:+x)});

test('explicit null span preserves every canonical comparison cell for each source and right reflection',()=>{
 const Compare=require('./mayatnik-compare.js'),engine=Compare.create({rows:5});
 const state=engine.seek(2),val=new Int8Array(state.W*state.H);
 for(const source of ['cone','field','xor','and'])for(const mirror of [false,true]){
  engine.copyTo(val,source,mirror);const before=val.slice(),m=C.create({W:state.W,H:state.H,val,anchor:state.anchor,span:null});
  for(let y=0;y<state.H;y++)for(let x=0;x<state.W;x++)assert.equal(m.bit(x,y),before[y*state.W+x],`${source}/${mirror}/${x}/${y}`);
  val.fill(-1);for(let y=0;y<state.H;y++)for(let x=0;x<state.W;x++)assert.equal(m.bit(x,y),before[y*state.W+x]);
 }
 // The reflected operand contributes a top-row bit outside the left source's span.
 engine.copyTo(val,'xor',true);const raw=C.create({W:state.W,H:state.H,val,anchor:state.anchor,span:null});
 const masked=C.create({W:state.W,H:state.H,val,anchor:state.anchor,span:[state.lo,state.hi]});
 assert.equal(raw.bit(state.anchor+1,0),1);assert.equal(masked.bit(state.anchor+1,0),-1);
});
test('cone occupancy retains uniform bit strips and excludes filled background in every direction',()=>{
 const M=require('./mayatnik-core.js');
 for(const mode of ['pend','left','right','one'])for(const frames of [1,2,5,8]){
  const H=16,g=M.geometry(mode,frames,H),f=M.field(g.W,H);
  for(let k=0;k<frames;k++)M.cone(f,g.anchor+M.offset(mode,k),H);
  const solid=Int8Array.from({length:g.W*H},()=>1),m=C.create({W:g.W,H,val:solid,anchor:g.anchor,span:M.span(mode,frames)});
  for(let y=0;y<H;y++)for(let x=0;x<g.W;x++)assert.equal(m.bit(x,y)>=0,f.val[y*g.W+x]>=0,`${mode}/${frames}/${x}/${y}`);
 }
});
test('half-cell steps: through centres keeps fixed cells; through boundaries pairs neighbours',()=>{
 const m=C.create(field(['1100']));
 assert.equal(m.analyze(0).pairs,0);assert.equal(m.analyze(0).match,false);
 assert.equal(m.analyze(1).fixed,1);assert.equal(m.analyze(1).pairs,0);
 assert.equal(m.analyze(2).same,1);assert.equal(m.analyze(3).different,1);assert.equal(m.analyze(3).fixed,1);
 assert.equal(m.analyze(4).different,2);assert.equal(m.target(0,4),3);
});
test('empty cells are distinct from zero and missing contours are counted both ways',()=>{
 const m=C.create(field(['1..0','.01.','....']));const r=m.analyze(4);
 assert.equal(r.different,2);assert.equal(r.same,0);
 const n=C.create(field(['1..1','0...','...0'])),s=n.analyze(4);
 assert.equal(s.same,1);assert.equal(s.overhang,1);assert.equal(s.missing,1);assert.equal(s.match,false);
});
test('cropped occupied bounds, odd centre, source ownership and arbitrary seeking',()=>{
 const f=field(['.......','..101..','...1...']);const m=C.create(f);f.val.fill(0);
 assert.equal(m.left,2);assert.equal(m.max,3);assert.equal(m.analyze(3).same,1);assert.equal(m.analyze(3).fixed,2);assert.equal(m.analyze(3).match,true);
 const before=m.analyze(3);m.analyze(1);assert.deepEqual(m.analyze(3),before);
 assert.equal(m.pair(4,1,3).sx,2);assert.equal(m.pair(3,1,3).kind,'fixed');
 assert.equal(C.create(field(['...'])).empty,true);
});
test('all axes agree with independent centre-coordinate reflection on random ternary fields',()=>{
 let seed=42;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)%3)-1;
 for(let W=1;W<24;W++){const H=9,val=Int8Array.from({length:W*H},rand),m=C.create({W,H,val});
  for(let step=0;step<=m.max;step++){
   const got=m.analyze(step),want={same:0,different:0,overhang:0,missing:0,fixed:0},axis=m.left+step/2;
   for(let y=0;y<H;y++)for(let sx=m.left;sx<=m.right;sx++){
    const a=val[y*W+sx],centre=sx+.5;if(centre===axis){if(a>=0)want.fixed++;continue;}if(centre>axis)continue;
    const x=Math.round(2*axis-centre-.5),b=val[y*W+x];if(a<0&&b<0)continue;
    want[a<0?'missing':b<0?'overhang':a===b?'same':'different']++;
   }
   for(const k in want)assert.equal(got[k],want[k],`${W}/${step}/${k}`);
  }
 }
});
test('v2: axis through two points matches vertical folds and is exact for horizontal and diagonal axes',()=>{
 let seed=7;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)%3)-1;
 for(let W=2;W<14;W++){const H=7,val=Int8Array.from({length:W*H},rand),m=C.create({W,H,val});if(m.empty)continue;
  for(let step=0;step<=m.max;step++){const a=m.left+step/2,v=m.analyze(step),l=m.line({x:a,y:0},{x:a,y:1}).analyze();
   for(const k of ['same','different','overhang','missing','fixed'])assert.equal(l[k],v[k],`${W}/${step}/${k}`);}
 }
 const h=C.create(field(['101','010','101'])).line({x:0,y:1.5},{x:1,y:1.5}).analyze();
 assert.equal(h.same,3);assert.equal(h.fixed,3);assert.equal(h.match,true);
 const d=C.create(field(['10','11'])),r=d.line({x:.5,y:.5},{x:1.5,y:1.5}).analyze();
 assert.equal(r.fixed,2);assert.equal(r.different,1);assert.deepEqual([r.first.x,r.first.y,r.first.sx,r.first.sy].sort(),[0,0,1,1]);
 assert.equal(d.line({x:.5,y:.5},{x:1.5,y:1.5},true).analyze().different,1);assert.equal(d.line({x:1,y:1},{x:1,y:1}),null);
});
