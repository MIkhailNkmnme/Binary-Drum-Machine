const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('N/3 | 4N sits first in the Размер section',()=>{
 const html=fs.readFileSync(path.join(__dirname,'Zerkalius-mayatnik.html'),'utf8'),menu=fs.readFileSync(path.join(__dirname,'mayatnik-menu.js'),'utf8');
 assert.match(menu,/pop\.prepend\(section\(vm, 'size'\)\)/);
 assert.doesNotMatch(menu,/pop\.prepend\(section\(vm, 'build'\)\)/);
 assert.match(html,/mayatnik-menu\.js\?v=819/);
 assert.match(html,/<title>Zerkalius Маятнкъ — v0\.819<\/title>/);
});
