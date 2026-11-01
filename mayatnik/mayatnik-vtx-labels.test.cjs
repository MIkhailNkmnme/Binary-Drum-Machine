const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('vertex labels have bit borders, no minuses and two side colours',()=>{
 const html=fs.readFileSync(path.join(__dirname,'Zerkalius-mayatnik.html'),'utf8');
 assert.match(html,/t=q>0\?'\+'\+q:q<0\?String\(-q\):'0'/);
 assert.match(html,/G\.fillStyle=q<0\?'#b48cff':q>0\?'#69edff':'#e8eef7'/);
 assert.match(html,/for\(let p=lo;p<=hi;p\+\+\)\{const q=mir\?-p:p/);
 assert.match(html,/G\.strokeStyle=q<0\?'#b48cff':q>0\?'#69edff':'#e8eef7'/);
 assert.match(html,/G\.moveTo\(bx,tickTop\);G\.lineTo\(bx,tickBottom\)/);
 assert.match(html,/v0\.815: границы по битам/);
 assert.match(html,/<title>Zerkalius Маятнкъ — v0\.815<\/title>/);
});
