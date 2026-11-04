'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'../..');
let server,browser,page;const errors=[];
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'};
before(async()=>{
 server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(error,body)=>{
   if(error){res.writeHead(404);res.end();return;}
   res.setHeader('Content-Type',MIME[path.extname(file)]||'application/octet-stream');res.end(body);
  });
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 page=await browser.newPage({viewport:{width:1100,height:900}});
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/issledovanie/xor-axes/index.html');
 await page.evaluate(()=>document.fonts.ready);
});
after(async()=>{await browser?.close();await new Promise(resolve=>server.close(resolve));assert.deepEqual(errors,[]);});

test('only the thin AzBuk face is delivered and every text style stays thin',async()=>{
 const fonts=await page.evaluate(()=>({
  thin:document.fonts.check('16px "AzBuk Thin"'),
  faces:[...document.fonts].filter(f=>f.family.startsWith('AzBuk')).map(f=>f.family+':'+f.status),
  body:getComputedStyle(document.body).fontFamily,
  heading:getComputedStyle(document.querySelector('h1')).fontFamily,
  icon:getComputedStyle(document.querySelector('.ico')).fontFamily,
  boldWeight:getComputedStyle(document.querySelector('h1')).fontWeight,
  strongWeight:getComputedStyle(document.querySelector('b')).fontWeight,
  headWeight:getComputedStyle(document.querySelector('.xs-variant-explanation th')).fontWeight
 }));
 assert.equal(fonts.thin,true);
 assert.deepEqual(fonts.faces,['AzBuk Thin:loaded']);
 assert.match(fonts.body,/AzBuk Thin/);
 assert.match(fonts.heading,/AzBuk Thin/);
 assert.match(fonts.icon,/AzBuk Thin/);
 assert.equal(fonts.boldWeight,'400');
 assert.equal(fonts.strongWeight,'400');
 assert.equal(fonts.headWeight,'400');
});

test('every button is a strict rectangle with a one-pixel border and no clipped corners',async()=>{
 const damage=await page.evaluate(()=>{
  const bad=[];
  for(const button of document.querySelectorAll('button')){
   const style=getComputedStyle(button);
   if(style.clipPath!=='none'||style.borderRadius!=='0px'||parseFloat(style.borderTopWidth)!==1||style.borderTopStyle!=='solid')
    bad.push([button.id||button.textContent.trim().slice(0,14),style.clipPath,style.borderRadius,style.borderTopWidth,style.borderTopStyle]);
  }
  return {count:document.querySelectorAll('button').length,bad:bad.slice(0,6),badCount:bad.length};
 });
 assert.equal(damage.badCount,0,JSON.stringify(damage.bad));
 assert(damage.count>=40);
});

test('button icons are glyph strings from the alphabet, not emoji or vector shapes',async()=>{
 const icons=await page.evaluate(()=>[...document.querySelectorAll('button .ico')].map(icon=>icon.textContent));
 assert(icons.length>=12);
 for(const icon of icons)assert.match(icon,/^[0-9A-Za-z<>+\-|/\[\]?"'#*=_:;,.\s]+$/,JSON.stringify(icon));
 const forbidden=await page.evaluate(()=>{
  const bad=new Set();
  for(const ch of document.body.innerText){
   const code=ch.codePointAt(0);
   if((code>=0x2190&&code<=0x21ff)||(code>=0x25a0&&code<=0x27bf)||(code>=0x2b00&&code<=0x2bff)||(code>=0x1f000&&code<=0x1faff))bad.add(ch);
  }
  return [...bad];
 });
 assert.deepEqual(forbidden,[],'no picture symbols left in the visible text');
});

test('sliders are drawn with square brackets in both the field and the 3D player',async()=>{
 const brackets=await page.evaluate(()=>{
  const field=[...document.querySelectorAll('.x-range .x-bracket')].map(span=>span.textContent);
  const player=[...document.querySelectorAll('.xs-sequence-position .xs-rail')].map(span=>span.textContent);
  const font=getComputedStyle(document.querySelector('.x-bracket')).fontFamily;
  return {field,player,font};
 });
 assert.deepEqual(brackets.field,['[',']','[',']','[',']','[',']','[',']']);
 assert.deepEqual(brackets.player,['[',']']);
 assert.match(brackets.font,/AzBuk/);
});

test('the glyph face reaches the 3D controls and canvas too',async()=>{
 const state=await page.evaluate(()=>({
  select:getComputedStyle(document.querySelector('.xs-figure select')).fontFamily,
  button:getComputedStyle(document.querySelector('.gz-hx')).fontFamily,
  caption:getComputedStyle(document.querySelector('.xs-projection figcaption')).fontFamily
 }));
 assert.match(state.select,/AzBuk/);
 assert.match(state.button,/AzBuk/);
 assert.match(state.caption,/AzBuk/);
});

test('field cell size is settable in pixels and never widens the page',async()=>{
 await page.locator('#cellAuto').click();
 await page.waitForTimeout(200);
 const auto=await page.evaluate(()=>({pressed:document.getElementById('cellAuto').getAttribute('aria-pressed'),slider:document.getElementById('cellSize').value}));
 assert.equal(auto.pressed,'true');
 assert(Number(auto.slider)>=4);
 await page.locator('#cellSize').evaluate(el=>{el.value='24';el.dispatchEvent(new Event('input'));});
 await page.waitForTimeout(200);
 const fixed=await page.evaluate(()=>{const field=document.getElementById('field'),wrap=field.parentElement;return {w:field.getBoundingClientRect().width,h:field.getBoundingClientRect().height,wrap:wrap.getBoundingClientRect().width,scroll:wrap.scrollWidth,page:document.documentElement.scrollWidth,shown:document.getElementById('cellSizeNow').textContent,pressed:document.getElementById('cellAuto').getAttribute('aria-pressed')};});
 assert.equal(fixed.w,696);
 assert.equal(fixed.h,696);
 assert.equal(fixed.shown,'24 px');
 assert.equal(fixed.pressed,'false');
 assert(fixed.scroll>=696);
 assert(fixed.page<=1100);
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(250);
 const mobile=await page.evaluate(()=>({page:document.documentElement.scrollWidth,field:document.getElementById('field').getBoundingClientRect().width}));
 assert.equal(mobile.page,390);
 assert.equal(mobile.field,696);
 await page.locator('#cellAuto').click();
 await page.waitForTimeout(200);
 const back=await page.evaluate(()=>({pressed:document.getElementById('cellAuto').getAttribute('aria-pressed'),field:document.getElementById('field').getBoundingClientRect().width,wrap:document.getElementById('field').parentElement.getBoundingClientRect().width}));
 assert.equal(back.pressed,'true');
 assert(Math.abs(back.field-back.wrap)<=1);
 await page.setViewportSize({width:1100,height:900});
});

test('the redesign fits a 390 px phone without sideways scrolling',async()=>{
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(250);
 const fit=await page.evaluate(()=>({width:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('button')].filter(button=>{const box=button.getBoundingClientRect();return box.width>0&&(box.left<-.5||box.right>390.5);}).map(button=>button.id||button.textContent.trim().slice(0,12))}));
 assert(fit.width<=390);
 assert.deepEqual(fit.buttons,[]);
});
