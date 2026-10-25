const test=require('node:test'),assert=require('node:assert/strict'),Dim=require('./mayatnik-template-dim.js');
const alpha=(mask,x,y)=>mask.data[(y*mask.width+x)*4+3];
test('exact placed silhouette leaves holes dimmed, including selected bit 0 without changing its pixels',()=>{
 const data=Uint32Array.from([0xff212121,0,0xff212121,0xff212121]),bits=Int8Array.from([0,-1,1,-1]),before=data.slice();
 const m=Dim.raster(4,4,1,[{data,bits,width:2,height:2,rect:{x:1,y:1,width:2,height:2}}]);
 assert.equal(alpha(m,1,1),0,'bit0 selected');assert.equal(alpha(m,2,1),255,'mask hole');assert.equal(alpha(m,1,2),0,'bit1 selected');assert.equal(alpha(m,2,2),255,'empty own bit');assert.equal(alpha(m,0,0),255);assert.deepEqual(data,before);
});
test('scale, position, DPR, clip and visibility use the same nearest-pixel projection as the placed copy',()=>{
 const p={data:[1,0],width:2,height:1,rect:{x:1,y:1,width:4,height:2},clip:{x:2,y:0,width:4,height:4}};const m=Dim.raster(6,4,2,[p]);
 assert.equal(alpha(m,2,2),255,'outside clipping');assert.equal(alpha(m,4,2),0);assert.equal(alpha(m,5,3),0);assert.equal(alpha(m,6,3),255,'empty right half');
 const hidden=Dim.raster(6,4,2,[{...p,visible:false}]);assert.ok([...hidden.data].filter((_,i)=>i%4===3).every(a=>a===255));
});
test('library occurrences preserve all selected cells, including inverted zero, and respect parity visibility',()=>{
 const selected=Uint8Array.from([1,0,1,0,0,1,0,1]);const before=selected.slice();
 const m=Dim.raster(4,2,1,[],(x,y)=>!!selected[Math.floor(y)*4+Math.floor(x)],(x,y)=>(Math.floor(x)+Math.floor(y))%2===0);
 assert.equal(alpha(m,0,0),0);assert.equal(alpha(m,1,0),255);assert.equal(alpha(m,2,0),0);assert.equal(alpha(m,1,1),0);assert.deepEqual(selected,before);
});
test('library and manual-copy holes combine as union, without clearing the entire bounding box',()=>{
 const m=Dim.raster(3,2,1,[{data:[1,0],width:2,height:1,rect:{x:0,y:0,width:2,height:1}}],(x,y)=>x>=2&&y>=1);
 assert.equal(alpha(m,0,0),0);assert.equal(alpha(m,1,0),255);assert.equal(alpha(m,2,1),0);assert.equal(alpha(m,1,1),255);
});
test('cached viewport mask builds once at idle, invalidates on projection/selection/mask changes and unselect restores',()=>{
 let allocations=0,draws=0,lastAlpha=0;const canvas={getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}})};
 const helper=Dim.create({createCanvas:()=>{allocations++;return canvas;}}),context={save(){},restore(){},drawImage(){draws++;lastAlpha=this.globalAlpha;}};
 const data=[1],view={active:true,width:3,height:3,dpr:1,key:'flat|0|0|1',selectionToken:{},parts:[{data,width:1,height:1,rect:{x:0,y:0,width:1,height:1}}]};
 for(let i=0;i<100;i++)helper.draw(context,view);assert.equal(helper.builds,1);assert.equal(draws,100);assert.equal(lastAlpha,.25);assert.equal(allocations,1);
 helper.draw(context,{...view,key:'pan|1|0|1'});assert.equal(helper.builds,2);helper.draw(context,{...view,selectionToken:{}});assert.equal(helper.builds,3);helper.draw(context,{...view,parts:[{...view.parts[0],data:[0]}]});assert.equal(helper.builds,4);
 assert.equal(helper.draw(context,{...view,active:false}),false);assert.equal(draws,103);helper.draw(context,view);assert.equal(helper.builds,5);helper.clear();helper.draw(context,view);assert.equal(allocations,2);
});

const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),html=fs.readFileSync(path.join(__dirname,'Zerkalius-mayatnik.html'),'utf8');
function host(){const start=html.indexOf('  function drawTemplateDim('),end=html.indexOf('  function drawTemplate(){',start),calls=[],item={id:'A',view:{visible:true},parts:[{mask:{width:2,height:1,data:[1,0]},bitsData:new Int8Array([0,-1]),ox:0}]};let selection=null;
 const c=vm.createContext({window:{MayatnikTemplateDim:{},mayTemplateLibrary:{getSelection:()=>selection}},MayatnikTemplateDim:{create:()=>({draw:(ctx,view)=>calls.push(view)})},templateDimmer:null,templatePickedIds:new Set(),templateItems:[item],colourTemplate:item,templateVisible:true,templateMatchCurrent:()=>true,templateRect:()=>({x:1,y:1,width:2,height:1}),RK:1,RG:0,VX:0,VW:4,VH:4,st:{parity:{}},templateMatchRevision:0,rombP:()=>-1,dispW:()=>4,halfOf:x=>[0,x],f:{W:4,H:4},parityVisible:()=>true});vm.runInContext(html.slice(html.indexOf('  function pickedTemplates()'),html.indexOf('  function templatePickSync()'))+html.slice(start,end),c);return{c,calls,item,select:s=>selection=s};}
test('production hook preserves selected placed bit0 and clears on deselection',()=>{const a=host();a.c.drawTemplateDim({},0,0,1,4,4,1);const v=a.calls[0],m=Dim.raster(v.width,v.height,v.dpr,v.parts,v.selectedAt);assert.equal(v.active,true);assert.equal(alpha(m,1,1),0);assert.equal(alpha(m,2,1),255);a.c.colourTemplate=null;a.c.drawTemplateDim({},0,0,1,4,4,1);assert.equal(a.calls[1].active,false);});
test('production hook uses all library matches and invalidates when parity changes',()=>{const a=host();a.select({count:1,instances:[],field:{},selected:Uint8Array.from({length:16},(_,i)=>i===0?1:0)});a.c.drawTemplateDim({},0,0,1,4,4,1);const v=a.calls[0];assert.equal(v.selectedAt(.5,.5),true);assert.equal(v.selectedAt(1.5,.5),false);a.c.st.parity.rowsOdd=false;a.c.drawTemplateDim({},0,0,1,4,4,1);assert.notEqual(a.calls[1].key,v.key);});
test('dimming runs after field template paint but before selection outlines and never enters snapshot pixels',()=>{const start=html.indexOf('  function drawTemplate(){'),end=html.indexOf('  function autoTplStats()',start),source=html.slice(start,end);assert.ok(source.indexOf('paintTemplate(')<source.indexOf('drawTemplateDim('));assert.ok(source.indexOf('drawTemplateDim(')<source.indexOf('templateMatchSelectionDraw('));const a=html.indexOf('  function wholeFrameThumbnail(){'),b=html.indexOf('  function fitLibraryFrame(',a);assert.ok(!html.slice(a,b).includes('drawTemplateDim'));});

test('multiple field selections all remain undimmed',()=>{const a=host();a.c.templateItems.push({...a.item,id:'B'});a.c.templatePickedIds.add('B');a.c.drawTemplateDim({},0,0,1,4,4,1);assert.equal(a.calls[0].parts.length,2);});
