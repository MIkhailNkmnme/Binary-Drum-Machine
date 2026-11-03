const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require(process.env.SETKA_JSDOM||'C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
const menu=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8');
const mount=menu.slice(menu.indexOf('  function mountXorromMenu('),menu.indexOf('  window.mayXorromControls=mountXorromMenu(rail);'));
const layout=menu.slice(menu.indexOf('  const relayout = () =>'),menu.indexOf('  // v0.042:',menu.indexOf('  const relayout = () =>'))).replace('const relayout =','window.testRelayout =');
function fixture(){
 const dom=new JSDOM('<div id="rail"></div><div id="right"></div><div id="tools"></div>',{url:'https://test/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.eval(fs.readFileSync(__dirname+'/../_js/grozd.js','utf8'));
 w.eval(fs.readFileSync(__dirname+'/mayatnik-xorrom-controls.js','utf8'));
 w.MayatnikTemplatePanel={registerControls(key,host){host.id='live-'+key;w.document.body.append(host);},openTab(){}};
 let state={state:'stopped',notes:[]},settings={},listener,starts=0;
 w.mayXorrom={getSettings:()=>settings,getState:()=>state,setSettings:p=>{Object.assign(settings,p);listener?.();},subscribe:fn=>{listener=fn;return()=>{};},start:async()=>{starts++;state={state:'playing',notes:[]};listener?.();},pause:()=>{state.state='paused';listener?.();},stop:()=>{state.state='stopped';listener?.();},exportWav:async()=>({blob:new w.Blob(['x'])})};
 const rail=w.ZerkGrozd.rail(w.document.getElementById('rail'),{key:'xorrom-test',groups:[{id:'xorrom',title:'Xorrom',items:[]}]});
 const group=rail.el.querySelector('[data-id="xorrom"]');assert.equal(group.querySelector('.gz-soty'),null);assert.ok(group.gzSoty);
 w.rail=rail;w.railR=w.document.getElementById('right');w.tools=w.document.getElementById('tools');w.eval(mount);w.eval(layout);
 return {dom,w,rail,group,get starts(){return starts;},settings};
}
test('real empty grozd group gains an attached music body, opens and lays out live controls',async()=>{
 const f=fixture(),controls=f.w.mountXorromMenu(f.rail),body=f.group.querySelector(':scope > .gz-soty');
 assert.ok(body);assert.equal(body,f.group.gzSoty);assert.equal(body.children.length,3);assert.equal(f.starts,0);
 const file=f.w.document.querySelector('#live-music [data-xorrom="jsonFile"]');assert.ok(file.hidden);assert.notEqual(file.parentElement,body);
 f.w.testRelayout();assert.ok(parseFloat(body.style.height)>0);
 const head=f.group.querySelector('.gz-head');head.click();assert.equal(f.group.classList.contains('gz-open'),true);
 const count=body.children.length,input=f.w.document.querySelector('#live-music [data-xorrom="bpm"] input');input.value='123';input.dispatchEvent(new f.w.Event('change',{bubbles:true}));assert.equal(f.settings.bpm,123);
 body.querySelector('[data-xorrom="start"]').click();await new Promise(setImmediate);assert.equal(f.starts,1);
 head.click();assert.equal(f.group.classList.contains('gz-open'),false);head.click();assert.equal(f.group.classList.contains('gz-open'),true);assert.equal(body.children.length,count);
 // The production adapter moves the intact group into the top tools strip.
 f.w.tools.append(f.group);f.w.testRelayout();f.rail.refresh();assert.ok(parseFloat(body.style.height)>0);assert.equal(body.querySelector('[data-xorrom="start"]').isConnected,true);
 controls.destroy();f.dom.window.close();
});
test('missing audio API leaves a normal header and can mount after API becomes available',()=>{
 const f=fixture();assert.equal(f.w.mountXorromMenu(f.rail,null),null);assert.equal(f.group.querySelector('.gz-soty'),null);
 const controls=f.w.mountXorromMenu(f.rail);assert.ok(controls);assert.equal(f.group.querySelectorAll(':scope > .gz-soty').length,1);controls.destroy();f.dom.window.close();
});

test('actual Mayatnik descriptors mount and refresh the shared Grozd rail; GIF settings is a command',()=>{
 const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8'),dom=new JSDOM(html,{url:'https://test/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 try{for(const path of ['../_js/menu-icons.js','../_js/group-header.js','../_js/grozd.js','mayatnik-menu-dock.js'])w.eval(fs.readFileSync(__dirname+'/'+path,'utf8'));
   let opened=null;w.MayatnikTemplatePanel={openTab:k=>{opened=k;}};
   const adapter=menu.slice(0,menu.indexOf('  function mountXorromMenu('))+'window.realRail=rail;})();';w.eval(adapter);w.realRail.refresh();
   const button=[...w.realRail.el.querySelectorAll('[data-id="gifscale"] button,[data-id="gifscale"] .gz-hx')].find(b=>b.textContent.includes('Настройки'));
   assert.ok(button);button.click();assert.equal(opened,'gif');
 }finally{dom.window.close();}
});
