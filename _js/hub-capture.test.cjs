const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(__dirname+'/hub-capture.js','utf8');
function fixture(){
 const calls=[],g={save(){calls.push(['save']);},restore(){calls.push(['restore']);},translate(...v){calls.push(['translate',...v]);},scale(...v){calls.push(['scale',...v]);},transform(...v){calls.push(['transform',...v]);},drawImage(...v){calls.push(['draw',...v,this.globalAlpha,this.imageSmoothingEnabled]);}};
 const flow={id:'flow',width:1280,height:720,matches:()=>true,style:{width:'1280px',height:'720px',opacity:'1',transform:'none'}},marker={id:'marker',width:40,height:40,matches:()=>false,style:{width:'20px',height:'20px',opacity:'.4',transform:'matrix(0,2,-2,0,300,200)'}};
 const window={};vm.runInNewContext(source,{window,document:{querySelectorAll:()=>[flow,marker]},getComputedStyle:n=>n.style,DOMMatrix:class{constructor(){Object.assign(this,{a:0,b:2,c:-2,d:0,e:300,f:200});}}});
 return {g,calls,flow,marker,draw:window.HubCapture.overlays};
}
test('video and high resolution PNG share full width flows and projected pulsing markers',()=>{
 for(const [scale,x,y] of [[1.5,0,0],[3.2,-960,24]]){
  const f=fixture();f.draw(f.g,scale,x,y);
  assert.deepEqual(f.calls[1],['translate',x,y]);assert.deepEqual(f.calls[2],['scale',scale,scale]);
  const draws=f.calls.filter(c=>c[0]==='draw');assert.equal(draws.length,2);
  assert.deepEqual(draws[0].slice(2),[0,0,1280,720,1,false]);
  assert.deepEqual(draws[1].slice(2),[0,0,20,20,.4,true]);
  assert.ok(f.calls.some(c=>JSON.stringify(c)===JSON.stringify(['transform',0,2,-2,0,300,200])));
 }
});
test('hidden or empty foreground canvases are excluded from recording',()=>{
 const f=fixture();f.marker.hidden=true;f.flow.width=0;f.draw(f.g);assert.equal(f.calls.filter(c=>c[0]==='draw').length,0);
});
