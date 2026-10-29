const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),Snake=require('./mayatnik-snake.js');
function field(width,height,points,extra={}){const val=new Int8Array(width*height).fill(-1);for(const [x,y,v]of points)val[y*width+x]=v;return {width,height,val,sequence:['1011'],...extra};}
test('snake follows shared edges down-left/down-right and backtracks only the failed path',()=>{
 const input=field(7,5,[[3,0,1],[2,1,0],[1,2,1],[4,1,0],[3,2,1],[4,3,1]]),result=Snake.find(input);assert.equal(result.complete,true);assert.equal(result.found.length,1);assert.deepEqual(result.found[0].cells,[3,9,17,25]);assert.equal(result.hl[15],0,'dead-end bit is not highlighted');
 for(const hit of result.found)for(let i=1;i<hit.cells.length;i++){assert.equal(Math.floor(hit.cells[i]/7)-Math.floor(hit.cells[i-1]/7),1);assert.equal(Math.abs(hit.cells[i]%7-hit.cells[i-1]%7),1);}
 assert.equal(new Set(result.found[0].cells).size,4);
});
test('same starting bit can supply distinct successful paths for duplicate sequence indices',()=>{
 const input=field(5,3,[[2,0,1],[1,1,0],[3,1,0],[0,2,1],[2,2,1],[4,2,1]],{sequence:['101','101','101','101']}),result=Snake.find(input),hits=result.found.filter(x=>x.p===0);assert.equal(hits.length,4);assert.ok(hits.every(x=>x.cells[0]===2));assert.equal(new Set(hits.map(x=>x.cells.join(','))).size,4);assert.deepEqual(hits.map(x=>x.cells),[[2,6,10],[2,6,12],[2,8,12],[2,8,14]]);
});
test('each half gets its own ordered sequence, and opposite parities cannot complete a path',()=>{
 const input=field(6,3,[[2,0,1],[1,1,0],[2,2,1],[3,0,1],[4,1,0],[3,2,1]],{sequence:['101','1']}),result=Snake.find(input);assert.deepEqual(result.found.map(x=>[x.i,x.p]),[[0,0],[0,1],[1,0],[1,1]]);assert.equal(result.total,4);assert.equal(result.halves,2);
 assert.equal(Snake.find(field(5,3,[[2,0,1],[2,1,0],[2,2,1]],{sequence:['101']})).found.length,0,'vertical corner contacts do not count as shared sides');
});

test('already-found indices are never searched again in the same half and preserve original numbering',()=>{
 const input=field(6,3,[[2,0,1],[1,1,0],[2,2,1],[3,0,1],[4,1,0],[3,2,1]],{sequence:['101','1','101']}),skipIndices=[[0],[1]],result=Snake.find({...input,skipIndices});
 assert.deepEqual(result.found.map(h=>[h.i,h.p]),[[0,1],[1,0],[2,0]]);assert.equal(result.total,6);
 assert.deepEqual(skipIndices,[[0],[1]],'caller current-search ledger is not mutated');
 const fresh=Snake.find(input);assert.ok(fresh.found.some(h=>h.i===0&&h.p===0),'a new search can find the same index');
 const done=Snake.find({...input,skipIndices:[[0,1,2],[0,1,2]],maxOperations:0,maxEntries:0});
 assert.equal(done.complete,true);assert.equal(done.operations,0);assert.equal(done.prepassCells,0);assert.deepEqual(done.found,[]);assert.equal(done.hl.some(Boolean),false);
});

test('skip applies before inversion, reverse, shared-prefix scanning and progress reports',()=>{
 const input=field(6,3,[[2,0,1],[1,1,0],[2,2,1],[3,0,1],[4,1,0],[3,2,1]],{sequence:['010','1','101'],inverse:true,reverse:true,skipIndices:[[0,2],[]],chunkOperations:1});
 const steps=Snake.findSteps(input),deltas=[];let step;do{step=steps.next();if(!step.done)deltas.push(...step.value.newFound);}while(!step.done);
 for(const hit of [...deltas,...step.value.found])assert.ok(hit.p!==0||hit.i===1);
 assert.ok(step.value.found.some(h=>h.p===1&&h.i===0));
 const one=Snake.find({...input,parities:[0],skipIndices:[[0,1,2],[]],maxOperations:0});assert.equal(one.complete,true);assert.equal(one.operations,0);
 for(const skipIndices of [[],[[],[-1]],[[3],[]],[[.5],[]]])assert.throws(()=>Snake.find({...input,skipIndices}),/исключения/);
});
test('inversion and reversal remain explicit sequence variants',()=>{
 const input=field(5,3,[[2,0,1],[1,1,0],[2,2,0]],{sequence:['001'],reverse:true});assert.equal(Snake.find(input).found[0].vn,'рев');input.sequence=['011'];input.reverse=false;input.inverse=true;assert.equal(Snake.find(input).found[0].vn,'инв');
});
test('DAG memoization bounds branching, depth uses no recursion, limits report incomplete search',()=>{
 const height=1500,width=3,val=new Int8Array(width*height).fill(1),result=Snake.find({width,height,val,sequence:['1'.repeat(height)],maxMs:10000});assert.equal(result.complete,true);assert.equal(result.found.length,2);assert.ok(result.operations<width*height*(Math.ceil(height/32)+10));assert.equal(result.found[0].n,height);
 for(const budget of [{maxOperations:1},{maxEntries:1}]){const limited=Snake.find({width:10,height:10,val:new Int8Array(100),sequence:['00000'],...budget});assert.equal(limited.complete,false);assert.match(limited.reason,/не все пути/);}
 assert.throws(()=>Snake.find({width:0,height:1,val:[],sequence:[]}));assert.throws(()=>Snake.find({width:1,height:1,val:[1],sequence:['10x']}));
});
test('blob worker construction failure always revokes its temporary URL',()=>{
 const previousWorker=global.Worker,oldCreate=URL.createObjectURL,oldRevoke=URL.revokeObjectURL,revoked=[];try{URL.createObjectURL=()=> 'blob:snake-test';URL.revokeObjectURL=url=>revoked.push(url);global.Worker=class{constructor(){throw Error('blocked');}};assert.throws(()=>Snake.createWorker(),/blocked/);assert.deepEqual(revoked,['blob:snake-test']);}finally{global.Worker=previousWorker;URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;}
});
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8'),integration=html.slice(html.indexOf('  let ochkiSnakeJob='),html.indexOf('  const ochkiTail'));
function host(factory){const buttons=new Map();const get=id=>{if(!buttons.has(id))buttons.set(id,{disabled:false,options:[{value:'initial'},{value:'ones'}],setAttribute(name,value){this[name]=value;}});return buttons.get(id);};const context={st:{ochki:true,ochkiSnake:true,ochkiPattern:'initial'},key:'a',f:{W:10,H:3,val:new Int8Array(30)},geo:{anchor:5},VW:3,VH:3,VX:5,sequences:{rows:['10']},ochki:null,playing:false,ochkiFindingsSuppressed:()=>false,ochkiRecordResult:()=>{},MayatnikSnake:{createWorker:factory},rombP:()=>context.view??2,ochkiJoined:()=>!!context.joined,joinedGeometry:()=>context.joinMap,ochkiJoinedSnapshot:()=>context.joinedSnapshot,ochkiKey:()=>context.key,parityVisible:()=>true,outZone:()=>false,$:get,draw:()=>context.draws++,draws:0,ochkiShow(){},publishOchki(result,note){context.published={result,note};}};context.ochkiScope=()=> 'scope';context.rows=new Map();context.union=new Set();context.ochkiFoundCount=new Map();context.ochkiRowsFor=key=>{if(!context.rows.has(key))context.rows.set(key,new Set());return context.rows.get(key);};context.ochkiUnionFor=()=>context.union;context.ochkiCountFor=key=>context.ochkiFoundCount.get(key)||0;let owner=context.f;context.ochkiFindingsSuppressed=()=>{if(owner!==context.f){owner=context.f;context.rows.clear();context.union.clear();context.ochkiFoundCount.clear();}return false;};vm.createContext(context);vm.runInContext(html.match(/  function ochkiMapHit[^\r\n]+/)[0]+integration+';globalThis.search=ochkiSnakeFor;globalThis.sync=ochkiSnakeSync;globalThis.stop=ochkiSnakeStop;globalThis.note=()=>ochkiSnakeNote;',context);return context;}
test('worker integration transfers a copy, maps hits to original field cells, and cancels stale jobs',()=>{
 const workers=[],api=host(()=>{const worker={terminated:0,terminate(){this.terminated++;},postMessage(data,transfer){this.data=data;this.transfer=transfer;}};workers.push(worker);return worker;});api.search();assert.notEqual(workers[0].transfer[0],api.f.val.buffer);assert.equal(api.f.val.length,30);api.key='b';api.search();assert.equal(workers[0].terminated,1);workers[0].onmessage({data:{result:{found:[]}}});assert.equal(api.ochki,null);
 workers[1].onmessage({data:{result:{found:[{i:0,p:1,r:0,c:1,cells:[1,3],n:2}],hl:new Uint8Array(9),complete:true,total:2,halves:2}}});assert.deepEqual(Array.from(api.ochki.found[0].cells),[6,15]);assert.equal(api.ochki.hl[6],1);assert.equal(api.ochki.hl[15],1);assert.equal(api.ochki.key,'b');
});
test('worker startup errors stay visible without automatic retry loops; paused snake can always be switched off',()=>{
 let attempts=0;const api=host(()=>{attempts++;throw Error('worker blocked');});api.search();api.search();assert.equal(attempts,1);assert.match(api.note(),/worker blocked/);api.key='c';api.search();assert.equal(attempts,2);
 api.view=-1;api.sync();assert.equal(api.$('bOchkiSnake').disabled,false,'saved enabled snake can be disabled outside rombs');assert.equal(api.$('ochkiMode').disabled,true);api.st.ochkiSnake=false;api.sync();assert.equal(api.$('bOchkiSnake').disabled,true);assert.match(api.$('bOchkiSnake').title,/Ромбы/);assert.equal(api.$('ochkiMode').disabled,false);
});
test('same-size replacement field rejects an old worker and cached result even with an identical key',()=>{
 const workers=[],api=host(()=>{const worker={terminated:0,terminate(){this.terminated++;},postMessage(){}};workers.push(worker);return worker;});api.search();api.f={W:10,H:3,val:new Int8Array(30)};workers[0].onmessage({data:{result:{found:[],hl:new Uint8Array(9)}}});assert.equal(api.ochki,null);assert.equal(workers[0].terminated,1);api.search();assert.equal(workers.length,2);
 workers[1].onmessage({data:{result:{found:[],hl:new Uint8Array(9),total:2,halves:2,complete:true}}});assert.equal(api.ochki.owner,api.f);api.f={W:10,H:3,val:new Int8Array(30)};api.search();assert.equal(api.ochki,null);assert.equal(workers.length,3);
 workers[2].onerror({message:'blob startup denied'});assert.match(api.note(),/blob startup denied/);api.search();assert.equal(workers.length,3,'asynchronous worker errors do not restart forever');
});
test('cooperative steps resume the exact search and release working memo between completed patterns',()=>{
 const input=field(7,8,Array.from({length:56},(_,q)=>[q%7,Math.floor(q/7),(q+Math.floor(q/7))%2]),{sequence:['1','10','101','000','11'],chunkOperations:7}),steps=Snake.findSteps(input),reports=[],deltas=[];let step;
 do{step=steps.next();if(!step.done){reports.push(step.value);deltas.push(...step.value.newFound);}}while(!step.done);
 assert.ok(reports.length>5);for(let i=1;i<reports.length;i++)assert.ok(reports[i].operations>reports[i-1].operations);assert.deepEqual({...step.value,elapsedMs:0},{...Snake.find(input),elapsedMs:0});assert.equal(step.value.complete,true);assert.equal(step.value.entries,0);assert.ok(step.value.peakEntries<200);assert.deepEqual(deltas,step.value.found.slice(0,deltas.length));
});
test('progress updates status without drawing; new hit deltas appear immediately and remain selectable',()=>{
 let worker;const api=host(()=>worker={terminate(){},postMessage(){}});api.search();worker.onmessage({data:{progress:{index:0,half:0,found:0,total:2,newFound:[]}}});assert.equal(api.draws,0);assert.match(api.published.note,/Поиск продолжается/);
 worker.onmessage({data:{progress:{index:0,half:0,found:1,total:2,newFound:[{i:0,p:0,r:0,c:1,cells:[1,3],n:2}]}}});assert.equal(api.draws,1);assert.equal(api.ochki.complete,false);assert.deepEqual(Array.from(api.ochki.found[0].cells),[6,15]);assert.equal(api.ochki.hl[15],1);
 worker.onmessage({data:{progress:{index:0,half:1,found:1,total:2,newFound:[]}}});assert.equal(api.draws,1);assert.equal(api.published.result,api.ochki);assert.match(api.ochki.reason,/правый/);
 worker.onerror({message:'interrupted worker'});assert.match(api.ochki.reason,/interrupted worker/);assert.equal(api.ochki.complete,false);
});
test('production Shift-And earliest rows agree with exhaustive paths on 17210 fixtures',()=>{
 function brute({width:W,height:H,val,anchor=0,text}){const rows=[-1,-1];function walk(r,c,i){return r<H&&c>=0&&c<W&&val[r*W+c]===Number(text[i])&&(i+1===text.length||walk(r+1,c-1,i+1)||walk(r+1,c+1,i+1));}for(let r=0;r<H;r++)for(let c=0;c<W;c++){const p=(c-anchor-r)&1;if(rows[p]<0&&walk(r,c,0))rows[p]=r;}return rows;}
 let seed=123456,checked=0;const random=n=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)%n;};
 const check=input=>{assert.deepEqual(Snake.earliest(input).rows,brute(input));checked++;};
 for(let run=0;run<10000;run++){const width=1+random(8),height=1+random(10),val=Int8Array.from({length:width*height},()=>random(5)===0?-1:random(2)),text=Array.from({length:1+random(12)},()=>random(2)).join('');check({width,height,val,text,anchor:random(width)});}
 for(let bits=0;bits<512;bits++){const val=Int8Array.from({length:9},(_,q)=>(bits>>>q)&1);for(let m=1;m<=3;m++)for(let word=0;word<1<<m;word++)check({width:3,height:3,val,text:word.toString(2).padStart(m,'0')});}
 for(const m of [31,32,33,63,64,65,127,128,129,255,256,257,511,512]){
  const ones={width:3,height:m+2,val:new Int8Array(3*(m+2)).fill(1),text:'1'.repeat(m)};check(ones);assert.deepEqual(Snake.earliest({...ones,text:ones.text.slice(0,-1)+'0'}).rows,[-1,-1]);checked++;
  const width=5,height=m+6,text=Array.from({length:m},()=>random(2)).join(''),val=new Int8Array(width*height).fill(-1);for(let i=0;i<m;i++){val[(i+2)*width+(i%2?1:2)]=Number(text[i]);val[(i+4)*width+(i%2?4:3)]=Number(text[i]);}check({width,height,val,text});
 }
 assert.equal(checked,17210);
});
test('prepass only bounds the starting row, preserving duplicate paths and earliest starting column',()=>{
 const input=field(7,5,[[2,1,1],[4,1,1],[1,2,0],[3,2,0],[5,2,0],[2,3,1],[4,3,1]],{sequence:['101','101','101'],chunkOperations:9});const result=Snake.find(input),hits=result.found.filter(hit=>hit.p===1);assert.equal(result.complete,true);assert.equal(hits.length,3);assert.deepEqual(hits.map(hit=>hit.cells),[[9,15,23],[9,17,23],[9,17,25]]);assert.ok(result.prepassWords>0);
});
test('joined single-parity snapshots search across the seam once, preserving display and source paths',()=>{
 const Joined=require('./mayatnik-joined-romb.js');
 for(const rotate of [false,true]){
  const map=Joined.create({width:3,height:3,origin:5,anchor:5,fieldWidth:10,rotate}),val=new Int8Array(30).fill(-1),points=[[0,2,1],[1,3,0],[2,4,1]];
  for(const [x,y,v]of points)val[map.inverse(x,y).q]=v;
  const snapshot=map.snapshot({val}),result=Snake.find({...snapshot,sequence:['101']});assert.equal(result.complete,true);assert.equal(result.total,1);assert.equal(result.halves,1);assert.equal(result.found.length,1);assert.deepEqual(result.found[0].cells,points.map(([x,y])=>y*map.width+x));
  let worker;const api=host(()=>worker={terminate(){},postMessage(data){this.data=data;}});api.f={W:10,H:3,val};api.joined=true;api.view=3;api.joinMap=map;api.joinedSnapshot=snapshot;api.sequences.rows=['101'];api.st.ochkiSnake=false;api.sync();assert.equal(api.$('bOchkiSnake').disabled,false);api.st.ochkiSnake=true;api.search();assert.deepEqual(Array.from(worker.data.parities),[0]);assert.equal(worker.data.halves,1);
  worker.onmessage({data:{result:Snake.find(worker.data)}});assert.equal(api.ochki.joined,true);assert.equal(api.ochki.halves,1);assert.equal(api.ochki.total,1);const hit=api.ochki.found[0];assert.equal(hit.p,null);assert.equal(hit.r,2);assert.deepEqual(Array.from(hit.displayCells),points.map(([x,y])=>y*map.width+x));assert.deepEqual(Array.from(hit.cells),points.map(([x,y])=>map.inverse(x,y).q));assert.ok(hit.cells.every(q=>api.ochki.hl[q]===1));
 }
 assert.throws(()=>Snake.find({width:1,height:1,val:[1],sequence:['1'],parities:[0,0]}));
});
test('single display parity with duplicate rows agrees with exhaustive downward path consumption',()=>{
 let seed=7301;const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 for(let run=0;run<200;run++){
  const width=3+random(4),height=3+random(4),val=Int8Array.from({length:width*height},(_,q)=>((q%width-Math.floor(q/width))&1)||random(5)===0?-1:random(2)),sequence=['1','11','101','101'],expected=[],used=new Set();
  for(let i=0;i<sequence.length;i++){const text=sequence[i];let chosen=null;function walk(q,index,path){if(chosen||q<0||q>=val.length||val[q]!==Number(text[index]))return;const cells=path.concat(q);if(index+1===text.length){const key=text+':'+cells.join(',');if(!used.has(key)){used.add(key);chosen=cells;}return;}const c=q%width;if(Math.floor(q/width)+1<height){if(c>0)walk(q+width-1,index+1,cells);if(c+1<width)walk(q+width+1,index+1,cells);}}
   for(let q=0;q<val.length&&!chosen;q++)walk(q,0,[]);if(chosen)expected.push({i,cells:chosen});
  }
  const result=Snake.find({width,height,val,sequence,parities:[0],halves:1});assert.deepEqual(result.found.map(({i,cells})=>({i,cells})),expected);assert.equal(result.total,sequence.length);assert.equal(result.complete,true);
 }
});

test('half-specific exclusions match an independent exhaustive oracle with duplicate rows',()=>{
 let seed=165;const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 for(let run=0;run<160;run++){
  const width=3+random(4),height=3+random(3),anchor=random(width),val=Int8Array.from({length:width*height},()=>random(5)===0?-1:random(2)),sequence=['1','11','101','101'],skipIndices=[0,1].map(()=>sequence.flatMap((_,i)=>random(3)===0?[i]:[])),expected=[],used=[new Set(),new Set()];
  for(let i=0;i<sequence.length;i++)for(const p of [0,1]){if(skipIndices[p].includes(i))continue;const text=sequence[i];let chosen=null;
   function walk(q,index,path){if(chosen||val[q]!==Number(text[index]))return;const cells=path.concat(q);if(index+1===text.length){const key=text+':'+cells.join(',');if(!used[p].has(key)){used[p].add(key);chosen=cells;}return;}const c=q%width;if(Math.floor(q/width)+1<height){if(c>0)walk(q+width-1,index+1,cells);if(c+1<width)walk(q+width+1,index+1,cells);}}
   for(let q=0;q<val.length&&!chosen;q++)if(((q%width-anchor-Math.floor(q/width))&1)===p)walk(q,0,[]);
   if(chosen)expected.push({i,p,cells:chosen});
  }
  const result=Snake.find({width,height,anchor,val,sequence,skipIndices});assert.deepEqual(result.found.map(({i,p,cells})=>({i,p,cells})),expected,'case '+run);assert.equal(result.complete,true);
 }
});
