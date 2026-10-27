const test=require('node:test');
const assert=require('node:assert/strict');
const Auto=require('./mayatnik-auto-axes.js');
const Core=require('./mayatnik-core.js');

function field(W,H,bit=1){return {W,H,val:new Int8Array(W*H).fill(bit)};}
function triangle(f,c,y,h){for(let r=0;r<h;r++)for(let x=c-h+1+r;x<=c+h-1-r;x++)f.val[(y+r)*f.W+x]=0;}
// Independent exhaustive cells oracle: no DP, packed coverage, or helper calls.
function oracle(f,minHeight=4){
  const candidates=[];
  for(let r=0;r<f.H;r++)for(let c=0;c<f.W;c++){
    let h=0;
    outer:for(let size=1;size<=Math.min(r+1,c+1,f.W-c);size++){
      for(let x=c-size+1;x<=c+size-1;x++)if(f.val[(r-size+1)*f.W+x]!==0)break outer;
      h=size;
    }
    if(h<minHeight)continue;
    let grows=r+1<f.H&&f.val[(r+1)*f.W+c]===0;
    if(grows)for(let y=0;y<h;y++){
      const radius=h-y;
      if(c-radius<0||c+radius>=f.W||f.val[(r-h+1+y)*f.W+c-radius]!==0||f.val[(r-h+1+y)*f.W+c+radius]!==0){grows=false;break;}
    }
    if(!grows)candidates.push({r,c,h});
  }
  candidates.sort((a,b)=>b.h-a.h||a.r-b.r||a.c-b.c);
  const out=[];
  for(const a of candidates){if(out.some(t=>a.r>=t.y&&a.r<t.y+t.h&&Math.abs(a.c-(t.x+t.h-1))<=t.y+t.h-1-a.r))continue;
    out.push({x:a.c-a.h+1,y:a.r-a.h+1,h:a.h,w:2*a.h-1,n:a.h*a.h,bit:0});}
  return out;
}
function segmentOracle(f,tris){
  const out=[];
  for(const c of [...new Set(tris.map(t=>t.x+t.h-1))].sort((a,b)=>a-b)){
    let start=null;
    for(let r=0;r<=f.H;r++){
      const visible=r<f.H&&f.val[r*f.W+c]>=0&&!tris.some(t=>r>=t.y&&r+.5<t.y+t.h-Math.abs(c-(t.x+t.h-1)));
      if(visible&&start===null)start=r;
      if(!visible&&start!==null){out.push({x:c+.5,y0:start,y1:r,h:r-start});start=null;}
    }
  }
  return out;
}

test('two aligned triangles leave top, apex-to-base, and bottom runs',()=>{
  const f=field(15,21);triangle(f,7,2,4);triangle(f,7,10,5);
  assert.deepEqual(Auto.analyze(f).segments,[{x:7.5,y0:0,y1:2,h:2},{x:7.5,y0:6,y1:10,h:4},{x:7.5,y0:15,y1:21,h:6}]);
});
test('a different triangle crossing an axis also interrupts its run',()=>{
  const f=field(21,25);triangle(f,10,1,4);triangle(f,13,10,5);
  const {triangles,segments}=Auto.analyze(f);
  assert.deepEqual(segments,segmentOracle(f,triangles));
  assert.deepEqual(segments.filter(s=>s.x===10.5),[{x:10.5,y0:0,y1:1,h:1},{x:10.5,y0:5,y1:10,h:5},{x:10.5,y0:12,y1:25,h:13}]);
});
test('start at the first real cell, split gaps, clip at the field bottom',()=>{
  const f=field(15,17);triangle(f,7,5,4);for(const r of [0,1,2,11,12])f.val[r*f.W+7]=-1;
  assert.deepEqual(Auto.analyze(f).segments,[{x:7.5,y0:3,y1:5,h:2},{x:7.5,y0:9,y1:11,h:2},{x:7.5,y0:13,y1:17,h:4}]);
});
test('no meeting-point restriction and no 60-triangle cap',()=>{
  const f=field(700,6);for(let i=0;i<70;i++)triangle(f,4+i*10,0,4);
  const a=Auto.analyze(f);assert.equal(a.triangles.length,70);assert.equal(a.segments.length,70);assert.ok(a.segments.every(s=>s.y0===4&&s.y1===6));
});
test('empty and nonzero fields have no artificial axes',()=>{
  for(const bit of [-1,1])assert.deepEqual(Auto.analyze(field(12,12,bit)),{triangles:[],segments:[]});
  assert.deepEqual(Auto.analyze(field(0,0)),{triangles:[],segments:[]});
});
test('logical bits and input arrays are unchanged',()=>{
  const f=field(13,12);triangle(f,6,3,4);const before=f.val.slice();Auto.analyze(f);assert.deepEqual(f.val,before);
});
test('nested and overlapping zero triangles match the independent oracle',()=>{
  for(const [W,H] of [[7,9],[13,15],[65,15]]){
    const f=field(W,H,0);assert.deepEqual(Auto.triangles(f),oracle(f));assert.deepEqual(Auto.analyze(f).segments,segmentOracle(f,oracle(f)));
  }
});
test('400 seeded mixed fields match exhaustive triangles and segment oracle',()=>{
  let seed=7114;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let trial=0;trial<400;trial++){
    const W=8+Math.floor(rnd()*25),H=8+Math.floor(rnd()*20),f=field(W,H);
    for(let i=0;i<f.val.length;i++){const p=rnd();f.val[i]=p<.12?-1:p<.88?0:1;}
    for(let j=0;j<3;j++){const h=2+Math.floor(rnd()*Math.min(5,(W-1)/2,H/2));if(2*h-1>W||h>H)continue;triangle(f,h-1+Math.floor(rnd()*(W-2*h+2)),Math.floor(rnd()*(H-h+1)),h);}
    const minHeight=2+(trial%4),expected=oracle(f,minHeight),actual=Auto.analyze(f,{minHeight});
    assert.deepEqual(actual.triangles,expected,`triangles ${trial}`);assert.deepEqual(actual.segments,segmentOracle(f,expected),`segments ${trial}`);
  }
});
test('real pendulum fields match the exhaustive oracle on 24 frames/backgrounds',()=>{
  for(const bg of ['empty','0','1'])for(let k=0;k<8;k++){
    const geo=Core.geometry('pend',8,32),f=Core.field(geo.W,32,bg,geo.anchor);
    for(let j=0;j<=k;j++)Core.cone(f,geo.anchor+Core.offset('pend',j),32);
    const a=Auto.analyze(f);assert.deepEqual(a.triangles,oracle(f));assert.deepEqual(a.segments,segmentOracle(f,a.triangles));
  }
});
test('invalid dimensions and thresholds are rejected',()=>{
  assert.throws(()=>Auto.analyze({W:3,H:4,val:new Int8Array(3)}),TypeError);
  for(const minHeight of [0,-1,1.5,NaN])assert.throws(()=>Auto.triangles(field(4,4),{minHeight}),RangeError);
});
test('the serialized worker computes the same complete result and reports errors',async()=>{
  const vm=require('node:vm'),fs=require('node:fs');let source='',revoked=false;
  const host={Blob:class{constructor(parts){source=parts.join('');}},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:()=>{revoked=true;}},Worker:class{constructor(url){this.url=url;}}};
  host.globalThis=host;vm.runInNewContext(fs.readFileSync(require.resolve('./mayatnik-auto-axes.js'),'utf8'),host);
  assert.equal(host.MayatnikAutoAxes.createWorker().url,'blob:test');assert.equal(revoked,true);
  const replies=[],worker={postMessage:message=>replies.push(message)};vm.runInNewContext(source,worker);
  const f=field(17,20);triangle(f,8,2,4);triangle(f,9,10,5);
  worker.onmessage({data:{id:'frame-1',field:f}});
  assert.deepEqual(JSON.parse(JSON.stringify(replies[0])),{id:'frame-1',...Auto.analyze(f)});
  assert.equal(replies.length,1);
  worker.onmessage({data:{id:'bad',field:{}}});assert.equal(replies[1].id,'bad');assert.match(replies[1].error,/finite/);
});
