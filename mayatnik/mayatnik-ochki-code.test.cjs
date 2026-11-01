const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
const code = (row, prev) => { const inverse = prev.replace(/[01]/g, b => b === '1' ? '0' : '1'); return Array.from(row, b => b === '1' ? prev : b === '0' ? inverse : b).join(''); };

test('код строки: 1 — предыдущая строка, 0 — её инверсия', () => {
  assert.equal(code('11', '1'), '11');
  assert.equal(code('101', '11'), '110011');
  assert.equal(code('1111', '101'), '101101101101');
  assert.equal(code('10001', '1111'), '11110000000000001111');
});

test('в «Поиске» есть режим «Код» и таблица показывает, что ищем', () => {
  const html = read('Zerkalius-mayatnik.html'), menu = read('mayatnik-menu.js');
  assert.match(html, /id="bOchkiCode"/);
  assert.match(html, /const OCHKI_CODE_MAX=4096/);
  assert.match(html, /function ochkiCodeAt\(i\)/);
  assert.match(html, /b==='1'\?prev:b==='0'\?inverse:b/);
  assert.match(html, /if\(st\.ochkiCode\)return ochkiCodeGet\(full,key\)/);
  assert.match(html, /👓 Код/);
  assert.match(html, /ищем №\$\{next\+1\}/);
  assert.match(html, /if\(!best\)\{stoppedAt=i;reason=reason\|\|'строка №'/);
  assert.match(html, /st\.ochkiCode\?1:0/);
  assert.match(html, /ochkiCodeSync\(\)/);
  assert.match(menu, /button\('bOchkiCode','text'\)/);
});
