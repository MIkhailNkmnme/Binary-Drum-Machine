const test=require('node:test'),assert=require('node:assert/strict'),A=require('./mayatnik-axis-style.js');
function context(){const calls=[],stack=[],ctx={lineWidth:3,strokeStyle:'original',lineCap:'round',lineDashOffset:9,globalAlpha:.4,dash:[2,3],save(){stack.push({lineWidth:this.lineWidth,strokeStyle:this.strokeStyle,lineCap:this.lineCap,lineDashOffset:this.lineDashOffset,globalAlpha:this.globalAlpha,dash:this.dash});},restore(){Object.assign(this,stack.pop());},setLineDash(d){this.dash=d;},stroke(path){calls.push({path,width:this.lineWidth,colour:this.strokeStyle,alpha:this.globalAlpha,cap:this.lineCap,dash:this.dash.slice(),offset:this.lineDashOffset});}};return{ctx,calls};}
test('both palettes use the existing violet cross and no white or transparent interval',()=>{
 assert.deepEqual(A.palette(),['#b48cff','#000000']);assert.deepEqual(A.palette('purple-red'),['#b48cff','#ff5a4f']);assert.equal(A.normalise('invalid'),'purple-black');
 for(const mode of ['purple-black','purple-red']){const{ctx,calls}=context(),before={...ctx};A.stroke(ctx,{mode});assert.equal(calls.length,2);assert.deepEqual(calls[0].dash,[]);assert.deepEqual(calls[1].dash,[6,6]);assert.deepEqual(calls.map(c=>c.colour),A.palette(mode).slice().reverse());assert.ok(calls.every(c=>c.alpha===1&&c.cap==='butt'&&c.width===3));for(const key of ['lineWidth','strokeStyle','lineCap','lineDashOffset','globalAlpha','dash'])assert.deepEqual(ctx[key],before[key]);}
});
test('Path2D identity and units survive, measurement proxy records one stroke only',()=>{
 const{ctx,calls}=context(),path={opaquePath:true};let recorded=0;const proxy=new Proxy(ctx,{get(t,k){if(k==='measureTarget')return t;if(k==='stroke')return p=>{recorded++;t.stroke(p);};return Reflect.get(t,k);}});A.stroke(proxy,{path,width:2,unit:.5,offset:3});assert.equal(recorded,1);assert.equal(calls.length,2);assert.ok(calls.every(c=>c.path===path));assert.deepEqual(calls[1].dash,[3,3]);assert.equal(calls[1].offset,3);
});
test('SVG paths share exact geometry; solid second colour lies beneath dash',()=>{
 const doc={createElementNS(ns,name){return{ns,name,style:{},attrs:{},setAttribute(k,v){this.attrs[k]=v;}};}},d='M1 2L33 44',paths=A.svgPaths(doc,d,{mode:'purple-red',width:1.5});assert.equal(paths.length,2);assert.ok(paths.every(p=>p.attrs.d===d&&p.attrs.fill==='none'&&p.style.strokeWidth==='1.5'));assert.equal(paths[0].style.stroke,A.RED);assert.equal(paths[0].attrs['stroke-dasharray'],undefined);assert.equal(paths[1].style.stroke,A.PURPLE);assert.equal(paths[1].attrs['stroke-dasharray'],'6 6');
});
test('DOM palette writes only axis variables and centering does not change line endpoints',()=>{
 const root={style:{setProperty(k,v){this[k]=v;}},dataset:{}},el={style:{setProperty(k,v){this[k]=v;},left:'7px',top:'10px',width:'90px',transform:'rotate(45deg)'},classList:{add(c){this.added=c;}}};A.applyRoot(root,'purple-red');A.domLine(el,{width:2});assert.equal(root.dataset.axisPalette,'purple-red');assert.equal(root.style['--may-axis-secondary'],A.RED);assert.equal(el.style.left,'7px');assert.equal(el.style.top,'10px');assert.equal(el.style.width,'90px');assert.equal(el.style.transform,'rotate(45deg)');assert.equal(el.style.height,'0');assert.equal(el.style['--may-axis-width'],'2px');assert.equal(el.style.marginTop,undefined);
});
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
test('main diagonal is one continuous dash path with the original endpoints in both directions',()=>{
 const html=fs.readFileSync(path.join(__dirname,'Zerkalius-mayatnik.html'),'utf8'),start=html.indexOf('    const run=(t,sg,ra,rb,Y)=>'),end=html.indexOf('\n    G.save();G.lineWidth=u;',start),calls=[],records=[];
 const c={P:(x,y)=>[13+(x+.5)*4,17+(y+.5)*4],G:{recordLine:(a,b)=>records.push([a,b])},u:.25,Path2D:class{constructor(){this.ops=[];}moveTo(...p){this.ops.push(['move',...p]);}lineTo(...p){this.ops.push(['line',...p]);}},axisStroke:(g,o)=>calls.push(o)};
 vm.createContext(c);vm.runInContext(html.slice(start,end)+';globalThis.run=run;',c);
 for(const sg of [-1,1]){c.run(7,sg,.5,12.25,4);const expected=[[13+(7+sg*.5+.5)*4,17+1*4],[13+(7+sg*12.25+.5)*4,17+12.75*4]];assert.deepEqual(records.at(-1),expected);assert.deepEqual(calls.at(-1).path.ops,[['move',...expected[0]],['line',...expected[1]]]);assert.equal(calls.at(-1).unit,.25);}
});
