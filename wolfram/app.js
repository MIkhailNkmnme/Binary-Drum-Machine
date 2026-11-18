/* Зеркалиус · Вольфрам v0.001. UI owns view/persistence; engine owns every field update. */
(() => {
  "use strict";
  const STORAGE_KEY = "zerk_wolfram_cone_lab_v1";
  const DEFAULTS = {rows: 128, steps: 64, rule: 90, retain: true, updating: "sweep", route: "pend"};
  const byId = id => document.getElementById(id);
  const canvas = byId("field");
  let context = null;
  try { context = canvas.getContext("2d", {alpha: false}); } catch { /* Report below, keep articles available. */ }
  let config = {...DEFAULTS}, fitted = true, scale = 2;
  let engine = null, pixels = null, running = false, frameRequest = null, lastTime = null, failed = false;
  const INTERVAL = 80;
  const EMPTY = [16, 26, 36];
  const table = [];
  const integer = (value, fallback, min, max) => {
    const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
    return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback;
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.version === 1 && saved.config && typeof saved.config === "object") {
      for (const key of Object.keys(DEFAULTS)) if (Object.hasOwn(saved.config, key)) config[key] = saved.config[key];
      fitted = saved.view?.fit !== false;
      scale = integer(saved.view?.scale, 2, 1, 8);
    }
  } catch { /* A missing or unreadable saved state uses this lab's own defaults. */ }

  const ruleNotes = {
    90: "Таблица 90: XOR левого и правого верхних соседей; верхний центр не влияет.",
    30: "Таблица 30: левый верхний бит XOR (верхний центр ИЛИ правый верхний бит).",
    110: "Таблица 110: выход 1, кроме верхних троек 111, 100 и 000.",
    150: "Таблица 150: XOR всех трёх клеток верхнего ряда.",
    60: "Таблица 60: XOR левого верхнего бита и верхнего центра."
  };
  const routeNames = {pend: "влево-вправо", pendR: "вправо-влево", left: "влево", right: "вправо", one: "повтор одной вершины"};

  for (let index = 7; index >= 0; index--) {
    const item = document.createElement("div");
    item.className = "transition";
    const triple = document.createElement("div");
    triple.className = "triple";
    triple.setAttribute("aria-hidden", "true");
    const bits = index.toString(2).padStart(3, "0");
    for (const value of bits) {
      const cell = document.createElement("span");
      cell.className = "bit" + (value === "1" ? " black" : "");
      cell.textContent = value;
      triple.append(cell);
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gz-hx";
    button.dataset.userLabel = "";
    const output = document.createElement("span");
    output.className = "bit";
    button.append(output);
    button.addEventListener("click", event => {
      config = {...config, rule: config.rule ^ (1 << index)};
      reset();
      if (event.detail && button.getAttribute("aria-pressed") === "false") button.dataset.pointerOff = "";
    });
    button.addEventListener("pointerleave", () => { delete button.dataset.pointerOff; });
    item.append(triple, button);
    byId("transitions").append(item);
    table.push({index, bits, button, output});
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({version: 1, config, view: {fit: fitted, scale}}));
      byId("save-note").textContent = "";
    } catch {
      byId("save-note").textContent = "Настройки не удалось сохранить в браузере. В этой вкладке они продолжают действовать.";
    }
  }

  function transport() {
    const complete = !!engine && engine.frame >= config.steps;
    byId("step").disabled = failed || !engine || running || complete;
    byId("play").disabled = failed || !engine || complete;
    byId("play").setAttribute("aria-pressed", String(running));
    byId("play-label").textContent = running ? "Пауза" : "Пуск";
    byId("play-icon").textContent = running ? "Ⅱ" : "▶";
    byId("play").title = running ? "Приостановить выполнение после текущего полного прохода" : "Начать или продолжить последовательное выполнение проходов";
    byId("play").setAttribute("aria-label", byId("play").title);
    byId("fit").setAttribute("aria-pressed", String(fitted));
  }

  function controls() {
    for (const id of ["rule", "rows", "steps", "updating", "route"]) byId(id).value = config[id];
    byId("scale").value = scale;
    byId("route").title = "Маршрут вершин: " + routeNames[config.route] + ".";
    byId("updating").title = config.updating === "sweep"
      ? "Чтение по ходу: верхний ряд из общего поля, включая уже пересчитанные клетки"
      : "Чтение снимка: все входы фиксируются в начале прохода после временной установки вершины";
    byId("retain").setAttribute("aria-pressed", String(config.retain));
    byId("retain").title = config.retain
      ? "Накопление включено: старое значение целевой клетки XOR результат локального правила"
      : "Накопление выключено: результат локального правила заменяет значение целевой клетки";
    byId("retain").setAttribute("aria-label", byId("retain").title + ". Нажать, чтобы переключить.");
    const kernel = config.rule === 90 && config.retain && config.updating === "sweep";
    for (const button of document.querySelectorAll("[data-preset]")) {
      const number = Number(button.dataset.preset);
      button.setAttribute("aria-pressed", String(number === 90 ? kernel && config.route === "pend" : config.rule === number));
    }
    for (const {index, bits, button, output} of table) {
      const value = (config.rule >> index) & 1;
      output.textContent = value;
      output.classList.toggle("black", value === 1);
      button.setAttribute("aria-pressed", String(value === 1));
      button.title = "Верхний ряд " + bits + ": результат локального правила " + value + ". Нажать, чтобы переключить.";
      button.setAttribute("aria-label", button.title);
    }
    byId("model-status").textContent = (kernel
      ? config.route === "pend" ? "Базовый Маятник: исходный XOR-переход и обычный маршрут вершин. " : "Исходный XOR-переход Маятника; маршрут изменён: " + routeNames[config.route] + ". "
      : "Гибридная конусная модель: правило " + config.rule + ", " + (config.retain ? "с накоплением" : "без накопления") + ", " +
        (config.updating === "sweep" ? "пересчёт по ходу" : "чтение снимка") + ". ") +
      (ruleNotes[config.rule] ?? "Восемь выходных битов задаёт таблица ниже.");
    transport();
  }

  function progress() {
    if (!engine || failed) {
      byId("progress").textContent = "Поле недоступно. Статьи и настройки остаются доступны.";
      return;
    }
    const {W, H} = engine.field;
    byId("progress").textContent = "Проход " + engine.frame + " / " + config.steps + " · поле " + W + " × " + H +
      " · якорь X=" + engine.anchor + " · " + (running ? "выполнение" : engine.frame === config.steps ? "готово" : engine.frame ? "пауза" : "пока пусто");
    canvas.setAttribute("aria-label", "Конусное поле, локальное правило " + config.rule + ". Выполнено " + engine.frame +
      " полных проходов из " + config.steps + ". Размер " + W + " на " + H + ". Пустые клетки тёмные, нули белые, единицы чёрные.");
  }

  function stop() {
    running = false;
    if (frameRequest !== null) cancelAnimationFrame(frameRequest);
    frameRequest = null;
    lastTime = null;
  }

  function pause() { stop(); transport(); progress(); }

  function failure(message) {
    stop();
    failed = true;
    pixels = null;
    canvas.hidden = true;
    canvas.width = 1;
    canvas.height = 1;
    byId("error").textContent = message;
    byId("error").hidden = false;
    transport();
    progress();
  }

  function fitCanvas() {
    if (!engine || failed) return;
    const host = byId("canvas-window"), {W, H} = engine.field;
    const ratio = fitted ? Math.min(scale, host.clientWidth / W, host.clientHeight / H) : scale;
    if (!(ratio > 0)) return;
    canvas.style.width = W * ratio + "px";
    canvas.style.height = H * ratio + "px";
  }

  function draw() {
    const {W, H, val} = engine.field;
    if (context.isContextLost?.()) throw new Error("Canvas context lost");
    for (let index = 0; index < val.length; index++) {
      const offset = index * 4, value = val[index];
      pixels.data[offset] = value < 0 ? EMPTY[0] : value === 1 ? 0 : 255;
      pixels.data[offset + 1] = value < 0 ? EMPTY[1] : value === 1 ? 0 : 255;
      pixels.data[offset + 2] = value < 0 ? EMPTY[2] : value === 1 ? 0 : 255;
      pixels.data[offset + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);
    progress();
  }

  function reset() {
    stop();
    failed = false;
    engine = null;
    try {
      if (typeof window.ZerkWolframEngine !== "function") throw new Error("Engine unavailable");
      engine = new window.ZerkWolframEngine(config);
      config = {...engine.config};
      controls();
      save();
      if (!context) throw new Error("Canvas unavailable");
      const {W, H, val} = engine.field;
      // Defense in depth: the engine's current contract is at most 1022 × 256.
      if (!Number.isInteger(W) || !Number.isInteger(H) || W < 1 || H < 1 || W > 2048 || H > 512 || W * H > 1048576 || val.length !== W * H) {
        throw new Error("Canvas size rejected");
      }
      canvas.width = W;
      canvas.height = H;
      pixels = context.createImageData(W, H);
      draw();
      // A tiny runtime readback catches a silently rejected or lost backing store.
      const first = context.getImageData(0, 0, 1, 1).data;
      if (first[0] !== EMPTY[0] || first[1] !== EMPTY[1] || first[2] !== EMPTY[2] || first[3] !== 255) throw new Error("Canvas allocation failed");
      byId("error").hidden = true;
      canvas.hidden = false;
      byId("canvas-window").scrollLeft = 0;
      byId("canvas-window").scrollTop = 0;
      fitCanvas();
    } catch {
      failure(!engine ? "Не удалось загрузить движок лаборатории. Перезагрузите страницу; статьи доступны ниже."
        : !context ? "Браузер не предоставляет двумерный canvas. Откройте лабораторию в другом браузере; статьи доступны ниже."
        : "Не удалось подготовить или нарисовать поле. Уменьшите глубину и число проходов, затем нажмите «Сброс». Статьи остаются доступны.");
    }
    controls();
    progress();
  }

  function advance() {
    if (!engine || failed || engine.frame >= config.steps) return;
    try {
      if (!engine.step()) { pause(); return; }
      draw();
      if (engine.frame >= config.steps) pause();
      else transport();
    } catch { failure("Не удалось выполнить или отобразить проход. Уменьшите глубину и число проходов, затем начните опыт заново кнопкой «Сброс»."); }
  }

  function animate(time) {
    frameRequest = null;
    if (!running || failed) return;
    if (lastTime === null || time - lastTime >= INTERVAL) { lastTime = time; advance(); }
    if (running) frameRequest = requestAnimationFrame(animate);
  }

  for (const button of document.querySelectorAll("[data-preset]")) button.addEventListener("click", () => {
    const rule = Number(button.dataset.preset);
    config = rule === 90 ? {...config, rule, retain: true, updating: "sweep", route: "pend"} : {...config, rule};
    reset();
  });
  for (const [id, min, max] of [["rule", 0, 255], ["rows", 8, 256], ["steps", 1, 512]]) byId(id).addEventListener("change", () => {
    config = {...config, [id]: integer(byId(id).value, config[id], min, max)};
    reset();
  });
  for (const id of ["route", "updating"]) byId(id).addEventListener("change", () => {
    config = {...config, [id]: byId(id).value};
    reset();
  });
  byId("retain").addEventListener("click", event => {
    config = {...config, retain: !config.retain};
    reset();
    if (!config.retain && event.detail) byId("retain").dataset.pointerOff = "";
  });
  byId("retain").addEventListener("pointerleave", () => { delete byId("retain").dataset.pointerOff; });
  byId("step").addEventListener("click", () => { if (!running) advance(); });
  byId("play").addEventListener("click", event => {
    if (running) {
      pause();
      if (event.detail) byId("play").dataset.pointerOff = "";
    } else if (engine && !failed && engine.frame < config.steps) {
      running = true;
      lastTime = null;
      transport();
      progress();
      frameRequest = requestAnimationFrame(animate);
    }
  });
  byId("play").addEventListener("pointerleave", () => { delete byId("play").dataset.pointerOff; });
  byId("reset").addEventListener("click", reset);
  byId("fit").addEventListener("click", event => {
    fitted = !fitted;
    if (!fitted && event.detail) byId("fit").dataset.pointerOff = "";
    fitCanvas(); transport(); save();
  });
  byId("fit").addEventListener("pointerleave", () => { delete byId("fit").dataset.pointerOff; });
  byId("scale").addEventListener("change", () => {
    scale = integer(byId("scale").value, scale, 1, 8);
    byId("scale").value = scale;
    fitted = false;
    fitCanvas(); transport(); save();
  });
  canvas.addEventListener("contextlost", event => {
    event.preventDefault();
    if (!failed) failure("Браузер потерял контекст рисования. Уменьшите размеры поля и нажмите «Сброс» или перезагрузите страницу.");
  });
  new ResizeObserver(fitCanvas).observe(byId("canvas-window"));
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
  window.addEventListener("pagehide", pause);
  reset();
})();
