const test=require('node:test'),assert=require('node:assert/strict');
global.MayatnikTemplateMatcher=require('./mayatnik-template-matcher.js');
const Engine=require('./mayatnik-template-engine.js');
const shape=()=>({parts:[{width:1,height:1,data:[1]}]});
function fixture(){
 let entries=['a','b','c'].map(id=>({id,name:id,shape:shape()})),scope=1,reads=0;
 const host={entries:()=>entries,scope:()=>scope,field:async()=>{reads++;return {width:3,height:1,data:Int8Array.of(1,0,1),scope};},current:f=>f.scope===scope,redrawSelection(){}};
 const api=Engine.create(host);return {api,host,get entries(){return entries},set entries(v){entries=v},get reads(){return reads},advance(){scope++;}};
}
test('deleting entries keeps completed matches visible without rereading the unchanged field',async()=>{
 const f=fixture();f.api.refresh();await f.api.whenFiltered();assert.deepEqual(f.api.list().map(t=>t.id),['a','b','c']);
 const events=[];f.api.subscribe(s=>events.push({ids:f.api.list().map(t=>t.id),filtering:s.filtering}));
 f.entries=f.entries.slice(1);f.api.refresh();await f.api.whenFiltered();
 assert.equal(f.reads,1);assert.deepEqual(events,[{ids:['b','c'],filtering:false}]);
 f.entries=[];f.api.refresh();assert.deepEqual(f.api.list(),[]);assert.equal(f.reads,1);
});
test('deletion does not promote absent shapes, and restored or changed shapes are scanned',async()=>{
 const f=fixture();f.entries[2].shape={parts:[{width:4,height:1,data:[1,1,1,1]}]};const original=f.entries;
 f.api.refresh();await f.api.whenFiltered();assert.deepEqual(f.api.list().map(t=>t.id),['a','b']);
 f.entries=f.entries.slice(1);f.api.refresh();await f.api.whenFiltered();assert.deepEqual(f.api.list().map(t=>t.id),['b']);assert.equal(f.reads,1);
 f.entries=original;f.api.refresh();await f.api.whenFiltered();assert.equal(f.reads,2);
 f.entries=[{...original[1],shape:shape()}];f.api.refresh();await f.api.whenFiltered();assert.equal(f.reads,3);
});
test('deletion during a pending scan cancels stale publication and rescans the surviving entries',async()=>{
 const f=fixture(),read=f.host.field;let release;f.host.field=()=>new Promise(r=>release=async()=>r(await read()));
 f.api.refresh();const old=f.api.whenFiltered();assert.equal(f.api.getState().filtering,true);
 f.entries=f.entries.slice(1);f.host.field=read;f.api.refresh();await f.api.whenFiltered();await release();await old;
 assert.deepEqual(f.api.list().map(t=>t.id),['b','c']);assert.equal(f.api.getState().filtering,false);assert.equal(f.reads,2);
});
test('a new field scope or failed scan cannot reuse a completed deletion result',async()=>{
 const f=fixture();f.api.refresh();await f.api.whenFiltered();f.advance();f.entries=f.entries.slice(1);f.api.refresh();await f.api.whenFiltered();assert.equal(f.reads,2);
 const g=fixture(),read=g.host.field;g.host.field=async()=>{throw Error('field unavailable');};g.api.refresh();await g.api.whenFiltered();g.host.field=read;g.entries=g.entries.slice(1);g.api.refresh();await g.api.whenFiltered();assert.deepEqual(g.api.list().map(t=>t.id),['b','c']);assert.equal(g.reads,1);
});
