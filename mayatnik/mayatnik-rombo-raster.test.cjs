const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require.resolve('./Zerkalius-mayatnik.html'),'utf8');
const code=html.slice(html.indexOf('  function romboSourceCanvas(){'),html.indexOf('  // v0.476:',html.indexOf('  function romboSourceCanvas(){')));
function fixture(){
 const calls=[],owner={},pic={width:1534,height:512,data:new Uint8ClampedArray(4)},cv={width:1344,height:448,getBoundingClientRect:()=>({left:10,top:20,width:1344,height:448})};
 const context={setTransform(){},clearRect(){},putImageData:(...args)=>calls.push(['native',...args]),drawImage:(...args)=>calls.push(['draw',...args])},canvas={width:0,height:0,getContext:()=>context};
 const overlay={hidden:false,width:1344,height:448,style:{},getBoundingClientRect:()=>({left:10,top:20,width:1344,height:448})};
 const h={img:owner,cv,window:{mayLayers:{}},document:{createElement:()=>canvas,querySelectorAll:()=>[overlay]},present(){}};h.present.romboNative={owner,pic};vm.createContext(h);vm.runInContext(code,h);return {h,calls,pic,canvas,overlay};
}
test('Rombo rotates current native bits before screen minification and aligns overlaid tools in native coordinates',()=>{
 const f=fixture(),out=f.h.romboSourceCanvas();assert.equal(out.width,1534);assert.equal(out.height,512);assert.equal(f.calls[0][0],'native');assert.equal(f.calls[0][1],f.pic);assert.equal(f.calls[1][1],f.overlay);assert.deepEqual(f.calls[1].slice(2),[0,0,1534,512]);
});
test('stale or absent layered native snapshots safely use current displayed source and respect canvas limits',()=>{
 for(const change of [h=>h.img={},h=>h.window.mayLayers=null,h=>h.present.romboNative=undefined,h=>h.present.romboNative.pic.width=20000]){
  const f=fixture();change(f.h);f.h.romboSourceCanvas();assert.equal(f.canvas.width,1344);assert.equal(f.canvas.height,448);assert.equal(f.calls[0][0],'draw');assert.equal(f.calls[0][1],f.h.cv);
 }
});
test('every present stores the visible native raster before full or quick screen downsampling',()=>{
 const first=html.indexOf('    const pic = pxView();present.romboNative={owner:img,pic};');assert.ok(first>0);assert.ok(first<html.indexOf('downsampleRaster(pic, shown)',first));assert.ok(first<html.indexOf('g.drawImage(o, 0, 0, w, h)',first));
});
