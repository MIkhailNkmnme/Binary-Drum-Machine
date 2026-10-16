const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
function mirror(saved={},window={}){window.dispatchEvent??=()=>{};const c={window,Event:class{},document:{readyState:'loading',addEventListener(){},querySelector(){return null;}},localStorage:{getItem:()=>JSON.stringify(saved),setItem(){}}};vm.runInNewContext(fs.readFileSync(__dirname+'/hub-mirror.js','utf8'),c);return c.window.HubMirror;}
function canvas(){const calls=[];const g={fillStyle:'#8fd3ff',save(){},restore(){},translate(...v){calls.push(['translate',...v]);},rotate(...v){calls.push(['rotate',...v]);},scale(...v){calls.push(['scale',...v]);},measureText(){return {width:12,actualBoundingBoxLeft:1,actualBoundingBoxRight:9,actualBoundingBoxAscent:8,actualBoundingBoxDescent:2};},fillText(...v){calls.push(['text',...v]);},beginPath(){},arc(...v){calls.push(['arc',...v]);},moveTo(...v){calls.push(['move',...v]);},lineTo(...v){calls.push(['line',...v]);},fill(){},stroke(){}};return {g,calls};}
test('view selection survives reload and invalid values fall back to rhombs',()=>{for(const mode of ['rhombs','digits','brackets','parentheses','slashes','angles','stars']){const m=mirror({bitView:mode});assert.equal(m.state.bitView,mode);assert.equal(m.symbolsOnly(),mode!=='rhombs');}assert.equal(mirror({bitView:'invalid'}).state.bitView,'rhombs');});
test('digits and bracket ink are centered and use the bit rotation',()=>{for(const [mode,bit,text] of [['digits','0','0'],['digits','1','1'],['brackets','0','()'],['brackets','1',')'],['parentheses','0','('],['parentheses','1',')'],['slashes','0','\\'],['slashes','1','/'],['angles','0','<'],['angles','1','>']]){const m=mirror({bitView:mode,zero:30,one:-45}),{g,calls}=canvas();m.drawSymbol(g,bit,100,200,14);assert.deepEqual(calls[0],['translate',100,200]);assert.ok(Math.abs(calls[1][1]-(bit==='0'?Math.PI/6:-Math.PI/4))<1e-12);assert.deepEqual(calls[2],['text',text,-4,3]);}});
test('star and dot share the exact origin; hidden symbols emit no geometry',()=>{const m=mirror({bitView:'stars'}),star=canvas(),dot=canvas();m.drawSymbol(star.g,'1',37,82,10);m.drawSymbol(dot.g,'0',37,82,10);assert.deepEqual(star.calls[0],dot.calls[0]);assert.deepEqual(dot.calls[2].slice(0,3),['arc',0,0]);const rays=star.calls.filter(c=>c[0]==='move'||c[0]==='line');assert.equal(rays.length,6);for(let i=0;i<6;i+=2){assert.ok(Math.abs(rays[i][1]+rays[i+1][1])<1e-12);assert.ok(Math.abs(rays[i][2]+rays[i+1][2])<1e-12);}m.state.hideOneDigit=true;const hidden=canvas();m.drawSymbol(hidden.g,'1',37,82,10);assert.equal(hidden.calls.length,0);});

test('glyph gaps and cell seams hit the figure, but outside the triangle stays background',()=>{
 for(const mode of ['digits','brackets','parentheses','slashes','angles','stars']){
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
 for(const mode of ['digits','brackets','parentheses','slashes','angles'])for(const bit of ['0','1']){
  const m=mirror({bitView:mode,zero:30,one:-45}),single=canvas(),batch=canvas(),points=[[100,200],[135,224]],angle=m.bitAngle(bit),co=Math.cos(angle),si=Math.sin(angle);
  m.drawSymbol(single.g,bit,...points[0],14);m.drawSymbolBatch(batch.g,bit,points,14,'#abcdef',.35);
  const one=single.calls.find(v=>v[0]==='text'),many=batch.calls.filter(v=>v[0]==='text');assert.equal(many.length,2);
  for(let i=0;i<2;i++){const [x,y]=points[i];assert.equal(many[i][1],one[1]);assert.ok(Math.abs(many[i][2]*co-many[i][3]*si-(x+one[2]*co-one[3]*si))<1e-10);assert.ok(Math.abs(many[i][2]*si+many[i][3]*co-(y+one[2]*si+one[3]*co))<1e-10);}
 }
});

test('transparent glyph erases only an isolated tile and preserves destination layers',()=>{
 const events=[],spriteContext={fillStyle:'',setTransform(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){events.push(['tile',this.globalCompositeOperation||'source-over']);},measureText:()=>({width:8,actualBoundingBoxLeft:0,actualBoundingBoxRight:8,actualBoundingBoxAscent:10,actualBoundingBoxDescent:0}),fillText(bit){events.push(['glyph',bit,this.globalCompositeOperation]);}};
 const tile={getContext:()=>spriteContext},c={window:{},document:{readyState:'loading',addEventListener(){},createElement:()=>tile},localStorage:{getItem:()=>JSON.stringify({hideZeroDigit:true,zero:30}),setItem(){}}};
 vm.runInNewContext(fs.readFileSync(__dirname+'/hub-mirror.js','utf8'),c);const m=c.window.HubMirror;
 const g={fillStyle:'#ff8800',globalCompositeOperation:'source-over',getTransform:()=>({a:2,b:0,c:0,d:2}),save(){},restore(){},translate(){},rotate:a=>events.push(['rotate',a]),drawImage:()=>events.push(['destination',g.globalCompositeOperation])};
 assert.equal(m.fillCutoutRhomb(g,'1',100,100,10,18,12),false);
 assert.equal(m.fillCutoutRhomb(g,'0',100,100,10,18,12),true);assert.deepEqual(events.slice(0,2),[['tile','source-over'],['glyph','0','destination-out']]);assert.deepEqual(events.at(-1),['destination','source-over']);assert.ok(Math.abs(events[2][1]-Math.PI/6)<1e-12);
 m.fillCutoutRhomb(g,'0',120,100,10,18,12);assert.equal(events.filter(e=>e[0]==='tile').length,1);
});
test('zero opacity and fold setting survive reload',()=>{const m=mirror({symAlpha:0,bitAlpha:0,foldAlpha:.42,foldIn:true});assert.equal(m.state.symAlpha,0);assert.equal(m.state.bitAlpha,0);assert.equal(m.state.foldAlpha,.42);assert.equal(m.state.foldIn,true);});

test('bit identification includes transparent glyph centers and distinguishes reflected zero and one',()=>{
 const m=mirror({bitView:'rhombs',hideZeroDigit:true,hideOneDigit:true,on:true,angle:Math.PI/2,x:.5,y:.5});m.place(0,200,200);m.setBitCenters([[50,50,'0'],[50,90,'1']],{width:20,height:40});assert.equal(m.bitAt(50,50),'0');assert.equal(m.bitAt(50,90),'1');assert.equal(m.bitAt(150,50,true),'0');assert.equal(m.bitAt(150,90,true),'1');assert.equal(m.bitAt(100,30),null);
});

test('rotation rays follow only the clicked bit and its selected plane',()=>{
 for(const mode of ['stars','rhombs']){
  const m=mirror({bitView:mode,on:true,angle:Math.PI/2}),out=canvas(),other=canvas();m.place(0,200,200);m.setBitCenters([[50,50,'1'],[60,70,'1'],[40,80,'0']],{width:20,height:32});
  const hit=m.pickBit(150,50,true);assert.equal(hit.index,0);assert.equal(hit.mirror,true);m.selectRotationBit(hit);
  m.drawRotationGuides(out.g,true);assert.equal(out.calls.length,0,'click alone does not show rotation rays');
  m.tiltBit('1',5);m.drawRotationGuides(out.g,true);m.drawRotationGuides(other.g,false);
  assert.equal(other.calls.length,0);assert.equal(out.calls.filter(c=>c[0]==='translate').length,1);
  assert.equal(out.calls.filter(c=>c[0]==='line').length,mode==='stars'?6:8);assert.equal(out.g.globalAlpha,.3);assert.equal(out.g.lineWidth,.7);
  m.clearRotationBit();const cleared=canvas();m.drawRotationGuides(cleared.g,true);assert.equal(cleared.calls.length,0);
 }
});
test('bracket guides complete circles for all bits of the selected type',()=>{
 for(const mode of ['brackets','parentheses']){
  const m=mirror({bitView:mode,on:false});m.place(0,200,200);m.setBitCenters([[50,50,'0'],[60,70,'0'],[40,80,'1']],{width:20,height:32});m.selectRotationBit(m.pickBit(50,50));m.tiltBit('0',5);
  const out=canvas();m.drawRotationGuides(out.g,false);assert.equal(out.calls.filter(c=>c[0]==='translate').length,2);assert.equal(out.calls.filter(c=>c[0]==='arc').length,mode==='brackets'?4:2);
 }
});

test('hover centre chooses a real bit nearest the geometric centroid, before source shift',()=>{
 const m=mirror({}, {HubView:{originalCenter:()=>[130,240],sourceShift:()=>[30,40],place(){}}});
 m.setBitCenters([[100,200,'.'],[95,202,'0'],[110,200,'1'],[100,180,'1']],{width:20,height:30});
 const c=m.centerBit();assert.equal(c.x,95);assert.equal(c.y,202);assert.equal(c.bit,'0');assert.equal(c.width,20);
 m.setBitCenters([],{width:20,height:30});assert.equal(m.centerBit(),null);
});

test('vertex markers are actual corner bits, cached and deduplicated for a one-row triangle',()=>{
 const m=mirror();m.setBitCenters([[100,20,'1'],[90,40,'0'],[110,40,'1'],[80,60,'0'],[100,60,'1'],[120,60,'0']],{width:20,height:30});
 assert.deepEqual(Array.from(m.vertexBits(),p=>p.index),[0,3,5]);assert.equal(m.vertexBits(),m.vertexBits());
 m.setBitCenters([[100,20,'0']],{width:20,height:30});assert.deepEqual(Array.from(m.vertexBits(),p=>p.index),[0]);
 m.setBitCenters([]);assert.equal(m.vertexBits().length,0);
});


test('packed symbols fill the cell ink bounds without moving their centres, in single and batched drawing',()=>{
 for(const mode of ['digits','brackets','parentheses','slashes','angles'])for(const bit of ['0','1']){
  const m=mirror({bitView:mode,packedBits:true,zero:30,one:-45}),single=canvas(),batch=canvas(),size=12,width=20,height=34,points=[[100,200],[130,217]];
  assert.equal(m.state.packedBits,true);
  m.drawSymbol(single.g,bit,...points[0],size,width,height);m.drawSymbolBatch(batch.g,bit,points,size,'#abc',1,width,height);
  const scale=single.calls.find(c=>c[0]==='scale'),text=single.calls.find(c=>c[0]==='text'),texts=batch.calls.filter(c=>c[0]==='text');
  assert.deepEqual(scale,['scale',2,3.4]);assert.deepEqual(batch.calls.find(c=>c[0]==='scale'),scale);
  const angle=m.bitAngle(bit),co=Math.cos(angle),si=Math.sin(angle);
  for(let i=0;i<points.length;i++){const [x,y]=points[i],lx=texts[i][2]*scale[1],ly=texts[i][3]*scale[2];assert.ok(Math.abs(lx*co-ly*si-(x+text[2]*scale[1]*co-text[3]*scale[2]*si))<1e-9);assert.ok(Math.abs(lx*si+ly*co-(y+text[2]*scale[1]*si+text[3]*scale[2]*co))<1e-9);}
 }
 const m=mirror({bitView:'stars',packedBits:true}),star=canvas(),dot=canvas();m.drawSymbol(star.g,'1',100,200,12,20,34);m.drawSymbol(dot.g,'0',100,200,12,20,34);
 assert.equal(dot.calls.find(c=>c[0]==='arc')[3],10);assert.equal(star.g.lineWidth,2);assert.equal(star.calls.find(c=>c[0]==='line')[1],9);
 assert.equal(mirror().state.packedBits,false);
});


test('free bit rotation crosses old stops and wraps full turns in either direction; limit is reversible and persisted',()=>{
 const m=mirror({zero:55,one:-55});assert.equal(m.state.bitFreeRotation,true);
 m.tiltBit('0',10);m.tiltBit('1',-10);assert.equal(m.state.zero,65);assert.equal(m.state.one,-65);
 m.tiltBit('0',110);m.tiltBit('0',10);assert.equal(m.state.zero,-175);
 m.tiltBit('0');assert.equal(m.state.zero,-165);
 m.tiltBit('1',-110);m.tiltBit('1',-10);assert.equal(m.state.one,175);
 m.tiltBit('1',-360*8);assert.equal(m.state.one,175);
 const saved=mirror({...m.state});assert.equal(saved.state.zero,-165);assert.equal(saved.state.one,175);
 m.setBitFreeRotation(false);assert.equal(m.state.zero,-60);assert.equal(m.state.one,60);
 m.tiltBit('0',-5);m.tiltBit('1',5);assert.equal(m.state.zero,-60);assert.equal(m.state.one,60);
 assert.equal(mirror({...m.state}).state.bitFreeRotation,false);
 m.setBitFreeRotation(true);m.tiltBit('1',5);assert.equal(m.state.one,65);
});

test('axis defaults to the screen centre and ignores the old unpinned preference',()=>{assert.equal(mirror().state.screenPin,true);assert.equal(mirror({screenPin:false}).state.screenPin,true);});
