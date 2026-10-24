// Execute the production transfer/mini migration and legacy pin resolver, without running the page.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const menu=fs.readFileSync(path.join(__dirname,'mayatnik-menu.js'),'utf8'),start=menu.indexOf('  function installManualAxesMenu(railButtons) {'),end=menu.indexOf('  installManualAxesMenu(railSourceButtons);',start);
assert.ok(start>0&&end>start);const installer=menu.slice(start,end);
class Element {
  constructor(cls='',text=''){this.className=cls;this.textContent=text;this.children=[];this.dataset={};this.style={setProperty(k,v){this[k]=v;}};this.tagName='DIV';}
  append(...nodes){for(const node of nodes){if(node.parentElement)node.parentElement.children=node.parentElement.children.filter(n=>n!==node);this.children.push(node);node.parentElement=this;}}
  get firstChild(){return this.children[0]||{textContent:this.textContent};}
  matches(selector){return selector==='button,.gz-hx,[role="button"]'?this.className.split(' ').includes('gz-hx')||this.tagName==='BUTTON':false;}
  closest(selector){for(let n=this;n;n=n.parentElement){if(selector==='.gz-group'&&n.className==='gz-group')return n;if(selector==='[data-id],.pt-g'&&(n.dataset.id||n.className==='pt-g'))return n;}return null;}
  querySelectorAll(selector){const nodes=[];const visit=n=>{if(selector==='.gz-soty > .gz-hx'&&n.parentElement?.className==='gz-soty'&&n.className.split(' ').includes('gz-hx'))nodes.push(n);n.children.forEach(visit);};visit(this);return nodes;}
  querySelector(selector){if(selector===':scope > .pt-l')return this.children.find(n=>n.className==='pt-l');const id=selector.match(/^\[data-n="(.+)"\]$/)?.[1];if(id){const find=n=>n.dataset.n===id?n:n.children.map(find).find(Boolean);return find(this);}return null;}
  click(){this.onclick?.();}
}
function setup(seed={}){
  const data=new Map(Object.entries(seed)),tools=new Element(),rail=new Element(),railButtons=new Map(),manualLegacyCells=new Map(),counts={},native={},nodes={};
  const button=(id,withData=true)=>{const node=new Element('gz-hx');if(withData)node.dataset.n=id;node.style.left='112px';node.style.top='27px';native[id]={click:()=>counts[id]=(counts[id]||0)+1};node.onclick=()=>native[id].click();nodes[id]=node;return node;};
  const group=name=>{const g=new Element('pt-g'),head=new Element('pt-l',name),row=new Element('pt-r');g.append(head,row);tools.append(g);return row;};
  const zoom=new Element('gz-group');zoom.dataset.id='zoom';const soty=new Element('gz-soty');zoom.append(soty);rail.append(zoom);
  const zoomIds=['zFit','zoomEdges','zLock','zLines','zVert','zDiag','zSnap'];for(const id of zoomIds){const node=button(id,false);soty.append(node);if(id!=='zoomEdges')railButtons.set(id,node);}
  const snapPopup={options:()=>['Плавно','×2','×3']};nodes.zSnap.gzList=snapPopup;
  const axes=group('Оси');for(const id of ['sym','symV','symH','symD','symTriangles','bTriangleAxes','bFrameWindow','bAxisLine','bAxisMirror','bAxisXor','bAxisLinesClear','bRuler'])axes.append(button(id));
  const view=group('Вид'),section=new Element('pt-col');view.append(section);for(const id of ['bFoldCompare','bFoldHorizontal','bFoldVertical','geomCenter'])section.append(button(id));
  const callbacks=Object.fromEntries(Object.entries(nodes).map(([id,node])=>[id,node.onclick]));
  const ctx=vm.createContext({ptGroup:group,tools,manualLegacyCells,railSourceButtons:railButtons,localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},document:{querySelectorAll(){throw Error('legacy zoom pin should use its original live cells');}}});
  vm.runInContext(installer+'\nvar result=installManualAxesMenu(railSourceButtons);',ctx);
  const cellLine=menu.split('\n').find(line=>line.includes('const cellOf ='));vm.runInContext(cellLine+'\nvar legacyPin=cellOf;',ctx);
  return {ctx,row:ctx.result,tools,zoom,soty,nodes,native,callbacks,counts,railButtons,manualLegacyCells,data,zoomIds,snapPopup,axes,section};
}

test('manual group receives existing live controls and callbacks; automatic axes, regular folds and popups remain owned by their original groups',()=>{
  const e=setup(),ids=['zLines','zVert','zDiag','bAxisLine','bAxisMirror','bAxisXor','bAxisLinesClear','bRuler','bFoldCompare'];
  assert.deepEqual(e.row.children,ids.map(id=>e.nodes[id]));assert.equal(e.row.parentElement.dataset.k,'Ручные оси');
  for(const id of ids){assert.equal(e.nodes[id].onclick,e.callbacks[id]);e.nodes[id].click();assert.equal(e.counts[id],1);assert.equal(e.nodes[id].style.left,'');assert.equal(e.nodes[id].style.top,'');}
  assert.ok(e.axes.children.includes(e.nodes.symTriangles));assert.ok(e.axes.children.includes(e.nodes.bTriangleAxes));assert.ok(e.section.children.includes(e.nodes.bFoldHorizontal));assert.ok(e.section.children.includes(e.nodes.geomCenter));
  assert.ok(e.soty.children.includes(e.nodes.zSnap));assert.equal(e.nodes.zSnap.gzList,e.snapPopup);
});

test('mini migration preserves each old zoom ordinal and old group key with backup; F5 does not overwrite saved group layouts',()=>{
  const old=['group:zoom:parent:gz-soty:slot:3','group:zoom:parent:gz-soty:slot:4','group:zoom:parent:gz-soty:slot:5','group:zoom:parent:gz-soty:slot:6','group:Оси:data:bAxisLine','group:Вид:data:bFoldCompare'];
  const seed={'mayatnik-control-mini-v464':JSON.stringify(old),'mayatnik-dd-grid':'{"Оси":[22,0,8],"Масштаб":[10,0,3]}','mayatnik-dd-pins':'["Оси","Масштаб"]','mayatnik-dd-order':'["Вид","Оси","Масштаб"]','mayatnik-pins':'[{"g":"zoom","i":4,"x":50,"y":60}]'};
  const first=setup(seed),minis=JSON.parse(first.data.get('mayatnik-control-mini-v464'));
  for(const id of ['zLines','zVert','zDiag','bAxisLine','bFoldCompare'])assert.ok(minis.includes('group:Ручные оси:data:'+id));assert.ok(minis.includes('group:zoom:data:zSnap'));
  assert.equal(first.data.get('mayatnik-manual-axes-mini-before-v491'),seed['mayatnik-control-mini-v464']);
  for(const key of ['mayatnik-dd-grid','mayatnik-dd-pins','mayatnik-dd-order','mayatnik-pins'])assert.equal(first.data.get(key),seed[key]);
  const fresh=setup(Object.fromEntries(first.data));assert.deepEqual([...fresh.data],[...first.data]);assert.equal(fresh.ctx.legacyPin('zoom',4),fresh.nodes.zVert);
});

test('old and new zoom pins resolve the original live source indices after transfer; zSnap popup attaches to its exact original node',()=>{
  const e=setup();for(const [index,id]of e.zoomIds.entries())assert.equal(e.ctx.legacyPin('zoom',index),e.nodes[id]);
  for(const id of ['zLines','zVert','zDiag']){const node=e.nodes[id];assert.equal(node.dataset.mayPinGroup,'zoom');assert.equal(e.ctx.legacyPin(node.dataset.mayPinGroup,Number(node.dataset.mayPinIndex)),node);}
  // Execute the production late popup registration against shifted current cells; original ordinal6 is no longer in current cell array.
  let target=null;const a=e.zoomIds.map(id=>({src:id})),ca=e.soty.children;
  const begin=menu.indexOf("      a.forEach((it, i) => { const cell=railSourceButtons.get(it.src)||ca[i];if (it.src === 'zSnap'"),finish=menu.indexOf('      a.forEach((it, i) => { const cell=railSourceButtons.get(it.src)||ca[i],names',begin);
  assert.ok(begin>0&&finish>begin);Object.assign(e.ctx,{a,ca,window:{mayZSnap:{on:()=>true,base:()=>2,set(){}}},reg(node,options){target=node;assert.equal(options().length,10);}});
  vm.runInContext(menu.slice(begin,finish),e.ctx);assert.equal(target,e.nodes.zSnap);
});
