const test=require('node:test'),assert=require('node:assert/strict'),Snake=require('./mayatnik-manual-snake.js'),Joined=require('./mayatnik-joined-romb.js');
function oracle({width:W,height:H,val,start,text,allowed=()=>true}){
 let result=null;function walk(q,i,path){const r=Math.floor(q/W),c=q%W;if(result||val[q]!==Number(text[i])||!allowed(q,r,c))return;const cells=path.concat(q);if(i+1===text.length){result=cells;return;}if(r+1<H){if(c>0)walk(q+W-1,i+1,cells);if(c+1<W)walk(q+W+1,i+1,cells);}}walk(start,0,[]);return result;
}
test('selected bit is included, paths never start elsewhere, and dead ends are backtracked exactly',()=>{
 const val=new Int8Array(35).fill(-1);for(const [q,v]of [[3,1],[9,0],[15,1],[11,0],[17,1],[25,1]])val[q]=v;
 const input={width:7,height:5,val,start:3,text:'1011'},before=val.slice(),r=Snake.findFrom(input);assert.deepEqual(r.cells,[3,9,17,25]);assert.equal(r.cells[0],input.start);assert.equal(r.n,4);assert.deepEqual(val,before);
 assert.equal(Snake.findFrom({...input,start:4}).found,false);assert.equal(Snake.findFrom({...input,text:'0'}).found,false);assert.deepEqual(Snake.findFrom({...input,text:'1'}).cells,[3]);
});
test('exact anchored search matches exhaustive DFS across boundaries, masks and both lattices',()=>{
 let seed=168;const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 for(let i=0;i<600;i++){
  const width=2+random(6),height=2+random(6),val=Int8Array.from({length:width*height},()=>random(5)===0?-1:random(2)),start=random(val.length),text=Array.from({length:1+random(7)},()=>random(2)).join(''),allowed=q=>q%7!==4,input={width,height,val,start,text,allowed},before=val.slice(),want=oracle(input),actual=Snake.findFrom(input);
  assert.equal(actual.complete,true);assert.equal(actual.found,!!want);assert.deepEqual(actual.cells,want||[]);assert.deepEqual(val,before);
  for(const q of actual.cells)assert.equal((q%width-Math.floor(q/width))&1,(start%width-Math.floor(start/width))&1);
 }
});
test('variants stay explicit; absent or hidden start and insufficient height never become partial successes',()=>{
 const input={width:3,height:3,val:Int8Array.from([0,0,0,0,1,0,0,0,1]),start:0,text:'011'};
 assert.equal(Snake.findFrom(input).found,true);assert.equal(Snake.findFrom({...input,text:'100',inverse:true}).variant,'инв');assert.equal(Snake.findFrom({...input,text:'110',reverse:true}).variant,'рев');
 assert.equal(Snake.findFrom({...input,allowed:q=>q!==0}).found,false);assert.equal(Snake.findFrom({...input,text:'0111'}).found,false);
 const incomplete=Snake.findFrom({...input,maxOperations:0});assert.equal(incomplete.complete,false);assert.equal(incomplete.found,false);assert.deepEqual(incomplete.cells,[]);
});
test('cooperative steps preserve the exact result and do not use a shared automatic-search ledger',()=>{
 const input={width:15,height:30,val:new Int8Array(450).fill(1),start:7,text:'1'.repeat(24),chunkOperations:3},steps=Snake.findSteps(input),progress=[];let step;do{step=steps.next();if(!step.done)progress.push(step.value);}while(!step.done);
 assert.ok(progress.length>10);assert.deepEqual(step.value,Snake.findFrom(input));assert.deepEqual(Snake.findFrom(input),Snake.findFrom(input));assert.equal(step.value.cells.length,24);
});
test('joined display starts and paths map exactly across the seam in both orientations',()=>{
 for(const rotate of [false,true]){
  const geometry=Joined.create({width:7,height:4,origin:3,anchor:3,fieldWidth:13,rotate}),val=new Int8Array(52).fill(-1),displayCells=[2*7+2,3*7+3,4*7+2,5*7+3];
  displayCells.forEach((q,i)=>{val[geometry.fromDisplay(q).q]=Number('1011'[i]);});const snapshot=geometry.snapshot({val}),source=geometry.fromDisplay(displayCells[0]),start=geometry.fromSource(source.q).displayQ,result=Snake.findFrom({...snapshot,start,text:'1011'});
  assert.deepEqual(result.cells,displayCells);assert.deepEqual(result.cells.map(q=>geometry.fromDisplay(q).q),displayCells.map(q=>geometry.fromDisplay(q).q));assert.ok(result.cells.some(q=>geometry.fromDisplay(q).p===1));
 }
});
test('malformed input fails explicitly and worker startup always releases the blob URL',()=>{
 for(const options of [{width:0,height:1,val:[1],start:0,text:'1'},{width:1,height:1,val:[1],start:1,text:'1'},{width:1,height:1,val:[1],start:0,text:'x'}])assert.throws(()=>Snake.findFrom(options),/данные/);
 const oldWorker=global.Worker,create=URL.createObjectURL,revoke=URL.revokeObjectURL,revoked=[];try{URL.createObjectURL=()=> 'blob:manual';URL.revokeObjectURL=u=>revoked.push(u);global.Worker=class{constructor(){throw Error('blocked');}};assert.throws(()=>Snake.createWorker(),/blocked/);assert.deepEqual(revoked,['blob:manual']);}finally{global.Worker=oldWorker;URL.createObjectURL=create;URL.revokeObjectURL=revoke;}
});

test('manual click session advances only at the same start, resets for another cell/frame and never loops',()=>{
 const session=Snake.createSession(),owner={},request={owner,key:'frame16',start:'left:3,4',length:3};
 let state=session.choose(request);assert.equal(state.index,0);assert.equal(state.pending,true);const oldToken=state.token;
 state=session.choose(request);assert.equal(state.index,1);assert.equal(session.complete(oldToken,{found:true}),false,'stale worker result cannot overwrite a later click');assert.equal(session.complete(state.token,{found:false,complete:true}),true);
 state=session.choose(request);assert.equal(state.index,2);state=session.choose(request);assert.equal(state.done,true);assert.equal(state.pending,false);assert.equal(session.choose(request).done,true,'end of list does not wrap to row one');
 state=session.choose({...request,start:'right:3,4'});assert.equal(state.index,0);assert.equal(state.done,false);
 state=session.choose({...request,key:'frame17'});assert.equal(state.index,0);state=session.choose({...request,owner:{}});assert.equal(state.index,0);
 const token=state.token;session.clear();assert.equal(session.current(),null);assert.equal(session.complete(token,{found:true}),false);assert.equal(session.choose({...request,length:0}).done,true);
});

test('display graph follows supplied visible edges and semantic bits, including a split visible cell',()=>{
 const nodes=[{x:4.5,y:2.5,bit:1,edges:[2,1,4]},{x:3.5,y:3.5,bit:0,edges:[3]},{x:5.5,y:3.5,bit:0,edges:[5]},
  {x:2.5,y:4.5,bit:0,edges:[]},{x:4.5,y:3.5,bit:1,edges:[5]}, {x:6.5,y:4.5,bit:1,edges:[6,7]},
  {x:5.5,y:5.5,bit:0,edges:[]},{x:5.5,y:5.5,bit:1,edges:[]}];
 const saved=structuredClone(nodes),result=Snake.findGraph({nodes,start:0,text:'1011'});assert.deepEqual(result.cells,[0,2,5,7]);assert.deepEqual(nodes,saved);
 assert.deepEqual(Snake.findGraph({nodes,start:6,text:'0'}).cells,[6]);assert.equal(Snake.findGraph({nodes,start:6,text:'1'}).found,false,'clicked fragment bit is never replaced by the centre bit');
 const steps=Snake.findGraphSteps({nodes,start:0,text:'1011',chunkOperations:1}),states=[];let step;do{step=steps.next();if(!step.done)states.push(step.value);}while(!step.done);assert.ok(states.length>5);assert.deepEqual(step.value,result);
});

test('display graph search agrees with rectangular anchored oracle for every start on both lattices',()=>{
 const width=7,height=7,val=Int8Array.from({length:49},(_,q)=>q%11===0?-1:(q*17^(q>>2))&1),nodes=Array.from(val,(bit,q)=>({bit,x:q%width+.5,y:Math.floor(q/width)+.5,edges:Math.floor(q/width)+1<height?[...(q%width?[q+width-1]:[]),...(q%width+1<width?[q+width+1]:[])]:[]}));
 for(let start=0;start<49;start++)for(const text of ['1','10','101','0011'])assert.deepEqual(Snake.findGraph({nodes,start,text}).cells,Snake.findFrom({width,height,val,start,text}).cells);
});

test('a two-bit click on a 4096-row field reads only its bounded cone, never constructs a full-field graph',async()=>{
 const W=12286,H=4096,c=6000,r=10;let reads=0;
 const bits=new Proxy({}, {get(_,key){reads++;return (+key)%W%2;}}),visibleMask=new Proxy({}, {get(){reads++;return 1;}});
 const snapshot={width:W,height:H,scale:1,bits,visibleMask,current:()=>true,cellAt:(x,y)=>({x:x+.5,y:y+.5})};
 const graph=await Snake.coneGraph(snapshot,{x:c+.5,y:r+.5,bit:0,length:2});assert.equal(graph.nodes.length,3);assert.ok(reads<100);assert.deepEqual(graph.nodes[0].edges,[1,2]);
 const result=Snake.findGraph({nodes:graph.nodes,start:0,text:'01'});assert.equal(result.found,true);assert.deepEqual(Array.from(graph.pixelsFor(result.cells)),[r*W+c,(r+1)*W+c-1]);assert.ok(reads<200);
});

test('lazy semantic reads and typed snapshots produce the same cone, exact path, and sparse highlights',async()=>{
 const W=23,H=12,bits=Int8Array.from({length:W*H},(_,q)=>(q+Math.floor(q/W))%3?1:0),visibleMask=Uint8Array.from(bits,(_,q)=>q%17?1:0),base={width:W,height:H,scale:1,bits,visibleMask,current:()=>true,cellAt:(x,y)=>({x:x+.5,y:y+.5})};
 for(const length of [1,2,5,10]){const args={x:11.5,y:1.5,bit:bits[W+11],length},a=await Snake.coneGraph(base,args);let reads=0;
 const lazy={...base,bits:undefined,visibleMask:undefined,readBit(x,y){reads++;return bits[y*W+x];},isVisible:(x,y)=>!!visibleMask[y*W+x]},b=await Snake.coneGraph(lazy,args);
 assert.deepEqual(b.nodes,a.nodes);const options={start:0,text:'1'.repeat(length),inverse:true};const left=Snake.findGraph({nodes:a.nodes,...options}),right=Snake.findGraph({nodes:b.nodes,...options});assert.deepEqual(right,left);assert.deepEqual(b.pixelsFor(right.cells),a.pixelsFor(left.cells));assert.ok(reads<=2*length*length+1);}
});
test('lazy cone never falls back to a bulk raster and rejects stale snapshots before publishing',async()=>{
 const snapshot={width:12286,height:4096,scale:1,current:()=>true,cellAt:(x,y)=>({x:x+.5,y:y+.5}),readBit:()=>1,isVisible:()=>true};Object.defineProperties(snapshot,{bits:{get(){throw Error('bulk bits accessed');}},visibleMask:{get(){throw Error('bulk mask accessed');}}});
 const graph=await Snake.coneGraph(snapshot,{x:5000.5,y:10.5,bit:1,length:2});assert.equal(graph.nodes.length,3);snapshot.current=()=>false;await assert.rejects(Snake.coneGraph(snapshot,{x:5000.5,y:10.5,bit:1,length:2}),/изменилось/);
});
