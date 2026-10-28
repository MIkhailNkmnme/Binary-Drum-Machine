const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
function between(start,end){const at=html.indexOf(start);assert.ok(at>=0);return html.slice(at,html.indexOf(end,at));}
function boot(state={}){
  const checkbox={checked:false},c={window:{},st:{rows:32,mode:'both',fixCross:false,fixLines:false,fixDragK:false,fixAxis:2,fixLockX:7,fixDx:4,fixDy:6,fixMirror:3,zoom:8,...state},geo:{anchor:50},VX:0,VW:100,VH:32,f:{H:32},k:2,saved:[],drawn:0,$:()=>checkbox,total:()=>16,compareOn:()=>false,pairOn:()=>true,rombP:()=>-1};
  c.save=()=>c.saved.push(JSON.stringify(c.st));c.draw=()=>c.drawn++;vm.createContext(c);
  vm.runInContext(between('  function fixApexes(','  // v0.127:'),c);
  vm.runInContext(between('  function fixSegments(','  // v0.203:'),c);
  vm.runInContext(between('  function fixShown()','  // v0.205:'),c);
  vm.runInContext(between('  window.mayFixFollow=','  window.mayLineMeasures='),c);
  c.checkbox=checkbox;return c;
}
test('enable resets manual shift, lock and anti-motion in one persisted draw; off preserves other settings',()=>{
  const c=boot();c.window.mayFixFollow.set(true);assert.equal(c.window.mayFixFollow.get(),true);
  assert.equal(c.st.fixAxis,0);assert.equal(c.st.fixLockX,null);assert.equal(c.st.fixDx,0);assert.equal(c.st.fixDy,0);assert.equal(c.checkbox.checked,true);assert.equal(c.saved.length,1);assert.equal(c.drawn,1);
  const restored=boot(JSON.parse(c.saved[0]));assert.equal(restored.window.mayFixFollow.get(),true);
  c.st.fixAxis=2;c.st.fixLockX=9;c.st.fixDx=3;c.st.fixDy=-2;c.window.mayFixFollow.set(false);
  assert.equal(c.st.fixCross,false);assert.equal(c.st.fixLines,false);assert.equal(c.st.fixDragK,false);assert.equal(c.checkbox.checked,false);
  assert.equal(c.st.fixAxis,2);assert.equal(c.st.fixLockX,9);assert.equal(c.st.fixDx,3);assert.equal(c.st.fixDy,-2);assert.equal(c.st.fixMirror,3);assert.equal(c.st.zoom,8);assert.equal(c.drawn,2);
  assert.equal(boot(JSON.parse(c.saved[1])).window.mayFixFollow.get(),false);
});
test('point and axis use the current neighboring frame geometry after enable',()=>{
  const c=boot();c.window.mayFixFollow.set(true);const positions=[];
  for(c.k=2;c.k<=5;c.k++){
    const segs=c.fixSegments(true),points=[...c.fixPts(segs,32).values()];assert.ok(points.length);positions.push(points.map(q=>q[2]));
    for(const q of points){assert.ok(segs.some(s=>s[2]===q[0]&&s[3]===q[1]));assert.equal(q[2],q[1]);assert.equal(q[3],q[0]);assert.equal(q[4],q[0]);}
  }
  assert.equal(new Set(positions.map(JSON.stringify)).size,4);assert.equal(c.st.zoom,8);
});
test('getter reflects every real mode change; enabling without a frame still saves',()=>{
  const c=boot();c.window.mayFixFollow.set(true);const base={...c.st};
  for(const [key,value]of Object.entries({fixCross:false,fixLines:false,fixDragK:false,fixAxis:1,fixLockX:0,fixDx:1,fixDy:-1})){Object.assign(c.st,base,{[key]:value});assert.equal(c.window.mayFixFollow.get(),false,key);}
  c.f=null;c.window.mayFixFollow.set(true);assert.equal(c.drawn,1);assert.equal(c.saved.length,2);assert.equal(c.window.mayFixFollow.get(),true);
});
test('single standard button toggles the atomic mode, reports real state and keeps the placement key',()=>{
  const menu=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8'),c=boot();
  const node=()=>({dataset:{},style:{},children:[],attrs:{},classList:{names:new Set(),add(...names){names.forEach(n=>this.names.add(n));},toggle(name,on){if(on)this.names.add(name);else this.names.delete(name);}},append(child){this.children.push(child);},setAttribute(key,value){this.attrs[key]=value;},querySelector(){return this.children[0];}});
  const sources=[node(),node(),node()];let button,placed=0;sources[2].before=b=>{button=b;};
  Object.assign(c,{tools:{querySelector:query=>sources[['fixCross','fixDragK','fixLines'].findIndex(id=>query.includes('"'+id+'"'))]},ptNames:{},document:{createElement:node},toolSync:[],placeTools:()=>placed++,ptBtn:(id,kind,probe,click)=>{const b=node();b.dataset.n=id;b.className='pt-b';b.append(node());b.onclick=click;return b;}});
  const at=menu.indexOf('  { const sources = [');assert.ok(at>=0);vm.runInContext(menu.slice(at,menu.indexOf('  // v0.499:',at)),c);
  assert.equal(button.dataset.n,'fixTri');assert.equal(button.children.length,2);assert.equal(button.children[1].textContent,'Точка');assert.equal(button.classList.names.has('gz-hx'),true);assert.equal(button.title,'Точка встречи и ось: следовать за кадром');assert.equal(button.attrs['aria-label'],button.title);
  for(const source of sources){assert.equal(source.style.display,'none');assert.equal(source.dataset.maySearchSkip,'');}
  const sync=()=>c.toolSync.forEach(f=>f());sync();assert.equal(button.attrs['aria-pressed'],'false');button.onclick();sync();assert.equal(button.attrs['aria-pressed'],'true');assert.equal(placed,1);assert.equal(c.saved.length,1);
  c.st.fixAxis=2;sync();assert.equal(button.attrs['aria-pressed'],'false');button.onclick();sync();assert.equal(button.attrs['aria-pressed'],'true');button.onclick();sync();assert.equal(button.attrs['aria-pressed'],'false');
  const search=require('./mayatnik-button-search.js'),record={node:button,name:'Точка',text:search.normalize(button.title+' Точка')};assert.equal(search.find([record],'следовать за кадром')[0].node,button);
});
