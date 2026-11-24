const requests = new Map();

function read(size, name) {
  const key = size + '/' + name;
  if (!requests.has(key)) {
    const url = new URL('data/' + key + '.json', import.meta.url);
    if (size === 512 && name.startsWith('chunk-')) url.searchParams.set('v', '2');
    const request = fetch(url).then(response => {
      if (!response.ok) throw Error('Не удалось загрузить данные атласа.');
      return response.json();
    }).catch(error => {
      requests.delete(key);
      throw error;
    });
    requests.set(key, request);
  }
  return requests.get(key);
}

export const catalogueIndex = size => read(size, 'index');
export const catalogueFrames = size => read(size, 'frames');
export const pngSource = figure => 'data:image/png;base64,' + figure.png;

export async function readFigure(size, offset, index) {
  const chunk = await read(size, 'chunk-' + Math.floor(offset / index.chunkSize));
  const [number, width, height, cells, frame, x, y, png, mirrored = false] = chunk[offset % index.chunkSize] ?? [];
  if (number !== index.ids[offset]) throw Error('Фигура отсутствует в атласе.');
  return { number, width, height, cells, frame, x, y, png, mirrored };
}

export async function catalogueImage(id) {
  const [size, number] = id.split(':').map(Number);
  const index = await catalogueIndex(size);
  const offset = index.ids.indexOf(number);
  if (offset < 0) throw Error('Фигура отсутствует в атласе.');
  return pngSource(await readFigure(size, offset, index));
}
