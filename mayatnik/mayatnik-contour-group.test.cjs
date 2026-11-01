const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('contour rows and Вспышка/Тепло sit under Контуры in the Вид поля group',()=>{
 const html=fs.readFileSync(path.join(__dirname,'Zerkalius-mayatnik.html'),'utf8'),menu=fs.readFileSync(path.join(__dirname,'mayatnik-menu.js'),'utf8');
 assert.match(menu,/const anchor=gModes\.querySelector\('\[data-view-overlay="contours"\]'\);if\(anchor\)anchor\.after\(row\);else gModes\.append\(row\)/);
 assert.match(menu,/for \(const n of \['vtxFlash', 'heat'\]\) \{ const e = gView\.querySelector/);
 assert.doesNotMatch(menu,/'cellInk', 'rowLab', 'vtxFlash', 'heat'/);
 assert.match(html,/mayatnik-menu\.js\?v=817/);
 assert.match(html,/<title>Zerkalius Маятнкъ — v0\.817<\/title>/);
});
