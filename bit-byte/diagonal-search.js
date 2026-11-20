(() => {
  "use strict";
  const byId = name => document.getElementById("chess-search-" + name);
  const input = byId("input"), status = byId("status"), storageNote = byId("storage");
  const gallery = byId("frames"), KEY = "zerk-bit-diagonal-search-v1", LIMIT = 100;
  const MAYATNIK_PRESETS = [30, 60, 90, 102, 150, "initial"];
  let mayatnikPreset = null;
  const records = new Map(), frameNumbers = new Map(), pending = new Set(), dismissed = new Set();
  let enabled = false, queries = [], targets = new Map(), ready = false, database;
  let lastSignature = "", lastFrame = 0, storageError = "";

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("zerk-bit-byte-search-v1", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("frames");
      request.onerror = () => reject(request.error);
      request.onblocked = () => { storageNote.textContent = "Хранилище ожидает закрытия другой вкладки Bit-Byte."; };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
    });
  }
  async function transact(mode, operation) {
    const db = await database;
    return new Promise((resolve, reject) => {
      const tx = db.transaction("frames", mode);
      let result;
      const request = operation(tx.objectStore("frames"));
      request.onsuccess = () => { result = request.result; };
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(tx.error || Error("Запись кадра прервана"));
    });
  }
  function makeFrameStore() {
    return window.MayatnikSearchFrameStore.create({
      storage: async () => ({
        read: key => transact("readonly", store => store.get(key)),
        write: (value, key) => transact("readwrite", store => store.put(value, key)),
      }),
      capture: () => { throw Error("Снимок текущего кадра не передан"); },
    });
  }
  let frameStore = makeFrameStore();
  function storageStatus() {
    storageNote.textContent = storageError || ("Сохранено кадров: " + records.size + "/" + LIMIT +
      (pending.size ? " · записывается: " + pending.size : "") +
      (records.size >= LIMIT ? ". Лимит достигнут: скачайте и удалите ненужные кадры для новых находок." : "."));
  }
  function savePreferences() {
    try { localStorage.setItem(KEY, JSON.stringify({text: input.value, enabled, mayatnikPreset})); }
    catch (_) { storageError = "Настройки поиска не удалось сохранить. Найденные кадры сохраняются отдельно."; storageStatus(); }
  }
  function controls() {
    byId("start").setAttribute("aria-pressed", String(enabled));
    byId("stop").disabled = !enabled;
    const button = byId("mayatnik");
    const next = MAYATNIK_PRESETS[(MAYATNIK_PRESETS.indexOf(mayatnikPreset) + 1) % MAYATNIK_PRESETS.length];
    const name = value => value === "initial" ? "Начальная" : String(value);
    button.querySelector(".gz-nm").textContent = mayatnikPreset === "initial" ? "Начальная" :
      "Маятнкъ" + (mayatnikPreset === null ? "" : " " + mayatnikPreset);
    button.title = (mayatnikPreset === null ? "Последовательности Маятника." : "Выбрано: " + name(mayatnikPreset) + ".") +
      " Следующее нажатие: " + name(next) + ". По кругу: 30 → 60 → 90 → 102 → 150 → Начальная." +
      " Правила: 320 полных строк от 1, до 639 битов; Начальная — исходные строки Маятника.";
    button.setAttribute("aria-label", button.title);
  }
  function setQueries(text) {
    const parsed = window.MayatnikSequences.parse(text);
    if (!parsed.length) throw Error("Введите хотя бы одну последовательность из 0 и 1.");
    if (parsed.some(word => word.length > 640)) throw Error("Диагональ поля содержит не более 640 битов. Укоротите искомую строку.");
    queries = parsed;
    targets = new Map();
    parsed.forEach((word, index) => {
      if (!targets.has(word)) targets.set(word, []);
      targets.get(word).push(index);
    });
  }
  function refresh() { window.BitByteChessSearch?.refresh(); }
  function apply() {
    try {
      setQueries(input.value);
      enabled = true; lastSignature = ""; dismissed.clear();
      status.textContent = "Поиск включён: строк в запросе — " + queries.length + ".";
    } catch (error) { enabled = false; status.textContent = error.message; }
    controls(); savePreferences(); refresh();
  }
  byId("start").addEventListener("click", apply);
  byId("stop").addEventListener("click", () => {
    enabled = false; status.textContent = "Поиск остановлен. Найденные кадры сохранены.";
    controls(); savePreferences(); refresh();
  });
  input.addEventListener("input", () => {
    enabled = false; lastSignature = ""; mayatnikPreset = null;
    status.textContent = "Последовательности изменены. Нажмите «Поиск», чтобы применить их.";
    controls(); savePreferences(); refresh();
  });
  byId("mayatnik").addEventListener("click", () => {
    try {
      const next = MAYATNIK_PRESETS[(MAYATNIK_PRESETS.indexOf(mayatnikPreset) + 1) % MAYATNIK_PRESETS.length];
      // Full elementary rows grow by two bits. 320 rows fit the 640-bit search limit.
      const rows = next === "initial" ? Array.from(ZZ_INITIAL_ROWS) :
        window.MayatnikSequences.elementary({rule: next, seed: "1", count: 320, compact: false});
      setQueries(rows.join("\n"));
      input.value = queries.join("\n");
      mayatnikPreset = next;
      apply();
    } catch (error) { status.textContent = error.message; }
  });

  function download(blob, name) {
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function button(label, title, icon, run) {
    const node = document.createElement("button");
    node.type = "button"; node.className = "gz-hx"; node.title = title; node.setAttribute("aria-label", title);
    const symbol = document.createElement("span"), text = document.createElement("span");
    symbol.className = "gz-ic"; symbol.setAttribute("aria-hidden", "true"); symbol.textContent = icon;
    text.className = "gz-nm"; text.textContent = label; node.append(symbol, text);
    node.addEventListener("click", run); return node;
  }
  function showRecord(key, stored, prepend = true) {
    const {record, snapshot} = stored, details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = new Date(record.frame).toLocaleString("ru-RU") + " · совпадений: " + record.finds.length +
      " · поле " + record.width + " × " + record.height;
    details.append(summary);
    const info = document.createElement("pre");
    info.textContent = record.finds.map(hit => "Диагональ " + (hit.p + 1) + ": " + hit.text).join("\n");
    const image = document.createElement("img");
    image.alt = "Поле в момент совпадения " + new Date(record.frame).toLocaleString("ru-RU");
    image.width = snapshot.pixelWidth; image.height = snapshot.pixelHeight;
    let previewUrl;
    details.addEventListener("toggle", () => {
      if (details.open && !previewUrl) {
        previewUrl = URL.createObjectURL(snapshot.blob); image.src = previewUrl;
      }
    });
    const actions = document.createElement("div"); actions.className = "commands";
    const basename = "bit-byte-found-" + record.frame;
    actions.append(
      button("PNG", "Скачать снимок найденного поля", "↓", () => download(snapshot.blob, basename + ".png")),
      button("JSON", "Скачать параметры поля, запрос и найденные координаты", "↓", () => {
        const {blob, ...imageInfo} = snapshot;
        download(new Blob([JSON.stringify({format: "bit-byte-found-frame-v1", record, snapshot: imageInfo}, null, 2)],
          {type: "application/json"}), basename + ".json");
      }),
      button("Удалть", "Удалить этот сохранённый кадр из истории браузера", "×", async event => {
        event.currentTarget.disabled = true;
        try {
          await transact("readwrite", store => store.delete(window.MayatnikSearchFrameStore.PREFIX + key));
          records.delete(key); frameNumbers.delete(key); dismissed.add(key); details.remove();
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          frameStore = makeFrameStore(); lastSignature = ""; storageError = ""; storageStatus();
        } catch (error) { event.target.closest("button").disabled = false; storageError = "Кадр не удалён: " + error.message; storageStatus(); }
      })
    );
    details.append(info, image, actions);
    if (prepend) gallery.prepend(details); else gallery.append(details);
  }

  async function remember(context, hits, signature, frozenCapture, sequence) {
    try {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(signature));
      const key = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
      if (records.has(key) || dismissed.has(key)) return;
      if (!frameNumbers.has(key)) {
        lastFrame = Math.max(context.capturedAt, lastFrame + 1);
        frameNumbers.set(key, lastFrame);
      }
      const frame = frameNumbers.get(key);
      const record = {frame, width: context.cols, height: context.rows, settings: context.settings,
        sequence, mode: context.mode, finds: hits, version: "0.024"};
      const stored = await frameStore.ensure(key, record, () => frozenCapture.then(snapshot => ({...snapshot, frame})));
      records.set(key, stored); showRecord(key, stored); storageError = "";
    } catch (error) {
      lastSignature = "";
      storageError = "Найденный кадр не сохранён: " + error.message + ". Нажмите «Поиск», чтобы повторить.";
    } finally { pending.delete(signature); storageStatus(); }
  }
  function update(context) {
    const hits = [];
    for (let index = 0; index < context.cells.length; index++) {
      const diagonal = context.first + index, text = context.lines[diagonal];
      const matched = enabled && targets.has(text);
      const row = context.cells[index].parentElement;
      row.classList.toggle("chess-search-match", matched);
      row.setAttribute("aria-label", "Диагональ " + (diagonal + 1) + (matched ? ": найдено совпадение" : ""));
      if (!matched) continue;
      const cells = [];
      for (let x = Math.max(0, diagonal - context.rows + 1); x <= Math.min(context.cols - 1, diagonal); x++) {
        const y = diagonal - x;
        if (context.bits[y * context.cols + x] !== 2) cells.push({x, y});
      }
      hits.push({i: targets.get(text)[0], queryRows: targets.get(text), p: diagonal, dir: "antidiagonal", text, cells});
    }
    if (!enabled) return;
    status.textContent = "Точных совпадений строк: " + hits.length + ". Поиск только целой строки той же длины.";
    if (!hits.length || !ready) return;
    const settings = {...context.settings}; delete settings.selected; delete settings.selectedIds;
    const signature = JSON.stringify([settings, queries]);
    if (signature === lastSignature || pending.has(signature)) return;
    if (records.size + pending.size >= LIMIT) {
      storageError = "Достигнут лимит 100 сохранённых и записываемых кадров. Новые совпадения подсвечиваются, но не сохраняются. Удалите ненужные кадры.";
      storageStatus(); return;
    }
    lastSignature = signature; pending.add(signature);
    let capture;
    try { capture = Promise.resolve(context.capture()); }
    catch (error) { capture = Promise.reject(error); }
    // Capture begins here, before hashing and any asynchronous storage work.
    capture.catch(() => {});
    remember({...context, settings, capturedAt: Date.now()}, hits, signature, capture, queries.slice()); storageStatus();
  }

  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && typeof saved.text === "string") {
      input.value = saved.text;
      if (MAYATNIK_PRESETS.includes(saved.mayatnikPreset)) mayatnikPreset = saved.mayatnikPreset;
      if (saved.enabled) { setQueries(input.value); enabled = true; }
    }
  } catch (error) { status.textContent = "Настройки поиска не восстановлены: " + error.message; }
  controls();
  window.BitByteDiagonalSearch = {update};
  database = openDatabase();
  (async () => {
    try {
      const db = await database;
      const saved = await new Promise((resolve, reject) => {
        const tx = db.transaction("frames", "readonly"), found = [];
        const request = tx.objectStore("frames").openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return;
          found.push([String(cursor.key).slice(window.MayatnikSearchFrameStore.PREFIX.length), cursor.value]); cursor.continue();
        };
        tx.oncomplete = () => resolve(found);
        tx.onerror = tx.onabort = () => reject(tx.error || Error("Не удалось прочитать историю"));
      });
      saved.sort((a, b) => b[1].record.frame - a[1].record.frame);
      for (const [key, value] of saved) {
        records.set(key, value); showRecord(key, value, false);
      }
      ready = true; storageStatus(); refresh();
    } catch (error) {
      storageError = "Хранилище кадров недоступно: " + error.message + ". Поиск и подсветка работают, кадры не сохраняются.";
      storageStatus();
    }
  })();
  // URLs live with this document (including BFCache); deleting a card revokes its preview.
})();
