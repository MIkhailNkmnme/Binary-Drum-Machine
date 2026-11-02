const {test}=require('node:test');
const assert=require('node:assert/strict');
const R=require('./mayatnik-rombo.js');
const T=require('./mayatnik-triangle-assembly.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const geometry={width:9,height:5,scope:'field-A',sides:true};
const layout={width:9,height:5,scope:'field-A',sourceFrame:19,pieces:[
 {id:'first',vertices:[[1,1],[4,1],[1,4]],pose:{x:2,y:-1,turn:1,flip:true}},
 {id:'second',vertices:[[5.25,2],[7,1],[6,4]],pose:{x:1,y:3,turn:3,flip:false}}
]};

test('custom poses and global rotation preserve source coordinates, source masks and exact bounds',()=>{
 const initial=JSON.stringify(layout);
 for(let angle=0;angle<360;angle+=45){
  const p=R.customPlan(layout,geometry,angle);
  assert.equal(p.axis,null);assert.equal(p.mode,'custom');assert.ok(p.available);
  const projected=[];
  for(const [i,tile] of p.parts.entries()){
   const v=layout.pieces[i].vertices,centroid={x:v.reduce((sum,q)=>sum+q[0],0)/3,y:v.reduce((sum,q)=>sum+q[1],0)/3};
   assert.ok(tile.contains(centroid.x,centroid.y));assert.ok(!tile.contains(0,5));
   const [x,y]=T.forward(layout.pieces[i],[centroid.x,centroid.y]);
   const back=p.pick(p.forward({x,y}));assert.equal(back.part,tile.id);near(back.x,centroid.x);near(back.y,centroid.y);
   projected.push(...tile.outline.map(q=>p.forward(R.point(tile.matrix,q))));
  }
  near(Math.min(...projected.map(v=>v.x)),0);near(Math.min(...projected.map(v=>v.y)),0);
  near(Math.max(...projected.map(v=>v.x)),p.outputWidth);near(Math.max(...projected.map(v=>v.y)),p.outputHeight);
  assert.equal(p.pick({x:-1,y:-1}),null);
 }
 assert.equal(JSON.stringify(layout),initial);
});

test('inverse picking gives the top painted piece even when native source bits differ',()=>{
 const a={id:'a',vertices:[[0,0],[3,0],[0,3]]},b={id:'b',vertices:[[4,0],[7,0],[4,3]],pose:{x:-4,y:0,turn:0,flip:false}};
 for(const pieces of [[a,b],[b,a]]){const p=R.customPlan({...layout,pieces},geometry,45);
  const back=p.pick(p.forward({x:1,y:1}));assert.equal(back.part,pieces[1].id);near(back.x,pieces[1]===b?5:1);near(back.y,1);
 }
});

function mount(){
 const g={...geometry},state={edgeRhombOn:true,romboMode:'custom',romboLayout:layout,romboAssembly:16,romboRow:2};
 const logs={draws:[],captures:[],centres:[],notifications:[],axis:0},listeners={};
 const win={Event:class{constructor(type){this.type=type;}},dispatchEvent:e=>logs.notifications.push(e.type),addEventListener:(type,fn)=>listeners[type]=fn,
  getComputedStyle:()=>({marginBottom:'0'}),requestAnimationFrame:()=>1,cancelAnimationFrame(){}};
 const doc={body:{classList:{toggle(){}}},defaultView:win,createElement:()=>({getContext:()=>({drawImage:frame=>logs.captures.push(frame)})})};
 const rect={left:20,top:50,width:90,height:50},source={width:36,height:20,style:{visibility:'visible'},getBoundingClientRect:()=>rect};
 const ctx={setTransform(){},fillRect(){},save(){},restore(){},transform(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){},
  drawImage:(...args)=>logs.draws.push(args),stroke:()=>logs.axis++};
 const box={style:{},getBoundingClientRect:()=>rect},canvas={style:{},getContext:()=>ctx,getBoundingClientRect:()=>rect};ctx.canvas=canvas;
 let frame=0;
 const api=R.mount({host:{ownerDocument:doc},source,box,canvas,state:()=>state,geometry:()=>g,
  paintCentres:(context,p)=>logs.centres.push(p),capture:()=>({width:36,height:20,frame:++frame})});
 function pointer(type,p){
  const point={x:rect.left+p.x*10,y:rect.top+p.y*10};
  const e={type,target:canvas,clientX:point.x,clientY:point.y,button:0,pointerId:1,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};
  listeners[type](e);return {e,point};
 }
 return {api,g,state,logs,source,box,canvas,pointer,rect};
}

test('live capture crops each current frame, centres use active plan, and input preserves physical coordinates',()=>{
 const h=mount(),p=h.api.plan();h.api.render();h.api.capture();
 assert.equal(h.logs.axis,0);assert.deepEqual(h.logs.captures,[h.canvas]);assert.deepEqual(h.logs.centres,[p,p]);
 assert.deepEqual(h.logs.draws.map(args=>args[0].frame),[1,1,2,2]);
 assert.deepEqual(h.logs.draws[0].slice(1),[4,4,12,12,1,1,3,3]);
 assert.deepEqual(h.logs.draws[1].slice(1),[21,4,7,12,5.25,1,1.75,3]);
 const src={x:2,y:2},pos=p.forward(R.point(p.parts[0].matrix,src));
 for(const type of ['pointerdown','pointermove','pointerup','click','wheel']){
  const {e,point}=h.pointer(type,pos);assert.deepEqual(h.api.physicalPoint(e),point);assert.ok(!e.stopped);
  near(e.clientX,h.rect.left+src.x*10);near(e.clientY,h.rect.top+src.y*10);
 }
 assert.equal(h.state.romboRow,2);assert.equal(h.canvas.style.cursor,'crosshair');
});

test('layouts invalidate once by reference, fixed previews stay isolated, incompatible scope or dimensions restore native field',()=>{
 const h=mount(),p=h.api.plan(),fixed=h.api.plan(16);h.api.render();h.api.render();
 assert.equal(h.logs.notifications.length,1);assert.strictEqual(h.api.plan(),p);assert.strictEqual(h.api.plan(16),fixed);
 assert.deepEqual(h.api.options().map(v=>v.id),R.variants.map(v=>v.id));assert.equal(fixed.mode,'fixed');
 h.state.romboLayout={...layout,pieces:[...layout.pieces].reverse()};h.api.render();const next=h.api.plan();
 assert.notStrictEqual(next,p);assert.equal(h.logs.notifications.length,2);assert.deepEqual(next.parts.map(t=>t.id),['second','first']);
 for(const [key,v] of [['scope','field-B'],['width',8],['height',6],['available',false]]){
  h.g[key]=v;h.api.render();assert.equal(h.box.style.display,'none');assert.equal(h.source.style.visibility,'visible');
  assert.equal(h.api.get().mode,'custom');assert.equal(h.api.get().available,false);assert.ok(h.api.get().reason);assert.deepEqual(h.api.plan().parts,[]);
  h.g[key]=geometry[key];h.api.render();assert.equal(h.box.style.display,'block');assert.equal(h.api.get().available,true);
 }
 assert.equal(h.state.romboLayout.pieces[0].id,'second');h.state.romboMode='fixed';h.api.render();assert.strictEqual(h.api.plan(),h.api.plan(16));assert.ok(h.logs.axis);
 h.state.romboMode='custom';for(const invalid of [null,{...layout,pieces:[]},{...layout,pieces:[{}]}]){
  h.state.romboLayout=invalid;h.api.render();assert.equal(h.box.style.display,'none');assert.strictEqual(h.state.romboLayout,invalid);
 }
});

test('custom centres count distant and overlapping triangle footprints without scanning the gaps',()=>{
 const vertices=[[0,2],[2,2],[0,4]];
 const translations=[[0,0],[0,0],[1e7,0],[1e7,1e7]];
 const pieces=translations.map(([x,y],i)=>({id:'t'+i,vertices,pose:{x,y,turn:0,flip:false}}));
 const p=R.customPlan({...layout,pieces},geometry,0);
 const parts=p.parts.map(t=>({...t,width:p.width,transform:t.matrix,read:()=>0}));
 // Bound even a regression to the old rectangular scan.
 const vm=require('node:vm'),C=require('./mayatnik-center.js');
 const result=vm.runInNewContext('C.compose(parts)',{C,parts},{timeout:2000});
 assert.equal(result.count,9);
 assert.deepEqual(result.parts.map(v=>v.count),[3,3,3,3]);
 near(result.center.x,5/6+2e7/3);near(result.center.y,2+5/6+1e7/3);
});
