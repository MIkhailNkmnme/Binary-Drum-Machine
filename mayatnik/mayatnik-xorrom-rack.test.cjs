'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require(process.env.SETKA_JSDOM||'C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
const Rack=require('./mayatnik-xorrom-rack'),Engine=require('./mayatnik-xorrom'),Field=require('./mayatnik-xorrom-field'),Work=require('./mayatnik-work-file'),Share=require('./mayatnik-share-link');
async function rig(saved,legacy,extra={}){
 const dom=new JSDOM('<main><canvas></canvas></main>',{pretendToBeVisual:true}),w=dom.window,d=w.document;
 w.Blob=Blob;const view=d.querySelector('main'),figure=d.querySelector('canvas');const rect=()=>({left:0,top:0,right:80,bottom:120,width:80,height:120});figure.getBoundingClientRect=view.getBoundingClientRect=rect;
 const makeNode=()=>({to:[],connect(n){this.to.push(n);},disconnect(){this.to=[];}});
 let ms=0,n=0,contexts=0,closed=0,captures=0,frame=0,ctx;const timers=new Map(),gains=[];
 class Context extends EventTarget{
  constructor(){super();contexts++;ctx=this;this.state='suspended';this.destination=makeNode();}
  get currentTime(){return ms/1000;}async resume(){this.state='running';}close(){closed++;this.state='closed';}
  createGain(){const g={...makeNode(),gain:{value:1,setTargetAtTime(v){this.value=v;},setValueAtTime(){},linearRampToValueAtTime(){}}};gains.push(g);return g;}
  createBuffer(ch,len,rate){return {duration:len/rate,getChannelData:()=>new Float32Array(len)};}
  createBufferSource(){return {...makeNode(),start(){},stop(){}};}
  createMediaStreamDestination(){return {...makeNode(),stream:{getAudioTracks:()=>[this.track],getTracks:()=>[this.track]}};}
  track={stopped:false,stop(){this.stopped=true;}};
 }
 w.AudioContext=Context;
 const engine={...Engine,create:o=>Engine.create({...o,setTimeout:(fn,dt)=>{timers.set(++n,{fn,at:ms+dt});return n;},clearTimeout:i=>timers.delete(i)})};
 const score=await Field.capture({width:8,height:12,readBit:(x,y)=>+(x%3===y%2)});
 let stored=saved,fallback=legacy;const opts={window:w,document:d,viewport:view,figure,getHeight:()=>12,getSize:()=>({width:8,height:12}),axisMarker:require('./mayatnik-xorrom-axis-marker'),engine,getSettings:()=>fallback,getRack:()=>stored,setRack:(r,s)=>{stored=r;fallback=s;},getSnapshot:async()=>{captures++;return {...score,frame};},...extra};
 const rack=Rack.mount(opts);
 function advance(dt){const end=ms+dt;for(;;){const a=[...timers].sort((x,y)=>x[1].at-y[1].at)[0];if(!a||a[1].at>end)break;timers.delete(a[0]);ms=a[1].at;a[1].fn();}ms=end;}
 const marker=id=>d.getElementById(id===1?'mayXorromRow':'mayXorromRow-'+id);
 const mouse=(el,type,y)=>{const e=new w.MouseEvent(type,{bubbles:true,cancelable:true,clientY:y,button:0});Object.defineProperty(e,'pointerId',{value:4});el.dispatchEvent(e);};
 return {rack,opts,ctx:()=>ctx,ms:()=>ms,gains,stored:()=>stored,stats:()=>({contexts,closed,captures}),score,advance,marker,mouse,w,changeFrame:()=>{frame++;rack.fieldChanged({owner:score,key:String(frame)});},settle:()=>new Promise(r=>w.setTimeout(r,40)),close(){rack.dispose();dom.window.close();}};
}
test('two real hosts share one context/recorder; moving, muting and deleting one reader leaves the other playing',async()=>{
 const f=await rig(null,{bpm:60,source:'melody',division:4});try{
 const r=f.rack;r.add();r.setSettings({bpm:120});assert.equal(f.stats().contexts,0);
 await f.settle();const m=f.marker(2);f.mouse(m.firstChild,'pointerdown',5);f.mouse(f.w,'pointermove',35);f.mouse(f.w,'pointerup',35);
 assert.equal(r.getRack().tracks[1].row,3);assert.deepEqual(await r.startAll(),[true,true]);assert.equal(f.stats().contexts,1);assert.equal(f.stats().captures,1);
 f.advance(1100);assert.equal(r.getState().index,5);assert.match(f.w.document.querySelector('[data-xorrom-edge=left]:not([hidden])').textContent,/№[12] · строка/);assert.equal([...f.w.document.querySelectorAll('[data-xorrom-edge=right]:not([hidden])')].length,2);r.select(1);assert.equal(r.getState().index,1);
 const rec=r.getStream();assert.equal(rec,r.getStream());assert.equal(f.gains.filter(g=>g.to.includes(f.gains[0])).length,2);
 r.select(2);f.mouse(m.firstChild,'pointerdown',55);f.mouse(f.w,'pointermove',75);await Promise.resolve();f.mouse(f.w,'pointerup',75);await f.settle();assert.equal(r.getRack().tracks[1].row,7);assert.equal(r.getState().state,'playing');
 r.setMuted(true);assert.ok(f.gains.some(g=>g.to.includes(f.gains[0])&&g.gain.value===0));r.select(1);assert.equal(r.getState().state,'playing');assert.equal(r.getState().index,1);
 f.changeFrame();await f.settle();assert.equal(r.getState().state,'playing');r.select(2);assert.equal(r.getState().state,'playing');
 r.remove();assert.equal(f.stats().closed,0);assert.equal(r.getStream(),rec);assert.equal(r.getState().state,'playing');
 r.stopAll();assert.equal(r.anyActive(),false);assert.equal(rec.getAudioTracks()[0].stopped,false);
 }finally{f.close();}assert.equal(f.stats().closed,1);assert.equal(f.ctx().track.stopped,true);
});
test('WAV sums actual PCM including stereo and mute; a muted track does not change the other samples',async()=>{
 const f=await rig(null,{bpm:180,gain:.13,source:'melody',last:3});try{
 const r=f.rack;r.add();r.setSettings({bpm:230,gain:.21,timbre:'bass',pan:.5});const [a,b]=r.getRack().tracks.map(t=>Engine.renderWav(f.score,t.settings));
 const v=bytes=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const left=(wav,idx,ch=0)=>{const view=v(wav.bytes),n=view.getUint16(22,true),p=44+2*(idx*n+(n===2?ch:0));return p+2>view.byteLength?0:view.getInt16(p,true);};
 for(const muted of [false,true]){r.setMuted(muted);const result=new DataView(await (await r.exportWav()).blob.arrayBuffer());assert.equal(result.getUint16(22,true),2);let hasDifference=false;
  for(let i=0;i<(result.byteLength-44)/4;i+=31)for(let ch=0;ch<2;ch++){const av=left(a,i),bv=left(b,i,ch);hasDifference||=bv!==0;assert.equal(result.getInt16(44+i*4+ch*2,true),av+(muted?0:bv));}assert.ok(hasDifference);}
 }finally{f.close();}
});
test('legacy settings migrate silently; complete track list, identity, mute and logical cue survive work and share encoding',async()=>{
 const legacy={...Engine.DEFAULTS,bpm:77.5,filterType:'lowpass',pan:.22},a=await rig(null,legacy);let data;
 try{const r=a.rack;assert.deepEqual(r.getRack().tracks[0].settings,legacy);r.add();r.setSettings({gain:.33});r.rename('Бас');r.setMuted(true);
 data=structuredClone(a.stored());data.tracks[1].row=7;const bytes=await Work.encode({st:{rows:8,steps:1,xorrom:legacy,xorromRack:data},field:new Int8Array([1])});assert.deepEqual((await Work.decode(bytes)).data.st.xorromRack,data);
 const share=Share.normalizePayload({v:1,k:0,state:{rows:8,steps:1,mode:'pend',bg:'empty',xorromRack:data}});assert.deepEqual(share.state.xorromRack,data);
 }finally{a.close();}
 const b=await rig(data,legacy);try{assert.deepEqual(b.rack.getRack(),data);assert.equal(b.rack.getState().state,'stopped');assert.equal(b.stats().contexts,0);}finally{b.close();}
});

test('axis, fixed and whole-template readers sample each new field independently; moving a bound mask changes only that track',async()=>{
 let frame=0,x=1;const pool=[{id:'left',name:'Лево'},{id:'right',name:'Право'}];
 const opts={getSelectedTemplates:()=>pool,getTemplatePlacement(id){const at=id==='left'?x:6;return {width:8,height:12,key:String(at),parts:[{mask:{width:1,height:1,data:[1]},rect:{x:at,y:2,width:1,height:1},clip:{left:0,top:0,right:8,bottom:12}}]};},
 async getSnapshot(){return {...await Field.capture({width:8,height:12,readBit:(xx,yy)=>+(xx===(frame?3:1)||xx===6)}),frame};}};
 const f=await rig(null,{source:'melody',division:4,bpm:120},opts);try{
 const r=f.rack;r.setAxis({x1:2,y1:0,x2:2,y2:11},'Вертикаль');assert.deepEqual(r.getAxis(),{x1:2,y1:0,x2:2,y2:11,offset:0,fixed:false,reverse:false});
 const ids=r.addTemplates();assert.deepEqual(ids,[2,3]);assert.equal(r.getState().state,'stopped');assert.deepEqual(await r.startAll(),[true,true,true]);f.advance(60);
 assert.ok(r.getState().notes.length);r.select(1);r.fixAxis(true);await f.settle();assert.equal(r.getAxis().fixed,true);const position=r.getAxis().offset;
 frame++;f.changeFrame();await f.settle();r.select(2);assert.equal(r.getState().notes.length,0);r.select(3);assert.ok(r.getState().notes.length);r.select(1);assert.equal(r.getAxis().offset,position);assert.equal(r.getState().index,0);
 x=3;r.templatesChanged();await f.settle();r.select(2);assert.ok(r.getState().notes.length);r.fixTemplate(true);x=5;r.templatesChanged();assert.deepEqual(r.getRack().tracks[1].template.mask.runs,[2,3,4]);
 const saved=structuredClone(r.getRack());const g=await rig(saved);try{assert.deepEqual(g.rack.getRack(),saved);assert.equal(g.stats().contexts,0);}finally{g.close();}
 r.stopAll();assert.equal(r.anyActive(),false);
 }finally{f.close();}
});
test('Library controls create/select readers, bind individual settings and reject an empty template selection',async()=>{
 const f=await rig(null,{}, {getSelectedTemplates:()=>[]});try{const box=f.w.document.createElement('div');f.w.document.body.append(box);
 const controls=require('./mayatnik-xorrom-controls').mount(box,{api:f.rack});const sel=k=>box.querySelector('[data-xorrom="'+k+'"]'),input=k=>sel(k).querySelector('input,select');
 sel('trackAdd').click();assert.equal(f.rack.getRack().tracks.length,2);input('bpm').value='135';input('bpm').dispatchEvent(new f.w.Event('change'));input('track').value='1';input('track').dispatchEvent(new f.w.Event('change'));
 assert.equal(input('bpm').value,'96');assert.equal(f.rack.getRack().tracks[1].settings.bpm,135);input('trackAxis').value='v';input('trackAxis').dispatchEvent(new f.w.Event('change'));assert.equal(f.rack.getAxis().x1,3);sel('trackAxisFixed').click();assert.ok(f.rack.getAxis().fixed);
 sel('tracksTemplates').click();assert.match(sel('status').textContent,/Выделите/);controls.destroy();
 }finally{f.close();}
});

test('Electro can repeat one pitch for more than twenty different rows: one chord voice follows the dominant RGB category',()=>{
 const e=Engine.ELECTRO_PRESET;const rows=Array.from({length:25},(_,i)=>({bits:Int8Array.of(i%2,1),ones:i%2+1,total:2,colors:Uint32Array.from([0,i%5,0,10+i,0,2,0,0])}));
 const notes=rows.map((r,i)=>Engine.notesForRow(r,i,e));assert.equal(notes.length,25);assert.equal(new Set(notes.map(n=>n[0].midi)).size,1);assert.ok(notes.every(n=>n.length===1&&n[0].code===3));
 rows[21]={...rows[21],colors:Uint32Array.from([0,0,0,1,5,0,0,0])};assert.notEqual(Engine.notesForRow(rows[21],21,e)[0].midi,notes[21][0].midi);
});
