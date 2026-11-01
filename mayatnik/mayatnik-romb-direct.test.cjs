const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
test('rombDirect keeps the field upright and draws every cell as a diamond',()=>{
 const html=read('Zerkalius-mayatnik.html'),menu=read('mayatnik-menu.js');
 assert.match(html,/option value="rombDirect"[^>]*>ромбы · прямо/);
 assert.match(html,/st\.view==='rombDirect'\?'diamond-flat':'flat'/);
 assert.match(html,/if\(st\.view==='rombDirect'&&!only\)\{/);
 assert.match(html,/ctx\.moveTo\(cx,cy-s\/2\);ctx\.lineTo\(cx\+s\/2,cy\)/);
 assert.match(html,/st\.view === 'rombDirect' \|\| rp >= 0&&st\.view!=='col'/);
 assert.match(html,/st\.view === 'rombDirect'(?: \|\| st\.view === 'rombTri')? \|\| constructionActive\(\)/);
 assert.match(html,/rombDirect:'Ромбы прямо'/);
 assert.match(menu,/rombDirect: 'Ромбы прям'/);
 assert.match(menu,/rombDirect: \['square','Ромбы · прямо'\]/);
});
