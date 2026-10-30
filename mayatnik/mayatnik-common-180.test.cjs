const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),J=require('./mayatnik-joined-romb.js');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
function fn(name){const a=html.indexOf('function '+name+'(');let b=html.indexOf('{',a)+1,n=1;for(;n;b++){if(html[b]==='{')n++;else if(html[b]==='}')n--;}return html.slice(a,b);}
test('new 180 rotates even source below the unchanged odd half; legacy mappings remain exact',()=>{
 for(const width of [4,5,8])for(const height of [3,4])for(const rotateParity of [0,1])for(const rotate of [false,true]){
  const origin=2,anchor=3,fieldWidth=width+4,j=J.create({width,height,origin,anchor,fieldWidth,rotate,rotateParity}),bits=Int8Array.from({length:fieldWidth*height},(_,q)=>q%3-1),before=bits.slice(),snap=j.snapshot({val:bits}),copy=J.create(snap.mapping),seen=new Set();
  for(let r=0;r<height;r++)for(let c=origin;c<origin+width;c++){
   const p=(c-anchor-r)&1,lower=p===rotateParity,x=lower&&rotate?2*Math.ceil((width-1)/2)-(c-origin):c-origin,y=lower?2*height-1-r:r,q=j.forward(c,r);
   assert.deepEqual([q.x,q.y,q.p,q.q],[x,y,p,r*fieldWidth+c]);assert.deepEqual(j.inverse(x,y),q);assert.deepEqual(copy.fromSource(q.q),q);assert.deepEqual(j.point(c-origin+.5,r+.5,p),{x:x+.5,y:y+.5});assert.equal(snap.val[q.displayQ],bits[q.q]);seen.add(q.displayQ);
  }assert.equal(seen.size,width*height);assert.deepEqual(bits,before);
 }
});
function host(view,rk=2){
 const width=6,height=4,origin=2,anchor=4,fieldWidth=10,j=J.create({width,height,origin,anchor,fieldWidth,rotate:true,rotateParity:0}),val=Int8Array.from({length:40},(_,q)=>q%5===0?-1:q%2),pixels=new Uint32Array(j.width*j.height*rk*rk),c=vm.createContext({st:{view,joined180:true,digitSize:80,digitOneColour:'#ffffff',digitZeroColour:'#777777'},f:{W:fieldWidth,H:height,val},geo:{anchor},VX:origin,VW:width,VH:height,RK:rk,RG:0,img:{width:j.width*rk,height:j.height*rk,data:new Uint8ClampedArray(pixels.buffer)},joinedOn:()=>true,joinedGeometry:()=>j,halfOf:()=>[3,0],rombP:()=>3,parityVisible:()=>true,outShow:()=>false,outZone:()=>false,tintAt:()=>2,MayatnikJoinedRomb:J,paintBits:null,templateMatchLayer:null,fillMask:null,stolbPaint:null,colReplayPaint:null,faceCurrent:()=>false,gpuDisplay:()=>false,rgba:()=>0,Uint32Array,Int8Array,Float64Array,ochkiCurrent:()=>null,digitFamily:()=> 'monospace',dispW:()=>j.width,dispH:()=>j.height});
 for(const name of ['displayCell','fieldCellAt','rasterBit','drawRomb','paintCellDigits'])vm.runInContext(fn(name),c);
 return {c,j,val,pixels};
}
test('all appearances retain their palette and exact source identity in the new CPU raster',()=>{
 const palette=Uint32Array.of(0xff000000,0xff000011,0xff000022,0xff000033,0xff000044,0xff000055);
 for(const view of ['bits','col','digits','digitsOnly','bitContours','romb0','romb1','romb2'])for(const rk of [1,2,8]){
  const {c,j,val,pixels}=host(view,rk);c.drawRomb(pixels,palette,0xff000000,null);
  for(let y=0;y<c.img.height;y++)for(let x=0;x<c.img.width;x++){
   const hit=j.hit((x+.5)/rk,(y+.5)/rk),v=hit?val[hit.q]:-1,expected=v<0?J.backgrounds[y/rk>=c.VH?1:0]:palette[v*3+(view==='col'?2:0)];assert.equal(pixels[y*c.img.width+x],expected);assert.equal(c.rasterBit(x,y),v);
  }
 }
});
test('digits only draws text without recolouring cells, while digits uses the selected rendered palette',()=>{
 for(const only of [false,true]){const {c,j,pixels}=host(only?'digitsOnly':'digits');pixels.fill(0xff123456);const calls=[];const ctx={beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){calls.push(['fill',this.fillStyle]);},stroke(){},save(){},restore(){},fillText(value){calls.push(['text',value,this.fillStyle]);}};c.paintCellDigits(ctx,0,0,8,0,j.width,0,j.height,3,only);assert.ok(calls.some(q=>q[0]==='text'));assert.equal(calls.some(q=>q[0]==='fill'),!only);if(!only)assert.ok(calls.filter(q=>q[0]==='fill').every(q=>q[1]==='rgb(86,52,18)'));}
});
test('background boundary follows the exact joined seam across zoom and vertical pan and clears on OFF',()=>{
 const style={},host={top:30},field={top:42},c=vm.createContext({f:{},st:{joined180:true},VH:16,scale:()=>2,cv:{getBoundingClientRect:()=>field},wrap:{style,scrollTop:0,clientHeight:600,getBoundingClientRect:()=>host},MayatnikJoinedRomb:J});vm.runInContext(fn('joinedBackground'),c);c.joinedBackground();assert.match(style.backgroundImage,/44px/);assert.equal(style.backgroundSize,'100% 600px');field.top=-58;c.wrap.scrollTop=100;c.scale=()=>4;c.joinedBackground();assert.match(style.backgroundImage,/-24px/);assert.equal(style.backgroundPosition,'0 100px');c.st.joined180=false;c.joinedBackground();assert.equal(style.backgroundImage,'');
});
test('the new toggle never rewrites any appearance or source; legacy paint keys stay unchanged',()=>{
 const a=html.indexOf("  $('bJoined180').onclick="),b=html.indexOf('\n',a),button={},state={};const c=vm.createContext({st:state,f:{val:Int8Array.of(1,0)},$:()=>button});
 for(const name of ['stopFrameTransports','foldCloseAll','joined180Sync','clearFillPreview','resetOchkiFindings','save','canvasSize','layout','draw','ovlDraw','queueDigits','savePaint'])c[name]=()=>{};vm.runInContext(html.slice(a,b),c);
 for(const view of ['bits','col','digits','digitsOnly','bitContours','romb0','romb1','romb2']){state.view=view;state.joined180=false;button.onclick();assert.equal(state.joined180,true);assert.equal(state.view,view);button.onclick();assert.equal(state.joined180,false);assert.equal(state.view,view);assert.deepEqual([...c.f.val],[1,0]);}
});

test('GPU render writes the new/legacy mapper, display anchor and two background colours without rewriting data',()=>{
 const source=fs.readFileSync(__dirname+'/mayatnik-gpu.js','utf8'),a=source.indexOf('      function render(context, o)'),b=source.indexOf('      return { W, H, WW',a),render=source.slice(a,b);let uniform;
 const pass={setPipeline(){},setBindGroup(){},draw(){},end(){}},encoder={beginRenderPass:()=>pass,finish:()=>({})};
 const device={queue:{writeBuffer(buffer,offset,data){if(data instanceof ArrayBuffer)uniform=data.slice(0);},submit(){}},createCommandEncoder:()=>encoder};
 const c=vm.createContext({reset(){},dead:false,pic:{},win:{VX:2,VW:6,VH:4,contours:true},device,uBuf:{},renderBind:{},pipeRender:{},ArrayBuffer,Float32Array,Int32Array,axesCols:null,axesRows:null});vm.runInContext(render,c);
 for(const rotateParity of [0,1])for(const rotate of [false,true]){const j=J.create({width:6,height:4,origin:2,anchor:4,fieldWidth:10,rotate,rotateParity}),backgrounds=rotateParity===0?J.backgrounds:null;c.render({getCurrentTexture:()=>({createView:()=>({})})},{x0:0,y0:0,step:.5,joined:{anchor:j.anchor,reflection:j.reflection,rotate,rotateParity,backgrounds}});const f=new Float32Array(uniform),i=new Uint32Array(uniform);assert.equal(i[13],rotate?2:1);assert.equal(f[14],j.anchor);assert.equal(f[15],j.reflection);assert.equal(i[18],backgrounds?.[0]||0);assert.equal(i[19],backgrounds?.[1]||0);}
});

test('diamond contour modes stay within their cell clips and remain nonempty at zoom-out on either lattice phase',()=>{
 for(const rotateParity of [0,1])for(const scale of [.1,.5,8])for(const mode of ['single','same','double','directional']){const geometry=J.create({width:16,height:8,rotate:true,rotateParity}),paths=[];let clips=0;const ctx={save(){},restore(){},beginPath(){},rect(){},clip(){clips++;},closePath(){},moveTo(x,y){this.at=[x,y];},lineTo(x,y){this.end=[x,y];},stroke(){paths.push([this.at,this.end]);}};const count=J.paintContours(ctx,{geometry,read:(x,y)=>geometry.inverse(x,y)?(x+y)%3===0?1:0:-1,x:0,y:0,scale,screenWidth:160,screenHeight:160,mode});assert.ok(count>0);assert.ok(paths.every(([a,b])=>Math.abs(Math.abs(a[0]-b[0])-Math.abs(a[1]-b[1]))<1e-9));if(mode!=='single')assert.ok(clips>1);}
});
