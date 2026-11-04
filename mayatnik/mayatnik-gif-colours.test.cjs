const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Gif=require('./mayatnik-gif.js'),Scale=require('./mayatnik-gif-scale.js');
const rgba=colours=>Uint8ClampedArray.from(colours.flatMap(c=>[...c,255]));
const rgb=pixels=>Array.from({length:pixels.length/4},(_,i)=>Array.from(pixels.slice(i*4,i*4+3)));

// Independently walk records and decode variable-width LZW. Palette assertions
// inspect actual GIF bytes, not encoder state or another run of the encoder.
async function decode(blob){
 const b=new Uint8Array(await blob.arrayBuffer());let p=13,delay=0;const frames=[];
 assert.equal(Buffer.from(b.slice(0,6)).toString(),'GIF89a');
 const word=i=>b[i]|b[i+1]<<8;
 const table=flags=>{if(!(flags&128))return null;const out=b.slice(p,p+3*2**((flags&7)+1));p+=out.length;return out;};
 const globalPalette=table(b[10]);
 const blocks=()=>{const data=[];while(b[p]){const count=b[p++];data.push(...b.slice(p,p+count));p+=count;}p++;return data;};
 while(b[p]!==59){
  const mark=b[p++];
  if(mark===33){const label=b[p++];if(label===249){assert.equal(b[p++],4);delay=word(p+1);p+=5;}else blocks();continue;}
  assert.equal(mark,44);const width=word(p+4),height=word(p+6),flags=b[p+8];p+=9;
  const palette=table(flags)||globalPalette;assert.ok(palette);
  const minimum=b[p++],data=blocks(),clear=1<<minimum,end=clear+1;let dict,bits,at=0,previous=null,ended=false;const indices=[];
  function reset(){dict=Array.from({length:end+1},(_,i)=>i<clear?[i]:null);bits=minimum+1;previous=null;}reset();
  while(at+bits<=data.length*8){
   let code=0;for(let i=0;i<bits;i++,at++)code|=((data[at>>3]>>(at&7))&1)<<i;
   if(code===clear){reset();continue;}if(code===end){ended=true;break;}
   const entry=dict[code]||(code===dict.length&&previous?[...previous,previous[0]]:null);assert.ok(entry,'valid LZW code');indices.push(...entry);
   if(previous){dict.push([...previous,entry[0]]);if(dict.length===2**bits&&bits<12)bits++;}previous=entry;
  }
  assert.ok(ended);assert.equal(indices.length,width*height);assert.ok(indices.every(i=>i*3+2<palette.length));
  frames.push({width,height,delay,flags,palette,pixels:indices.map(i=>Array.from(palette.slice(i*3,i*3+3)))});delay=0;
 }
 assert.equal(p,b.length-1);return frames;
}

test('every 1..256-colour palette stores original RGB bytes with the smallest local table',async()=>{
 for(const count of [1,2,3,4,8,17,128,129,255,256]){
  const colours=Array.from({length:count},(_,i)=>[i,(i*53+17)&255,(i*97+29)&255]),pixels=rgba(colours),e=Gif.encoder(count,1);e.add(pixels,7);
  const raw=new Uint8Array(await e.finish().arrayBuffer());assert.equal(raw[10]&128,0,'no fixed global palette');
  for(const blob of [e.finish(),e.frame()]){
   const [frame]=await decode(blob);assert.deepEqual(frame.pixels,colours);assert.ok(frame.flags&128);
   assert.equal(frame.palette.length,3*2**Math.max(1,Math.ceil(Math.log2(count))));
   assert.deepEqual(Array.from(frame.palette.slice(0,count*3)),colours.flat());
  }
 }
});

test('different frames may together use more than 256 colours; recoloured index patterns do not merge',async()=>{
 const e=Gif.encoder(16,16),a=rgba(Array.from({length:256},(_,i)=>[i,17,31])),b=rgba(Array.from({length:256},(_,i)=>[i,19,33]));
 e.add(a,11);const first=e.frame();e.add(b,12);const second=e.frame();e.add(b,13);const repeated=e.frame();
 const frames=await decode(e.finish());assert.equal(frames.length,2);assert.deepEqual(frames.map(f=>f.delay),[11,25]);
 assert.deepEqual(frames[0].pixels,rgb(a));assert.deepEqual(frames[1].pixels,rgb(b));
 assert.deepEqual((await decode(first))[0].pixels,rgb(a));assert.deepEqual((await decode(second))[0].pixels,rgb(b));
 assert.deepEqual(Buffer.from(await repeated.arrayBuffer()),Buffer.from(await second.arrayBuffer()));
 if(process.env.GIF_COLOUR_SAMPLE)fs.writeFileSync(process.env.GIF_COLOUR_SAMPLE,Buffer.from(await e.finish().arrayBuffer()));
});

test('257th distinct RGB is an explicit structured failure and cannot corrupt the last valid frame',async()=>{
 const e=Gif.encoder(257,1),valid=rgba(new Array(257).fill([147,81,133]));e.add(valid,9);
 const before=Buffer.from(await e.finish().arrayBuffer()),still=Buffer.from(await e.frame().arrayBuffer());
 const tooMany=rgba(Array.from({length:257},(_,i)=>[i&255,i>>8,113]));
 assert.throws(()=>e.add(tooMany,10),error=>error.code==='GIF_PALETTE_OVERFLOW'&&error.colourCount===257&&/256/.test(error.message));
 assert.deepEqual(Buffer.from(await e.finish().arrayBuffer()),before);assert.deepEqual(Buffer.from(await e.frame().arrayBuffer()),still);
 valid.fill(0);assert.deepEqual((await decode(e.finish()))[0].pixels,new Array(257).fill([147,81,133]));
 const empty=Gif.encoder(257,1);assert.throws(()=>empty.add(tooMany,10));assert.throws(()=>empty.finish(),/нет кадров/);
});

test('retiming preserves local palettes including bytes that look like graphics control markers',async()=>{
 const colours=[[33,249,4],[4,12,0],[0,0,19],[147,81,133]],e=Gif.encoder(4,1);e.add(rgba(colours),12);e.add(rgba(colours.slice().reverse()),12);
 const before=await decode(e.finish()),after=await decode(await Scale.retime(e.finish(),370));
 assert.deepEqual(after.map(f=>f.delay),[37,37]);
 for(let i=0;i<2;i++){assert.deepEqual(after[i].palette,before[i].palette);assert.deepEqual(after[i].pixels,before[i].pixels);}
 const timed=await decode(await Scale.retime(e.frame(),90));assert.equal(timed[0].delay,9);assert.deepEqual(timed[0].pixels,colours.slice().reverse());
});

// Run the actual serialized production worker without a browser or GUI.
class ThreadWorker{
 constructor(url){this.queue=[];this.closed=false;fetch(url).then(r=>r.text()).then(code=>{
  if(this.closed)return;const {Worker}=require('node:worker_threads');this.worker=new Worker("const {parentPort}=require('node:worker_threads');globalThis.postMessage=v=>parentPort.postMessage(v);parentPort.on('message',data=>globalThis.onmessage({data}));\n"+code,{eval:true});
  this.worker.on('message',data=>this.onmessage?.({data}));this.worker.on('error',error=>this.onerror?.(error));for(const args of this.queue)this.worker.postMessage(...args);
 }).catch(error=>this.onerror?.(error));}
 postMessage(...args){if(this.worker)this.worker.postMessage(...args);else this.queue.push(args);}
 terminate(){this.closed=true;this.worker?.terminate();}
}

test('all four production scale workers preserve arbitrary original colours and exact reduction RGB',async()=>{
 globalThis.Worker=ThreadWorker;globalThis.MayatnikGif=Gif;
 const colours=[[147,81,133],[25,240,57],[255,127,39],[13,29,51],[255,255,255],[0,0,0],[23,183,219],[237,17,141]];
 const width=8,height=24,pixels=rgba(Array.from({length:width*height},(_,i)=>colours[(i*13+Math.floor(i/width))%colours.length]));
 const result=await Scale.generateAll({width,height,pixels}).promise;assert.equal(result.variants.length,4);
 for(const variant of result.variants){
  const animation=await decode(variant.blob);assert.deepEqual(animation[0].pixels,rgb(pixels));
  // Animation may coalesce equal frames; static scale images always keep each level.
  for(const frame of variant.frames){
   const expected=Scale.enlarge(Scale.reduce(pixels,width,height,frame.rows,variant.method),width,height),decoded=await decode(frame.blob);
   assert.equal(decoded.length,1);assert.deepEqual(decoded[0].pixels,rgb(expected),variant.method+' '+frame.rows);
  }
 }
});

test('Rombo source RGB survives GIF encoding at every 45-degree turn and both central seams',async()=>{
 const R=require('./mayatnik-rombo.js'),width=9,height=4;
 const colours=[[147,81,133],[25,240,57],[255,127,39],[13,29,51],[255,255,255],[0,0,0],[23,183,219],[237,17,141]];
 const data=rgba(Array.from({length:width*height},(_,q)=>colours[q%colours.length]));
 for(const assembly of R.variants.map(v=>v.id))for(const seam of ['between','dedupe'])for(let angle=0;angle<360;angle+=45){
  const plan=R.plan(width,height,{row:height,angle,assembly,seam},{anchor:4,sides:true}),raster=R.rasterPixels(plan,{width,height,data},2);
  const p=Scale.plan(raster.width,raster.height),pixels=Scale.prepare({pixels:raster.data},p,[0,0,0]),e=Gif.encoder(p.width,p.height);e.add(pixels,10);
  assert.deepEqual((await decode(e.finish()))[0].pixels,rgb(pixels),assembly+' '+seam+' '+angle);
 }
});

function eightColourSource(){
 const colours=[[147,81,133],[25,240,57],[255,127,39],[13,29,51],[255,255,255],[0,0,0],[23,183,219],[237,17,141]],pixels=new Uint8ClampedArray(32*32*4);let seed=1234567;
 for(let i=0;i<pixels.length;i+=4){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;pixels.set([...colours[seed&7],255],i);}
 return {width:32,height:32,pixels};
}

test('eight original colours retain three exact methods when averaging creates over 256 colours',async()=>{
 globalThis.Worker=ThreadWorker;globalThis.MayatnikGif=Gif;
 const source=eightColourSource(),count=pixels=>new Set(rgb(pixels).map(c=>c.join(','))).size;
 assert.equal(count(source.pixels),8);assert.equal(count(Scale.reduce(source.pixels,32,32,24,'average').pixels),523);
 const progress=[],result=await Scale.generateAll(source,{onProgress:p=>progress.push(p)}).promise;
 assert.deepEqual(result.variants.map(v=>v.method),['canvas','nearest','majority']);assert.equal(result.warnings.length,1);
 const warning=result.warnings[0];assert.equal(warning.method,'average');assert.equal(warning.rows,24);assert.equal(warning.code,'GIF_PALETTE_OVERFLOW');assert.equal(warning.colourCount,257);assert.match(warning.message,/256/);
 assert.deepEqual(progress.map(p=>p.done),[...Array.from({length:13},(_,i)=>i+1),16]);assert.ok(progress.every(p=>p.total===16));assert.deepEqual(progress.at(-1).error,warning);
 for(const variant of result.variants){
  assert.deepEqual(variant.frames.map(f=>f.rows),[32,24,16,8]);assert.deepEqual((await decode(variant.blob))[0].pixels,rgb(source.pixels));
  for(const frame of variant.frames){const expected=Scale.enlarge(Scale.reduce(source.pixels,32,32,frame.rows,variant.method),32,32);assert.deepEqual((await decode(frame.blob))[0].pixels,rgb(expected));}
 }
 await assert.rejects(Scale.generate(source,{method:'average'}).promise,error=>error.code==='GIF_PALETTE_OVERFLOW'&&error.colourCount===257&&error.method==='average'&&error.rows===24);
});

test('an original raster over 256 colours rejects the whole batch with structured warnings for all methods',async()=>{
 globalThis.Worker=ThreadWorker;globalThis.MayatnikGif=Gif;
 const source={width:32,height:16,pixels:rgba(Array.from({length:512},(_,i)=>[i%257&255,Math.floor((i%257)/256),113]))},progress=[];
 await assert.rejects(Scale.generateAll(source,{onProgress:p=>progress.push(p)}).promise,error=>{
  assert.equal(error.code,'GIF_PALETTE_OVERFLOW');assert.equal(error.colourCount,257);assert.match(error.message,/Все способы GIF недоступны/);
  assert.deepEqual(error.warnings.map(w=>w.method),['canvas','nearest','majority','average']);assert.ok(error.warnings.every(w=>w.rows===16&&w.code===error.code&&w.colourCount===257));return true;
 });
 assert.deepEqual(progress.map(p=>p.done),[2,4,6,8]);assert.ok(progress.every(p=>p.total===8&&p.error));
 await assert.rejects(Scale.generate(source).promise,error=>error.code==='GIF_PALETTE_OVERFLOW'&&error.colourCount===257&&error.method==='canvas'&&error.rows===16);
});
