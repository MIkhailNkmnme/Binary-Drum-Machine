const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const G=require('./zz-rmb-grid.js'),s=fs.readFileSync(path.join(__dirname,'zz-ui.js'),'utf8');
const ctx=vm.createContext({Z:{rowsAlign:'center'}});ctx.gridsState=()=>({align:ctx.Z.rowsAlign});vm.runInContext(s.slice(s.indexOf('function rmbLayout('),s.indexOf('/* v0.795,',s.indexOf('function rmbLayout('))),ctx);
function covered(a,b,segments){
 const cross=(p,q,x)=>Math.abs((q[0]-p[0])*(x[1]-p[1])-(q[1]-p[1])*(x[0]-p[0]));
 return segments.some(([x0,y0,x1,y1])=>{const p=[x0,y0],q=[x1,y1];return cross(p,q,a)<1e-7&&cross(p,q,b)<1e-7&&[a,b].every(v=>v[0]>=Math.min(x0,x1)-1e-7&&v[0]<=Math.max(x0,x1)+1e-7&&v[1]>=Math.min(y0,y1)-1e-7&&v[1]<=Math.max(y0,y1)+1e-7);});
}
for(const alignment of ['l','r','zz','c'])test('grid exactly follows every triangle edge: '+alignment,()=>{
 let checked=0;
 for(const widths of [[6,6,6,6,6,6,6],[3,4,6,5,4,7,6]])for(const rowsAlign of ['left','center','right'])for(const cell of ['rmb','tri'])for(const view of [{tw:20,ox:300,oy:60,width:900,height:600},{tw:9,ox:35,oy:-20,width:240,height:160}]){
  const rows=widths.map(n=>'0'.repeat(n));ctx.Z.rowsAlign=rowsAlign;const {hs,u0}=ctx.rmbLayout(rows,rows.length,alignment,cell);
  const segments=G.segments({hs,u0,alignment,...view}),h=view.tw*Math.sqrt(3)/2;
  for(let r=0;r<rows.length;r++)for(let k=0;k<(cell==='rmb'?2*rows[r].length:rows[r].length);k++){
   const x=view.ox+(hs[r]+k)*view.tw/2,y=view.oy+r*h,up=((k+u0)&1)===0;
   const points=up?[[x,y+h],[x+view.tw,y+h],[x+view.tw/2,y]]:[[x,y],[x+view.tw,y],[x+view.tw/2,y+h]];
   if(points.some(p=>p[0]<0||p[0]>view.width||p[1]<0||p[1]>view.height))continue;
   for(let j=0;j<3;j++){assert.ok(covered(points[j],points[(j+1)%3],segments),JSON.stringify({alignment,rowsAlign,cell,r,k,edge:j,view}));checked++;}
  }
 }
 assert.ok(checked>1000);
});
test('orientation changes lattice phase; ordinary slanted rows remain one fast grid run',()=>{
 const hs=[-6,-7,-8];assert.equal(G.runs(hs,0,-20,50,'l').length,1);assert.equal(G.runs(hs,1,-20,50,'l').length,1);
 assert.notEqual(G.runs(hs,0,0,2,'l')[0].phase,G.runs(hs,1,0,2,'l')[0].phase);
 assert.equal(G.runs([-6,-6,-6],1,0,2,'c').length,3);
});
test('extreme zoom keeps grid work bounded and empty fields are safe',()=>{
 const geometry={hs:Array(1000).fill(-10),u0:1,alignment:'c',tw:2,ox:0,oy:0,width:2000,height:1600};
 const segments=G.segments(geometry);assert.ok(segments.length<55000,segments.length);assert.ok(segments.every(p=>p.every(Number.isFinite)));
 assert.deepEqual(G.segments({...geometry,hs:[]}),[]);
});
