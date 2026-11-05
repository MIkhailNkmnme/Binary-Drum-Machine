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
   if(button.classList.contains('thumb-play'))continue;
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
 for(const icon of icons)assert.match(icon,/^[0-9A-Za-z<>+\-|/\[\]?"'#*=_:;,!.\s]+$/,JSON.stringify(icon));
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
  const size=getComputedStyle(document.querySelector('.x-bracket')).fontSize;
  const play=getComputedStyle(document.querySelector('.thumb-play'));
  return {field,player,font,size,playBorder:play.borderTopWidth,playBackground:play.backgroundColor};
 });
 assert.deepEqual(brackets.field,['-','-','[',']','[',']','[',']','[',']']);
 assert.deepEqual(brackets.player,['[',']']);
 assert.match(brackets.font,/AzBuk/);
 assert.equal(brackets.size,'30px');
 assert.equal(brackets.playBorder,'0px','the play glyph has no frame');
 assert.equal(brackets.playBackground,'rgba(0, 0, 0, 0)','the play glyph has no badge');
});

test('every slider rail is dashed instead of solid',async()=>{
 const tracks=await page.evaluate(()=>[...document.querySelectorAll('.x-range .x-track')].map(track=>getComputedStyle(track).backgroundImage));
 assert.equal(tracks.length,5);
 for(const image of tracks)assert(image.includes('repeating-linear-gradient'),image);
});

test('field search finds 0/1 sequences along axes and through loops',async()=>{
 await page.evaluate(()=>{state.variant=1576;state.radius=0;state.selected=null;state.mode='xor';state.topCells=false;render();});
 await page.locator('#searchPattern').fill('1');
 await page.locator('#searchAxes').click();
 await page.locator('#searchRun').click();
 await page.waitForTimeout(200);
 const axes=await page.evaluate(()=>({cells:document.querySelectorAll('#searchBits .search-cell').length,info:document.getElementById('searchInfo').textContent,pressed:document.getElementById('searchAxes').getAttribute('aria-pressed')}));
 assert(axes.cells>0);
 assert.match(axes.info,/Найдено/);
 assert.equal(axes.pressed,'true');
 const yellow=await page.evaluate(()=>({chips:document.querySelectorAll('#searchPatternHits .search-pattern').length,found:document.querySelectorAll('#searchPatternHits .search-pattern.found').length,bg:getComputedStyle(document.querySelector('#searchPatternHits .search-pattern.found')).backgroundColor}));
 assert(yellow.chips>0);
 assert(yellow.found>0);
 assert.equal(yellow.bg,'rgb(255, 225, 77)');
 await page.locator('#searchLoops').click();
 await page.waitForTimeout(200);
 const loops=await page.evaluate(()=>({cells:document.querySelectorAll('#searchBits .search-cell').length,info:document.getElementById('searchInfo').textContent,pressed:document.getElementById('searchLoops').getAttribute('aria-pressed')}));
 assert(loops.cells>0);
 assert.match(loops.info,/сквозным/);
 assert.equal(loops.pressed,'true');
 await page.locator('#searchClear').click();
 assert.equal(await page.evaluate(()=>document.querySelectorAll('#searchBits .search-cell').length),0);
 assert.equal(await page.evaluate(()=>document.querySelectorAll('#searchPatternHits .search-pattern.found').length),0);
});

test('random playback is a default-on toggle with a remaining count',async()=>{
 assert.equal(await page.locator('#random').getAttribute('aria-pressed'),'true');
 await page.locator('#play').click();
 await page.waitForTimeout(900);
 const playing=await page.evaluate(()=>({hidden:document.getElementById('randomLeft').hidden,text:document.getElementById('randomLeft').textContent,pressed:document.getElementById('random').getAttribute('aria-pressed')}));
 assert.equal(playing.pressed,'true');
 assert.equal(playing.hidden,false);
 assert.match(playing.text,/^осталось \d+ \(\d+%\)$/);
 await page.locator('#play').click();
 assert.equal(await page.evaluate(()=>document.getElementById('randomLeft').hidden),true);
 await page.locator('#random').click();
 assert.equal(await page.evaluate(()=>document.getElementById('random').getAttribute('aria-pressed')),'false');
 const plans=await page.evaluate(()=>{
  const scrambled={...settings(),randomPlay:true,variant:100,motion:'variants'};
  const sequential={...settings(),randomPlay:false,variant:100,motion:'variants'};
  return {scrambled:plan(scrambled).slice(0,3).map(frame=>frame.variant),sequential:plan(sequential).slice(0,3).map(frame=>frame.variant)};
 });
 assert.deepEqual(plans.sequential,[100,101,102]);
 assert.notDeepEqual(plans.scrambled,plans.sequential);
 await page.locator('#play').click();
 await page.waitForTimeout(500);
 assert.equal(await page.evaluate(()=>document.getElementById('randomLeft').hidden),true);
 await page.locator('#play').click();
 await page.locator('#random').click();
 assert.equal(await page.evaluate(()=>document.getElementById('random').getAttribute('aria-pressed')),'true');
});

test('the layout strip has a 6144 all-variants play toggle',async()=>{
 await page.evaluate(()=>{if(animation)stopFilm();});
 const initial=await page.evaluate(()=>({text:document.getElementById('allVariants').textContent.trim(),pressed:document.getElementById('allVariants').getAttribute('aria-pressed')}));
 assert.equal(initial.text,'6144Перебор');
 assert.equal(initial.pressed,'false');
 await page.locator('#allVariants').click();
 await page.waitForTimeout(600);
 const playing=await page.evaluate(()=>({pressed:document.getElementById('allVariants').getAttribute('aria-pressed'),play:document.getElementById('play').getAttribute('aria-pressed'),anim:!!animation,motion:filmMotion}));
 assert.equal(playing.motion,'variants');
 assert.equal(playing.anim,true);
 assert.equal(playing.pressed,'true');
 assert.equal(playing.play,'true');
 await page.locator('#allVariants').click();
 await page.waitForTimeout(200);
 const stopped=await page.evaluate(()=>({pressed:document.getElementById('allVariants').getAttribute('aria-pressed'),play:document.getElementById('play').getAttribute('aria-pressed'),anim:!!animation}));
 assert.equal(stopped.anim,false);
 assert.equal(stopped.pressed,'false');
 assert.equal(stopped.play,'false');
});

test('the shift button plays all 6144 with a uniform centre shift',async()=>{
 await page.evaluate(()=>{if(animation)stopFilm();});
 const initial=await page.evaluate(()=>({text:document.getElementById('allVariantsShift').textContent.trim(),pressed:document.getElementById('allVariantsShift').getAttribute('aria-pressed')}));
 assert.equal(initial.text,'+-Сдвиг');
 assert.equal(initial.pressed,'false');
 await page.locator('#allVariantsShift').click();
 await page.waitForTimeout(500);
 const playing=await page.evaluate(()=>({
  shift:document.getElementById('allVariantsShift').getAttribute('aria-pressed'),
  plain:document.getElementById('allVariants').getAttribute('aria-pressed'),
  auto:state.radiusAuto,
  radiusDisabled:document.getElementById('radius').disabled,
  switchHidden:document.getElementById('radiusSwitch').hidden,
  motion:filmMotion,
  anim:!!animation,
  radius:displayRadius(),
  expected:autoRadius(sequenceIndex(state.variant),sequenceTotal())
 }));
 assert.equal(playing.shift,'true');
 assert.equal(playing.plain,'false');
 assert.equal(playing.auto,true);
 assert.equal(playing.radiusDisabled,true);
 assert.equal(playing.switchHidden,false);
 assert.equal(playing.motion,'variants');
 assert.equal(playing.anim,true);
 assert.equal(playing.radius,playing.expected);
 await page.locator('#allVariantsShift').click();
 await page.waitForTimeout(200);
 const stopped=await page.evaluate(()=>({shift:document.getElementById('allVariantsShift').getAttribute('aria-pressed'),anim:!!animation}));
 assert.equal(stopped.shift,'false');
 assert.equal(stopped.anim,false);
 await page.evaluate(()=>{state.radiusAuto=false;render();});
});

test('search accepts pasted lines and a dropped file, scans every frame and lists the found ones',async()=>{
 await page.evaluate(()=>{if(animation)stopFilm();state.variant=0;state.radius=0;state.selected=null;state.mode='xor';state.offsets=Array.from({length:4},()=>({x:0,y:0}));render();});
 await page.locator('#searchPattern').fill('1\n11');
 await page.locator('#searchRun').click();
 await page.waitForTimeout(150);
 const current=await page.evaluate(()=>({cells:document.querySelectorAll('#searchBits .search-cell').length,info:document.getElementById('searchInfo').textContent}));
 assert(current.cells>0);
 assert.match(current.info,/Найдено/);
 await page.locator('#searchAll').click();
 await page.waitForFunction(()=>!document.getElementById('searchAll').disabled&&document.getElementById('searchInfo').textContent.includes('Готово'),null,{timeout:120000});
 const scan=await page.evaluate(()=>({chips:document.querySelectorAll('#searchFound .found-chip').length,hidden:document.getElementById('searchFound').hidden,info:document.getElementById('searchInfo').textContent,title:document.getElementById('foundTitle').textContent,first:document.querySelector('#searchFound .found-chip')?.textContent}));
 assert(scan.chips>100);
 assert.equal(scan.hidden,false);
 assert.match(scan.info,/Готово/);
 assert.match(scan.title,/Найденные кадры: \d+/);
 const scanYellow=await page.evaluate(()=>({found:[...document.querySelectorAll('#searchPatternHits .search-pattern.found')].map(span=>span.textContent)}));
 assert.deepEqual(scanYellow.found.slice().sort(),['1','11'].sort());
 await page.locator('#searchFound .found-chip').first().click();
 await page.waitForTimeout(150);
 const jumped=await page.evaluate(()=>({variant:state.variant,frame:document.getElementById('frame').value,highlight:document.querySelectorAll('#searchBits .search-cell').length}));
 assert.equal(jumped.variant,Number(scan.first)-1);
 assert(jumped.highlight>0);
 await page.locator('#searchFoundClear').click();
 const cleared=await page.evaluate(()=>({chips:document.querySelectorAll('#searchFound .found-chip').length,hidden:document.getElementById('searchFound').hidden}));
 assert.equal(cleared.chips,0);
 assert.equal(cleared.hidden,true);
 await page.evaluate(async()=>{
  const transfer=new DataTransfer();
  transfer.items.add(new File(['101\n001'],'bits.txt',{type:'text/plain'}));
  document.getElementById('searchPattern').dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true}));
  await new Promise(resolve=>setTimeout(resolve,300));
 });
 assert.equal(await page.locator('#searchPattern').inputValue(),'101\n001');
 assert.equal(await page.evaluate(()=>document.querySelectorAll('#searchPatternHits .search-pattern.found').length),0);
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

test('layout readout keeps its right edge while the number grows',async()=>{
 const geom=()=>page.evaluate(()=>{
  const range=document.querySelector('.frame-range'),thumb=range.querySelector('.x-thumb');
  const tb=thumb.getBoundingClientRect(),track=getComputedStyle(range.querySelector('.x-track')),play=range.querySelector('.thumb-play');
  return {value:Number(document.getElementById('frame').value),number:range.querySelector('.x-number').textContent,left:Math.round(tb.left),right:Math.round(tb.right),plus:range.querySelector('.x-center').textContent,trackBg:track.backgroundImage.includes('repeating-linear-gradient'),trackHeight:track.height,play:play.textContent,playing:play.classList.contains('playing'),page:document.documentElement.scrollWidth};
 });
 await page.evaluate(()=>{const frame=document.getElementById('frame');frame.value='1';frame.dispatchEvent(new Event('input'));});
 await page.waitForTimeout(150);
 const one=await geom();
 await page.evaluate(()=>{const frame=document.getElementById('frame');frame.value='4000';frame.dispatchEvent(new Event('input'));});
 await page.waitForTimeout(150);
 const wide=await geom();
 assert.equal(wide.number,'4000');
 assert.equal(wide.right,one.right,'the right edge stays put');
 assert.ok(wide.left<one.left,'a wider number grows to the left');
 assert.equal(wide.plus,'+');
 assert.equal(wide.trackBg,true,'the line is dashed');
 assert.equal(wide.trackHeight,'3px','the line is thicker');
 const box=await page.locator('.frame-range').scrollIntoViewIfNeeded().then(()=>page.locator('.frame-range').boundingBox());
 await page.mouse.move(box.x+box.width/2,box.y+20);
 await page.mouse.down();
 await page.mouse.move(box.x+box.width/2+50,box.y+20,{steps:4});
 await page.mouse.up();
 await page.waitForTimeout(150);
 const dragged=await geom();
 assert.notEqual(dragged.value,wide.value);
 assert.equal(dragged.right,wide.right,'the right edge stays put while scrubbing');
 await page.evaluate(()=>{const frame=document.getElementById('frame');frame.value='1';frame.dispatchEvent(new Event('input'));});
 await page.locator('#play').click();
 await page.waitForTimeout(700);
 const playing=await geom();
 await page.locator('#play').click();
 assert.equal(playing.right,one.right,'the right edge stays put during playback');
 assert.notEqual(playing.number,'1');
 assert.equal(playing.play,'!!');
 assert.equal(playing.playing,true);
 assert(playing.page<=1100);
});

test('the square field size can grow to keep the shifted figures inside',async()=>{
 await page.evaluate(()=>{if(animation)stopFilm();state.radius=7;state.selected=null;state.mode='xor';state.offsets=Array.from({length:4},()=>({x:0,y:0}));render();});
 const small=await page.evaluate(()=>({ones:[...fieldCells(state.variant,7,state.selected,state.mode,state.offsets)].filter(value=>value===1).length,label:document.getElementById('fieldLabel').textContent}));
 await page.locator('[data-field-size="41"]').click();
 await page.waitForTimeout(250);
 const big=await page.evaluate(()=>{
  const cells=fieldCells(state.variant,7,state.selected,state.mode,state.offsets);
  return {viewBox:document.getElementById('field').getAttribute('viewBox'),label:document.getElementById('fieldLabel').textContent,cells:cells.length,ones:[...cells].filter(value=>value===1).length,pressed:document.querySelector('[data-field-size="41"]').getAttribute('aria-pressed'),tiles:[...document.querySelectorAll('#tiles svg')].every(svg=>svg.getAttribute('viewBox')==='0 0 41 41')};
 });
 assert.equal(big.viewBox,'0 0 41 41');
 assert.equal(big.label,'Поле / 41 x 41');
 assert.equal(big.cells,1681);
 assert(big.ones>small.ones,'the far arms leave the compact field but fit the larger one');
 assert.equal(big.pressed,'true');
 assert.equal(big.tiles,true);
 await page.locator('[data-field-size="29"]').click();
 await page.evaluate(()=>{state.radius=0;render();});
 await page.waitForTimeout(200);
 const back=await page.evaluate(()=>({viewBox:document.getElementById('field').getAttribute('viewBox'),label:document.getElementById('fieldLabel').textContent,pressed:document.querySelector('[data-field-size="29"]').getAttribute('aria-pressed')}));
 assert.equal(back.viewBox,'0 0 29 29');
 assert.equal(back.label,'Поле / 29 x 29');
 assert.equal(back.pressed,'true');
});

test('the redesign fits a 390 px phone without sideways scrolling',async()=>{
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(250);
 const fit=await page.evaluate(()=>({width:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('button')].filter(button=>{const box=button.getBoundingClientRect();return box.width>0&&(box.left<-.5||box.right>390.5);}).map(button=>button.id||button.textContent.trim().slice(0,12))}));
 assert(fit.width<=390);
 assert.deepEqual(fit.buttons,[]);
});
