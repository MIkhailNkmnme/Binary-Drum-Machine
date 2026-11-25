'use strict';

const {writeFileSync} = require('node:fs');
const {join} = require('node:path');
const {createPackedRhomb} = require('./rhomb-packed.cjs');

function contactPeriod(rows) {
  const model = createPackedRhomb(rows, {reverseAtContact: true});
  const witness = model.contactWitness();
  if (!witness) throw Error('Половина интервала не различается по вычисленной строке: ' + rows);
  const width = model.width;
  const start = rows;
  const contactEvery = 2 * (rows - 1);
  const routePeriod = 2 * contactEvery;
  const period = routePeriod * rows / 2;
  return {rows, width, start, contactEvery, routePeriod, period, returned: start + period,
    halfway: {frame: start + period / 2, row: witness.row + 1, column: witness.column + 1}};
}

function writeStudy(path = join(__dirname, '../../issledovanie/wolfram-nks/romb-contact.json')) {
  const sizes = Array.from({length: 10}, (_, i) => contactPeriod(2 ** (i + 3)));
  writeFileSync(path, JSON.stringify({reverseAtContact: true, sizes}, null, 2) + '\n');
  return sizes;
}

if (require.main === module) console.table(writeStudy(process.argv[2]));
module.exports = {contactPeriod, writeStudy};
