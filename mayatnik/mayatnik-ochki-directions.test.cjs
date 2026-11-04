const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
// Keep the real search, publishing and coordinate functions; exclude UI bootstrap listeners.
function section(start,end){const a=html.indexOf(start),b=html.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,'host section '+start);assert.equal(html.indexOf(start,a+start.length),-1,'unique host section '+start);return html.slice(a,b);}
const source=section('  function displayPoint(c,r,p){','  let RK =')+section('  let ochki = null;','  window.mayCurrentSnakePaths=')+section('  function publishOchki(result,','  function updWin()');
const Joined=require('./mayatnik-joined-romb.js');
function finder({mode='diag',through=false,view='bits',width=12,height=12,points=null,sequence=['1011'],pattern='initial',inv=false,rev=false,left=0,right=width,bottom=height,zone=null}={}){
 const val=new Int8Array(width*height).fill(points?-1:0);if(points)for(const [x,y,v]of points)val[y*width+x]=v;
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,{textContent:'',hidden:false,selectedOptions:[{textContent:pattern}]});return elements.get(id);};
 const state={view,ochki:true,ochkiMode:mode,ochkiThrough:through,ochkiPattern:pattern,ochkiLength:3,ochkiInv:inv,ochkiRev:rev};
 const context={MayatnikOchkiLoop:require('./mayatnik-ochki-loop.js'),MayatnikVariants:require('./mayatnik-variants.js'),f:{W:width,H:height,val},geo:{anchor:0},st:state,playing:false,VX:left,VW:right-left,VH:bottom,ZL:zone?Int32Array.from({length:bottom},()=>zone[0]):[],ZR:zone?Int32Array.from({length:bottom},()=>zone[1]):[],k:1,sequences:{rows:sequence,revision:1,setMatches(x){context.matches=x;}},pairOn:()=>false,rombP:()=>state.view==='romb2'?2:state.view==='romb0'?0:state.view==='romb1'?1:-1,clampInt:(x,min,max,def)=>Math.max(min,Math.min(max,Number(x)||def)),$:get,TextDecoder,performance,setTimeout:()=>0,clearTimeout,ovlSerial:0,window:{},localStorage:{getItem:()=>null,setItem(){}}};
 context.joinedOn=()=>state.view==='rombJoin'||state.view==='rombJoin180';context.joinedGeometry=()=>Joined.create({width:right-left,height:bottom,origin:left,anchor:0,fieldWidth:width,rotate:state.view==='rombJoin180'});context.parityVisible=()=>true;context.outZone=(r,c)=>!!zone&&(c<zone[0]||c>zone[1]);
 // These search-direction cases use the all-visible/no-copy parity baseline.
 // Read the current field rather than a snapshot: several cases edit it in place.
 Object.assign(context,{parityField:()=>context.f,parityValues:()=>context.f.val,parityRow:r=>r,parityActive:()=>false,parityPlan:()=>({settings:{rowFill:'none'}})});
 Object.assign(context,{fieldSourceKey:()=>'',ochkiSearchValues:val=>val,rgbNeighbourFilters:()=>[],rgbNeighbourBWMode:()=>false,joinedWhole:()=>false,gpuBig:null,gpuDisplay:()=>false,RG:0,structuredClone,CustomEvent,window:new EventTarget()});vm.createContext(context);vm.runInContext(source+';globalThis.getLines=ochkiLines;globalThis.getResult=()=>{const result=ochkiGet();publishOchki(result);return result;};',context);
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

test('completed long rows are excluded before the occurrence scanner while their duplicate index remains independent',()=>{
 const text='10110111001011011',points=Array.from(text,(v,i)=>[2,i*2,Number(v)]),api=finder({mode:'col',height:40,points,sequence:[text,text]}),first=api.result();assert.deepEqual(Array.from(first.found,h=>h.i),[0]);
 const original=api.context.ochkiLong,scanned=[];api.context.ochkiLong=(lines,sets)=>{scanned.push(Array.from(sets,vars=>vars.length));return original(lines,sets);};api.context.k++;
 const second=api.result();assert.deepEqual(scanned,[[0,1]]);assert.deepEqual(Array.from(second.found,h=>h.i),[1]);assert.equal(second.foundCount,2);
 api.context.k++;scanned.length=0;assert.equal(api.result().found.length,0);assert.deepEqual(scanned,[[0,0]]);
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
test('source select, sync and segmented adapter expose four directions, their union, and the separate V route',()=>{
 const options=html.match(/<select id="ochkiMode"[^>]*>(.*?)<\/select>/s)[1];assert.deepEqual([...options.matchAll(/value="([^"]+)"/g)].map(x=>x[1]),['diag','antidiag','row','col','all','v']);assert.match(html,/\['diag','antidiag','row','col','all','v'\]\.includes\(st\.ochkiMode\)/);
 const menu=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8');assert.match(menu,/selectSegments\('ochkiMode',\{diag:'↘',antidiag:'↙',row:'→',col:'↓',all:'Все',v:'↘↗'\}\)/);
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
test('changing between flat and both-rombs clears previous findings and searches each newly selected view',()=>{
 const points=fixtures.col.points.concat(fixtures.col.points.map(([x,y,v])=>[x+1,y,v])),api=finder({mode:'col',points});assert.equal(api.result().found.length,1);api.state.view='romb2';assert.equal(api.result().found.length,2);api.state.view='bits';assert.equal(api.result().found.length,1,'returning to a view starts with a cleared findings set');
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
// Independently enumerate candidate substrings and consume one occurrence per
// index within each half. Geometry is checked separately by the line-step tests.
function initialReference(api,allLines){
 const c=api.context,W=allLines.width||c.f.W,groups=api.state.view==='romb2'?[0,1]:[null],out=[];
 for(const half of groups){const lines=half===null?allLines:allLines.filter(L=>L.p===half),used=new Set();
  for(let i=0;i<c.sequences.rows.length;i++){const text=c.sequences.rows[i];let best=null;
   for(let li=0;li<lines.length;li++){const L=lines[li];for(let at=0;at+text.length<=L.n;at++){
    if(used.has(li+'|'+at+'|'+text))continue;let matches=true;for(let j=0;j<text.length;j++)if(L.str[at+j]!==text[j]){matches=false;break;}if(!matches)continue;
    const row=Math.floor(L.cells[at]/W);if(!best||row<best.row)best={li,at,row};
   }}
   if(best){const L=lines[best.li],raw=Array.from(L.cells.slice(best.at,best.at+text.length));used.add(best.li+'|'+best.at+'|'+text);out.push({i,p:allLines.joined?null:L.p,dir:L.dir,cells:allLines.joined?raw.map(q=>allLines.mapper.fromDisplay(q).q):raw});}
  }
 }return out;
}
test('all directions choose one earliest occurrence per index in each half, with exact duplicate and long-pattern paths',()=>{
 const width=40,height=40,points=Array.from({length:width*height},(_,q)=>[q%width,Math.floor(q/width),((q*73^(q>>2)*19)>>>2)&1]);
 for(const view of ['bits','romb0','romb1','romb2','rombJoin','rombJoin180']){const api=finder({mode:'all',view,width,height,points,sequence:['1011','1011','0','1','10110111001011011']}),expected=initialReference(api,api.lines()),r=api.result();
  assert.deepEqual(Array.from(r.found,({i,p,dir,cells})=>({i,p,dir,cells:Array.from(cells)})),expected);assert.equal(r.total,5*(view==='romb2'?2:1));assert.equal(r.directions,4);
  const want=new Set(expected.flatMap(h=>h.cells));assert.deepEqual(Array.from(r.hl,(on,q)=>on?q:-1).filter(q=>q>=0),[...want].sort((a,b)=>a-b));
  api.context.k++;const next=api.result();assert.equal(next.found.length,0);assert.equal(next.foundCount,expected.length);
 }
});

test('all directions combine every simple run count and highlight',()=>{
 const points=Array.from({length:144},(_,q)=>[q%12,Math.floor(q/12),(q%7===0)?0:1]);
 for(const pattern of ['ones','zeros','alternating']){const api=finder({points,pattern});let count=0;for(const mode of ['diag','antidiag','row','col']){api.state.ochkiMode=mode;count+=api.result().count;}const all=assertAllUnion(api,()=>api.result());assert.equal(all.count,count);}
});
test('all directions on overlay consume one earliest occurrence per sequence index',()=>{
 const api=finder({mode:'all',sequence:['1011','1','1']}),c=api.context;for(let q=0;q<c.f.val.length;q++)c.f.val[q]=(q*13^(q>>2))&1;c.ovlSource={bits:{W:12,H:12,anchor:0,val:c.f.val,frame:1}};c.ovlFrozen=null;c.gpuBig=null;c.ovlDraw=()=>{};api.state.ochkiOverlay=true;
 const expected=initialReference(api,c.ochkiGridLines(c.ovlSource.bits)),r=c.ochkiOverlayGet();assert.deepEqual(Array.from(r.found,({i,dir,cells})=>({i,dir,cells:Array.from(cells)})),expected.map(({i,dir,cells})=>({i,dir,cells})));assert.equal(r.total,3);assert.equal(r.directions,4);
});

test('loop joins real bits across rows and last-first seam with exact original addresses',()=>{
 const points=[[1,0,1],[4,0,0],[0,2,1],[5,3,1]],api=finder({mode:'loop',width:6,height:4,points,sequence:['0111','1101']});
 const result=api.result();assert.equal(result.found.length,2);assert.deepEqual(Array.from(result.found[0].cells),[4,12,23,1]);assert.deepEqual(Array.from(result.found[1].cells),[23,1,4,12]);assert.equal(result.halves,1);assert.equal(api.context.matches.mode,'loop');assert.match(api.get('ochkiSum').textContent,/сквозной/);
});
test('loop allows finite words across multiple laps and consumes each original start once',()=>{
 for(const text of ['10101','10'.repeat(9)]){const api=finder({mode:'loop',width:4,height:1,points:[[0,0,1],[3,0,0]],sequence:[text,text]}),r=api.result();assert.equal(r.found.length,1);assert.equal(r.found[0].n,text.length);assert.deepEqual(Array.from(r.found[0].cells),Array.from(text,(_,i)=>i%2?3:0));assert.equal(r.hl.reduce((a,b)=>a+b),2);}
 const r=finder({mode:'loop',points:[[0,0,1],[1,0,1]],sequence:['1','1','1']}).result();assert.equal(r.found.length,2);
});
test('loop preserves initial inverse reverse and half variants at circular seams',()=>{
 const points=[[0,0,1],[3,0,0],[1,1,1],[4,1,1]],ring='1011';
 for(const options of [{inverse:true},{reverse:true},{half:true},{inverse:true,reverse:true,half:true}]){
  const variants=require('./mayatnik-variants.js').generate(ring,options);for(const v of variants){const api=finder({mode:'loop',points,sequence:[v.word],inv:!!options.inverse,rev:!!options.reverse});api.state.ochkiHalf=!!options.half;assert.equal(api.result().found.length,1,JSON.stringify([options,v.word]));}
 }
});
test('loop is one cycle across both rombs, while unknown values remain barriers',()=>{
 const points=[[0,0,1],[1,0,0],[2,1,1]];const r=finder({mode:'loop',view:'romb2',points,sequence:['101']}).result();assert.equal(r.found.length,1);assert.equal(r.total,1);assert.equal(r.halves,1);assert.equal(r.found[0].p,null);
 assert.equal(finder({mode:'loop',points:[[0,0,1],[1,0,-2],[2,0,0]],sequence:['10']}).result().found.length,0);
 assert.equal(finder({mode:'loop',points:[[0,0,1],[1,0,-2],[2,0,0]],sequence:['01']}).result().found.length,1);
});
test('loop maximal runs merge across the seam once and never repeat an infinite cycle',()=>{
 for(const [ring,pattern,inv,count,longest,text]of [['11011','ones',false,1,4,'1111'],['00100','zeros',false,1,4,'0000'],['1111','ones',false,1,4,'1111'],['0101','alternating',false,1,4,'0101'],['111000','ones',true,2,3,'111']]){
  const points=Array.from(ring,(v,i)=>[i%3,Math.floor(i/3),+v]),api=finder({mode:'loop',width:3,height:2,points,pattern,inv}),r=api.result();assert.equal(r.count,count,ring);assert.equal(r.longest,longest);assert.equal(r.found[0].text,text);assert.ok(r.found.every(h=>new Set(h.cells).size===h.n));
 }
});
test('loop joined display retains row-major traversal and maps highlights back to source cells',()=>{
 const points=[[0,2,1],[2,2,0],[1,5,1],[3,5,1]],{map,api}=displayFixture('loop',points,{sequence:['0111']}),r=api.result();assert.equal(r.found.length,1);const display=[2*map.width+2,5*map.width+1,5*map.width+3,2*map.width];assert.deepEqual(Array.from(r.found[0].displayCells),display);assert.deepEqual(Array.from(r.found[0].cells),display.map(q=>map.fromDisplay(q).q));
});
test('loop overlay reuses cyclic patterns and maximal runs with local highlights',()=>{
 for(const pattern of ['initial','ones']){const api=finder({mode:'loop',sequence:['0111'],pattern}),c=api.context;c.ovlSource={bits:{W:4,H:2,anchor:0,val:Int8Array.from([1,-1,1,0,-1,1,-1,-1]),frame:1}};c.ovlFrozen=null;c.gpuBig=null;c.ovlDraw=()=>{};api.state.ochkiOverlay=true;const r=c.ochkiOverlayGet();assert.equal(r.found.length,1);assert.equal(r.local,true);assert.deepEqual(Array.from(r.found[0].cells),pattern==='initial'?[3,5,0,2]:[5,0,2]);}
});
test('loop Code searches expanded words across repeated laps and keeps code cursor semantics',()=>{
 const api=finder({mode:'loop',points:[[0,0,1],[1,0,0]],sequence:['10','11','101']}),c=api.context;api.state.ochkiCode=true;api.state.ochkiCodeStart=1;const r=api.result();assert.equal(r.codeMode,true);assert.deepEqual(Array.from(r.found,h=>h.i),[1]);assert.equal(r.found[0].text,'1010');assert.deepEqual(Array.from(r.found[0].cells),[0,1,0,1]);assert.equal(r.codeStopped,2);
});

test('loop long matcher never treats an unknown value as a binary hash bit',()=>{
 const points=Array.from({length:16},(_,i)=>[i,0,i===7?-2:1]);const r=finder({mode:'loop',width:16,height:1,points,sequence:['1'.repeat(16)]}).result();assert.equal(r.found.length,0);
});
test('loop respects visible crop and parity filters before forming its only cycle',()=>{
 const api=finder({mode:'loop',left:2,right:9,bottom:7,zone:[3,7]});api.context.parityVisible=(r,c)=>c%2===1;const line=api.lines()[0];assert.equal(line.cycleSize,21);assert.ok(Array.from(line.cells).every(q=>q%12>=3&&q%12<=7&&q%2===1&&Math.floor(q/12)<7));
});
test('loop survives settings presets, share-link encoding and full work files',async()=>{
 const settings=require('./mayatnik-settings-library.js'),share=require('./mayatnik-share-link.js'),work=require('./mayatnik-work-file.js');const state={rows:8,steps:16,mode:'pend',bg:'empty',ochkiMode:'loop',ochkiInv:true,ochkiHalf:true};const target={};settings.applyState(target,JSON.parse(JSON.stringify(settings.pick(state))));assert.equal(target.ochkiMode,'loop');
 const payload={v:1,k:0,state,tools:{},colours:{fillColour:'#abcdef',fillMirror:false},colourAuto:{}};const decoded=await share.decode(await share.encode(payload));assert.equal(decoded.state.ochkiMode,'loop');const back=(await work.decode(await work.encode({st:state,field:Int8Array.of(0,1)}))).data;assert.equal(back.st.ochkiMode,'loop');
});

test('loop simple runs after the first 100 remain selectable by their original cell',()=>{
 const width=640,points=Array.from({length:width},(_,q)=>[q,0,q%4===3?0:1]),api=finder({mode:'loop',view:'romb2',width,height:1,points,pattern:'ones'}),result=api.result(),c=api.context;assert.equal(result.count,160);assert.equal(result.found.length,100);c.MayatnikOchkiSelection=require('./mayatnik-ochki-selection.js');c.selectTemplate=()=>{};c.queueDigits=()=>{};c.window={mayTemplateLibrary:{clear(){}},MayatnikTemplatePanel:{openTab(){}}};c.sequences.selectMatches=value=>c.selected=value;vm.runInContext('globalThis.choose=ochkiSelectionChoose;globalThis.chosen=()=>ochkiSelected;',c);c.choose({cell:636,p:null,row:0,col:636,key:result.key,owner:c.f});assert.equal(result.found.length,101);assert.deepEqual(Array.from(c.chosen().cells),[636,637,638]);
});

test('All through is a separate toggle; the ordinary direction dropdown retains only its six choices',()=>{
 assert.match(html,/id="bOchkiThrough"[^>]*aria-pressed="false"/);const menu=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8');assert.match(menu,/button\('bOchkiThrough','eye'\)/);const api=finder({mode:'antidiag'}),c=api.context;
 for(const id of ['bOchkiThrough','bOchki'])api.get(id).setAttribute=function(k,v){this[k]=v;};Object.assign(c,{ochkiSnakeSync(){},ochkiCodeSync(){},save(){},openSequences(){},draw(){}});vm.runInContext(section("  $('bOchkiThrough').onclick=", "  $('bOchkiSnake').onclick="),c);const old=api.result().key;api.get('bOchkiThrough').onclick();assert.equal(api.state.ochkiThrough,true);assert.equal(api.state.ochkiMode,'antidiag');const r=api.result();assert.notEqual(r.key,old);assert.equal(r.directions,4);assert.equal(c.matches.mode,'loops');api.get('bOchkiThrough').onclick();assert.equal(api.state.ochkiThrough,false);assert.equal(api.state.ochkiMode,'antidiag');assert.equal(api.result().key,old);
});
test('four through chains have deterministic independent order and cover each eligible cell exactly once',()=>{
 const api=finder({through:true,width:3,height:2}),lines=api.lines(),expected=[[0,1,2,3,4,5],[0,3,1,4,2,5],[3,0,4,1,5,2],[0,1,3,2,4,5]];assert.equal(lines.length,4);assert.deepEqual(Array.from(lines,L=>L.dir),['loop-row','loop-col','loop-diag','loop-antidiag']);assert.deepEqual(Array.from(lines,L=>Array.from(L.baseCells)),expected);
});
test('all through consumes distinct origins per family without joining rings or duplicating repeated laps',()=>{
 for(const word of ['111','1'.repeat(19)]){const api=finder({through:true,width:2,height:2,points:[[0,0,1],[1,0,1],[0,1,1],[1,1,1]],sequence:Array(17).fill(word)}),r=api.result();assert.equal(r.found.length,16);assert.equal(r.halves,1);assert.equal(r.directions,4);for(const dir of ['loop-row','loop-col','loop-diag','loop-antidiag']){const hits=r.found.filter(h=>h.dir===dir);assert.equal(hits.length,4);assert.equal(new Set(hits.map(h=>h.cells[0])).size,4);}assert.equal(r.hl.reduce((a,b)=>a+b),4);}
});
test('all through initial patterns match a modular four-chain oracle including unknown barriers and long variants',()=>{
 const width=5,height=4,points=Array.from({length:width*height},(_,q)=>[q%width,Math.floor(q/width),q%11===0?-2:(q*17^(q>>1))&1]),sequence=['011','101','001','101','01100110011001100'];
 for(const inv of [false,true]){const api=finder({through:true,mode:'v',width,height,points,sequence,inv,rev:true}),lines=api.lines(),used=new Set(),expected=[];for(let i=0;i<sequence.length;i++){let best=null;for(const v of require('./mayatnik-variants.js').generate(sequence[i],{inverse:inv,reverse:true}))for(let li=0;li<lines.length;li++){const L=lines[li];for(let at=0;at<L.cycleSize;at++){if(used.has(li+'|'+at+'|'+v.word))continue;if(!Array.from(v.word,(b,j)=>L.ring[(at+j)%L.cycleSize]===b).every(Boolean))continue;const row=Math.floor(L.baseCells[at]/width);if(!best||row<best.row)best={li,at,row,v};}}
 if(best){const L=lines[best.li];used.add(best.li+'|'+best.at+'|'+best.v.word);expected.push({i,dir:L.dir,cells:Array.from(best.v.word,(_,j)=>L.baseCells[(best.at+j)%L.cycleSize])});}}
 const r=api.result();assert.deepEqual(Array.from(r.found,h=>({i:h.i,dir:h.dir,cells:Array.from(h.cells)})),expected);}
});
test('all through returns four bounded maximal cycles and works on overlay and with Code',()=>{
 const api=finder({through:true,mode:'col',width:2,height:2,points:[[0,0,1],[1,0,1],[0,1,1],[1,1,1]],pattern:'ones'}),r=api.result();assert.equal(r.count,4);assert.equal(r.longest,4);assert.equal(new Set(r.found.map(h=>h.dir)).size,4);const c=api.context;c.ovlSource={bits:{W:2,H:2,anchor:0,val:c.f.val,frame:1}};c.ovlDraw=()=>{};api.state.ochkiOverlay=true;assert.equal(c.ochkiOverlayGet().count,4);
 const code=finder({through:true,mode:'v',points:[[0,0,1],[1,0,0]],sequence:['10','11']});code.state.ochkiCode=true;const cr=code.result();assert.equal(cr.codeMode,true);assert.equal(cr.found[0].text,'1010');assert.equal(cr.directions,4);
});
test('through temporarily overrides Snake without rewriting its setting',()=>{
 const api=finder({through:true,mode:'v',width:2,height:2,sequence:['01']}),c=api.context;api.state.ochkiSnake=true;assert.equal(c.ochkiSnakeWait(),false);assert.equal(c.ochkiFor().directions,4);assert.equal(api.state.ochkiSnake,true);
});
test('through boolean survives presets links and works; old presets reset it and invalid booleans reject',async()=>{
 const S=require('./mayatnik-settings-library.js'),SL=require('./mayatnik-share-link.js'),F=require('./mayatnik-work-file.js');for(const flag of [false,true]){const state={rows:8,steps:16,mode:'pend',bg:'empty',ochkiMode:'antidiag',ochkiThrough:flag},target={};S.applyState(target,S.pick(state));assert.equal(target.ochkiThrough,flag);assert.equal(target.ochkiMode,'antidiag');const payload={v:1,k:0,state,tools:{},colours:{fillColour:'#abcdef',fillMirror:false},colourAuto:{}};assert.equal((await SL.decode(await SL.encode(payload))).state.ochkiThrough,flag);assert.equal((await F.decode(await F.encode({st:state}))).data.st.ochkiThrough,flag);}
 const old=S.pick({});delete old.state.ochkiThrough;const target={ochkiThrough:true};S.applyState(target,old);assert.equal(target.ochkiThrough,false);assert.equal(require('./mayatnik-reset-state.js').defaults().ochkiThrough,false);for(const bad of ['true',1,null,{}]){const value=S.pick({});value.state.ochkiThrough=bad;assert.throws(()=>S.normalized(value),/сквозные/);assert.throws(()=>SL.normalizePayload({v:1,k:0,state:{rows:8,steps:8,mode:'pend',bg:'empty',ochkiThrough:bad}}),/сквозные/);}
});

test('the new through button preserves every old search pin ordinal without moving visible controls',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8'),start=source.indexOf('    const ochki=rail.el.querySelector'),end=source.indexOf("    const legacy=manualLegacyCells.get('mirrors')",start);
 assert.ok(start>=0&&end>start);const first={id:'search'},through={dataset:{},id:'through'},snake={id:'snake'},code={id:'code'},visible=[first,through,snake,code],group={querySelectorAll:()=>visible},legacy=new Map();
 vm.runInNewContext(source.slice(start,end),{rail:{el:{querySelector:()=>group}},tools:{querySelector:()=>null},manualLegacyCells:legacy,railSourceButtons:new Map([['bOchkiThrough',through]])});
 assert.deepEqual(visible,[first,through,snake,code]);assert.deepEqual(Array.from(legacy.get('ochki')),[first,snake,code,through]);assert.equal(through.dataset.n,'bOchkiThrough');
});
