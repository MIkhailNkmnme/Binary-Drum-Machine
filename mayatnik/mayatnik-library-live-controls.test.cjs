'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
let JSDOM;try{({JSDOM}=require('jsdom'));}catch(_){({JSDOM}=require('C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom'));}
const menu=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8');
function fn(name){const start=menu.indexOf('  function '+name+'(');assert.ok(start>=0);let end=menu.indexOf('{',start)+1,depth=1;for(;depth;end++){if(menu[end]==='{')depth++;if(menu[end]==='}')depth--;}return menu.slice(start,end);}
function fixture({detached=false,opener}={}){
 const dom=new JSDOM('<button id="bTemplatePanel"></button><button id="bTemplateSave" disabled></button><div class="bar"><select id="gifScaleSequence" title="Последовательность масштабов"><option value="powers2">Степени 2</option></select><select id="gifScaleMethod"><option value="majority">Большинство</option></select><input id="gifScaleDelay" type="number" value="200"><button id="bGifScaleInfo">Сведения</button></div><div id="rail"><div class="gz-group" data-id="xorrom"><div class="gz-soty"></div></div></div>',{url:'https://example.test/mayatnik/',runScripts:'outside-only'}),w=dom.window;
 w.structuredClone=structuredClone;w.requestAnimationFrame=()=>1;w.MayatnikLibraryDetached=detached;w.MayatnikXorromBank=[];w.HTMLMediaElement.prototype.pause=function(){};w.HTMLMediaElement.prototype.load=function(){};w.HTMLCanvasElement.prototype.getContext=()=>null;if(opener)w.opener=opener;
 w.eval(fs.readFileSync(__dirname+'/mayatnik-template-folders.js','utf8'));w.eval(fs.readFileSync(__dirname+'/mayatnik-template-panel.js','utf8'));w.eval(fs.readFileSync(__dirname+'/mayatnik-music-panel.js','utf8'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 w.MayatnikXorromControls=require('./mayatnik-xorrom-controls.js');w.eval('const $=id=>document.getElementById(id);'+fn('mountXorromMenu')+'\n'+fn('mountGifLibraryControls'));
 const d=w.document,control=w.MayatnikTemplatePanel;return {w,d,control,close(){w.dispatchEvent(new w.Event('pagehide'));w.close();}};
}
test('actual Xorrom menu mounts one live settings host in its side window while Library retains working presets',async()=>{
 const f=fixture(),calls=[];let settings={bpm:96},listener;const api={getSettings:()=>settings,getState:()=>({state:'stopped'}),setSettings(p){settings={...settings,...p};listener?.();},start(){calls.push('start');},stop(){calls.push('stop');},subscribe(fn){listener=fn;return()=>listener=null;}};
 try{
  const controls=f.w.mountXorromMenu({el:f.d.getElementById('rail'),refresh(){}},api),body=f.d.querySelector('#rail .gz-soty');
  assert.deepEqual([...body.querySelectorAll('[data-xorrom]')].map(n=>n.dataset.xorrom),['start','stop']);assert.equal(body.children.length,3);
  const panel=f.w.MayatnikMusicPanel,launch=body.lastElementChild,bpm=f.d.querySelector('#mayMusicSettingsPane [data-xorrom="bpm"] input'),liveHost=bpm.closest('.mtp-live-controls');assert.ok(bpm);assert.equal(f.d.querySelectorAll('[data-xorrom="bpm"]').length,1);assert.equal(f.d.querySelectorAll('#mayMusicSettingsPane>.mtp-live-controls').length,1);assert.equal(panel.isOpen(),false);assert.equal(launch.getAttribute('aria-pressed'),'false');
  launch.click();assert.equal(panel.isOpen(),true);assert.equal(launch.getAttribute('aria-pressed'),'true');assert.equal(f.control.isOpen(),false);bpm.value='123.5';bpm.dispatchEvent(new f.w.Event('change'));assert.equal(settings.bpm,123.5);
  launch.click();assert.equal(panel.isOpen(),false);assert.equal(launch.getAttribute('aria-pressed'),'false');assert.equal(bpm.isConnected,true);api.setSettings({bpm:87});assert.equal(bpm.value,'87');
  launch.click();assert.equal(f.d.querySelector('[data-xorrom="bpm"] input'),bpm);assert.equal(bpm.closest('.mtp-live-controls'),liveHost);
  const presetCalls=[];f.w.mayXorromLibrary={getState:()=>({}),list:()=>[{id:'preset',name:'Музыкальный пример'}],subscribe:()=>()=>{},open:id=>presetCalls.push(id)};
  f.control.openTab('music');assert.equal(panel.isOpen(),false);assert.equal(launch.getAttribute('aria-pressed'),'false');const presetPane=f.d.querySelector('#mayMusicPane');assert.equal(presetPane.hidden,false);assert.equal(presetPane.querySelector('[data-library-controls],.mtp-live-controls,[data-xorrom]'),null);assert.ok(presetPane.querySelector('[data-music-id="preset"]'));presetPane.querySelector('[data-music-action="open"]').click();await Promise.resolve();assert.deepEqual(presetCalls,['preset']);assert.deepEqual(calls,[],'opening either window never starts sound');
  launch.click();assert.equal(f.control.isOpen(),false);assert.equal(panel.isOpen(),true);assert.equal(f.d.querySelectorAll('[data-xorrom="bpm"]').length,1);assert.equal(f.d.querySelector('#mayMusicSettingsPane>.mtp-live-controls'),liveHost);
  body.querySelector('[data-xorrom="start"]').click();await Promise.resolve();assert.deepEqual(calls,['start']);body.querySelector('[data-xorrom="stop"]').click();assert.deepEqual(calls,['start','stop']);
  controls.destroy();assert.equal(f.d.querySelector('[data-xorrom="bpm"]'),null);assert.equal(listener,null);
 }finally{f.close();}
});
test('GIF library adopts original controls with unchanged values, identity, handlers and IDs',()=>{
 const f=fixture();try{
  const before=['gifScaleSequence','gifScaleMethod','gifScaleDelay','bGifScaleInfo'].map(id=>f.d.getElementById(id));let changes=0,info=0;before[2].addEventListener('change',()=>changes++);before[3].onclick=()=>info++;
  f.w.mountGifLibraryControls();f.control.openTab('gif');assert.equal(f.d.getElementById('mayGifSettingsPane').hidden,false);assert.equal(f.d.getElementById('mayMusicPane').hidden,true);
  for(const node of before){assert.ok(node.closest('#mayGifSettingsPane'));assert.equal(f.d.querySelectorAll('#'+node.id).length,1);assert.equal(f.d.getElementById(node.id),node);}
  assert.equal(before[0].value,'powers2');assert.equal(before[1].value,'majority');assert.equal(before[2].value,'200');before[2].value='450';before[2].dispatchEvent(new f.w.Event('change'));before[3].click();assert.equal(changes,1);assert.equal(info,1);
  f.control.setOpen(false);f.control.openTab('gif');assert.equal(before[2].value,'450');assert.match(f.d.querySelector('.mtp-header-path').textContent,/GIF/);
 }finally{f.close();}
});
test('detached GIF settings opens the main library; detached Music retains presets without a live-settings launcher',()=>{
 const main=fixture();let redirected=0,focused=0;main.w.focus=()=>focused++;const popup={closed:false,focus(){},MayatnikTemplatePanel:{openTab(){redirected++;}}};main.w.open=()=>popup;
 let detached;try{
  main.control.openTab('music');main.d.querySelector('[data-library-window]').click();assert.equal(main.control.isOpen(),false);
  main.control.openTab('gif');assert.equal(redirected,1);assert.equal(main.control.isOpen(),false);
  detached=fixture({detached:true,opener:main.w});detached.control.openTab('gif');const launch=detached.d.querySelector('#mayGifSettingsPane [data-library-controls] button');assert.match(launch.title,/главного окна/);launch.click();
  assert.equal(main.control.isOpen(),true);assert.equal(main.d.querySelector('#mayatnikTemplatePanel').dataset.tab,'gif');assert.equal(redirected,1);assert.equal(focused,1);
  detached.control.openTab('music');assert.equal(detached.d.querySelector('#mayMusicPane [data-library-controls]'),null);assert.ok(detached.d.querySelector('#mayMusicPane .mtp-music-grid'));assert.equal(main.d.querySelector('#mayatnikTemplatePanel').dataset.tab,'gif');
  Object.defineProperty(main.w,'closed',{value:true,configurable:true});launch.click();assert.equal(launch.disabled,true);assert.match(launch.parentElement.textContent,/закрыт или перезагружен/);
 }finally{detached?.close();main.close();}
});
