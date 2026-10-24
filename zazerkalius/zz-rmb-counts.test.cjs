const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'zz-ui.js'),'utf8');
const functions=source.slice(source.indexOf('const RMB_FONT ='),source.indexOf('function rmbType(){'));
const plain=value=>JSON.parse(JSON.stringify(value));
const bits=rows=>rows.map(row=>Uint8Array.from([...row].flatMap(c=>[+c,+c])));
function api(extra={}){const c=vm.createContext(extra);vm.runInContext(functions,c);return c;}
test('text layout preserves the existing proportional font and repeated-letter regions',()=>{
 const c=api(),layout=c.rmbTextLayout('II');assert.deepEqual(plain(layout.letters),[{label:'I',start:1,end:4},{label:'I',start:5,end:8}]);
 const n=c.rmbLetterCounts(layout.rows,layout,bits(layout.rows));assert.deepEqual(plain(n.entries.map(e=>[e.triangles,e.rhombi])),[[22,11],[22,11]]);assert.equal(n.total.rhombi,22);assert.deepEqual(plain(n.entries.map(e=>e.ones)),[11,11]);assert.equal(n.total.ones,22);
 const old=fs.readFileSync(path.join(__dirname,'../_js/hub-menu-grid.js'),'utf8');const ref=vm.createContext();vm.runInContext(old.slice(old.indexOf('const RMB_FONT ='),old.indexOf('  const cache = new Map()')),ref);
 for(const text of ['Зерклъ','Aa I1','р у ь','<>&','😀'])assert.deepEqual(plain(c.rmbTextRows(text)),plain(ref.rmbTextRows(text)));
});
test('edits update one letter and deleting it gives zero without changing another',()=>{
 const c=api(),layout=c.rmbTextLayout('II'),rows=layout.rows.map(row=>row.slice(0,1)+'000'+row.slice(4));
 const n=c.rmbLetterCounts(rows,layout,bits(rows));assert.equal(n.entries[0].rhombi,0);assert.equal(n.entries[1].rhombi,11);assert.equal(n.total.rhombi,11);
 rows[0]=rows[0].slice(0,1)+'1'+rows[0].slice(2);assert.equal(c.rmbLetterCounts(rows,layout,bits(rows)).entries[0].rhombi,1);
});
test('painted separators counted outside letters and included once in total',()=>{
 const c=api(),layout=c.rmbTextLayout('II'),rows=layout.rows.slice();rows[0]='100010001';const n=c.rmbLetterCounts(rows,layout,bits(rows));
 assert.equal(n.outside.rhombi,3);assert.equal(n.outside.ones,3);assert.equal(n.total.ones,25);assert.equal(n.total.rhombi,25);assert.equal(n.total.triangles,n.entries.reduce((a,e)=>a+e.triangles,0)+n.outside.triangles);
});
test('triangle mode counts rendered triangles including inverse cells, excludes missing cells, keeps half-rhombi exact',()=>{
 const c=api(),layout=c.rmbTextLayout('I'),vals=[new Uint8Array([0,9,1,1,1,9,0,0,0])];
 const n=c.rmbLetterCounts(layout.rows,layout,vals);assert.equal(n.entries[0].triangles,3);assert.equal(n.entries[0].rhombi,1.5);assert.equal(n.total.triangles,3);assert.equal(n.entries[0].ones,11);
});
test('changed row widths invalidate character regions rather than display misleading counts',()=>{
 const c=api(),layout=c.rmbTextLayout('II');assert.equal(c.rmbLetterCounts(['1'],layout,bits(['1'])),null);assert.equal(c.rmbLetterCounts([],layout,[]),null);
});
class El{constructor(){this.children=[];this.hidden=false;this.textContent='';this.replaces=0;}append(...n){this.children.push(...n);}replaceChildren(){this.children=[];this.replaces++;}}
test('visible table refreshes after edits and mode changes, with no rebuild during pan/redraw',()=>{
 const box=new El(),c=api({Z:{rmbText:'II'},rmbSt:()=>({cell:c.mode}),$:()=>box,document:{createElement:()=>new El()}});c.mode='rmb';c.Z.rows=plain(c.rmbTextRows('II'));c.rmbVals=bits(c.Z.rows);
 c.rmbTextStats();assert.equal(box.hidden,false);assert.equal(box.replaces,1);const head=box.children[1].children[0];assert.equal(head.children[0].children[1].textContent,"1");assert.equal(head.children[1].children[1].textContent,"I");assert.equal(head.children[1].children[1].className,"rmb-count-letter");c.rmbTextStats();assert.equal(box.replaces,1);
 c.Z.rows=c.Z.rows.map(r=>r.replaceAll('1','0'));c.rmbVals=bits(c.Z.rows);c.rmbTextStats();assert.equal(box.replaces,2);assert.equal(box.children[1].children[1].children[0].children[1].textContent,'0');
 c.mode='tri';c.rmbTextStats();assert.match(box.children[0].textContent,/площадь/);c.Z.rmbText='';c.rmbTextStats();assert.equal(box.hidden,true);
});
test('typing snapshots old text before replacing it, undo restores character labels',()=>{
 const c=api({Z:{rmbText:'I',rows:['0']},rowsLocked:()=>false,prompt:()=> 'II',rowSel:{clear(){}},rmbSt:()=>({}),rmbFit(){},renderAll(){},save(){},say(){}});let old;
 c.snapshot=()=>{old=c.Z.rmbText;};vm.runInContext(source.slice(source.indexOf('function rmbType(){'),source.indexOf('function rmbFit(){')),c);c.rmbType();assert.equal(old,'I');assert.equal(c.Z.rmbText,'II');
 c.document={getElementById:()=>null};vm.runInContext(source.slice(source.indexOf('function undoApply(u){'),source.indexOf('/* v0.643,',source.indexOf('function undoApply(u){'))),c);c.undoApply({rows:['0'],cur:0,rmbText:'I'});assert.equal(c.Z.rmbText,'I');
});
test('opening a closed window rebuilds rendered values after field edits',()=>{
 const a=source.indexOf('function renderRmb(){'),b=source.indexOf('  const upK =',a);
 const c=vm.createContext({rmbWire(){},winOpen:()=>true,Z:{rows:['1']},rmbSt:()=>({al:'c',cell:'rmb'}),rmbW:{},window:{},rmbCur:null,rmbFrame:0,rmbClock:0,rmbLastA:null,rmbKey:'crmb0',rmbVals:[new Uint8Array([0,0])],rmbHeat:[],rmbAge:[],rmbLayout:()=>({hs:[0],ok:[true],u0:0,base:0})});
 vm.runInContext(source.slice(a,b)+'return rmbVals;}',c);assert.deepEqual(Array.from(c.renderRmb()[0]),[1,1]);
});
