const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/mayatnik-button-standard.js','utf8'),ctx={};
vm.runInNewContext(source.slice(source.indexOf('  function groupGapGeometry('),source.indexOf('  function groupGaps(')),ctx);
const silhouette=(x=0,y=0)=>({points:[[12,0],[108,0],[122,12],[116,25],[122,38],[108,50],[12,50],[-2,38],[4,25],[-2,12]].map(([px,py])=>[px+x,py+y]),top:0,bottom:1000});
test('grid neighbours fill only their facing teeth and split the gap at its middle',()=>{
 const a=silhouette(),b=silhouette(126),g=ctx.groupGapGeometry(a,b);assert.ok(g);
 assert.equal(g.left,a);assert.equal(g.right,b);
 assert.ok(g.leftPoints.some(([x,y])=>x===116&&y===25));assert.ok(g.rightPoints.some(([x,y])=>x===130&&y===25));
 assert.ok(g.leftPoints.every(([x])=>x>=108&&x<=123));assert.ok(g.rightPoints.every(([x])=>x>=123&&x<=138));
 assert.equal(a.points.length,10);assert.equal(b.points.length,10);
});
test('order of groups does not affect the facing sides',()=>{
 const a=silhouette(),b=silhouette(126),g=ctx.groupGapGeometry(b,a);assert.equal(g.left,a);assert.equal(g.right,b);
});
test('separated groups, overlapping groups and separate vertical ranges have no gap paint',()=>{
 assert.equal(ctx.groupGapGeometry(silhouette(),silhouette(130)),null);
 assert.equal(ctx.groupGapGeometry(silhouette(),silhouette(118)),null);
 assert.equal(ctx.groupGapGeometry(silhouette(),silhouette(126,60)),null);
});
test('staggered groups paint only their shared vertical range',()=>{
 const g=ctx.groupGapGeometry(silhouette(),silhouette(126,26));assert.ok(g);
 for(const [,y]of [...g.leftPoints,...g.rightPoints])assert.ok(y>=26&&y<=50);
});
test('scroll clipping limits the gap to the visible group parts',()=>{
 const a=silhouette(),b=silhouette(126);a.top=15;b.bottom=32;const g=ctx.groupGapGeometry(a,b);assert.ok(g);
 for(const [,y]of [...g.leftPoints,...g.rightPoints])assert.ok(y>=15&&y<=32);
 a.top=33;assert.equal(ctx.groupGapGeometry(a,b),null);
});
test('normal fractional positions tolerate at most half a CSS pixel beyond the grid gap',()=>{
 assert.ok(ctx.groupGapGeometry(silhouette(.3),silhouette(126.7)));
 assert.equal(ctx.groupGapGeometry(silhouette(.3),silhouette(126.9)),null);
});
