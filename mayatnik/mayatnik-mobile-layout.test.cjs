const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=name=>fs.readFileSync(__dirname+'/'+name,'utf8'),menu=read('mayatnik-menu.js'),css=read('mayatnik-menu.css'),panel=read('mayatnik-template-panel.css');
const Dock=require('./mayatnik-menu-dock.js');
function rule(source,selector){const at=source.indexOf(selector+'{');assert.ok(at>=0,selector);return Object.fromEntries(source.slice(at+selector.length+1,source.indexOf('}',at)).split(';').filter(Boolean).map(d=>{const i=d.indexOf(':');return[d.slice(0,i),d.slice(i+1)];}));}
function geometry(view={}){const win={innerWidth:390,innerHeight:844,visualViewport:view},context=vm.createContext({window:win});vm.runInContext(menu.slice(menu.indexOf('  function menuVisualViewport('),menu.indexOf('  function exactZoomFraction(')),context);return context;}

test('fixed mobile player fits four portraits and coarse landscape without changing standard control dimensions',()=>{
 const player=rule(css,'body.may-mobile-menu #mayMobileBar #mayBottomBar'),slider=rule(css,'body.may-mobile-menu #mayMobileBar #mayBottomBar>.gz-sl');
 assert.equal(player.position,'fixed!important');assert.equal(player.width,'288px!important');assert.equal(player['--may-frame-width'],'120px!important');assert.equal(slider.width,'120px!important');assert.equal(player.transform,'translateX(-50%)!important');assert.ok(!('display' in player),'preserve the existing Zen hiding cascade');
 // The fixed rule follows the equal-specificity generic mobile inset/transform reset.
 assert.ok(css.indexOf('body.may-mobile-menu #mayMobileBar #mayBottomBar{')>css.indexOf('body.may-mobile-menu #mayMobileBar :is(.pt-g,.gz-group,#mayCorner,#mayBottomBar,#mayTemplateLauncher){'));
 assert.match(player.left,/safe-area-inset-left.*safe-area-inset-right/);assert.equal(player.top,'calc(36px + env(safe-area-inset-top))!important');
 const header=rule(css,'body.may-mobile-menu'),strip=rule(css,'body.may-mobile-menu #mayMobileBar');assert.equal(header['--may-mobile-bar-height'],'calc(80px + env(safe-area-inset-top))');assert.equal(strip.height,'calc(36px + env(safe-area-inset-top))');
 for(const width of [320,360,390,430]){
  assert.ok(Dock.isMobile({width,height:844,coarse:true}));
  for(const safe of [{left:0,right:0,top:0},{left:0,right:0,top:47}]){
   const x=(width+safe.left-safe.right-288)/2;assert.ok(x>=safe.left&&x+288<=width-safe.right);
   assert.equal(84+120+84,288);assert.ok(36+24+16<=80);assert.ok(36+3+33<=80);assert.ok(36+safe.top+40<=80+safe.top);
  }
 }
 const landscape={width:844,height:390,coarse:true},left=(844+44-44-288)/2;assert.ok(Dock.isMobile(landscape));assert.ok(left>=44&&left+288<=800);
 assert.equal(Dock.isMobile({width:1280,height:720,coarse:false}),false);
});

test('actual transport diamonds use the visible viewport and keep every option reachable after keyboard pan',()=>{
 const code=menu.slice(menu.indexOf('    const optionShape=input=>'),menu.indexOf('    function selected(){'));
 for(const view of [{width:320,height:568},{width:360,height:640},{width:390,height:844},{width:430,height:932},{width:844,height:390,offsetLeft:44},{width:390,height:260,offsetTop:120},{width:844,height:140,offsetTop:70}]){
  for(const speed of [false,true]){
   const c=geometry(view),input={},r={left:(view.offsetLeft||0)+view.width-50,width:30,bottom:(view.offsetTop||0)+view.height-20};
   Object.assign(c,{popup:{style:{setProperty(key,value){this[key]=value;}}},active:{input,button:{getBoundingClientRect:()=>r}},sp:speed?input:{}});vm.runInContext(code+'place();',c);
   const out=c.popup.style,x=parseFloat(out.left),y=parseFloat(out.top),height=parseFloat(out.maxHeight),width=parseFloat(out['--transport-popup-width']);
   assert.equal(width,speed?240:270);assert.ok(x>=(view.offsetLeft||0)+4);assert.ok(x+width<=(view.offsetLeft||0)+view.width-4);
   assert.ok(y>=(view.offsetTop||0)+4);assert.ok(y+Math.min(speed?192:216,height)<=(view.offsetTop||0)+view.height-4);assert.ok(height>=24);
  }
 }
 // Desktop also respects a panned visual viewport, rather than positioning off-screen.
 const c=geometry({width:300,height:100,offsetTop:500}),sp={};Object.assign(c,{popup:{style:{setProperty(key,value){this[key]=value;}}},active:{input:sp,button:{getBoundingClientRect:()=>({left:900,width:30,bottom:740})}},sp});vm.runInContext(code+'place();',c);
 assert.equal(c.popup.style.left,'56px');assert.equal(c.popup.style.top,'572px');assert.equal(c.popup.style.maxHeight,'24px');
});

test('assembly placement keeps every option reachable above a keyboard and overrides standard overflow',()=>{
 const c=geometry(),style={setProperty(k,v){this[k]=v;}},list={style,scrollHeight:456},owner={getBoundingClientRect:()=>({left:340,bottom:220})};
 for(const view of [{left:0,top:0,width:320,height:568},{left:12,top:110,width:360,height:190},{left:44,top:0,width:756,height:390}]){
  c.placeRomboAssemblyList(list,owner,view);const top=parseFloat(style.top),height=parseFloat(style['--may-rombo-list-height']);assert.ok(top>=view.top+4);assert.ok(top+Math.min(456,height)<=view.top+view.height-4);assert.ok(parseFloat(style.left)+120<=view.left+view.width-4);
 }
 const r=rule(css,'body.may-mobile-menu :is(.gz-ladder,#mayMobileBar).may-standard-list.may-rombo-assembly-options');assert.equal(r['overflow-y'],'auto!important');assert.equal(r['max-height'],'var(--may-rombo-list-height)!important');assert.equal(r.display,'flex!important');
 // ID + three classes + body beats standard.css's ID + three classes on decorated options, even when that file loads later.
 assert.match(read('mayatnik-button-standard.css'),/:is\(body\.mayatnik-menu-ready,#paintTools\) \.gz-ladder\.may-standard-list\{[^}]*overflow:visible!important/);
 assert.match(menu,/b\.dataset\.n==='romboAssembly'[\s\S]*?placement:\(\)=>mobileMenu\.matches\?'below':'right'/);
 assert.match(menu,/visualViewport\?\.addEventListener\('resize',reflowAssembly\)/);assert.match(menu,/visualViewport\?\.addEventListener\('scroll',reflowAssembly\)/);
});

test('the split grip remains draggable on touch and the caption scrolls independently',()=>{
 assert.match(css,/\.may-frame-thumb\{[^}]*width:var\(--may-thumb-width\)[^}]*z-index:7/);
 const grip=rule(css,'.may-frame-tail');assert.equal(grip.inset,'0');assert.equal(grip['touch-action'],'none');
 const caption=rule(css,'body.may-mobile-menu #mayBottomBar>.may-frame-caption');assert.equal(caption['overflow-x'],'auto');assert.equal(caption['pointer-events'],'auto');assert.equal(caption['touch-action'],'pan-x');assert.equal(caption['z-index'],'9');
 assert.match(menu,/thumb\.append\(tail,pl\);cell\.append\(thumb\)/);
 assert.match(menu,/cell\.parentElement\.append\(caption\)/);
 assert.equal(rule(css,'body.may-mobile-menu .may-rombo-row .may-rows-line input')['font-size'],'16px');
 assert.equal(rule(panel,'body.may-mobile-menu #mayatnikTemplatePanel .mtp-sequence-generator')['grid-template-columns'],'repeat(4,minmax(0,1fr))');assert.equal(rule(panel,'body.may-mobile-menu #mayatnikTemplatePanel .mtp-sequence-generator>label:nth-child(-n+4)')['grid-column'],'span 2');assert.equal(rule(panel,'body.may-mobile-menu #mayatnikTemplatePanel .mtp-sequence-generator>label:nth-child(5)')['grid-row'],'3');assert.equal(rule(panel,'body.may-mobile-menu #mayatnikTemplatePanel .mtp-sequence-generator>.mtp-command')['grid-row'],'3');
 for(const width of [320,360,390,430]){const inner=width-24,track=(inner-6)/4;assert.ok(2*track+2>=120);assert.ok(track>=60,'60px standard commands fit the separate third row');}
});

class Node{
 constructor(id='',type=1){this.id=id;this.nodeType=type;this.childNodes=[];this.parentElement=null;this.events={};this.classList={toggle(){}};}
 get children(){return this.childNodes.filter(n=>n.nodeType===1);}
 append(...nodes){for(const n of nodes){n.remove();n.parentElement=this;this.childNodes.push(n);}}
 before(n){const p=this.parentElement;n.remove();n.parentElement=p;p.childNodes.splice(p.childNodes.indexOf(this),0,n);}
 after(n){const p=this.parentElement;n.remove();n.parentElement=p;p.childNodes.splice(p.childNodes.indexOf(this)+1,0,n);}
 remove(){if(this.parentElement){const p=this.parentElement;p.childNodes.splice(p.childNodes.indexOf(this),1);this.parentElement=null;}}
 contains(n){return n===this||this.children.some(c=>c.contains(n));}
 setAttribute(){} addEventListener(type,fn){this.events[type]=fn;}
}
test('the unchanged mobileStrip restores desktop homes and live player without touching saved preferences',()=>{
 const body=new Node('body'),header=new Node('header'),tools=new Node('tools'),player=new Node('player'),side=new Node('side'),library=new Node('library'),end=new Node('end');body.append(header,side,library);header.append(tools,end);tools.append(player);
 const handlers={},c={module:{exports:{}},innerWidth:1280,innerHeight:720,coarse:false,document:{body,createElement:()=>new Node(),createComment:()=>new Node('',8)},matchMedia:()=>({get matches(){return c.coarse;},addEventListener(){}}),addEventListener:(type,fn)=>{(handlers[type]||=[]).push(fn);},dispatchEvent(){},CustomEvent:class{},localStorage:{getItem(){throw Error('read preferences');},setItem(){throw Error('write preferences');}}};c.globalThis=c;vm.runInNewContext(read('mayatnik-menu-dock.js'),c);const api=c.module.exports.mobileStrip(),bar=api.connect(header,[tools,side,library]);
 const resize=(width,height,coarse)=>{Object.assign(c,{innerWidth:width,innerHeight:height,coarse});for(const fn of handlers.resize)fn();};
 for(const [width,height] of [[320,568],[360,640],[390,844],[430,932],[844,390]]){resize(width,height,true);assert.equal(api.matches,true);assert.equal(tools.parentElement,bar);assert.equal(player.parentElement,tools);}
 resize(1280,720,false);assert.equal(api.matches,false);assert.equal(bar.parentElement,null);assert.deepEqual(header.children.map(n=>n.id),['tools','end']);assert.equal(player.parentElement,tools);assert.equal(side.parentElement,body);assert.equal(library.parentElement,body);
});
