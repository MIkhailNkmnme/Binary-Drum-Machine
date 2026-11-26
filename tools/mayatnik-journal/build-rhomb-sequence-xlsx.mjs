import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {SpreadsheetFile, Workbook} from '@oai/artifact-tool';

const [outputDir, dataDirectory, repository] = process.argv.slice(2);
const root = repository || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const {patterns} = require(path.join(root, 'tools/mayatnik-journal/search-rhomb-sequences.cjs'));
const seriesNames = {sizes: 'Обычный ход', contact: 'Разворот'};
const dirs = ['→ Горизонталь', '↓ Вертикаль', '↘ Диагональ', '↙ Диагональ'];
const groupedFrames = [];
const missing = [];
for (const series of ['sizes', 'contact']) {
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'issledovanie/wolfram-nks/romb-gifs', series, 'index.json'), 'utf8'));
  const scanned = new Map();
  for (const line of (await fs.readFile(path.join(dataDirectory, 'seq-' + series + '.ndjson'), 'utf8')).trim().split('\n')) {
    if (!line) continue;
    const frame = JSON.parse(line);
    const key = frame.height + ':' + frame.frame;
    if (frame.series !== series || scanned.has(key)) throw Error('Лишняя запись ' + series + ' ' + key);
    scanned.set(key, frame);
  }
  for (const record of manifest) {
    const frames = [];
    for (const frame of record.frames) {
      const key = record.rows + ':' + frame;
      const result = scanned.get(key);
      if (!result) {
        missing.push(series + ' ' + key);
        continue;
      }
      if (record.width !== result.width) throw Error('Ширина не совпала: ' + key);
      frames.push(result);
      scanned.delete(key);
    }
    groupedFrames.push({series, record, frames});
  }
  if (scanned.size) throw Error('Кадры отсутствуют в манифесте ' + series);
}
const collection = JSON.parse(await fs.readFile(path.join(root, 'issledovanie/image-journal/rhomb-collection/recipes.json'), 'utf8'));
const collectionScan = new Map();
for (const line of (await fs.readFile(path.join(dataDirectory, 'seq-collection.ndjson'), 'utf8')).trim().split('\n')) {
  if (!line) continue;
  const frame = JSON.parse(line);
  const key = frame.series + ':' + frame.frame;
  if (collectionScan.has(key)) throw Error('Повтор кадра коллекции ' + key);
  collectionScan.set(key, frame);
}
for (const record of collection.series) {
  const ids = record.images.map(image => image.frame);
  const frames = [];
  for (const frame of ids) {
    const key = record.id + ':' + frame;
    const result = collectionScan.get(key);
    if (!result) {
      missing.push(key);
      continue;
    }
    frames.push(result);
    collectionScan.delete(key);
  }
  groupedFrames.push({series: record.id, record: {...record, frames: ids}, frames});
}
if (collectionScan.size) throw Error('В расчёте присутствуют неизвестные кадры коллекции.');
if (missing.length) throw Error('Не все кадры рассчитаны: ' + missing.slice(0, 10).join(', '));

console.log('Прочитано серий: ' + groupedFrames.length);
const workbook = Workbook.create();
const matrixSheet = workbook.worksheets.add('Строки 5–70');
const summarySheet = workbook.worksheets.add('Итоги');
const framesSheet = workbook.worksheets.add('Кадры');
const matchesSheet = workbook.worksheets.add('Совпадения');
const patternsSheet = workbook.worksheets.add('Шаблоны');
const colors = {text: '#162F44', navy: '#15354B', teal: '#107C83', pale: '#E5F4F2', white: '#FFFFFF'};
const addCount = (totals, byDirection) => {
  for (const [dir, count] of byDirection) totals[dir] += count;
};

function columnName(index) {
  let label = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    label = String.fromCharCode(65 + (n - 1) % 26) + label;
  }
  return label;
}

function style(sheet, title, note, headers, widths, rows) {
  const last = columnName(headers.length - 1);
  const titleEnd = headers.length > 12 ? 'F' : last;
  sheet.showGridLines = false;
  const titleRange = sheet.getRange('A1:' + titleEnd + '1');
  titleRange.merge();
  sheet.getRange('A1').values = [[title]];
  titleRange.format = {fill: colors.navy, font: {name: 'Arial', size: 16, color: colors.white, bold: true}, rowHeight: 31};
  const noteRange = sheet.getRange('A2:' + titleEnd + '2');
  noteRange.merge();
  sheet.getRange('A2').values = [[note]];
  noteRange.format = {fill: colors.pale, font: {name: 'Arial', color: colors.text}, rowHeight: 27, wrapText: true};

  for (const [i, width] of widths.entries()) {
    const col = columnName(i);
    sheet.getRange(col + ':' + col).format.columnWidthPx = width;
  }
  sheet.getRange('A4:' + last + '4').values = [headers];
  for (let offset = 0; offset < rows.length; offset += 2000) {
    const batch = rows.slice(offset, offset + 2000);
    sheet.getRange('A' + (5 + offset) + ':' + last + (4 + offset + batch.length)).values = batch;
  }
  const table = sheet.tables.add('A4:' + last + (4 + rows.length), true, 'Rhomb_' + ['Строки 5–70', 'Итоги', 'Кадры', 'Совпадения', 'Шаблоны'].indexOf(sheet.name));
  table.style = 'TableStyleMedium2';
  table.showFilterButton = true;
  sheet.getRange('A4:' + last + '4').format = {
    fill: colors.teal, font: {name: 'Arial', color: colors.white, bold: true}, rowHeight: 28, wrapText: true
  };
  sheet.freezePanes.freezeRows(4);
}

const groups = groupedFrames.sort((a, b) => a.record.rows - b.record.rows ||
  Number(Boolean(a.record.group)) - Number(Boolean(b.record.group)) || a.series.localeCompare(b.series));
const summary = [];
const matrix = patterns.map((_, i) => [i + 5]);
const always = [];
const frames = [];
const matches = [];
const patternTotals = patterns.map(() => [0, 0, 0, 0]);
for (const {series, record, frames: sourceFrames} of groups) {
  const seriesName = record.name || seriesNames[series];
  const start = record.first ?? record.start;
  const returned = record.end ?? record.returned;
  const seriesCounts = [0, 0, 0, 0];
  const patternFrames = patterns.map(() => []);
  const nonempty = sourceFrames.filter(({frame}) => frame > 0).length;
  let withMatches = 0;
  let longest = 0;
  for (const {frame, hits} of sourceFrames) {
    const counts = [0, 0, 0, 0];
    const maxLength = hits.at(-1)?.[0] ?? null;
    if (maxLength) {
      withMatches++;
      longest = Math.max(longest, maxLength);
    }
    for (const [index, byDirection] of hits) {
      patternFrames[index - 5].push(frame);
      addCount(counts, byDirection);
      addCount(patternTotals[index - 5], byDirection);
      const lineCounts = [0, 0, 0, 0], addresses = [null, null, null, null];
      for (const [dir, count, sy, sx, ey, ex] of byDirection) {
        lineCounts[dir] = count;
        addresses[dir] = `${sy}:${sx} → ${ey}:${ex}`;
      }
      matches.push([record.rows, seriesName, frame, index, ...lineCounts, ...addresses]);
    }
    for (let dir = 0; dir < 4; dir++) seriesCounts[dir] += counts[dir];
    const phase = record.group ? 'Журнал' : frame < start ? 'До цикла' : frame === returned ? 'Возврат' : 'Цикл';
    frames.push([record.rows, record.width, seriesName, frame, phase, hits.length, maxLength, ...counts]);
  }
  for (const [index, foundFrames] of patternFrames.entries()) {
    const total = foundFrames.length;
    const all = nonempty > 0 && total === nonempty;
    if (all) always.push([index, matrix[index].length]);
    matrix[index].push(total ? `${all ? 'Всегда · ' : ''}${total} из ${nonempty}\n${formatFrames(foundFrames)}` : '—');
  }
  summary.push([record.rows, record.width, seriesName, record.frames.length, sourceFrames.length, withMatches,
    ...seriesCounts, longest || null, null]);
}

function formatFrames(found) {
  const spans = [];
  for (let i = 0; i < found.length; i++) {
    const start = found[i];
    while (i + 1 < found.length && found[i + 1] === found[i] + 1) i++;
    spans.push(start === found[i] ? String(start) : `${start}–${found[i]}`);
  }
  return spans.join(', ');
}

const matrixHeaders = ['Строка', ...groups.map(({series, record}) => `${record.rows} · ${record.name || seriesNames[series]}`)];
style(matrixSheet, 'Где найдены строки 5–70',
  'В ячейках все номера кадров. «Всегда» означает каждый проверенный кадр с битами. Кадр 0 исключён. Длинный список виден целиком в строке формул.',
  matrixHeaders, [84, ...groups.map(() => 235)], matrix);
const matrixLast = columnName(groups.length);
const matrixCells = matrixSheet.getRange('A5:' + matrixLast + (matrix.length + 4));
matrixCells.format.wrapText = true;
matrixCells.format.verticalAlignment = 'top';
for (const [i, cells] of matrix.entries()) {
  const wrapped = Math.max(0, ...cells.slice(1).map(cell => cell === '—' ? 0 : Math.ceil(cell.length / 32)));
  const row = i + 5;
  matrixSheet.getRange('A' + row + ':' + matrixLast + row).format.rowHeight =
    Math.min(96, Math.max(20, (wrapped + 1) * 14));
}
for (const [row, col] of always) {
  matrixSheet.getRange(columnName(col) + (row + 5)).format.fill = '#BAE6D4';
}
matrixSheet.freezePanes.freezeRows(4);
matrixSheet.freezePanes.freezeColumns(1);
const matrixNoteRow = matrix.length + 7;
const matrixNote = matrixSheet.getRange('A' + matrixNoteRow + ':F' + matrixNoteRow);
matrixNote.merge();
matrixSheet.getRange('A' + matrixNoteRow).values = [['Длинный список целиком виден в строке формул. Направления, счётчики и адреса вынесены в «Совпадения».']];

const patternRows = patterns.map((pattern, i) => [i + 5, pattern, ...patternTotals[i], null]);
style(summarySheet, 'Поиск строк 5–70 в Ромбовом Маятнике',
  `${frames.length} исходных кадров. Проверены 20 GIF и 30 серий цветной коллекции. Пустые клетки разрывают линию.`,
  ['Высота N', 'Ширина W', 'Серия', 'Кадров в серии', 'Проверено', 'Кадры с находками', ...dirs, 'Макс. №', 'Всего совпадений'],
  [85, 90, 232, 112, 90, 120, 120, 112, 104, 104, 80, 130], summary);
style(framesSheet, 'Кадры · четыре направления',
  'Указан номер исходного кадра Маятника. Нули означают, что на кадре нет совпадений в этом направлении.',
  ['Высота N', 'Ширина W', 'Серия', 'Кадр', 'Часть', 'Шаблонов найдено', 'Макс. №', ...dirs],
  [85, 90, 232, 110, 115, 130, 92, 120, 115, 110, 110], frames);
style(matchesSheet, 'Совпадения по кадру и шаблону',
  'Первый адрес в формате строка:столбец → строка:столбец. Нумерация от 1. Пропущенный шаблон означает 0 совпадений.',
  ['Высота N', 'Серия', 'Кадр', '№ шаблона', '→ Число', '↓ Число', '↘ Число', '↙ Число',
    '→ Первый адрес', '↓ Первый адрес', '↘ Первый адрес', '↙ Первый адрес'],
  [84, 232, 112, 95, 80, 80, 80, 80, 185, 185, 185, 185], matches);
style(patternsSheet, 'Начальная последовательность',
  'Источник — _js/initial-rows.js, штатная последовательность Маятника. № строки равен её длине в битах. Искомый текст сохранён целиком.',
  ['№ строки', 'Шаблон', ...dirs, 'Всего'], [88, 640, 118, 112, 105, 105, 120], patternRows);

summarySheet.getRange('G5:J' + (summary.length + 4)).setNumberFormat('#,##0');
summarySheet.getRange('L5:L' + (summary.length + 4)).formulas =
  summary.map((_, i) => [`=SUM(G${i + 5}:J${i + 5})`]);
summarySheet.getRange('L5:L' + (summary.length + 4)).setNumberFormat('#,##0');
patternsSheet.getRange('B5:B' + (patternRows.length + 4)).setNumberFormat('@');
patternsSheet.getRange('B5:B' + (patternRows.length + 4)).format.font = {name: 'Liberation Mono', size: 11};
patternsSheet.getRange('C5:G' + (patternRows.length + 4)).setNumberFormat('#,##0');
patternsSheet.getRange('G5:G' + (patternRows.length + 4)).formulas =
  patternRows.map((_, i) => [`=SUM(C${i + 5}:F${i + 5})`]);

const noteRow = 5 + summary.length + 2;
for (const [offset, text] of [
  [0, 'Режимы двух опубликованных серий · XOR, ширина 2N−1, перескок. У второй серии включён разворот на последнем касании.'],
  [1, 'Шаг по клеткам как в «Очках» · → через столбец, ↓ через строку, ↘ и ↙ по соседней диагонали. Ищется исходная запись шаблона.'],
  [2, 'Крупные GIF содержат выборку. Поиск выполнен по точным исходным битам каждого сохранённого кадра, включая кадры возле возврата.'],
  [3, 'Цветная коллекция · 30 видов и 300 снимков. В квадратных проекциях биты проверены на решётке до поворота.'],
]) {
  const range = summarySheet.getRange('A' + (noteRow + offset) + ':L' + (noteRow + offset));
  range.merge();
  range.format = {fill: colors.pale, font: {name: 'Arial', color: colors.text}, rowHeight: 24};
  summarySheet.getRange('A' + (noteRow + offset)).values = [[text]];
}

workbook.recalculate();
for (const [sheet, scope] of [[summarySheet, 'G5:L' + (summary.length + 4)],
                              [patternsSheet, 'C5:G' + (patternRows.length + 4)]]) {
  const check = await workbook.inspect({
    kind: 'match', sheetId: sheet.name, range: scope,
    searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',
    options: {useRegex: true, maxResults: 20}, summary: 'Проверка формул',
  });
  console.log(check.ndjson);
}
const total = patternTotals.flat().reduce((a, b) => a + b, 0);
const summaryTotal = summarySheet.getRange('L5:L' + (summary.length + 4)).values.flat().reduce((a, b) => a + b, 0);
const patternsTotal = patternsSheet.getRange('G5:G' + (patternRows.length + 4)).values.flat().reduce((a, b) => a + b, 0);
if (summaryTotal !== total || patternsTotal !== total || patternsSheet.getRange('B5').values[0][0] !== '10101') {
  throw Error('Итоги книги или исходная строка 5 не сошлись.');
}
await fs.mkdir(outputDir, {recursive: true});
for (const [i, [sheet, range]] of [
  [matrixSheet, 'A1:F9'], [summarySheet, 'A1:L13'], [framesSheet, 'A1:K12'],
  [matchesSheet, 'A1:L12'], [patternsSheet, 'A1:G12']
].entries()) {
  const preview = await workbook.render({sheetName: sheet.name, range, scale: 1});
  await fs.writeFile(path.join(dataDirectory, 'sheet-' + i + '.png'), new Uint8Array(await preview.arrayBuffer()));
}
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(path.join(outputDir, 'romb-sequences.xlsx'));
console.log(JSON.stringify({frames: frames.length, patternFrames: matches.length, total, always: always.length,
  maxPattern: Math.max(...summary.map(row => row[10] || 0)), directions: patternTotals.reduce((sums, row) => sums.map((v, i) => v + row[i]), [0,0,0,0])}));
