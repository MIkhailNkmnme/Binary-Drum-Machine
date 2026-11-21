/* Packed templates and atlas figures from the two central-axis collections. */
(function(root, createBank){
  'use strict';
  const recorded = root.MayatnikAxis512Data;
  const recordedAtlas = root.MayatnikAxis512AtlasData;
  const match = recorded?.source?.sha256 && recordedAtlas?.sourceSha256 === recorded.source.sha256
    && recordedAtlas.palette?.join() === recorded.palette.join();
  const generated = root.MayatnikAxis1024Data;
  const banks = [
    createBank(root, recorded, '512', match ? recordedAtlas : null),
    createBank(root, generated, '1024', generated)
  ].filter(Boolean);
  const bankFor = id => banks.find(bank => bank.isId(id));
  root.MayatnikAxisArchive = {
    banks, bankFor,
    isId: id => !!bankFor(id),
    entries: () => banks.flatMap(bank => bank.entries()),
    shape: (id, palette) => bankFor(id)?.shape(id, palette)
  };
})(window,function(root, packed, folder, atlas){
  'use strict';
  if (packed?.version !== 1) return null;

  const folderId = 'folder:axis-' + folder;
  const prefix = 'axis-' + folder;
  const tileSide = 64;
  const sourceCentre = packed.center ?? packed.size[0] / 2;
  const records = new Map();
  const groups = [];
  const number = (value, digits) => String(value).padStart(digits, '0');
  const roles = packed.palette.map(hex => {
    if (hex === '#00008b') return 0;
    if (hex === '#ffe969' || hex === '#ffd700') return 1;
    return -1;
  });

  function addGroup(id, name){
    const group = {id, name, ids: []};
    groups.push(group);
    return group;
  }

  function addRecord(group, id, name, patches, metadata, crop){
    const x = Math.min(...patches.map(part => part.x));
    const y = Math.min(...patches.map(part => part.y));
    const width = Math.max(...patches.map(part => part.x + part.width)) - x;
    const height = Math.max(...patches.map(part => part.y + part.height)) - y;
    const bounds = [x, y, x + width, y + height];
    const counts = [0, 0];
    for (const patch of patches){
      counts[0] += patch.counts[0];
      counts[1] += patch.counts[1];
    }
    records.set(id, {id, name, patches, x, y, width, height, crop, counts,
      source: {...packed.source, bounds, ...metadata}});
    group.ids.push(id);
  }

  if (packed.bands && packed.frames){
    const frameGroup = addGroup(folderId + ':frames', 'Кадры');
    const bands = packed.bands.map(band => {
      const label = number(band.number, 2);
      const group = addGroup(folderId + ':band:' + label, label + ' · ' + band.title);
      const variants = new Map();
      for (const [variant, frame, x, y, width, height, counts, payload] of band.variants){
        const part = {x, y, width, height, counts, payload};
        variants.set(variant, part);
        const variantLabel = number(variant, 3);
        addRecord(group, prefix + ':band:' + label + ':' + variantLabel,
          band.title + ' · ' + variantLabel, [part], {band: band.number, variant, frame}, true);
      }
      return variants;
    });
    for (const [frame, startMs, durationMs, sameAs, refs] of packed.frames){
      const label = number(frame, 3);
      const patches = [];
      refs.forEach((variant, i) => {
        if (variant !== null) patches.push(bands[i].get(variant));
      });
      addRecord(frameGroup, prefix + ':frame:' + label, 'Кадр ' + label, patches,
        {frame, startMs, durationMs, sameAs}, false);
    }
  }

  let atlasGroup = null;
  if (atlas?.version === 1){
    atlasGroup = {id: folderId + ':atlas', name: 'Атлас', ids: []};
    for (let index = 0; index < atlas.records.length; index++){
      const [width, height, counts, payload, occurrences] = atlas.records[index];
      const label = number(index + 1, 3);
      const [frame, x, y] = occurrences[0];
      const patch = {x, y, width, height, counts, payload};
      addRecord(atlasGroup, prefix + ':atlas:' + label, 'Фигура ' + label, [patch],
        {frame, occurrences}, true);
    }
  }

  function colourValue(hex){
    const rgb = Number.parseInt(hex.slice(1), 16);
    const red = rgb >>> 16;
    const green = (rgb >>> 8) & 255;
    const blue = rgb & 255;
    return (0xff000000 | (blue << 16) | (green << 8) | red) >>> 0;
  }

  function overrides(value){
    const result = {};
    for (const key of ['zero', 'one']){
      const hex = value?.[key];
      if (typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex)) result[key] = hex.toLowerCase();
    }
    return result;
  }

  function colourTable(palette){
    return packed.palette.map((hex, index) => {
      if (index === 0) return 0; // Black GIF background is transparent on the field.
      const bit = roles[index];
      const colour = bit === 0 ? palette.zero : bit === 1 ? palette.one : null;
      return colourValue(colour || hex);
    });
  }

  function indexedRaster(record){
    const result = new Uint8Array(record.width * record.height);
    for (const patch of record.patches){
      const runs = root.atob(patch.payload);
      const pixels = new Uint8Array(patch.width * patch.height);
      let offset = 0;
      for (let i = 0; i < runs.length; i++){
        const run = runs.charCodeAt(i);
        const next = offset + (run >>> 3) + 1;
        if (next > pixels.length) throw Error('Повреждён растр шаблона ' + folder);
        pixels.fill(run & 7, offset, next);
        offset = next;
      }
      if (offset !== pixels.length) throw Error('Неполный растр шаблона ' + folder);

      const x = patch.x - record.x;
      const y = patch.y - record.y;
      for (let row = 0; row < patch.height; row++){
        const start = row * patch.width;
        result.set(pixels.subarray(start, start + patch.width), (y + row) * record.width + x);
      }
    }
    return result;
  }

  function axisParts(record, pixels, colours){
    const result = [];
    for (let y = 0; y < record.height; y += tileSide){
      const height = Math.min(tileSide, record.height - y);
      for (let x = 0; x < record.width; x += tileSide){
        const width = Math.min(tileSide, record.width - x);
        const data = new Array(width * height).fill(0);
        const bits = new Array(width * height).fill(-1);
        let occupied = false;
        for (let row = 0; row < height; row++){
          for (let column = 0; column < width; column++){
            const index = pixels[(y + row) * record.width + x + column];
            if (!index) continue;
            occupied = true;
            const position = row * width + column;
            data[position] = colours[index];
            bits[position] = roles[index];
          }
        }
        if (occupied){
          result.push({x: record.x - sourceCentre + x, y: (record.crop ? 0 : record.y) + y,
            width, height, axis: 0, axisOriginY: 0, data, bits});
        }
      }
    }
    return result;
  }

  function shape(id, paletteOverride){
    const record = records.get(id);
    if (!record) return null;
    const palette = overrides(paletteOverride);
    const colours = colourTable(palette);
    const {width, height} = record;
    let pixels, preview, parts;
    const raster = () => pixels ??= indexedRaster(record);
    const part = {width, height, y: record.crop ? 0 : record.y,
      center: record.x - sourceCentre + width / 2,
      get data(){return preview ??= Array.from(raster(), index => colours[index]);}};
    return {
      hex: palette.one || '#ffd700', rk: 1, height: 100, down: 0, x: 0,
      proportional: false, axis512Packed: true,
      axis512Palette: Object.keys(palette).length ? palette : null,
      axis512Tiles: [Math.min(tileSide, width), Math.min(tileSide, height)],
      axis512Counts: record.counts.slice(),
      parts: [part],
      get axisParts(){return parts ??= axisParts(record, raster(), colours);}
    };
  }

  function entries(){
    return (atlasGroup ? [...groups, atlasGroup] : groups).flatMap(group => group.ids.map(id => {
      const record = records.get(id);
      return {id, name: record.name, folder, source: record.source, shape: shape(id)};
    }));
  }

  return {
    folder, folderId, groups, atlasGroup, isId: id => records.has(id), entries, shape,
    occurrences: id => records.get(id)?.source.occurrences || [],
    frameId: frame => prefix + ':frame:' + number(frame, 3),
    sourceFrameHref: packed.source.link
      ? frame => packed.source.link.replace('{frame}', frame)
      : null
  };
});
