/* ===========================================================================
   ЗАПИСЬ ВИДЕО С ХОЛСТА — общий модуль для всех машин Зеркалиуса.
   Подключается одной строкой:  <script src="recorder.js"></script>

   Пишет то, что нарисовано на холсте, а не экран: панели и кнопки в кадр не
   попадают, даже когда они открыты. Если на странице несколько холстов
   (например, Canvas2D снизу и WebGL сверху), они складываются в том же
   порядке, в каком лежат на странице.

   Звук подмешивается, если страница уже построила аудиограф для визуализатора:
   берём тот же источник, поэтому анализатор продолжает работать. Если графа
   нет, но играет <audio> — пробуем его напрямую.
   =========================================================================== */
(function () {
    if (window.__zerkRecorder) return;

    const visibleCanvases = () => [...document.querySelectorAll('canvas')].filter(c => {
        const st = getComputedStyle(c);
        return c.width > 16 && c.height > 16 && st.display !== 'none' && st.visibility !== 'hidden' && +st.opacity > 0.01;
    });

    const REC = {
        rec: null, chunks: [], startedAt: 0, timer: null, mime: '', raf: 0, mix: null, noticeTo: null,

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
            this.chunks = [];
            this.rec = new MediaRecorder(this.mix.stream, { mimeType: this.mime, videoBitsPerSecond: 16000000 });
            this.rec.ondataavailable = e => { if (e.data && e.data.size) this.chunks.push(e.data); };
            this.rec.onstop = () => this.save();
            this.rec.start(1000);
            this.startedAt = Date.now();
            return true;
        },

        stop() {
            if (this.rec && this.rec.state !== 'inactive') this.rec.stop();
            this.rec = null;
            if (this.mix) { this.mix.stop(); this.mix = null; }
        },

        save() {
            if (!this.chunks.length) return;
            const ext = this.mime.startsWith('video/mp4') ? 'mp4' : 'webm';
            const blob = new Blob(this.chunks, { type: this.mime });
            const a = document.createElement('a');
            const d = new Date(), pad = n => String(n).padStart(2, '0');
            const name = (document.title || 'zerkalius').replace(/[^\wА-Яа-яЁё.-]+/g, '-').slice(0, 40);
            a.download = `${name}-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.${ext}`;
            a.href = URL.createObjectURL(blob);
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 30000);
            this.chunks = [];
        }
    };

    function build() {
        if (document.getElementById('zerkRecBtn')) return;
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
                background: rgba(0,0,0,.65); padding: 3px 8px; border-radius: 3px; }`;
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
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
    else build();
})();
