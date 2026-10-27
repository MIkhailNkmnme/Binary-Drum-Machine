const test=require('node:test'),assert=require('node:assert/strict');
const R=require('./mayatnik-view-rotation.js');
test('viewport rotation and inverse preserve offscreen, fractional and negative points',()=>{
  for(const viewport of [{left:20,top:85,width:1200,height:800},{left:-3.5,top:7.25,width:307.5,height:201.75}]){
    const c=R.center(viewport);
    for(let i=-40;i<=40;i++){const p={x:i*17.125,y:i*i*.5-330.25};assert.deepEqual(R.point(R.point(p,c),c),p);}
  }
});
test('logical rectangle is the inverse of all four transformed corners',()=>{
  const c={x:557.25,y:401.5};
  for(let i=1;i<100;i++){
    const r={left:-i*7,top:i*3.5,width:i*23,height:i*17};
    const corners=[[r.left,r.top],[r.left+r.width,r.top],[r.left,r.top+r.height],[r.left+r.width,r.top+r.height]].map(([x,y])=>R.point({x,y},c));
    const actual=R.rect(r,c);assert.equal(actual.left,Math.min(...corners.map(p=>p.x)));assert.equal(actual.top,Math.min(...corners.map(p=>p.y)));
    const inverse=R.rect(actual,c);for(const key of ['left','top','width','height'])assert.equal(inverse[key],r[key]);
  }
});
test('export turns the fully composed canvas once with exact canvas dimensions',()=>{
  const calls=[],canvas={width:317,height:199},out={getContext:()=>({translate:(...a)=>calls.push(['translate',...a]),scale:(...a)=>calls.push(['scale',...a]),drawImage:(...a)=>calls.push(['drawImage',...a])})};
  assert.equal(R.turnCanvas(canvas,()=>out),out);assert.equal(out.width,317);assert.equal(out.height,199);
  assert.deepEqual(calls,[['translate',317,199],['scale',-1,-1],['drawImage',canvas,0,0]]);
});
