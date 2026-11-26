"""Build the published comparison from the variant, source mask and GIF scans."""

import csv
import html
import json
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[2] / "issledovanie/wolfram-nks"
OUTPUT = ROOT / "romb-search"
SIZES = [2 ** power for power in range(3, 13)]
ROUTES = [
    (2, False, False, "2N−1 · перескок"),
    (2, True, False, "2N−1 · отскок"),
    (4, False, False, "4N−1 · перескок"),
    (4, True, False, "4N−1 · отскок"),
    (2, False, True, "Разворот · обе ширины и оба края"),
]
LABELS = {
    "draft": "Черновик", "axes": "Черновик с осями", "diamonds": "Черновик двух ромбов",
    "sizes": "Обычный ход", "contact": "Разворот",
}
PHASES = {"before": "До цикла", "cycle": "Цикл", "full": "Одна лента"}
MASK_KEYS = ("frames", "diamonds", "repeated", "samePair", "mirrorPair", "vertical", "horizontal", "halfTurn")
MASK_HEAD = ("Кадров", "Ромбов", "Повторных ромбов", "Пара совпала", "Пара зеркальна",
             "Вертикальная ось", "Горизонтальная ось", "Поворот 180°")


def read_lines(file):
    return [json.loads(line) for line in file.read_text(encoding="utf-8").splitlines()]


def number(value):
    return f"{value:,}".replace(",", "\u202f") if value is not None else "—"


def count(items, key):
    return sum(item[key] for item in items)


def variant_key(row):
    return (row["height"], row["and"], row["widthFactor"], row["bounce"], row["reverseAtContact"])


def read_inputs(directory):
    variants = {}
    for file in sorted(directory.glob("*.ndjson")):
        if not file.name.startswith(("xor", "and")):
            continue
        for row in read_lines(file):
            key = variant_key(row)
            current = variants.get(key, {})
            score = lambda r: (bool(r.get("witness") or r.get("returned") is not None and r.get("and")),
                               r.get("scan") is not None, r.get("scannedThrough", 0))
            if score(row) > score(current) or key not in variants:
                variants[key] = row
    for height in SIZES:
        for and_rule in (False, True):
            contact = variants[height, and_rule, 2, False, True]
            for factor in (2, 4):
                for bounce in (False, True):
                    witness = contact["witness"]
                    variants[height, and_rule, factor, bounce, True] = dict(
                        contact, widthFactor=factor, bounce=bounce, width=factor * height - 1,
                        witness=dict(witness, column=witness["column"] + (factor - 2) * height // 2)
                        if witness else None,
                    )
    for height in SIZES:
        for and_rule in (False, True):
            for factor, bounce, contact, _ in ROUTES[:-1]:
                key = (height, and_rule, factor, bounce, contact)
                if key in variants:
                    continue
                if not and_rule:
                    raise ValueError(f"Отсутствует расчёт XOR для {key}")
                width = factor * height - 1
                period = 4 * (width - 1) if bounce else 2 * width
                variants[key] = {
                    "height": height, "width": width, "widthFactor": factor, "bounce": bounce,
                    "reverseAtContact": False, "and": True, "start": None, "period": period,
                    "returned": None, "witness": None, "scan": None, "scannedThrough": 0,
                }
    sources = read_lines(directory / "sources.ndjson")
    gifs = read_lines(directory / "gifs.ndjson")
    if len(variants) != 160 or len(sources) != 20 or len(gifs) != 50:
        raise ValueError("Неполный список вариантов или GIF.")
    return variants, sources, gifs


def table(headers, rows, css=""):
    head = "".join(f'<th scope="col">{entry}</th>' for entry in headers)
    body = []
    for first, *rest in rows:
        cells = "".join(f"<td>{value}</td>" for value in rest)
        body.append(f'<tr><th scope="row">{first}</th>{cells}</tr>')
    return (f'<div class="table-scroll"><table{css}><thead><tr>{head}</tr></thead><tbody>\n'
            + "\n".join(body) + "\n</tbody></table></div>")


def write_csv(file, headers, rows):
    with file.open("w", encoding="utf-8-sig", newline="") as output:
        writer = csv.writer(output)
        writer.writerow(headers)
        writer.writerows(rows)


def render(variants, sources, gifs, sequence):
    xor, intersection = [], []
    for height in SIZES:
        period_cells, and_cells = [], []
        for factor, bounce, contact, _ in ROUTES:
            row = variants[height, False, factor, bounce, contact]
            period_cells.append(("" if row["witness"] else "≤ ") + number(row["period"]))
            row = variants[height, True, factor, bounce, contact]
            and_cells.append(f'{number(row["start"])} → {number(row["returned"])}' if row["returned"] else
                             f'Проверено до {number(row["scannedThrough"])}' if row["scannedThrough"] else "Расчёт открыт")
        xor.append([number(height), *period_cells])
        intersection.append([number(height), *and_cells])

    detail = []
    for row in sorted(variants.values(), key=variant_key):
        scan = row["scan"] or {}
        label = ("Разворот · " if row["reverseAtContact"] else "") + ("отскок" if row["bounce"] else "перескок")
        detail.append([number(row["height"]), number(row["width"]), "AND" if row["and"] else "XOR", label,
            number(row["start"]), number(row["period"]) if row["and"] or row["witness"] else "≤ " + number(row["period"]),
            number(row["returned"]) if row["and"] or row["witness"] else "≤ " + number(row["returned"]),
            *[number(scan.get(k)) for k in MASK_KEYS],
        ])

    source_rows = []
    for row in sources:
        height, series = row["height"], row["series"]
        link = "romb-contact-atlas.html?size=" + str(height) if series == "contact" else (
            "../../prosmotr/Zerkalius-prosmotr.html?rhomb=" + str(height))
        source_rows.append([number(height), f'<a href="{link}">{LABELS[series]}</a>',
                            *[number(row[k]) for k in MASK_KEYS]])

    gif_rows = []
    for row in gifs:
        example = row["examples"].get("repeat")
        gif_rows.append([number(row["rows"]), f'<a href="romb-gifs/{html.escape(row["path"])}">{LABELS[row["series"]]}</a>',
            PHASES[row["phase"]], f'{row["block"]}×{row["block"]}' if row["overview"] else "Битовый растр",
            *[number(row[k]) for k in ("frames", "blank", "repeated", "vertical", "horizontal", "halfTurn")],
            " → ".join(map(number, example)) if example else "—"])

    exact = sum(bool(row.get("witness")) for row in variants.values() if not row["and"])
    stabilized = sum(row["returned"] is not None for row in variants.values() if row["and"])
    dense_rows = [height for height in SIZES if all(row["scan"] for row in variants.values() if row["height"] == height)]
    dense = "–".join(map(number, [dense_rows[0], dense_rows[-1]]))
    route_header = ["Высота N", *[route[-1] for route in ROUTES]]
    return f"""<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="Кадры, повторы, симметрии и периоды Ромбового Маятника от 8 до 4096 строк.">
  <title>Ромбовый Маятник · поиск по кадрам 8–4096</title>
  <link rel="stylesheet" href="../../wolfram/style.css?v=001">
  <style>
    .table-scroll {{overflow-x:auto}}
    .table-scroll th,.table-scroll td {{min-width:5em;vertical-align:middle}}
    details {{margin:1em 0}}
    summary {{cursor:pointer;color:var(--accent,#71d7e7)}}
    .find-cards {{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:1rem}}
    .find-cards figure {{margin:0}}
    .find-cards img {{width:100%;height:auto;display:block}}
  </style>
</head>
<body><main>
  <nav class="site-nav" aria-label="Разделы Зеркалиуса">
    <a href="../../mayatnik/romb.html">Ромбовый Маятник</a>
    <a href="romb-atlas.html">Атлас ромбов</a>
    <a href="romb-contact-atlas.html">Атлас разворота</a>
    <a href="../Zerkalius-issledovanie.html">Исследования</a>
  </nav>
  <header>
    <h1>Поиск по кадрам Ромбового Маятника</h1>
    <p class="lead">Десять высот от 8 до 4096 строк и {number(len(variants))} сочетаний настроек. Из них {exact} точных циклов XOR и {stabilized} подтверждённых моментов стабилизации AND.
    Проверены все {number(count(gifs, "frames"))} кадра в {len(gifs)} GIF и исходные биты {number(count(sources, "frames"))} кадров двух новых серий.</p>
    <p><a href="romb-search-variants.csv">Все режимы и результаты, CSV</a> · <a href="romb-search-gifs.csv">Все GIF, CSV</a> · <a href="romb-search.json">Данные, JSON</a> · <a href="romb-sequences.xlsx">Поиск строк 5–70 по кадрам, Excel</a></p>
  </header>
  <section aria-labelledby="xor">
    <h2 id="xor">XOR · число ходов между точными повторами</h2>
    <p>Пустое поле — кадр 0. Цикл обычного хода начинается с кадра W, где W — ширина. При развороте первый кадр цикла равен N. При возврате совпадают биты, положения и направления обеих ветвей.</p>
    {table(route_header, xor)}
    <p>Один круг содержит 2W ходов для перескока, 4(W−1) для отскока и 4(N−1) для разворота. Период равен N/2 кругов в строках без знака ≤. После одного круга линейная разность по XOR распространяется минимум на две строки вниз. Вычисленный бит-свидетель отличает опорный кадр от кадра через половину периода. Его координаты записаны в JSON, начиная с нуля.</p>
  </section>
  <section aria-labelledby="and">
    <h2 id="and">AND · стабильное поле и первый возврат ветвей</h2>
    <p>В каждой ячейке указан кадр последнего изменения поля → следующий кадр с тем же положением и направлением обеих ветвей. Записанная единица может стать нулём. После полного круга без изменений зафиксированное поле сохраняется, а ветви продолжают движение.</p>
    {table(route_header, intersection)}
  </section>
  <section aria-labelledby="masks">
    <h2 id="masks">Повторы и симметрии по исходным битам</h2>
    <p>Для высот {dense} в таблице вариантов есть сплошной перебор кадров от 0 до первого возврата включительно. Выше этой границы исследование форм ромбов по всем исходным кадрам остаётся открытым. В таблице ниже проверен каждый исходный кадр, выбранный для двух новых серий GIF на 2N−1, в том числе кадры с большими номерами в конце цикла. Сами GIF могут показывать плотность битов, оси и контуры.</p>
    <p>Сравниваются целые области внутри контура двух ромбов. Положение на поле убирается, пустая клетка, 0 и 1 различаются. Повтором считается очередное появление того же рисунка в пределах серии или варианта. Пара считается зеркальной при отражении слева направо. У пустого кадра 0 ромбы отсутствуют.</p>
    <details><summary>Все {len(variants)} сочетаний и покрытие сплошного поиска</summary>
    {table(["Высота N", "Ширина W", "Правило", "Маршрут", "Начало", "Период", "Первый возврат", *MASK_HEAD], detail)}
    </details>
    {table(["Высота N", "Серия", *MASK_HEAD], source_rows)}
    <p>В подборках от 256 строк кадр 1 отсутствует. Столбцы осей показывают найденное только на выбранных кадрах. Локальные симметричные фигуры собраны в <a href="romb-atlas.html">Атласе</a> и <a href="romb-contact-atlas.html">Атласе разворота</a>.</p>
  </section>
  <section aria-labelledby="sequences">
    <h2 id="sequences">Строки 5–70 по четырём направлениям</h2>
    <p>В Excel-отчёте проверены горизонталь →, вертикаль ↓ и обе диагонали ↘ и ↙ на исходной решётке. У 66 шаблонов, начиная с 10101, проверены все {number(sequence["gifFrames"])} кадра двух новых GIF-серий и {number(sequence["collectionFrames"])} снимков 30 видов <a href="../image-journal/rhomb-collection/">цветной коллекции</a>. В первом листе строки 5–70 стоят слева, по столбцам идут высоты и виды. Каждая ячейка содержит все найденные номера кадров и метку «Всегда», если совпали все непустые кадры серии.</p>
    <p>Самая длинная находка — строка {sequence["maximum"]["pattern"]} на кадре {number(sequence["maximum"]["frame"])} при высоте {number(sequence["maximum"]["height"])}. Серия «{LABELS[sequence["maximum"]["series"]]}», направление {sequence["maximum"]["direction"]}.</p>
    <p><a href="romb-sequences.xlsx">Открыть отчёт Excel</a> · <a href="romb-search-examples/n8-f3-row5.png">Строка 5 · кадр 3</a> · <a href="romb-search-examples/n128-f15004-row24.png">Строка 24 · кадр 15 004</a></p>
  </section>
  <section aria-labelledby="long-matches">
    <h2 id="long-matches">Сохранённые кадры с находками от строки 35</h2>
    <p>Порог прошли два кадра поля 8 191 × 4 096. В оригинальном PNG каждый пиксель соответствует одной клетке, жёлтые пиксели отмечают все биты найденной цепочки.</p>
    <div class="find-cards">
      <figure>
        <a href="romb-search-examples/n4096-f13652-row35.png"><img src="romb-search-examples/n4096-f13652-row35.png" alt="Кадр 13652, выделено совпадение строки 35 по вертикали" width="1120" height="570" loading="lazy"></a>
        <figcaption>Строка 35 · кадр 13 652 · обычный ход. <a href="romb-search-examples/n4096-f13652-row35-full.png">Полный PNG</a></figcaption>
      </figure>
      <figure>
        <a href="romb-search-examples/n4096-f1489-row37.png"><img src="romb-search-examples/n4096-f1489-row37.png" alt="Кадр 1489, выделено совпадение строки 37 по вертикали" width="1120" height="570" loading="lazy"></a>
        <figcaption>Строка 37 · кадр 1 489 · разворот. <a href="romb-search-examples/n4096-f1489-row37-full.png">Полный PNG</a></figcaption>
      </figure>
    </div>
  </section>
  <section aria-labelledby="gif">
    <h2 id="gif">Все 50 GIF и их сохранённые кадры</h2>
    <p>Сравнивается декодированный растр без строки с номером кадра. Для повторов и осей считаются непустые кадры в пределах одного GIF. В растр входят раскраска, оси и контуры. Для крупных обзоров «2×2» и выше показывает размер блока исходных клеток.</p>
    <details><summary>Кадры и первые повторы по каждому файлу</summary>
    {table(["Высота N", "Серия", "Часть", "Растр", "Кадров", "Пустых", "Повторов", "Вертикальная ось",
            "Горизонтальная ось", "Поворот 180°", "Первая пара кадров"], gif_rows)}
    </details>
  </section>
  <section aria-labelledby="variants">
    <h2 id="variants">Вариации в интерфейсе</h2>
    {table(["Вариация", "Что меняется"], [
        ("Перескок / отскок", "Вершины переходят через край или отражаются от края."),
        ("Разворот", "Обе ветви разворачиваются на последнем касании ромбов. Вершины остаются в центральных N столбцах при обеих ширинах."),
        ("Построение XOR / AND", "Правило накопления вклада каждого прохода. Меняет сами биты."),
        ("Склейка ← / →", "Копии половин поля слева, справа или с обеих сторон."),
        ("Ромб-монета", "Наложение, XOR либо AND двух ромбов, с отражением второй стороны либо без него. Работает на уже построенном кадре."),
        ("Ромб / квадрат", "Проекция на 45° у основного поля и у Ромба-монеты."),
        ("Повторы и цвет осей", "Подсветка совпадений на поле и окраска центральных осей в Хабе."),
        ("Четыре треугольника в Хабе", "Два ромба по две половины и режим «Вверх-вниз» на поле 2047 × 1024."),
        ("Кадры, пауза, масштаб и GIF", "Воспроизведение в обе стороны, шаг через заданное число кадров, стоп при касании, ползунок, масштаб и запись выбранного вида."),
    ])}
    <p>Циклы рассчитаны при выборе режима до первого хода. Переключение правил края или разворота посреди истории создаёт отдельную последовательность.</p>
    <p><a href="https://github.com/MIkhailNkmnme/Binary-Drum-Machine/blob/main/tools/mayatnik-journal/analyze-rhomb-variants.cjs">Исходник расчёта</a> · <a href="https://github.com/MIkhailNkmnme/Binary-Drum-Machine/blob/main/tools/mayatnik-journal/scan-rhomb-gifs.py">Сканер GIF</a></p>
  </section>
</main></body>
</html>
"""


def sequence_summary(directory, sources):
    gif_frames = read_lines(directory / "seq-sizes.ndjson") + read_lines(directory / "seq-contact.ndjson")
    collection_frames = read_lines(directory / "seq-collection.ndjson")
    frames = gif_frames + collection_frames
    if len(gif_frames) != count(sources, "frames") or len(collection_frames) != 300:
        raise ValueError("Итог поиска строк собран по неполному набору кадров.")
    directions = ["→", "↓", "↘", "↙"]
    totals = [0] * len(directions)
    longest = {"pattern": 0}
    for row in frames:
        for pattern, matches in row["hits"]:
            for direction, matches_count, row1, col1, row2, col2 in matches:
                totals[direction] += matches_count
                if pattern > longest["pattern"]:
                    longest = dict(pattern=pattern, frame=row["frame"], height=row["height"], series=row["series"],
                                   direction=directions[direction], first=[row1, col1], last=[row2, col2])
    return dict(frames=len(frames), gifFrames=len(gif_frames), collectionFrames=len(collection_frames),
                patterns=66, directions=dict(zip(directions, totals)), maximum=longest)


if __name__ == "__main__":
    directory = Path(sys.argv[1])
    variants, sources, gifs = read_inputs(directory)
    sequence = sequence_summary(directory, sources)
    rows = sorted(variants.values(), key=variant_key)
    payload = dict(version="0.001", variants=rows, sourceMasks=sources, gifRaster=gifs, sequenceScan=sequence)
    OUTPUT.with_suffix(".json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUTPUT.with_suffix(".html").write_text(render(variants, sources, gifs, sequence), encoding="utf-8")
    write_csv(ROOT / "romb-search-variants.csv",
        ["N", "W", "Правило", "Край", "Разворот", "Начало", "Период или верхняя граница", "Возврат", "Статус",
         "Проверено ходов AND", "Строка свидетеля с 0", "Столбец свидетеля с 0", *MASK_HEAD],
        [[r["height"], r["width"], "AND" if r["and"] else "XOR", "отскок" if r["bounce"] else "перескок",
          int(r["reverseAtContact"]), r["start"], r["period"], r["returned"],
          ("Стабильно" if r["returned"] else "Проверка продолжается") if r["and"] else
          ("Точный период" if r["witness"] else "Верхняя граница"),
          r.get("scannedThrough"), (r["witness"] or {}).get("row"), (r["witness"] or {}).get("column"),
          *[(r["scan"] or {}).get(key) for key in MASK_KEYS]] for r in rows])
    write_csv(ROOT / "romb-search-gifs.csv",
        ["N", "W", "Серия", "Часть", "Файл", "Блок", "Кадров", "Пустых", "Повторов", "Вертикальная ось",
         "Горизонтальная ось", "Поворот 180°", "Первый кадр", "Кадр повтора"],
        [[r["rows"], r["width"], LABELS[r["series"]], PHASES[r["phase"]], r["path"], r["block"],
          *[r[k] for k in ("frames", "blank", "repeated", "vertical", "horizontal", "halfTurn")],
          *r["examples"].get("repeat", ["", ""])] for r in gifs])
