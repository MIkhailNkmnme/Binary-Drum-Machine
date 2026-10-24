const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8');
test('segmented selectors choose the source option and follow changes made elsewhere',()=>{
 let changes=0;const e={value:'initial',options:[['initial','Начальная'],['ones','111…'],['zeros','000…'],['alternating','1010…']].map(([value,textContent])=>({value,textContent})),dispatchEvent(){changes++;}};
 const c={$:()=>e,tip:()=> 'Последовательность',Event:class {}};vm.createContext(c);vm.runInContext(src.slice(src.indexOf('  const segments ='),src.indexOf('  const control ='))+';globalThis.make=selectSegments;',c);
 const button=c.make('ochkiPattern');assert.equal(button.parts.length,4);assert.equal(button.type,'pair');button.parts[2].click();assert.equal(e.value,'zeros');assert.equal(changes,1);assert.equal(button.parts[2].on(),true);assert.equal(button.parts[0].on(),false);e.value='ones';assert.equal(button.parts[1].on(),true);
});
test('ring segments select explicit modes and keep the shared source handler',()=>{
 const modes=['выкл','краска','всё'];let mode=0;const e={get textContent(){return 'Зеркало: '+modes[mode];},click(){mode=(mode+1)%3;}};const c={$:()=>e,tip:()=> 'Зеркало'};vm.createContext(c);vm.runInContext(src.slice(src.indexOf('  const segments ='),src.indexOf('  const control ='))+';globalThis.make=ringSegments;',c);const b=c.make('bBlackMirror',modes);b.parts[2].click();assert.equal(mode,2);assert.equal(b.parts[2].on(),true);b.parts[0].click();assert.equal(mode,0);
});
test('overlap shading covers only rectangle intersections',()=>{
 const c={};vm.createContext(c);vm.runInContext(src.slice(src.indexOf('  function overlapRegions('),src.indexOf('  function syncGroupOverlap()')),c);const a={left:0,top:0,right:120,bottom:24},b={left:100,top:10,right:220,bottom:34};assert.deepEqual(JSON.parse(JSON.stringify(c.overlapRegions([a],[b]))),[{left:100,top:10,width:20,height:14}]);assert.equal(c.overlapRegions([a],[{left:121,top:0,right:200,bottom:24}]).length,0);
});

test('lower mirror has two independent sides and preserves all four source modes',()=>{
 let mode=0,options;const c={window:{mayFixLowNames:['Выкл','Левая','Правая','Обе'],mayFixLow:{get:()=>mode,set:v=>mode=v}},tools:{querySelector:()=>({})},reg:(b,fn)=>options=fn};vm.createContext(c);const line=src.split('\n').find(l=>l.includes('mayFixLowNames[i]'));assert.ok(line);vm.runInContext(line,c);
 assert.deepEqual(Array.from(options(),o=>o.name),['Левая','Правая']);
 for(const [i,m]of [[0,1],[1,3],[0,2],[1,0]]){options()[i].pick();assert.equal(mode,m);assert.deepEqual(Array.from(options(),o=>o.on),[!!(m&1),!!(m&2)]);}
 mode=3;assert.deepEqual(Array.from(options(),o=>o.on),[true,true]);options()[1].pick();assert.equal(mode,1);
 assert.ok(src.includes('две включённые части — обе стороны'));
});

test('diamond between Верх/Вниз toggles both actual sources, follows outside changes and owns its border',()=>{
 class N{constructor(cls=''){this.children=[];this.dataset={};this.attrs={};this.events={};this.className=cls;this.style={setProperty:(k,v)=>this.style[k]=v};}set className(v){this.classes=new Set(v.split(' ').filter(Boolean));}get classList(){return {add:(...x)=>x.forEach(k=>this.classes.add(k)),contains:k=>this.classes.has(k),toggle:(k,on)=>on?this.classes.add(k):this.classes.delete(k)};}append(...n){this.children.push(...n);}replaceChildren(){this.children=[];}setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}addEventListener(k,f){(this.events[k]??=[]).push(f);}click(){for(const f of this.events.click||[])f({stopPropagation(){}});}querySelector(s){return this.children.find(n=>n.classList.contains(s.split('.').pop()))||null;}querySelectorAll(){return this.children.filter(n=>n.classList.contains('gz-half'));}closest(){return null;}}
 const doc={createElement:()=>new N(),createElementNS:(ns)=>Object.assign(new N(),{namespaceURI:ns})},host=new N('may-zoom-edges'),halves=[new N('gz-half'),new N('gz-half')];host.ownerDocument=doc;host.append(...halves);
 const frames=require('../_js/control-frame.js'),observations=[],states={zTop:false,zFitH:false},clicks=[];let refreshes=0;
 const sources=Object.fromEntries(Object.keys(states).map(id=>[id,{getAttribute:()=>String(states[id]),click(){states[id]=!states[id];clicks.push(id);observations.forEach(f=>f());}}]));
 const ctx={ZerkControlFrame:frames,rail:{el:{querySelector:()=>host},refresh:()=>refreshes++},$:id=>sources[id],MutationObserver:class{constructor(f){this.f=f;}observe(){observations.push(this.f);}}};vm.createContext(ctx);
 vm.runInContext(src.slice(src.indexOf('  // A closed diamond joins'),src.indexOf('  // v0.255:')),ctx);const button=host.querySelector('.zcf-pair-switch');assert.ok(button);assert.equal(button.children[0].children[0].getAttribute('points'),'12,0 24,12 12,24 0,12');
 for(const initial of [[false,false],[false,true],[true,false],[true,true]]){[states.zTop,states.zFitH]=initial;observations.forEach(f=>f());const target=!initial.every(Boolean),before=refreshes;button.click();assert.deepEqual([states.zTop,states.zFitH],[target,target]);assert.equal(refreshes,before+1);assert.equal(button.getAttribute('aria-pressed'),String(target));}
 states.zTop=true;states.zFitH=false;observations.forEach(f=>f());assert.equal(button.getAttribute('aria-pressed'),'mixed');button.click();assert.deepEqual([states.zTop,states.zFitH],[true,true]);button.click();assert.deepEqual([states.zTop,states.zFitH],[false,false]);
 const standard=fs.readFileSync(__dirname+'/mayatnik-button-standard.js','utf8'),renderer={window:{ZerkControlFrame:frames},svg:cls=>new N(cls),shape:(svg,tag,attrs)=>{const n=new N(attrs.class||'');for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);svg.append(n);},set:(n,k,v)=>n.setAttribute(k,v),keyboard(){}};vm.createContext(renderer);vm.runInContext(standard.slice(standard.indexOf('  function choiceShape('),standard.indexOf('  function keyboard(')),renderer);renderer.parts(host);
 assert.deepEqual(halves.map(n=>n.querySelector('.may-half-outline').children[0].getAttribute('d')),['M60 0H12L0 12 12 24H60','M0 0H48L60 12 48 24H0']);assert.equal(halves[0].style['clip-path'],"path('M12 0H60L48 12 60 24H12L0 12Z')");assert.equal(host.children.filter(n=>n.classList.contains('gz-half')).length,2);
});
