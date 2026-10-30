const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const J=require('./mayatnik-joined-romb.js'),Transient=require('./mayatnik-template-transient.js');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
function fn(name){const a=html.indexOf('function '+name+'(');assert.ok(a>=0,name);let b=html.indexOf('{',a)+1,n=1;for(;n;b++){if(html[b]==='{')n++;else if(html[b]==='}')n--;}return html.slice(a,b);}
function fixture(gpu=false){
 const nodes=new Map(),saved=[],layouts=[],field={W:18,H:8,val:Int8Array.from({length:144},(_,q)=>q%3-1)},paint=Uint32Array.of(0xff123456,0xff654321),templates=[{id:'source'},{id:'mirror'}];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='rows'||id==='steps'?8:id==='mode'?'pend':id==='speed'?4:'bits',attrs:{},listeners:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,f){this.listeners[k]=f;},dispatchEvent(e){this.listeners[e.type]?.(e);}});return nodes.get(id);};
 const c=vm.createContext({st:{view:'bits',joined180:false,viewUpsideDown:true,rows:8,steps:8,mode:'pend',bg:'empty',speed:4},f:field,geo:{anchor:9},VX:0,VW:18,VH:8,RG:2,RK:1,k:4,gpuBig:gpu?{}:null,img:null,cv:{width:18,height:8},wrap:{clientWidth:800},MayatnikJoinedRomb:J,templateTransient:Transient.create(),templateTransientCanvas:null,fillMask:paint,templateItems:templates,$:node,Event:class{constructor(type){this.type=type;}},gpuDisplay:()=>gpu,gpuCpuDisplay:()=>false,wrapPadX:()=>32,vSteps:n=>n,
  g:{createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)})},save(){saved.push(JSON.parse(JSON.stringify(c.st)));},layout(){layouts.push({view:c.st.view,on:c.st.joined180,width:c.dispW(),height:c.dispH(),rp:c.rombP()});},scale:()=>8,draw(){},fillBits:null});
 Object.assign(c,{fillHistory:[],fillRedo:[],fillHistoryBytes:0,fillSync(){}});
 for(const name of ['lgSync','stopFrameTransports','foldCloseAll','clearFillPreview','resetOchkiFindings','ovlDraw','queueDigits','savePaint','zoomTo'])c[name]=()=>{};
 vm.runInContext(html.slice(html.indexOf('  const joinedOn ='),html.indexOf('  function joinedBackground()'))+'\nthis.rombP=rombP;',c);
 vm.runInContext("let joinedCache=null;"+fn('joinedGeometry'),c);
 for(const name of ['clampInt','readUI','changeView','canvasSize','templateTransientScope','templateTransientSync'])vm.runInContext(fn(name),c);
 for(const name of ['dispW','dispH']){const a=html.indexOf('  const '+name+' ='),b=html.indexOf('\n',a);vm.runInContext(html.slice(a,b)+'\nthis.'+name+'='+name+';',c);}
 const start=html.indexOf("  $('bJoined180').onclick="),end=html.indexOf('\n',start);vm.runInContext(html.slice(start,end),c);
 node('view').addEventListener('change',c.changeView);const a=html.indexOf('  const lgSelect ='),b=html.indexOf('\n',a);vm.runInContext(html.slice(a,b)+'\nthis.lgSelect=lgSelect;',c);
 const choose=view=>{node('view').value=view;node('view').dispatchEvent(new c.Event('change'));};return {c,node,choose,saved,layouts,field,paint,templates};
}
test('every appearance change disables180 before saving and CPU/GPU layout; upside down and source content survive',()=>{
 for(const gpu of [false,true])for(const from of ['bits','col','digits','digitsOnly','romb0','romb1','romb2','rombJoin180'])for(const to of ['bits','col','digits','digitsOnly','bitContours','romb0','romb1','romb2']){
  if(from===to)continue;const f=fixture(gpu),{c}=f,bits=c.f.val.slice();c.st.view=from;c.st.joined180=from!=='rombJoin180';f.choose(to);
  assert.equal(c.st.view,to);assert.equal(c.st.joined180,false);assert.equal(c.st.viewUpsideDown,true);assert.equal(f.node('bJoined180').attrs['aria-pressed'],'false');assert.ok(f.saved.length);assert.ok(f.saved.every(s=>s.joined180===false&&s.view===to));assert.ok(f.layouts.every(s=>s.on===false&&s.view===to));assert.equal(c.f,f.field);assert.deepEqual(c.f.val,bits);assert.equal(c.fillMask,f.paint);assert.equal(c.templateItems,f.templates);
 }
});
test('both orderings are explicit:180 then Both turnsOFF; Both then180 stacks the two parity halves with fullheight',()=>{
 for(const gpu of [false,true]){const f=fixture(gpu),{c}=f;f.node('bJoined180').onclick();assert.equal(c.st.joined180,true);f.choose('romb2');assert.equal(c.rombP(),2);assert.equal(c.dispW(),36+c.RG);assert.equal(c.dispH(),8);f.node('bJoined180').onclick();assert.equal(c.st.view,'romb2');assert.equal(c.rombP(),3);assert.equal(c.dispW(),19);assert.equal(c.dispH(),16);const j=c.joinedGeometry();for(let r=0;r<8;r++)for(let col=0;col<18;col++){const point=j.forward(col,r);assert.equal(point.y>=8,point.p===0);assert.deepEqual(j.inverse(point.x,point.y),point);}assert.equal(f.node('bJoined180').attrs['aria-pressed'],'true');f.node('bJoined180').onclick();assert.equal(c.st.view,'romb2');assert.equal(c.rombP(),2);}
});
test('legacy joined view loads unchanged and selecting Both explicitly clears its visible180 state',()=>{
 const f=fixture(),{c}=f;c.st.view='rombJoin180';c.st.joined180=false;c.joined180Sync();const old=c.joinedGeometry();assert.equal(old.config.rotateParity,undefined);assert.equal(f.node('bJoined180').attrs['aria-pressed'],'true');f.choose('romb2');assert.equal(c.st.joined180,false);assert.equal(c.rombP(),2);assert.equal(f.node('bJoined180').attrs['aria-pressed'],'false');f.node('bJoined180').onclick();assert.equal(c.joinedGeometry().config.rotateParity,0);
});
test('palette appearance changes use the same event, while selecting the already active palette leaves180 alone',()=>{
 const f=fixture(),{c}=f;c.st.view='bits';c.st.joined180=true;c.lgSelect('col');assert.equal(c.st.view,'col');assert.equal(c.st.joined180,false);c.st.joined180=true;c.lgSelect('col');assert.equal(c.st.joined180,true);c.lgSelect('bits');assert.equal(c.st.joined180,false);
});
test('an appearance change discards temporaryDelete immediately and it does not return with the old view',()=>{
 const f=fixture(),{c}=f;c.templateTransientSync();c.templateTransient.hide([{rect:{x:0,y:0,width:1,height:1},mask:{width:1,height:1,data:Uint32Array.of(1)}}],['source']);assert.equal(c.templateTransient.active,true);f.choose('romb2');assert.equal(c.templateTransient.active,false);f.choose('bits');assert.equal(c.templateTransient.active,false);assert.equal(c.fillMask,f.paint);
});

test('Both180 contains each original source bit exactly once, with no copied triangles, in new and legacy orientations',()=>{
 const M=require('./mayatnik-core.js'),height=8,frames=4,g=M.geometry('pend',frames,height),field=M.field(g.W,height,'empty',g.anchor);for(let k=0;k<frames;k++)M.cone(field,g.anchor+M.offset('pend',k),height);const before=field.val.slice(),occupied=[...field.val].filter(v=>v>=0).length;
 for(const rotateParity of [0,1])for(const rotate of [false,true]){const mapping=J.create({width:field.W,height,anchor:g.anchor,rotate,rotateParity}),snapshot=mapping.snapshot({val:field.val}),counts=new Map();for(let y=0;y<mapping.height;y++)for(let x=0;x<mapping.width;x++){const cell=mapping.inverse(x,y);if(!cell||field.val[cell.q]<0)continue;counts.set(cell.q,(counts.get(cell.q)||0)+1);assert.equal(snapshot.val[y*mapping.width+x],field.val[cell.q]);assert.equal(y>=height,cell.p===rotateParity);}assert.equal(counts.size,occupied);assert.ok([...counts.values()].every(n=>n===1));assert.equal([...snapshot.val].filter(v=>v>=0).length,occupied);assert.equal(mapping.height,2*height);assert.deepEqual(field.val,before);}
});
