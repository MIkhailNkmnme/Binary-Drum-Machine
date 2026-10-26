const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8'),menu=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8');
const source=html.slice(html.indexOf('  const clearAxesKeys='),html.indexOf('  window.mayClear='));
function fixture(){
 const nodes=new Map(),history=[],calls=[],$=id=>{if(!nodes.has(id))nodes.set(id,{textContent:id,title:id,setAttribute(){}});return nodes.get(id);};
 const st={userLines:[[0,1,8,1],[2,0,2,8]],nAxisSets:[{id:'n',n:3,row:2,left:-3,center:0,right:3}],zl:[{k:'d',p:0,m:1}],linesOn:true,ztlMain:true,ztMir:1,sym:true,symBits:true,symTriangles:true,fixLines:true,fixCross:true,midCol:true,geomCenter:true,lineMeasures:true,mirAxis:{on:true,ax:.25},zoom:12,ztop:true,ztopRow:7,fixAxis:2,fixDx:3,fixDy:2};
 const c=vm.createContext({st,$,structuredClone,Uint32Array,wrap:{scrollLeft:33,scrollTop:44},f:{val:Int8Array.of(0,1,-1,1)},templateItems:[{id:'keep',view:{visible:true}}],axisSelected:2,axisLineMode:true,axisPicking:true,rulerMode:true,rulerA:[1,2],rulerB:[4,5],mirrorLine:true,mirrorLineY:3,konus:{frame:4},mirrorLive:true,mirrorXor:true,mirrorBase:{paint:Uint32Array.of(2)},symWorker:{terminate:()=>calls.push('sym')},triangleWorker:{terminate:()=>calls.push('triangle')},mirrorFrame:9,
  axisLinePending:{},axisLineHover:{},axisDrag:{},axisBox:{},rulerHover:{},rulerDrag:{},lineDrag:{},fixDrag:{},
  window:{mayNAxes:{cancel:()=>calls.push('N-cancel'),get:()=>({enabled:false})}},cancelAnimationFrame:id=>calls.push('cancel'+id),
  pushHistory:entry=>history.push(entry)});
 for(const name of ['axisLinesSync','rulerSync','zLinesSync','templateSync','save','savePaint','queueDigits'])c[name]=()=>calls.push(name);
 c.clearKonus=()=>c.konus=null;c.mirrorLiveSet=on=>c.mirrorLive=on;c.draw=()=>{c.wrap.scrollLeft=0;c.wrap.scrollTop=0;};
 vm.runInContext(source,c);return {c,history,calls,st};
}
test('all axis families clear in one undo entry while field, templates and camera stay intact',()=>{
 const {c,history,calls,st}=fixture(),before=c.axesSnapshot(),bits=Array.from(c.f.val),templates=JSON.stringify(c.templateItems);c.clearAllAxes();
 assert.equal(history.length,1);assert.equal(c.axesPresent(),false);for(const key of ['userLines','nAxisSets','zl'])assert.equal(st[key].length,0);
 for(const key of ['linesOn','ztlMain','sym','symBits','symTriangles','fixLines','fixCross','midCol','geomCenter','lineMeasures','anchorAxis'])assert.equal(st[key],false,key);
 assert.equal(st.mirAxis.on,false);assert.equal(c.rulerA,null);assert.equal(c.konus,null);assert.equal(c.mirrorLive,false);assert.equal(c.fixDrag,null);
 assert.deepEqual(Array.from(c.f.val),bits);assert.equal(JSON.stringify(c.templateItems),templates);assert.deepEqual([st.zoom,st.ztop,st.ztopRow,st.fixAxis,st.fixDx,st.fixDy,c.wrap.scrollLeft,c.wrap.scrollTop],[12,true,7,2,3,2,33,44]);
 assert.ok(calls.includes('sym'));assert.ok(calls.includes('triangle'));c.clearAllAxes();assert.equal(history.length,1);
 history[0].external.apply(before);assert.deepEqual(c.axesSnapshot(),before);assert.deepEqual(Array.from(c.f.val),bits);
 history[0].external.apply(history[0].external.after);assert.equal(c.axesPresent(),false);
 st.userLines.push([0,0,1,1]);st.nAxisSets.push({id:'new'});assert.equal(c.axesPresent(),true);
});
test('default system axes restore without adding persisted keys',()=>{
 const {c,history,st}=fixture();delete st.anchorAxis;delete st.fixLines;const before=c.axesSnapshot();c.clearAllAxes();history[0].external.apply(before);
 assert.equal(Object.hasOwn(st,'anchorAxis'),false);assert.equal(Object.hasOwn(st,'fixLines'),false);assert.equal(c.$('fixLines').checked,true);
});
test('shared cleanup button and both anchor drawing paths honor the same visibility state',()=>{
 assert.match(menu,/\['clrAxes', 'axes', 'axes', 'axesOff'/);assert.match(menu,/clrAxes:'Все оси'/);assert.match(menu,/включение возвращает центральную ось/);
 assert.match(html,/on=!!\(st\.anchorAxis!==false&&picOn/);assert.match(html,/if\(st\.anchorAxis!==false\)add\(/);assert.match(html,/const axis=st\.anchorAxis===false\?null:/);
 for(const m of html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
});
