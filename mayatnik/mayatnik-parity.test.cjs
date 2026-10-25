const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'Zerkalius-mayatnik.html'),'utf8'),gpu=fs.readFileSync(path.join(__dirname,'mayatnik-gpu.js'),'utf8'),menu=fs.readFileSync(path.join(__dirname,'mayatnik-menu.js'),'utf8'),parity=require('../_js/grid-parity.js');
function fn(name){const start=html.indexOf('function '+name+'(');assert.ok(start>=0,name);const brace=html.indexOf('{',start);let depth=1,i=brace+1;for(;depth&&i<html.length;i++){if(html[i]==='{')depth++;else if(html[i]==='}')depth--;}return html.slice(start,i);}
function context(settings={},extra={}){
  const f={W:8,H:4,val:new Int8Array(32).fill(1)},img={width:4,height:4,data:new Uint8ClampedArray(64)};
  const c=vm.createContext({st:{parity:settings,view:'bits'},VX:2,VW:4,VH:4,RK:1,RG:1,geo:{anchor:4},f,img,EMPTY:[0,0,0],rgba:()=>0xff000000,rombP:()=>-1,halfOf:fx=>[-1,fx],outShow:()=>false,paintBits:null,templateMatchLayer:null,parityVisible:(r,col)=>parity.visible(r,col,settings),parityActive:()=>parity.active(settings),...extra});
  for(const name of ['rombCell','fieldCellAt','parityMask','rasterBit'])vm.runInContext(fn(name),c);return c;
}
test('flat view mask uses absolute field columns after crop and leaves bits and paint untouched',()=>{
  const c=context({cellsEven:false}),before=c.f.val.slice(),pixels=new Uint32Array(16).fill(0xffabcdef);c.fillMask=new Uint32Array(16).fill(0xfffedcba);const paint=c.fillMask.slice();
  c.parityMask(pixels);for(let r=0;r<4;r++)for(let x=0;x<4;x++)assert.equal(pixels[r*4+x],parity.visible(r,x+2,c.st.parity)?0xffabcdef:0xff000000);
  assert.deepEqual(c.f.val,before);assert.deepEqual(c.fillMask,paint);
});
test('scaled raster mask hides complete source cells and uses one-based row parity',()=>{
  const c=context({rowsOdd:false},{RK:2,img:{width:8,height:8}}),px=new Uint32Array(64).fill(5);c.parityMask(px);
  for(let y=0;y<8;y++)for(let x=0;x<8;x++)assert.equal(px[y*8+x],Math.floor(y/2)%2===0?0xff000000:5);
});
test('all 16 switch combinations produce the same CPU final mask and GPU parity decision',()=>{
  const keys=['cellsEven','cellsOdd','rowsEven','rowsOdd'];
  const shader=gpu.match(/fn parityShown\([^]*?\n/)[0];assert.match(shader,/P\[28 \+ pm2\(r \+ fc\)\]/);assert.match(shader,/P\[30 \+ pm2\(r \+ 1\)\]/);
  const upload=gpu.match(/for\(const \[i,key\]of \['cellsEven'[^\n]+/)[0];
  for(let bits=0;bits<16;bits++){const settings=Object.fromEntries(keys.map((k,i)=>[k,!!(bits&(1<<i))])),c=context(settings),px=new Uint32Array(16).fill(7),P=new Int32Array(32);vm.runInNewContext(upload,{P,o:{parity:settings}});c.parityMask(px);
    for(let r=0;r<4;r++)for(let col=2;col<6;col++){const shown=P[28+(r+col)%2]!==0&&P[30+(r+1)%2]!==0;assert.equal(px[r*4+col-2]===7,shown,JSON.stringify({bits,r,col}));}
  }
  assert.match(gpu,/if \(!parityShown\(r, fc\)\) \{ return -1;/);assert.match(gpu,/if \(!parityShown\(Y, C \+ P\[1\]\)\) \{ pic\[o\] = u32\(P\[22\]\); return;/);
});
test('final composition mask anchors both diamond panels to the same source column origin',()=>{
  const {JSDOM}=require('C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom'),dom=new JSDOM('<div class="may-layer-scene"></div><canvas id="colourTemplate"></canvas>'),doc=dom.window.document;
  const c=context({rowsOdd:false},{document:doc,ovlDraw:()=>{},rombP:()=>2,dispW:()=>9,scale:()=>8,cv:{getBoundingClientRect:()=>({left:10,top:20})}});
  for(const node of doc.querySelectorAll('*'))node.getBoundingClientRect=()=>({left:0,top:0});vm.runInContext(fn('parityOverlayMask'),c);c.parityOverlayMask();
  const style=doc.querySelector('.may-layer-scene').style,svg=decodeURIComponent(style.getPropertyValue('mask-image'));
  assert.match(svg,/patternTransform="translate\(0 0\)"/);assert.match(svg,/patternTransform="translate\(5 0\)"/);assert.match(svg,/<rect x="5" width="4" height="4"/);assert.equal(style.getPropertyValue('mask-position'),'10px 20px');assert.equal(style.getPropertyValue('mask-size'),'72px 32px');
  c.parityActive=()=>false;c.parityOverlayMask();assert.equal(style.getPropertyValue('mask-image'),'');dom.window.close();
});
test('both menu pairs have independent keyboard and pointer controls with pressed states',()=>{
  const {JSDOM}=require('C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom'),dom=new JSDOM('<div id="view"></div>'),doc=dom.window.document,settings={cellsEven:true,cellsOdd:true,rowsEven:true,rowsOdd:true},toolSync=[];
  const api={get:()=>({...settings}),set:(key,v)=>settings[key]=v},run=menu.slice(menu.indexOf('  // Independent view switches:'),menu.indexOf('  // v0.226:',menu.indexOf('  // Independent view switches:')));
  vm.runInNewContext(run,{document:doc,window:{mayParity:api},gView:doc.getElementById('view'),toolSync,rail:{refresh:()=>{}},placeTools:()=>toolSync.forEach(f=>f())});toolSync.forEach(f=>f());
  const parts=doc.querySelectorAll('.gz-half');assert.equal(parts.length,4);parts[0].click();assert.equal(settings.cellsEven,false);assert.equal(settings.cellsOdd,true);assert.equal(settings.rowsEven,true);assert.equal(parts[0].getAttribute('aria-pressed'),'false');
  parts[3].dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:' ',bubbles:true,cancelable:true}));assert.equal(settings.rowsOdd,false);assert.equal(settings.rowsEven,true);assert.equal(parts[3].getAttribute('aria-pressed'),'false');dom.window.close();
});
test('hidden hits and manually edited pixels cannot bypass visibility',()=>{
  const c=context({cellsEven:false},{paintBits:new Int8Array(16).fill(0)});assert.equal(c.fieldCellAt(0,0),null);assert.equal(c.rasterBit(0,0),-1);assert.equal(c.rasterBit(0,0,true),-1);assert.equal(c.fieldCellAt(1,0).c,3);assert.equal(c.rasterBit(1,0),0);
});
test('diamond masks follow source cell coordinates in both lattice panels',()=>{
  for(const p of [0,1]){const c=context({rowsOdd:false},{RK:2,rombP:()=>p,img:{width:8,height:8},halfOf:fx=>[p,fx]}),px=new Uint32Array(64).fill(9);c.parityMask(px);
    for(let y=0;y<8;y++)for(let x=0;x<8;x++){const[col,row]=c.rombCell((x+.5)/2,(y+.5)/2,p);assert.equal(px[y*8+x],parity.visible(row,col,c.st.parity)?9:0xff000000);}
  }
});
test('digitsOnly draws labels only for visible source cells',()=>{
  let labels=0;const g=new Proxy({fillText:()=>labels++},{get:(o,k)=>o[k]||(()=>{})}),rect={left:0,top:0},c=context({cellsOdd:false,rowsOdd:false},{digitsRaf:0,window:{},st:{parity:{cellsOdd:false,rowsOdd:false},view:'digitsOnly',digitSize:80},scale:()=>8,dispW:()=>4,gpuBig:null,cv:{style:{},getBoundingClientRect:()=>rect},gpuCv:null,wrap:{getBoundingClientRect:()=>rect,clientWidth:32,clientHeight:32},digitCanvas:{style:{}},digitG:g,devicePixelRatio:1,digitFamily:()=> 'mono',fillMask:null,stolbPaint:null,layerService:()=>{}});
  vm.runInContext(fn('drawDigits'),c);c.drawDigits();assert.equal(labels,4);
});
test('parity setting changes persist and redraw without rebuilding or changing source bits',()=>{
  let saves=0,draws=0;const settings={cellsEven:true,cellsOdd:true,rowsEven:true,rowsOdd:true},c=context(settings,{window:{},save:()=>saves++,draw:()=>draws++,clearFillPreview:()=>{}}),before=c.f.val.slice();
  c.parityOverlayMask=()=>{};const line=html.match(/window\.mayParity=\{[^\n]+/)[0];vm.runInContext(line,c);c.window.mayParity.set('rowsEven',false);assert.equal(c.st.parity.rowsEven,false);assert.equal(saves,1);assert.equal(draws,1);assert.deepEqual(c.f.val,before);assert.equal(c.fillBits,null);
  c.window.mayParity.set('wrong',false);assert.equal(saves,1);
});
test('inline source and external scripts parse with both CPU and GPU guards connected',()=>{
  for(const match of html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);new vm.Script(gpu);new vm.Script(menu);
  assert.match(html,/grid-parity\.js/);assert.match(html,/passes: M\.out, parity:st\.parity/);assert.match(html,/templateMatchApply\(px\);parityMask\(px\);present/);
  assert.match(menu,/\['parityCells','Клетки'/);assert.match(menu,/\['parityRows','Строки'/);assert.match(menu,/part\.setAttribute\('aria-pressed',String\(on\)\)/);
});
