const test=require('node:test'),assert=require('node:assert/strict');
const S=require('./mayatnik-symmetry.js');
const mod=n=>((n%2)+2)%2;
// Independent brute-force reflection: enumerate each geometric axis and compare
// symmetric coordinates directly, without palindrome radii or the fast scanner.
function reference(f,o={}){
  const {W,H,val}=f,A=o.anchor||0,result=[];
  for(const dir of ['v','h','d','u'])for(let p=0;p<2;p++){
    const amin=dir==='d'?1-H:0,amax=dir==='v'?W-1:dir==='h'?H-1:dir==='d'?W-1:W+H-2;
    for(let a=amin;a<=amax;a++){
      const ts=dir==='v'?Array.from({length:H},(_,i)=>i):dir==='h'?Array.from({length:W},(_,i)=>i):dir==='d'?Array.from({length:W+H-1},(_,i)=>i).filter(t=>mod(t-A)===p):Array.from({length:W+H-1},(_,i)=>i-H+1).filter(t=>mod(t-A)===p);
      let run=null;
      const finish=()=>{if(run&&run.widths.length>=(o.minRows||2)&&run.widths.length<=(o.maxRows||Infinity))result.push(run);run=null;};
      for(const t of ts){
        const [x,y]=dir==='v'?[a,t]:dir==='h'?[t,a]:dir==='d'?[(t+a)/2,(t-a)/2]:[(a+t)/2,(a-t)/2];
        const [dx,dy]=dir==='v'?[2,0]:dir==='h'?[0,2]:dir==='d'?[1,-1]:[1,1];
        const through=Number.isInteger(x)&&Number.isInteger(y)&&mod(x-y-A)===p;
        const at=(xx,yy)=>xx<0||xx>=W||yy<0||yy>=H?-1:val[yy*W+xx];
        let bits=0;
        if(!through||at(x,y)>=0)for(let k=1;k<=W+H;k++){
          const d=k-(through?0:.5),left=at(x-d*dx,y-d*dy),right=at(x+d*dx,y+d*dy);
          if(left<0||left!==right)break;bits++;
        }
        if(bits<(o.minBits||2)||bits>(o.maxBits||Infinity)){finish();continue;}
        if(!run)run={dir,p,axis:a,t0:t,t1:t,widths:[]};
        run.t1=t;run.widths.push(bits);
      }finish();
    }
  }return result;
}
const normalize=segs=>segs.map(({dir,p,axis,t0,t1,widths})=>JSON.stringify([dir,p,axis,t0,t1,widths])).sort();
test('all four orientations and both lattices equal brute-force reflection',()=>{
  let seed=7;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
  for(let trial=0;trial<24;trial++){
    const W=7+trial%3,H=6+trial%4,f={W,H,val:Int8Array.from({length:W*H},()=>rnd()%7===0?-1:rnd()%2)};
    const o={anchor:trial%4,minRows:2,minBits:2,maxRows:trial%2?3:0,maxBits:trial%3?0:2};
    assert.deepEqual(normalize(S.find(f,o)),normalize(reference(f,o)));
  }
});
test('transpose preserves proportions and exchanges horizontal/vertical axes',()=>{
  const W=13,H=9,f={W,H,val:Int8Array.from({length:W*H},(_,q)=>(q%W%4===0||Math.floor(q/W)%3===0)?1:0)};
  const trans={W:H,H:W,val:new Int8Array(W*H)};
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)trans.val[x*H+y]=f.val[y*W+x];
  const a=S.find(f,{anchor:1}).filter(s=>s.dir==='v').map(s=>({...s,dir:'h'}));
  const b=S.find(trans,{anchor:1}).filter(s=>s.dir==='h');
  assert.deepEqual(normalize(a),normalize(b));
});
test('no empty-cell matches, no skipped row, no old 64-bit width cap',()=>{
  const f={W:303,H:3,val:new Int8Array(909).fill(1)};
  let segs=S.find(f,{directions:['v'],minRows:2,minBits:70});
  assert.ok(segs.some(s=>s.widths.every(w=>w>=70)));
  f.val.fill(-1,303,606);
  assert.equal(S.find(f,{directions:['v'],minRows:2,minBits:2}).length,0);
  assert.equal(S.find({W:10,H:4,val:new Int8Array(40).fill(-1)}).length,0);
});
test('highlighted cells are exactly the union of mirrored spans',()=>{
  const f={W:13,H:11,val:Int8Array.from({length:143},(_,i)=>i%5?1:0)},anchor=2;
  const segs=S.find(f,{anchor}),pixels=S.highlights(f,segs,anchor),expected=new Set();
  for(const s of segs)for(let i=0;i<s.widths.length;i++){
    const a=S.span(s,i,anchor);
    for(let j=0;j<a.n;j++){
      const x=a.x+j*a.dx,y=a.y+j*a.dy;
      assert.ok(Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&x<f.W&&y>=0&&y<f.H);
      assert.equal(mod(x-y-anchor),s.p);expected.add(y*f.W+x);
    }
  }
  for(let q=0;q<f.val.length;q++)assert.equal(pixels[q*4+3]>0,expected.has(q));
});

// Brute-force cones: try every base and check each intermediate mirror slice.
function referenceTriangles(segs,anchor,minRows){
  const result=[];
  for(const s of segs)for(const sign of [1,-1]){
    const n=s.widths.length,dt=s.dir==='v'||s.dir==='h'?1:2;
    const candidates=[];
    for(let i=0;i<n;i++){
      const ai=sign===1?i:n-1-i;let last=i;
      for(let j=i;j<n;j++){
        const idx=sign===1?j:n-1-j;
        const [x,y]=S.point(s.dir,s.axis,s.t0+idx*dt);
        const through=Number.isInteger(x)&&Number.isInteger(y)&&mod(x-y-anchor)===s.p;
        const radius=(s.widths[idx]-(through?0:.5))*(dt===1?2:1);
        if(radius<j-i)break;last=j;
      }
      const bi=sign===1?last:n-1-last,h=last-i;
      const a=S.point(s.dir,s.axis,s.t0+ai*dt),b=S.point(s.dir,s.axis,s.t0+bi*dt);
      const dx=s.dir==='h'?0:h,dy=s.dir==='v'?0:s.dir==='d'?-h:h;
      candidates.push({height:h+1,coords:[...a,b[0]-dx,b[1]-dy,b[0]+dx,b[1]+dy,s.p]});
    }
    candidates.forEach((c,i)=>{
      let l=i,r=i;while(l>0&&candidates[l-1].height===c.height)l--;while(r<n-1&&candidates[r+1].height===c.height)r++;
      if(i!==Math.floor((l+r)/2)||c.height<minRows)return;
      if(l>0&&candidates[l-1].height>c.height||r<n-1&&candidates[r+1].height>c.height)return;
      result.push(c.coords);
    });
  }return result;
}
function unpackTriangles(ts){
  return Array.from({length:ts.length/10},(_,i)=>[...ts.slice(i*10,i*10+6),ts[i*10+9]]);
}
test('triangle boundaries equal brute-force inscribed cones in every orientation and lattice',()=>{
  let seed=31;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
  for(const dir of ['v','h','d','u'])for(const p of [0,1])for(let trial=0;trial<25;trial++){
    const segs=[{dir,p,axis:16,t0:4,t1:28,widths:Array.from({length:13},()=>1+rnd()%7)}];
    const actual=S.triangles(segs,2,3);
    assert.deepEqual(unpackTriangles(actual),referenceTriangles(segs,2,3));
    assert.ok([...actual].every(Number.isFinite));
  }
});
test('nested axes and both apex directions survive; minimum height filters only small cones',()=>{
  const segs=[{dir:'v',p:0,axis:20,t0:0,widths:Array(17).fill(20)},
    {dir:'v',p:0,axis:18,t0:7,widths:Array(6).fill(8)}];
  const ts=unpackTriangles(S.triangles(segs,0,2));
  assert.equal(ts.length,4);
  assert.ok(ts.some(t=>t[0]===20&&t[1]===0&&t[3]===16));
  assert.ok(ts.some(t=>t[0]===20&&t[1]===16&&t[3]===0));
  assert.ok(ts.some(t=>t[0]===18&&t[1]===7&&t[3]===12));
  assert.equal(S.triangles(segs,0,10).length/10,2);
  assert.equal(S.triangles(segs,0,18).length,0);
});
test('cones stop at narrow slices and do not bridge separate symmetry runs',()=>{
  const segs=[{dir:'v',p:0,axis:20,t0:0,widths:[8,8,8,1,8,8,8,8,8]},
    {dir:'v',p:0,axis:20,t0:20,widths:[8,8,8]}];
  const ts=unpackTriangles(S.triangles(segs,0,3));
  assert.deepEqual(ts,referenceTriangles(segs,0,3));
  assert.ok(ts.every(t=>Math.max(t[1],t[3])<=8||Math.min(t[1],t[3])>=20));
  assert.ok(!ts.some(t=>t[1]===0&&t[3]>=3));
});
test('worker and direct calculation return identical triangles without a per-bit colour buffer',()=>{
  const vm=require('node:vm'),fs=require('node:fs');let workerCode,result;
  const ctx={Blob:class{constructor(parts){workerCode=parts.join('');}},URL:{createObjectURL:()=>'',revokeObjectURL:()=>{}},Worker:class{}};
  vm.runInNewContext(fs.readFileSync(require.resolve('./mayatnik-symmetry.js'),'utf8'),ctx);
  ctx.MayatnikSymmetry.createWorker();
  const worker={postMessage:data=>{result=data;}};vm.runInNewContext(workerCode,worker);
  const field={W:21,H:13,val:new Int8Array(21*13).fill(1)},opts={anchor:10,directions:['v','h'],minRows:2,minBits:2};
  worker.onmessage({data:{field,opts,totems:true,minTriangleRows:4,bits:false}});
  assert.equal(result.rgba,null);
  assert.deepEqual([...result.triangles],[...S.triangles(S.find(field,opts),10,4)]);
});
