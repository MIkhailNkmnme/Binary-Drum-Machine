const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const G=require('./zz-grids.js'),E=require('./zz-rmb-editor.js'),A=require('./zz-rmb-axis.js');
const source=fs.readFileSync(__dirname+'/../setka/setka-engine.js','utf8')+fs.readFileSync(__dirname+'/zz-ui.js','utf8'),plain=x=>JSON.parse(JSON.stringify(x));
const state=()=>({rows:['0100','0000'],cur:0,colors:{'0,1':'#ffd166'},groups:{},dots:{},lines:{},scenes:[],text:'',textBlocks:[]});
function context(){const Z={rows:['0100','0000'],cur:1,rmb:{axes:[]},rowsAlign:'left',rowLock:true};const c=vm.createContext({Z,window:{ZZGrids:G,ZZRmbAxis:A},renderRmb(){},save(){},say(){},rmbWStop(){},rmbEditor:null,rmbSt:()=>Z.rmb,undoPush(){}});vm.runInContext(source.slice(source.indexOf('function gridsState(){'),source.indexOf('const rmbIsMobile=')),c);return c;}
test('new grid starts independently; saved grid content survives reload',()=>{
 const c=context(),s=c.gridsState();assert.deepEqual(plain(s.rows),['0']);assert.equal(s.align,'center');c.Z.rows[0]='1111';assert.equal(s.rows[0],'0');G.write(s,0,0,'#f00');assert.equal(c.Z.rows[0],'1111');assert.equal(c.gridsLocked(),false);
 const saved=JSON.parse(JSON.stringify(c.Z));c.Z=saved;assert.equal(c.gridsState().rows[0],'1');
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
 const region=fs.readFileSync(__dirname+'/../setka/setka-engine.js','utf8');const withoutMigration=region;
 assert.doesNotMatch(withoutMigration,/\bZ\.rows\b|bAnimPlay|bAnimStep|bAnimHome|rowsLocked\(/);assert.match(region,/gridsSnapshot/);assert.match(source,/top\.grids/);
 const html=fs.readFileSync(__dirname+'/../setka/Zerkalius-setka.html','utf8');assert.match(html,/id="w-rmb" data-title="Сетки"/);assert.match(html,/id="gridsRowsPane"/);assert.doesNotMatch(html,/data-grid-view/);
});
test('real controller brushes, cancels a gesture, edits own rows and restores scenes',()=>{
 class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.style={};this.value='';this.scrollTop=0;this.clientHeight=260;this.classList={toggle(){}};this.events={};}
  append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;}setAttribute(){}focus(){}blur(){}setPointerCapture(){}releasePointerCapture(){}
  contains(x){return this.children.includes(x);}matches(selector){return selector==='input'&&this.tagName==='INPUT';}
  addEventListener(t,f){(this.events[t]??=[]).push(f);}getBoundingClientRect(){return {left:0,top:0};}
 }
 const ids={},tools=['brush','erase','group','dot','line'].map(tool=>{const b=new Element('button');b.dataset.gridTool=tool;return b;});
 let s=state(),view={cell:'rmb',ln:'each'},snapshots=[],saved=0;const originalRows=['10','01'];
 const document={activeElement:null,getElementById:id=>ids[id]??=new Element(id==='gridsScenes'?'select':'div'),querySelectorAll:()=>tools,createElement:tag=>new Element(tag),createDocumentFragment:()=>new Element()};
 const ctx=vm.createContext({document,matchMedia:()=>({matches:false}),setTimeout:f=>f(),prompt:()=>'',navigator:{clipboard:{writeText:async()=>{}}}});vm.runInContext(fs.readFileSync(__dirname+'/zz-grids.js','utf8'),ctx);
 const cv=new Element('canvas'),api=ctx.ZZGrids,g={hs:[0,1],u0:1,rm:true,tw:20,ox:0,oy:0};
 const cfg={importRows:()=>originalRows,state:()=>s,view:()=>view,geometry:()=>g,hit:E.hit,polygon:(r,c)=>{const x=(g.hs[r]/2+c)*20,y=r*20*Math.sqrt(3)/2;return [[x,y],[x+20,y],[x+30,y+20*Math.sqrt(3)/2],[x+10,y+20*Math.sqrt(3)/2]];},snapshot:before=>snapshots.push(clone(before||s)),locked:()=>!!s.locked,redraw(){api.sync();},save(){saved++;},message(){},editor:()=>({selection:()=>[],clear(){},setSelection(){}}),axis:()=>({cancel(){}}),fit(){},legacy:()=>({scenes:[],cells:{},dots:{},lines:{}})};
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
 before=snapshots.length;ids.gridsRowsImport.onclick();assert.deepEqual(clone(s.rows),['10','01']);assert.equal(snapshots.length,before+1);assert.notEqual(s.rows,originalRows);
 s.rows[0]='00';assert.deepEqual(originalRows,['10','01']);
 Object.assign(s,{colors:{'1,1':'red'},groups:{'1,1':{symbol:'A'}},dots:{a:{}},lines:{b:{}},text:'A',textBlocks:[{text:'A'}],textWidth:3});view.axes=[{id:1}];list.scrollTop=200;
 before=snapshots.length;ids.gridsRowsImport.onclick();assert.deepEqual(clone(s.rows),['10','01']);assert.equal(snapshots.length,before+1);assert.equal(snapshots.at(-1).colors['1,1'],'red');assert.equal(snapshots.at(-1).text,'A');
 for(const name of ['colors','groups','dots','lines'])assert.deepEqual(clone(s[name]),{});
 assert.equal(s.text,'');assert.deepEqual(clone(s.textBlocks),[]);assert.equal(s.textWidth,null);assert.deepEqual(clone(view.axes),[]);assert.equal(list.scrollTop,0);
 originalRows[0]='11';assert.equal(s.rows[0],'10');ids.gridsRowsLock.onclick();before=snapshots.length;ids.gridsRowsImport.onclick();assert.equal(s.rows.length,2);assert.equal(snapshots.length,before);


});

test('unhandled grid keys cannot delete, select or navigate ordinary rows',()=>{
 const start=source.indexOf('// v0.012: Del/Backspace'),end=source.indexOf('\n  renderAll();',start),calls=[];let handler;
 const c=vm.createContext({document:{body:{classList:{contains:()=>false,add(){}}},addEventListener:(type,fn)=>handler=fn},window:{},Z:{rows:['1','10'],cur:1,laneCount:2,laneView:'over'},axSel:1,
  undo:()=>calls.push('undo'),redo:()=>calls.push('redo'),deleteLane:()=>calls.push('lane'),deleteSelection:()=>calls.push('rows'),renderRows:()=>calls.push('render'),renderAll:()=>calls.push('renderAll'),save(){},say(){},clearTextSel(){},rowSel:new Set(),switchLane:()=>calls.push('switch')});
 vm.runInContext(source.slice(start,end),c);
 const event=(key,grid=true,extra={})=>({key,target:{closest:selector=>grid&&selector==='#w-rmb'},preventDefault(){},...extra});
 for(const key of ['Delete','Backspace','Escape','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'])handler(event(key));
 handler(event('a',true,{ctrlKey:true}));assert.deepEqual(calls,[]);assert.deepEqual(plain(c.Z.rows),['1','10']);assert.equal(c.Z.cur,1);
 handler(event('Delete',false,{defaultPrevented:true}));assert.deepEqual(calls,[]);
 handler(event('z',true,{ctrlKey:true}));assert.deepEqual(calls,['undo']);calls.length=0;
 handler(event('Delete',false));assert.deepEqual(calls,['lane']);c.axSel=-1;handler(event('Delete',false));assert.deepEqual(calls,['lane','rows']);
});

test('square and ring UI geometry fits, renders and edits the same unchanged binary cells',()=>{
 const Shapes=require('./zz-grid-shapes.js'),rows=['101','01011','10'],before=rows.slice();
 class P{moveTo(){}lineTo(){}closePath(){}arc(){}}
 const st={rows:rows.slice(),align:'center',cur:1},Z={rmb:{cell:'square',al:'zz'}};
 const ctx=vm.createContext({Z,gridsState:()=>st,window:{ZZGridShapes:Shapes,ZerkGridParity:require('../_js/grid-parity.js')},$:()=>({clientWidth:640,clientHeight:400}),Path2D:P,coneCss:(a,b)=>b,rmbFrame:1,rmbClock:1,rmbHeat:[],rmbAge:[],RMB_AGE:[[2,'red']]});
 vm.runInContext(source.slice(source.indexOf('function rmbSt(){'),source.indexOf('/* v0.795,',source.indexOf('function rmbSt(){'))),ctx);
 vm.runInContext(source.slice(source.indexOf('function rmbFit(){'),source.indexOf('function rmbUi(){')),ctx);
 vm.runInContext(source.slice(source.indexOf('function rmbVisible('),source.indexOf('function rmbHighlightPolygon(')),ctx);
 vm.runInContext(source.slice(source.indexOf('function rmbRenderShapes('),source.indexOf('function renderRmb(){')),ctx);
 for(const cell of ['square','ring']){
  Z.rmb.cell=cell;ctx.rmbFit();const r=Z.rmb,{hs,u0}=ctx.rmbLayout(rows,rows.length,r.al,cell),geo={hs,u0,cell,rows,tw:r.s,ox:r.ox,oy:r.oy,M:rows.length,Wc:640,Hc:400};
  assert.ok(r.s>0&&Number.isFinite(r.ox)&&Number.isFinite(r.oy));
  for(let i=0;i<rows.length;i++)for(let j=0;j<rows[i].length;j++){
   const q=Shapes.center(i,j,geo);assert.deepEqual(E.hit(rows,geo,r.ox+q[0]*r.s,r.oy+q[1]*r.s),[i,j]);
   for(const p of Shapes.polygon(i,j,geo)){assert.ok(p[0]>=0&&p[0]<=640);assert.ok(p[1]>=0&&p[1]<=400);}
  }
  let fills=0,strokes=0;const g={save(){},restore(){},fill(){fills++;},stroke(){strokes++;},fillText(){}};
  ctx.rmbRenderShapes(g,geo,{...r,out:true,ln:'each',num:true,sh:true},'#777','#fd0');assert.ok(fills>=2&&strokes>=2);assert.deepEqual(rows,before);assert.deepEqual(st.rows,before);
  const filled={rows:['111','11111'],colors:{}};assert.equal(G.component(filled,[0,0],()=>[],(i,j)=>Shapes.neighbors(filled.rows,{cell,hs:[0,0]},i,j)).length,8);
 }
});
test('ring mirror wave copies matching angular sectors into outer rows only',()=>{
 const c=context();c.rmbUi=()=>{};c.cancelAnimationFrame=()=>{};c.Z.rmb={cell:'ring',al:'c',whz:1};const ordinary=plain(c.Z.rows),st=c.gridsState();st.rows=['10','0000','0000'];st.colors={'0,0':'red'};
 vm.runInContext(source.slice(source.indexOf('function rmbLayout('),source.indexOf('/* v0.795,',source.indexOf('function rmbLayout('))),c);
 vm.runInContext(source.slice(source.indexOf('const rmbW ='),source.indexOf('const RMB_WMASK =')),c);
 c.rmbWStep();assert.deepEqual(plain(st.rows),['10','1100','0000']);assert.equal(st.colors['1,0'],'red');assert.equal(st.colors['1,1'],'red');assert.deepEqual(plain(c.Z.rows),ordinary);
 c.rmbWHome();assert.deepEqual(plain(c.gridsState().rows),['10','0000','0000']);
});
