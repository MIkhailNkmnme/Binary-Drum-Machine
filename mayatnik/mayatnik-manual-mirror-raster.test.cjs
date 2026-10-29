const test=require('node:test'),assert=require('node:assert/strict');
const Mirror=require('./mayatnik-manual-mirror-raster.js');
// Independent reflection across ax+by+c=0, not the production swap formulas.
function line(z,A){return z.k==='h'?[0,1,-z.p]:z.k==='v'?[1,0,-A-.5-z.p]:z.k==='d'?[1,-1,-A-z.p]:[1,1,-A-1-z.p];}
function reflect(x,y,L){const [a,b,c]=L,t=2*(a*x+b*y+c)/(a*a+b*b);return {x:x-a*t,y:y-b*t};}
function oracle(input,W,H,S,A,axes,allowed,filter=()=>true){
  const px=input.slice(),centers=Array.from(input,(_,q)=>({x:(q%W+.5)/S,y:(Math.floor(q/W)+.5)/S}));
  for(const z of axes){const src=px.slice(),old=centers.map(c=>({...c})),L=line(z,A);for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const cx=(x+.5)/S,cy=(y+.5)/S,sd=L[0]*cx+L[1]*cy+L[2],q=y*W+x,positive=z.k==='h'||z.k==='v'?z.m===1:z.m!==1;
    if(!sd||(positive?sd<0:sd>0)||z.k==='h'&&z.m===2&&allowed&&!allowed(x,y,q))continue;
    const p=reflect(cx,cy,L),sx=Math.floor(p.x*S),sy=Math.floor(p.y*S);if(sx<0||sx>=W||sy<0||sy>=H)continue;const sq=sy*W+sx;if(!filter(src[sq],q,z))continue;
    px[q]=z.op==='xor'?src[sq]^px[q]:z.op==='and'?src[sq]&px[q]:src[sq];if(!z.op)centers[q]=reflect(old[sq].x,old[sq].y,L);
  }}return {px,centers};
}
test('all manual families reflect exact display pixels at integer/half axes and several raster scales',()=>{
  let cases=0;for(const S of [1,2,4])for(const k of ['h','v','d','e'])for(const m of [1,2])for(const half of [0,.5]){
    const W=12*S,H=10*S,A=5,input=Uint32Array.from({length:W*H},(_,q)=>q+1),axis={k,m,p:(k==='h'?4:0)+half},actual=input.slice();
    Mirror.apply(actual,{width:W,height:H,scale:S,anchor:A,axes:[axis]});assert.deepEqual(actual,oracle(input,W,H,S,A,[axis]).px,JSON.stringify({S,k,m,half}));cases++;
  }assert.equal(cases,48);
});
test('upward destination mask is sampled once before every manual pass and excludes original empty cells',()=>{
  const W=9,H=8,input=Uint32Array.from({length:W*H},(_,q)=>q+1),original=input.slice(),allowed=(x,y)=>Math.abs(x-4)<=y,axes=[{k:'v',p:0,m:1},{k:'h',p:4,m:2},{k:'h',p:2.5,m:2}],actual=input.slice();let checked=0;
  Mirror.apply(actual,{width:W,height:H,anchor:4,axes,targetAllowed:(x,y)=>{checked++;assert.deepEqual(actual,original,'mask is captured before mutations');return allowed(x,y);}});
  assert.equal(checked,W*H);assert.deepEqual(actual,oracle(input,W,H,1,4,axes,allowed).px);
});
test('COPY provenance returns transformed cell centres after clipped/filtered compositions; XOR and AND retain destination ownership',()=>{
  const W=16,H=12,S=2,A=3,axes=[{k:'h',p:3,m:1,op:''},{k:'v',p:.5,m:2,op:''},{k:'h',p:2,m:2,op:'xor'},{k:'d',p:0,m:1,op:''},{k:'e',p:2,m:2,op:'and'}];
  const input=Uint32Array.from({length:W*H},(_,q)=>q+1),actual=input.slice(),allowed=(x,y)=>x>=y/2,filter=v=>v%3!==0;
  const result=Mirror.apply(actual,{width:W,height:H,scale:S,anchor:A,axes,targetAllowed:allowed,trace:true,cellAt:(x,y)=>({x:(x+.5)/S,y:(y+.5)/S}),
    put(q,v,sq,z){if(!filter(v))return false;actual[q]=z.op==='xor'?v^actual[q]:z.op==='and'?v&actual[q]:v;return true;}});
  const expected=oracle(input,W,H,S,A,axes,allowed,filter);assert.deepEqual(actual,expected.px);for(let q=0;q<actual.length;q++)assert.deepEqual(result.cellAt(q%W,Math.floor(q/W)),expected.centers[q],'pixel '+q);
  assert.equal(result.traceBytes,3*Math.ceil(W*H/8));
});
test('no paint tracking allocates no provenance and identity mapper stays usable without active mirrors',()=>{
  const px=new Uint32Array(8),cellAt=(x,y)=>({x,y});assert.equal(Mirror.apply(px,{width:4,height:2,cellAt}).cellAt,cellAt);
  assert.equal(Mirror.apply(px,{width:4,height:2,cellAt,axes:[{k:'h',p:1,m:1}]}).traceBytes,0);
});
test('diamond COPY ownership composes with whole-cell paint at integer and half-row axes in every projected view',()=>{
  const Joined=require('./mayatnik-joined-romb.js'),Lines=require('./mayatnik-manual-lines.js');let cases=0,changedOwnership=0;
  for(const view of ['romb0','romb1','romb2','rombJoin','rombJoin180'])for(const S of [1,2,4])for(const p of [3,3.5]){
    const width=9,height=7,A=4,gap=2,joined=view.startsWith('rombJoin')?Joined.create({width,height,anchor:A,rotate:view==='rombJoin180'}):null,DW=joined?joined.width:view==='romb2'?2*width+gap:width,DH=joined?joined.height:height,W=DW*S,H=DH*S;
    const raw=(c,r)=>c>=0&&c<width&&r>=0&&r<height&&Math.abs(c-A)<=r?((c*3+r*7)^r)&1:-1;
    function baseCell(x,y){const fx=(x+.5)/S,fy=(y+.5)/S;let c,r,parity,ox=0;
      if(joined){const hit=joined.hit(fx,fy);if(!hit)return null;c=hit.c;r=hit.r;parity=hit.p;}
      else{parity=view==='romb1'?1:0;let xx=fx;if(view==='romb2'){if(fx>=width&&fx<width+gap)return null;if(fx>=width+gap){parity=1;ox=width+gap;xx-=ox;}}
        const u=xx-.5-A-parity,v=fy-.5,i=Math.round((u+v)/2),j=Math.round((u-v)/2);c=i+j+A+parity;r=i-j;}
      if(raw(c,r)<0)return null;const point=joined?joined.point(c+.5,r+.5,parity):{x:c+ox+.5,y:r+.5};return {...point,bit:raw(c,r)};
    }
    const input=Uint32Array.from({length:W*H},(_,q)=>{const cell=baseCell(q%W,Math.floor(q/W));return cell?cell.bit?29:17:0;}),actual=input.slice(),axes=[{k:'h',p,m:1,op:''},{k:'h',p:2.5,m:2,op:''}],expected=input.slice();let owners=Array.from(input,(_,q)=>baseCell(q%W,Math.floor(q/W)));
    for(const z of axes){const before=expected.slice(),old=owners.slice(),L=line(z,A);for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const q=y*W+x,cx=(x+.5)/S,cy=(y+.5)/S,sd=cy-z.p;if(!sd||(z.m===1?sd<0:sd>0)||z.m===2&&!baseCell(x,y))continue;
      const source=reflect(cx,cy,L),sx=Math.floor(source.x*S),sy=Math.floor(source.y*S);if(sx<0||sx>=W||sy<0||sy>=H)continue;const sq=sy*W+sx;expected[q]=before[sq];owners[q]=old[sq]?{...old[sq],...reflect(old[sq].x,old[sq].y,L)}:null;
    }}
    const result=Mirror.apply(actual,{width:W,height:H,scale:S,anchor:A,axes,trace:true,cellAt:baseCell,targetAllowed:(x,y)=>!!baseCell(x,y)});assert.deepEqual(actual,expected,view+' mirror '+S+'/'+p);
    for(let q=0;q<actual.length;q++){const got=result.cellAt(q%W,Math.floor(q/W)),want=owners[q];assert.deepEqual(got,want,view+' cell '+q);if(JSON.stringify(got)!==JSON.stringify(baseCell(q%W,Math.floor(q/W))))changedOwnership++;}
    const bits=Int8Array.from(actual,v=>v===0?-1:v===17?0:1),colour=0xff20aa33;
    Lines.paintRaster(actual,{width:W,height:H,anchor:A,axes:[{kind:'h',p:2.5,paint:3}],cellAt:result.cellAt,bits,colour});
    for(let q=0;q<expected.length;q++)if(bits[q]>=0&&owners[q]&&Math.abs(owners[q].y-2.5)<=.5)expected[q]=colour;
    assert.deepEqual(actual,expected,view+' paint '+S+'/'+p);cases++;
  }assert.equal(cases,30);assert.ok(changedOwnership>100);
});
