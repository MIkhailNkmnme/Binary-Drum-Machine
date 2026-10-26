const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
const Contours=require('./mayatnik-bit-contours.js'),Cells=require('./mayatnik-cell-selection.js');
function fn(name){const start=html.indexOf('function '+name+'(');assert.ok(start>=0,name);const brace=html.indexOf('{',start);let depth=1,i=brace+1;for(;depth&&i<html.length;i++){if(html[i]==='{')depth++;else if(html[i]==='}')depth--;}return html.slice(start,i);}
function fixture(view='bitContours'){
 const colour=0xff555555,c=vm.createContext({st:{view,blackMirror:2},joinedOn:()=>false,f:{W:2,H:2,val:Int8Array.of(0,1,0,-1)},img:{width:2,height:2},VW:2,VH:2,VX:0,RK:1,contourBits:null,contourTagging:false,paintBits:null,parityVisible:()=>true,outShow:()=>false,fillBase:null,rombP:()=>-1,blackTriUp:()=>Uint16Array.of(0,0,1,1),mirBitC:[colour,colour],mirPre:()=>{},pxFam:()=> 'k',pxBit:()=>0,mixPx:()=>{throw Error('unexpected blend');},Int8Array,Uint32Array,rgba:()=>0xff000000,EMPTY:[],parityActive:()=>true});
 for(const name of ['contourColour','contourBegin','contourEnd','contourEdits','mirPut','blackMirrorApply','parityMask'])vm.runInContext(fn(name),c);
 return {c,px:new Uint32Array(4).fill(colour)};
}
test('semantic tags survive geometric mirror copies with identical colours and never leak into public pixels',()=>{
 const {c,px}=fixture();c.contourBegin(px);assert.deepEqual(Array.from(px,v=>v>>>24),[253,254,253,252]);c.mirPut(px,3,px[1],1);c.contourEnd(px);
 assert.deepEqual(Array.from(c.contourBits),[0,1,0,1]);assert.ok(px.every(v=>v===0xff555555));assert.equal(c.contourTagging,false);
});
test('post-paint black mirrors carry semantic bits rather than guessing identical colour values',()=>{
 const {c,px}=fixture();c.contourBegin(px);c.contourEnd(px);c.blackMirrorApply(px);assert.deepEqual(Array.from(c.contourBits),[0,1,0,1]);assert.ok(px.every(v=>v===0xff555555));
});
test('painted bit overrides and final parity mask update contours without changing stored field',()=>{
 const {c,px}=fixture(),original=Array.from(c.f.val);c.contourBegin(px);c.contourEnd(px);c.paintBits=Int8Array.of(-1,0,-1,1);c.contourEdits();assert.deepEqual(Array.from(c.contourBits),[0,0,0,1]);c.parityVisible=(y,x)=>x===0;c.parityMask(px);assert.deepEqual(Array.from(c.contourBits),[0,-1,0,-1]);assert.deepEqual(Array.from(c.f.val),original);
});
test('ordinary views never tag pixels or allocate a semantic field',()=>{
 for(const view of ['bits','digitsOnly','col']){const {c,px}=fixture(view);c.contourBegin(px);c.mirPut(px,3,px[1],1);c.contourEnd(px);assert.equal(c.contourBits,null);assert.ok(px.every(v=>v===0xff555555));}
});
test('old thirds retain their pixels and suppress only boundaries touching unknown history',()=>{
 const {c}=fixture();Object.assign(c,{third:{k:2,part:1,prev:{RK:1,VX:0,W:2,H:2,px:Uint32Array.of(4,5,6,7)}},k:2,geo:{anchor:0},fixSegments:()=>[],contourBits:Int8Array.of(0,1,0,1)});
 vm.runInContext(fn('thirdApply'),c);const px=Uint32Array.of(10,11,12,13);c.thirdApply(px);
 assert.deepEqual(Array.from(px),[10,11,6,7]);assert.deepEqual(Array.from(c.contourBits),[0,1,-2,-2]);assert.ok(c.third);
 assert.equal(Contours.boundary(0,-2),false);assert.equal(Contours.boundary(-2,-1),false);assert.equal(Contours.boundary(0,1),true);
 c.third.prev.contourBits=Int8Array.of(1,1,1,0);c.thirdApply(px);assert.deepEqual(Array.from(c.contourBits),[0,1,1,0]);
 assert.deepEqual(Array.from(c.third.prev.px),[4,5,6,7]);
});
test('thirds semantic history with unknown cells round-trips through existing work files',async()=>{
 const Work=require('./mayatnik-work-file.js');
 assert.match(fn('drawPost'),/contourBits:Int32Array\.from\(contourBits\)/);
 const input={lastShown:{contourBits:Int32Array.of(-2,-1,0,1)}};
 const restored=(await Work.decode(await Work.encode(input))).data;
 assert.deepEqual(restored.lastShown.contourBits,input.lastShown.contourBits);
});
test('collapsed columns and rows compare new semantic neighbours without changing source data',()=>{
 const model=Cells.create({rows:3,cols:3});model.hideRange('rows',1,1);model.hideRange('cols',1,1);
 const bits=Int8Array.of(0,1,0, 1,1,1, 0,1,1),before=Array.from(bits),calls=[];
 const c=vm.createContext({st:{bitContourColour1:'#12abef'},cellSelectionModel:model,cellContourCache:null,VX:5,VW:3,VH:3,contourBits:bits,Int32Array,
  MayatnikBitContours:{paint(ctx,o){calls.push(o);return Contours.paint(ctx,o);}}});
 for(const name of ['bitContourOptions','cellContourProjection','cellVisiblePosition','cellTileCoordinates','cellContourTile'])vm.runInContext(fn(name),c);
 const p=c.cellContourProjection();assert.deepEqual(Array.from(p.cols),[5,7]);assert.deepEqual(Array.from(p.rows),[0,2]);assert.equal(c.cellContourProjection(),p);
 const lines=[],ctx={save(){},restore(){},translate(){},beginPath(){},rect(){},clip(){},moveTo(x,y){this.start=[x,y];},lineTo(x,y){lines.push([...this.start,x,y]);},stroke(){}};
 c.cellContourTile(ctx,{sx:0,sy:0,sw:3,sh:3,dx:0,dy:0,dw:8,dh:8},{canvas:{width:3,height:3},cols:3,rows:3,rect:{width:12}});
 assert.deepEqual([calls[0].read(0,0),calls[0].read(1,0),calls[0].read(0,1),calls[0].read(1,1)],[0,0,0,1]);
 assert.ok(!lines.some(l=>l.join()==='4,0,4,4'),'same bits across removed column have no seam');
 assert.ok(lines.some(l=>l.join()==='4,4,4,8'),'different bits across removed column share one edge');
 assert.deepEqual(Array.from(bits),before);assert.equal(calls[0].colour,'#12abef');
});
test('XOR and AND retain existing colour-operation results while tagging the bit they actually produce',()=>{
 for(const op of ['xor','and']){const {c,px}=fixture();c.st.mirOp=op;c.pxBit=()=>0;
  c.contourBegin(px);c.mirBitC=[c.contourColour(0xff555555,0),c.contourColour(0xff555555,1)];c.mirPut(px,3,px[1],1);c.contourEnd(px);
  assert.equal(c.contourBits[3],0,'existing equal-grey colour operation yields zero even when the source semantic tag is one');assert.equal(px[3],0xff555555);
 }
});
test('new mode has a host option, exact palette, screen rendering and all full-frame capture routes',()=>{
 assert.match(html,/<option value="bitContours">/);assert.match(fn('gpuPicture'),/v === 'bitContours'/);assert.match(fn('drawDigits'),/paintBitContours\(/);
 for(const name of ['wholeFrameThumbnail','captureScaleGifFrame','frameSnapshot'])assert.match(fn(name),/paintBitContours\(/);
 for(const match of html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
});

test('contour first colour reaches CPU drawing, GPU render and captures; second is storage only',()=>{
 const {c}=fixture();c.contourBits=Int8Array.of(0,1,0,1);c.st.bitContourColour1='#12abef';c.st.bitContourColour2='#34cd56';let colour;
 c.MayatnikBitContours={paint(ctx,o){colour=o.colour;}};vm.runInContext(fn('bitContourOptions'),c);vm.runInContext(fn('paintBitContours'),c);c.paintBitContours({},0,0,8,16,16);assert.equal(colour,'#12abef');
 c.st.bitContourColour2='#ff0000';c.paintBitContours({},0,0,8,16,16);assert.equal(colour,'#12abef');
 for(const name of ['gpuRender','cellGpuTile'])assert.match(fn(name),/gpuContourOptions\(\)/);
 for(const name of ['wholeFrameThumbnail','captureScaleGifFrame','frameSnapshot'])assert.match(fn(name),/paintBitContours/);
});

test('automatic anti palette uses the opposite bit and custom colours map directly to their cells',()=>{
 const {c}=fixture();vm.runInContext(fn('bitContourOptions'),c);c.st.bitContourMode='double';c.st.bitZeroColour='#a020e0';c.st.bitOneColour='#20d080';
 assert.deepEqual(Array.from(c.bitContourOptions().colours),['#20d080','#a020e0']);
 c.st.bitContourColours='custom';c.st.bitContourColour1='#123456';c.st.bitContourColour2='#fedcba';assert.deepEqual(Array.from(c.bitContourOptions().colours),['#123456','#fedcba']);
 c.st.bitContourMode='single';assert.equal(c.bitContourOptions().colour,'#123456');
});
