const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require(process.env.SETKA_JSDOM||'C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
function boot(width=1200,saved,setup){
 const dom=new JSDOM('<body><button id="bTemplateSave" disabled></button><div id="source"><button>control</button></div></body>',{url:'http://test/',runScripts:'outside-only'}),w=dom.window;
 Object.defineProperty(w,'innerWidth',{value:width,writable:true});if(saved)w.localStorage.setItem('mayatnik-template-panel-width',String(saved));
 const frames=[];w.requestAnimationFrame=f=>(frames.push(f),frames.length);w.HTMLElement.prototype.setPointerCapture=function(id){this.capture=id;};w.HTMLElement.prototype.releasePointerCapture=function(){this.capture=null;};
 w.structuredClone=structuredClone;w.HTMLCanvasElement.prototype.getContext=()=>null;w.HTMLElement.prototype.scrollIntoView=function(){this.scrolled=true;};if(setup)setup(w);
 w.eval(fs.readFileSync(path.join(__dirname,'mayatnik-template-folders.js'),'utf8'));w.eval(fs.readFileSync(path.join(__dirname,'mayatnik-template-panel.js'),'utf8'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 const panel=w.document.getElementById('mayatnikTemplatePanel'),handle=w.document.querySelector('.mtp-resize');
 const flush=()=>{while(frames.length)frames.shift()();},value=()=>parseFloat(w.document.body.style.getPropertyValue('--may-template-panel-width'));
 const fire=(type,x,id=1)=>{const e=new w.MouseEvent(type,{bubbles:true,button:0,clientX:x,cancelable:true});Object.defineProperty(e,'pointerId',{value:id});handle.dispatchEvent(e);};
 const key=(key,shiftKey=false)=>handle.dispatchEvent(new w.KeyboardEvent('keydown',{key,shiftKey,bubbles:true,cancelable:true}));
 w.MayatnikTemplatePanel.setOpen(true);flush();return {dom,w,panel,handle,flush,value,fire,key};
}
test('default panel is half viewport; separate source controls, four card columns and common layout width remain intact',()=>{
 const a=boot();try{assert.equal(a.value(),600);assert.equal(a.handle.hidden,false);assert.equal(a.handle.getAttribute('role'),'separator');assert.equal(a.handle.getAttribute('aria-orientation'),'vertical');
  const source=a.w.document.getElementById('source');assert.ok(!a.panel.contains(source));assert.equal(a.panel.querySelector('.mtp-controls'),null);
  const css=fs.readFileSync(path.join(__dirname,'mayatnik-template-panel.css'),'utf8');assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);assert.match(css,/#cellInkBar\{left:calc\(\(100vw - var\(--may-template-panel-width\)\)\/2\)/);assert.doesNotMatch(css,/37\.5vw|75vw|25vw|--may-template-panel-width:100vw/);
 }finally{a.dom.window.close();}
});
test('saving reveals a new root card from an open subfolder and existing cards in their saved parent',async()=>{
 const list=[{id:'old',name:'Old',parts:[]}];let state={selectedId:'',message:'Сохранено'},clicks=0;
 const a=boot(1200,null,w=>{w.localStorage.setItem('mayatnik-template-folders-v1',JSON.stringify({nodes:[{kind:'folder',id:'f',name:'Folder',parent:''},{kind:'template',id:'old',parent:'f'}]}));w.mayTemplateLibrary={list:()=>list,allIds:()=>list.map(n=>n.id),getState:()=>state,subscribe:()=>()=>{},refresh(){}};});
 try{a.panel.querySelector('.mtp-folder .mtp-preview').click();assert.equal(a.panel.querySelector('[data-template-id="old"]')?.dataset.templateId,'old');
  list.push({id:'new',name:'New',parts:[]});a.w.dispatchEvent(new a.w.CustomEvent('may-template-saved',{detail:{id:'new'}}));a.flush();assert.ok(a.panel.querySelector('[data-template-id="new"]').scrolled);assert.equal(a.panel.querySelector('[data-template-id="old"]'),null);
  a.w.dispatchEvent(new a.w.CustomEvent('may-template-saved',{detail:{id:'old'}}));a.flush();assert.ok(a.panel.querySelector('[data-template-id="old"]').scrolled);assert.equal(a.panel.querySelector('[data-template-id="new"]'),null);
  const source=a.w.document.getElementById('bTemplateSave'),proxy=a.panel.querySelector('[data-library-save]');assert.equal(proxy.disabled,true);source.onclick=()=>clicks++;source.disabled=false;await Promise.resolve();assert.equal(proxy.disabled,false);proxy.click();assert.equal(clicks,1);assert.equal(a.panel.querySelector('.mtp-status').textContent,'Сохранено');
 }finally{a.dom.window.close();}
});
test('left edge drag captures pointer, grows panel leftwards, saves width and restores it',()=>{
 const a=boot();try{a.fire('pointerdown',600);assert.equal(a.handle.capture,1);a.fire('pointermove',450,2);assert.equal(a.value(),600);a.fire('pointermove',450);assert.equal(a.value(),750);a.fire('pointerup',450);a.flush();assert.equal(a.handle.capture,null);assert.equal(a.w.localStorage.getItem('mayatnik-template-panel-width'),'750');
  const b=boot(1200,750);try{assert.equal(b.value(),750);}finally{b.dom.window.close();}
 }finally{a.dom.window.close();}
});
test('cancel, lost capture, blur and close restore the start width without persisting a partial gesture',()=>{
 for(const end of ['pointercancel','lostpointercapture','blur','close']){const a=boot(1200,700);try{a.fire('pointerdown',500);a.fire('pointermove',400);assert.equal(a.value(),800);
  if(end==='blur')a.w.dispatchEvent(new a.w.Event('blur'));else if(end==='close')a.w.MayatnikTemplatePanel.setOpen(false);else a.fire(end,400);a.flush();assert.equal(a.value(),700);assert.equal(a.w.localStorage.getItem('mayatnik-template-panel-width'),'700');assert.equal(a.w.document.body.classList.contains('may-template-panel-resizing'),false);
 }finally{a.dom.window.close();}}
});
test('keyboard separator supports arrows, Shift, Home and End; narrow viewport clamps without losing preference',()=>{
 const a=boot();try{a.key('ArrowLeft');assert.equal(a.value(),610);a.key('ArrowRight',true);assert.equal(a.value(),570);a.key('Home');assert.equal(a.value(),240);a.key('End');assert.equal(a.value(),1142);a.flush();
  a.w.innerWidth=390;a.w.dispatchEvent(new a.w.Event('resize'));assert.equal(a.value(),332);assert.equal(a.handle.getAttribute('aria-valuemax'),'332');assert.equal(a.w.localStorage.getItem('mayatnik-template-panel-width'),'1142');
  a.w.innerWidth=1200;a.w.dispatchEvent(new a.w.Event('resize'));assert.equal(a.value(),1142);
  a.w.MayatnikTemplatePanel.setOpen(false);assert.equal(a.handle.hidden,true);a.w.MayatnikTemplatePanel.setOpen(true);assert.equal(a.handle.hidden,false);
 }finally{a.dom.window.close();}
 const small=boot(390);try{assert.equal(small.value(),195);}finally{small.dom.window.close();}
});
