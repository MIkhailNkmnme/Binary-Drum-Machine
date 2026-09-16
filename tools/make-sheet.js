const { chromium } = require('playwright');
const fs = require('fs');
const recipes = require('./recipes');
const DIR = __dirname + '/../renders/sheet';

const tile = r => `
<figure>
  <div class="thumb"><img src="${r.id}.png"><span class="tag ${r.gl?'gl':''}">${r.gl?'⚡ GPU':'Canvas2D'}</span></div>
  <figcaption><b>${r.id.toUpperCase()} · ${r.name}</b><span>${r.note}</span></figcaption>
</figure>`;

fs.writeFileSync(DIR + '/sheet.html', `<!doctype html><meta charset="utf-8"><style>
  :root { color-scheme: dark; }
  body { background:#070707; color:#00ff66; font:14px 'Consolas',monospace; margin:0; padding:34px 30px 40px; }
  h1 { font-size:22px; letter-spacing:5px; text-transform:uppercase; margin:0 0 4px; font-weight:700; }
  .sub { color:#5a7f68; font-size:13px; margin:0 0 26px; letter-spacing:1px; }
  .grid { display:grid; grid-template-columns:repeat(4,1fr); gap:20px 18px; }
  figure { margin:0; }
  .thumb { position:relative; border:1px solid #1d3a2a; border-radius:4px; overflow:hidden; background:#000; aspect-ratio:16/10; }
  .thumb img { width:100%; height:100%; object-fit:cover; display:block; }
  .tag { position:absolute; top:7px; right:7px; font-size:10px; letter-spacing:1px; padding:2px 6px; border-radius:3px;
         background:rgba(0,0,0,.72); color:#4d7a63; border:1px solid #23402f; }
  .tag.gl { color:#ffd500; border-color:#6b5a00; }
  figcaption { padding:8px 2px 0; display:flex; flex-direction:column; gap:2px; }
  figcaption b { color:#00ff66; font-size:13px; font-weight:700; }
  figcaption span { color:#5f7f6e; font-size:11.5px; line-height:1.35; }
</style>
<h1>Zerkalius Genezis v0.420 · контактный лист</h1>
<p class="sub">20 рецептов узоров · генератор Серпинского + модификаторы движения · кадры сняты в zen-режиме</p>
<div class="grid">${recipes.map(tile).join('')}</div>`);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{ width:2100, height:1200 }, deviceScaleFactor:1 });
  await p.goto('file://' + DIR + '/sheet.html');
  await p.waitForTimeout(1200);
  await p.screenshot({ path: DIR + '/CONTACT-SHEET.png', fullPage:true });
  await b.close();
  console.log('готово');
})();
