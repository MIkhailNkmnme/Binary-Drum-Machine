/* Hub image v0.002: local picture source and freshly rendered high-resolution PNG. */
(() => {
  'use strict';
  let picture = null, revision = 0, pending = 0, status, restore;
  const changed = () => {
    revision++;
    document.body.classList.toggle('hubPictureMode', !!picture);
    if (restore) restore.hidden = !picture;
    window.dispatchEvent(new Event('hubimage'));
  };
  const clear = () => { pending++; picture = null; changed(); if (status) status.textContent = 'Треугольник'; };
  window.HubImage = {
    get active() { return !!picture; },
    get revision() { return revision; },
    draw(g, left, width, height) {
      if (!picture) return;
      const scale = Math.min(width / picture.naturalWidth, height / picture.naturalHeight);
      const w = picture.naturalWidth * scale, h = picture.naturalHeight * scale;
      g.save(); g.globalAlpha = 1; g.shadowBlur = 0; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(picture, left + (width - w) / 2, (height - h) / 2, w, h); g.restore();
    }
  };
  function init() {
    const settings = document.querySelector('.hubMirrorSettings'); if (!settings) return;
    const tools = document.createElement('div'); tools.className = 'hubImageTools';
    tools.addEventListener('click', e => e.stopPropagation());
    const file = document.createElement('input'); file.type = 'file'; file.accept = 'image/*'; file.hidden = true;
    const upload = document.createElement('button'); upload.type = 'button'; upload.className='hubRhomb';upload.textContent='↑▧';upload.setAttribute('aria-label','Загрузить картинку');
    upload.title = 'Своя картинка вместо треугольника; зеркало отражает её целиком'; upload.onclick = () => file.click();
    restore = document.createElement('button'); restore.type = 'button'; restore.className='hubRhomb';restore.textContent='△';restore.title='Вернуть треугольник';restore.setAttribute('aria-label',restore.title); restore.hidden = true; restore.onclick = clear;
    const label = document.createElement('label'), size = document.createElement('select'); label.className='hubRhomb';label.title='Разрешение PNG';label.append(size);
    size.setAttribute('aria-label', 'Разрешение PNG по длинной стороне');
    for (const [value, text] of [[2048, '2K'], [4096, '4K'], [8192, '8K']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = text; size.append(option);
    }
    size.value = '4096';
    const download = document.createElement('button'); download.type = 'button'; download.id='hubPNG';download.textContent='PNG';download.setAttribute('aria-label','Скачать снимок PNG');
    download.title = 'Чёткий рисунок с отражением и светом, без кнопок и ручек зеркала';
    status = document.createElement('div'); status.className = 'hubImageStatus'; status.setAttribute('role', 'status'); status.textContent = 'PNG: длинная сторона 4096 px';
    size.onchange = () => { status.textContent = 'PNG: длинная сторона ' + size.value + ' px'; };
    file.addEventListener('change', async () => {
      const selected = file.files[0]; file.value = ''; if (!selected) return;
      const ticket = ++pending, url = URL.createObjectURL(selected), image = new Image();
      status.textContent = 'Загрузка…';
      try {
        await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
        if (ticket !== pending) return;
        if (!image.naturalWidth || !image.naturalHeight) throw new Error('empty');
        picture = image; changed(); status.textContent = selected.name + ' · ' + image.naturalWidth + '×' + image.naturalHeight;
      } catch (_) { if (ticket === pending) status.textContent = 'Не удалось прочитать картинку. Попробуй PNG, JPG или WebP.'; }
      finally { URL.revokeObjectURL(url); }
    });
    download.onclick = async () => {
      download.disabled = true; status.textContent = 'Рисую PNG…';
      let canvas;
      try {
        canvas = window.hubRenderPNG(Number(size.value));
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('encode');
        const url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = 'Zerkalius-' + (picture ? 'picture' : window.HubMirror.state.pattern) + '-' + canvas.width + 'x' + canvas.height + '-' + Date.now() + '.png';
        document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
        status.textContent = 'PNG · ' + canvas.width + '×' + canvas.height;
      } catch (_) { status.textContent = 'Не удалось сохранить PNG. Попробуй меньшее разрешение.'; }
      finally { if (canvas) { canvas.width = 0; canvas.height = 0; } download.disabled = false; }
    };
    tools.append(upload, file, restore, label, status); settings.append(tools); document.body.append(download);
    window.addEventListener('hubpattern', clear);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
