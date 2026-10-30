const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Host=require('./mayatnik-snake-scan-host.js'),C=require('./mayatnik-snake-catalog.js');
const repo=process.env.MAYATNIK_REPO||__dirname;
function inlineSource(){const html=fs.readFileSync(path.join(__dirname,'Zerkalius-mayatnik.html'),'utf8').replace(/\r\n/g,'\n'),a=html.indexOf('  // All-frame scans use an isolated CHISTO page;'),tail="    for(const id of ['bSnakeScanAll','bSnakeScanResume','bSnakeScanPause'])if($(id))$(id).disabled=true;\n  }",b=html.indexOf(tail,a);assert.ok(a>=0&&b>a,'actual scan inline source');return html.slice(a,b+tail.length);}
const Joined=require(path.join(repo,'mayatnik-joined-romb.js')),Manual=require(path.join(repo,'mayatnik-manual-snake.js'));
test('whole source graph equals actual manual cone graph for joined parity180, seam, holes and all starts',async()=>{
 for(const width of [4,5])for(const rotate of [false,true])for(const rotateParity of [0,1])for(const K of [1,2,8]){
  const height=4,geometry=Joined.create({width,height,anchor:2,rotate,rotateParity}),source=Array.from({length:width*height},(_,q)=>q%7===0?-1:q%2),cells=[];
  for(let row=0;row<height;row++)for(let col=0;col<width;col++)cells.push({...geometry.point(col+.5,row+.5,(col-2-row)&1),row,col});
  const snapshot={width:geometry.width*K,height:geometry.height*K,scale:K,current:()=>true,
   readBit(x,y){const q=geometry.hit((x+.5)/K,(y+.5)/K);return q?source[q.q]:-1;},isVisible(x,y){return this.readBit(x,y)>=0;},cellAt(x,y){const q=geometry.hit((x+.5)/K,(y+.5)/K);return q&&source[q.q]>=0?{x:q.x+.5,y:q.y+.5}:null;}};
  const graph=await Host.wholeGraph(snapshot,{cells,yieldTask:async()=>{}});assert.equal(graph.length,source.filter(bit=>bit>=0).length);
  const pos=q=>graph[q].x+':'+graph[q].y;
  for(let start=0;start<graph.length;start++){
   const p=graph[start],cone=await Manual.coneGraph(snapshot,{...p,length:8}),reachable=new Set(),queue=[start];while(queue.length){const q=queue.pop();if(reachable.has(q))continue;reachable.add(q);queue.push(...graph[q].edges);}
   assert.deepEqual([...reachable].map(pos).sort(),cone.nodes.map(n=>n.x+':'+n.y).sort());
   for(const node of cone.nodes){const own=graph.find(n=>n.x===node.x&&n.y===node.y);assert.deepEqual(own.edges.map(pos).sort(),node.edges.map(q=>cone.nodes[q].x+':'+cone.nodes[q].y).sort());assert.equal(own.bit,node.bit);assert.equal(source[own.row*width+own.col],own.bit);}
  }
 }
});
test('separate side-by-side diamonds never bridge the gap; unknown fragments keep unknown source coordinates',async()=>{
 const cells=[{x:.5,y:.5,row:0,col:0},{x:1.5,y:1.5,row:1,col:1},{x:5.5,y:.5,row:0,col:1},{x:6.5,y:1.5,row:1,col:0}],byPosition=new Map(cells.map(c=>[c.x+':'+c.y,c])),snapshot={width:8,height:3,scale:1,current:()=>true,readBit:(x,y)=>byPosition.has((x+.5)+':'+(y+.5))?1:-1,cellAt:(x,y)=>byPosition.get((x+.5)+':'+(y+.5))};
 const nodes=await Host.wholeGraph(snapshot,{cells});assert.deepEqual(nodes.map(n=>n.edges),[[1],[],[3],[]]);assert.equal(C.compile({nodes,sequence:['11']}).rows[0].count,'2');
 const fragments=Host.downward([{x:0,y:0,bit:1,edges:[1,2]},{x:1,y:1,bit:0,edges:[0,2]},{x:0,y:2,bit:1,edges:[0,1]}]);assert.deepEqual(fragments.map(n=>n.edges),[[1],[2],[]]);assert.equal(C.page(C.compile({nodes:fragments,sequence:['101']}),{row:0}).items[0].start.row,null);
});
test('whole graph cancellation is observable and never returns partial output',async()=>{
 let cancelled=false;const cells=Array.from({length:5000},(_,q)=>({x:q+.5,y:.5})),snapshot={width:5001,height:1,scale:1,current:()=>true,readBit:()=>1,cellAt:(x,y)=>({x:x+.5,y:y+.5})};await assert.rejects(Host.wholeGraph(snapshot,{cells,cancelled:()=>cancelled,yieldTask:async()=>{cancelled=true;}}),/отменён/);
});
test('actual HTML patch freezes finite range, isolated storage, native wait and standalone save',()=>{
 const html=fs.readFileSync(path.join(__dirname,'Zerkalius-mayatnik.html'),'utf8'),scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(s=>s.trim());for(const script of scripts)new vm.Script(script);
 assert.match(html,/Storage\.prototype\.setItem = Storage\.prototype\.removeItem = function \(\) \{\}/);assert.match(html,/MayatnikPaintCache\.write = async \(\) => \{\}/);
 assert.match(html,/lastFrame=total\(\),finiteTotal=lastFrame\+1/);assert.match(html,/excluded=\[\[\],\[\]\]/);assert.match(html,/if\(ochkiSnakeSavePending\)return true/);assert.match(html,/commitSnakeFrame\(detail/);
 assert.doesNotMatch(inlineSource(),/mayFrameLibrary\.save|\.val\.set|coneContinueExtend/);
});
test('iframe is nonzero offscreen CHISTO CPU, cancelled and removed on failed begin/end',async()=>{
 const frames=[],calls=[],root={location:{href:'https://example.test/mayatnik/Zerkalius-mayatnik.html?n=64'},innerWidth:800,innerHeight:600,setTimeout,
 document:{body:{append:frame=>frames.push(frame)},createElement(){return {style:{},setAttribute(){},remove(){this.removed=true;},contentWindow:{maySnakeScanLocal:{ready:()=>true,load:async job=>calls.push(job.id),acquire:async frame=>({frame})}}};}}};
 const host=Host.create({captureRun:async()=>({total:1})},{root});await host.begin({id:'j'});assert.match(frames[0].src,/chisto=1&gpu=0&snakeSandbox=1/);assert.equal(frames[0].style.width,'800px');assert.equal(frames[0].style.visibility,'hidden');assert.equal(frames[0].style.display,undefined);assert.deepEqual(await host.acquire(0,{}),{frame:0});await host.end();assert.equal(frames[0].removed,true);
 await host.begin({id:'j2'});host.cancel();assert.equal(frames[1].removed,true);await assert.rejects(host.acquire(0,{}),/отменён/);assert.deepEqual(calls,['j','j2']);
});
test('CPU window opens synchronously with token; blocked, closed, wrong origin and late close are explicit failures',async()=>{
 let calls=0;const opened={closed:false,location:{origin:'https://example.test',href:'https://example.test/child'},maySnakeScanLocal:{ready:()=>true,openSaved:async(token,entry,stored,opener)=>{assert.equal(entry.frame,4);assert.equal(opener,root);assert.ok(token.length>10);}}},root={location:{href:'https://example.test/mayatnik/page.html'},crypto:require('node:crypto').webcrypto,open(url){calls++;assert.match(url,/chisto=1&gpu=0&snakeSandbox=1/);return opened;},setTimeout};
 const ticket=Host.prepareOpen(root);assert.equal(calls,1);assert.equal(await Host.deliverOpen(ticket,{frame:4},{snapshot:{}},{root}),true);
 assert.throws(()=>Host.prepareOpen({...root,open:()=>null}),/заблокировал/);opened.closed=true;await assert.rejects(Host.deliverOpen(ticket,{frame:4},{},{root}),/закрыто/);opened.closed=false;opened.location.origin='https://other.test';await assert.rejects(Host.deliverOpen(ticket,{frame:4},{},{root}),/Адрес/);opened.location.origin=ticket.origin;opened.maySnakeScanLocal.openSaved=async()=>{opened.closed=true;};await assert.rejects(Host.deliverOpen(ticket,{frame:4},{},{root}),/закрыто/);
});
function inlineContext(){
 const scope={CHISTO:true,URLSearchParams,location:{search:'?snakeSandbox=1&snakeOpen=secret',origin:'https://example.test'},structuredClone,Uint8Array,Uint32Array,BigInt,console,$:()=>null,window:{},wrap:{addEventListener(){}},addEventListener(){},f:{},manualPaintRevision:0,manualPaintKey:()=> 'frame',manualPatternGeometry:()=> 'geometry'};vm.createContext(scope);vm.runInContext(inlineSource(),scope);return scope;
}
test('actual inline CPU receiver validates opener identity, origin and token before restoring',async()=>{
 const scope=inlineContext(),parent={location:{origin:'https://example.test'}};scope.window.opener=parent;scope.restores=0;vm.runInContext('snakeOpenStored=async()=>{restores++;}',scope);
 await scope.window.maySnakeScanLocal.openSaved('secret',{}, {},parent);assert.equal(scope.restores,1);await assert.rejects(scope.window.maySnakeScanLocal.openSaved('bad',{}, {},parent),/Неверный/);await assert.rejects(scope.window.maySnakeScanLocal.openSaved('secret',{}, {},{location:parent.location}),/Неверный/);parent.location.origin='https://other.test';await assert.rejects(scope.window.maySnakeScanLocal.openSaved('secret',{}, {},parent),/Неверный/);assert.equal(scope.restores,1);
});
test('actual capture includes zero and slider final index: max2 captures a frozen count3',async()=>{
 const scope=inlineContext();Object.assign(scope,{sessionReady:true,visibleGraphKnown(){},ochkiSnakeView:()=>true,stopFrameTransports(){},st:{ochkiInv:false,ochkiHalf:true},sequences:{rows:['11']},total:()=>2,frameWorkOnly:x=>structuredClone(x),paintSnapshot:()=>({field:new Int8Array([1]),st:{}}),frameHostSnapshot:()=>({version:1}),MayatnikWorkFile:{run:async()=>new Blob(['immutable'])},MayatnikVariants:{generate:word=>[{word}]},gpuBig:null});scope.window.mayVisibleSemantic={acquire:async()=>({current:()=>true,release(){}})};
 const input=await scope.window.maySnakeScanLocal.captureRun();assert.equal(input.total,3);assert.deepEqual({...input.range},{first:0,last:2});scope.total=()=>100;assert.equal(input.total,3);
 const Scan=require('./mayatnik-snake-scan.js'),Log=require('./mayatnik-ochki-log.js'),map=new Map(),log=Log.create({storage:async()=>({read:async k=>map.get(k),write:async(v,k)=>map.set(k,structuredClone(v))})}),frames=[];
 const scan=Scan.create({worker:false,captureRun:async()=>input,acquire:async frame=>{frames.push(frame);return {nodes:[{x:0,y:0,bit:frame===2?1:0,edges:[1]},{x:1,y:1,bit:frame===2?1:0,edges:[]}],frameSnapshot:{blob:new Blob([String(frame)])}};}},log);const job=await scan.start();assert.deepEqual(frames,[0,1,2]);assert.equal(job.complete,true);assert.deepEqual(await scan.earliest(job.id,0),{proven:true,frame:2,count:'1'});
});
test('actual inline selected-path overlay keeps exact fragments and rejects stale/reranked routes',async()=>{
 const scope=inlineContext(),catalog={frame:2,nodes:[{x:.5,y:.5,bit:1,fragment:0},{x:1.5,y:1.5,bit:0,fragment:1}]},path={id:'2:0:0',i:0,rank:'0',cells:[0,1],start:{row:null,bit:null},end:{row:null,bit:null}};scope.window.maySnakeCatalog={jobId:'job',catalog};scope.MayatnikSnakeCatalog={query:async()=>({items:[path]})};scope.releases=0;scope.raster=new Int32Array([0,0,-1,1,1,-1]);
 vm.runInContext("snakeCatalogStamp={owner:f,key:snakeCatalogKey()};snakeCatalogGraph=async()=>({nodes:window.maySnakeCatalog.catalog.nodes,rasterOwnerIds:raster,width:3,height:2,rasterScale:8,release(){releases++;}});",scope);
 const overlay=await scope.window.maySnakeFullScan.pathOverlay('job',2,path);assert.deepEqual([...overlay.indices],[0,1,3,4]);assert.equal(overlay.width,3);assert.equal(overlay.height,2);assert.equal(overlay.scale,8);assert.equal(overlay.sourceStart.row,null);assert.equal(scope.releases,1);await assert.rejects(scope.window.maySnakeFullScan.pathOverlay('job',2,{...path,id:'wrong'}),/не принадлежит/);scope.manualPaintRevision++;await assert.rejects(scope.window.maySnakeFullScan.pathOverlay('job',2,path),/Сначала откройте/);
});
