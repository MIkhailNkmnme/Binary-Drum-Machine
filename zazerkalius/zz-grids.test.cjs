const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const G=require('./zz-grids.js'),E=require('./zz-rmb-editor.js'),A=require('./zz-rmb-axis.js');
const source=fs.readFileSync(__dirname+'/zz-ui.js','utf8'),plain=x=>JSON.parse(JSON.stringify(x));
const state=()=>({rows:['0100','0000'],cur:0,colors:{'0,1':'#ffd166'},groups:{},dots:{},lines:{},scenes:[],text:'',textBlocks:[]});
function context(){const Z={rows:['0100','0000'],cur:1,rmb:{axes:[]},rowsAlign:'left',rowLock:true};const c=vm.createContext({Z,window:{ZZGrids:G,ZZRmbAxis:A},renderRmb(){},save(){},say(){},rmbWStop(){},rmbEditor:null,rmbSt:()=>Z.rmb,undoPush(){}});vm.runInContext(source.slice(source.indexOf('function gridsState(){'),source.indexOf('const rmbIsMobile=')),c);return c;}
test('migration copies current rows once; both directions are independent',()=>{
 const c=context(),s=c.gridsState();assert.notEqual(s.rows,c.Z.rows);assert.equal(s.align,'left');c.Z.rows[0]='1111';assert.equal(s.rows[0],'0100');G.write(s,1,2,'#f00');assert.equal(c.Z.rows[1],'0000');assert.equal(c.gridsLocked(),false);
 const saved=JSON.parse(JSON.stringify(c.Z));c.Z=saved;assert.equal(c.gridsState().rows[1],'0010');
});
test('brush and erase update the same bits read by the right-hand matrix',()=>{
 const s=state();assert.ok(G.write(s,1,2,'#ff0000'));assert.equal(s.rows[1],'0010');assert.equal(s.colors['1,2'],'#ff0000');G.write(s,1,2,null);assert.equal(s.rows[1],'0000');assert.equal(s.colors['1,2'],undefined);assert.equal(G.write(s,9,9,'#fff'),false);
});
test('move/copy preserve cell colors and group metadata, row edits prune erased cells',()=>{
 const s=state();s.groups['0,1']={symbol:'A'};let result=E.apply(s.rows,[[0,1]],{dr:1,dc:1,copy:true});G.reconcile(s,result.rows,result);
 assert.equal(s.colors['0,1'],'#ffd166');assert.equal(s.colors['1,2'],'#ffd166');assert.equal(s.groups['1,2'].symbol,'A');
 result=E.apply(s.rows,[[0,1]],{dc:2});G.reconcile(s,result.rows,result);assert.equal(s.colors['0,1'],undefined);assert.equal(s.colors['0,3'],'#ffd166');
 G.reconcile(s,['0000','0000']);assert.deepEqual(s.colors,{});assert.deepEqual(s.groups,{});
});
test('manual mirror copies colors as well as bits and does not mutate its source snapshot',()=>{
 const s=state();s.rows=['1010'];s.colors={'0,0':'#f00','0,2':'#0f0'};const before=s.rows.slice(),g={hs:[0],u0:1,rm:true,tw:20,ox:0,oy:0};
 const result=A.reflectRows(s.rows,g,{a:[2,0],b:[2,2]},'positive');G.reconcile(s,result.rows,result);assert.deepEqual(before,['1010']);assert.equal(s.rows[0],'0110');assert.equal(s.colors['0,1'],'#0f0');assert.equal(s.colors['0,0'],undefined);
});
test('own row insertion/removal moves cell metadata, never creates an empty matrix',()=>{
 const s=state();G.shiftRows(s,0,0,['0000']);assert.equal(s.rows.length,3);assert.equal(s.colors['1,1'],'#ffd166');G.shiftRows(s,1,1,[]);assert.deepEqual(s.colors,{});G.shiftRows(s,0,99,[]);assert.deepEqual(s.rows,['0']);
});
test('scenes snapshot all layers without recursively embedding the scene collection',()=>{
 const s=state();s.scenes=[{name:'old',data:{rows:['1']}}];s.dots['1,2']={color:'#fff',size:2};const saved=G.scene(s);assert.equal(saved.scenes,undefined);s.rows[0]='0000';s.dots['1,2'].size=9;assert.equal(saved.rows[0],'0100');assert.equal(saved.dots['1,2'].size,2);
});
test('connected groups follow actual shared edges and stop at color boundaries',()=>{
 const s=state();s.rows=['111','010'];s.colors={'0,0':'red','0,1':'red','0,2':'blue','1,1':'red'};
 const polygon=(r,c)=>[[c,r],[c+1,r],[c+1,r+1],[c,r+1]];assert.deepEqual(G.component(s,[0,0],polygon),[[0,0],[0,1],[1,1]]);
});
test('old triangle scenes preserve every cell, points, lines and group labels',()=>{
 const old={R:2,N:4,c:{'0_0':2,'1_0':3,'1_3':4},d:{'0_1':[2,4]},l:{'0_1|1_0':[3,2]},gt:{'1_3':'X'},gi:{'1_3':false},gl:{'1_3':'#123456'}};
 const data=G.legacyScene(old,state());assert.deepEqual(data.rows,['001000','010010']);assert.equal(Object.keys(data.colors).length,3);assert.equal(Object.keys(data.dots).length,1);assert.equal(Object.keys(data.lines).length,1);assert.equal(data.groups['1,4'].symbol,'X');assert.equal(data.groups['1,4'].inner,false);
});
test('triangle hit testing agrees with every displayed triangle centroid',()=>{
 const rows=['101010','010101'],g={hs:[-6,-5],u0:0,rm:false,tw:20,ox:100,oy:30},h=20*Math.sqrt(3)/2;
 for(let r=0;r<2;r++)for(let c=0;c<6;c++)assert.deepEqual(E.hit(rows,g,100+(g.hs[r]+c)*10+10,30+(r+(c%2?1/3:2/3))*h),[r,c]);
});
test('grid undo ignores the ordinary rows lock and restores only grid state',()=>{
 const c=context();let snap;c.undoPush=v=>snap=v;const initial=plain(c.gridsState());c.gridsSnapshot();G.write(c.gridsState(),1,1,'#f00');c.Z.rows=['111'];c.gridsApply(snap.grids);assert.deepEqual(plain(c.gridsState()),initial);assert.deepEqual(plain(c.Z.rows),['111']);
});
test('the local mirror wave and its reset preserve ordinary rows and restore grid colors',()=>{
 const c=context();c.rmbUi=()=>{};c.cancelAnimationFrame=()=>{};c.Z.rmb={cell:'rmb',al:'r',whz:1};const original=plain(c.Z.rows),st=c.gridsState();st.rows=['1010','0000','0000'];st.colors={'0,0':'#ff0000'};const before=plain(st);
 vm.runInContext(source.slice(source.indexOf('function rmbLayout('),source.indexOf('/* v0.795,',source.indexOf('function rmbLayout('))),c);
 vm.runInContext(source.slice(source.indexOf('const rmbW ='),source.indexOf('const RMB_WMASK =')),c);
 c.rmbWStep();assert.notDeepEqual(plain(c.gridsState().rows),before.rows);assert.deepEqual(plain(c.Z.rows),original);
 c.rmbWHome();assert.deepEqual(plain(c.gridsState()),before);assert.deepEqual(plain(c.Z.rows),original);
});
test('source wiring has no shared-row animation or row write in the grid implementation',()=>{
 const region=source.slice(source.indexOf('function rmbSt()'),source.indexOf('function bipyGeo('));const withoutMigration=region.replace(/function gridsState\(\)\{[\s\S]*?\n\}/,'');
 assert.doesNotMatch(withoutMigration,/\bZ\.rows\b|bAnimPlay|bAnimStep|bAnimHome|rowsLocked\(/);assert.match(region,/gridsSnapshot/);assert.match(source,/top\.grids/);
 const html=fs.readFileSync(__dirname+'/Zerkalius-zazerkalius.html','utf8');assert.match(html,/id="w-rmb" data-title="Сетки"/);assert.match(html,/id="gridsRowsPane"/);assert.doesNotMatch(html,/data-grid-view/);
});
test('real controller brushes, cancels a gesture, edits own rows and restores scenes',()=>{
 class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.style={};this.value='';this.scrollTop=0;this.clientHeight=260;this.classList={toggle(){}};this.events={};}
  append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;}setAttribute(){}focus(){}blur(){}setPointerCapture(){}releasePointerCapture(){}
  contains(x){return this.children.includes(x);}matches(selector){return selector==='input'&&this.tagName==='INPUT';}
  addEventListener(t,f){(this.events[t]??=[]).push(f);}getBoundingClientRect(){return {left:0,top:0};}
 }
 const ids={},tools=['brush','erase','group','dot','line'].map(tool=>{const b=new Element('button');b.dataset.gridTool=tool;return b;});
 let s=state(),view={cell:'rmb',ln:'each'},snapshots=[],saved=0;
 const document={activeElement:null,getElementById:id=>ids[id]??=new Element(id==='gridsScenes'?'select':'div'),querySelectorAll:()=>tools,createElement:tag=>new Element(tag),createDocumentFragment:()=>new Element()};
 const ctx=vm.createContext({document,matchMedia:()=>({matches:false}),setTimeout:f=>f(),prompt:()=>'',navigator:{clipboard:{writeText:async()=>{}}}});vm.runInContext(fs.readFileSync(__dirname+'/zz-grids.js','utf8'),ctx);
 const cv=new Element('canvas'),api=ctx.ZZGrids,g={hs:[0,1],u0:1,rm:true,tw:20,ox:0,oy:0};
 const cfg={state:()=>s,view:()=>view,geometry:()=>g,hit:E.hit,polygon:(r,c)=>{const x=(g.hs[r]/2+c)*20,y=r*20*Math.sqrt(3)/2;return [[x,y],[x+20,y],[x+30,y+20*Math.sqrt(3)/2],[x+10,y+20*Math.sqrt(3)/2]];},snapshot:before=>snapshots.push(clone(before||s)),locked:()=>!!s.locked,redraw(){api.sync();},save(){saved++;},message(){},editor:()=>({selection:()=>[],clear(){},setSelection(){}}),axis:()=>({cancel(){}}),fit(){},legacy:()=>({scenes:[],cells:{},dots:{},lines:{}})};
 function clone(x){return JSON.parse(JSON.stringify(x));}
 function fire(type,x,y){const e={button:0,pointerId:1,clientX:x,clientY:y,preventDefault(){},stopImmediatePropagation(){this.stopped=true;}};for(const fn of cv.events[type]||[]){fn(e);if(e.stopped)break;}}
 api.mount(cv,cfg);tools[0].onclick();fire('pointerdown',55,9);fire('pointerup',55,9);assert.equal(s.rows[0],'0110');assert.equal(snapshots.length,1);assert.equal(snapshots[0].rows[0],'0100');
 fire('pointerdown',75,9);api.cancel();assert.equal(s.rows[0],'0110');assert.equal(snapshots.length,1);
 const input=new Element('input');input.dataset.row='1';input.value='1111';ids.gridsRowsList.onchange({target:input});assert.equal(s.rows[1],'1111');assert.equal(snapshots.length,2);
 ids.gridsSceneNew.onclick();ids.gridsClear.onclick();assert.equal(s.rows[1],'0000');ids.gridsScenes.onchange({target:{value:'0'}});assert.equal(s.rows[1],'1111');
 ids.gridsRowsLock.onclick();input.value='0000';ids.gridsRowsList.onchange({target:input});assert.equal(s.rows[1],'1111');assert.equal(input.value,'1111');assert.ok(saved>0);
 const list=ids.gridsRowsList;input.closest=()=>input;
 const event=extra=>({key:'Delete',target:input,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra});
 let before=snapshots.length,e=event();list.onkeydown(e);assert.equal(s.rows.length,2);assert.equal(snapshots.length,before);assert.ok(e.prevented&&e.stopped);
 ids.gridsRowsLock.onclick();
 for(const extra of [{repeat:true},{isComposing:true},{ctrlKey:true},{key:'Backspace'}]){list.onkeydown(event(extra));assert.equal(s.rows.length,2);}
 s.colors['1,0']='#fff';input.value='000';input.blur=()=>{list.onchange({target:input});};list.focus=()=>{list.focused=true;};
 e=event();list.onkeydown(e);assert.deepEqual(clone(s.rows),['0110']);assert.equal(snapshots.length,before+1);assert.deepEqual(snapshots.at(-1).rows,['0110','1111']);assert.equal(s.colors['1,0'],undefined);assert.equal(input.value,'1111');assert.ok(list.focused);
 // Restoring the recorded undo snapshot restores the removed row and its color.
 Object.assign(s,clone(snapshots.at(-1)));assert.equal(s.rows[1],'1111');assert.equal(s.colors['1,0'],'#fff');
 input.dataset.row='0';list.onkeydown(event());list.onkeydown(event());assert.deepEqual(clone(s.rows),['0']);

});
