/* DOM/runtime smoke checks; no browser or pixel rendering. Set SETKA_JSDOM to a jsdom package path if it is not installed locally. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let JSDOM,VirtualConsole;
for(const location of ['jsdom',process.env.SETKA_JSDOM,path.join(process.env.TEMP||'/tmp','codex-setka-dom/node_modules/jsdom')].filter(Boolean)){
  try{({JSDOM,VirtualConsole}=require(location));break;}catch{}
}
if(!JSDOM)throw new Error('Startup checks require jsdom. Install it outside the repo and set SETKA_JSDOM to that package directory.');
const old={rows:['111','010','101'],grids:{rows:['10','01'],cur:0,align:'center',text:'',textBlocks:[],colors:{},groups:{},dots:{},lines:{},scenes:[],tool:'',version:1},rmb:{cell:'tri',al:'zz',ln:'each',out:true}};
function boot(){
  const errors=[],console=new VirtualConsole();console.on('jsdomError',e=>errors.push(e));
  const html=fs.readFileSync(path.join(__dirname,'Zerkalius-setka.html'),'utf8');
  const dom=new JSDOM(html,{url:'http://setka.test/setka/Zerkalius-setka.html',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:console});
  const w=dom.window,ctx=dom.getInternalVMContext(),frames=new Map();let frame=0;
  w.localStorage.setItem('zazerkalius_v1',JSON.stringify(old));
  w.requestAnimationFrame=fn=>{frames.set(++frame,fn);return frame;};w.cancelAnimationFrame=id=>frames.delete(id);
  w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  w.ResizeObserver=class{observe(){}disconnect(){}};
  w.Path2D=class{moveTo(){}lineTo(){}closePath(){}arc(){}rect(){}addPath(){}};
  const noop=()=>{},context=new Proxy({measureText:t=>({width:String(t).length*7}),getLineDash:()=>[],createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop}),getImageData:()=>({data:new Uint8ClampedArray(4)})},{get:(o,k)=>k in o?o[k]:noop});
  w.HTMLCanvasElement.prototype.getContext=function(){context.canvas=this;return context;};
  Object.defineProperties(w.HTMLCanvasElement.prototype,{clientWidth:{get:()=>800},clientHeight:{get:()=>600}});
  w.HTMLCanvasElement.prototype.getBoundingClientRect=()=>({left:0,top:0,right:800,bottom:600,width:800,height:600,x:0,y:0});
  w.SVGElement.prototype.getBBox=()=>({x:0,y:0,width:120,height:24});
  w.HTMLElement.prototype.scrollIntoView=noop;w.HTMLElement.prototype.setPointerCapture=noop;w.HTMLElement.prototype.releasePointerCapture=noop;
  w.confirm=()=>true;w.prompt=()=>null;
  for(const script of [...w.document.querySelectorAll('script[src]')]){
    const file=path.resolve(__dirname,script.getAttribute('src').split('?')[0]);
    vm.runInContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});
  }
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  const flush=()=>{for(let n=0;n<10&&frames.size;n++){const next=[...frames.values()];frames.clear();for(const fn of next)fn(n*16);}assert.equal(frames.size,0,'refresh must settle without a perpetual animation loop');assert.deepEqual(errors,[]);};
  flush();
  return {w,dom,flush,run:code=>vm.runInContext(code,ctx),proxy:id=>w.document.querySelector('#mayatnikRail [data-source="'+id+'"]')};
}
test('real standalone scripts start; every live toolbar control has one proxy; no legacy settings proxy',()=>{
 const app=boot();try{const {w}=app,source=w.document.getElementById('gridsToolbar');assert.equal(source.hidden,true);
  assert.equal(w.document.querySelectorAll('#mayatnikRail .gz-group').length,6);
  const controls=[...source.querySelectorAll('button,input,select,textarea')].filter(e=>e.id!=='bRmbSettings');
  assert.equal(w.document.querySelectorAll('#mayatnikRail [data-pan]').length,controls.length);
  for(const control of controls.filter(e=>e.id))assert.ok(app.proxy(control.id),control.id);
  assert.equal(app.proxy('bRmbSettings'),null);
  for(const id of ['pageUndo','pageRedo','pageHelp','gridsRowsLock','gridsRowAdd'])assert.ok(w.document.getElementById(id).classList.contains('gz-hx'),id);
 }finally{app.dom.window.close();}
});
test('proxy mode button renders all four grid modes without modifying rows',()=>{
 const app=boot();try{const rows=app.run('JSON.stringify(gridsState().rows)'),seen=[];
  for(let i=0;i<4;i++){seen.push(app.run('rmbSt().cell'));app.proxy('bRmbCell').click();app.flush();assert.equal(app.run('JSON.stringify(gridsState().rows)'),rows);}
  assert.deepEqual(seen,['tri','rmb','square','ring']);
 }finally{app.dom.window.close();}
});
test('import replaces only standalone cells, edits/undo/save leave source rows intact',()=>{
 const app=boot();try{const {w}=app,original=w.localStorage.getItem('zazerkalius_v1');
  app.run("gridsState().colors={'0,0':'#ff0000'};gridsState().dots={'0,0':{color:'#ff0000',size:2}};");
  w.document.getElementById('gridsRowsImport').click();app.flush();
  assert.equal(app.run('JSON.stringify(gridsState().rows)'),JSON.stringify(old.rows));
  assert.equal(app.run('Object.keys(gridsState().colors).length'),0);assert.equal(app.run('Object.keys(gridsState().dots).length'),0);
  app.proxy('gridsClear').click();app.flush();assert.equal(app.run('gridsState().rows.some(row=>row.includes("1"))'),false);
  w.document.getElementById('pageUndo').click();app.flush();assert.equal(app.run('JSON.stringify(gridsState().rows)'),JSON.stringify(old.rows));
  assert.equal(w.localStorage.getItem('zazerkalius_v1'),original);
  assert.equal(app.run('Z.rows'),undefined);
  assert.deepEqual(JSON.parse(w.localStorage.getItem('zerklus_setka_v1')).grids.rows,old.rows);
 }finally{app.dom.window.close();}
});
test('dynamic scene choices and native field proxies update live sources, visibility and disabled states',()=>{
 const app=boot();try{const {w}=app;
  app.proxy('gridsSceneNew').click();app.flush();
  const scene=app.proxy('gridsScenes'),options=scene.gzList.options();assert.ok(options.some(o=>o.name==='Сцена 1'));
  const number=app.proxy('gridsStroke').querySelector('input');number.value='7';number.dispatchEvent(new w.Event('input',{bubbles:true}));app.flush();assert.equal(w.document.getElementById('gridsStroke').value,'7');
  const color=app.proxy('gridsColor').querySelector('input');color.value='#abcdef';color.dispatchEvent(new w.Event('input',{bubbles:true}));app.flush();assert.equal(w.document.getElementById('gridsColor').value,'#abcdef');
  assert.equal(app.proxy('bRmbAxisApply').hidden,true);app.proxy('bRmbAxis').click();app.flush();assert.equal(app.proxy('bRmbAxisApply').hidden,false);assert.equal(app.proxy('bRmbAxisApply').getAttribute('aria-disabled'),'true');
  const head=w.document.querySelector('#mayatnikRail .gz-head'),pin=head.querySelector('.gz-pin');pin.click();app.flush();assert.ok(head.parentElement.classList.contains('gz-pinned'));assert.ok(JSON.parse(w.localStorage.getItem('grozd:setka')).pin.includes(head.parentElement.dataset.id));
 }finally{app.dom.window.close();}
});
test('dynamic letter actions use shared buttons and retain deletion handlers',()=>{
 const app=boot();try{const {w}=app;w.prompt=()=> 'А';app.proxy('bRmbType').click();app.flush();
  const stats=w.document.getElementById('rmbTextStats');assert.equal(stats.hidden,false);
  const buttons=[...stats.querySelectorAll('button')];assert.ok(buttons.length>=2);assert.ok(buttons.every(b=>b.classList.contains('gz-hx')));
  assert.equal(stats.querySelectorAll('th.gz-hx,td.gz-hx').length,0,'numeric table cells keep their existing form');
  const erase=buttons.find(b=>/все|всё/i.test(b.title));assert.ok(erase);erase.click();app.flush();assert.equal(stats.hidden,true);
 }finally{app.dom.window.close();}
});
