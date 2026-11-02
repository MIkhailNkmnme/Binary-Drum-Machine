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

function host(){
  const geometry={width:9,height:5,sides:true},state={edgeRhombOn:true,romboRow:3,romboAngle:0,romboAssembly:1},listeners={},notifications=[],r={left:200,top:100,width:90,height:50},classes=new Set();
  const style={},source={width:9,height:5,style:{},getBoundingClientRect:()=>({...r})};
  const ctx={canvas:null,setTransform(){},fillRect(){},save(){},restore(){},transform(){},beginPath(){},rect(){},closePath(){},clip(){},drawImage(){},moveTo(){},lineTo(){},stroke(){},setLineDash(){}};
  const box={style,getBoundingClientRect(){const t=/translate\(([-.\d]+)px, ([-.\d]+)px\)/.exec(style.transform||'');return {left:+(t?.[1]||0),top:r.top+r.height+2+(parseFloat(style.marginTop)||0)+ +(t?.[2]||0)};}};
  const canvas={style:{},width:1,height:1,getContext:()=>ctx,getBoundingClientRect(){const b=box.getBoundingClientRect();return {...b,width:parseFloat(canvas.style.width),height:parseFloat(canvas.style.height)};},setPointerCapture(){}};ctx.canvas=canvas;
  const win={Event:class{constructor(type){this.type=type;}},dispatchEvent(event){notifications.push(event.type);},requestAnimationFrame:()=>1,cancelAnimationFrame(){},getComputedStyle:()=>({marginBottom:'2px'}),addEventListener(type,fn){listeners[type]=fn;}};
  const doc={defaultView:win,body:{classList:{toggle(key,on){on?classes.add(key):classes.delete(key);}}},createElement:()=>({getContext:()=>({drawImage(){}})})};
  const api=R.mount({host:{ownerDocument:doc},source,box,canvas,state:()=>state,geometry:()=>geometry,changed(){api.render();}});
  function event(type,x,y){const e={type,target:canvas,clientX:x,clientY:y,pointerId:1,button:0,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};listeners[type](e);return e;}
  return {api,state,source,box,canvas,r,classes,event,notifications,geometry};
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
    const p=h.api.plan(),r=h.canvas.getBoundingClientRect();near(r.width/p.outputWidth,scale);near(r.height/p.outputHeight,scale);
    near(r.left+r.width/2,h.r.left+h.r.width/2);near(r.top,h.r.top);
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
 const dom=new JSDOM('<div id="wrap"><canvas id="cv"></canvas><div id="edgeBelowWrap"><canvas id="edgeBelow"></canvas></div><div id="paintTools"><button>Menu</button></div></div>'),doc=dom.window.document,win=dom.window,wrap=doc.querySelector('#wrap'),source=doc.querySelector('#cv'),box=doc.querySelector('#edgeBelowWrap'),canvas=doc.querySelector('#edgeBelow');
 win.requestAnimationFrame=()=>1;win.cancelAnimationFrame=()=>{};win.ZerkControlFrame={attach(){}};
 const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
 wrap.getBoundingClientRect=()=>rect(0,0,800,600);source.getBoundingClientRect=()=>rect(200,100,90,50);box.getBoundingClientRect=()=>rect(200,100,90,60);canvas.getBoundingClientRect=()=>rect(200,100,90,60);source.width=9;source.height=5;
 const dockContext={document:doc,getComputedStyle:win.getComputedStyle.bind(win)};vm.runInNewContext(fs.readFileSync(require.resolve('./mayatnik-menu-dock.js'),'utf8'),dockContext);const dock=dockContext.MayatnikMenuDock;
 const rotation=Rotation.mount({host:wrap,ownsMenu:dock.ownsWheel}),state={edgeRhombOn:true,romboRow:3,romboAngle:0,romboAssembly:1};
 const api=R.mount({host:wrap,source,box,canvas,state:()=>state,geometry:()=>({width:9,height:5,sides:true})});api.render(true);
 const preview=Preview.mount({document:doc,api:()=>api});
 const zooms=[],ctx={wrap,geo:{},viewRotation:rotation,window:{MayatnikMenuDock:dock},st:{},ovlLinked:()=>false,scale:()=>1,zoomTo:(...args)=>zooms.push(args),zWant:0,requestAnimationFrame:()=>{},drawEdgeRhomb:()=>{}};vm.runInNewContext(html.slice(start,end),ctx);
 const wheel=(target,x,y)=>{const e=new win.WheelEvent('wheel',{bubbles:true,cancelable:true,clientX:x,clientY:y,deltaY:30});target.dispatchEvent(e);return e;};
 for(const turned of [false,true]){
  rotation.set(turned);
  const logical=turned?Rotation.point({x:202,y:102},rotation.center):{x:202,y:102},before=zooms.length,event=wheel(canvas,202,102);
  assert.equal(zooms.length,before+1);near(zooms.at(-1)[1],logical.x);near(zooms.at(-1)[2],logical.y);assert.equal(event.defaultPrevented,true);assert.equal(rotation.isFieldEvent(event),turned);
  const menuBefore=zooms.length,menuEvent=wheel(doc.querySelector('#paintTools button'),25,25);assert.equal(zooms.length,menuBefore);assert.equal(rotation.isFieldEvent(menuEvent),false);assert.equal(menuEvent.defaultPrevented,true);
  const atlasEvent=wheel(preview.element.querySelector('button'),400,500);assert.equal(zooms.length,menuBefore);assert.equal(rotation.isFieldEvent(atlasEvent),false);
 }
 preview.destroy();rotation.destroy();dom.window.close();
});
