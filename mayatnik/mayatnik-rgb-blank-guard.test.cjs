const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8'),start=html.indexOf('  function rgbNeighbourFilters('),end=html.indexOf('  // v0.024:',start);
const rgba=rgb=>((255<<24)|(rgb[2]<<16)|(rgb[1]<<8)|rgb[0])>>>0,colours=[[0,0,0],[0,0,255],[0,255,0],[0,255,255],[255,0,0],[255,0,255],[255,255,0],[255,255,255]];
function fixture(codes){const counts=new Uint32Array(8);for(const code of codes)if(code<8)counts[code]++;const c={st:{view:'rgbNeighbours',rgbNeighbourFilters:[],rgbNeighbourBW:0},window:{},rgbNeighbourClasses:Uint8Array.from(codes),rgbNeighbourCounts:counts,rgba,EMPTY:[0,0,0],f:{},saves:0,draws:0,save(){c.saves++;},draw(){c.draws++;}};vm.createContext(c);vm.runInContext(html.slice(start,end),c);return c;}
test('preflight matches actual RGB rendering for all 256 filters and three modes, including empty cells',()=>{
 let scenarios=0;for(const codes of [[0,1,2,3,4,5,6,7],[0,1,2,3,4,5,6,7,255],[0,0,0],[7,7,7],[0,7,255],[255,255],[4,4,4]]){
  const c=fixture(codes);for(let mask=0;mask<256;mask++)for(let mode=0;mode<3;mode++){
   const filters=Array.from({length:8},(_,i)=>i).filter(i=>mask&(1<<i));c.st.rgbNeighbourFilters=filters;c.st.rgbNeighbourBW=mode;
   const px=Uint32Array.from(codes,code=>rgba(colours[code]||[0,0,0]));c.rgbNeighbourFilterApply(px);const blank=[...px].every(p=>p===rgba([0,0,0]))||[...px].every(p=>p===rgba([255,255,255]));assert.equal(c.rgbNeighbourWouldBlank(filters,mode),blank,JSON.stringify({codes,filters,mode}));scenarios++;
  }
 }assert.equal(scenarios,5376);
});
test('blocked filter and BW changes leave saved settings and pixels alone; safe selections still work',()=>{
 const c=fixture([0,1,2,3,4,5,6,7]),api=c.window.mayRGBNeighbours;
 assert.equal(api.canToggleFilter(0),false);assert.deepEqual(Array.from(api.toggleFilter(0)),[]);assert.equal(c.saves,0);assert.equal(c.draws,0);
 assert.equal(api.canSetBW(1),false);assert.equal(api.setBW(1),false);assert.equal(c.st.rgbNeighbourBW,0);assert.equal(c.saves,0);
 assert.equal(api.canToggleFilter(4),true);api.toggleFilter(4);assert.deepEqual(Array.from(api.filters()),[4]);assert.equal(api.canSetBW(1),true);assert.equal(api.setBW(1),true);assert.equal(c.st.rgbNeighbourBW,1);
 c.st.rgbNeighbourFilters=[0,1,2,3,4,5,6];assert.equal(api.canToggleFilter(7),false);const saved=c.saves;api.toggleFilter(7);assert.equal(c.saves,saved);assert.deepEqual(Array.from(api.filters()),[0,1,2,3,4,5,6]);
});
