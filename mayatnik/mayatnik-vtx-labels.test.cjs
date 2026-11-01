const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('vertex labels have bit borders, signs only at -1/+1 and two side colours',()=>{
 const html=fs.readFileSync(path.join(__dirname,'Zerkalius-mayatnik.html'),'utf8');
 assert.match(html,/t=q===-1\?'−1':q===1\?'\+1':String\(Math\.abs\(q\)\)/);
 assert.match(html,/G\.fillStyle=q<0\?'#b48cff':q>0\?'#69edff':'#e8eef7'/);
 assert.match(html,/for\(let p=lo;p<=hi;p\+\+\)\{const q=mir\?-p:p/);
 assert.match(html,/G\.strokeStyle=q<0\?'#b48cff':q>0\?'#69edff':'#e8eef7'/);
 assert.match(html,/G\.moveTo\(bx,tickTop\);G\.lineTo\(bx,tickBottom\)/);
 assert.match(html,/v0\.816: у номеров вершин знаки только у −1 и \+1/);
 assert.match(html,/<title>Zerkalius Маятнкъ — v0\.\d+<\/title>/);
});
