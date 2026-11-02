const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=file=>fs.readFileSync(__dirname+'/'+file,'utf8');
test('Independent overlay group retains live handlers and preferences from Scale and older owners',()=>{
 class Node{
  constructor(){this.children=[];this.dataset={};this.style={setProperty(k,v){this[k]=v;}};this.className='';this.classList={add:(...names)=>this.className+=' '+names.join(' ')};}
  append(...nodes){for(const n of nodes){if(n.parentElement)n.parentElement.children=n.parentElement.children.filter(e=>e!==n);n.parentElement=this;this.children.push(n);}}
  setAttribute(k,v){this[k]=v;}
  matches(s){return s.split(',').some(q=>q==='button'&&this.button||q==='.gz-hx'&&this.className.includes('gz-hx'));}
  closest(){return this.dataset.id||this.dataset.k?this:this.parentElement?.closest();}
  querySelector(s){const name=s.replace(':scope > ','');return this.children.find(n=>n.className.split(' ').includes(name.slice(1)))||(!s.startsWith(':scope > ')?this.children.map(n=>n.querySelector(s)).find(Boolean):null)||null;}
  querySelectorAll(){return this.children.filter(n=>['gz-wide','gz-soty'].includes(n.className));}
 }
 const zoom=new Node();zoom.dataset.id='zoom';const measure=new Node();measure.dataset.k='Площади';const view=new Node();view.dataset.k='Вид';
 const ids=['ovlStep','ovlPos','ovlH0','ovlFreeze','ovlAlpha','ovlOriginal','ovlCenter','ovlReduce','ovlReset','ovlReturn','sawFull','sectors','areas','areaFreeze','lineMeasures'],nodes=new Map();
 let clicks=0;for(const id of ids){const n=new Node();n.dataset.n=id;n.button=true;n.className='gz-hx';n.onclick=()=>clicks++;nodes.set(id,n);(id==='ovlReduce'?view:measure).append(n);}
 const vis=new Node();vis.className='gz-hx may-vis-triple';view.append(vis);nodes.get('ovlAlpha').hidden=true;
 const storage=new Map([['mayatnik-control-mini-v464',JSON.stringify(['group:Площади:data:ovlStep','group:Вид:data:ovlReduce','group:zoom:data:ovlFreeze','group:zoom:data:ovlVisibility'])]]),source=read('mayatnik-menu.js'),start=source.indexOf('  function mountOverlayGroup(){'),end=source.indexOf('  mountOverlayGroup();',start);
 const overlay=new Node(),section=new Node();overlay.className='pt-g';overlay.append(section);
 const context={ptGroup:name=>{assert.equal(name,'Наложение');return section;},tools:{querySelector:s=>s==='.may-vis-triple'?vis:nodes.get(s.match(/data-n="([^"]+)"/)[1])},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};
 vm.runInNewContext(source.slice(start,end)+'mountOverlayGroup();',context);
 assert.equal(overlay.dataset.k,'Наложение');assert.equal(overlay.style['--c'],'#7cbcff');assert.equal(zoom.children.length,0);
 for(const id of ids.filter(id=>id.startsWith('ovl'))){assert.equal(nodes.get(id).parentElement,section);nodes.get(id).onclick();}assert.equal(clicks,10);assert.equal(vis.parentElement,section);assert.equal(vis.dataset.n,'ovlVisibility');assert.equal(nodes.get('ovlAlpha').hidden,true);
 for(const id of ['sawFull','sectors','areas','areaFreeze','lineMeasures'])assert.equal(nodes.get(id).parentElement,measure);
 const saved=JSON.parse(storage.get('mayatnik-control-mini-v464'));for(const id of ['ovlStep','ovlReduce','ovlFreeze','ovlVisibility'])assert.ok(saved.includes('group:Наложение:data:'+id));assert.ok(saved.includes('group:Площади:data:ovlStep'));assert.ok(saved.includes('group:zoom:data:ovlFreeze'));
});
test('startup ignores saved open state and active sequence matches, but detached library opens normally',()=>{
 const source=read('mayatnik-template-panel.js'),start=source.indexOf('    // The main page always starts'),end=source.indexOf('\n  }',start),startup=source.slice(start,end);
 for(const detached of [false,true])for(const enabled of [false,true])for(const savedOpen of ['0','1']){const calls=[],store=new Map([['open',savedOpen],['tab','settings']]),context={root:{MayatnikLibraryDetached:detached,maySequences:{snapshot:()=>({matches:{enabled}})}},storage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},OPEN_KEY:'open',TAB_KEY:'tab',open:false,activeTab:'templates',captureLibraries:new Map([['settings',{}]]),bindLayers(){},bind(){},bindCapture(){},selectTab:tab=>calls.push(['tab',tab]),setOpen:(value,persist)=>calls.push(['open',value,persist])};vm.runInNewContext(startup,context);assert.deepEqual(calls.filter(c=>c[0]==='open'),detached?[['open',true,false]]:[]);assert.equal(context.open,detached);assert.equal(store.get('open'),savedOpen);assert.equal(store.get('tab'),'settings');assert.equal(calls.some(c=>c[0]==='tab'&&c[1]==='sequences'),!detached&&enabled);}
});
