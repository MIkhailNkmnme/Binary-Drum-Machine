const assert=require('node:assert/strict');
const {test}=require('node:test');
const M=require('./mayatnik-line-measures.js');
const line=(a,b)=>({a,b});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);

test('crossings divide both lines; their parts sum to the full bit length',()=>{
  const lines=M.split([line([0,0],[10,0]),line([4,-4],[4,4])]);
  assert.deepEqual(lines.map(l=>l.segments.map(s=>s.length)),[[4,6],[4,4]]);
  for(const l of lines)near(l.segments.reduce((n,s)=>n+s.length,0),l.length);
});
test('diagonal steps, half-bit intersections and shared endpoints',()=>{
  const lines=M.split([line([0,0],[10,10]),line([2.5,-2],[2.5,8]),line([0,0],[-3,0])]);
  assert.deepEqual(lines[0].segments.map(s=>Math.round(s.length*100)/100),[2.5,7.5]);
  assert.equal(lines[2].segments.length,1);
  near(lines[0].length,10);
});
test('overlapping copies form one line while separated collinear lines stay separate',()=>{
  const lines=M.split([line([0,0],[10,0]),line([12,0],[4,0]),line([20,0],[25,0]),line([0,2],[12,2])]);
  assert.deepEqual(lines.map(l=>l.length),[12,5,12]);
  assert.ok(lines.every(l=>l.segments.length===1));
});
test('degenerate and invalid lines do not produce numbers or spurious cuts',()=>{
  assert.deepEqual(M.split([line([0,0],[0,0]),line([NaN,0],[1,1])]),[]);
  assert.equal(M.clip([0,0],[10,0],{left:2,right:8,top:1,bottom:3}),null);
  assert.deepEqual(M.clip([0,0],[10,10],{left:2,right:8,top:1,bottom:9}),[[2,2],[8,8]]);
});
test('many guide lines use exact intersections without losing endpoints',()=>{
  const input=[];for(let i=0;i<50;i++){input.push(line([0,i],[49,i]));input.push(line([i,0],[i,49]));}
  const result=M.split(input);assert.equal(result.length,100);
  assert.ok(result.every(l=>l.segments.length===49));
  assert.ok(result.every(l=>l.segments.every(s=>Math.abs(s.length-1)<1e-8)));
});
test('Canvas capture preserves drawing calls, clip rectangles and bit coordinates',()=>{
  let strokes=0;const context={strokeStyle:'#ffffff',beginPath(){},moveTo(){},lineTo(){},save(){},restore(){},rect(){},clip(){},stroke(){strokes++;}};
  const captured=M.capture(context,G=>{
    assert.equal(G.measureTarget,context);G.save();G.beginPath();G.rect(14,18,12,10);G.clip();
    G.beginPath();G.moveTo(10,20);G.lineTo(30,20);G.stroke();G.restore();
    G.beginPath();G.moveTo(10,20);G.lineTo(10,1000);G.recordLine([10,20],[10,40],{replace:true});G.stroke();
  },{origin:[10,20],scale:2});
  assert.equal(strokes,2);
  assert.deepEqual(captured.map(l=>[l.a,l.b]),[[[2,0],[8,0]],[[0,0],[0,10]]]);
});
