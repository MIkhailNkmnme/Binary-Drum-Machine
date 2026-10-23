/* Regenerate the seven documentation figures from their HTML source, v1.001.
   Usage: NODE_PATH=<directory with playwright> node render.cjs [source URL]
   Start a static server rooted at the repository first. */
const {chromium} = require('playwright');
const path = require('node:path');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const figures = ['states','sizing','split','lists','overlap','slider','captions'];
(async()=>{
 const browser = await chromium.launch({headless:true});
 try {
  const page = await browser.newPage({viewport:{width:1100,height:950},deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.argv[2]||'http://127.0.0.1:8766/knopki/standart/illustrations.html',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.buttonReferenceReady===true);
  await page.evaluate(()=>document.fonts.ready);
  const measure=()=>page.evaluate(()=>{
   const b=document.querySelector('#states .ref-button'),style=getComputedStyle(b),bg=getComputedStyle(b,'::before'),r=b.getBoundingClientRect();
   return {w:r.width,h:r.height,stroke:style.getPropertyValue('--stroke'),text:style.color,shadow:style.textShadow,gradient:bg.backgroundImage};
  });
  const b=page.locator('#states .ref-button').first(),before=await measure();
  await b.hover();const hover=await measure();await page.mouse.down();const down=await measure();await page.mouse.up();
  assert.equal(before.w,120);assert.equal(before.h,24);assert.equal(hover.w,120);assert.equal(down.h,24);assert.equal(hover.stroke,'1px');assert.equal(down.stroke,'3px');assert.equal(before.gradient,hover.gradient);assert.equal(before.gradient,down.gradient);assert.equal(before.text,down.text);assert.equal(before.shadow,'none');assert.match(before.gradient,/radial-gradient/);
  const pair=page.locator('#split .ref-pair').first();
  const pairGradient=await pair.evaluate(n=>getComputedStyle(n).backgroundImage);assert.match(pairGradient,/radial-gradient/);
  await pair.locator('.gz-half').nth(1).click();assert.equal(await pair.getAttribute('class').then(c=>c.includes('reverse-seam')),true);
  assert.equal(await pair.evaluate(n=>getComputedStyle(n).backgroundImage),pairGradient);
  await pair.locator('.gz-half').first().click();assert.equal(await pair.getAttribute('class').then(c=>c.includes('reverse-seam')),false);
  await page.mouse.move(1080,940);
  for(const id of figures) await page.locator('#'+id).screenshot({path:path.join(__dirname,id+'.png'),animations:'disabled'});
  const dims=await page.locator('.ref-button:not(.bad-tall):not(.bad-wide)').evaluateAll(bs=>bs.filter(b=>b.getClientRects().length).every(b=>b.offsetWidth===120&&b.offsetHeight===24));assert.ok(dims);
  assert.deepEqual(errors,[]);
  await page.setViewportSize({width:412,height:900});
  await page.locator('#split').scrollIntoViewIfNeeded();await page.locator('#split .ref-pair').first().locator('.gz-half').nth(1).click();
  const mobile=await page.evaluate(()=>({page:innerWidth,scroll:document.documentElement.scrollWidth,figures:document.querySelectorAll('.figure').length}));
  // The fixed-width technical diagrams intentionally remain scrollable at 412px.
  assert.equal(mobile.figures,7);assert.ok(mobile.scroll>=mobile.page);
  fs.writeFileSync(path.join(__dirname,'render-report.json'),JSON.stringify({version:'1.001',figures,before,hover,down,mobile,errors},null,2)+'\n');
  console.log('Seven PNGs regenerated at DPR 2; states, geometry, diagonal switching and 412px scroll checked.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
