const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require.resolve('./Zerkalius-mayatnik.html'),'utf8'),M=require('./mayatnik-cross-mirrors.js');
function host(){
  const W=27,H=21,nodes=new Map(),points=[[0,0,7,12.5,13],[0,0,13,13,12.5]],c={st:{rows:H,view:'bits',crossMirror:true,crossLabels:true,crossMirrorMode:'sector',crossMirrorSector:'A1'},f:{W,H,val:new Int8Array(W*H)},geo:{anchor:13},k:7,bmGen:0,VX:0,VW:W,VH:H,RK:1,img:{width:W,height:H},gpuBig:null,window:{},MayatnikCrossMirrors:M,contourBits:Int32Array.from({length:W*H},(_,q)=>q),rombP:()=>-1,parityVisible:(y,x)=>(x+y)%7!==0,outShow:(y,x)=>y===0&&x<3,fixSegments:()=>points,fixPts:s=>new Map(s.map((p,i)=>[i,p])),$:id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',value:'',checked:false});return nodes.get(id);}};
  vm.createContext(c);vm.runInContext(html.slice(html.indexOf('  let crossMirrorCache='),html.indexOf('  function fixShown()')),c);return {c,api:c.window.mayCrossMirrors,nodes,points};
}
test('host mirrors the immutable packed image and contour semantics, never field bits',()=>{
  const {c,api}=host(),data=api.get(),original=Uint32Array.from({length:c.VW*c.VH},(_,q)=>q+100),pixels=original.slice(),bits=c.f.val.slice(),semantic=c.contourBits.slice();
  assert.ok(data.mapping.some(q=>q>=0));const count=api.apply(pixels);assert.ok(count>0);
  for(let q=0;q<pixels.length;q++){const source=data.mapping[q]<0?q:data.mapping[q];assert.equal(pixels[q],original[source]);assert.equal(c.contourBits[q],semantic[source]);if(!data.valid[q])assert.equal(source,q);}
  assert.deepEqual(c.f.val,bits);c.st.crossMirror=false;const untouched=original.slice();assert.equal(api.apply(untouched),0);assert.deepEqual(untouched,original);
});
test('mapping cache follows frame, field, crop, mode, sector, geometry and display masks',()=>{
  const {c,api,points}=host();let current=api.get();assert.strictEqual(api.get(),current);
  for(const change of [()=>c.k++,()=>c.bmGen++,()=>c.st.view='col',()=>c.st.noband=true,()=>c.st.parity={rowsOdd:false},()=>c.st.crossMirrorMode='lr',()=>c.st.crossMirrorSector='C2',()=>points[0][3]++,()=>c.VW--,()=>c.f={...c.f,val:c.f.val.slice()}]){change();const next=api.get();assert.notStrictEqual(next,current);assert.strictEqual(api.get(),next);current=next;}
});
test('unsupported diamonds and unread GPU frames cannot reuse an earlier mapping',()=>{
  const {c,api}=host(),pixels=new Uint32Array(c.VW*c.VH).fill(42);api.get();
  for(const change of [()=>c.rombP=()=>0,()=>{c.rombP=()=>-1;c.RK=2;},()=>{c.RK=1;c.gpuBig={fresh:false,k:c.k};},()=>c.gpuBig={fresh:true,k:c.k-1}]){change();assert.ok(api.get().error);assert.equal(api.apply(pixels),0);assert.ok(pixels.every(v=>v===42));}
  c.gpuBig={fresh:true,k:c.k};assert.ok(!api.get().error);c.fixSegments=()=>[];assert.match(api.get().error,/нет крестов/);
});
test('label draw anchors remain in their own clipped sector and visible cells',()=>{
  const {c}=host(),paint=[],ctx={save(){},restore(){},measureText:t=>({width:12}),strokeText(){},fillText:(...v)=>paint.push(v)};
  const labels=c.paintCrossLabels(ctx,0,0,16,c.VW*16,c.VH*16);assert.ok(labels.length>0);assert.equal(labels.length,paint.length);
  for(const label of labels){assert.equal(M.classify(label.cross,label.x,label.y),label.sector);assert.ok(c.parityVisible(Math.round(label.y),Math.round(label.x)));}
  c.st.crossLabels=false;assert.equal(c.paintCrossLabels(ctx,0,0,16,400,300).length,0);
});
test('state restores, separate label clear/undo, mirror clear and PNG are wired',()=>{
  assert.ok(html.includes("'triangleMapAxes','crossLabels','fixLines'"));assert.ok(html.includes('triangleMapAxes:false,crossLabels:false'));
  assert.ok(html.includes("'triangleMapAxes','crossLabels','midCol'"));assert.ok(html.includes('mirrorsOff(){st.crossMirror=false;crossMirrorSync();'));
  assert.equal((html.match(/triangleMapSync\(\);crossMirrorSync\(\);\$\('autoAxes'\)/g)||[]).length,2);
  assert.ok(html.includes('if(st.crossLabels)paintCrossLabels(cg,0,0,RK,c.width,c.height)'));
  assert.ok(html.includes('triangleMapMirrorApply(px);crossMirrorApply(px);'));
  for(const id of ['crossMirror','crossMirrorMode','crossMirrorSector','crossLabels'])assert.ok(html.includes('id="'+id+'"'));
});

function canvasHost(c){
  const canvases=[];c.document={createElement:()=>{const canvas={width:0,height:0,calls:[]},g={createImageData:(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),putImageData:image=>canvas.image=image,save(){},restore(){},measureText:()=>({width:12}),strokeText(){},fillText(){},drawImage:(...args)=>canvas.calls.push(args)};canvas.getContext=()=>g;canvas.toBlob=fn=>fn({type:'image/png'});canvases.push(canvas);return canvas;}};return canvases;
}

test('sector fill uses a cached immutable RGBA mask, one opacity, neutral/hidden/empty cells and matching labels',()=>{
  const {c,api}=host(),canvases=canvasHost(c),calls=[],ctx={save(){},restore(){},drawImage:(...args)=>calls.push(args)};c.f.val[3*c.VW+3]=-1;const before=c.f.val.slice();
  const data=c.paintCrossSectors(ctx,-50,-30,8),rgba=data.canvas.image.data;assert.equal(canvases.length,1);
  for(let q=0;q<data.codes.length;q++){
    assert.equal(rgba[q*4+3],data.codes[q]?51:0);if(data.codes[q]){const id=Object.keys(M.COLOURS)[data.codes[q]-1],colour=parseInt(M.COLOURS[id].slice(1),16);assert.deepEqual(Array.from(rgba.slice(q*4,q*4+3)),[colour>>>16,colour>>>8&255,colour&255]);assert.ok(c.f.val[q]>=0&&c.parityVisible(Math.floor(q/c.VW),q%c.VW)&&!c.outShow(Math.floor(q/c.VW),q%c.VW));}
  }
  const labels=c.paintCrossLabels({save(){},restore(){},measureText:()=>({width:12}),strokeText(){},fillText(){}},0,0,20,c.VW*20,c.VH*20);
  for(const label of labels){const q=Math.round(label.y)*c.VW+Math.round(label.x);assert.equal(Object.keys(M.LABELS)[data.codes[q]-1],label.sector);assert.deepEqual(data.crosses[data.owners[q]],label.cross);}
  assert.strictEqual(c.paintCrossSectors(ctx,11,13,16),data);assert.equal(canvases.length,1);assert.deepEqual(calls[1].slice(1),[11,13,c.VW*16,c.VH*16]);
  c.st.crossMirror=false;c.st.crossMirrorMode='bt';assert.strictEqual(api.sectors(),data);c.st.crossLabels=false;assert.equal(c.paintCrossSectors(ctx,0,0,1),null);assert.equal(calls.length,2);assert.deepEqual(c.f.val,before);
});

test('sector cache tracks actual frame, masks, geometry, rows, crop and field revision',()=>{
  const {c,api,points}=host();let data=api.sectors();assert.strictEqual(api.sectors(),data);
  for(const change of [()=>c.k++,()=>c.bmGen++,()=>c.st.rows--,()=>c.st.view='col',()=>c.st.noband=2,()=>c.st.parity={colsOdd:false},()=>points[0][3]++,()=>points[0][4]++,()=>points[0][2]++,()=>c.VX++,()=>c.VW--,()=>c.f={...c.f,val:c.f.val.slice()}]){change();const next=api.sectors();assert.notStrictEqual(next,data);assert.strictEqual(api.sectors(),next);data=next;}
});

test('PNG paints the same cached sector mask before contours/axes and keeps fill independent of mirror',()=>{
  const {c,nodes}=host(),canvases=canvasHost(c),trace=[],ctx={save(){},restore(){},drawImage(){}};c.st.crossMirror=false;const data=c.paintCrossSectors(ctx,0,0,5);
  Object.assign(c,{playing:false,capturePicture:()=>({width:c.VW,height:c.VH}),paintBitContours:()=>trace.push('contours'),paintTemplate(){},paintGeomCenter(){},viewRotation:{capture:canvas=>canvas},download:(name,blob)=>trace.push(blob.type),fname:()=> 'frame.png'});
  const source=html.slice(html.indexOf("  $('bPng').onclick ="),html.indexOf('  function frameSnapshot()'));vm.runInContext(source,c);nodes.get('bPng').onclick();
  assert.equal(canvases.length,2);assert.strictEqual(canvases[1].calls[0][0],data.canvas);assert.deepEqual(canvases[1].calls[0].slice(1),[0,0,c.VW,c.VH]);assert.deepEqual(trace,['contours','image/png']);
  const png=source.indexOf('paintCrossSectors'),contours=source.indexOf('paintBitContours');assert.ok(png<contours);assert.ok(html.indexOf('paintCrossSectors(symG')<html.indexOf('if(data)paintSymmetry(symG'));
});
