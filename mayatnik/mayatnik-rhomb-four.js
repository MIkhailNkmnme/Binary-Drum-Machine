(() => {
  'use strict';

  const palette = new Uint32Array(Uint8Array.from([
    33, 98, 126, 255, 225, 242, 236, 255,
    129, 80, 172, 255, 240, 207, 255, 255,
    49, 119, 93, 255, 172, 242, 183, 255,
    155, 96, 30, 255, 255, 218, 138, 255
  ]).buffer);
  const verticalPalette = new Uint32Array(Uint8Array.from([17, 110, 114, 255, 198, 248, 206, 255]).buffer);

  function enableZoom(canvas, vertical, width, height) {
    const viewport = canvas.parentElement;
    let scale = 1, x = 0, y = 0;

    function position() {
      const {width: w, height: h} = viewport.getBoundingClientRect();
      if (!w || !h) return;
      const fit = Math.min(w / width, h / height);
      const uprightFit = vertical.hidden ? 0 : Math.min(w / height, h / width);
      const maxX = Math.max(0, (Math.max(width * fit, height * uprightFit) * scale - w) / 2);
      const maxY = Math.max(0, (Math.max(height * fit, width * uprightFit) * scale - h) / 2);
      x = Math.max(-maxX, Math.min(maxX, x));
      y = Math.max(-maxY, Math.min(maxY, y));
      canvas.style.transform = vertical.style.transform = scale === 1 ? '' : `translate(${x}px, ${y}px) scale(${scale})`;
    }

    function zoom(next, pointX = x, pointY = y) {
      next = Math.max(1, Math.min(24, next));
      const ratio = next / scale;
      x = pointX - (pointX - x) * ratio;
      y = pointY - (pointY - y) * ratio;
      scale = next;
      position();
    }

    viewport.addEventListener('wheel', event => {
      if (!event.deltaY) return;
      event.preventDefault();
      const bounds = viewport.getBoundingClientRect();
      zoom(scale * (event.deltaY < 0 ? 1.25 : .8),
        event.clientX - bounds.left - bounds.width / 2, event.clientY - bounds.top - bounds.height / 2);
    }, {passive: false});
    viewport.addEventListener('keydown', event => {
      if (!['+', '=', '-', '−', '0', 'Home'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === '0' || event.key === 'Home') zoom(1);
      else zoom(scale * (event.key === '+' || event.key === '=' ? 1.25 : .8));
    });
    canvas.addEventListener('pointerdown', () => viewport.focus({preventScroll: true}));
    viewport.tabIndex = 0;
    viewport.setAttribute('role', 'region');
    viewport.setAttribute('aria-label', 'Четыре треугольника. Колесо меняет масштаб, клавиша 0 вписывает поле.');
    canvas.title = 'Колесо — масштаб к курсору. 0 — вписать. Двойной щелчок — пауза или продолжение.';
    new ResizeObserver(position).observe(viewport);
    return position;
  }

  function createVertical(canvas, W, H) {
    canvas.width = H;
    canvas.height = W;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const image = context.createImageData(H, W);
    const pixels = new Uint32Array(image.data.buffer);

    return function renderVertical(values, centers, marks) {
      pixels.fill(0);
      for (const center of centers) {
        for (let row = 0; row < H; row++) {
          const radius = Math.min(row, H - 1 - row);
          const end = Math.min(W - 1, center + radius);
          for (let column = Math.max(0, center - radius); column <= end; column++) {
            const source = row * W + column;
            const bit = values[source];
            const colour = marks?.[source] || 0;
            if (bit >= 0 || colour) pixels[column * H + H - 1 - row] = colour
              ? palette[colour * 2 + Number(bit === 1)] : verticalPalette[bit];
          }
        }
      }
      context.putImageData(image, 0, 0);
      context.lineWidth = 3;
      for (let branch = 0; branch < centers.length; branch++) {
        const center = centers[branch] + 0.5;
        const radius = H / 2 - 0.5;
        context.strokeStyle = branch ? '#8ae0ac' : '#c288ef';
        context.beginPath();
        context.moveTo(H - 0.5, center);
        context.lineTo(H / 2, center - radius);
        context.lineTo(0.5, center);
        context.lineTo(H / 2, center + radius);
        context.closePath();
        context.stroke();
      }
    };
  }

  function create(canvas, vertical, W, H) {
    canvas.width = W;
    canvas.height = H;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const position = enableZoom(canvas, vertical, W, H);
    const image = context.createImageData(W, H);
    const pixels = new Uint32Array(image.data.buffer);
    const labels = new Uint16Array(W * H);
    const marks = new Uint8Array(labels.length);
    const queue = new Int32Array(labels.length);
    let renderVertical;

    function hasAxis(count, label, left, top, right, bottom) {
      const width = right - left + 1;
      const height = bottom - top + 1;
      for (let axis = 0; axis < (width === height ? 4 : 2); axis++) {
        let i = 0;
        for (; i < count; i++) {
          const p = queue[i];
          const x = p % W;
          const y = Math.floor(p / W);
          const reflected = axis === 0 ? y * W + left + right - x
            : axis === 1 ? (top + bottom - y) * W + x
              : axis === 2 ? (top + x - left) * W + left + y - top
                : (bottom - x + left) * W + right - y + top;
          if (labels[reflected] !== label) break;
        }
        if (i === count) return true;
      }
      return false;
    }

    function colourAxes(values, leftCenter, rightCenter) {
      labels.fill(0);
      marks.fill(0);
      const centers = [leftCenter, rightCenter];
      let label = 0;
      for (let row = 0; row < H; row++) {
        for (const center of centers) {
          const seed = row * W + center;
          const bit = values[seed];
          if (bit < 0 || labels[seed]) continue;
          let count = 1;
          let left = W, top = H, right = 0, bottom = 0, branch = 0;
          queue[0] = seed;
          labels[seed] = ++label;
          for (let cursor = 0; cursor < count; cursor++) {
            const p = queue[cursor];
            const x = p % W;
            const y = Math.floor(p / W);
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x);
            bottom = Math.max(bottom, y);
            if (x === leftCenter) branch |= 1;
            if (x === rightCenter) branch |= 2;
            for (let ny = Math.max(0, y - 1); ny <= Math.min(H - 1, y + 1); ny++) {
              for (let nx = Math.max(0, x - 1); nx <= Math.min(W - 1, x + 1); nx++) {
                const neighbor = ny * W + nx;
                if (labels[neighbor] || values[neighbor] !== bit) continue;
                labels[neighbor] = label;
                queue[count++] = neighbor;
              }
            }
          }
          if (count >= 4 && hasAxis(count, label, left, top, right, bottom)) {
            for (let i = 0; i < count; i++) marks[queue[i]] = branch;
          }
        }
      }
      for (let row = 0; row < H; row++) {
        marks[row * W + leftCenter] |= 1;
        marks[row * W + rightCenter] |= 2;
      }
    }

    function render(field, leftCenter, rightCenter, coloured, upright) {
      if (coloured) colourAxes(field.val, leftCenter, rightCenter);
      pixels.fill(0);
      const middle = H / 2 - 1;
      for (let row = 0; row < H; row++) {
        const radius = Math.min(row, H - 1 - row);
        for (let side = 0; side < 2; side++) {
          const center = side ? rightCenter : leftCenter;
          const target = row * W + side * H + middle;
          const origin = row * W + center;
          for (let offset = Math.max(-radius, -center); offset <= Math.min(radius, W - 1 - center); offset++) {
            const source = origin + offset;
            const bit = field.val[source];
            const mark = coloured ? marks[source] : 0;
            if (bit >= 0 || mark) pixels[target + offset] = palette[mark * 2 + Number(bit === 1)];
          }
        }
      }
      context.putImageData(image, 0, 0);
      context.strokeStyle = '#708997';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, H / 2 + 0.5);
      context.lineTo(W, H / 2 + 0.5);
      context.stroke();
      if (coloured) {
        context.lineWidth = 2.5;
        context.strokeStyle = '#c288ef';
        context.beginPath();
        context.moveTo(middle + 0.5, 0);
        context.lineTo(middle + 0.5, H);
        context.stroke();
        context.strokeStyle = '#8ae0ac';
        context.beginPath();
        context.moveTo(H + middle + 0.5, 0);
        context.lineTo(H + middle + 0.5, H);
        context.stroke();
      }
      if (upright) {
        renderVertical ||= createVertical(vertical, W, H);
        renderVertical?.(field.val, [leftCenter, rightCenter], coloured ? marks : null);
      }
      if (vertical.hidden === upright) {
        vertical.hidden = !upright;
        position();
      }
    }

    return {render};
  }

  window.MayatnikRhombFour = {create};
})();
