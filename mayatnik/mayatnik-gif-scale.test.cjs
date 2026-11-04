const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const S=require('./mayatnik-gif-scale.js'),Gif=require('./mayatnik-gif.js');
const rgba=values=>Uint8ClampedArray.from(values.flatMap(v=>[v,v,v,255]));

test('default canvas reduction matches physical viewport pixel centres without stretching rounded width',()=>{
 const Host=require('./mayatnik-pixel-exact-host.js');
 for(const width of [1,7,19,40])for(const height of [8,16,24,40])for(const rows of [8,16,24].filter(n=>n<=height)){
  const pixels=Uint8ClampedArray.from({length:width*height*4},(_,i)=>i%4===3?255:(i*29)%256),small=S.reduce(pixels,width,height,rows),screen=Host.sampleViewport({width,height,data:pixels},small.width,rows,{scale:rows/height});
  for(let q=3;q<screen.data.length;q+=4)screen.data[q]=255;
  assert.deepEqual(small.pixels,screen.data);assert.equal(small.width,Math.ceil(width*rows/height));
 }
 const pixels=rgba(Array.from({length:7*24},(_,i)=>i%7*30)),canvas=S.reduce(pixels,7,24,8),legacy=S.reduce(pixels,7,24,8,'nearest');
 assert.equal(canvas.width,3);assert.equal(legacy.width,2);assert.deepEqual([...canvas.pixels.slice(0,12)],[30,30,30,255,120,120,120,255,0,0,0,255]);
});

test('canvas is the initial UI choice while every legacy reduction stays available',()=>{
 const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8'),select=html.match(/<select id="gifScaleMethod"[\s\S]*?<\/select>/)[0];
 assert.match(select,/<option value="canvas" selected>Как на холсте/);for(const value of ['nearest','average'])assert.ok(select.includes('value="'+value+'"'));assert.ok(!select.includes('value="majority"'));
});
test('levels start at full 1:1 and descend to 8 rows, including non-power-of-two sources',()=>{
 const a=S.plan(2047,1024);assert.equal(a.levels.length,128);assert.deepEqual(a.levels.slice(0,4),[1024,1016,1008,1000]);assert.equal(a.levels.at(-1),8);assert.equal(a.padded,0);
 assert.deepEqual(S.plan(2047,1024,'powers2').levels,[1024,512,256,128,64,32,16,8]);assert.equal(S.plan(37,1019).height,1024);assert.equal(S.plan(37,1019).padded,5);assert.equal(S.plan(3,1).height,8);assert.equal(S.plan(3,1000,'powers2').levels[0],1000);
});
test('padding uses background, alpha composites once, source remains byte-identical',()=>{const source={width:1,height:1,pixels:Uint8ClampedArray.of(200,100,0,128)},before=source.pixels.slice(),p=S.plan(1,1),out=S.prepare(source,p,[10,20,30]);assert.deepEqual([...out.slice(0,4)],[105,60,15,255]);assert.deepEqual([...out.slice(-4)],[10,20,30,255]);assert.deepEqual(source.pixels,before);});
test('nearest, area majority and mean produce distinct expected reductions',()=>{const pixels=rgba([255,0,255,0,0,255,0,0,0]);assert.equal(S.reduce(pixels,3,3,1,'nearest').pixels[0],0);assert.equal(S.reduce(pixels,3,3,1,'majority').pixels[0],0);assert.equal(S.reduce(pixels,3,3,1,'average').pixels[0],85);const different=rgba([0,0,0,0,255,0,0,0,0]);assert.equal(S.reduce(different,3,3,1,'nearest').pixels[0],255);assert.equal(S.reduce(different,3,3,1,'majority').pixels[0],0);});
test('fractional edge areas are weighted rather than discarded; majority ties choose center colour',()=>{const source=rgba([0,100,200]);const reduced=S.reduce(source,1,3,2,'average');assert.deepEqual([...reduced.pixels.filter((_,i)=>i%4===0)],[33,167]);assert.equal(S.reduce(rgba([0,255]),2,1,1,'majority').width,2);assert.equal(S.reduce(rgba([0,255,0,255]),2,2,1,'majority').pixels[0],255);});
test('enlargement makes hard pixel blocks and final full-size level is unchanged in every method',()=>{const small={width:2,height:1,pixels:rgba([0,255])},out=S.enlarge(small,8,4);assert.deepEqual([...out.slice(0,32).filter((_,i)=>i%4===0)],[0,0,0,0,255,255,255,255]);for(const method of ['nearest','majority','average']){const pixels=rgba(Array.from({length:32},(_,i)=>i*7));assert.deepEqual(S.enlarge(S.reduce(pixels,4,8,8,method),4,8),pixels);}});

test('scale presentation centers the reduced raster at 1:1 with untouched colours and opaque background',()=>{
 const small={width:2,height:1,pixels:Uint8ClampedArray.of(255,0,0,255,0,255,0,255)},before=small.pixels.slice(),out=S.center(small,7,5,[0,0,255]);
 assert.equal(out.length,7*5*4);for(let y=0;y<5;y++)for(let x=0;x<7;x++)assert.deepEqual([...out.slice((y*7+x)*4,(y*7+x+1)*4)],y===2&&x===2?[255,0,0,255]:y===2&&x===3?[0,255,0,255]:[0,0,255,255]);assert.deepEqual(small.pixels,before);
 const pixels=rgba(Array.from({length:128},(_,i)=>i)),p={width:8,height:16};for(const method of ['canvas','nearest','majority','average'])assert.deepEqual(S.center(S.reduce(pixels,8,16,16,method),p.width,p.height),pixels);
 const white=rgba(new Array(128).fill(255)),low=S.reduce(white,8,16,8),centered=S.center(low,8,16,[0,0,255]),blocks=S.enlarge(low,8,16);assert.equal([...centered].filter((_,i)=>i%4===0&&centered[i]===255).length,32);assert.equal([...blocks].filter((_,i)=>i%4===0&&blocks[i]===255).length,128);
 assert.throws(()=>S.center(small,1,1),/размер/);assert.throws(()=>S.center({...small,pixels:new Uint8ClampedArray(0)},7,5),/размер/);
});

test('presentation validation rejects unknown values and defaults to the full-size figure view',()=>{
 const source={width:8,height:16,pixels:rgba(new Array(128).fill(255))};for(const presentation of ['unknown','',null,0])assert.throws(()=>S.validate(source,{presentation}),/вид GIF/);
 for(const presentation of ['scale','pixels'])assert.equal(S.validate(source,{presentation}).levels[0],16);
});
test('preflight rejects malformed input and huge work without silently changing output dimensions',()=>{assert.throws(()=>S.plan(0,1),/размер/);assert.throws(()=>S.plan(1,1,'bad'),/последовательность/);assert.throws(()=>S.validate({width:8,height:8,pixels:rgba([0])}),/повреждены/);assert.throws(()=>S.validate({width:4096,height:2048,pixels:{length:4096*2048*4}}),/степени/);assert.equal(S.validate({width:4096,height:2048,pixels:{length:4096*2048*4}},{sequence:'powers2'}).height,2048);});
// Execute the production Blob worker in a real Node worker thread; no browser.
class ThreadWorker{
 constructor(url,transform=code=>code){this.queue=[];this.closed=false;this.ready=fetch(url).then(r=>r.text()).then(code=>{if(this.closed)return;const {Worker}=require('node:worker_threads');this.worker=new Worker("const {parentPort}=require('node:worker_threads');globalThis.postMessage=v=>parentPort.postMessage(v);parentPort.on('message',data=>globalThis.onmessage({data}));\n"+transform(code),{eval:true});this.worker.on('message',data=>this.onmessage?.({data}));this.worker.on('error',error=>this.onerror?.(error));for(const args of this.queue)this.worker.postMessage(...args);}).catch(error=>this.onerror?.(error));}
 postMessage(...args){if(this.worker)this.worker.postMessage(...args);else this.queue.push(args);}
 terminate(){this.closed=true;this.worker?.terminate();}
}
test('real background worker exports constant-size GIF, ordered levels and owns its pixel copy',async()=>{globalThis.Worker=ThreadWorker;globalThis.MayatnikGif=Gif;const width=32,height=19,pixels=rgba(Array.from({length:width*height},(_,i)=>(i*39)%256)),before=pixels.slice(),progress=[];const job=S.generate({width,height,pixels},{method:'average',delay:120,onProgress:p=>progress.push(p.rows)});const result=await job.promise,bytes=Buffer.from(await result.blob.arrayBuffer());assert.equal(bytes.subarray(0,6).toString(),'GIF89a');assert.equal(bytes.readUInt16LE(6),32);assert.equal(bytes.readUInt16LE(8),24);assert.equal(bytes.at(-1),59);assert.deepEqual(progress,[24,16,8]);assert.equal(result.delay,120);assert.deepEqual(result.frames.map(f=>f.rows),[24,16,8]);for(const f of result.frames){const b=Buffer.from(await f.blob.arrayBuffer());assert.equal(b.subarray(0,6).toString(),'GIF89a');assert.equal(b.readUInt16LE(6),32);assert.equal(b.readUInt16LE(8),24);assert.equal(b.at(-1),59);}assert.deepEqual(pixels,before);assert.equal(pixels.byteLength,width*height*4);if(process.env.GIF_SCALE_SAMPLE)fs.writeFileSync(process.env.GIF_SCALE_SAMPLE,bytes);});

test('real worker encodes both presentation modes exactly, starts with the native frame and ignores later caller mutations',async()=>{
 globalThis.Worker=ThreadWorker;globalThis.MayatnikGif=Gif;
 for(const presentation of ['scale','pixels']){
  const pixels=rgba(new Array(128).fill(255)),before=pixels.slice(),source={width:8,height:16,pixels},background=[0,0,255],job=S.generate(source,{presentation,background,delay:100});pixels.fill(0);
  const result=await job.promise;assert.equal(job.presentation,presentation);assert.equal(result.presentation,presentation);assert.deepEqual(result.frames.map(frame=>frame.rows),[16,8]);
  const prepared=S.prepare({...source,pixels:before},result.plan,background),expected=Gif.encoder(8,16);
  for(let i=0;i<result.frames.length;i++){
   const small=S.reduce(prepared,8,16,result.frames[i].rows),image=presentation==='scale'?S.center(small,8,16,background):S.enlarge(small,8,16);if(i===0)assert.deepEqual(image,before);
   expected.add(image,10);assert.deepEqual(Buffer.from(await result.frames[i].blob.arrayBuffer()),Buffer.from(await expected.frame().arrayBuffer()));
  }
  assert.deepEqual(Buffer.from(await result.blob.arrayBuffer()),Buffer.from(await expected.finish().arrayBuffer()));assert.equal(pixels.byteLength,before.byteLength);
 }
});
test('cancel terminates worker and rejects once without a partial download',async()=>{globalThis.Worker=ThreadWorker;globalThis.MayatnikGif=Gif;const job=S.generate({width:16,height:16,pixels:rgba(new Array(256).fill(127))});job.cancel();job.cancel();await assert.rejects(job.promise,{name:'AbortError'});});
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');function fn(name){const a=html.indexOf('function '+name+'('),b=html.indexOf('{',a);let depth=1,i=b+1;for(;depth;i++){if(html[i]==='{')depth++;if(html[i]==='}')depth--;}return html.slice(a,i);}
test('host captures complete offscreen raster at one pixel per row and preserves live pixels',()=>{let result;const src={width:4,height:2,data:rgba([0,10,20,30,40,50,60,70])},c=vm.createContext({st:{edgeRhombOn:false},gpuBig:null,f:{},img:src,framePreviewBounds:()=>({left:0,top:0,width:4,height:2,layers:[]}),document:{createElement:()=>({getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:im=>result=im.data,getImageData:()=>({data:result}),drawImage(){}})})},pxView:()=>src,capturePicture:()=>src,paintBitContours(){},window:{},dispW:()=>4,dispH:()=>2,VH:2,RK:1,visibleSemanticBit:q=>q%3===0?-1:q%2});vm.runInContext(fn('gifScaleBitAt')+fn('captureScaleGifFrame'),c);const out=c.captureScaleGifFrame();assert.equal(out.width,4);assert.equal(out.height,2);assert.deepEqual(out.pixels,src.data);assert.notEqual(out.pixels,src.data);assert.deepEqual([...out.bits],[-1,1,0,-1,0,1,-1,1]);c.gpuBig={};assert.throws(()=>c.captureScaleGifFrame(),/процессора/);});
const begin=html.indexOf('  let gifScaleJob='),end=html.indexOf('  let gifRecording=null;',begin);
test('worker uses canvas and full-size figure presentation by default and returns each exact static scale frame',async()=>{globalThis.Worker=ThreadWorker;globalThis.MayatnikGif=Gif;const result=await S.generate({width:7,height:24,pixels:rgba(Array.from({length:168},(_,i)=>i%7*30))}).promise;assert.equal(result.method,'canvas');assert.equal(result.presentation,'pixels');assert.deepEqual(result.frames.map(f=>f.rows),[24,16,8]);assert.equal(result.frames.length,3);});

test('semantic sampling follows the selected source index or contributing colours, never the output RGB',()=>{
 const pixels=rgba(Array.from({length:7*24},(_,i)=>(i%7)*30));
 const bits=Int8Array.from({length:7*24},(_,i)=>(i%7===4||i%7===1)?1:0);
 assert.deepEqual([...S.reduce(pixels,7,24,8,'canvas',bits).bits.slice(0,3)],[1,1,-1]); // Last centre is outside.
 assert.deepEqual([...S.reduce(pixels,7,24,8,'nearest',bits).bits.slice(0,2)],[1,0]);
 const four=rgba([220,220,220,15]),cell=(method,values,data=four)=>S.reduce(data,2,2,1,method,Int8Array.from(values)).bits[0];
 assert.equal(cell('majority',[0,0,0,1]),0);
 assert.equal(cell('majority',[0,1,0,1]),-2); // Winning colour carries two different bits.
 assert.equal(cell('majority',[-1,-1,-1,1]),-1);
 assert.equal(cell('majority',[1,1,0,0],rgba([220,220,15,15])),0); // Tied area uses centre colour.
 assert.equal(cell('average',[1,1,1,1]),1); // Different colours can still have the very same bit.
 for(const values of [[1,1,1,0],[-1,-1,-1,1],[-2,-2,-2,-2]])assert.equal(cell('average',values),-2);
 assert.deepEqual([...S.reduce(rgba([1,2,3]),1,3,2,'average',Int8Array.of(0,0,1)).bits],[0,-2]);
});
test('aggregate preflight bounds computation and map memory, and rejects malformed semantic values',()=>{
 const mock=(width,height)=>({width,height,pixels:{length:width*height*4}});
 assert.throws(()=>S.plan(1,Number.MAX_SAFE_INTEGER),/предел GIF/);
 // The four-method batch fits where the former eight-animation batch did not.
 assert.equal(S.validateAll(mock(1024,1024)).height,1024);
 assert.throws(()=>S.validateAll(mock(2047,1024)),/четырёх/);
 assert.equal(S.validateAll(mock(2047,1024),{sequence:'powers2'}).height,1024);
 assert.throws(()=>S.validateAll(mock(65535,240),{sequence:'powers2'}),/не хватит памяти/);
 const large=mock(65535,184);assert.throws(()=>S.validateAll({...large,bits:new Int8Array(large.width*large.height)},{sequence:'powers2'}),/не хватит памяти/);
 for(const bits of [Int8Array.of(0),new Uint8Array(8),Int8Array.of(0,1,0,1,0,1,-2,2)])assert.throws(()=>S.validateAll({...mock(1,8),bits}),/бит/);
});
test('one real worker creates only three full-frame animations with exact pixels and semantic cells, without scale work',async()=>{
 let workers=0;globalThis.Worker=class extends ThreadWorker{
  constructor(url){super(url,code=>code+'\ncenter=()=>{throw Error("Batch must not render scale presentation");};');workers++;}
  postMessage(message,...rest){assert.deepEqual(message.presentations,['pixels']);assert.deepEqual(message.methods,['canvas','nearest','average']);super.postMessage(message,...rest);}
 };globalThis.MayatnikGif=Gif;
 const width=7,height=19,pixels=rgba(Array.from({length:width*height},(_,i)=>i%5*60)),bits=Int8Array.from({length:width*height},(_,i)=>i%4-2);
 const original=pixels.slice(),native=bits.slice(),progress=[],background=[15,30,40];
 const job=S.generateAll({width,height,pixels,bits},{presentation:'scale',delay:110,background,onProgress:p=>progress.push(p)});pixels.fill(255);bits.fill(0);background.fill(0);
 const {variants,plan}=await job.promise;assert.equal(workers,1);assert.equal(variants.length,3);
 assert.deepEqual(variants.map(v=>v.id),['canvas-pixels','nearest-pixels','average-pixels']);
 assert.deepEqual(progress.map(p=>p.done),Array.from({length:9},(_,i)=>i+1));assert.ok(progress.every(p=>p.total===9&&p.presentation==='pixels'));
 const source=S.prepare({pixels:original},plan,[15,30,40]),padded=new Int8Array(width*24).fill(-1);padded.set(native);
 for(let i=0;i<3;i++){
  const v=variants[i],expected=Gif.encoder(width,24);assert.equal(v.presentation,'pixels');assert.equal(v.delay,110);assert.deepEqual(v.frames.map(f=>f.rows),[24,16,8]);assert.deepEqual(v.frames[0].semantic.bits,padded);
  for(let n=0;n<v.frames.length;n++){
   const {rows,semantic,blob}=v.frames[n],small=S.reduce(source,width,24,rows,v.method,padded);
   assert.deepEqual(semantic.bits,small.bits);
   assert.deepEqual(semantic.bounds,{left:0,top:0,width,height:24});
   assert.deepEqual([semantic.width,semantic.height],[small.width,rows]);
   expected.add(S.enlarge(small,width,24),11);
   assert.deepEqual(Buffer.from(await blob.arrayBuffer()),Buffer.from(await expected.frame().arrayBuffer()));
  }
  assert.deepEqual(Buffer.from(await v.blob.arrayBuffer()),Buffer.from(await expected.finish().arrayBuffer()));
 }
});
test('cancelling a batch after receiving its first level rejects once; a batch without semantic input has no digit grids',async()=>{
 globalThis.Worker=ThreadWorker;globalThis.MayatnikGif=Gif;
 const source={width:2,height:16,pixels:rgba(new Array(32).fill(0))};
 const prior=await S.generateAll(source).promise;assert.ok(prior.variants.every(v=>v.frames.every(f=>f.semantic===null)));
 const progress=[];const next=S.generateAll(source,{onProgress:p=>{progress.push(p.done);next.cancel();}});
 await assert.rejects(next.promise,{name:'AbortError'});next.cancel();assert.deepEqual(progress,[1]);assert.equal(prior.variants.length,3);
});
test('retime edits only real control delays, skips a false control inside image data and rejects truncated records',async()=>{
 const make=t=>{const gif=Gif.encoder(2,2);gif.add(rgba([255,0,0,255]),t);gif.add(rgba([0,255,255,0]),t);return gif.finish();};
 async function withExtraPayload(blob){const raw=Buffer.from(await blob.arrayBuffer());assert.deepEqual([...raw.slice(-2)],[0,59]);return new Blob([raw.subarray(0,-2),Uint8Array.of(8,33,249,4,4,12,0,0,0),raw.slice(-2)]);}
 const original=await withExtraPayload(make(12)),before=Buffer.from(await original.arrayBuffer());
 const updated=await S.retime(original,397);assert.deepEqual(Buffer.from(await updated.arrayBuffer()),Buffer.from(await (await withExtraPayload(make(40))).arrayBuffer()));
 assert.deepEqual(Buffer.from(await original.arrayBuffer()),before);for(const v of [before.subarray(0,-1),Buffer.from([1,2,3]),Buffer.concat([before,Buffer.from([0])])])await assert.rejects(S.retime(new Blob([v]),99),/структура GIF/);
 // A valid 1x1 GIF87a with no controls gains its first actual timed control.
 const still=Buffer.from('47494638376101000100800000000000ffffff2c00000000010001000002024401003b','hex');
 const timed=Buffer.from(await (await S.retime(new Blob([still]),80)).arrayBuffer());
 assert.equal(timed.subarray(0,6).toString(),'GIF89a');assert.deepEqual([...timed.subarray(19,27)],[33,249,4,0,8,0,0,0]);assert.deepEqual(timed.subarray(27),still.subarray(19));
});
test('retime preserves logical steps hidden in identical GIF frames, even beyond one control delay',async()=>{
 globalThis.Worker=ThreadWorker;globalThis.MayatnikGif=Gif;
 const n=1056,job=S.generate({width:1,height:n,pixels:rgba(new Array(n).fill(0))},{delay:20}),result=await job.promise;
 assert.equal(result.frames.length,132);
 const slow=await S.retime(result.blob,5000),expect=Gif.encoder(1,n),raster=rgba(new Array(n).fill(0));for(let i=0;i<132;i++)expect.add(raster,500);
 assert.deepEqual(Buffer.from(await slow.arrayBuffer()),Buffer.from(await expect.finish().arrayBuffer()));
});

test('Rombo GIF digit provenance matches the exact independent raster at every turn and central seam',()=>{const R=require('./mayatnik-rombo.js'),W=9,H=4,bits=Int8Array.from({length:W*H},(_,q)=>q%3-1),data=Uint8ClampedArray.from(Array.from(bits,v=>[v+1,0,0,255]).flat());for(const assembly of R.variants.map(v=>v.id))for(const seam of ['between','dedupe'])for(let angle=0;angle<360;angle+=45){const p=R.plan(W,H,{row:H,angle,assembly,seam},{anchor:4,sides:true}),ratio=2,expected=R.rasterPixels(p,{width:W,height:H,data},ratio),canvas={width:expected.width,height:expected.height,getContext:()=>({getImageData:()=>({data:expected.data})})},c=vm.createContext({st:{edgeRhombOn:true},gpuBig:null,img:{width:W,height:H},RK:1,dispW:()=>W,dispH:()=>H,visibleSemanticBit:q=>bits[q],window:{mayRombo:{capture:()=>canvas,plan:()=>p},mayPixelExact:{exportScale:()=>ratio}}});vm.runInContext(fn('gifScaleBitAt')+fn('captureScaleGifFrame'),c);const result=c.captureScaleGifFrame();assert.deepEqual([...result.bits],Array.from({length:result.bits.length},(_,q)=>expected.data[q*4]-1),assembly+' '+seam+' '+angle);}});

test('custom stack heights retain their exact sequence and reject sub-eight levels',()=>{
 const source={width:19,height:35,pixels:rgba(Array.from({length:19*35},()=>0))};
 const p=S.validateAll(source,{sequence:'custom',levels:[35,27,19,11,8]});assert.equal(p.height,35);assert.equal(p.padded,0);assert.deepEqual(p.levels,[35,27,19,11,8]);
 for(const levels of [[35,1],[35,8,16],[34,8],[35,8,8]])assert.throws(()=>S.validateAll(source,{levels}));
});
