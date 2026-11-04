const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
let JSDOM;try{({JSDOM}=require('jsdom'));}catch{({JSDOM}=require(path.join(process.env.LOCALAPPDATA,'Temp/codex-setka-dom/node_modules/jsdom')));}
const strip=require('./mayatnik-gif-strip.js'),windowHost=require('./mayatnik-gif-window.js');
function fixture(blocked=false){
 const main=new JSDOM('<!doctype html><head><link rel="stylesheet" href="../_js/grozd.css?v=50"><link rel="stylesheet" href="mayatnik-gif-strip.css?v=896"></head><body><button id="mainMenu">Маятник</button></body>',{url:'https://example.test/mayatnik/Zerkalius-mayatnik.html'}),w=main.window,children=[];
 w.URL.createObjectURL=()=> 'blob:main';w.URL.revokeObjectURL=()=>{};
 const source=strip.create(w);source.create=strip.create;let opens=0;
 w.open=()=>{opens++;if(blocked)return null;const dom=new JSDOM('<!doctype html><html><head></head><body></body></html>',{url:w.location.href}),child=dom.window;let closed=false,n=0;const revoked=[];
  Object.defineProperty(child,'closed',{get:()=>closed});child.focus=()=>{};child.URL.createObjectURL=()=> 'blob:child-'+children.length+'-'+(++n);child.URL.revokeObjectURL=u=>revoked.push(u);child.HTMLCanvasElement.prototype.getContext=()=>null;
  child.close=()=>{if(closed)return;closed=true;child.dispatchEvent(new child.Event('pagehide'));};
  const dispose=JSDOM=>JSDOM.window.close();children.push({dom,w:child,revoked,dispose:()=>dispose(dom)});return child;
 };
 const api=windowHost.create(w,source),blob=new w.Blob(['GIF89a']),variants=Array.from({length:8},(_,i)=>({id:'v'+i,method:['canvas','nearest','majority','average'][i>>1],presentation:i%2?'scale':'pixels',plan:{width:16,height:8},blob,name:'v'+i+'.gif',frames:[8,4].map(rows=>({rows,blob,semantic:{width:1,height:1,bits:Int8Array.of(1)}}))}));
 const q=s=>children.at(-1).w.document.querySelector(s),qa=s=>[...children.at(-1).w.document.querySelectorAll(s)];
 function event(node,type){node.dispatchEvent(new node.ownerDocument.defaultView.Event(type,{bubbles:true}));}
 return {w,api,variants,children,q,qa,event,opens:()=>opens,close(){api.hide();for(const c of children)c.dispose();w.close();}};
}
test('explicit open creates a clean browser workspace with every GIF control, all eight strips and native playback',()=>{
 const f=fixture();try{
  f.api.openSettings({delay:200,onGenerate(){},onMontage(){},onDownload(){}});assert.equal(f.opens(),1);assert.equal(f.w.document.querySelector('#mayGifStrip'),null);assert.equal(f.q('#mainMenu'),null);
  assert.equal(f.q('.may-gif-strip-settings').hidden,false);assert.equal(f.q('.may-gif-strip-generate').hidden,false);assert.equal(f.q('.may-gif-strip-montage').hidden,false);
  const links=[...f.children[0].w.document.querySelectorAll('link')].map(n=>n.href);assert.ok(links.some(s=>s.endsWith('mayatnik-gif-strip.css?v=896')));assert.ok(links.some(s=>s.endsWith('_js/grozd.css?v=50')));
  f.api.showVariants(f.variants,{delay:200});assert.equal(f.qa('.may-gif-strip-variant').length,8);f.qa('.may-gif-strip-select')[5].click();assert.equal(f.q('.may-gif-strip-seek').value,'1');assert.equal(f.q('.may-gif-strip-stage').src,f.qa('.may-gif-strip-track img')[5].src);
  f.q('.may-gif-strip-play').click();assert.equal(f.q('.may-gif-strip-play').getAttribute('aria-pressed'),'true');f.q('.may-gif-strip-play').click();assert.equal(f.q('.may-gif-strip-play').getAttribute('aria-pressed'),'false');
  f.api.openSettings({delay:200});assert.equal(f.opens(),1,'reuse window instead of multiplying popups');
 }finally{f.close();}
});
test('closed popup releases decoded URLs and reopening restores cached variant, frame and delay without generation',()=>{
 const f=fixture();try{let calls=0;const options={delay:200,onGenerate:()=>calls++};f.api.openSettings(options);f.api.showVariants(f.variants,options);f.qa('.may-gif-strip-select')[9].click();const speed=f.q('.may-gif-strip-speed');speed.value='430';f.event(speed,'change');f.api.hide();assert.equal(f.children[0].w.closed,true);assert.equal(new Set(f.children[0].revoked).size,24);
  assert.equal(f.api.open(),true);assert.equal(f.opens(),2);assert.equal(f.q('.may-gif-strip-speed').value,'430');assert.equal(f.q('.may-gif-strip-seek').value,'1');assert.equal(f.q('.may-gif-strip-variant[data-selected=true]').dataset.variant,'v4');assert.equal(calls,0);
 }finally{f.close();}
});
test('generation completed after closing is cached without reopening until an explicit user action',()=>{
 const f=fixture();try{f.api.openSettings();f.api.hide();f.api.showVariants(f.variants,{delay:300});assert.equal(f.opens(),1);assert.equal(f.children[0].w.closed,true);assert.equal(f.api.open(),true);assert.equal(f.opens(),2);assert.equal(f.qa('.may-gif-strip-variant').length,8);}finally{f.close();}
});
test('blocked popup has a usable local fallback and parent unload closes an open child',()=>{
 const f=fixture(true);try{assert.equal(f.api.openSettings(),true);assert.equal(f.w.document.querySelector('#mayGifStrip').hidden,false);assert.match(f.w.document.querySelector('.may-gif-strip-status').textContent,/заблокировано/);}finally{f.close();}
 const g=fixture();try{g.api.openSettings();g.w.dispatchEvent(new g.w.Event('pagehide'));assert.equal(g.children[0].w.closed,true);assert.equal(g.api.open(),false);}finally{g.close();}
});
