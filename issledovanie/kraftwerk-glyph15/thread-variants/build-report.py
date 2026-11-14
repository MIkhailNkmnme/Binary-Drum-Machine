"""Build the comparison page and lossless SVG route plates from checked data."""
from pathlib import Path
from collections import defaultdict
import html
import json

ROOT=Path(__file__).resolve().parent
source=json.loads((ROOT.parent/'analysis.json').read_text(encoding='utf-8'))
thickness=json.loads((ROOT/'thickness.json').read_text(encoding='utf-8'))
dashed=json.loads((ROOT/'dashed.json').read_text(encoding='utf-8'))
routes={g['id']:g for g in dashed['graphs']}
out=ROOT/'plates';out.mkdir(exist_ok=True)
esc=lambda value:html.escape(str(value))

def svg_start(w,h):
    return [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><rect width="100%" height="100%" fill="#f6f4e9"/><g font-family="Arial,sans-serif" fill="#202522">']

def text(parts,x,y,value,size=16,color='#202522'):
    parts.append(f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}">{esc(value)}</text>')

def edge_xy(key):
    x,y=map(int,key[1:].split(','))
    return x,y,x+(key[0]=='H'),y+(key[0]=='V')

def graph_svg(parts,case,ox,oy,scale=24,variant=None):
    repeat=set(case['variants'][variant].get('doubledEdges',[])) if variant else set()
    for e in case['edges']:
        x,y,u,v=edge_xy(e['edge'])
        color='#c84c12' if e['edge'] in repeat else '#252b27'
        width=(2.5 if e['class']=='thin' else 4.3)
        parts.append(f'<path d="M{ox+x*scale},{oy+y*scale}L{ox+u*scale},{oy+v*scale}" stroke="{color}" stroke-width="{width}" fill="none" stroke-linecap="square"/>')
    if variant and case['variants'][variant]['possible']:
        path=case['variants'][variant]['route']['vertices']
        for p,c in ((path[0],'#158d6d'),(path[-1],'#b52c46')):
            parts.append(f'<circle cx="{ox+p[0]*scale}" cy="{oy+p[1]*scale}" r="5" stroke="#f6f4e9" stroke-width="1.5" fill="{c}"/>')

def comparison(case):
    parts=svg_start(1040,560)
    text(parts,28,33,f"Строка {case['state']:02d} · место {case['slot']} · G{case['graphId']}",24)
    text(parts,28,62,'Толщина взята из исходных кадров. Оранжевое — ребро выбранного маршрута с двумя проходами.',15)
    for panel,(label,variant) in enumerate((('Измеренная обводка',None),('A · повтор только толстого','A'),('B · повтор только тонкого','B'))):
        x=30+panel*345
        text(parts,x,103,label,18)
        graph_svg(parts,case,x+24,135,24,variant)
        if variant:
            result=case['variants'][variant]
            if result['possible']:
                text(parts,x,466,f"Путь есть · повторено рёбер: {len(result['doubledEdges'])}",15,'#17705a')
                text(parts,x,492,f"Всего проходов: {len(result['route']['edges'])}",14)
            else:
                reason='Раздельные части' if result['reason']=='disconnected-original-graph' else 'Ограничение нечётных узлов'
                text(parts,x,466,'Одного пути нет',17,'#b52c46')
                text(parts,x,492,reason,14)
        else:
            text(parts,x,466,'Тонкое ≈3–4 px, толстое обычно ≈6 px',14)
            text(parts,x,492,'Толщина не равна доказанному числу проходов.',13)
    text(parts,28,535,'Начало — зелёная точка, конец — красная. При замкнутом обходе они совпадают. Координаты пути — в thickness.json.',13)
    parts.append('</g></svg>')
    name=f'state-{case["state"]:02d}-slot-{case["slot"]}.svg'
    (out/name).write_text(''.join(parts),encoding='utf-8')
    return name

def dashed_plate(row):
    parts=svg_start(1100,940)
    text(parts,28,36,f"G{row['id']} · нить с пустотами 1–0",26)
    text(parts,28,67,'Белый заполненный квадрат — запись 1. Синий кружок — пустое посещение, он не стирает рисунок.',16)
    target=set(map(tuple,row['target']));scale=25;ox=55;oy=122
    mx=min(x for x,y in target);my=min(y for x,y in target)
    px=lambda p:(ox+(p[0]-mx)*scale,oy+(p[1]-my)*scale)
    parts.append('<rect x="22" y="92" width="485" height="690" fill="#172126" rx="5"/>')
    for p in sorted(target):
        x,y=px(p);parts.append(f'<rect x="{x-scale/2}" y="{y-scale/2}" width="{scale}" height="{scale}" fill="#e8edf5"/>')
    if row['status']=='found':
        route=row['route'];points=' '.join(f'{px(p)[0]},{px(p)[1]}' for p in route)
        parts.append(f'<polyline points="{points}" stroke="#28b3b1" stroke-width="1.2" fill="none" opacity=".65"/>')
        labels=defaultdict(list)
        for i,p in enumerate(route):labels[tuple(p)].append(i)
        for p,indices in labels.items():
            x,y=px(p)
            if any(i%2 for i in indices):parts.append(f'<circle cx="{x}" cy="{y}" r="7" fill="none" stroke="#159ea9" stroke-width="1.3"/>')
            label=','.join(map(str,indices))
            color='#263539' if p in target else '#71e9f0'
            parts.append(f'<text x="{x}" y="{y+3}" text-anchor="middle" font-size="{7 if len(label)<9 else 5}" fill="{color}">{label}</text>')
        text(parts,545,120,f"{len(target)} белых + {len(route)//2} пустых посещений",22)
        text(parts,545,152,f"{len(route)-1} соседних переходов",18)
        text(parts,545,185,'Ни один отрезок пути не пройден дважды.',16)
        text(parts,545,214,'Белые клетки записаны ровно по одному разу.',16)
        text(parts,545,243,'Поворот H↔V проходит через диагональный шаг.',16)
        text(parts,545,284,'Развёрнутая нить: слева направо, затем следующая строка.',14)
        parts.append('<rect x="535" y="300" width="535" height="455" fill="#172126" rx="5"/>')
        for i in range(len(route)):
            x=549+(i%20)*24;y=314+(i//20)*32
            fill='#172126' if i%2 else '#e8edf5'
            parts.append(f'<rect x="{x}" y="{y}" width="13" height="13" fill="{fill}" stroke="#7e9186"/>')
            text(parts,x,y+25,i,8,'#b6c9cf')
    else:
        text(parts,545,160,'Маршрут пока не найден',26,'#ac571d')
        text(parts,545,201,'Достигнут лимит поиска.',19)
        text(parts,545,235,'Это не доказательство невозможности.',18)
    text(parts,28,826,'Шаг растра — половина исходной осевой клетки: концы рёбер ×2 и их середины.',17)
    text(parts,28,857,'Синий путь и номера — пояснение, в конечный белый рисунок они не входят. Видеотолщина здесь не моделируется.',15)
    text(parts,28,889,'Пустой шаг может попадать на уже белую клетку. Отсутствие краски не означает закрашивание фоном.',16)
    parts.append('</g></svg>')
    (out/f'dashed-g{row["id"]}.svg').write_text(''.join(parts),encoding='utf-8')

def main():
    for row in dashed['graphs']:dashed_plate(row)
    table=[]
    for state in range(1,16):
        cells=[]
        for case in [c for c in thickness['cases'] if c['state']==state]:
            name=comparison(case);r=routes[case['graphId']]
            a='да' if case['variants']['A']['possible'] else 'нет'
            b='да' if case['variants']['B']['possible'] else 'нет'
            d='есть' if r['status']=='found' else 'пока не найден'
            cells.append(f'<td><a href="plates/{name}"><b>G{case["graphId"]}</b> · A: {a} · B: {b}</a><br><a href="plates/dashed-g{case["graphId"]}.svg">Пунктир: {d}</a></td>')
        table.append(f'<tr><th>{state:02d}</th>{"".join(cells)}</tr>')
    found=sum(r['status']=='found' for r in routes.values());unknown=45-found
    first=next(c for c in thickness['cases'] if c['variants']['A']['possible'] and not c['variants']['B']['possible'])
    example=f'plates/state-{first["state"]:02d}-slot-{first["slot"]}.svg'
    markup=f'''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Толщина, повтор и пустота · глифы Зеркалиуса</title><link rel="stylesheet" href="../page.css"><style>.matrix td{{white-space:normal;min-width:165px;vertical-align:top}}.matrix a{{line-height:1.7}}.result-table td{{white-space:normal}}.wide{{max-width:100%;width:100%}}code{{overflow-wrap:anywhere}}</style><body><main>
<nav><a href="../">← Первые 15 секунд</a><a href="../../Zerkalius-issledovanie.html">Исследования</a><a href="#all">Все 15 × 4</a></nav>
<header class="intro"><p class="eyebrow">ЗЕРКАЛИУС / ИСС-108 / 14 НОЯБРЯ 2026</p><h1>Толщина.<br>Повтор. Пустота.</h1><p class="lead">Три варианта нити для тех же 45 форм. Повторы разрешаем по видимой толщине, а пустые шаги проверяем отдельно.</p></header>
<section><h2>Что меняет правило</h2><div class="table-scroll"><table class="result-table"><thead><tr><th>Правило</th><th>Форм с одним путём</th><th>Что именно разрешено</th></tr></thead><tbody>
<tr><td>Без повторов</td><td>13 / 45</td><td>Каждое видимое ребро один раз.</td></tr>
<tr><td>A · повтор на толстом</td><td><b>36 / 45</b></td><td>Тонкое — один раз; толстое — один или два. Все связные формы проходят.</td></tr>
<tr><td>B · наоборот</td><td><b>16 / 45</b></td><td>Толстое — только один раз; тонкое — один или два.</td></tr>
<tr><td>Нить 1–0</td><td><b>{found} найдено; {unknown} пока неизвестно</b></td><td>Заполненный квадрат, пустой соседний шаг, снова квадрат. Половинный шаг осевой сетки.</td></tr></tbody></table></div>
<p>В A и B каждый исходный отрезок покрывается обязательно. Второй проход разрешён только указанному классу; третий запрещён. «Допускаем два» не означает «все такие отрезки обязаны пройти дважды».</p>
<p>Здесь толщина служит <b>меткой разрешения повторить отрезок</b>. Два точно совпадающих штриха сами по себе не становятся шире: при OR след остаётся, при XOR второй такой след гасится. Чтобы получать толщину именно от двух нитей, нужно отдельно задать их смещение или правило отрисовки кратности. Этого в проверку A/B не добавляли.</p>
<aside><b>Если удваивать обязательно:</b> все толстые по два и тонкие по одному — ни одного успешного случая; обратное обязательное правило — тоже ни одного. Здесь различие между «можно» и «нужно» меняет результат полностью.</aside>
<p>Для 60 мест в пятнадцати строках A работает в 49, B — в 21. В таблице выше считаются 45 разных осевых форм. Девять форм несвязны: повтор уже существующей линии не соединит отдельные части.</p>
<a href="{example}"><img class="wide" src="{example}" alt="Сравнение измеренной обводки и двух правил повторного прохода"></a><p class="caption">Оранжевое — рёбра, действительно удвоенные в построенном маршруте. Остальные проходят один раз. Нажми на схему для увеличения; все координаты маршрута сохранены в JSON.</p></section>
<section><h2>Толщина видна в кадре</h2><p>На 3188 отрезках-позициях выделяются два растровых класса: тонкие примерно 3–4 пикселя, основные толстые около 6. Встречаются и более широкие участки. Измеряем середины отрезков, не углы и не перекрёстки, по трём снимкам каждого состояния.</p><p>Между всеми измеренными поперечными сечениями остаётся промежуток <b>4,14–5,58 пикселя</b>. Порог 4,7 лежит внутри него; класс не меняется ни между тремя снимками, ни между одиннадцатью сечениями. Ширину измеряем по половине контраста относительно местного фона. Это свойства имеющегося растра, а не доказательство числа нитей.</p>
<a href="thickness-atlas.png"><img src="thickness-atlas.png" alt="Атлас измеренных толщин и результатов обоих правил" loading="lazy"></a>
<h3>Одинаковый каркас, разная толщина</h3><p>У G19 в строках 3 и 12 один и тот же отрезок V0,5 меняется примерно с <b>3,57 до 5,88 px</b>. Поэтому прежний повтор этих строк точен для осевых рёбер, но не для всей обводки. Получилось 45 геометрий и 46 сочетаний «геометрия + толщина»; результат A/B у G19 от этой смены не меняется.</p><a href="source-thickness-change.png"><img src="source-thickness-change.png" alt="Одно и то же ребро G19 тонкое в строке 3 и толстое в строке 12" loading="lazy"></a></section>
<section><h2>Почему повтор помогает</h2><p>В каждой промежуточной точке нить должна войти и выйти. Поэтому число подходящих проходов там чётное; нечётными могут остаться только начало и конец. Повтор отрезка добавляет по одному проходу к двум его концам и меняет их чётность. Если разрешённые для повтора участки не связывают нужные нечётные узлы, один путь невозможен.</p><p>Это точная проверка для принятой модели: пересечения считаются общими точками, тонкие или толстые рёбра повторяются только по выбранному правилу. Для A достаточно связности всех исходных рёбер; именно на этих данных разрешённых толстых участков хватает для исправления чётности. В общем случае этого обещать нельзя.</p></section>
<section><h2>Нить с пустотами</h2><p>Сохраняем наши правила: <b>1 — заполненный квадрат; 0 — ничего не рисуем</b>. Каждый соседний переход, в том числе диагональный, переключает 1/0. Прямой переход класса H↔V запрещён, между ними нужен диагональный шаг. Пустота не стирает ранее нарисованное.</p><p>Используем уже принятую клеточную конструкцию: концы осевых рёбер умножены на два, добавлены середины. Получается шаг в половину исходной клетки. Это не перенос видеопикселей и не моделирование двух толщин: отдельная проверка того, можно ли собрать клеточную форму чередованием заполненных и пустых квадратов.</p>
<p>В найденных путях каждая целевая клетка закрашена ровно один раз, ни один отрезок пути не повторён; точечные пересечения допустимы. Поэтому OR и XOR дают одинаковый конечный рисунок. Пустой шаг может пройти по уже белой клетке, ничего с ней не делая.</p>
<p><b>{found} форм имеют проверенный маршрут.</b> Для остальных {unknown} поиск достиг лимита; невозможность не доказана. При N белых клетках найденные маршруты имеют N−1 пустых посещений и 2N−2 перехода — минимальное число для такого чередования при старте и финише на 1.</p>
<details><summary>Развернуть пример G10: пустые шаги соединяют раздельные видимые части</summary><a href="plates/dashed-g10.svg"><img src="plates/dashed-g10.svg" alt="Нить 1–0 для G10, маршрут и развёрнутая последовательность" loading="lazy"></a></details></section>
<section id="all"><h2>Все пятнадцать строк</h2><p>В каждой ячейке первая ссылка открывает обводку и два варианта повторов. Вторая — отдельную схему нити 1–0. На узком экране таблица прокручивается вбок.</p><div class="table-scroll"><table class="matrix"><thead><tr><th>Строка</th><th>Место 1</th><th>Место 2</th><th>Место 3</th><th>Место 4</th></tr></thead><tbody>{''.join(table)}</tbody></table></div></section>
<section><h2>Проверки и исходники</h2><p>Независимо проверены 70 маршрутов A/B, все найденные маршруты 1–0 и сертификаты невозможности A/B. Критерий разрешённых удвоений также сверен полным перебором 2186 малых задач. В данных остаются измерения, разрешённые и фактически удвоенные рёбра, последовательности вершин и результаты ограниченного поиска.</p><p><a href="thickness.json">Толщины и маршруты A/B</a> · <a href="dashed.json">Маршруты 1–0</a> · <a href="independent-check.json">Независимая проверка</a> · <a href="thickness-check.json">Контроль измерения и решателя</a></p><p><a href="README.md">Метод и повторение</a> · <a href="https://github.com/MIkhailNkmnme/Binary-Drum-Machine/tree/main/issledovanie/kraftwerk-glyph15/thread-variants">Все данные и код в GitHub</a></p><p class="caption">Источник изображения — заставка <a href="https://www.youtube.com/watch?v=72x7kbeeGwQ">Kraftwerk live 2025 Coachella soundboard</a>, канал Hotel Mario. Это проверка предложенных моделей, а не установление авторского алгоритма.</p></section><footer>ИСС-108 · v0.001 · 2026-11-14</footer></main></body></html>'''
    (ROOT/'index.html').write_text(markup+'\n',encoding='utf-8')
    print(f'Built 60 comparison plates, 45 dashed plates; {found} found, {unknown} unknown')

if __name__=='__main__':main()
