const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8'),lines=html.split('\n');
function fn(name){const at=html.indexOf('  function '+name+'(');assert.ok(at>=0,name);let end=html.indexOf('{',at)+1,depth=1;for(;depth;end++){if(html[end]==='{')depth++;if(html[end]==='}')depth--;}return html.slice(at,end);}
function fixture(options={}){
 const buttons=new Map(),st={zoom:1,zsnap:true,zbase:2,zLimit:false,zLock:false,ztop:false,zBot:false,zMid:false,...options};
 const c={st,geo:{anchor:63},window:{devicePixelRatio:options.dpr||1},wrap:{clientWidth:800,clientHeight:800,scrollLeft:100,scrollTop:100,getBoundingClientRect:()=>({left:0,top:0,width:800,height:800})},cv:{style:{},getBoundingClientRect:()=>({left:0,top:0,width:127*c.scale(),height:128*c.scale(),bottom:128*c.scale()})},VTX_H:16,MAX_ZOOM:512,zWant:0,dispW:()=>127,dispH:()=>128,wrapPadX:()=>32,bothOn:()=>false,ovlLinked:()=>false,fitAxis:()=>false,save(){},layout(){},thick(){},zBotScroll(){},zTopScroll(){},zTopLine(){},present(){},imageStats(){},queueDigits(){},midScroll(){},fitHold(){},$:(id)=>{if(!buttons.has(id))buttons.set(id,{setAttribute(){}});return buttons.get(id);}};
 vm.createContext(c);
 const declarations=['DPR','zB','snap2','fitScale','baseMinScale','minScale','scale'].map(name=>lines.find(line=>line.trimStart().startsWith('const '+name+' ='))).join('\n');
 vm.runInContext(declarations+'\nthis.scale=scale;this.minimum=minScale;\n'+fn('zoomTo'),c);
 return c;
}
test('actual zoomTo clamps after snapping for every base, DPR and field transport',()=>{
 for(const mode of [{},{edgeWrap:true},{edgeWrap:true,edgeBounce:true},{edgeWrap:true,edgeContinuous:true}])for(const zbase of [2,3,4,5,6,7,8,9,10])for(const dpr of [1,1.25,1.5,2])for(const zLimit of [false,true]){
  const c=fixture({...mode,zbase,dpr,zLimit});c.zoomTo(1e10);assert.ok(c.scale()<=512,JSON.stringify({mode,zbase,dpr,zLimit}));c.zoomTo(1e-10);assert.ok(c.scale()>=c.minimum());
 }
});
test('Down cannot change an explicitly locked numeric zoom',()=>{
 const c=fixture({zoom:1,zLock:true});vm.runInContext(html.split('\n').find(line=>line.includes("$('zFitH').onclick =")),c);c.$('zFitH').onclick();assert.equal(c.scale(),1);
});
test('layout cannot enlarge an explicitly locked zoom with Down active',()=>{
 const c=fixture({zoom:1,zLock:true,zBot:true});vm.runInContext(fn('cssLayout'),c);c.cssLayout();assert.equal(c.scale(),1);
});
test('restoring a snapped maximum never exceeds the interactive maximum',()=>{
 for(const zbase of [2,3,4,5,6,7,8,9,10])for(const dpr of [1,1.25,1.5,2]){
  const c=fixture({zoom:512,zbase,dpr});const startup=lines.find(line=>line.includes("if (st.zsnap && st.zoom !== 'fit' && st.zoom !== 'fitH')"))||lines.find(line=>line.trimStart().startsWith("if (st.zoom !== 'fit' && st.zoom !== 'fitH') st.zoom ="));assert.ok(startup);vm.runInContext(startup,c);assert.ok(c.scale()<=512,JSON.stringify({zbase,dpr,actual:c.scale()}));
 }
});
test('fit scale never exceeds available width across flat, paired diamonds and 180 degree dimensions',()=>{
 for(const [width,height]of [[127,128],[256,128],[256,256],[127,256]])for(const zbase of [2,3,5,10])for(const dpr of [1,1.25,1.5,2]){
  const c=fixture({zoom:'fit',zbase,dpr});c.dispW=()=>width;c.dispH=()=>height;assert.ok(c.scale()*width<=c.wrap.clientWidth-c.wrapPadX()+1e-8);
 }
});
test('free pinch retains the source point under the gesture at custom and maximum zoom',()=>{
 for(const wanted of [8,16,512]){
  const c=fixture({zoom:4,zsnap:false});c.cv.getBoundingClientRect=()=>({left:-c.wrap.scrollLeft,top:-c.wrap.scrollTop,width:127*c.scale(),height:128*c.scale(),bottom:128*c.scale()-c.wrap.scrollTop});
  const x=200,y=200,before=c.cv.getBoundingClientRect(),sourceX=(x-before.left)/c.scale(),sourceY=(y-before.top)/c.scale();c.zoomTo(wanted,x,y,true);const after=c.cv.getBoundingClientRect();assert.ok(Math.abs((x-after.left)/c.scale()-sourceX)<1e-9);assert.ok(Math.abs((y-after.top)/c.scale()-sourceY)<1e-9);
 }
});
