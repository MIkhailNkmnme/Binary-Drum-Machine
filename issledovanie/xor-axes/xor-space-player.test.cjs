const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright-core');
test('3D player worker, fixed centres, strict/shared pivots, every counter, gestures invalidation and camera isolation',async()=>{
 const root=path.resolve(__dirname,'../..'),server=http.createServer((req,res)=>{
  const file=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.__raf=new Map();let id=0;requestAnimationFrame=f=>{__raf.set(++id,f);return id;};cancelAnimationFrame=id=>__raf.delete(id);});
  await page.goto('http://127.0.0.1:'+server.address().port+'/issledovanie/xor-axes/index.html');
  const play=page.locator('.xs-sequence [data-action=play]'),allow=page.locator('[data-centres]');
  assert.equal(await allow.isChecked(),true);await allow.uncheck();await play.click();await page.waitForFunction(()=>!xorSpacePlayer.getState().busy,null,{polling:50,timeout:10000});
  assert.equal(await page.locator('[data-counter]').textContent(),'0 / 0');assert.match(await page.locator('[data-status]').textContent(),/Разведите/);
  await allow.check();const anchors=await page.evaluate(()=>xorSpaceView.getModel().figures.map(f=>f.anchor));
  await page.locator('#play').click();assert.equal(await page.evaluate(()=>!!animation),true);
  await play.click();await page.waitForFunction(()=>xorSpacePlayer.getState().playing,null,{polling:50,timeout:10000});
  assert.equal(await page.evaluate(()=>!!animation),false,'starting 3D stops the 2D player');
  assert.equal(await page.evaluate(()=>xorSpacePlayer.getState().count),64512);
  const walked=await page.evaluate(()=>{
   let now=performance.now(),indices=[];
   for(let i=0;i<20;i++){now+=3000;const cb=[...__raf.values()][0];__raf.clear();cb(now);indices.push(xorSpacePlayer.getState().index);
    const model=xorSpaceView.getModel(),occupied=new Set(),centres=new Set(model.figures.map(f=>f.anchor.join(',')));
    for(const f of model.figures)for(const p of f.cells){const key=p.join(',');if(occupied.has(key)||centres.has(key))throw Error('Collision during playback');occupied.add(key);}
   }return {indices,anchors:xorSpaceView.getModel().figures.map(f=>f.anchor)};
  });assert.deepEqual(walked.indices,Array.from({length:20},(_,i)=>i+1));assert.deepEqual(walked.anchors,anchors);
  await play.click();assert.equal(await page.evaluate(()=>xorSpacePlayer.getState().playing),false);
  if(process.env.XOR_PLAYER_FULL_SCREENSHOT)await page.locator('.xor-space').screenshot({path:process.env.XOR_PLAYER_FULL_SCREENSHOT});
  const slider=page.locator('[data-position]');await slider.fill('64512');await slider.dispatchEvent('input');assert.equal(await page.locator('[data-counter]').textContent(),'64512 / 64512');
  await page.locator('[data-action=next]').click();assert.equal(await page.locator('[data-counter]').textContent(),'1 / 64512');await page.locator('[data-action=prev]').click();assert.equal(await page.locator('[data-counter]').textContent(),'64512 / 64512');
  const before=await page.evaluate(()=>xorSpaceView.getState().camera);await page.locator('.xs-main').press('ArrowRight');assert.notDeepEqual(await page.evaluate(()=>xorSpaceView.getState().camera),before);assert.equal(await page.evaluate(()=>xorSpacePlayer.getState().count),64512);
  await play.click();await page.evaluate(()=>document.querySelector('.xor-space').dispatchEvent(new CustomEvent('xor-space-change',{bubbles:true,detail:{reason:'interaction'}})));assert.equal(await page.evaluate(()=>xorSpacePlayer.getState().playing),false);assert.equal(await page.evaluate(()=>xorSpacePlayer.getState().count),64512);
  await page.locator('input[data-figure="0"][data-axis="X"]').fill('5');assert.equal(await page.evaluate(()=>xorSpacePlayer.getState().count),0);
  await play.click();await allow.uncheck();await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>xorSpacePlayer.getState().count),0);assert.equal(await page.evaluate(()=>xorSpacePlayer.getState().busy),false,'stale worker discarded');
  await page.locator('.xs-reset').click();
  for(let i=0;i<4;i++)await page.locator('input[data-figure="'+i+'"][data-axis="X"]').fill(String(i*40));
  await play.click();await page.waitForFunction(()=>xorSpacePlayer.getState().playing,null,{polling:50,timeout:10000});assert.equal(await page.evaluate(()=>xorSpacePlayer.getState().count),331776);
  await page.locator('#play').click();assert.equal(await page.evaluate(()=>!!animation),true);await page.evaluate(()=>{const cb=[...__raf.values()].at(-1);__raf.clear();cb(performance.now()+10);});assert.equal(await page.evaluate(()=>xorSpacePlayer.getState().playing),false,'2D source update stops stale 3D playback');
  await page.locator('#play').click();
  await page.setViewportSize({width:390,height:844});await page.locator('.xs-sequence').scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=390),true);
  for(const el of await page.locator('.xs-sequence button,.xs-sequence input').all()){const r=await el.boundingBox();assert.ok(r.x>=0&&r.x+r.width<=390);}
  if(process.env.XOR_PLAYER_SCREENSHOT)await page.locator('.xs-sequence').screenshot({path:process.env.XOR_PLAYER_SCREENSHOT});
  assert.deepEqual(errors,[]);
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
