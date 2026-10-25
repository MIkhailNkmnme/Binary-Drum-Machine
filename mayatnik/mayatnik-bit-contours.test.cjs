const test=require('node:test'),assert=require('node:assert/strict'),C=require('./mayatnik-bit-contours.js');
function edges(rows,region={}){const out=[];C.segments({width:rows[0].length,height:rows.length,read:(x,y)=>rows[y][x],...region},(...line)=>out.push(line));return out;}
test('same bits merge into one outer rectangle; shared zero/one edge is emitted once',()=>{
 assert.deepEqual(edges([[0,0],[0,0]]),[[0,0,2,0],[0,2,2,2],[0,0,0,2],[2,0,2,2]]);
 const split=edges([[0,1],[0,1]]);assert.equal(split.length,5);assert.equal(split.filter(l=>l.join()=== '1,0,1,2').length,1);
 assert.equal(edges([[-1,-1],[-1,-1]]).length,0);
});
test('external boundaries and inner holes are kept; diagonally touching cells are separate',()=>{
 const ring=edges([[1,1,1],[1,-1,1],[1,1,1]]);assert.equal(ring.length,8);
 assert.equal(edges([[1,-1],[-1,1]]).length,6,'collinear segments may join at a corner without adding an internal edge');
});
test('clipping reads only visible cells and one neighbour, without outlining the viewport boundary',()=>{
 let calls=0;const out=[];C.segments({width:100000,height:100000,left:500,top:600,right:510,bottom:610,read:()=>{calls++;return 1;}},(...line)=>out.push(line));assert.deepEqual(out,[]);assert.ok(calls<=440);
 const small=edges([[0,0,1,1],[0,0,1,1]],{left:1,top:0,right:3,bottom:2});assert.equal(small.filter(l=>l[0]===l[2]).length,1);
});
test('outline geometry uses bits even when display colours are identical',()=>{
 assert.equal(C.boundary(0,1),true);assert.equal(C.boundary(0,0),false);assert.equal(C.boundary(-1,-1),false);assert.equal(C.boundary(1,-1),true);
});
test('unknown historical cells do not invent edges and are cached once during minification',()=>{
 for(const known of [-1,0,1]){assert.equal(C.boundary(-2,known),false);assert.equal(C.boundary(known,-2),false);}
 const reads=new Map();C.paint(canvas(),{width:100,height:100,read:(x,y)=>{const key=x+','+y;reads.set(key,(reads.get(key)||0)+1);return -2;},scale:.1,screenWidth:20,screenHeight:20});
 assert.ok([...reads.values()].every(count=>count===1));
});
function canvas(){const lines=[],state=[];let start;return {lines,state,save(){state.push('save');},restore(){state.push('restore');},beginPath(){},rect(){},clip(){},moveTo(x,y){start=[x,y];},lineTo(x,y){lines.push([...start,x,y]);},stroke(){state.push({lineWidth:this.lineWidth,colour:this.strokeStyle});}};}
test('canvas keeps two-screen-pixel stroke width at every zoom and exact fractional outside edges',()=>{
 for(const scale of [.25,.75,1,4,16]){
  const ctx=canvas(),x=3.25,y=7.5,w=3*scale,h=2*scale;const count=C.paint(ctx,{width:3,height:2,read:()=>1,x,y,scale,screenWidth:100,screenHeight:100});
  assert.equal(count,4);assert.deepEqual(ctx.lines,[[x,y,x+w,y],[x,y+h,x+w,y+h],[x,y,x,y+h],[x+w,y,x+w,y+h]]);assert.deepEqual(ctx.state,['save',{lineWidth:2,colour:'#ffe969'},'restore']);
 }
});
test('minification samples semantic bits at pixel centres, with one shared edge and retained emptiness',()=>{
 const ctx=canvas();C.paint(ctx,{width:8,height:4,read:(x,y)=>x<4?0:1,scale:.5,screenWidth:20,screenHeight:20});
 assert.equal(ctx.lines.length,5);assert.equal(ctx.lines.filter(l=>l.join()==='2,0,2,2').length,1);
 const empty=canvas();C.paint(empty,{width:800,height:800,read:()=>-1,scale:.01,screenWidth:20,screenHeight:20});assert.deepEqual(empty.lines,[]);
 const samples=[];C.paint(canvas(),{width:5,height:1,read:(x,y)=>{samples.push([x,y]);return 1;},scale:.4,screenWidth:20,screenHeight:20});assert.ok(samples.every(([x,y])=>[1,3].includes(x)&&y===0));
});
test('minification work is bounded by viewport even for millions of cells and deep zoom-out',()=>{
 for(const scale of [.0001,.01,.5]){
  let calls=0;const ctx=canvas(),screenWidth=64,screenHeight=48;C.paint(ctx,{width:10000000,height:10000000,read:(x,y)=>{calls++;assert.ok(x>=0&&x<10000000&&y>=0&&y<10000000);return 1;},x:-20.5,y:-40.25,scale,screenWidth,screenHeight});
  assert.ok(calls<=(screenWidth+5)*(screenHeight+5),String(calls));assert.deepEqual(ctx.lines,[],'uniform interior has no false viewport outline');
 }
 let calls=0;assert.equal(C.paint(canvas(),{width:10000000,height:10000000,read:()=>{calls++;return 1;},x:1000,y:1000,scale:.5,screenWidth:64,screenHeight:48}),0);assert.equal(calls,0);
});
test('viewport clips stroke but includes a boundary just beyond its edge',()=>{
 const ctx=canvas();C.paint(ctx,{width:20,height:20,read:x=>x<5?0:1,x:-20.5,y:-20,scale:4,screenWidth:10,screenHeight:10});assert.deepEqual(ctx.lines,[[-.5,-4,-.5,12]]);
 for(const scale of [0,-1,NaN,Infinity]){const ctx=canvas();assert.equal(C.paint(ctx,{width:10,height:10,read:()=>1,scale,screenWidth:20,screenHeight:20}),0);assert.deepEqual(ctx.state,[]);}
});
