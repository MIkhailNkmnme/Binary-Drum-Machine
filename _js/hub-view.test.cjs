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
test('disabled axis rotates original around its centroid',()=>{
 const f=fixture({zoom:1.7,angle:23,pan:[47,-31],sourcePan:[.1,.1]}),mirror=realMirror(f),view=f.window.HubView;
 mirror.state.on=false;const pivot=Array.from(view.originalCenter()),before=screenPoint(view,...pivot),point=screenPoint(view,pivot[0]+70,pivot[1]-45);
 const inverse=view.captureInverse(),local=Array.from(inverse(...point));
 mirror.rotateBy(Math.PI/2);
 near(screenPoint(view,...pivot),before);
 near(screenPoint(view,pivot[0]+70,pivot[1]-45),[before[0]-(point[1]-before[1]),before[1]+point[0]-before[0]]);
 near(Array.from(inverse(...point)),local);assert.equal(f.state().angle,113);
});

test('enabled axis moves and rotates reflection while original remains fixed',()=>{
 const f=fixture({zoom:1.7,angle:23,pan:[47,-31],sourcePan:[.1,.1]}),mirror=realMirror(f),view=f.window.HubView;
 mirror.state.angle=Math.PI/2;const start=mirror.position(),original=screenPoint(view,840,480),reflected=Array.from(mirror.point(750,400));
 mirror.moveFrom(start,90,-80);
 near(Array.from(view.sourceShift()),[90,80]);near(screenPoint(view,840,480),original);
 near(Array.from(mirror.point(750,400)),[reflected[0]+180,reflected[1]]);
 mirror.rotateBy(Math.PI/2);
 near(screenPoint(view,840,480),original);near(Array.from(view.sourceShift()),[90,80]);
 assert.notDeepEqual(Array.from(mirror.point(750,400)),[reflected[0]+180,reflected[1]]);
 mirror.moveFrom(start,9000,-8000);assert.equal(mirror.state.x,.99);assert.equal(mirror.state.y,.01);
 near(screenPoint(view,840,480),original);
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
 f.tick(0);f.tick(1000);f.button('Автокручение треугольника').onclick();
 assert.ok(Math.abs(f.state().angle-90)<1e-7);assert.equal(f.state().spinRate,1000.25);
 const before=screenPoint(v,730,510);f.tick(2000);near(screenPoint(v,730,510),before);
 rate.valueAsNumber=50000;rate.onchange();assert.equal(f.state().spinRate,10000);
 f.tick(3000);f.tick(3016.025);f.button('Автокручение треугольника').onclick();
 assert.ok(Math.abs(f.state().angle-180)<1e-6);
});


test('dragging overlapping original and reflection moves the complete field with its axis',()=>{
  const f=fixture({unlocked:true});realMirror(f);
  f.window.HubMirror.hit=()=>({source:true,mirror:true});
  const event={target:{closest:()=>null},button:0,pointerId:1,clientX:750,clientY:400,stopPropagation(){}};
  assert.equal(f.window.HubView.grabBits(event,true),true);
  f.emit('pointermove',{pointerId:1,clientX:790,clientY:420});
  assert.deepEqual(f.state().sourcePan,[0,0]);
  assert.deepEqual(f.state().pan,[40,20]);assert.equal(f.window.HubMirror.state.x,.5);assert.equal(f.window.HubMirror.state.y,.5);
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


test('slider starts rotation above zero and zero stops without losing the last speed',()=>{
 const f=fixture(),range=f.button('Шкала скорости автокручения'),toggle=f.button('Автокручение треугольника');
 assert.equal(Number(range.value),0);range.value=201;range.oninput();
 assert.equal(f.bodyClass('hubAutoTurning'),true);assert.equal(f.state().spinRate,1);
 f.tick(0);f.tick(250);range.value=0;range.oninput();
 assert.equal(f.bodyClass('hubAutoTurning'),false);assert.equal(Number(range.value),0);assert.equal(f.state().angle,0);
 f.tick(1000);assert.equal(f.state().angle,0);
 toggle.onclick();assert.equal(f.bodyClass('hubAutoTurning'),true);assert.equal(f.state().spinRate,1);
 range.value=601;range.oninput();assert.equal(f.state().spinRate,10000);
});


test('pause preserves selected speed and angle, resume continues from that angle',()=>{
 const f=fixture(),range=f.button('Шкала скорости автокручения'),toggle=f.button('Автокручение треугольника');
 range.value=201;range.oninput();f.tick(0);f.tick(250);toggle.onclick();
 assert.equal(f.bodyClass('hubAutoTurning'),false);assert.equal(Number(range.value),201);
 assert.equal(f.state().angle,90);assert.equal(toggle.textContent,'');
 f.tick(1000);assert.equal(f.state().angle,90);
 toggle.onclick();f.tick(1100);f.tick(1350);assert.equal(f.window.HubView.rotation*180/Math.PI,180);
 range.value=0;range.oninput();assert.equal(f.state().angle,0);assert.equal(Number(range.value),0);
});


test('magnetic auto rotation accumulates substeps and keeps the source centroid fixed',()=>{
 const f=fixture({spinRate:.01,sourcePan:[.1,.2]}),view=f.window.HubView;
 f.window.HubMirror.state={magnet:true,angle:0};view.setSourceCenter(680,480);
 const before=screenPoint(view,770,640);f.button('Автокручение треугольника').onclick();
 f.tick(0);for(let time=16;time<=1000;time+=16){f.tick(time);assert.equal(view.rotation,0);}
 f.tick(2200);assert.ok(Math.abs(view.rotation*180/Math.PI-15)<1e-8);near(screenPoint(view,770,640),before);
 f.window.HubMirror.state.magnet=false;f.tick(2300);assert.ok(view.rotation*180/Math.PI>15&&view.rotation*180/Math.PI<16);
});
test('magnetic field rotation uses the visible manual axis grid, including high speed',()=>{
 const f=fixture({spinRate:10000}),v=f.window.HubView;f.window.HubMirror.state={magnet:true,angle:Math.PI/6};
 f.button('Повернуть поле на −15°').onclick();assert.equal(v.rotation*180/Math.PI,345);
 f.button('Автокручение треугольника').onclick();f.tick(0);
 for(const time of [16.025,32.037,48.099,64.101]){f.tick(time);const degrees=v.rotation*180/Math.PI+30;assert.ok(Math.abs(degrees/15-Math.round(degrees/15))<1e-8);}
});
test('magnetic mirror wheel steps and automatic phase work with and without reflection',()=>{
 for(const on of [true,false]){
  const f=fixture();let tick;
  const source=fs.readFileSync(__dirname+'/hub-mirror.js','utf8').replace('const api = window.HubMirror = {','window.testStartSpin=startSpin; const api = window.HubMirror = {');
  vm.runInNewContext(source,{window:f.window,document:{readyState:'loading',addEventListener(){},hidden:false},localStorage:{getItem:()=>null,setItem(){}},requestAnimationFrame:fn=>{tick=fn;return 1;},cancelAnimationFrame(){},Event:class{constructor(type){this.type=type;}}});
  const m=f.window.HubMirror;m.place(300,900,800);m.state.on=on;m.state.magnet=true;m.state.angle=0;
  m.rotateBy(Math.PI/36);assert.ok(Math.abs((m.state.angle+f.window.HubView.rotation)*180/Math.PI-15)<1e-8);
  m.state.spinSpeed=3;f.window.testStartSpin();tick(1);for(let time=17;time<1000;time+=16)tick(time);
  assert.ok(Math.abs((m.state.angle+f.window.HubView.rotation)*180/Math.PI-15)<1e-8);
  tick(2601);assert.ok(Math.abs((m.state.angle+f.window.HubView.rotation)*180/Math.PI-30)<1e-8);
 }
});


test('dragging either copy keeps original, reflection and axis aligned at any zoom',()=>{
 for(const hit of [{source:true,mirror:false},{source:false,mirror:true}]){
  const f=fixture({unlocked:true,zoom:2,angle:25,sourcePan:[.1,.2]}),m=realMirror(f),v=f.window.HubView;
  m.hit=()=>hit;const pivot=screenPoint(v,750,400),original=screenPoint(v,800,420),reflected=screenPoint(v,...m.point(800,420));
  assert.equal(v.grabBits({target:{closest:()=>null},button:0,pointerId:1,clientX:750,clientY:400,stopPropagation(){}},true),true);
  f.emit('pointermove',{pointerId:1,clientX:810,clientY:430});
  near(screenPoint(v,750,400),[pivot[0]+60,pivot[1]+30]);near(screenPoint(v,800,420),[original[0]+60,original[1]+30]);
  near(screenPoint(v,...m.point(800,420)),[reflected[0]+60,reflected[1]+30]);assert.deepEqual(f.state().sourcePan,[.1,.2]);
 }
});


test('arrows change speed during playback without changing angle or direction; pause restores angle steps',()=>{
 const f=fixture(),auto=f.button('Автокручение треугольника');
 f.button('Повернуть поле на −15°').onclick();auto.onclick();f.tick(0);f.tick(100);
 const angle=f.window.HubView.rotation;f.button('Увеличить скорость вращения').onclick();
 assert.equal(f.state().spinDirection,-1);assert.ok(Math.abs(f.state().spinRate-.275)<1e-10);assert.equal(f.window.HubView.rotation,angle);
 f.button('Уменьшить скорость вращения').onclick();assert.ok(Math.abs(f.state().spinRate-.25)<1e-10);assert.equal(f.window.HubView.rotation,angle);
 auto.onclick();f.button('Повернуть поле на +15°').onclick();assert.equal(f.state().spinDirection,1);assert.ok(Math.abs(f.window.HubView.rotation-angle-Math.PI/12)<1e-10);
});


test('screen-pinned axis stays at viewport center through camera changes, including edge-on 3D',()=>{
 for(const on of [true,false])for(const flip of [0,67,90,180]){
  const f=fixture({zoom:2.4,angle:123,pan:[390,-210],flip}),m=realMirror(f),v=f.window.HubView;
  m.state.on=on;m.state.screenPin=true;m.syncCenter();
  const check=()=>near(screenPoint(v,300+900*m.state.x,800*m.state.y),[600,400]);
  check();m.moveFrom(m.position(),500,-300);check();
  m.rotateBy(Math.PI/12);check();
  f.button('Увеличить масштаб холста').onclick();check();
  f.button('Повернуть поле на +15°').onclick();check();
  m.state.screenPin=false;m.state.on=true;const before=m.position();m.moveFrom(before,40,20);
  assert.notDeepEqual(m.position(),before);
 }
});


test('pinned empty drag rotates the whole field and axis around viewport center',()=>{
 const f=fixture(),m=realMirror(f),v=f.window.HubView;m.state.screenPin=true;m.syncCenter();m.hit=()=>({source:false,mirror:false});
 const p=screenPoint(v,800,400),axis=m.state.angle+v.rotation;
 f.emit('pointerdown',{target:{closest:()=>null},button:0,pointerId:4,clientX:800,clientY:400,stopPropagation(){}});
 f.emit('pointermove',{pointerId:4,clientX:600,clientY:600});
 near(screenPoint(v,800,400),[600-(p[1]-400),400+(p[0]-600)]);
 assert.ok(Math.abs(m.state.angle+v.rotation-axis-Math.PI/2)<1e-10);
 near(screenPoint(v,300+900*m.state.x,800*m.state.y),[600,400]);
});
test('pinned drag of either copy rotates it under the pointer and its twin oppositely with axis fixed',()=>{
 for(const reflected of [false,true])for(const magnetic of [false,true]){
  const f=fixture({zoom:1.6,angle:30,pan:[70,-40]}),m=realMirror(f),v=f.window.HubView;m.state.screenPin=true;m.state.magnet=magnetic;m.syncCenter();m.hit=()=>({source:!reflected,mirror:reflected});
  const p=[800,420],orig=screenPoint(v,...p),copy=screenPoint(v,...m.point(...p,false)),axis=m.state.angle+v.rotation;
  assert.equal(v.grabBits({target:{closest:()=>null},button:0,pointerId:1,clientX:800,clientY:400,stopPropagation(){}},true),true);
  f.emit('pointermove',{pointerId:1,clientX:600,clientY:600});
  const direction=reflected?-1:1,rot=(p,d)=>[600-d*(p[1]-400),400+d*(p[0]-600)];
  near(screenPoint(v,...p),rot(orig,direction));near(screenPoint(v,...m.point(...p,false)),rot(copy,-direction));
  assert.ok(Math.abs(Math.sin(m.state.angle+v.rotation-axis))<1e-10);
  near(screenPoint(v,300+900*m.state.x,800*m.state.y),[600,400]);
 }
});


test('3D right-angle preset keeps the axis shared and the two projected planes distinct',()=>{
 const f=fixture({flip:30,angle:17,zoom:1.4,pan:[21,-9]}),v=f.window.HubView;
 f.button('Оригинал и зеркало под прямым углом').onclick();
 assert.equal(f.state().flip,30);assert.equal(f.state().mirrorFlip,120);
 const project=(mirror,x,y)=>{const e={id:'note',dataset:{note:mirror?'apex-mirror':'apex'},offsetLeft:0,offsetTop:0,style:{}};v.apply(e);const m=e.style.transform.slice(7,-1).split(',').map(Number);return [m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];};
 near(project(false,750,200),project(true,750,200));
 assert.notDeepEqual(project(false,850,400),project(true,850,400));
 for(const mirrored of [false,true])near(Array.from(v.inverse(...project(mirrored,850,400),mirrored)),[850,400]);
 f.button('Переворот вокруг оси зеркала в 3D').onclick();f.tick(1);f.tick(101);f.button('Переворот вокруг оси зеркала в 3D').onclick();
 assert.equal(f.state().mirrorFlip-f.state().flip,90);
});

test('freezing original allows mirror 3D motion; reset clears only 3D and prevents deferred resume',()=>{
 const f=fixture({flip:30,mirrorFlip:120,zoom:1.7,angle:42,pan:[21,32]}),before=f.state();
 f.button('Заморозить 3D-наклон оригинала; зеркало продолжает вращаться').onclick();
 f.button('Переворот вокруг оси зеркала в 3D').onclick();f.tick(1);f.tick(101);f.button('Переворот вокруг оси зеркала в 3D').onclick();
 assert.equal(f.state().flip,30);assert.equal(f.state().mirrorFlip,123);assert.equal(f.state().freezeOriginal,true);
 f.button('Сбросить только 3D: остановить, снять заморозку, вернуть обе плоскости').onclick();
 const after=f.state();assert.deepEqual([after.flip,after.mirrorFlip,after.freezeOriginal],[0,0,false]);
 assert.deepEqual([after.zoom,after.angle,after.pan],[before.zoom,before.angle,before.pan]);f.tick(201);assert.equal(f.state().mirrorFlip,0);
});

test('legacy saved 3D angle initializes both planes, and screen hit uses each plane independently',()=>{
 const f=fixture({flip:90,mirrorFlip:0});let calls=[];
 f.window.HubMirror.hit=(x,y)=>{calls.push([x,y]);return {source:true,mirror:true};};
 const hit=f.window.HubView.hitScreen(850,400);assert.equal(hit.source,false);assert.equal(hit.mirror,true);near(calls[0],[850,400]);
 const old=fixture({flip:35});assert.equal(old.state().mirrorFlip,35);
});


test('canvas reflection and export use the mirror plane even when original is edge-on',()=>{
 const f=fixture({flip:90,mirrorFlip:0}),draws=[],raw={width:2400,height:1600};
 let current=[];const g={save(){},restore(){},clearRect(){},setTransform(...m){current=m;},transform(a,b,c,d,e,h){const m=current;current=[m[0]*a+m[2]*b,m[1]*a+m[3]*b,m[0]*c+m[2]*d,m[1]*c+m[3]*d,m[0]*e+m[2]*h+m[4],m[1]*e+m[3]*h+m[5]];},drawImage(){const x=1700,y=800;draws.push([current[0]*x+current[2]*y+current[4],current[1]*x+current[3]*y+current[5]]);}};
 f.window.HubMirror.matrix=()=>[-1,0,0,1,3000,0];
 f.window.HubView.paint({width:2400,height:1600,getContext:()=>g},{left:0,scale:2},raw);
 near(draws[0],[1500,800]);near(draws[1],[1300,800]);
});


test('axis handle maps pointer directly through the screen plane at any 3D tilt, including edge-on',()=>{
 for(const flip of [0,45,89.9,90,120,270]){
  const f=fixture({flip,zoom:1.7,angle:37,pan:[43,-29]}),v=f.window.HubView,m=realMirror(f);
  m.state.x=.4;m.state.y=.55;const cx=660,cy=440,radius=155;
  const axisInverse=v.captureAxisInverse();
  for(const angle of [.3,1.4,3.8,5.9]){
   m.state.angle=angle;const x=cx+radius*Math.cos(angle),y=cy+radius*Math.sin(angle),screen=screenPoint(v,x,y);
   near(Array.from(v.axisInverse(...screen)),[x,y]);near(Array.from(axisInverse(...screen)),[x,y]);
  }
 }
});

test('wheel by axis endpoint rotates the axis instead of zooming, elsewhere zooms',()=>{
 const f=fixture(),calls=[];f.window.HubMirror.wheelAt=(...v)=>{calls.push(v);return true;};
 assert.equal(f.wheel().prevented,true);assert.equal(f.window.HubView.scale,1);assert.deepEqual(calls,[[750,400,-120]]);
 f.window.HubMirror.wheelAt=()=>false;f.wheel();assert.ok(f.window.HubView.scale>1);
});

test('wheel on axis line shifts bits without zoom and endpoint takes precedence',()=>{
 const f=fixture(),calls=[];f.window.HubMirror.wheelAt=()=>false;f.window.HubMirror.wheelAlong=d=>{calls.push(d);return true;};
 const event={target:{closest:s=>s==='.hubMirrorLine'},clientX:800,clientY:400,deltaY:120,preventDefault(){this.prevented=true;}};
 f.emit('wheel',event);assert.equal(event.prevented,true);assert.equal(f.window.HubView.scale,1);assert.deepEqual(calls,[120]);
 f.window.HubMirror.wheelAt=()=>true;f.emit('wheel',event);assert.deepEqual(calls,[120]);
});

test('direct symbol layers render in screen and export without a prepainted bitmap',()=>{
 const f=fixture(),passes=[];let copies=0;
 const g={save(){},restore(){},setTransform(){},clearRect(){},translate(){},transform(){},drawImage(){copies++;}};
 f.window.HubMirror.matrix=()=>null;
 const vector={direct:true,base:[1,0,0,1,0,0],draw:()=>passes.push('source')},canvas={width:1200,height:800,getContext:()=>g};
 f.window.HubView.paint(canvas,null,{},vector);f.window.HubView.paint(canvas,{scale:2,left:300},{},vector);
 assert.deepEqual(passes,['source','source']);assert.equal(copies,0);
});
