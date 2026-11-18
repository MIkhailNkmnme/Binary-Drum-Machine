/* Вольфрам · Простые программы v0.002. Synchronous elementary CA, infinite background. */
(() => {
  "use strict";
  const byId = id => document.getElementById(id);
  const canvas = byId("field"), context = canvas.getContext("2d", {alpha: false});
  const ruleInput = byId("rule-number"), stepInput = byId("step-count"), scaleInput = byId("cell-scale");
  const descriptions = {
    254: {page: 23, text: "Сплошной растущий треугольник. Клетка становится чёрной, если на предыдущем шаге чёрной была она сама, её левый или правый сосед. Это ИЛИ трёх клеток; схема правила — на странице 24."},
    250: {page: 25, text: "Шахматный узор. Новая клетка чёрная, если хотя бы один из двух соседей был чёрным. Собственное прежнее состояние не учитывается: два белых соседа дают белую клетку."},
    90: {page: 25, text: "Вложенные треугольники. Новая клетка чёрная, если ровно один из двух соседей был чёрным. Это XOR левого и правого соседей; обе чёрные или обе белые клетки дают белую."},
    30: {page: 27, text: "Нерегулярный узор из одной чёрной клетки. Если сама клетка и её правый сосед были белыми, берётся прежний цвет левого соседа; иначе — противоположный ему. Простота правила здесь не означает простоты результата."},
    110: {page: 31, text: "Упорядоченный фон и взаимодействующие структуры. Результат чёрный, кроме троек 111, 100 и 000. В книге после примерно 2780 шагов остаётся структура, повторяющая поведение через 240 шагов; чтобы проследить её, задайте 3200 шагов."}
  };
  const clampNumber = (input, fallback, min, max) => {
    const value = input.valueAsNumber;
    return Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback;
  };
  const query = new URLSearchParams(location.search);
  let rule = 30, target = 256, scale = 2, fitted = true;
  if (query.has("rule") && /^\d+$/.test(query.get("rule"))) rule = Math.max(0, Math.min(255, Number(query.get("rule"))));
  if (query.has("steps") && /^\d+$/.test(query.get("steps"))) target = Math.max(1, Math.min(4096, Number(query.get("steps"))));
  if (query.has("scale") && /^\d+$/.test(query.get("scale"))) scale = Math.max(1, Math.min(12, Number(query.get("scale"))));
  if (query.get("fit") === "0") fitted = false;
  let current, next, width, completed = 0, background = 0, running = false, frame = null, failed = false;
  const transitions = [];

  // Each button toggles the output for exactly one neighbourhood, 111 through 000.
  for (let index = 7; index >= 0; index--) {
    const entry = document.createElement("div");
    entry.className = "rule-entry";
    const neighbours = document.createElement("div");
    neighbours.className = "neighbours";
    neighbours.setAttribute("aria-hidden", "true");
    const bits = index.toString(2).padStart(3, "0");
    for (const bit of bits) {
      const cell = document.createElement("span");
      cell.className = "bit" + (bit === "1" ? " black" : "");
      cell.textContent = bit;
      neighbours.append(cell);
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gz-hx rule-result";
    button.dataset.userLabel = "";
    const output = document.createElement("span");
    output.className = "bit";
    button.append(output);
    button.addEventListener("click", () => {
      chooseRule(rule ^ (1 << index));
      if (button.getAttribute("aria-pressed") === "false") button.dataset.pointerOff = "";
    });
    button.addEventListener("pointerleave", () => { delete button.dataset.pointerOff; });
    entry.append(neighbours, button);
    byId("rule-table").append(entry);
    transitions.push({index, bits, button, output});
  }

  function controls() {
    ruleInput.value = rule;
    stepInput.value = target;
    scaleInput.value = scale;
    for (const button of document.querySelectorAll("[data-rule]")) {
      button.setAttribute("aria-pressed", String(Number(button.dataset.rule) === rule));
    }
    for (const {index, bits, button, output} of transitions) {
      const value = (rule >> index) & 1;
      output.textContent = value;
      output.classList.toggle("black", value === 1);
      button.setAttribute("aria-pressed", String(value === 1));
      button.title = "Тройка " + bits + ": результат " + value + ". Нажать, чтобы переключить.";
      button.setAttribute("aria-label", button.title);
    }
    const description = descriptions[rule];
    byId("rule-description").textContent = description?.text ?? "Произвольное элементарное правило " + rule + ". Восемь выходных битов заданы таблицей ниже. Окружение обновляется тем же правилом, даже если белый фон становится чёрным.";
    const page = description?.page ?? 23;
    byId("rule-reading").href = "reader.html#p" + page;
    byId("rule-reading").textContent = "Описание в главе · с. " + page;
    byId("play-label").textContent = running ? "Пауза" : "Пуск";
    byId("play").setAttribute("aria-pressed", String(running));
    byId("play").title = running ? "Приостановить построение" : "Продолжить построение до выбранного числа шагов";
    byId("play").setAttribute("aria-label", byId("play").title);
    byId("play").disabled = failed || completed >= target;
    byId("step").disabled = failed || running || completed >= target;
    byId("fit").setAttribute("aria-pressed", String(fitted));
  }

  function progress() {
    if (failed) {
      byId("progress").textContent = "Правило " + rule + " · поле не создано · запрошено " + target + " шагов.";
      return;
    }
    byId("progress").textContent = "Правило " + rule + " · шаг " + completed + " / " + target + " · " + width + " столбцов · " +
      (running ? "построение" : completed === target ? "готово" : completed ? "пауза" : "одна чёрная клетка") +
      " · фон текущего ряда: " + (background ? "чёрный" : "белый");
    canvas.setAttribute("aria-label", "Клеточный автомат, правило " + rule + ". Выполнено " + completed + " шагов из " + target + ". Шаг 0 содержит одну чёрную клетку.");
  }

  function fitCanvas() {
    const available = byId("canvas-window").clientWidth;
    const ratio = fitted && available > 0 ? Math.min(scale, available / width) : scale;
    canvas.style.width = width * ratio + "px";
    canvas.style.height = (target + 1) * ratio + "px";
  }

  function pause() {
    running = false;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    controls();
    progress();
  }

  function saveAddress() {
    try {
      const address = new URL(location.href);
      address.searchParams.set("rule", rule);
      address.searchParams.set("steps", target);
      address.searchParams.set("scale", scale);
      address.searchParams.set("fit", fitted ? "1" : "0");
      history.replaceState(null, "", address);
    } catch { /* Local file viewing can forbid history changes. */ }
  }

  function canvasFailure() {
    failed = true;
    running = false;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    // Release a possibly oversized backing store instead of retaining a blank field.
    canvas.width = 1;
    canvas.height = 1;
    canvas.hidden = true;
    const message = byId("canvas-error");
    message.textContent = context
      ? "Браузер не смог создать или обновить поле на " + target + " шагов (" + width + " × " + (target + 1) + " клеток). Уменьшите число шагов и нажмите «Сброс». Например, начните с 512. Чтение главы доступно ниже."
      : "В этом браузере недоступен двумерный canvas. Откройте лабораторию в другом браузере; перевод главы и PDF доступны ниже.";
    message.hidden = false;
    controls();
    progress();
  }

  function reset() {
    running = false;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    completed = 0;
    background = 0;
    failed = false;
    width = 2 * target + 1;
    current = new Uint8Array(width);
    next = new Uint8Array(width);
    current[target] = 1;
    try {
      if (!context) throw new Error("Canvas unavailable");
      canvas.width = width;
      canvas.height = target + 1;
      context.fillStyle = "#fff";
      context.fillRect(0, 0, width, target + 1);
      // Some devices silently reject oversized canvas buffers. A single-pixel
      // readback forces allocation and detects a blank/lost context at runtime.
      const sample = context.getImageData(0, 0, 1, 1).data;
      if (context.isContextLost?.() || sample[0] !== 255 || sample[3] !== 255) throw new Error("Canvas allocation failed");
      context.fillStyle = "#000";
      context.fillRect(target, 0, 1, 1);
      canvas.hidden = false;
      byId("canvas-error").hidden = true;
    } catch {
      canvasFailure();
      saveAddress();
      return;
    }
    byId("canvas-window").scrollLeft = 0;
    byId("canvas-window").scrollTop = 0;
    fitCanvas();
    controls();
    progress();
    saveAddress();
  }

  function chooseRule(value) {
    rule = value;
    reset();
  }

  function advance(count) {
    if (failed) return;
    count = Math.min(count, target - completed);
    if (!count) return;
    try {
      if (context.isContextLost?.()) throw new Error("Canvas context lost");
      const pixels = context.createImageData(width, count);
      for (let row = 0; row < count; row++) {
        for (let x = 0; x < width; x++) {
          const left = x ? current[x - 1] : background;
          const self = current[x];
          const right = x + 1 < width ? current[x + 1] : background;
          next[x] = (rule >> ((left << 2) | (self << 1) | right)) & 1;
          const offset = (row * width + x) * 4;
          const shade = next[x] ? 0 : 255;
          pixels.data[offset] = shade;
          pixels.data[offset + 1] = shade;
          pixels.data[offset + 2] = shade;
          pixels.data[offset + 3] = 255;
        }
        // Outside the light cone the row remains uniform, but its bit can change.
        background = (rule >> (background ? 7 : 0)) & 1;
        [current, next] = [next, current];
      }
      context.putImageData(pixels, 0, completed + 1);
      completed += count;
      progress();
    } catch { canvasFailure(); }
  }

  function animate() {
    frame = null;
    if (!running) return;
    advance(8);
    if (failed) return;
    if (completed >= target) pause();
    else frame = requestAnimationFrame(animate);
  }

  for (const button of document.querySelectorAll("[data-rule]")) {
    button.addEventListener("click", () => chooseRule(Number(button.dataset.rule)));
  }
  ruleInput.addEventListener("change", () => chooseRule(clampNumber(ruleInput, rule, 0, 255)));
  stepInput.addEventListener("change", () => { target = clampNumber(stepInput, target, 1, 4096); reset(); });
  scaleInput.addEventListener("change", () => {
    scale = clampNumber(scaleInput, scale, 1, 12);
    fitted = false;
    fitCanvas();
    controls();
    saveAddress();
  });
  byId("step").addEventListener("click", () => { if (!running) { advance(1); controls(); } });
  byId("play").addEventListener("click", event => {
    if (running) {
      pause();
      if (event.detail) byId("play").dataset.pointerOff = "";
    } else if (!failed && completed < target) {
      running = true;
      controls();
      frame = requestAnimationFrame(animate);
    }
  });
  byId("play").addEventListener("pointerleave", () => { delete byId("play").dataset.pointerOff; });
  byId("reset").addEventListener("click", reset);
  byId("fit").addEventListener("click", event => {
    fitted = !fitted;
    if (!fitted && event.detail) byId("fit").dataset.pointerOff = "";
    fitCanvas();
    controls();
    saveAddress();
  });
  byId("fit").addEventListener("pointerleave", () => { delete byId("fit").dataset.pointerOff; });
  byId("embed-reader").addEventListener("click", () => {
    const host = byId("reader-host");
    const open = host.hidden;
    if (open && !host.firstElementChild) {
      const reader = document.createElement("iframe");
      reader.src = "reader.html#p23";
      reader.title = "Неофициальный русский перевод: Решающий эксперимент";
      reader.loading = "lazy";
      host.append(reader);
    }
    host.hidden = !open;
    byId("embed-reader").setAttribute("aria-expanded", String(open));
    byId("embed-reader").setAttribute("aria-label", open ? "Скрыть встроенный перевод" : "Показать перевод на этой странице");
    byId("embed-reader").title = open ? "Скрыть встроенный перевод" : "Открыть перевод внутри этой страницы; он загружается только после нажатия";
    byId("reader-label").textContent = open ? "Скрыть чтение" : "Читать здесь";
  });
  canvas.addEventListener("contextlost", event => {
    event.preventDefault();
    if (!failed) canvasFailure();
  });
  new ResizeObserver(fitCanvas).observe(byId("canvas-window"));
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
  window.addEventListener("pagehide", pause);
  reset();
})();
