const test=require('node:test'),assert=require('node:assert/strict'),R=require('./mayatnik-reset-state.js'),S=require('./mayatnik-settings-library.js');
test('clean scene has the agreed 512 build, top fit and optional effects off',()=>{
 const s=R.defaults();assert.equal(s.rows,512);assert.equal(s.steps,512);assert.equal(s.mode,'pend');assert.equal(s.view,'bits');assert.equal(s.zoom,'fit');assert.equal(s.zMid,true);assert.equal(s.ztop,true);assert.equal(s.zBot,false);assert.equal(s.zLock,false);assert.equal(s.zsnap,true);assert.equal(s.zbase,2);
 for(const key of R.off)assert.equal(s[key],false,key);for(const key of R.zero)assert.equal(s[key],0,key);
 assert.equal(s.templateMaxArea,4096);assert.equal(s.crossMirrorMode,'lr');assert.equal(s.autoFillPalette,true);assert.equal(s.growOwnColour,false);
});
test('fresh defaults and group reset never alias mutable selections or touch another group',()=>{
 const a=R.defaults(),b=R.defaults();a.userLines.push([1,2,3,4]);a.parity.cellsEven=false;assert.equal(b.userLines.length,0);assert.equal(b.parity.cellsEven,true);
 const scale=R.scope('scale');assert.equal(scale.ztop,true);assert.equal(scale.zBot,false);assert.equal('rows' in scale,false);assert.equal('view' in scale,false);
 assert.throws(()=>R.scope('library'));
});
test('clean defaults can be saved as a valid named preset',()=>{
 const snapshot=S.normalized(S.pick(R.defaults(),{}, {fillColour:'#ff7f27',fillMirror:false}));assert.equal(snapshot.state.templateMaxArea,4096);assert.equal(snapshot.state.crossMirrorMode,'lr');assert.equal(snapshot.state.viewUpsideDown,false);
});
