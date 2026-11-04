const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const View=require('./mayatnik-scale-stack-view.js');
test('one-row step includes every lower triangle through one row, larger steps retain the final row',()=>{
 assert.deepEqual(View.levels(63,32,1).map(s=>s.height),Array.from({length:24},(_,i)=>31-i));
 assert.deepEqual(View.levels(63,32,8).map(s=>s.height),[24,16,8]);
 assert.deepEqual(View.levels(1,1,1),[]);
});
test('scroll window paints exact pixels, frees offscreen rasters, displays every lower raster at the original screen size and supports zoom in both directions',{timeout:45000},async t=>{
 const {chromium}=require('playwright-core');const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1000,height:700}});
 await page.setContent('<style>body{margin:0}#host{width:900px;height:600px;overflow:auto;padding:0;position:relative}</style><div id="host"></div>');
 await page.addStyleTag({path:path.join(__dirname,'mayatnik-scale-stack.css')});await page.addScriptTag({path:path.join(__dirname,'mayatnik-scale-stack-view.js')});
 await page.evaluate(()=>{const source={width:63,height:32,pixels:Uint8ClampedArray.from({length:63*32*4},(_,i)=>i%4===3?255:17)};window.source=source;window.stack=MayatnikScaleStackView.create({host:document.querySelector('#host'),stepRows:()=>1,captureSource:()=>source});stack.refreshLayout({left:100,width:630,pixelScale:10});stack.setEnabled(true);});
 await page.waitForFunction(()=>stack.inspect().canvases>0&&!stack.inspect().busy&&!stack.inspect().pending);
 await page.locator('.may-scale-stack__controls select[aria-label="Вариант уменьшения"]').selectOption('powers');assert.equal(await page.locator('.may-scale-stack__level').count(),2);
 assert.match(await page.locator('.may-scale-stack__level').first().textContent(),/16 строк/);
 const base=page.locator('.may-scale-stack__controls input[aria-label="Число x"]');await base.fill('3');await base.dispatchEvent('change');assert.match(await page.locator('.may-scale-stack__level').first().textContent(),/10 строк/);
 await base.fill('2');await base.dispatchEvent('change');await page.locator('.may-scale-stack__controls select[aria-label="Вариант уменьшения"]').selectOption('multiples');assert.match(await page.locator('.may-scale-stack__level').nth(1).textContent(),/8 строк/);
 await page.locator('.may-scale-stack__controls select[aria-label="Вариант уменьшения"]').selectOption('rows');
 assert.equal(await page.locator('.may-scale-stack__level').count(),24);
 assert.ok(await page.locator('.may-scale-stack canvas').count()<5);
 assert.equal(await page.locator('.may-scale-stack canvas').first().evaluate(c=>c.getContext('2d').getImageData(0,0,1,1).data[0]),17);
 const centre=await page.locator('.may-scale-stack').evaluate(n=>{const r=n.getBoundingClientRect();return r.x+r.width/2;});
 await page.evaluate(()=>stack.setZoom(2));assert.equal(await page.locator('.may-scale-stack').evaluate(n=>{const r=n.getBoundingClientRect();return r.x+r.width/2;}),centre);
 assert.equal(await page.evaluate(()=>stack.setZoom(.5)),.5);
 const size=await page.locator('.may-scale-stack canvas').first().evaluate(c=>({width:c.width,height:c.height,cssWidth:c.getBoundingClientRect().width,cssHeight:c.getBoundingClientRect().height}));assert.equal(size.cssWidth,315);assert.equal(size.cssHeight,size.height*5);assert.ok(size.width<63);assert.ok(size.height<32);
 await page.evaluate(()=>{const h=document.querySelector('#host');h.scrollTop=h.scrollHeight;});
 await page.waitForFunction(()=>document.querySelector('.may-scale-stack__level:last-child canvas'));
 assert.equal(await page.locator('.may-scale-stack__level:first-child canvas').count(),0);
 const last=await page.locator('.may-scale-stack__level:last-child canvas').evaluate(c=>({rows:c.height,width:c.getBoundingClientRect().width,height:c.getBoundingClientRect().height}));assert.equal(last.rows,8);assert.equal(last.width,315);assert.equal(last.height,40);
 assert.ok(await page.evaluate(()=>stack.inspect().canvasBytes)<32*1024*1024);
 assert.match(await page.locator('.may-scale-stack__level:last-child').textContent(),/8 строк.*часть ×4/);
 await page.evaluate(()=>{source.pixels.set(source.pixels.map((_,i)=>i%4===3?255:99));stack.requestFrame(source,{key:'changed'});});
 await page.waitForFunction(()=>stack.inspect().key==='changed'&&!stack.inspect().busy&&!stack.inspect().pending&&document.querySelector('.may-scale-stack__level:last-child canvas')?.getContext('2d').getImageData(0,0,1,1).data[0]===99);
 assert.equal(await page.locator('.may-scale-stack canvas').last().evaluate(c=>c.getContext('2d').getImageData(0,0,1,1).data[0]),99);
 await page.evaluate(()=>stack.setEnabled(false));assert.equal(await page.locator('.may-scale-stack canvas').count(),0);
 assert.equal(await page.evaluate(()=>stack.inspect().canvasBytes),0);
 await page.evaluate(()=>stack.destroy());assert.equal(await page.locator('.may-scale-stack').count(),0);
});

test('powers, multiples and row steps build distinct monotone sequences from the original',()=>{
 const heights=(mode,base)=>View.levels(1023,512,8,mode,base).map(x=>x.height);
 assert.deepEqual(heights('powers',2),[256,128,64,32,16,8]);
 assert.deepEqual(heights('multiples',2).slice(0,5),[256,128,85,64,51]);
 assert.deepEqual(heights('rows',2).slice(0,3),[504,496,488]);
 assert.deepEqual(heights('powers',3).slice(0,4),[170,56,18,8]);
 for(const mode of ['powers','multiples','rows']){const a=heights(mode,2);assert.equal(a.at(-1),8);assert.equal(new Set(a).size,a.length);assert.ok(a.every((v,i)=>!i||v<a[i-1]));}
});
