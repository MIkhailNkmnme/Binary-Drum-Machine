const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const Joined=require('./mayatnik-joined-romb.js');
const html=fs.readFileSync(path.join(__dirname,'Zerkalius-mayatnik.html'),'utf8');
function fn(name){const at=html.indexOf('function '+name+'(');assert.ok(at>=0,name);for(let end=html.indexOf('}',at);end>=0;end=html.indexOf('}',end+1)){const s=html.slice(at,end+1);try{new vm.Script('('+s+')');return s;}catch(e){if(!(e instanceof SyntaxError))throw e;}}throw Error(name);}
function fixture(view,{width=8254,rows=4096,origin=3072,anchor=7167,gap=32,zoom=.125,windowWidth=1280}={}){
  const styles={},nodes=new Map(),rp={bits:-1,romb0:0,romb1:1,romb2:2,rombJoin:3,rombJoin180:3}[view];
  const st={view,zoom,zMid:false,zsnap:false,zBot:false,ztop:false,zLock:false},wrap={clientWidth:windowWidth,clientHeight:900,scrollLeft:100,scrollTop:73,getBoundingClientRect:()=>({left:20,top:10})};
  const c={st,wrap,geo:{anchor},VX:origin,VW:width,VH:rows,RG:gap,zWant:99,rombP:()=>rp,bothOn:()=>false,ovlLinked:()=>false,scale:()=>typeof st.zoom==='number'?st.zoom:c.fitScale(),fitScale:()=>zoom,DPR:()=>1,wrapPadX:()=>32,
    joinedGeometry:()=>Joined.create({width,height:rows,origin,anchor,fieldWidth:origin+width,rotate:view==='rombJoin180'}),save(){},$:id=>{if(!nodes.has(id))nodes.set(id,{setAttribute(){}});return nodes.get(id);}};
  c.dispW=()=>rp===2?2*width+gap:rp===3?c.joinedGeometry().width:width;c.dispH=()=>rp===3?2*rows:rows;
  c.cv={style:styles,getBoundingClientRect:()=>({left:20+16+(parseFloat(styles.marginLeft)||0)-wrap.scrollLeft,top:10,width:c.dispW()*c.scale(),height:c.dispH()*c.scale()})};
  Object.defineProperty(wrap,'scrollWidth',{get:()=>Math.max(windowWidth,c.dispW()*c.scale()+32+(parseFloat(styles.marginLeft)||0)+(parseFloat(styles.marginRight)||0))});
  vm.createContext(c);vm.runInContext(html.match(/  const fitAxis =[^\n]+/)[0]+['displayAnchorX','centerAnchor','midScroll','fitHold','cssLayout'].map(fn).join('\n'),c);c.layout=()=>c.cssLayout();
  vm.runInContext(html.match(/  \$\('zFit'\)\.onclick =[^\n]+/)[0],c);
  return {c,nodes,styles};
}
function projectedAxes(c){const a=c.geo.anchor-c.VX+.5;if(c.st.view==='romb2')return [a,a+c.VW+c.RG];if(c.st.view.startsWith('rombJoin'))return [c.joinedGeometry().point(a,.5,0).x,c.joinedGeometry().point(a,.5,1).x];return [a];}
test('single, side-by-side and joined centering follows actual projected axes including an even-width rotated join',()=>{
  for(const view of ['bits','romb0','romb1','romb2','rombJoin','rombJoin180'])for(const width of [8254,8255]){
    const {c}=fixture(view,{width}),axes=projectedAxes(c),expected=axes.reduce((sum,x)=>sum+x,0)/axes.length;
    assert.equal(c.displayAnchorX(),expected,view+' '+width);
  }
});
test('native zFit centers every N4096 view while preserving numeric zoom and vertical scroll',()=>{
  for(const view of ['bits','romb0','romb1','romb2','rombJoin','rombJoin180'])for(const zoom of [.03125,.125,2]){
    const {c,nodes}=fixture(view,{zoom});nodes.get('zFit').onclick();
    assert.equal(c.st.zMid,true);assert.equal(c.st.zoom,zoom);assert.equal(c.wrap.scrollTop,73);assert.equal(c.zWant,0);
    const axis=c.cv.getBoundingClientRect().left+c.displayAnchorX()*zoom,center=20+c.wrap.clientWidth/2;
    assert.ok(Math.abs(axis-center)<=.51,view+' '+zoom+': '+axis+' / '+center);
    c.wrap.scrollLeft=150;c.midScroll();assert.ok(Math.abs(c.cv.getBoundingClientRect().left+c.displayAnchorX()*zoom-center)<=.51,'scroll remains centered');
    nodes.get('zFit').onclick();assert.equal(c.st.zMid,false);assert.equal(c.st.zoom,zoom);c.wrap.scrollLeft=150;c.midScroll();assert.equal(c.wrap.scrollLeft,150,'OFF releases horizontal scrolling');
  }
});
test('window resizing and restore center the same projected axis without changing zoom',()=>{
  for(const view of ['romb0','romb1','romb2','rombJoin','rombJoin180']){
    const {c}=fixture(view);c.st.zMid=true;
    for(const width of [640,1920]){c.wrap.clientWidth=width;c.cssLayout();c.centerAnchor();assert.equal(c.st.zoom,.125);assert.ok(Math.abs(c.cv.getBoundingClientRect().left+c.displayAnchorX()*.125-(20+width/2))<=.01);}
  }
});
test('fit zoom freezes at the same visible scale and existing linked-overlay exception remains unchanged',()=>{
  const {c,nodes}=fixture('romb2');c.st.zoom='fit';nodes.get('zFit').onclick();assert.equal(c.st.zoom,.125);assert.equal(c.st.zMid,true);
  c.ovlLinked=()=>true;c.wrap.scrollLeft=177;c.midScroll();assert.equal(c.wrap.scrollLeft,177);
});
