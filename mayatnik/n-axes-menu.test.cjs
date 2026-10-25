const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require(process.env.SETKA_JSDOM||'C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
const source=fs.readFileSync(path.join(__dirname,'mayatnik-menu.js'),'utf8'),start=source.indexOf('  function installNAxesMenu('),end=source.indexOf('  const manualAxesRow=',start);
function boot(){const dom=new JSDOM('<div id="row"><button data-n="old">Old</button></div>',{runScripts:'outside-only'}),w=dom.window,row=w.document.getElementById('row');
 let state={enabled:false,n:3,count:0,selectedId:null},listener,removed=0,unsubscribed=0;
 const api={get:()=>state,toggle(){state.enabled=!state.enabled;listener?.();},setN(n){state.n=n;listener?.();},removeSelected(){removed++;state.selectedId=null;listener?.();},subscribe(fn){listener=fn;return()=>unsubscribed++;}};
 w.ptNames={};w.toolSync=[];w.ptBtn=(id,kind,src,onclick)=>{const b=w.document.createElement('button');b.dataset.n=id;b.dataset.icon=kind;b.onclick=onclick;b.append(w.document.createElement('i'));return b;};
 w.eval(fs.readFileSync(path.join(__dirname,'../_js/control-frame.js'),'utf8'));w.eval(source.slice(start,end)+';window.installNAxesMenu=installNAxesMenu;');w.installNAxesMenu(row,api);
 return{dom,w,row,api,state,notify:()=>listener?.(),removed:()=>removed,unsubscribed:()=>unsubscribed};}
test('appends N-axis controls with stable keys and shared numeric frame; existing order is untouched',()=>{const a=boot();try{
 assert.deepEqual([...a.row.children].map(n=>n.dataset.n),['old','nAxesToggle','nAxesCount','nAxesRemove']);assert.equal(a.row.querySelector('[data-n=nAxesToggle]').dataset.icon,'axes');
 const box=a.row.querySelector('[data-n=nAxesCount]');assert.ok(box.classList.contains('zcf-control'));assert.equal(box.querySelector('input').value,'3');assert.equal(box.querySelector('input').min,'1');assert.equal(box.querySelector('input').max,'64');assert.equal(box.querySelectorAll('.zcf-outline').length,3);
 a.w.installNAxesMenu(a.row,a.api);assert.equal(a.row.children.length,4);
 }finally{a.dom.window.close();}});
test('toggle and shared arrows change host state; numeric edits clamp to 1..64',()=>{const a=boot();try{const toggle=a.row.querySelector('[data-n=nAxesToggle]'),input=a.row.querySelector('input'),arrows=a.row.querySelectorAll('.gz-a');
 toggle.click();assert.equal(a.state.enabled,true);assert.equal(toggle.getAttribute('aria-pressed'),'true');arrows[1].click();assert.equal(a.state.n,4);arrows[0].click();assert.equal(a.state.n,3);
 for(const [value,n]of [['99',64],['0',1],['5.7',6]]){input.value=value;input.dispatchEvent(new a.w.Event('change'));assert.equal(a.state.n,n);assert.equal(input.value,String(n));}
 input.value='';input.dispatchEvent(new a.w.Event('change'));assert.equal(input.value,'6');
 }finally{a.dom.window.close();}});
test('selection subscription controls delete and updates N; deletion affects only the host selected set',()=>{const a=boot();try{const remove=a.row.querySelector('[data-n=nAxesRemove]');assert.equal(remove.disabled,true);remove.click();assert.equal(a.removed(),0);
 Object.assign(a.state,{selectedId:'set-2',n:11,count:3});a.notify();assert.equal(remove.disabled,false);assert.equal(a.row.querySelector('input').value,'11');remove.click();assert.equal(a.removed(),1);assert.equal(remove.disabled,true);assert.equal(a.state.count,3);
 a.w.dispatchEvent(new a.w.Event('pagehide'));assert.equal(a.unsubscribed(),1);
 }finally{a.dom.window.close();}});
