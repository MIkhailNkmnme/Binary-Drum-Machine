const test=require('node:test'),assert=require('node:assert/strict'),A=require('./mayatnik-axis-colour.js');
function traced(a,b,options={}){const got=new Set();A.traceCells(a,b,{clip:[0,0,8,8],...options},(x,y)=>got.add(x+','+y));return [...got].sort();}
test('axis through centres, common edges and diagonals visits exact incident cells',()=>{
 assert.deepEqual(traced([2.5,2.5],[2.5,2.5]),[]);
 assert.deepEqual(traced([2.5,0],[2.5,4],{clip:[0,0,8,4]}),['2,0','2,1','2,2','2,3']);
 assert.deepEqual(traced([2,0],[2,2],{clip:[0,0,8,2]}),['1,0','1,1','2,0','2,1']);
 assert.deepEqual(traced([.5,.5],[3.5,3.5]),['0,0','1,1','2,2','3,3']);
 assert.deepEqual(traced([.5,3.5],[3.5,.5]),['0,3','1,2','2,1','3,0']);
 assert.deepEqual(traced([2.1,0],[2.1,2],{clip:[0,0,8,2]}),['2,0','2,1']);
});
// Independent segment/convex-cell intersection by half planes, including a
// shared full edge and excluding a zero-length intersection at a corner.
function intersects(a,b,planes){let l=0,r=1;for(const [nx,ny,c]of planes){const p=nx*a[0]+ny*a[1]-c,d=nx*(b[0]-a[0])+ny*(b[1]-a[1]);if(Math.abs(d)<1e-10){if(p>1e-9)return false;}else if(d>0)r=Math.min(r,-p/d);else l=Math.max(l,-p/d);}return r-l>1e-8;}
test('DDA matches independent polygon clipping for square and both diamond lattices',()=>{
 for(const diamond of [false,true])for(const parity of [0,1])for(let n=0;n<80;n++){
  const a=[.1+(n*17%73)/10,.1+(n*29%73)/10],b=[.1+(n*31+9)%73/10,.1+(n*11+7)%73/10];if(a[0]===b[0]&&a[1]===b[1])continue;
  const actual=traced(a,b,{diamond,parity}),expected=[];
  for(let y=-1;y<=8;y++)for(let x=-1;x<=8;x++){
   if(diamond&&((x-y-parity)%2+2)%2)continue;
   const cx=x+.5,cy=y+.5,planes=diamond?[[1,1,cx+cy+1],[1,-1,cx-cy+1],[-1,1,-cx+cy+1],[-1,-1,-cx-cy+1]]:[[1,0,x+1],[-1,0,-x],[0,1,y+1],[0,-1,-y]];
   if(intersects(a,b,planes))expected.push(x+','+y);
  }assert.deepEqual(actual,expected.sort(),JSON.stringify({diamond,parity,a,b}));
 }
});
test('cropping, reverse traversal and split-panel offset preserve the same cells',()=>{
 const options={clip:[10,0,18,8],offset:10,diamond:true,anchor:2,parity:1};
 assert.deepEqual(traced([8,-4],[20,12],options),traced([20,12],[8,-4],options));
 assert.deepEqual(traced([0,0],[1,1],options),[]);
});
