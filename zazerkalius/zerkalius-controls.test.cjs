const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const sceneMath=require('../_js/mirror-scene.js');
const source=fs.readFileSync(__dirname+'/zz-zerkalius.js','utf8');
function functions(names){const ctx={sceneMath,drawW:1000,drawH:800,state:{bitsOnly:false,netDigits:true,font:'monospace',net:{up:'#4dd4ff',down:'#e8b64a'}},visibleWorld:()=>[-Infinity,-Infinity,Infinity,Infinity]};vm.createContext(ctx);for(const name of names){const begin=source.indexOf('  function '+name+'('),end=source.indexOf('\n  function ',begin+1);assert(begin>=0);vm.runInContext(source.slice(begin,end),ctx);}return ctx;}
const math=functions(['nearestBit','magneticPosition','netCell','netFaces']);
test('canvas centre wins over a more distant bit',()=>{const r=math.magneticPosition(500,400,[],1,[[502,406]]);assert.equal(r.label,'центр холста');assert.equal(r.x,500);assert.equal(r.y,400);});
test('a genuinely closer bit remains magnetic',()=>{const r=math.magneticPosition(507,400,[],1,[[507,401]]);assert.equal(r.label,'центр бита');assert.equal(r.x,507);assert.equal(r.y,401);});
test('axis restriction skips off-axis bits and finds the next valid bit',()=>{const r=math.magneticPosition(701,600,[],1,[[701,601],[705,600]],{x:700,y:600,angle:0});assert.equal(r.x,705);assert.equal(r.y,600);});
test('snap threshold remains ten screen pixels while zoomed',()=>{const r=math.magneticPosition(700,600,[],6,[[703,600]]);assert.equal(r.snapped,false);});
test('rhombi and edge triangles tile the entire face',()=>{const f={P:[[0,0],[1,0],[0,1]]},area=p=>Math.abs(p.reduce((a,v,i)=>{const w=p[(i+1)%p.length];return a+v[0]*w[1]-w[0]*v[1]},0))/2;for(const R of [1,2,3,8,64,71]){let sum=0;for(let r=0;r<R;r++)for(let k=0;k<=r;k++){const cell=math.netCell(f,r,k,R);sum+=area(cell.P);assert.equal(cell.P.length,r===R-1?3:4);for(const p of cell.P)assert(p[0]>=0&&p[1]>=0&&p[0]+p[1]<=1+1e-12);}assert(Math.abs(sum-.5)<1e-12);}});
test('digit switch controls numbers with filled cells and with digits-only view',()=>{const calls=[],ctx={globalAlpha:1,beginPath(){},moveTo(){},lineTo(){},closePath(){},stroke(){},fill(){},save(){},restore(){},translate(){},scale(){},fillText(v){calls.push(v);}},model={faces:[{up:true,P:[[0,0],[1,0],[0,1]]}]};for(const bitsOnly of [false,true])for(const digits of [false,true]){math.state.bitsOnly=bitsOnly;math.state.netDigits=digits;calls.length=0;math.netFaces(ctx,model,[[1]],100,false);assert.equal(calls.length,digits?1:0);}});
