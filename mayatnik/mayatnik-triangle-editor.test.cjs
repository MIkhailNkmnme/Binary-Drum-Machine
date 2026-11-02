const test=require('node:test');
const assert=require('node:assert/strict');
const {compatible,viewport,worldPoint}=require('./mayatnik-triangle-editor.js');
const {mount,portalGeometry}=require('./mayatnik-triangle-editor.js');
const core=require('./mayatnik-triangle-assembly.js');
test('assembly remains compatible across playback frames but rejects a different geometry',()=>{
 const l={width:200,height:100,sourceFrame:4,scope:'axes-1'};
 assert.equal(compatible(l,{...l,sourceFrame:99}),true);
 assert.equal(compatible(l,{...l,scope:'axes-2'}),false);
 assert.equal(compatible(l,{...l,width:201}),false);
 assert.equal(compatible(null,l),false);
});
function harness(){
 let frame=0,enabled=false,current=null,available=true,queue=[],serial=0;
 const commits=[],draws=[];
 const ctx={save(){},restore(){},setTransform(){},transform(){},translate(){},scale(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){},fill(){},stroke(){},fillRect(){},clearRect(){},drawImage(...args){draws.push(args);}};
 class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.style={};this.dataset={};this.attrs={};this.listeners={};this.clientWidth=640;this.clientHeight=tag==='canvas'?280:0;this.classList={toggle(){}};}
  append(...items){this.children.push(...items);}
  replaceChildren(...items){this.children=items;}
  get firstChild(){return this.children[0];}
  setAttribute(k,v){this.attrs[k]=v;}
  addEventListener(k,v){(this.listeners[k]??=[]).push(v);}
  removeEventListener(){}
  getContext(){return ctx;}
  getBoundingClientRect(){return {left:0,top:0,width:640,height:280};}
  setPointerCapture(){}
  releasePointerCapture(){}
  remove(){}
  fire(type,x=0,y=0){for(const cb of this.listeners[type]||[])cb({type,pointerId:1,button:0,clientX:x,clientY:y,preventDefault(){},stopPropagation(){}});}
 }
 const win={devicePixelRatio:1,innerWidth:900,innerHeight:600,scrollX:0,scrollY:0,MayatnikTriangleAssembly:core,requestAnimationFrame(cb){queue.push(cb);return ++serial;},cancelAnimationFrame(){},addEventListener(){},removeEventListener(){}};
 const body=new Element('body'),document={defaultView:win,body,createElement:tag=>new Element(tag)};
 const source={width:100,height:100};
 const snapshot=()=>({width:100,height:100,scope:'test',sourceFrame:frame,available,reason:available?'':'Недоступно в GPU',segments:[{a:[0,0],b:[100,0]},{a:[100,0],b:[0,100]},{a:[0,100],b:[0,0]}]});
 const clip=new Element('div');clip.getBoundingClientRect=()=>({left:50,right:690,top:50,bottom:500,width:640,height:450});clip.scrollTop=137;
 const figure={getBoundingClientRect:()=>({left:800,width:120,bottom:100})};
 const editor=mount({document,viewport:clip,figure:()=>figure,snapshot,getLayout:()=>current,commit(l,label){current=l;commits.push({l,label});},enable:v=>{enabled=v;},isEnabled:()=>enabled,sourceCanvas:()=>source});
 function flush(){while(queue.length){const q=queue;queue=[];q.forEach(cb=>cb());}}
 return {editor,body,clip,commits,draws,source,flush,nextFrame(){frame++;editor.sync();flush();},setAvailable(v){available=v;editor.sync();flush();},setLayout(v){current=v;editor.sync();flush();},layout:()=>current,enabled:()=>enabled};
}
test('explicit open/find discovers pieces, enables assembly and redraws current playback pixels',()=>{
 const h=harness(),panel=h.body.children[0],tools=panel.children[0];
 assert.equal(panel.hidden,true);assert.equal(h.commits.length,0);
 h.editor.open();h.flush();tools.children[0].onclick();h.flush();
 assert.equal(h.layout().pieces.length,2);assert.equal(h.enabled(),true);assert.equal(h.commits.length,1);
 assert.equal(panel.children[2].children.length,2); // equal-area pieces each retain a thumbnail
 const before=h.draws.length;h.nextFrame();assert.ok(h.draws.length>before);assert.equal(h.commits.length,1);
 assert.ok(h.draws.every(args=>args[0]===h.source&&args.length===9));
});
test('unavailable snapshot with matching scope blocks transform/apply/find and cancels active gestures',()=>{
 const h=harness();h.editor.open();h.flush();const panel=h.body.children[0],tools=panel.children[0],canvas=panel.children[3];tools.children[0].onclick();h.flush();const original=JSON.stringify(h.layout());
 h.setAvailable(false);
 assert.equal(tools.children[0].disabled,true);assert.equal(tools.children[1].disabled,true);assert.equal(tools.children[3].disabled,true);assert.match(panel.children[1].textContent,/GPU/);
 for(const i of [0,1,3,4,5,6,7])tools.children[i].onclick();h.flush();
 const v=viewport({minX:0,minY:0,maxX:100,maxY:100},640,280),start=[v.x+20*v.scale,v.y+20*v.scale];canvas.fire('pointerdown',...start);canvas.fire('pointermove',start[0]+20,start[1]+20);canvas.fire('pointerup');h.flush();
 assert.equal(h.commits.length,1);assert.equal(JSON.stringify(h.layout()),original);
 h.setAvailable(true);canvas.fire('pointerdown',...start);canvas.fire('pointermove',start[0]+20,start[1]+20);h.setAvailable(false);canvas.fire('pointerup');h.flush();assert.equal(h.commits.length,1);assert.equal(JSON.stringify(h.layout()),original);
});
test('body portal clamps to internal viewport, clips above and below it, reserves scroll room without moving scroll',()=>{
 const h=harness();h.editor.open();h.flush();const panel=h.body.children[0];
 assert.equal(panel.style.left,'366px');assert.equal(panel.style.top,'108px');assert.equal(panel.style.width,'320px');assert.equal(panel.style.clipPath,'inset(0px 0px 48px 0px)');
 assert.equal(h.clip.children[0].style.height,'452px');assert.equal(h.clip.scrollTop,137);assert.equal(h.editor.scrollSpace(),452);h.editor.close();assert.equal(h.clip.children[0].hidden,true);assert.equal(h.editor.scrollSpace(),0);
 const g=portalGeometry({left:-500,width:2000,bottom:-100},{left:50,right:690,top:50,bottom:500},{width:900,height:600},440);
 assert.equal(g.left,54);assert.equal(g.width,632);assert.equal(g.clipPath,'inset(142px 0px 0px 0px)');
});
test('malformed startup layout shows empty editor without throwing',()=>{
 const h=harness();h.setLayout({width:100,height:100,scope:'test'});h.editor.open();assert.doesNotThrow(h.flush);assert.match(h.body.children[0].children[1].textContent,/Найдите/);
});
test('drag uses the original viewport throughout gesture and creates only one history entry; cancel rolls back',()=>{
 const h=harness();h.editor.open();h.flush();const panel=h.body.children[0];panel.children[0].children[0].onclick();h.flush();
 const canvas=panel.children[3],v=viewport({minX:0,minY:0,maxX:100,maxY:100},640,280);
 const start=[v.x+20*v.scale,v.y+20*v.scale];
 canvas.fire('pointerdown',...start);canvas.fire('pointermove',start[0]+20*v.scale,start[1]+10*v.scale);h.flush();
 assert.equal(h.commits.length,1);
 canvas.fire('pointermove',start[0]+30*v.scale,start[1]+15*v.scale);h.flush();
 canvas.fire('pointerup',start[0]+30*v.scale,start[1]+15*v.scale);h.flush();
 assert.equal(h.commits.length,2);assert.ok(Math.abs(h.layout().pieces[0].pose.x-30)<1e-9);assert.ok(Math.abs(h.layout().pieces[0].pose.y-15)<1e-9);
 const before=JSON.stringify(h.layout()),v2=viewport({minX:0,minY:0,maxX:130,maxY:115},640,280),at=[v2.x+50*v2.scale,v2.y+35*v2.scale];
 canvas.fire('pointerdown',...at);canvas.fire('pointermove',at[0]+50,at[1]+30);h.flush();canvas.fire('pointercancel');h.flush();
 assert.equal(h.commits.length,2);assert.equal(JSON.stringify(h.layout()),before);
});
test('selection clicks, returning a drag to origin, and identity resets leave undo history unchanged',()=>{
 const h=harness();h.editor.open();h.flush();const panel=h.body.children[0],tools=panel.children[0],canvas=panel.children[3];tools.children[0].onclick();h.flush();
 const original=JSON.stringify(h.layout()),v=viewport({minX:0,minY:0,maxX:100,maxY:100},640,280),start=[v.x+20*v.scale,v.y+20*v.scale];
 canvas.fire('pointerdown',...start);canvas.fire('pointerup',...start);h.flush();assert.equal(h.commits.length,1);
 canvas.fire('pointerdown',...start);canvas.fire('pointermove',start[0]+30*v.scale,start[1]+15*v.scale);h.flush();canvas.fire('pointermove',...start);canvas.fire('pointerup',...start);h.flush();
 assert.equal(h.commits.length,1);assert.equal(JSON.stringify(h.layout()),original);
 tools.children[6].onclick();tools.children[7].onclick();h.flush();assert.equal(h.commits.length,1);
});
test('workspace transform includes moved negative coordinates and round trips pointer coordinates',()=>{
 const b={minX:-60,minY:-20,maxX:160,maxY:120},v=viewport(b,640,280);
 for(const p of [[-60,-20],[160,120],[11,29]]){const actual=worldPoint(v,p[0]*v.scale+v.x,p[1]*v.scale+v.y);assert.ok(Math.abs(actual[0]-p[0])<1e-10);assert.ok(Math.abs(actual[1]-p[1])<1e-10);}
 assert.ok(b.minX*v.scale+v.x>=24-1e-10);assert.ok(b.maxY*v.scale+v.y<=256+1e-10);
});
