const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
function fn(name){const a=html.indexOf('function '+name+'('),b=html.indexOf('{',a);assert.ok(a>=0,name);let d=1,i=b+1;for(;d;i++){if(html[i]==='{')d++;if(html[i]==='}')d--;}return html.slice(a,i);}
function fixture(){
 const nodes=new Map(),meta=new Map(),make=(id,x)=>({id,hex:'#abcdef',view:{visible:true,height:100,down:0,x,alpha:100},parts:[{ox:0,axis:1,mask:{x:0,y:0,width:2,height:2,data:Uint32Array.of(1,1,1,1)},bitsData:Int8Array.of(0,1,1,0)}]});
 const a=make('a',0),b=make('b',1),c=vm.createContext({Uint32Array,Uint8Array,Int8Array,Set,Map,structuredClone,templateItems:[a,b],colourTemplate:a,templatePickedIds:new Set(['a','b']),templateVisible:true,templatePaintLayer:null,templateOffsetX:0,
  window:{mayLayers:{get:id=>meta.get(id)},mayTemplateLibrary:{clear(){}}},img:{width:10,height:5,data:new Uint8ClampedArray(200)},f:{W:10,H:5,val:Int8Array.from({length:50},(_,i)=>i%2)},k:1,VX:0,VW:10,VH:5,RK:1,RG:0,bmGen:0,st:{view:'bits'},fillKey:'fixture',fillField:null,
  fillMask:new Uint32Array(50),paintBits:null,fillBits:null,faceLayer:null,manualPaintState:null,manualPaintRevision:0,templateMatchLayer:null,templateMatchRevision:0,templateMatchCache:null,fillHistory:[],fillRedo:[],fillHistoryBytes:0,templateDragging:false,mirrorLive:false,mirrorApplying:false,templateLibrary:[],removedTemplateIds:new Set(),colReplay:[],colReplayPaint:null,gpuBig:null,
  $:id=>{if(!nodes.has(id))nodes.set(id,{value:id==='fillColour'?'#123456':id==='templateHeight'?'100':'0',checked:false,dataset:{},setAttribute(k,v){this[k]=v;}});return nodes.get(id);},scale:()=>1,dispW:()=>10,dispH:()=>5,joinedOn:()=>false,rombP:()=>-1,triangleMapRasterMask:()=>null,rasterBit:(x,y)=>c.f.val[y*10+x],rgba:rgb=>(0xff000000|rgb[2]<<16|rgb[1]<<8|rgb[0])>>>0,
  MayatnikTemplate:require('./mayatnik-template.js'),MayatnikPaintCache:{write:()=>Promise.resolve()},rememberTemplate(){},colReplaySnapshot:()=>[],colReplayRestore(){},manualPaintCurrent:()=>null,manualPaintClear(){},persistLibrary(){},templatePaintSync(){},savePaint(){},fillSync(){},lockWipe(){},selectTemplate(t){c.colourTemplate=t;c.templateVisible=!!t&&t.view?.visible!==false;},cssLayout(){},templateStatsKey:'',
  document:{createElement:()=>{const canvas={};canvas.getContext=()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:im=>canvas.pixels=new Uint32Array(im.data.buffer)});return canvas;}}
 });
 const geometry=html.indexOf('  const geometryKey =');vm.runInContext(html.slice(geometry,html.indexOf('\n',geometry)),c);
 for(const name of ['pickedTemplates','templateOptions','templateRect','templatePaintTargets','templatePaintColour','templatePaintSync','templatePaintValidate','templatePaintBuild','templatePaintApply','templatePaintCanvas','templatePaintToggle','templatePaintColourChanged','sceneSnapshot','editSnapshot','finishEdit','pushHistory','paintHistoryCurrent','historyStep','templateSceneHistory','paintSnapshot'])vm.runInContext(fn(name),c);
 c.draw=()=>{c.pixels=Uint32Array.from(c.f.val,v=>v===1?0xffffffff:v===0?0xff444444:0);if(c.fillMask)for(let q=0;q<50;q++)if(c.fillMask[q])c.pixels[q]=c.fillMask[q];c.templatePaintApply(c.pixels);};
 const start=html.indexOf("  $('bFillClear').onclick="),end=html.indexOf("  $('bRegions').onclick",start);vm.runInContext(html.slice(start,end),c);
 c.draw();return {c,a,b,meta};
}
test('one ON paints 0 and 1 in every selected silhouette; overlap is one union and field/source/fill are unchanged',()=>{
 const {c,a,b}=fixture(),bits=c.f.val.slice(),source=a.parts[0].bitsData.slice();c.fillMask[0]=0xff778899;const old=c.fillMask.slice();c.templatePaintToggle();
 assert.equal(c.fillHistory.length,1);assert.deepEqual(Object.keys(c.templatePaintLayer.colours),['a','b']);assert.deepEqual([...c.templatePaintBuild([a,b]).indices].sort((x,y)=>x-y),[0,1,2,10,11,12]);
 for(const q of [0,1,2,10,11,12])assert.equal(c.pixels[q],0xff563412);assert.deepEqual(c.f.val,bits);assert.deepEqual(a.parts[0].bitsData,source);assert.deepEqual(c.fillMask,old);
 assert.deepEqual([...c.templatePaintCanvas(a.parts[0],a).pixels],Array(4).fill(0xff563412));
 c.fillMask[1]=0xffaabbcc;c.templatePaintToggle();assert.equal(c.pixels[0],0xff778899);assert.equal(c.pixels[1],0xffaabbcc);assert.equal(c.templatePaintCanvas(a.parts[0],a),null);
});
test('A red then B blue never recolours A; the current selection alone controls ON/OFF and the palette',()=>{
 const {c,a,b}=fixture(),pick=item=>{c.colourTemplate=item;c.templatePickedIds=new Set(item?[item.id]:[]);c.templateOffsetX=item?.view.x||0;c.templatePaintSync();};
 pick(a);c.$('fillColour').value='#ff0000';c.templatePaintToggle();assert.equal(c.$('bTemplatePaint')['aria-pressed'],'true');
 pick(b);assert.equal(c.$('bTemplatePaint')['aria-pressed'],'false');c.$('fillColour').value='#0000ff';c.templatePaintColourChanged();assert.equal(c.templatePaintColour('a'),'#ff0000');assert.equal(c.templatePaintColour('b'),null);
 c.templatePaintToggle();assert.equal(c.templatePaintColour('a'),'#ff0000');assert.equal(c.templatePaintColour('b'),'#0000ff');assert.equal(c.pixels[0],0xff0000ff);assert.equal(c.pixels[1],0xffff0000);
 c.templatePaintToggle();assert.equal(c.templatePaintColour('a'),'#ff0000');assert.equal(c.templatePaintColour('b'),null);assert.equal(c.pixels[1],0xff0000ff);assert.equal(c.templatePaintCanvas(a.parts[0],a).pixels[0],0xff0000ff);assert.equal(c.templatePaintCanvas(b.parts[0],b),null);
 c.historyStep(false);assert.equal(c.templatePaintColour('a'),'#ff0000');assert.equal(c.templatePaintColour('b'),'#0000ff');c.historyStep(true);assert.equal(c.templatePaintColour('a'),'#ff0000');assert.equal(c.templatePaintColour('b'),null);
 pick(null);assert.equal(c.$('bTemplatePaint').disabled,true);assert.equal(c.$('bTemplatePaint')['aria-pressed'],'false');c.templatePaintToggle();assert.equal(c.templatePaintColour('a'),'#ff0000');
 pick(a);assert.equal(c.$('bTemplatePaint')['aria-pressed'],'true');c.templatePaintToggle();assert.equal(c.templatePaintLayer,null);
});
test('mixed current selection enables the selected set, while palette and OFF never touch an unselected assignment',()=>{
 const {c,a,b}=fixture();const third={...b,id:'c',view:{...b.view,x:6}};c.templateItems.push(third);
 c.templatePaintLayer={version:2,colours:{a:'#ff0000',c:'#00ff00'}};c.templatePaintSync();assert.equal(c.$('bTemplatePaint')['aria-pressed'],'false');
 c.$('fillColour').value='#0000ff';c.templatePaintColourChanged();assert.equal(c.templatePaintColour('a'),'#0000ff');assert.equal(c.templatePaintColour('b'),null);assert.equal(c.templatePaintColour('c'),'#00ff00');
 c.templatePaintToggle();assert.equal(c.$('bTemplatePaint')['aria-pressed'],'true');assert.equal(c.templatePaintColour('b'),'#0000ff');assert.equal(c.templatePaintColour('c'),'#00ff00');
 c.templatePaintToggle();assert.equal(c.templatePaintColour('a'),null);assert.equal(c.templatePaintColour('b'),null);assert.equal(c.templatePaintColour('c'),'#00ff00');c.historyStep(false);assert.equal(c.templatePaintColour('a'),'#0000ff');assert.equal(c.templatePaintColour('b'),'#0000ff');assert.equal(c.templatePaintColour('c'),'#00ff00');
});
test('different coloured overlaps follow layer order and hiding or removing the upper figure reveals the lower colour',()=>{
 const {c,a,b,meta}=fixture();c.templatePaintLayer={version:2,colours:{a:'#ff0000',b:'#0000ff'}};c.draw();assert.equal(c.pixels[1],0xffff0000);
 meta.set('template:a',{order:2});meta.set('template:b',{order:1});c.draw();assert.equal(c.pixels[1],0xff0000ff);assert.equal(c.templatePaintCanvas(b.parts[0],b).pixels[0],0xffff0000);
 meta.get('template:a').visible=false;c.draw();assert.equal(c.pixels[1],0xffff0000);meta.get('template:a').visible=true;c.templateItems=[b];c.colourTemplate=b;c.templateOffsetX=1;c.draw();assert.equal(c.pixels[1],0xffff0000);assert.equal(c.templatePaintColour('a'),'#ff0000');
});
test('live geometry follows movement, resizing, layer offset, hiding and removal without leaving stamps',()=>{
 const {c,a,b,meta}=fixture();c.templatePickedIds=new Set(['a']);c.templatePaintToggle();c.templateOffsetX=4;c.draw();assert.notEqual(c.pixels[0],0xff563412);assert.equal(c.pixels[4],0xff563412);
 c.$('templateHeight').value=200;c.draw();assert.equal(c.pixels[34],0xff563412);meta.set('template:a',{x:2,y:1,visible:true,opacity:100});c.draw();assert.notEqual(c.pixels[4],0xff563412);assert.equal(c.pixels[16],0xff563412);
 meta.get('template:a').visible=false;c.draw();assert.equal(c.pixels.includes(0xff563412),false);meta.get('template:a').visible=true;c.templateVisible=false;c.draw();assert.equal(c.pixels.includes(0xff563412),false);
 c.templateVisible=true;c.templateItems=[b];c.colourTemplate=b;c.draw();assert.equal(c.pixels.includes(0xff563412),false);c.templateItems=[a,b];c.colourTemplate=a;c.draw();assert.equal(c.pixels[16],0xff563412);
});
test('hidden templates, transparent layers, holes, empty field and protected map are skipped; 0 is never treated as empty',()=>{
 const {c,a,b,meta}=fixture();b.view.visible=false;c.f.val[1]=-1;a.parts[0].mask.data[2]=0;const blocked=new Uint8Array(50);blocked[11]=1;c.triangleMapRasterMask=()=>blocked;c.templatePaintToggle();assert.deepEqual(Object.keys(c.templatePaintLayer.colours),['a']);assert.deepEqual([...c.templatePaintBuild([a]).indices],[0]);assert.equal(c.pixels[0],0xff563412);assert.notEqual(c.pixels[1],0xff563412);
 c.templatePaintToggle();meta.set('template:a',{opacity:0});c.templatePaintSync();assert.equal(c.$('bTemplatePaint').disabled,true);
});
test('colour changes while ON update the same layer and are undoable; OFF colour changes do not paint',()=>{
 const {c,a}=fixture();c.$('fillColour').value='#fedcba';c.templatePaintColourChanged();assert.equal(c.templatePaintLayer,null);c.templatePaintToggle();const first=c.templatePaintLayer;
 c.$('fillColour').value='#102030';c.templatePaintColourChanged();assert.equal(c.templatePaintLayer.colours.a,'#102030');assert.equal(c.pixels[0],0xff302010);assert.equal(c.templatePaintCanvas(a.parts[0],a).pixels[0],0xff302010);
 c.historyStep(false);assert.equal(c.templatePaintLayer,first);assert.equal(c.pixels[0],0xffbadcfe);c.historyStep(true);assert.equal(c.pixels[0],0xff302010);
});
test('continuous colour input is coalesced and keeps the original colour for one Undo',()=>{
 const {c}=fixture();c.templatePaintToggle();c.$('fillColour').value='#102030';c.templatePaintColourChanged();c.$('fillColour').value='#112233';c.templatePaintColourChanged();assert.equal(c.fillHistory.length,2);assert.equal(c.pixels[0],0xff332211);c.historyStep(false);assert.equal(c.pixels[0],0xff563412);
});
test('palette coalescing cannot join A and B selections, including a selection-only excursion',()=>{
 const {c,a,b}=fixture(),pick=item=>{c.colourTemplate=item;c.templatePickedIds=new Set([item.id]);c.templateOffsetX=item.view.x;c.templatePaintSync();};c.templatePaintLayer={version:2,colours:{a:'#ff0000',b:'#0000ff'}};
 pick(a);c.$('fillColour').value='#112233';c.templatePaintColourChanged();pick(b);c.$('fillColour').value='#445566';c.templatePaintColourChanged();assert.equal(c.fillHistory.length,2);assert.equal(c.templatePaintColour('a'),'#112233');assert.equal(c.templatePaintColour('b'),'#445566');
 c.historyStep(false);assert.equal(c.templatePaintColour('a'),'#112233');assert.equal(c.templatePaintColour('b'),'#0000ff');c.historyStep(true);pick(a);c.$('fillColour').value='#223344';c.templatePaintColourChanged();const n=c.fillHistory.length;pick(b);pick(a);c.$('fillColour').value='#334455';c.templatePaintColourChanged();assert.equal(c.fillHistory.length,n+1);c.historyStep(false);assert.equal(c.templatePaintColour('a'),'#223344');assert.equal(c.templatePaintColour('b'),'#445566');
});
test('both displayed halves and per-layer screen offsets use the same raster geometry',()=>{
 const {c,a}=fixture();c.img={width:24,height:5};a.parts.push({...a.parts[0],ox:12,mask:{...a.parts[0].mask,x:12},axis:13});c.templateItems=[a];c.templatePickedIds=new Set(['a']);c.rasterBit=()=>0;
 assert.deepEqual([...c.templatePaintBuild([a]).indices].sort((x,y)=>x-y),[0,1,12,13,24,25,36,37]);
});
test('changing frames stashes the live command with its templates and returning restores it',()=>{
 const {c}=fixture();Object.assign(c,{paintStash:new Map(),fillField:c.f,fillKey:'1:flat:0:10:5:1',manualPaintFrameSync(){},paintLockCheck(){},resetFillHistory(){},templateSync(){}});vm.runInContext(fn('clearFill')+fn('applyFill'),c);
 c.templatePaintToggle();const before=c.templatePaintLayer;c.k=2;c.applyFill(new Uint32Array(50));assert.equal(c.templatePaintLayer,null);assert.equal(c.templateItems.length,0);c.k=1;const px=new Uint32Array(50);c.applyFill(px);assert.equal(c.templatePaintLayer,before);assert.equal(c.templateItems.length,2);assert.equal(px[0],0xff563412);assert.equal(px[2],0xff563412);
});
test('ON/OFF, Clear, Undo and Redo preserve independent paint layers and selected template objects',()=>{
 const {c}=fixture();c.fillMask[4]=0xff987654;c.templatePaintToggle();const layer=c.templatePaintLayer;c.historyStep(false);assert.equal(c.templatePaintLayer,null);c.historyStep(true);assert.equal(c.templatePaintLayer,layer);
 c.templatePaintToggle();c.historyStep(false);assert.equal(c.templatePaintLayer,layer);c.historyStep(true);assert.equal(c.templatePaintLayer,null);c.historyStep(false);
 c.$('bFillClear').onclick();assert.equal(c.templatePaintLayer,null);assert.equal(c.fillMask,null);c.historyStep(false);assert.equal(c.templatePaintLayer,layer);assert.equal(c.fillMask[4],0xff987654);c.historyStep(true);assert.equal(c.templatePaintLayer,null);
});
test('saved work/F5 payload retains the explicit live command and old files remain OFF',async()=>{
 const {c}=fixture();c.manualPaintSnapshot=()=>null;c.autoPaintIds=[];c.mirrorLive=false;c.mirrorXor=false;c.templateReturn=null;c.templatePaintBit=1;c.templateMatchLayer=null;c.templateOffsetX=0;c.templatePaintToggle();
 c.templatePaintCanvas(c.templateItems[0].parts[0],c.templateItems[0]);const Work=require('./mayatnik-work-file.js'),saved=c.paintSnapshot();assert.equal(saved.templates[0].parts[0].commandPaint,undefined);const decoded=await Work.decode(await Work.encode(saved));const restored=fixture().c;restored.templatePaintLayer=restored.templatePaintValidate(decoded.data.templatePaint);restored.draw();assert.equal(restored.pixels[0],0xff563412);restored.templatePaintToggle();assert.equal(restored.templatePaintLayer,null);
 assert.equal(restored.templatePaintValidate(undefined),null);assert.throws(()=>restored.templatePaintValidate({version:1,ids:['a'],hex:'bad'}),/окраска/);
 assert.match(html,/templatePaintLayer=templatePaintValidate\(data.templatePaint/);assert.match(html,/templatePaintLayer=back.templatePaintLayer\|\|null/);
});
test('v1 work migrates to independent v2 assignments; v2 binary reload preserves different colours and subset OFF',async()=>{
 const {c,a,b}=fixture(),legacy={version:1,ids:['a','b'],hex:'#ff0000'};c.templatePaintLayer=c.templatePaintValidate(legacy);assert.equal(c.templatePaintLayer.version,2);assert.equal(c.templatePaintColour('a'),'#ff0000');assert.equal(c.templatePaintColour('b'),'#ff0000');assert.equal(legacy.version,1);
 c.colourTemplate=b;c.templateOffsetX=1;c.templatePickedIds=new Set(['b']);c.$('fillColour').value='#0000ff';c.templatePaintColourChanged();const Work=require('./mayatnik-work-file.js'),encoded=await Work.encode({templatePaint:c.templatePaintLayer}),decoded=await Work.decode(encoded),restored=fixture().c;restored.templatePaintLayer=restored.templatePaintValidate(decoded.data.templatePaint);
 restored.colourTemplate=restored.templateItems[1];restored.templateOffsetX=1;restored.templatePickedIds=new Set(['b']);restored.draw();assert.equal(restored.pixels[0],0xff0000ff);assert.equal(restored.pixels[1],0xffff0000);restored.templatePaintToggle();assert.equal(restored.templatePaintColour('a'),'#ff0000');assert.equal(restored.templatePaintColour('b'),null);
 for(const bad of [{version:2,colours:[]},{version:2,colours:{a:'red'}},{version:3,colours:{a:'#112233'}}])assert.throws(()=>restored.templatePaintValidate(bad),/окраска/);
});
test('menu uses the shared colour-circle control and its picker cannot invoke the command',()=>{
 const menu=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8');assert.match(menu,/withColour\('bTemplatePaint','fillColour','Прокрасть'\)/);assert.doesNotMatch(html,/textContent='Под ним:/);
 let clicks=0,opens=0;const c=vm.createContext({$:id=>({id,value:'#123456'}),tgl:()=>({tip:'paint',on:()=>false,click:()=>clicks++}),picker:()=>()=>opens++,pair:(a,b)=>({parts:[a,b]})});
 const a=menu.indexOf('  const withColour ='),b=menu.indexOf('  const both =',a);vm.runInContext(menu.slice(a,b)+";this.button=withColour('bTemplatePaint','fillColour','Прокрасть');",c);c.button.parts[1].open();assert.equal(opens,1);assert.equal(clicks,0);c.button.parts[0].click();assert.equal(clicks,1);
 const short=fs.readFileSync(__dirname+'/../_js/menu-icons.js','utf8');assert.match(short,/"mayatnik:bTemplatePaint":"Прокрасть"/);
});
