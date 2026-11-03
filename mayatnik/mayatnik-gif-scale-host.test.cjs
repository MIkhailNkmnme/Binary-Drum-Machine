'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
const host=html.slice(html.indexOf("  const gifScaleKey="),html.indexOf('  let gifRecording=null;'));
function fixture(){
 const dom=new JSDOM('<select id="gifScalePresentation"><option value="pixels" selected>На весь кадр</option><option value="scale">Уменьшать</option></select><select id="gifScaleSequence"><option value="step8">8</option></select><select id="gifScaleMethod"><option value="canvas">Canvas</option></select><input id="gifScaleDelay" value="200"><button id="bGifScale">Создать GIF</button><button id="bGifScaleView" disabled></button><button id="bGifScaleInfo"></button><p id="triangleInfo"></p>',{url:'https://example.test/',runScripts:'outside-only'});
 const w=dom.window,d=w.document,jobs=[],shown=[],downloads=[],busy=[];let captures=0,stops=0,fallback=0;
 Object.assign(w,{$:id=>d.getElementById(id),cacheRestoring:false,templateDragging:false,frameLibraryBusy:false,k:32,EMPTY:[0,0,0],stopFrameTransports(){stops++;},captureScaleGifFrame(){captures++;return {width:63,height:32,pixels:new Uint8ClampedArray(63*32*4)};},download(...args){downloads.push(args);}});
 w.localStorage.setItem('mayatnik.gifScale.presentation.v1','scale');
 w.MayatnikGifStrip={show(frames,options){shown.push({frames,options});},open(){return shown.length>0;},setBusy(value){busy.push(value);}};
 w.MayatnikGifViewer={open(){fallback++;return true;}};
 w.MayatnikGifScale={generate(source,options){let resolve,reject;const job={source,options,plan:{width:63,height:32,padded:0,levels:[32,24,16,8]},promise:new Promise((a,b)=>{resolve=a;reject=b;}),cancel(){reject(Object.assign(Error('cancelled'),{name:'AbortError'}));}};job.finish=()=>resolve({plan:job.plan,frames:job.plan.levels.map(rows=>({rows,blob:new w.Blob(['frame'],{type:'image/gif'})})),blob:new w.Blob(['gif'],{type:'image/gif'}),delay:200,presentation:options.presentation});job.fail=()=>reject(Error('worker failed'));jobs.push(job);return job;}};
 w.eval(host);
 return {w,d,jobs,shown,downloads,busy,captures:()=>captures,stops:()=>stops,fallback:()=>fallback,close(){w.dispatchEvent(new w.Event('pagehide'));w.close();}};
}
test('full-size default ignores old shrinking preference and the completed player gets the exact generation metadata',async()=>{
 const f=fixture();try{
  assert.equal(f.d.querySelector('#gifScalePresentation').value,'pixels');
  const running=f.d.querySelector('#bGifScale').onclick();assert.deepEqual(f.busy,[true]);assert.equal(f.d.querySelector('#gifScalePresentation').disabled,true);
  f.jobs[0].finish();await running;
  const info=f.shown[0].options;assert.equal(info.presentation,'pixels');assert.equal(info.delay,200);assert.equal(info.blob.type,'image/gif');assert.match(info.name,/kadr32.*pixels/);assert.equal(f.downloads.length,1);assert.deepEqual(f.busy,[true,false]);assert.equal(f.d.querySelector('#bGifScaleView').disabled,false);
 }finally{f.close();}
});
test('the visible mode button rebuilds the saved source, not a later live frame, and does not automatically download again',async()=>{
 const f=fixture();try{
  const first=f.d.querySelector('#bGifScale').onclick();f.jobs[0].finish();await first;f.w.k=99;f.w.EMPTY[0]=255;
  const second=f.shown[0].options.onPresentationChange('scale',3);assert.equal(f.captures(),1);assert.equal(f.stops(),1);assert.equal(f.jobs[1].source,f.jobs[0].source);assert.deepEqual(Array.from(f.jobs[1].options.background),[0,0,0]);
  f.jobs[1].finish();await second;
  assert.equal(f.shown.length,2);assert.equal(f.shown[1].options.selectedIndex,3);assert.match(f.shown[1].options.name,/kadr32.*scale/);assert.equal(f.downloads.length,1);assert.equal(f.w.localStorage.getItem('mayatnik.gifScale.presentation.v2'),'scale');
 }finally{f.close();}
});
test('a failed mode rebuild retains the previous player and always unlocks its controls',async()=>{
 const f=fixture();try{
  const first=f.d.querySelector('#bGifScale').onclick();f.jobs[0].finish();await first;
  const second=f.shown[0].options.onPresentationChange('scale');f.jobs[1].fail();await second;
  assert.equal(f.shown.length,1);assert.equal(f.busy.at(-1),false);assert.equal(f.d.querySelector('#gifScalePresentation').disabled,false);assert.match(f.d.querySelector('#triangleInfo').textContent,/worker failed/);
 }finally{f.close();}
});
test('cancel never replaces a valid player and the preview command can open an existing recorded GIF',async()=>{
 const f=fixture();try{
  f.d.querySelector('#bGifScaleView').onclick();assert.equal(f.fallback(),1);
  const first=f.d.querySelector('#bGifScale').onclick();await f.d.querySelector('#bGifScale').onclick();await first;
  assert.equal(f.shown.length,0);assert.equal(f.busy.at(-1),false);assert.match(f.d.querySelector('#triangleInfo').textContent,/отменён/);
 }finally{f.close();}
});
