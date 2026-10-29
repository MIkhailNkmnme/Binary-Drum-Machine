const test=require('node:test'),assert=require('node:assert/strict');
const {layout,slot,geometry,SIZE,HEIGHT,STEP}=require('./mayatnik-menu-options.js');

test('every option uses a separate standard button row in one vertical column',()=>{
 assert.equal(SIZE,120);assert.equal(HEIGHT,24);assert.equal(STEP,26);
 for(let count=1;count<=100;count++)for(const oldColumns of [1,2]){const g=geometry(count,oldColumns),cells=Array.from({length:count},(_,i)=>slot(i,oldColumns));assert.ok(cells.every((c,i)=>c.column===1&&c.row===i+1));assert.equal(g.cols,1);assert.equal(g.chainHeight,count*26-2);assert.equal(g.chainWidth,120);assert.equal(g.gridTemplateColumns,'120px');assert.equal(g.gridTemplateRows,'repeat('+count+',24px)');}
});

test('popup stays bounded at screen/library edges and scrolls by actual button column height',()=>{
 for(const right of [80,110,128,320,800,1400])for(const left of [4,Math.max(4,right-124)])for(const count of [1,2,5,8,25,100]){
  const column={left,right:left+120,width:120},g=layout(count,{...column,top:560},column,right,600);assert.ok(g.left>=4);assert.ok(g.left+g.width<=right-4);assert.ok(g.top>=14);assert.ok(g.top+Math.min(g.chainHeight+40,g.maxHeight)<=586);assert.equal(g.scroll,g.chainHeight+40>g.maxHeight);assert.equal(g.scrollX,right<128);assert.equal(g.chainWidth,120);assert.equal(g.rows,count);
 }
 const col={left:550,right:670,width:120};assert.equal(layout(5,{top:50},col,1000,800).side,'right');assert.equal(layout(5,{top:50},col,700,800).side,'left');
});

test('narrow popup viewport retains full size rows and scroll access instead of shrinking options',()=>{
 for(const right of [80,85,110,128,320])for(const count of [3,5,25]){const g=layout(count,{top:50},{left:4,right:124,width:120},right,300);assert.equal(g.cols,1);assert.equal(g.step,26);assert.equal(g.chainWidth,120);assert.equal(g.width,Math.min(120,right-8));assert.equal(g.scrollX,right<128);assert.equal(new Set(Array.from({length:count},(_,i)=>slot(i).row)).size,count);}
});

test('option CSS reuses common hex buttons, visible names and inline icons/palettes',()=>{
 const fs=require('node:fs'),css=fs.readFileSync(__dirname+'/mayatnik-button-standard.css','utf8'),standard=fs.readFileSync(__dirname+'/mayatnik-button-standard.js','utf8'),menu=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8');
 assert.match(css,/may-button-options\{[^}]*gap:2px 0!important/);assert.match(css,/may-option-button>\.gz-nm\{[^}]*display:block!important/);assert.match(css,/may-option-symbol\{[^}]*order:-1/);assert.match(css,/may-option-button>\.may-view-swatch\{[^}]*position:relative[^}]*width:12px/);assert.doesNotMatch(css,/may-option-diamond|may-diamond-options/);assert.doesNotMatch(standard,/may-option-diamond|may-diamond-options/);assert.match(menu,/overflow-x',g.scrollX\?'auto'/);
});

test('decoration keeps text, icons, selected state, keyboard click and owner preview in a standard column',()=>{
 const {JSDOM}=require(process.env.SETKA_JSDOM||'C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom'),fs=require('node:fs');
 const dom=new JSDOM('<body><button id="owner"><span class="may-list-label"></span></button><div id="list"><button class="gz-hx"><span class="gz-nm">One</span></button><button class="gz-hx gz-on"><span class="gz-nm">Two</span><span class="gz-ic">★</span></button><button class="gz-hx"><span class="gz-nm">Three</span></button></div></body>',{runScripts:'outside-only'});
 try{const w=dom.window,owner=w.document.getElementById('owner'),list=w.document.getElementById('list');owner.dataset.listTitle='Выбор';owner.gzList={options:()=>[{name:'Первый'},{name:'Второй',on:true},{name:'Третий'}]};let clicks=0;list.children[0].onclick=()=>clicks++;w.eval(fs.readFileSync(__dirname+'/mayatnik-menu-options.js','utf8'));w.MayatnikMenuOptions.decorate(list,owner);
 assert.equal(list.style.gridTemplateColumns,'120px');assert.equal(list.style.gridTemplateRows,'repeat(3,24px)');assert.deepEqual([...list.querySelectorAll('.gz-hx')].map(n=>[n.style.gridRow,n.style.gridColumn]),[['1','1'],['2','1'],['3','1']]);assert.ok([...list.children].every(n=>n.classList.contains('may-option-button')));assert.deepEqual([...list.querySelectorAll('.gz-nm')].map(n=>n.textContent),['One','Two','Three']);assert.equal(list.children[1].querySelector('.gz-ic').textContent,'★');assert.ok(list.children[1].classList.contains('gz-on'));assert.equal(owner.querySelector('.may-list-label').textContent,'Второй');assert.equal(list.children[0].title,'Первый');
 list.children[2].dispatchEvent(new w.Event('pointerenter'));assert.equal(owner.querySelector('.may-list-label').textContent,'Третий');list.children[2].dispatchEvent(new w.Event('pointerleave'));assert.equal(owner.querySelector('.may-list-label').textContent,'Второй');list.children[0].dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));assert.equal(clicks,1);w.MayatnikMenuOptions.decorate(list,owner);list.children[0].dispatchEvent(new w.KeyboardEvent('keydown',{key:' ',bubbles:true}));assert.equal(clicks,2);assert.equal(list.querySelectorAll('.may-option-symbol').length,2);
 }finally{dom.window.close();}
});
function exclusionFixture({native=false,stored=null}={}){
 const {JSDOM}=require(process.env.SETKA_JSDOM||'C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom'),fs=require('node:fs');
 const dom=new JSDOM('<body><button class="gz-lst" data-n="viewCycle"><span class="may-list-label"></span></button><div id="list"></div></body>',{url:'http://localhost/',runScripts:'outside-only'}),w=dom.window,owner=w.document.querySelector('button'),list=w.document.getElementById('list');
 if(stored)w.localStorage.setItem('mayatnik-list-exclusions-v1',stored);
 let active='a',legacy=0,after=0,picks=0,folds=0,rowContexts=0;let items=[{key:'a',name:'Alpha'},{key:'b',name:'Beta'},{key:'c',name:'Gamma'}];
 owner.gzList={cycleOnClick:native,options:()=>items.map(o=>({...o,on:o.key===active,pick(){picks++;active=o.key;}})),after:()=>after++};
 owner.onclick=()=>{legacy++;const opts=owner.gzList.options(),index=opts.findIndex(o=>o.on);opts[(index+1)%opts.length].pick();};
 // The page standard owns document-capture folding; option rows opt out with data-no-mini.
 w.document.addEventListener('contextmenu',event=>{if(event.target.closest('[data-no-mini]'))return;const b=event.target.closest('button,.gz-hx');if(!b)return;folds++;event.preventDefault();event.stopImmediatePropagation();},true);
 const rebuild=()=>{list.replaceChildren(...items.map(item=>{const row=w.document.createElement('div');row.className='gz-hx';row.title=item.name;row.onclick=()=>owner.gzList.options().find(o=>o.key===item.key)?.pick();row.oncontextmenu=()=>rowContexts++;return row;}));w.MayatnikMenuOptions.decorate(list,owner);};
 w.eval(fs.readFileSync(__dirname+'/mayatnik-menu-options.js','utf8'));rebuild();
 return{dom,w,owner,list,api:w.MayatnikMenuOptions,rebuild,get active(){return active},set active(v){active=v},get legacy(){return legacy},get after(){return after},get picks(){return picks},get folds(){return folds},get rowContexts(){return rowContexts},set items(v){items=v},context:node=>node.dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2})),click:node=>node.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,button:0}))};
}
test('right-click exclusion keeps active variant, blocks direct selection, and never folds or invokes old row context',()=>{const f=exclusionFixture();try{
 const row=f.list.children[0];f.context(row);assert.equal(f.active,'a');assert.equal(f.picks,0);assert.equal(f.folds,0);assert.equal(f.rowContexts,0);assert.ok(row.classList.contains('may-option-excluded'));assert.equal(row.getAttribute('aria-disabled'),'true');f.click(row);assert.equal(f.picks,0);
 row.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));assert.equal(f.picks,0);f.context(row);assert.equal(row.getAttribute('aria-disabled'),'false');f.click(row);assert.equal(f.picks,1);f.context(f.owner);assert.equal(f.folds,1);assert.equal(f.active,'a');
 }finally{f.dom.window.close();}});
test('toolbar and native rail cycles skip exclusions once, support backward wheel, and restore legacy handlers when enabled',()=>{for(const native of [false,true]){const f=exclusionFixture({native});try{
 f.context(f.list.children[1]);f.click(f.owner);assert.equal(f.active,'c');assert.equal(f.picks,1);assert.equal(f.after,1);assert.equal(f.legacy,0);
 f.owner.dispatchEvent(new f.w.WheelEvent('wheel',{deltaY:-1,bubbles:true,cancelable:true}));assert.equal(f.active,'a');assert.equal(f.picks,2);assert.equal(f.after,2);
 f.api.install(f.owner);f.api.decorate(f.list,f.owner);f.click(f.owner);assert.equal(f.active,'c');assert.equal(f.picks,3);assert.equal(f.after,3);f.context(f.list.children[1]);f.click(f.owner);assert.equal(f.active,'a');assert.equal(f.legacy,1);
 }finally{f.dom.window.close();}}});
test('all excluded is a no-op; right-click restores an option without switching current state',()=>{const f=exclusionFixture();try{
 for(const row of f.list.children)f.context(row);f.click(f.owner);f.owner.dispatchEvent(new f.w.WheelEvent('wheel',{deltaY:1,bubbles:true,cancelable:true}));assert.equal(f.active,'a');assert.equal(f.picks,0);assert.equal(f.after,0);f.context(f.list.children[1]);assert.equal(f.active,'a');f.click(f.owner);assert.equal(f.active,'b');assert.equal(f.picks,1);f.click(f.owner);assert.equal(f.picks,1);
 }finally{f.dom.window.close();}});
test('palette cannot activate excluded inactive variant, while current excluded palette still edits colour',()=>{const f=exclusionFixture();try{
 const row=f.list.children[1],dot=f.w.document.createElement('button');dot.className='may-view-swatch';row.append(dot);let colours=0;dot.onclick=event=>{event.stopPropagation();colours++;f.active='b';};f.context(row);f.click(dot);assert.equal(colours,0);assert.equal(f.active,'a');f.active='b';f.click(dot);assert.equal(colours,1);f.context(dot);assert.equal(row.getAttribute('aria-disabled'),'true');assert.equal(f.folds,0);
 }finally{f.dom.window.close();}});
test('exclusions survive reload, reordering and renamed dynamic ID without affecting another owner',()=>{const f=exclusionFixture();let stored;try{f.context(f.list.children[1]);stored=f.w.localStorage.getItem(f.api.STORAGE_KEY);}finally{f.dom.window.close();}
 const g=exclusionFixture({stored});try{g.items=[{key:'c',name:'Gamma'},{key:'b',name:'Renamed layer'},{key:'a',name:'Alpha'}];g.rebuild();assert.ok(g.list.children[1].classList.contains('may-option-excluded'));g.click(g.owner);assert.equal(g.active,'c');const other=g.w.document.createElement('button');other.dataset.n='different';other.gzList=g.owner.gzList;assert.equal(g.api.isExcluded(other,{key:'b'}),false);assert.equal(g.api.optionKey({key:0}),'value:0');assert.equal(g.api.optionKey({key:false}),'value:false');
 }finally{g.dom.window.close();}});
test('stable fallback uses owner group/title and option name rather than DOM order',()=>{const f=exclusionFixture();try{delete f.owner.dataset.n;f.owner.dataset.listTitle='Modes';const group=f.w.document.createElement('div');group.dataset.id='field';group.append(f.owner);f.w.document.body.append(group);assert.equal(f.api.ownerKey(f.owner),'field:Modes');f.api.toggle(f.owner,{name:'Stable'});assert.equal(f.api.isExcluded(f.owner,{name:'Stable'}),true);assert.equal(f.api.isExcluded(f.owner,{name:'Other'}),false);}finally{f.dom.window.close();}});
test('actual shared grozd native cycle handler cannot double-advance an excluded owner',()=>{const f=exclusionFixture();try{
 const fs=require('node:fs');f.owner.onclick=null;f.owner.getClientRects=()=>[{left:0,top:0,right:120,bottom:24,width:120,height:24}];f.w.eval(fs.readFileSync(__dirname+'/../_js/grozd.js','utf8'));const live=f.owner.gzList;f.w.ZerkGrozd.listHover(f.owner,{...live,cycleOnClick:true});f.api.toggle(f.owner,live.options()[1]);f.click(f.owner);assert.equal(f.active,'c');assert.equal(f.picks,1);assert.equal(f.after,1);f.api.toggle(f.owner,live.options()[1]);f.click(f.owner);assert.equal(f.active,'a');assert.equal(f.picks,2);assert.equal(f.after,2);
 }finally{f.dom.window.close();}});
