const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../setka/setka-engine.js'),'utf8');
const functions=source.slice(source.indexOf('const RMB_FONT ='),source.indexOf('function rmbType(){'));
const plain=value=>JSON.parse(JSON.stringify(value));
const bits=rows=>rows.map(row=>Uint8Array.from([...row].flatMap(c=>[+c,+c])));
function api(extra={}){const c=vm.createContext({window:{ZerkGridParity:require('../_js/grid-parity.js')},rmbSt:()=>({cell:"rmb"}),...extra});vm.runInContext(functions,c);return c;}
test('per-letter bounding area equals ones plus zeros; repeated letters stay separate',()=>{
 const c=api(),layout=c.rmbTextLayout('II'),n=c.rmbLetterCounts(layout.rows,layout);
 assert.deepEqual(plain(n.entries.map(e=>[e.width,e.height,e.ones,e.zeros,e.rhombi])),[[3,7,11,10,21],[3,7,11,10,21]]);
 assert.deepEqual(plain(n.total),{label:'Итого',ones:22,zeros:20,rhombi:42});
 const old=fs.readFileSync(path.join(__dirname,'../_js/hub-menu-grid.js'),'utf8');const ref=vm.createContext();vm.runInContext(old.slice(old.indexOf('const RMB_FONT ='),old.indexOf('  const cache = new Map()')),ref);
 for(const text of ['Зерклъ','Aa I1','р у ь','<>&','😀'])assert.deepEqual(plain(c.rmbTextRows(text)),plain(ref.rmbTextRows(text)));
});
test('live bounding rectangle shrinks, expands and becomes empty after edits',()=>{
 const c=api(),layout=c.rmbTextLayout('I'),rows=['00000','01010','00000','01010','00000'];
 let e=c.rmbLetterCounts(rows,layout).entries[0];assert.deepEqual([e.width,e.height,e.ones,e.zeros,e.rhombi],[3,3,4,5,9]);
 rows[2]='00100';e=c.rmbLetterCounts(rows,layout).entries[0];assert.deepEqual([e.ones,e.zeros,e.rhombi],[5,4,9]);
 const empty=rows.map(r=>'0'.repeat(r.length));e=c.rmbLetterCounts(empty,layout).entries[0];assert.deepEqual([e.width,e.height,e.ones,e.zeros,e.rhombi],[0,0,0,0,0]);
 empty[0]='00100';e=c.rmbLetterCounts(empty,layout).entries[0];assert.deepEqual([e.width,e.height,e.ones,e.zeros,e.rhombi],[1,1,1,0,1]);
});
test('separators and surrounding blank rows are excluded from letter areas and totals',()=>{
 const c=api(),layout=c.rmbTextLayout('II'),rows=layout.rows.slice();rows[0]='100010001';
 const n=c.rmbLetterCounts(rows,layout);assert.equal(n.total.ones,22);assert.equal(n.total.rhombi,42);assert.equal(n.total.zeros,20);
 const spaces=c.rmbTextLayout('I I'),n2=c.rmbLetterCounts(spaces.rows,spaces);assert.equal(n2.entries[1].rhombi,0);assert.equal(n2.total.rhombi,42);
});
test('different heights in lowercase letters use their own bounds, not the font height',()=>{
 const c=api(),layout=c.rmbTextLayout('ер'),n=c.rmbLetterCounts(layout.rows,layout);
 assert.equal(n.entries[0].height,5);assert.equal(n.entries[1].height,7);
 for(const e of n.entries)assert.equal(e.rhombi,e.ones+e.zeros);
});
test('changed row widths invalidate character regions',()=>{
 const c=api(),layout=c.rmbTextLayout('II');assert.equal(c.rmbLetterCounts(['1'],layout),null);assert.equal(c.rmbLetterCounts([],layout),null);
});
test('hover selection matches every displayed number and never includes another letter or gaps',()=>{
 const c=api(),layout=c.rmbTextLayout('II'),n=c.rmbLetterCounts(layout.rows,layout);
 for(const entry of [...n.entries,n.total])for(const kind of ['ones','zeros','rhombi']){
  const cells=c.rmbHighlightCells(layout.rows,n,{index:entry.index||0,kind});assert.equal(cells.length,entry[kind]);
  assert.equal(new Set(cells.map(([r,k])=>r+','+k)).size,cells.length);
  for(const [r,k] of cells){if(entry.index)assert.ok(k>=entry.left&&k<=entry.right);if(kind!=='rhombi')assert.equal(layout.rows[r][k],kind==='ones'?'1':'0');}
 }
 assert.deepEqual(plain(c.rmbHighlightCells(layout.rows,n,null)),[]);
});
test('highlight geometry follows row alignment, orientation, pan and zoom',()=>{
 const c=api(),g={hs:[3],u0:0,rm:true,tw:10,ox:7,oy:11},h=10*Math.sqrt(3)/2;
 assert.deepEqual(plain(c.rmbHighlightPolygon(0,1,g)),[[37,11],[47,11],[42,11+h],[32,11+h]]);
 assert.deepEqual(plain(c.rmbHighlightPolygon(0,1,{...g,u0:1})),[[32,11],[42,11],[47,11+h],[37,11+h]]);
 assert.equal(c.rmbHighlightPolygon(0,1,{...g,rm:false}).length,3);
 const scaled=c.rmbHighlightPolygon(0,1,{...g,tw:20,ox:14,oy:22});assert.deepEqual(plain(scaled),plain(c.rmbHighlightPolygon(0,1,g)).map(p=>p.map(x=>x*2)));
});
class El{constructor(){this.children=[];this.hidden=false;this.textContent='';this.replaces=0;}append(...n){this.children.push(...n);}replaceChildren(){this.children=[];this.replaces++;}setAttribute(k,v){(this.attrs??={})[k]=v;}focus(){this.focused=true;}}
test('touch on a count pins its highlight through leave and blur, and a second tap clears it',()=>{
 const c=api({document:{},renderRmb(){}}),node=new El();c.rmbCountCell(node,{index:2},'zeros');
 node.onpointerenter({pointerType:'touch'});assert.equal(vm.runInContext('rmbCountHighlight',c),null);
 node.onpointerdown({pointerType:'touch'});node.onfocus();node.onclick({pointerType:'touch'});
 node.onpointerleave({pointerType:'touch'});node.onblur();assert.deepEqual(plain(vm.runInContext('rmbCountHighlight',c)),{index:2,kind:'zeros'});
 node.onpointerdown({pointerType:'touch'});node.onfocus();node.onclick({pointerType:'touch'});assert.equal(vm.runInContext('rmbCountHighlight',c),null);
 node.onpointerdown({pointerType:'mouse'});node.onpointerenter({pointerType:'mouse'});assert.equal(vm.runInContext('rmbCountHighlight',c).index,2);node.onpointerleave({pointerType:'mouse'});assert.equal(vm.runInContext('rmbCountHighlight',c),null);
});
test('table shows 1 / 0 / total, hover and focus select cells, edits refresh without pan rebuilds',()=>{
 const box=new El();let renders=0;const c=api({Z:{rmbText:'II'},$:()=>box,document:{createElement:()=>new El()},renderRmb(){renders++;}});
 c.Z.rows=plain(c.rmbTextRows('II'));Object.assign(c.gridsState(),{rows:c.Z.rows.slice(),text:'II'});c.rmbVals=bits(c.Z.rows);c.rmbTextStats();assert.equal(box.hidden,false);assert.equal(box.replaces,1);
 const table=box.children[1],head=table.children[0],body=table.children[1];assert.equal(head.children[0].children[1].textContent,'1');assert.equal(head.children[1].children[1].textContent,'I');assert.equal(head.children[1].children[1].className,'rmb-count-letter');
 assert.deepEqual(body.children.map(r=>r.children[0].textContent),['1','0','Всего ◇']);
 const zero=body.children[1].children[1];zero.onpointerenter();assert.deepEqual(plain(vm.runInContext('rmbCountHighlight',c)),{index:1,kind:'zeros'});assert.equal(renders,1);
 zero.onpointerleave();assert.equal(vm.runInContext('rmbCountHighlight',c),null);zero.onfocus();zero.onblur();assert.equal(vm.runInContext('rmbCountHighlight',c),null);
 c.rmbTextStats();assert.equal(box.replaces,1);c.gridsState().rows=c.gridsState().rows.map(r=>r.replaceAll('1','0'));c.rmbVals=bits(c.gridsState().rows);c.rmbTextStats();assert.equal(box.replaces,2);assert.equal(box.hidden,true);
 c.gridsState().text='';c.rmbTextStats();assert.equal(box.hidden,true);
});
test('overlay draws selected cells without changing field data',()=>{
 class P{constructor(){this.paths=0;}moveTo(){this.paths++;}lineTo(){}closePath(){}}
 const c=api({Z:{rows:['00000','01010','00000','01010','00000']},Path2D:P});
 c.gridsState().rows=c.Z.rows.slice();
 vm.runInContext('rmbStatsCache={counts:rmbLetterCounts(Z.rows,rmbTextLayout("I"))};rmbCountHighlight={index:1,kind:"zeros"};',c);
 const before=JSON.stringify(c.Z.rows);let fill,stroke;const g={save(){},restore(){},fill(p){fill=p.paths;},stroke(p){stroke=p.paths;}};
 c.rmbDrawCountHighlight(g,{hs:[0,0,0,0,0],u0:0,rm:true,tw:10,ox:0,oy:0,M:5,Wc:100,Hc:100});assert.equal(fill,5);assert.equal(stroke,5);assert.equal(JSON.stringify(c.Z.rows),before);
 c.Z.rmb={parity:{rowsOdd:false}};c.rmbDrawCountHighlight(g,{hs:[0,0,0,0,0],u0:0,rm:true,tw:10,ox:0,oy:0,M:5,Wc:100,Hc:100});assert.equal(fill,2);assert.equal(stroke,2);
 c.Z.rmb.parity={cellsEven:false};c.rmbDrawCountHighlight(g,{hs:[0,0,0,0,0],u0:0,rm:true,tw:10,ox:0,oy:0,M:5,Wc:100,Hc:100});assert.equal(fill,4);assert.equal(stroke,4);assert.equal(JSON.stringify(c.Z.rows),before);
});
test('typing modifies only independent grid data and snapshots the previous text',()=>{
 const c=api({Z:{rmbText:'I',rows:['0']},prompt:()=> 'II',rmbSt:()=>({}),rmbFit(){},renderRmb(){},save(){},say(){}});let old;
 c.gridsState().text='I';c.gridsSnapshot=()=>{old=c.gridsState().text;};vm.runInContext(source.slice(source.indexOf('function rmbType(){'),source.indexOf('function rmbFit(){')),c);c.rmbType();assert.equal(old,'I');assert.equal(c.gridsState().text,'II');assert.deepEqual(plain(c.Z.rows),['0']);assert.equal(c.Z.rmbText,'I');
});

test('opening a closed window rebuilds rendered values after field edits',()=>{
 const a=source.indexOf('function renderRmb(){'),b=source.indexOf('  const upK =',a);
 const c=vm.createContext({rmbWire(){},winOpen:()=>true,Z:{rows:['1']},rmbSt:()=>({al:'c',cell:'rmb'}),rmbW:{},window:{},rmbCur:null,rmbFrame:0,rmbClock:0,rmbLastA:null,rmbKey:'crmb0',rmbVals:[new Uint8Array([0,0])],rmbHeat:[],rmbAge:[],rmbLayout:()=>({hs:[0],ok:[true],u0:0,base:0})});
 c.gridsState=()=>({rows:['1']});vm.runInContext(source.slice(a,b)+'return rmbVals;}',c);assert.deepEqual(Array.from(c.renderRmb()[0]),[1,1]);
});

test('black letter border cancels interior grid edges and encloses its whole area',()=>{
 const c=api(),e={ones:1,left:0,top:0,bottom:1,width:2};
 const edges=plain(c.rmbLetterBorderEdges([e],[0,1],1));assert.equal(edges.length,12);
 assert.ok(!edges.some(([a,b])=>a[1]===1&&b[1]===1));
 assert.deepEqual(plain(c.rmbLetterBorderEdges([{...e,ones:0}],[0,1],1)),[]);
});

test('adding text preserves existing cells, separates rows and counts every text block',()=>{
 const c=api(),old=plain(c.rmbTextRows('I'));old[0]='01000';const saved=old.slice();
 const added=c.rmbAppendText(old,[{text:'I',row:0,col:0}],'WW');
 assert.deepEqual(old,saved);for(let i=0;i<old.length;i++)assert.equal(added.rows[i].slice(0,old[i].length),old[i]);
 assert.ok(added.width>old[0].length);assert.equal(added.blocks[1].row,old.length+1);assert.equal(added.rows[old.length],'0'.repeat(added.width));
 const layout=c.rmbDocumentLayout(added.blocks,added.width,added.rows.length),n=c.rmbLetterCounts(added.rows,layout);
 assert.equal(n.entries.length,3);assert.equal(n.entries[0].ones,12);assert.equal(n.entries[1].ones,n.entries[2].ones);
 const word=c.rmbTextLayout('WW'),expected=c.rmbLetterCounts(word.rows,word);assert.equal(n.entries[1].ones,expected.entries[0].ones);
});
test('grid text undo restores its own rows, labels and axes without touching ordinary rows',()=>{
 let saved;const c=api({Z:{rmbText:'I',rmb:{al:'l',num:true,axes:[{id:1,a:[0,0],b:[1,1]}]}},prompt:()=> 'WW',rmbFit(){},renderRmb(){},save(){},say(){},rmbWStop(){}});
 c.rmbSt=()=>c.Z.rmb;c.Z.rows=plain(c.rmbTextRows('I'));c.Z.cur=0;Object.assign(c.gridsState(),{rows:c.Z.rows.slice(),text:'I'});const ordinary=plain(c.Z.rows),old=plain(c.gridsState().rows);
 c.gridsSnapshot=()=>saved=c.gridsSnap();vm.runInContext(source.slice(source.indexOf('function rmbType(){'),source.indexOf('function rmbFit(){')),c);c.rmbType();assert.ok(c.gridsState().rows.length>old.length);assert.ok(c.Z.rmb.axes[0].a[0]<0);assert.equal(c.gridsState().textBlocks.length,2);
 c.gridsApply(saved);assert.deepEqual(plain(c.gridsState().rows),old);assert.deepEqual(plain(c.Z.rows),ordinary);assert.equal(c.gridsState().text,'I');assert.deepEqual(plain(c.Z.rmb.axes),[{id:1,a:[0,0],b:[1,1]}]);
});

test('letter selection deletes only chosen occurrences, preserves positions and can undo everything',()=>{
 const box=new El(),G=require('./zz-grids.js'),snapshots=[];let c;
 c=api({Z:{rows:['101'],rmb:{cell:'rmb',axes:[]}},$:()=>box,document:{createElement:()=>new El()},window:{ZZGrids:G},rmbEditor:{clear(){}},rmbWStop(){},save(){},say(){},undoPush:v=>snapshots.push(plain(v)),renderRmb(){c.rmbVals=bits(c.gridsState().rows);c.rmbTextStats();}});
 const st=c.gridsState(),font=c.rmbTextLayout('III');Object.assign(st,{rows:plain(font.rows),text:'III',textBlocks:[{text:'III',row:0,col:0}],textWidth:font.rows[0].length,colors:{'1,1':'red'},groups:{'1,1':{symbol:'x'}}});
 // A hand-made cell in the left margin must survive even Delete All Letters.
 st.rows[0]='1'+st.rows[0].slice(1);const before=plain(st);c.renderRmb();
 let header=box.children[1].children[0].children[1];header.children[1].onclick();assert.equal(box.focused,true);header=box.children[1].children[0].children[1];assert.equal(header.children[1].attrs['aria-pressed'],'true');
 header.children[3].onclick();box.onkeydown({key:'Delete',preventDefault(){},stopPropagation(){}});
 assert.equal(snapshots.length,1);assert.deepEqual(plain(c.Z.rows),['101']);assert.equal(st.text,'I');assert.deepEqual(plain(st.textBlocks[0].deleted),[0,2]);assert.deepEqual(plain(st.colors),{});assert.deepEqual(plain(st.groups),{});
 const remaining=c.rmbDocumentLayout(c.rmbTextBlocks(),st.textWidth,st.rows.length).letters;assert.equal(remaining.length,1);assert.equal(remaining[0].start,font.letters[1].start);assert.equal(remaining[0].letterIndex,1);
 assert.equal(box.hidden,false);box.children[2].children[1].onclick();assert.equal(box.hidden,true);assert.equal(st.rows[0][0],'1');assert.equal(st.rows.reduce((n,r)=>n+[...r].filter(x=>x==='1').length,0),1);assert.equal(snapshots.length,2);
 c.gridsApply(snapshots[0].grids);assert.deepEqual(plain(c.gridsState()),before);assert.equal(box.hidden,false);assert.deepEqual(plain(c.Z.rows),['101']);
});
test('letter deletion respects lock, repeated Delete and independently positioned text blocks',()=>{
 const box=new El(),G=require('./zz-grids.js');let c,steps=0;
 c=api({Z:{rows:['111'],rmb:{cell:'rmb',axes:[]}},$:()=>box,document:{createElement:()=>new El()},window:{ZZGrids:G},rmbEditor:{clear(){}},rmbWStop(){},save(){},say(){},undoPush(){steps++;},renderRmb(){c.rmbVals=bits(c.gridsState().rows);c.rmbTextStats();}});
 const f=c.rmbTextRows('I'),added=c.rmbAppendText(plain(f),[{text:'I',row:0,col:0}],'I'),st=c.gridsState();Object.assign(st,{rows:plain(added.rows),text:'I',textBlocks:plain(added.blocks),textWidth:added.width});c.renderRmb();
 box.children[1].children[0].children[1].children[2].onclick();const before=plain(st.rows);st.locked=true;c.rmbLetterDelete();assert.deepEqual(plain(st.rows),before);assert.equal(steps,0);st.locked=false;
 box.onkeydown({key:'Delete',repeat:true,preventDefault(){},stopPropagation(){}});assert.equal(steps,0);
 box.onkeydown({key:'Delete',preventDefault(){},stopPropagation(){}});assert.equal(steps,1);assert.deepEqual(plain(st.rows.slice(0,f.length)),plain(f));assert.ok(st.rows.slice(added.blocks[1].row).every(r=>!r.includes('1')));assert.equal(st.text,'I');
 const fresh=c.rmbAppendText(st.rows,c.rmbTextBlocks(),'W'),layout=c.rmbDocumentLayout(fresh.blocks,fresh.width,fresh.rows.length);assert.deepEqual(plain(layout.letters.map(e=>e.label)),['I','W']);
});
