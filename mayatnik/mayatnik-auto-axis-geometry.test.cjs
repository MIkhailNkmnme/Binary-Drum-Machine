const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Geometry=require('./mayatnik-auto-axis-geometry.js'),Axes=require('./mayatnik-axis-colour.js'),Style=require('./mayatnik-axis-style.js');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
function section(a,b){const start=html.indexOf(a),end=html.indexOf(b,start);assert.ok(start>=0&&end>start);return html.slice(start,end);}
function fixture(state={}){
 const c={st:{rows:10,fixLines:true,fixCross:true,saw:false,axisPalette:'purple-black',...state},VW:17,VH:10,VX:0,f:{W:17,H:10,val:new Int8Array(170).fill(1)},geo:{anchor:8},g:null,
  fixSegments:()=>[[4,0,8,4,13,9,4],[12,0,8,4,3,9,4]],fixShown:()=>c.st.fixLines!==false||c.st.fixCross!==false,fixBound:()=>c.st.fixLines!==false,
  Path2D:class{moveTo(){}lineTo(){}},axisStroke:(G,o)=>Style.stroke(G,{mode:c.st.axisPalette,...o}),fixPad(){assert.fail('collector must not alter page spacing');},vtxLabels(){assert.fail('collector must not create labels');}};
 c.parityValues=()=>c.f.val;
 vm.createContext(c);vm.runInContext(section('  function fixPts(','  // v0.205:')+section('  function fixLinesDraw(','  // v0.245 →')+section('  function guideBottom(','  function guideHeight('),c);
 c.collect=()=>Geometry.capture(G=>c.fixLinesDraw(G,0,0,1,1,0,false,true),{clip:[0,0,17,10]});return c;
}
test('collector reuses actual meeting renderer: both diagonals, continuations, horizontal and full vertical',()=>{
 const c=fixture(),before=c.f.val.slice(),lines=c.collect();assert.equal(lines.length,6);
 const key=L=>[L.a,L.b].map(p=>p.join(',')).join(':');assert.ok(lines.some(L=>key(L)==='8.5,0:8.5,10'));assert.ok(lines.some(L=>key(L)==='0,4.5:17,4.5'));
 assert.equal(lines.filter(L=>L.a[0]!==L.b[0]&&L.a[1]!==L.b[1]).length,4);assert.deepEqual(c.f.val,before);
});
test('the independent full saw keeps its reflected teeth when the cross and freeze guides are hidden',()=>{
 const c=fixture({fixCross:false,fixLines:false,saw:false,sawFull:false}),before=c.f.val.slice();
 assert.equal(c.collect().length,0);
 const setter=section('  function sawFullUnavailable(','  window.mayAreas=');
 Object.assign(c,{window:{},save(){},draw(){},animatrixOn:()=>false,edgeFlowOn:()=>false,compareOn:()=>false,rombP:()=>-1});vm.runInContext(setter,c);
 c.window.maySawFull.set(true);
 const lines=c.collect();assert.deepEqual(new Set(lines.map(L=>L.color)),new Set(['#ff5a4f','#5ce1e6']));
 assert.equal(c.st.fixLines,false);assert.equal(c.st.fixCross,false);assert.deepEqual(c.f.val,before);
 c.window.maySawFull.set(false);assert.equal(c.collect().length,0);
 c.st.fixLines=true;assert.equal(c.collect().length,2);
});
test('ordinary frame zero can arm the saw; unsupported sources explain the missing geometry and stay off',()=>{
 const c=fixture({fixCross:false,fixLines:false}),notice={};
 Object.assign(c,{window:{},save(){},draw(){},$:()=>notice,ochkiToast:text=>{notice.toast=text;},k:0,
  animatrixOn:()=>false,edgeFlowOn:()=>false,compareOn:()=>false,rombP:()=>-1});
 vm.runInContext(section('  function sawFullUnavailable(','  window.mayAreas='),c);
 const saw=c.window.maySawFull;assert.equal(saw.set(true),true);assert.equal(saw.get(),true);
 for(const [fn,value,reason]of [['animatrixOn',true,/Аниматриц/],['edgeFlowOn',true,/без сброса/],['rombP',2,/ромбы/]]){
  const previous=c[fn];c[fn]=()=>value;assert.match(saw.reason(),reason);assert.equal(saw.get(),false);
  assert.equal(saw.set(true),false);assert.equal(c.st.sawFull,false);assert.equal(c.st.saw,false);
  assert.match(notice.textContent,reason);assert.equal(notice.toast,notice.textContent);
  c[fn]=previous;saw.set(true);
 }
});
test('the live overlay paints the independent saw calculated from an actual frame of the pendulum',()=>{
 const Core=require('./mayatnik-core.js'),Construction=require('./mayatnik-construction.js');
 const c=fixture({rows:16,steps:16,mode:'pend',fixLines:false,fixCross:false,saw:true,sawFull:true});
 c.geo=Core.geometry('pend',16,16);c.VW=c.geo.W;c.VH=16;c.k=6;c.f=Core.field(c.VW,16,'empty',c.geo.anchor);
 for(let i=0;i<c.k;i++)Construction.step(c.f,c.geo,c.st,i);
 const rect={left:0,top:0},canvas={style:{}},graphics={setTransform(){},clearRect(){}};
 let lines=null;
 Object.assign(c,{MayatnikConstruction:Construction,animatrixOn:()=>false,edgeFlowOn:()=>false,
  total:()=>16,compareOn:()=>false,pairOn:()=>false,rombP:()=>-1,picOn:()=>true,fixOvOn:()=>true,
  cv:{getBoundingClientRect:()=>rect},wrap:{getBoundingClientRect:()=>rect,clientWidth:c.VW,clientHeight:16},
  devicePixelRatio:1,scale:()=>1,bothDraw:{},bothOn:()=>false,areaPad(){},queueLineMeasures(){},fixPad(){},digitG:null,
  MayatnikLineMeasures:{capture(target,paint){lines=Geometry.capture(paint,{clip:[0,0,c.VW,c.VH]});return lines;}}});
 const named=name=>{const start=html.indexOf('  function '+name+'(');assert.ok(start>=0);let end=html.indexOf('{',start)+1,depth=1;
  while(depth){if(html[end]==='{')depth++;if(html[end]==='}')depth--;end++;}return html.slice(start,end);};
 vm.runInContext(['fixApexes','fixSegments','fixOvDraw'].map(named).join('\n'),c);
 c.fixOvDraw.o={c:canvas,g:graphics};c.fixOvDraw();
 assert.equal(canvas.style.display,'');assert.deepEqual(new Set(lines.map(line=>line.color)),new Set(['#ff5a4f','#5ce1e6']));
 c.st.sawFull=false;c.st.saw=false;c.fixOvDraw();assert.equal(canvas.style.display,'none');
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
