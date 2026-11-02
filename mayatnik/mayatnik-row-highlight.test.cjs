const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
function source(name){const start=html.indexOf('  function '+name+'(');assert.ok(start>=0);let end=html.indexOf('{',start)+1,depth=1;for(;depth;end++){if(html[end]==='{')depth++;if(html[end]==='}')depth--;}return html.slice(start,end);}
function fixture(){
 const field={},canvas={hidden:false,style:{display:''},width:100,height:60},rectangles=[];
 const g={setTransform(){},clearRect(){},save(){},restore(){},beginPath(){},rect(...args){rectangles.push(args);},stroke(){}};
 const c={st:{rowStepOutline:true},f:field,k:1,img:{},rowBuildHighlight:{owner:field,frame:1,row:1,columns:new Set([1,2])},rowBuildHighlightDismissedOwner:null,
  window:{},document:{body:{classList:{contains:()=>false}}},gpuDisplay:()=>false,wrap:{clientWidth:100,clientHeight:60,clientLeft:0,clientTop:0,getBoundingClientRect:()=>({left:0,top:0})},cv:{getBoundingClientRect:()=>({left:0,top:0})},DPR:()=>1,scale:()=>4,rombP:()=>-1,VH:3,VX:0,VW:5,
  parityRow:r=>r,parityVisible:()=>true,outShow:()=>false,joinedWhole:()=>false,joinedOn:()=>false,geo:{anchor:2},displayPoint:(col,row)=>({x:col+.5,y:row+.5})};
 vm.createContext(c);vm.runInContext(source('rowBuildHighlightDraw')+'\n'+source('dismissRowBuildHighlight'),c);c.rowBuildHighlightDraw.overlay={canvas,ctx:g};
 // The page's canvas{display:block} overrides the UA rule for [hidden].
 const display=()=>canvas.style.display||'block';
 return {c,canvas,rectangles,display};
}
test('clearing or invalidating a row marker hides its existing canvas despite canvas display:block',()=>{
 for(const invalidate of [c=>{c.rowBuildHighlight=null;},c=>{c.st.rowStepOutline=false;},c=>{c.f={};},c=>{c.k=2;},c=>{c.img=null;},c=>{c.gpuDisplay=()=>true;},c=>{c.window.mayLayers={get:()=>({visible:false})};}]){
  const {c,canvas,rectangles,display}=fixture();c.rowBuildHighlightDraw();assert.equal(rectangles.length,2);assert.equal(display(),'block');invalidate(c);c.rowBuildHighlightDraw();assert.equal(canvas.hidden,true);assert.equal(display(),'none');
 }
});
test('outside dismissal hides immediately and stays hidden until a deliberate new step',()=>{
 const {c,canvas,display}=fixture(),before=c.f;c.rowBuildHighlightDraw();assert.equal(c.dismissRowBuildHighlight(),true);assert.equal(display(),'none');c.rowBuildHighlightDraw();assert.equal(display(),'none');assert.equal(c.f,before);assert.equal(c.k,1);
 c.rowBuildHighlightDismissedOwner=null;c.rowBuildHighlightDraw();assert.equal(canvas.hidden,false);assert.equal(display(),'block');
});
