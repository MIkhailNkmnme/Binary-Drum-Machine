export function gridFor(width, height, cellWidth, cellHeight) {
  const cap = (value, extent) => Math.max(1, Math.min(Math.floor(value) || 1, Math.ceil(extent / 2)));
  const w = cap(cellWidth, width);
  const h = cap(cellHeight, height);
  return {width: w, height: h, columns: Math.ceil(width / w), rows: Math.ceil(height / h)};
}

export function compareFrames(previous, current, grid, threshold) {
  const {width, height, data} = current;
  const scores = new Float32Array(grid.columns * grid.rows);
  const hasPrevious = previous?.width === width && previous.height === height;
  if (!hasPrevious) return {scores, changed: 0, average: 0, maximum: 0, hasPrevious};

  let changed = 0, sum = 0, maximum = 0;
  for (let row = 0; row < grid.rows; row++) {
    const top = row * grid.height, bottom = Math.min(height, top + grid.height);
    for (let column = 0; column < grid.columns; column++) {
      const left = column * grid.width, right = Math.min(width, left + grid.width);
      let difference = 0;
      for (let y = top; y < bottom; y++) {
        let position = (y * width + left) * 4;
        for (let x = left; x < right; x++, position += 4) {
          difference += Math.abs(data[position] - previous.data[position])
            + Math.abs(data[position + 1] - previous.data[position + 1])
            + Math.abs(data[position + 2] - previous.data[position + 2]);
        }
      }
      const percent = difference * 100 / ((bottom - top) * (right - left) * 765);
      scores[row * grid.columns + column] = percent;
      if (percent > 0 && percent >= threshold) changed++;
      maximum = Math.max(maximum, percent);
      sum += difference;
    }
  }
  return {scores, changed, average: sum * 100 / (width * height * 765), maximum, hasPrevious};
}

export function youtubeVideoId(value) {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    const [, first, second] = url.pathname.split('/');
    const isYouTube = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com'].includes(host);
    const id = host === 'youtu.be' ? first : isYouTube && (first === 'watch' ? url.searchParams.get('v') :
      ['embed', 'shorts', 'live'].includes(first) ? second : '');
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
