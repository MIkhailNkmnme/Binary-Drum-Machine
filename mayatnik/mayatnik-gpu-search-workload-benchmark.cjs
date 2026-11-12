/* МАЯ-660. Real-adapter baseline and exact-search benchmark; no software GPU. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process'),crypto=require('node:crypto');
const playwright=process.env.PLAYWRIGHT_PATH||path.join(process.env.LOCALAPPDATA,'Temp/mayatnik-benchmark-657/node_modules/playwright-core');
const {chromium}=require(playwright);
const root=path.resolve(__dirname,'..'),baseline='d50855ff',out=path.join(__dirname,'benchmark-660');
fs.mkdirSync(out,{recursive:true});
const pinned=new Map();
function source(name,old){if(!old)return fs.readFileSync(path.join(root,name));if(!pinned.has(name))pinned.set(name,cp.execFileSync('git',['show',baseline+':'+name],{cwd:root,maxBuffer:32*1024*1024}));return pinned.get(name);}
const server=http.createServer((req,res)=>{try{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),old=pathname.startsWith('/baseline/'),name=pathname.replace(/^\/(baseline|current)\//,'');
 if(pathname==='/favicon.ico'){res.writeHead(204).end();return;}
 if(name==='mayatnik/runner.html'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>МАЯ-657 measurement</title>'+'<script src="mayatnik-gpu-search.js"></script>'+ '<script src="mayatnik-core.js"></script><script src="mayatnik-gpu.js"></script><script src="mayatnik-large-search-host.js"></script><script src="mayatnik-large-search.js"></script>');return;}
 if(!name.startsWith('mayatnik/')||name.includes('..'))throw Error('path');
 let content=source(name,old);
 res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':'text/plain');res.end(content);
 }catch(e){res.writeHead(404).end(String(e));}});
async function main(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-webgpu','--disable-background-timer-throttling']});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.error(m.text());});
 await page.exposeFunction('benchProgress',v=>console.log(JSON.stringify(v)));
 try{
 const mode=process.argv[2]||'baseline',old=mode==='baseline';
 await page.goto(`http://127.0.0.1:${server.address().port}/${old?'baseline':'current'}/mayatnik/runner.html?height=${process.env.BENCH_HEIGHT||16384}`);
 if(mode==='parity'){
  const parityInput=JSON.parse(fs.readFileSync(path.join(out,'queries.json'),'utf8'));
  const report=await page.evaluate(async(randomRows)=>{
   const gpu=await MayatnikGPU.create(),adapter=gpu.adapter;gpu.device.addEventListener('uncapturederror',e=>console.error(e.error.message));
   const makeShader=gpu.device.createShaderModule.bind(gpu.device);gpu.device.createShaderModule=desc=>{const module=makeShader(desc);module.getCompilationInfo().then(info=>{for(const m of info.messages)if(m.type==='error')console.error('WGSL '+m.lineNum+':'+m.linePos+' '+m.message);});return module;};
   if(!/nvidia|ampere|3090/i.test(JSON.stringify(adapter)))throw Error('Hardware NVIDIA adapter required');
   const W=131,H=270,anchor=65,f=gpu.field({W,H,anchor}),bits=new Uint32Array(f.WW*H),present=new Uint32Array(bits.length);
   let seed=657;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
   function put(r,c,v){const at=r*f.WW+(c>>5),mask=1<<(c&31);present[at]|=mask;if(v)bits[at]|=mask;else bits[at]&=~mask;}
   for(let r=0;r<H;r++)for(let c=0;c<W;c++){const n=rand();if(n%13!==0)put(r,c,(n>>>19)&1);}
   // Both present zero and absent cells, bit-word crossings, and 128-row strip seam.
   for(let c=26;c<74;c++)put(127,c,c%3?0:1);
   for(let r=118;r<142;r++){put(r,31,(r&1));put(r,32,0);put(r,128,1);}
   const snapshot={width:W,height:H,stride:f.WW,bits,present};f.writePacked(snapshot);await f.done();
   const vsets=[[["0000","zero",{index:0,label:'zero'}]],[["10101","a"],["01010","b"]],[["0000","repeat"]],[["1010101010101010","16"]],[["1 0","wildcard"]]];
   const base={anchor,mode:'all',parity:-1,latticeStride:2,vsets,pattern:'initial',compact:true};
   const cases=[];for(const mode of ['row','col','diag','antidiag','all'])for(const parity of [-1,0,1,2])for(const invertBits of [false,true])cases.push({...base,mode,parity,invertBits});
   for(const mode of ['row','col','diag','antidiag','all'])cases.push({...base,mode,latticeStride:1,compact:false,bounds:{x:23,y:121,width:81,height:139}});
   cases.push({...base,skip:[0,2]},{...base,parity:2,skipByHalf:[[0,1],[2,4]]},{...base,independentWords:true},{...base,compact:false},{...base,vsets:[[['0000000000000000000000000000000000000000','long-zero']]]});
   const randomVsets=randomRows.map(word=>[[word,'',{index:0,label:'original'}]]);
   for(const mode of ['row','col','diag','antidiag','all'])for(const parity of [-1,0,1,2])for(const invertBits of [false,true])cases.push({...base,mode,parity,invertBits,vsets:randomVsets});
   cases.push({...base,vsets:randomVsets,independentWords:true},{...base,vsets:randomVsets,compact:false,bounds:{x:30,y:126,width:67,height:133}});
   const previouslyFound=MayatnikLargeSearch.search(snapshot,{...base,vsets:randomVsets});
   const previouslyFoundHalves=MayatnikLargeSearch.search(snapshot,{...base,vsets:randomVsets,parity:2});
   cases.push({...base,vsets:randomVsets,skip:previouslyFound.foundIndices},{...base,vsets:randomVsets,parity:2,skipByHalf:previouslyFoundHalves.foundByHalf});
   const passed=[],failures=[];let readbackBytes=0;
   for(let i=0;i<cases.length;i++){
    const options=cases[i],cpu=MayatnikLargeSearch.search(snapshot,options),actual=await f.searchExact(options);
    if(!actual){failures.push({i,reason:'unsupported',options});continue;}
    const {gpu:metrics,occurrenceCount,occurrenceCountComplete,...exact}=actual;readbackBytes+=metrics.readbackBytes;
    if(JSON.stringify(exact)!==JSON.stringify(cpu))failures.push({i,options,cpu,gpu:exact});else passed.push({i,mode:options.mode,parity:options.parity,latticeStride:options.latticeStride,invertBits:!!options.invertBits,found:exact.found.length,occurrenceCount});
   }
   // Use the real worker as oracle for automatic band clipping.
   const options={...base,withoutBands:true,bounds:{x:0,y:0,width:W,height:H}};
   const cpu=await MayatnikLargeSearchHost.start({...MayatnikLargeSearchHost.fromPacked(snapshot),request:{options,archive:false}}).result;
   const actual=await f.searchExact(options);const {gpu:metrics,occurrenceCount,occurrenceCountComplete,...exact}=actual||{};
   if(JSON.stringify(exact)!==JSON.stringify(cpu.result))failures.push({i:'withoutBands',options,cpu:cpu.result,gpu:exact});else passed.push({i:'withoutBands',found:exact.found.length});
   let cancelled=false;try{await f.searchExact(base,()=>false);}catch(e){cancelled=e.name==='AbortError';}
   const fallbacks={};for(const setting of [{through:true},{skipSpaces:true},{pattern:'zeros'},{mode:'v'},{mode:'loop'}])fallbacks[JSON.stringify(setting)]=(await f.searchExact({...base,...setting}))===null;
   for(let r=0;r<H;r++)for(let c=0;c<W;c++)put(r,c,1);f.writePacked(snapshot);await f.done();
   const denseOptions={...base,mode:'row',countOccurrences:true,vsets:[[['1','first']],[['1','second']],[['1','third']],[['111','triple']]]};
   const denseCPU=MayatnikLargeSearch.search(snapshot,denseOptions),denseGPU=await f.searchExact(denseOptions),{gpu:denseMetrics,occurrenceCount:denseCount,occurrenceCountComplete:denseCountComplete,...denseExact}=denseGPU;
   const expectedDenseCount=W*H+(W-4)*H;
   if(JSON.stringify(denseExact)!==JSON.stringify(denseCPU)||denseCount!==expectedDenseCount)failures.push({i:'dense-overflow',expectedDenseCount,denseCount,cpu:denseCPU,gpu:denseExact});else passed.push({i:'dense-overflow',occurrenceCount:denseCount,retained:denseExact.found.length});
   for(const value of [0,1]){
    for(let r=0;r<H;r++)for(let c=0;c<W;c++)put(r,c,value);f.writePacked(snapshot);await f.done();
    const prefixVsets=Array.from({length:70},(_,i)=>[[String(value).repeat(i+1),'prefix-'+(i+1)]]);
    prefixVsets.push([[String(value),'duplicate1']],[[String(value),'duplicate2']],[[String(value).repeat(3),'duplicate3']]);
    for(const setting of [{mode:'all',parity:-1},{mode:'all',parity:2},{mode:'row',parity:-1,independentWords:true}]){
     const options={...base,...setting,vsets:prefixVsets},cpu=MayatnikLargeSearch.search(snapshot,options),actual=await f.searchExact(options);
     const {gpu:metrics,occurrenceCount,occurrenceCountComplete,...exact}=actual||{};
     const id='dense-prefix-'+value+'-'+setting.mode+'-'+setting.parity;
     if(JSON.stringify(exact)!==JSON.stringify(cpu))failures.push({i:id,options,cpu,gpu:exact});else passed.push({i:id,words:prefixVsets.length,found:exact.found.length,occurrenceCount});
    }
   }
   let mutationCancelled=false,mutationDuringProgress=false;try{await f.searchExact(denseOptions,()=>true,p=>{if(p.done>0&&!mutationDuringProgress){mutationDuringProgress=true;f.reset();}});}catch(e){mutationCancelled=e.name==='AbortError';}
   f.destroy();return {adapter,width:W,height:H,passed,failures,readbackBytes,cancelled,mutationCancelled,mutationDuringProgress,fallbacks};
  },parityInput.rows);fs.writeFileSync(path.join(out,'parity.json'),JSON.stringify({...report,errors},null,2));console.log(JSON.stringify({passed:report.passed.length,failures:report.failures.length,cancelled:report.cancelled,mutationCancelled:report.mutationCancelled,fallbacks:report.fallbacks,errors}));if(report.failures.length||!report.cancelled||!report.mutationCancelled||errors.length)process.exitCode=1;return;
 }
 const setup=await page.evaluate(async()=>{
   const gpu=await MayatnikGPU.create();window.benchGPU=gpu;
   const description=JSON.stringify(gpu.adapter);if(!/nvidia|ampere|3090/i.test(description)||/swiftshader|llvmpipe/i.test(description))throw Error('RTX3090 hardware adapter required: '+description);
   const H=Number(new URLSearchParams(location.search).get('height'))||16384,steps=Math.ceil(H/3)+Math.ceil(H/64),geometry=MAYATNIK.geometry('pend',steps,H),field=gpu.field({...geometry,H,bg:'empty'});
   window.benchField=field;const started=performance.now();
   const frame=1;for(let from=0;from<frame;from+=256){field.run(MayatnikGPU.apexList(MAYATNIK,{mode:'pend',pair:false,anchor:geometry.anchor,steps:Math.min(frame,from+256),from}));await field.done();if(from%1024===0)await benchProgress({phase:'build',from,steps});}
   return {adapter:gpu.adapter,H,W:field.W,stride:field.WW,anchor:field.anchor,frame,plannedVertices:steps,mode:'pend',pair:false,range:'N/3',buildMs:performance.now()-started};
 });console.log('SETUP '+JSON.stringify(setup));
 const input=JSON.parse(fs.readFileSync(path.join(out,'queries.json'),'utf8'));
 const run=await page.evaluate(async({rows})=>{
   const f=benchField,options={mode:'all',anchor:f.anchor,parity:-1,latticeStride:2,pattern:'initial',vsets:rows.map(word=>[[word,'',{index:0,label:'original'}]]),bounds:{x:0,y:0,width:f.W,height:f.H},withoutBands:true,compact:true,invertBits:false,skipSpaces:false,through:false};
   const started=performance.now();let last=0;
   const result=await f.searchExact(options,()=>true,p=>{const now=performance.now();if(now-last>1000||p.done===p.total){last=now;benchProgress({...p,elapsedMs:now-started});}});
   if(!result)throw Error('GPU refused workload');const searchWallMs=performance.now()-started;
   let archived=null;if(result.found.length){archived=await MayatnikLargeSearchHost.start({header:{width:f.W,height:f.H,stride:f.WW},strips:current=>f.readPackedStrips(current),request:{archiveOnly:true},onProgress:p=>{if(p.phase==='archive'&&(!p.done||p.done%4096===0||p.done===p.total))benchProgress(p);}}).result;}
   return {options,result,metrics:{searchWallMs,...result.gpu,totalMs:performance.now()-started,archive:archived?.metrics},archiveBytes:archived?.archive?.blob?.size||0};
 },{rows:input.rows});
 const shaderSha256=crypto.createHash('sha256').update(source('mayatnik/mayatnik-gpu-search.js',old)).digest('hex');
 const record={baseline,shaderSha256,querySeed:input.seed,setup,results:[run],errors};
 fs.writeFileSync(path.join(out,mode+(process.env.BENCH_TAG?'-'+process.env.BENCH_TAG:'')+'.json'),JSON.stringify(record,null,2));
 console.log('RESULT '+JSON.stringify({mode,...run.metrics,archiveBytes:run.archiveBytes,found:run.result.found.length,occurrenceCount:run.result.occurrenceCount}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;server.close();});
