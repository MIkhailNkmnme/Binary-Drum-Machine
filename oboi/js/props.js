// копия LivelyProperties.json для страницы настройки
var LIVELY_PROPS = {
  "hdr1": {
    "text": "■ СЦЕНА",
    "type": "label",
    "value": "■ СЦЕНА"
  },
  "preset": {
    "text": "Готовый набор",
    "type": "dropdown",
    "value": 0,
    "items": [
      "— свой —",
      "к нам",
      "от нас",
      "крупный"
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
  }
};
