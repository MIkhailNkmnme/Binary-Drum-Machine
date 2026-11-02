const test=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
const audio=require('./mayatnik-xorrom.js'),host=require('./mayatnik-xorrom-host.js');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function fixture(){
 const dom=new JSDOM('<div><canvas></canvas></div>',{pretendToBeVisual:true}),win=dom.window,doc=win.document,viewport=doc.querySelector('div'),figure=doc.querySelector('canvas');
 viewport.getBoundingClientRect=()=>({left:0,top:0,right:300,bottom:300});figure.getBoundingClientRect=()=>({left:0,top:0,right:300,bottom:200,width:300,height:200});
 let source={height:4,width:1,rows:Array.from({length:4},()=>({ones:1,bits:new Int8Array([1]),colors:new Uint32Array([0,1,0,0,0,0,0,0])}))},snapshot,state='stopped',current=0,config,starts=0,run=0,captureWait=null,seekWait=null;
 const captures=[],seeks=[],replacements=[],frames=new Map();let frameId=0;
 win.requestAnimationFrame=fn=>{frames.set(++frameId,fn);return frameId;};win.cancelAnimationFrame=id=>frames.delete(id);
 const change=next=>{if(next!==state){state=next;config.onState(next);}};
 const engine={...audio,create(o){config=o;return {
  async start(){starts++;const ticket=++run;if(state!=='paused')snapshot=await o.getSnapshot();if(ticket!==run)return false;change('playing');return true;},pause(){run++;change(state==='playing'?'paused':state);},stop(){run++;snapshot=null;change('stopped');},setSettings(){},dispose(){},getStream(){return null;},
  async seek(row){const ticket=++run;change('paused');const wait=seekWait;seekWait=null;if(wait)await wait.promise;if(ticket!==run)return false;current=Math.max(0,Math.min(snapshot.rows.length-1,row));seeks.push(current);o.onStep({index:current,notes:audio.notesForRow(snapshot.rows[current],current),manual:true});return true;},
  replaceSnapshot(value,{index=0}={}){run++;snapshot=value;current=Math.max(0,Math.min(value.rows.length-1,index));replacements.push(value);change('paused');o.onStep({index:current,notes:audio.notesForRow(value.rows[current],current),manual:true});return current;}
 };}};
 const api=host.mount({window:win,document:doc,viewport,figure:()=>figure,engine,getSettings:()=>({}),getSnapshot:async options=>{captures.push(options);const value=source,wait=captureWait;captureWait=null;if(wait)await wait.promise;return value;}});
 const marker=doc.getElementById('mayXorromRow'),hit=marker.firstChild;
 function fire(type,y=75,target=hit,key){const event=key?new win.KeyboardEvent(type,{key,bubbles:true,cancelable:true}):new win.MouseEvent(type,{clientY:y,button:0,bubbles:true,cancelable:true});if(!key)Object.defineProperty(event,'pointerId',{value:7});target.dispatchEvent(event);return event;}
 const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
 const raf=async()=>{const pending=[...frames.values()];frames.clear();for(const fn of pending)fn();await flush();};
 return {api,dom,win,marker,hit,captures,seeks,replacements,fire,flush,raf,owner:{},get starts(){return starts;},setSource(value){source=value;},waitCapture(){captureWait=deferred();return captureWait;},waitSeek(){seekWait=deferred();return seekWait;},step(row){config.onStep({index:row,notes:audio.notesForRow(snapshot.rows[row],row)});},close(){api.dispose();dom.window.close();}};
}
test('line drag retriggers rows, deduplicates motion within a row and resumes from release',async()=>{
 const f=fixture();await f.api.start();f.step(1);assert.equal(f.fire('pointerdown').defaultPrevented,true);await f.flush();assert.deepEqual(f.seeks,[1]);assert.equal(f.api.getState().state,'paused');
 f.fire('pointermove',125,f.win);await f.flush();f.fire('pointermove',126,f.win);await f.flush();assert.deepEqual(f.seeks,[1,2]);assert.equal(f.api.getState().index,2);f.fire('pointerup',125,f.win);await f.flush();assert.equal(f.api.getState().state,'playing');assert.equal(f.starts,2);f.close();
});
test('paused clicks replay same row, keyboard moves and cancellation never resumes automatically',async()=>{
 const f=fixture();await f.api.start();f.step(1);f.api.pause();
 for(let n=0;n<2;n++){f.fire('pointerdown');await f.flush();f.fire('pointerup',75,f.win);await f.flush();}assert.deepEqual(f.seeks,[1,1]);assert.equal(f.api.getState().state,'paused');assert.equal(f.starts,1);
 f.fire('keydown',0,f.marker,'ArrowDown');await f.flush();assert.equal(f.api.getState().index,2);f.fire('pointerdown');f.fire('pointermove',25,f.win);f.fire('pointercancel',25,f.win);await f.flush();assert.equal(f.api.getState().state,'paused');assert.equal(f.starts,1);f.close();
});
test('Stop supersedes release waiting for an asynchronous preview',async()=>{
 const f=fixture();await f.api.start();f.step(1);const wait=f.waitSeek();f.fire('pointerdown');f.fire('pointerup',75,f.win);f.api.stop();wait.resolve();await f.flush();assert.equal(f.api.getState().state,'stopped');assert.equal(f.starts,1);f.close();
});
test('new empty frame cancels old notes immediately and resumes with silence without Stop/Start',async()=>{
 const f=fixture();f.api.fieldChanged({owner:f.owner,key:'a'});await f.api.start();f.step(1);assert.ok(f.api.getState().notes.length);
 f.setSource({height:4,width:1,rows:Array.from({length:4},()=>({ones:0,bits:new Int8Array([0]),colors:new Uint32Array(8)}))});f.api.fieldChanged({owner:f.owner,key:'b'});assert.equal(f.api.getState().state,'paused');assert.deepEqual(f.api.getState().notes,[]);assert.equal(f.api.getState().updating,true);await f.raf();assert.equal(f.api.getState().state,'playing');assert.deepEqual(f.api.getState().notes,[]);assert.equal(f.api.getState().index,1);assert.equal(f.captures.at(-1).automatic,true);assert.equal(f.replacements.length,1);assert.equal(f.api.fieldChanged({owner:f.owner,key:'b'}),false);f.close();
});
test('latest frame wins coalesced reads and Stop or Pause during refresh cannot ghost-resume',async()=>{
 const f=fixture();f.api.fieldChanged({owner:f.owner,key:'a'});await f.api.start();f.step(2);const wait=f.waitCapture();f.api.fieldChanged({owner:f.owner,key:'b'});await f.raf();f.api.fieldChanged({owner:f.owner,key:'c'});f.api.pause();await f.raf();assert.equal(f.api.getState().state,'paused');assert.equal(f.replacements.length,1);wait.resolve();await f.flush();assert.equal(f.replacements.length,1);assert.equal(f.starts,1);
 const second=f.waitCapture();f.api.fieldChanged({owner:f.owner,key:'d'});await f.raf();f.api.stop();second.resolve();await f.flush();assert.equal(f.api.getState().state,'stopped');assert.equal(f.replacements.length,1);f.close();
});

test('frame replacement preserves an ongoing line grab and respects release during capture',async()=>{
 const f=fixture();f.api.fieldChanged({owner:f.owner,key:'a'});await f.api.start();f.step(1);f.fire('pointerdown');await f.flush();f.fire('pointermove',125,f.win);await f.flush();
 f.setSource({width:1,height:4,rows:Array.from({length:4},()=>({ones:0,bits:new Int8Array([0]),colors:new Uint32Array(8)}))});f.api.fieldChanged({owner:f.owner,key:'b'});await f.raf();assert.equal(f.api.getState().state,'paused');assert.equal(f.starts,1);assert.deepEqual(f.api.getState().notes,[]);
 f.fire('pointermove',175,f.win);await f.flush();assert.equal(f.api.getState().index,3);f.fire('pointerup',175,f.win);await f.flush();assert.equal(f.api.getState().state,'playing');assert.equal(f.starts,2);
 f.step(1);f.fire('pointerdown');await f.flush();const pending=f.waitCapture();f.api.fieldChanged({owner:f.owner,key:'c'});await f.raf();f.fire('pointerup',75,f.win);await f.flush();assert.equal(f.api.getState().updating,true);pending.resolve();await f.flush();assert.equal(f.api.getState().state,'playing');assert.equal(f.starts,3);f.close();
});

test('lost pointer capture leaves the selected line paused',async()=>{
 const f=fixture();await f.api.start();f.step(1);f.fire('pointerdown');await f.flush();f.fire('lostpointercapture');f.fire('pointerup',75,f.win);await f.flush();assert.equal(f.api.getState().state,'paused');assert.equal(f.starts,1);f.close();
});


test('automatic geometry/connectivity toggle refreshes the playing score but base/source edits do not reread',async()=>{
 const f=fixture();await f.api.start();f.step(1);const before=f.captures.length;
 f.api.setSettings({autoGeometry:true});assert.equal(f.api.getState().updating,true);await f.raf();assert.equal(f.captures.length,before+1);assert.equal(f.api.getState().state,'playing');
 f.api.setSettings({geometrySource:'areas',bpm:150});assert.equal(f.api.getState().updating,false);assert.equal(f.captures.length,before+1);
 f.api.setSettings({geometryConnectivity:'corners'});assert.equal(f.api.getState().updating,true);await f.raf();assert.equal(f.captures.length,before+2);
 f.api.setSettings({autoGeometry:false});await f.raf();assert.equal(f.captures.length,before+3);assert.equal(f.api.getState().state,'playing');f.close();
});
