const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const L=require('./mayatnik-template-limit.js'),Engine=require('./mayatnik-template-engine.js');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
test('limit normalization, exact boundary and sparse bounding area',()=>{
 assert.match(L.error(8).message,/\u0428\u0430\u0431\u043b\u043e\u043d \u043d\u0435 \u0432\u044b\u0434\u0435\u043b\u0435\u043d/); assert.equal(L.normalize(undefined),4096);assert.equal(L.normalize(-4),4096);assert.equal(L.normalize(0.5),1);assert.equal(L.normalize(1e12),1048576);
 assert.equal(L.allowed(64,64,4096),true);assert.equal(L.allowed(65,64,4096),false);assert.equal(L.allowed(2.1,2,5),false);
 for(const missing of [undefined,null,'',false,NaN])assert.equal(L.normalize(missing),4096);assert.equal(L.normalize(0),0);assert.equal(L.normalize('0'),0);assert.equal(L.allowed(1e6,1e6,0),true);assert.match(L.error(0).message,/отключено/);
 assert.match(L.error(8).message,/кнопкой «Лимит» в разделе «Шаблоны»/);
 assert.throws(()=>L.flood({seed:0,match:()=>true,point:q=>[q?100:0,q?100:0],neighbours(q,visit){if(!q)visit(1);},limit:4096}),{name:'TemplateAreaLimitError'});
});
test('explicit unlimited selection and capture remove only the bounding-area guard',()=>{
 const options={seed:0,match:()=>true,point:q=>[q*100,0],neighbours:(q,visit)=>{if(q<99)visit(q+1);}};
 assert.throws(()=>L.flood({...options,limit:4096}),{name:'TemplateAreaLimitError'});const cells=L.flood({...options,limit:0});assert.equal(cells.length,100);assert.equal(cells.at(-1),99);
 const source=new Uint32Array(65*65).fill(7);assert.throws(()=>L.capture(source,65,65,7,0,65,1,4096),{name:'TemplateAreaLimitError'});const captured=L.capture(source,65,65,7,0,65,1,0);assert.equal(captured.width,65);assert.equal(captured.height,65);assert.equal(captured.count,4225);assert.deepEqual(captured.data,source);
});
test('huge virtual field aborts after bounded frontier without full arrays',()=>{
 let reads=0;assert.throws(()=>L.flood({seed:0,limit:4096,match:()=>{reads++;return true;},point:q=>[q,0],neighbours:(q,visit)=>visit(q+1)}),{name:'TemplateAreaLimitError'});assert.equal(reads,4097);
 let pixels=0;const source=new Proxy({},{get(_,key){if(key==='length')return 1e12;pixels++;return 5;}});
 assert.throws(()=>L.capture(source,1e6,1e6,5,0,1e6,1,8),{name:'TemplateAreaLimitError'});assert.equal(pixels,9);
});
function selectionFixture(mode,p=-1){
 const W=9,H=9,data=new Uint32Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++)data[y*W+x]=((x+y)%3===0||x===4)?11:22;
 const c={MayatnikCellArea:require('./mayatnik-cell-area.js'),MayatnikTemplateLimit:L,MayatnikFill:require('./mayatnik-fill.js'),st:{fillArea:mode,templateMaxArea:1000},img:{width:W,height:H,data:new Uint8ClampedArray(data.buffer)},pxBase:null,pxAnimPre:null,pxHide:new Set(),pxFam:()=>'',rgba:()=>0,EMPTY:[],RK:1,VX:0,VW:W,VH:H,autoVertical:0,pxView:()=>c.img,joinedOn:()=>false,displayPoint:(c,r)=>({x:c+.5,y:r+.5}),
 fieldCellAt:(x,y)=>({c:x,r:y,p,ox:0}),fillBit:(x,y)=>x>=0&&x<W&&y>=0&&y<H?0:-1,rasterBit:(x,y)=>x>=0&&x<W&&y>=0&&y<H?0:-1,cellPixels:(cell,visit)=>visit(cell.r*W+cell.c)};
 vm.createContext(c);for(const[a,b]of [['  function templatePickSelection(','  function paintSelection('],['  function paintSelection(','  // v0.202:']]){const start=html.indexOf(a);vm.runInContext(html.slice(start,html.indexOf(b,start)),c);}return c;
}
test('production bounded selection agrees with existing fill connectivity, square and diamond neighbours',()=>{
 for(const p of [-1,0,1])for(const mode of ['sides','corners','diagonal','chess0','bit'])for(const x of [2,4,6]){
  const c=selectionFixture(mode,p),expected=Array.from(c.paintSelection(x,4,false,true).indices).sort((a,b)=>a-b),actual=Array.from(c.templatePickSelection(x,4).indices).sort((a,b)=>a-b);assert.deepEqual(actual,expected,`${mode}, p=${p}, x=${x}`);
 }
});
test('production item/shape guards include enlarged height, width, and ignore mask density',()=>{
 const c={MayatnikCellArea:require('./mayatnik-cell-area.js'),MayatnikTemplateLimit:L,st:{templateMaxArea:16},RK:2,templateRect:part=>part.rect};vm.createContext(c);
 const start=html.indexOf('  function templateItemAllowed(');vm.runInContext(html.slice(start,html.indexOf('  function templatePickSelection(',start)),c);
 assert.equal(c.templateItemAllowed({parts:[{rect:{width:8,height:8}}]}),true);assert.equal(c.templateItemAllowed({parts:[{rect:{width:8,height:10}}]}),false);
 const shape={rk:2,height:200,parts:[{width:8,height:4,data:[1]}]};assert.equal(c.templateShapeAllowed(shape),true);shape.proportional=true;assert.equal(c.templateShapeAllowed(shape),false);assert.equal(c.templateShapeAllowed(shape,false),true);
});
test('library refuses before field copy and keeps prior selection',async()=>{
 let allowed=true,copies=0,chooses=0;globalThis.MayatnikTemplateMatcher={compile:p=>p,find:async()=>({count:1,selected:Uint8Array.of(1)})};const entry={id:'a',shape:{parts:[{width:1,height:1}]}};
 const other={...entry,id:'b'},api=Engine.create({entries:()=>[entry,other],selectionAllowed:()=>allowed,selectionMessage:()=> 'limit',field:async()=>{copies++;return{};},current:()=>true,instances:()=>[],choose:()=>chooses++,stop(){},redrawSelection(){}});
 await api.select('a');const before=api.getSelection();allowed=false;await api.select('b');assert.equal(api.getSelection(),before);assert.equal(copies,1);assert.equal(chooses,1);assert.equal(api.getState().message,'limit');
});
test('limit setting persists in st and reloads without mutating saved shapes',()=>{
 const controls={templateMaxArea:{}},saved=[],events=[],c={st:{templateMaxArea:17},MayatnikTemplateLimit:L,$:id=>controls[id],window:{},save(){saved.push(JSON.stringify(c.st));},dispatchEvent:e=>events.push(e.type),Event:class{constructor(type){this.type=type;}}};vm.createContext(c);
 const start=html.indexOf('  st.templateMaxArea=');vm.runInContext(html.slice(start,html.indexOf('  st.parity=',start)),c);assert.equal(c.window.mayTemplateLimit.get(),17);c.window.mayTemplateLimit.set(64);assert.equal(JSON.parse(saved.at(-1)).templateMaxArea,64);c.st=JSON.parse(saved.at(-1));assert.equal(c.window.mayTemplateLimit.get(),64);assert.equal(controls.templateMaxArea.value,64);assert.equal(events.at(-1),'may-template-limit-change');
 c.window.mayTemplateLimit.set(0);assert.equal(JSON.parse(saved.at(-1)).templateMaxArea,0);c.st=JSON.parse(saved.at(-1));assert.equal(c.window.mayTemplateLimit.get(),0);assert.equal(controls.templateMaxArea.value,0);c.window.mayTemplateLimit.set(16384);assert.equal(c.window.mayTemplateLimit.get(),16384);
});

test('filter keeps oversize entries listed without compiling patterns or scanning the field',async()=>{
 const big={id:'big',name:'Big',shape:{parts:[]}};let copies=0;const api=Engine.create({entries:()=>[big],scope:()=>1,selectionAllowed:()=>false,field:async()=>{copies++;throw Error('unexpected field copy');},current:()=>true});api.refresh();await api.whenFiltered();assert.equal(copies,0);assert.equal(api.list()[0].id,'big');
});

test('production rejected field click stops before image mask/history and preserves existing figure',()=>{
 const c=selectionFixture('sides'),old={id:'keep',parts:[]};let notices=0;c.st.templateMaxArea=1;c.colourTemplate=old;c.cv={getBoundingClientRect:()=>({left:0,top:0,width:9,height:9})};c.hitTemplate=()=>null;c.stop=()=>{};c.k=1;c.halfOf=()=>[-1,0];c.rombP=()=>-1;c.templateLimitRefusal=()=>{notices++;return false;};c.editSnapshot=()=>{throw Error('history must not run');};c.document={createElement(){throw Error('canvas must not allocate');}};
 c.window={};const start=html.indexOf('  function takeColourAt(');vm.runInContext(html.slice(start,html.indexOf("  $('bTemplateShow').onclick",start)),c);assert.equal(c.takeColourAt(4,4),false);assert.equal(c.colourTemplate,old);assert.equal(notices,1);
 assert.match(html,/if\(takeColourAt\(e.clientX,e.clientY\)\)\{axisSelected=0;window.mayTemplateLibrary\?\.clear\(\)/);
});
