'use strict';

importScripts('../mayatnik-core.js', '../mayatnik-construction.js',
  '../mayatnik-axis-cone-bits.js?v=1', '../mayatnik-scale-stack-view.js?v=1031', 'source.js?v=2');

const {phasePlan, phaseSourceIndex} = MayatnikScaleStackView;
const {create, sample, pageSize, LARGE_ROWS} = MayatnikScaleAtlasSource;
const frames = create(MAYATNIK, MayatnikConstruction, () => {
  if (!self.MayatnikAxisArchive) {
    self.window = self;
    importScripts('../mayatnik-axis-512-data.js?v=1087', '../mayatnik-axis-512.js?v=1092');
  }
  return {size: MayatnikAxis512Data.size, bank: MayatnikAxisArchive};
}, MayatnikAxisConeBits);

self.onmessage = ({data: {id, rows, frame, factor, page}}) => {
  try {
    const source = frames.read(rows, frame);
    const compact = rows >= LARGE_ROWS;
    const plan = phasePlan(source.width, source.height, factor, page, compact ? pageSize(source, factor, true) : 32);
    const items = plan.items.map(item => sample(source, item, phaseSourceIndex, compact));
    self.postMessage({id, plan: {...plan, items}}, items.map(item => item.raster.buffer));
  } catch (error) {
    self.postMessage({id, error: error.message || String(error)});
  }
};
