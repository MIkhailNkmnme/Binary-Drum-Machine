const test=require('node:test'),assert=require('node:assert/strict');
const S=require('./mayatnik-symmetry.js');

// Independent geometric oracle: reflect endpoints, not axis/t coordinates.
const endpoints=s=>{
  const at=t=>s.dir==='v'?[s.axis,t]:s.dir==='h'?[t,s.axis]:
    s.dir==='d'?[(t+s.axis)/2,(t-s.axis)/2]:[(s.axis+t)/2,(s.axis-t)/2];
  return [at(s.t0),at(s.t1)];
};
const normalized=points=>points.map(p=>p.join(',')).sort().join(';');
function peers(segs,s,anchor){
  const reflected=normalized(endpoints(s).map(([x,y])=>[2*anchor-x,y]));
  const dir={v:'v',h:'h',d:'u',u:'d'}[s.dir];
  return segs.filter(q=>q===s||q.p===s.p&&q.dir===dir&&normalized(endpoints(q))===reflected);
}
const make=(dir,p,axis,t0,t1,widths=[1,1,1],colour=[10,20,30])=>({dir,p,axis,t0,t1,widths,colour});

test('all directions and lattices group exactly reflected endpoints about the actual anchor',()=>{
  for(const anchor of [2,5])for(const p of [-1,0,1]){
    const C=2*anchor,dt=p===-1?1:2;
    const segs=[make('v',p,anchor-1.5,1,3),make('v',p,anchor+1.5,1,3),
      make('h',p,3,0,2),make('h',p,3,C-2,C),
      make('d',p,-2,2,2+2*dt),make('u',p,C+2,C-2-2*dt,C-2),
      make('v',p,anchor-1.5,2,4),make('v',p,anchor+1.5,3,5),
      make('v',p,anchor,1,3),make('h',p,4,anchor-1,anchor+1)];
    const before=JSON.stringify(segs),groups=S.mirrorGroups(segs,anchor);
    for(const s of segs){
      const group=groups.get(S.segmentKey(s));
      assert.deepEqual(new Set(group.segments),new Set(peers(segs,s,anchor)),S.segmentKey(s));
      for(const peer of group.segments)assert.equal(groups.get(S.segmentKey(peer)),group);
    }
    assert.equal(JSON.stringify(segs),before,'grouping leaves all search records untouched');
  }
});

test('same row, different lengths or lattice, and absent counterparts stay independent',()=>{
  const a=make('v',0,2,1,3),otherLattice=make('v',1,8,1,3),short=make('v',0,8,1,2),
    sameRow=make('v',0,7,1,3),b=make('v',0,8,1,3,[4,3,2],[99,88,77]);
  const segs=[a,otherLattice,short,sameRow,b],groups=S.mirrorGroups(segs,5);
  assert.deepEqual(groups.get(S.segmentKey(a)).segments,[a,b]);
  for(const s of [otherLattice,short,sameRow]){
    assert.deepEqual(groups.get(S.segmentKey(s)).segments,[s]);
    assert.equal(groups.get(S.segmentKey(s)).colour,s.colour);
  }
  const reversed=S.mirrorGroups([...segs].reverse(),5);
  for(const s of segs)assert.deepEqual(groups.get(S.segmentKey(s)).colour,reversed.get(S.segmentKey(s)).colour);
  assert.deepEqual(S.mirrorGroups(segs.filter(s=>s!==b),5).get(S.segmentKey(a)).segments,[a]);
});

test('real full-grid and checkerboard searches match geometric oracle, including half-cell axes',()=>{
  for(const anchor of [2,5]){
    const field={W:11,H:9,val:Int8Array.from({length:99},(_,q)=>((q%11-anchor)**2+Math.floor(q/11))%3?1:0)};
    const segs=S.find(field,{anchor,minRows:1,minBits:1,plainDirections:['v','h','d','u']});
    const groups=S.mirrorGroups(segs,anchor);
    assert.ok(segs.some(s=>s.axis%1!==0));
    for(const s of segs)assert.deepEqual(new Set(groups.get(S.segmentKey(s)).segments),new Set(peers(segs,s,anchor)));
  }
});

test('global bit highlights use the shared colour, preserving coverage and source bits',()=>{
  const field={W:11,H:7,val:new Int8Array(77).fill(1)},before=field.val.slice();
  const a=make('v',-1,2,1,3,[1,1,1],[10,20,30]),b=make('v',-1,8,1,3,[1,1,1],[100,200,250]);
  const rgba=S.highlights(field,[a,b],5),colour=S.mirrorGroups([a,b],5).get(S.segmentKey(a)).colour;
  for(let y=0;y<7;y++)for(let x=0;x<11;x++){
    const q=(y*11+x)*4,inside=y>=1&&y<=3&&([1,2,3,7,8,9].includes(x));
    assert.deepEqual(Array.from(rgba.slice(q,q+4)),inside?[...colour,255]:[0,0,0,0]);
  }
  assert.deepEqual(field.val,before);
  assert.deepEqual(b.colour,[100,200,250]);
});

test('large sets use bounded indexed passes instead of pairwise searches',()=>{
  const n=50000,anchor=n,segs=[];
  for(let x=0;x<n;x++)segs.push(make('v',-1,x,0,2),make('v',-1,2*n-x,0,2));
  const groups=S.mirrorGroups(segs,anchor);
  assert.equal(groups.size,2*n);
  assert.equal(groups.get(S.segmentKey(segs[n])).segments.length,2);
});

test('worker colours match fallback grouping with the supplied central anchor',()=>{
  const vm=require('node:vm'),fs=require('node:fs');let workerCode,result;
  const context={Blob:class{constructor(parts){workerCode=parts.join('');}},URL:{createObjectURL:()=>'',revokeObjectURL:()=>{}},Worker:class{}};
  vm.runInNewContext(fs.readFileSync(require.resolve('./mayatnik-symmetry.js'),'utf8'),context);
  context.MayatnikSymmetry.createWorker();
  const worker={postMessage:data=>{result=data;}};vm.runInNewContext(workerCode,worker);
  const field={W:11,H:9,val:new Int8Array(99).fill(1)},opts={anchor:5,directions:['v','h','d','u'],plainDirections:['v','h','d','u'],minRows:1,minBits:1};
  worker.onmessage({data:{field,opts,bits:true,totems:false}});
  assert.deepEqual([...result.rgba],[...S.highlights(field,S.find(field,opts),opts.anchor)]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.segs)),S.find(field,opts));
});
