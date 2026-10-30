const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),D=require('./mayatnik-template-dedup.js');
const html=fs.readFileSync(process.env.MAYATNIK_TEST_HTML||__dirname+'/Zerkalius-mayatnik.html','utf8');
const section=(a,b)=>{const start=html.indexOf(a),end=html.indexOf(b,start);assert.ok(start>=0&&end>start,a);return html.slice(start,end);};
function fixture(){
 const nodes={templateName:{value:'Серый'},paintCacheInfo:{textContent:''}},entries=[],item={id:'field',view:{}},events=[];
 let shape;const c={window:{},MayatnikTemplateDedup:D,templateLibrary:entries,colourTemplate:item,templateItems:[item],libraryReady:Promise.resolve(),templateSnapshot:()=>shape,$:id=>nodes[id],sceneSnapshot:()=>({}),templateSceneHistory(){},savePaint(){},libraryList(){},dispatchEvent:e=>events.push(e),CustomEvent:class{constructor(type,args){this.type=type;this.detail=args.detail;}},MayatnikPaintCache:{write:async()=>{}},RK:1,VX:10,rombP:()=>-1,displayCell:(x,y)=>x<0?null:{c:10+Math.floor(x),r:Math.floor(y)},visibleSemanticContext:()=>({readBit:(x,y)=>x%2}),};
 vm.createContext(c);vm.runInContext(section('  function templateLibraryCaptureParts(','  function templateSnapshot('),c);vm.runInContext(section('  async function saveTemplateLibrary(','  function useLibraryTemplate('),c);
 function create(y=3,colour=0xff556677){const parts=c.templateLibraryCaptureParts([{mask:{x:2,y,width:2,height:1,data:Uint32Array.of(colour,colour)},axis:3,ox:0}]);return {hex:'#556677',rk:1,height:100,proportional:false,parts:[{width:2,height:1,y,center:3,data:[colour,colour]}],libraryProof:D.serialize(parts)};}
 shape=create();return {c,nodes,entries,item,events,create,get shape(){return shape},set shape(s){shape=s}};
}
test('actual Save reuses identical found/recoloured captures, preserving the first name and pixels',async()=>{
 const h=fixture(),id=await h.c.saveTemplateLibrary(),before=JSON.stringify(h.entries[0]);h.item.libraryId=null;h.nodes.templateName.value='Найденный 1';h.shape=h.create(3,0xff00ffff);
 assert.equal(await h.c.saveTemplateLibrary(),id);assert.equal(h.entries.length,1);assert.equal(JSON.stringify(h.entries[0]),before);assert.equal(h.events.at(-1).detail.name,'Серый');assert.match(h.nodes.paintCacheInfo.textContent,/уже в библиотеке/);
 h.item.libraryId=null;h.shape=h.create(4);assert.notEqual(await h.c.saveTemplateLibrary(),id);assert.equal(h.entries.length,2,'different source row stays independent');
});
test('actual fresh autosave and concurrent repeated captures share the first entry; explicit linked save still updates',async()=>{
 const h=fixture(),ids=await Promise.all([h.c.saveTemplateLibrary(true),h.c.saveTemplateLibrary(true)]);assert.equal(ids[0],ids[1]);assert.equal(h.entries.length,1);assert.equal(h.events.length,0);
 h.shape=h.create(3,0xff00ffff);await h.c.saveTemplateLibrary();assert.equal(h.entries.length,1);assert.equal(h.entries[0].shape.parts[0].data[0],0xff00ffff,'explicit linked Save updates its entry');
});
test('actual capture records visible semantic bits, own edited bits and immutable original addresses',()=>{
 const h=fixture();h.c.visibleSemanticContext=()=>({readBit:()=>1});const mask={x:2,y:3,width:2,height:1,data:Uint32Array.of(8,8)};
 const parts=h.c.templateLibraryCaptureParts([{mask,bitsData:Int8Array.of(0,-1)}]);assert.deepEqual(D.serialize(parts).parts[0].runs,[[0,1,12,3,0],[1,2,13,3,1]]);
 h.c.displayCell=()=>({c:900,r:900});assert.equal(h.c.templateLibraryCaptureParts(parts)[0],parts[0],'view changes cannot reinterpret old captured proof');
 const old={mask,sourceOrigin:{mask}};assert.equal(h.c.templateLibraryCaptureParts([old])[0],old,'legacy transformed origins remain unknown');
});
test('materialized offscreen matches use the captured semantic field and source coordinates',()=>{
 const h=fixture(),data=new Int8Array(40);data[8]=1;data[9]=0;const item={parts:[{mask:{x:-2,y:0,width:2,height:1,data:Uint32Array.of(8,8)}}]};
 h.c.visibleSemanticContext=()=>{throw Error('CPU raster not available');};h.c.window.mayTemplateDedup.capture(item,{width:20,data});assert.deepEqual(D.serialize(item.parts).parts[0].runs,[[0,1,8,0,1],[1,2,9,0,0]]);
 assert.match(html,/mayTemplateDedup\?\.capture\(item,request\.field\)/);
});
test('actual import reuses proven entries and preserves unknown legacy entries',async()=>{
 const h=fixture();await h.c.saveTemplateLibrary();const known=structuredClone(h.shape),legacy=structuredClone(known);delete legacy.libraryProof;
 const payload={format:'mayatnik-templates',version:1,templates:[{id:'x',name:'Found',shape:known},{id:'y',name:'Legacy',shape:legacy}]};
 h.nodes.templateFile={files:[{size:100,text:async()=>JSON.stringify(payload)}],value:'x'};h.c.clampInt=(v,a,b,d)=>Number.isFinite(v)?Math.max(a,Math.min(b,v)):d;
 vm.runInContext(section("  $('templateFile').onchange=",'  // Full-field template edits'),h.c);await h.nodes.templateFile.onchange();assert.equal(h.entries.length,2);assert.equal(h.entries[0].name,'Серый');assert.equal(h.entries[1].name,'Legacy');assert.match(h.nodes.paintCacheInfo.textContent,/Добавлено шаблонов: 1.*уже в библиотеке: 1/);
});
test('actual auto cut captures proof and a later recoloured repeat does not duplicate its representative',async()=>{
 const h=fixture();Object.assign(h.c,{img:{width:2,height:1},editSnapshot:()=>({}),geo:{anchor:10},k:1,rgba:()=>0,EMPTY:0,fillMask:null,finishEdit(){},draw(){}});
 vm.runInContext(section('  async function autoTplCut(',"  $('bLibPage').onclick="),h.c);
 const scan=col=>({W:2,H:1,byId:[0],id:Int8Array.of(0,0),regs:[{i:0,x:0,y:0,w:2,h:1,n:2,bit:1,col}]});
 await h.c.autoTplCut(scan(0xff112233));await h.c.autoTplCut(scan(0xff556677));assert.equal(h.entries.length,1);assert.deepEqual(h.entries[0].shape.libraryProof.parts[0].runs,[[0,1,10,0,1],[1,2,11,0,1]]);
});
test('proof is included in work parts and snapshot, and library insertion restores it before registration',()=>{
 assert.match(html,/sourceData:p\.sourceData,bitsData:p\.bitsData,librarySource:p\.librarySource/);
 assert.match(section('  function templateSnapshot(','  async function saveTemplateLibrary('),/libraryProof:window\.mayTemplateDedup\?\.proof\(colourTemplate\.parts\)/);
 const load=section('  function useLibraryTemplate(',"  $('bTemplateSave').onclick=");assert.match(load,/restoredParts=window\.mayTemplateDedup\?\.restore\(parts,shape\)/);assert.match(load,/colourTemplate=\{parts:restoredParts/);
});
