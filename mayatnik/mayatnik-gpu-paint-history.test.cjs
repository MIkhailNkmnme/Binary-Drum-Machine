const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
function fn(name){const a=html.indexOf('function '+name+'('),b=html.indexOf('{',a);assert.ok(a>=0,name);let i=b+1,d=1;for(;d;i++){if(html[i]==='{')d++;if(html[i]==='}')d--;}return html.slice(a,i);}
function fixture(view='bits'){
 const nodes=new Map(),rp=view==='bits'?-1:view==='romb2'?2:view.startsWith('rombJoin')?3:0;
 const c={manualPaintCurrent:()=>null,manualPaintEntryCurrent:()=>false,st:{view,ochki:false},f:{W:29,H:10,val:new Int8Array(290).fill(1)},k:16,VX:5,VW:17,VH:10,RK:rp<0?1:4,RG:rp===2?3:0,geo:{anchor:14},
  img:null,gpuBig:{fresh:true,k:16,cpuRaster:true,cpuLayout:true},fillMask:null,paintBits:null,fillHistory:[],fillRedo:[],fillHistoryBytes:0,gpuPaintRequests:0,templateDragging:false,mirrorLive:false,mirrorApplying:false,templateMatchRevision:0,templateMatchCache:null,
  Uint32Array,Int8Array,window:{},$:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);},rombP:()=>rp,joinedOn:()=>rp===3,manualPaintOn:()=>false,manualMirrorPlan:()=>[],
  g:{createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)})},cv:{width:1,height:1},wrap:{clientWidth:800},wrapPadX:()=>0,fillSync(){},cssLayout(){},savePaint(){},stopFrameTransports(){c.stopped++;},stopped:0};
 c.dispW=()=>rp===2?2*c.VW+c.RG:c.VW;c.dispH=()=>rp===3?2*c.VH:c.VH;c.img=c.g.createImageData(c.dispW()*c.RK,c.dispH()*c.RK);
 vm.createContext(c);vm.runInContext(['gpuCpuOchki','gpuManualCpu','gpuPaintCpu','gpuCpuDisplay','gpuDisplay'].map(name=>html.match(new RegExp('  const '+name+' =[^\\n]+'))[0]).join('\n')+['paintHistoryCurrent','pushHistory','historyStep','canvasSize'].map(fn).join('\n')+';this.cpu=()=>gpuCpuDisplay();this.gpu=()=>gpuDisplay();',c);
 c.draw=()=>{if(c.gpu()||!c.gpuBig.cpuRaster||!c.img)c.canvasSize();};
 c.paint=()=>{const n=c.img.width*c.img.height,indices=Uint32Array.from([0,c.img.width+7,n-1]),previous=new Uint32Array(3),next=Uint32Array.from([0xff123456,0xffabcdef,0xff135790]);c.fillMask=new Uint32Array(n);for(let j=0;j<3;j++)c.fillMask[indices[j]]=next[j];c.pushHistory({indices,previous,next,bytes:36});return c.fillMask.slice();};return c;
}
test('GPU paint Undo then immediate Redo retains exact raster and source across flat, rombs and cropped joined views',()=>{
 for(const view of ['bits','romb0','romb2','rombJoin','rombJoin180']){
  const c=fixture(view),source=c.f.val.slice(),expected=c.paint(),geometry=[c.img.width,c.img.height,c.RK,c.RG],entry=c.fillHistory[0];
  assert.equal(entry.raster.VX,5);assert.equal(entry.raster.VW,17);assert.equal(c.historyStep(false),true);assert.equal(c.fillMask,null);assert.equal(c.cpu(),true,'Redo must keep CPU geometry available');assert.equal(c.fillRedo[0],entry);
  assert.equal(c.historyStep(true),true);assert.deepEqual(c.fillMask,expected,view);assert.deepEqual([c.img.width,c.img.height,c.RK,c.RG],geometry);assert.deepEqual(c.f.val,source);assert.equal(c.fillHistory[0],entry);assert.equal(c.fillRedo.length,0);assert.equal(c.gpuPaintRequests,0);
  for(let j=0;j<3;j++){c.historyStep(false);c.historyStep(true);}assert.deepEqual(c.fillMask,expected);assert.equal(c.fillHistoryBytes,36);
 }
});
test('Redo rebuilds a missing image or stale flat GPU-post image using saved romb dimensions, scale and panel gap',()=>{
 for(const stale of ['missing','flat'])for(const view of ['bits','romb0','romb2','rombJoin180']){
  const c=fixture(view),expected=c.paint(),geometry=[c.img.width,c.img.height,c.RK,c.RG];c.historyStep(false);
  c.img=stale==='missing'?null:c.g.createImageData(c.VW,c.VH);c.RK=1;c.RG=0;c.gpuBig.cpuRaster=false;c.gpuBig.cpuLayout=false;
  assert.equal(c.historyStep(true),true);assert.deepEqual(c.fillMask,expected,view+' '+stale);assert.deepEqual([c.img.width,c.img.height,c.RK,c.RG],geometry);assert.equal(c.gpuBig.cpuRaster,true);
 }
});
test('failed image allocation or changed crop preserves the redo entry and paint until a valid retry',()=>{
 for(const fail of ['allocation','crop','frame']){
  const c=fixture('romb2'),expected=c.paint(),entry=c.fillHistory[0];c.historyStep(false);const bytes=c.fillHistoryBytes;
  if(fail==='allocation'){c.img=null;c.g.createImageData=()=>{throw RangeError('allocation failed');};}else if(fail==='crop')c.VX++;else c.k++;
  assert.equal(c.historyStep(true),false);assert.equal(c.fillMask,null);assert.equal(c.fillRedo[0],entry);assert.equal(c.fillHistory.length,0);assert.equal(c.fillHistoryBytes,bytes);assert.match(c.$('fillInfo').textContent,/История не выполнена/);
  if(fail==='allocation')c.g.createImageData=(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)});else if(fail==='crop')c.VX--;else c.k--;
  assert.equal(c.historyStep(true),true);assert.deepEqual(c.fillMask,expected);assert.equal(c.fillHistory[0],entry);assert.equal(c.fillRedo.length,0);
 }
});
test('a retained redo raster prevents asynchronous flat GPU post from replacing the romb image',async()=>{
 const c=fixture('romb2');c.paint();c.historyStep(false);const image=c.img;c.gpuBig.fld={readPic(){assert.fail('GPU post must not run over retained paint history');}};
 vm.runInContext('async '+fn('gpuPost'),c);await c.gpuPost();assert.equal(c.img,image);assert.equal(c.fillRedo.length,1);
});
test('a failing external action does not pop its history record or decrement history bytes',()=>{
 const c=fixture();const entry={indices:new Uint32Array(),previous:new Uint32Array(),next:new Uint32Array(),bytes:100,external:{apply(){throw Error('failed external restore');}}};c.pushHistory(entry);
 assert.equal(c.historyStep(false),false);assert.equal(c.fillHistory[0],entry);assert.equal(c.fillRedo.length,0);assert.equal(c.fillHistoryBytes,100);
});
test('GPU savePaint explicitly remains session-only and never copies or writes an unsupported field snapshot',()=>{
 const info={},c={gpuBig:{},cacheRestoring:false,templateDragging:false,URL_ON:false,$:()=>info,paintSnapshot(){assert.fail('GPU snapshot must not be copied for unsupported persistence');},MayatnikPaintCache:{write(){assert.fail('GPU snapshot must not be written');}}};
 vm.createContext(c);vm.runInContext(fn('savePaint'),c);c.savePaint();assert.match(info.textContent,/GPU.*текущем сеансе.*PNG/);
});
test('GPU Save All refuses the unsupported work file before snapshot allocation or download',async()=>{
 const nodes=new Map(),c={gpuBig:{},cacheRestoring:false,templateDragging:false,k:1,stop(){},libraryReady:Promise.resolve(),$:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);},paintSnapshot(){assert.fail('unsupported GPU work must not be copied');},download(){assert.fail('unsupported GPU work must not be downloaded');}};
 const start=html.indexOf("  $('bPaintSave').onclick="),end=html.indexOf("  $('bPaintNew').onclick=",start);vm.createContext(c);vm.runInContext(html.slice(start,end),c);await c.$('bPaintSave').onclick();assert.match(c.$('paintCacheInfo').textContent,/GPU.*текущем сеансе.*PNG/);
});
