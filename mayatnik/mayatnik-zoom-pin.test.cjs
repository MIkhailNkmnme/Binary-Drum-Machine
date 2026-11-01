const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('top and bottom pins hold the field, fit-width keeps the middle of the tall picture',()=>{
 const html=fs.readFileSync(path.join(__dirname,'Zerkalius-mayatnik.html'),'utf8');
 assert.match(html,/function zPinScroll\(\)/);
 assert.match(html,/wrap\.addEventListener\('scroll', zPinScroll, \{ passive: true \}\)/);
 assert.match(html,/if \(st\.ztop\) zTopScroll\(\); else if \(st\.zBot\) zBotScroll\(\)/);
 assert.match(html,/function fitCenterY\(\)/);
 assert.match(html,/if \(st\.zoom === 'fit' && !st\.ztop && !st\.zBot\) fitCenterY\(\)/);
 assert.match(html,/const t = Math\.round\(over \/ 2\)/);
});
