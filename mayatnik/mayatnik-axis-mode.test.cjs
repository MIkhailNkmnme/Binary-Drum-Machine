const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
function boot(x0,locked){
 const c={window:{},st:{fixAxis:2,fixLockX:locked,fixLines:true},geo:{anchor:50},VX:0,VW:100,f:{},saved:[],drawn:[]};
 c.save=()=>c.saved.push({...c.st});c.draw=()=>c.drawn.push([...c.fixPts([[0,0,x0,8]],32).values()][0][3]);
 vm.createContext(c);
 vm.runInContext(html.slice(html.indexOf('  function fixShown()'),html.indexOf('  // v0.205:',html.indexOf('  function fixShown()'))),c);
 vm.runInContext(html.match(/window\.mayFixAxis=\{[^\n]+/)[0],c);return c;
}
for(const [x0,expected]of [[50,[49.5,50,49]],[49.5,[49.5,49.5,50]]]){
 test('explicit axis modes override a lock, meeting '+x0,()=>{const c=boot(x0,7);for(const [i,mode]of [1,0,2].entries()){c.st.fixLockX=7;c.window.mayFixAxis.set(mode);assert.equal(c.window.mayFixAxis.get(),mode);assert.equal(c.st.fixLockX,null);assert.equal(c.saved.at(-1).fixLockX,null);assert.equal(c.drawn.at(-1),expected[i]);}});
}
test('choosing already active 0 unlocks an axis saved on a bit',()=>{const c=boot(50,0);c.st.fixAxis=1;c.window.mayFixAxis.set(1);assert.equal(c.drawn[0],49.5);assert.equal(c.saved.length,1);});
test('no frame: explicit choice still persists without drawing',()=>{const c=boot(50,0);c.f=null;c.window.mayFixAxis.set(1);assert.equal(c.saved[0].fixLockX,null);assert.equal(c.drawn.length,0);});
test('lock holds until explicitly selecting a mode; diagonal meeting is unchanged',()=>{const c=boot(50,7);let q=[...c.fixPts([[0,0,50,8]],32).values()][0];assert.equal(q[3],57);assert.equal(q[4],50);c.window.mayFixAxis.set(1);q=[...c.fixPts([[0,0,50,8]],32).values()][0];assert.equal(q[4],50);assert.equal(q[3],49.5);});
