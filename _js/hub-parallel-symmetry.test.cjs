const test=require('node:test'),assert=require('node:assert/strict');
const {analyze}=require('./hub-parallel-symmetry.js'),standard=require('./bit-symmetry.js');
const pitch=Math.sqrt(3)/2;
function verify(rows,data){
 const t=[Math.cos(data.angle),Math.sin(data.angle)],n=[-t[1],t[0]];
 const point=([r,j])=>[j-(rows[r].length-1)/2,r*pitch];
 for(const s of data.segments){
  assert.ok(s.rows.length>=data.minRows);
  const a=[s.from[0]/2,s.from[1]*pitch],b=[s.to[0]/2,s.to[1]*pitch];
  assert.ok(Math.abs((b[0]-a[0])*n[0]+(b[1]-a[1])*n[1])<1e-7);
  for(const stripe of s.rows){assert.ok(stripe.pairs.length>=data.minPairs);
   for(const [p,q] of stripe.pairs){const x=point(p),y=point(q),d=x[0]*n[0]+x[1]*n[1]-s.v;
    assert.ok(Math.hypot(x[0]-2*d*n[0]-y[0],x[1]-2*d*n[1]-y[1])<1e-7);
    assert.equal(rows[p[0]][p[1]],rows[q[0]][q[1]]);
    assert.equal(data.colors[p[0]][p[1]],data.colors[q[0]][q[1]]);
   }
  }
 }
}
test('vertical parallel scan agrees with existing row symmetry including gaps',()=>{
 const rows=['010110011010','010110011010','01011.011010','010110011010'];
 const options={minPairs:2,minRows:1},old=standard.analyze(rows,options),data=analyze(rows,{...options,angle:Math.PI/2});
 assert.equal(data.matched,old.matched);assert.equal(data.segments.length,old.segments.length);verify(rows,data);
});
test('oblique axes have real matching pairs, exact parallel direction and consistent overlap colours',()=>{
 const rows=Array.from({length:16},(_,r)=>'1'.repeat(r+1));
 for(const angle of [Math.PI/6,Math.PI/2,5*Math.PI/6]){const data=analyze(rows,{angle,minPairs:1,minRows:2});assert.ok(data.segments.length>0);verify(rows,data);}
 assert.equal(analyze(rows,{angle:110*Math.PI/180,minPairs:1,minRows:1}).matched,0);
});
test('angle and source invalidate cache; minimums reject short and uniform motifs',()=>{
 const rows=Array.from({length:10},(_,r)=>'1'.repeat(r+1)),opt={angle:Math.PI/6,minPairs:1,minRows:1},a=analyze(rows,opt);
 assert.equal(analyze(rows,opt),a);assert.notEqual(analyze(rows,{...opt,angle:Math.PI/2}),a);
 assert.equal(analyze(rows,{...opt,minPairs:2}).matched,0);assert.equal(analyze(rows,{...opt,minRows:100}).matched,0);
 const changed=rows.slice();changed[4]='00000';assert.notEqual(analyze(changed,opt),a);assert.equal(rows[4],'11111');
});
test('actual Horrorius oblique motifs satisfy exact reflection',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),rows=vm.runInNewContext(fs.readFileSync(__dirname+'/horr-rows.js','utf8')+';ZZ_HORR_ROWS');
 const data=analyze(rows,{angle:Math.PI/6,minPairs:2,minRows:4});assert.ok(data.matched>0);verify(rows,data);
});
