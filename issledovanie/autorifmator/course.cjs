const { execFileSync } = require('node:child_process');
const { existsSync, mkdirSync, readFileSync, renameSync, rmdirSync, rmSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');

const repo = resolve(__dirname, '../..');
const file = resolve(__dirname, 'history.json');
const lock = `${file}.lock`;
const pending = `${lock}/history.json`;
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const validText = value => typeof value === 'string' && value.trim().length > 0;

function checkDraft(draft) {
  if (!draft || !Number.isSafeInteger(draft.previous) || draft.previous < 0
      || !validText(draft.title) || !validText(draft.reason) || !validText(draft.next)
      || !Array.isArray(draft.sections) || !draft.sections.length) {
    throw Error('Нужны previous, title, reason, next и хотя бы один раздел.');
  }
  for (const section of draft.sections) {
    if (!section || !validText(section.title) || !Array.isArray(section.links) || !section.links.length) {
      throw Error('В каждом разделе нужны заголовок и хотя бы одна ссылка.');
    }
    for (const link of section.links) {
      if (!link || !validText(link.title) || typeof link.path !== 'string'
          || !/^[\p{L}\p{N}_-][\p{L}\p{N}_.\/-]*\.html$/u.test(link.path)
          || link.path.split('/').some(part => !part || part === '..' || part === '.')) {
        throw Error('У материала должны быть название и путь к HTML-файлу от корня Git.');
      }
    }
  }
}

function advance() {
  const draft = JSON.parse(readFileSync(0, 'utf8').replace(/^\uFEFF/, ''));
  checkDraft(draft);
  try { mkdirSync(lock); }
  catch (error) {
    if (error.code === 'EEXIST') throw Error('История занята другой командой. Повторите после её завершения.');
    throw error;
  }
  try {
    const history = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
    const previous = history.at(-1);
    if (draft.previous !== (previous?.number ?? 0)) {
      throw Error(`Курс уже изменился. Текущая редакция: ${previous?.number ?? 0}.`);
    }
    const snapshot = previous ? git('rev-parse', 'HEAD') : null;
    if (previous) {
      for (const { links } of previous.sections) for (const { path } of links) {
        try { git('cat-file', '-e', `${snapshot}:${path}`); }
        catch (_) { throw Error(`Сначала сохраните материал предыдущего курса в Git: ${path}`); }
        if (git('diff', '--name-only', snapshot, '--', path)) {
          throw Error(`Сначала закоммитьте изменения в материале предыдущего курса: ${path}`);
        }
      }
    }
    const { title, reason, next, sections } = draft;
    const number = draft.previous + 1;
    const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    history.push({ number, date, title, reason, next, sections, snapshot });
    writeFileSync(pending, JSON.stringify(history, null, 2) + '\n');
    renameSync(pending, file);
    console.log(`Открыта редакция ${number} · ${title}`);
    if (snapshot) console.log(`Редакция ${draft.previous} сохранена на ${snapshot}.`);
  } finally {
    rmSync(pending, { force: true });
    rmdirSync(lock);
  }
}

try {
  if (process.argv.slice(2).join(' ') !== 'advance') throw Error('Передайте JSON в stdin: node course.cjs advance');
  advance();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
