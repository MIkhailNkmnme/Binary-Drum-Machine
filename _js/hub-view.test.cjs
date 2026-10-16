const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture(saved = {}) {
  const raf=new Map();let nextRaf=0;
  const elements = [], listeners = {}, windowListeners = {}, storage = new Map([['zerk_hub_view', JSON.stringify(saved)]]);
  const element = () => {
    const e = {style:{},dataset:{},children:[],offsetLeft:0,offsetTop:0,attributes:{},classList:{add(){},toggle(name,value){this[name]=value;}},
      append(...items){this.children.push(...items);},setAttribute(k,v){this.attributes[k]=v;},addEventListener(){}};
    elements.push(e); return e;
  };
  const settings = element();
  let mirrorHomes = 0;
  const document = {hidden:false,body:element(),createElement:element,createTextNode:text=>({textContent:text}),
    querySelector:s=>s==='.hubMirrorSettings'?settings:null,querySelectorAll:()=>[],
    addEventListener:(name,fn)=>(listeners[name] ||= []).push(fn)};
  const window = {HubMirror:{state:{},home(){mirrorHomes++;}},addEventListener:(name,fn)=>(windowListeners[name] ||= []).push(fn),
    dispatchEvent:e=>(windowListeners[e.type]||[]).forEach(fn=>fn(e))};
  vm.runInNewContext(fs.readFileSync(__dirname+'/hub-view.js','utf8'),{document,window,
    localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},innerWidth:1200,innerHeight:800,scrollY:0,
    matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>{const id=++nextRaf;raf.set(id,fn);return id;},cancelAnimationFrame:id=>raf.delete(id),Event:class{constructor(type){this.type=type;}},
    CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}}});
  listeners.DOMContentLoaded.forEach(fn=>fn()); window.HubView.place(300,900,800);
  return {window,bodyClass:name=>document.body.classList[name]===true,emit(name,event){for(const fn of listeners[name]||[])fn(event);},tick(time){const pending=[...raf.values()];raf.clear();pending.forEach(fn=>fn(time));},button:label=>elements.find(e=>e.attributes['aria-label']===label),state:()=>JSON.parse(storage.get('zerk_hub_view')),
    homes:()=>mirrorHomes,wheel(overMenu=false){const event={target:{closest:()=>overMenu},clientX:750,clientY:400,deltaY:-120,preventDefault(){this.prevented=true;}};listeners.wheel.forEach(fn=>fn(event));return event;}};
}

test('closed drag lock permits wheel and both zoom buttons',()=>{
  const f=fixture({unlocked:false});
  assert.equal(f.window.HubView.unlocked,false);
  assert.equal(f.button('Увеличить масштаб холста').disabled,false);
  assert.equal(f.wheel().prevented,true);
  assert.ok(f.window.HubView.scale>1);
  f.button('Увеличить масштаб холста').onclick();
  const before=f.window.HubView.scale;
  f.button('Уменьшить масштаб холста').onclick();
  assert.ok(f.window.HubView.scale<before);
  assert.equal(f.window.HubView.unlocked,false);
});

test('menu wheel remains scrolling rather than changing the field',()=>{
  const f=fixture();assert.equal(f.wheel(true).prevented,undefined);assert.equal(f.window.HubView.scale,1);
});

test('home recovers saved offscreen drawing, source displacement, rotation and edge-on 3D',()=>{
  const f=fixture({zoom:6,angle:54,flip:90,pan:[9000,-8000],sourcePan:[12,7],unlocked:false,flipRate:1000});
  assert.ok(f.window.HubView.inverse(750,400).some(v=>!Number.isFinite(v)));
  f.button('Переворот вокруг оси зеркала в 3D').onclick();
  f.button('Вернуть весь рисунок в поле').onclick();
  const state=f.state();
  assert.deepEqual([state.zoom,state.angle,state.flip,state.pan,state.sourcePan],[1,0,0,[0,0],[0,0]]);
  assert.equal(state.flipRate,1000);assert.equal(state.unlocked,false);assert.equal(f.homes(),1);
  assert.deepEqual(Array.from(f.window.HubView.inverse(750,400)),[750,400]);
  assert.equal(f.button('Переворот вокруг оси зеркала в 3D').attributes['aria-pressed'],'false');
});

test('displaced rows return through the final camera without an intermediate viewport crop',()=>{
  const f=fixture({zoom:.2,sourcePan:[0,-.5]}),draws=[];
  const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
  let current=[1,0,0,1,0,0];
  const raw={width:1200,height:800},g={save(){},restore(){},clearRect(){},setTransform(...m){current=m;},transform(...m){current=multiply(current,m);},drawImage(image,x,y){assert.equal(image,raw);const px=750+x,py=140+y;draws.push([current[0]*px+current[2]*py+current[4],current[1]*px+current[3]*py+current[5]]);}};
  f.window.HubMirror.matrix=()=>[1,0,0,-1,0,800];
  f.window.HubView.paint({width:1200,height:800,getContext:()=>g},null,raw);
  // The original row was moved to y=-260 before the camera. Both copies are still visible.
  assert.equal(draws.length,2);assert.deepEqual(draws,[[750,268],[750,532]]);
});

function realMirror(f) {
  const document={readyState:'loading',addEventListener(){}};
  vm.runInNewContext(fs.readFileSync(__dirname+'/hub-mirror.js','utf8'),{window:f.window,document,
    localStorage:{getItem:()=>null,setItem(){}},cancelAnimationFrame(){},Event:class{constructor(type){this.type=type;}}});
  f.window.HubMirror.place(300,900,800);return f.window.HubMirror;
}
function screenPoint(view,x,y) {
  const el={id:'hubMirror',dataset:{},offsetLeft:0,offsetTop:0,style:{}};view.apply(el);
  const m=el.style.transform.slice(7,-1).split(',').map(Number);
  return [m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
}
const near=(a,b)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-7,`${a} != ${b}`));
test('axis rotation turns original around its fixed pivot with reflection on or off',()=>{
 for(const on of [false,true]) {
  const f=fixture({zoom:1.7,angle:23,pan:[47,-31],sourcePan:[.1,.1]}),mirror=realMirror(f),view=f.window.HubView;
  mirror.state.on=on;mirror.state.x=.37;mirror.state.y=.62;
  const pivot=on?[300+900*.37,800*.62]:Array.from(view.originalCenter()),before=screenPoint(view,...pivot),point=screenPoint(view,pivot[0]+70,pivot[1]-45);
  const inverse=view.captureInverse(),local=Array.from(inverse(...point));
  mirror.rotateBy(Math.PI/2);
  near(screenPoint(view,...pivot),before);
  near(screenPoint(view,pivot[0]+70,pivot[1]-45),[before[0]-(point[1]-before[1]),before[1]+point[0]-before[0]]);
  near(Array.from(inverse(...point)),local);
  assert.equal(f.state().angle,113);assert.equal(mirror.state.on,on);
 }
});
test('moving the enabled mirror axis carries the original by the same clamped displacement',()=>{
 const f=fixture(),mirror=realMirror(f);
 const start=mirror.position();mirror.moveFrom(start,90,-80);
 near(Array.from(f.window.HubView.sourceShift()),[90,-80]);
 mirror.moveFrom(start,9000,-8000);
 near(Array.from(f.window.HubView.sourceShift()),[(.99-start.x)*900,(.01-start.y)*800]);
});

test('auto rotation follows last step direction and keeps the shifted triangle centroid stationary',()=>{
 const f=fixture({sourcePan:[.1,.2]}),v=f.window.HubView;v.setSourceCenter(680,480);
 const pivot=[770,640],before=screenPoint(v,...pivot);
 f.button('Повернуть поле на −15°').onclick();near(screenPoint(v,...pivot),before);
 f.button('Автокручение треугольника').onclick();f.tick(0);f.tick(1000);
 near(screenPoint(v,...pivot),before);
 f.button('Автокручение треугольника').onclick();assert.equal(f.state().angle,255);
 assert.equal(f.state().spinDirection,-1);
 f.button('Повернуть поле на +15°').onclick();f.button('Автокручение треугольника').onclick();f.tick(2000);f.tick(3000);
 f.button('Автокручение треугольника').onclick();near(screenPoint(v,...pivot),before);assert.equal(f.state().angle,0);
});
test('thousands of revolutions use elapsed time and fractional phase, not thousands of render steps',()=>{
 const f=fixture(),v=f.window.HubView;v.setSourceCenter(670,510);
 const rate=f.button('Скорость автокручения в оборотах в секунду');rate.valueAsNumber=1000.25;rate.onchange();
 f.button('Автокручение треугольника').onclick();f.tick(0);f.tick(1000);f.button('Автокручение треугольника').onclick();
 assert.ok(Math.abs(f.state().angle-90)<1e-7);assert.equal(f.state().spinRate,1000.25);
 const before=screenPoint(v,730,510);f.tick(2000);near(screenPoint(v,730,510),before);
 rate.valueAsNumber=50000;rate.onchange();assert.equal(f.state().spinRate,10000);
 f.button('Автокручение треугольника').onclick();f.tick(3000);f.tick(3016.025);f.button('Автокручение треугольника').onclick();
 assert.ok(Math.abs(f.state().angle-180)<1e-6);
});


test('dragging overlapping original and reflection moves the source once',()=>{
  const f=fixture({unlocked:true});realMirror(f);
  f.window.HubMirror.hit=()=>({source:true,mirror:true});
  const event={target:{closest:()=>null},button:0,pointerId:1,clientX:750,clientY:400,stopPropagation(){}};
  assert.equal(f.window.HubView.grabBits(event,true),true);
  f.emit('pointermove',{pointerId:1,clientX:790,clientY:420});
  assert.ok(Math.abs(f.state().sourcePan[0]-40/900)<1e-10);
  assert.ok(Math.abs(f.state().sourcePan[1]-20/800)<1e-10);
});


test('disabled mirror axis stays at source centroid and ignores translation',()=>{
 const f=fixture({sourcePan:[.1,.2],angle:25,pan:[42,17]}),mirror=realMirror(f),view=f.window.HubView;
 view.setSourceCenter(680,480);const before=screenPoint(view,770,640);
 mirror.state.on=false;mirror.syncCenter();
 near([300+900*mirror.state.x,800*mirror.state.y],[770,640]);
 near(screenPoint(view,770,640),before);
 mirror.moveFrom(mirror.position(),200,-100);
 near(Array.from(view.sourceShift()),[90,160]);
 near([300+900*mirror.state.x,800*mirror.state.y],[770,640]);
 view.shiftSourceBy(25,30);
 near([300+900*mirror.state.x,800*mirror.state.y],[795,670]);
 view.setSourceCenter(700,500);
 near([300+900*mirror.state.x,800*mirror.state.y],[815,690]);
});

test('automatic rotation hides axis until stopped or reset',()=>{
 const f=fixture(),auto=f.button('Автокручение треугольника');
 assert.equal(f.bodyClass('hubAutoTurning'),false);
 auto.onclick();assert.equal(f.bodyClass('hubAutoTurning'),true);
 auto.onclick();assert.equal(f.bodyClass('hubAutoTurning'),false);
 auto.onclick();f.button('Вернуть весь рисунок в поле').onclick();
 assert.equal(f.bodyClass('hubAutoTurning'),false);
});
