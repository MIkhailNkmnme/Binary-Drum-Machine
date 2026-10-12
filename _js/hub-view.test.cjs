const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture(saved = {}) {
  const elements = [], listeners = {}, windowListeners = {}, storage = new Map([['zerk_hub_view', JSON.stringify(saved)]]);
  const element = () => {
    const e = {style:{},dataset:{},children:[],offsetLeft:0,offsetTop:0,attributes:{},classList:{add(){},toggle(){}},
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
    matchMedia:()=>({matches:false}),requestAnimationFrame:()=>1,cancelAnimationFrame(){},Event:class{constructor(type){this.type=type;}},
    CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}}});
  listeners.DOMContentLoaded.forEach(fn=>fn()); window.HubView.place(300,900,800);
  return {window,button:label=>elements.find(e=>e.attributes['aria-label']===label),state:()=>JSON.parse(storage.get('zerk_hub_view')),
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
