const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('./zz-grid-shapes.js'),E=require('./zz-rmb-editor.js'),A=require('./zz-rmb-axis.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const geo=(cell,rows,extra={})=>({cell,rows,hs:rows.map(()=>0),tw:27,ox:123,oy:91,...extra});
test('square and ring centers map back to every bit with variable row lengths and any pan/scale',()=>{
 const rows=Array.from({length:40},(_,r)=>'01'.repeat(r+1));
 for(const cell of ['square','ring'])for(const tw of [.3,5,100]){
  const g=geo(cell,rows,{tw,hs:rows.map((_,r)=>r%3-4)});
  for(let r=0;r<rows.length;r++)for(let c=0;c<rows[r].length;c++){
   const p=S.center(r,c,g);assert.deepEqual(S.hit(rows,g,g.ox+p[0]*tw,g.oy+p[1]*tw),[r,c]);assert.deepEqual(E.hit(rows,g,g.ox+p[0]*tw,g.oy+p[1]*tw),[r,c]);
  }
 }
});
test('square corners, exact grid edges, clamp and fit bounds share row offsets',()=>{
 const rows=['10','001'],g=geo('square',rows,{tw:20,ox:5,oy:7,hs:[-2,1]});
 assert.deepEqual(S.polygon(0,0,g),[[-15,7],[5,7],[5,27],[-15,27]]);
 assert.deepEqual(S.hit(rows,g,5,7),[0,1]);assert.deepEqual(S.hit(rows,g,15,27),[1,0]);assert.equal(S.hit(rows,g,75,27),null);
 assert.deepEqual(S.hit(rows,g,-99,-99,true),[0,0]);assert.deepEqual(S.hit(rows,g,999,999,true),[1,2]);
 assert.deepEqual(S.bounds(rows,g),{minX:-1,minY:0,maxX:3.5,maxY:2});assert.deepEqual(S.snapVertex(rows,g,[.48,1.02]),[.5,1]);
});
test('ring exact seam, center, outer boundary and clamping are deterministic',()=>{
 const rows=['0101','10101010'],g=geo('ring',rows,{tw:10,ox:0,oy:0});
 assert.deepEqual(S.hit(rows,g,0,0),[0,0]);assert.deepEqual(S.hit(rows,g,0,-5),[0,0]);
 assert.deepEqual(S.hit(rows,g,5,0),[0,1]);assert.deepEqual(S.hit(rows,g,0,-10),[1,0]);assert.equal(S.hit(rows,g,0,-20),null);assert.deepEqual(S.hit(rows,g,0,-20,true),[1,0]);
 assert.deepEqual(S.bounds(rows,g),{minX:-2,minY:-2,maxX:2,maxY:2});const snap=S.snapVertex(rows,g,[1.43,-1.41]);near(snap[0],Math.SQRT2);near(snap[1],-Math.SQRT2);
});
test('ring polygon boundaries meet and remain on the requested concentric circles',()=>{
 const rows=['1111','1111'],g=geo('ring',rows,{tw:100,ox:0,oy:0});
 const one=S.polygon(0,0,g),two=S.polygon(1,0,g);const boundary=p=>p.filter(q=>Math.abs(Math.hypot(...q)-100)<1e-8).map(q=>q.map(x=>+x.toFixed(7)).join(','));
 assert.deepEqual(new Set(boundary(one)),new Set(boundary(two)));assert.deepEqual(one.at(-1),[0,0]);
 const full=S.polygon(0,0,geo('ring',['1'],{tw:20,ox:0,oy:0}));assert.ok(full.length>20);for(const p of full.slice(0,-1))near(Math.hypot(...p),20);
});
test('ring adjacency wraps and crosses unequal sector counts only along positive shared arcs',()=>{
 const rows=['11','1111','111'],g=geo('ring',rows),n=S.neighbors(rows,g,0,0);
 assert.deepEqual(n,[[0,1],[1,0],[1,1]]);
 assert.deepEqual(S.neighbors(rows,g,1,0),[[1,3],[1,1],[0,0],[2,0]]);
 assert.deepEqual(S.neighbors(rows,g,1,1),[[1,0],[1,2],[0,0],[2,0],[2,1]]);
 assert.deepEqual(S.neighbors(['1'],geo('ring',['1']),0,0),[]);
 for(let r=0;r<rows.length;r++)for(let c=0;c<rows[r].length;c++)for(const [rr,cc] of S.neighbors(rows,g,r,c))assert.ok(S.neighbors(rows,g,rr,cc).some(p=>p[0]===r&&p[1]===c));
});
test('square adjacency follows staggered row edges and excludes corner-only contact',()=>{
 const rows=['111','111'],g=geo('square',rows);
 assert.deepEqual(S.neighbors(rows,g,0,1),[[0,0],[0,2],[1,1]]);
 g.hs=[0,1];assert.deepEqual(S.neighbors(rows,g,0,1),[[0,0],[0,2],[1,0],[1,1]]);
});
test('new modes reflect editable source bits while preserving source rows and use their own vertices',()=>{
 const rows=['1000'],g=geo('square',rows),result=A.reflectRows(rows,g,{a:[2,0],b:[2,1]},'negative');
 assert.deepEqual(result.rows,['1001']);assert.deepEqual(rows,['1000']);assert.deepEqual(A.snapVertex(rows,g,[1.03,.99]),[1,1]);
 for(const n of [2,3,4,7,8,15]){
  const rr=['1'+'0'.repeat(n-1)],gg=geo('ring',rr),copy=A.reflectRows(rr,gg,{a:[0,-2],b:[0,2]},'positive');
  assert.equal(copy.rows[0],'1'+'0'.repeat(n-2)+'1');assert.equal(rr[0],'1'+'0'.repeat(n-1));
 }
});
test('invalid geometry inputs do not create target cells',()=>{
 assert.equal(S.hit([],geo('ring',[]),0,0),null);assert.equal(S.hit(['1'],geo('square',['1']),NaN,0),null);
 assert.deepEqual(S.polygon(3,1,geo('ring',['1'])),[]);assert.equal(S.center(0,2,geo('square',['1'])),null);assert.equal(S.snapVertex([],geo('square',[]),[0,0]),null);
});
