"""Static illustrated research page from measured graph data."""
from pathlib import Path
from html import escape as esc
import json
import zipfile

root=Path(__file__).resolve().parent
d=json.loads((root/'analysis.json').read_text(encoding='utf-8'))
v=json.loads((root/'validation.json').read_text(encoding='utf-8'))
graphs={g['id']:g for g in d['graphs']}

def segment(key, colour, dash=''):
    x,y=map(int,key[1:].split(','))
    x2,y2=(x+1,y) if key[0]=='H' else (x,y+1)
    return f'<path d="M{x} {y}L{x2} {y2}" stroke="{colour}" stroke-width=".11" {dash}/>'

def picture(g, previous, label):
    now=set(g['edges']);before=set(previous['edges']) if previous else now
    grid=''.join(f'<path d="M{x} 0V12"/>' for x in range(9))+''.join(f'<path d="M0 {y}H8"/>' for y in range(13))
    removed=''.join(segment(e,'#2983ba','stroke-dasharray=".13 .12"') for e in sorted(before-now))
    lines=''.join(segment(e,'#d65012' if e not in before else '#202522') for e in sorted(now))
    return f'<svg viewBox="-1 -1 10 14" role="img" aria-label="{esc(label)}"><g fill="none" stroke="#dfded3" stroke-width=".025">{grid}</g><g fill="none">{removed}{lines}</g></svg>'

episodes=[]
previous=None
for e in d['episodes']:
    cards=[]
    for slot,gid in enumerate(e['glyphIds']):
        g=graphs[gid];s=g['topology']
        before=graphs[previous['glyphIds'][slot]] if previous else None
        verdict='Один штрих' if s['eulerTrail'] else ('Есть разрыв' if s['components']>1 else 'Нужны повторы / отрывы')
        cards.append(f'<figure>{picture(g,before,"Глиф "+str(slot+1)+", форма G"+str(gid))}<figcaption><b>{slot+1} · G{gid}</b><br>{s["edgeCount"]} рёбер · {s["components"]} комп.<br>{s["oddCount"]} нечётных · {len(s["unitSquareCycles"])} □<br><strong>{verdict}</strong></figcaption></figure>')
    end=min(15,e['end'])
    episodes.append(f'''<section class="state" id="state-{e['id']}"><header><h3>{e['id']:02d} / {e['start']:.3f}–{end:.3f} с</h3><span>{e['sampleCount']} уверенных наблюдений</span></header>
      <div class="row-scroll"><div class="glyph-row">{''.join(cards)}</div></div>
      <details><summary>Сравнить с исходным кадром</summary><a href="captures/{e['witnessFile']}"><img src="captures/{e['witnessFile']}" alt="Опорный кадр состояния {e['id']}" width="1337" height="748" loading="lazy"></a></details></section>''')
    previous=e

transition_rows=[]
for t in d['transitions']:
    vals=' / '.join(str(x['xorCount']) for x in t['changes'])
    transition_rows.append(f'<tr><td>{t["fromState"]} → {t["toState"]}</td><td>{t["bracket"][0]:.3f}–{t["bracket"][1]:.3f}</td><td>{vals}</td></tr>')

html=f'''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f6f4e9"><title>Чёткие глифы Kraftwerk · 15 секунд · Зеркалиус</title>
<link rel="stylesheet" href="page.css?v=1"><meta name="description" content="15 наборов четырёх клеточных глифов: кадры, сетка 8×12, смены раз в секунду, проверка одной нити и гипотезы XOR квадратов."></head><body>
<main><nav><a href="../Zerkalius-issledovanie.html">← Исследования</a><a href="../kraftwerk-glyph22/">Прежние 22 секунды</a><a href="#atlas">15 строк глифов ↓</a></nav>
<header class="intro"><p class="eyebrow">ЗЕРКАЛИУС / ИСС-107 / 14 НОЯБРЯ 2026</p><h1>Четыре глифа.<br>Линии становятся видны.</h1><p class="lead">Чёткая заставка позволила восстановить <b>15 наборов по четыре глифа</b> на сетке 8 × 12. В них 45 разных форм; 40 уже встречались в прежнем разборе.</p><p class="status">Покадровое исследование · авторский генератор пока не установлен</p></header>
<nav class="contents"><a href="#law">Как они меняются</a><a href="#thread">Одна нить?</a><a href="#atlas">Все состояния</a><a href="#method">Метод и точность</a><a href="#files">Скачать</a></nav>

<section id="source"><h2>Что именно разбираем</h2><p>Первые 15 секунд <a href="https://www.youtube.com/watch?v=72x7kbeeGwQ">ролика «Kraftwerk live 2025 Coachella soundboard»</a>, канал Hotel Mario. Здесь рассматриваем изображение и смену глифов. Это заставка данного ролика; по ней одной нельзя установить происхождение анимации или авторскую программу.</p>
<video controls playsinline preload="metadata" poster="captures/{d['episodes'][5]['witnessFile']}" src="source-excerpt-silent.mp4" aria-label="Немой фрагмент первых 15 секунд">Открыть <a href="source-excerpt-silent.mp4">MP4</a></video>
<p class="caption">Немой фрагмент восстановлен из снимков проигрывателя с отметками времени. Это не прямое извлечение исходных видеокадров. Время сохранено; область плеера обрезана до глифов и надписей.</p></section>

<section id="law"><p class="eyebrow">НАБЛЮДАЕМАЯ ЗАКОНОМЕРНОСТЬ</p><h2>Обновляется весь ряд,<br>примерно раз в секунду.</h2>
<ol><li><b>Четыре места обновляются вместе.</b> В каждом из 14 наблюдаемых переходов меняются все четыре глифа. Оценка шага по границам — около 1,002 с; точность ограничена снимками экрана.</li>
<li><b>Меняются отдельные клеточные отрезки.</b> Есть общая неподвижная часть и переменные участки — верх, изгибы, внутренние перемычки и квадратные петли. На каждом месте неизменными остаются соответственно 26, 27, 25 и 30 рёбер из наблюдаемого ряда.</li>
<li><b>Повторы есть, простого периода 9 с нет.</b> Набор около 2–3 с повторяется около 11–12 с (строки 3 и 12). Но из шести доступных пар со сдвигом на девять состояний совпадает целиком только эта пара.</li>
<li><b>Формы узнаваемы между роликами.</b> 40 из 45 разных графов точно совпадают с прежним набором после приведения к общей сетке. Остальные пять отличаются от ближайших прежних схем на 1, 2, 3, 6 и 6 рёбер. Причиной может быть и другая форма, и погрешность старой съёмки.</li></ol>
<aside><h3>Что это говорит про XOR и квадраты</h3><p>Разность двух кадров удобно считать через XOR: сохраняем только добавленные и исчезнувшие рёбра. Но это способ сравнения уже известных кадров, а не правило получения следующего.</p><p>Гипотеза «каждое изменение — XOR с целыми замкнутыми квадратами» <b>не объясняет этот ряд</b>. У XOR замкнутых циклов число сходящихся линий в любой точке чётное. В 51 из 56 отдельных переходов глифов разность содержит нечётные вершины. Пять переходов допускают разложение на циклы, но это не доказывает авторский алгоритм.</p><p>AND тоже требует второго входного рисунка. Без правила его изменения название булевой операции не предсказывает следующий глиф.</p></aside>
<details><summary>Границы всех переходов и число изменённых отрезков</summary><div class="table-scroll"><table><thead><tr><th>Строки</th><th>Интервал смены, с</th><th>XOR-рёбра: 1 / 2 / 3 / 4</th></tr></thead><tbody>{''.join(transition_rows)}</tbody></table></div></details></section>

<section id="thread"><p class="eyebrow">ПРО ТВОЮ НЕПРЕРЫВНУЮ НИТЬ</p><h2>Одним проходом —<br>13 из 45 разных форм.</h2><div class="numbers"><p><b>7</b>замкнутых обходов</p><p><b>6</b>открытых обходов</p><p><b>9</b>несвязных форм</p><p><b>23</b>связных, но с лишними нечётными узлами</p></div>
<p>Берём все видимые отрезки, включая внутренние перекладины. Пересечение считаем общей точкой, а каждый отрезок разрешаем пройти только один раз. Для одного штриха фигура должна быть связной и иметь ровно 0 или 2 точки с нечётным числом сходящихся отрезков.</p>
<p>Квадрат, отделённый от корпуса, требует перехода через пустое место или второго штриха. Квадрат, касающийся другого контура в углу, может проходиться одной нитью: в общей точке сходятся четыре отрезка. Поэтому число маленьких квадратов само по себе не решает задачу.</p>
<p>Это проверка непрерывной линии по видимым рёбрам. Твоя отдельная модель <a href="../kraftwerk-glyph22/curve-analysis/square-thread.html">пунктирной нити 1–0 с заполненными квадратами</a> допускает невидимые шаги и требует другого поиска; результаты этих двух задач не смешиваем.</p></section>

<section id="atlas"><p class="eyebrow">В КАЖДОЙ СТРОКЕ — ЧЕТЫРЕ ГЛИФА</p><h2>Все 15 устойчивых наборов.</h2><p class="legend"><span class="kept">Чёрное — сохранилось</span> · <span class="added">оранжевое — добавилось</span> · <span class="removed">синий пунктир — исчезло</span></p><p>Время рядом — интервал уверенных наблюдений, а не точная длительность состояния. Начальное затемнение скрывает детали: первый набор совместим с кадрами от ≈0,19 с, строго подтверждён от 0,739 с. Последнее наблюдение пересекает границу 15 с не более чем на 0,021 с.</p><p class="caption">На узком экране ряд из четырёх фигур прокручивается вбок. «Комп.» — отдельные связные части; «нечётные» — точки с нечётной степенью; □ — полные маленькие квадраты 1 × 1. Один и тот же G-номер означает ту же форму.</p>
{''.join(episodes)}
<p class="downloads"><a href="atlas.svg" download>Все строки · SVG</a><a href="atlas.png" download>Все строки · PNG</a></p></section>

<section id="method"><h2>Как получена клеточная схема</h2><p>Сохранены 446 снимков области видео. При воспроизведении со скоростью 0,25 для каждого записаны время до и после захвата. Максимальная ширина такого интервала — 0,061611 с, максимальный промежуток между интервалами — 0,029308 с. В начале есть почти чёрные кадры, они сохранены, но не превращены в самостоятельные формы.</p>
<p>По ярким кадрам найдены девять вертикальных и тринадцать горизонтальных линий сетки для каждого места. Проверяется темнота середины каждого возможного ребра относительно жёлтого фона; так общее осветление или затемнение не подменяет изменение формы. Неуверенные участки остаются в данных.</p>
<a href="overlay-check.png"><img src="overlay-check.png" alt="Проверка совпадения восстановленной сетки и видимых чёрных линий" width="1337" height="748" loading="lazy"></a>
<p class="caption">Наложение сетки и восстановленных осей на наблюдаемый кадр. Толщина чёрного штриха не создаёт второго ребра: анализируется его осевая линия.</p>
<p>Для 15 опорных кадров проверены пять положений сетки (включая сдвиг на один пиксель) и пять порогов выделения: все 375 сочетаний дали те же рёбра. Отдельный проверяющий скрипт независимо пересчитал связность, степени, квадраты и разности всех 56 переходов. Это подтверждает реконструкцию наблюдаемого рисунка, но не раскрывает исходный генератор.</p></section>

<section id="files"><h2>Кадры, схемы и исходники</h2><p class="downloads"><a href="glyph15-study.zip" download>Комплект исследования · ZIP</a><a href="source-excerpt-silent.mp4" download>15 секунд · MP4 без звука</a><a href="analysis.json">Все графы и наблюдения · JSON</a></p><p><a href="validation.json">Проверка выделения</a> · <a href="independent-check.json">Независимая проверка графов</a> · <a href="captures/samples.json">446 меток времени и хешей</a> · <a href="excerpt-provenance.json">Происхождение MP4</a> · <a href="README.md">Воспроизведение анализа</a></p><p><a href="https://github.com/MIkhailNkmnme/Binary-Drum-Machine/tree/main/issledovanie/kraftwerk-glyph15">Все 446 кадров и код в GitHub</a>. ZIP содержит 15 опорных кадров и компактный комплект просмотра; полный ряд остаётся в репозитории.</p></section>
<footer>ИСС-107 · v0.001 · Зеркалиус · 2026-11-14<br>Изображения исходного ролика приведены для анализа. Источник и границы измерений указаны выше.</footer></main></body></html>'''
(root/'index.html').write_text(html+'\n',encoding='utf-8')
files=['index.html','page.css','README.md','analyze.py','analysis.json','atlas.svg','atlas.png','overlay-check.png','validation.json','independent-check.json','check-independent.py','source-excerpt-silent.mp4','excerpt-provenance.json','build-excerpt.py','build-page.py','prepare-captures.py','captures/samples.json']
files+=list(dict.fromkeys('captures/'+e['witnessFile'] for e in d['episodes']))
with zipfile.ZipFile(root/'glyph15-study.zip','w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for name in files:z.write(root/name,name)
    z.writestr('READ-ME.txt','Откройте index.html. В комплекте 15 опорных кадров; все 446 снимков и неизменный JSON доступны в GitHub по ссылке на странице. Для полного повторения анализа скачайте каталог captures из репозитория.\n')
with zipfile.ZipFile(root/'glyph15-study.zip') as z:
    assert z.testzip() is None
    for name in files:assert z.read(name)==(root/name).read_bytes()
print('Built 15-row page and study ZIP', (root/'glyph15-study.zip').stat().st_size)
