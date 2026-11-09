const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
test('frame and heat use the same split X geometry',()=>{
 const source=read('mayatnik-menu.js'),heat=read('mayatnik-heat-period-control.js'),css=read('mayatnik-menu.css');
 assert.match(source,/MayatnikHeatPeriodControl\.attachTrack\(cell,'may-frame-track'\)/);
 assert.match(heat,/track=attachTrack\(host,'may-heat-period'\)/);
 assert.match(css,/\.may-frame-track-rail\{[^}]*stroke-dasharray:2 3/);
});

test('the entire grip toggles play on click and suppresses play after a drag',()=>{
 const source=read('mayatnik-menu.js');
 assert.match(source,/tail\.append\(value,glyph\)/);
 assert.match(source,/tail\.addEventListener\('pointerdown'/);
 assert.match(source,/tail\.addEventListener\('click',[\s\S]*?suppressClick[\s\S]*?togglePlay\(\)/);
});
