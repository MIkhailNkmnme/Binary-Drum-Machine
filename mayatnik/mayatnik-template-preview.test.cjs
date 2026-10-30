const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('./mayatnik-template-matcher.js');global.MayatnikTemplateMatcher=M;
const Engine=require('./mayatnik-template-engine.js'),Joined=require('./mayatnik-joined-romb.js');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
function fn(name){const a=html.indexOf('function '+name+'('),b=html.indexOf('{',a);assert.ok(a>=0,name);let d=1,i=b+1;for(;d;i++){if(html[i]==='{')d++;if(html[i]==='}')d--;}return html.slice(a,i);}
const red=0xff4030e0,blue=0xffe08020,green=0xff40d060;
function fixture(){const shape={rk:1,hex:'#123456',parts:[{width:2,height:2,data:[red,blue,green,0]}]},entry={id:'a',name:'A',shape},field={width:5,height:2,data:Int8Array.from([1,1,0,1,1,1,0,0,1,0])};let current=true,edits=0;
 const host={entries:()=>[entry],field:async()=>field,current:()=>current,choose(){},stop(){},redrawSelection(){},instances:()=>['placed'],edit(){edits++;}};
 return {shape,entry,field,host,api:Engine.create(host),invalidate(){current=false;},get edits(){return edits;}};}
test('card toggles all matches and exact preview colours without touching field, shape or paint commands',async()=>{
 const f=fixture(),before=structuredClone({shape:f.shape,field:f.field});await f.api.select('a');const selected=f.api.getSelection();assert.equal(selected.count,2);assert.deepEqual([...selected.colours],[red,blue,0,red,blue,green,0,0,green,0]);assert.equal(selected.previewShape,f.shape);assert.deepEqual(selected.instances,['placed']);
 await f.api.select('a');assert.equal(f.api.getSelection(),null);assert.equal(f.api.getState().selectedId,null);assert.equal(f.edits,0);assert.deepEqual(f.shape,before.shape);assert.deepEqual(f.field,before.field);
 await f.api.select('a');assert.equal(f.api.getSelection().selected,selected.selected);await f.api.selectShape(f.shape);await f.api.selectShape(f.shape);assert.ok(f.api.getSelection(),'programmatic selection never toggles');assert.equal(f.api.getSelection().colours,null);
});
test('repeat while busy and stale snapshots cannot publish late preview colours',async()=>{
 const f=fixture();let resolve;f.host.field=()=>new Promise(r=>resolve=r);const pending=f.api.select('a');assert.equal(f.api.getState().busy,true);await f.api.select('a');resolve(f.field);await pending;assert.equal(f.api.getSelection(),null);assert.equal(f.api.getState().selectedId,null);
 const next=f.api.select('a');f.invalidate();resolve(f.field);await next;assert.equal(f.api.getSelection(),null);assert.equal(f.api.getState().busy,false);
});
test('compiled mirrored/rescaled patterns retain exact source pixel indices and packed RGBA',()=>{
 const p={width:4,height:2,data:[red,blue,green,red,blue,green,red,blue]};
 for(const mirrorX of [false,true]){const compiled=M.compile(p,2,{mirrorX});assert.deepEqual([...compiled.sourceIndices],mirrorX?[7,5]:[5,7]);assert.deepEqual([...compiled.colours],mirrorX?[blue,green]:[green,blue]);}
});
function canvas(){const c={width:0,height:0};c.getContext=()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:im=>{c.pixels=new Uint32Array(im.data.buffer).slice();}});return c;}
function renderFixture(selection,geometry=null){const drawings=[],ctx={drawImage:(...args)=>drawings.push(args),save(){},restore(){},setLineDash(){},strokeRect(){},beginPath(){},rect(){},clip(){}};
 const c={window:{mayTemplateLibrary:{getSelection:()=>selection}},document:{createElement:canvas},templateSelectionPicture:null,templateMatchCurrent:()=>true,st:{parity:{}},VX:0,VW:selection.field.width,VH:selection.field.height,RK:1,f:{W:selection.field.width,H:selection.field.height},templateItems:[],rombP:()=>geometry?3:-1,joinedOn:()=>!!geometry,dispW:()=>geometry?geometry.width:selection.field.width,dispH:()=>geometry?geometry.height:selection.field.height,parityVisible:()=>true,
 displayCell:(x,y)=>geometry?geometry.hit(x,y):{c:Math.floor(x),r:Math.floor(y)},templateRect:part=>({x:part.x||0,y:0,width:part.mask.width,height:part.mask.height})};
 vm.createContext(c);vm.runInContext(fn('templatePartWidth')+'\n'+fn('templateSelectionPartCanvas')+'\n'+fn('templateMatchSelectionDraw'),c);return {c,ctx,drawings};}
test('real shared CPU/GPU screen renderer preserves exact colours, parity, empty cells and restores prepainted pixels when cleared',async()=>{
 const f=fixture();await f.api.select('a');const selected=f.api.getSelection(),r=renderFixture(selected),paint=Uint32Array.from({length:10},()=>0xff123456),original=paint.slice();
 r.c.templateMatchSelectionDraw(r.ctx,0,0,1,5,2);const pixels=r.drawings[0][0].pixels;assert.deepEqual(pixels,selected.colours);const composite=paint.map((v,q)=>pixels[q]||v);assert.equal(composite[0],red);assert.equal(composite[2],original[2]);assert.deepEqual(paint,original);
 r.c.parityVisible=(row,col)=>(row+col)%2===0;r.c.st.parity={even:true};r.drawings.length=0;r.c.templateMatchSelectionDraw(r.ctx,0,0,1,5,2);assert.equal(r.drawings[0][0].pixels[1],0);
 r.c.window.mayTemplateLibrary.getSelection=()=>null;r.drawings.length=0;r.c.templateMatchSelectionDraw(r.ctx,0,0,1,5,2);assert.equal(r.drawings.length,0);assert.deepEqual(paint,original);
});
test('placed multicolour preview preserves holes, reflected source colours and existing command paint',async()=>{
 const f=fixture();await f.api.select('a');const selected=f.api.getSelection(),r=renderFixture(selected),mask={width:2,height:2,data:Uint32Array.of(7,7,7,0)},part={mask,ox:0},item={id:'placed',view:{visible:true},parts:[part]},oldPaint={colours:{placed:'#aabbcc'}};
 r.c.templatePaintLayer=oldPaint;r.c.templateItems=[item];r.c.templateMatchSelectionDraw(r.ctx,0,0,1,5,2);assert.deepEqual([...r.drawings[1][0].pixels],[red,blue,green,0]);assert.equal(r.c.templatePaintLayer,oldPaint);assert.deepEqual([...mask.data],[7,7,7,0]);
 item.matchOrientation='mirror';mask.data=Uint32Array.of(7,7,0,7);const picture=r.c.templateSelectionPartCanvas(selected,item,part,0);assert.deepEqual([...picture.pixels],[blue,red,0,green]);
});
test('joined geometry screen overlay samples source cells for both rotation parities without duplicating source colours',()=>{
 for(const rotateParity of [0,1]){const geometry=Joined.create({width:5,height:3,origin:0,anchor:2,fieldWidth:5,rotate:true,rotateParity}),field={width:5,height:3},selection={field,selected:new Uint8Array(15).fill(1),colours:Uint32Array.from({length:15},(_,q)=>0xff000000+q),instances:[]},r=renderFixture(selection,geometry);
  const width=geometry.width,height=geometry.height;r.c.templateMatchSelectionDraw(r.ctx,0,0,2,width*2,height*2);const pixels=r.drawings[0][0].pixels;let occupied=0;
  for(let y=0;y<height*2;y++)for(let x=0;x<width*2;x++){const cell=geometry.hit((x+.5)/2,(y+.5)/2);assert.equal(pixels[y*width*2+x],cell?selection.colours[cell.q]:0);if(cell)occupied++;}assert.ok(occupied>0);
 }
});
