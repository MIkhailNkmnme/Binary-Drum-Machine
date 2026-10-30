const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8'),Snake=require('./mayatnik-manual-snake.js');
function fn(name){const at=html.indexOf('function '+name+'(');assert.ok(at>=0,name);let end=html.indexOf('{',at),d=1;while(d){end++;if(html[end]==='{')d++;if(html[end]==='}')d--;}return (html.slice(at-6,at)==='async '?'async ':'')+html.slice(at,end+1);}
test('snapshot acquisition stops active transports without redrawing an already closed column player',()=>{
 const c={k:64,target:0,stops:0,closes:0,stop(){c.stops++;},autoStop(){},rowRunEnd(){},stolbTransport:{active:false,close(){c.closes++;this.active=false;}}};
 vm.createContext(c);vm.runInContext(fn('stopFrameTransports'),c);
 c.stopFrameTransports();assert.equal(c.closes,0);assert.equal(c.target,64);
 c.stolbTransport.active=true;c.stopFrameTransports();assert.equal(c.closes,1);
 c.stopFrameTransports();assert.equal(c.closes,1);assert.equal(c.stops,3);
});
function fixture(){
 const els=new Map(),owner={},graph={nodes:[{x:1,y:0,bit:1,edges:[1,2]},{x:0,y:1,bit:0,edges:[]},{x:2,y:1,bit:1,edges:[]}],rasterOwnerIds:Int32Array.from([0,1,2]),hit:x=>Math.floor(x)},snapshot={owner,key:'k',geometry:'g',scale:1,width:3,height:1,bits:Int8Array.from([1,0,1]),visibleMask:Uint8Array.from([1,1,1]),cellAt:x=>graph.nodes[x],current:()=>true,release(){c.releases++;}};
 const c={st:{manualSnake:true},f:owner,sequences:{rows:['10','11'],revision:1,recordFirstFind(hit,context){c.first.push({hit,context});}},k:16,rombP:()=>-1,joinedOn:()=>false,ochkiScope:()=> 'scope',ochkiSearchSerial:0,ochkiLogSerial:0,ochkiLogEvent:entry=>c.logs.push(entry),logs:[],first:[],manualPaintRevision:0,manualSnakeBusy:false,manualSnakeSerial:0,manualSnakeSession:Snake.createSession(),manualSnakeLayer:null,MayatnikManualSnake:Snake,MayatnikManualPaintPattern:{abort:()=>Error('changed')},window:{mayVisibleSemantic:{acquire:async()=>snapshot}},visibleGraphKnown(){},manualPatternEffects:()=>true,visibleGraph:async()=>graph,manualPaintKey:()=> 'k',manualPatternGeometry:()=> 'g',draw(){c.draws++;},draws:0,releases:0,$:id=>{if(!els.has(id))els.set(id,{});return els.get(id);},setTimeout,Uint8Array,Set,rgba:()=>123};
 vm.createContext(c);vm.runInContext(fn('ochkiRecordManualSnake')+fn('manualSnakeClick')+fn('manualSnakeApply'),c);return {c,graph,snapshot,els};
}
test('host clicks visible start inclusively, advances sequence, preserves final result without wrapping, and resets on another bit',async()=>{
 const {c}=fixture();let r=await c.manualSnakeClick(0,0);assert.deepEqual(Array.from(r.cells),[0,1]);assert.equal(c.manualSnakeSession.current().index,0);assert.deepEqual(Array.from(c.manualSnakeLayer.mask),[1,1,0]);
 r=await c.manualSnakeClick(0,0);assert.deepEqual(Array.from(r.cells),[0,2]);assert.equal(c.manualSnakeSession.current().index,1);assert.deepEqual(Array.from(c.manualSnakeLayer.mask),[1,0,1]);
 await c.manualSnakeClick(0,0);assert.equal(c.manualSnakeSession.current().done,true);assert.equal(c.draws,2);assert.deepEqual(Array.from(c.manualSnakeLayer.mask),[1,0,1]);
 r=await c.manualSnakeClick(1,0);assert.equal(c.manualSnakeSession.current().index,0);assert.equal(r.found,false);assert.deepEqual(Array.from(c.manualSnakeLayer.mask),[0,0,0]);assert.equal(c.releases,4);
});
test('manual path follows semantic visible bits rather than underlying field or RGB and never writes auto-search ledger or paint',async()=>{
 const {c,graph}=fixture();c.f.val=new Int8Array([0,1,0]);c.fillMask=new Uint32Array([7,8,9]);c.ochkiFoundRows=new Map([['gold',new Set([1])]]);const old=c.fillMask.slice();
 const result=await c.manualSnakeClick(0,0);assert.equal(result.found,true);assert.equal(graph.nodes[0].bit,1);assert.deepEqual(c.fillMask,old);assert.deepEqual([...c.ochkiFoundRows.get('gold')],[1]);
 const px=new Uint32Array([1,2,3]);c.manualSnakeApply(px);assert.deepEqual([...px],[123,123,3]);c.st.manualSnake=false;c.manualSnakeApply(px.fill(5));assert.deepEqual([...px],[5,5,5]);
});
test('changed snapshot or mode cancels host search atomically and always releases snapshot',async()=>{
 for(const change of [c=>c.st.manualSnake=false,c=>c.manualSnakeSerial++,c=>c.f={}]){
 const {c,snapshot}=fixture();snapshot.current=()=>c.f===snapshot.owner;c.visibleGraph=async()=>{change(c);return {nodes:[],rasterOwnerIds:new Int32Array(0),hit:()=>0};};const r=await c.manualSnakeClick(0,0);assert.ok(r.error);assert.equal(c.manualSnakeLayer,null);assert.equal(c.draws,0);assert.equal(c.releases,1);assert.equal(c.manualSnakeBusy,false);
 }
});
test('fragment adapter passes the original semantic snapshot and cancellation to the exact shared graph',async()=>{
 const snapshot={scale:1},cancelled=()=>true,result={nodes:[]};let actual;
 const c={visibleGraphKnown(){},MayatnikVisibleCellGraph:{build:async(s,options)=>{actual={s,options};return result;}}};vm.createContext(c);vm.runInContext(fn('visibleGraph'),c);
 assert.equal(await c.visibleGraph(snapshot,cancelled),result);assert.equal(actual.s,snapshot);assert.equal(actual.options.geometry,'half-grid');assert.equal(actual.options.cancelled,cancelled);assert.equal(snapshot.scale,1);
});

test('lazy basic click highlights sparse exact pixels without redrawing the full field',async()=>{
 const {c,snapshot}=fixture();snapshot.lazy=true;snapshot.width=3;snapshot.height=3;snapshot.scale=1;snapshot.readBit=(x,y)=>x>=0&&x<3&&y>=0&&y<3?1:-1;snapshot.isVisible=(x,y)=>snapshot.readBit(x,y)>=0;snapshot.cellAt=(x,y)=>snapshot.isVisible(x,y)?{x:x+.5,y:y+.5}:null;
 c.manualPatternEffects=()=>false;c.sequences.rows=['1','11'];let overlays=0;c.manualSnakeOverlayDraw=()=>overlays++;const r=await c.manualSnakeClick(1.5,.5);assert.equal(r.found,true);assert.equal(c.draws,0);assert.equal(overlays,1);assert.equal(c.manualSnakeLayer.overlay,true);assert.deepEqual([...c.manualSnakeLayer.indices],[1]);
 const px=new Uint32Array([4,5,6]);c.manualSnakeLayer.size=3;c.manualSnakeApply(px);assert.deepEqual([...px],[4,5,6],'sparse overlay never bakes into source pixels');
});
test('sparse overlay uses exact raster coordinates and a single physical pixel at small zoom',()=>{
 const draws=[],ctx={fillRect(...a){draws.push(a);}},canvas={style:{},setAttribute(){},getContext:()=>ctx},owner={};
 const c={st:{manualSnake:true},manualSnakeLayer:{owner,key:'k',geometry:'g',overlay:true,width:100,rasterScale:1,indices:Uint32Array.of(204,205)},f:owner,manualPaintKey:()=> 'k',manualPatternGeometry:()=> 'g',document:{createElement:()=>canvas,body:{append(){}}},wrap:{clientLeft:0,clientTop:0,clientWidth:100,clientHeight:80,getBoundingClientRect:()=>({left:20,top:10})},cv:{getBoundingClientRect:()=>({left:20,top:10})},DPR:()=>2,scale:()=>.1};
 vm.createContext(c);vm.runInContext(fn('manualSnakeOverlayDraw'),c);c.manualSnakeOverlayDraw();assert.equal(canvas.style.background,'transparent');assert.equal(draws.length,2);assert.deepEqual(draws,[[0,0,1,1],[1,0,1,1]]);c.st.manualSnake=false;c.manualSnakeOverlayDraw();assert.equal(canvas.hidden,true);
});

test('manual success logs actual solver variant and records table metadata without touching automatic ledger',async()=>{
 for(const [word,variant]of [['001',''],['110','инв'],['100','рев'],['011','инв+рев']]){
  const {c}=fixture(),nodes=[...word].map((bit,i)=>({x:i,y:i,bit:Number(bit),edges:i<2?[i+1]:[]}));let step,it=Snake.findGraphSteps({nodes,start:0,text:'001',inverse:true,reverse:true});do{step=it.next();}while(!step.done);
  assert.equal(step.value.variant,variant);c.VW=3;c.RG=1;c.rombP=()=>2;
  c.ochkiRecordManualSnake(1,step.value,{x:4.5,y:2});assert.equal(c.logs.length,1);assert.equal(c.logs[0].finds[0].vn,variant);assert.equal(c.logs[0].finds[0].manual,true);assert.equal(c.logs[0].finds[0].p,1);assert.equal(c.first[0].context.frame,16);assert.equal(c.first[0].hit.i,1);
  c.ochkiRecordManualSnake(1,{found:false},{});assert.equal(c.logs.length,1,'failed clicks do not log findings');
 }
});
