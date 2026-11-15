/* Local font files are previewed in memory and are never uploaded. */
(() => {
  'use strict';
  const input = document.getElementById('localFontFile');
  const text = document.getElementById('localFontText');
  const status = document.getElementById('localFontStatus');
  const canvas = document.getElementById('localFontCanvas');
  const save = document.getElementById('localFontPng');
  let current = null, generation = 0, fileName = 'font';

  function draw() {
    if (!current) return;
    const lines = text.value.replace(/\r\n?/g, '\n').split('\n').slice(0, 40);
    const ctx = canvas.getContext('2d');
    const font = '64px "' + current.family + '"';
    ctx.font = font;
    const metrics = lines.map(line => ctx.measureText(line));
    const left = Math.max(16, ...metrics.map(m => Math.ceil(m.actualBoundingBoxLeft || 0) + 8));
    const right = Math.max(16, ...metrics.map(m => Math.ceil((m.actualBoundingBoxRight || m.width) - m.width) + 8));
    const ascent = Math.max(64, ...metrics.map(m => Math.ceil(m.actualBoundingBoxAscent || 0)));
    const descent = Math.max(16, ...metrics.map(m => Math.ceil(m.actualBoundingBoxDescent || 0)));
    const lineHeight = ascent + descent + 16;
    const naturalWidth = Math.ceil(Math.max(1, ...metrics.map(m => m.width)) + left + right);
    const naturalHeight = lines.length * lineHeight + 16;
    const scale = Math.min(1, 4096 / naturalWidth, 4096 / naturalHeight);
    canvas.width = Math.ceil(naturalWidth * scale);
    canvas.height = Math.ceil(naturalHeight * scale);
    const style = getComputedStyle(document.documentElement);
    ctx.fillStyle = style.getPropertyValue('--bg').trim() || '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale); ctx.font = font; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = style.getPropertyValue('--ink').trim() || '#fff';
    lines.forEach((line, i) => ctx.fillText(line, left, 8 + ascent + i * lineHeight));
    canvas.hidden = false;
    save.disabled = !text.value;
  }

  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    const request = ++generation;
    status.textContent = 'Загрузка ' + file.name + '…';
    try {
      if (file.size > 16 * 1024 * 1024) throw new Error('Размер шрифта больше 16 МБ.');
      const face = new FontFace('AzbukLocal' + request, await file.arrayBuffer());
      await face.load();
      if (request !== generation) return;
      if (current) document.fonts.delete(current);
      document.fonts.add(face); current = face;
      fileName = file.name.replace(/\.[^.]+$/, '');
      status.textContent = file.name + ' · просмотр исходного шрифта без клеточного подсчёта. После закрытия страницы файл нужно выбрать снова.';
      draw();
    } catch (error) {
      if (request !== generation) return;
      status.textContent = 'Не удалось открыть шрифт. Выберите TTF/OTF/WOFF из распакованного архива. ' + error.message;
    }
  });
  text.addEventListener('input', draw);
  new MutationObserver(draw).observe(document.documentElement, {attributes: true, attributeFilter: ['style', 'class']});
  save.addEventListener('click', () => {
    if (!current || save.disabled) return;
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = fileName + '.png'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  });
})();
