const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'Zerkalius-mayatnik.html'),'utf8'),gpu=fs.readFileSync(path.join(__dirname,'mayatnik-gpu.js'),'utf8'),parity=require('../_js/grid-parity.js');
function fn(name,source=html,prefix='function '){const start=source.indexOf(prefix+name+'(');assert.ok(start>=0,name);const brace=source.indexOf('{',start);let depth=1,i=brace+1;for(;depth&&i<source.length;i++){if(source[i]==='{')depth++;else if(source[i]==='}')depth--;}return source.slice(start,i);}
function context(settings={},extra={}){
  const f={W:8,H:4,val:new Int8Array(32).fill(1)},img={width:4,height:4,data:new Uint8ClampedArray(64)};
  const c=vm.createContext({st:{parity:parity.normalize(settings),view:'bits',digitSize:80},k:0,bmGen:0,VX:2,VW:4,VH:4,RK:1,RG:1,geo:{anchor:4},f,img,EMPTY:[0,0,0],rgba:()=>0xff000000,rombP:()=>-1,halfOf:fx=>[-1,fx],joinedOn:()=>false,gpuDisplay:()=>false,contourBits:null,outShow:()=>false,paintBits:null,fillMask:null,templateMatchLayer:null,templateMatchKey:()=>'',faceCurrent:()=>false,MayatnikFaceTransform:{find:()=>-1},ZerkGridParity:parity,TextDecoder,Uint8Array,Int8Array,Int32Array,...extra});
  for(const name of ['parityPlan','parityValues','parityField','rombCell','displayCell','displayPoint','fieldCellAt','paritySourcePixel','parityFillRaster','parityMask','rasterBit'])vm.runInContext(fn(name),c);
  c.parityVisible=(r,col)=>c.parityPlan().visible(r,col,c.VH);c.parityActive=()=>c.parityPlan().active;c.parityRow=r=>c.parityPlan().settings.rowFill==='none'?r:c.parityPlan().sourceRow(r,c.VH);return c;
}
test('all 16 legacy filters preserve exact cropped CPU masks and raw source/paint',()=>{
  const keys=['cellsEven','cellsOdd','rowsEven','rowsOdd'];
  for(let bits=0;bits<16;bits++){
    const settings=Object.fromEntries(keys.map((key,i)=>[key,!!(bits&(1<<i))])),c=context(settings),before=c.f.val.slice(),px=new Uint32Array(16).fill(7);c.fillMask=new Uint32Array(16).fill(11);c.parityMask(px);
    for(let r=0;r<4;r++)for(let x=0;x<4;x++)assert.equal(px[r*4+x],parity.visible(r,x+2,settings)?7:0xff000000);
    assert.deepEqual(c.f.val,before);assert.ok(c.fillMask.every(v=>v===11));
  }
});
test('scaled raster and both diamond lattices use complete logical cells',()=>{
  for(const p of [-1,0,1]){const c=context({rowsOdd:false},{RK:2,rombP:()=>p,img:{width:8,height:8},halfOf:fx=>[p,fx]}),px=new Uint32Array(64).fill(9);c.parityMask(px);
    for(let y=0;y<8;y++)for(let x=0;x<8;x++){const[col,row]=p<0?[2+Math.floor(x/2),Math.floor(y/2)]:c.rombCell((x+.5)/2,(y+.5)/2,p);assert.equal(px[y*8+x],parity.visible(row,col,c.st.parity)?9:0xff000000);}
  }
});
function shaderContext(P){
  const c=vm.createContext({P,select:(a,b,on)=>on?b:a,min:Math.min});
  for(const name of ['pm2','selected','parityRow','parityShown']){
    let src=fn(name,gpu,'fn ').replace(/^fn /,'function ').replace(/:\s*i32/g,'').replace(/\s*->\s*(?:i32|bool)/g,'').replaceAll('((P[3] - 1 - first) / stride)','Math.trunc((P[3] - 1 - first) / stride)').replaceAll('((r - first) / stride)','Math.trunc((r - first) / stride)');vm.runInContext(src,c);
  }return c;
}
test('actual WGSL source-row and visibility functions agree with CPU for deep filters and both fills',()=>{
  for(let seed=0;seed<128;seed++)for(const rowFill of ['none','above','below']){
    const settings={rowsEven:!!(seed&1),rowsOdd:!!(seed&2),cellsEven:!!(seed&4),cellsOdd:!!(seed&8),colsEven:!!(seed&16),colsOdd:!!(seed&32),rowLevels:[{even:!!(seed&64),odd:true}],cellLevels:[{even:false,odd:true},{even:true,odd:false}],rowFill},plan=parity.compile(settings),P=new Int32Array(41);P[3]=7;P.set(plan.gpu(13,7),32);const c=shaderContext(P);
    for(let r=0;r<7;r++){assert.equal(c.parityRow(r),plan.sourceRow(r,7));for(let col=0;col<13;col++)assert.equal(c.parityShown(r,col),plan.visible(r,col,7));}
  }
  assert.match(gpu,/return raw\(source, fc\)/);assert.match(gpu,/outZone\(source, fc\)/);assert.match(gpu,/kind == 7[^\n]+pic2\[source \* VW \+ C\]/);
});
test('nested columns and rows have an exact non-2x2 DOM mask at the crop origin',()=>{
  const {JSDOM}=require('C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom'),dom=new JSDOM('<div class="may-layer-scene"></div><canvas id="colourTemplate"></canvas>'),doc=dom.window.document;
  const c=context({rowsOdd:false,rowLevels:[{even:true,odd:false}],colsOdd:false,colLevels:[{even:true,odd:false}]},{document:doc,ovlDraw:()=>{},rombP:()=>2,dispW:()=>9,dispH:()=>4,scale:()=>8,cv:{getBoundingClientRect:()=>({left:10,top:20})}});
  for(const node of doc.querySelectorAll('*'))node.getBoundingClientRect=()=>({left:0,top:0});for(const name of ['parityOverlayImage','parityOverlayMask'])vm.runInContext(fn(name),c);c.parityOverlayMask();
  const style=doc.querySelector('.may-layer-scene').style,svg=decodeURIComponent(style.getPropertyValue('mask-image'));
  assert.match(svg,/translate\(0 0\)/);assert.match(svg,/translate\(5 0\)/);assert.match(svg,/width="4" height="2" patternUnits/);assert.match(svg,/y="2.5"/);assert.doesNotMatch(svg,/y="0.5" width="4" height="2" fill/);assert.equal(style.getPropertyValue('mask-position'),'10px 20px');assert.equal(style.getPropertyValue('mask-size'),'72px 32px');
  c.parityActive=()=>false;c.parityOverlayMask();assert.equal(style.getPropertyValue('mask-image'),'');dom.window.close();
});
test('hidden hits, edits and face transformations cannot bypass the final visibility mask',()=>{
  const c=context({cellsEven:false},{paintBits:new Int8Array(16).fill(0),faceCurrent:()=>true,faceLayer:{bitsBefore:new Int8Array(16),bits:new Int8Array(16).fill(1)},MayatnikFaceTransform:{find:()=>0}});
  assert.equal(c.fieldCellAt(0,0),null);assert.equal(c.rasterBit(0,0),-1);assert.equal(c.rasterBit(0,0,true),-1);assert.equal(c.fieldCellAt(1,0).c,3);assert.equal(c.rasterBit(1,0),1);
  assert.match(fn('drawPost'),/faceApply\(px\);parityFillRaster\(px\);manualPaintLayerApply\(px\);parityMask\(px\)/);
});
test('fill copies retained row bits and raster colours without changing raw values or stored paint',()=>{
  const c=context({rowsOdd:false,rowFill:'below'});c.f.val.set(Array.from({length:32},(_,q)=>Math.floor(q/8)%2));const before=c.f.val.slice(),px=Uint32Array.from({length:16},(_,q)=>Math.floor(q/4)*10+q%4),original=px.slice();c.contourBits=Int32Array.from({length:16},(_,q)=>Math.floor(q/4)%2);c.parityFillRaster(px);
  assert.deepEqual([...px.slice(0,4)],[...original.slice(4,8)]);assert.deepEqual([...px.slice(8,12)],[...original.slice(12,16)]);assert.equal(c.rasterBit(0,0),1);assert.equal(c.fieldCellAt(0,0).sourceR,1);assert.equal(c.fieldCellAt(0,0).sourceQ,10);assert.equal(c.fieldCellAt(0,0).copied,true);assert.deepEqual(c.f.val,before);assert.ok(c.contourBits.every(v=>v===1));
});
test('source edited bits follow copies and hidden destination edits return after fill is off',()=>{
  const c=context({rowsOdd:false,rowFill:'below'});c.paintBits=new Int8Array(16).fill(-1);c.paintBits[4]=0;assert.equal(c.rasterBit(0,0),0);c.paintBits[0]=1;assert.equal(c.rasterBit(0,0),0);assert.equal(c.rasterBit(0,0,true),1);c.st.parity=parity.normalize();assert.equal(c.rasterBit(0,0),1);
});
test('digitsOnly and text export use the derived filtered values',()=>{
  let labels=0;const g=new Proxy({fillText:()=>labels++},{get:(o,k)=>o[k]||(()=>{})}),rect={left:0,top:0},c=context({cellsOdd:false,rowsOdd:false},{digitsRaf:0,window:{},scale:()=>8,dispW:()=>4,dispH:()=>4,gpuBig:null,cv:{style:{},getBoundingClientRect:()=>rect},gpuCv:null,wrap:{getBoundingClientRect:()=>rect,clientWidth:32,clientHeight:32},digitCanvas:{style:{}},digitG:g,devicePixelRatio:1,digitFamily:()=> 'mono',stolbPaint:null,colReplayPaint:null,ochkiCurrent:()=>null,layerService:()=>{},rombDigits:()=>false});c.st.view='digitsOnly';
  for(const name of ['paintCellDigits','drawDigits','rowsText'])vm.runInContext(fn(name),c);c.drawDigits();assert.equal(labels,4);assert.equal(c.rowsText(),'\n.1.1.1.1\n\n.1.1.1.1\n');
});
test('public parity API persists independent levels and fill, redraws and never rebuilds source',()=>{
  let saves=0,draws=0;const c=context({}, {window:{},save:()=>saves++,queueSession:()=>{},queueDigits:()=>{},dispatchEvent:()=>{},Event:class {},draw:()=>draws++,clearFillPreview:()=>{},parityOverlayMask:()=>{}}),before=c.f.val.slice();vm.runInContext(fn('parityCommit'),c);
  const start=html.indexOf('  window.mayParity={'),end=html.indexOf("  if(!['sides'",start);vm.runInContext(html.slice(start,end),c);const api=c.window.mayParity;
  api.set('rowsEven',false);api.addLevel('rows');api.setLevel('rows',1,'odd',false);api.set('rowFill','above');assert.equal(saves,4);assert.equal(draws,4);assert.equal(api.get().rowLevels[0].odd,false);assert.equal(api.get().rowFill,'above');assert.equal(api.removeLevel('rows',0),false);assert.equal(api.set('wrong',false),false);assert.equal(saves,4);api.removeLevel('rows',1);assert.equal(api.get().rowLevels.length,0);assert.deepEqual(c.f.val,before);
  const detached=api.get();detached.rowsOdd=false;assert.equal(api.get().rowsOdd,true);
});
test('derived buffer invalidates for frame, generation, field and parity but allocates once per draw',()=>{
  const c=context({rowsOdd:false}),first=c.parityValues();assert.equal(c.parityValues(),first);c.bmGen++;assert.notEqual(c.parityValues(),first);const second=c.parityValues();c.st.parity={rowsEven:false};assert.notEqual(c.parityValues(),second);assert.equal(c.parityValues()[0],1);assert.equal(c.f.val[8],1);
});
test('inline and external scripts parse and GPU/CPU final passes stay wired',()=>{
  for(const match of html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);new vm.Script(gpu);new vm.Script(fs.readFileSync(path.join(__dirname,'mayatnik-menu.js'),'utf8'));
  assert.match(html,/parity:st\.parity,contours/);assert.match(fn('templateThirdsSnapshot'),/parityFillRaster\(result\);manualPaintLayerApply\(result,true\);parityMask\(result\)/);assert.match(gpu,/P\.set\(parity\.gpu\(W,o\.VH\),32\)/);
});

test('single diamond uses source bits and never invents paint from its absent opposite lattice',()=>{
  const c=context({rowsOdd:false,rowLevels:[{even:true,odd:false}],cellsEven:false,rowFill:'below'},{RK:2,rombP:()=>0,halfOf:x=>[0,x],img:{width:8,height:8},pxBase:new Uint32Array(64).fill(7)});c.f.val.fill(1);c.f.val.fill(0,24);c.paintBits=new Int8Array(64).fill(1);c.fillMask=new Uint32Array(64).fill(99);const original=c.paintBits.slice(),px=new Uint32Array(64).fill(99);c.contourBits=new Int32Array(64).fill(1);
  assert.equal(c.paritySourcePixel(4,0),-2);assert.equal(c.rasterBit(4,0),0);c.parityFillRaster(px);assert.equal(px[4],7);assert.equal(c.contourBits[4],0);assert.deepEqual(c.paintBits,original);assert.equal(c.fieldCellAt(4,0).sourceR,3);
});
test('lazy and full semantic readers agree with raster bits on copied and edited rows',()=>{
  const c=context({rowsOdd:false,rowFill:'below'},{gpuBig:null,manualPaintKey:()=>'',manualPatternGeometry:()=>'',fillField:null,fillKey:'0:',currentManualMirrorMap:null,manualPaintCellAt:()=>null,pxHidden:()=>false});c.f.val.fill(0);c.f.val.fill(1,8,16);c.fillField=c.f;c.paintBits=new Int8Array(16).fill(-1);c.paintBits[0]=1;c.paintBits[4]=0;
  for(const name of ['visibleSemanticBit','visibleSemanticContext'])vm.runInContext(fn(name),c);
  assert.equal(c.visibleSemanticContext(true).readBit(0,0),0);assert.equal(c.visibleSemanticContext(false).readBit(0,0),0);assert.equal(c.visibleSemanticBit(0),0);assert.equal(c.visibleSemanticContext(true).readBit(1,0),1);assert.equal(c.rasterBit(1,0),1);
});
test('preset snapshots preserve nested parity, fill and columns with independent arrays',()=>{
  const S=require('./mayatnik-settings-library.js'),R=require('./mayatnik-reset-state.js'),settings={colsOdd:false,rowsEven:false,rowLevels:[{even:false,odd:true}],cellLevels:[{even:true,odd:false}],colLevels:[{even:false,odd:true}],rowFill:'above'},snapshot=S.pick({parity:settings}),target={};S.applyState(target,JSON.parse(JSON.stringify(snapshot)));assert.deepEqual(target.parity,parity.normalize(settings));target.parity.rowLevels[0].odd=false;assert.equal(snapshot.parity.rowLevels[0].odd,true);assert.deepEqual(R.defaults().parity,parity.normalize());
});
test('cycle changes both halves atomically including nested levels',()=>{
  let saves=0,draws=0;const c=context({}, {window:{},save:()=>saves++,queueSession:()=>{},queueDigits:()=>{},dispatchEvent:()=>{},Event:class {},draw:()=>draws++,clearFillPreview:()=>{},parityOverlayMask:()=>{}});vm.runInContext(fn('parityCommit'),c);const start=html.indexOf('  window.mayParity={'),end=html.indexOf("  if(!['sides'",start);vm.runInContext(html.slice(start,end),c);const api=c.window.mayParity;
  api.cycle('rows');assert.equal(saves,1);assert.equal(draws,1);assert.equal(api.get().rowsEven,true);assert.equal(api.get().rowsOdd,false);api.cycle('rows');assert.equal(saves,2);assert.equal(api.get().rowsEven,false);assert.equal(api.get().rowsOdd,true);api.addLevel('cells');api.cycle('cells',1);assert.equal(saves,4);assert.equal(api.get().cellLevels[0].even,true);assert.equal(api.get().cellLevels[0].odd,false);assert.equal(api.cycle('rows',99),false);assert.equal(saves,4);
});

test('clipped source diamond pixels do not retain paint from hidden destination rows',()=>{
  const c=context({rowsEven:false,rowLevels:[{even:false,odd:true}],rowFill:'above'},{RK:2,VX:0,VW:8,VH:6,geo:{anchor:0},f:{W:8,H:6,val:new Int8Array(48).fill(1)},img:{width:16,height:12},rombP:()=>0,halfOf:x=>[0,x],pxBase:new Uint32Array(192).fill(10)}),px=new Uint32Array(192).fill(10);
  for(let y=0;y<12;y++)for(let x=0;x<16;x++){const cell=c.displayCell((x+.5)/2,(y+.5)/2);if(cell?.r===2)px[y*16+x]=99;}
  c.parityFillRaster(px);for(let y=0;y<12;y++)for(let x=0;x<16;x++){const cell=c.displayCell((x+.5)/2,(y+.5)/2);if(cell?.r===2)assert.equal(px[y*16+x],10);}
});

test('digits-only paint backgrounds use the copied source row colour',()=>{
  const colours=[],g=new Proxy({fillRect(){colours.push(this.fillStyle);},fillText(){}},{get:(o,k)=>o[k]||(()=>{})}),c=context({rowsOdd:false,rowFill:'below'},{stolbPaint:null,colReplayPaint:null,ochkiCurrent:()=>null,digitFamily:()=> 'mono'});c.fillMask=new Uint32Array(16);c.fillMask[0]=0xffff0000;c.fillMask[4]=0xff0000ff;
  vm.runInContext(fn('paintCellDigits'),c);c.paintCellDigits(g,0,0,20,0,1,0,1,-1,true);assert.deepEqual(colours,['rgb(255,0,0)']);assert.equal(c.fillMask[0],0xffff0000);
});

test('canvas exports mask composed overlays at the field origin without moving their source',()=>{
  let created=0;function canvas(w,h){const node={width:w,height:h,pixels:new Uint8ClampedArray(w*h*4)},g={globalAlpha:1,globalCompositeOperation:'source-over',save(){this.previous=this.globalCompositeOperation;},restore(){this.globalCompositeOperation=this.previous;},setTransform(){},createImageData(w,h){return {width:w,height:h,data:new Uint8ClampedArray(w*h*4)};},putImageData(p){node.pixels=p.data;},drawImage(mask){assert.equal(this.globalCompositeOperation,'destination-in');for(let q=3;q<node.pixels.length;q+=4)node.pixels[q]=Math.round(node.pixels[q]*mask.pixels[q]/255);}};node.getContext=()=>g;return node;}
  const target=canvas(10,10);target.pixels.fill(255);const c=context({rowsOdd:false,colsOdd:false},{document:{createElement(){created++;return canvas(0,0);}}}),before=c.f.val.slice();vm.runInContext(fn('parityExportMask'),c);c.parityExportMask(target,1,1,2);
  for(let y=0;y<10;y++)for(let x=0;x<10;x++){const cell=c.displayCell((x+.5-1)/2,(y+.5-1)/2),on=cell&&c.parityVisible(cell.r,cell.c);assert.equal(target.pixels[(y*10+x)*4+3],on?255:0);}
  c.parityExportMask(target,1,1,2);assert.equal(created,1);assert.deepEqual(c.f.val,before);assert.equal(target.getContext().globalCompositeOperation,'source-over');
  assert.match(fn('gifViewFrame'),/parityExportMask\(c,fieldRect.left-L,fieldRect.top-T,scale\(\)\)/);assert.match(fn('frameSnapshot'),/paintTemplate\(pg,0,0,RK\);parityExportMask\(picture\)/);assert.match(fn('wholeFrameThumbnail'),/parityExportMask\(c,-B.left\*ratio,-B.top\*ratio,ratio\)/);
});
