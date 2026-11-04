const test=require('node:test'),assert=require('node:assert/strict');
const Stack=require('./mayatnik-scale-stack.js');
function harness(options={}){
 let captures=0;const jobs=new Map();let id=0;
 const doc={createElement(tag){const node={tag,style:{},dataset:{},children:[],width:0,height:0,attributes:{},ownerDocument:doc,setAttribute(k,v){this.attributes[k]=v;},appendChild(c){c.parentNode=this;this.children.push(c);},remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(c=>c!==this);}};
 if(tag==='canvas')node.getContext=()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(image){node.painted=image.data.slice();}});return node;}};
 const host=doc.createElement('div'),stack=Stack.create({host,captureSource(){captures++;return source(17,64);},schedule(fn){jobs.set(++id,fn);return id;},cancel(key){jobs.delete(key);},...options});
 function next(){const entry=jobs.entries().next().value;if(!entry)return false;jobs.delete(entry[0]);entry[1]();return true;}
 function drain(){let count=0;while(next()){if(++count>20000)throw Error('Unbounded work');}}
 return {host,stack,jobs,next,drain,get captures(){return captures;}};
}
function source(width,height,value){return {width,height,pixels:Uint8ClampedArray.from({length:width*height*4},(_,i)=>value===undefined?(i*31)%256:value),bits:new Int8Array(width*height)};}
function canvases(h){return h.stack.element.children.map(level=>level.children.find(node=>node.tag==='canvas'));}
test('half levels preserve full source aspect, stop at eight and cap canvas count',()=>{
 assert.deepEqual(Stack.levels(101,65),[{width:50,height:32},{width:25,height:16},{width:13,height:8}]);
 assert.equal(Stack.levels(4096,4096).length,5);assert.deepEqual(Stack.levels(8,8),[]);assert.deepEqual(Stack.levels(3,9),[{width:3,height:8}]);
});
test('disabled does not capture; enabling captures once and creates bounded vertical canvases',()=>{
 const h=harness();assert.equal(h.stack.requestFrame(),false);assert.equal(h.captures,0);assert.equal(h.jobs.size,0);
 h.stack.setEnabled(true);h.drain();assert.equal(h.captures,1);assert.equal(h.stack.inspect().canvases,3);assert.equal(h.host.children.length,1);assert.equal(h.stack.element.hidden,false);
 h.stack.setEnabled(false);assert.equal(h.stack.inspect().canvases,0);assert.equal(h.stack.element.children.length,0);assert.equal(h.jobs.size,0);
});
test('sampling matches physical pixel centres, preserves RGBA, whole width, source immutability',()=>{
 const h=harness(),s=source(17,65),copy=s.pixels.slice();h.stack.setEnabled(true);h.stack.requestFrame(s,{key:7});h.drain();
 const canvas=canvases(h)[0],scale=32/65;assert.equal(canvas.width,9);assert.equal(canvas.height,32);
 for(let y=0;y<32;y++)for(let x=0;x<9;x++){
  const sx=Math.floor((x+.5)/scale),sy=Math.floor((y+.5)/scale),expected=sx<17?s.pixels.slice((sy*17+sx)*4,(sy*17+sx+1)*4):new Uint8ClampedArray(4);
  assert.deepEqual(canvas.painted.slice((y*9+x)*4,(y*9+x+1)*4),expected);
 }
 assert.deepEqual(s.pixels,copy);assert.equal(h.captures,0);
 h.stack.refreshLayout({width:170,left:25});assert.equal(canvas.style.width,'90px');assert.equal(canvas.style.height,'320px');assert.equal(h.stack.element.style.marginLeft,'25px');
});
test('continuous frame requests finish active then newest pending in monotonic paint order',()=>{
 const painted=[],h=harness({chunkPixels:8,onPaint:info=>painted.push(info.key)});h.stack.setEnabled(true);
 h.stack.requestFrame(source(32,64,11),{key:1});h.next();assert.equal(h.stack.inspect().busy,true);assert.equal(h.stack.inspect().canvases,0);
 let key=2;while(painted.length===0){h.stack.requestFrame(source(32,64,key),{key});key++;h.next();}
 assert.deepEqual(painted,[1]);const latest=key-1;h.drain();
 assert.deepEqual(painted,[1,latest]);assert.equal(h.stack.inspect().key,latest);assert.ok(canvases(h).every(c=>c.painted.every(v=>v===latest)));assert.equal(h.captures,0);
 assert.equal(h.stack.requestFrame(source(32,64,44),{key:latest}),false);assert.equal(h.jobs.size,0);
});
test('busy lazy requests coalesce without capture until active completes',()=>{
 const painted=[],h=harness({chunkPixels:8,onPaint:info=>painted.push(info.key)});h.stack.setEnabled(true);h.stack.requestFrame(source(32,64),{key:'initial'});h.next();
 for(let i=0;i<5;i++){h.stack.requestFrame(undefined,{key:i});h.next();assert.equal(h.captures,0);}
 while(!painted.length)h.next();assert.deepEqual(painted,['initial']);assert.equal(h.captures,0);
 h.drain();assert.equal(h.captures,1);assert.deepEqual(painted,['initial',4]);
});
test('second snapshot over memory budget becomes one lazy recapture without disabling',()=>{
 const painted=[],errors=[],h=harness({chunkPixels:8,maxBytes:40000,onPaint:info=>painted.push(info.key),onError:e=>errors.push(e)});h.stack.setEnabled(true);h.stack.requestFrame(source(64,64),{key:1});h.next();
 h.stack.requestFrame(source(64,64),{key:2});assert.equal(h.captures,0);h.drain();assert.deepEqual(painted,[1,2]);assert.equal(h.captures,1);assert.equal(errors.length,0);assert.equal(h.stack.inspect().enabled,true);
});
test('admission discards largest copies to remain inside memory bound and reports oversize source',()=>{
 const errors=[],h=harness({maxBytes:22000,onError:e=>errors.push(e)});h.stack.setEnabled(true);h.stack.requestFrame(source(64,64),{key:1});h.drain();
 assert.equal(h.stack.inspect().canvases,1);assert.equal(canvases(h)[0].height,8);assert.equal(errors.length,0);
 h.stack.requestFrame(source(128,128),{key:2});h.drain();assert.equal(errors.length,1);assert.match(errors[0].message,/памяти/);assert.equal(h.stack.inspect().canvases,0);
});
test('disable and destroy release incomplete buffers, canvas backing and scheduled callbacks',()=>{
 const h=harness({chunkPixels:8});h.stack.setEnabled(true);h.stack.requestFrame(source(32,64));h.next();h.stack.setEnabled(false);assert.equal(h.stack.inspect().busy,false);assert.equal(h.jobs.size,0);
 h.stack.setEnabled(true);h.drain();const before=canvases(h);h.stack.destroy();assert.equal(h.host.children.length,0);assert.ok(before.every(c=>c.width===0&&c.height===0));assert.equal(h.stack.requestFrame(source(4,16)),false);assert.equal(h.stack.setEnabled(true),false);
});
test('malformed source is contained and can recover on next valid frame',()=>{
 const errors=[],h=harness({onError:e=>errors.push(e)});h.stack.setEnabled(true);h.stack.requestFrame({width:2,height:16,pixels:[]});h.drain();assert.equal(errors.length,1);
 h.stack.requestFrame(source(4,16),{key:'ok'});h.drain();assert.equal(h.stack.inspect().key,'ok');assert.equal(h.stack.inspect().error,null);
});
test('fillWidth enlarges different reduced rasters to the same complete source geometry with labels',()=>{
 const h=harness({fillWidth:true});h.stack.setEnabled(true);h.stack.requestFrame(source(17,65),{key:1});h.stack.refreshLayout({width:170,left:12});h.drain();
 const cs=canvases(h);assert.deepEqual(cs.map(c=>[c.width,c.height]),[[9,32],[5,16],[3,8]]);
 assert.ok(cs.every(c=>c.style.width==='170px'&&c.style.height==='650px'));
 assert.deepEqual(h.stack.element.children.map(level=>level.children[0].textContent),['32 строк','16 строк','8 строк']);
 h.stack.requestFrame(source(17,16),{key:2});h.drain();assert.equal(h.stack.element.children.length,1);assert.equal(h.stack.element.children[0].children[0].textContent,'8 строк');
 h.stack.setEnabled(false);assert.equal(h.stack.element.children.length,0);assert.ok(cs.every(c=>c.width===0&&c.height===0));
});
