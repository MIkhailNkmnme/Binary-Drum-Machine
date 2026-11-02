const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
function fn(name){const at=html.indexOf('  function '+name+'(');assert.ok(at>=0,name);let end=html.indexOf('{',at)+1,depth=1;for(;depth;end++){if(html[end]==='{')depth++;if(html[end]==='}')depth--;}return html.slice(at,end);}
function fixture(view='bits',options={}){
 let frames=0,paints=0,now=0;
 const g={setTransform(){},clearRect(){},fillRect(){paints++;},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){paints++;},save(){},restore(){},rect(){},clip(){},createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){paints++;}};
 const el={width:31,height:8,getBoundingClientRect:()=>({left:0,top:0,width:310,height:80})};
 const c={style:{},width:31,height:8},o={c,g,list:[],n:-1,raf:0,id:null};
 const ctx={st:{view,rows:8,mode:'pend',vtxFlash:true,...options},geo:{anchor:15},f:{W:31,H:8},VW:31,VH:8,VX:0,RG:2,k:1,third:null,flashSeed:true,flashCellsQueue:[],performance:{now:()=>now},requestAnimationFrame(){frames++;return frames;},cv:el,$:()=>el,dispW:()=>31,dispH:()=>8,edgeFlowOn:()=>!!options.edgeContinuous,animatrixOn:()=>!!options.animatrixOn,compareOn:()=>false,joinedOn:()=>view==='joined',joinedWhole:()=>false,joinedGeometry:()=>({reflection:30,config:{rotateParity:1,rotate:true}}),rombP:()=>({romb0:0,romb1:1,romb2:2,rombAll:4}[view]??-1),displayPoint:(col,row,p)=>({x:col+.5,y:row+.5}),fixApexes:()=>({past:[0],fut:[]})};
 vm.createContext(ctx);vm.runInContext(['flashDrawRhombus','flashDrawJoined','flashDraw'].map(fn).join('\n'),ctx);ctx.flashDraw.o=o;
 Object.assign(ctx,{parityVisible:()=>true,outShow:()=>false,pairOn:()=>false,edgeRawApices:()=>[15],edgeCol:a=>a,animatrixEnsure:()=>({present:new Uint8Array(248).fill(1),filled:new Uint8Array(248),selection:new Uint8Array(248).fill(1)})});ctx.f.val=new Int8Array(248);ctx.st.animatrixTiming='rows';
 return {ctx,o,draw:()=>ctx.flashDraw(),get frames(){return frames;},get paints(){return paints;},set now(value){now=value;}};
}
test('Flash schedules its own fade while paused in flat, diamond and joined displays',()=>{
 for(const view of ['bits','romb0','romb1','romb2','joined']){
  const a=fixture(view);a.draw();assert.ok(a.paints>0,view+' initially paints');assert.ok(a.frames>0,view+' schedules fade while transport is paused');a.now=1400;a.draw();assert.equal(a.o.c.style.display,'none',view+' expires');
 }
});
test('flash supports whole-field diamonds, one apex, continuous edges and Animatrix',()=>{
 for(const [view,options]of [['rombAll',{}],['bits',{mode:'one'}],['bits',{edgeContinuous:true}],['bits',{animatrixOn:true}]]){
  const a=fixture(view,options);a.draw();assert.ok(a.paints>0,view+JSON.stringify(options));assert.notEqual(a.o.c.style.display,'none');assert.ok(a.frames>0);a.now=1400;a.draw();assert.equal(a.o.c.style.display,'none');
 }
});
