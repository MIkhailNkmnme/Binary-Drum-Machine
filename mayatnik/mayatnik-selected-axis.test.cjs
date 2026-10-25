const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),S=require('./mayatnik-symmetry.js');
const html=fs.readFileSync(require('node:path').join(__dirname,'Zerkalius-mayatnik.html'),'utf8');
const code=html.slice(html.indexOf('  function paintSymmetry('),html.indexOf('  /* v0.177:'));
const geometricPeers=(segs,selected,anchor)=>{
  const key=points=>points.map(p=>p.join(',')).sort().join(';');
  const ends=s=>[S.point(s.dir,s.axis,s.t0),S.point(s.dir,s.axis,s.t1)];
  const reflected=key(ends(selected).map(([x,y])=>[2*anchor-x,y]));
  return segs.filter(s=>s===selected||s.p===selected.p&&s.dir===({v:'v',h:'h',d:'u',u:'d'}[selected.dir])&&key(ends(s))===reflected);
};
test('manual selection shows only its group pairs below x3 with global bit highlighting off, changes and clears',()=>{
  const field={W:9,H:9,val:new Int8Array(81).fill(1)},anchor=2;
  const segs=S.find(field,{anchor,directions:['v','h','d','u'],plainDirections:['v','h','d','u'],minBits:1,minRows:1});
  const context={MayatnikSymmetry:S,rombP:()=>-1,VW:9,VH:9,VX:0,geo:{anchor},st:{symBits:false,symTriangles:false},k:4,f:field,outShow:()=>false,scale:()=>2,konus:null};
  vm.createContext(context);vm.runInContext(code,context);
  let drawn=[];const ctx={save(){},restore(){},beginPath(){},rect(){},clip(){},moveTo(){},lineTo(){},stroke(){},fillRect(x,y,w,h){drawn.push([Math.round((x+w/2)/2-.5),Math.round((y+h/2)/2-.5)]);}};
  const draw=()=>{drawn=[];context.paintSymmetry(ctx,{segs},0,0,2,18,18);return [...new Set(drawn.map(p=>p.join(',')))].sort();};
  assert.deepEqual(draw(),[]);
  for(const dir of ['v','h','d','u'])for(const p of [-1,0,1]){
    const selected=segs.find(s=>s.dir===dir&&s.p===p);context.konus={frame:4,segment:selected};
    const expected=[];for(const s of geometricPeers(segs,selected,anchor))S.eachPair(s,anchor,(x,y,mx,my)=>expected.push(x+','+y,mx+','+my));
    assert.deepEqual(draw(),[...new Set(expected)].sort(),dir+'/'+p);
  }
  context.konus=null;assert.deepEqual(draw(),[]);
  context.konus={frame:3,segment:segs[0]};assert.deepEqual(draw(),[],'old frame selection is not drawn');
  context.konus={frame:4,segment:{...segs[0],axis:999}};assert.deepEqual(draw(),[],'filtered or missing axis is not drawn');
});

test('real click selects both strokes and their pairs while export retains the clicked segment',()=>{
  const a={dir:'d',p:-1,axis:-2,t0:4,t1:8,widths:[1,1,1,1,1],colour:[10,20,30]},
    b={dir:'u',p:-1,axis:12,t0:2,t1:6,widths:[1,1,1,1,1],colour:[100,110,120]},
    other={dir:'v',p:-1,axis:5,t0:3,t1:5,widths:[1,1,1],colour:[60,70,80]};
  const field={W:11,H:9,val:new Int8Array(99).fill(1)},data={segs:[a,b,other]},els=new Map();
  const element=id=>{if(!els.has(id))els.set(id,{classList:{add(){},remove(){}},setAttribute(){}});return els.get(id);};
  const context={MayatnikSymmetry:S,rombP:()=>-1,VW:11,VH:9,VX:0,geo:{anchor:5},st:{sym:true,symBits:false,symTriangles:false,rows:9},
    k:4,f:field,outShow:()=>false,scale:()=>10,konus:null,symGet:()=>data,$:element,axisPicking:false,draw(){}};
  vm.createContext(context);vm.runInContext(code,context);
  vm.runInContext(html.slice(html.indexOf('  function konusData()'),html.indexOf('  function konusDraw(')),context);
  let cells=[],strokes=[];
  const ctx={save(){},restore(){},beginPath(){},rect(){},clip(){},moveTo(){},lineTo(){},
    stroke(){strokes.push([this.strokeStyle,this.lineWidth]);},
    fillRect(x,y,w,h){cells.push([Math.round((x+w/2)/10-.5),Math.round((y+h/2)/10-.5)].join(','));}};
  const paint=()=>{cells=[];strokes=[];context.paintSymmetry(ctx,data,0,0,10,110,90);};
  paint();assert.deepEqual(strokes[0],strokes[1]);assert.notDeepEqual(strokes[0],strokes[2]);
  for(const clicked of [a,b]){
    const point=S.point(clicked.dir,clicked.axis,(clicked.t0+clicked.t1)/2);
    assert.equal(context.konusPick(...point,true,-1),true);
    assert.equal(context.konus.segment,clicked,'primary clicked segment is kept');
    paint();assert.deepEqual(strokes,[['#ff3cc8',2.8],['#ff3cc8',2.8],['rgb(60,70,80)',1.1]]);
    const expected=[];for(const s of [a,b])S.eachPair(s,5,(x,y,mx,my)=>expected.push(x+','+y,mx+','+my));
    assert.deepEqual([...new Set(cells)].sort(),[...new Set(expected)].sort());
    assert.equal(cells.length,new Set(cells).size,'overlapping selected cells are painted once');
    const exported=context.konusData();assert.equal(exported.axisDirection,clicked.dir);assert.equal(exported.axis,clicked.axis);
    assert.equal(exported.rows.length,clicked.widths.length);
  }
  context.konus={frame:3,segment:a};paint();assert.equal(cells.length,0);assert.ok(strokes.every(s=>s[1]===1.1));
  context.konus={frame:4,segment:a};data.segs=[b,other];paint();assert.equal(cells.length,0);assert.ok(strokes.every(s=>s[1]===1.1));
  data.segs=[a,other];paint();assert.equal(strokes[0][0],'#ff3cc8');assert.equal(strokes[1][0],'rgb(60,70,80)');
  const pointAxis={dir:'v',p:-1,axis:2,t0:3,t1:3,widths:[1],colour:[10,20,30]},
    pointPeer={...pointAxis,axis:8,colour:[100,110,120]};
  data.segs=[pointAxis,pointPeer];assert.equal(context.konusPick(8,3,true,-1),true);
  assert.equal(context.konus.segment,pointPeer);paint();assert.ok(strokes.every(s=>s[0]==='#ff3cc8'));
});

test('hidden checkerboard lattice does not show the selected group',()=>{
  const field={W:11,H:9,val:new Int8Array(99).fill(1)},anchor=5,segs=S.find(field,{anchor,minBits:1,minRows:1,directions:['v']});
  const selected=segs.find(s=>s.p===1),context={MayatnikSymmetry:S,rombP:()=>0,VW:11,VH:9,VX:0,geo:{anchor},st:{symBits:false,symTriangles:false},
    k:4,f:field,outShow:()=>false,scale:()=>2,konus:{frame:4,segment:selected}};
  vm.createContext(context);vm.runInContext(code,context);
  let fills=0;const strokes=[],ctx={save(){},restore(){},beginPath(){},rect(){},clip(){},moveTo(){},lineTo(){},closePath(){},fill(){fills++;},stroke(){strokes.push(this.lineWidth);}};
  context.paintSymmetry(ctx,{segs},0,0,2,22,18);
  assert.equal(fills,0);assert.ok(strokes.every(w=>w===1.1));
});
