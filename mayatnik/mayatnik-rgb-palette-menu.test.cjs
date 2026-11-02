const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8');
class Node{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.dataset={};this.attrs={};this.listeners={};this.style={setProperty(){}};this.className='';this.namespaceURI='http://www.w3.org/2000/svg';this.classList={contains:c=>this.className.split(' ').includes(c),add:c=>this.className+=' '+c,toggle:(c,on)=>{this.className=this.className.split(' ').filter(v=>v!==c).concat(on?[c]:[]).join(' ');}};}
 append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
 after(node){const parent=this.parentElement;node.parentElement=parent;parent.children.splice(parent.children.indexOf(this)+1,0,node);}
 get nextElementSibling(){return this.parentElement?.children[this.parentElement.children.indexOf(this)+1];}
 setAttribute(k,v){this.attrs[k]=String(v);}
 addEventListener(k,fn){(this.listeners[k]||=[]).push(fn);}
 fire(k){for(const fn of this.listeners[k]||[])fn({preventDefault(){},stopPropagation(){}});}
 querySelectorAll(s){if(s.startsWith(':scope >'))return this.children.filter(n=>n.classList.contains('gz-hx'));return this.children.flatMap(n=>[...(n.classList.contains(s.slice(1))?[n]:[]),...n.querySelectorAll(s)]);}
}
test('RGB settings open on view change, preserve multi-colour filters and sync every display mode',()=>{
 const view=new Node('select');view.value='bits';view.options=['col','bits','rgbNeighbours'].map(value=>({value}));
 const list=new Node(),owner=new Node('button');owner.className='gz-hx';owner.dataset.viewMode='rgbNeighbours';list.append(owner);
 const events=new Node(),selected=[],counts=[10,20,30,40,50,60,70,80];let bw=0;
 const context={document:{createElement:tag=>new Node(tag),createElementNS:(ns,tag)=>new Node(tag),querySelectorAll:s=>list.querySelectorAll(s)},window:{addEventListener:(...args)=>events.addEventListener(...args),mayRGBNeighbours:{counts:()=>counts,filters:()=>selected,bw:()=>bw,toggleFilter:code=>{const at=selected.indexOf(code);at<0?selected.push(code):selected.splice(at,1);events.fire('may-rgb-neighbours-update');},setBW:mode=>{bw=mode;events.fire('may-rgb-neighbours-update');}}},$:()=>view,gModes:list,viewModeButtons:new Map([['rgbNeighbours',owner]]),viewPaletteSources:{},viewPalettePickers:new Map()};
 const start=source.indexOf('  function decorateViewPalette('),shared=source.lastIndexOf('  const rgbChoices=',start),end=source.indexOf('  function nameListButton(',start);
 vm.runInNewContext(source.slice(shared>=0?shared:start,end),context);
 const panels=list.querySelectorAll('.may-rgb-palette');assert.equal(panels.length,1);const panel=panels[0];assert.equal(owner.nextElementSibling,panel);assert.equal(panel.hidden,true);
 view.value='rgbNeighbours';view.fire('change');assert.equal(panel.hidden,false);
 const chips=panel.querySelectorAll('.may-rgb-choice'),modes=panel.querySelectorAll('.may-rgb-bw-option');assert.equal(chips.length,8);assert.equal(modes.length,3);
 chips[0].fire('click');chips[7].fire('click');assert.deepEqual(selected,[0,7]);assert.equal(chips[0].attrs['aria-pressed'],'true');assert.equal(chips[7].attrs['aria-pressed'],'true');assert.match(chips[7].title,/80/);
 for(const option of modes){option.fire('click');assert.equal(bw,Number(option.dataset.mode));assert.equal(option.attrs['aria-pressed'],'true');assert.equal(modes.filter(n=>n.attrs['aria-pressed']==='true').length,1);}
 view.value='bits';view.fire('change');assert.equal(panel.hidden,true);view.value='rgbNeighbours';view.fire('change');assert.equal(panel.hidden,false);assert.deepEqual(selected,[0,7]);assert.equal(list.querySelectorAll('.may-rgb-palette').length,1);
});
