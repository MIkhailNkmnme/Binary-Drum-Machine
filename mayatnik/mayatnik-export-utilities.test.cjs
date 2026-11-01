const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('search/info/help utility button sits in the Экспорт group',()=>{
 const html=fs.readFileSync(path.join(__dirname,'Zerkalius-mayatnik.html'),'utf8'),menu=fs.readFileSync(path.join(__dirname,'mayatnik-menu.js'),'utf8');
 assert.match(menu,/doc\.querySelector\('\.gz-group\[data-id="export"\]'\)/);
 assert.match(menu,/mayInfoDiamond/);
 assert.match(menu,/mayButtonSearchTrigger/);
 assert.match(html,/mayatnik-menu\.js\?v=\d+/);
 assert.match(html,/<title>Zerkalius Маятнкъ — v0\.\d+<\/title>/);
});
