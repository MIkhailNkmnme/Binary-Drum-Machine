const {test}=require('node:test'),assert=require('node:assert/strict');
const R=require('./mayatnik-rombo.js'),C=require('./mayatnik-center.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const composed=p=>C.compose(p.parts.map(t=>({id:t.id,width:p.width,height:t.height,left:t.left,right:t.right,contains:t.contains,sampleStep:.5,transform:t.matrix,read:()=>0})));

test('real outer triangles at all Pereskok widths preserve source addresses through every assembly and turn',()=>{
 for(const N of [1,3,6])for(const factor of [2,4,6,8])for(const row of [...new Set([1,N])])for(const {id:assembly} of R.variants)for(let angle=0;angle<360;angle+=45){
  const W=factor*N-1,p=R.plan(W,N,{row,assembly,angle},{sides:true});assert.equal(p.available,true);
  for(const t of p.parts){near(Math.abs(t.matrix[0]*t.matrix[3]-t.matrix[1]*t.matrix[2]),1);
   for(const r of t.rows)for(let x=r.left+.125;x<r.right;x+=.5){const src={x,y:r.y+.25},q=p.forward(R.point(t.matrix,src)),back=p.pick(q);assert.ok(back);const visible=p.parts.find(v=>v.id===back.part),again=p.forward(R.point(visible.matrix,back));near(again.x,q.x);near(again.y,q.y);assert.ok(visible.contains(back.x,back.y));if(back.part===t.id){near(back.x,src.x);near(back.y,src.y);}assert.ok(q.x>=-1e-8&&q.y>=-1e-8&&q.x<=p.outputWidth+1e-8&&q.y<=p.outputHeight+1e-8);}
  }
  assert.equal(p.pick({x:-100,y:-100}),null);
 }
});

test('C and the two boundary cones omit wide intermediate areas, and half seam has no gap or overlap',()=>{
 for(const N of [1,4,7])for(const factor of [2,4,6,8])for(let row=1;row<=N;row++){
  const W=factor*N-1,a=(W-1)/2,p=R.plan(W,N,{row,assembly:1},{sides:true}),[top,L,Rt]=p.parts;
  assert.equal(top.sourceKey,'C');assert.equal(L.sourceKey,'L');assert.equal(Rt.sourceKey,'R');
  for(let r=0;r<row;r++){assert.deepEqual(top.rows[r],{y:r,left:a-r,right:a+r+1});assert.deepEqual(L.rows[r],{y:r,left:.5,right:r+1});assert.deepEqual(Rt.rows[r],{y:r,left:W-r-1,right:W-.5});
   for(const x of [a+.25,a+.75]){const q=p.pick(p.forward({x,y:2*row-r-.5}));assert.equal(q.sourceKey,x<a+.5?'L':'R');}
  }
  const c=composed(p);near(c.count,2*row*row);near(c.center.x,a+.5);near(c.center.y,row);near(c.parts[1].count,row*row/2);near(c.parts[2].count,row*row/2);
 }
});

test('central 180 reverses both coordinates; diagonal quarter exchange translates pieces without rotating them',()=>{
 const p=R.plan(19,5,{row:4,assembly:16}),q=R.plan(19,5,{row:4,assembly:17});
 assert.deepEqual(p.parts[1].matrix,[-1,0,0,-1,19,8]);assert.equal(q.parts.length,4);
 for(const t of q.parts){assert.equal(t.targetQuarter,({1:3,2:4,3:1,4:2})[t.sourceQuarter]);const m=t.matrix,bottom=t.sourceQuarter>=3;assert.deepEqual(m.slice(0,4),bottom?[-1,0,0,-1]:[1,0,0,1]);}
 near(composed(q).count,composed(p).count);
});

test('reflections move the mask together with the pixels, and bounds include every outline',()=>{
 for(const v of R.variants)for(let angle=0;angle<360;angle+=45){const p=R.plan(31,8,{assembly:v.id,angle},{sides:true});for(const t of p.parts)for(const a of t.outline){const q=p.forward(R.point(t.matrix,a));assert.ok(q.x>=-1e-8&&q.y>=-1e-8&&q.x<=p.outputWidth+1e-8&&q.y<=p.outputHeight+1e-8);}}
 const p=R.plan(31,8,{assembly:3},{sides:true});assert.equal(p.parts[2].matrix[0],1);assert.ok(p.parts[2].contains(30.25,.25));assert.ok(!p.parts[2].contains(29.25,.25));
});

test('unavailable sources stay explicit; obsolete duplicated-half ids migrate to central 180',()=>{
 assert.deepEqual(R.variants.map(v=>v.id),[1,3,4,6,9,11,12,14,16,17]);
 assert.equal(R.plan(9,5,{assembly:1}).available,false);assert.equal(R.plan(9,5,{assembly:1}).parts.length,0);
 assert.equal(R.plan(9,5,{assembly:16},{available:false,reason:'projection'}).reason,'projection');
 for(const id of [null,0,2,5,7,8,10,13,15,18])assert.equal(R.plan(9,5,{assembly:id}).assembly,16);
 assert.equal(R.plan(9,5,{assembly:16}).available,true);
});

function host(extra={}){
  const geometry={width:9,height:5,sides:true},state={edgeRhombOn:true,romboRow:3,romboAngle:0,romboAssembly:1},listeners={},notifications=[],r={left:200,top:100,width:90,height:50},classes=new Set();
  const style={},source={width:9,height:5,style:{},getBoundingClientRect:()=>({...r})};
  const ctx={canvas:null,createImageData(width,height){return {width,height,data:new Uint8ClampedArray(width*height*4)};},putImageData(image){this.lastImage=image;},setTransform(){},fillRect(){},save(){},restore(){},transform(){},beginPath(){},rect(){},closePath(){},clip(){},drawImage(){},moveTo(){},lineTo(){},stroke(){},setLineDash(){}};
  const box={style,append(){},getBoundingClientRect(){const t=/translate\(([-.\d]+)px, ([-.\d]+)px\)/.exec(style.transform||'');return {left:+(t?.[1]||0),top:r.top+r.height+2+(parseFloat(style.marginTop)||0)+ +(t?.[2]||0)};}};
  const canvas={style:{},width:1,height:1,getContext:()=>ctx,getBoundingClientRect(){const b=box.getBoundingClientRect();return {...b,left:b.left+(parseFloat(canvas.style.left)||0),top:b.top+(parseFloat(canvas.style.top)||0),width:parseFloat(canvas.style.width),height:parseFloat(canvas.style.height)};},setPointerCapture(){}};ctx.canvas=canvas;
  const win={Event:class{constructor(type){this.type=type;}},dispatchEvent(event){notifications.push(event.type);},requestAnimationFrame:()=>1,cancelAnimationFrame(){},getComputedStyle:()=>({marginBottom:'2px'}),addEventListener(type,fn){listeners[type]=fn;}};
  const doc={defaultView:win,body:{classList:{toggle(key,on){on?classes.add(key):classes.delete(key);}}},createElement:()=>{const context={...ctx},out={width:0,height:0,style:{},setAttribute(){},getContext:()=>context,getBoundingClientRect(){const b=box.getBoundingClientRect();return {...b,left:b.left+(parseFloat(this.style.left)||0),top:b.top+(parseFloat(this.style.top)||0),width:parseFloat(this.style.width),height:parseFloat(this.style.height)};}};context.canvas=out;return out;}};
  const viewport={ownerDocument:doc,clientWidth:800,clientHeight:600,getBoundingClientRect:()=>({left:0,top:0,right:800,bottom:600,width:800,height:600})};
  const api=R.mount({host:viewport,source,box,canvas,state:()=>state,geometry:()=>geometry,changed(){api.render();},...extra});
  function event(type,x,y){const e={type,target:canvas,clientX:x,clientY:y,pointerId:1,button:0,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};listeners[type](e);return e;}
  return {api,state,source,box,canvas,r,classes,event,notifications,geometry,win,viewport};
}

test('Rombo publishes effective state changes after setters and direct restore/reset, without frame duplicates',()=>{
 const h=host();h.api.render();assert.deepEqual(h.notifications,['may-rombo-change']);
 h.api.render();h.api.render(true);assert.equal(h.notifications.length,1);
 h.api.setAssembly(14);assert.equal(h.notifications.length,2);
 h.api.setAssembly(14);assert.equal(h.notifications.length,2);
 h.api.setRow(4);h.api.cycleAngle();assert.equal(h.notifications.length,4);
 Object.assign(h.state,{romboAssembly:1,romboRow:3,romboAngle:0});h.api.render();assert.equal(h.notifications.length,5);
 h.state.edgeRhombOn=false;h.api.render();assert.equal(h.notifications.length,6);
 h.api.render();assert.equal(h.notifications.length,6);
});

test('projection follows fractional zoom and scroll without clamping or changing cell aspect',()=>{
  const h=host();
  for(const scale of [.125,1,2.75,20])for(const angle of [0,45,90,180,315]){
    Object.assign(h.r,{left:17.25-scale,top:-60.5+scale,width:9*scale,height:5*scale});h.state.romboAngle=angle;h.api.render();
    const p=h.api.plan(),r=h.canvas.getBoundingClientRect();near(parseFloat(h.box.style.width)/p.outputWidth,scale);near(parseFloat(h.box.style.height)/p.outputHeight,scale);
    assert.ok(Math.abs(r.left+parseFloat(h.box.style.width)/2-(h.r.left+h.r.width/2))<=.500001);assert.ok(Math.abs(r.top-h.r.top)<=.500001);
  }
  h.api.set(false);assert.equal(h.box.style.display,'none');assert.equal(h.classes.has('may-rombo-active'),false);
});

test('rotated copy input maps to native source cells; axis drag changes row without forwarding pointer events',()=>{
  const h=host();h.state.romboAngle=45;h.api.render();
  const p=h.api.plan(),q=p.forward(R.point(p.parts[1].matrix,{x:.75,y:.25})),r=h.canvas.getBoundingClientRect();
  const e=h.event('pointermove',r.left+q.x*10,r.top+q.y*10);near(e.clientX,h.r.left+7.5);near(e.clientY,h.r.top+2.5);
  const a=p.forward({x:4,y:3}),down=h.event('pointerdown',r.left+a.x*10,r.top+a.y*10);assert.equal(down.stopped,true);
  const move=h.event('pointermove',down.clientX-Math.sin(Math.PI/4)*10,down.clientY+Math.cos(Math.PI/4)*10);assert.equal(move.stopped,true);assert.equal(h.state.romboRow,4);
  assert.equal(h.event('pointerup',move.clientX,move.clientY).stopped,true);
  assert.equal(h.event('click',move.clientX,move.clientY).stopped,true);
});

test('rotated half-open seam boundaries resolve consistently and geometry plans are cached',()=>{
 for(let angle=0;angle<360;angle+=45){const p=R.plan(31,8,{row:8,assembly:1,angle},{sides:true}),seam=p.pick(p.forward({x:15.5,y:10.5}));assert.equal(seam.sourceKey,'L');near(seam.x,.5);}
 const h=host(),a=h.api.plan(),b=h.api.plan(16);assert.strictEqual(h.api.plan(),a);assert.strictEqual(h.api.plan(16),b);h.api.render();assert.strictEqual(h.api.plan(),a);h.api.setRow(2);assert.notStrictEqual(h.api.plan(),a);
 h.api.setAssembly(16);assert.equal(h.api.get().assembly,16);assert.equal(h.api.options().length,10);
});

test('unsupported projection leaves the source visible and restores selected variant when available again',()=>{
 const h=host();h.api.render();h.geometry.available=false;h.geometry.reason='projection';h.api.render();assert.equal(h.classes.has('may-rombo-active'),false);assert.equal(h.box.style.display,'none');assert.equal(h.source.style.visibility,undefined);assert.equal(h.api.get().available,false);assert.equal(h.api.get().assembly,1);
 h.geometry.available=true;h.api.render();assert.equal(h.box.style.display,'block');assert.equal(h.api.get().assembly,1);
 const outside=R.plan(9,5,{assembly:16,row:1},{anchor:12});assert.equal(outside.available,false);assert.equal(outside.parts.length,0);
});


test('wheel in Rombo gaps and occupied triangles reaches production field zoom at its navigation point',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),Rotation=require('./mayatnik-view-rotation.js');
 const html=fs.readFileSync(require.resolve('./Zerkalius-mayatnik.html'),'utf8'),start=html.indexOf("  wrap.addEventListener('wheel', e => {"),end=html.indexOf("  }, { passive: false });",start)+"  }, { passive: false });".length;
 assert.ok(start>=0&&end>start);const code=html.slice(start,end);
 for(const angle of [0,45,90,180,315])for(const turned of [false,true]){
  const h=host();h.state.romboAngle=angle;h.api.render();const p=h.api.plan(),r=h.canvas.getBoundingClientRect(),positions=[];
  // Include transparent canvas gaps as well as actual source-triangle pixels.
  for(let y=.1;y<p.outputHeight;y+=.5)for(let x=.1;x<p.outputWidth;x+=.5){const hit=!!p.pick({x,y});if(!positions.some(q=>q.hit===hit))positions.push({x,y,hit});}
  assert.ok(positions.some(q=>q.hit));if(p.outputHeight>1)assert.ok(positions.some(q=>!q.hit));
  for(const q of positions){
   const logical={x:r.left+q.x*10,y:r.top+q.y*10},center={x:400,y:300},physical=turned?Rotation.point(logical,center):logical;
   // Whole-view capture runs before Rombo and has already inverse-rotated it.
   const mapped=turned?Rotation.point(physical,center):physical,event=h.event('wheel',mapped.x,mapped.y);
   near(event.clientX,logical.x);near(event.clientY,logical.y);assert.equal(event.stopped,undefined);assert.equal(event.prevented,undefined);assert.equal(h.api.physicalPoint(event),undefined);
   const zooms=[],handlers={},ctx={geo:{},viewRotation:{isFieldEvent:()=>turned},wrap:{addEventListener:(type,fn)=>handlers[type]=fn},window:{MayatnikMenuDock:{guardWheel:()=>false}},st:{},ovlLinked:()=>false,scale:()=>1,zoomTo:(...args)=>zooms.push(args),zWant:0,requestAnimationFrame:()=>{},drawEdgeRhomb:()=>{}};
   vm.runInNewContext(code,ctx);event.deltaY=20;handlers.wheel(event);assert.equal(zooms.length,1);near(zooms[0][1],logical.x);near(zooms[0][2],logical.y);assert.equal(event.prevented,true);
  }
 }
});


test('real DOM wheel keeps Rombo gaps zoomable through whole-view rotation and leaves menus and atlas alone',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom'),Rotation=require('./mayatnik-view-rotation.js'),Preview=require('./mayatnik-rombo-preview.js');
 const html=fs.readFileSync(require.resolve('./Zerkalius-mayatnik.html'),'utf8'),start=html.indexOf("  wrap.addEventListener('wheel', e => {"),end=html.indexOf("  }, { passive: false });",start)+"  }, { passive: false });".length;
 assert.match(html,/const viewRotation\s*=\s*window.mayViewRotation\s*=\s*MayatnikViewRotation.mount/);
 const dom=new JSDOM('<div id="wrap"><canvas id="cv"></canvas><div id="edgeBelowWrap"><canvas id="edgeBelow"></canvas></div><div id="paintTools"><button>Menu</button></div></div>'),doc=dom.window.document,win=dom.window,wrap=doc.querySelector('#wrap'),source=doc.querySelector('#cv'),box=doc.querySelector('#edgeBelowWrap'),canvas=doc.querySelector('#edgeBelow');
 win.requestAnimationFrame=()=>1;win.cancelAnimationFrame=()=>{};win.ZerkControlFrame={attach(){}};
 const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
 wrap.getBoundingClientRect=()=>rect(0,0,800,600);source.getBoundingClientRect=()=>rect(200,100,90,50);box.getBoundingClientRect=()=>rect(200,100,90,60);canvas.getBoundingClientRect=()=>rect(200,100,90,60);source.width=9;source.height=5;
 const dockContext={document:doc,getComputedStyle:win.getComputedStyle.bind(win)};vm.runInNewContext(fs.readFileSync(require.resolve('./mayatnik-menu-dock.js'),'utf8'),dockContext);const dock=dockContext.MayatnikMenuDock;
 const rotation=win.mayViewRotation=Rotation.mount({host:wrap,ownsMenu:dock.ownsWheel}),state={edgeRhombOn:true,romboRow:3,romboAngle:0,romboAssembly:1};
 const api=R.mount({host:wrap,source,box,canvas,state:()=>state,geometry:()=>({width:9,height:5,sides:true})});api.render(true);
 const preview=Preview.mount({document:doc,api:()=>api});
 const zooms=[],ctx={wrap,geo:{},viewRotation:rotation,window:{MayatnikMenuDock:dock},st:{},ovlLinked:()=>false,scale:()=>1,zoomTo:(...args)=>zooms.push(args),zWant:0,requestAnimationFrame:()=>{},drawEdgeRhomb:()=>{}};vm.runInNewContext(html.slice(start,end),ctx);
 const wheel=(target,x,y)=>{const e=new win.WheelEvent('wheel',{bubbles:true,cancelable:true,clientX:x,clientY:y,deltaY:30});target.dispatchEvent(e);return e;};
 for(const turned of [false,true]){
  rotation.set(turned);api.render(true);
  const logical=turned?Rotation.point({x:202,y:102},rotation.center):{x:202,y:102},before=zooms.length,event=wheel(canvas,202,102);
  assert.equal(zooms.length,before+1);near(zooms.at(-1)[1],logical.x);near(zooms.at(-1)[2],logical.y);assert.equal(event.defaultPrevented,true);assert.equal(rotation.isFieldEvent(event),turned);
  const menuBefore=zooms.length,menuEvent=wheel(doc.querySelector('#paintTools button'),25,25);assert.equal(zooms.length,menuBefore);assert.equal(rotation.isFieldEvent(menuEvent),false);assert.equal(menuEvent.defaultPrevented,true);
  const atlasEvent=wheel(preview.element.querySelector('button'),400,500);assert.equal(zooms.length,menuBefore);assert.equal(rotation.isFieldEvent(atlasEvent),false);
 }
 preview.destroy();rotation.destroy();dom.window.close();
});


test('Rombo backing matches physical density, snaps its origin and stays fixed across changing frames',()=>{
 for(const dpr of [1,1.25,2])for(const physicalScale of [1,4,26683/30464])for(const turned of [false,true]){
  const h=host(),unit=physicalScale/dpr;h.win.devicePixelRatio=dpr;h.win.mayViewRotation={enabled:turned,center:{x:400.125,y:300.25}};
  Object.assign(h.geometry,{width:1534,height:512});Object.assign(h.state,{romboRow:512,romboAngle:45,romboAssembly:16});Object.assign(h.source,{width:1534,height:512});Object.assign(h.r,{left:17.125,top:-63.375,width:1534*unit,height:512*unit});
  let first;for(let frame=0;frame<6;frame++){
   h.source.frame=frame;h.api.render();const p=h.api.plan(),r=h.canvas.getBoundingClientRect(),cx=h.win.mayViewRotation.center;
   near(r.width*dpr,h.canvas.width);near(r.height*dpr,h.canvas.height);
   const physicalLeft=turned?2*cx.x-r.left-r.width:r.left,physicalTop=turned?2*cx.y-r.top-r.height:r.top;
   near(physicalLeft*dpr,Math.round(physicalLeft*dpr));near(physicalTop*dpr,Math.round(physicalTop*dpr));
   assert.equal(h.canvas.getContext().imageSmoothingEnabled,physicalScale<1);
   const snapshot=JSON.stringify([h.box.style,h.canvas.style.width,h.canvas.style.height,h.canvas.width,h.canvas.height,p.rotation]);if(!first)first=snapshot;else assert.equal(snapshot,first);
   const q=p.forward(R.point(p.parts[0].matrix,{x:767,y:.25})),e=h.event('pointermove',r.left+q.x*unit,r.top+q.y*unit);near(e.clientX,h.r.left+767*unit);near(e.clientY,h.r.top+.25*unit);
  }
 }
});

test('Rombo capped backing stays below area and side budgets at very large zoom',()=>{
 for(const assembly of [9,16]){
  const h=host();h.win.devicePixelRatio=2;Object.assign(h.geometry,{width:1534,height:512});Object.assign(h.state,{romboRow:512,romboAngle:45,romboAssembly:assembly});Object.assign(h.source,{width:1534,height:512});Object.assign(h.r,{width:1534*512,height:512*512});h.api.render();
  assert.ok(h.canvas.width*h.canvas.height<=16e6);assert.ok(h.canvas.width<=16384&&h.canvas.height<=16384);assert.ok(parseFloat(h.canvas.style.width)*2>h.canvas.width);
 }
});


test('Rombo capture keeps native-source minimum double density and annotations without changing screen raster',()=>{
 const calls=[],native={width:1534,height:512};
 const h=host({capture:()=>native,paintCentres:(ctx,p,quality,unit)=>calls.push({canvas:ctx.canvas,p,quality,unit})});
 Object.assign(h.geometry,{width:1534,height:512});Object.assign(h.state,{romboRow:512,romboAngle:45,romboAssembly:16});Object.assign(h.source,{width:1344,height:449});Object.assign(h.r,{width:1534*.25,height:512*.25});
 const draws=[],strokes=[];h.canvas.getContext().drawImage=(...args)=>draws.push(args);h.canvas.getContext().stroke=function(){strokes.push(this.canvas);};h.api.render();
 const before=JSON.stringify([h.box.style,h.canvas.style,h.canvas.width,h.canvas.height]),p=h.api.plan(),out=h.api.capture();
 assert.equal(JSON.stringify([h.box.style,h.canvas.style,h.canvas.width,h.canvas.height]),before);assert.notEqual(out,h.canvas);assert.equal(out.width,Math.ceil(p.outputWidth*2));assert.equal(out.height,Math.ceil(p.outputHeight*2));
 assert.equal(calls.at(-1).canvas,out);assert.equal(calls.at(-1).quality,2);assert.equal(calls.at(-1).unit,.25);assert.equal(strokes.at(-1),out);assert.ok(draws.slice(-p.parts.length).every(args=>args[0]===native));assert.ok(out.width>h.canvas.width);
 h.geometry.width=20000;h.geometry.height=20000;h.source.width=20000;h.source.height=20000;h.state.romboRow=20000;const capped=h.api.capture();assert.ok(capped.width*capped.height<=16e6);assert.ok(capped.width<=16384&&capped.height<=16384);
});


function nativePixels(width,height){const data=new Uint8ClampedArray(width*height*4);for(let i=0;i<width*height;i++){data[i*4]=i%251+1;data[i*4+1]=Math.floor(i/251)%251;data[i*4+2]=17;data[i*4+3]=255;}return {width,height,data};}
const rgba=(image,index)=>Array.from(image.data.subarray(index*4,index*4+4));

test('exact inverse raster matches native picking and copies only original RGBA across every assembly and turn',()=>{
 const source=nativePixels(31,8),palette=new Set(['0,0,0,255',...Array.from({length:31*8},(_,i)=>rgba(source,i).join(','))]);
 for(const {id:assembly}of R.variants)for(let angle=0;angle<360;angle+=45){
  const p=R.plan(31,8,{assembly,angle,row:8},{sides:true}),ratio=angle%90?Math.SQRT2:2,image=R.rasterPixels(p,source,ratio);
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
   const q=p.pick({x:(x+.5)/ratio,y:(y+.5)/ratio}),actual=rgba(image,y*image.width+x);assert.ok(palette.has(actual.join(',')));
   const expected=q?rgba(source,Math.floor(q.y)*source.width+Math.floor(q.x)):[0,0,0,255];assert.deepEqual(actual,expected,`assembly ${assembly}, angle ${angle}, pixel ${x},${y}`);
  }
 }
});

test('exact central diamond keeps every native cone bit visible at diagonal sqrt2 and straight one',()=>{
 const source=nativePixels(31,8);
 for(const angle of [0,45,90,135,180,225,270,315]){
  const p=R.plan(31,8,{assembly:16,angle,row:8},{sides:true}),image=R.rasterPixels(p,source,angle%90?Math.SQRT2:1),seen=new Set();
  for(let i=0;i<image.width*image.height;i++)seen.add(rgba(image,i).join(','));
  for(const row of p.parts[0].rows)for(let x=row.left;x<row.right;x++)assert.ok(seen.has(rgba(source,row.y*source.width+x).join(',')),`missing ${x},${row.y} at ${angle}`);
 }
});

test('exact custom triangle raster agrees with source picking after local rotations and reflection',()=>{
 const source=nativePixels(12,10),layout={width:12,height:10,scope:'test',pieces:[{id:'a',vertices:[[1,1],[7,1],[1,7]],pose:{x:2,y:1,turn:1,flip:true}}]};
 const p=R.customPlan(layout,{width:12,height:10,scope:'test'},45);assert.equal(p.available,true);const ratio=3,image=R.rasterPixels(p,source,ratio);
 for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
  const q=p.pick({x:(x+.5)/ratio,y:(y+.5)/ratio});assert.deepEqual(rgba(image,y*image.width+x),q?rgba(source,Math.floor(q.y)*12+Math.floor(q.x)):[0,0,0,255]);
 }
});

test('exact raster refuses oversized output and accepts reusable RGBA storage',()=>{
 const source=nativePixels(31,8),p=R.plan(31,8,{assembly:16,angle:45},{sides:true}),a=R.rasterPixels(p,source,2),data=new Uint8ClampedArray(a.data.length);assert.equal(R.rasterPixels(p,source,2,{data}).data,data);assert.deepEqual(data,a.data);
 assert.throws(()=>R.rasterPixels(p,source,10000),/Точный растр Ромбо превышает лимит/);assert.throws(()=>R.rasterPixels(p,null),/исходный массив RGBA/);
});

test('strict display and export use exact native RGBA and report precision failure without stale raster or RAF storm',()=>{
 const pixels=nativePixels(9,5),errors=[],decorations=[];
 const h=host({precision:()=>true,captureBits:()=>pixels,capture:()=>{throw Error('interpolated source forbidden');},onPrecisionError:message=>errors.push(message),paintCentres:ctx=>decorations.push(ctx.canvas)});
 h.canvas.getContext().drawImage=()=>{throw Error('Canvas interpolation forbidden');};h.api.render();assert.ok(h.canvas.getContext().lastImage);assert.equal(decorations.at(-1),h.canvas);
 const before=JSON.stringify([h.box.style,h.canvas.style,h.canvas.width,h.canvas.height]),out=h.api.capture();assert.ok(out.getContext().lastImage);assert.equal(decorations.at(-1),out);assert.equal(JSON.stringify([h.box.style,h.canvas.style,h.canvas.width,h.canvas.height]),before);
 h.r.width=9*10000;h.r.height=5*10000;h.api.render();assert.equal(h.canvas.style.display,'none');assert.equal(errors.length,1);assert.match(errors[0],/лимит/);h.api.render();assert.equal(errors.length,1);
 h.r.width=90;h.r.height=50;h.api.render();assert.equal(h.canvas.style.display,'');assert.equal(errors.at(-1),'');
});

test('precision state guard rejects incompatible setters before state mutation',()=>{
 const checked=[],h=host({allowState:next=>{checked.push(next);return false;}}),before={...h.state};h.api.set(false);h.api.setRow(2);h.api.cycleAngle();h.api.setAssembly(16);h.api.setMode('custom');assert.deepEqual(h.state,before);assert.equal(checked.length,5);assert.equal(h.notifications.length,0);
});


test('strict canonical scale survives CSS rounding; overlay palette stays separate and a new revision updates bits',()=>{
 const pixels=nativePixels(9,5),overlay={width:9,height:5,data:new Uint8ClampedArray(9*5*4)},draws=[];overlay.data.set([200,10,77,255],4*4);let revision=1;
 const h=host({precision:()=>true,scale:()=>Math.SQRT2,captureBits:()=>pixels,captureOverlay:()=>overlay,revision:()=>revision,exportScale:()=>2*Math.SQRT2});h.state.romboAngle=45;h.r.width=9*Math.SQRT2+.003;h.canvas.getContext().drawImage=(c,...args)=>draws.push([c,args]);h.api.render();
 const p=h.api.plan(),expected=R.rasterPixels(p,pixels,Math.SQRT2);assert.equal(h.canvas.width,expected.width);assert.deepEqual(h.canvas.getContext().lastImage.data,expected.data);assert.equal(h.canvas.getContext().imageSmoothingEnabled,false);assert.deepEqual(draws[0][1],[0,0]);
 const decorated=draws[0][0].getContext().lastImage;assert.deepEqual(decorated.data,R.rasterPixels(p,overlay,Math.SQRT2,{transparent:true}).data);
 pixels.data[4*4]=99;revision++;h.api.render();assert.deepEqual(h.canvas.getContext().lastImage.data,R.rasterPixels(p,pixels,Math.SQRT2).data);
 const out=h.api.capture();assert.deepEqual(out.getContext().lastImage.data,R.rasterPixels(p,pixels,2*Math.SQRT2).data);
});


test('regional exact pixels are byte-identical to the whole raster across every variant, turn and tile seam',()=>{
 const source=nativePixels(31,8);
 for(const {id:assembly}of R.variants)for(let angle=0;angle<360;angle+=45){
  const p=R.plan(31,8,{assembly,angle},{sides:true}),quality=angle%90?2*Math.SQRT2:4,full=R.rasterPixels(p,source,quality);
  for(let y=0;y<full.height;y+=17)for(let x=0;x<full.width;x+=19){
   const region={x,y,width:Math.min(19,full.width-x),height:Math.min(17,full.height-y)},tile=R.rasterPixels(p,source,quality,{region});
   for(let v=0;v<region.height;v++)assert.deepEqual(tile.data.subarray(v*region.width*4,(v+1)*region.width*4),full.data.subarray(((y+v)*full.width+x)*4,((y+v)*full.width+x+region.width)*4));
  }
 }
});

test('viewport tiles cover only visible global pixels at 512 zoom and retain full-size picking, overlay and export',()=>{
 for(const dpr of [1,1.25,2])for(const angle of [0,45,90,135,180,225,270,315]){
  let overlays=0,revision=1,registrations=0;const pixels=nativePixels(31,8),decorated={...pixels,data:pixels.data.slice()},unit=64;
  const h=host({viewport:true,precision:()=>true,scale:()=>unit,captureBits:()=>pixels,captureOverlay:()=>{overlays++;return decorated;},revision:()=>revision,exportScale:()=>angle%90?2*Math.SQRT2:2});
  h.win.devicePixelRatio=dpr;h.win.mayViewRotation={enabled:false,center:{x:400,y:300},register(){registrations++;}};Object.assign(h.geometry,{width:31,height:8});Object.assign(h.state,{romboRow:8,romboAssembly:16,romboAngle:angle});Object.assign(h.source,{width:31,height:8});Object.assign(h.r,{left:-500,top:-200,width:31*unit,height:8*unit});
  h.api.render();const p=h.api.plan(),tiles=h.api.screenTiles();assert.ok(tiles.length>0);assert.equal(overlays,1);assert.ok(tiles.every(t=>t.width<=2048&&t.height<=2048));
  assert.equal(parseFloat(h.box.style.width),p.outputWidth*unit);assert.equal(parseFloat(h.box.style.height),p.outputHeight*unit);
  for(const tile of tiles){
   const ox=Math.round(parseFloat(tile.style.left)*dpr),oy=Math.round(parseFloat(tile.style.top)*dpr),image=tile.getContext().lastImage;
   for(let y=0;y<tile.height;y+=127)for(let x=0;x<tile.width;x+=113){
    const q=p.pick({x:(ox+x+.5)/(unit*dpr),y:(oy+y+.5)/(unit*dpr)}),expected=q?rgba(pixels,Math.floor(q.y)*pixels.width+Math.floor(q.x)):[0,0,0,255];assert.deepEqual(rgba(image,y*tile.width+x),expected);
   }
  }
  const before=JSON.stringify(tiles.map(t=>[t.width,t.height,t.style.left,t.style.top]));h.r.left-=29;h.r.top-=31;h.api.render();assert.notEqual(JSON.stringify(h.api.screenTiles().map(t=>[t.width,t.height,t.style.left,t.style.top])),before);assert.equal(overlays,2);
  const output=h.api.capture();assert.ok(output.width*output.height<=16e6);assert.ok(output.width<parseFloat(h.box.style.width)*dpr);h.api.render();assert.equal(overlays,4);
 }
});

test('very large Rombo canvas is tiled, captured immediately after half-turn registration, and hidden tiles release storage',()=>{
 let overlays=0,registered=0;const pixels=nativePixels(31,8),unit=512,h=host({viewport:true,precision:()=>true,scale:()=>unit,captureBits:()=>pixels,captureOverlay:()=>{overlays++;return null;}});
 h.win.devicePixelRatio=2;h.win.innerWidth=5000;h.win.innerHeight=3000;Object.assign(h.viewport,{clientWidth:5000,clientHeight:3000});h.viewport.getBoundingClientRect=()=>({left:0,top:0,right:5000,bottom:3000,width:5000,height:3000});
 h.win.mayViewRotation={enabled:true,center:{x:2500,y:1500},register(){registered++;}};Object.assign(h.geometry,{width:31,height:8});Object.assign(h.state,{romboRow:8,romboAssembly:16});Object.assign(h.source,{width:31,height:8});Object.assign(h.r,{left:-4000,top:-2000,width:31*unit,height:8*unit});h.api.render();
 const tiles=h.api.screenTiles();assert.ok(tiles.length>1);assert.equal(registered,tiles.length-1);assert.equal(overlays,1);assert.ok(tiles.every(t=>t.width*t.height<=2048*2048));assert.ok(parseFloat(h.box.style.width)*parseFloat(h.box.style.height)*4>16e6);
 h.r.left=1e7;h.api.render();assert.deepEqual(h.api.screenTiles(),[]);assert.ok(tiles.every(t=>t.width===1&&t.height===1&&t.style.display==='none'));
});

test('cropped first-tile and full-container hits map to the same source and physical navigation coordinates',()=>{
 const pixels=nativePixels(31,8),unit=64,h=host({viewport:true,precision:()=>true,scale:()=>unit,captureBits:()=>pixels});Object.assign(h.geometry,{width:31,height:8});Object.assign(h.state,{romboRow:8,romboAssembly:16,romboAngle:45});Object.assign(h.source,{width:31,height:8});Object.assign(h.r,{left:-650,top:-200,width:31*unit,height:8*unit});h.api.render();
 const p=h.api.plan(),br=h.box.getBoundingClientRect(),native={x:15.25,y:2.25},q=p.forward(R.point(p.parts[0].matrix,native)),screen={x:br.left+q.x*unit,y:br.top+q.y*unit};
 const e=h.event('pointermove',screen.x,screen.y);near(e.clientX,h.r.left+native.x*unit);near(e.clientY,h.r.top+native.y*unit);assert.deepEqual(h.api.physicalPoint(e),screen);
});
