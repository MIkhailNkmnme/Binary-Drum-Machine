const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'Zerkalius-mayatnik.html'),'utf8');
const menu=fs.readFileSync(path.join(__dirname,'mayatnik-menu.js'),'utf8');
function block(start,end){const a=html.indexOf(start),b=html.indexOf(end,a);assert.ok(a>=0&&b>a);return html.slice(a,b);}
function setup(st={}){
  const controls={};for(const [id,value]of Object.entries({fillColour:'#123456',verticalFillColour:'#ff7f27',stolbFillColour:'#ff7f27',midOneColour:'#ff7f27',midZeroColour:'#4f9bff',fillMirror:'',fillInfo:''}))controls[id]={value,checked:false,dataset:{},addEventListener(type,fn){this[type]=fn;}};
  const c={st,$:id=>controls[id],controls,save(){c.saved=JSON.parse(JSON.stringify(st));},clearFillPreview(){c.fillPreview=null;},previewPoint:null,previewFrame:0,f:{},draw(){},requestAnimationFrame(){return 1;},rgba:([r,g,b])=>(255<<24|b<<16|g<<8|r)>>>0,Uint32Array,Uint8ClampedArray,Math,setTimeout(){}};
  vm.createContext(c);vm.runInContext(block('  function paintToolColour(','  for(const ev of'),c);return c;
}
test('old saves inherit restored common colour once; selections persist independently of fill and centre',()=>{
  const c=setup();c.syncPaintToolColours();assert.equal(c.controls.verticalFillColour.value,'#123456');assert.equal(c.st.verticalFillColour,undefined);
  c.controls.fillColour.value='#654321';c.syncPaintToolColours(true);assert.equal(c.st.verticalFillColour,'#654321');assert.equal(c.st.stolbFillColour,'#654321');
  c.controls.verticalFillColour.value='#112233';c.controls.verticalFillColour.input();c.controls.stolbFillColour.value='#445566';c.controls.stolbFillColour.input();
  c.controls.fillColour.value='#aabbcc';c.syncPaintToolColours();assert.equal(c.paintToolColour('verticalFillColour'),'#112233');assert.equal(c.paintToolColour('stolbFillColour'),'#445566');assert.equal(c.saved.verticalFillColour,'#112233');assert.equal(c.saved.stolbFillColour,'#445566');
  assert.equal(c.controls.midOneColour.value,'#ff7f27');assert.equal(c.controls.midZeroColour.value,'#4f9bff');
  const reloaded=setup(c.saved);reloaded.syncPaintToolColours(true);assert.equal(reloaded.controls.stolbFillColour.value,'#445566');
});
test('invalid legacy own colour falls back without overwriting valid other tool',()=>{
  const c=setup({verticalFillColour:'bad',stolbFillColour:'#abcdef'});c.syncPaintToolColours(true);assert.equal(c.st.verticalFillColour,'#123456');assert.equal(c.st.stolbFillColour,'#abcdef');
});
test('actual column fill/replay and repeated-click erase use own colour, ordinary fill uses common',()=>{
  const c=setup({verticalFillColour:'#112233',stolbFillColour:'#445566'});Object.assign(c,{img:{width:2,height:1},playing:false,cv:{getBoundingClientRect:()=>({left:0,top:0,width:2,height:1})},autoVertical:1,paintSelection:()=>({indices:new Uint32Array([0,1])}),fillMask:null,fillHistory:[],fillHistoryBytes:0,colReplay:[],lockColourAt:()=>0,lockErase(){},pushHistory(){},fillSync(){},savePaint(){}});
  vm.runInContext(block('  function fillAt(','  // v0.070:'),c);c.fillAt(.5,.5);assert.deepEqual([...c.fillMask],[c.rgba([17,34,51]),c.rgba([17,34,51])]);assert.equal(c.colReplay[0].colour,c.rgba([17,34,51]));
  c.fillAt(.5,.5);assert.equal(c.fillMask,null);assert.equal(c.colReplay.length,0);c.autoVertical=0;c.fillAt(.5,.5);assert.equal(c.fillMask[0],c.rgba([18,52,86]));
});
test('preview, transit pixels, digits and glow all use the matching tool colour',()=>{
  const c=setup({verticalFillColour:'#112233',stolbFillColour:'#ff0000'});let glow;
  const gc={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:im=>glow=new Uint32Array(im.data.buffer)};
  Object.assign(c,{img:{width:1,height:1},playing:false,fillMode:false,autoVertical:1,previewPoint:[.5,.5,false],fillPreview:null,fillMask:null,stolbCol:0,stolbHeat:new Float32Array([1]),stolbPaint:null,stolbGlow:null,geo:{},cv:{width:1,height:1,getBoundingClientRect:()=>({left:0,top:0,width:1,height:1})},paintSelection:()=>({indices:[0],members:[0]}),document:{createElement:()=>({getContext:()=>gc})},ImageData:class{constructor(data){this.data=data;}},previewCanvas:{dataset:{}},drawFillPreview(){},g:{save(){},restore(){},drawImage(){}},stolbTransport:{line:false}});
  vm.runInContext(block('  function updateFillPreview(){','  function drawFillPreview(){'),c);c.updateFillPreview();assert.equal(c.fillPreview.hex,'#112233');
  vm.runInContext(block('  function stolbApply(px){','  function autoPaintAll(){'),c);const px=new Uint32Array([0xff000000]);c.stolbApply(px);assert.equal(px[0],0xff0000ff);assert.equal(c.stolbPaint.colour,0xff0000ff);c.stolbLine();assert.equal(glow[0]&0xffffff,255);
  c.controls.fillColour.value='#00ff00';c.stolbApply(px);assert.equal(px[0],0xff0000ff);
});
test('both controls use shared palette buttons and real source input IDs',()=>{
  for(const [id,col,name]of [['bAutoVertical','verticalFillColour','Столбы'],['bStolb','stolbFillColour','Проход']]){
    assert.ok(menu.includes(`withColour('${id}','${col}','${name}')`));assert.ok(html.includes(`id="${col}" type="color"`));
  }
  for(const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);new vm.Script(menu);
});
