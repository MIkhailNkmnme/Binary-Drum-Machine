"""Собрать продолжение исследования из выдачи search-rhomb-routes.cjs."""

import argparse
import base64
from collections import Counter
from html import escape
import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "issledovanie/wolfram-nks"
MINIMUM = 30
DIRECTIONS = ["→", "↓", "↘", "↙"]
MOTIONS = {"pendulum": "Маятник", "sync": "Подряд", "double": "2 подряд", "inward": "Навстречу"}
ROUTES = {"cw": "По часовой", "ccw": "Против часовой", "cross": "Крестом",
          "spiral-cw": "Спираль по часовой", "spiral-ccw": "Спираль против часовой"}
HALVES = {"together": "вместе", "apart": "врозь"}
EDGES = {"bounce": "отскок", "wrap": "перескок", "contact": "разворот при касании"}
APP_VERSION = "0.051"


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def number(value):
    return f"{value:,}".replace(",", " ")


def frames_in(schedule):
    extra = set(schedule.get("extra", []))
    return [frame for frame in range(1, schedule["last"] + 1)
            if frame <= schedule["dense"] or frame % schedule["step"] == 0 or frame in extra]


def max_length(config):
    if config["width"] == "unlimited":
        return float("inf")
    n = config["n"]
    width = n - 1 if config["x"] == "off" else config["width"] * n - 1
    height = n if config["y"] == "off" else config["height"] * n - 1
    return max((width + 1) // 2, (height + 1) // 2, min(width, height))


def order(hit):
    frame, _, _, end_row, end_col, _ = hit["witness"]
    return frame, end_row, end_col, hit["direction"]


def load_records(files):
    received = {}
    for path in files:
        for line in path.read_text().splitlines():
            config = json.loads(line)
            key = config["id"]
            if key in received:
                raise ValueError(f"Дублируется настройка {key}")
            received[key] = config
    if sorted(received) != list(range(1054)):
        raise ValueError("Неполная матрица из 1054 настроек")
    records = []
    for key in sorted(received):
        config = received[key]
        if max_length(config) < MINIMUM:
            continue
        schedule = frames_in(config["frames"])
        checked = config.pop("scannedFrames", None)
        previous_count = config.pop("scanned", None)
        config.pop("foundFrames", None)
        if checked is None:
            if previous_count != len(schedule):
                raise ValueError(f"Не удаётся восстановить выборку {key}")
            checked = schedule
        if not set(checked).issubset(schedule) or checked != sorted(set(checked)):
            raise ValueError(f"Неправильная выборка {key}")
        first = {}
        for hit in config["matches"]:
            length = hit["length"]
            if length < MINIMUM:
                continue
            if hit["witness"][0] not in checked:
                raise ValueError(f"Результат вне выборки {key}")
            if length not in first or order(hit) < order(first[length]):
                first[length] = {k: hit[k] for k in ("length", "direction", "witness")}
        config["checked"] = checked
        config["matches"] = [first[n] for n in sorted(first)]
        records.append(config)
    return records, len(received) - len(records)


def mode(config):
    x, y = config["x"], config["y"]
    if y == "off":
        return "Горизонталь", MOTIONS[x], HALVES[config["halfX"]]
    if x == "off":
        return "Вертикаль", MOTIONS[y], HALVES[config["halfY"]]
    return "Обе оси", ROUTES[config["route"]], (
        HALVES[config["halfX"]] + " по горизонтали, " + HALVES[config["halfY"]] + " по вертикали")


def replay(config, frame):
    wrap = config["edge"] == "wrap"
    wrap_x = wrap and config["width"] != "unlimited" and config["x"] != "off"
    wrap_y = wrap and config["y"] != "off"
    contact = config["edge"] == "contact"
    settings = {
        "rows": config["n"], "factor": config["width"], "heightFactor": config["height"],
        "horizontalMotion": config["x"], "verticalMotion": config["y"], "jointRoute": config["route"],
        "halves": {"x": config["halfX"], "y": config["halfY"]},
        "buildAnd": config["rule"] == "AND", "wrap": wrap_x, "wrapY": wrap_y, "reverseAtContact": contact,
        "patternColors": False, "square": False, "joinLeft": False, "joinRight": False,
    }
    scene = {"version": 1, "settings": settings, "frame": frame, "lap": 0,
             "routes": [[[0, wrap_x]], [[0, wrap_y]], [[0, contact]]]}
    code = base64.urlsafe_b64encode(encode(scene).encode()).decode().rstrip("=")
    return "../../mayatnik/romb.html#romb=" + code


def pairs(configs):
    return [(config, hit) for config in configs for hit in config["matches"]]


def top_pair(items):
    return min(items, default=None, key=lambda item: (-item[1]["length"], order(item[1]), item[0]["id"]))


def hit_label(item):
    if item is None:
        return "—"
    config, hit = item
    frame, y, x, ey, ex, width = hit["witness"]
    direction = DIRECTIONS[hit["direction"]]
    center = f" · центр в столбце {(width + 1) // 2}" if config["width"] == "unlimited" else ""
    coords = f"строка {y}, столбец {x} → строка {ey}, столбец {ex}{center}"
    url = replay(config, frame)
    return (
        f"<strong>{hit['length']} {direction}</strong> · N = {number(config['n'])} · "
        f'<a href="{url}">кадр {number(frame)}</a><br><small>{coords}</small>'
    )


def scope_table():
    rows = [
        ("8", "Исключены по размерам исходного поля"),
        ("16", "1–128 подряд, только общие маршруты. На поле 31 × 31 диагональ вмещает 30 бит"),
        ("32", "1–256 подряд"),
        ("64", "1–512 подряд"),
        ("128, 256", "1–32 подряд, затем 40, 48, 56, …, 512"),
        ("512", "1–16 подряд, затем 32, 48, 64, …, 256"),
        ("1024", "1–8, 16, 32, 48, 64"),
        ("2048", "1–4, 8, 16"),
        ("4096", "1, 2, 4"),
    ]
    return "".join(f"<tr><th scope='row'>{a}</th><td>{b}</td></tr>" for a, b in rows)


def route_table(records):
    rows = []
    for key in dict.fromkeys(mode(config) for config in records):
        subset = [config for config in records if mode(config) == key]
        best = [top_pair(pairs(c for c in subset if c["rule"] == rule)) for rule in ("XOR", "AND")]
        axis, name, halves = key
        rows.append(
            f"<tr><td>{axis}</td><th scope='row'>{name}<br><small>{halves}</small></th>"
            f"<td>{len(subset)}</td><td>{hit_label(best[0])}</td><td>{hit_label(best[1])}</td></tr>"
        )
    return "\n".join(rows)


def match_table(records):
    rows = []
    for config, hit in sorted(pairs(records), key=lambda item: (-item[1]["length"], item[0]["id"])):
        axis, name, halves = mode(config)
        w = "без ограничения" if config["width"] == "unlimited" else f'{config["width"]}N−1'
        h = "N" if config["y"] == "off" else f'{config["height"]}N−1'
        field = f"{w} × {h}" if config["x"] != "off" else f"(N−1) × {h}"
        title = f"{axis} · {name}<br><small>{halves} · {field} · {EDGES[config['edge']]}</small>"
        rows.append(f"<tr><th scope='row'>{title}</th><td>{config['rule']}</td><td>{hit_label((config, hit))}</td></tr>")
    return "\n".join(rows)


def explicit_table(records):
    rows = []
    for config in records:
        for snapshot in config.get("explicitFrames", []):
            frame = snapshot["frame"]
            all_hits = [(length, *detail) for length, details in snapshot["hits"] for detail in details]
            best = max(all_hits, key=lambda hit: hit[0])
            diagonal = max((hit for hit in all_hits if hit[1] >= 2), key=lambda hit: hit[0])
            row, col = snapshot["apex"]
            length, direction, _, y, x, ey, ex = diagonal
            rows.append(
                f"<tr><th scope='row'>{config['rule']}</th><td>{best[0]} {DIRECTIONS[best[1]]}</td>"
                f"<td>{length} {DIRECTIONS[direction]} · строка {y}, столбец {x} → строка {ey}, столбец {ex}</td>"
                f'<td><a href="{replay(config, frame)}">Кадр {number(frame)}</a> · вершина {col}, {row}</td></tr>'
            )
    return "\n".join(rows)


def coverage_table(windows):
    return "\n".join(
        f"<tr><th scope='row'>{r['config']['rule']}</th><td>{number(r['windows'])}</td>"
        f"<td>{number(r['distinct'])} из {number(r['possible'])}</td>"
        f"<td>{number(r['targetHits'])}</td><td>{r['first']}</td></tr>" for r in windows
    )


def render(records, excluded, windows):
    counts = Counter(config["group"] for config in records)
    found = pairs(records)
    independent = Counter(hit["length"] for _, hit in found)
    summary = ", ".join(f"{n} ({count})" for n, count in sorted(independent.items()))
    total = sum(len(config["checked"]) for config in records)
    return f"""<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ромбовый Маятник · строки 30–70 на новых маршрутах</title>
  <link rel="stylesheet" href="../../wolfram/style.css?v=001">
  <style>
    .table-scroll {{overflow-x:auto}}
    table {{width:100%;border-collapse:collapse}}
    th,td {{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}}
    thead {{background:#15212b}}
  </style>
</head>
<body>
<main>
  <nav class="site-nav" aria-label="Разделы Зеркалиуса">
    <a href="../Zerkalius-issledovanie.html">Исследования</a>
    <a href="romb-search.html#sequences">Предыдущее исследование 5–70</a>
  </nav>
  <h1>Строки 30–70 на новых маршрутах Ромбового Маятника</h1>
  <p>Поиск по исходным битам Ромбового Маятника v{APP_VERSION}. Проверено {number(total)} кадров в {number(len(records))} настройках. Один номер кадра считается отдельно для каждой настройки. Самая длинная находка в этой выборке — {hit_label(top_pair(found))}.</p>
  <p>Длины найдены в следующем числе настроек (в скобках) — {summary or "совпадений нет"}.
    <a href="romb-route-sequences.json" download>Скачать результаты и точный список кадров (JSON)</a>.</p>
  <nav aria-label="Разделы исследования">
    <a href="#matches">Совпадения</a> · <a href="#modes">Маршруты</a> · <a href="#frames">Кадры</a> ·
    <a href="#spiral-frame">Кадр 24 433</a> · <a href="#windows">Окна с нахлёстом</a> · <a href="#time">Оценка времени</a>
  </nav>
  <section id="matches">
    <h2>Первые совпадения</h2>
    <p>Для каждой настройки и длины сохранено первое совпадение среди проверенных кадров. Координаты считались от 1 в исходной решётке на этом кадре. Ссылка открывает маршрут с теми же настройками и номером кадра.</p>
    <div class="table-scroll"><table>
      <thead><tr><th>Маршрут и настройки</th><th>Правило</th><th>Длина, направление и положение</th></tr></thead>
      <tbody>{match_table(records)}</tbody>
    </table></div>
  </section>
  <section id="modes">
    <h2>Результат по каждому движению половин</h2>
    <div class="table-scroll"><table>
      <thead><tr><th>Оси</th><th>Ход и половины</th><th>Настроек</th><th>Лучшее XOR</th><th>Лучшее AND</th></tr></thead>
      <tbody>{route_table(records)}</tbody>
    </table></div>
  </section>
  <section id="frames">
    <h2>Какие кадры вошли в выборку</h2>
    <p>Искали 41 строку исходной последовательности по горизонтали →, вертикали ↓ и обеим диагоналям ↘ и ↙. Шаг по ряду или столбцу равен двум клеткам исходной решётки, шаг по диагонали — одна строка и один столбец. Пустая клетка разрывает цепочку. Длины, которые не помещаются в поле, исключены.</p>
    <p>Основная выборка ({counts['routes']} настроек) использует размеры 2N−1 на включённых осях и отскок. На выключенной горизонтали ширина N−1, на выключенной вертикали высота N. Для каждого хода и состояния половин проверены XOR и AND. В таблице ниже указаны запланированные кадры, точная выборка для каждой настройки приведена в JSON. Всего исключено {excluded} настроек, где строка 30 геометрически не помещается.</p>
    <div class="table-scroll"><table>
      <thead><tr><th>Высота ромба N</th><th>Кадры</th></tr></thead>
      <tbody>{scope_table()}</tbody>
    </table></div>
    <ul>
      <li>При N = 64 проверены ширины 4N−1, 8N−1, растущее поле и отдельно высота 4N−1. Это {counts['geometry']} настроек. Проверены кадры 1–32, затем через 8 до 512.</li>
      <li>При N = 32 проверены перескок и разворот при касании там, где он доступен. Это {counts['edges']} настроек. Проверены кадры 1–256 подряд.</li>
      <li>В поздней выборке {counts['late']} настроек общих маршрутов при N = 256 с половинами вместе. Для четырёх маршрутов проверены кадры 128, 256, …, 4096. Для спирали по часовой — 256, 512, …, 24 320 и отдельно 24 433.</li>
    </ul>
    <p>Выводы относятся к перечисленным кадрам. Пропущенные кадры между точками выборки могут содержать более длинное совпадение. Непрерывный поиск по спиралям отложен.</p>
  </section>
  <section id="spiral-frame">
    <h2>Отдельная проверка кадра 24 433</h2>
    <p>Спираль по часовой, N = 256, поле 511 × 511, половины вместе, отскок. Вершина совпала с положением на снимке. На этом кадре проверен также прежний диапазон 5–70. Строки 30–70 не встретились ни в XOR, ни в AND.</p>
    <div class="table-scroll"><table>
      <thead><tr><th>Правило</th><th>Максимум</th><th>Лучшая диагональ</th><th>Кадр и вершина (столбец, строка)</th></tr></thead>
      <tbody>{explicit_table(records)}</tbody>
    </table></div>
  </section>
  <section id="windows">
    <h2>Окна с нахлёстом</h2>
    <p>У 10-битной строки 1 024 возможных значения. Если окон больше, среди них обязательно есть дубль. Чтобы измерить покрытие, нужно считать разные значения. На N = 32, маршруте «По часовой» и кадрах 1–256 получилось следующее для строки <code>{escape(windows[0]['target'])}</code>.</p>
    <div class="table-scroll"><table>
      <thead><tr><th>Правило</th><th>Всего окон</th><th>Разных вариантов</th><th>Совпадений с шаблоном</th><th>Первый кадр</th></tr></thead>
      <tbody>{coverage_table(windows)}</tbody>
    </table></div>
  </section>
  <section id="time">
    <h2>Оценка сплошного поиска до повтора</h2>
    <p>В базовом сравнении на каждую высоту от 32 строк приходится 56 настроек движения и накопления с конечной траекторией. Учитывались фиксированные поля 2N−1 и отскок. При пороге 30 бит на N = 16 остаются 24 настройки двух осей, на N = 8 подходящих нет. Спирали и бескрайние маршруты оставлены за рамками оценки.</p>
    <div class="table-scroll"><table>
      <thead><tr><th>Высоты до N</th><th>Вариантов 30–70</th><th>Один период движения каждого</th><th>Пример подтверждённого первого повтора поля</th></tr></thead>
      <tbody>
        <tr><th scope="row">1024</th><td>360</td><td>около 4 часов</td><td>4 192 255 кадров, около 3 суток</td></tr>
        <tr><th scope="row">2048</th><td>416</td><td>около 28 часов</td><td>16 773 119 кадров, около 47 суток</td></tr>
        <tr><th scope="row">4096</th><td>472</td><td>около 9 суток</td><td>67 100 671 кадр, около 2 лет</td></tr>
      </tbody>
    </table></div>
    <p>Время оценено по локальному замеру построения и поиска по первым кадрам с тремя параллельными расчётами для сводной колонки. Пример справа — один горизонтальный XOR-маятник на максимальном N, поле 2N−1, отскок. Номера его первого повтора взяты из <a href="romb-search.html#xor">предыдущего расчёта</a>. Реальная скорость зависит от заполнения поля и маршрута.</p>
    <p>Один период движения возвращает фазы и положения, а поле может повториться через много таких периодов. Полные периоды новых маршрутов пока не измерены, поэтому общего времени сплошного прогона до повторов эта выборка не определяет.</p>
  </section>
  <p><a href="https://github.com/MIkhailNkmnme/Binary-Drum-Machine/tree/main/tools/mayatnik-journal">Исходники расчёта и отчёта</a></p>
</main>
</body>
</html>
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("windows", type=Path)
    parser.add_argument("inputs", type=Path, nargs="+")
    args = parser.parse_args()
    windows = json.loads(args.windows.read_text())
    records, excluded = load_records(args.inputs)
    sequences = (ROOT / "_js/initial-rows.js").read_text().split("]);", 1)[0]
    patterns = re.findall(r'"([01]+)"', sequences)
    data = {
        "version": 1, "app": APP_VERSION, "sourceCommit": "ed3d8a68",
        "directions": DIRECTIONS, "steps": [[2, 0], [0, 2], [1, 1], [-1, 1]],
        "witnessFields": ["frame", "row", "column", "endRow", "endColumn", "width"],
        "patterns": {n: patterns[n] for n in range(MINIMUM, 71)},
        "excludedByGeometry": excluded, "windowsExample": windows,
    }
    output = encode(data)[:-1] + ',\n"configurations":[\n'
    output += ",\n".join(encode(config) for config in records) + "\n]}\n"
    (OUTPUT / "romb-route-sequences.json").write_text(output)
    (OUTPUT / "romb-route-sequences.html").write_text(render(records, excluded, windows))
    print(f"{len(records)} configurations, {sum(len(config['checked']) for config in records)} frame checks, "
          f"{len(pairs(records))} matches, {excluded} excluded")


if __name__ == "__main__":
    main()
