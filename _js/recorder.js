/* ===========================================================================
   ЗАПИСЬ ВИДЕО С ХОЛСТА — общий модуль для всех машин Зеркалиуса.
   Подключается одной строкой:  <script src="_js/recorder.js"></script>

   Пишет то, что нарисовано на холсте, а не экран: панели и кнопки в кадр не
   попадают, даже когда они открыты. Правый щелчок по ⏺ — «что писать»: можно
   переключить на запись ВКЛАДКИ целиком, с панелями (захват вкладки браузером,
   Chrome спросит разрешение; значок ▣ на кнопке). Если на странице несколько холстов
   (например, Canvas2D снизу и WebGL сверху), они складываются в том же
   порядке, в каком лежат на странице.

   Звук подмешивается, если страница уже построила аудиограф для визуализатора:
   берём тот же источник, поэтому анализатор продолжает работать. Если графа
   нет, но играет <audio> — пробуем его напрямую.

   Запись не живёт в памяти вкладки: каждый кусок сразу уходит в IndexedDB, и
   закрытая посреди записи вкладка её больше не уносит — при следующем открытии
   страница сама предложит сохранить недописанное.
   =========================================================================== */
(function () {
    if (window.__zerkRecorder) return;
    // <script src="…/recorder.js" data-bez-knopki> — только модуль, без плавающей ⏺ и клавиши R:
    // для страниц со своей кнопкой записи, которым нужен доводчик webm (Zazerkalius).
    const BEZ_KNOPKI = !!(document.currentScript && document.currentScript.hasAttribute('data-bez-knopki'));

    /* ---------------------------------------------------------------------
       Хранилище кусков.

       Раньше куски копились в массиве и превращались в файл только в момент
       остановки: закрытая на пятой минуте вкладка уносила всё, на диске не
       оставалось ничего — собирать было не из чего. Теперь каждый кусок сразу
       ложится в IndexedDB, которая переживает и закрытие вкладки, и перезапуск
       браузера. Заодно уходит расход памяти: на 16 Мбит/с пять минут записи —
       это больше полугигабайта, который прежде целиком лежал в куче вкладки.
       --------------------------------------------------------------------- */
    const VAULT = {
        db: null, ready: null, tail: Promise.resolve(),

        open() {
            if (this.ready) return this.ready;
            this.ready = new Promise((res, rej) => {
                let rq;
                try { rq = indexedDB.open('zerkalius-rec', 1); } catch (e) { return rej(e); }
                rq.onupgradeneeded = () => {
                    const db = rq.result;
                    if (!db.objectStoreNames.contains('chunks')) {
                        db.createObjectStore('chunks', { keyPath: 'id', autoIncrement: true })
                          .createIndex('sid', 'sid');
                    }
                    if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'sid' });
                };
                rq.onsuccess = () => { this.db = rq.result; res(this.db); };
                rq.onerror = () => rej(rq.error);
            }).catch(e => { this.ready = null; throw e; });
            return this.ready;
        },

        wrap(rq) { return new Promise((res, rej) => { rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); }); },

        // Записи выстроены в одну цепочку: порядок кусков в файле обязан совпасть
        // с порядком, в котором их отдал MediaRecorder.
        chain(fn) { this.tail = this.tail.then(fn, fn); return this.tail; },

        begin(sid, meta) {
            return this.chain(async () => {
                await this.open();
                return this.wrap(this.db.transaction('sessions', 'readwrite').objectStore('sessions').put({ sid, ...meta }));
            });
        },

        put(sid, seq, blob) {
            return this.chain(async () => {
                await this.open();
                // Время кладём в сам кусок: считать длину по их числу нельзя, браузер
                // отдаёт куски неравномерно, а вести счётчик в записи сеанса — лишняя
                // запись в базу на каждый сброс.
                return this.wrap(this.db.transaction('chunks', 'readwrite').objectStore('chunks').add({ sid, seq, blob, at: Date.now() }));
            });
        },

        index() { return this.db.transaction('chunks').objectStore('chunks').index('sid'); },

        async sessions() {
            await this.open();
            const all = await this.wrap(this.db.transaction('sessions').objectStore('sessions').getAll());
            const out = [];
            for (const s of all) {
                // Транзакция на каждый запрос своя: одна, растянутая через await,
                // закрывается сама, как только цепочка запросов прервётся, и
                // следующее обращение к ней падает.
                s.chunks = await this.wrap(this.index().count(s.sid));
                if (!s.chunks) continue;
                // Длину берём по времени последнего куска: по их числу считать
                // нельзя, браузер отдаёт куски неравномерно.
                const last = await this.wrap(this.index().openCursor(IDBKeyRange.only(s.sid), 'prev'));
                s.ms = last && last.value.at ? last.value.at - s.startedAt : 0;
                out.push(s);
            }
            return out.sort((a, b) => b.sid - a.sid);
        },

        assemble(sid) {
            // Через ту же очередь, что и записи: иначе сборка успевает начаться
            // раньше, чем последний кусок ляжет на диск, и хвост записи теряется.
            return this.chain(async () => {
                await this.open();
                const rows = await this.wrap(this.index().getAll(sid));
                rows.sort((a, b) => a.seq - b.seq);
                // В первом куске лежит заголовок файла. Без него видео не открывает
                // ни один проигрыватель, поэтому оборванную с начала цепочку честнее
                // вернуть пустой, чем отдать обломок, который выглядит как видео.
                if (!rows.length || rows[0].seq !== 0) return [];
                return rows.map(r => r.blob);
            });
        },

        /* Приёмник кусков одной записи.

           Куски нельзя делить между памятью и диском: хранилище готово не мгновенно,
           а заголовок браузер отдаёт одним из первых кусков. Если ранние ушли в
           память, а поздние на диск, собранный с диска файл оказывается без
           заголовка — ровно так и получалось видео, которое не открывалось.
           Поэтому до подтверждения готовности куски ждут в памяти и уходят на диск
           все разом, начиная с нулевого. */
        sink(sid, meta) {
            const V = this;
            const waiting = [];
            let ready = false, broken = false, seq = 0;
            const flush = () => {
                while (ready && !broken && waiting.length) {
                    const blob = waiting.shift();
                    V.put(sid, seq++, blob).catch(() => { broken = true; });
                }
            };
            const started = V.begin(sid, meta).then(() => { ready = true; flush(); },
                                                    () => { broken = true; });
            return {
                get onDisk() { return ready && !broken; },
                push(blob) { waiting.push(blob); flush(); },
                async finish() {
                    await started.catch(() => {});
                    flush();
                    // На диске лежит начало записи, в памяти — хвост, который туда не
                    // успел (или не смог). Порядок между ними известен, поэтому просто
                    // складываем: что бы ни отвалилось, запись собирается целиком.
                    const parts = seq > 0 ? await V.assemble(sid).catch(() => []) : [];
                    return parts.concat(waiting);
                },
                drop() { return V.drop(sid).catch(() => {}); }
            };
        },

        async drop(sid) {
            await this.open();
            return new Promise((res, rej) => {
                const tx = this.db.transaction(['chunks', 'sessions'], 'readwrite');
                const chunks = tx.objectStore('chunks');
                tx.objectStore('sessions').delete(sid);
                // Курсор идёт внутри той же транзакции и без await: каждый следующий
                // шаг ставится прямо из обработчика, поэтому она не успевает закрыться.
                const rq = chunks.index('sid').openKeyCursor(IDBKeyRange.only(sid));
                rq.onsuccess = () => { const c = rq.result; if (c) { chunks.delete(c.primaryKey); c.continue(); } };
                tx.oncomplete = () => res();
                tx.onerror = () => rej(tx.error);
            });
        }
    };

    /* ---------------------------------------------------------------------
       Длительность в заголовок webm (2026-09-27).

       MediaRecorder пишет webm «потоком»: в заголовке нет длительности, потому
       что в начале записи она ещё неизвестна. Проигрыватель такого файла не знает
       его длины — PotPlayer пишет длину 0, не строит эскиз и плохо мотает.
       Здесь, когда запись уже кончилась, в блок Info дописывается элемент
       Duration. Всё остальное в файле остаётся байт в байт: сегмент у такой
       записи «неизвестного размера», а таблицы с адресами внутри файла нет,
       поэтому сдвиг хвоста на несколько байт ничего не ломает. Не разобрался
       в заголовке — возвращаем файл как был: запись важнее длительности.
       --------------------------------------------------------------------- */
    const WEBM = {
        // Элемент EBML: номер, размер, где начинаются данные, где конец.
        el(b, p) {
            if (p >= b.length) return null;
            const vint = (q) => {
                const f = b[q]; let len = 1, mask = 0x80;
                while (len <= 8 && !(f & mask)) { len++; mask >>= 1; }
                if (len > 8 || q + len > b.length) return null;
                let v = f & (mask - 1), all = v === mask - 1;
                for (let i = 1; i < len; i++) { v = v * 256 + b[q + i]; all = all && b[q + i] === 255; }
                return { raw: f, len, v, unknown: all };
            };
            const id = vint(p); if (!id) return null;
            let idv = id.raw; for (let i = 1; i < id.len; i++) idv = idv * 256 + b[p + i];
            const sz = vint(p + id.len); if (!sz) return null;
            const data = p + id.len + sz.len;
            return { id: idv, start: p, idLen: id.len, data, size: sz.v, end: sz.unknown ? Infinity : data + sz.v };
        },

        async fix(blob, ms) {
            if (!blob || !(ms > 0)) return blob;
            try {
                const headLen = Math.min(blob.size, 256 * 1024);
                const b = new Uint8Array(await blob.slice(0, headLen).arrayBuffer());
                let e = this.el(b, 0);
                if (!e || e.id !== 0x1A45DFA3 || e.end > b.length) return blob;          // EBML-заголовок
                const seg = this.el(b, e.end);
                if (!seg || seg.id !== 0x18538067) return blob;                          // Segment
                let info = null;
                for (let p = seg.data; p < b.length; ) {
                    const c = this.el(b, p);
                    if (!c || c.id === 0x1F43B675 || c.end === Infinity) return blob;    // дошли до кадров — Info нет
                    if (c.id === 0x1549A966) { info = c; break; }
                    p = c.end;
                }
                if (!info || info.end > b.length) return blob;
                let scale = 1e6, dur = null;                                             // TimecodeScale: по умолчанию миллисекунды
                for (let p = info.data; p < info.end; ) {
                    const c = this.el(b, p);
                    if (!c || c.end > info.end) return blob;
                    if (c.id === 0x2AD7B1) { scale = 0; for (let i = c.data; i < c.end; i++) scale = scale * 256 + b[i]; }
                    if (c.id === 0x4489) dur = c;
                    p = c.end;
                }
                if (!scale) return blob;
                const value = ms * 1e6 / scale;
                const rest = blob.slice(headLen), type = blob.type || 'video/webm';
                if (dur && (dur.size === 8 || dur.size === 4)) {                        // Duration уже есть — переписываем на месте
                    const dv = new DataView(b.buffer, b.byteOffset + dur.data, dur.size);
                    dur.size === 8 ? dv.setFloat64(0, value) : dv.setFloat32(0, value);
                    return new Blob([b, rest], { type });
                }
                if (dur) return blob;
                const add = new Uint8Array(11);                                          // 44 89 | размер 8 | float64
                add.set([0x44, 0x89, 0x88]); new DataView(add.buffer).setFloat64(3, value);
                const sz = new Uint8Array(8); sz[0] = 0x01;                              // новый размер Info — всегда 8-байтным числом
                for (let i = 7, n = info.size + add.length; i >= 1; i--) { sz[i] = n % 256; n = Math.floor(n / 256); }
                return new Blob([b.subarray(0, info.start + info.idLen), sz, b.subarray(info.data, info.end),
                                 add, b.subarray(info.end), rest], { type });
            } catch (err) { return blob; }
        }
    };

    /* ---------------------------------------------------------------------
       Перемотка в записи (2026-10-17).

       Chrome пишет mp4 «фрагментами» (moof + mdat), и длительность в заголовке
       у него 0, а таблицы, где какой кадр, нет. Проигрыватель такой файл
       играет, но не знает длины и не мотает. Здесь, когда запись кончилась,
       в заголовок ставится длительность (mvhd, tkhd, mdhd, mehd), а в конец
       файла — таблица фрагментов с опорными кадрами (mfra / tfra). Сами кадры
       не трогаются. У webm то же самое: длительность (WEBM.fix) и таблица
       Cues — где начинается каждый кластер с опорным кадром.
       Не разобрался в файле — возвращаем как был: запись важнее перемотки.
       --------------------------------------------------------------------- */
    const MP4 = {
        box(b, p, end) {
            if (p + 8 > end) return null;
            const dv = new DataView(b.buffer, b.byteOffset);
            let size = dv.getUint32(p), head = 8;
            const type = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]);
            if (size === 1) { size = dv.getUint32(p + 8) * 4294967296 + dv.getUint32(p + 12); head = 16; }
            else if (size === 0) size = end - p;
            if (size < head || p + size > end) return null;
            return { p, type, size, head, end: p + size };
        },
        kids(b, s, e) { const out = []; for (let p = s; p < e; ) { const x = this.box(b, p, e); if (!x) return null; out.push(x); p = x.end; } return out; },
        u32(n) { return [n >>> 24 & 255, n >>> 16 & 255, n >>> 8 & 255, n & 255]; },
        u64(n) { return [...this.u32(Math.floor(n / 4294967296)), ...this.u32(n >>> 0)]; },
        mk(type, body) { const o = new Uint8Array(8 + body.length); o.set(this.u32(8 + body.length)); for (let i = 0; i < 4; i++) o[4 + i] = type.charCodeAt(i); o.set(body, 8); return o; },

        async fix(blob) {
            try {
                const b = new Uint8Array(await blob.arrayBuffer()), dv = new DataView(b.buffer);
                const top = this.kids(b, 0, b.length); if (!top) return blob;
                const moov = top.find(x => x.type === 'moov'); if (!moov || !top.some(x => x.type === 'moof')) return blob;
                if (top.some(x => x.type === 'mfra')) return blob;                       // уже доведён
                const rd = (p, v1) => v1 ? dv.getUint32(p) * 4294967296 + dv.getUint32(p + 4) : dv.getUint32(p);
                // дорожки: номер → шкала времени (mdhd), значения по умолчанию (trex)
                const T = new Map(), trex = new Map();
                const mk = this.kids(b, moov.p + moov.head, moov.end); if (!mk) return blob;
                let mvTs = 1000;
                for (const x of mk) {
                    if (x.type === 'mvhd') mvTs = dv.getUint32(x.p + (b[x.p + 8] === 1 ? 28 : 20));
                    if (x.type === 'mvex') for (const y of this.kids(b, x.p + 8, x.end) || []) if (y.type === 'trex') trex.set(dv.getUint32(y.p + 12), { dur: dv.getUint32(y.p + 20), flags: dv.getUint32(y.p + 28) });
                    if (x.type === 'trak') {
                        let id = 0, ts = 0;
                        for (const y of this.kids(b, x.p + 8, x.end) || []) {
                            if (y.type === 'tkhd') id = dv.getUint32(y.p + (b[y.p + 8] === 1 ? 28 : 20));
                            if (y.type === 'mdia') for (const z of this.kids(b, y.p + 8, y.end) || []) if (z.type === 'mdhd') ts = dv.getUint32(z.p + (b[z.p + 8] === 1 ? 28 : 20));
                        }
                        if (id && ts) T.set(id, { ts, end: 0, ra: [] });
                    }
                }
                if (!T.size) return blob;
                // фрагменты: начало, длительность, первый кадр опорный ли
                for (const f of top) if (f.type === 'moof') {
                    let traf = 0;
                    for (const x of this.kids(b, f.p + 8, f.end) || []) if (x.type === 'traf') {
                        traf++;
                        let id = 0, dDur = 0, dFlags = 0, t0 = null, tr = 0;
                        for (const y of this.kids(b, x.p + 8, x.end) || []) {
                            if (y.type === 'tfhd') {
                                const fl = dv.getUint32(y.p + 8) & 0xFFFFFF; let q = y.p + 16; id = dv.getUint32(y.p + 12);
                                const df = trex.get(id) || { dur: 0, flags: 0 }; dDur = df.dur; dFlags = df.flags;
                                if (fl & 1) q += 8; if (fl & 2) q += 4;
                                if (fl & 8) { dDur = dv.getUint32(q); q += 4; }
                                if (fl & 16) q += 4;
                                if (fl & 32) dFlags = dv.getUint32(q);
                            }
                            if (y.type === 'tfdt') t0 = rd(y.p + 12, b[y.p + 8] === 1);
                            if (y.type === 'trun') {
                                tr++;
                                const fl = dv.getUint32(y.p + 8) & 0xFFFFFF, n = dv.getUint32(y.p + 12); let q = y.p + 16, first = null, sum = 0;
                                if (fl & 1) q += 4; if (fl & 4) { first = dv.getUint32(q); q += 4; }
                                for (let i = 0; i < n; i++) {
                                    let d = dDur, sf = dFlags;
                                    if (fl & 0x100) { d = dv.getUint32(q); q += 4; }
                                    if (fl & 0x200) q += 4;
                                    if (fl & 0x400) { sf = dv.getUint32(q); q += 4; }
                                    if (fl & 0x800) q += 4;
                                    if (i === 0 && first !== null) sf = first;
                                    if (i === 0 && tr === 1 && t0 !== null && T.has(id) && !(sf & 0x10000)) T.get(id).ra.push({ t: t0, off: f.p, traf });
                                    sum += d;
                                }
                                const t = T.get(id); if (t && t0 !== null) { t.end = Math.max(t.end, t0 + sum); t0 += sum; }
                            }
                        }
                    }
                }
                let movie = 0; for (const t of T.values()) movie = Math.max(movie, t.end / t.ts);
                if (!(movie > 0)) return blob;
                // заголовок с длительностью: те же коробки, поле длительности переписано, в mvex — mehd
                const out = [], put = (x, v1Off, v0Off, val) => { const c = b.slice(x.p, x.end), d2 = new DataView(c.buffer), v1 = c[8] === 1, o = v1 ? v1Off : v0Off;
                    if (v1) { d2.setUint32(o, Math.floor(val / 4294967296)); d2.setUint32(o + 4, val >>> 0); } else d2.setUint32(o, Math.min(val, 4294967295)); return c; };
                const rebuild = (x, trackTs) => {
                    if (x.type === 'mvhd') return put(x, 32, 24, Math.round(movie * mvTs));
                    if (x.type === 'tkhd') return put(x, 36, 28, Math.round(movie * mvTs));
                    if (x.type === 'mdhd') return put(x, 32, 24, Math.round(movie * trackTs));
                    if (x.type === 'mehd') return put(x, 12, 12, Math.round(movie * mvTs));
                    if (!['moov', 'trak', 'mdia', 'mvex'].includes(x.type)) return b.subarray(x.p, x.end);
                    const ks = this.kids(b, x.p + x.head, x.end); let ts = trackTs;
                    if (x.type === 'trak') for (const y of ks) if (y.type === 'tkhd') { const t = T.get(dv.getUint32(y.p + (b[y.p + 8] === 1 ? 28 : 20))); if (t) ts = t.ts; }
                    const parts = ks.map(y => rebuild(y, ts));
                    if (x.type === 'mvex' && !ks.some(y => y.type === 'mehd')) parts.unshift(this.mk('mehd', [1, 0, 0, 0, ...this.u64(Math.round(movie * mvTs))]));
                    const len = parts.reduce((s, c) => s + c.length, 0), body = new Uint8Array(len); let q = 0; for (const c of parts) { body.set(c, q); q += c.length; }
                    return this.mk(x.type, body);
                };
                const nm = rebuild(moov, 0), shift = nm.length - moov.size;
                // таблица опорных кадров в конце файла
                const tfras = [];
                for (const [id, t] of T) {
                    const e = []; for (const r of t.ra) e.push(...this.u64(r.t), ...this.u64(r.off + (r.off > moov.p ? shift : 0)), r.traf, 1, 1);
                    tfras.push(this.mk('tfra', [1, 0, 0, 0, ...this.u32(id), 0, 0, 0, 0, ...this.u32(t.ra.length), ...e]));
                }
                const tl = tfras.reduce((s, c) => s + c.length, 0) + 16, mfro = this.mk('mfro', [0, 0, 0, 0, ...this.u32(tl + 8)]);
                const mb = new Uint8Array(tl - 16 + mfro.length); let q = 0; for (const c of tfras) { mb.set(c, q); q += c.length; } mb.set(mfro, q);
                out.push(b.subarray(0, moov.p), nm, b.subarray(moov.end), this.mk('mfra', mb));
                return new Blob(out, { type: blob.type || 'video/mp4' });
            } catch (err) { return blob; }
        }
    };

    // Cues для webm: где начинается каждый кластер с опорным кадром. Кладутся перед первым
    // кластером, сегмент получает известный размер. Позиции — 8-байтными числами, чтобы
    // размер таблицы не зависел от самих позиций.
    WEBM.cues = async function (blob) {
        try {
            const b = new Uint8Array(await blob.arrayBuffer());
            const e = this.el(b, 0); if (!e || e.id !== 0x1A45DFA3) return blob;
            const seg = this.el(b, e.end); if (!seg || seg.id !== 0x18538067) return blob;
            const TOP = [0x1F43B675, 0x1C53BB6B, 0x1254C367, 0x1549A966, 0x1654AE6B, 0x114D9B74, 0x1941A469, 0x1043A770];
            const segEnd = Math.min(seg.end, b.length), heads = [], clusters = [];
            let track = 1, p = seg.data;
            while (p < segEnd) {
                const c = this.el(b, p); if (!c) return blob;
                if (c.id === 0x1C53BB6B) return blob;                                       // Cues уже есть
                if (c.id === 0x1F43B675) {
                    let q = c.data, time = null, key = null, end = c.end;
                    while (q < Math.min(end, segEnd)) {
                        const k = this.el(b, q); if (!k) return blob;
                        if (c.end === Infinity && TOP.includes(k.id)) break;
                        if (k.id === 0xE7) { time = 0; for (let i = k.data; i < k.end; i++) time = time * 256 + b[i]; }
                        if (key === null && (k.id === 0xA3 || k.id === 0xA0)) {
                            const tn = b[k.data] & 0x80 ? 1 : 2;                       // номер дорожки — vint, флаги после двух байт времени
                            key = k.id === 0xA0 ? true : !!(b[k.data + tn + 2] & 0x80);
                        }
                        if (k.end === Infinity) return blob;
                        q = k.end;
                    }
                    clusters.push({ p, data: c.data, end: q, time, key });
                    p = q; continue;
                }
                if (c.end === Infinity || c.end > segEnd) return blob;
                if (c.id === 0x1654AE6B) for (let q = c.data; q < c.end; ) {                // Tracks → первая дорожка
                    const te = this.el(b, q); if (!te) break;
                    if (te.id === 0xAE) for (let r = te.data; r < te.end; ) { const f = this.el(b, r); if (!f) break; if (f.id === 0xD7) { track = b[f.data]; break; } r = f.end; }
                    break;
                }
                if (c.id !== 0x114D9B74) heads.push([c.start, c.end]);                       // SeekHead со старыми адресами — выкинуть
                p = c.end;
            }
            const cs = clusters.filter(c => c.key && c.time !== null); if (!cs.length) return blob;
            const u = (n, len) => { const o = []; for (let i = len - 1; i >= 0; i--) { o[i] = n % 256; n = Math.floor(n / 256); } return o; };
            // кластеры — с известным размером (8-байтным, заголовок всегда 12 байт): в сегменте известного размера
            // кластер «до следующего» проигрыватели читают с предупреждением
            let at = 0; for (const c of clusters) { c.at = at; at += 12 + c.end - c.data; }
            const headLen = heads.reduce((s, h) => s + h[1] - h[0], 0), cuesLen = 4 + 8 + cs.length * 27;
            const body = [];
            for (const c of cs) {
                const pos = headLen + cuesLen + c.at;
                body.push(0xBB, 0x99, 0xB3, 0x88, ...u(c.time, 8), 0xB7, 0x8D, 0xF7, 0x81, track, 0xF1, 0x88, ...u(pos, 8));
            }
            const cues = new Uint8Array([0x1C, 0x53, 0xBB, 0x6B, 0x01, ...u(body.length, 7), ...body]);
            const total = headLen + cues.length + at;
            const segHead = new Uint8Array([0x18, 0x53, 0x80, 0x67, 0x01, ...u(total, 7)]);
            const parts = [b.subarray(0, e.end), segHead, ...heads.map(h => b.subarray(h[0], h[1])), cues];
            for (const c of clusters) parts.push(new Uint8Array([0x1F, 0x43, 0xB6, 0x75, 0x01, ...u(c.end - c.data, 7)]), b.subarray(c.data, c.end));
            return new Blob(parts, { type: blob.type || 'video/webm' });
        } catch (err) { return blob; }
    };

    // Любая запись: mp4 — длительность и таблица фрагментов, webm — длительность и Cues.
    const fixVideo = async (blob, ms) => {
        if (!blob) return blob;
        let head; try { head = new Uint8Array(await blob.slice(0, 12).arrayBuffer()); } catch (e) { return blob; }
        if (head[0] === 0x1A && head[1] === 0x45) return WEBM.cues(await WEBM.fix(blob, ms));
        if (String.fromCharCode(head[4], head[5], head[6], head[7]) === 'ftyp') return MP4.fix(blob);
        return blob;
    };

    // Значок «в Хаб» (hub-link.js) — тоже холст: без этого исключения он растягивался на весь кадр
    // и висел в каждом ролике огромными песочными часами. data-no-rec — так же убрать любой свой холст.
    const visibleCanvases = () =>[...document.querySelectorAll('canvas')].filter(c => {
        if (c.closest('#zerkHubBtn, [data-no-rec]')) return false;
        const st = getComputedStyle(c);
        return c.width > 16 && c.height > 16 && st.display !== 'none' && st.visibility !== 'hidden' && +st.opacity > 0.01;
    });

    const REC = {
        rec: null, startedAt: 0, timer: null, mime: '', raf: 0, mix: null, noticeTo: null,
        sid: 0, sink: null, busy: false, onEnded: null,

        /* Что писать: 'canvas' — холсты (как всегда), 'page' — вкладку целиком, с панелями. Панели — не холст,
           captureStream их не видит, поэтому вкладку пишет сам браузер (getDisplayMedia, «эта вкладка»): Chrome
           один раз спрашивает разрешение, его кнопка «Закрыть доступ» — тоже стоп. Выбор общий для всех страниц. */
        mode() { try { return localStorage.getItem('zerk_rec_mode') === 'page' ? 'page' : 'canvas'; } catch (e) { return 'canvas'; } },
        setMode(m) { try { localStorage.setItem('zerk_rec_mode', m); } catch (e) {} },

        pickMime() {
            const want = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4',
                          'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
            return want.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
        },

        audioTrack() {
            try {
                const A = window.AUDIO_VISUALIZER;
                if (A && A.audioCtx && A.source) {
                    if (!this._dest) { this._dest = A.audioCtx.createMediaStreamDestination(); A.source.connect(this._dest); }
                    if (A.audioCtx.state === 'suspended') A.audioCtx.resume();
                    return this._dest.stream.getAudioTracks()[0] || null;
                }
                const a = [...document.querySelectorAll('audio')].find(el => el.src && !el.paused);
                if (a && a.captureStream) return a.captureStream().getAudioTracks()[0] || null;
            } catch (e) {}
            return null;
        },

        // Несколько холстов сводим в один: иначе в записи окажется только верхний,
        // без фона, либо только фон, без движения.
        makeSource(fps) {
            const list = visibleCanvases();
            if (!list.length) return null;
            // Сводим всегда, даже когда холст один: с неподвижного холста браузер
            // не отдаёт ни одного кадра, и запись выходит пустой. Здесь же кадр
            // рисуется каждый раз заново, поэтому поток идёт при любой картинке.
            const w = Math.max(...list.map(c => c.width)), h = Math.max(...list.map(c => c.height));
            const mix = document.createElement('canvas');
            mix.width = w; mix.height = h;
            const ctx = mix.getContext('2d');
            let raf = 0, tick = 0;
            const draw = () => {
                ctx.clearRect(0, 0, w, h);
                for (const c of list) { try { ctx.drawImage(c, 0, 0, w, h); } catch (e) {} }
                tick = (tick + 1) % 2;
                ctx.fillStyle = `rgba(0,0,0,${0.004 + tick * 0.002})`;
                ctx.fillRect(0, 0, 1, 1);
                raf = requestAnimationFrame(draw);
            };
            // Браузер отдаёт кадр, только когда холст изменился. На неподвижной
            // картинке (например, шейдер на паузе) запись выходила в один кадр или
            // вовсе пустой, поэтому каждый кадр помечаем холст крошечным мазком в
            // углу — он меняет ровно один пиксель на четверть процента прозрачности.
            draw();
            return { stream: mix.captureStream(fps), stop() { cancelAnimationFrame(raf); } };
        },

        notify(text) {
            const el = document.getElementById('zerkRecTimer');
            if (!el) return;
            el.textContent = text; el.style.display = 'block';
            clearTimeout(this.noticeTo);
            this.noticeTo = setTimeout(() => { if (!this.rec) el.style.display = 'none'; }, 1800);
        },

        start(fps) {
            this.mime = this.pickMime();
            if (!this.mime) { this.notify('ЗАПИСЬ НЕ ПОДДЕРЖИВАЕТСЯ'); return false; }
            this.mix = this.makeSource(fps || 60);
            if (!this.mix) { this.notify('ХОЛСТ НЕ НАЙДЕН'); return false; }
            return this.begin();
        },

        async startPage() {
            this.mime = this.pickMime();
            if (!this.mime || !navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) { this.notify('ЗАПИСЬ ВКЛАДКИ НЕ ПОДДЕРЖИВАЕТСЯ'); return false; }
            let ds;
            try {
                ds = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 60, displaySurface: 'browser' }, audio: true,
                    preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude', systemAudio: 'exclude' });
            } catch (e) { this.notify('ЗАПИСЬ ОТМЕНЕНА'); return false; }
            const vt = ds.getVideoTracks()[0];
            if (vt) vt.addEventListener('ended', () => { if (this.rec && this.onEnded) this.onEnded(); });
            const stream = new MediaStream(ds.getVideoTracks());
            const ta = ds.getAudioTracks()[0]; if (ta) stream.addTrack(ta);
            // Останавливаем только захват вкладки: трек визуализатора общий и нужен дальше.
            this.mix = { stream, stop() { ds.getTracks().forEach(t => t.stop()); } };
            return this.begin();
        },

        begin() {
            const at = this.mix.stream.getAudioTracks().length ? null : this.audioTrack();
            if (at) this.mix.stream.addTrack(at);
            this.sid = Date.now();
            this.sink = VAULT.sink(this.sid, { mime: this.mime, startedAt: this.sid, name: this.fileBase(this.sid) });

            this.rec = new MediaRecorder(this.mix.stream, { mimeType: this.mime, videoBitsPerSecond: 16000000, videoKeyFrameIntervalDuration: 1000 }   /* опорный кадр раз в секунду — есть куда мотать */);
            this.rec.ondataavailable = e => { if (e.data && e.data.size) this.sink.push(e.data); };
            this.rec.onstop = () => this.save();
            // Шаг в start(1000) соблюдает только webm: mp4-муксер Chrome копит кадры у
            // себя и отдаёт их примерно раз в три секунды, а на requestData() отвечает
            // пустыми кусками. Столько и потеряется, если вкладку всё-таки оборвут.
            this.rec.start(1000);
            this.startedAt = Date.now();
            // Вкладку, закрытую во время записи, браузер сам не удержит — просим его
            // переспросить. Это и есть та самая пятая минута, которая пропала.
            window.addEventListener('beforeunload', guardUnload);
            return true;
        },

        stop() {
            this.stoppedAt = Date.now();
            if (this.rec && this.rec.state !== 'inactive') this.rec.stop();
            this.rec = null;
            if (this.mix) { this.mix.stop(); this.mix = null; }   // у записи вкладки — и сам захват
            window.removeEventListener('beforeunload', guardUnload);
        },

        // Кириллицу в имени файла Chrome у blob-ссылок не принимает: атрибут download
        // молча отбрасывается, и запись падает на диск безымянным файлом «download»
        // без расширения. Поэтому заголовок страницы переводим в латиницу.
        translit(text) {
            const M = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',
                        н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',
                        ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' };
            return text.replace(/[А-Яа-яЁё]/g, ch => {
                const low = ch.toLowerCase(), t = M[low] || '';
                return ch === low ? t : t.charAt(0).toUpperCase() + t.slice(1);
            });
        },

        fileBase(at) {
            const d = at ? new Date(at) : new Date(), pad = n => String(n).padStart(2, '0');
            const name = this.translit(document.title || 'zerkalius').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'zerkalius';
            return `${name}-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
        },

        // Файл обязан начинаться с заголовка. Если первым идёт фрагмент, значит
        // потерялось начало записи и такое видео не откроет ни один проигрыватель —
        // честнее сказать это сразу и пометить файл, чем отдать его молча.
        async hasHeader(parts) {
            if (!parts.length) return false;
            try {
                const head = new Uint8Array(await parts[0].slice(0, 8).arrayBuffer());
                const typ = String.fromCharCode(head[4], head[5], head[6], head[7]);
                return typ !== 'moof' && typ !== 'mdat';
            } catch (e) { return true; }
        },

        // Для страниц со своей записью: длительность и перемотка — и в webm, и в mp4 (2026-10-17; прежде только длительность webm).
        fixWebm(blob, ms) { return fixVideo(blob, ms); },
        fixVideo(blob, ms) { return fixVideo(blob, ms); },

        async download(parts, mime, base, ms) {
            if (!parts.length) return false;
            const ext = (mime || '').startsWith('video/mp4') ? 'mp4' : 'webm';
            let blob = new Blob(parts, { type: mime });
            blob = await fixVideo(blob, ms);
            const a = document.createElement('a');
            a.download = `${base}.${ext}`;
            a.href = URL.createObjectURL(blob);
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 30000);
            return true;
        },

        async save() {
            const sink = this.sink, sid = this.sid;
            if (!sink) return;
            this.sink = null;
            const parts = await sink.finish();
            if (!parts.length) { this.notify('ЗАПИСЬ ПУСТА'); return; }
            const ok = await this.hasHeader(parts);
            const ms = (this.stoppedAt > this.startedAt ? this.stoppedAt : Date.now()) - this.startedAt;
            if (await this.download(parts, this.mime, this.fileBase(sid) + (ok ? '' : '-BEZ-ZAGOLOVKA'), ms)) await sink.drop();
            if (!ok) this.notify('ЗАПИСЬ БЕЗ ЗАГОЛОВКА — НЕ ОТКРОЕТСЯ');
        },

        // Недописанные записи прошлых сеансов: вкладку закрыли, остановка не
        // случилась, но куски на диске лежат и собираются в обычный файл.
        async recover() {
            let list = [];
            try { list = await VAULT.sessions(); } catch (e) { return []; }
            return list.filter(x => x.sid !== this.sid);
        },

        async recoverOne(sess) {
            const parts = await VAULT.assemble(sess.sid);
            const base = (sess.name || this.fileBase(sess.startedAt)) + '-vosstanovleno';
            const ok = await this.download(parts, sess.mime, base, sess.ms);   // длина — по времени последнего куска
            await VAULT.drop(sess.sid);
            return ok;
        },

        async forget(sess) { await VAULT.drop(sess.sid); }
    };

    // Диалог «уйти со страницы?» браузер показывает только по такому обработчику
    // и только пока запись идёт — в остальное время он никому не мешает.
    function guardUnload(e) {
        e.preventDefault();
        e.returnValue = 'Идёт запись видео. Если закрыть вкладку, запись останется недописанной.';
        return e.returnValue;
    }

    // Полоса «нашлась незавершённая запись». Появляется только если в хранилище
    // действительно что-то лежит, и уходит, как только человек решил её судьбу.
    const МЕСЯЦ = 30 * 24 * 3600 * 1000;

    async function offerRecovery() {
        let list;
        try { list = await REC.recover(); } catch (e) { return; }
        // Брошенные записи не должны копиться в профиле браузера: на 16 Мбит/с
        // каждая забытая минута — это больше сотни мегабайт. Месяц предлагаем
        // сохранить, дальше убираем.
        const old = list.filter(s => Date.now() - s.sid > МЕСЯЦ);
        for (const s of old) { try { await REC.forget(s); } catch (e) {} }
        list = list.filter(s => Date.now() - s.sid <= МЕСЯЦ);
        if (!list.length) return;

        const bar = document.createElement('div');
        bar.id = 'zerkRecRescue';
        const draw = () => {
            const s = list[0];
            const secs = Math.max(0, Math.round((s.ms || 0) / 1000));
            const len = secs ? ` ~${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : '';
            bar.innerHTML = '';
            const txt = document.createElement('span');
            txt.textContent = `● НЕЗАВЕРШЁННАЯ ЗАПИСЬ${len}` + (list.length > 1 ? ` (ещё ${list.length - 1})` : '');
            const save = document.createElement('button'); save.type = 'button'; save.textContent = 'СОХРАНИТЬ';
            const drop = document.createElement('button'); drop.type = 'button'; drop.textContent = 'УДАЛИТЬ';
            // Сборка длинной записи занимает время: пока идёт, кнопки заперты —
            // иначе второй щелчок снял бы с очереди следующую запись.
            const once = (fn) => async () => {
                save.disabled = drop.disabled = true;
                const s = list.shift();
                try { await fn(s); } catch (e) { list.unshift(s); }
                list.length ? draw() : bar.remove();
            };
            save.addEventListener('click', once(s => REC.recoverOne(s)));
            drop.addEventListener('click', once(s => REC.forget(s)));
            bar.append(txt, save, drop);
        };
        draw();
        styles();
        document.body.appendChild(bar);
    }

    // Стили нужны и полосе «незавершённая запись». На страницах без плавающей ⏺
    // (data-bez-knopki, своя кнопка записи) build() выходит раньше, и полоса
    // оставалась без стилей: обычным блоком в конце страницы, под её панелями —
    // кнопки «сохранить / удалить» не нажимались (Zazerkalius v0.955).
    function styles() {
        if (document.getElementById('zerkRecCss')) return;
        const css = document.createElement('style'); css.id = 'zerkRecCss';
        css.textContent = `
            #zerkRecBtn { position: fixed; right: 10px; bottom: 10px; z-index: 99999;
                width: 38px; height: 38px; border-radius: 50%; cursor: pointer;
                background: #1a1a1a; color: #ff5555; border: 1px solid #552222;
                font-size: 18px; line-height: 1; display: flex; align-items: center;
                justify-content: center; opacity: .55; transition: opacity .2s, background .2s; }
            #zerkRecBtn:hover { opacity: 1; background: #331111; }
            #zerkRecBtn.rec { opacity: 1; background: #cc0000; color: #fff; border-color: #ff3333;
                animation: zerkRecPulse 1.2s infinite alternate; }
            @keyframes zerkRecPulse { from { box-shadow: 0 0 3px #ff3333; } to { box-shadow: 0 0 14px #ff3333; } }
            #zerkRecTimer { position: fixed; right: 56px; bottom: 18px; z-index: 99999; display: none;
                font: bold 12px 'Courier New', monospace; color: #ff5555;
                background: rgba(0,0,0,.65); padding: 3px 8px; border-radius: 3px; }
            #zerkRecRescue { position: fixed; right: 56px; bottom: 54px; z-index: 99999;
                display: flex; align-items: center; gap: 8px;
                font: bold 12px 'Courier New', monospace; color: #ffcc00;
                background: rgba(0,0,0,.85); border: 1px solid #665500;
                padding: 6px 10px; border-radius: 3px; }
            #zerkRecRescue button { font: bold 11px 'Courier New', monospace; cursor: pointer;
                background: #222; color: #ffcc00; border: 1px solid #665500; padding: 3px 8px; border-radius: 2px; }
            #zerkRecRescue button:hover { background: #443300; color: #fff; }
            #zerkRecBtn.page::after { content: '▣'; position: absolute; right: -3px; bottom: -5px; font-size: 11px;
                line-height: 1; color: #ffcc00; text-shadow: 0 0 2px #000; pointer-events: none; }
            #zerkRecBtn.recpage { opacity: 1; background: #1a0000; color: #ff3333; border-color: #ff3333; }
            #zerkRecMode { position: fixed; z-index: 100000; display: none; background: #111; border: 1px solid #552222;
                border-radius: 4px; padding: 6px 10px; font: 12px Consolas, monospace; color: #ddd;
                box-shadow: 0 2px 10px rgba(0,0,0,.6); }
            #zerkRecMode b { display: block; color: #ff8888; margin-bottom: 4px; font-weight: 600; }
            #zerkRecMode label { display: flex; gap: 6px; align-items: center; cursor: pointer; margin: 3px 0; white-space: nowrap; }
            #zerkRecMode .hint { color: #889; font-size: 11px; margin-top: 5px; max-width: 280px; }`;
        document.head.appendChild(css);
    }

    function build() {
        // На страницах со своей кнопкой записи (у них она вписана в панель) вторую
        // плавающую не добавляем — хранилище и полоса восстановления общие, а
        // управление остаётся тамошнее.
        if (BEZ_KNOPKI || document.getElementById('zerkRecBtn') || document.getElementById('recBtn')) return;
        styles();

        const timer = document.createElement('div');
        timer.id = 'zerkRecTimer';
        const btn = document.createElement('button');
        btn.id = 'zerkRecBtn'; btn.type = 'button'; btn.textContent = '⏺';
        document.body.appendChild(timer); document.body.appendChild(btn);

        // Правый щелчок по ⏺ — что писать; выбор помнится
        const setTitle = () => {
            const page = REC.mode() === 'page';
            btn.classList.toggle('page', page);
            btn.title = (page ? 'Запись видео ВКЛАДКИ целиком, с панелями (R; Chrome спросит разрешение)'
                              : 'Запись видео с холста (R). Пишется только холст — панели в кадр не попадают') + ' · правый щелчок — что писать';
        };
        const menu = document.createElement('div');
        menu.id = 'zerkRecMode';
        menu.innerHTML = '<b>⏺ Что писать</b>' +
            '<label><input type="radio" name="zerkRecMode" value="canvas"> только холст</label>' +
            '<label><input type="radio" name="zerkRecMode" value="page"> вкладку целиком, с панелями</label>' +
            '<div class="hint">С панелями пишется то, что видно во вкладке, как есть. Chrome спросит «Поделиться этой вкладкой» — ' +
            'согласиться; остановить можно и его кнопкой «Закрыть доступ». Звук — звук вкладки, если отмечен в том окне.</div>';
        document.body.appendChild(menu);
        menu.addEventListener('change', e => { if (e.target.name === 'zerkRecMode') { REC.setMode(e.target.value); setTitle(); menu.style.display = 'none'; } });
        btn.addEventListener('contextmenu', e => {
            e.preventDefault();
            if (REC.rec) return;
            menu.querySelectorAll('input').forEach(r => { r.checked = r.value === REC.mode(); });
            menu.style.display = 'block';
            const b = btn.getBoundingClientRect(), mw = menu.offsetWidth, mh = menu.offsetHeight;
            const left = b.left + b.width / 2 > innerWidth / 2 ? b.left - mw - 8 : b.right + 8;
            menu.style.left = Math.max(4, Math.min(innerWidth - mw - 4, left)) + 'px';
            menu.style.top = Math.max(4, Math.min(innerHeight - mh - 4, b.top)) + 'px';
        });
        document.addEventListener('mousedown', e => { if (menu.style.display === 'block' && !menu.contains(e.target)) menu.style.display = 'none'; });
        setTitle();

        const stopUi = () => {
            REC.stop(); clearInterval(REC.timer);
            btn.classList.remove('rec', 'recpage'); REC.notify('● СОХРАНЕНО');
        };
        REC.onEnded = stopUi;   // «Закрыть доступ» в Chrome
        const toggle = async () => {
            if (REC.rec) { stopUi(); return; }
            if (REC.busy) return;
            const page = REC.mode() === 'page';
            REC.busy = true;
            const ok = page ? await REC.startPage() : REC.start(60);
            REC.busy = false;
            if (!ok) return;
            btn.classList.add(page ? 'recpage' : 'rec');   // с панелями — без мигания: кнопка сама в кадре
            if (!page) timer.style.display = 'block';      // и счётчик тоже попал бы в кадр
            REC.timer = setInterval(() => {
                const s = Math.floor((Date.now() - REC.startedAt) / 1000);
                timer.textContent = `● REC ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
            }, 500);
        };
        btn.addEventListener('click', toggle);
        // Горячая клавиша R — но не тогда, когда человек печатает в поле.
        document.addEventListener('keydown', e => {
            if (e.key !== 'r' && e.key !== 'R' && e.key !== 'к' && e.key !== 'К') return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const t = e.target.tagName;
            if (t === 'INPUT' || t === 'TEXTAREA' || e.target.isContentEditable) return;
            e.preventDefault(); toggle();
        });
    }

    window.__zerkRecorder = REC;
    // Хранилище и защита от закрытия нужны и машинам со своей кнопкой записи —
    // отдаём их наружу, чтобы вся возня с IndexedDB жила в одном месте.
    window.__zerkVault = VAULT;
    window.__zerkRecGuard = { on: () => window.addEventListener('beforeunload', guardUnload),
                              off: () => window.removeEventListener('beforeunload', guardUnload) };

    const init = () => { build(); offerRecovery(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
