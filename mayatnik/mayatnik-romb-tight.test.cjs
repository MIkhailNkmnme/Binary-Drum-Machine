const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
test('rombTight shows empty cells as tight diamonds with an outline',()=>{
 const html=read('Zerkalius-mayatnik.html'),menu=read('mayatnik-menu.js');
 assert.match(html,/option value="rombTight"[^>]*>ромбы · вплотную/);
 assert.match(html,/st\.view === 'rombTight' \? 0 : st\.view === 'romb0' \? 0/);
 assert.match(html,/if\(v<0\)\{if\(st\.view==='rombTight'\)\{/);
 assert.match(html,/ctx\.fillStyle='#0b0f16'/);
 assert.match(html,/rombTight:'Ромбы вплотную'/);
 assert.match(menu,/rombTight: 'Ромбы впл'/);
 assert.match(menu,/rombTight: \['square','Ромбы · вплотную'\]/);
});
