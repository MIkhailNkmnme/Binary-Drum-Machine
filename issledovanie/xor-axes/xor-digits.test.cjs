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

test('the digits layer starts empty and the cells keep their own colours',async()=>{
 const initial=await page.evaluate(()=>({
  pressed:document.getElementById('digitsToggle').getAttribute('aria-pressed'),
  nodes:document.querySelectorAll('#digitBits text').length,
  background:getComputedStyle(document.getElementById('field')).backgroundColor,
  bits:getComputedStyle(document.getElementById('bits')).display,
  digits:getComputedStyle(document.getElementById('digitBits')).display
 }));
 assert.deepEqual(initial,{pressed:'false',nodes:0,background:'rgb(253, 0, 0)',bits:'inline',digits:'none'});
});

test('digits are written over the existing black and red cells, not instead of them',async()=>{
 await page.locator('#digitsToggle').click();
 const result=await page.evaluate(()=>{
  const cells=fieldCells(state.variant,state.radius,state.selected,state.mode,state.offsets);
  const nodes=[...document.querySelectorAll('#digitBits text')],bad=[];
  nodes.forEach((node,i)=>{
   const value=cells[i],text=value===2?'':String(value),kind=value===2?'digit-pivot':value?'digit-one':'digit-zero';
   if(node.textContent!==text||node.getAttribute('class')!==kind)bad.push(i);
   if(value===2)return;
   if(getComputedStyle(node).fill!==(value?'rgb(244, 240, 232)':'rgb(0, 0, 0)'))bad.push('fill'+i);
   if(+node.getAttribute('x')!==i%29+.5||+node.getAttribute('y')!==Math.floor(i/29)+.5)bad.push('xy'+i);
  });
  return {
   count:nodes.length,bad:bad.slice(0,8),badCount:bad.length,
   ones:cells.filter(value=>value===1).length,zeros:cells.filter(value=>value===0).length,
   background:getComputedStyle(document.getElementById('field')).backgroundColor,
   bits:getComputedStyle(document.getElementById('bits')).display,
   digitLayer:getComputedStyle(document.getElementById('digitBits')).display,
   pressed:document.getElementById('digitsToggle').getAttribute('aria-pressed'),
   body:document.body.classList.contains('digits')
  };
 });
 assert.equal(result.badCount,0,JSON.stringify(result.bad));
 assert.equal(result.count,841);
 assert.equal(result.ones+result.zeros,840);
 assert(result.ones>0&&result.zeros>0);
 assert.equal(result.background,'rgb(253, 0, 0)','the field keeps its background');
 assert.equal(result.bits,'inline','the filled cells stay visible');
 assert.equal(result.digitLayer,'inline');
 assert.equal(result.pressed,'true');
 assert.equal(result.body,true);
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

test('digit colours and the whole palette are configurable and reset together',async()=>{
 const colours=await page.evaluate(()=>{
  const set=(id,value)=>{const input=document.getElementById(id);input.value=value;input.dispatchEvent(new Event('input'));};
  set('colorDigitOne','#00ff00');set('colorDigitZero','#0000ff');
  set('colorFieldBg','#102030');set('colorBit','#abcdef');set('colorAxes','#ffcc00');
  const one=document.querySelector('#digitBits .digit-one'),zero=document.querySelector('#digitBits .digit-zero');
  return {
   one:getComputedStyle(one).fill,zero:getComputedStyle(zero).fill,
   background:getComputedStyle(document.getElementById('field')).backgroundColor,
   bits:getComputedStyle(document.getElementById('bits')).fill,
   tile:getComputedStyle(document.querySelector('.tile svg rect')).fill,
   grid:getComputedStyle(document.querySelector('.grid')).stroke
  };
 });
 assert.deepEqual(colours,{one:'rgb(0, 255, 0)',zero:'rgb(0, 0, 255)',background:'rgb(16, 32, 48)',bits:'rgb(171, 205, 239)',tile:'rgb(16, 32, 48)',grid:'rgb(255, 204, 0)'});
 await page.locator('#resetColors').click();
 const reset=await page.evaluate(()=>({
  one:getComputedStyle(document.querySelector('#digitBits .digit-one')).fill,
  zero:getComputedStyle(document.querySelector('#digitBits .digit-zero')).fill,
  background:getComputedStyle(document.getElementById('field')).backgroundColor,
  bits:getComputedStyle(document.getElementById('bits')).fill
 }));
 assert.deepEqual(reset,{one:'rgb(244, 240, 232)',zero:'rgb(0, 0, 0)',background:'rgb(253, 0, 0)',bits:'rgb(0, 0, 0)'});
});

test('GIF and video raster carries shadows, digits and the chosen colours',async()=>{
 const result=await page.evaluate(()=>{
  document.getElementById('resetAll').click();
  state.digits=false;state.ghosts=false;state.grid=false;state.shadows=true;state.variant=1576;state.radius=0;state.selected=null;state.mode='xor';render();
  const config=settings(),frame=plan(config)[0],plain=raster(config,frame);
  const cells=fieldCells(frame.variant,config.radius,config.selected,frame.mode,config.offsets,config.points);
  const at=(x,y)=>{const i=(y*side+x)*4;return [plain[i],plain[i+1],plain[i+2]];};
  let light=0,dark=0;
  for(let i=0;i<plain.length;i+=4){
   if(plain[i]===233&&plain[i+1]===233&&plain[i+2]===233)light++;
   if(plain[i]===43&&plain[i+1]===45&&plain[i+2]===52)dark++;
  }
  // Digits and custom colours in the same raster.
  const set=(id,value)=>{const input=document.getElementById(id);input.value=value;input.dispatchEvent(new Event('input'));};
  set('colorDigitOne','#ff00ff');set('colorDigitZero','#ffff00');set('colorFieldBg','#101820');set('colorBit','#e0e0e0');
  state.digits=true;state.shadows=false;render();
  const withDigits=raster(settings(),plan(settings())[0]);
  let magenta=0,yellow=0,corner=[withDigits[0],withDigits[1],withDigits[2]];
  for(let i=0;i<withDigits.length;i+=4){
   if(withDigits[i]===255&&withDigits[i+1]===0&&withDigits[i+2]===255)magenta++;
   if(withDigits[i]===255&&withDigits[i+1]===255&&withDigits[i+2]===0)yellow++;
  }
  return {side,cellPixels,light,dark,magenta,yellow,corner,plainLength:plain.length,different:plain.length!==withDigits.length||plain.some((v,i)=>v!==withDigits[i])};
 });
 assert.equal(result.side,464);
 assert.equal(result.cellPixels,16);
 assert.equal(result.plainLength,result.side*result.side*4);
 assert(result.light>50,'light drop shadow');
 assert(result.dark>50,'dark drop shadow');
 assert(result.magenta>20,'digit 1 colour in raster');
 assert(result.yellow>20,'digit 0 colour in raster');
 assert.deepEqual(result.corner,[16,24,32],'raster background follows the colour picker');
 assert.equal(result.different,true);
});

test('MP3 duration and the resulting frame rate appear immediately',async()=>{
 const rate=8000,seconds=1,samples=rate*seconds,data=Buffer.alloc(samples*2);
 for(let i=0;i<samples;i++)data.writeInt16LE(Math.round(Math.sin(2*Math.PI*440*i/rate)*6000),i*2);
 const header=Buffer.alloc(44);
 header.write('RIFF',0);header.writeUInt32LE(36+data.length,4);header.write('WAVE',8);header.write('fmt ',12);
 header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(rate,24);
 header.writeUInt32LE(rate*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);
 header.writeUInt32LE(data.length,40);
 await page.setInputFiles('#audioFile',{name:'test.wav',mimeType:'audio/wav',buffer:Buffer.concat([header,data])});
 await page.waitForFunction(()=>typeof audioDuration==='number'&&audioDuration>0,null,{timeout:20000});
 const info=await page.evaluate(()=>({audio:document.getElementById('audioInfo').textContent,video:document.getElementById('videoInfo').textContent,duration:audioDuration}));
 assert.match(info.audio,/Длительность: 1[.,]0 с/);
 assert.match(info.video,/1[.,]0 с/);
 assert.match(info.video,/кадров\/с/);
 assert.match(info.video,/кадр/);
});

test('off returns the filled field, and the page fits a 390 px phone',async()=>{
 await page.locator('#resetColors').click();
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
 const mobile=await page.evaluate(()=>({width:document.documentElement.scrollWidth,field:document.getElementById('field').getBoundingClientRect().toJSON()}));
 assert(mobile.width<=390);
 assert(mobile.field.left>=0&&mobile.field.right<=390);
});
