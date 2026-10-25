const test=require('node:test'),assert=require('node:assert/strict');
const S=require('./mayatnik-symmetry.js');
const mod=n=>((n%2)+2)%2;
// Independent brute-force reflection: enumerate each geometric axis and compare
// symmetric coordinates directly, without palindrome radii or the fast scanner.
function reference(f,o={}){
  const {W,H,val}=f,A=o.anchor||0,result=[];
  const scans=(o.directions||['v','h','d','u']).flatMap(dir=>[0,1].map(p=>({dir,p}))).concat((o.plainDirections||[]).map(dir=>({dir,p:-1})));
  for(const {dir,p} of scans){
    const amin=dir==='d'?1-H:0,amax=dir==='v'?W-1:dir==='h'?H-1:dir==='d'?W-1:W+H-2;
    for(let a=amin;a<=amax;a+=p===-1&&['v','h'].includes(dir)?.5:1){
      const ts=dir==='v'?Array.from({length:H},(_,i)=>i):dir==='h'?Array.from({length:W},(_,i)=>i):dir==='d'?Array.from({length:W+H-1},(_,i)=>i).filter(t=>p===-1||mod(t-A)===p):Array.from({length:W+H-1},(_,i)=>i-H+1).filter(t=>p===-1||mod(t-A)===p);
      let run=null;
      const finish=()=>{if(run&&run.widths.length>=(o.minRows||2)&&run.widths.length<=(o.maxRows||Infinity))result.push(run);run=null;};
      for(const t of ts){
        const [x,y]=dir==='v'?[a,t]:dir==='h'?[t,a]:dir==='d'?[(t+a)/2,(t-a)/2]:[(a+t)/2,(a-t)/2];
        const [dx,dy]=dir==='v'?[p===-1?1:2,0]:dir==='h'?[0,p===-1?1:2]:dir==='d'?[1,-1]:[1,1];
        const through=Number.isInteger(x)&&Number.isInteger(y)&&(p===-1||mod(x-y-A)===p);
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
    const n=s.widths.length,dt=s.dir==='v'||s.dir==='h'||s.p===-1?1:2,straight=['v','h'].includes(s.dir),unit=straight?1:dt/2;
    const candidates=[];
    for(let i=0;i<n;i++){
      const ai=sign===1?i:n-1-i;let last=i;
      for(let j=i;j<n;j++){
        const idx=sign===1?j:n-1-j;
        const [x,y]=S.point(s.dir,s.axis,s.t0+idx*dt);
        const through=Number.isInteger(x)&&Number.isInteger(y)&&(s.p===-1||mod(x-y-anchor)===s.p);
        const radius=(s.widths[idx]-(through?0:.5))*(straight?(s.p===-1?1:2):1);
        if(radius<(j-i)*unit)break;last=j;
      }
      const bi=sign===1?last:n-1-last,h=(last-i)*unit;
      const a=S.point(s.dir,s.axis,s.t0+ai*dt),b=S.point(s.dir,s.axis,s.t0+bi*dt);
      const dx=s.dir==='h'?0:h,dy=s.dir==='v'?0:s.dir==='d'?-h:h;
      candidates.push({height:last-i+1,coords:[...a,b[0]-dx,b[1]-dy,b[0]+dx,b[1]+dy,s.p]});
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
test('ordinary axes on every cell, alone and alongside checkerboard axes, equal independent reflection',()=>{
 let seed=47;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let trial=0;trial<48;trial++){const W=5+trial%6,H=4+trial%5,f={W,H,val:Int8Array.from({length:W*H},()=>rnd()%11===0?-1:(rnd()>>>12)%2)},o={anchor:trial%3,directions:trial%2?[]:['v','h','d','u'],plainDirections:['v','h','d','u'],minBits:1+trial%2,minRows:1+trial%3,maxRows:trial%4?0:3,maxBits:trial%3?0:2};assert.deepEqual(normalize(S.find(f,o)),normalize(reference(f,o)));}
});
test('ordinary spans and highlights cover adjacent cells and retain half-cell axes',()=>{
 const f={W:8,H:7,val:new Int8Array(56).fill(1)},o={directions:[],plainDirections:['v','h','d','u'],minRows:2,minBits:2},segs=S.find(f,o),expected=new Set();assert.ok(segs.some(s=>s.dir==='v'&&s.axis%1===.5));assert.ok(segs.every(s=>s.p===-1));
 for(const s of segs)for(let i=0;i<s.widths.length;i++){const span=S.span(s,i,0);for(let j=0;j<span.n;j++){const x=span.x+j*span.dx,y=span.y+j*span.dy;assert.ok(Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&x<f.W&&y>=0&&y<f.H);expected.add(y*f.W+x);}}
 const rgba=S.highlights(f,segs,0);for(let q=0;q<f.val.length;q++)assert.equal(rgba[q*4+3]>0,expected.has(q));
});
test('ordinary triangles fit the same mirrored spans on straight and half-step diagonal slices',()=>{
 let seed=83;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};for(const dir of ['v','h','d','u'])for(let trial=0;trial<40;trial++){const segs=[{dir,p:-1,axis:16+(trial%2&&['v','h'].includes(dir)?.5:0),t0:4,t1:16,widths:Array.from({length:13},()=>1+rnd()%7)}];assert.deepEqual(unpackTriangles(S.triangles(segs,0,3)),referenceTriangles(segs,0,3));}
});
test('checkerboard can be symmetric when adjacent cells break an ordinary axis; empty gaps split ordinary runs',()=>{
 const f={W:5,H:2,val:Int8Array.from([0,1,1,0,0,0,1,1,0,0])};const all=S.find(f,{directions:['v'],plainDirections:['v'],minBits:1,minRows:1});assert.ok(all.some(s=>s.p>=0&&s.axis===2));assert.ok(!all.some(s=>s.p===-1&&s.axis===2));const hole={W:7,H:3,val:new Int8Array(21).fill(1)};hole.val.fill(-1,7,14);assert.equal(S.find(hole,{directions:[],plainDirections:['v'],minBits:1,minRows:2}).length,0);
});
test('worker message path passes ordinary directions through to all outputs',async()=>{const vm=require('node:vm'),create=URL.createObjectURL,revoke=URL.revokeObjectURL,oldWorker=global.Worker;let blob;try{URL.createObjectURL=b=>(blob=b,'blob:test');URL.revokeObjectURL=()=>{};global.Worker=class{};S.createWorker();const text=await blob.text();let result;const c=vm.createContext({postMessage:data=>result=data});vm.runInContext(text,c);const field={W:7,H:7,val:new Int8Array(49).fill(1)},opts={directions:[],plainDirections:['v','h','d','u'],minRows:2,minBits:1};c.onmessage({data:{field,opts,bits:true,totems:true,minTriangleRows:2}});assert.deepEqual([...normalize(result.segs)],normalize(S.find(field,opts)));assert.ok(result.rgba.length===196&&result.triangles.length>0);}finally{URL.createObjectURL=create;URL.revokeObjectURL=revoke;global.Worker=oldWorker;}});
