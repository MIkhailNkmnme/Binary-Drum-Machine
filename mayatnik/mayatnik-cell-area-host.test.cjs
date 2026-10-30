const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Area=require('./mayatnik-cell-area.js'),Joined=require('./mayatnik-joined-romb.js');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
function fixture({scale,joined,rotate,mode,uniform=false,rotateParity=1,diamond=false}){
  const W=7,H=5,G=joined?Joined.create({width:W,height:H,rotate,rotateParity}):null,iw=W*scale,ih=(G?G.height:H)*scale;
  const pixelCell=(x,y)=>{if(x<0||y<0||x>=iw||y>=ih)return null;if(G)return G.hit((x+.5)/scale,(y+.5)/scale);if(diamond){const dx=(x+.5)/scale-.5,dy=(y+.5)/scale-.5,i=Math.round((dx+dy)/2),j=Math.round((dx-dy)/2),c=i+j,r=i-j;return c>=0&&c<W&&r>=0&&r<H?{c,r,p:0,q:r*W+c}:null;}const c=Math.floor(x/scale),r=Math.floor(y/scale);return {c,r,p:-1,q:r*W+c};};
  const bit=c=>(c.c+c.r)%2,colour=c=>(!uniform&&(c.c*3+c.r)%5===0?22:11),data=new Uint32Array(iw*ih);
  for(let y=0;y<ih;y++)for(let x=0;x<iw;x++){const c=pixelCell(x,y);data[y*iw+x]=c?colour(c):0;}
  const c={MayatnikCellArea:Area,MayatnikTemplateLimit:require('./mayatnik-template-limit.js'),st:{fillArea:mode,templateMaxArea:1000},img:{width:iw,height:ih,data:new Uint8ClampedArray(data.buffer)},pxBase:null,pxAnimPre:null,pxHide:new Set(),pxFam:()=>'',rgba:()=>0,EMPTY:[],RK:scale,VX:0,VW:W,VH:H,autoVertical:0,pxView:()=>c.img,joinedOn:()=>joined,joinedGeometry:()=>G,
    displayPoint:(col,row)=>{const p=G?G.forward(col,row):{x:col,y:row};return {x:p.x+.5,y:p.y+.5};},fieldCellAt:pixelCell,fillBit:(x,y)=>{const p=pixelCell(x,y);return p?bit(p):-1;},rasterBit:(x,y)=>{const p=pixelCell(x,y);return p?bit(p):-1;},cellPixels:(cell,visit)=>{for(let y=0;y<ih;y++)for(let x=0;x<iw;x++){const at=pixelCell(x,y);if(at&&at.c===cell.c&&at.r===cell.r)visit(y*iw+x);}}};
  vm.createContext(c);for(const [start,end]of [['  function templatePickSelection(','  function columnSeed('],['  function paintSelection(','  // v0.202:']]){const a=html.indexOf(start);vm.runInContext(html.slice(a,html.indexOf(end,a)),c);}
  const cells=ids=>[...new Set(Array.from(ids,q=>pixelCell(q%iw,Math.floor(q/iw)).q))].sort((a,b)=>a-b);
  return {c,G,data,pixelCell,cells,point:(col,row)=>{const p=c.displayPoint(col,row);return [Math.floor(p.x*scale),Math.floor(p.y*scale)];}};
}
test('production template and paint selectors use identical cells at every raster scale and joined seam',()=>{
  for(const [joined,rotate,diamond]of [[false,false,false],[false,false,true],[true,false,false],[true,true,false]])for(const mode of ['sides','corners','diagonal','chess0','bit']){
    let reference;
    for(const scale of [1,2,3,8]){const f=fixture({scale,joined,rotate,mode,diamond}),[x,y]=f.point(diamond?2:3,4),pick=f.cells(f.c.templatePickSelection(x,y).indices),paint=f.cells(f.c.paintSelection(x,y,false,true).indices);
      assert.deepEqual(pick,paint,`${joined}/${rotate}/${diamond}/${mode}/${scale}`);if(reference)assert.deepEqual(pick,reference);else reference=pick;
    }
  }
});
test('cell-centre colour makes picking an edge pixel equivalent to picking the cell centre',()=>{
  const f=fixture({scale:8,joined:false,rotate:false,mode:'sides'}),[x,y]=f.point(3,2),centre=f.cells(f.c.templatePickSelection(x,y).indices),edge=[3*8,2*8];f.data[edge[1]*f.c.img.width+edge[0]]=99;
  assert.deepEqual(f.cells(f.c.templatePickSelection(...edge).indices),centre);assert.deepEqual(f.cells(f.c.paintSelection(...edge,false,true).indices),centre);
});

test('sides crosses a true joined seam for either rotated source parity',()=>{
 for(const rotate of [false,true])for(const rotateParity of [0,1])for(const scale of [1,2,3,8]){
  const f=fixture({scale,joined:true,rotate,rotateParity,mode:'sides',uniform:true}),[x,y]=f.point(3,4),pick=f.cells(f.c.templatePickSelection(x,y).indices);
  assert.ok(pick.some(q=>f.G.fromSource(q).p!==f.G.forward(3,4).p),`${rotate}/${rotateParity}/${scale}`);
 }
});
