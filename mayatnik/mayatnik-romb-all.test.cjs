const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
test('rombAll view shows the whole field as diamonds with both parities',()=>{
 const html=read('Zerkalius-mayatnik.html'),menu=read('mayatnik-menu.js');
 assert.match(html,/option value="rombAll"[^>]*>ромбы · всё поле/);
 assert.match(html,/st\.view === 'rombAll' \? 4 : -1/);
 assert.match(html,/rombP\(\) === 4 \? VW \+ VH \+ 1/);
 assert.match(html,/function drawRombAll\(px, T, empty, hl\)/);
 assert.match(html,/if \(rp === 4\) drawRombAll\(px, T, empty, och && och\.hl\)/);
 assert.match(html,/const i = Math\.round\(\(u \+ v - \(VH \+ 1\)\) \/ 2\), j = Math\.round\(\(v - u \+ \(VH - 1\)\) \/ 2\)/);
 assert.match(html,/rombAll:'Всё поле ромбами'/);
 assert.match(html,/st\.view === 'rombAll' \|\| st\.view === 'rombDirect' \|\| st\.view === 'rombTri' \|\| constructionActive\(\)/);
 assert.match(menu,/romb2: 'Ромбы оба', rombAll: 'Ромбы всё'/);
 assert.match(menu,/rombAll: \['square','Ромбы · всё поле'\]/);
});
