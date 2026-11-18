/* Зеркалиус · Вольфрам: конусные проходы Маятника с таблицей правил 0–255.
   Подключается после mayatnik/mayatnik-core.js. Только вычисление поля:
   конструктор не строит кадры, step() не запускает таймеры и не рисует.
   Это обобщение нашего конусного прохода, а не обычный одномерный КА. */
(() => {
  'use strict';

  const MAX_ROWS = 256;
  const MAX_STEPS = 512;
  const ROUTES = ['pend', 'pendR', 'left', 'right', 'one'];

  function integer(value, fallback, min, max) {
    const number = typeof value === 'number' ? value
      : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
    return Number.isFinite(number)
      ? Math.max(min, Math.min(max, Math.trunc(number))) : fallback;
  }

  function boolean(value, fallback) {
    if (value === true || value === 1 || value === 'true' || value === '1') return true;
    if (value === false || value === 0 || value === 'false' || value === '0') return false;
    return fallback;
  }

  function normalize(input) {
    const config = input && typeof input === 'object' ? input : {};
    return Object.freeze({
      rows: integer(config.rows, 128, 8, MAX_ROWS),
      steps: integer(config.steps, 64, 1, MAX_STEPS),
      rule: integer(config.rule, 90, 0, 255),
      retain: boolean(config.retain, true),
      updating: config.updating === 'snapshot' ? 'snapshot' : 'sweep',
      route: ROUTES.includes(config.route) ? config.route : 'pend'
    });
  }

  // Пустая клетка (-1) и отсутствие соседа за краем поля дают входной бит 0.
  function bit(values, row, column, width) {
    return column >= 0 && column < width && values[row + column] === 1 ? 1 : 0;
  }

  function generalizedCone(field, apexColumn, config) {
    const { W, H, val } = field;
    if (val[apexColumn] === -1) val[apexColumn] = 1;
    const apex = val[apexColumn];

    // Как в Core.cone: родитель первого ряда временно равен 1 даже тогда,
    // когда сохранённый бит вершины равен 0. После первого ряда он вернётся.
    val[apexColumn] = 1;
    // Снимок фиксирует все входы кадра после установки временной вершины.
    // Строки ниже вершины здесь ещё содержат исключительно прошлые значения.
    const source = config.updating === 'snapshot' ? val.slice() : val;
    const last = Math.min(config.rows, H);

    for (let r = 1; r < last; r++) {
      const row = r * W;
      const up = row - W;
      const first = apexColumn - r;
      const end = Math.min(W - 1, apexColumn + r);
      let c = Math.max(0, first);
      if ((c - first) % 2 !== 0) c++;

      // Только клетки маски конуса, через одну. Промежутки не перезаписываем.
      for (; c <= end; c += 2) {
        const L = bit(source, up, c - 1, W);
        const C = bit(source, up, c, W);
        const R = bit(source, up, c + 1, W);
        const index = (L << 2) | (C << 1) | R;
        const next = (config.rule >> index) & 1;
        const i = row + c;
        const old = val[i] === 1 ? 1 : 0;
        val[i] = config.retain ? old ^ next : next;
      }
      if (r === 1) val[apexColumn] = apex;
    }
  }

  class ZerkWolframEngine {
    constructor(config) {
      // MAYATNIK объявлен через const: это глобальная lexical binding,
      // а не свойство window. Ядро остаётся единственным источником геометрии.
      const Core = typeof MAYATNIK !== 'undefined' ? MAYATNIK : null;
      if (!Core || typeof Core.geometry !== 'function' || typeof Core.offset !== 'function'
          || typeof Core.field !== 'function' || typeof Core.cone !== 'function') {
        throw new Error('Сначала подключите mayatnik/mayatnik-core.js.');
      }
      this.config = normalize(config);
      const { rows, steps, route } = this.config;
      const { W, anchor } = Core.geometry(route, steps, rows);
      const maxWidth = 2 * (MAX_ROWS - 1) + MAX_STEPS;
      if (!Number.isInteger(W) || W < 1 || W > maxWidth
          || !Number.isInteger(anchor) || anchor < 0 || anchor >= W) {
        throw new RangeError('Некорректная геометрия поля Маятника.');
      }
      this.field = Core.field(W, rows, 'empty', anchor);
      this.anchor = anchor;
      this.frame = 0;
      this._core = Core;
    }

    step() {
      const config = this.config;
      if (this.frame >= config.steps) return false;
      // one намеренно повторяет одну вершину, offset=0, до лимита steps.
      const apexColumn = this.anchor + this._core.offset(config.route, this.frame);
      if (config.rule === 90 && config.retain && config.updating === 'sweep') {
        // Эталонный режим исполняет сам Core, без второй реализации XOR.
        this._core.cone(this.field, apexColumn, config.rows);
      } else {
        generalizedCone(this.field, apexColumn, config);
      }
      this.frame++;
      return true;
    }
  }

  window.ZerkWolframEngine = ZerkWolframEngine;
})();
