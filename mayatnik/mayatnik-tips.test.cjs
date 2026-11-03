const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require(process.env.SETKA_JSDOM||'C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
const source=fs.readFileSync(path.join(__dirname,'mayatnik-tips.js'),'utf8');
function fixture(help=false){
 const dom=new JSDOM('<!doctype html><html><body><button id="axis" data-may-tip-immediate title="В123 · между 31/32 · +½" aria-label="В123 · между 31/32 · +½">В123</button><button id="ordinary" title="Обычная команда">Команда</button><div id="outside"></div></body></html>',{runScripts:'outside-only'}),w=dom.window,d=w.document,timers=new Map();let seq=0;
 w.setTimeout=(fn,delay)=>{const id=++seq;timers.set(id,{fn,delay});return id;};w.clearTimeout=id=>timers.delete(id);if(help)d.documentElement.classList.add('gz-help');
 w.eval(source);d.dispatchEvent(new w.Event('DOMContentLoaded'));const box=d.getElementById('mayTip');Object.defineProperties(box,{offsetWidth:{value:180},offsetHeight:{value:32}});
 for(const el of d.querySelectorAll('button'))el.getBoundingClientRect=()=>({left:100,right:148,top:200,bottom:224,width:48,height:24});
 const event=(node,type,values={})=>{const e=new w.Event(type,{bubbles:true});for(const [k,v]of Object.entries(values))Object.defineProperty(e,k,{value:v});node.dispatchEvent(e);};
 const flush=()=>{const pending=[...timers.values()];timers.clear();for(const t of pending)t.fn();};
 return {w,d,box,timers,event,flush,axis:d.getElementById('axis'),ordinary:d.getElementById('ordinary'),outside:d.getElementById('outside'),close:()=>w.close()};
}
test('only opted-in coordinate labels show at zero delay, including help mode; ordinary tips retain 4000ms and help suppression',()=>{
 for(const help of [false,true]){const f=fixture(help);try{
  f.event(f.ordinary,'pointerover',{pointerType:'mouse'});assert.equal(f.ordinary.hasAttribute('title'),false);assert.equal([...f.timers.values()][0].delay,4000);assert.equal(f.box.hidden,true);f.flush();assert.equal(f.box.hidden,help);
  f.event(f.axis,'pointerover',{pointerType:'mouse'});assert.equal([...f.timers.values()][0].delay,0);assert.equal(f.axis.hasAttribute('title'),false);assert.equal(f.ordinary.title,'Обычная команда');f.flush();assert.equal(f.box.hidden,false);assert.equal(f.box.textContent,'В123 · между 31/32 · +½');assert.equal(f.axis.textContent,'В123');assert.equal(f.axis.getAttribute('aria-label'),'В123 · между 31/32 · +½');assert.equal(f.box.style.left,'156px','existing side placement avoids its owner');
 }finally{f.close();}}
});
test('native title mutations update a visible coordinate tip and leaving restores the latest full title',async()=>{
 const f=fixture(true);try{f.event(f.axis,'pointerover');f.flush();f.axis.title='В123 · столбец 44';await Promise.resolve();await Promise.resolve();assert.equal(f.axis.hasAttribute('title'),false);assert.equal(f.box.textContent,'В123 · столбец 44');f.event(f.axis,'pointerout',{relatedTarget:f.outside});assert.equal(f.box.hidden,true);assert.equal(f.timers.size,0);assert.equal(f.axis.title,'В123 · столбец 44');}finally{f.close();}
});
test('outside hover and scroll hide immediately; touch and explicit no-tooltips remain excluded',()=>{
 const f=fixture(true);try{
  f.event(f.axis,'pointerover');f.flush();f.event(f.outside,'pointerover');assert.equal(f.box.hidden,true);assert.equal(f.timers.size,0);
  f.event(f.axis,'pointerover');f.flush();f.event(f.w,'scroll');assert.equal(f.box.hidden,true);assert.ok(f.axis.hasAttribute('title'));
  f.event(f.axis,'pointerover',{pointerType:'touch'});assert.equal(f.timers.size,0);assert.equal(f.box.hidden,true);
  f.axis.setAttribute('data-no-tooltips','');f.event(f.axis,'pointerover');assert.equal(f.timers.size,0);assert.equal(f.box.hidden,true);
 }finally{f.close();}
});
test('coordinate tips avoid the whole column of stacked axis toolbars, below when it fits and above otherwise',()=>{
 const f=fixture(true),rect=(left,top,width,height)=>({left,top,right:left+width,bottom:top+height,width,height});try{
  const first=f.d.createElement('div'),second=f.d.createElement('div'),distant=f.d.createElement('div');
  for(const panel of [first,second,distant]){panel.className='may-manual-axis-controls';f.d.body.append(panel);}
  first.append(f.axis);const panels=[rect(100,400,256,24),rect(102,426,256,50),rect(700,100,256,24)];
  [first,second,distant].forEach((panel,index)=>{panel.getBoundingClientRect=()=>panels[index];});
  const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  const tipRect=()=>rect(parseFloat(f.box.style.left),parseFloat(f.box.style.top),180,32);
  f.event(f.axis,'pointerover');f.flush();assert.equal(f.box.hidden,false);assert.equal(f.box.style.top,'482px');assert.equal(f.box.style.left,'100px');for(const panel of panels)assert.equal(overlap(tipRect(),panel),false);
  f.event(f.axis,'pointerout',{relatedTarget:f.outside});Object.defineProperty(f.w,'innerHeight',{value:500,configurable:true});f.event(f.axis,'pointerover');f.flush();assert.equal(f.box.style.top,'362px');for(const panel of panels)assert.equal(overlap(tipRect(),panel),false);
 }finally{f.close();}
});
