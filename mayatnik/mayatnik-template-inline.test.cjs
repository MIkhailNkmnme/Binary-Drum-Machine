const test=require('node:test'),assert=require('node:assert/strict'),I=require('./mayatnik-template-inline.js');
function item(id,data=[1,0,1,1],x=0){return {id,parts:[{mask:{x,y:0,width:2,height:2,data:Uint32Array.from(data)},bitsData:Int8Array.from(data,v=>v?1:-1)}]};}
test('matching is exact, includes mirror copies regardless of colour/location and excludes unpicked or another silhouette',()=>{
 const a=item('a'),b=item('b',[0,9,9,9],40),c=item('c',[1,1,1,0]),d=item('d',[1,1,0,0]),e=item('e');
 assert.deepEqual(I.matching(a,[a,b,c,d,e],new Set(['a','b','c','d'])).map(t=>t.id),['a','b','c']);
 assert.notEqual(I.signature(a),I.signature(item('x',[1,0,0,1])));
});
test('source canonical survives reflected/split working parts and unrelated RGB edits',()=>{
 const a=item('a'),origin={key:'source-a',mask:a.parts[0].mask,librarySource:{version:1,width:2,height:2,runs:[[0,1,0,0,1],[2,4,0,1,1]]}},b={id:'b',parts:[{sourceOrigin:origin,mask:{x:90,y:90,width:1,height:1,data:[77]}},{sourceOrigin:origin,mask:{x:100,y:100,width:1,height:1,data:[99]}}]};
 assert.equal(I.signature(a),I.signature(b));assert.deepEqual(I.matching(a,[a,b],['a','b']),[a,b]);
});
test('same occupied silhouette with different semantic 0/1 values is excluded; mirrored bit values are included',()=>{
 const a=item('a',[7,7,7,7]),b=item('b',[99,99,99,99],40),different=item('different',[2,2,2,2],60);a.parts[0].bitsData=Int8Array.from([0,0,1,1]);b.parts[0].bitsData=Int8Array.from([1,1,0,0]);different.parts[0].bitsData=Int8Array.from([0,1,0,1]);assert.deepEqual(I.matching(a,[a,b,different],['a','b','different']).map(t=>t.id),['a','b']);b.parts[0].mask.data.fill(0xff000000);assert.equal(I.signature(a),I.signature(b));
});
test('librarySource bit proof ignores source addresses and colour but never infers bits from RGBA',()=>{
 const a=item('a',[7,7,7,7]),b=item('b',[255,255,255,255]);a.parts[0].bitsData=Int8Array.from([0,0,1,1]);delete b.parts[0].bitsData;b.parts[0].librarySource={version:1,width:2,height:2,runs:[[0,2,99,88,0],[2,4,50,60,1]]};assert.equal(I.signature(a),I.signature(b));delete b.parts[0].librarySource;assert.notEqual(I.signature(a),I.signature(b));
});
test('unproven semantics match only the active item or an objectively shared source origin',()=>{
 const a=item('a'),b=item('b');delete a.parts[0].bitsData;delete b.parts[0].bitsData;assert.deepEqual(I.matching(a,[a,b],['a','b']),[a]);const origin={key:'same-origin',mask:a.parts[0].mask};a.parts[0].sourceOrigin=origin;b.parts[0].sourceOrigin=structuredClone(origin);assert.equal(I.signature(a),I.signature(b));b.parts[0].sourceOrigin.key='unrelated';assert.notEqual(I.signature(a),I.signature(b));
});
test('sourceIndices recover semantic bits through mirrored working order and split source pieces',()=>{
 const a=item('a',[1,1,1,1]);a.parts[0].bitsData=Int8Array.from([0,0,1,1]);const origin={key:'origin',mask:a.parts[0].mask},b={id:'b',parts:[{sourceOrigin:origin,sourceIndices:Uint32Array.from([3,2]),mask:{x:30,y:30,width:2,height:1,data:Uint32Array.of(9,9)},bitsData:Int8Array.of(1,1)},{sourceOrigin:origin,sourceIndices:Uint32Array.from([1,0]),mask:{x:30,y:31,width:2,height:1,data:Uint32Array.of(9,9)},bitsData:Int8Array.of(0,0)}]};assert.equal(I.signature(a),I.signature(b));b.parts[1].bitsData[0]=1;assert.notEqual(I.signature(a),I.signature(b));
});
test('a family frozen before its first action survives colour, stretch and later bit-transform changes',()=>{const a=item('a'),b=item('b');a.inlineSourceKey=I.signature(a);b.inlineSourceKey=I.signature(b);b.parts[0].bitsData.fill(0);b.parts[0].mask.x=99;b.parts[0].mask.data.fill(77);assert.deepEqual(I.matching(a,[a,b],['a','b']),[a,b]);});
test('axis movement stays exactly along the selected axis, with same-lattice diamond steps',()=>{
 assert.deepEqual(I.constrained('h',6,400,2),{x:3,y:0});assert.deepEqual(I.constrained('v',400,-6,2),{x:0,y:-3});assert.deepEqual(I.constrained('h',5,900,2,true),{x:2,y:0});assert.deepEqual(I.constrained('v',100,7,2,true),{x:0,y:4});
 assert.deepEqual(I.constrained('h',-1,0,1,true),{x:-2,y:0});assert.deepEqual(I.constrained('h',1,0,1,true),{x:2,y:0});
});
test('scoped raster reset restores only recorded effects and preserves newer ordinary paint',()=>{
 const before={paint:Uint32Array.of(10,20,30),bits:Int8Array.of(-1,1,0)},after={paint:Uint32Array.of(99,20,30),bits:Int8Array.of(0,1,0)};
 const receipt=I.receipt(null,before,after),current={...after,paint:Uint32Array.of(99,55,30)};assert.deepEqual([...I.restoreReceipt(receipt,current).paint],[10,55,30]);assert.deepEqual([...I.restoreReceipt(receipt,current).bits],[-1,1,0]);
 const repainted={...current,paint:Uint32Array.of(42,55,30)};assert.equal(I.restoreReceipt(receipt,repainted).paint[0],42);
 const next=I.receipt(receipt,after,{...after,paint:Uint32Array.of(88,20,30)});assert.equal(I.restoreReceipt(next,{...after,paint:Uint32Array.of(88,20,30)}).paint[0],10);
});
function dom(){class Node{constructor(tag){this.tagName=tag;this.children=[];this.events={};this.style={setProperty(k,v){this[k]=v;}};this.dataset={};this.attrs={};this.classList={add(){},toggle(){}};this.namespaceURI='svg';}append(...children){this.children.push(...children);}prepend(child){this.children.unshift(child);}setAttribute(k,v){this.attrs[k]=String(v);}addEventListener(k,v){(this.events[k]||=[]).push(v);}emit(k,args={}){const e={button:0,pointerId:1,clientX:0,clientY:0,preventDefault(){},stopPropagation(){},...args};for(const f of this.events[k]||[])f(e);}setPointerCapture(){}releasePointerCapture(){}focus(){}remove(){this.removed=true;}}return {createElement:tag=>new Node(tag),createElementNS:(ns,tag)=>new Node(tag),body:new Node('body')};}
test('inline colour swatches apply immediately; controls forward commands without cloning template state',()=>{
 const doc=dom(),calls=[],view=I.mount({document:doc,action:(...a)=>calls.push(a)}),colour=view.host.children.find(n=>n.dataset.command==='colour'),palette=view.host.children.find(n=>n.className==='may-template-inline-palette');colour.emit('click');assert.equal(palette.hidden,false);palette.children[0].emit('click');assert.deepEqual(calls,[['colour','#ffffff']]);
 const save=view.host.children.find(n=>n.dataset.command==='save');save.emit('click');assert.deepEqual(calls.at(-1),['save']);assert.equal(palette.hidden,true);view.render({left:10,top:20,width:500,height:400,box:{x:30,y:40,width:60,height:70},colour:'#ff0000',height:100,downValue:3,alpha:50});assert.equal(colour.style['--sample'],'#ff0000');
});
test('all eight axis grips translate with threshold/cancel and keyboard, while Move OFF leaves manual-axis component alone',()=>{
 const doc=dom(),controls={host:doc.createElement('div')},calls=[],layout=(box,axes)=>axes.map((a,i)=>({...a,a:[i,0],b:[i,100]})),drag=I.axisDrag(controls,{layout},{document:doc,begin:(...x)=>{calls.push(['begin',...x]);return true;},move:(...x)=>calls.push(['move',...x]),end:cancel=>calls.push(['end',cancel])}),axes=Array.from({length:8},(_,i)=>({id:'axis'+i,direction:i<4?'h':'v',position:i}));
 const state={translateEnabled:true,box:{x:0,y:0,width:8,height:8},factor:2,rk:2,ox:0,oy:0,width:200,height:200,axes};drag.render(state);const svg=controls.host.children[0];assert.equal(svg.children.length,8);const h=svg.children[0];h.emit('pointerdown',{clientX:20,clientY:30});h.emit('pointermove',{clientX:22,clientY:30});assert.equal(calls.filter(x=>x[0]==='move').length,0);h.emit('pointermove',{clientX:26,clientY:70});assert.deepEqual(calls.at(-1),['move','h',3,20,2]);h.emit('pointercancel');assert.deepEqual(calls.at(-1),['end',true]);
 const v=svg.children[4];v.emit('keydown',{key:'ArrowDown'});assert.deepEqual(calls.at(-2),['move','v',0,2,2]);assert.deepEqual(calls.at(-1),['end',false]);drag.render({...state,translateEnabled:false});assert.equal(svg.style.display,'none');
});
test('a second touch hands the two current pointers to field pinch and cancels the axis transaction',()=>{
 const doc=dom(),controls={host:doc.createElement('div')};let capture,handed,ended;doc.addEventListener=(name,fn)=>capture=fn;
 const drag=I.axisDrag(controls,{layout:(box,axes)=>axes.map(a=>({...a,a:[0,0],b:[100,0]}))},{document:doc,begin:()=>true,move(){},end:cancel=>ended=cancel,secondTouch(event,first){handed={id:event.pointerId,first};drag.cancel();}});
 drag.render({translateEnabled:true,box:{x:0,y:0,width:10,height:10},factor:1,rk:1,ox:0,oy:0,width:100,height:100,axes:[{id:'centerH',direction:'h',position:5}]});const line=controls.host.children[0].children[0];line.emit('pointerdown',{pointerType:'touch',pointerId:7,clientX:10,clientY:20});line.emit('pointermove',{pointerId:7,clientX:15,clientY:20});capture({pointerType:'touch',pointerId:8,preventDefault(){},stopImmediatePropagation(){}});assert.deepEqual(handed,{id:8,first:{id:7,x:15,y:20}});assert.equal(ended,true);assert.equal(drag.dragging,false);
});
