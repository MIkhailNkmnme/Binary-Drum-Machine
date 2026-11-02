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
  event(type,extra={}){const event={type,...extra,stopped:false,prevented:false,stopPropagation(){this.stopped=true;},preventDefault(){this.prevented=true;}};for(const fn of this.listeners.get(type)||[])fn(event);return event;}
  remove(){this.parent.children=this.parent.children.filter(el=>el!==this);}
 }
 const frames=[],win={addEventListener(type,fn){listeners.set(type,fn);},removeEventListener(type){listeners.delete(type);},ZerkControlFrame:{attach(...args){frames.push(args);}},requestAnimationFrame(fn){framesPending.set(++frameId,fn);return frameId;},cancelAnimationFrame(id){framesPending.delete(id);},ResizeObserver:class{constructor(fn){resize=fn;}observe(){}disconnect(){resize=null;}}};
 const doc={defaultView:win,body:new Element('body'),createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag)};
 const viewport=layout?new Element('viewport'):null,figure=layout?new Element('canvas'):null;
 if(layout){viewport.rect={left:100,top:50,right:1000,bottom:650};figure.rect={left:300,top:100,width:300,height:500,bottom:600};doc.body.append(viewport);}
 let state=null,calls=[],writable=true;const preview=P.mount({document:doc,api:()=>state?{get:()=>state,setAssembly:writable?function(id){calls.push(id);state.assembly=id;fire();}:undefined}:null,viewport,figure});preview.element.layoutHeight=350;preview.element.layoutWidth=342;
 const fire=()=>listeners.get('may-rombo-change')?.();
 return {preview,doc,fire,calls,frames,viewport,figure,setWritable(value){writable=value;fire();},resize:()=>resize?.(),flush(){const pending=[...framesPending.values()];framesPending.clear();pending.forEach(fn=>fn());},pending:()=>framesPending.size,set(value){state=value;fire();},writes:()=>writes};
}
const navigation=h=>h.preview.element.children[2].children.filter(el=>el.tagName==='button');
const numberInput=h=>h.preview.element.children[2].children[1].children[0];
const cells=h=>h.preview.element.children[0].children;
const texts=el=>[...(el.tagName==='text'?[el.textContent]:[]),...el.children.flatMap(texts)];

test('4x4 atlas contains all 16 assemblies with slot order, duplicate parts, colours and independent flip markers',()=>{
 const expected=['L','R','L↔','R↔'],h=host();h.set({on:true,assembly:0,angle:0,row:512});
 assert.equal(cells(h).length,16);
 for(let id=0;id<16;id++){
  const cell=cells(h)[id],svg=cell.children[1],turned=svg.children[0],slots=[Math.floor(id/4),id%4];
  assert.equal(cell.children[0].textContent,`${id+1} · ${expected[slots[0]]} | ${expected[slots[1]]}`);
  assert.deepEqual(texts(turned),['C',...slots.map(i=>expected[i])]);
  assert.deepEqual(turned.children.filter(el=>el.tagName==='g').map(el=>el.attributes.transform),slots.map((slot,i)=>`translate(${i?18:-18} 25) scale(${slot>=2?-1:1} 1)`));
  assert.deepEqual(turned.children.filter(el=>el.tagName==='path').slice(0,3).map(el=>el.attributes.fill),['#e5be68',...slots.map(i=>i%2?'#d99bc9':'#78b8e8')]);
  assert.equal(svg.attributes.viewBox,'0 0 128 128');
 }
});

test('every atlas button selects exactly one assembly through API without changing axis or angle',()=>{
 const h=host(),state={on:true,assembly:0,angle:135,row:37};h.set(state);
 for(let id=0;id<16;id++){
  const button=cells(h)[id];assert.equal(button.type,'button');assert.equal(button.tagName,'button');assert.equal(button.disabled,false);
  const before=h.calls.length;button.event('click');assert.equal(h.calls.length,before+1);assert.equal(h.calls.at(-1),id);assert.equal(state.assembly,id);
  assert.equal(state.angle,135);assert.equal(state.row,37);assert.equal(numberInput(h).value,String(id+1));
  assert.equal(cells(h).filter(cell=>cell.attributes['aria-pressed']==='true').length,1);assert.equal(button.attributes['aria-pressed'],'true');
 }
 h.set({on:true,assembly:13,angle:270,row:91});assert.equal(cells(h)[13].attributes['aria-pressed'],'true');assert.equal(cells(h)[15].attributes['aria-pressed'],'false');
});

test('all miniature axes and arrows rotate with the rendered Rombo plan; footer is shared',()=>{
 const R=require('./mayatnik-rombo.js'),h=host();
 for(const angle of [-45,0,45,90,135,180,225,270,315,360,17,44]){
  h.set({on:true,assembly:6,angle,row:37});const actual=R.plan(9,100,{angle,row:37,assembly:6}).angle;
  for(const cell of cells(h))assert.equal(cell.children[1].children[0].attributes.transform,`translate(64 64) rotate(${actual})`);
  assert.equal(h.preview.element.children[1].textContent,`Ось 37 · ${actual}°`);
  assert.match(h.preview.element.attributes['aria-label'],new RegExp(`Поворот ${actual}°`));
 }
});

test('unavailable API, delayed load, disable, import/reset and unchanged events update without polling',()=>{
 const h=host();assert.equal(h.preview.element.hidden,true);
 h.set({on:true,assembly:15,angle:90,row:8});assert.equal(h.preview.element.hidden,false);
 const writes=h.writes();h.fire();assert.equal(h.writes(),writes);
 h.set({on:false,assembly:15,angle:90,row:8});assert.equal(h.preview.element.hidden,true);
 h.set({on:true,assembly:1,angle:0,row:512});assert.equal(h.preview.element.hidden,false);
 assert.equal(h.preview.element.children[1].textContent,'Ось 512 · 0°');
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
 assert.equal(cells(h)[0].children[0].textContent,'1 · L | L');
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
 const h=host(),buttons=[...navigation(h),...cells(h)];
 assert.ok(buttons.every(button=>button.disabled));buttons[0].event('click');assert.deepEqual(h.calls,[]);
 h.set({on:false,assembly:4,angle:90,row:8});buttons[1].event('click');assert.deepEqual(h.calls,[]);
 h.set({on:true,assembly:4,angle:90,row:8});h.preview.element.hidden=true;buttons[1].event('click');assert.deepEqual(h.calls,[]);
 h.set(null);buttons[1].event('click');assert.deepEqual(h.calls,[]);
});

test('read-only API disables every atlas cell and the numeric frame',()=>{
 const h=host();h.set({on:true,assembly:7,angle:45,row:91});h.setWritable(false);
 for(const element of [...cells(h),...navigation(h),numberInput(h)])assert.equal(element.disabled,true);
 for(const button of [...cells(h),...navigation(h)])button.event('click');
 assert.deepEqual(h.calls,[]);assert.equal(h.preview.element.hidden,false);
 h.setWritable(true);assert.ok(cells(h).every(cell=>!cell.disabled));cells(h)[5].event('click');assert.deepEqual(h.calls,[5]);
});

test('navigation isolates field gestures and keeps native keyboard activation',()=>{
 const h=host();h.set({on:true,assembly:1,angle:0,row:8});
 for(const button of [...navigation(h),...cells(h)]){
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

// CSS-only geometry is intentionally isolated from the large field and its transforms.
test('compact rectangular atlas stays 4 columns wide at 320px without changing the field CSS',()=>{
 const fs=require('node:fs'),css=fs.readFileSync(__dirname+'/mayatnik-menu.css','utf8');
 const block=css.slice(css.indexOf('/* Compact 4x4 assembly atlas;'),css.indexOf('body.may-mobile-menu .may-rombo-assembly-options::-webkit-scrollbar'));
 assert.match(block,/width:342px;max-width:calc\(100vw - 16px\)/);
 assert.match(block,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\);gap:2px/);
 assert.match(block,/cell>svg\{display:block;width:72px;max-width:100%;height:auto/);
 assert.equal(Math.min(342,320-16),304);
 assert.ok(4*72+3*2<=304);
 assert.doesNotMatch(block,/#mayCanvas|#canvas|#wrap|may-mobile-menu #mayRomboPreview\{/);
});

test('all rotated diagram geometry fits the square SVG, including the longest dashed axis',()=>{
 for(const angle of [0,45,90,135,180,225,270,315]){
  const a=angle*Math.PI/180;
  for(const [x,y]of [[-59,0],[59,0],[0,-44],[0,44],[-54,0],[54,0]]){
   assert.ok(Math.abs(x*Math.cos(a)-y*Math.sin(a))<=64);
   assert.ok(Math.abs(x*Math.sin(a)+y*Math.cos(a))<=64);
  }
 }
});

test('numeric Enter applies once and blocks the field keyboard shortcut',()=>{
 const h=host(),state={on:true,assembly:0,angle:315,row:41};h.set(state);const input=numberInput(h);input.value='16';
 const event=input.event('keydown',{key:'Enter'});assert.equal(event.stopped,true);assert.equal(event.prevented,true);
 assert.deepEqual(h.calls,[15]);assert.equal(state.angle,315);assert.equal(state.row,41);
});

test('mobile atlas remains centered under the figure and viewport clipping follows horizontal panning',()=>{
 const h=host(true);h.preview.element.layoutWidth=304;h.viewport.rect={left:0,top:50,right:320,bottom:650};
 h.figure.rect={left:60,top:100,width:200,height:100,bottom:200};h.set({on:true,assembly:2,angle:45,row:37});h.flush();
 assert.equal(h.preview.element.style.left,'160px');assert.equal(h.preview.element.style.clipPath,'inset(0px 0px 0px 0px)');
 h.figure.rect={...h.figure.rect,left:0};h.viewport.event('scroll');h.flush();
 assert.equal(h.preview.element.style.left,'100px');assert.equal(h.preview.element.style.clipPath,'inset(0px 0px 0px 52px)');
 h.preview.element.layoutHeight=410;h.resize();h.flush();assert.equal(h.preview.scrollSpace(),434);
});
