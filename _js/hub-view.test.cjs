const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture(saved = {}) {
  const raf=new Map();let nextRaf=0;
  const elements = [], listeners = {}, windowListeners = {}, storage = new Map([['zerk_hub_view', JSON.stringify({frameLocked:false,...saved})]]);
  const element = () => {
    const e = {style:{},dataset:{},children:[],offsetLeft:0,offsetTop:0,attributes:{},classList:{add(){},toggle(name,value){this[name]=value;}},
      getContext:()=>({setTransform(){}}),append(...items){this.children.push(...items);},setAttribute(k,v){this.attributes[k]=v;},addEventListener(){}};
    elements.push(e); return e;
  };
  const settings = element();
  let mirrorHomes = 0;
  const document = {hidden:false,body:element(),createElement:element,createTextNode:text=>({textContent:text}),
    querySelector:s=>s==='.hubMirrorSettings'?settings:null,querySelectorAll:()=>[],
    addEventListener:(name,fn)=>(listeners[name] ||= []).push(fn),removeEventListener:(name,fn)=>{listeners[name]=(listeners[name]||[]).filter(f=>f!==fn);}};
  const window = {HubMirror:{state:{},home(){mirrorHomes++;}},addEventListener:(name,fn)=>(windowListeners[name] ||= []).push(fn),
    dispatchEvent:e=>(windowListeners[e.type]||[]).forEach(fn=>fn(e))};
  vm.runInNewContext(fs.readFileSync(__dirname+'/hub-view.js','utf8'),{document,window,
    localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},innerWidth:1200,innerHeight:800,scrollY:0,
    matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>{const id=++nextRaf;raf.set(id,fn);return id;},cancelAnimationFrame:id=>raf.delete(id),Event:class{constructor(type){this.type=type;}},
    CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}}});
  listeners.DOMContentLoaded.forEach(fn=>fn()); window.HubView.place(300,900,800);
  return {window,centerMarkers:()=>elements.filter(e=>e.className==='hubCenterBit'),centerMarker:()=>elements.find(e=>e.className==='hubCenterBit'),bodyClass:name=>document.body.classList[name]===true,emit(name,event){for(const fn of listeners[name]||[])fn(event);},tick(time){const pending=[...raf.values()];raf.clear();pending.forEach(fn=>fn(time));},button:label=>elements.find(e=>e.attributes['aria-label']===label),state:()=>JSON.parse(storage.get('zerk_hub_view')),
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

test('auto zoom swings between existing limits about the viewport centre without anchor drift',()=>{
 const f=fixture({zoom:.2,angle:21,pan:[15,-20]}),v=f.window.HubView,play=f.button('Автозум от центра — пуск / пауза');const anchor=Array.from(v.inverse(600,400));
 play.onclick();f.tick(0);f.tick(4000);assert.ok(Math.abs(v.scale-Math.sqrt(1.2))<1e-9);near(Array.from(v.inverse(600,400)),anchor);
 f.tick(8000);assert.equal(v.scale,6);f.tick(12000);assert.ok(Math.abs(v.scale-Math.sqrt(1.2))<1e-9);f.tick(16000);assert.equal(v.scale,.2);near(Array.from(v.inverse(600,400)),anchor);
 assert.equal(play.attributes['aria-pressed'],'true');
});

test('auto zoom reset cycle jumps from maximum to minimum and keeps repeating',()=>{
 const f=fixture({zoom:.2,zoomCycle:'reset',zoomSeconds:8}),v=f.window.HubView;f.button('Автозум от центра — пуск / пауза').onclick();f.tick(0);f.tick(7900);assert.ok(v.scale>5.7);f.tick(8000);assert.equal(v.scale,.2);f.tick(12000);assert.ok(Math.abs(v.scale-Math.sqrt(1.2))<1e-9);f.tick(16000);assert.equal(v.scale,.2);
});

test('auto zoom pause preserves its descending phase; manual zoom and home stop it',()=>{
 const f=fixture({zoom:.2}),v=f.window.HubView,play=f.button('Автозум от центра — пуск / пауза');play.onclick();f.tick(0);f.tick(10000);const paused=v.scale;play.onclick();f.tick(20000);assert.equal(v.scale,paused);play.onclick();f.tick(21000);f.tick(22000);assert.ok(v.scale<paused);
 f.button('Увеличить масштаб холста').onclick();const manual=v.scale;f.tick(30000);assert.equal(v.scale,manual);assert.equal(play.attributes['aria-pressed'],'false');
 play.onclick();f.button('Вернуть весь рисунок в поле').onclick();f.tick(40000);assert.equal(v.scale,1);assert.equal(play.attributes['aria-pressed'],'false');
});

test('field pause suspends auto zoom and resumes without catching up elapsed time',()=>{
 const f=fixture({zoom:.2}),v=f.window.HubView;f.button('Автозум от центра — пуск / пауза').onclick();f.tick(0);f.tick(2000);const before=v.scale;
 f.window.dispatchEvent({type:'hubmotionpause',detail:{paused:true}});f.tick(50000);assert.equal(v.scale,before);
 f.window.dispatchEvent({type:'hubmotionpause',detail:{paused:false}});f.tick(51000);assert.equal(v.scale,before);f.tick(52000);assert.ok(v.scale>before);
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
  // Legacy unpinned cases remain explicit; live defaults now always pin the axis.
  f.window.HubMirror.state.screenPin=false;f.window.HubMirror.place(300,900,800);return f.window.HubMirror;
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
 for(let i=0;i<=60;i++)f.tick(-2000+i*1000/60);
 const rate=f.button('Скорость автокручения в оборотах за кадр');rate.valueAsNumber=1000.25/60;rate.onchange();
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


test('middle-button drag pans from bits or empty canvas even with the drag lock and pinned axis',()=>{
 for(const pinned of [false,true])for(const reflected of [false,true,null]){
  const f=fixture({zoom:1.6,angle:30,pan:[70,-40]}),m=realMirror(f),v=f.window.HubView;m.state.screenPin=pinned;m.syncCenter();m.hit=()=>({source:reflected===false,mirror:reflected===true});
  const p=screenPoint(v,800,400),axis=m.state.angle,rotation=v.rotation;
  const event={target:{closest:()=>null},button:1,pointerId:4,clientX:800,clientY:400,preventDefault(){},stopPropagation(){}};
  if(reflected===null)f.emit('pointerdown',event);else assert.equal(v.grabBits(event,true),true);
  f.emit('pointermove',{pointerId:4,clientX:600,clientY:600});
  near(screenPoint(v,800,400),[p[0]-200,p[1]+200]);near(f.state().pan,[-130,160]);assert.equal(v.rotation,rotation);assert.equal(m.state.angle,axis);
  f.emit('pointerup',{type:'pointerup',pointerId:4});assert.equal(v.rotation,rotation);
 }
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
 const f=fixture(),calls=[];f.window.HubMirror.wheelZoneAt=()=> 'axis';f.window.HubMirror.wheelStep=(...v)=>{calls.push(v);return true;};
 assert.equal(f.wheel().prevented,true);assert.equal(f.window.HubView.scale,1);assert.deepEqual(calls,[['axis',-120]]);
 f.window.HubMirror.wheelZoneAt=()=>false;f.emit('click',{});f.wheel();assert.ok(f.window.HubView.scale>1);
});

test('wheel on axis line shifts bits without zoom and endpoint takes precedence',()=>{
 const f=fixture(),calls=[];f.window.HubMirror.wheelZoneAt=()=>false;f.window.HubMirror.wheelAlong=d=>{calls.push(d);return true;};
 const event={target:{closest:s=>s==='.hubMirrorLine'},clientX:800,clientY:400,deltaY:120,preventDefault(){this.prevented=true;}};
 f.emit('wheel',event);assert.equal(event.prevented,true);assert.equal(f.window.HubView.scale,1);assert.deepEqual(calls,[120]);
 f.window.HubMirror.wheelZoneAt=()=> 'axis';f.window.HubMirror.wheelStep=()=>true;f.emit('click',{});f.emit('wheel',event);assert.deepEqual(calls,[120]);
});

test('direct symbol layers render in screen and export without a prepainted bitmap',()=>{
 const f=fixture(),passes=[];let copies=0;
 const g={save(){},restore(){},setTransform(){},clearRect(){},translate(){},transform(){},drawImage(){copies++;}};
 f.window.HubMirror.matrix=()=>null;
 const vector={direct:true,base:[1,0,0,1,0,0],draw:()=>passes.push('source')},canvas={width:1200,height:800,getContext:()=>g};
 f.window.HubView.paint(canvas,null,{},vector);f.window.HubView.paint(canvas,{scale:2,left:300},{},vector);
 assert.deepEqual(passes,['source','source']);assert.equal(copies,0);
});

test('flow geometry survives note painting, matches both projected layers and ignores exports',()=>{
 const f=fixture({zoom:1.7,angle:30,sourcePan:[.1,-.05],flip:28,mirrorFlip:55});realMirror(f);f.window.HubMirror.state.on=true;
 const mult=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
 let current=[1,0,0,1,0,0];const stack=[],points=[];
 const g={save(){stack.push(current.slice());},restore(){current=stack.pop();},clearRect(){},drawImage(){},setTransform(...m){current=m;},transform(...m){current=mult(current,m);},translate(x,y){this.transform(1,0,0,1,x,y);}};
 const vector={direct:true,base:[1,0,0,1,0,0],draw(){},obstacles(){points.push([current[0]*600+current[2]*300+current[4],current[1]*600+current[3]*300+current[5]]);}};
 const canvas={id:'hubSier',width:1200,height:800,getContext:()=>g};
 f.window.HubView.paint(canvas,null,{},vector);
 f.window.HubView.paint({...canvas,id:'notes'},null,{});
 f.window.HubView.paint(canvas,{scale:2,left:0},{},{...vector,obstacles(){throw Error('export leaked');}});
 g.setTransform(1,0,0,1,0,0);assert.equal(f.window.HubView.drawFlowObstacles(g),true);assert.equal(points.length,2);
 const m=f.window.HubView.symmetryCamera();for(const [i,mirror] of [false,true].entries()){
   const p=f.window.HubView.projectBit(600,300,mirror),q=[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
   assert.ok(Math.hypot(points[i][0]-q[0],points[i][1]-q[1])<1e-7);
 }
 const filters=[];vector.obstacles=(g,bit)=>filters.push(['layer',bit]);vector.foldObstacles=(g,bit)=>filters.push(['fold',bit]);
 for(const bit of ['0','1'])f.window.HubView.drawFlowObstacles(g,bit);
 assert.deepEqual(filters,[['layer','0'],['layer','0'],['fold','0'],['layer','1'],['layer','1'],['fold','1']]);
});

test('wheel rotation about the axis endpoint preserves that screen pivot',()=>{
 const f=fixture({zoom:2,angle:14,pan:[20,10],sourcePan:[.1,.15]}),axis=Array.from(f.window.HubView.axisInverse(600,400));
 f.window.HubView.rotateBy(5,axis);
 const after=Array.from(f.window.HubView.axisInverse(600,400));assert.ok(Math.hypot(after[0]-axis[0],after[1]-axis[1])<1e-8);assert.equal(f.state().angle,19);
});

test('wheel rotates bits and their reflection oppositely while the axis and endpoint stay fixed',()=>{
 for(const pinned of [false,true])for(const magnetic of [false,true]){
  const f=fixture({zoom:1.6,angle:27,pan:[70,-40]}),m=realMirror(f),v=f.window.HubView;
  m.state.screenPin=pinned;m.state.magnet=magnetic;m.syncCenter();
  const pivot=[300+900*m.state.x,800*m.state.y],center=screenPoint(v,...pivot),point=[800,420],original=screenPoint(v,...point),copy=screenPoint(v,...m.point(...point,false)),axis=m.state.angle+v.rotation;
  v.rotateBitsBy(5,pivot);const a=(magnetic?15:5)*Math.PI/180;
  const rotated=(p,d)=>{const x=p[0]-center[0],y=p[1]-center[1];return [center[0]+x*Math.cos(d)-y*Math.sin(d),center[1]+x*Math.sin(d)+y*Math.cos(d)];};
  near(screenPoint(v,...point),rotated(original,a));near(screenPoint(v,...m.point(...point,false)),rotated(copy,-a));
  near(screenPoint(v,300+900*m.state.x,800*m.state.y),center);assert.ok(Math.abs(Math.sin(m.state.angle+v.rotation-axis))<1e-10);
  v.rotateBitsBy(5,pivot);near(screenPoint(v,...point),rotated(original,2*a));assert.ok(Math.abs(Math.sin(m.state.angle+v.rotation-axis))<1e-10);
 }
});


test('frame rate display and exact input use measured cadence without changing stored speed',()=>{
 for(const hz of [60,120]){
  const f=fixture(),rate=f.button('Скорость автокручения в оборотах за кадр'),slider=f.button('Шкала скорости автокручения');
  assert.equal(rate.disabled,true);assert.equal(slider.attributes['aria-valuetext'],'… об/кадр');
  for(let i=0;i<=hz;i++)f.tick(i*1000/hz);
  assert.equal(rate.disabled,false);rate.onfocus();rate.valueAsNumber=1.25;rate.onchange();
  assert.equal(f.state().spinRate,1.25*hz);assert.equal(slider.attributes['aria-valuetext'],'≈5/4 об/кадр');
  f.button('Автокручение треугольника').onclick();
  f.tick(10000);for(let i=1;i<=hz;i++)f.tick(10000+i*1000/hz);
  assert.equal(slider.attributes['aria-valuetext'],'≈5/4 об/кадр');assert.equal(f.state().spinRate,1.25*hz);
  rate.onblur();for(let i=1;i<=120;i++)f.tick(11000+i*1000/30);
  assert.equal(Number(rate.value),1.25*hz/30);assert.equal(f.state().spinRate,1.25*hz);
 }
});


test('pinned zoom scales both figures toward the axis endpoint down to the minimum without separating them',()=>{
 for(const flip of [0,67,90]){
  const f=fixture({zoom:1.7,angle:123,pan:[47,-31],sourcePan:[.1,.2],flip}),m=realMirror(f),v=f.window.HubView;
  m.state.screenPin=true;m.syncCenter();
  const p=[730,510],original=screenPoint(v,...p),copy=screenPoint(v,...m.point(...p,false)),z=v.scale;
  for(let i=0;i<25;i++){
   f.button('Уменьшить масштаб холста').onclick();const k=v.scale/z;
   near(screenPoint(v,...p),[600+(original[0]-600)*k,400+(original[1]-400)*k]);
   near(screenPoint(v,...m.point(...p,false)),[600+(copy[0]-600)*k,400+(copy[1]-400)*k]);
  }
  assert.equal(v.scale,.2);const before=f.state();f.button('Уменьшить масштаб холста').onclick();assert.deepEqual(f.state(),before);
 }
});


test('frame fractions show simple ratios and preserve the approximation marker',()=>{
 const f=fixture(),rate=f.button('Скорость автокручения в оборотах за кадр'),slider=f.button('Шкала скорости автокручения');
 for(let i=0;i<=60;i++)f.tick(i*1000/60);
 for(const [value,text] of [[1/2,'≈1/2'],[1/3,'≈1/3'],[5/4,'≈5/4'],[2,'≈2'],[0,'0']]){
  rate.valueAsNumber=value;rate.onchange();assert.equal(slider.attributes['aria-valuetext'],text+' об/кадр');
 }
});


test('axis continues backward only to the last intersected bit, including bit rotation and displacement',()=>{
 const f=fixture(),m=realMirror(f);m.state.angle=0;m.state.x=.5;m.state.y=.5;
 m.setBitCenters([[700,400,'1'],[650,400,'0'],[400,500,'1'],[850,400,'1']],{width:20,height:10});
 assert.equal(m.axisTailLength(),110);
 m.state.zero=90;assert.ok(Math.abs(m.axisTailLength()-105)<1e-8);
 f.window.HubView.shiftSourceBy(30,0);assert.ok(Math.abs(m.axisTailLength()-75)<1e-8);
 m.setBitCenters([[400,500,'1']],{width:20,height:10});assert.equal(m.axisTailLength(),0);
});


test('frame lock defaults on and advances by the actual fraction on each callback regardless of time or magnet',()=>{
 const f=fixture({frameLocked:undefined}),v=f.window.HubView,input=f.button('Скорость автокручения в оборотах за кадр'),mode=f.button('Точный шаг вращения на каждый кадр');
 assert.equal(mode.attributes['aria-pressed'],'true');assert.equal(input.disabled,false);
 input.value='1/2';input.onchange();assert.equal(f.state().frameStep,.5);
 f.tick(0);assert.equal(v.rotation,Math.PI);f.tick(16);assert.equal(v.rotation,0);f.tick(1600);assert.equal(v.rotation,Math.PI);
 f.button('Автокручение треугольника').onclick();f.tick(2000);assert.equal(v.rotation,Math.PI);
 f.button('Вернуть весь рисунок в поле').onclick();f.window.HubMirror.state.magnet=true;
 input.value='1/3';input.onchange();f.tick(3000);assert.ok(Math.abs(v.rotation-2*Math.PI/3)<1e-10);f.tick(3001);assert.ok(Math.abs(v.rotation-4*Math.PI/3)<1e-10);f.tick(6000);assert.ok(Math.abs(v.rotation)<1e-10);
 mode.onclick();assert.equal(f.state().frameLocked,false);mode.onclick();assert.equal(f.state().frameLocked,true);assert.equal(f.state().frameStep,1/3);
 input.value='1/0';input.onchange();assert.equal(f.state().frameStep,1/3);
});

test('left drag outside bits delegates to the axis',()=>{
 const f=fixture(),m=realMirror(f);m.state.screenPin=true;let grabbed=null;m.grabAxis=e=>{grabbed=e;return true;};
 const e={target:{closest:()=>null},button:0,pointerId:5,clientX:800,clientY:400,stopPropagation(){}};
 f.emit('pointerdown',e);assert.equal(grabbed,e);assert.equal(f.window.HubView.rotation,0);
});

test('middle click repeats last wheel rotation, preserves axis and ignores cancelled clicks',()=>{
 for(const cancel of [false,true]){const f=fixture({angle:73}),m=realMirror(f),v=f.window.HubView;m.state.screenPin=true;m.state.magnet=false;m.syncCenter();m.hit=()=>({source:false,mirror:false});const axis=m.state.angle+v.rotation;
 v.rotateBitsBy(-5,m.rotationCenter());
 f.emit('pointerdown',{target:{closest:()=>null},button:1,pointerId:4,clientX:800,clientY:400,preventDefault(){},stopPropagation(){}});
 const type=cancel?'pointercancel':'pointerup';f.emit(type,{type,pointerId:4});assert.ok(Math.abs(v.rotation-(cancel?68:63)*Math.PI/180)<1e-10);assert.ok(Math.abs(m.state.angle+v.rotation-axis)<1e-10);}
});

test('wheel and middle click on zero/one tilt only that bit type, without camera zoom or rotation',()=>{
 const f=fixture(),m=realMirror(f),v=f.window.HubView;m.state.on=false;m.setBitCenters([[800,200,'0'],[840,200,'1']],{width:20,height:40});const target={closest:()=>null};
 for(const [x,key,delta,expected] of [[800,'zero',120,10],[840,'one',-120,-10]]){
  f.emit('pointerdown',{target,button:0,pointerId:8,clientX:x,clientY:200,preventDefault(){},stopPropagation(){}});f.emit('pointerup',{type:'pointerup',pointerId:8});f.emit('click',{});
  f.emit('wheel',{target,clientX:x,clientY:200,deltaY:delta,preventDefault(){}});
  f.emit('pointerdown',{target,button:1,pointerId:9,clientX:x,clientY:200,preventDefault(){},stopPropagation(){}});f.emit('pointerup',{type:'pointerup',pointerId:9});assert.equal(m.state[key],expected);
 }
 assert.equal(m.state.zero,10);assert.equal(m.state.one,-10);assert.equal(v.scale,1);assert.equal(v.rotation,0);
});

test('zoom remains zoom over arriving bits or axis, including after a pause, until a click',()=>{
 const f=fixture(),m=f.window.HubMirror;let bit=null,zone=false,tilts=0,steps=0;
 m.bitAt=()=>bit;m.wheelZoneAt=()=>zone;m.wheelStep=()=>steps++;m.tiltBit=()=>tilts++;
 f.wheel();const first=f.window.HubView.scale;bit='1';zone='bits';f.tick(60000);f.wheel();assert.ok(f.window.HubView.scale>first);assert.equal(steps,0);assert.equal(tilts,0);
 f.emit('click',{});const scale=f.window.HubView.scale;f.wheel();assert.equal(steps,1);assert.equal(f.window.HubView.scale,scale);
 zone=false;bit=null;f.wheel();assert.equal(steps,2);assert.equal(f.window.HubView.scale,scale);
});
test('bit wheel requires a completed click, keeps its type and clears on another press',()=>{
 const f=fixture(),m=f.window.HubMirror,calls=[];let bit='0';m.bitAt=()=>bit;m.wheelZoneAt=()=>false;m.tiltBit=(...args)=>calls.push(args);m.hit=()=>({source:true,mirror:false});
 const target={closest:()=>null},down=()=>f.emit('pointerdown',{target,button:0,pointerId:1,clientX:750,clientY:400,preventDefault(){},stopPropagation(){}}),up=()=>f.emit('pointerup',{type:'pointerup',pointerId:1});
 f.wheel();assert.equal(calls.length,0);assert.ok(f.window.HubView.scale>1);
 down();up();f.emit('click',{});f.wheel();bit='1';f.wheel();assert.deepEqual(calls,[['0',-5],['0',-5]]);
 f.emit('pointerdown',{target:{closest:()=>true},button:0});f.wheel();assert.equal(calls.length,2);
 down();up();f.emit('click',{});f.wheel();assert.deepEqual(calls.at(-1),['1',-5]);
 down();f.emit('pointermove',{pointerId:1,clientX:760,clientY:400});up();f.emit('click',{});f.wheel();assert.equal(calls.length,3);
 down();f.emit('pointercancel',{pointerId:1});f.emit('click',{});f.wheel();assert.equal(calls.length,3);
 bit=null;down();up();f.wheel();assert.equal(calls.length,3);
});

test('combined symmetry projection includes displacement and separate 3D planes but excludes common camera motion',()=>{
 const f=fixture({sourcePan:[.1,.2],angle:40,zoom:3,flip:0,mirrorFlip:60});f.window.HubMirror.state={angle:Math.PI/2,x:.5,y:.5};
 const sh=f.window.HubView.sourceShift();f.window.HubMirror.point=(x,y)=>[1500-x-sh[0],y+sh[1]];
 const a=Array.from(f.window.HubView.projectBit(700,300)),b=Array.from(f.window.HubView.projectBit(700,300,true));
 assert.deepEqual(a,[700+sh[0],300+sh[1]]);assert.ok(Math.abs(b[0]-(750+(50-sh[0])*.5))<1e-8);assert.equal(b[1],300+sh[1]);
 f.window.HubView.rotateBy(15);assert.deepEqual(Array.from(f.window.HubView.projectBit(700,300)),a);
});

test('hover centre follows the camera, reuses its bitmap and hides over controls or outside bits',()=>{
 const f=fixture({zoom:2,angle:35}),m=realMirror(f),v=f.window.HubView;m.state.on=false;v.setSourceCenter(750,400);m.setBitCenters([[750,400,'1'],[760,410,'0']],{width:20,height:30});let paints=0;m.drawCenterBit=()=>paints++;
 const [x,y]=screenPoint(v,750,400),target={closest:()=>null};f.emit('pointermove',{clientX:x,clientY:y,target,pointerType:'mouse'});
 const marker=f.centerMarker();assert.equal(marker.hidden,false);assert.equal(marker.dataset.layer,'source');assert.ok(marker.style.transform.includes('matrix('));assert.equal(paints,2);
 f.emit('pointermove',{clientX:x+1,clientY:y,target});assert.equal(paints,2);
 f.emit('pointermove',{clientX:x,clientY:y,target:{closest:()=>true}});assert.equal(marker.hidden,true);
 f.emit('pointermove',{clientX:x,clientY:y,target});assert.equal(marker.hidden,false);
 f.emit('pointerout',{relatedTarget:null});assert.equal(marker.hidden,true);
 f.emit('pointermove',{clientX:1100,clientY:10,target});assert.equal(marker.hidden,true);
});

test('double click on either central bit moves the whole triangle to the axis without rotating or pausing',()=>{
 for(const mirrored of [false,true])for(const pinned of [false,true]){
  const f=fixture({zoom:1.3,angle:20,pan:[10,20],sourcePan:[.04,-.03],flip:17,mirrorFlip:28}),m=realMirror(f),v=f.window.HubView;
  m.state.on=true;m.state.screenPin=pinned;m.state.x=.5;m.state.y=.55;m.state.angle=Math.PI/2;
  v.setSourceCenter(830,300);m.setBitCenters([[830,300,'1'],[830,250,'0']],{width:20,height:30});
  const axis=Array.from(m.rotationCenter()),before=f.state(),p=v.projectBit(830,300,mirrored),camera=v.symmetryCamera();
  const event={target:{closest:()=>null},clientX:camera[0]*p[0]+camera[2]*p[1]+camera[4],clientY:camera[1]*p[0]+camera[3]*p[1]+camera[5],preventDefault(){this.prevented=true;},stopPropagation(){}};
  let paused=0;f.window.addEventListener('hubmotionpause',()=>paused++);f.emit('dblclick',event);
  near(Array.from(v.originalCenter()),axis);near(Array.from(m.rotationCenter()),axis);assert.equal(event.prevented,true);assert.equal(paused,0);
  const after=f.state();for(const key of ['zoom','angle','flip','mirrorFlip'])assert.equal(after[key],before[key]);assert.deepEqual(after.pan,before.pan);
 }
});

test('double click on any original or reflected bit centres that bit and releases a conflicting centre pin',()=>{
 for(const reflected of [false,true])for(const pinned of [false,true]){
  const f=fixture({centerBitPin:pinned,zoom:1.3,angle:20,flip:17,mirrorFlip:35}),m=realMirror(f),v=f.window.HubView;
  m.state.on=true;m.state.angle=Math.PI/2;v.setSourceCenter(830,300);m.setBitCenters([[830,300,'1'],[830,250,'0']],{width:20,height:30});
  const bit=m.bitCenter(1),axis=Array.from(m.rotationCenter()),p=v.projectBit(bit.x,bit.y,reflected),camera=v.symmetryCamera();let paused=0;f.window.addEventListener('hubmotionpause',()=>paused++);
  f.emit('dblclick',{target:{closest:()=>null},clientX:camera[0]*p[0]+camera[2]*p[1]+camera[4],clientY:camera[1]*p[0]+camera[3]*p[1]+camera[5],preventDefault(){},stopPropagation(){}});
  for(const layer of [false,true])near(Array.from(v.projectBit(bit.x,bit.y,layer)),axis);
  assert.equal(paused,0);assert.equal(v.centerBitPinned,false);
 }
});

test('hover highlights the centre and three vertices of both separately tilted layers',()=>{
 const f=fixture({zoom:1.3,angle:23,flip:17,mirrorFlip:45}),m=realMirror(f),v=f.window.HubView;m.state.on=true;v.setSourceCenter(800,300);
 m.setBitCenters([[800,200,'1'],[800,300,'0'],[700,400,'1'],[900,400,'0']],{width:20,height:30});m.drawCenterBit=()=>{};
 const p=v.projectBit(800,300),camera=v.symmetryCamera(),target={closest:()=>null};f.emit('pointermove',{clientX:camera[0]*p[0]+camera[2]*p[1]+camera[4],clientY:camera[1]*p[0]+camera[3]*p[1]+camera[5],target});
 const markers=f.centerMarkers();assert.equal(markers.length,8);assert.equal(markers.filter(n=>n.dataset.kind==='vertex').length,6);
 for(const marker of markers){const bit=m.bitCenter(Number(marker.dataset.bitIndex)),p=v.projectBit(bit.x,bit.y,marker.dataset.layer==='mirror'),a=marker.style.transform.match(/matrix\(([^)]+)\)/)[1].split(',').map(Number);near(a.slice(4),[camera[0]*p[0]+camera[2]*p[1]+camera[4],camera[1]*p[0]+camera[3]*p[1]+camera[5]]);}
 f.emit('pointerout',{relatedTarget:null});assert.ok(markers.every(n=>n.hidden));
});

test('hidden orbit can be found away from the handle, including zoom and edge-on 3D',()=>{
 for(const flip of [0,60,90])for(const magnet of [false,true]){
  const f=fixture({zoom:2,angle:31,flip}),m=realMirror(f),v=f.window.HubView;m.state.magnet=magnet;m.state.orbitRadius=.22;
  const c=Array.from(m.rotationCenter()),camera=v.axisCamera(),project=(x,y)=>[camera[0]*x+camera[2]*y+camera[4],camera[1]*x+camera[3]*y+camera[5]],offset=magnet?-v.rotation:0;
  for(const i of [3,7,15,21]){const a=offset+i*Math.PI/12,p=project(c[0]+176*Math.cos(a),c[1]+176*Math.sin(a));assert.equal(m.orbitNear(...p),true);}
  assert.equal(m.orbitNear(-10000,-10000),false);m.state.orbitRadius=0;assert.equal(m.orbitNear(...project(...c)),false);
 }
});


test('successive clicks on zero and one accumulate both wheel targets in either order; drag or outside press clears them',()=>{
 for(const order of [['0','1'],['1','0']]){
  const f=fixture(),m=realMirror(f),v=f.window.HubView;m.state.on=false;m.setBitCenters([[800,200,'0'],[840,200,'1']],{width:20,height:40});const target={closest:()=>null};
  const down=bit=>f.emit('pointerdown',{target,button:0,pointerId:10,clientX:bit==='0'?800:840,clientY:200,preventDefault(){},stopPropagation(){}});
  const click=bit=>{down(bit);f.emit('pointerup',{type:'pointerup',pointerId:10});f.emit('click',{});};
  const wheel=deltaY=>f.emit('wheel',{target,clientX:840,clientY:200,deltaY,preventDefault(){}});
  click(order[0]);click(order[1]);wheel(120);assert.equal(m.state.zero,5);assert.equal(m.state.one,5);
  click(order[0]);wheel(120);assert.equal(m.state.zero,10);assert.equal(m.state.one,10,'same type is not added twice');
  wheel(-120);assert.equal(m.state.zero,5);assert.equal(m.state.one,5);assert.equal(v.scale,1);assert.equal(v.rotation,0);
  f.emit('pointerdown',{target:{closest:()=>true},button:0});click('1');wheel(120);assert.equal(m.state.zero,5);assert.equal(m.state.one,10);
  down('0');f.emit('pointermove',{pointerId:10,clientX:808,clientY:200});f.emit('pointerup',{type:'pointerup',pointerId:10});wheel(120);assert.equal(m.state.zero,5);assert.equal(m.state.one,10);
 }
});

test('centre bit pin aligns the actual bit to the axis and follows movement, zoom, rotation and 3D',()=>{
 for(const on of [false,true])for(const screenPin of [false,true]){
  const f=fixture({zoom:1.7,angle:31,flip:90,mirrorFlip:28}),m=realMirror(f),v=f.window.HubView;
  m.state.on=on;m.state.screenPin=screenPin;m.state.x=.6;m.state.y=.4;m.state.autoCenter=false;
  v.setSourceCenter(830,300);m.setBitCenters([[826,304,'1'],[860,330,'0']],{width:20,height:30});
  const check=()=>{const bit=m.centerBit(),axis=Array.from(m.rotationCenter());for(const reflected of on?[false,true]:[false])near(Array.from(v.projectBit(bit.x,bit.y,reflected)),axis);};
  f.button('Закрепить центральный бит треугольника в центре оси').onclick();check();assert.equal(f.state().centerBitPin,true);
  assert.notDeepEqual(Array.from(v.originalCenter()),Array.from(m.rotationCenter()),'pin the bit, not the nearby geometric centroid');
  m.moveFrom(m.position(),40,25);check();v.rotateBy(15);check();f.button('Увеличить масштаб холста').onclick();check();v.shiftSourceBy(30,-25);check();
  v.setSourceCenter(750,450);m.setBitCenters([[747,453,'0'],[790,480,'1']],{width:20,height:30});check();
  f.button('Закрепить центральный бит треугольника в центре оси').onclick();assert.equal(f.state().centerBitPin,false);const before=Array.from(v.sourceShift());v.shiftSourceBy(30,-25);near(Array.from(v.sourceShift()),[before[0]+30,before[1]-25]);
 }
});
test('saved centre bit pin waits for actual bit geometry and remains enabled after reload',()=>{
 const f=fixture({centerBitPin:true}),m=realMirror(f),v=f.window.HubView;
 assert.equal(v.centerBitPinned,true);assert.equal(f.button('Закрепить центральный бит треугольника в центре оси').attributes['aria-pressed'],'true');
 v.setSourceCenter(830,300);m.setBitCenters([[826,304,'1']],{width:20,height:30});near(Array.from(v.projectBit(826,304)),Array.from(m.rotationCenter()));
});
