const test=require('node:test'),assert=require('node:assert/strict');
const Focus=require('./mayatnik-template-focus.js'),Matcher=require('./mayatnik-template-matcher.js');global.MayatnikTemplateMatcher=Matcher;
const Engine=require('./mayatnik-template-engine.js');
test('chooses the preferred visible copy, then first visible copy; never combines distant instances',()=>{
 const list=[{id:'hidden',visible:false},{id:'first'},{id:'selected'}];assert.equal(Focus.choose(list,'selected').id,'selected');assert.equal(Focus.choose(list,'missing').id,'first');assert.equal(Focus.choose([{visible:false}]),null);
 assert.deepEqual(Focus.union([{x:2,y:3,width:10,height:5},{x:5,y:10,width:20,height:5}]),{x:2,y:3,width:23,height:12});
});
test('available viewport clips the open library panel and pan is view-only at unchanged zoom',()=>{
 const available=Focus.viewport({left:10,top:20,right:1000,bottom:620},{left:600});assert.equal(available.width,590);
 const target={x:20,y:50,width:40,height:20},old={...target};assert.deepEqual(Focus.panDelta(target,available),{x:-265,y:-260});assert.deepEqual(target,old);assert.equal(Focus.panDelta(null,available),null);
});
test('scroll margins center edge and off-canvas copies without requiring negative or out-of-range scroll',()=>{
 const available={width:600,height:400},canvas={width:1000,height:800},padding={left:16,right:16,top:12,bottom:12};
 for(const target of [{x:0,y:0,width:10,height:10},{x:990,y:790,width:10,height:10},{x:-300,y:-200,width:30,height:20},{x:1300,y:1200,width:30,height:20}]){
  const p=Focus.scrollPlan(target,canvas,available,padding),m=p.margins;
  assert.ok(p.scrollLeft>=0&&p.scrollTop>=0);assert.ok(p.scrollLeft<=padding.left+m.left+canvas.width+m.right+padding.right-available.width+1e-9);assert.ok(p.scrollTop<=padding.top+m.top+canvas.height+m.bottom+padding.bottom-available.height+1e-9);
  assert.equal(padding.left+m.left+target.x+target.width/2-p.scrollLeft,300);assert.equal(padding.top+m.top+target.y+target.height/2-p.scrollTop,200);
 }
});
test('engine focuses first exact occurrence and placed-copy IDs, after selection; no matches does nothing',async()=>{
 const entry={id:'a',shape:{rk:1,parts:[{width:2,height:1,data:[1,0]}]}},field={width:6,height:1,data:Int8Array.from([1,0,-1,1,0,-1])};let calls=[],instances=['chosen','second'];
 const api=Engine.create({entries:()=>[entry],field:async()=>field,current:f=>f===field,instances:()=>instances,choose(){},stop(){},redrawSelection(){},focus:request=>calls.push(request)});
 await api.select('a');assert.equal(calls.length,1);assert.deepEqual(calls[0].first,{x:0,y:0,width:2,height:1,patternIndex:0});assert.deepEqual(calls[0].instances,['chosen','second']);assert.ok(api.getSelection());
 field.data.fill(-1);instances=[];const empty=Engine.create({entries:()=>[entry],field:async()=>field,current:()=>true,instances:()=>[],choose(){},stop(){},redrawSelection(){},focus:r=>calls.push(r)});await empty.select('a');assert.equal(calls.length,1);
});
test('a cancelled selection never pans the view',async()=>{let resolve,focused=0;const entry={id:'a',shape:{parts:[{width:1,height:1,data:[1]}]}};
 const api=Engine.create({entries:()=>[entry],field:()=>new Promise(r=>resolve=r),current:()=>true,instances:()=>[],choose(){},stop(){},redrawSelection(){},focus:()=>focused++});const pending=api.select('a');api.clear();resolve({width:1,height:1,data:Int8Array.of(1)});await pending;assert.equal(focused,0);
});
