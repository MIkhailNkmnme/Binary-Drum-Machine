const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8');
const context={window:{HubButtonText:require('../_js/hub-button-text.js')},document:{createElement:()=>({})}};
vm.createContext(context);vm.runInContext(source.slice(source.indexOf('  function exactZoomFraction('),source.indexOf('  let libraryMenuFold=')),context);
test('physical zoom is an exact reduced fraction, including non-dyadic column counts and binary floating-point values',()=>{
 for(const [width,cols,dpr,wanted]of [[512,512,1,'1/1'],[1024,512,1,'2/1'],[64,512,1,'1/8'],[137,12,1,'137/12'],[137.5,12,1.25,'1375/96'],[4095/64,4095,1,'1/64'],[0.1,1,1,'3602879701896397/36028797018963968'],[128,512,1.5,'3/8']])assert.equal(context.exactZoomFraction(width,cols,dpr),wanted);
 for(const args of [[0,1,1],[1,0,1],[1,1,Infinity],[NaN,1,1],[1,1.5,1]])assert.equal(context.exactZoomFraction(...args),'');
});
test('caption honours exact spellings and retains every digit of the scale fraction without thousands spacing',()=>{
 const caption={dataset:{},replaceChildren(...nodes){this.children=nodes;}};
 context.renderFrameCaption(caption,['Маятник','без сброса хода','Перескок 2497','512 строк','8N−1=4095','масштаб 137/12']);
 assert.equal(caption.children[0].textContent,'Маятнкъ');assert.equal(caption.children[2].textContent,'Прескокъ 2497');assert.equal(caption.children[3].textContent,'512 стркъ');assert.equal(caption.children[4].textContent,'8N−1=4095');assert.equal(caption.children[5].textContent,'Масштбъ 137/12');
 const same=caption.children;context.renderFrameCaption(caption,['Маятник','без сброса хода','Перескок 2497','512 строк','8N−1=4095','масштаб 137/12']);assert.equal(caption.children,same);
});
