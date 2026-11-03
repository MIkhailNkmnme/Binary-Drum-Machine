const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
function between(start,end){const at=html.indexOf(start);assert.ok(at>=0);return html.slice(at,html.indexOf(end,at));}
function boot(state={}){
  const checkbox={checked:false},c={window:{},st:{rows:32,mode:'pend',pair:true,fixCross:false,fixLines:false,fixDragK:false,fixAxis:2,fixLockX:7,fixDx:4,fixDy:6,fixMirror:3,zoom:8,...state},geo:{anchor:50},VX:0,VW:100,VH:32,f:{H:32},k:2,saved:[],drawn:0,$:()=>checkbox,total:()=>16,compareOn:()=>false,pairOn:()=>true,rombP:()=>-1};
  Object.assign(c,{MayatnikConstruction:require('./mayatnik-construction.js'),MAYATNIK:require('./mayatnik-core.js'),MayatnikEdgeFlow:require('./mayatnik-edge-flow.js'),animatrixOn:()=>false,edgeFlowOn:()=>c.MayatnikEdgeFlow.active(c.st),coneContinueAllowed:()=>false,pairOn:()=>c.st.pair&&c.st.mode==='pend'});
  c.save=()=>c.saved.push(JSON.stringify(c.st));c.draw=()=>c.drawn++;vm.createContext(c);
  vm.runInContext(between('  function edgeCol(', '  function addOne('),c);
  vm.runInContext(between('  function fixMeetAt(', '  window.mayFixAxis='),c);
  vm.runInContext(between('  function fixApexes(','  // v0.127:'),c);
  vm.runInContext(between('  function fixSegments(','  // v0.203:'),c);
  vm.runInContext(between('  function fixShown()','  // v0.205:'),c);
  vm.runInContext(between('  window.mayFixFollow=','  window.mayLineMeasures='),c);
  c.checkbox=checkbox;return c;
}
test('enable resets manual shift, lock and anti-motion in one persisted draw; off preserves other settings',()=>{
  const c=boot();c.window.mayFixFollow.set(true);assert.equal(c.window.mayFixFollow.get(),true);
  assert.equal(c.st.fixAxis,0);assert.equal(c.st.fixLockX,null);assert.equal(c.st.fixDx,0);assert.equal(c.st.fixDy,0);assert.equal(c.checkbox.checked,true);assert.equal(c.saved.length,1);assert.equal(c.drawn,1);
  const restored=boot(JSON.parse(c.saved[0]));assert.equal(restored.window.mayFixFollow.get(),true);
  c.st.fixAxis=2;c.st.fixLockX=9;c.st.fixDx=3;c.st.fixDy=-2;c.window.mayFixFollow.set(false);
  assert.equal(c.st.fixCross,false);assert.equal(c.st.fixLines,false);assert.equal(c.st.fixDragK,false);assert.equal(c.checkbox.checked,false);
  assert.equal(c.st.fixAxis,2);assert.equal(c.st.fixLockX,9);assert.equal(c.st.fixDx,3);assert.equal(c.st.fixDy,-2);assert.equal(c.st.fixMirror,3);assert.equal(c.st.zoom,8);assert.equal(c.drawn,2);
  assert.equal(boot(JSON.parse(c.saved[1])).window.mayFixFollow.get(),false);
});
test('point and axis use the current neighboring frame geometry after enable',()=>{
  const c=boot();c.window.mayFixFollow.set(true);const positions=[];
  for(c.k=2;c.k<=5;c.k++){
    const segs=c.fixSegments(true),points=[...c.fixPts(segs,32).values()];assert.ok(points.length);positions.push(points.map(q=>q[2]));
    for(const q of points){assert.ok(segs.some(s=>s[2]===q[0]&&s[3]===q[1]));assert.equal(q[2],q[1]);assert.equal(q[3],q[0]);assert.equal(q[4],q[0]);}
  }
  assert.equal(new Set(positions.map(JSON.stringify)).size,4);assert.equal(c.st.zoom,8);
});
test('getter reflects every real mode change; enabling without a frame still saves',()=>{
  const c=boot();c.window.mayFixFollow.set(true);const base={...c.st};
  for(const [key,value]of Object.entries({fixCross:false,fixLines:false,fixDragK:false,fixAxis:1,fixLockX:0,fixDx:1,fixDy:-1})){Object.assign(c.st,base,{[key]:value});assert.equal(c.window.mayFixFollow.get(),false,key);}
  c.f=null;c.window.mayFixFollow.set(true);assert.equal(c.drawn,1);assert.equal(c.saved.length,2);assert.equal(c.window.mayFixFollow.get(),true);
});
test('single standard button toggles the atomic mode, reports real state and keeps the placement key',()=>{
  const menu=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8'),c=boot();
  const node=()=>({dataset:{},style:{},children:[],attrs:{},classList:{names:new Set(),add(...names){names.forEach(n=>this.names.add(n));},toggle(name,on){if(on)this.names.add(name);else this.names.delete(name);}},append(child){this.children.push(child);},setAttribute(key,value){this.attrs[key]=value;},querySelector(){return this.children[0];}});
  const sources=[node(),node(),node()];let button,placed=0;
  Object.assign(c,{gAxis:{append:b=>{button=b;}},tools:{querySelector:query=>sources[['fixCross','fixDragK','fixLines'].findIndex(id=>query.includes('"'+id+'"'))]},ptNames:{},document:{createElement:node},toolSync:[],placeTools:()=>placed++,ptBtn:(id,kind,probe,click)=>{const b=node();b.dataset.n=id;b.className='pt-b';b.append(node());b.onclick=click;return b;}});
  const at=menu.indexOf('  { const sources = [');assert.ok(at>=0);vm.runInContext(menu.slice(at,menu.indexOf('  // v0.499:',at)),c);
  assert.equal(button.dataset.n,'fixTri');assert.equal(button.children.length,2);assert.equal(button.children[1].textContent,'Точка');assert.equal(button.classList.names.has('gz-hx'),true);assert.match(button.title,/Точка встречи и ось: следовать за кадром/);assert.equal(button.attrs['aria-label'],button.title);
  for(const source of sources){assert.equal(source.style.display,'none');assert.equal(source.dataset.maySearchSkip,'');}
  const sync=()=>c.toolSync.forEach(f=>f());sync();assert.equal(button.attrs['aria-pressed'],'false');button.onclick();sync();assert.equal(button.attrs['aria-pressed'],'true');assert.equal(placed,1);assert.equal(c.saved.length,1);
  c.st.fixAxis=2;sync();assert.equal(button.attrs['aria-pressed'],'false');button.onclick();sync();assert.equal(button.attrs['aria-pressed'],'true');button.onclick();sync();assert.equal(button.attrs['aria-pressed'],'false');
  const search=require('./mayatnik-button-search.js'),record={node:button,name:'Точка',text:search.normalize(button.title+' Точка')};assert.equal(search.find([record],'следовать за кадром')[0].node,button);
});

test('continuous edge guides meet at the mapped next tips before and after crossings',()=>{
  const R=require('./mayatnik-rombo.js'),c=boot({rows:16,edgeWrap:true,edgeContinuous:true,pair:false});
  c.geo.anchor=15;c.VH=c.f.H=16;c.VW=c.f.W=31;c.window.mayFixFollow.set(true);
  const plan=R.plan(31,16,{assembly:16},{sides:true,anchor:15});
  for(const [frame,pair,expectedX,expectedY] of [[5,false,15,3],[30,false,30,0],[31,false,15,15],[32,false,14.5,14.5],[33,false,15,14],[17,true,15,13]]){
    c.k=frame;c.st.pair=pair;
    const segments=c.fixGuideSegments(),point=[...c.fixPts(segments,16).values()][0];
    assert.equal(point[4],expectedX);assert.equal(point[2],expectedY);assert.equal(c.fixMeetAt(frame,expectedX),expectedY);
    assert.equal(c.fixSegments(true).length,0,'unbounded runs do not freeze cells');
    if(frame===5)for(const part of plan.parts){
      const native={x:expectedX+.5,y:expectedY+.5},picked=plan.pick(plan.forward(R.point(part.matrix,native)));
      assert.equal(picked.part,part.id);assert.equal(picked.x,native.x);assert.equal(picked.y,native.y);
    }
  }
  c.st.mode='left';assert.equal(c.fixGuideSegments().length,0);
});
test('edge frame dragging chooses a nearest matching frame on the current traversal',()=>{
  const c=boot({rows:8,edgeWrap:true,edgeContinuous:true});c.geo.anchor=7;c.VH=c.f.H=8;c.VW=c.f.W=15;c.total=()=>101;c.Event=class{};
  const slider={value:0,dispatchEvent(){}};c.$=()=>slider;
  for(const pair of [true,false])for(const bounce of [false,true]){
    c.st.pair=pair;c.st.edgeBounce=bounce;
    const depths=Array.from({length:101},(_,i)=>c.fixMeetAt(i+1,7));
    for(const current of [1,15,31,69,101])for(const target of [0,.5,1.5,3,6,7,10]){
      c.k=current;slider.value=current;c.fixDragFrame(target,7);
      const best=Math.min(...depths.map(y=>Math.abs(target-y)));
      const distance=Math.min(...depths.map((y,i)=>Math.abs(y-target)===best?Math.abs(i+1-current):Infinity));
      assert.equal(Math.abs(slider.value-current),distance);assert.equal(Math.abs(depths[slider.value-1]-target),best);
    }
  }
});

test('Rombo overlay emits the meeting rays at final zoom and physical stroke width with no source bitmap',()=>{
  const c=boot({rows:16,edgeWrap:true,edgeContinuous:true,pair:false}),unit=16,quality=32;
  c.VH=c.f.H=16;c.VW=c.f.W=63;c.geo.anchor=31;c.k=4;c.window.mayFixFollow.set(true);
  const rays=[],widths=[],noop=()=>{};
  const ctx={save:noop,restore:noop,setLineDash:noop,beginPath:noop,moveTo:noop,lineTo:noop,recordLine:(a,b)=>rays.push([a,b])};
  Object.assign(c,{g:{},fixOvOn:()=>true,paintRomboTemplate:noop,
    MayatnikRombo:{paintSourceMarks:(G,plan,scale,paint)=>{assert.equal(scale,unit);paint(G);}},
    Path2D:class{moveTo(){}lineTo(){}},axisStroke:G=>widths.push(G.lineWidth)});
  vm.runInContext(between('  function guideBottom(', '  function guideHeight(')+between('  function fixLinesDraw(', '  // v0.245 →')+between('  function paintRomboMarks(', '  function paintRomboTemplate('),c);
  c.paintRomboMarks(ctx,{},quality,unit);
  assert.equal(rays.length,4);
  for(const [,end] of rays.slice(0,2))assert.deepEqual(Array.from(end),[31*unit,3*unit]);
  assert.ok(widths.every(w=>w*quality/unit===1));assert.ok(widths.length>=6);
  c.window.mayFixFollow.set(false);c.paintRomboMarks(ctx,{},quality,unit);assert.equal(rays.length,4);
});
