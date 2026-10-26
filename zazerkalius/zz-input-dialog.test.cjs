const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Dialog=require('./zz-input-dialog.js'),{JSDOM}=require('C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
function setup(){const dom=new JSDOM('<button id="before">Начало</button>'),doc=dom.window.document,api=Dialog.create(doc);doc.querySelector('button').focus();return {dom,doc,api};}
test('integer range is strict and does not accept empty, fractional or nonnumeric text',()=>{for(const value of ['',0,-1,257,'1.5','1e2','0x10','abc'])assert.throws(()=>Dialog.integer(value,1,256));assert.equal(Dialog.integer(' 256 ',1,256),256);});
test('invalid submit leaves the dialog open; Enter accepts once and restores focus',async()=>{
 const {dom,doc,api}=setup();try{const pending=api.open({title:'Колец',value:'5',type:'number',min:1,max:256}),input=doc.querySelector('input'),form=doc.querySelector('form');input.value='0';form.requestSubmit();assert.ok(api.active);assert.match(doc.querySelector('[role=alert]').textContent,/от 1 до 256/);assert.equal(input.getAttribute('aria-invalid'),'true');input.value='8';input.dispatchEvent(new dom.window.Event('input'));input.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));assert.equal(await pending,'8');assert.equal(api.active,null);assert.equal(doc.activeElement.id,'before');}finally{api.cancel();dom.window.close();}
});
test('Cancel, Escape, and opening a replacement dialog cancel without accepting data',async()=>{
 const {dom,doc,api}=setup();try{let pending=api.open({title:'Имя',value:'старое'});doc.querySelector('[aria-label="Отменить ввод"]').click();assert.equal(await pending,null);pending=api.open({title:'Имя'});doc.querySelector('dialog').dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(await pending,null);const old=api.open({title:'Старый'}),next=api.open({title:'Новый',value:'2'});assert.equal(await old,null);api.cancel();assert.equal(await next,null);}finally{dom.window.close();}
});
test('copy fallback renders safe readonly text and selects it without native prompt',async()=>{
 const {dom,doc,api}=setup();try{dom.window.prompt=()=>{throw Error('unsupported');};const text='<script>alert(1)</script>\nhttps://example.test/#state',pending=api.open({title:'Скопируй',value:text,readOnly:true});const field=doc.querySelector('textarea');assert.equal(field.value,text);assert.equal(field.readOnly,true);assert.equal(field.selectionEnd,text.length);assert.equal(doc.querySelectorAll('script').length,0);doc.querySelector('form').requestSubmit();assert.equal(await pending,text);}finally{dom.window.close();}
});
const source=fs.readFileSync(__dirname+'/zz-ui.js','utf8'),start=source.indexOf('  if ($("bConeSliceRingCount"))'),handler=source.slice(start,source.indexOf('  document.querySelectorAll("[data-slice-first]")',start));
test('actual ring-count handler cancels/errors without restart, and valid change restarts exactly once',async()=>{
 const {dom,doc,api}=setup(),button=doc.createElement('button'),Z={coneSliceRingCount:5,coneSliceStop5:true};let restarts=0;const context={Z,CONE_MAX:256,$:()=>button,ZZInputDialog:api,plateZig(){},sliceSetupRestart(){restarts++;},say(){}};vm.createContext(context);vm.runInContext(handler,context);
 try{
  let pending=button.onclick();doc.querySelector('input').value='0';doc.querySelector('form').requestSubmit();assert.equal(restarts,0);assert.equal(Z.coneSliceRingCount,5);api.cancel();await pending;assert.equal(restarts,0);
  pending=button.onclick();doc.querySelector('dialog').dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await pending;assert.equal(restarts,0);assert.equal(Z.coneSliceRingCount,5);
  pending=button.onclick();doc.querySelector('input').value='7';doc.querySelector('form').requestSubmit();await pending;assert.equal(restarts,1);assert.equal(Z.coneSliceRingCount,7);assert.equal(Z.coneSliceStop5,true);
  pending=button.onclick();doc.querySelector('form').requestSubmit();await pending;assert.equal(restarts,1,'unchanged count keeps the current run');
 }finally{api.cancel();dom.window.close();}
});
test('all page-local prompt sites use the reusable helper and it loads before zz-ui',()=>{assert.doesNotMatch(source,/(?:window\.)?prompt\s*\(/);const html=fs.readFileSync(__dirname+'/Zerkalius-zazerkalius.html','utf8');assert.ok(html.indexOf('zz-input-dialog.js')<html.indexOf('<script src="zz-ui.js'));assert.match(fs.readFileSync(__dirname+'/zz-input-dialog.css','utf8'),/border-radius:0/);});
