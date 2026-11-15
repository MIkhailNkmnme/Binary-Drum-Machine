// Авторские клеточные маски кириллицы для АзъБукъ.
(() => {
  const capitalLatin = Object.entries({
    А: 'A', В: 'B', Е: 'E', Ё: 'Ë', М: 'M', Н: 'H', О: 'O',
    Р: 'P', С: 'C', Т: 'T', Х: 'X'
  });
  const lowercaseLatin = Object.entries({
    а: 'a', е: 'e', ё: 'ë', о: 'o', р: 'p', с: 'c', у: 'y', х: 'x'
  });

  // Строки коротких прописных и строчных. У Д, Ц и Щ последняя строка
  // находится под базовой линией.
  const capitals = {
    Б: '11111/10000/10000/11110/10001/10001/11110',
    Г: '11111/10000/10000/10000/10000/10000/10000',
    Д: '0011100/0010100/0010100/0100100/0100100/0100100/1111111/1000001',
    Ж: '1001001/1001001/0101010/0011100/0101010/1001001/1001001',
    З: '01110/10001/00001/00110/00001/10001/01110',
    И: '10001/10001/10011/10101/11001/10001/10001',
    К: '10001/10010/10100/11000/10100/10010/10001',
    Л: '00111/00101/00101/01001/01001/01001/10001',
    П: '11111/10001/10001/10001/10001/10001/10001',
    У: '10001/10001/01010/01010/00100/01000/10000',
    Ф: '0001000/0111110/1001001/1001001/1001001/0111110/0001000',
    Ц: '100010/100010/100010/100010/100010/100010/111111/000001',
    Ч: '10001/10001/10001/01111/00001/00001/00001',
    Ш: '1001001/1001001/1001001/1001001/1001001/1001001/1111111',
    Щ: '10010010/10010010/10010010/10010010/10010010/10010010/11111111/00000001',
    Ъ: '111000/001000/001000/001110/001001/001001/001110',
    Ы: '1000001/1000001/1000001/1111001/1000101/1000101/1111001',
    Ь: '10000/10000/10000/11110/10001/10001/11110',
    Э: '01110/10001/00001/00111/00001/10001/01110',
    Ю: '1001110/1010001/1010001/1110001/1010001/1010001/1001110',
    Я: '01111/10001/10001/01111/00101/01001/10001'
  };
  const lowercase = {
    б: '00111/01100/10000/11110/10001/10001/01110',
    в: '11110/10001/11110/10001/11110',
    г: '11111/10000/10000/10000/10000',
    д: '0011100/0010100/0100100/0100100/1111111/1000001',
    ж: '1001001/0101010/0011100/0101010/1001001',
    з: '01110/10001/00110/10001/01110',
    и: '10001/10011/10101/11001/10001',
    к: '10001/10110/11000/10110/10001',
    л: '00111/00101/01001/01001/10001',
    м: '1000001/1100011/1010101/1001001/1000001',
    н: '10001/10001/11111/10001/10001',
    п: '11111/10001/10001/10001/10001',
    т: '11111/00100/00100/00100/00100',
    ф: '0001000/0111110/1001001/1001001/1001001/0111110/0001000',
    ц: '100010/100010/100010/100010/111111/000001',
    ч: '10001/10001/01111/00001/00001',
    ш: '1001001/1001001/1001001/1001001/1111111',
    щ: '10010010/10010010/10010010/10010010/11111111/00000001',
    ъ: '111000/001000/001110/001001/001110',
    ы: '1000001/1000001/1111001/1000101/1111001',
    ь: '10000/10000/11110/10001/11110',
    э: '01110/10001/00111/10001/01110',
    ю: '1001110/1010001/1110001/1010001/1001110',
    я: '01111/10001/01111/01001/10001'
  };

  // У жирного Operator вертикальные штрихи занимают две клетки,
  // а горизонтальные остаются высотой в одну клетку.
  function broaden(row) {
    return Array.from({length: row.length + 1}, (_, x) =>
      row[x] === '1' || row[x - 1] === '1' ? '1' : '0'
    ).join('');
  }

  function extend(rows) {
    const lower = rows.length === 5 || rows.length === 6;
    const repeat = lower ? [1, 3] : [1, 5];
    return rows.flatMap((row, i) => repeat.includes(i) ? [row, row] : [row]);
  }

  const cyrillic = {};
  for (const font of window.AzbukImportedFonts || []) {
    const compact = font.id === 'operator-8' || font.id === 'operator-8-bold';
    const smallCaps = font.id === 'operator-sc' || font.id === 'operator-sc-bold';
    const bold = font.id.endsWith('-bold');
    const masks = {};
    const descend = {Д: 1, Ц: 1, Щ: 1, д: 1, ц: 1, щ: 1};
    const weight = rows => bold ? rows.map(broaden) : rows;
    function assign(ch, rows, tall) {
      masks[ch] = weight(tall ? extend(rows) : rows);
    }

    for (const [ch, pattern] of Object.entries(capitals)) {
      const rows = pattern.split('/');
      assign(ch, rows, !compact);
      if (smallCaps) assign(ch.toLowerCase(), rows, false);
    }
    if (smallCaps) {
      for (const [ch, latin] of capitalLatin) {
        const lower = ch.toLowerCase();
        const latinLower = latin.toLowerCase();
        masks[lower] = font.masks[latinLower];
        if (font.descend[latinLower]) descend[lower] = font.descend[latinLower];
      }
    } else {
      for (const [ch, pattern] of Object.entries(lowercase)) {
        assign(ch, pattern.split('/'), !compact);
      }
      descend.ф = 1;
    }
    for (const [ch, latin] of [...capitalLatin, ...lowercaseLatin]) {
      masks[ch] = font.masks[latin];
      if (font.descend[latin]) descend[ch] = font.descend[latin];
    }

    // В коротком начертании надстрочные знаки входят в высоту прописных.
    const breve = ['01010', '00100'];
    const shortI = lowercase.и.split('/');
    const capitalI = capitals.И.split('/');
    assign('Й', compact ? [...breve, ...shortI] : [...breve, '00000', ...extend(capitalI)], false);
    const lowerI = smallCaps ? capitalI : compact ? shortI : extend(shortI);
    assign('й', [...breve, '00000', ...lowerI], false);
    cyrillic[font.id] = {masks, descend};
  }
  window.AzbukOperatorCyrillic = cyrillic;
})();
