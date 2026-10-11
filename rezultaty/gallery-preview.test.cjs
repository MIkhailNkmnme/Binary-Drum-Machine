const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

test('live previews release the previous app and stop offscreen or in a hidden tab',()=>{
  let observeCallback;
  const frames=new Set(),events={},buttons=[];
  const boxes=[0,1].map(i=>({title:'Preview '+i,dataset:{previewSrc:'app'+i+'.html'},parentElement:{appendChild(b){buttons.push(b);}},appendChild(frame){frames.add(frame);}}));
  const document={hidden:false,querySelectorAll(){return boxes;},addEventListener(name,fn){events[name]=fn;},createElement(tag){
    if(tag==='iframe')return {remove(){frames.delete(this);}};
    return {attrs:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(name,fn){this[name]=fn;}};
  }};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'gallery-preview.js'),'utf8'),{document,window:{addEventListener(name,fn){events[name]=fn;}},IntersectionObserver:class{constructor(fn){observeCallback=fn;}observe(){}},Map});
  assert.equal(frames.size,0);
  buttons[0].click();assert.equal(frames.size,1);assert.equal([...frames][0].src,'app0.html');
  buttons[1].click();assert.equal(frames.size,1);assert.equal([...frames][0].src,'app1.html');assert.equal(buttons[0].attrs['aria-pressed'],'false');
  observeCallback([{target:boxes[1].parentElement,isIntersecting:false}]);assert.equal(frames.size,0);
  buttons[0].click();buttons[0].click();assert.equal(frames.size,0);
  buttons[1].click();document.hidden=true;events.visibilitychange();assert.equal(frames.size,0);
  document.hidden=false;buttons[0].click();events.pagehide();assert.equal(frames.size,0);
});

test('the gallery has no automatically loaded live applications',()=>{
  const html=fs.readFileSync(path.join(__dirname,'Zerkalius-rezultaty.html'),'utf8');
  assert.doesNotMatch(html,/<iframe\b/i);
  assert.match(html,/gallery-preview\.js\?v=15/);
});
