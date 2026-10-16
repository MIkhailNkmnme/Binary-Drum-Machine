const test=require('node:test'),assert=require('node:assert/strict');
const {geometry,affine}=require('./mayatnik-logo.js');
test('six faces of the triangular bipyramid turn through depth and return after a full rotation',()=>{
 const a=geometry(0,26),b=geometry(Math.PI/.0011,26),c=geometry(2*Math.PI/.0011,26);
 assert.equal(a.faces.length,6);assert.equal(a.vertices.length,5);assert.ok(a.vertices.every(p=>p.every(Number.isFinite)));
 assert.notDeepEqual(a.vertices,b.vertices);for(let i=0;i<5;i++)for(let j=0;j<3;j++)assert.ok(Math.abs(a.vertices[i][j]-c.vertices[i][j])<1e-10);
 for(let i=1;i<a.faces.length;i++)assert.ok(a.faces[i-1].depth>=a.faces[i].depth);
});
test('texture corners map exactly to each projected triangle',()=>{
 for(const t of [0,1200,2700])for(const f of geometry(t,26).faces){const m=affine(f.uv,f.points);f.uv.forEach(([x,y],i)=>{assert.ok(Math.abs(m[0]*x+m[2]*y+m[4]-f.points[i][0])<1e-9);assert.ok(Math.abs(m[1]*x+m[3]*y+m[5]-f.points[i][1])<1e-9);});}
});
