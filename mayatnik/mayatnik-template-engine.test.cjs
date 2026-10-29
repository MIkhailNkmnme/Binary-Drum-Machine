const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const M=require('./mayatnik-template-matcher.js');global.MayatnikTemplateMatcher=M;
const Engine=require('./mayatnik-template-engine.js'),Work=require('./mayatnik-work-file.js');
const html=fs.readFileSync(path.join(__dirname,'Zerkalius-mayatnik.html'),'utf8');
function reference(field,p){const selected=new Uint8Array(field.data.length);let count=0;for(let y=0;y<=field.height-p.height;y++)for(let x=0;x<=field.width-p.width;x++)for(const inverse of [0,1]){let ok=true;for(let r=0;r<p.height;r++)for(let c=0;c<p.width;c++)if(field.data[(r+y)*field.width+c+x] !== (p.data[r*p.width+c]^inverse))ok=false;if(ok){count++;for(const q of p.filled)selected[(y+Math.floor(q/p.width))*field.width+x+q%p.width]=1;}}return {count,selected};}
test('exact translated and inverted matches agree with independent exhaustive reference including holes and empty cells',async()=>{
 let seed=17;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let i=0;i<30;i++){const field={width:13,height:9,data:Int8Array.from({length:117},()=>random()%3-1)},p=M.compile({width:3,height:2,data:[1,0,1,0,1,1]});const actual=await M.find(field,[p]),expected=reference(field,p);assert.equal(actual.count,expected.count);assert.deepEqual(actual.selected,expected.selected);}
 const field={width:6,height:2,data:Int8Array.from([1,0,1,0,1,0,0,1,1,1,0,0])},p=M.compile({width:3,height:2,data:[1,0,1,0,1,1]});const actual=await M.find(field,[p]);assert.equal(actual.count,2);assert.equal(actual.selectedCount,8);
});
test('large scans yield and can be cancelled before publishing a partial selection',async()=>{
 let cancel=false,yields=0;const field={width:1024,height:512,data:new Int8Array(1024*512)},p=M.compile({width:2,height:2,data:[1,1,1,1]});await assert.rejects(M.find(field,[p],{cancelled:()=>cancel,yieldTask:async()=>{yields++;cancel=true;}}),{name:'AbortError'});assert.equal(yields,1);
});
function fixture(){let inserts=0,edits=0,draws=0;const entry={id:'a',name:'A',shape:{hex:'#112233',rk:1,parts:[{width:2,height:2,data:[1,0,0,1]}]}},field={width:4,height:2,data:Int8Array.from([1,0,1,0,0,1,0,1])};let stamp=field;
 const host={entries:()=>[entry],field:async()=>stamp,current:x=>x===stamp,instances:()=>[],choose(){},stop(){},redrawSelection(){draws++;},insert(){inserts++;},async edit(){edits++;},action(){},recordExternal(){}};const api=Engine.create(host);return {api,entry,field,host,get inserts(){return inserts},get edits(){return edits},get draws(){return draws},invalidate(){stamp={...field}}};}
test('selection caches exact results; idle library refresh emits no events; edits use the entire selection',async()=>{
 const f=fixture();let events=0;f.api.subscribe(()=>events++);f.api.refresh();const n=events;for(let i=0;i<100;i++)f.api.refresh();assert.equal(events,n);
 await f.api.select('a');const selected=f.api.getSelection().selected;assert.ok(f.api.getState().count>0);assert.equal(f.inserts,0);await f.api.select('a');assert.equal(f.api.getSelection().selected,selected);assert.equal(await f.api.colour('#aabbcc'),true);assert.equal(f.edits,1);f.invalidate();assert.equal(await f.api.removeMatches(),false);assert.equal(f.edits,1);
 f.entry.name='renamed';f.api.refresh();assert.ok(events>n);
});
test('a newer selection cancels an older asynchronous request',async()=>{
 const f=fixture();let resolve;f.host.field=()=>new Promise(r=>resolve=r);const pending=f.api.select('a');f.api.clear();resolve(f.field);await pending;assert.equal(f.api.getSelection(),null);assert.equal(f.api.getState().busy,false);
});
function actualHistory(){
 const controls={};const c={console,Uint32Array,Uint8Array,Uint8ClampedArray,Int8Array,Set,Map,Promise,setTimeout,window:{mayTemplateLibrary:{clear(){}}},document:{createElement:()=>({getContext:()=>({putImageData(){}})})},ImageData:function(data,width,height){Object.assign(this,{data,width,height});},
  $:id=>controls[id]??=( {value:'',disabled:false,textContent:''}),f:{val:new Int8Array([1,0,1,0]),W:4,H:1},img:{width:4,height:1},gpuBig:null,k:1,bmGen:0,playing:false,st:{},templateMatchLayer:null,templateMatchRevision:0,templateMatchCache:null,
  templateItems:[{id:'copy',libraryId:'a',hex:'#112233',name:'A',view:{visible:true},parts:[{mask:{width:1,height:1,data:Uint32Array.of(0xff332211)},canvas:{}}]}],colourTemplate:null,templateLibrary:[{id:'a',name:'A',shape:{hex:'#112233'}}],removedTemplateIds:new Set(),templatePickedIds:new Set(),faceLayer:null,colReplaySnapshot:()=>[],colReplayRestore(){},
  fillHistory:[],fillRedo:[],fillHistoryBytes:0,fillMask:null,paintBits:null,fillBits:null,templateStatsKey:'',templateDragging:false,mirrorLive:false,mirrorApplying:false,templateSync(){},draw(){},fillSync(){},savePaint(){},persistLibrary(){},rememberTemplate(){},MayatnikPaintCache:{write:async()=>{}},selectTemplate(t){c.colourTemplate=t;},rgba:rgb=>(0xff000000|rgb[2]<<16|rgb[1]<<8|rgb[0])>>>0,hexRGB:h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),MayatnikTemplateMatcher:M};
 vm.createContext(c);const slices=[['  function pushHistory(','  function editSnapshot('],['  function historyStep(','  $(\'bFillUndo\').onclick'],['  function recolourTemplate(','  $(\'templateColour\').onchange'],['  function templateMatchKey(','  async function templateMatchField('],['  function templateSceneHistory(','  window.mayTemplateLibrary=']];
 for(const [a,b]of slices)vm.runInContext(html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a))),c);return c;
}
test('production batch recolour/delete use common undo/redo and preserve original source pixels',async()=>{
 const c=actualHistory(),initial=c.templateItems[0].parts[0].mask.data,stamp={owner:c.f,key:c.templateMatchKey(),revision:0,generation:0};const selection={field:stamp,selected:Uint8Array.from([1,0,1,0]),instances:['copy']};
 await c.templateMatchEdit(selection,'colour','#abcdef',()=>false);assert.equal(c.fillHistory.length,1);assert.equal(initial[0],0xff332211);assert.equal(c.templateItems[0].parts[0].mask.data[0],0xffefcdab);assert.equal(c.templateMatchLayer.paint[2],0xffefcdab);
 c.historyStep(false);assert.equal(c.templateItems[0].parts[0].mask.data[0],0xff332211);assert.equal(c.templateMatchLayer,null);c.historyStep(true);assert.equal(c.templateItems[0].parts[0].mask.data[0],0xffefcdab);
 selection.field={...stamp,revision:c.templateMatchRevision};await c.templateMatchEdit(selection,'delete',null,()=>false);assert.equal(c.templateItems.length,0);assert.equal(c.templateMatchLayer.bits[0],255);assert.equal(c.templateMatchLayer.bits[1],2);c.historyStep(false);assert.equal(c.templateItems.length,1);assert.equal(c.templateMatchLayer.bits[0],2);c.historyStep(true);assert.equal(c.templateItems.length,0);
 const restored=await Work.decode(await Work.encode({templateMatches:c.templateMatchLayer}));assert.deepEqual(restored.data.templateMatches.bits,c.templateMatchLayer.bits);
});
test('production external folder history uses the same undo/redo stack without mutating field',()=>{
 const c=actualHistory();let current='after';c.pushHistory({indices:new Uint32Array(),next:new Uint32Array(),previous:new Uint32Array(),bytes:1024,external:{before:'before',after:'after',apply:v=>current=v}});c.historyStep(false);assert.equal(current,'before');c.historyStep(true);assert.equal(current,'after');assert.deepEqual(c.f.val,Int8Array.from([1,0,1,0]));
});

test('production library deletion is separate from field deletion and common undo restores the entry',async()=>{
 const c=actualHistory();c.templateSync=()=>{};c.queueDigits=()=>{};vm.runInContext(html.slice(html.indexOf('  async function deleteLibraryItem('),html.indexOf('  function syncLibraryChoices(')),c);const entry=c.templateLibrary[0];await c.deleteLibraryItem(entry);assert.equal(c.templateLibrary.length,0);assert.equal(c.templateItems.length,1);assert.ok(c.removedTemplateIds.has('a'));c.historyStep(false);assert.equal(c.templateLibrary[0].id,'a');assert.equal(c.removedTemplateIds.size,0);c.historyStep(true);assert.equal(c.templateLibrary.length,0);
});

test('production scale API maps 1 to smooth, preserves 2..10 and never changes the zoom ceiling',()=>{
 const st={zsnap:true,zbase:2},c={window:{},st,zB:()=>st.zbase,zSnapApply(){}};vm.createContext(c);const line=html.split('\n').find(l=>l.includes('window.mayZSnap ='));vm.runInContext(line,c);for(const n of [1,2,3,10]){c.window.mayZSnap.set(n);assert.equal(c.window.mayZSnap.on(),n>1);if(n>1)assert.equal(c.window.mayZSnap.base(),n);}c.window.mayZSnap.set(11);assert.equal(st.zbase,10);assert.match(html,/MAX_ZOOM\s*=\s*512/);
});

test('current-row filtering hides absent templates, preserves library IDs and caches unchanged scans',async()=>{
 const entries=[{id:'wide',name:'Wide',shape:{parts:[{width:3,height:1,data:[1,1,0]}]}},{id:'tall',name:'Tall',shape:{parts:[{width:1,height:3,data:[1,1,0]}]}}];
 let rows=1,reads=0,active=true;const full=Int8Array.from([1,1,0,1,1,0,0,0,1]);let stamp;
 const host={entries:()=>entries,scope:()=>String(rows),filterActive:()=>active,field:async()=>{reads++;return stamp={width:3,height:rows,data:full.slice(0,rows*3)};},current:s=>s===stamp,visibleInstances:()=>false};
 const api=Engine.create(host);api.refresh();await api.whenFiltered();assert.deepEqual(api.list().map(t=>t.id),['wide']);assert.deepEqual(api.allIds(),['wide','tall']);
 for(let i=0;i<100;i++)api.refresh();assert.equal(reads,1);rows=3;api.refresh();await api.whenFiltered();assert.deepEqual(api.list().map(t=>t.id),['wide','tall']);
 active=false;rows=1;api.refresh();assert.equal(reads,2);active=true;api.refresh();await api.whenFiltered();assert.deepEqual(api.list().map(t=>t.id),['wide']);
});
test('existence scan returns early without allocating a full selection mask',async()=>{
 const found=await M.find({width:3,height:1,data:Int8Array.from([1,1,0])},[M.compile({width:3,height:1,data:[1,1,0]})],{existsOnly:true});assert.equal(found.count,1);assert.equal(found.selected,undefined);
});

test('Delete removes just the selected field copy; common undo/redo restores it without touching the library',()=>{
 const c=actualHistory();c.templateLocks=null;c.colourTemplate=c.templateItems[0];c.templatePickedIds=new Set();c.pickedTemplates=()=>c.colourTemplate?[c.colourTemplate]:[];c.selectTemplate=t=>{c.colourTemplate=t;};
 c.templateItems.push({...c.templateItems[0],id:'second'});const library=c.templateLibrary[0],data=c.f.val.slice();
 vm.runInContext(html.slice(html.indexOf('  function removeSelectedTemplate('),html.indexOf("  $('bTemplateRemove').onclick=")),c);
 assert.equal(c.removeSelectedTemplate(),true);assert.deepEqual(c.templateItems.map(t=>t.id),['second']);assert.equal(c.colourTemplate,null);assert.equal(c.removeSelectedTemplate(),false);assert.equal(c.templateLibrary[0],library);assert.deepEqual(c.f.val,data);
 c.historyStep(false);assert.equal(c.templateItems.length,2);assert.equal(c.colourTemplate.id,'copy');c.historyStep(true);assert.equal(c.templateItems.length,1);assert.equal(c.templateLibrary[0].id,'a');
});
test('production Delete hotkey respects text editing, composition and active drag',()=>{
 let handler,deletes=0;const c={addEventListener:(name,fn)=>handler=fn,colourTemplate:{id:'a'},templateDragging:false,axisSelected:0,$:()=>({click:()=>deletes++})};vm.createContext(c);
 const a=html.lastIndexOf("  addEventListener('keydown', e => {",html.indexOf("// v0.104: Delete")),b=html.indexOf("  cv.addEventListener('pointermove'",a);assert.ok(a>0);vm.runInContext(html.slice(a,b),c);
 const event=editing=>({key:'Delete',target:{closest:()=>editing},preventDefault(){this.defaultPrevented=true;}});
 handler(event(false));assert.equal(deletes,1);handler(event(true));assert.equal(deletes,1);handler({...event(false),isComposing:true});assert.equal(deletes,1);
 c.templateDragging={};handler(event(false));assert.equal(deletes,1);
 const hit=html.slice(html.indexOf('if(hit){axisSelected=0;'),html.indexOf('      if(part){',html.indexOf('if(hit){axisSelected=0;')));assert.ok(hit.includes('wrap.focus({preventScroll:true})'));assert.ok(hit.includes('selectTemplate(hit.item,false,false,true)'));
});
test('hidden in-range copies stay listed and visibility does not insert or discard the library entry',async()=>{const f=fixture();let visible=true;f.host.scope=()=> 'field';f.host.listedInstances=()=>true;f.host.visibleInstances=()=>visible;f.host.visibility=()=>({placed:1,visible});f.host.action=()=>{visible=!visible;};const api=Engine.create(f.host);api.refresh();await api.whenFiltered();assert.equal(api.list().length,1);await api.action('a','visible');await api.whenFiltered();assert.equal(api.visibility('a').visible,false);assert.equal(api.list()[0].id,'a');assert.equal(f.inserts,0);await api.action('a','visible');assert.equal(api.visibility('a').visible,true);});
