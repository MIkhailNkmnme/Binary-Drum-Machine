/* MAЯ-657. Real-adapter baseline and exact-search benchmark; no software GPU. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process'),crypto=require('node:crypto');
const playwright=process.env.PLAYWRIGHT_PATH||path.join(process.env.LOCALAPPDATA,'Temp/mayatnik-benchmark-657/node_modules/playwright-core');
const {chromium}=require(playwright);
const root=path.resolve(__dirname,'..'),baseline='b5ab4369',out=path.join(__dirname,'benchmark-657');
fs.mkdirSync(out,{recursive:true});
const pinned=new Map();
function source(name,old){if(!old)return fs.readFileSync(path.join(root,name));if(!pinned.has(name))pinned.set(name,cp.execFileSync('git',['show',baseline+':'+name],{cwd:root,maxBuffer:32*1024*1024}));return pinned.get(name);}
const server=http.createServer((req,res)=>{try{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),old=pathname.startsWith('/baseline/'),name=pathname.replace(/^\/(baseline|current)\//,'');
 if(pathname==='/favicon.ico'){res.writeHead(204).end();return;}
 if(name==='mayatnik/runner.html'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>МАЯ-657 measurement</title>'+(!old?'<script src="mayatnik-gpu-search.js"></script>':'')+'<script src="mayatnik-core.js"></script><script src="mayatnik-gpu.js"></script><script src="mayatnik-large-search-host.js"></script><script src="mayatnik-large-search.js"></script>');return;}
 if(!name.startsWith('mayatnik/')||name.includes('..'))throw Error('path');
 let content=source(name,old);
 if(old&&name.endsWith('mayatnik-large-search-worker.js')){content=content.toString().replace('const result=engine.search(snapshot,','const searchStart=performance.now();const result=engine.search(snapshot,').replace('let saved,archiveError;','const searchMs=performance.now()-searchStart;let archiveMs=0;let saved,archiveError;').replace('try{saved=await archiveFrame(snapshot,spool);}','try{const archiveStart=performance.now();saved=await archiveFrame(snapshot,spool);archiveMs=performance.now()-archiveStart;}').replace('return {result:visible,archive:saved,archiveError};','return {result:visible,archive:saved,archiveError,metrics:{searchMs,archiveMs}};');}
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
  const report=await page.evaluate(async()=>{
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
   const passed=[],failures=[];let readbackBytes=0;
   for(let i=0;i<cases.length;i++){
    const options=cases[i],cpu=MayatnikLargeSearch.search(snapshot,options),actual=await f.searchExact(options);
    if(!actual){failures.push({i,reason:'unsupported',options});continue;}
    const {gpu:metrics,occurrenceCount,...exact}=actual;readbackBytes+=metrics.readbackBytes;
    if(JSON.stringify(exact)!==JSON.stringify(cpu))failures.push({i,options,cpu,gpu:exact});else passed.push({i,mode:options.mode,parity:options.parity,latticeStride:options.latticeStride,invertBits:!!options.invertBits,found:exact.found.length,occurrenceCount});
   }
   // Use the real worker as oracle for automatic band clipping.
   const options={...base,withoutBands:true,bounds:{x:0,y:0,width:W,height:H}};
   const cpu=await MayatnikLargeSearchHost.start({...MayatnikLargeSearchHost.fromPacked(snapshot),request:{options,archive:false}}).result;
   const actual=await f.searchExact(options);const {gpu:metrics,occurrenceCount,...exact}=actual||{};
   if(JSON.stringify(exact)!==JSON.stringify(cpu.result))failures.push({i:'withoutBands',options,cpu:cpu.result,gpu:exact});else passed.push({i:'withoutBands',found:exact.found.length});
   let cancelled=false;try{await f.searchExact(base,()=>false);}catch(e){cancelled=e.name==='AbortError';}
   const fallbacks={};for(const setting of [{through:true},{skipSpaces:true},{pattern:'zeros'},{mode:'v'},{mode:'loop'}])fallbacks[JSON.stringify(setting)]=(await f.searchExact({...base,...setting}))===null;
   for(let r=0;r<H;r++)for(let c=0;c<W;c++)put(r,c,1);f.writePacked(snapshot);await f.done();
   const denseOptions={...base,mode:'row',vsets:[[['1','first']],[['1','second']],[['1','third']],[['111','triple']]]};
   const denseCPU=MayatnikLargeSearch.search(snapshot,denseOptions),denseGPU=await f.searchExact(denseOptions),{gpu:denseMetrics,occurrenceCount:denseCount,...denseExact}=denseGPU;
   const expectedDenseCount=W*H+(W-4)*H;
   if(JSON.stringify(denseExact)!==JSON.stringify(denseCPU)||denseCount!==expectedDenseCount)failures.push({i:'dense-overflow',expectedDenseCount,denseCount,cpu:denseCPU,gpu:denseExact});else passed.push({i:'dense-overflow',occurrenceCount:denseCount,retained:denseExact.found.length});
   let mutationCancelled=false;try{await f.searchExact(denseOptions,()=>true,()=>f.reset());}catch(e){mutationCancelled=e.name==='AbortError';}
   f.destroy();return {adapter,width:W,height:H,passed,failures,readbackBytes,cancelled,mutationCancelled,fallbacks};
  });fs.writeFileSync(path.join(out,'parity.json'),JSON.stringify({...report,errors},null,2));console.log(JSON.stringify({passed:report.passed.length,failures:report.failures.length,cancelled:report.cancelled,mutationCancelled:report.mutationCancelled,fallbacks:report.fallbacks,errors}));if(report.failures.length||!report.cancelled||!report.mutationCancelled||errors.length)process.exitCode=1;return;
 }
 const setup=await page.evaluate(async()=>{
   const gpu=await MayatnikGPU.create();window.benchGPU=gpu;
   const description=JSON.stringify(gpu.adapter);if(!/nvidia|ampere|3090/i.test(description)||/swiftshader|llvmpipe/i.test(description))throw Error('RTX3090 hardware adapter required: '+description);
   const H=Number(new URLSearchParams(location.search).get('height'))||16384,steps=Math.ceil(H/3)+Math.ceil(H/64),geometry=MAYATNIK.geometry('pend',steps,H),field=gpu.field({...geometry,H,bg:'empty'});
   window.benchField=field;const started=performance.now();
   for(let from=0;from<steps;from+=256){field.run(MayatnikGPU.apexList(MAYATNIK,{mode:'pend',pair:false,anchor:geometry.anchor,steps:Math.min(steps,from+256),from}));await field.done();if(from%1024===0)await benchProgress({phase:'build',from,steps});}
   return {adapter:gpu.adapter,H,W:field.W,stride:field.WW,anchor:field.anchor,frame:steps,mode:'pend',pair:false,range:'N/3',buildMs:performance.now()-started};
 });console.log('SETUP '+JSON.stringify(setup));
 const query=process.env.BENCH_QUERY||'10011001100110011001100110011001';
 const directions=(process.env.BENCH_DIRECTIONS||'row').split(',');const results=[];
 for(const direction of directions){
 const run=await page.evaluate(async({direction,query,old})=>{
   const f=benchField,options={mode:direction,anchor:f.anchor,parity:-1,latticeStride:2,pattern:'initial',vsets:[[[query,'',{index:0,label:'original'}]]],bounds:{x:0,y:0,width:f.W,height:f.H},withoutBands:true,compact:true,invertBits:false,skipSpaces:false,through:false};
   const started=performance.now();let bytes=0,lastRead=started;
   if(old){const job=MayatnikLargeSearchHost.start({header:{width:f.W,height:f.H,stride:f.WW},strips:async function*(current){for await(const strip of f.readPackedStrips(current)){bytes+=strip.bits.byteLength+strip.present.byteLength;yield strip;lastRead=performance.now();}},request:{options,archive:true},onProgress:p=>{if(p.phase!=='read'||p.done===p.total)benchProgress(p);}});const data=await job.result;return {options,result:data.result,metrics:{...data.metrics,readbackBytes:bytes,totalMs:performance.now()-started,transferMs:lastRead-started},archiveBytes:data.archive?.blob?.size||0};}
   const result=await f.searchExact(options,()=>true,p=>benchProgress(p));if(!result)throw Error('GPU refused benchmark options');const searchWallMs=performance.now()-started;
   let archived=null;if(result.found.length){archived=await MayatnikLargeSearchHost.start({header:{width:f.W,height:f.H,stride:f.WW},strips:current=>f.readPackedStrips(current),request:{archiveOnly:true},onProgress:p=>{if(p.phase==='archive')benchProgress(p);}}).result;}
   return {options,result,metrics:{searchWallMs,...result.gpu,totalMs:performance.now()-started,archive:archived?.metrics},archiveBytes:archived?.archive?.blob?.size||0};
 },{direction,query,old});results.push(run);const shaderSha256=old?null:crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'mayatnik-gpu-search.js'))).digest('hex');fs.writeFileSync(path.join(out,mode+(process.env.BENCH_TAG?'-'+process.env.BENCH_TAG:'')+'.json'),JSON.stringify({baseline,shaderSha256,setup,results,errors},null,2));console.log('RESULT '+JSON.stringify({direction,...run.metrics,archiveBytes:run.archiveBytes,found:run.result.found}));
 }
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;server.close();});
