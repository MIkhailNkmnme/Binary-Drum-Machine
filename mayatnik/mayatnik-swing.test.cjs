const test=require('node:test'),assert=require('node:assert/strict');
const S=require('./mayatnik-swing.js'),R=require('./mayatnik-view-rotation.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('each shown transition advances once; arrows, x2, backward and same-frame paint',()=>{
  let index=0,last=10;const shown=[12,12,13,15,14,12],expected=[-1,-1,-2,-3,-2,-1];
  for(let i=0;i<shown.length;i++){index=S.advance(index,last,shown[i]);last=shown[i];assert.equal(S.STEPS[index],expected[i]);}
  const saved=JSON.parse(JSON.stringify({index,last}));assert.equal(S.advance(saved.index,saved.last,saved.last),saved.index);
  assert.equal(S.STEPS[S.advance(2,127,0,true)],-3);
  assert.deepEqual(S.STEPS,[0,-1,-2,-3,-2,-1,0,1,2,3,2,1]);
});
test('seven base divisions measured from visible triangle, including cropped top',()=>{
  const geometry=S.triangle(31,12,(x,y)=>y>=2&&y<=9&&Math.abs(x-15)<=y-2?((x+y)&1):-1);
  assert.deepEqual(geometry,{top:2,bottom:9,left:8,right:22,width:15,height:8});
  for(const step of S.STEPS){const amount=step*geometry.width/(7*geometry.height),apex={x:15,y:2},left={x:8,y:10},right={x:23,y:10};
    assert.deepEqual(S.point(apex,amount,apex.y),apex);
    for(const p of [left,right]){const q=S.point(p,amount,apex.y);near(q.x-p.x,step*15/7);assert.equal(q.y,p.y);}
  }
});
test('inverse pointer and screen mask preserve source cells for every position and half turn',()=>{
  const pivot={x:375,y:225},apexY=83;
  for(const step of S.STEPS)for(const flipped of [false,true])for(let y=0;y<20;y++)for(let x=0;x<32;x++){
    const amount=step*32/(7*20),source={x:150+x+.5,y:apexY+y+.5};let screen=S.point(source,amount,apexY);if(flipped)screen=R.point(screen,pivot);
    let logical=flipped?R.point(screen,pivot):screen;logical=S.point(logical,-amount,apexY);
    near(logical.x,source.x);near(logical.y,source.y);
    // A flow sampled in screen coordinates hits the same 0/1 obstacle.
    assert.equal((Math.floor(logical.x-150)+Math.floor(logical.y-apexY))&1,(x+y)&1);
  }
});
test('DOM bounding rectangles undo shear and half turn without inflated hit-test width',()=>{
  const source={left:30,top:74,width:913,height:512},pivot={x:700,y:420};
  for(const step of S.STEPS){const amount=step*913/(7*512),screen=S.rect(source,amount,70),back=S.unrect(R.rect(R.rect(screen,pivot),pivot),amount,70);for(const key of ['left','top','width','height'])near(back[key],source[key]);}
});
test('PNG shear preserves full base without clipping and leaves height unchanged',()=>{
  for(const amount of [-3/7,3/7]){const calls=[],canvas={width:700,height:490},out={getContext:()=>({setTransform:(...v)=>calls.push(v),drawImage:(...v)=>calls.push(v)})};
    assert.equal(S.capture(canvas,amount,()=>out),out);assert.equal(out.width,910);assert.equal(out.height,490);calls[0].forEach((v,i)=>near(v,[1,0,amount,1,amount<0?210:0,0][i]));assert.equal(calls[1][0],canvas);
  }
});
