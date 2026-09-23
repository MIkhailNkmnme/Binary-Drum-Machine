// копия LivelyProperties.json для страницы настройки
var LIVELY_PROPS = {
  "hdr1": {
    "text": "■ СЦЕНА",
    "type": "label",
    "value": "■ СЦЕНА"
  },
  "scene": {
    "text": "Сцена",
    "type": "dropdown",
    "value": 0,
    "items": [
      "Холм из пыли",
      "Треугольник Серпинского",
      "Топологический радар",
      "Воронка из колец"
    ]
  },
  "preset": {
    "text": "Готовый набор",
    "type": "dropdown",
    "value": 0,
    "items": [
      "— свой —",
      "Холм: туман",
      "Холм: крупные знаки",
      "Холм: пыль",
      "Холм: почти стоит",
      "Серпинский: к нам",
      "Серпинский: от нас",
      "Серпинский: крупный",
      "Радар: спокойный",
      "Радар: частая сетка",
      "Радар: редкий пульс"
    ]
  },
  "hdr2": {
    "text": "■ НАДПИСЬ И ЧАСЫ",
    "type": "label",
    "value": "■ НАДПИСЬ И ЧАСЫ"
  },
  "title": {
    "text": "Строка 1",
    "type": "textbox",
    "value": "Zerkalius"
  },
  "t1Size": {
    "text": "  строка 1: размер, %",
    "type": "slider",
    "min": 20,
    "max": 300,
    "tick": 281,
    "value": 100
  },
  "t1Font": {
    "text": "  строка 1: шрифт",
    "type": "dropdown",
    "value": 0,
    "items": [
      "Consolas",
      "Cascadia Mono",
      "Courier New",
      "Lucida Console",
      "OCR-A BT",
      "Bahnschrift",
      "Segoe UI",
      "Arial Black",
      "Impact",
      "Georgia",
      "Times New Roman"
    ]
  },
  "t1Space": {
    "text": "  строка 1: интервал между символами, %",
    "type": "slider",
    "min": -10,
    "max": 100,
    "tick": 111,
    "value": 0
  },
  "title2": {
    "text": "Строка 2 (пусто — не выводится)",
    "type": "textbox",
    "value": ""
  },
  "t2Size": {
    "text": "  строка 2: размер, %",
    "type": "slider",
    "min": 20,
    "max": 300,
    "tick": 281,
    "value": 100
  },
  "t2Font": {
    "text": "  строка 2: шрифт",
    "type": "dropdown",
    "value": 0,
    "items": [
      "Consolas",
      "Cascadia Mono",
      "Courier New",
      "Lucida Console",
      "OCR-A BT",
      "Bahnschrift",
      "Segoe UI",
      "Arial Black",
      "Impact",
      "Georgia",
      "Times New Roman"
    ]
  },
  "t2Space": {
    "text": "  строка 2: интервал между символами, %",
    "type": "slider",
    "min": -10,
    "max": 100,
    "tick": 111,
    "value": 0
  },
  "title3": {
    "text": "Строка 3 (пусто — не выводится)",
    "type": "textbox",
    "value": ""
  },
  "t3Size": {
    "text": "  строка 3: размер, %",
    "type": "slider",
    "min": 20,
    "max": 300,
    "tick": 281,
    "value": 100
  },
  "t3Font": {
    "text": "  строка 3: шрифт",
    "type": "dropdown",
    "value": 0,
    "items": [
      "Consolas",
      "Cascadia Mono",
      "Courier New",
      "Lucida Console",
      "OCR-A BT",
      "Bahnschrift",
      "Segoe UI",
      "Arial Black",
      "Impact",
      "Georgia",
      "Times New Roman"
    ]
  },
  "t3Space": {
    "text": "  строка 3: интервал между символами, %",
    "type": "slider",
    "min": -10,
    "max": 100,
    "tick": 111,
    "value": 0
  },
  "titleSize": {
    "text": "Размер надписи, %",
    "type": "slider",
    "min": 10,
    "max": 300,
    "tick": 291,
    "value": 100
  },
  "blockY": {
    "text": "Положение по вертикали, % экрана",
    "type": "slider",
    "min": 2,
    "max": 95,
    "tick": 94,
    "value": 22
  },
  "gapTC": {
    "text": "Расстояние до часов, %",
    "type": "slider",
    "min": 0,
    "max": 300,
    "tick": 301,
    "value": 100
  },
  "clock": {
    "text": "Показывать часы и дату",
    "type": "checkbox",
    "value": true
  },
  "clockSize": {
    "text": "Размер часов, %",
    "type": "slider",
    "min": 10,
    "max": 300,
    "tick": 291,
    "value": 100
  },
  "clockFont": {
    "text": "Шрифт часов",
    "type": "dropdown",
    "value": 0,
    "items": [
      "Consolas",
      "Cascadia Mono",
      "Courier New",
      "Lucida Console",
      "OCR-A BT",
      "Bahnschrift",
      "Segoe UI",
      "Arial Black",
      "Impact",
      "Georgia",
      "Times New Roman"
    ]
  },
  "clockSpace": {
    "text": "Интервал между символами часов, %",
    "type": "slider",
    "min": -10,
    "max": 100,
    "tick": 111,
    "value": 0
  },
  "hdr3": {
    "text": "■ ЦВЕТ",
    "type": "label",
    "value": "■ ЦВЕТ"
  },
  "color": {
    "text": "Цвет",
    "type": "color",
    "value": "#00ff6e"
  },
  "rainbow": {
    "text": "Радуга (цвет меняется)",
    "type": "checkbox",
    "value": false
  },
  "rainbowSpeed": {
    "text": "Скорость радуги",
    "type": "slider",
    "min": 1,
    "max": 100,
    "tick": 100,
    "value": 20
  },
  "contrast": {
    "text": "Контраст, %",
    "type": "slider",
    "min": 30,
    "max": 250,
    "tick": 221,
    "value": 100
  },
  "sat": {
    "text": "Цветность, %",
    "type": "slider",
    "min": 0,
    "max": 300,
    "tick": 301,
    "value": 100
  },
  "hdr4": {
    "text": "■ СИМВОЛЫ, МУЗЫКА, СБОИ",
    "type": "label",
    "value": "■ СИМВОЛЫ, МУЗЫКА, СБОИ"
  },
  "chars": {
    "text": "Символы (вместо 0 и 1)",
    "type": "textbox",
    "value": "01"
  },
  "music": {
    "text": "Реагировать на музыку",
    "type": "checkbox",
    "value": true
  },
  "musicPower": {
    "text": "Сила реакции на музыку",
    "type": "slider",
    "min": 0,
    "max": 200,
    "tick": 201,
    "value": 100
  },
  "glitch": {
    "text": "Сбойные полосы",
    "type": "checkbox",
    "value": true
  },
  "hdr5": {
    "text": "■ ДОЖДЬ",
    "type": "label",
    "value": "■ ДОЖДЬ"
  },
  "rain": {
    "text": "Яркость дождя (0 — нет)",
    "type": "slider",
    "min": 0,
    "max": 100,
    "tick": 101,
    "value": 45
  },
  "rainSpeed": {
    "text": "Скорость",
    "type": "slider",
    "min": 0,
    "max": 300,
    "tick": 301,
    "value": 100
  },
  "rainSize": {
    "text": "Размер символов (3 — пыль)",
    "type": "slider",
    "min": 3,
    "max": 48,
    "tick": 46,
    "value": 20
  },
  "rainTrail": {
    "text": "След (100 — не исчезает)",
    "type": "slider",
    "min": 0,
    "max": 100,
    "tick": 101,
    "value": 50
  },
  "rainGapX": {
    "text": "Интервал по горизонтали, %",
    "type": "slider",
    "min": 0,
    "max": 400,
    "tick": 401,
    "value": 100
  },
  "rainGapY": {
    "text": "Интервал по вертикали, %",
    "type": "slider",
    "min": 0,
    "max": 400,
    "tick": 401,
    "value": 100
  },
  "hdr6": {
    "text": "■ ХОЛМ",
    "type": "label",
    "value": "■ ХОЛМ"
  },
  "hSpeed": {
    "text": "Скорость",
    "type": "slider",
    "min": 0,
    "max": 300,
    "tick": 301,
    "value": 100
  },
  "hBright": {
    "text": "Яркость",
    "type": "slider",
    "min": 0,
    "max": 200,
    "tick": 201,
    "value": 100
  },
  "hBig": {
    "text": "Размер символов (2 — пыль)",
    "type": "slider",
    "min": 2,
    "max": 35,
    "tick": 34,
    "value": 10
  },
  "hGapX": {
    "text": "Интервал по горизонтали, %",
    "type": "slider",
    "min": 0,
    "max": 400,
    "tick": 401,
    "value": 100
  },
  "hGapY": {
    "text": "Интервал по вертикали, %",
    "type": "slider",
    "min": 0,
    "max": 400,
    "tick": 401,
    "value": 100
  },
  "hCover": {
    "text": "Пыль закрывает дождь (от верхней кромки)",
    "type": "checkbox",
    "value": true
  },
  "hdr7": {
    "text": "■ СЕРПИНСКИЙ",
    "type": "label",
    "value": "■ СЕРПИНСКИЙ"
  },
  "sSpeed": {
    "text": "Скорость",
    "type": "slider",
    "min": 0,
    "max": 250,
    "tick": 251,
    "value": 45
  },
  "sToUs": {
    "text": "Движение к нам (снять — от нас)",
    "type": "checkbox",
    "value": true
  },
  "sBright": {
    "text": "Яркость",
    "type": "slider",
    "min": 0,
    "max": 200,
    "tick": 201,
    "value": 100
  },
  "sBig": {
    "text": "Размер символов (2 — пыль)",
    "type": "slider",
    "min": 2,
    "max": 35,
    "tick": 34,
    "value": 10
  },
  "sWidth": {
    "text": "Ширина узора",
    "type": "slider",
    "min": 21,
    "max": 201,
    "tick": 181,
    "value": 81
  },
  "sDepth": {
    "text": "Глубина до горизонта",
    "type": "slider",
    "min": 40,
    "max": 300,
    "tick": 261,
    "value": 120
  },
  "hdr8": {
    "text": "■ РАДАР",
    "type": "label",
    "value": "■ РАДАР"
  },
  "rSpeed": {
    "text": "Скорость развёртки",
    "type": "slider",
    "min": 0,
    "max": 300,
    "tick": 301,
    "value": 60
  },
  "rTrail": {
    "text": "Длина шлейфа",
    "type": "slider",
    "min": 0,
    "max": 100,
    "tick": 101,
    "value": 60
  },
  "rCY": {
    "text": "Центр по вертикали, %",
    "type": "slider",
    "min": 0,
    "max": 100,
    "tick": 101,
    "value": 50
  },
  "rSpan": {
    "text": "Охват экрана, % (100 — до углов)",
    "type": "slider",
    "min": 20,
    "max": 200,
    "tick": 181,
    "value": 100
  },
  "rLev": {
    "text": "Частота горизонталей",
    "type": "slider",
    "min": 2,
    "max": 30,
    "tick": 29,
    "value": 8
  },
  "rRing": {
    "text": "Колец дальности",
    "type": "slider",
    "min": 1,
    "max": 12,
    "tick": 12,
    "value": 5
  },
  "rDense": {
    "text": "Плотность сетки",
    "type": "slider",
    "min": 41,
    "max": 241,
    "tick": 201,
    "value": 141
  },
  "rBig": {
    "text": "Размер символов (2 — пыль)",
    "type": "slider",
    "min": 2,
    "max": 35,
    "tick": 34,
    "value": 10
  },
  "rBright": {
    "text": "Яркость",
    "type": "slider",
    "min": 0,
    "max": 200,
    "tick": 201,
    "value": 100
  },
  "hdr9": {
    "text": "■ ВОРОНКА",
    "type": "label",
    "value": "■ ВОРОНКА"
  },
  "vSpeed": {
    "text": "Скорость",
    "type": "slider",
    "min": 0,
    "max": 300,
    "tick": 301,
    "value": 35
  },
  "vOut": {
    "text": "Кольца растут наружу (снять — внутрь)",
    "type": "checkbox",
    "value": true
  },
  "vCY": {
    "text": "Центр по вертикали, %",
    "type": "slider",
    "min": 0,
    "max": 100,
    "tick": 101,
    "value": 50
  },
  "vHole": {
    "text": "Радиус чёрного круга в центре, %",
    "type": "slider",
    "min": 0,
    "max": 60,
    "tick": 61,
    "value": 3
  },
  "vSize": {
    "text": "Размер символов",
    "type": "slider",
    "min": 3,
    "max": 40,
    "tick": 38,
    "value": 14
  },
  "vStep": {
    "text": "Шаг колец, %",
    "type": "slider",
    "min": 103,
    "max": 140,
    "tick": 38,
    "value": 112
  },
  "vGap": {
    "text": "Интервал символов в кольце, %",
    "type": "slider",
    "min": 50,
    "max": 300,
    "tick": 251,
    "value": 105
  },
  "vTwist": {
    "text": "Закрутка",
    "type": "slider",
    "min": 0,
    "max": 100,
    "tick": 101,
    "value": 14
  },
  "vRot": {
    "text": "Поворачивать символы по кольцу",
    "type": "checkbox",
    "value": true
  },
  "vBright": {
    "text": "Яркость",
    "type": "slider",
    "min": 0,
    "max": 200,
    "tick": 201,
    "value": 100
  },
  "hdr10": {
    "text": "■ АВТОРАЗБРОС (значение плавно гуляет)",
    "type": "label",
    "value": "■ АВТОРАЗБРОС (значение плавно гуляет)"
  },
  "autoAmp": {
    "text": "На сколько гулять, %",
    "type": "slider",
    "min": 0,
    "max": 50,
    "tick": 51,
    "value": 10
  },
  "auto_rCY": {
    "text": "авто: Радар — Центр по вертикали, %",
    "type": "checkbox",
    "value": false
  },
  "auto_rSpan": {
    "text": "авто: Радар — Охват экрана, % (100 — до углов)",
    "type": "checkbox",
    "value": false
  },
  "auto_vSpeed": {
    "text": "авто: Воронка — Скорость",
    "type": "checkbox",
    "value": false
  },
  "auto_vCY": {
    "text": "авто: Воронка — Центр по вертикали, %",
    "type": "checkbox",
    "value": false
  },
  "auto_vHole": {
    "text": "авто: Воронка — Радиус чёрного круга в центре, %",
    "type": "checkbox",
    "value": false
  },
  "auto_vSize": {
    "text": "авто: Воронка — Размер символов",
    "type": "checkbox",
    "value": false
  },
  "auto_vStep": {
    "text": "авто: Воронка — Шаг колец, %",
    "type": "checkbox",
    "value": false
  },
  "auto_vGap": {
    "text": "авто: Воронка — Интервал символов в кольце, %",
    "type": "checkbox",
    "value": false
  },
  "auto_vTwist": {
    "text": "авто: Воронка — Закрутка",
    "type": "checkbox",
    "value": false
  },
  "auto_vBright": {
    "text": "авто: Воронка — Яркость",
    "type": "checkbox",
    "value": false
  },
  "auto_rainbowSpeed": {
    "text": "авто: Цвет — Скорость радуги",
    "type": "checkbox",
    "value": false
  },
  "auto_contrast": {
    "text": "авто: Цвет — Контраст, %",
    "type": "checkbox",
    "value": false
  },
  "auto_sat": {
    "text": "авто: Цвет — Цветность, %",
    "type": "checkbox",
    "value": false
  },
  "auto_musicPower": {
    "text": "авто: Символы — Сила реакции на музыку",
    "type": "checkbox",
    "value": false
  },
  "auto_rain": {
    "text": "авто: Дождь — Яркость дождя (0 — нет)",
    "type": "checkbox",
    "value": false
  },
  "auto_rainSpeed": {
    "text": "авто: Дождь — Скорость",
    "type": "checkbox",
    "value": false
  },
  "auto_rainTrail": {
    "text": "авто: Дождь — След (100 — не исчезает)",
    "type": "checkbox",
    "value": false
  },
  "auto_titleSize": {
    "text": "авто: Надпись — Размер надписи, %",
    "type": "checkbox",
    "value": false
  },
  "auto_clockSize": {
    "text": "авто: Надпись — Размер часов, %",
    "type": "checkbox",
    "value": false
  },
  "auto_blockY": {
    "text": "авто: Надпись — Положение по вертикали, % экрана",
    "type": "checkbox",
    "value": false
  },
  "auto_gapTC": {
    "text": "авто: Надпись — Расстояние до часов, %",
    "type": "checkbox",
    "value": false
  },
  "auto_hBright": {
    "text": "авто: Холм — Яркость",
    "type": "checkbox",
    "value": false
  },
  "auto_hSpeed": {
    "text": "авто: Холм — Скорость",
    "type": "checkbox",
    "value": false
  },
  "auto_sBright": {
    "text": "авто: Серпинский — Яркость",
    "type": "checkbox",
    "value": false
  },
  "auto_sBig": {
    "text": "авто: Серпинский — Размер символов (2 — пыль)",
    "type": "checkbox",
    "value": false
  },
  "auto_sSpeed": {
    "text": "авто: Серпинский — Скорость",
    "type": "checkbox",
    "value": false
  },
  "auto_rSpeed": {
    "text": "авто: Радар — Скорость развёртки",
    "type": "checkbox",
    "value": false
  },
  "auto_rTrail": {
    "text": "авто: Радар — Длина шлейфа",
    "type": "checkbox",
    "value": false
  },
  "auto_rLev": {
    "text": "авто: Радар — Частота горизонталей",
    "type": "checkbox",
    "value": false
  },
  "auto_rRing": {
    "text": "авто: Радар — Колец дальности",
    "type": "checkbox",
    "value": false
  },
  "auto_rBig": {
    "text": "авто: Радар — Размер символов (2 — пыль)",
    "type": "checkbox",
    "value": false
  },
  "auto_rBright": {
    "text": "авто: Радар — Яркость",
    "type": "checkbox",
    "value": false
  }
};
