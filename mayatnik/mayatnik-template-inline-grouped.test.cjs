const test=require('node:test'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom'),I=require('./mayatnik-template-inline.js'),text=require('../_js/hub-button-text.js');
function fixture(){
  const dom=new JSDOM('<!doctype html><body></body>'),doc=dom.window.document,calls=[];
  doc.defaultView.HubButtonText=text;
  const view=I.mount({document:doc,action:(...args)=>calls.push(args)});
  const banks=[...view.host.querySelectorAll('.may-template-inline-bank')];
  let measured=300;
  for(const bank of banks)Object.defineProperty(bank,'scrollHeight',{get:()=>measured});
  const state={key:'a',left:10,top:20,width:600,viewportHeight:600,box:{x:50,y:60,width:100,height:50},colour:'#ff4040',height:125,downValue:3,alpha:80};
  return {dom,doc,calls,view,state,banks,measure:value=>measured=value};
}
function openField(input){
  const heading=input.closest('section').querySelector('.may-template-inline-heading');
  if(heading.getAttribute('aria-expanded')==='false')heading.click();
}
test('six labelled groups retain all 23 command identifiers and full accessible names',()=>{const {view}=fixture(),buttons=[...view.host.querySelectorAll('button.gz-hx')];assert.equal(view.host.querySelectorAll('section').length,6);assert.equal(buttons.length,23);assert.deepEqual(buttons.map(b=>b.dataset.command).sort(),I.commands.map(c=>c[0]).sort());for(const b of buttons){const command=I.commands.find(c=>c[0]===b.dataset.command);assert.equal(b.title,command[1]);assert.equal(b.getAttribute('aria-label'),command[1]);assert.ok(/[а-яA-Z]/i.test(b.querySelector('.gz-nm').textContent));assert.ok(b.classList.contains('may-standard'));assert.ok(b.querySelector('.may-standard-outline polygon'));}assert.equal(view.host.querySelector('[data-command=colour] .gz-nm').textContent,text.shortCaption('Цвет'));});
test('each command and accessible numeric field forwards its action',()=>{
  const {view,calls,dom,state}=fixture();
  view.render(state);
  for(const [id]of I.commands){
    if(id==='colour')continue;
    view.host.querySelector('[data-command="'+id+'"]').click();
    assert.deepEqual(calls.at(-1),[id]);
  }
  for(const [id,value,unit]of [['height',150,'%'],['downValue',-3,'строк'],['alpha',40,'%']]){
    const input=view.host.querySelector('[data-field='+id+']');
    const row=input.closest('[data-field-control]');
    assert.ok(input.title);
    assert.equal(row.title,input.title);
    assert.equal(input.getAttribute('aria-label'),input.title);
    assert.equal(row.getAttribute('aria-label'),input.title);
    assert.equal(input.closest('label').textContent,text.shortCaption(unit));
    input.value=value;
    input.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
    assert.deepEqual(calls.at(-1),[id,value]);
  }
});
test('palette is immediate and remains inside outside-dismiss capture boundary across redraws',()=>{const {view,state,doc,calls,dom,measure}=fixture();view.render(state);view.host.querySelector('[data-command=colour]').click();const palette=view.host.querySelector('.may-template-inline-palette');assert.equal(palette.hidden,false);measure(460);palette.querySelector('button').dispatchEvent(new dom.window.Event('pointerdown',{bubbles:true}));view.render(state);assert.equal(view.host.hidden,false);palette.querySelector('button').click();assert.deepEqual(calls.at(-1),['colour','#ffffff']);doc.body.dispatchEvent(new dom.window.Event('pointerdown',{bubbles:true}));assert.equal(view.host.hidden,true);view.render({...state,alpha:60});assert.equal(view.host.hidden,true);view.render({...state,key:'b'});assert.equal(view.host.hidden,false);view.destroy();assert.equal(doc.body.children.length,0);});
test('busy, command disabled and independent pressed states survive grouped redraw',()=>{const {view,state}=fixture();view.render({...state,move:true,show:true,disabled:['line']});assert.equal(view.host.querySelector('[data-command=move]').getAttribute('aria-pressed'),'true');assert.equal(view.host.querySelector('[data-command=trail]').getAttribute('aria-pressed'),'false');assert.equal(view.host.querySelector('[data-command=line]').disabled,true);view.render({...state,busy:true});assert.ok([...view.host.querySelectorAll('button,input')].every(n=>n.disabled));view.render(state);assert.ok([...view.host.querySelectorAll('button,input')].every(n=>!n.disabled));});
test('each bank follows the figure vertically and clamps to the viewport',()=>{
  const {view,state,banks,measure}=fixture();
  view.render(state);
  assert.deepEqual(banks.map(bank=>bank.style.top),['60px','60px']);
  view.render({...state,box:{...state.box,y:500}});
  assert.deepEqual(banks.map(bank=>bank.style.top),['316px','316px']);
  view.hide();
  measure(900);
  view.render({...state,viewportHeight:220});
  for(const bank of banks){
    assert.equal(bank.style.maxHeight,'212px');
    assert.equal(bank.style.top,'24px');
  }
});
test('two banks stay inside the field and stack when space is narrow',()=>{
  const {view,state,banks}=fixture();
  for(const width of [600,300,258]){
    view.render({...state,width,box:{x:2000,y:60,width:40,height:40}});
    assert.equal(view.host.classList.contains('inline-narrow'),false);
    const [left,right]=banks.map(bank=>parseFloat(bank.style.left));
    assert.ok(left>=state.left+4);
    assert.ok(right>=left+126);
    assert.ok(right+124<=state.left+width-4);
  }
  view.render({...state,width:200,viewportHeight:220});
  assert.equal(view.host.classList.contains('inline-narrow'),true);
  assert.equal(view.host.style.left,'14px');
  assert.equal(view.host.style.top,'24px');
  assert.equal(view.host.style.maxHeight,'212px');
  assert.ok(banks.every(bank=>bank.style.maxHeight==='none'));
  view.render({...state,width:129});
  assert.equal(view.host.hidden,true);
});

test('numeric display removes noise and preserves fractions and focused edits',()=>{
  const {view,state,doc}=fixture(),input=view.host.querySelector('[data-field=height]');
  const noisy={...state,height:110.00000000000001};
  view.render(noisy);
  assert.equal(input.value,'110');
  assert.equal(noisy.height,110.00000000000001);
  view.render({...state,height:110.125});
  assert.equal(input.value,'110.125');
  openField(input);
  input.focus();
  assert.equal(doc.activeElement,input);
  input.value='137.75';
  view.render({...state,height:125});
  assert.equal(doc.activeElement,input);
  assert.equal(input.value,'137.75');
});


test('host keeps template controls outside Music settings while preserving figure coordinates',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8'),at=html.indexOf('function templateInlineRender(');let end=html.indexOf('{',at),depth=1;while(depth){end++;if(html[end]==='{')depth++;if(html[end]==='}')depth--;}
 let shown,panel=null;const context=vm.createContext({templateInlineControls:{render:s=>shown=s,hide(){}},templateInlineAxes:null,templateInlineTransaction:null,templateOptions:()=>({height:1,down:0,proportional:false}),templateVisible:true,templateDragEnabled:false,templateTransfer:false,templatePaintColour:()=>null,templateInlineFall:null,RK:1,mirrorLine:false,$:id=>id==='mayMusicSettingsPanel'?panel:{checked:false,value:50}});vm.runInContext(html.slice(at,end+1),context);
 const screen={left:100,top:20,width:600,height:500,ox:0,oy:0,factor:2},state={item:{id:'a',hex:'#fff'},box:{x:10,y:15,width:20,height:25}};
 context.templateInlineRender(null,state,screen);assert.equal(shown.width,600);const expected=JSON.stringify(shown.box);
 panel={hidden:false,getBoundingClientRect:()=>({left:450,right:700,top:20,bottom:520})};context.templateInlineRender(null,state,screen);assert.equal(shown.width,346);assert.equal(JSON.stringify(shown.box),expected);
 panel.hidden=true;context.templateInlineRender(null,state,screen);assert.equal(shown.width,600);
 panel.hidden=false;panel.getBoundingClientRect=()=>({left:100,right:700,top:20,bottom:520});context.templateInlineRender(null,state,screen);assert.equal(shown.width,0);
});

test('late caption helper updates group titles and units without losing edits',()=>{
  const {view,state,doc,calls}=fixture();
  view.destroy();
  delete doc.defaultView.HubButtonText;
  const late=I.mount({document:doc,action:(...args)=>calls.push(args)});
  late.render(state);
  const button=late.host.querySelector('[data-command=colour]');
  const heading=late.host.querySelector('.may-template-inline-heading .zgh-title');
  const height=late.host.querySelector('[data-field=height]');
  const down=late.host.querySelector('[data-field=downValue]');
  assert.equal(button.querySelector('.gz-nm').textContent,'Цвет');
  assert.equal(heading.textContent,'Копии / библиотека');
  const fullName=height.getAttribute('aria-label');
  openField(height);
  height.focus();
  assert.equal(doc.activeElement,height);
  height.value='137.75';
  doc.defaultView.HubButtonText=text;
  late.render(state);
  assert.equal(button.querySelector('.gz-nm').textContent,text.shortCaption('Цвет'));
  assert.equal(heading.textContent,text.shortCaption('Копии / библиотека'));
  assert.equal(down.closest('label').textContent,text.shortCaption('строк'));
  assert.equal(height.getAttribute('aria-label'),fullName);
  const once=late.host.textContent;
  late.render(state);
  assert.equal(late.host.textContent,once);
  assert.equal(height.value,'137.75');
  assert.equal(doc.activeElement,height);
  assert.equal(button.title,I.commands.find(c=>c[0]==='colour')[1]);
  late.host.querySelector('[data-command=save]').click();
  assert.deepEqual(calls.at(-1),['save']);
  late.destroy();
});
test('DOMContentLoaded applies late captions without reopening dismissed selection, and destroy removes listener',()=>{const {view,state,doc,dom}=fixture();view.destroy();delete doc.defaultView.HubButtonText;const late=I.mount({document:doc,action(){}});Object.defineProperty(late.host,'scrollHeight',{value:300});late.render(state);doc.body.dispatchEvent(new dom.window.Event('pointerdown',{bubbles:true}));doc.defaultView.HubButtonText=text;doc.dispatchEvent(new dom.window.Event('DOMContentLoaded'));assert.equal(late.host.hidden,true);assert.equal(late.host.querySelector('[data-command=colour] .gz-nm').textContent,text.shortCaption('Цвет'));late.render(state);assert.equal(late.host.hidden,true);late.destroy();const removed=I.mount({document:doc,action(){}});delete doc.defaultView.HubButtonText;removed.destroy();doc.defaultView.HubButtonText={shortCaption:()=>{throw Error('destroyed listener invoked');}};doc.dispatchEvent(new dom.window.Event('DOMContentLoaded'));});
