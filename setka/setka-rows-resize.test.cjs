const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Resize=require('./setka-rows-resize.js');
test('pane width preserves canvas space and reaches the numbers-only minimum',()=>{
 assert.equal(Resize.clamp(260,1200),260);assert.equal(Resize.clamp(4000,1200),900);assert.equal(Resize.clamp(-20,1200),64);assert.equal(Resize.clamp(260,220),64);assert.equal(Resize.clamp(NaN,1200),260);
});
function fixture(saved){
 let JSDOM;for(const p of ['jsdom',process.env.SETKA_JSDOM,path.join(process.env.TEMP||'/tmp','codex-setka-dom/node_modules/jsdom')].filter(Boolean))try{({JSDOM}=require(p));break;}catch{}
 if(!JSDOM)throw new Error('Set SETKA_JSDOM to an installed jsdom package. No browser is used.');
 const dom=new JSDOM('<div class="grids-workspace"><canvas></canvas><aside id="gridsRowsPane"><div class="grids-rows-head">СТРОКИ</div><div class="tools"><button>Копия</button></div><div id="gridsRowsList"><div class="grids-row"><button>1</button><div class="grids-row-editor"><input value="101"></div></div></div><div id="gridsRowsInfo"></div></aside></div>',{url:'http://setka.test/',runScripts:'outside-only'}),w=dom.window,doc=w.document,frames=[];
 const media={matches:false,addEventListener(){}};let width=1200,renders=0;
 w.matchMedia=()=>media;w.requestAnimationFrame=fn=>{frames.push(fn);return frames.length;};w.renderRmb=()=>renders++;w.setkaMenuRefresh=()=>{};
 doc.querySelector('.grids-workspace').getBoundingClientRect=()=>({width});
 if(saved!==undefined)w.localStorage.setItem(Resize.KEY,JSON.stringify(saved));
 w.localStorage.setItem('zerklus_setka_v1','{"grids":{"rows":["101"]}}');
 w.eval(fs.readFileSync(path.join(__dirname,'setka-rows-resize.js'),'utf8'));w.SetkaRowsResize.mount();
 const pane=doc.getElementById('gridsRowsPane'),handle=doc.querySelector('.setka-rows-resize');handle.setPointerCapture=()=>{};handle.releasePointerCapture=()=>{};
 const flush=()=>{for(let i=0;i<5&&frames.length;i++)frames.splice(0).forEach(fn=>fn());assert.equal(frames.length,0);};flush();
 const pointer=(type,x,id=1)=>{const e=new w.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x});Object.defineProperty(e,'pointerId',{value:id});handle.dispatchEvent(e);flush();};
 const key=(key,shiftKey=false)=>{handle.dispatchEvent(new w.KeyboardEvent('keydown',{bubbles:true,cancelable:true,key,shiftKey}));flush();};
 return {dom,w,doc,pane,handle,pointer,key,flush,get renders(){return renders;},resize(n,mobile=false){width=n;media.matches=mobile;w.dispatchEvent(new w.Event('resize'));flush();}};
}
test('dragging the left border changes width, saves it and preserves all bit data',()=>{
 const f=fixture();try{
  const input=f.doc.querySelector('input');input.focus();f.pointer('pointerdown',800);assert.equal(f.doc.activeElement,f.handle);
  f.pointer('pointermove',700);assert.equal(f.pane.style.getPropertyValue('--setka-rows-width'),'360px');assert.ok(f.w.document.body.classList.contains('setka-resizing-rows'));
  f.pointer('pointerup',700);assert.equal(f.w.localStorage.getItem(Resize.KEY),'360');assert.equal(f.w.document.body.classList.contains('setka-resizing-rows'),false);
  f.pointer('pointerdown',800);f.pointer('pointermove',1200);f.pointer('pointerup',1200);assert.equal(f.pane.style.getPropertyValue('--setka-rows-width'),'64px');assert.ok(f.pane.classList.contains('setka-rows-collapsed'));
  assert.equal(input.value,'101');assert.equal(f.w.localStorage.getItem('zerklus_setka_v1'),'{"grids":{"rows":["101"]}}');assert.equal(f.handle.getAttribute('aria-valuetext'),'Только номера строк');assert.ok(f.renders>1);
 }finally{f.dom.window.close();}
});
test('cancel restores width; keyboard collapse and expand are persisted',()=>{
 const f=fixture(400);try{
  f.pointer('pointerdown',800);f.pointer('pointermove',650,2);assert.equal(f.pane.style.getPropertyValue('--setka-rows-width'),'400px');f.pointer('pointermove',650);f.pointer('pointercancel',650);assert.equal(f.pane.style.getPropertyValue('--setka-rows-width'),'400px');assert.equal(f.w.localStorage.getItem(Resize.KEY),'400');
  f.key('Home');assert.ok(f.pane.classList.contains('setka-rows-collapsed'));f.key('ArrowLeft');assert.equal(f.pane.style.getPropertyValue('--setka-rows-width'),'80px');assert.equal(f.pane.classList.contains('setka-rows-collapsed'),false);
  f.key('ArrowRight');assert.equal(f.w.localStorage.getItem(Resize.KEY),'64');f.key('End');assert.equal(f.pane.style.getPropertyValue('--setka-rows-width'),'900px');
  f.pointer('pointerdown',800);f.pointer('pointermove',900);f.key('Escape');assert.equal(f.pane.style.getPropertyValue('--setka-rows-width'),'900px');
 }finally{f.dom.window.close();}
});
test('mobile retains its full-width rows layout and restores saved desktop width',()=>{
 const f=fixture(500);try{
  f.resize(300,true);assert.equal(f.handle.hidden,true);assert.equal(f.pane.classList.contains('setka-rows-collapsed'),false);assert.equal(f.w.localStorage.getItem(Resize.KEY),'500');
  f.pointer('pointerdown',200);f.pointer('pointermove',10);f.pointer('pointerup',10);assert.equal(f.w.localStorage.getItem(Resize.KEY),'500');
  f.resize(1200);assert.equal(f.handle.hidden,false);assert.equal(f.pane.style.getPropertyValue('--setka-rows-width'),'500px');
  const css=fs.readFileSync(path.join(__dirname,'setka.css'),'utf8');assert.match(css,/#gridsRowsPane\.setka-rows-collapsed \.grids-row-editor\{display:none!important\}/);assert.match(css,/\.setka-rows-resizable\{flex:0 0 auto;width:100%;min-width:0;max-width:100%\}/);
 }finally{f.dom.window.close();}
 const collapsed=fixture(64);try{assert.ok(collapsed.pane.classList.contains('setka-rows-collapsed'));assert.equal(collapsed.doc.querySelectorAll('.setka-rows-resize').length,1);}finally{collapsed.dom.window.close();}
});
