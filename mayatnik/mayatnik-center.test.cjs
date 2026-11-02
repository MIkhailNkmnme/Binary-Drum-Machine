const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('./mayatnik-center.js'),M=require('./mayatnik-core.js');
const fs=require('node:fs'),vm=require('node:vm'),R=require('./mayatnik-rombo.js');
test('empty field has no centre; rectangle includes both zero and one cells',()=>{
 assert.equal(C.measure(M.field(8,4,'empty')).center,null);
 assert.deepEqual(C.measure(M.field(8,4,'0')).center,{x:4,y:2});
 assert.deepEqual(C.measure(M.field(8,4,'1')).center,{x:4,y:2});
});
test('one cone has its area centre below half-height; colours do not move it',()=>{
 const f=M.field(11,4,'empty',5);M.cone(f,5,4);
 const a=C.measure(f);assert.deepEqual(a.center,{x:5.5,y:2.5});assert.equal(a.count,10);
 for(let i=0;i<f.val.length;i++)if(f.val[i]>=0)f.val[i]^=1;
 assert.deepEqual(C.measure(f).center,a.center);
});
test('translation and reflection of an asymmetric footprint transform its centre',()=>{
 const f={W:8,H:3,val:new Int8Array(24).fill(-1)};f.val[0]=1;f.val[9]=0;f.val[10]=1;
 const a=C.measure(f),g={...f,val:new Int8Array(24).fill(-1)};
 for(let r=0;r<3;r++)for(let c=0;c<8;c++)g.val[r*8+7-c]=f.val[r*8+c];
 assert.equal(C.measure(g).center.x,8-a.center.x);assert.equal(C.measure(g).center.y,a.center.y);
 assert.equal(a.zero,1);assert.equal(a.one,2);assert.equal(a.empty,21);
});

test('composite centre counts overlapping cells once while retaining each copy subcentre',()=>{
 const part={width:4,height:2,read:(x,y)=>y===0&&x<2?0:-1};
 const a=C.compose([{...part,id:'a'},{...part,id:'b',transform:[1,0,0,1,1,0]}]);
 assert.equal(a.count,3);assert.deepEqual(a.center,{x:1.5,y:.5});
 assert.deepEqual(a.parts.map(p=>p.count),[2,2]);assert.deepEqual(a.parts.map(p=>p.center),[{x:1,y:.5},{x:2,y:.5}]);
});

test('asymmetric reflected figure gets a shared centre on the seam and separate group subcentres',()=>{
 const part={width:4,height:3,read:(x,y)=>x===0&&y<2?y:-1};
 const a=C.compose([{...part,id:'top'},{...part,id:'bottom',transform:[1,0,0,-1,0,6]}]);
 assert.equal(a.count,4);assert.deepEqual(a.center,{x:.5,y:3});assert.equal(a.parts.length,4);
 assert.deepEqual(C.compose([]),{count:0,center:null,parts:[]});
 assert.equal(C.compose([{...part,read:()=>-1}]).center,null);
});

test('live figure adapter uses visible semantic cells, RGB filters and the shared Rombo plan',()=>{
 const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8'),a=html.indexOf('  function geomCenterFigure(){'),b=html.indexOf('  function paintGeomCenter(',a),data=Int8Array.from([0,0,-1,-1,0,-1,-1,-1]);
 const ctx={img:{width:4,height:2},contourBits:data,st:{view:'bits'},rgbNeighbourClasses:new Uint8Array(8),RK:1,MayatnikCenter:C,rombP:()=>-1,rgbNeighbourBWMode:()=>0,rgbNeighbourFilters:()=>[1],cv:{getBoundingClientRect:()=>({width:40,height:20})},bothDraw:{},bothOn:()=>false,mirState:()=>({on:false}),window:{}};
 vm.createContext(ctx);vm.runInContext(html.slice(a,b),ctx);
 const ordinary=ctx.geomCenterFigure();assert.equal(ordinary.count,3);assert.equal(ordinary.center.x,5/6);assert.equal(ordinary.center.y,5/6);
 ctx.st.view='rgbNeighbours';ctx.rgbNeighbourClasses[1]=1;assert.equal(ctx.geomCenterFigure().count,1);assert.equal(ctx.geomCenterFigure().center.x,1.5);
 ctx.st.view='bits';ctx.st.edgeRhombOn=true;
 for(let assembly=0;assembly<16;assembly++)for(let angle=0;angle<360;angle+=45){
  const p=R.plan(4,2,{row:1,assembly,angle});ctx.window.mayRombo={plan:()=>p};const result=ctx.geomCenterFigure();
  const expected=C.compose(p.parts.map(t=>({id:t.id,width:4,height:1,left:t.left,right:t.right,transform:t.matrix,read:(x,y)=>data[y*4+x]>=0?0:-1}))),centre=p.forward(expected.center);
  assert.equal(result.count,expected.count);assert.ok(Math.abs(result.center.x-centre.x)<1e-8);assert.ok(Math.abs(result.center.y-centre.y)<1e-8);
 }
});
