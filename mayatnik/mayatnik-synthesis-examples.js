/* Маятник · Синтез 0.012. Настройки примеров для ссылок и роликов. */
(function (root) {
  'use strict';

  const example = (id, label, settings, prefs) => ({ id, label, settings, prefs });
  const chaos = (id, label, settings, chaosVertices, chaosJump, chaosNoRepeat = false, chaosBatch = 32) =>
    example(id, label, settings, { fractalKind: 'chaos', chaosVertices, chaosJump, chaosNoRepeat, chaosBatch, chaosSeed: 1 });
  const cellular = (id, label, cellularRule, cellularSeed = 'single', cellularBits = '') => {
    const seed = cellularSeed === 'captured' ? cellularBits : cellularSeed === 'pair' ? '101' : '1';
    return example(id, label, 'Старт ' + seed + ' · 64 строки',
      { fractalKind: 'cellular', fractalDepth: 6, cellularRule, cellularSeed, cellularBits });
  };

  const examples = [
    example('arrowhead', 'Стрелка Серпинского', 'Глубина 4 · 81 отрезок', { fractalKind: 'arrowhead', fractalDepth: 4 }),
    example('rule90', 'Треугольник Серпинского', 'Правило 90 · 16 строк', { fractalKind: 'rule90', fractalDepth: 4 }),
    chaos('chaos-triangle', 'Игра хаоса · треугольник', '3 вершины · прыжок 1/2', 3, .5),
    chaos('chaos-square', 'Игра хаоса · квадрат', '4 вершины · прыжок 1/2 · с повторами', 4, .5),
    chaos('chaos-square-no-repeat', 'Квадрат без повторов', '4 вершины · прыжок 1/2 · без повторов', 4, .5, true),
    chaos('chaos-pentagon', 'Игра хаоса · пятиугольник', '5 вершин · прыжок 61,8%', 5, .618),
    chaos('chaos-fifths-half', 'Квинтовый круг · прыжок 1/2', '12 вершин · прыжок 1/2', 12, .5),
    chaos('chaos-fifths', 'Квинтовый круг · прыжок 4/5', '12 вершин · прыжок 4/5', 12, .8),
    chaos('chaos-fifths-notes', 'Квинтовый круг · каждый прыжок', '12 вершин · прыжок 4/5 · одна точка за шаг', 12, .8, false, 1),
    cellular('deckard-231123', 'Deckard 231123', '231123'),
    cellular('deckard-222111', 'Deckard 222111', '222111'),
    cellular('wolfram-30', 'Правило 30', 30),
    cellular('wolfram-90', 'Правило 90', 90),
    cellular('wolfram-110', 'Правило 110', 110),
    cellular('wolfram-150', 'Правило 150', 150),
    cellular('wolfram-204', 'Правило 204', 204),
    cellular('sum-mod-3', 'Сумма по модулю 3', 'sum3'),
    cellular('cellular-two', 'Правило 90 · две точки', 90, 'pair'),
    cellular('cellular-custom', 'Правило 150 · свой ряд', 150, 'captured', '101101001')
  ];

  if (typeof module === 'object' && module.exports) module.exports = examples;
  else {
    const libraryId = new URLSearchParams(location.hash.slice(1)).get('synthesis');
    const id = new URLSearchParams(location.search).get('synthExample');
    root.MayatnikSynthesisExample = libraryId ? null : examples.find(entry => entry.id === id) || null;
  }
})(globalThis);
