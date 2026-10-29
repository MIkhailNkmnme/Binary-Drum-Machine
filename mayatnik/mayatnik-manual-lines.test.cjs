const test=require('node:test'),assert=require('node:assert/strict'),Lines=require('./mayatnik-manual-lines.js');
const viewport={left:100,top:50,right:900,bottom:650};
const geometry={left:-300,top:-200,scale:10,anchor:50,width:140,height:100};
const size={width:160,height:24};

test('segments clip all families to the viewport without depending on field bit contents',()=>{
 assert.deepEqual(Lines.segment({kind:'h',p:30},geometry,viewport),[100,100,900,100]);
 assert.deepEqual(Lines.segment({kind:'v',p:0},geometry,viewport),[205,50,205,650]);
 assert.deepEqual(Lines.segment({kind:'d',p:0},geometry,viewport),[450,50,900,500]);
 assert.deepEqual(Lines.segment({kind:'e',p:60},geometry,viewport),[560,50,100,510]);
 assert.equal(Lines.segment({kind:'h',p:0},geometry,viewport),null);
 assert.equal(Lines.segment({kind:'h',p:30,visible:false},geometry,viewport),null);
 assert.equal(Lines.clip([0,0,10,10],{left:2,top:6,right:4,bottom:8}),null);
});

test('controls use 40 percent of viewport width/height and fit their whole footprint',()=>{
 for(const [kind,p]of [['h',30],['v',0],['d',0],['e',60]]){
  const line=Lines.segment({kind,p},geometry,viewport),a=Lines.controlAnchor(line,viewport,size,kind);
  assert.ok(a.x-size.width/2>=viewport.left&&a.x+size.width/2<=viewport.right,kind);
  assert.ok(a.y-size.height/2>=viewport.top&&a.y+size.height/2<=viewport.bottom,kind);
  assert.equal(a.detached,false,kind);
  assert.equal(kind==='h'?a.x:a.y,kind==='h'?420:290,kind);
  assert.ok(Lines.hit([{id:kind,segment:line}],a.x,a.y,{radius:1e-7}),kind+' lies on its own line');
 }
});

test('pan, zoom and resize keep the horizontal target relative to screen, not to first field cell',()=>{
 for(const left of [-900,-300,0])for(const scale of [10,20,30]){
  const g={...geometry,left,top:0,scale},line=Lines.segment({kind:'h',p:10},g,viewport);
  if(!line)continue;
  assert.equal(Lines.controlAnchor(line,viewport,size,'h').x,420);
 }
 const narrow={left:100,top:50,right:600,bottom:650};
 assert.equal(Lines.controlAnchor([0,100,1000,100],narrow,size,'h').x,300);
});

test('short corner segments retain an explicit attachment, offscreen segments yield no controls',()=>{
 const a=Lines.controlAnchor([90,60,110,40],viewport,size,'d');
 assert.ok(a&&a.detached);assert.equal(a.x,182);assert.equal(a.y,64);
 assert.equal(Lines.controlAnchor([0,0,20,20],viewport,size,'d'),null);
 assert.equal(Lines.controlAnchor([0,0,NaN,20],viewport,size,'d'),null);
});

test('hit test chooses nearest visible axis; exact intersections use stable explicit preference',()=>{
 const axes=[{id:'main',kind:'h',segment:[100,100,900,100]},{id:'extra',kind:'h',segment:[100,104,900,104]},
  {id:'vertical',kind:'v',segment:[420,50,420,650]}];
 assert.equal(Lines.hit(axes,300,103,{preferredId:'main'}).id,'extra');
 assert.equal(Lines.hit(axes,420,100,{preferredId:'main'}).id,'main');
 assert.equal(Lines.hit(axes,420,100).id,'vertical');
 assert.equal(Lines.hit([{...axes[1],visible:false}],300,104),null);
 assert.equal(Lines.hit(axes,95,100).id,'main');assert.equal(Lines.hit(axes,93,100),null);
 assert.equal(Lines.hit(axes,300,130),null);
});

test('all axes drag on half-cell steps; main and extra horizontal use identical delta math',()=>{
 assert.equal(Lines.dragPosition('h',8,0,40,4,64),18);
 assert.equal(Lines.dragPosition('h',8,0,1,4,64),8.5);
 assert.equal(Lines.dragPosition('h',8,0,-100,4,64),0);
 assert.equal(Lines.dragPosition('h',8,0,400,4,64),64);
 assert.equal(Lines.dragPosition('h',63,0,2,4,64),63.5,'last row centre remains reachable');
 assert.equal(Lines.dragPosition('h',63.5,0,2,4,64),64,'bottom boundary remains reachable');
 assert.equal(Lines.dragPosition('v',-2,10,300,4),.5);
 assert.equal(Lines.dragPosition('d',2,20,20,4),2,'motion along diagonal keeps its position');
 assert.equal(Lines.dragPosition('d',2,0,20,4),-3);
 assert.equal(Lines.dragPosition('e',2,20,-20,4),2);
 assert.equal(Lines.dragPosition('e',2,0,20,4),7);
});

test('labels distinguish a row centre from a boundary and keep axis number separate',()=>{
 assert.equal(Lines.label({kind:'h',p:0,number:1}),'Г1 · перед 1');
 assert.equal(Lines.label({kind:'h',p:12,number:2}),'Г2 · между 12/13');
 assert.equal(Lines.label({kind:'h',p:12.5,number:2}),'Г2 · строка 13');
 assert.equal(Lines.positionLabel('v',0,10),'столбец 11 · 0');
 assert.equal(Lines.positionLabel('v',.5,10),'между 11/12 · +½');
 assert.equal(Lines.positionLabel('v',-.5,10),'между 10/11 · -½');
 assert.equal(Lines.label({kind:'h',p:63.5,number:2},0,64),'Г2 · строка 64');
 assert.equal(Lines.label({kind:'h',p:64,number:2},0,64),'Г2 · после 64');
 assert.equal(Lines.label({kind:'e',p:2.5,number:3}),'Д3 · ╱ · Δ+2½');
});

test('coincident and close axes keep distinct panels on their lines without changing field positions',()=>{
 for(const kind of ['h','v','d','e']){
  const p=kind==='h'?30:kind==='e'?60:0;
  const items=Array.from({length:3},(_,i)=>({id:i,kind,p,segment:Lines.segment({kind,p},geometry,viewport),size:{width:100,height:24}}));
  const before=JSON.stringify(items),layout=Lines.controlLayout(items,viewport);
  assert.equal(JSON.stringify(items),before,'layout never mutates field positions');
  for(let i=0;i<layout.length;i++){
   const a=layout[i];assert.equal(a.overlap,false,kind);assert.equal(a.detached,false,kind);
   assert.ok(Lines.hit([items[i]],a.x,a.y,{radius:1e-6}),kind+' stays on its line');
   for(const b of layout.slice(0,i))assert.ok(a.rect.right<=b.rect.left-1.99||a.rect.left>=b.rect.right+1.99||a.rect.bottom<=b.rect.top-1.99||a.rect.top>=b.rect.bottom+1.99,kind+' panels do not collide');
  }
  assert.deepEqual(Lines.controlLayout(items,viewport),layout,'redraw is stable');
 }
 const close=[{id:'main',kind:'h',segment:[100,100,900,100],size},{id:'extra',kind:'h',segment:[100,104,900,104],size}];
 const [a,b]=Lines.controlLayout(close,viewport);assert.notEqual(a.x,b.x);assert.equal(a.y,100);assert.equal(b.y,104);
 const edge=close.map(item=>({...item,segment:[100,50,900,50]})),[first,second]=Lines.controlLayout(edge,viewport);
 assert.notEqual(first.x,second.x,'plus at first-row boundary still separates the two panels');assert.equal(first.y,second.y);assert.equal(first.onLineY,50);assert.equal(second.onLineY,50);assert.equal(first.overlap,false);assert.equal(second.overlap,false);
});

test('direction buttons preserve legacy mirror modes, including slash diagonal destination',()=>{
 for(const [kind,symbols]of [['h',['↓','↑']],['v',['→','←']],['d',['↙','↗']],['e',['↖','↘']]]){
  const buttons=Lines.mirrorButtons(kind,2);assert.deepEqual(buttons.map(b=>b.symbol),symbols);assert.deepEqual(buttons.map(b=>b.mode),[1,2]);
  assert.ok(buttons.every(b=>!b.disabled));
 }
 assert.ok(Lines.mirrorButtons('e',2.5).every(b=>b.disabled));
 assert.ok(Lines.mirrorButtons('h',2.5).every(b=>!b.disabled));
 assert.equal(Lines.toggleMirror(0,1),1);assert.equal(Lines.toggleMirror(1,2),2);assert.equal(Lines.toggleMirror(2,2),0);
});

test('narrow-screen two-row panels on coincident axes fit without overlap and retain an explicit line attachment',()=>{
 const screen={left:8,top:10,right:352,bottom:610};
 for(const y of [10,200,610]){
  const items=Array.from({length:4},(_,i)=>({id:i,kind:'h',segment:[8,y,352,y],size:{width:206,height:50}})),before=JSON.stringify(items),positions=Lines.controlLayout(items,screen);
  assert.equal(JSON.stringify(items),before);assert.deepEqual(Lines.controlLayout(items,screen),positions);
  for(let i=0;i<positions.length;i++){const a=positions[i];assert.equal(a.overlap,false);assert.ok(a.rect.left>=screen.left&&a.rect.right<=screen.right&&a.rect.top>=screen.top&&a.rect.bottom<=screen.bottom);assert.equal(a.onLineY,y);
   for(const b of positions.slice(0,i))assert.ok(a.rect.bottom<=b.rect.top-1.99||a.rect.top>=b.rect.bottom+1.99);
  }
  assert.ok(positions.slice(1).some(p=>p.detached));
 }
});

test('keyboard half steps and Shift full steps preserve centre/boundary phase and use natural perpendicular movement',()=>{
 for(const p of [0,1,1.5,20.5]){
  assert.equal(Lines.keyPosition('h',p,'ArrowDown'),p+.5);assert.equal(Lines.keyPosition('h',p,'ArrowDown',true),p+1);
  assert.equal(Lines.keyPosition('v',p,'ArrowRight'),p+.5);assert.equal(Lines.keyPosition('v',p,'ArrowLeft',true),p-1);
  assert.equal(Lines.keyPosition('d',p,'ArrowUp'),p+.5);assert.equal(Lines.keyPosition('d',p,'ArrowDown',true),p-1);
  assert.equal(Lines.keyPosition('e',p,'ArrowUp'),p-.5);assert.equal(Lines.keyPosition('e',p,'ArrowDown',true),p+1);
 }
 assert.equal(Lines.keyPosition('h',.5,'ArrowUp',true,8),.5);assert.equal(Lines.keyPosition('h',7.5,'ArrowDown',true,8),7.5);
 assert.equal(Lines.keyPosition('h',.5,'ArrowUp',false,8),0);assert.equal(Lines.keyPosition('h',8,'ArrowDown',false,8),8);
 assert.equal(Lines.keyPosition('h',1,'ArrowLeft'),null);assert.equal(Lines.keyPosition('v',1,'ArrowDown'),null);assert.equal(Lines.keyPosition('d',1,'Enter'),null);
});
