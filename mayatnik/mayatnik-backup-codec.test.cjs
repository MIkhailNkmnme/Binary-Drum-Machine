const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto').webcrypto,F=require('./mayatnik-backup-codec.js');
const fixture=()=>({createdAt:'2026-10-25',entries:[{key:'latest',value:{field:Int8Array.of(-1,0,1),paint:Uint32Array.of(0xffffffff),nested:{pixels:Uint8ClampedArray.of(1,2,3,255)}}},{key:'frame-library-item:test',value:new Blob([Uint8Array.of(0,128,255)],{type:'application/x-test'})},{key:'removed',value:null}],local:[{key:'zerk_mayatnik',value:'{"rows":512}'},{key:'mayatnik-template-folders-v1',value:'{}'},{key:'grozd:mayatnik',value:'{}'}]});
test('full backup preserves all entries, typed arrays, blobs, nulls, local strings and metadata',async()=>{
 const source=fixture(),file=await F.encode(source),result=await F.decode(file);assert.equal(result.format,'mayatnik-backup');assert.equal(result.version,1);assert.equal(result.snapshot.createdAt,source.createdAt);assert.deepEqual(result.snapshot.local,source.local);assert.deepEqual(result.snapshot.entries[0],source.entries[0]);assert.deepEqual(result.snapshot.entries[2],source.entries[2]);const blob=result.snapshot.entries[1].value;assert.equal(blob.type,'application/x-test');assert.deepEqual(new Uint8Array(await blob.arrayBuffer()),Uint8Array.of(0,128,255));
});
test('scope excludes other applications and accepts migration keys',()=>{
 for(const key of ['zerk_rec_mode','zerk-mayatnik-naklon','zerk_mayatnik_other','grozd:other','__proto__'])assert.equal(F.isLocalKey(key),false,key);
 for(const key of ['mayatnik-dd-grid-before-v461','zerkalius_mayatnik_template_locks_v1','zerk_mayatnik_solarius'])assert.equal(F.isLocalKey(key),true,key);
 assert.throws(()=>F.validateLocal([{key:'zerk_rec_mode',value:'x'}]));assert.throws(()=>F.validateLocal([{key:'zerk_mayatnik',value:null}]));assert.throws(()=>F.validateLocal([{key:'zerk_mayatnik',value:'1'},{key:'zerk_mayatnik',value:'2'}]));
});
test('rejects duplicate entries and input above size limits',async()=>{
 const source=fixture();source.entries.push(source.entries[0]);await assert.rejects(F.encode(source),/ключ/);
 const huge=new Blob([new Uint8Array(1024*1024)]);const file=new Blob(Array(1025).fill(huge));await assert.rejects(F.decode(file),/размер/);await assert.rejects(F.encode({entries:[{key:'big',value:file}],local:[]}),/1 ГиБ/);
});
test('rejects header corruption, blob corruption, truncation and appended data',async()=>{
 const file=await F.encode(fixture()),bytes=new Uint8Array(await file.arrayBuffer());for(const at of [0,12,50,bytes.length-1]){const bad=bytes.slice();bad[at]^=1;await assert.rejects(F.decode(new Blob([bad])));}
 await assert.rejects(F.decode(file.slice(0,file.size-1)));await assert.rejects(F.decode(new Blob([file,'x'])));
});
async function changedManifest(file,change){const all=new Uint8Array(await file.arrayBuffer()),n=new DataView(all.buffer).getUint32(8,true),manifest=JSON.parse(new TextDecoder().decode(all.slice(44,44+n)));change(manifest);const header=new TextEncoder().encode(JSON.stringify(manifest)),prefix=all.slice(0,44);new DataView(prefix.buffer).setUint32(8,header.length,true);prefix.set(new Uint8Array(await crypto.subtle.digest('SHA-256',header)),12);return new Blob([prefix,header,all.slice(44+n)]);}
test('valid header hash cannot bypass duplicate, scope or payload validation',async()=>{
 const file=await F.encode(fixture());
 for(const mutate of [m=>m.entries[1].key=m.entries[0].key,m=>m.local[0].key='zerk_rec_mode',m=>m.entries[0].size=Number.MAX_SAFE_INTEGER,m=>m.entries[0].kind='script',m=>m.entries[0].checksum='0'.repeat(64)])await assert.rejects(F.decode(await changedManifest(file,mutate)));
});
