const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
test('треугольники: половина ромба, пустой низ и подписи вида', () => {
  const html = read('Zerkalius-mayatnik.html'), menu = read('mayatnik-menu.js');
  assert.match(html, /option value="rombTri"[^>]*>треугольники/);
  assert.match(html, /st\.view === 'rombTri' \? 0 : st\.view === 'romb1'/);
  assert.match(html, /const tri = st\.view === 'rombTri'/);
  assert.match(html, /\(!tri \|\| y <= r\) \? cc\[r \* VW \+ c\] : empty/);
  assert.match(html, /function cellDigitPath\(ctx,cx,cy,s,tri\)/);
  assert.match(html, /const tri=st\.view==='rombTri'/);
  assert.match(html, /ctx\.fillText\(String\(v\),cx,tri\?cy-s\/3:cy\)/);
  assert.match(html, /if\(st\.view==='rombTri'\)\{st\.view='romb0';/);
  assert.match(html, /rombTri:'Треугольники'/);
  assert.match(html, /st\.view === 'rombAll' \|\| st\.view === 'rombDirect' \|\| st\.view === 'rombTri'/);
  assert.match(html, /"romb0","rombTri","romb1"/);
  assert.match(menu, /rombTri: 'Треуг\.'/);
  assert.match(menu, /rombTri: \['tri', 'Треугольники · половинки ромбов'\]/);
});
