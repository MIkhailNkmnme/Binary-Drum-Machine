'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'../..');
let server,browser,page;const errors=[];
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css'};
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

test('button starts off and the digit layer stays empty until it is pressed',async()=>{
 const initial=await page.evaluate(()=>({
  pressed:document.getElementById('digitsToggle').getAttribute('aria-pressed'),
  nodes:document.querySelectorAll('#digitBits text').length,
  background:getComputedStyle(document.getElementById('field')).backgroundColor,
  bits:getComputedStyle(document.getElementById('bits')).display,
  digits:getComputedStyle(document.getElementById('digitBits')).display
 }));
 assert.deepEqual(initial,{pressed:'false',nodes:0,background:'rgb(253, 0, 0)',bits:'inline',digits:'none'});
});

test('every cell is labelled with its bit: 1 black, 0 red, grey centres left blank',async()=>{
 await page.locator('#digitsToggle').click();
 const result=await page.evaluate(()=>{
  const cells=fieldCells(state.variant,state.radius,state.selected,state.mode,state.offsets);
  const nodes=[...document.querySelectorAll('#digitBits text')],bad=[];
  nodes.forEach((node,i)=>{
   const value=cells[i],text=value===2?'':String(value),kind=value===2?'digit-pivot':value?'digit-one':'digit-zero';
   if(node.textContent!==text||node.getAttribute('class')!==kind)bad.push(i);
   if(value===2)return;
   if(getComputedStyle(node).fill!==(value?'rgb(0, 0, 0)':'rgb(253, 0, 0)'))bad.push('fill'+i);
   if(+node.getAttribute('x')!==i%29+.5||+node.getAttribute('y')!==Math.floor(i/29)+.5)bad.push('xy'+i);
  });
  return {
   count:nodes.length,bad:bad.slice(0,8),badCount:bad.length,
   ones:cells.filter(value=>value===1).length,zeros:cells.filter(value=>value===0).length,
   background:getComputedStyle(document.getElementById('field')).backgroundColor,
   bits:getComputedStyle(document.getElementById('bits')).display,
   pressed:document.getElementById('digitsToggle').getAttribute('aria-pressed'),
   body:document.body.classList.contains('digits')
  };
 });
 assert.equal(result.badCount,0,JSON.stringify(result.bad));
 assert.equal(result.count,841);
 assert.equal(result.ones+result.zeros,840);
 assert(result.ones>0&&result.zeros>0);
 assert.equal(result.background,'rgb(244, 240, 232)');
 assert.equal(result.bits,'none');
 assert.equal(result.pressed,'true');
 assert.equal(result.body,true);
 if(process.env.XOR_DIGITS_SCREENSHOT)await page.locator('#field').screenshot({path:path.join(__dirname,'xor-digits-field.png')});
});

test('labels follow every layout change, all three operations and the reset',async()=>{
 const mismatches=await page.evaluate(()=>{
  const compare=()=>{
   const cells=fieldCells(state.variant,state.radius,state.selected,state.mode,state.offsets);
   const nodes=document.querySelectorAll('#digitBits text');
   for(let i=0;i<cells.length;i++)if(nodes[i].textContent!==(cells[i]===2?'':String(cells[i])))return i;
   return -1;
  };
  const bad=[];
  for(const variant of [0,1576,4000,6143]){state.variant=variant;render();const at=compare();if(at>=0)bad.push([variant,state.mode,at]);}
  for(const mode of ['union','solo']){state.mode=mode;state.selected=mode==='solo'?1:null;state.variant=1576;render();const at=compare();if(at>=0)bad.push([1576,mode,at]);}
  state.mode='xor';state.selected=null;
  document.getElementById('resetAll').click();
  const at=compare();if(at>=0)bad.push(['reset','xor',at]);
  return {bad,digits:state.digits};
 });
 assert.deepEqual(mismatches.bad,[]);
 assert.equal(mismatches.digits,true,'reset keeps the reading mode on');
});

test('grid, silhouettes, axes and grey centres keep readable colours over the light field',async()=>{
 await page.locator('#gridToggle').click();
 await page.locator('#ghostToggle').click();
 await page.waitForTimeout(80);
 const colours=await page.evaluate(()=>({
  grid:getComputedStyle(document.querySelector('#field .grid')).stroke,
  ghost:getComputedStyle(document.getElementById('ghostBits')).opacity,
  axes:getComputedStyle(document.getElementById('symAxes')).stroke,
  glow:getComputedStyle(document.getElementById('symAxesGlow')).stroke,
  pivot:getComputedStyle(document.getElementById('pivotBits')).filter
 }));
 assert.deepEqual(colours,{grid:'rgb(181, 172, 163)',ghost:'0.16',axes:'rgb(24, 22, 20)',glow:'rgb(244, 240, 232)',pivot:'none'});
});

test('export plan and raster stay the same with the reading mode on',async()=>{
 const same=await page.evaluate(()=>{
  const beforeFrames=JSON.stringify(plan(settings())),beforePixels=[...raster(settings(),plan(settings())[0])];
  state.digits=true;render();
  const afterFrames=JSON.stringify(plan(settings())),afterPixels=[...raster(settings(),plan(settings())[0])];
  return {frames:beforeFrames===afterFrames,pixels:beforePixels.every((value,i)=>value===afterPixels[i])};
 });
 assert.deepEqual(same,{frames:true,pixels:true});
});

test('off returns the filled red field, and the page fits a 390 px phone',async()=>{
 await page.locator('#digitsToggle').click();
 const off=await page.evaluate(()=>({
  pressed:document.getElementById('digitsToggle').getAttribute('aria-pressed'),
  background:getComputedStyle(document.getElementById('field')).backgroundColor,
  bits:getComputedStyle(document.getElementById('bits')).display,
  digits:getComputedStyle(document.getElementById('digitBits')).display
 }));
 assert.deepEqual(off,{pressed:'false',background:'rgb(253, 0, 0)',bits:'inline',digits:'none'});
 await page.locator('#digitsToggle').click();
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(150);
 const mobile=await page.evaluate(()=>{
  const button=document.getElementById('digitsToggle').getBoundingClientRect(),field=document.getElementById('field').getBoundingClientRect();
  return {width:document.documentElement.scrollWidth,button:[button.left,button.right,button.height],field:[field.left,field.right]};
 });
 assert(mobile.width<=390);
 assert(mobile.button[0]>=0&&mobile.button[1]<=390&&mobile.button[2]>=44);
 assert(mobile.field[0]>=0&&mobile.field[1]<=390);
 if(process.env.XOR_DIGITS_SCREENSHOT)await page.locator('#field').screenshot({path:path.join(__dirname,'xor-digits-mobile.png')});
});
