const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Geometry=require('./mayatnik-auto-axis-geometry.js'),Axes=require('./mayatnik-axis-colour.js'),Style=require('./mayatnik-axis-style.js');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
function section(a,b){const start=html.indexOf(a),end=html.indexOf(b,start);assert.ok(start>=0&&end>start);return html.slice(start,end);}
function fixture(state={}){
 const c={st:{rows:10,fixLines:true,fixCross:true,saw:false,axisPalette:'purple-black',...state},VW:17,VH:10,VX:0,f:{W:17,H:10,val:new Int8Array(170).fill(1)},geo:{anchor:8},g:null,
  fixSegments:()=>[[4,0,8,4,13,9,4],[12,0,8,4,3,9,4]],fixShown:()=>c.st.fixLines!==false||c.st.fixCross!==false,fixBound:()=>c.st.fixLines!==false,
  Path2D:class{moveTo(){}lineTo(){}},axisStroke:(G,o)=>Style.stroke(G,{mode:c.st.axisPalette,...o}),fixPad(){assert.fail('collector must not alter page spacing');},vtxLabels(){assert.fail('collector must not create labels');}};
 vm.createContext(c);vm.runInContext(section('  function fixPts(','  // v0.205:')+section('  function fixLinesDraw(','  // v0.245 →')+section('  function guideBottom(','  function guideHeight('),c);
 c.collect=()=>Geometry.capture(G=>c.fixLinesDraw(G,0,0,1,1,0,false,true),{clip:[0,0,17,10]});return c;
}
test('collector reuses actual meeting renderer: both diagonals, continuations, horizontal and full vertical',()=>{
 const c=fixture(),before=c.f.val.slice(),lines=c.collect();assert.equal(lines.length,6);
 const key=L=>[L.a,L.b].map(p=>p.join(',')).join(':');assert.ok(lines.some(L=>key(L)==='8.5,0:8.5,10'));assert.ok(lines.some(L=>key(L)==='0,4.5:17,4.5'));
 assert.equal(lines.filter(L=>L.a[0]!==L.b[0]&&L.a[1]!==L.b[1]).length,4);assert.deepEqual(c.f.val,before);
});
test('hidden cross excludes its horizontal, vertical and lower continuations; fully hidden meeting contributes nothing',()=>{
 const c=fixture({fixCross:false,saw:true,sawFull:true});assert.equal(c.collect().length,2);c.st.fixLines=false;assert.equal(c.collect().length,0);
});
test('all drawn saw and full-saw segments are collected with the renderer clips, without treating decorative circles or labels as axes',()=>{
 const c=fixture({saw:true}),partial=c.collect();assert.ok(partial.length>6);assert.ok(partial.some(L=>L.color==='#ff5a4f'));
 c.st.sawFull=true;const full=c.collect();assert.ok(full.length>partial.length);assert.ok(full.some(L=>L.color==='#5ce1e6'));
 for(const L of full)for(const p of [L.a,L.b]){assert.ok(p[0]>=-1e-8&&p[0]<=17+1e-8);assert.ok(p[1]>=-1e-8&&p[1]<=10+1e-8);}
 const cells=new Set();for(const L of full)Axes.traceCells(L.a,L.b,{clip:[0,0,17,10]},(x,y)=>{if(x>=0&&x<17&&y>=0&&y<10)cells.add(y*17+x);});assert.ok(cells.size>30);assert.ok(cells.size<=170);
});
test('manual meeting shifts move diagonal centre independently of the separately locked vertical axis',()=>{
 const c=fixture({fixLines:false,fixCross:true,fixDx:1,fixDy:2,fixLockX:4}),lines=c.collect();assert.ok(lines.some(L=>L.a[0]===12.5&&L.b[0]===12.5));assert.ok(lines.some(L=>L.a[1]===6.5&&L.b[1]===6.5));assert.ok(lines.some(L=>L.a[0]===9.5&&L.a[1]===6.5));
});
test('nested clip scopes and two-colour axis strokes yield one geometric line, independent of palette',()=>{
 for(const mode of ['purple-black','purple-red']){const lines=Geometry.capture(G=>{G.beginPath();G.moveTo(-5,2);G.lineTo(12,2);Style.stroke(G,{mode});G.save();G.beginPath();G.rect(2,1,3,2);G.clip();G.beginPath();G.moveTo(0,1.5);G.lineTo(8,1.5);G.stroke();G.restore();},{clip:[0,0,8,4]});assert.deepEqual(lines.map(L=>[L.a,L.b]),[[[0,2],[8,2]],[[2,1.5],[5,1.5]]]);}
});
