const test=require('node:test'),assert=require('node:assert/strict'),D=require('./mayatnik-template-dedup.js');
function fixture({x=4,y=7,colour=0xff112233,bit=q=>q%2}={}){
 const mask={x,y,width:3,height:2,data:Uint32Array.from([1,0,1,1,1,0],v=>v?colour:0)},parts=D.capture([{mask,axis:x+1.5,ox:0,p:-1}],(p,c,r,q)=>({c,r,bit:bit(q)}));
 const shape={hex:'#112233',rk:1,height:100,down:0,x:0,proportional:false,parts:parts.map(p=>({width:p.mask.width,height:p.mask.height,y:p.mask.y,center:p.axis,data:[...p.mask.data]})),libraryProof:D.serialize(parts)};
 return {parts,shape};
}
test('same mask, bits and source addresses reuse the first entry despite colour, name and runtime ID',()=>{
 const a=fixture(),b=fixture({colour:0xffeeddcc}),entry={id:'old',name:'Original',shape:a.shape},entries=[entry];b.shape.hex='#eeddcc';
 assert.equal(D.find(entries,b.shape),entry);assert.equal(D.key(a.shape),D.key(b.shape));
 const before=JSON.stringify(entries),result=D.append(entries,[{id:'new',name:'Found',shape:b.shape}]);assert.equal(result.added.length,0);assert.deepEqual(result.reused,[entry]);assert.equal(JSON.stringify(entries),before);
});
test('equal dimensions and counts never substitute for exact source addresses, bit arrangement or silhouette',()=>{
 const a=fixture(),entry={shape:a.shape};
 for(const b of [fixture({x:5}),fixture({y:8}),fixture({bit:q=>1-q%2})])assert.equal(D.find([entry],b.shape),null);
 const hole=structuredClone(a.shape);hole.parts[0].data[1]=9;hole.parts[0].data[2]=0;assert.equal(D.key(hole),null,'a proof cannot certify another silhouette');
 const altered=structuredClone(a.shape);altered.libraryProof.parts[0].runs[0][2]++;assert.notEqual(D.key(altered),D.key(a.shape));
});
test('source-index permutation retains exact provenance through a reflection, including symmetric mixed-bit masks',()=>{
 const mask={x:3,y:6,width:2,height:1,data:Uint32Array.of(11,11)},parts=D.capture([{mask,axis:4,ox:0,p:-1}],(p,c,r,q)=>({c,r,bit:q}));
 const flipped={...parts[0],sourceOrigin:{mask},sourceIndices:Uint32Array.of(1,0)};
 const a={rk:1,parts:[{width:2,height:1,y:6,center:4,data:[11,11]}],libraryProof:D.serialize(parts)},b={...a,libraryProof:D.serialize([flipped])};
 assert.notEqual(D.key(a),D.key(b));assert.deepEqual(b.libraryProof.parts[0].runs,[[0,1,4,6,1],[1,2,3,6,0]]);
});
test('multipart identity uses every transformed part and its relative placement, independent of part ordering',()=>{
 const a=fixture(),b=fixture({x:11,y:10}),parts=[...a.parts,...b.parts],axisParts=parts.map(p=>({x:p.mask.x,y:p.mask.y,width:p.mask.width,height:p.mask.height,data:[...p.mask.data]})),shape={...a.shape,axisParts,libraryProof:D.serialize(parts)};
 const reordered={...shape,axisParts:[...axisParts].reverse(),libraryProof:{version:1,parts:[...shape.libraryProof.parts].reverse()}};assert.equal(D.key(shape),D.key(reordered));
 const shifted=structuredClone(shape);shifted.axisParts[1].x++;assert.notEqual(D.key(shape),D.key(shifted));
 const composite=structuredClone(shape);composite.parts=[{width:100,height:100,data:[]}];assert.equal(D.key(shape),D.key(composite),'display preview is not the multipart source proof');
});
test('global placement, names and colours are not a new source; actual scaling remains distinct',()=>{
 const {shape}=fixture(),moved=structuredClone(shape);moved.x=40;moved.down=80;moved.parts[0].y+=40;moved.parts[0].center+=30;assert.equal(D.key(shape),D.key(moved));
 moved.height=200;assert.notEqual(D.key(shape),D.key(moved));
});
test('proof roundtrip and mask resampling preserve source 0 separately from empty pixels',()=>{
 const {shape}=fixture(),saved=JSON.parse(JSON.stringify(shape)),src=saved.parts[0],data=new Uint32Array(6*4);
 for(let y=0;y<4;y++)for(let x=0;x<6;x++)data[y*6+x]=src.data[Math.floor(y/2)*3+Math.floor(x/2)];
 const loaded=D.restore([{mask:{x:0,y:0,width:6,height:4,data}}],saved,2),proof=D.serialize(loaded).parts[0];assert.equal(D.at(proof,0).bit,0);assert.equal(D.at(proof,1).bit,0);assert.equal(D.at(proof,2),null);assert.equal(D.at(proof,4).c,6);
 assert.equal(D.key(saved),D.key(shape));
});
test('fractional RK resampling follows the exact host factor, including rounded output dimensions',()=>{
 const mask={x:4,y:7,width:3,height:3,data:new Uint32Array(9).fill(1)},parts=D.capture([{mask}],(p,c,r)=>({c,r,bit:1})),shape={libraryProof:D.serialize(parts)};
 const loaded=D.restore([{mask:{width:5,height:5,data:new Uint32Array(25).fill(1)}}],shape,1.5),proof=D.serialize(loaded).parts[0];
 assert.equal(D.at(proof,3).c,6);assert.equal(D.at(proof,15).r,9,'floor(q/factor), not floor(q*sourceWidth/roundedWidth)');
});
test('unknown legacy, stale transformed origins and incomplete source maps are never guessed or merged',()=>{
 const {shape,parts}=fixture(),old={...shape};delete old.libraryProof;assert.equal(D.find([{shape:old}],shape),null);assert.equal(D.key(old),null);
 const part={mask:parts[0].mask,sourceOrigin:{mask:parts[0].mask}};let reads=0;assert.equal(D.capture([part],()=>{reads++;return {c:0,r:0,bit:0};})[0],part);assert.equal(reads,0);assert.equal(D.serialize([part]),null);
 const bad=structuredClone(shape);bad.libraryProof.parts[0].runs[0][4]=2;assert.equal(D.key(bad),null);
 const invalid=D.capture([{mask:parts[0].mask}],()=>null);assert.equal(invalid[0].librarySource,undefined);
 const unavailable=D.capture([{mask:parts[0].mask}],()=>{throw Error('semantic history unavailable');});assert.equal(unavailable[0].librarySource,undefined,'optional identity must not block field selection');
});
test('batch import deduplicates against existing and earlier incoming entries without deleting preexisting duplicates',()=>{
 const {shape}=fixture(),entries=[{id:'a',shape},{id:'old-duplicate',shape:structuredClone(shape)}],other=fixture({y:30}).shape;
 const out=D.append(entries,[{id:'repeat',shape:structuredClone(shape)},{id:'new',shape:other},{id:'new-repeat',shape:structuredClone(other)}]);
 assert.deepEqual(entries.map(t=>t.id),['a','old-duplicate','new']);assert.deepEqual(out.added.map(t=>t.id),['new']);assert.deepEqual(out.reused.map(t=>t.id),['a','new']);
});
test('split-part scale anchors affect exact geometry, while malformed legacy shapes remain unknown',()=>{
 const a=fixture(),b=fixture({x:11,y:10}),parts=[...a.parts,...b.parts],axisParts=parts.map(p=>({x:p.mask.x,y:p.mask.y,axis:p.axis,axisOriginY:7,width:p.mask.width,height:p.mask.height,data:[...p.mask.data]})),shape={...a.shape,height:200,axisParts,libraryProof:D.serialize(parts)};
 const shifted=structuredClone(shape);shifted.axisParts[1].axisOriginY=9;assert.notEqual(D.key(shifted),D.key(shape));
 const malformed=structuredClone(shape);malformed.axisParts[0]=null;assert.equal(D.key(malformed),null);
});
