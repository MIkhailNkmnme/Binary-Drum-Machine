const test=require('node:test'),assert=require('node:assert/strict');
const Area=require('./mayatnik-cell-area.js'),Limit=require('./mayatnik-template-limit.js'),Joined=require('./mayatnik-joined-romb.js');
const modes=['sides','corners','diagonal','chess0','bit'];
function oracle(cells,seed,mode){
  const value=c=>Area.matches(mode,seed.bit,seed.colour,c),polygon=c=>c.p<0?[[c.x-.5,c.y-.5],[c.x+.5,c.y-.5],[c.x+.5,c.y+.5],[c.x-.5,c.y+.5]]:[[c.x,c.y-1],[c.x+1,c.y],[c.x,c.y+1],[c.x-1,c.y]];
  const vertices=new Map(cells.map(c=>[c,polygon(c).map(v=>v.join(':'))]));
  const contact=(a,b)=>vertices.get(a).filter(v=>vertices.get(b).includes(v)).length;
  const chain=c=>cells.some(other=>other!==c&&value(other)&&contact(c,other)===1);
  const found=new Set(),queue=[seed];
  for(let i=0;i<queue.length;i++){const a=queue[i];if(found.has(a)||!value(a))continue;found.add(a);if(mode==='bit')continue;
    for(const b of cells){if(found.has(b)||!value(b))continue;const n=contact(a,b);if(n===0)continue;
      if(mode==='corners'||mode==='sides'&&n===2||['diagonal','chess0'].includes(mode)&&n===1||mode==='chess0'&&seed.bit===0&&n===2&&chain(a)&&chain(b))queue.push(b);
    }
  }return [...found].map(c=>c.q).sort((a,b)=>a-b);
}
function run(cells,seed,mode){
  const byPoint=new Map(cells.map(c=>[c.x+':'+c.y,c]));
  return Area.select({seed,mode,bit:seed.bit,match:c=>Area.matches(mode,seed.bit,seed.colour,c),move:(c,dx,dy)=>byPoint.get((c.x+dx)+':'+(c.y+dy)),point:c=>[c.x,c.y]}).map(c=>c.q).sort((a,b)=>a-b);
}
test('all modes agree with polygon-vertex adjacency oracle for square, diamonds and both joined orientations',()=>{
  for(const kind of ['square','diamond','joined','rotated'])for(let variant=0;variant<6;variant++){
    const geometry=kind==='joined'||kind==='rotated'?Joined.create({width:7,height:5,origin:3,anchor:6,fieldWidth:13,rotate:kind==='rotated'}):null,cells=[];
    for(let r=0;r<5;r++)for(let c=0;c<7;c++){
      if(kind==='diamond'&&(c+r)%2)continue;if((c*7+r*3+variant)%13===0)continue;
      const cell=geometry?geometry.forward(c+3,r):{x:c,y:r,c,r,p:kind==='square'?-1:0,q:r*7+c};
      cells.push({...cell,bit:(c+3*r+variant)%2,colour:(c*3+r+variant)%5===0?22:11});
    }
    for(const seed of cells)for(const mode of modes)assert.deepEqual(run(cells,seed,mode),oracle(cells,seed,mode),`${kind} ${variant} ${seed.q} ${mode}`);
  }
});
test('colour equality does not erase established bit semantics',()=>{
  for(const mode of ['sides','corners'])assert.equal(Area.matches(mode,0,11,{bit:1,colour:11}),true);
  for(const mode of ['bit','diagonal','chess0'])assert.equal(Area.matches(mode,0,11,{bit:1,colour:11}),false);
  assert.equal(Area.matches('bit',1,11,{bit:1,colour:22}),true);
  for(const mode of modes)assert.equal(Area.matches(mode,0,11,{bit:-1,colour:11}),false);
});
test('diamond edge and vertex contacts stay distinct without a raster',()=>{
  const cells=[{x:2,y:2,c:2,r:2,p:0,q:0,bit:0,colour:11},{x:3,y:3,c:3,r:3,p:0,q:1,bit:0,colour:11},{x:0,y:2,c:0,r:2,p:0,q:2,bit:0,colour:11}];
  assert.deepEqual(run(cells,cells[0],'sides'),[0,1]);assert.deepEqual(run(cells,cells[0],'diagonal'),[0,2]);assert.deepEqual(run(cells,cells[0],'corners'),[0,1,2]);
});
test('template bound uses logical geometry and aborts without raster-size allocations',()=>{
  let reads=0;assert.throws(()=>Area.select({seed:{c:0,r:0,p:-1},mode:'sides',bit:0,limit:4,flood:Limit.flood,match:c=>{reads++;return c.c>=0&&c.r===0;},move:(c,dc,dr)=>({...c,c:c.c+dc,r:c.r+dr})}),{name:'TemplateAreaLimitError'});assert.ok(reads<20);
});
