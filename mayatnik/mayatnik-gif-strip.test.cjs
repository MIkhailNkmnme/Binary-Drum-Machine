const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let JSDOM;try{({JSDOM}=require(process.env.SETKA_JSDOM||'jsdom'));}catch{
 const base=process.env.LOCALAPPDATA||path.join(process.env.USERPROFILE||'','AppData','Local');
 ({JSDOM}=require(path.join(base,'Temp','codex-setka-dom','node_modules','jsdom')));
}
const {create}=require('./mayatnik-gif-strip.js');
function fixture(saved,blocked=false,withObserver=false,withPanelObserver=false){
 const dom=new JSDOM('<!doctype html><body><header></header><div id="wrap" style="flex:1;min-height:0"></div><footer></footer></body>',{url:'https://example.test'}),w=dom.window;
 const revoked=[],created=[],wrap=w.document.getElementById('wrap');wrap.getBoundingClientRect=()=>({height:540});
 if(saved!==undefined)w.localStorage.setItem('mayatnik.gifStrip.size.v1',JSON.stringify(saved));
 if(blocked)Object.defineProperty(w,'localStorage',{get(){throw Error('blocked');}});
 w.URL.createObjectURL=blob=>{created.push(blob);return 'blob:test-'+created.length;};w.URL.revokeObjectURL=url=>revoked.push(url);
 let observer,panelObserver;const scrolled=[];w.HTMLElement.prototype.scrollIntoView=function(options){scrolled.push({element:this,options});};
 if(withObserver)w.IntersectionObserver=class{constructor(callback,options){this.callback=callback;this.options=options;this.targets=[];observer=this;}observe(node){this.targets.push(node);}disconnect(){this.targets=[];}};
 if(withPanelObserver)w.ResizeObserver=class{constructor(callback){this.callback=callback;this.targets=[];panelObserver=this;}observe(node){this.targets.push(node);}disconnect(){this.targets=[];}};
 const api=create(w),frames=[12,24,36].map(rows=>({rows,blob:new w.Blob(['GIF89a'],{type:'image/gif'})}));
 const show=(options={})=>api.show(frames,{width:400,height:200,name:'Тест.gif',...options});
 const q=s=>w.document.querySelector(s),qa=s=>[...w.document.querySelectorAll(s)];
 function event(node,type,extra={}){const e=new w.Event(type,{bubbles:true,cancelable:true});Object.assign(e,extra);node.dispatchEvent(e);return e;}
 const edge=()=>parseFloat(q('#mayGifStrip').style.getPropertyValue('--may-gif-width'));
 return {dom,w,api,show,frames,q,qa,event,edge,revoked,created,wrap,scrolled,get observer(){return observer;},get panelObserver(){return panelObserver;}};
}
test('separate fixed dialog preserves field styles and document position through show, hide and reopen',()=>{
 const f=fixture();assert.equal(f.api.open(),false);assert.equal(f.show(),true);
 const strip=f.q('#mayGifStrip');assert.equal(strip.parentElement,f.w.document.body);assert.equal(strip.getAttribute('role'),'dialog');assert.equal(strip.getAttribute('aria-label'),'Гиф-Масштаб');assert.equal(strip.getAttribute('aria-modal'),'false');assert.equal(f.wrap.nextElementSibling.tagName,'FOOTER');assert.equal(f.wrap.style.flex,'1 1 0%');assert.equal(f.wrap.style.height,'');
 assert.equal(f.qa('img').length,3);assert.equal(f.qa('canvas').length,0);assert.equal(f.created[1],f.frames[1].blob);assert.match(f.qa('.may-gif-strip-caption')[1].textContent,/2 · 24/);
 assert.equal(f.q('.may-gif-strip-header button').classList.contains('gz-hx'),true);
 f.api.hide();assert.equal(strip.hidden,true);assert.equal(f.wrap.style.flex,'1 1 0%');assert.equal(f.wrap.style.height,'');assert.equal(f.api.open(),true);assert.equal(strip.hidden,false);assert.deepEqual(f.scrolled,[]);f.dom.window.close();
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
 f.event(handle,'pointermove',{pointerId:9,clientX:200,clientY:150});assert.equal(f.edge(),start+100);assert.equal(f.wrap.style.height,'');
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
test('stylesheet isolates a bounded resizable window with pixelated images and internal scrolling',()=>{
 const css=fs.readFileSync(path.join(__dirname,'mayatnik-gif-strip.css'),'utf8');assert.match(css,/image-rendering:pixelated/);assert.match(css,/overflow:auto/);assert.match(css,/scrollbar-width:auto/);assert.match(css,/touch-action:none/);assert.match(css,/#mayGifStrip\{position:fixed/);assert.match(css,/resize:both/);assert.match(css,/max-height:calc\(100dvh - 16px\)/);assert.match(css,/overflow-anchor:none/);assert.doesNotMatch(css,/#wrap|grid-template|body\{/);
});
test('only viewport-near images activate, distant images release decode sources and reopening reveals strip',()=>{
 const f=fixture(undefined,false,true);f.show();const images=f.qa('img'),observer=f.observer;
 assert.equal(observer.options.root,f.q('.may-gif-strip-track'));assert.equal(observer.targets.length,3);for(const img of images){assert.equal(img.hasAttribute('src'),false);assert.equal(img.loading,'lazy');assert.equal(img.decoding,'async');}
 observer.callback([{target:images[1],isIntersecting:true}]);assert.equal(images[1].src,images[1].dataset.frameUrl);assert.equal(images[0].hasAttribute('src'),false);
 observer.callback([{target:images[1],isIntersecting:false}]);assert.equal(images[1].hasAttribute('src'),false);assert.equal(f.revoked.length,0);
 f.api.hide();f.api.open();assert.deepEqual(f.scrolled,[]);
 f.show();assert.equal(observer.targets.length,3);assert.equal(observer.targets[0],f.qa('img')[0]);f.event(f.w,'pagehide');assert.equal(observer.targets.length,0);f.dom.window.close();
});
test('desktop/mobile grids remain unchanged through window show, frame resize, viewport change and hide',()=>{
 for(const [tracks,row]of [['42px 0px 0px 540px 18px 30px','4'],['80px 36px 0px 0px 540px 18px 30px','5']]){
  const f=fixture(),body=f.w.document.body;body.style.display='grid';body.style.gridTemplateRows=tracks;body.style.overflowY='hidden';f.wrap.style.gridRow=row;f.wrap.style.gridColumn='2';
  const beforeBody=body.style.cssText,beforeField=f.wrap.style.cssText;f.show();const section=f.q('#mayGifStrip');assert.equal(section.style.gridRow,'');assert.equal(section.style.gridColumn,'');assert.equal(body.style.cssText,beforeBody);assert.equal(f.wrap.style.cssText,beforeField);
  f.event(f.q('.may-gif-strip-resize'),'keydown',{key:'ArrowDown'});Object.defineProperty(f.w,'innerWidth',{value:640,configurable:true});f.event(f.w,'resize');assert.equal(body.style.cssText,beforeBody);assert.equal(f.wrap.style.cssText,beforeField);
  f.api.hide();assert.equal(body.style.cssText,beforeBody);assert.equal(f.wrap.style.cssText,beforeField);assert.deepEqual(f.scrolled,[]);f.dom.window.close();
 }
});

test('window header dragging and keyboard movement stay inside viewport without resizing GIF frames',()=>{
 const f=fixture();f.show();const panel=f.q('#mayGifStrip'),head=f.q('.may-gif-strip-header'),edge=f.edge(),before={left:parseFloat(panel.style.left),top:parseFloat(panel.style.top)};
 f.event(head,'pointerdown',{pointerId:1,button:0,clientX:100,clientY:100});f.event(f.w,'pointermove',{pointerId:1,clientX:70,clientY:150});assert.equal(parseFloat(panel.style.left),before.left-30);assert.equal(parseFloat(panel.style.top),before.top+50);
 f.event(f.w,'pointermove',{pointerId:1,clientX:99999,clientY:99999});assert.ok(parseFloat(panel.style.left)+parseFloat(panel.style.width)<=f.w.innerWidth-8);assert.ok(parseFloat(panel.style.top)+parseFloat(panel.style.height)<=f.w.innerHeight-8);assert.equal(f.edge(),edge);f.event(f.w,'pointercancel',{pointerId:1});assert.equal(panel.classList.contains('may-gif-moving'),false);
 const end=panel.style.cssText;f.event(f.w,'pointermove',{pointerId:1,clientX:-99999,clientY:-99999});assert.equal(panel.style.cssText,end);f.event(head,'keydown',{key:'Home'});assert.equal(panel.style.left,'8px');assert.equal(panel.style.top,'8px');
 f.event(head,'keydown',{key:'ArrowRight',shiftKey:true});assert.equal(panel.style.left,'48px');assert.equal(f.edge(),edge);f.event(head,'keydown',{key:'Escape'});assert.equal(panel.hidden,true);f.api.open();assert.equal(panel.style.left,'48px');assert.deepEqual(f.scrolled,[]);f.dom.window.close();
});

test('close and frame controls cannot start a window drag; keyboard scrolling changes only the internal track',()=>{
 const f=fixture();f.show();const panel=f.q('#mayGifStrip'),head=f.q('.may-gif-strip-header'),close=head.querySelector('button'),position={left:panel.style.left,top:panel.style.top};
 f.event(close,'pointerdown',{pointerId:2,button:0,clientX:50,clientY:50});f.event(f.w,'pointermove',{pointerId:2,clientX:150,clientY:150});assert.equal(panel.style.left,position.left);assert.equal(panel.style.top,position.top);assert.equal(panel.classList.contains('may-gif-moving'),false);
 const track=f.q('.may-gif-strip-track'),frames=f.qa('.may-gif-strip-frame');track.getBoundingClientRect=()=>({left:0,top:0,right:200,bottom:120,width:200,height:120});frames[2].getBoundingClientRect=()=>({left:500,top:0,right:692,bottom:120,width:192,height:120});
 f.event(f.q('.may-gif-strip-select'),'keydown',{key:'End'});assert.equal(track.scrollLeft,492);assert.deepEqual(f.scrolled,[]);assert.equal(panel.style.left,position.left);assert.equal(panel.style.top,position.top);f.dom.window.close();
});

test('native window resize and visual viewport bounds never alter frame size or field styles',()=>{
 const f=fixture(undefined,false,false,true);f.show();const panel=f.q('#mayGifStrip'),originalField=f.wrap.style.cssText,edge=f.edge();let width=520,height=210;
 panel.getBoundingClientRect=()=>({left:parseFloat(panel.style.left),top:parseFloat(panel.style.top),width,height});f.panelObserver.callback();assert.equal(panel.style.width,'520px');assert.equal(panel.style.height,'210px');assert.equal(f.edge(),edge);
 const view=new f.w.EventTarget();Object.assign(view,{offsetLeft:12,offsetTop:24,width:320,height:240});Object.defineProperty(f.w,'visualViewport',{value:view});f.event(f.w,'resize');assert.equal(panel.style.width,'304px');assert.equal(panel.style.height,'210px');assert.ok(parseFloat(panel.style.left)>=20);assert.ok(parseFloat(panel.style.top)>=32);assert.ok(parseFloat(panel.style.top)+parseFloat(panel.style.height)<=256);
 assert.equal(f.wrap.style.cssText,originalField);assert.equal(f.edge(),edge);f.event(f.w,'pagehide');assert.equal(f.panelObserver.targets.length,0);f.dom.window.close();
});
