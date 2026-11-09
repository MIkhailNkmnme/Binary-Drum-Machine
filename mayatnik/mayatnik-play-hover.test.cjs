const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
test('frame and heat use the same split X geometry',()=>{
 const source=read('mayatnik-menu.js'),heat=read('mayatnik-heat-period-control.js'),css=read('mayatnik-menu.css');
 assert.match(source,/MayatnikHeatPeriodControl\.attachTrack\(cell,'may-frame-track'\)/);
 assert.match(heat,/track=attachTrack\(host,'may-heat-period'\)/);
 assert.match(css,/\.may-frame-track-rail\{[^}]*stroke-dasharray:2 3/);
});

test('play stays on the thumb and has a separate target from dragging and reset',()=>{
 const source=read('mayatnik-menu.js');
 assert.match(source,/thumb\.append\(tail,pl\)/);
 assert.match(source,/pl\.addEventListener\('click',event=>\{event\.stopPropagation\(\);togglePlay\(\);\}\)/);
 assert.match(source,/tail\.addEventListener\('pointerdown'/);
 assert.match(source,/tail\.addEventListener\('dblclick',[^\n]*resetFrame\(\)/);
});
