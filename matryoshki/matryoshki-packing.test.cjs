const test = require('node:test'), assert = require('node:assert/strict');
const M = require('./matryoshki-core.js'), P = require('./matryoshki-packing.js');
function source(rows,frame) { const e = new M.Engine(rows); e.advance(frame); return e.snapshot(); }
function check(node, seen) {
  assert.equal(node.layer.bits[node.layer.center],1);
  for (let y=1;y<node.height;y++) {
    const r=node.rows[y]; assert.ok(!seen.has(r),`row ${r} repeated`); seen.add(r);
    assert.ok(node.left[y] !== 0 || node.right[y] !== 0, 'collapsed column must live inside');
    const addresses=[];
    for(let c=node.left[y];c<=node.right[y];c++) {
      const o=P.origin(node,y,c); if(!o) continue;
      assert.equal(o.row,r);
      let expected=0;
      for(let q=o.from;q<=o.to;q++) if(node.layer.data[r*node.layer.width+node.layer.center+q]>=0) { expected^=node.layer.data[r*node.layer.width+node.layer.center+q]; addresses.push(q || 0); }
      assert.equal(node.layer.bits[r*node.layer.width+node.layer.center+c],expected);
    }
    const actual=[]; for(let c=-r;c<=r;c++) if(node.layer.data[r*node.layer.width+node.layer.center+c]>=0) actual.push(c);
    assert.deepEqual(addresses,actual);
  }
  if(node.child) {
    const f=node.placement; assert.ok(f.scale>0 && f.scale<1);
    for(let y=0;y<node.child.height;y++) {
      const a=Math.floor(f.y+y*f.scale),b=Math.ceil(f.y+(y+1)*f.scale-1e-9)-1;
      for(let py=a;py<=b;py++) {
        assert.ok(py>=1 && py<node.height);
        assert.ok(f.x+(node.child.left[y]-.5)*f.scale>=node.left[py]-.5-1e-8);
        assert.ok(f.x+(node.child.right[y]+.5)*f.scale<=node.right[py]+.5+1e-8);
      }
    }
    check(node.child,seen);
  }
}
test('packing retains every source row and address across phases, caps and full collapse',()=>{
 for(const rows of [8,17,32,64]) for(const frame of [1,2,7,16,33,64,65,128,256]) {
  const s=source(rows,frame),before=s.data.slice();
  for(const cap of [0,1,2,4,8,Infinity]) {
   const seen=new Set();check(P.pack(M.project(s,cap)),seen);
   assert.deepEqual([...seen].sort((a,b)=>a-b),Array.from({length:rows-1},(_,i)=>i+1));
  }
  assert.deepEqual(s.data,before);
 }
});
test('frame 64 moves collapsed rows into a nested previous level instead of drawing a stalk',()=>{
 const n=P.pack(M.project(source(64,64),Infinity));
 assert.equal(n.height,49);assert.equal(n.rows[1],16);assert.equal(n.child.layer.rows,16);
 assert.ok(n.child.layer.limit<Infinity);assert.ok(n.child.child);
});
