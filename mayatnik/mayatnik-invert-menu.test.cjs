'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom'),menu=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8');
function fixture(){const dom=new JSDOM('<div id="view"><button data-n="existing">Existing</button><button data-n="resetView">Reset</button></div>',{runScripts:'outside-only'}),w=dom.window,d=w.document,row=d.getElementById('view'),calls=[],state={kind:'bits',inverted:false,auto:false};let after=0;
 const notify=()=>w.dispatchEvent(new w.Event('may-invert-change')),api={get:()=>({...state}),toggle(){calls.push(['toggle']);state.inverted=!state.inverted;notify();},setAuto(value){calls.push(['auto',value]);state.auto=value;notify();},setKind(value){calls.push(['kind',value]);state.kind=value;notify();}};
 w.ptBtn=(id,kind,source,onclick)=>{const b=d.createElement('button');b.type='button';b.className='pt-b';b.dataset.n=id;b.onclick=onclick;b.append(d.createElement('i'));return b;};w.toolSync=[];
 const start=menu.indexOf('  function installInvertMenu('),end=menu.indexOf('  installInvertMenu(gView);',start);w.eval(menu.slice(start,end)+';window.installInvertMenu=installInvertMenu;');const controls=w.installInvertMenu(row,api,()=>after++);
 return {dom,w,d,row,state,calls,notify,controls,api,get after(){return after;},close(){w.close();}};
}
test('view installs standard invert commands before reset and does not mutate the engine while mounting',()=>{
 const f=fixture();try{assert.deepEqual([...f.row.children].map(node=>node.dataset.n),['existing','invertToggle','invertAuto','invertKind','resetView']);assert.deepEqual(f.calls,[]);assert.equal(f.controls.toggle.getAttribute('aria-pressed'),'false');assert.equal(f.controls.auto.getAttribute('aria-pressed'),'false');assert.equal(f.controls.kind.querySelector('button').getAttribute('aria-pressed'),'true');assert.equal(f.controls.toggle.classList.contains('gz-hx'),true);assert.equal(f.controls.kind.classList.contains('may-segments'),true);assert.equal(f.w.installInvertMenu(f.row,f.api),null);assert.equal(f.row.children.length,5);
 }finally{f.close();}
});
test('manual/auto buttons call the shared API once and reflect actual phase and auto independently',()=>{
 const f=fixture();try{f.controls.toggle.click();assert.deepEqual(f.calls,[['toggle']]);assert.equal(f.controls.toggle.getAttribute('aria-pressed'),'true');assert.ok(f.controls.toggle.classList.contains('on'));f.controls.auto.click();assert.deepEqual(f.calls,[['toggle'],['auto',true]]);assert.equal(f.controls.auto.getAttribute('aria-pressed'),'true');assert.equal(f.controls.toggle.getAttribute('aria-pressed'),'true');
  Object.assign(f.state,{inverted:false,auto:true});f.notify();assert.equal(f.controls.toggle.getAttribute('aria-pressed'),'false');assert.equal(f.controls.auto.getAttribute('aria-pressed'),'true');f.controls.auto.click();assert.deepEqual(f.calls.at(-1),['auto',false]);assert.equal(f.after,3);
 }finally{f.close();}
});
test('bits/colour changes only the API kind, retaining the shared inversion phase and external-restore synchronization',()=>{
 const f=fixture();try{Object.assign(f.state,{inverted:true,auto:true});f.notify();const [bits,colour]=f.controls.kind.querySelectorAll('button');colour.click();assert.deepEqual(f.calls,[['kind','colour']]);assert.equal(f.state.inverted,true);assert.equal(f.state.auto,true);assert.equal(colour.getAttribute('aria-pressed'),'true');assert.equal(bits.getAttribute('aria-pressed'),'false');
  Object.assign(f.state,{kind:'bits',inverted:false,auto:false});f.notify();assert.equal(bits.getAttribute('aria-pressed'),'true');assert.equal(colour.getAttribute('aria-pressed'),'false');assert.equal(f.controls.auto.getAttribute('aria-pressed'),'false');assert.deepEqual(f.calls,[['kind','colour']]);
  f.w.dispatchEvent(new f.w.Event('pagehide'));f.state.inverted=true;f.notify();assert.equal(f.controls.toggle.getAttribute('aria-pressed'),'false');
 }finally{f.close();}
});
