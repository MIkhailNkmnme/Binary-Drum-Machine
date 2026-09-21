/* ===========================================================================
   ЗАПИСЬ ВИДЕО С ХОЛСТА — общий модуль для всех машин Зеркалиуса.
   Подключается одной строкой:  <script src="_js/recorder.js"></script>

   Пишет то, что нарисовано на холсте, а не экран: панели и кнопки в кадр не
   попадают, даже когда они открыты. Если на странице несколько холстов
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

    const visibleCanvases = () => [...document.querySelectorAll('canvas')].filter(c => {
        const st = getComputedStyle(c);
        return c.width > 16 && c.height > 16 && st.display !== 'none' && st.visibility !== 'hidden' && +st.opacity > 0.01;
    });

    const REC = {
        rec: null, startedAt: 0, timer: null, mime: '', raf: 0, mix: null, noticeTo: null,
        sid: 0, sink: null,

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
            const at = this.audioTrack();
            if (at) this.mix.stream.addTrack(at);
            this.sid = Date.now();
            this.sink = VAULT.sink(this.sid, { mime: this.mime, startedAt: this.sid, name: this.fileBase(this.sid) });

            this.rec = new MediaRecorder(this.mix.stream, { mimeType: this.mime, videoBitsPerSecond: 16000000 });
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
            if (this.rec && this.rec.state !== 'inactive') this.rec.stop();
            this.rec = null;
            if (this.mix) { this.mix.stop(); this.mix = null; }
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

        download(parts, mime, base) {
            if (!parts.length) return false;
            const ext = (mime || '').startsWith('video/mp4') ? 'mp4' : 'webm';
            const a = document.createElement('a');
            a.download = `${base}.${ext}`;
            a.href = URL.createObjectURL(new Blob(parts, { type: mime }));
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
            if (this.download(parts, this.mime, this.fileBase(sid) + (ok ? '' : '-BEZ-ZAGOLOVKA'))) await sink.drop();
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
            const ok = this.download(parts, sess.mime, base);
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
        document.body.appendChild(bar);
    }

    function build() {
        // На страницах со своей кнопкой записи (у них она вписана в панель) вторую
        // плавающую не добавляем — хранилище и полоса восстановления общие, а
        // управление остаётся тамошнее.
        if (document.getElementById('zerkRecBtn') || document.getElementById('recBtn')) return;
        const css = document.createElement('style');
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
            #zerkRecRescue button:hover { background: #443300; color: #fff; }`;
        document.head.appendChild(css);

        const timer = document.createElement('div');
        timer.id = 'zerkRecTimer';
        const btn = document.createElement('button');
        btn.id = 'zerkRecBtn'; btn.type = 'button'; btn.textContent = '⏺';
        btn.title = 'Запись видео с холста (R). Пишется только холст — панели в кадр не попадают';
        document.body.appendChild(timer); document.body.appendChild(btn);

        const toggle = () => {
            if (REC.rec) {
                REC.stop(); clearInterval(REC.timer);
                btn.classList.remove('rec'); REC.notify('● СОХРАНЕНО');
                return;
            }
            if (!REC.start(60)) return;
            btn.classList.add('rec');
            timer.style.display = 'block';
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
