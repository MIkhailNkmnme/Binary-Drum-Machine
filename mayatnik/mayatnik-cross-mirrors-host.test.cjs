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
