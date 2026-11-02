const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
const begin=html.indexOf('  function anchorDraw(');let end=html.indexOf('{',begin)+1,depth=1;for(;depth;end++){if(html[end]==='{')depth++;if(html[end]==='}')depth--;}
const code=html.slice(begin,end);
function fixture(zoom,dpr){const strokes=[],canvas={style:{display:'none'}},g={setTransform(){},clearRect(){},setLineDash(value){this.dash=value;},beginPath(){this.path=[];},moveTo(...p){this.path.push(['M',...p]);},lineTo(...p){this.path.push(['L',...p]);},stroke(){strokes.push({path:this.path,dash:this.dash,width:this.lineWidth,colour:this.strokeStyle});}},c={window:{},st:{edgeWrap:true,anchorAxis:false},anchorDash:{o:{c:canvas,g}},picOn:()=>true,f:{W:31,H:8},geo:{anchor:15},rombP:()=>-1,animatrixOn:()=>false,compareOn:()=>false,VX:0,VW:31,VH:8,scale:()=>zoom,devicePixelRatio:dpr,document:{body:{classList:{contains:()=>false}}},wrap:{clientWidth:1200,clientHeight:800,getBoundingClientRect:()=>({left:100,top:50})},cv:{getBoundingClientRect:()=>({left:110,top:60})}};vm.createContext(c);vm.runInContext(code,c);return {c,canvas,strokes};}
test('width boundaries are continuous one-device-pixel strokes at every zoom, independent of anchor-axis switch',()=>{
 for(const zoom of [.25,1,4,24])for(const dpr of [1,2]){
  const {c,strokes,canvas}=fixture(zoom,dpr);c.anchorDraw();assert.equal(canvas.style.display,'');assert.equal(strokes.length,1);const stroke=strokes[0];assert.deepEqual(Array.from(stroke.dash),[]);assert.equal(stroke.width*dpr,1);assert.equal(stroke.colour,'#ffd35b');
  assert.deepEqual(stroke.path.map(p=>Array.from(p)),[['M',Math.round(10*dpr)/dpr+.5/dpr,10],['L',Math.round(10*dpr)/dpr+.5/dpr,10+8*zoom],['M',Math.round((10+31*zoom)*dpr)/dpr-.5/dpr,10],['L',Math.round((10+31*zoom)*dpr)/dpr-.5/dpr,10+8*zoom]]);
 }
});
test('leaving the edge source hides its previous boundary overlay and does not paint an Animatrix boundary',()=>{
 for(const change of [c=>{c.st.edgeWrap=false;},c=>{c.animatrixOn=()=>true;},c=>{c.compareOn=()=>true;},c=>{c.st.sequenceSourceOn=true;},c=>{c.rombP=()=>0;}]){const {c,canvas,strokes}=fixture(4,1);c.anchorDraw();change(c);c.anchorDraw();assert.equal(canvas.style.display,'none');assert.equal(strokes.length,1);}
});
