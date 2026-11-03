const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let JSDOM;try{({JSDOM}=require('jsdom'));}catch{
 const base=process.env.LOCALAPPDATA||path.join(process.env.USERPROFILE||'','AppData','Local');
 ({JSDOM}=require(path.join(base,'Temp','codex-horr-dom','node_modules','jsdom')));
}
const {create}=require('./mayatnik-gif-strip.js');
function fixture(saved,blocked=false,withObserver=false){
 const dom=new JSDOM('<!doctype html><body><header></header><div id="wrap" style="flex:1;min-height:0"></div><footer></footer></body>',{url:'https://example.test'}),w=dom.window;
 const revoked=[],created=[],wrap=w.document.getElementById('wrap');wrap.getBoundingClientRect=()=>({height:540});
 if(saved!==undefined)w.localStorage.setItem('mayatnik.gifStrip.size.v1',JSON.stringify(saved));
 if(blocked)Object.defineProperty(w,'localStorage',{get(){throw Error('blocked');}});
 w.URL.createObjectURL=blob=>{created.push(blob);return 'blob:test-'+created.length;};w.URL.revokeObjectURL=url=>revoked.push(url);
 let observer;const scrolled=[];w.HTMLElement.prototype.scrollIntoView=function(options){scrolled.push({element:this,options});};
 if(withObserver)w.IntersectionObserver=class{constructor(callback,options){this.callback=callback;this.options=options;this.targets=[];observer=this;}observe(node){this.targets.push(node);}disconnect(){this.targets=[];}};
 const api=create(w),frames=[12,24,36].map(rows=>({rows,blob:new w.Blob(['GIF89a'],{type:'image/gif'})}));
 const show=(options={})=>api.show(frames,{width:400,height:200,name:'Тест.gif',...options});
 const q=s=>w.document.querySelector(s),qa=s=>[...w.document.querySelectorAll(s)];
 function event(node,type,extra={}){const e=new w.Event(type,{bubbles:true,cancelable:true});Object.assign(e,extra);node.dispatchEvent(e);return e;}
 const edge=()=>parseFloat(q('#mayGifStrip').style.getPropertyValue('--may-gif-width'));
 return {dom,w,api,show,frames,q,qa,event,edge,revoked,created,wrap,scrolled,get observer(){return observer;}};
}
test('mount is after viewport, exact images/captions and fixed field height; hiding restores inline styles',()=>{
 const f=fixture();assert.equal(f.api.open(),false);assert.equal(f.show(),true);
 const strip=f.q('#mayGifStrip');assert.equal(f.wrap.nextElementSibling,strip);assert.equal(f.wrap.style.flex,'0 0 auto');assert.equal(f.wrap.style.height,'540px');
 assert.equal(f.qa('img').length,3);assert.equal(f.qa('canvas').length,0);assert.equal(f.created[1],f.frames[1].blob);assert.match(f.qa('.may-gif-strip-caption')[1].textContent,/2 · 24/);
 assert.equal(f.q('.may-gif-strip-header button').classList.contains('gz-hx'),true);
 f.api.hide();assert.equal(strip.hidden,true);assert.equal(f.wrap.style.flex,'1 1 0%');assert.equal(f.wrap.style.height,'');assert.equal(f.api.open(),true);assert.equal(strip.hidden,false);f.dom.window.close();
});
test('any frame selects, keyboard selection and proportional shared resize survive reopen and reload',()=>{
 const f=fixture();f.show();const buttons=f.qa('.may-gif-strip-select');buttons[1].click();assert.equal(buttons[1].getAttribute('aria-pressed'),'true');
 f.event(buttons[1],'keydown',{key:'ArrowRight'});assert.equal(buttons[2].getAttribute('aria-pressed'),'true');assert.equal(f.w.document.activeElement,buttons[2]);
 const handle=f.qa('.may-gif-strip-resize')[2];assert.equal(handle.hidden,false);const before=f.edge();f.event(handle,'keydown',{key:'ArrowRight'});assert.equal(f.edge(),before+8);
 const h=parseFloat(f.q('#mayGifStrip').style.getPropertyValue('--may-gif-height'));assert.equal(f.edge()/h,2);
 f.api.hide();f.api.open();assert.equal(buttons[2].getAttribute('aria-pressed'),'true');assert.equal(f.edge(),before+8);
 const saved=JSON.parse(f.w.localStorage.getItem('mayatnik.gifStrip.size.v1')),g=fixture(saved);g.show();assert.equal(g.edge(),f.edge());f.dom.window.close();g.dom.window.close();
});
test('pointer resize uses original pointer position for later frames; cancel/lost capture terminate safely',()=>{
 const f=fixture();f.show();const handle=f.qa('.may-gif-strip-resize')[2],start=f.edge();
 f.event(handle,'pointerdown',{pointerId:9,button:0,clientX:100,clientY:100});
 f.event(handle,'pointermove',{pointerId:9,clientX:150,clientY:125});assert.equal(f.edge(),start+50);
 f.event(handle,'pointermove',{pointerId:9,clientX:200,clientY:150});assert.equal(f.edge(),start+100);assert.equal(f.wrap.style.height,'540px');
 f.event(handle,'pointercancel',{pointerId:9});const end=f.edge();f.event(handle,'pointermove',{pointerId:9,clientX:999,clientY:999});assert.equal(f.edge(),end);
 f.event(handle,'pointerdown',{pointerId:10,button:0,clientX:0,clientY:0});f.event(handle,'lostpointercapture');f.event(handle,'pointermove',{pointerId:10,clientX:999,clientY:999});assert.equal(f.edge(),end);f.dom.window.close();
});
test('all interaction bubbles stay inside strip while scrolling keeps default behavior',()=>{
 const f=fixture();f.show();let escaped=0;for(const type of ['keydown','pointerdown','wheel','touchmove','click'])f.w.document.body.addEventListener(type,()=>escaped++);
 const button=f.q('.may-gif-strip-select');for(const type of ['pointerdown','wheel','touchmove','click'])assert.equal(f.event(button,type).defaultPrevented,false);
 f.event(button,'keydown',{key:' '});assert.equal(escaped,0);f.dom.window.close();
});
test('size is bounded and corrupt/blocked storage does not prevent showing frames',()=>{
 for(const value of ['bad',-1,1e99]){const f=fixture(value);f.show();assert.ok(f.edge()>=96&&f.edge()<=2048);const h=f.q('.may-gif-strip-resize');f.event(h,'keydown',{key:'Home'});assert.equal(f.edge(),96);f.event(h,'keydown',{key:'End'});assert.ok(f.edge()<=2048);f.dom.window.close();}
 const f=fixture(undefined,true);assert.equal(f.show(),true);f.event(f.q('.may-gif-strip-resize'),'keydown',{key:'ArrowRight'});f.dom.window.close();
});
test('replacement and pagehide revoke every old URL; invalid or failed replacements preserve existing strip',()=>{
 const f=fixture();f.show();const old=f.qa('img').map(img=>img.src);assert.equal(f.api.show([],{width:1,height:1}),false);assert.deepEqual(f.revoked,[]);
 f.show({name:'Next'});assert.deepEqual(f.revoked,old);assert.equal(f.qa('img').length,3);
 let count=0;f.w.URL.createObjectURL=()=>{if(count++)throw Error('allocation failed');return 'blob:partial';};assert.equal(f.show(),false);assert.equal(f.qa('img').length,3);assert.equal(f.revoked.at(-1),'blob:partial');
 const current=f.qa('img').map(img=>img.src);f.event(f.w,'pagehide');for(const url of current)assert.ok(f.revoked.includes(url));assert.equal(f.api.open(),false);assert.equal(f.wrap.style.height,'');f.dom.window.close();
});
test('stylesheet leaves shared images pixelated with visible scrollbars and normal document layout',()=>{
 const css=fs.readFileSync(path.join(__dirname,'mayatnik-gif-strip.css'),'utf8');assert.match(css,/image-rendering:pixelated/);assert.match(css,/overflow:auto/);assert.match(css,/scrollbar-width:auto/);assert.match(css,/touch-action:none/);assert.match(css,/min-height:min\(48dvh,calc\(var\(--may-gif-height\) \+ \d+px\)\)/);assert.match(css,/overflow-anchor:none/);assert.doesNotMatch(css,/position:fixed|position:absolute[^}]*#mayGifStrip/);
});
test('only viewport-near images activate, distant images release decode sources and reopening reveals strip',()=>{
 const f=fixture(undefined,false,true);f.show();const images=f.qa('img'),observer=f.observer;
 assert.equal(observer.options.root,f.q('.may-gif-strip-track'));assert.equal(observer.targets.length,3);for(const img of images){assert.equal(img.hasAttribute('src'),false);assert.equal(img.loading,'lazy');assert.equal(img.decoding,'async');}
 observer.callback([{target:images[1],isIntersecting:true}]);assert.equal(images[1].src,images[1].dataset.frameUrl);assert.equal(images[0].hasAttribute('src'),false);
 observer.callback([{target:images[1],isIntersecting:false}]);assert.equal(images[1].hasAttribute('src'),false);assert.equal(f.revoked.length,0);
 f.api.hide();f.api.open();assert.equal(f.scrolled.at(-1).element,f.q('#mayGifStrip'));assert.equal(f.scrolled.at(-1).options.block,'nearest');
 f.show();assert.equal(observer.targets.length,3);assert.equal(observer.targets[0],f.qa('img')[0]);f.event(f.w,'pagehide');assert.equal(observer.targets.length,0);f.dom.window.close();
});
test('desktop/mobile grid append a final row without changing existing rows or field placement',()=>{
 for(const [tracks,row]of [['42px 0px 0px 540px 18px 30px','4'],['80px 36px 0px 0px 540px 18px 30px','5']]){
  const f=fixture(),body=f.w.document.body;body.style.display='grid';body.style.gridTemplateRows=tracks;body.style.overflowY='hidden';f.wrap.style.gridRow=row;f.wrap.style.gridColumn='2';
  f.show();const section=f.q('#mayGifStrip');assert.equal(section.style.gridRow,String(tracks.split(' ').length+1));assert.equal(section.style.gridColumn,'1 / -1');assert.equal(body.style.gridTemplateRows,tracks+' auto');assert.equal(body.style.getPropertyPriority('grid-template-rows'),'important');assert.equal(body.style.overflowY,'auto');assert.equal(f.wrap.style.gridRow,row);
  const oldRows=body.style.gridTemplateRows;f.event(f.q('.may-gif-strip-resize'),'keydown',{key:'ArrowDown'});assert.equal(body.style.gridTemplateRows,oldRows);
  f.api.hide();assert.equal(body.style.gridTemplateRows,tracks);assert.equal(body.style.getPropertyPriority('grid-template-rows'),'');assert.equal(body.style.overflowY,'hidden');assert.equal(f.wrap.style.gridRow,row);f.dom.window.close();
 }
});
