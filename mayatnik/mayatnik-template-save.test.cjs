const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const repo=fs.existsSync(__dirname+'/mayatnik-template-engine.js')?__dirname:require('node:path').resolve(__dirname,'../../../Binary-Drum-Machine/mayatnik');
const html=fs.readFileSync(process.env.MAY_INLINE_HTML||repo+'/Zerkalius-mayatnik.html','utf8');
const saveCode=html.slice(html.indexOf('  async function saveTemplateLibrary('),html.indexOf('  function useLibraryTemplate('));
global.MayatnikTemplateMatcher=require(repo+'/mayatnik-template-matcher.js');const Engine=require(repo+'/mayatnik-template-engine.js');
function hostFixture(){
 let revision=0,field,scans=0;const item={id:'field',parts:[{mask:{width:2,height:1,data:Uint32Array.from([1,0])}}],view:{visible:true}},entries=[],shape={hex:'#123456',parts:[{width:2,height:1,data:[1,0]}]},events=[],persist=[];
 const host={entries:()=>entries,scope:()=>revision,filterActive:()=>true,visibleInstances:id=>item.libraryId===id&&item.view.visible,field:async()=>{scans++;return field={width:2,height:1,data:Int8Array.from([1,0]),revision}},current:f=>f.revision===revision,redrawSelection(){}};
 const engine=Engine.create(host),nodes={templateName:{value:'Новый'},templateList:{value:'unrelated'},paintCacheInfo:{textContent:''}};
 const c={colourTemplate:item,templateItems:[item],templateLibrary:entries,libraryReady:Promise.resolve(),templateSnapshot:()=>shape,$:id=>nodes[id],sceneSnapshot:()=>({}),templateSceneHistory:()=>revision++,savePaint(){},libraryList:()=>engine.refresh(),window:{mayTemplateLibrary:engine},MayatnikPaintCache:{write:async v=>persist.push(JSON.parse(JSON.stringify(v)))},dispatchEvent:e=>events.push(e),CustomEvent:class{constructor(type,args){this.type=type;this.detail=args.detail;}}};vm.createContext(c);vm.runInContext(saveCode,c);return {c,item,entries,shape,events,persist,engine,nodes,get scans(){return scans}};
}
test('saving selected field figure publishes a visible card after history invalidation and persists it',async()=>{
 const f=hostFixture(),id=await f.c.saveTemplateLibrary();await f.engine.whenFiltered();assert.equal(f.entries.length,1);assert.equal(f.item.libraryId,id);assert.deepEqual(f.engine.list().map(x=>x.id),[id]);assert.equal(f.scans,0);assert.equal(f.persist[0][0].id,id);assert.equal(f.engine.getState().selectedId,id);assert.equal(f.events[0].type,'may-template-saved');assert.match(f.engine.getState().message,/сохранён/);
});
test('new figure never overwrites unrelated library choice; linked save updates and rename creates another entry',async()=>{
 const f=hostFixture();f.entries.push({id:'unrelated',name:'Новый',shape:f.shape});const id=await f.c.saveTemplateLibrary();assert.notEqual(id,'unrelated');assert.equal(f.entries.length,2);await f.c.saveTemplateLibrary();assert.equal(f.entries.length,2);f.nodes.templateName.value='Копия';await f.c.saveTemplateLibrary();assert.equal(f.entries.length,3);
});
test('storage rejection keeps local card and reports lack of persistence explicitly',async()=>{
 const f=hostFixture();f.c.MayatnikPaintCache.write=async()=>{throw Error('quota')};const id=await f.c.saveTemplateLibrary();assert.equal(f.engine.list()[0].id,id);assert.match(f.engine.getState().message,/память браузера недоступна/);
});
test('placed figures remain listed when source field is not ready; unrelated absent templates stay hidden',async()=>{
 const entries=['placed','absent'].map(id=>({id,name:id,shape:{parts:[{width:1,height:1,data:[1]}]}}));
 const api=Engine.create({entries:()=>entries,scope:()=>1,visibleInstances:id=>id==='placed',field:async()=>{throw Error('GPU pending')},current:()=>true});api.refresh();await api.whenFiltered();assert.deepEqual(api.list().map(x=>x.id),['placed']);
});
test('aborted scan can retry unchanged scope instead of caching an empty library',async()=>{
 let attempt=0;const entry={id:'one',name:'One',shape:{parts:[{width:1,height:1,data:[1]}]}};
 const api=Engine.create({entries:()=>[entry],scope:()=>1,field:async()=>{if(!attempt++){const e=Error('changed');e.name='AbortError';throw e;}return {width:1,height:1,data:Int8Array.of(1)}},current:()=>true});api.refresh();await api.whenFiltered();assert.equal(api.list().length,0);api.refresh();await api.whenFiltered();assert.equal(api.list().length,1);
});

test('automatic capture preserves panel visibility and does not steal library selection',async()=>{const f=hostFixture();await f.c.saveTemplateLibrary(true);assert.equal(f.entries.length,1);assert.equal(f.events.length,0);assert.equal(f.engine.getState().selectedId,null);});

test('late storage completion never steals newer library selection or reopens an undone card',async()=>{
 const f=hostFixture();let finish;f.c.MayatnikPaintCache.write=()=>new Promise(r=>finish=r);const pending=f.c.saveTemplateLibrary();await new Promise(setImmediate);assert.equal(f.events.length,1);f.engine.saved('other','Другой выбор');finish();await pending;assert.equal(f.events.length,1);assert.equal(f.engine.getState().selectedId,'other');assert.equal(f.engine.getState().message,'Другой выбор');
 const g=hostFixture();let end;g.c.MayatnikPaintCache.write=()=>new Promise(r=>end=r);const undone=g.c.saveTemplateLibrary();await new Promise(setImmediate);g.entries.splice(0);g.engine.clear('Отменено');end();await undone;assert.equal(g.events.length,1);assert.equal(g.engine.getState().message,'Отменено');
});
