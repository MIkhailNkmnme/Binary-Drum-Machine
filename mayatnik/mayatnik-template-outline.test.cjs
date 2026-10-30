const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
function fn(name){const a=html.indexOf('function '+name+'('),b=html.indexOf('{',a);assert.ok(a>0);let depth=1,i=b+1;for(;depth;i++){if(html[i]==='{')depth++;if(html[i]==='}')depth--;}return html.slice(a,i);}
function harness(){
 const controls=new Map(),a={id:'a',view:{visible:true,alpha:50,bare:false},parts:[{ox:0,mask:{width:1,height:1,data:Uint32Array.of(7)},canvas:{id:'a'}}]},b={id:'b',view:{visible:true,alpha:50},parts:[{ox:0,mask:{width:1,height:1,data:Uint32Array.of(9)},canvas:{id:'b'}}]};
 const c=vm.createContext({templateItems:[a,b],templatePickedIds:new Set(),colourTemplate:null,templateDragging:null,templateTransfer:false,templateAxisUnlocked:false,templateVisible:false,templateOffsetX:0,templatePaintBit:1,templateReturn:null,templateLastDown:0,templateStatsKey:'',playing:false,VW:20,VH:20,RK:1,joinedOn:()=>false,dispW:()=>20,dispH:()=>20,templatePaintCanvas:()=>null,templateFollowActive:()=>false,
  $:id=>{if(!controls.has(id))controls.set(id,{value:'',checked:false,textContent:''});return controls.get(id);},templateSync(){},queueDigits(){},savePaint(){},window:{mayLayers:{get:()=>({visible:true,x:0,y:0})}},templateRect:(part,original,item)=>({x:item===a?1:5,y:1,width:1,height:1}),MayatnikTemplate:require('./mayatnik-template.js')});
 for(const name of ['rememberTemplate','selectTemplate','paintTemplate'])vm.runInContext(fn(name),c);
 function drawing(){
  const strokes=[],images=[];let path=[];const ctx={save(){},restore(){},beginPath(){path=[];},rect(){},clip(){},translate(){},moveTo(x,y){path.push([x,y]);},lineTo(x,y){path.push([x,y]);},drawImage(image){images.push(image.id);},stroke(){strokes.push({x:path[0][0],colour:this.strokeStyle,width:this.lineWidth});},setTransform(){},setLineDash(){},strokeRect(){}};
  return{ctx,strokes,images};
 }
 function render(contentOnly=false,layerMode='outline'){const {ctx,strokes,images}=drawing();
  c.paintTemplate(ctx,0,0,1,contentOnly,null,layerMode);return{strokes,images};
 }
 return{c,a,b,render,drawing};
}
test('single selection replaces its outline; previously selected templates keep content without black borders',()=>{
 const {c,a,b,render}=harness();c.selectTemplate(a,false);assert.deepEqual(render().strokes,[{x:1,colour:'#ffe969',width:2}]);
 c.selectTemplate(b,false);assert.deepEqual(render().strokes,[{x:5,colour:'#ffe969',width:2}]);
 assert.deepEqual(render(true,'content').images,['a','b']);assert.equal(a.view.visible,true);assert.equal(b.view.visible,true);
 assert.deepEqual(Array.from(a.parts[0].mask.data),[7]);assert.deepEqual(Array.from(b.parts[0].mask.data),[9]);
});
test('together selection outlines both templates; deselection removes every outline even with legacy bare flags',()=>{
 const {c,a,b,render}=harness();c.selectTemplate(a,false);c.selectTemplate(b,false,false,true);assert.deepEqual(render().strokes.map(s=>s.x),[1,5]);
 c.selectTemplate(null,false);assert.deepEqual(render().strokes,[]);assert.deepEqual(render(true,'content').images,['a','b']);
 a.view.bare=false;b.view.bare=false;assert.deepEqual(render(false,'').strokes,[]);
 c.selectTemplate(a,false);assert.deepEqual(render().strokes.map(s=>s.x),[1]);a.view.visible=false;c.colourTemplate=null;assert.deepEqual(render().strokes,[]);
});

test('temporary current-frame erasure suppresses content and outline without changing the selected template objects',()=>{
 const {c,a,b,render}=harness();c.selectTemplate(a,false);c.selectTemplate(b,false,false,true);render();const before=JSON.stringify([a,b]);
 c.window.mayTemplateTransient={hidden:item=>item.id==='a'};
 assert.deepEqual(render(true,'content').images,['b']);assert.deepEqual(render().strokes.map(s=>s.x),[5]);assert.equal(JSON.stringify([a,b]),before);
 c.window.mayTemplateTransient.hidden=()=>false;assert.deepEqual(render(true,'content').images,['a','b']);assert.deepEqual(render().strokes.map(s=>s.x),[1,5]);
});
test('content capture never includes selection outlines, and old unselected outlines are absent from picture export',()=>{
 const {c,a,b,render}=harness();c.selectTemplate(a,false);c.selectTemplate(b,false);
 assert.deepEqual(render(true,'content'),{strokes:[],images:['a','b']});assert.deepEqual(render(false,'').strokes.map(s=>s.x),[5]);
 c.selectTemplate(null,false);assert.deepEqual(render(false,'').strokes,[]);
});
test('clear-selection status follows current selection instead of legacy outline flags',()=>{
 const {c,a,render}=harness(),start=html.indexOf('    sel:()=>'),end=html.indexOf('    paint:()=>',start);
 vm.runInContext('globalThis.clearSelection={'+html.slice(start,end)+'};',c);
 assert.equal(c.clearSelection.sel(),false);c.selectTemplate(a,false);assert.equal(c.clearSelection.sel(),true);
 c.clearSelection.selOff();assert.equal(c.clearSelection.sel(),false);assert.deepEqual(render().strokes,[]);assert.deepEqual(render(true,'content').images,['a','b']);
});
test('mirror orientation changes only selected outlines, including during exact follow playback',()=>{
 const {c,a,b,render}=harness();a.matchOrientation='direct';b.matchOrientation='mirror';c.selectTemplate(a,false);c.selectTemplate(b,false,false,true);
 const pixels=a.parts[0].mask.data.slice(),other=b.parts[0].mask.data.slice();
 assert.deepEqual(render().strokes.map(s=>s.colour),['#ffe969','#65d9ff']);assert.deepEqual(render(true,'content'),{strokes:[],images:['a','b']});
 c.playing=true;assert.deepEqual(render(),{strokes:[],images:[]});c.templateFollowActive=()=>true;assert.deepEqual(render().strokes.map(s=>s.colour),['#ffe969','#65d9ff']);
 assert.deepEqual(render(true,'content'),{strokes:[],images:['a','b']});assert.deepEqual(a.parts[0].mask.data,pixels);assert.deepEqual(b.parts[0].mask.data,other);
 b.matchOrientation='symmetric';assert.deepEqual(render().strokes.map(s=>s.colour),['#ffe969','#ffe969']);c.templatePickedIds.delete('b');assert.equal(render().strokes.length,1);
});
test('actual overlay and layer adapter both remain visible during follow playback and hide during ordinary playback',()=>{
 const {c,a,b,drawing}=harness(),overlay=drawing(),content=drawing(),frames=[];a.matchOrientation='direct';b.matchOrientation='mirror';c.selectTemplate(a,false);c.selectTemplate(b,false,false,true);
 const bounds={left:0,top:0,width:40,height:40,right:40,bottom:40},layers={get:()=>({visible:true,x:0,y:0}),_add:()=>({raw:null}),_frame:(id,value)=>frames.push({id,enabled:value.enabled}),list:()=>[]};
 Object.assign(c,{playing:true,templateFollowActive:()=>true,window:{mayLayers:layers,mayTemplateLibrary:{getSelection:()=>null}},layerViewport:()=>bounds,DPR:()=>1,devicePixelRatio:1,scale:()=>1,
  layerCanvas:()=>({width:40,height:40,getContext:()=>content.ctx}),wrap:{clientWidth:40,clientHeight:40,getBoundingClientRect:()=>bounds},cv:{getBoundingClientRect:()=>bounds},templateCanvas:{hidden:false,style:{}},templateG:overlay.ctx,
  queueLineMeasures(){},templateStatus(){},ochkiSelectionCurrent:()=>null,drawTemplateDim(){},drawTemplateAxes(){},templateMatchSelectionDraw(){},drawOchkiSelection(){},st:{userLines:[]},mirrorLine:false,axisLineMode:false,rulerA:null,geo:{anchor:0},VX:0,templateHover:null});
 vm.runInContext(fn('layerTemplates')+'\n'+fn('drawTemplate'),c);c.drawTemplate();assert.equal(c.templateCanvas.hidden,false);assert.deepEqual(frames.map(f=>f.enabled),[true,true]);assert.deepEqual(overlay.strokes.map(s=>s.colour),['#ffe969','#65d9ff']);assert.deepEqual(content.images,['a','b']);
 frames.length=0;overlay.strokes.length=0;content.images.length=0;c.templateFollowActive=()=>false;c.drawTemplate();assert.equal(c.templateCanvas.hidden,true);assert.deepEqual(frames.map(f=>f.enabled),[false,false]);assert.deepEqual(overlay.strokes,[]);assert.deepEqual(content.images,[]);
});
