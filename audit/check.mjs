import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const directory = fileURLToPath(new URL('.', import.meta.url));
const root = fileURLToPath(new URL('..', import.meta.url));
const reports = join(directory, 'reports');
const { values } = parseArgs({ options: {
  base: { type: 'string' },
  channel: { type: 'string', default: 'chrome' },
  workers: { type: 'string', default: '2' },
  tree: { type: 'string' },
} });
const workers = Number(values.workers);
if (!Number.isInteger(workers) || workers < 1 || workers > 4) {
  throw new Error('--workers: ожидается число от 1 до 4');
}
const hostname = (await readFile(join(root, 'CNAME'), 'utf8')).trim();
const base = new URL(values.base ?? `https://${hostname}/`);
if (!['http:', 'https:'].includes(base.protocol) || base.pathname !== '/' || base.search || base.hash) {
  throw new Error('--base: ожидается HTTP(S)-адрес в корне сайта');
}
const profiles = [
  ['ПК', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }],
  ['390 px', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }],
];
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
const remoteTree = values.tree ? JSON.parse(await readFile(values.tree, 'utf8')) : null;
if (remoteTree && (remoteTree.truncated !== false || !/^[\da-f]{40}$/.test(remoteTree.sha) || !Array.isArray(remoteTree.tree))) {
  throw new Error('--tree: ожидается полный рекурсивный ответ GitHub Git Trees API');
}
const commit = remoteTree?.sha ?? git('rev-parse', 'HEAD').trim();
const tree = new Map(remoteTree
  ? remoteTree.tree.filter(entry => entry.type === 'blob').map(entry => [entry.path, entry.sha])
  : git('ls-tree', '-rz', commit).split('\0').filter(Boolean).flatMap(entry => {
    const tab = entry.indexOf('\t');
    const [, type, sha] = entry.slice(0, tab).split(' ');
    return type === 'blob' ? [[entry.slice(tab + 1), sha]] : [];
  }));
const html = /\.html?$/i;
const pages = [...tree.keys()].filter(file => html.test(file)).sort();
if (!pages.length) throw new Error('В снимке Git отсутствуют HTML-страницы');
const untracked = git('ls-files', '--others', '--exclude-standard', '-z').split('\0').filter(file => html.test(file));
const dirty = Boolean(git('status', '--porcelain', '--untracked-files=no').trim());
const slug = file => file.replace(/(^|\/)index\.html$/, '$1').split('/').map(encodeURIComponent).join('/');
const route = file => new URL(slug(file), base).href;
const paths = new Set([...tree.keys()].map(file => new URL(file.split('/').map(encodeURIComponent).join('/'), base).pathname));
const blobHash = buffer => createHash('sha1').update(`blob ${buffer.length}\0`).update(buffer).digest('hex');
function matchesBlob(body, expected) {
  if (blobHash(body) === expected) return true;
  const lf = body.toString('utf8').replaceAll('\r\n', '\n');
  return [lf, lf.replaceAll('\n', '\r\n')].some(text => blobHash(Buffer.from(text)) === expected);
}
const cell = s => String(s).replaceAll('|', '\\|').replace(/\s+/g, ' ').trim();
const compactUrl = address => address.startsWith(base.origin + '/') ? address.slice(base.origin.length) : address;
const size = bytes => (bytes / 1024).toFixed(0);
const dedupe = entries => [...new Set(entries)];

async function inspect(browser, file, name, options) {
  const url = route(file);
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const issues = [];
  const notes = [];
  const result = { name, issues, notes };
  page.on('pageerror', error => issues.push(`JavaScript: ${error.message}`));
  page.on('console', entry => {
    if (entry.type() !== 'error' || entry.text().startsWith('Failed to load resource:')) return;
    const location = entry.location().url;
    issues.push(`Консоль: ${entry.text()}${location ? ` (${compactUrl(location)})` : ''}`);
  });
  page.on('response', response => {
    if (response.status() >= 400) {
      issues.push(`HTTP ${response.status()} (${response.request().resourceType()}): ${compactUrl(response.url())}`);
    }
  });
  page.on('requestfailed', request => {
    const reason = request.failure()?.errorText;
    if (reason !== 'net::ERR_ABORTED') issues.push(`Сеть ${reason}: ${compactUrl(request.url())}`);
  });
  await page.addInitScript(() => {
    window.auditLongTasks = [];
    try {
      new PerformanceObserver(list => {
        window.auditLongTasks.push(...list.getEntries().map(entry => entry.duration));
      }).observe({ type: 'longtask', buffered: true });
    } catch {
      window.auditLongTasks = null;
    }
  });
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    result.http = response?.status();
    const originalBody = response?.ok() && response.url() === url
      ? Promise.race([response.body().catch(() => null), delay(8000, null, { ref: false })])
      : null;
    try {
      await page.waitForLoadState('load', { timeout: 12000 });
    } catch {
      result.incomplete = true;
      notes.push('Событие load не дождалось таймаута 12 с после DOMContentLoaded');
    }
    await delay(900);
    if (page.url() !== url) result.redirect = compactUrl(page.url());
    if (originalBody) {
      const body = await originalBody;
      if (body) {
        result.matches = matchesBlob(body, tree.get(file));
        if (!result.matches) notes.push('HTML ответа отличается от снимка Git');
      } else if (result.redirect) {
        notes.push('Сверка HTML старого адреса пропущена после перехода');
      } else {
        result.incomplete = true;
        issues.push('Браузер не вернул тело начального HTML для сверки');
      }
    }
    const capture = await Promise.race([
      page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        const resources = performance.getEntriesByType('resource');
        const entries = nav ? [nav, ...resources] : resources;
        const sum = property => entries.reduce((total, resource) => total + resource[property], 0);
        return {
          title: document.title,
          inner: innerWidth,
          scroll: document.documentElement.scrollWidth,
          links: [...document.querySelectorAll('a[href], area[href]')].flatMap(link => {
            try {
              return [new URL(link.getAttribute('href'), link.baseURI).href];
            } catch {
              return [];
            }
          }),
          requests: entries.length,
          transfer: sum('transferSize'),
          hiddenSizes: resources.filter(item => !item.transferSize && !item.encodedBodySize &&
            /^https?:/.test(item.name) && new URL(item.name).origin !== location.origin).length,
          dom: nav?.domContentLoadedEventEnd,
          load: nav?.loadEventEnd,
          long: window.auditLongTasks?.length,
          longest: Math.max(0, ...(window.auditLongTasks ?? [])),
          largest: entries.filter(item => item.transferSize > 250 * 1024)
            .sort((a, b) => b.transferSize - a.transferSize)
            .slice(0, 3).map(item => [item.name, item.transferSize]),
        };
      }),
      delay(8000, null, { ref: false }),
    ]);
    if (!capture) throw new Error('Таймаут чтения состояния страницы (8 с)');
    Object.assign(result, capture);
    if (name === '390 px' && result.inner > 410) notes.push(`Мобильный layout viewport ${result.inner} px`);
    if (result.scroll > result.inner + 2) notes.push(`Горизонтальный скролл ${result.scroll} / ${result.inner} px`);
    if (result.largest.length) {
      notes.push(`Крупные ресурсы: ${result.largest.map(([address, bytes]) => `${compactUrl(address)} (${size(bytes)} КиБ)`).join(', ')}`);
    }
  } catch (error) {
    result.incomplete = true;
    issues.push(`Прогон прерван: ${error.message.split('\n')[0]}`);
  } finally {
    await context.close();
  }
  return result;
}

function brokenLinks(links) {
  return dedupe(links.flatMap(address => {
    const url = new URL(address);
    if (url.origin !== base.origin) return [];
    let path;
    try {
      path = url.pathname.split('/').map(part => encodeURIComponent(decodeURIComponent(part))).join('/');
    } catch {
      return [`Некорректно закодирована внутренняя ссылка: ${compactUrl(address)}`];
    }
    if (paths.has(path) || paths.has(path.replace(/\/?$/, '/index.html'))) return [];
    return [`Внутренняя ссылка отсутствует в дереве Git: ${compactUrl(address)}`];
  }));
}

await mkdir(reports, { recursive: true });
const time = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'medium',
}).format(new Date());
const originKey = base.href === `https://${hostname}/` ? 'site' : 'local';
const name = `${time.replace(' ', '_').replaceAll(':', '-')}-${originKey}.md`;
const earlier = (await readdir(reports)).filter(file => file.endsWith(`-${originKey}.md`)).sort().at(-1);
const earlierText = earlier ? await readFile(join(reports, earlier), 'utf8') : '';
const earlierPages = new Set([...earlierText.matchAll(/^<!-- audit-page: (.+) -->$/gm)].map(match => match[1]));
const newPages = earlier ? pages.filter(file => !earlierPages.has(file)) : [];
const removedPages = [...earlierPages].filter(file => !pages.includes(file));
const browser = await chromium.launch({ channel: values.channel, headless: true });
const browserVersion = browser.version();
const results = new Array(pages.length);
let cursor = 0;
let done = 0;
try {
  await Promise.all(Array.from({ length: Math.min(pages.length, workers) }, async () => {
    while (cursor < pages.length) {
      const index = cursor++;
      const file = pages[index];
      const views = [];
      for (const [label, options] of profiles) views.push(await inspect(browser, file, label, options));
      const links = brokenLinks(views.flatMap(view => view.links ?? []));
      results[index] = { file, views, links };
      console.log(`[${++done}/${pages.length}] ${file} — ${views.map(view => view.http ?? 'таймаут').join('/')}`);
    }
  }));
} finally {
  await browser.close();
}

const hasIssues = row => row.links.length || row.views.some(view => view.issues.length || view.incomplete || view.matches === false);
const incomplete = row => row.views.some(view => view.incomplete);
const count = predicate => results.filter(predicate).length;
const metrics = view => view.requests == null ? '—' : [
  view.dom ? `${Math.round(view.dom)}/${Math.round(view.load) || '—'}` : '—',
  size(view.transfer),
  view.requests,
  view.long == null ? '—' : `${view.long}/${Math.round(view.longest)}`,
].join(' · ');
const lines = [
  `# Проверка страниц Зеркалиуса · ${time} МСК`, '',
  `- Адрес ${base.href} · ${remoteTree ? 'снимок GitHub' : 'коммит Git'} \`${commit}\` · Chrome/Chromium ${browserVersion} · потоков ${workers}.`,
  `- Страниц в прогоне ${results.length}, с сигналами об ошибках ${count(hasIssues)}, с незавершённым браузерным проходом ${count(incomplete)}. Ручные сценарии ожидают проверки.`,
  `- Совпадение HTML с Git на обоих экранах ${count(row => row.views.every(view => view.matches === true))}/${results.length}. Перенаправления и незавершённые загрузки рассматриваются отдельно.`,
  earlier ? `- Предыдущий отчёт [${earlier}](${earlier}). Новые (${newPages.length}) ${newPages.join(', ') || '—'}. Удалённые (${removedPages.length}) ${removedPages.join(', ') || '—'}.`
    : '- Первый отчёт для этой среды. Все строки образуют исходный реестр.',
  dirty && !remoteTree ? '- Есть изменённые отслеживаемые файлы. Сравнение HTML и ссылки проверены по снимку HEAD.' : '',
  untracked.length ? `- HTML вне Git, ожидают включения в коммит и прогон: ${untracked.join(', ')}.` : '',
  '', 'Показатели в колонках экрана по порядку: DOM/load (мс) · передано (КиБ) · записей Resource Timing с HTML · длинные задачи (число/макс. мс). Один холодный запуск на профиль, без ограничения скорости и замедления CPU. Переданный объём может быть занижен из-за внешних ресурсов без доступных таймингов. Первичную оценку следует перепроверять в одном потоке.',
  '', '| Страница | ПК | 390 px | Браузер | Ручной сценарий |',
  '|---|---:|---:|---|---|',
];
const details = ['','## Диагностика по страницам',''];
for (const row of results) {
  const { file, views, links } = row;
  const status = incomplete(row) ? 'Неполный' : hasIssues(row) ? 'Есть сигналы' : 'Старт пройден';
  lines.push(`| [${cell(file)}](${route(file)})${newPages.includes(file) ? ' **новая**' : ''} | ${metrics(views[0])} | ${metrics(views[1])} | ${status} | Ожидает |`);
  const messages = new Map();
  for (const view of views) {
    const evidence = [...view.issues, ...view.notes];
    if (view.redirect) evidence.push(`Переход на ${view.redirect}`);
    if (view.hiddenSizes) evidence.push(`Внешние ресурсы со скрытым размером: ${view.hiddenSizes}`);
    for (const item of dedupe(evidence)) {
      if (!messages.has(item)) messages.set(item, []);
      messages.get(item).push(view.name);
    }
  }
  for (const link of links) messages.set(link, []);
  if (messages.size) {
    details.push(`### ${file}`, '');
    for (const [message, seen] of messages) details.push(`- ${seen.length ? `[${seen.join(', ')}] ` : ''}${cell(message).replaceAll('<', '&lt;')}`);
    details.push('');
  }
}
if (details.length === 3) details.push('Записей нет.', '');
const metadata = ['', ...pages.map(file => `<!-- audit-page: ${file} -->`), ''];
await writeFile(join(reports, name), [...lines, ...details, ...metadata].join('\n'), { flag: 'wx' });
console.log(`Отчёт: ${join(reports, name)}`);
if (count(hasIssues) || untracked.length) process.exitCode = 1;
