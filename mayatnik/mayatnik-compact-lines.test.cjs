const test=require('node:test');
const assert=require('node:assert/strict');
const {lines}=require('./mayatnik-compact-lines.js');
const Variants=require('./mayatnik-variants.js');
const collect=(val,width,options={})=>lines({width,height:val.length/width,val,...options});
const paths=ls=>ls.map(l=>Array.from(l.cells));

test('empty gaps disappear while matches retain original highlight addresses',()=>{
  const val=Int8Array.from([1,-1,0,-1,1]),before=val.slice(),ls=collect(val,5),L=ls[0];
  assert.equal(L.str,'101');assert.deepEqual(paths(ls),[[0,2,4]]);
  assert.equal(L.monotonic,true);assert.equal(L.p,null);assert.equal(L.dir,0);
  const at=Variants.indexOf(L.str,'1 1');assert.equal(at,0);
  assert.deepEqual(Array.from(L.cells.subarray(at,at+3)),[0,2,4]);
  assert.deepEqual(val,before);
});

test('physical rows stay independent; no row wrap or implicit cycle',()=>{
  const ls=collect([0,1,-1,0,-1,1],3);
  assert.deepEqual(ls.map(l=>l.str),['01','01']);
  assert.equal(Variants.indexOf(ls.all,'10'),-1);
  assert.equal(Variants.indexOf(ls.all,'1 0'),-1);
  assert.deepEqual(paths(ls),[[0,1],[3,5]]);
});

test('unknown and mixed values split a line, including masked unknowns',()=>{
  const ls=collect([1,-1,0,-2,-1,1,2,0,NaN,1],10,{allowed:()=>false});
  assert.equal(ls.length,0);
  const live=collect([1,-1,0,-2,-1,1,2,0,NaN,1],10,{allowed:(r,c)=>c!==3});
  assert.deepEqual(live.map(l=>l.str),['10','1','0','1']);
  assert.deepEqual(paths(live),[[0,2],[5],[7],[9]]);
});

test('columns and both diagonal families preserve physical order without wrapping',()=>{
  const val=Array(9).fill(1);
  assert.deepEqual(paths(collect(val,3,{mode:'col'})),[[0,3,6],[1,4,7],[2,5,8]]);
  assert.deepEqual(paths(collect(val,3,{mode:'diag'})),[[0,4,8],[1,5],[2],[3,7],[6]]);
  assert.deepEqual(paths(collect(val,3,{mode:'antidiag'})),[[0],[1,3],[2,4,6],[5,7],[8]]);
  for(const mode of ['row','col','diag','antidiag'])for(const L of collect(val,3,{mode})){
    assert.equal(L.monotonic,true);for(let i=1;i<L.n;i++)assert.ok(L.cells[i]>L.cells[i-1]);
  }
});

test('filter skips source cells and parity is metadata rather than an implicit lattice',()=>{
  const seen=[],ls=collect([1,0,1,0,1,0],6,{parity:1,allowed:(r,c,q)=>{seen.push([r,c,q]);return c%2===0;}});
  assert.equal(ls[0].str,'111');assert.equal(ls[0].p,1);assert.deepEqual(paths(ls),[[0,2,4]]);
  assert.equal(seen.length,6);assert.deepEqual(seen[5],[0,5,5]);
});

test('string bits and explicit blank values are supported without coercing unknowns',()=>{
  const val=['1','',null,'0',' ','-1',undefined,'1',false,'0'];
  const before=val.slice(),ls=collect(val,10);
  assert.deepEqual(ls.map(l=>l.str),['101','0']);assert.deepEqual(paths(ls),[[0,3,7],[9]]);
  assert.deepEqual(val,before);
});

test('all directions have sorted starts and exact packed text/ASCII offsets',()=>{
  const ls=collect([1,0,0,1],2,{mode:'all'});
  assert.equal(ls.length,10);assert.equal(ls.width,2);
  assert.equal(ls.all,ls.map(l=>l.str+',').join(''));
  assert.equal(Buffer.from(ls.bytes).toString('ascii'),ls.all);
  const counts=new Map();let end=0;
  for(let i=0;i<ls.length;i++){
    const L=ls[i];assert.ok(L.cells instanceof Int32Array);assert.equal(L.b,end);
    assert.equal(ls.all.slice(L.b,L.b+L.n),L.str);assert.equal(ls.bytes[L.b+L.n],44);
    if(i)assert.ok(L.cells[0]>=ls[i-1].cells[0]);
    end+=L.n+1;counts.set(L.dir,(counts.get(L.dir)||0)+1);
  }
  assert.deepEqual([...counts.keys()].sort((a,b)=>a-b),[-1,0,1,2]);assert.equal(end,ls.all.length);
});

test('empty fields produce complete empty metadata',()=>{
  const ls=collect([-1,-1,-1,-1],2,{mode:'all'});
  assert.equal(ls.length,0);assert.equal(ls.all,'');assert.deepEqual(ls.bytes,new Uint8Array());assert.equal(ls.width,2);
});

test('each direction reads each physical cell once, also for rectangular fields',()=>{
  let reads=0;const width=51,height=37,size=width*height,val={length:size};
  for(let q=0;q<size;q++)Object.defineProperty(val,q,{get(){reads++;return -1;}});
  for(const mode of ['row','col','diag','antidiag']){reads=0;lines({width,height,val,mode});assert.equal(reads,size);}
  reads=0;lines({width,height,val,mode:'all'});assert.equal(reads,4*size);
});

test('invalid dimensions, incomplete values and unknown modes reject before traversal',()=>{
  for(const options of [{width:0},{width:-1},{width:1.5},{height:Infinity},{width:2147483648,height:1},{val:[1]},{mode:'loop'}])
    assert.throws(()=>lines({width:2,height:2,val:[0,1,0,1],...options}),RangeError);
  assert.throws(()=>collect([0],1,{allowed:null}),TypeError);
});
