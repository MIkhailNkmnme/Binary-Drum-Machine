const test=require('node:test');
const assert=require('node:assert/strict');
const g=require('./mayatnik-pixel-grid');
const plan=opts=>g.policy({width:100,height:80,...opts});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);

// Count physical pixel centres by inverse projection of a half-open source
// square (or seam). Construct the actual angle, then check the exact integer
// lattice vectors, including cases where a pixel centre is on its boundary.
function count(x,y,span,scale,angle,flip,tx,ty){
  const theta=angle*Math.PI/180,s=scale*Math.sin(theta),c=scale*Math.cos(theta);
  const raw=[flip?-c:c,flip?-s:s,-s,c],m=raw.map(Math.round);
  m.forEach((v,i)=>near(raw[i],v));
  const [a,b,u,v]=m,det=a*v-b*u;
  const corners=[[x,y],[x+span,y],[x,y+1],[x+span,y+1]].map(([i,j])=>[a*i+u*j+tx,b*i+v*j+ty]);
  const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]);
  let pixels=0;
  for(let Y=Math.floor(Math.min(...ys));Y<Math.ceil(Math.max(...ys));Y++){
    for(let X=Math.floor(Math.min(...xs));X<Math.ceil(Math.max(...xs));X++){
      const px=X+.5-tx,py=Y+.5-ty;
      const i=(v*px-u*py)/det,j=(a*py-b*px)/det;
      if(i>=x&&i<x+span&&j>=y&&j<y+1)pixels++;
    }
  }
  return pixels;
}

test('all eight rotations give every full bit the same positive number of physical samples',()=>{
  for(let angle=0;angle<360;angle+=45)for(const flip of [false,true])for(const dpr of [1,1.25,2]){
    const p=plan({angle,dpr});
    for(const k of [1,2,3]){
      const r=g.raster(k*p.quantum/dpr,p);
      for(const [tx,ty] of [[0,0],[.5,.5],[-3.25,.75],[13.125,-21.25]]){
        for(const [x,y] of [[0,0],[9,-7],[-5,-13]]){
          assert.equal(count(x,y,1,r.quality,angle,flip,tx,ty),k*k*(angle%90?2:1));
        }
      }
    }
  }
});

test('minimum permitted scale retains both half-cell seams even at negative coordinates',()=>{
  for(let angle=0;angle<360;angle+=45){
    const p=plan({angle,halfCells:true});
    assert.equal(p.minK,angle%90?1:2);
    for(const [tx,ty] of [[0,0],[.5,.5],[.125,-.25]])for(const x of [-3,-2.5]){
      const n=count(x,-2,.5,p.minScale,angle,true,tx,ty);
      assert.equal(n,angle%90?1:2);
    }
  }
});

test('snap and directional steps operate in CSS units without rounding device pixel ratio',()=>{
  const dpr=1.25,p=plan({angle:-45,dpr}),q=Math.SQRT2/dpr;
  near(p.minScale,q);near(g.snap(.01,p,'down'),q);
  near(g.snap(2.5*q,p),3*q);near(g.snap(2.2*q,p,'down'),2*q);near(g.snap(2.2*q,p,'up'),3*q);
  near(g.step(2.25*q,p,1),3*q);near(g.step(2.25*q,p,-1),2*q);
  near(g.step(2*q,p,1),3*q);near(g.step(2*q,p,-1),q);
  assert.equal(g.format(q,p),'√2/1');assert.equal(g.format(2*q,p),'2√2/1');
  assert.equal(g.raster(2,p),null);assert.equal(g.format(2,p),'');
});

test('quarter-turns, reflections and compatible piece turns share a physical pitch; incompatible turns fail',()=>{
  assert.equal(plan({angle:45,pieceTurns:[1,3,-1]}).quantum,1);
  assert.equal(plan({angle:450,pieceTurns:[0,2,6]}).quantum,1);
  assert.equal(plan({angle:0,pieceTurns:[0,1]}).ok,false);
  assert.equal(plan({angle:360,pieceTurns:[]}).ok,false);
  assert.equal(plan({angle:10}).ok,false);assert.equal(plan({pieceTurns:[.5]}).ok,false);
  assert.equal(plan({angle:45,oneToOne:true}).ok,false);
  assert.equal(plan({oneToOne:true,halfCells:true}).ok,false);
  const p=plan({angle:270,dpr:1.5,oneToOne:true});
  assert.equal(p.ok,true);assert.equal(p.minK,1);assert.equal(p.maxK,1);
  assert.equal(g.format(p.minScale,p),'1/1');
});

test('strict raster rejects smaller fallback, non-lattice or oversized scales, including ceil overflow',()=>{
  assert.equal(plan({width:4000.01,height:3999.98}).ok,false);
  assert.equal(plan({width:16384,height:1}).maxK,1);
  assert.equal(plan({width:16385,height:1}).ok,false);
  assert.equal(plan({width:4000,height:4000,angle:45}).ok,false);
  assert.equal(plan({dpr:.5,maxZoom:1.9}).ok,false);
  const p=plan({width:100,height:200,maxZoom:5,dpr:1.25,angle:315});
  assert.equal(p.maxK,4);assert.equal(g.raster(5*Math.SQRT2/1.25,p),null);
  assert.deepEqual(g.raster(p.maxScale,p),{k:4,quality:4*Math.SQRT2,width:566,height:1132});
  assert.equal(g.snap(500,p),p.maxScale);assert.equal(g.raster(NaN,p),null);
  for(const bad of [{width:0},{height:-1},{maxZoom:Infinity},{dpr:NaN}])assert.equal(plan(bad).ok,false);
});


test('viewport display keeps the exact lattice through 512 regardless of whole raster area, full export remains bounded',()=>{
 for(const angle of [0,45,90,135,180,225,270,315])for(const dpr of [1,1.25,2]){
  const p=g.policy({width:2047,height:1024,angle,dpr,viewport:true}),s=g.snap(512,p);assert.ok(p.ok);assert.ok(g.raster(s,p));assert.ok(p.maxK>=Math.floor(512*dpr/p.quantum));assert.ok(g.raster(s,p).width*g.raster(s,p).height>16e6);
 }
 assert.equal(g.policy({width:1024,height:512}).maxK,5);assert.equal(g.policy({width:1024,height:512,viewport:true}).maxK,512);
 assert.equal(g.policy({width:1024,height:512,viewport:true,oneToOne:true}).maxK,1);
});


test('overview uses small rational steps without weakening the exact lattice or physical 1:1',()=>{
 for(const angle of [0,45,90,135,180,225,270,315])for(const dpr of [1,1.25,2]){
  const p=g.policy({width:1024,height:512,angle,dpr,viewport:true,overview:true});assert.ok(p.minScale<p.exactMinScale);
  let scale=p.exactMinScale;for(let i=0;i<24;i++){const next=g.step(scale,p,-1);assert.ok(next<=scale);scale=next;const r=g.raster(scale,p);assert.ok(r);assert.ok(r.overview);assert.ok(g.format(scale,p).includes('/'));}
  const enlarged=g.snap(512,p);assert.ok(enlarged>scale);assert.ok(!g.raster(enlarged,p).overview);
  assert.equal(g.snap(1e-100,p),p.minScale);assert.equal(g.raster(p.minScale/2,p),null);
  const locked=g.policy({...p,oneToOne:true});if(angle%90===0){assert.equal(locked.overview,false);assert.equal(locked.minScale,1/dpr);}
 }
 const p=g.policy({width:1024,height:512,viewport:true,overview:true});assert.equal(g.format(g.snap(.25,p),p),'1/4');assert.equal(g.format(g.snap(.125,p),p),'1/8');
 const exact=g.policy({width:1024,height:512,viewport:true});assert.equal(g.snap(.125,exact),1);
});
