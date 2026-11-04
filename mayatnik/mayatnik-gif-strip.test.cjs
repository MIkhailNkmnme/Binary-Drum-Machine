const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let JSDOM;try{({JSDOM}=require(process.env.SETKA_JSDOM||'jsdom'));}catch{
 const base=process.env.LOCALAPPDATA||path.join(process.env.USERPROFILE||'','AppData','Local');
 ({JSDOM}=require(path.join(base,'Temp','codex-setka-dom','node_modules','jsdom')));
}
const {create}=require('./mayatnik-gif-strip.js');
function fixture(saved,blocked=false,withObserver=false,withPanelObserver=false){
 const dom=new JSDOM('<!doctype html><body><header></header><div id="wrap" style="flex:1;min-height:0"></div><footer></footer></body>',{url:'https://example.test'}),w=dom.window;
 const revoked=[],created=[],wrap=w.document.getElementById('wrap');wrap.getBoundingClientRect=()=>({height:540});
 if(saved!==undefined)w.localStorage.setItem('mayatnik.gifStrip.thumbSize.v2',JSON.stringify(saved));
 if(blocked)Object.defineProperty(w,'localStorage',{get(){throw Error('blocked');}});
 w.URL.createObjectURL=blob=>{created.push(blob);return 'blob:test-'+created.length;};w.URL.revokeObjectURL=url=>revoked.push(url);
 const timers=new Map();let now=0,timerId=0;w.setTimeout=(fn,delay)=>{timers.set(++timerId,{at:now+delay,fn});return timerId;};w.clearTimeout=id=>timers.delete(id);
 const advance=ms=>{const until=now+ms;let runs=0;while(timers.size){const [id,task]=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(task.at>until)break;assert.ok(runs++<1000,'bounded playback scheduling');now=task.at;timers.delete(id);task.fn();}now=until;};
 let observer,panelObserver;const scrolled=[];w.HTMLElement.prototype.scrollIntoView=function(options){scrolled.push({element:this,options});};
 if(withObserver)w.IntersectionObserver=class{constructor(callback,options){this.callback=callback;this.options=options;this.targets=[];observer=this;}observe(node){this.targets.push(node);}disconnect(){this.targets=[];}};
 if(withPanelObserver)w.ResizeObserver=class{constructor(callback){this.callback=callback;this.targets=[];panelObserver=this;}observe(node){this.targets.push(node);}disconnect(){this.targets=[];}};
 const api=create(w),frames=[12,24,36].map(rows=>({rows,blob:new w.Blob(['GIF89a'],{type:'image/gif'})}));
 const show=(options={})=>api.show(frames,{width:400,height:200,name:'Тест.gif',...options});
 const q=s=>w.document.querySelector(s),qa=s=>[...w.document.querySelectorAll(s)];
 function event(node,type,extra={}){const e=new w.Event(type,{bubbles:true,cancelable:true});Object.assign(e,extra);node.dispatchEvent(e);return e;}
 const edge=()=>parseFloat(q('#mayGifStrip').style.getPropertyValue('--may-gif-width'));
 return {dom,w,api,show,frames,q,qa,event,edge,revoked,created,wrap,scrolled,timers,advance,get observer(){return observer;},get panelObserver(){return panelObserver;}};
}
test('separate fixed dialog preserves field styles and document position through show, hide and reopen',()=>{
 const f=fixture();assert.equal(f.api.open(),false);assert.equal(f.show(),true);
 const strip=f.q('#mayGifStrip');assert.equal(strip.parentElement,f.w.document.body);assert.equal(strip.getAttribute('role'),'dialog');assert.equal(strip.getAttribute('aria-label'),'Гиф-Масштаб');assert.equal(strip.getAttribute('aria-modal'),'false');assert.equal(f.wrap.nextElementSibling.tagName,'FOOTER');assert.equal(f.wrap.style.flex,'1 1 0%');assert.equal(f.wrap.style.height,'');
 assert.equal(f.qa('img').length,4);assert.equal(f.qa('canvas').length,0);assert.equal(f.created[1],f.frames[1].blob);assert.match(f.qa('.may-gif-strip-caption')[1].textContent,/2 · 24/);
 assert.equal(f.q('.may-gif-strip-header button').classList.contains('gz-hx'),true);
 f.api.hide();assert.equal(strip.hidden,true);assert.equal(f.wrap.style.flex,'1 1 0%');assert.equal(f.wrap.style.height,'');assert.equal(f.api.open(),true);assert.equal(strip.hidden,false);assert.deepEqual(f.scrolled,[]);f.dom.window.close();
});
test('any frame selects, keyboard selection and proportional shared resize survive reopen and reload',()=>{
 const f=fixture();f.show();const buttons=f.qa('.may-gif-strip-select');buttons[1].click();assert.equal(buttons[1].getAttribute('aria-pressed'),'true');
 f.event(buttons[1],'keydown',{key:'ArrowRight'});assert.equal(buttons[2].getAttribute('aria-pressed'),'true');assert.equal(f.w.document.activeElement,buttons[2]);
 const handle=f.qa('.may-gif-strip-resize')[2];assert.equal(handle.hidden,false);const before=f.edge();f.event(handle,'keydown',{key:'ArrowRight'});assert.equal(f.edge(),before+8);
 const h=parseFloat(f.q('#mayGifStrip').style.getPropertyValue('--may-gif-height'));assert.equal(f.edge()/h,2);
 f.api.hide();f.api.open();assert.equal(buttons[2].getAttribute('aria-pressed'),'true');assert.equal(f.edge(),before+8);
 const saved=JSON.parse(f.w.localStorage.getItem('mayatnik.gifStrip.thumbSize.v2')),g=fixture(saved);g.show();assert.equal(g.edge(),f.edge());f.dom.window.close();g.dom.window.close();
});
test('pointer resize uses original pointer position for later frames; cancel/lost capture terminate safely',()=>{
 const f=fixture();f.show();const handle=f.qa('.may-gif-strip-resize')[2],start=f.edge();
 f.event(handle,'pointerdown',{pointerId:9,button:0,clientX:100,clientY:100});
 f.event(handle,'pointermove',{pointerId:9,clientX:150,clientY:125});assert.equal(f.edge(),128);
 f.event(handle,'pointermove',{pointerId:9,clientX:200,clientY:150});assert.equal(f.edge(),128);assert.equal(f.wrap.style.height,'');
 f.event(handle,'pointercancel',{pointerId:9});const end=f.edge();f.event(handle,'pointermove',{pointerId:9,clientX:999,clientY:999});assert.equal(f.edge(),end);
 f.event(handle,'pointerdown',{pointerId:10,button:0,clientX:0,clientY:0});f.event(handle,'lostpointercapture');f.event(handle,'pointermove',{pointerId:10,clientX:999,clientY:999});assert.equal(f.edge(),end);f.dom.window.close();
});
test('all interaction bubbles stay inside strip while scrolling keeps default behavior',()=>{
 const f=fixture();f.show();let escaped=0;for(const type of ['keydown','pointerdown','wheel','touchmove','click'])f.w.document.body.addEventListener(type,()=>escaped++);
 const button=f.q('.may-gif-strip-select');for(const type of ['pointerdown','wheel','touchmove','click'])assert.equal(f.event(button,type).defaultPrevented,false);
 f.event(button,'keydown',{key:' '});assert.equal(escaped,0);f.dom.window.close();
});
test('size is bounded and corrupt/blocked storage does not prevent showing frames',()=>{
 for(const value of ['bad',-1,1e99]){const f=fixture(value);f.show();assert.ok(f.edge()>=64&&f.edge()<=128);const h=f.q('.may-gif-strip-resize');f.event(h,'keydown',{key:'Home'});assert.equal(f.edge(),64);f.event(h,'keydown',{key:'End'});assert.ok(f.edge()<=128);f.dom.window.close();}
 const f=fixture(undefined,true);assert.equal(f.show(),true);f.event(f.q('.may-gif-strip-resize'),'keydown',{key:'ArrowRight'});f.dom.window.close();
});
test('replacement and pagehide revoke every old URL; invalid or failed replacements preserve existing strip',()=>{
 const f=fixture();f.show();const old=f.qa('.may-gif-strip-track img').map(img=>img.src);assert.equal(f.api.show([],{width:1,height:1}),false);assert.deepEqual(f.revoked,[]);
 f.show({name:'Next'});assert.deepEqual(f.revoked,old);assert.equal(f.qa('img').length,4);
 let count=0;f.w.URL.createObjectURL=()=>{if(count++)throw Error('allocation failed');return 'blob:partial';};assert.equal(f.show(),false);assert.equal(f.qa('img').length,4);assert.equal(f.revoked.at(-1),'blob:partial');
 const current=f.qa('.may-gif-strip-track img').map(img=>img.src);f.event(f.w,'pagehide');for(const url of current)assert.ok(f.revoked.includes(url));assert.equal(f.api.open(),false);assert.equal(f.wrap.style.height,'');f.dom.window.close();
});
test('stylesheet isolates a bounded resizable window with pixelated images and internal scrolling',()=>{
 const css=fs.readFileSync(path.join(__dirname,'mayatnik-gif-strip.css'),'utf8');assert.match(css,/image-rendering:pixelated/);assert.match(css,/overflow-x:auto/);assert.match(css,/scrollbar-width:auto/);assert.match(css,/touch-action:none/);assert.match(css,/#mayGifStrip\{position:fixed/);assert.match(css,/resize:both/);assert.match(css,/max-height:calc\(100dvh - 16px\)/);assert.match(css,/overflow-anchor:none/);assert.doesNotMatch(css,/#wrap|grid-template|body\{/);
});
test('only viewport-near images activate, distant images release decode sources and reopening reveals strip',()=>{
 const f=fixture(undefined,false,true);f.show();const images=f.qa('.may-gif-strip-track img'),observer=f.observer;
 assert.equal(observer.options.root,f.q('.may-gif-strip-track'));assert.equal(observer.targets.length,3);for(const img of images){assert.equal(img.hasAttribute('src'),false);assert.equal(img.loading,'lazy');assert.equal(img.decoding,'async');}
 observer.callback([{target:images[1],isIntersecting:true}]);assert.equal(images[1].src,images[1].dataset.frameUrl);assert.equal(images[0].hasAttribute('src'),false);
 observer.callback([{target:images[1],isIntersecting:false}]);assert.equal(images[1].hasAttribute('src'),false);assert.equal(f.revoked.length,0);
 f.api.hide();f.api.open();assert.deepEqual(f.scrolled,[]);
 f.show();assert.equal(observer.targets.length,3);assert.equal(observer.targets[0],f.qa('.may-gif-strip-track img')[0]);f.event(f.w,'pagehide');assert.equal(observer.targets.length,0);f.dom.window.close();
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
 f.event(head,'pointerdown',{pointerId:1,button:0,clientX:100,clientY:100});f.event(f.w,'pointermove',{pointerId:1,clientX:70,clientY:150});assert.equal(parseFloat(panel.style.left),before.left-30);assert.ok(Math.abs(parseFloat(panel.style.top)-Math.min(before.top+50,f.w.innerHeight-8-parseFloat(panel.style.height)))<1e-9);
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
 panel.getBoundingClientRect=()=>({left:parseFloat(panel.style.left),top:parseFloat(panel.style.top),width,height});f.panelObserver.callback();assert.equal(panel.style.width,'520px');assert.equal(panel.style.height,'320px');assert.equal(f.edge(),edge);
 const view=new f.w.EventTarget();Object.assign(view,{offsetLeft:12,offsetTop:24,width:320,height:240});Object.defineProperty(f.w,'visualViewport',{value:view});f.event(f.w,'resize');assert.equal(panel.style.width,'304px');assert.equal(panel.style.height,'224px');assert.ok(parseFloat(panel.style.left)>=20);assert.ok(parseFloat(panel.style.top)>=32);assert.ok(parseFloat(panel.style.top)+parseFloat(panel.style.height)<=256);
 assert.equal(f.wrap.style.cssText,originalField);assert.equal(f.edge(),edge);f.event(f.w,'pagehide');assert.equal(f.panelObserver.targets.length,0);f.dom.window.close();
});

test('large image, selected thumbnail, seek and row label stay synchronous without autoplay',()=>{
 const f=fixture();try{f.show({delay:360});const stage=f.q('.may-gif-strip-stage'),thumbs=f.qa('.may-gif-strip-select'),seek=f.q('.may-gif-strip-seek'),counter=f.q('.may-gif-strip-counter');
  assert.equal(stage.src,thumbs[0].querySelector('img').src);assert.equal(seek.max,'2');assert.equal(f.timers.size,0);assert.match(counter.textContent,/1 \/ 3 · 12 строк/);
  thumbs[2].click();assert.equal(stage.src,thumbs[2].querySelector('img').src);assert.equal(seek.value,'2');assert.match(counter.textContent,/3 \/ 3 · 36 строк/);
  seek.value='1';f.event(seek,'input');assert.equal(stage.src,thumbs[1].querySelector('img').src);assert.equal(thumbs[1].getAttribute('aria-pressed'),'true');assert.match(seek.getAttribute('aria-valuetext'),/2 из 3, 24 строк/);
  f.q('.may-gif-strip-next').click();assert.equal(seek.value,'2');f.q('.may-gif-strip-next').click();assert.equal(seek.value,'0');f.q('.may-gif-strip-previous').click();assert.equal(seek.value,'2');assert.equal(f.timers.size,0);
  assert.equal(f.edge(),88);assert.ok(f.qa('.may-gif-strip-mode').every(button=>button.hidden));assert.equal(f.q('.may-gif-strip-download').hidden,true);
  const css=fs.readFileSync(path.join(__dirname,'mayatnik-gif-strip.css'),'utf8');assert.match(css,/\.may-gif-strip-stage\{[^}]*object-fit:contain/);assert.match(css,/\.may-gif-strip-track\{[^}]*flex:0 0 auto[^}]*overflow-x:auto;overflow-y:hidden/);
 }finally{f.dom.window.close();}
});

test('playback uses GIF delay with one timer; seeking restarts its interval and pause/hide/replace/pagehide stop it',()=>{
 const f=fixture();try{f.show({delay:360});const play=f.q('.may-gif-strip-play'),seek=f.q('.may-gif-strip-seek');play.click();assert.equal(play.getAttribute('aria-pressed'),'true');assert.equal(f.timers.size,1);
  f.advance(359);assert.equal(seek.value,'0');f.advance(1);assert.equal(seek.value,'1');assert.equal(f.timers.size,1);f.advance(720);assert.equal(seek.value,'0');
  f.advance(100);seek.value='2';f.event(seek,'input');assert.equal(f.timers.size,1);f.advance(359);assert.equal(seek.value,'2');f.advance(1);assert.equal(seek.value,'0');
  play.click();assert.equal(f.timers.size,0);f.advance(1000);assert.equal(seek.value,'0');play.click();f.api.hide();assert.equal(f.timers.size,0);assert.equal(play.getAttribute('aria-pressed'),'false');f.api.open();assert.equal(f.timers.size,0);
  play.click();assert.equal(f.api.show([],{width:1,height:1}),false);assert.equal(f.timers.size,1,'invalid replacement preserves the playing generation');f.show({delay:40});assert.equal(f.timers.size,0);assert.equal(seek.value,'0');play.click();f.advance(40);assert.equal(seek.value,'1');f.event(f.w,'pagehide');assert.equal(f.timers.size,0);assert.equal(f.api.open(),false);
 }finally{f.dom.window.close();}
});

test('legacy single GIF download stays busy-aware without a presentation selector',()=>{
 const f=fixture();try{const blob=new f.w.Blob(['animated GIF'],{type:'image/gif'});f.api.setBusy(true);f.show({presentation:'scale',blob,name:'Проверка.gif',onPresentationChange(){throw Error('legacy selector must not run');}});const download=f.q('.may-gif-strip-download');
  assert.equal(f.qa('.may-gif-strip-mode').length,0);assert.equal(download.hidden,false);assert.equal(download.disabled,true);f.api.setBusy(false);
  const requests=[],click=f.w.HTMLAnchorElement.prototype.click;f.w.HTMLAnchorElement.prototype.click=function(){requests.push({href:this.href,name:this.download});};download.click();assert.deepEqual(requests,[{href:'blob:test-4',name:'Проверка.gif'}]);assert.equal(f.created[3],blob);f.w.HTMLAnchorElement.prototype.click=click;
  f.show();assert.equal(download.hidden,true);assert.equal(f.revoked.filter(url=>url==='blob:test-4').length,1);
  f.event(f.w,'pagehide');f.event(f.w,'pagehide');assert.equal(new Set(f.revoked).size,f.revoked.length);
 }finally{f.dom.window.close();}
});

test('obsolete lazy observer deliveries cannot reactivate released frame images',()=>{
 const f=fixture(undefined,false,true);try{f.show();const old=f.qa('.may-gif-strip-track img');f.observer.callback([{target:old[0],isIntersecting:true}]);assert.ok(old[0].hasAttribute('src'));f.show();f.observer.callback([{target:old[0],isIntersecting:true}]);assert.equal(old[0].hasAttribute('src'),false);assert.equal(f.q('.may-gif-strip-stage').src,'blob:test-4');assert.equal(f.revoked.filter(url=>url==='blob:test-1').length,1);
 }finally{f.dom.window.close();}
});

test('local standard button outlines survive transport toggles and fit each actual button width',()=>{
 const f=fixture();try{f.show({onPresentationChange(){}});const play=f.q('.may-gif-strip-play'),outline=play.querySelector('.may-standard-outline');
  assert.equal(outline.getAttribute('viewBox'),'0 0 88 24');assert.equal(play.querySelector('polygon').getAttribute('points'),'12,0 76,0 88,12 76,24 12,24 0,12');assert.equal(f.q('.may-gif-strip-previous svg').getAttribute('viewBox'),'0 0 40 24');assert.equal(f.q('.may-gif-strip-close svg').getAttribute('viewBox'),'0 0 120 24');
  play.click();assert.match(play.querySelector('.may-gif-button-caption').textContent,/Пауза/);assert.equal(play.querySelector('.may-standard-outline'),outline);play.click();assert.match(play.querySelector('.may-gif-button-caption').textContent,/Пуск/);assert.equal(play.querySelector('.may-standard-outline'),outline);f.show();assert.equal(play.querySelector('.may-standard-outline'),outline);
  const css=fs.readFileSync(path.join(__dirname,'mayatnik-gif-strip.css'),'utf8');assert.match(css,/\[aria-pressed=true\]\{--may-outline:#73e4a5!important;--may-stroke:2px!important/);assert.match(css,/\.gz-hx\.may-standard\.may-standard\{[^}]*width:40px!important;min-width:40px!important;max-width:40px!important/);assert.match(css,/\.may-gif-strip-play\.may-standard\.may-standard\{[^}]*width:88px!important;min-width:88px!important;max-width:88px!important/);
 }finally{f.dom.window.close();}
});

test('replacement preserves the selected frame across stage, seek, thumbnail and counter',()=>{
 const f=fixture();try{const frames=Array.from({length:9},(_,i)=>({rows:128-i*8,blob:new f.w.Blob(['GIF89a'])})),changes=[];
  assert.equal(f.api.show(frames,{width:400,height:200,presentation:'scale',onPresentationChange:(value,index)=>changes.push([value,index])}),true);
  f.qa('.may-gif-strip-select')[7].click();assert.equal(f.qa('.may-gif-strip-mode').length,0);
  assert.equal(f.api.show(frames,{width:400,height:200,presentation:'pixels',selectedIndex:7}),true);assert.equal(f.q('.may-gif-strip-seek').value,'7');assert.equal(f.qa('.may-gif-strip-select')[7].getAttribute('aria-pressed'),'true');assert.equal(f.q('.may-gif-strip-stage').src,f.qa('.may-gif-strip-track img')[7].src);assert.match(f.q('.may-gif-strip-counter').textContent,/8 \/ 9 · 72 строк/);assert.equal(f.timers.size,0);
  for(const [input,expected]of [[999,'8'],[-9,'0'],[1.5,'0'],['7','0'],[undefined,'0']]){f.api.show(frames,{width:400,height:200,selectedIndex:input});assert.equal(f.q('.may-gif-strip-seek').value,expected);}
 }finally{f.dom.window.close();}
});

test('viewport changes reveal the selected thumbnail using only track scrolling without restarting playback',()=>{
 const f=fixture();try{const frames=Array.from({length:8},(_,i)=>({rows:128-i*8,blob:new f.w.Blob(['GIF89a'])}));f.api.show(frames,{width:400,height:200,selectedIndex:7,delay:360});const panel=f.q('#mayGifStrip'),track=f.q('.may-gif-strip-track'),last=f.qa('.may-gif-strip-frame')[7],body=f.w.document.body.style.cssText,field=f.wrap.style.cssText;
  track.getBoundingClientRect=()=>({left:0,top:0,right:320,bottom:100,width:320,height:100});last.getBoundingClientRect=()=>({left:700,top:0,right:788,bottom:100,width:88,height:100});track.scrollLeft=0;f.q('.may-gif-strip-play').click();const timer=[...f.timers.keys()];
  Object.defineProperty(f.w,'innerWidth',{value:360,configurable:true});Object.defineProperty(f.w,'innerHeight',{value:800,configurable:true});f.event(f.w,'resize');assert.equal(track.scrollLeft,468);assert.equal(f.q('.may-gif-strip-seek').value,'7');assert.deepEqual([...f.timers.keys()],timer);assert.equal(body,f.w.document.body.style.cssText);assert.equal(field,f.wrap.style.cssText);assert.deepEqual(f.scrolled,[]);assert.equal(panel.style.minHeight,'320px');
  Object.defineProperty(f.w,'innerHeight',{value:180,configurable:true});f.event(f.w,'resize');assert.equal(panel.style.minHeight,'164px');assert.equal(panel.style.height,'164px');
  const css=fs.readFileSync(path.join(__dirname,'mayatnik-gif-strip.css'),'utf8');assert.match(css,/#mayGifStrip\{[^}]*overflow-x:hidden;overflow-y:auto/);assert.match(css,/\.may-gif-strip-toolbar\{display:flex;flex-wrap:wrap;gap:4px;flex:none\}/);assert.match(css,/\.may-gif-strip-display\{[^}]*min-height:24px/);assert.match(css,/\.may-gif-strip-transport\{[^}]*flex:none/);
 }finally{f.api.hide();f.dom.window.close();}
});

function variantFixture(){
 const f=fixture(undefined,false,true),draw=[];
 const ctx={clearRect(){},fillRect(...a){draw.push(['rect',...a]);},strokeText(){},fillText(...a){draw.push(['text',...a]);}};
 f.w.HTMLCanvasElement.prototype.getContext=()=>ctx;
 const variants=Array.from({length:8},(_,i)=>({id:'v'+i,method:['canvas','nearest','majority','average'][i>>1],presentation:i%2?'scale':'pixels',name:'v'+i+'.gif',blob:new f.w.Blob(['gif'+i]),delay:100,plan:{width:100,height:100},frames:[8,4,2].map(rows=>({rows,blob:new f.w.Blob(['png']),semantic:{width:2,height:2,bits:new Int8Array([0,1,-2,-1]),bounds:{left:20,top:10,width:40,height:40}}}))}));
 return {...f,variants,draw};
}
test('all eight labeled tracks remain mounted; cross-variant selection pauses and uses cached URLs',()=>{
 const f=variantFixture(),selections=[];try{assert.equal(f.api.showVariants(f.variants,{onSelection:s=>selections.push(s)}),true);assert.equal(f.qa('.may-gif-strip-track').length,8);assert.equal(f.qa('.may-gif-strip-variant-label').length,8);assert.equal(f.qa('.may-gif-strip-select').length,24);assert.equal(f.qa('.may-gif-strip-stage').length,1);
  const created=f.created.length;f.q('.may-gif-strip-play').click();assert.equal(f.timers.size,1);f.qa('.may-gif-strip-select')[23].click();assert.equal(f.timers.size,0);assert.equal(f.q('.may-gif-strip-seek').value,'2');assert.equal(selections.at(-1).variant.id,'v7');assert.equal(selections.at(-1).frame,f.variants[7].frames[2]);assert.equal(f.qa('.may-gif-strip-select[aria-pressed=true]').length,1);assert.equal(f.q('.may-gif-strip-stage').src,f.qa('.may-gif-strip-track img')[23].dataset.frameUrl);
  f.qa('.may-gif-strip-variant-label')[2].click();assert.equal(f.q('.may-gif-strip-seek').value,'2');assert.equal(f.created.length,created);f.api.hide();f.api.open();assert.equal(f.created.length,created);f.event(f.w,'pagehide');assert.equal(new Set(f.revoked).size,32);assert.equal(f.revoked.length,32);
 }finally{f.dom.window.close();}
});
async function flushSearch(f){
 for(let i=0;i<200;i++){await Promise.resolve();await Promise.resolve();f.advance(0);}
}

test('main search scans every cached frame in four lists, retains counts and masks across selection',async()=>{
 const f=variantFixture(),calls=[],engine=require('./mayatnik-gif-search.js');
 const variants=f.variants.filter(v=>v.presentation==='pixels');
 for(const [i,v]of variants.entries())for(const [j,frame]of v.frames.entries())frame.semantic={...frame.semantic,bits:new Int8Array((i+j)%2?[1,0,-2,-1]:[0,1,-2,-1])};
 const settings={patterns:['01'],direction:'row',pattern:'initial'};
 try{
  f.api.showVariants(variants,{searchEnabled:()=>true,search:(grid,query)=>{calls.push({grid,query});return engine.search(grid,{...settings,...query});}});
  assert.equal(f.qa('.may-gif-strip-pattern,.may-gif-strip-direction,.may-gif-strip-find,.may-gif-strip-mode').length,0);
  assert.equal(f.qa('.may-gif-strip-track').length,4);f.q('.may-gif-strip-display').getBoundingClientRect=()=>({width:400,height:200});
  await flushSearch(f);assert.equal(calls.length,12);assert.deepEqual(calls.map(c=>c.grid),variants.flatMap(v=>v.frames.map(frame=>frame.semantic)));
  for(const {query}of calls){assert.equal(query.patterns,undefined);assert.equal(query.direction,undefined);assert.equal(query.maxHits,0);}
  assert.match(f.q('.may-gif-strip-search-status').textContent,/всего: 6 совпадений/);assert.equal(f.q('.may-gif-strip-search-status').getAttribute('aria-busy'),'false');
  assert.match(f.qa('.may-gif-strip-caption')[5].textContent,/0 совпадений/);assert.match(f.qa('.may-gif-strip-caption')[8].textContent,/1 совпадений/);
  f.q('.may-gif-strip-digits').click();assert.deepEqual(f.draw.filter(x=>x[0]==='text').slice(-3),[['text','0',160,40],['text','1',200,40],['text','·',160,80]]);
  f.draw.length=0;f.qa('.may-gif-strip-select')[8].click();assert.equal(calls.length,12,'selecting an unvisited matching frame uses its cached mask');assert.equal(f.draw.filter(x=>x[0]==='rect').length,2);assert.match(f.q('.may-gif-strip-search-status').textContent,/кадр: 1 совпадений/);
  f.draw.length=0;f.qa('.may-gif-strip-select')[5].click();assert.equal(f.draw.filter(x=>x[0]==='rect').length,0);assert.match(f.q('.may-gif-strip-search-status').textContent,/кадр: 0 совпадений/);
  settings.patterns=['10'];f.event(f.w,'may-gif-search-change');assert.ok(f.qa('.may-gif-strip-caption').every(n=>!n.textContent.includes('совпадений')));await flushSearch(f);assert.equal(calls.length,24);assert.match(f.qa('.may-gif-strip-caption')[5].textContent,/1 совпадений/);
 }finally{f.api.hide();f.dom.window.close();}
});

test('selection does not cancel scans; main changes, disable, hide and replacement discard stale results',async()=>{
 const f=variantFixture(),pending=[],queries=[];let enabled=true;
 const options={searchEnabled:()=>enabled,search:(grid,query)=>{queries.push({grid,query});return new Promise(resolve=>pending.push(resolve));}};
 const complete=count=>({count,mask:new Uint8Array([1,1,1,1])});
 try{
  f.api.showVariants(f.variants,options);await flushSearch(f);assert.equal(queries.length,1);const first=queries[0];f.qa('.may-gif-strip-select')[4].click();assert.equal(first.query.cancelled(),false);assert.equal(queries.length,1);
  f.event(f.w,'may-gif-search-change');assert.equal(first.query.cancelled(),true);assert.equal(queries.length,1,'cancelled predecessor must finish before next run');pending[0](complete(99));await flushSearch(f);assert.equal(queries.length,2);assert.doesNotMatch(f.q('.may-gif-strip-search-status').textContent,/99/);
  enabled=false;f.event(f.w,'may-gif-search-change');assert.equal(queries[1].query.cancelled(),true);pending[1](complete(88));await flushSearch(f);assert.equal(queries.length,2);assert.match(f.q('.may-gif-strip-search-status').textContent,/Включите Поиск в Маятнике/);
  enabled=true;f.event(f.w,'may-gif-search-change');await flushSearch(f);assert.equal(queries.length,3);f.api.hide();assert.equal(queries[2].query.cancelled(),true);pending[2](complete(77));await flushSearch(f);assert.doesNotMatch(f.q('.may-gif-strip-search-status').textContent,/77/);
  f.api.open();await flushSearch(f);assert.equal(queries.length,4);assert.equal(queries[3].grid,f.variants[0].frames[0].semantic,'reopening scans all frames, independent of selection');
  const replacement=[{...f.variants[0],id:'new',frames:[{...f.variants[0].frames[0],semantic:{width:2,height:2,bits:new Int8Array([1,1,-2,-1])}}]}];
  f.api.showVariants(replacement,options);assert.equal(queries[3].query.cancelled(),true);pending[3](complete(66));await flushSearch(f);assert.equal(queries.length,5);assert.equal(queries[4].grid,replacement[0].frames[0].semantic);pending[4](complete(2));await flushSearch(f);assert.match(f.q('.may-gif-strip-search-status').textContent,/всего: 2 совпадений/);assert.doesNotMatch(f.q('.may-gif-strip-search-status').textContent,/66/);
  f.q('.may-gif-strip-display').getBoundingClientRect=()=>({width:200,height:200});f.draw.length=0;f.event(f.w,'resize');assert.equal(f.draw.filter(x=>x[0]==='rect').length,2,'a returned mask never paints mixed/background cells');
 }finally{f.api.hide();for(const resolve of pending)resolve(complete(0));await flushSearch(f);f.dom.window.close();}
});

test('hiding between frames cancels the queued step and reopening recomputes discarded masks',async()=>{
 const f=variantFixture();let calls=0;try{
  f.api.showVariants(f.variants,{searchEnabled:()=>true,search:async()=>{calls++;return {count:1,mask:new Uint8Array([0,1,0,0])};}});
  for(let i=0;i<5;i++)await Promise.resolve();assert.equal(calls,1);assert.equal(f.timers.size,1);
  f.api.hide();assert.equal(f.timers.size,0);await flushSearch(f);assert.equal(calls,1);assert.ok(f.qa('.may-gif-strip-caption').every(n=>!n.textContent.includes('совпадений')));
  f.api.open();await flushSearch(f);assert.equal(calls,25);assert.match(f.q('.may-gif-strip-search-status').textContent,/всего: 24 совпадений/);
 }finally{f.api.hide();f.dom.window.close();}
});

test('global search settings errors are shown once and stop the batch',async()=>{
 const f=variantFixture();let calls=0;try{
  f.api.showVariants(f.variants,{searchEnabled:()=>true,search:async()=>{calls++;throw Object.assign(Error('Направление пока недоступно'),{code:'GIF_SEARCH_SETTINGS'});}});await flushSearch(f);
  assert.equal(calls,1);assert.match(f.q('.may-gif-strip-search-status').textContent,/Направление пока недоступно/);assert.equal(f.q('.may-gif-strip-search-status').getAttribute('aria-busy'),'false');
 }finally{f.api.hide();f.dom.window.close();}
});

test('viewer speed immediately updates playback and save/generate/cancel callbacks carry its settings',async()=>{
 const f=variantFixture(),saved=[],generated=[],delays=[];let cancelled=0,resolve;try{f.api.showVariants(f.variants,{onDelayChange:d=>delays.push(d),onDownload:async value=>saved.push(value),onGenerate:value=>{generated.push(value);return new Promise(r=>resolve=r);},onCancel:()=>cancelled++});const speed=f.q('.may-gif-strip-speed');f.q('.may-gif-strip-play').click();speed.value='250';f.event(speed,'change');assert.deepEqual(delays,[250]);f.advance(249);assert.equal(f.q('.may-gif-strip-seek').value,'0');f.advance(1);assert.equal(f.q('.may-gif-strip-seek').value,'1');f.q('.may-gif-strip-download').click();await Promise.resolve();assert.equal(saved[0].delay,250);assert.equal(saved[0].variant.id,'v0');assert.equal(saved[0].index,1);
  f.q('.may-gif-strip-sequence').value='powers2';f.q('.may-gif-strip-generate').click();assert.deepEqual(generated,[{sequence:'powers2',delay:250}]);assert.equal(f.q('.may-gif-strip-cancel').hidden,false);assert.equal(f.q('.may-gif-strip-generate').disabled,true);f.q('.may-gif-strip-cancel').click();assert.equal(cancelled,1);resolve();await Promise.resolve();assert.equal(f.q('.may-gif-strip-generate').disabled,false);assert.equal(f.q('.may-gif-strip-cancel').hidden,true);
 }finally{f.api.hide();f.dom.window.close();}
});
test('variant allocation failure preserves old selection and revokes partial URLs once',()=>{
 const f=variantFixture();try{f.api.showVariants(f.variants);f.qa('.may-gif-strip-select')[17].click();const old=f.q('.may-gif-strip-stage').src;let allocations=0;f.w.URL.createObjectURL=()=>{if(allocations++===2)throw Error('fail');return 'blob:partial-'+allocations;};assert.equal(f.api.showVariants(f.variants),false);assert.equal(f.q('.may-gif-strip-stage').src,old);assert.deepEqual(f.revoked,['blob:partial-1','blob:partial-2']);assert.equal(f.qa('.may-gif-strip-track').length,8);
 }finally{f.dom.window.close();}
});

test('settings open before capture, retain old cached frames, and expose montage without automatic generation',async()=>{
 const f=variantFixture();let generated=0,montage=0;try{assert.equal(f.api.openSettings({delay:320,sequence:'powers2',onGenerate:()=>generated++,onMontage:()=>montage++}),true);assert.equal(f.created.length,0);assert.equal(f.q('.may-gif-strip-speed').value,'320');assert.equal(f.q('.may-gif-strip-sequence').value,'powers2');assert.equal(f.q('.may-gif-strip-download').hidden,true);assert.equal(f.q('.may-gif-strip-settings').hidden,false);assert.equal(generated,0);f.q('.may-gif-strip-montage').click();assert.equal(montage,1);f.q('.may-gif-strip-generate').click();await Promise.resolve();assert.equal(generated,1);f.api.hide();assert.equal(f.api.open(),false);
  f.api.showVariants(f.variants);f.qa('.may-gif-strip-select')[20].click();const source=f.q('.may-gif-strip-stage').src,created=f.created.length;f.api.openSettings({delay:400,onGenerate:()=>generated++});assert.equal(f.q('.may-gif-strip-stage').src,source);assert.equal(f.created.length,created);assert.equal(f.q('.may-gif-strip-speed').value,'400');assert.equal(generated,1);
 }finally{f.api.hide();f.dom.window.close();}
});

test('common delay survives variant selection, clamps to encoder bounds and synchronizes both speed controls',async()=>{
 const f=variantFixture(),saved=[];try{f.api.showVariants(f.variants,{delay:230,onDownload:async value=>saved.push(value)});const number=f.q('.may-gif-strip-speed'),slider=f.q('.may-gif-strip-speed-range');assert.equal(number.min,'20');assert.equal(number.max,'5000');assert.equal(slider.step,'10');assert.equal(slider.value,'230');number.value='375';f.event(number,'change');assert.equal(number.value,'380');assert.equal(slider.value,'380');f.qa('.may-gif-strip-variant-label')[7].click();assert.equal(number.value,'380');assert.equal(f.variants[7].delay,100,'viewer does not mutate cached variants');f.q('.may-gif-strip-download').click();await Promise.resolve();assert.equal(saved[0].delay,380);assert.equal(saved[0].variant.id,'v7');slider.value='490';f.event(slider,'input');assert.equal(number.value,'490');number.value='99999';f.event(number,'change');assert.equal(number.value,'5000');number.value='1';f.event(number,'change');assert.equal(number.value,'20');f.api.openSettings({delay:12345});assert.equal(number.value,'5000');assert.equal(slider.value,'5000');
 }finally{f.api.hide();f.dom.window.close();}
});

test('semantic overlay stays transparent above the GIF despite the real global canvas background',()=>{
 const f=variantFixture();try{
  const page=fs.readFileSync(path.join(__dirname,'Zerkalius-mayatnik.html'),'utf8');
  const globalRule=page.match(/(?:^|\n)canvas\{[^}]+\}/)[0];
  const style=f.w.document.createElement('style');style.textContent=globalRule+'\n'+fs.readFileSync(path.join(__dirname,'mayatnik-gif-strip.css'),'utf8');f.w.document.head.append(style);
  f.api.showVariants(f.variants);
  const overlay=f.q('.may-gif-strip-overlay'),field=f.w.document.createElement('canvas');f.wrap.append(field);
  assert.equal(f.w.getComputedStyle(field).backgroundColor,'rgb(0, 0, 0)','main field keeps its original black background');
  assert.equal(f.w.getComputedStyle(overlay).backgroundColor,'rgba(0, 0, 0, 0)','transparent search/digit layer must not hide the selected GIF');
  assert.equal(f.w.getComputedStyle(overlay).marginLeft,'0px');assert.equal(f.w.getComputedStyle(overlay).pointerEvents,'none');
  f.q('.may-gif-strip-digits').click();f.qa('.may-gif-strip-select')[7].click();
  assert.equal(f.w.getComputedStyle(overlay).backgroundColor,'rgba(0, 0, 0, 0)');assert.equal(f.q('.may-gif-strip-stage').src,f.qa('.may-gif-strip-track img')[7].dataset.frameUrl);
 }finally{f.dom.window.close();}
});

test('GIF, saved-frame and replace-field exports use exactly the selected cached frame and explicit callbacks',async()=>{
 const f=variantFixture(),calls=[];let fail=false;
 try{
  const options={onSaveLibrary:async d=>calls.push(['gif',d]),onSaveFrame:async d=>{if(fail)throw Error('Смешанная ячейка');calls.push(['frame',d]);},onApplyFrame:async d=>calls.push(['apply',d])};
  f.api.openSettings(options);for(const cls of ['save-library','save-frame','apply-frame'])assert.equal(f.q('.may-gif-strip-'+cls).hidden,true);
  f.api.showVariants(f.variants,options);f.qa('.may-gif-strip-select')[17].click();f.q('.may-gif-strip-speed').value='420';f.event(f.q('.may-gif-strip-speed'),'change');
  for(const cls of ['save-library','save-frame','apply-frame']){const b=f.q('.may-gif-strip-'+cls);assert.equal(b.hidden,false);b.click();assert.equal(b.disabled,true);await Promise.resolve();assert.equal(b.disabled,false);}
  assert.deepEqual(calls.map(c=>c[0]),['gif','frame','apply']);for(const [,d]of calls){assert.equal(d.variant,f.variants[5]);assert.equal(d.frame,f.variants[5].frames[2]);assert.equal(d.index,2);assert.equal(d.delay,420);}
  fail=true;f.q('.may-gif-strip-save-frame').click();await Promise.resolve();assert.match(f.q('.may-gif-strip-status').textContent,/Смешанная ячейка/);assert.equal(calls.length,3);assert.equal(f.q('.may-gif-strip-save-frame').disabled,false);
  f.show();for(const cls of ['save-library','save-frame','apply-frame'])assert.equal(f.q('.may-gif-strip-'+cls).hidden,true,'legacy show does not retain previous export actions');
 }finally{f.dom.window.close();}
});
