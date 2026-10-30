const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8'),source=html.slice(html.indexOf('  let ochki = null;'),html.indexOf('  function updWin()'));
const route=require('./mayatnik-ochki-v-route.js'),Joined=require('./mayatnik-joined-romb.js'),Selection=require('./mayatnik-ochki-selection.js');
function fn(name){const a=html.indexOf('function '+name+'('),b=html.indexOf('{',a);let i=b+1,d=1;for(;d;i++){if(html[i]==='{')d++;if(html[i]==='}')d--;}return html.slice(a,i);}
function fixture({view='bits',W=15,H=8,VX=1,VW=13,A=7,Y=4,pattern='initial',sequence=['101101001'],points=null}={}){
 const nodes=new Map(),st={view,rows:H,steps:16,mode:'pend',ochki:true,ochkiMode:'v',ochkiPattern:pattern,ochkiLength:3,fixLines:true},val=new Int8Array(W*H).fill(0);
 const c={st,f:{W,H,val},VX,VW,VH:H,geo:{anchor:A},k:4,playing:false,ZL:[],ZR:[],ovlSerial:0,ovlFrozen:null,gpuBig:null,gpuDisplay:()=>false,MayatnikOchkiVRoute:route,MayatnikOchkiSelection:Selection,TextDecoder,performance,structuredClone,Date,
  $:id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false,selectedOptions:[{textContent:pattern}]});return nodes.get(id);},sequences:{rows:sequence,revision:1,setMatches(){},selectMatches(){}},pairOn:()=>false,compareOn:()=>false,total:()=>16,fixApexes:()=>({past:[-1,0,1],fut:[-Y,Y]}),fixBound:()=>st.fixLines!==false,parityVisible:()=>true,outZone:()=>false,outShow:()=>false,clampInt:(x,a,b,d)=>Math.max(a,Math.min(b,+x||d)),setTimeout:()=>0,clearTimeout(){},localStorage:{getItem:()=>null,setItem(){}},window:{dispatchEvent(){}},CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}},queueDigits(){},selectTemplate(){}};
 c.rombP=()=>view==='romb0'?0:view==='romb1'?1:view==='romb2'?2:view.startsWith('rombJoin')?3:-1;c.joinedOn=()=>view.startsWith('rombJoin');c.joinedGeometry=()=>Joined.create({width:VW,height:H,origin:VX,anchor:A,fieldWidth:W,rotate:view==='rombJoin180'});
 vm.createContext(c);vm.runInContext(source+';globalThis.current=()=>ochki;globalThis.key=ochkiKey;globalThis.setOchki=x=>ochki=x;',c);for(const name of ['fixSegments','fixPts'])vm.runInContext(fn(name),c);
 if(points)c.fixSegments=()=>points.map(p=>[p.x-p.y,0,p.x,p.y,p.x+p.y,0,p.y]);
 c.testY=Y;return c;
}
function fillRoute(c,text){const all=c.ochkiLines(),line=all.find(l=>l.meeting.y===c.testY)||all[0],lines=Object.assign([line],{joined:all.joined,mapper:all.mapper});assert.ok(line);for(let j=0;j<lines[0].n;j++){const q=lines.joined?lines.mapper.fromDisplay(lines[0].cells[j]).q:lines[0].cells[j];c.f.val[q]=+text[j%text.length];}c.bmGen=(c.bmGen||0)+1;return Array.from(lines[0].cells,q=>lines.joined?lines.mapper.fromDisplay(q).q:q);}
test('actual meeting geometry uses diagonal intersection, ignores vertical lock, and supplies all defined views',()=>{
 for(const view of ['bits','romb0','romb2','rombJoin','rombJoin180']){const c=fixture({view});const points=c.ochkiMeetingPoints();assert.deepEqual(JSON.parse(JSON.stringify(points)),[{x:6,y:4}]);c.st.fixLockX=99;c.st.fixAxis=2;assert.deepEqual(JSON.parse(JSON.stringify(c.ochkiMeetingPoints())),[{x:6,y:4}]);const cells=fillRoute(c,'101101001'),before=c.f.val.slice(),r=c.ochkiGet(true);assert.equal(r.found.length,1,view);assert.deepEqual(Array.from(r.found[0].cells),cells);assert.deepEqual(c.f.val,before);}
 const other=fixture({view:'romb1',pattern:'ones'});other.f.val.fill(1);const result=other.ochkiGet(true);assert.ok(result.count>0,'translated vertices also visit the other lattice');assert.ok(result.found.every(h=>h.p===1));
});
test('half-cell meeting crosses exact adjacent centres only in flat view, and unpaired fake endpoints are rejected',()=>{
 const points=[{x:5.5,y:3.5}];for(const view of ['bits','romb0','romb1','romb2']){const c=fixture({view,points,sequence:['1'],pattern:'ones'});c.f.val.fill(1);const r=c.ochkiGet(true);assert.equal(r.count,view==='bits'?7:0,view);if(view!=='bits')assert.match(r.reason,/Нет непрерывного/);}
 const c=fixture();c.fixSegments=()=>[[0,0,4,4,8,7,Infinity]];assert.equal(c.ochkiMeetingPoints().length,0);assert.match(c.ochkiGet(true).reason,/нет точки встречи/);
});
test('nonmonotonic short and long matching includes ascending occurrences, inverse, reverse and duplicate consumption',()=>{
 const c=fixture({W:45,VW:43,H:22,A:22,Y:20,sequence:['101','101','101','1'.repeat(16)]});let text='101'+ '0'.repeat(17)+'1'.repeat(16)+'00101';fillRoute(c,text);const r=c.ochkiGet(true);assert.equal(r.found.length,3);assert.deepEqual(Array.from(r.found,h=>h.i),[0,1,3]);assert.ok(r.found[1].cells[0]>r.found[1].cells.at(-1));
 for(const [seq,inv,rev]of [['010010110',true,false],['100101101',false,true]]){const a=fixture({sequence:[seq]});fillRoute(a,'101101001');a.st.ochkiInv=inv;a.st.ochkiRev=rev;assert.equal(a.ochkiGet(true).found.length,1);}
});
test('moving meeting point invalidates cache but a locked vertical axis does not change the route',()=>{
 const c=fixture({pattern:'ones'});c.f.val.fill(1);const first=c.ochkiGet(),key=c.key();c.st.fixLines=false;c.st.fixDx=1;assert.notEqual(c.key(),key);const next=c.ochkiGet();assert.notEqual(next,first);assert.notDeepEqual(Array.from(next.hl),Array.from(first.hl));const stable=c.key();c.st.fixLockX=8;assert.equal(c.key(),stable);
});

test('V initial search consumes a row once per half across frames and permits it after explicit reset',()=>{
 for(const view of ['bits','romb0','romb2','rombJoin','rombJoin180']){
  const c=fixture({view});fillRoute(c,'101101001');const first=c.ochkiGet();assert.equal(first.found.length,1,view);
  c.k++;const next=c.ochkiGet();assert.equal(next.found.length,0,view);assert.equal(next.hl.some(Boolean),false);assert.equal(next.foundCount,1);assert.deepEqual(Array.from(next.foundIndices),[0]);
  c.resetOchkiFindings(false,false);assert.equal(c.ochkiGet().found.length,1,view);
 }
});
test('simple series span the bend and click recovery works beyond the first hundred shown findings',()=>{
 const c=fixture({W:505,VW:505,VX:0,H:5,A:0,pattern:'ones',points:Array.from({length:101},(_,i)=>({x:2+5*i,y:2}))});c.f.val.fill(1);const r=c.ochkiGet();assert.equal(r.count,404);assert.equal(r.found.length,100);assert.equal(r.longest,9);const cell=2*505+502;c.ochkiSelectionChoose({owner:c.f,key:c.key(),cell,p:null,row:2,col:502});assert.ok(c.current().found.length>100);assert.equal(c.current().found.at(-1).dir,'v');assert.ok(c.current().found.slice(100).some(h=>h.cells.length===5));
});
test('overlay uses captured meeting points; legacy snapshots report missing geometry instead of choosing a false centre',()=>{
 const c=fixture({sequence:['101101001']});const grid={W:13,H:8,val:new Int8Array(13*8),anchor:6,meetingPoints:[{x:6,y:4}]};c.ovlSource={bits:grid};const lines=c.ochkiGridLines(grid);for(let i=0;i<lines[0].n;i++)grid.val[lines[0].cells[i]]=+'101101001'[i];const result=c.ochkiOverlayGet();assert.equal(result.found.length,1);assert.equal(result.local,true);c.st.fixDx=50;assert.equal(c.ochkiOverlayGet(),result,'moving live axes does not move captured axes');
 c.ovlSource={bits:{...grid,meetingPoints:undefined}};c.ovlSerial++;const old=c.ochkiOverlayGet();assert.equal(old.found.length,0);assert.match(old.reason,/снимке наложения нет геометрии/);
});
test('new exact overlay capture stores the meeting geometry without modifying source values',()=>{
 const c=fixture();Object.assign(c,{scale:()=>1,present:{clean:null}});vm.runInContext(fn('ovlBitsNow'),c);const before=c.f.val.slice(),snapshot=c.ovlBitsNow();assert.ok(snapshot);assert.deepEqual(JSON.parse(JSON.stringify(snapshot.meetingPoints)),[{x:6,y:4}]);assert.deepEqual(c.f.val,before);
});
test('coarse overlay capture transforms its meeting point exactly with the grouped cell centres',()=>{
 const c=fixture({points:[{x:5.5,y:3.5}],pattern:'ones'});c.f.val.fill(1);Object.assign(c,{scale:()=>.5,wrap:{getBoundingClientRect:()=>({left:0,top:0}),clientLeft:0,clientTop:0},cv:{getBoundingClientRect:()=>({left:0,top:0})}});vm.runInContext(fn('ovlCoarseSource'),c);
 const before=c.f.val.slice(),snapshot=c.ovlCoarseSource(2);assert.deepEqual(JSON.parse(JSON.stringify(snapshot.bits.meetingPoints)),[{x:2.5,y:1.5}]);const lines=c.ochkiGridLines(snapshot.bits);assert.equal(lines.length,4);assert.deepEqual(Array.from(lines.find(l=>l.meeting.y===1.5).cells),[1,8,9,4]);assert.deepEqual(c.f.val,before);
});
test('V status and direction label remain truthful in sequence panel and saved settings',()=>{
 const c=fixture({points:[],pattern:'ones'}),r=c.ochkiGet();assert.match(c.$('ochkiSum').textContent,/нет точки встречи/);assert.equal(r.count,0);
 assert.match(fs.readFileSync(__dirname+'/mayatnik-sequences.js','utf8'),/v:'вдоль осей ↘↗'/);
 assert.match(html,/'ochkiSnake','view','fixLines','fixDx','fixDy'\]\.map/);assert.match(html,/'view','ochkiOverlay','fixLines','fixDx','fixDy'\]\)if\(entry.settings/);
});
