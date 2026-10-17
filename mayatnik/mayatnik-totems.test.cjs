const test=require('node:test'),assert=require('node:assert/strict'),T=require('./mayatnik-totems.js');
function hole(f,x,base,h,sign){for(let r=0;r<h;r++)for(let c=x-h+1+r;c<=x+h-1-r;c+=2)f.val[(base+sign*r)*f.W+c]=0;}
test('finds exact black holes of different sizes in both directions on both lattices',()=>{
  const f={W:61,H:35,val:new Int8Array(61*35).fill(1)};hole(f,15,3,10,1);hole(f,40,29,7,-1);hole(f,35,4,4,1);
  const triangles=T.holes(f,{minRows:4,anchor:3});
  assert.equal(triangles.length/5,3);
  const result=Array.from({length:3},(_,i)=>[...triangles.slice(i*5,i*5+4)]);
  assert.ok(result.some(a=>a.join()=== [15,12,10,1].join()));assert.ok(result.some(a=>a.join()===[40,23,7,-1].join()));
  assert.equal(T.holes(f,{minRows:8}).length/5,1);
});
test('missing cells and zeros outside the pattern are not triangular holes',()=>{
  const f={W:25,H:15,val:new Int8Array(375).fill(-1)};assert.equal(T.holes(f).length,0);
  f.val.fill(0);assert.equal(T.holes(f).length,0);
  f.val.fill(1);hole(f,12,2,8,1);f.val[7*25+12]=-1;assert.ok(![...T.holes(f,{minRows:8})].length);
});
test('three edges meet on the outer bit boundary and respect crop and lattice',()=>{
  const tris=Int32Array.from([12,9,8,1,0]);
  assert.deepEqual(T.edges(tris),[[4.5,2,20.5,2],[4.5,2,12.5,10],[20.5,2,12.5,10]]);
  assert.equal(T.edges(tris,{lattice:1}).length,0);assert.equal(T.edges(tris,{x0:8,width:20}).length,0);
  assert.equal(T.edges(Int32Array.from([...tris,...tris])).length,3);
});
