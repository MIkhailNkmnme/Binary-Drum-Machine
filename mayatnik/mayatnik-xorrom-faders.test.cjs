const test=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
const {mount}=require('./mayatnik-xorrom-faders');
const css=require('node:fs').readFileSync(require.resolve('./mayatnik-xorrom-faders.css'),'utf8');

function setup(settings={},options={}){
  const dom=new JSDOM('<menu id="xorrom"></menu>',{pretendToBeVisual:true}),win=dom.window,doc=win.document;
  const style=doc.createElement('style');style.textContent=css;doc.head.append(style);
  let current={bpm:96,gain:.25,...settings},transport='stopped',listener,starts=0;
  const writes=[];
  const api={getSettings:()=>({...current}),getState:()=>({state:transport}),setSettings(patch){writes.push(patch);Object.assign(current,patch);listener?.();},
    subscribe(fn){listener=fn;return ()=>{listener=null;};},start(){starts++;}};
  const mounted=mount({document:doc,api,...options}),el=mounted.element;
  const input=key=>el.querySelector(`[data-xorrom-fader="${key}"] input`);
  const emit=(key,value,type='input')=>{const node=input(key);node.value=String(value);node.dispatchEvent(new win.Event(type,{bubbles:true}));};
  const press=(key,button)=>input(key).dispatchEvent(new win.KeyboardEvent('keydown',{key:button,cancelable:true,bubbles:true}));
  const external=patch=>{Object.assign(current,patch);listener?.();};
  return {win,doc,el,mounted,input,emit,press,external,writes,api,setTransport(value){transport=value;listener?.();},get starts(){return starts;},get subscribed(){return !!listener;},close(){mounted.destroy();win.close();}};
}

test('faders are visible only while audio transport is playing',()=>{
  const f=setup();assert.equal(f.el.hidden,true);assert.equal(f.win.getComputedStyle(f.el).display,'none');
  for(const state of ['playing','paused','playing','stopped','capturing','error']){
    f.setTransport(state);assert.equal(f.el.hidden,state!=='playing');
    assert.equal(f.win.getComputedStyle(f.el).display,state==='playing'?'flex':'none');
  }
  assert.equal(f.writes.length,0);assert.equal(f.starts,0);f.close();
});
test('right-edge sliders use shared settings outside Xorrom menu without starting playback',()=>{
  const f=setup();assert.equal(f.el.parentElement,f.doc.body);assert.equal(f.doc.querySelector('menu input'),null);
  assert.equal(f.input('gain').value,'25');assert.equal(f.input('bpm').getAttribute('aria-valuetext'),'96 BPM');
  assert.equal(f.writes.length,0);f.emit('gain',0);assert.deepEqual(f.writes.at(-1),{gain:0});
  f.emit('gain',87);assert.deepEqual(f.writes.at(-1),{gain:.87});
  f.external({gain:.335,bpm:123.456789,source:'rhythm'});assert.equal(f.input('gain').getAttribute('aria-valuetext'),'33.5 %');
  assert.equal(f.input('bpm').getAttribute('aria-valuetext'),'123.456789 BPM');assert.equal(f.api.getSettings().bpm,123.456789);assert.equal(f.starts,0);f.close();
});
test('tempo logarithmic endpoints expand only after release and preserve the selected value',()=>{
  const f=setup();f.emit('bpm',500);assert.ok(Math.abs(f.api.getSettings().bpm-20)<1e-10);
  f.emit('bpm',1000);assert.equal(f.api.getSettings().bpm,400);const n=f.writes.length;
  f.emit('bpm',1000,'change');assert.ok(+f.input('bpm').value<950);assert.equal(f.writes.length,n);
  assert.equal(f.api.getSettings().bpm,400);f.emit('bpm',1000);assert.equal(f.api.getSettings().bpm,1600);
  f.emit('bpm',0);f.emit('bpm',0,'change');assert.equal(f.api.getSettings().bpm,1);
  f.emit('bpm',0);assert.equal(f.api.getSettings().bpm,.25);assert.equal(f.starts,0);f.close();
});
test('restoring an external tempo outside both original bounds never clamps saved values',()=>{
  const f=setup({bpm:10000});
  for(const bpm of [10000,.0002,1e120,Number.MIN_VALUE,Number.MAX_VALUE]){
    f.external({bpm});assert.equal(f.input('bpm').getAttribute('aria-valuetext'),bpm+' BPM');assert.equal(f.writes.length,0);assert.doesNotMatch(f.el.textContent,/Infinity/);
    assert.ok(+f.input('bpm').value>=0&&+f.input('bpm').value<=1000);
  }
  f.press('bpm','ArrowDown');assert.ok(Number.isFinite(f.api.getSettings().bpm));assert.equal(f.starts,0);f.close();
});
test('keyboard arrows and endpoints update the same sound settings, with teardown releasing subscriptions',()=>{
  let left=800;const f=setup({},{anchor:()=>({left,top:200,width:24,height:48})});
  assert.equal(f.el.style.right,(f.win.innerWidth-left+6)+'px');assert.equal(f.el.style.top,'224px');
  left=650;f.win.dispatchEvent(new f.win.Event('resize'));assert.equal(f.el.style.right,(f.win.innerWidth-left+6)+'px');
  f.press('gain','ArrowUp');assert.equal(f.api.getSettings().gain,.26);f.press('gain','Home');assert.equal(f.api.getSettings().gain,0);
  f.press('bpm','ArrowUp');assert.ok(f.api.getSettings().bpm>96);f.press('bpm','End');assert.equal(f.api.getSettings().bpm,400);assert.equal(f.starts,0);
  const count=f.writes.length;f.mounted.destroy();assert.equal(f.subscribed,false);assert.equal(f.el.isConnected,false);
  f.emit('gain',50);assert.equal(f.writes.length,count);f.close();
});
