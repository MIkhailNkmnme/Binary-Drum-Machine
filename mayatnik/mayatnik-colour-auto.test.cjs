/* node --test mayatnik/mayatnik-colour-auto.test.cjs; no browser required. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
let JSDOM;
try { ({JSDOM}=require('jsdom')); } catch { ({JSDOM}=require('C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom')); }
const source=fs.readFileSync(require('node:path').join(__dirname,'mayatnik-colour-auto.js'),'utf8');
function setup(html='<input id="a" type="color" value="#ff0000"><input id="b" type="color" value="#00ff00">'){
  const dom=new JSDOM('<!doctype html><body>'+html+'</body>',{url:'https://mayatnik.test/',runScripts:'outside-only'});
  dom.window.eval(source);const w=dom.window,doc=w.document,api=w.MayatnikColourAuto;
  return {dom,w,doc,api,a:doc.getElementById('a'),b:doc.getElementById('b'),done:()=>{api.destroy();w.close();}};
}
const states=value=>JSON.parse(JSON.stringify(value));
test('32 distinct equally spaced RGB rainbow hues and circular clocks',()=>{
  const s=setup(),{api,a}=s;api.register(a,'a');api.setMode('a','frame');
  assert.equal(api.palette.length,32);assert.equal(new Set(api.palette).size,32);
  assert.equal(api.palette[0],'#ff0000');assert.equal(api.palette[16],'#00ffff');
  for(let i=1;i<=32;i++){const changed=api.advance('frame',i);assert.equal(changed.length,1);assert.equal(a.value,api.palette[i%32]);}
  assert.equal(api.getState('a').index,0);s.done();
});
test('off/build/frame are independent per stable key',()=>{
  const s=setup(),{api,a,b}=s;api.register(a,'a');api.register(b,'b');
  assert.deepEqual(states(api.advance('build',0)),[]);
  api.setMode('a','build');api.setMode('b','frame');
  assert.deepEqual(states(api.advance('build',1)).map(x=>x.key),['a']);assert.equal(b.value,'#00ff00');
  const ac=a.value;assert.deepEqual(states(api.advance('frame',1)).map(x=>x.key),['b']);assert.equal(a.value,ac);
  api.setMode('a','off');assert.deepEqual(states(api.advance('build',2)),[]);s.done();
});
test('event dedup suppresses repeated and recent out-of-order redraws, separately per clock',()=>{
  const s=setup(),{api,a}=s;api.register(a,'a');api.setMode('a','build');
  api.advance('build','b1');api.advance('build','b2');const index=api.getState('a').index;
  assert.deepEqual(states(api.advance('build','b1')),[]);assert.equal(api.getState('a').index,index);
  api.setMode('a','frame');assert.equal(api.advance('frame','b1').length,1);
  assert.equal(api.advance('frame').length,1);assert.equal(api.advance('frame').length,1);s.done();
});
test('multi-frame advances wrap at 32 and apply only the final colour once',()=>{
  const s=setup(),{api,a}=s;let writes=0;api.register(a,'a');api.setWriter('a',()=>writes++);api.setMode('a','frame');
  let changes=api.advance('frame','wrap',32);assert.equal(changes.length,1);assert.equal(changes[0].index,0);assert.equal(a.value,api.palette[0]);assert.equal(writes,1);
  changes=api.advance('frame','jump',67);assert.equal(changes.length,1);assert.equal(changes[0].index,3);assert.equal(a.value,api.palette[3]);assert.equal(writes,2);
  assert.deepEqual(states(api.advance('frame','jump',67)),[]);assert.equal(writes,2);s.done();
});
test('invalid frame counts are rejected before consuming an event ID or changing state',()=>{
  const s=setup(),{api,a}=s;api.register(a,'a');api.setMode('a','frame');
  for(const steps of [0,-1,1.5,NaN,Infinity,'2',Number.MAX_SAFE_INTEGER+1])assert.throws(()=>api.advance('frame','one',steps),/positive safe integer/);
  assert.equal(api.getState('a').index,0);assert.equal(api.advance('frame','one',2)[0].index,2);s.done();
});
test('all source inputs and proxies sync with one canonical writer and no input/change events',()=>{
  const s=setup('<input id="a" type="color" value="#ff0000"><input id="b" type="color"><span id="proxy"></span><span id="proxy2"></span>'),{api,a,b,doc}=s;
  let first=0,second=0,events=0;doc.addEventListener('input',()=>events++);doc.addEventListener('change',()=>events++);
  api.register(()=>[a,b],'same');api.adaptPalette(doc.getElementById('proxy'),'same',()=>a.value,()=>first++);
  api.adaptPalette(doc.getElementById('proxy2'),'same',()=>a.value,()=>second++);
  api.setMode('same','frame');api.advance('frame',1);
  assert.equal(first,1);assert.equal(second,0);assert.equal(events,0);assert.equal(a.value,b.value);
  assert.equal(doc.getElementById('proxy2').style.getPropertyValue('--may-auto-colour'),a.value);
  api.setWriter('same',()=>second++);api.advance('frame',2);assert.equal(first,1);assert.equal(second,1);s.done();
});
test('manual colour keeps auto mode, syncs aliases and resumes from nearest hue',()=>{
  const s=setup(),{api,a,b,w}=s;api.register(a,'same');api.register(b,'same');api.setMode('same','frame');
  a.value='#00ffff';a.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(api.getState('same').mode,'frame');assert.equal(api.getState('same').index,16);assert.equal(b.value,'#00ffff');
  api.advance('frame',1);assert.equal(a.value,api.palette[17]);s.done();
});
test('modes, phase and last manually chosen colour restore on reload',()=>{
  const s=setup(),{api,a,w}=s;api.register(a,'a');api.setMode('a','frame');api.manual('a','#00ffff');
  const restored=api.create();restored.register(a,'a');assert.deepEqual(states(restored.getState('a')),states(api.getState('a')));
  restored.advance('frame',1);assert.equal(a.value,api.palette[17]);restored.destroy();s.done();
});
test('off mode leaves host saved colour in charge, while unregistered stored keys survive writes',()=>{
  const s=setup(),{api,a,b,w}=s;
  const storage={getItem:()=>JSON.stringify({other:{mode:'frame',index:7,color:'#ff0000'}}),setItem:(k,v)=>{storage.saved=JSON.parse(v);}};
  const custom=api.create({storage});custom.register(a,'a');custom.setMode('a','build');assert.equal(storage.saved.other.index,7);
  custom.setMode('a','off');a.value='#112233';const restored=api.create({storage:{getItem:()=>JSON.stringify(storage.saved),setItem(){}}});restored.register(a,'a');assert.equal(a.value,'#112233');restored.destroy();custom.destroy();s.done();
});
test('malformed and unavailable storage do not stop independent clocks',()=>{
  const s=setup(),{api,a}=s;
  for(const storage of [{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}},{getItem:()=>'{',setItem(){}},{getItem:()=>JSON.stringify({a:{mode:'wrong',index:-9,color:'bad'}}),setItem(){}}]){
    const c=api.create({storage});c.register(a,'a');assert.equal(c.getState('a').mode,'off');c.setMode('a','frame');assert.equal(c.advance('frame',1).length,1);c.destroy();
  }s.done();
});
test('getter registration follows rebuilt input elements without losing phase',()=>{
  const s=setup(),{api,a,doc,w}=s;api.register(()=>doc.getElementById('a'),'a');api.setMode('a','build');
  const replacement=a.cloneNode();a.replaceWith(replacement);api.advance('build',1);assert.equal(replacement.value,api.palette[1]);
  replacement.dispatchEvent(new w.MouseEvent('pointerover',{bubbles:true}));assert.equal(doc.querySelector('.may-colour-auto').hidden,false);s.done();
});
test('hover merely reveals mini button; click shows three checked modes without changing colour',()=>{
  const s=setup(),{api,a,doc,w}=s;api.register(a,'a');
  a.dispatchEvent(new w.MouseEvent('pointerover',{bubbles:true}));let portal=doc.querySelector('.may-colour-auto');
  assert.equal(portal.hidden,false);assert.equal(a.value,'#ff0000');assert.equal(api.getState('a').mode,'off');
  portal.querySelector('.may-colour-auto-mini').click();const choices=Array.from(portal.querySelectorAll('[role=menuitemradio]'));
  assert.equal(choices.length,3);assert.equal(choices[0].getAttribute('aria-checked'),'true');choices[2].click();
  assert.equal(api.getState('a').mode,'frame');assert.equal(choices[2].getAttribute('aria-checked'),'true');assert.equal(a.value,'#ff0000');s.done();
});
test('source ArrowRight, menu arrow navigation and Escape retain keyboard access',()=>{
  const s=setup(),{api,a,doc,w}=s;api.register(a,'a');a.focus();
  a.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));const mini=doc.querySelector('.may-colour-auto-mini');assert.equal(doc.activeElement,mini);
  mini.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));assert.equal(doc.activeElement.dataset.mode,'off');
  doc.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'End',bubbles:true,cancelable:true}));assert.equal(doc.activeElement.dataset.mode,'frame');
  doc.activeElement.click();assert.equal(api.getState('a').mode,'frame');
  doc.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(doc.activeElement,a);assert.equal(doc.querySelector('.may-colour-auto').hidden,true);s.done();
});
test('touch pointerdown reveals mini; outside pointerdown closes it',()=>{
  const s=setup(),{api,a,doc,w}=s;api.register(a,'a');a.dispatchEvent(new w.MouseEvent('pointerdown',{bubbles:true}));assert.equal(doc.querySelector('.may-colour-auto').hidden,false);
  doc.body.dispatchEvent(new w.MouseEvent('pointerdown',{bubbles:true}));assert.equal(doc.querySelector('.may-colour-auto').hidden,true);s.done();
});
test('popup flips to the left and clamps inside a short viewport',()=>{
  const s=setup(),{api,a,doc,w}=s;api.register(a,'a');Object.defineProperty(w,'innerWidth',{value:220});Object.defineProperty(w,'innerHeight',{value:110});
  a.getBoundingClientRect=()=>({left:195,right:215,top:100,bottom:120,width:20,height:20});
  a.dispatchEvent(new w.MouseEvent('pointerover',{bubbles:true}));const portal=doc.querySelector('.may-colour-auto'),anchor=portal.style.cssText;portal.querySelector('.may-colour-auto-mini').click();
  const menu=portal.querySelector('.may-colour-auto-menu');assert.equal(portal.style.cssText,anchor);
  assert.ok(parseInt(menu.style.left)>=4);assert.ok(parseInt(menu.style.left)+124<=216);assert.ok(parseInt(menu.style.top)>=4);assert.ok(parseInt(menu.style.top)+80<=106);s.done();
});
test('paint:false attaches auto controls without painting the whole split button',()=>{
  const s=setup('<input id="a" type="color" value="#ff0000"><span id="half" style="background-color:rgb(27,36,48)">●</span>'),{api,a,doc,w}=s;
  const half=doc.getElementById('half');api.register(a,'a');api.adaptPalette(half,'a',()=>a.value,null,{paint:false});
  const background=half.style.backgroundColor;api.setMode('a','frame');api.advance('frame',1);
  assert.equal(half.style.backgroundColor,background);assert.equal(half.style.getPropertyValue('--may-auto-colour'),a.value);
  assert.equal(half.tabIndex,0);half.focus();half.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(doc.activeElement.classList.contains('may-colour-auto-mini'),true);s.done();
});
test('disabled/hidden source never reveals automatic controls',()=>{
  const s=setup(),{api,a,doc,w}=s;api.register(a,'a');a.disabled=true;a.dispatchEvent(new w.MouseEvent('pointerover',{bubbles:true}));assert.equal(doc.querySelector('.may-colour-auto'),null);
  a.disabled=false;a.hidden=true;a.dispatchEvent(new w.MouseEvent('pointerover',{bubbles:true}));assert.equal(doc.querySelector('.may-colour-auto'),null);s.done();
});
test('unregister removes palette hover target; destroy removes portal and delegated listeners',()=>{
  const s=setup(),{api,a,doc,w}=s;const handle=api.register(a,'a');a.dispatchEvent(new w.MouseEvent('pointerover',{bubbles:true}));handle.unregister();assert.equal(doc.querySelector('.may-colour-auto').hidden,true);
  api.destroy();a.dispatchEvent(new w.MouseEvent('pointerover',{bubbles:true}));assert.equal(doc.querySelector('.may-colour-auto'),null);s.done();
});
