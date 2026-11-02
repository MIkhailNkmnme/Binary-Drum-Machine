const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('./mayatnik-rombo-preview.js');
const ids=[1,3,4,6,9,11,12,14,16,17];
const fixtureOptions=()=>ids.map(id=>({id,label:id>=16?'Central '+id:'L | R '+id,available:id!==11,reason:id===11?'Нет боковых частей':''}));
function fixturePlan(id,state){const angle=((Math.round((state.angle||0)/45)*45)%360+360)%360,a=angle*Math.PI/180;return {available:id!==11,reason:'Нет боковых частей',rotation:[Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0],parts:[{outline:[{x:5,y:0},{x:0,y:10},{x:10,y:10}],matrix:[1,0,0,1,0,0],sourceKey:'C',label:'Центр',color:'#e5be68'},{outline:[{x:5,y:0},{x:0,y:10},{x:10,y:10}],matrix:id===16?[-1,0,0,-1,10,20]:[1,0,0,-1,0,20],sourceKey:id>=16?'C':'L',label:'Низ',color:'#78b8e8'}],axis:[{x:0,y:10},{x:10,y:10}]};}
function host(layout=false,fallback=false){
 const listeners=new Map(),framesPending=new Map();let writes=0,frameId=0,resize;
 class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.hidden=false;this.listeners=new Map();this.style={};}
  get offsetHeight(){return this.hidden?0:this.layoutHeight??(parseFloat(this.style.height)||0);}
  get offsetWidth(){return this.layoutWidth??140;}
  getBoundingClientRect(){return this.rect;}
  append(el){this.children.push(el);el.parent=this;}
  setAttribute(key,value){this.attributes[key]=value;writes++;}
  set textContent(value){this.text=value;writes++;}
  get textContent(){return this.text;}
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(fn);}
  removeEventListener(type){this.listeners.delete(type);}
  event(type,extra={}){const event={type,...extra,stopped:false,prevented:false,stopPropagation(){this.stopped=true;},preventDefault(){this.prevented=true;}};for(const fn of this.listeners.get(type)||[])fn(event);return event;}
  remove(){this.parent.children=this.parent.children.filter(el=>el!==this);}
 }
 const frames=[],win={addEventListener(type,fn){listeners.set(type,fn);},removeEventListener(type){listeners.delete(type);},ZerkControlFrame:{attach(...args){frames.push(args);}},requestAnimationFrame(fn){framesPending.set(++frameId,fn);return frameId;},cancelAnimationFrame(id){framesPending.delete(id);},ResizeObserver:class{constructor(fn){resize=fn;}observe(){}disconnect(){resize=null;}}};
 const doc={defaultView:win,body:new Element('body'),createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag)};
 const viewport=layout?new Element('viewport'):null,figure=layout?new Element('canvas'):null,fallbackFigure=fallback?new Element('source'):null;if(fallbackFigure)fallbackFigure.rect={left:100,top:100,width:200,height:300,bottom:400};
 if(layout){viewport.rect={left:100,top:50,right:1000,bottom:650};figure.rect={left:300,top:100,width:300,height:500,bottom:600};doc.body.append(viewport);}
 let state=null,calls=[],writable=true,entries=fixtureOptions(),planShift=0;const preview=P.mount({document:doc,api:()=>state?{get:()=>state,options:()=>entries,plan:id=>{const p=fixturePlan(id,state);p.rotation[4]+=planShift;return p;},setAssembly:writable?function(id){calls.push(id);state.assembly=id;fire();}:undefined}:null,viewport,figure,fallbackFigure});preview.element.layoutHeight=350;preview.element.layoutWidth=342;
 const fire=()=>listeners.get('may-rombo-change')?.();
 return {preview,doc,fire,calls,frames,viewport,figure,fallbackFigure,setPlanShift(value){planShift=value;fire();},setOptions(value){entries=value;fire();},setWritable(value){writable=value;fire();},resize:()=>resize?.(),flush(){const pending=[...framesPending.values()];framesPending.clear();pending.forEach(fn=>fn());},pending:()=>framesPending.size,set(value){state=value;fire();},writes:()=>writes};
}
const navigation=h=>h.preview.element.children[2].children.filter(el=>el.tagName==='button');
const numberInput=h=>h.preview.element.children[2].children[1].children[0];
const cells=h=>h.preview.element.children[0].children;
const texts=el=>[...(el.tagName==='text'?[el.textContent]:[]),...el.children.flatMap(texts)];

test('runtime catalogue maps ordinal numbers to raw IDs and draws exact transformed plan outlines',()=>{
 const h=host(),state={on:true,assembly:16,angle:45,row:37};h.set(state);assert.equal(cells(h).length,10);assert.equal(numberInput(h).value,'9');assert.equal(numberInput(h).max,'10');
 ids.forEach((id,i)=>{const cell=cells(h)[i],svg=cell.children[1],g=P.geometry(fixturePlan(id,state));assert.equal(cell.children[0].textContent,String(i+1));assert.equal(svg.attributes.viewBox,g.viewBox.join(' '));assert.deepEqual(svg.children.filter(n=>n.tagName==='polygon').map(n=>n.attributes.points),g.parts.map(part=>part.points.map(p=>p.x+','+p.y).join(' ')));});
 assert.equal(h.preview.element.children[1].textContent,'Ось 37 · 45°');assert.equal(cells(h)[8].attributes['aria-pressed'],'true');
 const writes=h.writes();h.fire();assert.equal(h.writes(),writes);
});
test('dynamic catalogues rebuild without assumptions about count or raw ID continuity',()=>{
 const h=host();h.set({on:true,assembly:16,angle:0,row:37});h.setOptions([{id:17,label:'Кварталы',available:true},{id:16,label:'Центр',available:true}]);assert.equal(cells(h).length,2);assert.equal(numberInput(h).value,'2');assert.equal(numberInput(h).max,'2');assert.equal(numberInput(h).parent.children[1].textContent,'/2');
 cells(h)[0].event('click');assert.deepEqual(h.calls,[17]);assert.equal(numberInput(h).value,'1');
});
test('selection and numeric controls preserve axis and angle and skip unavailable entries',()=>{
 const h=host(),state={on:true,assembly:1,angle:135,row:37};h.set(state);const input=numberInput(h),buttons=navigation(h);
 input.value='9';input.event('change');assert.deepEqual(h.calls,[16]);assert.equal(input.value,'9');buttons[1].event('click');assert.equal(state.assembly,17);buttons[1].event('click');assert.equal(state.assembly,1);buttons[0].event('click');assert.equal(state.assembly,17);
 input.value='5';input.event('change');assert.equal(state.assembly,9);buttons[1].event('click');assert.equal(state.assembly,12);assert.equal(input.value,'7');
 const count=h.calls.length;input.value='6';input.event('change');assert.equal(h.calls.length,count);assert.equal(input.value,'7');assert.equal(cells(h)[5].disabled,true);assert.match(cells(h)[5].title,/Нет боковых/);cells(h)[5].event('click');assert.equal(h.calls.length,count);
 for(const draft of ['', 'invalid','Infinity']){input.value=draft;input.event('change');assert.equal(input.value,'7');assert.equal(h.calls.length,count);}
 assert.equal(state.angle,135);assert.equal(state.row,37);
});
test('every available atlas cell selects raw ID and exposes exactly one selected state',()=>{
 const h=host(),state={on:true,assembly:16,angle:315,row:41};h.set(state);
 for(let i=0;i<ids.length;i++){if(ids[i]===11)continue;const button=cells(h)[i];assert.equal(button.type,'button');button.event('click');assert.equal(h.calls.at(-1),ids[i]);assert.equal(cells(h).filter(n=>n.attributes['aria-pressed']==='true').length,1);assert.equal(numberInput(h).value,String(i+1));}
 const input=numberInput(h);input.value='9';const event=input.event('keydown',{key:'Enter'});assert.equal(event.prevented,true);assert.equal(event.stopped,true);assert.equal(state.assembly,16);assert.equal(state.angle,315);assert.equal(state.row,41);
});
test('delayed API, read-only API and hidden or disabled controls cannot change assembly',()=>{
 const h=host();assert.equal(h.preview.element.hidden,true);h.set({on:true,assembly:16,angle:0,row:37});h.setWritable(false);for(const control of [...cells(h),...navigation(h),numberInput(h)])assert.equal(control.disabled,true);for(const button of [...cells(h),...navigation(h)])button.event('click');assert.deepEqual(h.calls,[]);
 h.setWritable(true);h.set({on:false,assembly:16,angle:0,row:37});cells(h)[0].event('click');assert.deepEqual(h.calls,[]);h.set({on:true,assembly:16,angle:0,row:37});h.preview.element.hidden=true;cells(h)[0].event('click');assert.deepEqual(h.calls,[]);h.set(null);assert.equal(h.preview.element.hidden,true);h.preview.destroy();assert.equal(h.doc.body.children.length,0);
});
test('native buttons isolate field gestures without preventing Enter or Space activation',()=>{
 const h=host();h.set({on:true,assembly:16,angle:0,row:37});for(const button of [...navigation(h),...cells(h)])for(const type of ['pointerdown','pointerup','mousedown','mouseup','dblclick','contextmenu','keydown','keyup']){const event=button.event(type);assert.equal(event.stopped,true);assert.equal(event.prevented,type==='contextmenu'||type==='dblclick');}
});
test('scheme follows fractional zoom and rotated figure bounds below the field, then scrolls into view',()=>{
 const h=host(true),R={plan:()=>({outputHeight:80,outputWidth:100})};h.set({on:true,assembly:1,angle:0,row:37});
 for(const unit of [.125,1,2.75])for(const angle of [0,45,90,315]){
  const p=R.plan(100,80,{row:37,angle}),height=p.outputHeight*unit,width=p.outputWidth*unit;
  h.figure.rect={left:450-width/2,top:100,width,height,bottom:100+height};h.resize();h.resize();assert.equal(h.pending(),1);h.flush();
  assert.equal(h.preview.element.style.left,'450px');assert.equal(h.preview.element.style.top,(112+height)+'px');
  assert.equal(h.pending(),0);assert.equal(h.preview.scrollSpace(),374);
 }
 h.figure.rect={left:200,top:100,width:500,height:900,bottom:1000};h.resize();h.flush();
 assert.equal(h.preview.element.style.top,'1012px'); // No viewport-bottom clamp.
 h.figure.rect={...h.figure.rect,top:-500,bottom:400};h.viewport.event('scroll');h.flush();
 assert.equal(h.preview.element.style.top,'412px');assert.equal(h.preview.element.style.clipPath,'inset(0px 0px 112px 0px)');
 h.figure.rect={...h.figure.rect,top:-650,bottom:250};h.viewport.event('scroll');h.flush();assert.equal(h.preview.element.style.top,'262px');assert.equal(h.preview.element.style.clipPath,'inset(0px 0px 0px 0px)');
 const space=h.viewport.children[0];assert.equal(space.parent,h.viewport);assert.equal(h.preview.element.parent,h.doc.body);
 const rect=h.figure.rect;h.figure.rect={...rect,width:0};h.resize();h.flush();assert.equal(h.preview.element.style.visibility,'hidden');assert.equal(h.preview.scrollSpace(),0);
 h.figure.rect=rect;h.resize();h.flush();assert.equal(h.preview.element.style.visibility,'visible');assert.equal(h.preview.scrollSpace(),374);
 h.set({on:false,assembly:1,angle:0,row:37});h.flush();assert.equal(space.hidden,true);assert.equal(h.preview.scrollSpace(),0);assert.equal(h.preview.element.hidden,true);
 h.set({on:true,assembly:1,angle:0,row:37});h.flush();assert.equal(space.hidden,false);assert.equal(h.preview.element.style.visibility,'visible');
 h.preview.destroy();assert.equal(h.viewport.children.length,0);
});

test('fit centering excludes the whole trailer and keeps the original field anchor',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
 const code=html.match(/function fitCenterY\(\) \{[^\n]+\}/)[0];
 for(const content of [500,1000,2073.5]){
  const wrap={clientHeight:600,scrollHeight:Math.max(600,content),scrollTop:0},context={wrap,ovlLinked:()=>false,window:{}};vm.createContext(context);vm.runInContext(code+';fitCenterY();',context);const baseline=wrap.scrollTop;
  wrap.scrollHeight=Math.max(600,content+199);wrap.scrollTop=0;context.window.mayRomboPreview={scrollSpace:()=>199};vm.runInContext('fitCenterY();',context);assert.equal(wrap.scrollTop,baseline);
 }
});

test('compact rectangular atlas stays 4 columns wide at 320px without changing the field CSS',()=>{
 const fs=require('node:fs'),css=fs.readFileSync(__dirname+'/mayatnik-menu.css','utf8');
 const block=css.slice(css.indexOf('/* Compact 4-column assembly atlas;'),css.indexOf('body.may-mobile-menu .may-rombo-assembly-options::-webkit-scrollbar'));
 assert.match(block,/width:342px;max-width:calc\(100vw - 16px\)/);
 assert.match(block,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\);gap:2px/);
 assert.match(block,/cell>svg\{display:block;width:72px;max-width:100%;height:auto/);
 assert.equal(Math.min(342,320-16),304);
 assert.ok(4*72+3*2<=304);
 assert.doesNotMatch(block,/#mayCanvas|#canvas|#wrap|may-mobile-menu #mayRomboPreview\{/);
});

test('mobile atlas remains centered under the figure and viewport clipping follows horizontal panning',()=>{
 const h=host(true);h.preview.element.layoutWidth=304;h.viewport.rect={left:0,top:50,right:320,bottom:650};
 h.figure.rect={left:60,top:100,width:200,height:100,bottom:200};h.set({on:true,assembly:2,angle:45,row:37});h.flush();
 assert.equal(h.preview.element.style.left,'160px');assert.equal(h.preview.element.style.clipPath,'inset(0px 0px 0px 0px)');
 h.figure.rect={...h.figure.rect,left:0};h.viewport.event('scroll');h.flush();
 assert.equal(h.preview.element.style.left,'100px');assert.equal(h.preview.element.style.clipPath,'inset(0px 0px 0px 52px)');
 h.preview.element.layoutHeight=410;h.resize();h.flush();assert.equal(h.preview.scrollSpace(),434);
});

test('geometry composes production source masks with part and global transforms for every runtime variant',()=>{
 const R=require('./mayatnik-rombo.js');
 for(const variant of R.variants)for(const angle of [0,45,135,270]){
  const plan=R.plan(81,40,{row:31,angle,assembly:variant.id},{anchor:40,sides:true}),g=P.geometry(plan);
  assert.equal(g.parts.length,plan.parts.length);for(let i=0;i<plan.parts.length;i++){
   const part=plan.parts[i];assert.deepEqual(g.parts[i].points,part.outline.map(p=>R.point(plan.rotation,R.point(part.matrix,p))));
   for(const p of g.parts[i].points){assert.ok(p.x>=g.viewBox[0]&&p.x<=g.viewBox[0]+g.viewBox[2]);assert.ok(p.y>=g.viewBox[1]&&p.y<=g.viewBox[1]+g.viewBox[3]);}
  }
 }
 const p=P.geometry({parts:[{outline:[{x:1,y:2},{x:2,y:2},{x:1,y:3}],matrix:[-1,0,0,-1,10,20]}],rotation:[0,1,-1,0,4,5]});assert.deepEqual(p.parts[0].points,[{x:-14,y:14},{x:-14,y:13},{x:-13,y:14}]);
});

test('large source outlines avoid variadic bounds limits',()=>{
 const outline=Array.from({length:150000},(_,i)=>({x:i%1000,y:Math.floor(i/1000)})),g=P.geometry({parts:[{outline,matrix:[1,0,0,1,0,0]}]});assert.equal(g.parts[0].points.length,150000);assert.ok(g.viewBox.every(Number.isFinite));assert.equal(g.viewBox[2],999*1.07);
});
test('geometry-only changes refresh SVG even when get state and options are unchanged',()=>{
 const h=host();h.set({on:true,assembly:16,angle:0,row:37});const polygon=cells(h)[8].children[1].children[0].attributes.points;h.setPlanShift(20);assert.notEqual(cells(h)[8].children[1].children[0].attributes.points,polygon);assert.match(cells(h)[8].children[1].children[0].attributes.points,/25,0/);
});
test('unavailable side assembly keeps table below visible source and lets available central variant recover it',()=>{
 const h=host(true,true);h.figure.rect={left:0,top:0,width:0,height:0,bottom:0};h.set({on:true,assembly:11,angle:0,row:37,available:false,reason:'Нет боковых частей'});h.flush();assert.equal(h.preview.element.style.visibility,'visible');assert.equal(h.preview.element.style.left,'200px');assert.equal(h.preview.element.style.top,'412px');assert.equal(h.preview.scrollSpace(),374);assert.match(h.preview.element.children[1].textContent,/Нет боковых/);assert.equal(cells(h)[5].disabled,true);assert.equal(cells(h)[8].disabled,false);cells(h)[8].event('click');assert.equal(h.calls.at(-1),16);
});
