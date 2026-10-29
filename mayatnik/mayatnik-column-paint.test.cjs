const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const JoinedRomb=require('./mayatnik-joined-romb.js');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');

function sourceFunction(name){
 const start=html.indexOf('  function '+name+'(');
 assert.ok(start>=0,`runtime function ${name} exists`);
 const body=html.indexOf('{',start);let depth=1,end=body+1;
 for(;depth&&end<html.length;end++){if(html[end]==='{')depth++;if(html[end]==='}')depth--;}
 assert.equal(depth,0,`runtime function ${name} closes`);
 return html.slice(start,end);
}

function fixture(view,RK,VX){
 const c={st:{view},RK,VX,VW:9,VH:8,RG:2,geo:{anchor:7},
  f:{W:15,H:8,val:Int8Array.from({length:120},(_,q)=>((q%15)+Math.floor(q/15))%3===0?1:0)},
  joinedCache:null,MayatnikJoinedRomb:JoinedRomb,parityVisible:()=>true,outShow:()=>false,
  triangleMapRasterMask:()=>c.mapMask||null};
 c.joinedOn=()=>view.startsWith('rombJoin');
 c.rombP=()=>view==='bits'?-1:view==='romb0'?0:view==='romb1'?1:view==='romb2'?2:3;
 c.halfOf=fx=>c.rombP()!==2?[c.rombP(),fx]:fx<c.VW?[0,fx]:fx>=c.VW+c.RG?[1,fx-c.VW-c.RG]:null;
 vm.createContext(c);
 for(const name of ['joinedGeometry','rombCell','displayCell','displayPoint','fieldCellAt','cellPixels','columnCell','columnSelection'])
  vm.runInContext(sourceFunction(name),c);
 c.img={width:(c.joinedOn()?c.joinedGeometry().width:view==='romb2'?2*c.VW+c.RG:c.VW)*RK,height:(c.joinedOn()?16:8)*RK};
 c.fillBit=(x,y)=>{const cell=c.fieldCellAt(x,y);return cell?c.f.val[cell.r*c.f.W+cell.c]:-1;};
 return c;
}

// Independent inverse-projection oracle: inspect every displayed pixel. Do not
// call columnCell/cellPixels or duplicate their forward bounds and parity math.
function rasterOracle(c,seed){
 const expected=[];
 for(let y=0;y<c.img.height;y++)for(let x=0;x<c.img.width;x++){
  const cell=c.fieldCellAt(x,y),q=y*c.img.width+x;
  if(cell&&cell.c===seed.c&&cell.r>=seed.r&&!c.outShow(cell.r,cell.c)&&
   !(c.st.triangleMapMask&&c.mapMask?.[q])&&c.fillBit(x,y)===seed.bit)expected.push(q);
 }
 return expected;
}
const sorted=values=>Array.from(values).sort((a,b)=>a-b);

test('strict source column agrees with inverse raster projection in 432 geometry cases',()=>{
 let cases=0,pixelChecks=0;
 for(const view of ['bits','romb0','romb1','romb2','rombJoin','rombJoin180'])
 for(const RK of [1,2,4])for(const VX of [1,2]){
  const c=fixture(view,RK,VX);
  for(const col of [VX,VX+3,VX+8])for(const row of [0,3])for(const bit of [0,1]){
   const seed={c:col,r:row,bit},label=JSON.stringify({view,RK,VX,...seed}),expected=rasterOracle(c,seed);
   const selection=c.columnSelection(seed),replay=c.columnSelection(seed,false);
   assert.deepEqual(sorted(selection.indices),expected,label);
   assert.deepEqual(sorted(replay.indices),expected,label+' replay without membership allocation');
   assert.equal(replay.members,null);
   assert.equal(new Set(selection.indices).size,selection.indices.length,label+' no duplicate pixels');
   assert.deepEqual(Array.from(selection.members).flatMap((value,q)=>value?[q]:[]),expected,label+' membership');
   cases++;pixelChecks+=c.img.width*c.img.height;
  }
 }
 assert.equal(cases,432);assert.equal(pixelChecks,334656);
});

test('all six projections respect outside, parity and raster-map exclusions',()=>{
 for(const view of ['bits','romb0','romb1','romb2','rombJoin','rombJoin180']){
  const c=fixture(view,4,2);c.f.val.fill(1);
  c.outShow=(r,col)=>r===4&&col===5;
  c.parityVisible=(r,col)=>!(r===6&&col===5);
  c.st.triangleMapMask=true;c.mapMask=Uint8Array.from({length:c.img.width*c.img.height},(_,q)=>q%7===0?1:0);
  const seed={c:5,r:1,bit:1};
  assert.deepEqual(sorted(c.columnSelection(seed).indices),rasterOracle(c,seed),view);
  assert.deepEqual(sorted(c.columnSelection(seed,false).indices),rasterOracle(c,seed),view+' replay');
  for(const hidden of [{c:1,r:0,bit:1},{c:11,r:0,bit:1},{c:5,r:8,bit:1}])
   assert.equal(c.columnSelection(hidden,false).indices.length,0,view+' offscreen '+JSON.stringify(hidden));
 }
});
