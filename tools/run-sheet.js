const { chromium } = require('playwright');
const fs = require('fs');
const recipes = require('./recipes');
const OUT = __dirname + '/../renders/sheet';
const PIXI_LOCAL = __dirname + '/vendor/pixi-7.4.2.min.js';

(async () => {
  const browser = await chromium.launch({
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
  });
  const report = [];
  for (const r of recipes) {
    const ctx = await browser.newContext({ viewport:{ width:1280, height:800 } }); // чистое хранилище: автосохранение не тащит прошлый прогон
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message.slice(0,120)));
    await page.route('**/pixi.js@7.4.2/dist/pixi.min.js', q =>
      q.fulfill({ status:200, contentType:'application/javascript', body: fs.readFileSync(PIXI_LOCAL,'utf8') }));
    await page.goto('http://127.0.0.1:8080/Zerkalius-genezis.html', { waitUntil:'load' });
    await page.waitForTimeout(2500);

    const missing = await page.evaluate(set => {
      const bad = [];
      for (const [id, val] of Object.entries(set)) {
        const el = document.getElementById(id);
        if (!el) { bad.push(id); continue; }
        if (el.type === 'checkbox') { if (el.checked !== val) el.click(); }
        else { el.value = val; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); }
      }
      return bad;
    }, r.set);

    for (const id of r.click || []) await page.evaluate(i => document.getElementById(i)?.click(), id);
    await page.waitForTimeout(1200);

    if (r.gl) { await page.evaluate(() => { const c=document.getElementById('webglRenderCheck'); if(c&&!c.checked) c.click(); }); await page.waitForTimeout(1800); }
    if (r.run) { await page.evaluate(() => document.getElementById('playBtn')?.click()); await page.waitForTimeout(r.run); await page.evaluate(() => document.getElementById('playBtn')?.click()); await page.waitForTimeout(400); }

    await page.evaluate(() => document.body.classList.add('zen-mode')); // убрать панели с кадра
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${r.id}.png` });

    const pixi = r.gl ? await page.evaluate(() => typeof PIXI !== 'undefined' && !!(document.getElementById('webglCanvas')?.getContext instanceof Function)) : null;
    report.push({ id:r.id, name:r.name, missing, errs: errs.slice(0,2), gl:!!r.gl, pixiOk:pixi });
    console.log(r.id, r.name, missing.length ? 'НЕТ ТАКИХ id: '+missing.join(',') : 'ok', errs.length ? '| err: '+errs[0] : '');
    await ctx.close();
  }
  fs.writeFileSync(OUT + '/report.json', JSON.stringify(report, null, 1));
  await browser.close();
})();
