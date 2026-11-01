const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
test('frame play/pause appears in the middle only on hover, stays as pause while playing',()=>{
 const css=read('mayatnik-menu.css');
 assert.match(css,/\.may-bb-play\{[^}]*opacity:0;visibility:hidden[^}]*pointer-events:none/);
 assert.match(css,/\.gz-sl:hover \.may-bb-play/);
 assert.match(css,/\.gz-sl:focus-visible \.may-bb-play/);
 assert.match(css,/\.may-bb-play\[aria-pressed="true"\]\{opacity:1;visibility:visible/);
 assert.match(css,/@media\(hover:none\)\{#mayBottomBar \.may-bb-play\{opacity:1;visibility:visible/);
 assert.match(css,/\.may-bb-play\{[^}]*z-index:11/);
});
test('play and reset in the slider keep their clicks away from the thumb and slider handlers',()=>{
 const source=read('mayatnik-menu.js');
 assert.match(source,/const stop=e=>e\.stopPropagation\(\); b\.className = 'may-bb-rs'/);
 assert.match(source,/b\.addEventListener\('pointerdown',stop\); b\.addEventListener\('pointerup',stop\); b\.addEventListener\('click',stop\)/);
 assert.match(source,/pl\.addEventListener\('pointerdown',stop\); pl\.addEventListener\('pointerup',stop\); pl\.addEventListener\('click',stop\)/);
});
