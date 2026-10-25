const {test}=require('node:test'),assert=require('node:assert/strict'),S=require('./setka-state.js');
const storage=data=>({data:{...data},getItem(k){return this.data[k]??null;},setItem(k,v){this.data[k]=v;}});
test('first opening migrates grid, axes and scenes without overwriting ordinary rows',()=>{
 const old={rows:['111'],grids:{rows:['01','10'],colors:{'0,1':'#ffaa00'},scenes:[{name:'A'}]},rmb:{cell:'rmb',axes:[{a:[0,0],b:[2,2]}]},triScenes:[{R:3}]};
 const raw=JSON.stringify(old),ls=storage({zazerkalius_v1:raw}),s=S.load(ls);
 assert.deepEqual(s.grids,old.grids);assert.deepEqual(s.rmb,old.rmb);s.grids.rows[0]='00';S.save(ls,s);
 assert.equal(ls.getItem('zazerkalius_v1'),raw);assert.deepEqual(S.rows(ls),['111']);assert.deepEqual(S.load(ls).grids.rows,['00','10']);
});
test('own saved field wins after ordinary page changes; import reads latest source by copy',()=>{
 const ls=storage({[S.KEY]:JSON.stringify({grids:{rows:['0']},rmb:{cell:'ring'}}),zazerkalius_v1:JSON.stringify({rows:['10'],grids:{rows:['111']}})});
 assert.equal(S.load(ls).rmb.cell,'ring');assert.deepEqual(S.load(ls).grids.rows,['0']);
 const rows=S.rows(ls);rows[0]='11';assert.deepEqual(S.rows(ls),['10']);
 ls.setItem('zazerkalius_v1',JSON.stringify({rows:['101']}));assert.deepEqual(S.rows(ls),['101']);
});
test('empty or corrupt storage starts independently, solo legacy data is retained',()=>{
 for(const data of [{},{[S.KEY]:'bad',zazerkalius_v1:'bad'},{[S.KEY]:JSON.stringify({grids:{rows:['xyz']}})}])assert.deepEqual(S.load(storage(data)).grids.rows,['0']);
 const solo={grids:{rows:['101']},rmb:{cell:'square'}};
 assert.deepEqual(S.load(storage({zazerkalius_solo_rmb:JSON.stringify(solo)})).grids,solo.grids);
});
