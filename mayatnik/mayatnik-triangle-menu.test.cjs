const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require(process.env.SETKA_JSDOM||'C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
const menu=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8');
const code=menu.slice(menu.indexOf('  function mountRomboControls('),menu.indexOf('  function mountHorrSections('));
test('assembly menu opens editor, separates fixed schemes from custom and disables the unused fold axis',()=>{
 const dom=new JSDOM('<div id="host"></div>'),w=dom.window,host=w.document.getElementById('host');
 let toggles=0,list;
 const s={on:true,row:8,maxRow:16,angle:0,assembly:16,mode:'custom',available:true};
 const api={get:()=>s,options:()=>[{id:16,label:'central',available:true}],setMode:v=>s.mode=v,set:v=>s.on=v,setRow:v=>s.row=v,cycleAngle:v=>s.angle=(s.angle+v*45+360)%360,setAssembly:v=>{s.assembly=v;s.mode='fixed';}};
 w.mayTriangleEditor={toggle(){toggles++;}};
 const c=vm.createContext({window:w,ZerkGrozd:{listHover:(_b,o)=>list=o},mobileMenu:{matches:false},getComputedStyle:w.getComputedStyle});vm.runInContext(code,c);
 const controls=c.mountRomboControls(host,{api:()=>api});
 assert.equal(host.querySelector('input').disabled,true);assert.equal(host.querySelector('[data-n="romboAssembly"] .gz-nm').textContent,'Своя сборка');
 host.querySelector('[data-n="triangleEditor"]').click();assert.equal(toggles,1);assert.equal(s.mode,'custom');
 host.querySelector('[data-n="romboFixed"]').click();assert.equal(s.mode,'fixed');assert.equal(host.querySelector('input').disabled,false);
 s.mode='custom';controls.sync();list.options()[0].pick();assert.equal(s.mode,'fixed');
 s.mode='custom';controls.sync();host.querySelector('[data-n="romboAngle"]').click();assert.equal(s.angle,45);assert.equal(s.mode,'custom');
 host.querySelector('[data-n="edgeRhombTop"]').click();assert.equal(s.on,false);dom.window.close();
});


test('exact controls disable incompatible 1:1 rotations with an actionable explanation',()=>{
 const dom=new JSDOM('<div></div>'),w=dom.window,host=w.document.querySelector('div'),s={on:true,row:3,maxRow:8,angle:0,assembly:16,mode:'fixed'},api={get:()=>s,options:()=>[],set(){},setRow(){},setMode(){},cycleAngle(){throw Error('incompatible angle must not run');}};
 w.mayPixelExact={canState:patch=>patch.romboAngle===undefined,policyFor:()=>({ok:false,reason:'Выключите 1:1 перед поворотом.'})};const c=vm.createContext({window:w,ZerkGrozd:{listHover(){}},mobileMenu:{matches:false},getComputedStyle:w.getComputedStyle});vm.runInContext(code,c);c.mountRomboControls(host,{api:()=>api});const button=host.querySelector('[data-n="romboAngle"]');assert.equal(button.disabled,true);assert.match(button.getAttribute('aria-label'),/1:1/);button.click();assert.equal(s.angle,0);dom.window.close();
});
