const test=require('node:test'),assert=require('node:assert/strict'),X=require('./mayatnik-cross-mirrors.js');
const cross={verticalX:10,diagX:10,y:8,left:1.5,right:18.5};
const sample={A1:[9,4],A2:[11,4],B1:[3,4],B2:[17,4],a1:[9,12],a2:[11,12],b1:[5,10],b2:[15,10],C1:[2,12],C2:[18,12]};
function oracle(c,x,y){
  if(x===c.verticalX||y===c.y||x+y===c.diagX+c.y||x-y===c.diagX-c.y)return null;
  if(y>c.y&&(x-y===c.left-c.y||x+y===c.right+c.y))return null;
  if(y>c.y&&x<c.verticalX&&x-y<c.left-c.y)return 'C1';
  if(y>c.y&&x>c.verticalX&&x+y>c.right+c.y)return 'C2';
  const side=x<c.verticalX?'1':'2',inside=x>c.diagX-Math.abs(y-c.y)&&x<c.diagX+Math.abs(y-c.y);
  return (y<c.y?(inside?'A':'B'):(inside?'a':'b'))+side;
}
test('ten screenshot sectors, own sides, and all boundary lines',()=>{
  for(const [name,point]of Object.entries(sample))assert.equal(X.classify(cross,...point),name);
  for(const point of [[10,1],[1,8],[7,5],[7,11],[5.5,12],[14.5,12]])assert.equal(X.classify(cross,...point),null);
  assert.equal(X.classify(cross,9,30),'C1');assert.equal(X.classify(cross,11,30),'C2');
});
test('locked vertical and diagonal centre remain distinct, checked against halfplanes',()=>{
  for(const V of [5,9.5,10,12,17])for(const D of [8.5,10,12.5])for(const Y of [6,8.5]){
    const c={...cross,verticalX:V,diagX:D,y:Y};for(let y=0;y<20;y+=.5)for(let x=0;x<22;x+=.5)assert.equal(X.classify(c,x,y),oracle(c,x,y));
  }
});
test('cross geometry uses q3/q4 and the actual rounded row with extrapolated outer edges',()=>{
  const f={W:7,H:5,val:new Int8Array(35).fill(-1)};for(let c=1;c<=5;c++)f.val[4*7+c]=0;
  assert.deepEqual(X.crosses(f,[[3,3,6,2.5,3.5]]),[{verticalX:2.5,diagX:3.5,y:6,left:-1.5,right:7.5}]);
  assert.deepEqual(X.crosses(f,[[3,3,3,2.5,3.5]])[0],{verticalX:2.5,diagX:3.5,y:3,left:null,right:null});
});
test('the four directional mirrors use the real vertical/horizontal and valid cells only',()=>{
  const c={...cross,verticalX:9.5,diagX:10.5,y:8.5},W=22,H=20,valid=new Uint8Array(W*H).fill(1);valid[5*W+3]=0;
  for(const mode of ['lr','rl','tb','bt']){
    const map=X.mapping({W,H,crosses:[c],mode,valid});for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const q=y*W+x,onSide=mode==='lr'?x>c.verticalX:mode==='rl'?x<c.verticalX:mode==='tb'?y>c.y:y<c.y;
      const sx=mode==='lr'||mode==='rl'?2*c.verticalX-x:x,sy=mode==='tb'||mode==='bt'?2*c.y-y:y;
      const ok=onSide&&oracle(c,x,y)&&sx>=0&&sx<W&&sy>=0&&sy<H&&Number.isInteger(sx)&&Number.isInteger(sy)&&valid[q]&&valid[sy*W+sx]&&oracle(c,sx,sy);
      assert.equal(map[q],ok?sy*W+sx:-1,`${mode}:${x}:${y}`);
    }
  }
});
test('sector inverse D4 sources are exact selected-sector members; no rounding',()=>{
  for(const c of [cross,{...cross,verticalX:8,diagX:10.5}])for(const sector of Object.keys(X.LABELS)){
    const W=22,H=20,map=X.mapping({W,H,crosses:[c],mode:'sector',sector});
    for(let q=0;q<map.length;q++)if(map[q]>=0){const x=q%W,y=Math.floor(q/W),sx=map[q]%W,sy=Math.floor(map[q]/W);assert.equal(oracle(c,sx,sy),sector);assert.notEqual(oracle(c,x,y),sector);assert.ok(oracle(c,x,y));assert.equal((x-c.diagX)**2+(y-c.y)**2,(sx-c.diagX)**2+(sy-c.y)**2);}
  }
  const c={...cross,diagX:10.5},map=X.mapping({W:22,H:20,crosses:[c],mode:'sector',sector:'A1'});
  for(let y=0;y<8;y++)for(let x=0;x<22;x++)if(oracle(c,x,y)?.startsWith('B'))assert.equal(map[y*22+x],-1,'a quarter-turn would require half-cell source');
});
test('all crosses read one immutable snapshot, deterministic order, absent orbits stay unchanged',()=>{
  const W=24,H=24,crosses=[cross,{...cross,verticalX:12,diagX:12,y:12}],original=Uint32Array.from({length:W*H},(_,q)=>1000+q),a=original.slice(),b=original.slice();
  const result=X.apply(a,{W,H,crosses,mode:'lr'});X.apply(b,{W,H,crosses:crosses.slice().reverse(),mode:'lr'});assert.deepEqual(a,b);
  let witnesses=0;for(let q=0;q<a.length;q++){const source=result.mapping[q];assert.equal(a[q],source<0?original[q]:original[source]);if(source>=0&&result.mapping[source]>=0)witnesses++;}assert.ok(result.count>0);assert.ok(witnesses>0);
});
test('clipped polygons cover the box and each label anchor belongs to its named sector',()=>{
  for(const c of [cross,{...cross,verticalX:4},{...cross,diagX:16,y:4.5}]){
    const polygons=X.sectorPolygons(c,[0,0,22,20]),area=polygons.reduce((n,p)=>n+p.area,0);assert.ok(Math.abs(area-440)<1e-8);
    for(const p of polygons){assert.equal(X.classify(c,...p.centroid),p.sector);assert.ok(p.points.every(([x,y])=>x>=-1e-8&&x<=22+1e-8&&y>=-1e-8&&y<=20+1e-8));}
    for(const p of X.labelAnchors(c,[0,0,22,20]))assert.equal(X.classify(c,p.x,p.y),p.sector);
    assert.deepEqual(X.labelAnchors(c,[0,0,22,20],()=>false),[]);
  }
});

test('sector raster has ten stable colours, neutral axes and exact visible-cell classification',()=>{
  assert.equal(new Set(Object.values(X.COLOURS)).size,10);assert.deepEqual(Object.keys(X.COLOURS),Object.keys(X.LABELS));assert.equal(X.FILL_ALPHA,.2);
  const W=22,H=20,valid=Uint8Array.from({length:W*H},(_,q)=>q%7!==0),before=valid.slice(),ids=Object.keys(X.LABELS);
  for(const c of [cross,{...cross,verticalX:4.5,diagX:12,y:7.5}]){
    const data=X.sectorRaster({W,H,crosses:[c],valid});
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const q=y*W+x;assert.equal(ids[data.codes[q]-1]||null,valid[q]?oracle(c,x,y):null);assert.equal(data.owners[q],valid[q]?0:-1);}
  }
  assert.deepEqual(valid,before);
});

test('overlapping crosses assign each cell once to the nearest meeting, independent of input order',()=>{
  const W=30,H=25,cs=[cross,{...cross,verticalX:7.5,diagX:19,y:15}],a=X.sectorRaster({W,H,crosses:cs}),b=X.sectorRaster({W,H,crosses:[cs[1],cs[0],cs[0]]}),ids=Object.keys(X.LABELS);
  assert.deepEqual(a,b);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const q=y*W+x,dist=cs.map(c=>(x-c.diagX)**2+(y-c.y)**2),owner=dist[0]<=dist[1]?0:1;assert.equal(a.owners[q],owner);assert.equal(ids[a.codes[q]-1]||null,oracle(cs[owner],x,y));}
  const regions=X.ownerRegions(cs,[0,0,W,H]);assert.equal(regions.length,2);
  for(const r of regions)for(const p of X.sectorPolygons(r.cross,r.points)){
    const [x,y]=p.centroid,own=cs[r.index],other=cs[1-r.index];assert.ok((x-own.diagX)**2+(y-own.y)**2<=(x-other.diagX)**2+(y-other.y)**2+1e-8);assert.equal(p.sector,oracle(own,x,y));
  }
});

test('same meeting with different locked verticals has deterministic ownership and one label region',()=>{
  const cs=[cross,{...cross,verticalX:4}],data=X.sectorRaster({W:22,H:20,crosses:cs});assert.ok(data.owners.every(i=>i===0));
  const regions=X.ownerRegions(cs,[0,0,22,20]);assert.equal(regions.length,1);assert.equal(regions[0].cross.verticalX,4);
});
