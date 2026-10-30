const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
function fn(name){const a=html.indexOf('function '+name+'(');assert.ok(a>=0,'missing '+name);const b=html.indexOf('{',a);let d=1,i=b+1;for(;d;i++){if(html[i]==='{')d++;if(html[i]==='}')d--;}return html.slice(a,i);}
function fixture(drag=false){
 const handlers={},captures=new Set(),nodes=new Map(),requests=[],calls=[],part={mask:{height:10}},a={id:'a',view:{visible:true},parts:[part]},b={id:'b',view:{visible:true},parts:[part]};
 const wrap={scrollLeft:0,scrollTop:0,clientWidth:100,clientHeight:100,classList:{add(){},remove(){}},addEventListener:(name,handler)=>handlers[name]=handler,setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id),focus(){}};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='templateHeight'?100:0,checked:false,setAttribute(){},click(){return this.onclick?.();}});return nodes.get(id);};
 const c=vm.createContext({wrap,window:{mayTemplateLibrary:{clear(){}}},$:node,templateItems:[a,b],colourTemplate:a,templatePickedIds:new Set(['a']),templateDragging:null,templatePickTap:null,templateContextSkip:false,templatePickEnabled:false,templateDragEnabled:drag,templateMove:true,templateHover:null,templateVisible:true,templateOffsetX:0,templateTransfer:false,templateStatsKey:'',templateLastDown:0,img:{width:100,height:100},cv:{getBoundingClientRect:()=>({left:0,top:0,width:100,height:100})},f:null,st:{userLines:[]},lineDrag:null,axisDrag:null,axisBox:null,rulerMode:false,axisSelected:0,axisLineMode:false,axisLinePending:null,axisPicking:false,fillMode:false,autoVertical:0,RK:1,scale:()=>1,nearLine:()=>false,hitTemplate:()=>({item:a,part}),templateItemAllowed:()=>true,templateSelectionSkipped:()=>false,templateRect:()=>({x:0,y:0,width:10,height:10}),templateEdge:()=> 'left',editSnapshot:()=>({}),finishEdit(){},libraryIfOutside(){},actSet(){},clearFillPreview(){},mirrorTemplate:()=>calls.push('mirror'),takeColourAt:()=>{calls.push('pick');return true;},rememberTemplate(){},templateSync(){},queueDigits(){},savePaint(){},liftTemplateSource(){},templateOutside:()=>false,rombP:()=>-1,changeTemplate:(id,v)=>node(id).value=v,pts:new Map(),pan:null,pinch:null});
 vm.runInContext(['selectTemplate','findAllSelectedTemplate','finishTemplateDrag'].map(fn).join('\n'),c);
 node('bTemplateFindAll').onclick=()=>requests.push({active:c.colourTemplate?.id,picked:[...c.templatePickedIds]});
 const ds=html.indexOf("  wrap.addEventListener('pointerdown', e => {",html.indexOf('  const nearLine=')),de=html.indexOf("  addEventListener('keydown', e => {",ds);vm.runInContext(html.slice(ds,de),c);
 const fire=(type,extra={})=>handlers[type]({type,pointerId:1,pointerType:'mouse',button:0,clientX:10,clientY:10,offsetX:10,offsetY:10,target:wrap,preventDefault(){},...extra});
 return{c,a,b,node,calls,requests,fire};
}
test('plain mouse or pen click on selected template invokes the existing Find all button in either gesture mode',()=>{
 for(const drag of [false,true])for(const pointerType of ['mouse','pen']){const f=fixture(drag);f.fire('pointerdown',{pointerType});assert.equal(f.requests.length,0);f.fire('pointerup',{pointerType});assert.equal(f.requests.length,1);assert.equal(f.requests[0].active,'a');assert.equal(f.calls.includes('pick'),false);}
});
test('clicking another selected template searches that item and retains the rest of the multiple selection',()=>{
 for(const drag of [false,true]){const f=fixture(drag);f.c.templatePickedIds.add('b');f.c.colourTemplate=f.b;f.fire('pointerdown');f.fire('pointerup');assert.equal(f.requests.length,1);assert.equal(f.requests[0].active,'a');assert.deepEqual(new Set(f.requests[0].picked),new Set(['a','b']));}
});
test('drag, cancellation and a distant release without pointermove never trigger Find all',()=>{
 for(const drag of [false,true])for(const route of ['move','cancel','distant']){const f=fixture(drag);f.fire('pointerdown');if(route==='move')f.fire('pointermove',{clientX:30,clientY:30});f.fire(route==='cancel'?'pointercancel':'pointerup',route==='cancel'?{}:{clientX:30,clientY:30});assert.equal(f.requests.length,0,`${drag}/${route}`);}
});
test('touch and modified clicks preserve their existing routes without Find all',()=>{
 for(const drag of [false,true])for(const mods of [{pointerType:'touch'},{shiftKey:true},{altKey:true},{ctrlKey:true},{metaKey:true}]){const f=fixture(drag);f.fire('pointerdown',mods);f.fire('pointerup',mods);assert.equal(f.requests.length,0);if(drag&&mods.altKey)assert.equal(f.calls.includes('mirror'),true);}
});
test('left click on an unselected template pans without choosing it',()=>{for(const drag of [false,true]){const f=fixture(drag);f.c.templatePickedIds.clear();f.c.colourTemplate=null;f.fire('pointerdown');f.fire('pointerup');assert.equal(f.requests.length,0);assert.equal(f.calls.includes('pick'),false);}});
test('release rechecks selection and template limits before calling Find all',()=>{
 for(const drag of [false,true])for(const invalidate of [f=>{f.c.templatePickedIds.clear();f.c.colourTemplate=null;},f=>f.c.templateItemAllowed=()=>false]){const f=fixture(drag);f.fire('pointerdown');invalidate(f);f.fire('pointerup');assert.equal(f.requests.length,0);}
});
