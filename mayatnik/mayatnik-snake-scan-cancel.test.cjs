const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const Host=require(process.env.SNAKE_AUDIT_HOST||'./mayatnik-snake-scan-host.js');
const source=process.env.SNAKE_AUDIT_DEPS||(fs.existsSync(path.join(__dirname,'mayatnik-snake-scan.js'))?__dirname:path.join(__dirname,'../codex-mayatnik-652-fullscan'));
const Scan=require(path.join(source,'mayatnik-snake-scan.js'));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const within=async promise=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('parent scan stayed pending after iframe removal')),250);})]);}finally{clearTimeout(timer);}};

for(const stage of ['load','acquire'])test('pause settles a removed child '+stage+' timer; resume completes without late publication',async()=>{
  let notify,entered=new Promise(resolve=>notify=resolve),block=true,lateResolve,lateReleases=0;
  const frames=[],jobs=new Map(),saved=new Map(),writes=[];
  const result=()=>({nodes:[{x:0,y:0,bit:1,edges:[]}],frameSnapshot:{blob:new Blob(['exact'])},release(){lateReleases++;}});
  const root={location:{href:'https://example.test/mayatnik/page.html'},innerWidth:800,innerHeight:600,setTimeout,
    document:{body:{append:frame=>frames.push(frame)},createElement(){
      const frame={style:{},setAttribute(){},remove(){this.removed=true;clearTimeout(this.timer);}};
      const defer=()=>new Promise(resolve=>{lateResolve=resolve;frame.timer=setTimeout(()=>resolve(stage==='acquire'?result():undefined),10000);notify();});
      frame.contentWindow={maySnakeScanLocal:{ready:()=>true,load:()=>stage==='load'&&block?defer():Promise.resolve(),acquire:()=>stage==='acquire'&&block?defer():Promise.resolve(result())}};
      return frame;
    }}};
  const host=Host.create({captureRun:async()=>({total:1,sequence:['1']})},{root});host.worker=false;
  const log={putScanJob:async job=>jobs.set(job.id,structuredClone(job)),getScanJob:async id=>structuredClone(jobs.get(id)),readScanFrame:async(id,frame)=>saved.get(id+':'+frame),commitScanFrame:async(job,catalog,snapshot)=>{writes.push(catalog.frame);saved.set(job.id+':'+catalog.frame,{catalog,snapshot});}};
  const scan=Scan.create(host,log),running=scan.start();await entered;scan.pause();host.cancel();
  const paused=await within(running);assert.equal(paused.status,'paused');assert.equal(scan.get().busy,false);assert.equal(paused.next,0);assert.equal(frames[0].removed,true);assert.deepEqual(writes,[]);
  block=false;const resumed=await within(scan.resume(paused.id));assert.equal(resumed.complete,true);assert.equal(scan.get().busy,false);assert.deepEqual(writes,[0]);
  const before=lateReleases;lateResolve(stage==='acquire'?result():undefined);await delay(5);assert.deepEqual(writes,[0]);if(stage==='acquire')assert.equal(lateReleases,before+1);
});

test('parent cancellation during child polling settles and removes the frame',async()=>{
  const frames=[],root={location:{href:'https://example.test/'},innerWidth:8,innerHeight:8,setTimeout,document:{body:{append:f=>frames.push(f)},createElement:()=>({style:{},setAttribute(){},remove(){this.removed=true;},contentWindow:{}})}};
  const host=Host.create({}, {root}),waiting=host.begin({id:'j'});host.cancel();await assert.rejects(within(waiting),/отменён/);assert.equal(frames[0].removed,true);
});

for(const failure of ['close','origin','timeout'])test('CPU open parent guard survives pending child restore: '+failure,async()=>{
  let lateResolve,calls=0,successes=0;
  const opened={closed:false,location:{href:'https://example.test/child',origin:'https://example.test'},maySnakeScanLocal:{ready:()=>true,openSaved(){calls++;return new Promise(resolve=>lateResolve=resolve);}}};
  const root={setTimeout},ticket={window:opened,origin:'https://example.test',token:'t'};
  const delivery=Host.deliverOpen(ticket,{}, {},{root,timeout:40}).then(value=>{successes++;return value;});
  await delay(5);if(failure==='close')opened.closed=true;if(failure==='origin')opened.location.origin='https://other.test';
  await assert.rejects(within(delivery),failure==='close'?/Окно кадра закрыто/:failure==='origin'?/Адрес окна кадра изменился/:/не завершило открытие/);
  assert.equal(calls,1);lateResolve();await delay(5);assert.equal(successes,0);
});

test('CPU open readiness polling stops when its window closes',async()=>{
  let polls=0;const opened={closed:false,location:{href:'https://example.test/child',origin:'https://example.test'},maySnakeScanLocal:{ready(){polls++;return false;}}};
  const delivery=Host.deliverOpen({window:opened,origin:'https://example.test'}, {}, {}, {root:{setTimeout},timeout:100});await delay(5);opened.closed=true;
  await assert.rejects(within(delivery),/Окно кадра закрыто/);const stopped=polls;await delay(30);assert.equal(polls,stopped);
});
