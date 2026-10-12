const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./mirror-pendulum.js');

// Independent cell loop, including the temporary apex used as a parent.
function reference(W,H,anchor,steps) {
  const val = new Int8Array(W*H).fill(-1);
  for(let k=0;k<steps;k++) {
    const a=anchor+(k===0?0:k%2?-(k+1)/2:k/2);
    if(val[a]<0)val[a]=1;
    const original=val[a];val[a]=1;
    for(let r=1;r<H;r++) {
      for(let c=a-r;c<=a+r;c+=2) {
        const old=val[r*W+c],left=val[(r-1)*W+c-1],right=val[(r-1)*W+c+1];
        val[r*W+c]=Number(old===1)^Number(left===1)^Number(right===1);
      }
      if(r===1)val[a]=original;
    }
  }
  return val;
}
for(const [depth,limit,frames] of [[32,128,[0,1,2,3,96,128]],[97,150,[1,7,42,96,150]],[512,512,[1,2,96,128]]]) {
  test(`${depth} rows: bit parity, backward seek, occupancy and mirror modes`,()=>{
    const e=new Engine(depth,limit);
    for(const frame of frames) {
      assert.equal(e.seek(frame,Infinity),true);
      assert.deepEqual(e.field.val,reference(e.field.W,depth,e.anchor,frame));
    }
    const last=e.field.val.slice();e.seek(2,Infinity);e.seek(frames.at(-1),Infinity);assert.deepEqual(e.field.val,last);
    const balance=e.balance();assert.equal(balance.zero+balance.one+balance.empty,e.field.val.length);
    const rows=e.rows();assert.equal(rows.length,depth);assert.ok(rows.every(r=>r.length===e.field.W));
    assert.equal(rows.flatMap(s=>[...s]).filter(c=>c==='1').length,balance.one);
    for(let r=0;r<depth;r+=7)for(let c=0;c<e.field.W;c+=13) {
      const v=e.field.val[r*e.field.W+c],reverse=e.field.W-1-c;
      assert.equal(e.color(r,c,0,false),v<0?null:v?'#e8edf5':'#5b6475');
      assert.equal(e.color(r,reverse,2,false),e.color(r,c,0,false));
      assert.equal(e.color(r,c,1,false),v<0?null:v?'#5b6475':'#e8edf5');
    }
  });
}
