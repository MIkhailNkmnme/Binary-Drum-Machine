const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('./mayatnik-rombo-preview.js');

function host(layout=false){
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
  event(type){const event={type,stopped:false,prevented:false,stopPropagation(){this.stopped=true;},preventDefault(){this.prevented=true;}};for(const fn of this.listeners.get(type)||[])fn(event);return event;}
  remove(){this.parent.children=this.parent.children.filter(el=>el!==this);}
 }
 const frames=[],win={addEventListener(type,fn){listeners.set(type,fn);},removeEventListener(type){listeners.delete(type);},ZerkControlFrame:{attach(...args){frames.push(args);}},requestAnimationFrame(fn){framesPending.set(++frameId,fn);return frameId;},cancelAnimationFrame(id){framesPending.delete(id);},ResizeObserver:class{constructor(fn){resize=fn;}observe(){}disconnect(){resize=null;}}};
 const doc={defaultView:win,body:new Element('body'),createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag)};
 const viewport=layout?new Element('viewport'):null,figure=layout?new Element('canvas'):null;
 if(layout){viewport.rect={left:100,top:50,right:1000,bottom:650};figure.rect={left:300,top:100,width:300,height:500,bottom:600};doc.body.append(viewport);}
 let state=null,calls=[];const preview=P.mount({document:doc,api:()=>state?{get:()=>state,setAssembly(id){calls.push(id);state.assembly=id;fire();}}:null,viewport,figure});preview.element.layoutHeight=175;
 const fire=()=>listeners.get('may-rombo-change')?.();
 return {preview,doc,fire,calls,frames,viewport,figure,resize:()=>resize?.(),flush(){const pending=[...framesPending.values()];framesPending.clear();pending.forEach(fn=>fn());},pending:()=>framesPending.size,set(value){state=value;fire();},writes:()=>writes};
}
const navigation=h=>h.preview.element.children[1].children.filter(el=>el.tagName==='button');
const numberInput=h=>h.preview.element.children[1].children[1].children[0];
const texts=el=>[...(el.tagName==='text'?[el.textContent]:[]),...el.children.flatMap(texts)];

test('all atlas assemblies retain slot order, duplicate parts, colours and independent flip markers',()=>{
 const expected=['L','R','L↔','R↔'],h=host();
 for(let id=0;id<16;id++){
  h.set({on:true,assembly:id,angle:0,row:512});
  const svg=h.preview.element.children[0],turned=svg.children[1],slots=[Math.floor(id/4),id%4];
  assert.equal(h.preview.element.hidden,false);
  assert.equal(texts(svg)[0],`Сборка ${id+1} · ${expected[slots[0]]} | ${expected[slots[1]]}`);
  assert.deepEqual(texts(turned),['C',...slots.map(i=>expected[i])]);
  assert.deepEqual(turned.children.filter(el=>el.tagName==='g').map(el=>el.attributes.transform),slots.map((slot,i)=>`translate(${i?18:-18} 25) scale(${slot>=2?-1:1} 1)`));
  assert.deepEqual(turned.children.filter(el=>el.tagName==='path').slice(0,3).map(el=>el.attributes.fill),['#e5be68',...slots.map(i=>i%2?'#d99bc9':'#78b8e8')]);
 }
});

test('angle matches the rendered Rombo plan, rotating the axis and orientation arrows together',()=>{
 const R=require('./mayatnik-rombo.js'),h=host();
 for(const angle of [-45,0,45,90,135,180,225,270,315,360,17,44]){
  h.set({on:true,assembly:6,angle,row:37});const actual=R.plan(9,100,{angle,row:37,assembly:6}).angle;
  const svg=h.preview.element.children[0];assert.equal(svg.children[1].attributes.transform,`translate(82 86) rotate(${actual})`);
  assert.equal(texts(svg).at(-1),`Ось 37 · ${actual}°`);
  assert.match(h.preview.element.attributes['aria-label'],new RegExp(`Поворот ${actual}°`));
 }
});

test('unavailable API, delayed load, disable, import/reset and unchanged events update without polling',()=>{
 const h=host();assert.equal(h.preview.element.hidden,true);
 h.set({on:true,assembly:15,angle:90,row:8});assert.equal(h.preview.element.hidden,false);
 const writes=h.writes();h.fire();assert.equal(h.writes(),writes);
 h.set({on:false,assembly:15,angle:90,row:8});assert.equal(h.preview.element.hidden,true);
 h.set({on:true,assembly:1,angle:0,row:512});assert.equal(h.preview.element.hidden,false);
 assert.equal(texts(h.preview.element).at(-1),'Ось 512 · 0°');
 h.set(null);assert.equal(h.preview.element.hidden,true);
 h.set({on:true,assembly:1,angle:0,row:512});assert.equal(h.preview.element.hidden,false);
 h.preview.destroy();assert.equal(h.doc.body.children.length,0);
});

test('visible previous/next buttons wrap all assemblies through the API and preserve axis and angle',()=>{
 const h=host(),buttons=navigation(h),state={on:true,assembly:0,angle:135,row:37};h.set(state);
 const number=numberInput(h);assert.equal(h.frames.length,1);assert.equal(h.frames[0][4].input,number);
 assert.equal(number.value,'1');
 assert.ok(buttons.every(button=>button.tagName==='button'&&button.type==='button'&&!button.disabled));
 for(let i=0;i<16;i++){buttons[0].event('click');assert.equal(state.assembly,(15-i+16)%16);assert.equal(number.value,String(state.assembly+1));}
 assert.equal(state.assembly,0);
 for(let i=0;i<16;i++){buttons[1].event('click');assert.equal(state.assembly,(i+1)%16);assert.equal(number.value,String(state.assembly+1));}
 assert.equal(state.angle,135);assert.equal(state.row,37);assert.equal(h.calls.length,32);
 assert.equal(texts(h.preview.element)[0],'Сборка 1 · L | L');
});

test('numeric entry applies 1..16, clamps finite values, and restores blank or invalid drafts',()=>{
 const h=host(),state={on:true,assembly:3,angle:225,row:91};h.set(state);const input=numberInput(h);
 for(let n=1;n<=16;n++){input.value=String(n);input.event('change');assert.equal(state.assembly,n-1);assert.equal(input.value,String(n));}
 for(const [draft,expected]of [['0',1],['20',16],['3.7',4]]){input.value=draft;input.event('change');assert.equal(input.value,String(expected));assert.equal(state.assembly,expected-1);}
 const before=h.calls.length;for(const draft of ['', 'invalid','Infinity']){input.value=draft;input.event('change');assert.equal(input.value,'4');assert.equal(h.calls.length,before);}
 assert.equal(state.angle,225);assert.equal(state.row,91);
 h.set({on:false,assembly:3,angle:225,row:91});input.value='8';input.event('change');assert.equal(h.calls.length,before);
});

test('off, hidden and unavailable preview never changes the assembly',()=>{
 const h=host(),buttons=navigation(h);
 assert.ok(buttons.every(button=>button.disabled));buttons[0].event('click');assert.deepEqual(h.calls,[]);
 h.set({on:false,assembly:4,angle:90,row:8});buttons[1].event('click');assert.deepEqual(h.calls,[]);
 h.set({on:true,assembly:4,angle:90,row:8});h.preview.element.hidden=true;buttons[1].event('click');assert.deepEqual(h.calls,[]);
 h.set(null);buttons[1].event('click');assert.deepEqual(h.calls,[]);
});

test('navigation isolates field gestures and keeps native keyboard activation',()=>{
 const h=host();h.set({on:true,assembly:1,angle:0,row:8});
 for(const button of navigation(h)){
  for(const type of ['pointerdown','pointerup','mousedown','mouseup','dblclick','contextmenu','keydown','keyup']){
   const event=button.event(type);assert.equal(event.stopped,true,type);assert.equal(event.prevented,type==='contextmenu'||type==='dblclick',type);
  }
  const before=h.calls.length,event=button.event('click');assert.equal(event.stopped,true);assert.equal(h.calls.length,before+1);
 }
});

test('scheme follows fractional zoom and rotated figure bounds below the field, then scrolls into view',()=>{
 const h=host(true),R=require('./mayatnik-rombo.js');h.set({on:true,assembly:1,angle:0,row:37});
 for(const unit of [.125,1,2.75])for(const angle of [0,45,90,315]){
  const p=R.plan(100,80,{row:37,angle}),height=p.outputHeight*unit,width=p.outputWidth*unit;
  h.figure.rect={left:450-width/2,top:100,width,height,bottom:100+height};h.resize();h.resize();assert.equal(h.pending(),1);h.flush();
  assert.equal(h.preview.element.style.left,'450px');assert.equal(h.preview.element.style.top,(112+height)+'px');
  assert.equal(h.pending(),0);assert.equal(h.preview.scrollSpace(),199);
 }
 h.figure.rect={left:200,top:100,width:500,height:900,bottom:1000};h.resize();h.flush();
 assert.equal(h.preview.element.style.top,'1012px'); // No viewport-bottom clamp.
 h.figure.rect={...h.figure.rect,top:-500,bottom:400};h.viewport.event('scroll');h.flush();
 assert.equal(h.preview.element.style.top,'412px');assert.equal(h.preview.element.style.clipPath,'inset(0px 0px 0px 0px)');
 const space=h.viewport.children[0];assert.equal(space.parent,h.viewport);assert.equal(h.preview.element.parent,h.doc.body);
 const rect=h.figure.rect;h.figure.rect={...rect,width:0};h.resize();h.flush();assert.equal(h.preview.element.style.visibility,'hidden');assert.equal(h.preview.scrollSpace(),0);
 h.figure.rect=rect;h.resize();h.flush();assert.equal(h.preview.element.style.visibility,'visible');assert.equal(h.preview.scrollSpace(),199);
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
