const test=require('node:test'),assert=require('node:assert/strict'),G=require('./mayatnik-manual-lines.js');
const grid={width:9,height:7,anchor:4};
const indices=axis=>{const out=[];G.paintCells(axis,grid,(c,r)=>out.push(r*grid.width+c));return out.sort((a,b)=>a-b);};
test('all four axes agree with an independent cell-distance oracle at centres, half steps and outside each field edge',()=>{
 for(const kind of ['h','v','d','e'])for(let p=-15;p<=15;p+=.5){
  const expected=[];
  for(let r=0;r<grid.height;r++)for(let c=0;c<grid.width;c++){
   const distance=kind==='h'?Math.abs(r+.5-p):kind==='v'?Math.abs(c-grid.anchor-p):Math.abs(c-grid.anchor-p-(kind==='d'?r:-r));
   if(distance<=.5)expected.push(r*grid.width+c);
  }
  assert.deepEqual(indices({kind,p}),expected,kind+' '+p);
 }
});
test('first and last boundary rows are painted, and two adjoining rows are selected at an internal boundary',()=>{
 assert.deepEqual(indices({kind:'h',p:0}),[0,1,2,3,4,5,6,7,8]);
 assert.deepEqual(indices({kind:'h',p:7}),[54,55,56,57,58,59,60,61,62]);
 assert.equal(indices({kind:'h',p:3}).length,18);assert.equal(indices({kind:'h',p:3.5}).length,9);
});
test('paint flags are independent and malformed persisted flags default to off',()=>{
 assert.equal(G.togglePaint(0,1),1);assert.equal(G.togglePaint(1,0),3);assert.equal(G.togglePaint(3,1),2);assert.equal(G.togglePaint(2,0),0);
 for(const v of [undefined,null,-1,4,'3',NaN])assert.equal(G.paintMask(v),0);
});
function run(axes,bits,blocked){const px=Uint32Array.from(bits,v=>v===0?11:v===1?22:33),source=px.slice();const count=G.paint(px,{...grid,axes,colour:123,bitAt:(c,r,q)=>bits[q],blocked});return {px,source,count};}
test('painting is confined to the axis and requested visible bits, including hidden and empty cells',()=>{
 const bits=Int8Array.from({length:63},(_,i)=>i%5===0?-1:i%2),axis={kind:'h',p:3.5,paint:1},a=run([axis],bits,q=>q===31);
 const expected=indices(axis).filter(q=>bits[q]===1&&q!==31);assert.equal(a.count,expected.length);
 assert.deepEqual([...a.px].flatMap((v,i)=>v===123?[i]:[]),expected);
 assert.equal(run([{...axis,visible:false}],bits).count,0);assert.equal(run([{...axis,paint:0}],bits).count,0);
});
test('moving, hiding and changing frames recomputes paint without retaining old axis pixels or mutating field bits',()=>{
 const bits=Int8Array.from({length:63},(_,i)=>i%2),saved=bits.slice(),axis={kind:'v',p:0,paint:3};
 const first=run([axis],bits);axis.p=2;const second=run([axis],bits);
 for(const q of indices({...axis,p:0}))assert.equal(second.px[q],second.source[q]);
 axis.visible=false;const hidden=run([axis],bits);assert.deepEqual(hidden.px,hidden.source);
 axis.visible=true;axis.paint=1;bits.fill(0);assert.equal(run([axis],bits).count,0);bits.set(saved);assert.deepEqual(bits,saved);assert.notDeepEqual(first.px,second.px);
});
test('overlapping axes combine flags and classify all original pixels before painting',()=>{
 const px=new Uint32Array(63).fill(22),axes=[{kind:'h',p:3.5,paint:1},{kind:'v',p:0,paint:2},{kind:'d',p:-3,paint:1}];
 const expected=new Set([...indices(axes[0]),...indices(axes[2])]);
 assert.equal(G.paint(px,{...grid,axes,colour:11,bitAt:(c,r,q)=>px[q]===22?1:0}),expected.size);
 assert.deepEqual([...px].flatMap((v,i)=>v===11?[i]:[]),[...expected].sort((a,b)=>a-b));
});
test('bit provider can supply mirrored results without changing mirror settings or source bits',()=>{
 const bits=Int8Array.from({length:63},(_,i)=>(i%9)<4?0:1),axis={kind:'h',p:2.5,paint:1,mode:2},px=new Uint32Array(63);
 G.paint(px,{...grid,axes:[axis],colour:123,bitAt:(c,r)=>bits[r*9+8-c]});
 assert.deepEqual([...px].flatMap((v,i)=>v?[i]:[]),[18,19,20,21,22]);assert.equal(axis.mode,2);assert.equal(bits[18],0);
});
test('GPU pass encoding chunks 14 axes, excludes hidden/off axes and preserves all independent flags and half steps',()=>{
 const axes=Array.from({length:31},(_,i)=>({kind:['h','v','d','e'][i%4],p:(i-16)/2,paint:i%3+1}));axes.push({kind:'h',p:0,paint:0},{kind:'h',p:0,paint:3,visible:false});
 const passes=G.paintPasses(axes,0xff123456);assert.deepEqual(passes.map(p=>p[3]),[14,14,3]);
 const decoded=[];for(const p of passes){assert.equal(p.length,64);assert.equal(p[0],6);assert.equal(p[1]>>>0,0xff123456);for(let i=0;i<p[3];i++)decoded.push({kind:['','h','v','d','e'][p[8+4*i]],p:p[9+4*i]/2,paint:p[10+4*i]});}
 assert.deepEqual(decoded,axes.slice(0,31));
});
test('doubled-coordinate GPU protocol matches CPU selection across frames, all axes and overlapping passes',()=>{
 const axes=Array.from({length:37},(_,i)=>({kind:['h','v','d','e'][i%4],p:(i-18)/2,paint:i%3+1})),colour=0xff102030,passes=G.paintPasses(axes,colour);
 for(let frame=0;frame<5;frame++){
  const bits=Int8Array.from({length:63},(_,q)=>(q*7+frame*11)%3-1),cpu=new Uint32Array(63),gpu=new Uint32Array(63);
  G.paint(cpu,{...grid,axes,colour,bitAt:(c,r,q)=>bits[q]});
  for(const Q of passes)for(let q=0;q<63;q++){const bit=bits[q];if(bit<0)continue;const c=q%9,r=Math.floor(q/9);
   for(let i=0;i<Q[3];i++){const k=Q[8+4*i],p=Q[9+4*i],flags=Q[10+4*i];
    const distance=k===1?2*r+1-p:k===2?2*(c-grid.anchor)-p:k===3?2*(c-grid.anchor-r)-p:2*(c-grid.anchor+r)-p;
    if(Math.abs(distance)<=1&&(flags&(bit?1:2))){gpu[q]=Q[1];break;}
   }
  }
  assert.deepEqual(gpu,cpu,'frame '+frame);
 }
});
test('projected paint colours entire joined rhombi at both scales, including pixels beyond the axis band',()=>{
 const Joined=require('./mayatnik-joined-romb.js');
 for(const rotate of [false,true])for(const scale of [4,8]){
  const geometry=Joined.create({width:9,height:5,anchor:4,rotate}),width=geometry.width*scale,height=geometry.height*scale,bits=new Int8Array(width*height).fill(-1),pixels=new Uint32Array(width*height).fill(17);
  const cellAt=(x,y)=>{const c=geometry.hit((x+.5)/scale,(y+.5)/scale);return c?{x:c.x+.5,y:c.y+.5}:null;};
  for(let q=0;q<bits.length;q++){const c=cellAt(q%width,Math.floor(q/width));if(c)bits[q]=Math.round(c.x+c.y)%2;}
  const axes=[{kind:'h',p:2.5,paint:3},{kind:'h',p:7.5,paint:3}];
  G.paintRaster(pixels,{width,height,axes,anchor:4,cellAt,bits,colour:123});let beyond=0;
  for(let q=0;q<pixels.length;q++){const c=cellAt(q%width,Math.floor(q/width)),selected=c&&(c.y===2.5||c.y===7.5);assert.equal(pixels[q],selected?123:17);
   const y=(Math.floor(q/width)+.5)/scale;if(selected&&Math.min(Math.abs(y-2.5),Math.abs(y-7.5))>.5)beyond++;
  }
  assert.ok(beyond>0,'whole diamond extends outside a half-cell axis stripe');
 }
});
test('projected paint respects reflected cell centres, semantic zero/one, hidden axes and clipped empty pixels',()=>{
 const Joined=require('./mayatnik-joined-romb.js'),geometry=Joined.create({width:9,height:5,anchor:4}),scale=4,width=36,height=40,bits=new Int8Array(width*height).fill(-1),pixels=new Uint32Array(bits.length).fill(17);
 const cellAt=(x,y)=>{const fx=(x+.5)/scale,fy=(y+.5)/scale,reflected=fy>=4,c=geometry.hit(fx,reflected?8-fy:fy);return c?{x:c.x+.5,y:reflected?8-(c.y+.5):c.y+.5}:null;};
 for(let q=0;q<bits.length;q++){const c=cellAt(q%width,Math.floor(q/width));if(c)bits[q]=Math.floor(c.x/2)%2;}
 bits[20*width+18]=-1;
 const axes=[{kind:'h',p:5.5,paint:1},{kind:'h',p:2.5,paint:3,visible:false}];
 G.paintRaster(pixels,{width,height,axes,anchor:4,cellAt,bits,colour:123});let changed=0;
 for(let q=0;q<pixels.length;q++){const c=cellAt(q%width,Math.floor(q/width)),selected=c&&c.y===5.5&&bits[q]===1;assert.equal(pixels[q],selected?123:17);if(selected)changed++;}
 assert.ok(changed>0);assert.equal(pixels[20*width+18],17);
});
