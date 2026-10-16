const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
function mirror(saved={},window={}){const c={window,document:{readyState:'loading',addEventListener(){}},localStorage:{getItem:()=>JSON.stringify(saved),setItem(){}}};vm.runInNewContext(fs.readFileSync(__dirname+'/hub-mirror.js','utf8'),c);return c.window.HubMirror;}
function canvas(){const calls=[];const g={fillStyle:'#8fd3ff',save(){},restore(){},translate(...v){calls.push(['translate',...v]);},rotate(...v){calls.push(['rotate',...v]);},measureText(){return {width:12,actualBoundingBoxLeft:1,actualBoundingBoxRight:9,actualBoundingBoxAscent:8,actualBoundingBoxDescent:2};},fillText(...v){calls.push(['text',...v]);},beginPath(){},arc(...v){calls.push(['arc',...v]);},moveTo(...v){calls.push(['move',...v]);},lineTo(...v){calls.push(['line',...v]);},fill(){},stroke(){}};return {g,calls};}
test('view selection survives reload and invalid values fall back to rhombs',()=>{for(const mode of ['rhombs','digits','brackets','parentheses','stars']){const m=mirror({bitView:mode});assert.equal(m.state.bitView,mode);assert.equal(m.symbolsOnly(),mode!=='rhombs');}assert.equal(mirror({bitView:'invalid'}).state.bitView,'rhombs');});
test('digits and bracket ink are centered and use the bit rotation',()=>{for(const [mode,bit,text] of [['digits','0','0'],['digits','1','1'],['brackets','0','()'],['brackets','1',')'],['parentheses','0','('],['parentheses','1',')']]){const m=mirror({bitView:mode,zero:30,one:-45}),{g,calls}=canvas();m.drawSymbol(g,bit,100,200,14);assert.deepEqual(calls[0],['translate',100,200]);assert.ok(Math.abs(calls[1][1]-(bit==='0'?Math.PI/6:-Math.PI/4))<1e-12);assert.deepEqual(calls[2],['text',text,-4,3]);}});
test('star and dot share the exact origin; hidden symbols emit no geometry',()=>{const m=mirror({bitView:'stars'}),star=canvas(),dot=canvas();m.drawSymbol(star.g,'1',37,82,10);m.drawSymbol(dot.g,'0',37,82,10);assert.deepEqual(star.calls[0],dot.calls[0]);assert.deepEqual(dot.calls[2].slice(0,3),['arc',0,0]);const rays=star.calls.filter(c=>c[0]==='move'||c[0]==='line');assert.equal(rays.length,6);for(let i=0;i<6;i+=2){assert.ok(Math.abs(rays[i][1]+rays[i+1][1])<1e-12);assert.ok(Math.abs(rays[i][2]+rays[i+1][2])<1e-12);}m.state.hideOneDigit=true;const hidden=canvas();m.drawSymbol(hidden.g,'1',37,82,10);assert.equal(hidden.calls.length,0);});

test('glyph gaps and cell seams hit the figure, but outside the triangle stays background',()=>{
 for(const mode of ['digits','brackets','parentheses','stars']){
  const m=mirror({bitView:mode,on:false,zero:60,one:-60});m.place(0,200,200);
  m.setBitCenters([[100,40],[90,60],[110,60]],{width:20,height:40});
  for(const [x,y] of [[100,40],[106,40],[100,60],[95,50]])assert.equal(m.hit(x,y).source,true,mode+' '+[x,y]);
  for(const [x,y] of [[100,19],[79,60],[100,81]])assert.equal(m.hit(x,y).source,false);
  assert.equal(m.hit(100,40).mirror,false);
 }
});
test('logical cells follow source translation and reflection about the manual axis',()=>{
 const m=mirror({bitView:'digits',on:true,x:.5,y:.5,angle:Math.PI/2},{HubView:{sourceShift:()=>[10,5],place(){}}});
 m.place(0,200,200);m.setBitCenters([[50,50]],{width:20,height:40});
 assert.equal(m.hit(66,55).source,true);assert.equal(m.hit(134,55).mirror,true);
 assert.equal(m.hit(50,50).source,false);assert.equal(m.hit(100,55).source,false);assert.equal(m.hit(100,55).mirror,false);
});
test('rhombs and custom images do not inherit invisible glyph-cell hit targets',()=>{
 for(const [mode,image] of [['rhombs',false],['digits',true]]){
  const m=mirror({bitView:mode},{HubImage:{active:image}});m.place(0,200,200);m.setBitCenters([[50,50]],{width:20,height:40});
  assert.equal(m.hit(50,50).source,false);
 }
});

test('batched glyphs preserve ink positions under bit rotation',()=>{
 for(const mode of ['digits','brackets','parentheses'])for(const bit of ['0','1']){
  const m=mirror({bitView:mode,zero:30,one:-45}),single=canvas(),batch=canvas(),points=[[100,200],[135,224]],angle=m.bitAngle(bit),co=Math.cos(angle),si=Math.sin(angle);
  m.drawSymbol(single.g,bit,...points[0],14);m.drawSymbolBatch(batch.g,bit,points,14,'#abcdef',.35);
  const one=single.calls.find(v=>v[0]==='text'),many=batch.calls.filter(v=>v[0]==='text');assert.equal(many.length,2);
  for(let i=0;i<2;i++){const [x,y]=points[i];assert.equal(many[i][1],one[1]);assert.ok(Math.abs(many[i][2]*co-many[i][3]*si-(x+one[2]*co-one[3]*si))<1e-10);assert.ok(Math.abs(many[i][2]*si+many[i][3]*co-(y+one[2]*si+one[3]*co))<1e-10);}
 }
});
