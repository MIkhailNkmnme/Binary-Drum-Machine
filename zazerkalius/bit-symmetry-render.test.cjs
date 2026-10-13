const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const symmetry = require('../_js/bit-symmetry.js');
const code = fs.readFileSync(__dirname+'/zz-zerkalius.js','utf8');
function context2d() {
  const saved=[],ctx={globalAlpha:1,fills:[],strokes:[],save(){saved.push({globalAlpha:this.globalAlpha,fillStyle:this.fillStyle,strokeStyle:this.strokeStyle});},restore(){Object.assign(this,saved.pop());},
    setTransform(){},translate(){},rotate(){},scale(){},beginPath(){},closePath(){},
    moveTo(x,y){assert.ok(Number.isFinite(x)&&Number.isFinite(y));},lineTo(x,y){assert.ok(Number.isFinite(x)&&Number.isFinite(y));},
    fill(){this.fills.push(this.fillStyle);},stroke(){this.strokes.push(this.strokeStyle);},fillText(){this.fills.push(this.fillStyle);},strokeText(){},fillRect(){this.fills.push(this.fillStyle);},
    createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};},putImageData(d){this.pixels=d.data.slice();}};
  return ctx;
}
function fixture(bitSymmetry) {
  const contexts=[],state={bitSymmetry,zero:0,one:0,bitsOnly:false,trace:false,font:'monospace',netDigits:true,net:{up:'#00ffff',down:'#ffff00'}};
  const context={state,ZZBitSymmetry:symmetry,pi:Math.PI,clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),
    document:{createElement(){const ctx=context2d();contexts.push(ctx);return {getContext:()=>ctx};}},
    visibleWorld:()=>[-Infinity,-Infinity,Infinity,Infinity],figureHull:v=>v,rowsLattice:()=>({})};
  const source=code.slice(code.indexOf('  function sourceImage('),code.indexOf('  function netGeometry('));
  const net=code.slice(code.indexOf('  function netCell('),code.indexOf('  function netPreview('));
  const pend=code.slice(code.indexOf('  function pendulumImage('),code.indexOf('  function sourceImage('));
  vm.runInNewContext(source+net+pend,context);
  return {context,contexts,state};
}
test('Zerkalius paints motifs and finite clipped axes in cached and zoomed sources; off removes both',()=>{
  const rows=vm.runInNewContext(fs.readFileSync(__dirname+'/../_js/horr-rows.js','utf8')+'; ZZ_HORR_ROWS');
  for(const on of [true,false]){
    const {context,contexts}=fixture(on),src=context.sourceImage(rows,'#9fffc8',4,1);
    assert.equal(!!src.symmetry,on);assert.equal(contexts[0].strokes.length,on?src.symmetry.segments.length:0);
    assert.equal(contexts[0].fills.some(c=>c!=='#9fffc8'),on);
    const zoom=context2d();src.draw(zoom,2);assert.equal(zoom.strokes.length,contexts[0].strokes.length);
  }
});
test('unfolded faces use the same switch and carry their local axes',()=>{
  const rows=Array(8).fill('010110011010').map(r=>[...r].map(Number)),model={faces:[{up:true,P:[[0,0],[-1,1],[1,1]],name:'U'}]};
  for(const on of [true,false]){const {context}=fixture(on),ctx=context2d();context.netFaces(ctx,model,rows,256,false);assert.equal(ctx.strokes.length,on?symmetry.analyze(rows.map(r=>r.join(''))).segments.length+1:1);}
});
test('pendulum symmetry respects empty cells and reverses with the bits',()=>{
  const P=require('../mayatnik/mirror-pendulum.js'),engine=new P(64,96);engine.seek(16,10000);
  const before=engine.field.val.slice(),{context,contexts}=fixture(true);context.pendEngine=()=>engine;context.pendSettings={colored:true};
  const a=context.pendulumImage(0,2),b=context.pendulumImage(2,2),{W,H}=engine.field;
  assert.ok(a.symmetry.segments.length);assert.equal(a.symmetry,b.symmetry);
  for(let r=0;r<H;r++)for(let c=0;c<W;c++){
    const i=(r*W+c)*4,j=(r*W+W-1-c)*4;
    assert.deepEqual(contexts[0].pixels.slice(i,i+4),contexts[1].pixels.slice(j,j+4));
    assert.equal(!!contexts[0].pixels[i+3],engine.field.val[r*W+c]>=0);
  }
  const target=context2d();a.draw(target,2);assert.equal(target.strokes.length,a.symmetry.segments.length);
  assert.deepEqual(engine.field.val,before);
});
test('custom row minimum changes actual source painting down to one row',()=>{
  const {context,contexts,state}=fixture(true);
  state.symmetryMinimums={minRows:1,minPairs:2};const one=context.sourceImage(['0110'],'#9fffc8',10,1);
  assert.equal(one.symmetry.segments.length,1);assert.equal(contexts[0].strokes.length,1);
  state.symmetryMinimums.minRows=2;const two=context.sourceImage(['0110'],'#9fffc8',10,1);
  assert.equal(two.symmetry.segments.length,0);assert.equal(contexts[1].strokes.length,0);
});
