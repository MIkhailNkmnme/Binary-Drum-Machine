const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
const source=html.slice(html.indexOf('  let ochki = null;'),html.indexOf('  function updWin()'));
const Joined=require('./mayatnik-joined-romb.js');
function finder({mode='diag',view='bits',width=12,height=12,points=null,sequence=['1011'],pattern='initial',inv=false,rev=false,left=0,right=width,bottom=height,zone=null}={}){
 const val=new Int8Array(width*height).fill(points?-1:0);if(points)for(const [x,y,v]of points)val[y*width+x]=v;
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,{textContent:'',hidden:false,selectedOptions:[{textContent:pattern}]});return elements.get(id);};
 const state={view,ochki:true,ochkiMode:mode,ochkiPattern:pattern,ochkiLength:3,ochkiInv:inv,ochkiRev:rev};
 const context={f:{W:width,H:height,val},geo:{anchor:0},st:state,playing:false,VX:left,VW:right-left,VH:bottom,ZL:zone?Int32Array.from({length:bottom},()=>zone[0]):[],ZR:zone?Int32Array.from({length:bottom},()=>zone[1]):[],k:1,sequences:{rows:sequence,revision:1,setMatches(x){context.matches=x;}},pairOn:()=>false,rombP:()=>state.view==='romb2'?2:state.view==='romb0'?0:state.view==='romb1'?1:-1,clampInt:(x,min,max,def)=>Math.max(min,Math.min(max,Number(x)||def)),$:get,TextDecoder,performance,setTimeout:()=>0,clearTimeout,ovlSerial:0,window:{},localStorage:{getItem:()=>null,setItem(){}}};
 context.joinedOn=()=>state.view==='rombJoin'||state.view==='rombJoin180';context.joinedGeometry=()=>Joined.create({width:right-left,height:bottom,origin:left,anchor:0,fieldWidth:width,rotate:state.view==='rombJoin180'});context.parityVisible=()=>true;context.outZone=(r,c)=>!!zone&&(c<zone[0]||c>zone[1]);
 vm.createContext(context);vm.runInContext(source+';globalThis.getLines=ochkiLines;globalThis.getResult=()=>{const result=ochkiGet();publishOchki(result);return result;};',context);
 return {context,state,get,lines:()=>context.getLines(),result:()=>context.getResult()};
}
const fixtures={diag:{dir:1,step:[1,1],points:[[1,1,1],[2,2,0],[3,3,1],[4,4,1]]},antidiag:{dir:-1,step:[-1,1],points:[[6,1,1],[5,2,0],[4,3,1],[3,4,1]]},row:{dir:0,step:[2,0],points:[[1,2,1],[3,2,0],[5,2,1],[7,2,1]]},col:{dir:2,step:[0,2],points:[[2,1,1],[2,3,0],[2,5,1],[2,7,1]]}};
test('each of four directions covers both lattices once and keeps its exact cell step',()=>{
 for(const [mode,{dir,step}]of Object.entries(fixtures)){
  const api=finder({mode}),lines=api.lines(),seen=new Set();assert.ok(lines.some(l=>l.p===0));assert.ok(lines.some(l=>l.p===1));
  for(const line of lines){assert.equal(line.dir,dir);assert.equal(line.str.length,line.n);assert.equal(line.cells.length,line.n);for(let j=0;j<line.n;j++){const cell=line.cells[j];assert.equal(seen.has(cell),false);seen.add(cell);if(j){const prev=line.cells[j-1];assert.deepEqual([cell%12-prev%12,Math.floor(cell/12)-Math.floor(prev/12)],step);}}}
  assert.equal(seen.size,144);
 }
});
test('initial sequence finds and highlights only the chosen direction, including both separate diagonals',()=>{
 for(const [mode,{dir,points}]of Object.entries(fixtures)){
  for(const other of Object.keys(fixtures)){
   const api=finder({mode:other,points}),result=api.result();assert.equal(result.found.length,other===mode?1:0,mode+' viewed '+other);
   if(other!==mode)continue;const hit=result.found[0];assert.equal(hit.dir,dir);assert.deepEqual(Array.from(hit.cells),points.map(([x,y])=>y*12+x));assert.deepEqual(Array.from(result.hl).flatMap((on,i)=>on?[i]:[]).sort((a,b)=>a-b),points.map(([x,y])=>y*12+x).sort((a,b)=>a-b));assert.equal(api.context.matches.mode,mode);assert.match(api.get('ochkiSum').textContent,{diag:/↘/,antidiag:/↙/,row:/рядам →/,col:/столбцам ↓/}[mode]);
  }
 }
});
test('inversion, reversal, duplicate consumption and long-pattern search follow column cells',()=>{
 const points=fixtures.col.points;
 for(const options of [{sequence:['0100'],inv:true},{sequence:['1101'],rev:true},{sequence:['0010'],inv:true,rev:true}])assert.equal(finder({mode:'col',points,...options}).result().found.length,1);
 assert.equal(finder({mode:'col',points,sequence:['1011','1011']}).result().found.length,1);
 const text='10110111001011011',long=Array.from(text,(v,i)=>[2,i*2,Number(v)]),api=finder({mode:'col',height:40,points:long,sequence:[text]});assert.equal(api.result().found.length,1);assert.equal(api.result().found[0].n,text.length);
});
test('simple runs use contiguous column steps, split holes and publish the chosen direction',()=>{
 for(const [mode,{dir,points}]of Object.entries(fixtures)){
  const ones=points.map(([x,y])=>[x,y,1]),api=finder({mode,points:ones,pattern:'ones'}),result=api.result();assert.equal(result.count,1);assert.equal(result.longest,4);assert.equal(result.found[0].dir,dir);assert.equal(Array.from(result.hl).filter(Boolean).length,4);assert.equal(api.context.matches.mode,mode);
  assert.equal(finder({mode,points:ones.filter((_,i)=>i!==2),pattern:'ones'}).result().count,0);
 }
});
test('visible window and noise-zone limits crop column/diagonal input without reading hidden cells',()=>{
 for(const mode of Object.keys(fixtures)){
  const api=finder({mode,left:2,right:9,bottom:7,zone:[3,7]}),lines=api.lines();for(const line of lines)for(const cell of line.cells){assert.ok(cell%12>=3&&cell%12<=7);assert.ok(Math.floor(cell/12)<7);}
  assert.equal(lines.reduce((n,line)=>n+line.n,0),35);
 }
});
test('source select, sync and segmented adapter expose four directions and their all-direction union',()=>{
 const options=html.match(/<select id="ochkiMode"[^>]*>(.*?)<\/select>/s)[1];assert.deepEqual([...options.matchAll(/value="([^"]+)"/g)].map(x=>x[1]),['diag','antidiag','row','col','all']);assert.match(html,/\['diag','antidiag','row','col','all'\]\.includes\(st\.ochkiMode\)/);
 const menu=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8');assert.match(menu,/selectSegments\('ochkiMode',\{diag:'↘',antidiag:'↙',row:'→',col:'↓',all:'Все'\}\)/);
});
test('side-by-side rombs search every sequence row independently in each lattice, without crossing the seam',()=>{
 for(const [mode,{points}]of Object.entries(fixtures)){
  const both=[...points,...points.map(([x,y,v])=>[x+1,y,v])],api=finder({mode,view:'romb2',points:both}),result=api.result();
  assert.equal(result.found.length,2,mode);assert.equal(result.total,2);assert.equal(result.halves,2);assert.deepEqual(Array.from(result.found,h=>h.p),[0,1]);
  for(const hit of result.found){assert.equal(hit.i,0);assert.equal(hit.cells.length,4);assert.ok(hit.cells.every(cell=>((cell%12-Math.floor(cell/12))&1)===hit.p));}
  assert.equal(Array.from(result.hl).filter(Boolean).length,8);assert.equal(api.context.matches.halves,2);assert.equal(api.context.matches.total,2);assert.match(api.get('ochkiSum').textContent,/2 из 2 совпадений в двух полумаятниках/);
  assert.equal(finder({mode,points:both}).result().found.length,1,'ordinary view keeps one global occurrence');
  assert.equal(finder({mode,view:'romb2',points:points.slice(0,2).concat(points.slice(2).map(([x,y,v])=>[x+1,y,v]))}).result().found.length,0,'opposite halves cannot supply a combined pattern');
 }
});
test('both halves have independent long-pattern occurrence cursors and duplicate-row consumption',()=>{
 const text='10110111001011011',points=Array.from(text,(v,i)=>[2,i*2,Number(v)]).concat(Array.from(text,(v,i)=>[3,i*2,Number(v)]));
 const api=finder({mode:'col',view:'romb2',height:40,points,sequence:[text,text]}),result=api.result();assert.equal(result.total,4);assert.equal(result.found.length,2);assert.deepEqual(Array.from(result.found,h=>[h.i,h.p]),[[0,0],[0,1]]);
});
test('changing between flat and both-rombs invalidates the match cache',()=>{
 const points=fixtures.col.points.concat(fixtures.col.points.map(([x,y,v])=>[x+1,y,v])),api=finder({mode:'col',points});assert.equal(api.result().found.length,1);api.state.view='romb2';assert.equal(api.result().found.length,2);api.state.view='bits';assert.equal(api.result().found.length,1);
});
function displayFixture(mode,points,{rotate=false,width=8,height=4,sequence=['1011'],pattern='initial'}={}){
 const map=Joined.create({width,height,anchor:0,rotate}),sourcePoints=points.map(([x,y,v])=>{const cell=map.inverse(x,y);assert.ok(cell,'valid display lattice point '+[x,y]);return [cell.c,cell.r,v];});return {map,api:finder({mode,view:rotate?'rombJoin180':'rombJoin',width,height,points:sourcePoints,sequence,pattern})};
}
test('joined display lines cross the base in both diagonals and columns, with original source highlights',()=>{
 const paths={diag:[[1,3,1],[2,4,0],[3,5,1],[4,6,1]],antidiag:[[6,2,1],[5,3,0],[4,4,1],[3,5,1]],col:[[1,1,1],[1,3,0],[1,5,1],[1,7,1]]};
 for(const rotate of [false,true])for(const [mode,points]of Object.entries(paths)){
  const {map,api}=displayFixture(mode,points,{rotate}),result=api.result();assert.equal(result.found.length,1,mode+' rotate '+rotate);assert.equal(result.total,1);assert.equal(result.halves,1);assert.equal(result.joined,true);const hit=result.found[0],display=points.map(([x,y])=>y*map.width+x);assert.equal(hit.p,null);assert.deepEqual(Array.from(hit.displayCells),display);assert.deepEqual(Array.from(hit.cells),display.map(q=>map.fromDisplay(q).q));assert.equal(hit.r,points[0][1]);assert.ok(hit.displayCells.some(q=>Math.floor(q/map.width)<4)&&hit.displayCells.some(q=>Math.floor(q/map.width)>=4));for(const q of hit.cells)assert.equal(result.hl[q],1);assert.equal(api.context.matches.joined,true);assert.match(api.get('ochkiList').textContent,/строка ромба/);
  const cut=displayFixture(mode,points.filter((_,i)=>i!==1),{rotate}).api.result();assert.equal(cut.found.length,0,'holes cannot bridge a joined line');
 }
});
test('joined horizontal rows search the upper and lower parts with one shared sequence consumption',()=>{
 const points=[[0,2,1],[2,2,0],[4,2,1],[6,2,1],[1,5,1],[3,5,0],[5,5,1],[7,5,1]];
 for(const rotate of [false,true]){const {api}=displayFixture('row',points,{rotate,sequence:['1011','1011']}),result=api.result();assert.equal(result.found.length,2);assert.equal(result.total,2);assert.deepEqual(Array.from(result.found,h=>h.r),[2,5]);assert.ok(result.found.every(hit=>hit.displayCells.every(q=>Math.floor(q/api.lines().width)===hit.r)));}
});
test('long initial patterns and simple runs preserve display ordering across the reversed lower half',()=>{
 const text='10110111001011011',points=Array.from(text,(v,i)=>[i,i+2,Number(v)]);
 for(const rotate of [false,true]){const {api}=displayFixture('diag',points,{rotate,width:20,height:10,sequence:[text]}),result=api.result();assert.equal(result.found.length,1);assert.equal(result.found[0].n,17);assert.equal(result.found[0].r,2);assert.equal(result.total,1);
  const run=displayFixture('diag',[[1,3,1],[2,4,1],[3,5,1],[4,6,1]],{rotate,pattern:'ones'}).api.result();assert.equal(run.count,1);assert.equal(run.longest,4);assert.equal(run.found[0].displayCells.length,4);assert.equal(run.found[0].p,null);
 }
});
test('joined flip and rotation have separate search cache keys',()=>{
 const {api}=displayFixture('diag',[[1,3,1],[2,4,0],[3,5,1],[4,6,1]]),key=api.result().key;api.state.view='rombJoin180';assert.notEqual(api.result().key,key);
});
test('joined simple matches beyond the first 100 recover in display coordinates for click selection',()=>{
 const width=160,height=4,map=Joined.create({width,height,anchor:0}),points=[];for(let y=0;y<map.height;y++)for(let i=0;i<width/2;i++)if(i%4!==3)points.push([2*i+(y&1),y,1]);const {api}=displayFixture('row',points,{width,height,pattern:'ones'}),result=api.result();assert.equal(result.count,160);assert.equal(result.found.length,100);
 const display=map.inverse(155,7),context=api.context;context.MayatnikOchkiSelection=require('./mayatnik-ochki-selection.js');context.selectTemplate=()=>{};context.queueDigits=()=>{};context.window={mayTemplateLibrary:{clear(){}},MayatnikTemplatePanel:{openTab(){}}};context.sequences.selectMatches=value=>context.selected=value;vm.runInContext('globalThis.choose=ochkiSelectionChoose;globalThis.chosen=()=>ochkiSelected;',context);
 context.choose({cell:display.q,p:null,row:display.r,col:display.c,displayRow:7,displayCol:155,key:result.key,owner:context.f});assert.equal(result.found.length,101);assert.equal(context.chosen().cells.length,3);assert.deepEqual(Array.from(result.found[100].displayCells),[7*width+153,7*width+155,7*width+157]);assert.deepEqual(Array.from(context.selected.matchIndices),[100]);
});

function assertAllUnion(api,read){
 const modes=['diag','antidiag','row','col'],expected=[],hl=new Uint8Array(api.context.f.val.length);let total=0;
 for(const mode of modes){api.state.ochkiMode=mode;const r=read();expected.push(...r.found);total+=r.total||0;for(let i=0;i<hl.length;i++)hl[i]|=r.hl[i];}
 api.state.ochkiMode='all';const actual=read(),key=hit=>JSON.stringify([hit.i,hit.p??null,hit.dir,Array.from(hit.cells),hit.vn||'',hit.text||'']);assert.deepEqual(Array.from(actual.found,key).sort(),expected.map(key).sort());assert.deepEqual(Array.from(actual.hl),Array.from(hl));if(!actual.simple)assert.equal(actual.total,total);return actual;
}
test('all directions equal the independent union, with separate duplicate and long-pattern cursors',()=>{
 const width=40,height=40,points=Array.from({length:width*height},(_,q)=>[q%width,Math.floor(q/width),((q*73^(q>>2)*19)>>>2)&1]);
 for(const view of ['bits','romb0','romb1','romb2','rombJoin','rombJoin180']){const api=finder({view,width,height,points,sequence:['1011','1011','0','1','10110111001011011']});const r=assertAllUnion(api,()=>api.result());assert.equal(r.directions,4);assert.equal(r.total,5*4*(view==='romb2'?2:1));}
});
test('all directions combine every simple run count and highlight',()=>{
 const points=Array.from({length:144},(_,q)=>[q%12,Math.floor(q/12),(q%7===0)?0:1]);
 for(const pattern of ['ones','zeros','alternating']){const api=finder({points,pattern});let count=0;for(const mode of ['diag','antidiag','row','col']){api.state.ochkiMode=mode;count+=api.result().count;}const all=assertAllUnion(api,()=>api.result());assert.equal(all.count,count);}
});
test('all directions on overlay equal four independent searches and keep exact total',()=>{
 const api=finder({sequence:['1011','1','1']}),c=api.context;for(let q=0;q<c.f.val.length;q++)c.f.val[q]=(q*13^(q>>2))&1;c.ovlSource={bits:{W:12,H:12,anchor:0,val:c.f.val,frame:1}};c.ovlFrozen=null;c.gpuBig=null;c.ovlDraw=()=>{};api.state.ochkiOverlay=true;const r=assertAllUnion(api,()=>c.ochkiOverlayGet());assert.equal(r.total,12);assert.equal(r.directions,4);
});
