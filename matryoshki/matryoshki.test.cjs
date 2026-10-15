const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('../mayatnik/mayatnik-core.js'),X=require('./matryoshki-core.js');
function snapshot(rows,frame){const e=new X.Engine(rows);e.advance(frame);return e.snapshot();}
test('source matches the unmodified pendulum core, including odd and even phases',()=>{
 for(const rows of [8,17,32]){const steps=4*rows,g=M.geometry('pend',steps,rows),f=M.field(g.W,rows,'empty'),e=new X.Engine(rows);
  for(let frame=1;frame<=steps;frame++){M.cone(f,g.anchor+M.offset('pend',frame-1),rows);e.advance(frame);const s=e.snapshot();
   for(let r=0;r<rows;r++)for(let c=-r;c<=r;c++)assert.equal(s.data[r*s.width+s.center+c],f.val[r*g.W+g.anchor+c]);
  }
 }
});
test('depth extension preserves every existing source bit at the same frame',()=>{
 for(const frame of [1,2,17,64,127,256]){const a=snapshot(32,frame),b=snapshot(64,frame);
  for(let r=0;r<a.rows;r++)for(let c=-r;c<=r;c++)assert.equal(a.data[r*a.width+a.center+c],b.data[r*b.width+b.center+c]);
 }
});
test('left and right enter on their own clock; no forced waiting for a pair',()=>{
 assert.deepEqual(X.shifts(16,33),{left:0,right:0});assert.deepEqual(X.shifts(16,34),{left:1,right:0});
 assert.deepEqual(X.shifts(16,35),{left:1,right:1});assert.deepEqual(X.shifts(16,36),{left:2,right:1});
});
test('every folded input has reached its infinite-growth deadline; apex never moves',()=>{
 for(let frame=1;frame<160;frame++){const s=snapshot(40,frame),p=X.project(s,Infinity);
  assert.equal(p.bits[p.center],1);assert.equal(p.left[0],0);assert.equal(p.right[0],0);
  for(let r=1;r<40;r++)for(let c=-p.left[r];c<=p.right[r];c++)if(p.left[r]||p.right[r])assert.ok(X.deadline(r,c)<=frame);
 }
});
test('projection XOR agrees with independent source reconstruction and keeps origins',()=>{
 const s=snapshot(40,97),original=s.data.slice();
 for(const cap of [0,1,2,8,Infinity]){const p=X.project(s,cap);
  for(let r=0;r<p.rows;r++)for(let c=-r;c<=r;c++){
   const o=X.origin(p,r,c),value=p.bits[r*p.width+p.center+c];if(!o){assert.equal(value,-1);continue;}
   let expected=0,n=0;for(let q=o.from;q<=o.to;q++){const b=s.data[r*s.width+s.center+q];if(b>=0){expected^=b;n++;}}
   assert.equal(value,n?expected:-1);
  }
 }
 assert.deepEqual(s.data,original);
});
test('a later frame cannot change any cell already beyond its deadline',()=>{
 const a=snapshot(32,43),b=snapshot(32,128);
 for(let r=0;r<32;r++)for(let c=-r;c<=r;c++)if(X.deadline(r,c)<=43)assert.equal(a.data[r*a.width+a.center+c],b.data[r*b.width+b.center+c]);
});
test('browser and worker scripts can see the shared lexical MAYATNIK binding',()=>{
 const context=vm.createContext({});vm.runInContext(fs.readFileSync(require.resolve('../mayatnik/mayatnik-core.js'),'utf8'),context);vm.runInContext(fs.readFileSync(require.resolve('./matryoshki-core.js'),'utf8'),context);
 assert.equal(vm.runInContext('const e=new Matryoshki.Engine(8);e.advance(16);e.snapshot().frame',context),16);
});
test('huge allocation fails before replacing a valid field; infinite clock keeps frozen prefix',()=>{
 const e=new X.Engine(16);e.advance(64);const a=e.snapshot().data;e.advance(1000000);assert.deepEqual(e.snapshot().data,a);assert.equal(e.frame,1000000);
 assert.throws(()=>new X.Engine(1000000),/памяти/);assert.throws(()=>e.advance(1),/обратного/);
});
