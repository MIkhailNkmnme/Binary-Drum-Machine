const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Gif=require('./mayatnik-gif.js');
// Independent GIF parser and variable-width LZW decoder, including dictionary
// resets. Checking decoded pixels catches corrupt streams beyond a valid header.
async function decode(blob){
 const b=new Uint8Array(await blob.arrayBuffer()),word=p=>b[p]|b[p+1]<<8;assert.equal(Buffer.from(b.slice(0,6)).toString(),'GIF89a');let p=13,palette=b.slice(p,p+3*(2**((b[10]&7)+1)));p+=palette.length;let delay=0;const frames=[];
 const blocks=()=>{const a=[];while(b[p]){const n=b[p++];a.push(...b.slice(p,p+n));p+=n;}p++;return a;};
 while(p<b.length&&b[p]!==59){const type=b[p++];if(type===33){const extension=b[p++];if(extension===249){assert.equal(b[p++],4);delay=word(p+1)*10;p+=5;}else blocks();continue;}assert.equal(type,44);const width=word(p+4),height=word(p+6),packed=b[p+8];p+=9;if(packed&128)p+=3*2**((packed&7)+1);const minimum=b[p++],data=blocks(),clear=1<<minimum,end=clear+1;let dictionary,bits,position=0,previous=null;const pixels=[];
  function reset(){dictionary=Array.from({length:end+1},(_,i)=>i<clear?[i]:null);bits=minimum+1;previous=null;}reset();
  while(position+bits<=data.length*8){let code=0;for(let i=0;i<bits;i++,position++)code|=((data[position>>3]>>(position&7))&1)<<i;if(code===clear){reset();continue;}if(code===end)break;const entry=dictionary[code]||(code===dictionary.length&&previous?[...previous,previous[0]]:null);assert.ok(entry,'valid LZW dictionary reference');pixels.push(...entry);if(previous){dictionary.push([...previous,entry[0]]);if(dictionary.length===2**bits&&bits<12)bits++;}previous=entry;}
  assert.equal(pixels.length,width*height);frames.push({width,height,delay,pixels:pixels.map(i=>Array.from(palette.slice(i*3,i*3+3)))});
 }assert.equal(b[p],59);return frames;
}
const rgba=(colour,count=1)=>Uint8ClampedArray.from(Array.from({length:count},()=>[...colour,255]).flat());
test('encoder decodes noisy pixels across LZW resets, coalesces equal frames and splits delay overflow',async()=>{
 let seed=1234567;const pixels=Uint8ClampedArray.from({length:128*64*4},(_,i)=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return i%4===3?255:seed&255;});const e=Gif.encoder(128,64);e.add(pixels,10);const out=await decode(e.finish());assert.equal(out.length,1);assert.deepEqual(out[0].pixels,pixels.reduce((a,v,i)=>{if(i%4===0)a.push([Math.round((v>>5)*255/7),Math.round((pixels[i+1]>>5)*255/7),Math.round((pixels[i+2]>>6)*255/3)]);return a;},[]));
 const repeated=Gif.encoder(1,1);repeated.add(rgba([255,0,0]),10);repeated.add(rgba([255,0,0]),25);assert.equal((await decode(repeated.finish()))[0].delay,350);
 const long=Gif.encoder(1,1);long.add(rgba([0,0,0]),65535);long.add(rgba([0,0,0]),1);assert.deepEqual((await decode(long.finish())).map(f=>f.delay),[655350,10]);
});
test('encoder refuses empty and malformed exports before producing a misleading GIF',()=>{for(const [w,h]of [[0,1],[1,0],[65536,1],[1.5,1]])assert.throws(()=>Gif.encoder(w,h));const e=Gif.encoder(1,1);assert.throws(()=>e.finish(),/нет кадров/);assert.throws(()=>e.add(new Uint8Array(3),1),/пиксели/);assert.throws(()=>e.add(rgba([0,0,0]),NaN),/длительность/);});

test('static strip frames decode exactly like GIF images, including palette and coalesced repeats',async()=>{
 const e=Gif.encoder(3,2);assert.throws(()=>e.frame(),/нет кадров/);
 e.add(rgba([147,81,133],6),12);const first=e.frame();e.add(rgba([147,81,133],6),12);const repeated=e.frame();
 e.add(rgba([25,240,57],6),12);const last=e.frame(),animation=await decode(e.finish());
 for(const [blob,index]of [[first,0],[repeated,0],[last,1]]){const frames=await decode(blob);assert.equal(frames.length,1);assert.deepEqual(frames[0].pixels,animation[index].pixels);assert.equal(frames[0].width,3);assert.equal(frames[0].height,2);}
 assert.deepEqual(Buffer.from(await first.arrayBuffer()),Buffer.from(await repeated.arrayBuffer()));assert.equal(animation.length,2);
});
function fixture(){
 let time=0,nextTimer=0,source=rgba([255,0,0]),worker,done=0,errors=0,result,captures=0,captureError=false;const timers=new Map();
 class Worker{constructor(){worker=this;this.messages=[];this.terminated=false;}postMessage(message){this.messages.push(message);}terminate(){this.terminated=true;}respond(){const m=this.messages.shift();assert.ok(m,'pending worker message');if(m.type==='start'){this.encoder=Gif.encoder(m.width,m.height);this.onmessage({data:{ready:true}});}else if(m.type==='frame'){this.encoder.add(m.pixels,m.delay);this.onmessage({data:{ready:true}});}else this.onmessage({data:{blob:this.encoder.finish()}});}}
 let drawn;const g={clearRect(){},drawImage(s){drawn=s;},getImageData:()=>({data:drawn.slice()})};const c={module:{exports:{}},Blob,URL:{createObjectURL:()=>'',revokeObjectURL(){}},Worker,document:{createElement:()=>({getContext:()=>g})},performance:{now:()=>time},setTimeout(fn,ms){const id=++nextTimer;timers.set(id,{fn,due:time+ms});return id;},clearTimeout:id=>timers.delete(id)};vm.createContext(c);vm.runInContext(fs.readFileSync(__dirname+'/mayatnik-gif.js','utf8'),c);
 const job=c.module.exports.record({width:1,height:1,capture(){captures++;if(captureError)throw Error('capture failed');return source;},onDone(blob,info){done++;result={blob,info};},onError(){errors++;}});
 return {job,get worker(){return worker;},get done(){return done;},get errors(){return errors;},get result(){return result;},get captures(){return captures;},set time(v){time=v;},set colour(v){source=rgba(v);},set captureError(v){captureError=v;},tick(){const [id,t]=timers.entries().next().value;timers.delete(id);t.fn();}};
}
test('Stop before worker startup still saves the exact first visible frame once',async()=>{const a=fixture();assert.equal(a.captures,1);a.colour=[0,0,255];a.job.stop();a.job.stop();a.worker.respond();a.worker.respond();a.worker.respond();assert.equal(a.done,1);assert.equal(a.errors,0);const f=await decode(a.result.blob);assert.equal(f.length,1);assert.deepEqual(f[0].pixels,[[255,0,0]]);assert.equal(a.result.info.frames,1);});
test('recorded duration belongs to the displayed frame, including the final interval at Stop',async()=>{const a=fixture();a.worker.respond();a.time=100;a.colour=[0,0,255];a.tick();a.worker.respond();a.time=350;a.colour=[0,255,0];a.tick();a.worker.respond();a.time=430;a.job.stop();a.worker.respond();a.worker.respond();const f=await decode(a.result.blob);assert.deepEqual(f.map(x=>x.delay),[100,250,80]);assert.deepEqual(f.map(x=>x.pixels[0]),[[255,0,0],[0,0,255],[0,255,0]]);assert.equal(a.result.info.frames,3);assert.equal(a.done,1);});
test('Stop waits for the in-flight frame and capture errors close the recorder once',async()=>{const a=fixture();a.worker.respond();a.time=100;a.colour=[0,0,255];a.tick();a.time=180;a.job.stop();a.worker.respond();a.worker.respond();a.worker.respond();assert.deepEqual((await decode(a.result.blob)).map(f=>f.delay),[100,80]);assert.equal(a.captures,2);assert.equal(a.worker.terminated,true);
 const b=fixture();b.worker.respond();b.captureError=true;b.time=100;b.tick();b.job.stop();b.worker.onerror({message:'late error'});assert.equal(b.errors,1);assert.equal(b.done,0);assert.equal(b.worker.terminated,true);
});
test('production Blob worker returns a decodable first frame after immediate Stop',{timeout:10000},async()=>{
 class ThreadWorker{
  constructor(url){this.queue=[];this.closed=false;fetch(url).then(r=>r.text()).then(code=>{if(this.closed)return;const {Worker}=require('node:worker_threads');this.worker=new Worker("const {parentPort}=require('node:worker_threads');globalThis.postMessage=v=>parentPort.postMessage(v);parentPort.on('message',data=>globalThis.onmessage({data}));\n"+code,{eval:true});this.worker.on('message',data=>this.onmessage?.({data}));this.worker.on('error',error=>this.onerror?.(error));for(const args of this.queue)this.worker.postMessage(...args);}).catch(error=>this.onerror?.(error));}
  postMessage(...args){if(this.worker)this.worker.postMessage(...args);else this.queue.push(args);}
  terminate(){this.closed=true;this.worker?.terminate();}
 }
 const pixels=rgba([0,255,0],12),g={clearRect(){},drawImage(){},getImageData:()=>({data:pixels.slice()})},context={module:{exports:{}},Blob,URL,Worker:ThreadWorker,performance,setTimeout,clearTimeout,document:{createElement:()=>({getContext:()=>g})}};vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/mayatnik-gif.js','utf8'),context);
 const result=await new Promise((resolve,reject)=>{const job=context.module.exports.record({width:4,height:3,capture:()=>({}),onDone:(blob,info)=>resolve({blob,info}),onError:reject});job.stop();});const frames=await decode(result.blob);assert.equal(frames.length,1);assert.equal(frames[0].width,4);assert.equal(frames[0].height,3);assert.deepEqual(frames[0].pixels,new Array(12).fill([0,255,0]));assert.equal(result.info.frames,1);if(process.env.GIF_RECORD_SAMPLE)fs.writeFileSync(process.env.GIF_RECORD_SAMPLE,Buffer.from(await result.blob.arrayBuffer()));
});
