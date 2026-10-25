const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),S=require('./mayatnik-symmetry.js');
const html=fs.readFileSync(require('node:path').join(__dirname,'Zerkalius-mayatnik.html'),'utf8');
const code=html.slice(html.indexOf('  function paintSymmetry('),html.indexOf('  /* v0.177:'));
test('manual selection shows only its pairs below x3 with global bit highlighting off, changes and clears',()=>{
  const field={W:9,H:9,val:new Int8Array(81).fill(1)},anchor=2;
  const segs=S.find(field,{anchor,directions:['v','h','d','u'],plainDirections:['v','h','d','u'],minBits:1,minRows:1});
  const context={MayatnikSymmetry:S,rombP:()=>-1,VW:9,VH:9,VX:0,geo:{anchor},st:{symBits:false,symTriangles:false},k:4,f:field,outShow:()=>false,scale:()=>2,konus:null};
  vm.createContext(context);vm.runInContext(code,context);
  let drawn=[];const ctx={save(){},restore(){},beginPath(){},rect(){},clip(){},moveTo(){},lineTo(){},stroke(){},fillRect(x,y,w,h){drawn.push([Math.round((x+w/2)/2-.5),Math.round((y+h/2)/2-.5)]);}};
  const draw=()=>{drawn=[];context.paintSymmetry(ctx,{segs},0,0,2,18,18);return [...new Set(drawn.map(p=>p.join(',')))].sort();};
  assert.deepEqual(draw(),[]);
  for(const dir of ['v','h','d','u'])for(const p of [-1,0,1]){
    const selected=segs.find(s=>s.dir===dir&&s.p===p);context.konus={frame:4,segment:selected};
    const expected=[];S.eachPair(selected,anchor,(x,y,mx,my)=>expected.push(x+','+y,mx+','+my));
    assert.deepEqual(draw(),[...new Set(expected)].sort(),dir+'/'+p);
  }
  context.konus=null;assert.deepEqual(draw(),[]);
  context.konus={frame:3,segment:segs[0]};assert.deepEqual(draw(),[],'old frame selection is not drawn');
  context.konus={frame:4,segment:{...segs[0],axis:999}};assert.deepEqual(draw(),[],'filtered or missing axis is not drawn');
});
