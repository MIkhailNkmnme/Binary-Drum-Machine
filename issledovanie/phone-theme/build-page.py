"""Build the static, usable-without-JavaScript phone collection from its manifests."""
from pathlib import Path
import json
from html import escape

ROOT = Path(__file__).resolve().parent
e = lambda value: escape(str(value), quote=True)

def read(name):
    return json.loads((ROOT / name).read_text(encoding='utf-8-sig'))

def duration(seconds):
    return f'{int(seconds)//60}:{int(seconds)%60:02d}' if seconds >= 10 else f'{seconds:.1f} с'.replace('.', ',')

def link(path, label, download=True):
    return f'<a href="{e(path)}"' + (' download' if download else '') + f'>{e(label)}</a>'

def player(path, title):
    return f'<audio controls preload="none" src="{e(path)}" aria-label="{e(title)}">{link(path, "Слушать / скачать")}</audio>'

def main():
    music, art = read('music.json'), read('wallpapers.json')
    tracks, signals, papers = music['tracks'], music['notifications'], art['wallpapers']
    track_html = []
    for i, t in enumerate(tracks):
        ring = t['ringtone']
        track_html.append(f'''<article class="track" id="{e(t['id'])}">
          <p class="eyebrow">0{i+1} / НОВАЯ КОМПОЗИЦИЯ · {e(t['bpm'])} BPM · {duration(t['duration'])}</p>
          <h3>{e(t['title'])}</h3><p class="description">{e(t['description'])}</p>
          {player(t['src'], t['title'])}
          <p class="links">{link(t['src'], 'Скачать трек · MP3')}</p>
          <details class="ring"><summary>На звонок · {duration(ring['duration'])}</summary>
            {player(ring['mp3'], t['title'] + ' — на звонок')}
            <p class="links">{link(ring['mp3'], 'MP3')} {link(ring['m4r'], 'M4R')} <a href="#install">Как установить</a></p>
          </details></article>''')
    notification_html = []
    for i, s in enumerate(signals):
        notification_html.append(f'''<article class="signal" id="{e(s['id'])}">
          <div class="signal-heading"><span class="number">{i+1:02d}</span><div><h3>{e(s['title'])}</h3>
          <p>{e(s['sourceTitle'])} · {duration(s['duration'])}</p></div></div>
          {player(s['src'], s['title'])}<p class="links">{link(s['src'], 'MP3')} {link(s['wav'], 'WAV')}
          <span class="source-time">Фрагмент {float(s['start']):.2f}–{float(s['end']):.2f} с</span></p></article>''')
    def gallery(variant, category=None):
        items=[]
        for p in papers:
            if p['variant'] != variant or p.get('category') != category: continue
            items.append(f'''<figure class="wallpaper"><a class="paper-link" href="{e(p['src'])}" aria-label="Открыть обои «{e(p['title'])}» в полном размере">
            <img src="{e(p['thumb'])}" width="360" height="800" alt="{e(p['description'])}" loading="lazy" decoding="async"></a>
            <figcaption><h3>{e(p['title'])}</h3><p>{p['width']} × {p['height']} · PNG</p>
            {("<p class=paper-description>" + e(p["description"]) + "</p>") if p.get("category") else ""}
            <p class="links">{link(p['src'], 'Скачать')} {link(p['svg'], 'SVG')}</p></figcaption></figure>''')
        return '\n'.join(items)
    themes = [
        ('sierpinski', 'Серпинский', 'Один исходный бит и XOR двух соседей. Треугольник раскрывается на всё меньшие подобные треугольники.'),
        ('animatrix', 'Аниматрицы', 'Кадры из действующего движка Аниматрицы. Исходная сцена и число шагов сохранены в рецепте каждого изображения.'),
        ('pendulums', 'Маятники', 'Два рассчитанных поля, отражения и задержки. Цвет помогает увидеть вклад каждого построения и места их совпадений.'),
        ('rhombi', 'Ромбы', 'Зеркальные треугольники образуют ромбы. Повторение и сдвиг открывают внутренние клеточные узоры.'),
        ('rgb', 'Наложения RGB', 'Три маски управляют каналами R, G и B. RG — жёлтый, RB — пурпурный, GB — голубой; совпадение всех трёх — белое.')
    ]
    geometric_html=''.join(f'<div class="gallery-heading" id="{category}"><h3>{title}</h3><a href="#geometric">К темам ↑</a></div><p class="gallery-note">{description}</p><div class="wallpapers">{gallery("color",category)}</div>' for category,title,description in themes)
    theme_nav=''.join(f'<a href="#{category}">{title}</a>' for category,title,_ in themes)
    hero_ids=['geometric-sierpinski-solar','geometric-rgb-prism','geometric-rhombi-aurora']
    hero=[p for ident in hero_ids for p in papers if p['id']==ident]
    if len(hero)!=3: hero=[p for p in papers if p['variant']=='color'][:3]
    count=len(papers)
    hero_html=''.join(f'<div class="phone phone-{i}"><img src="{e(p["thumb"])}" alt="{e(p["title"])}" width="360" height="800"><span class="phone-clock" aria-hidden="true">13:13</span></div>' for i,p in enumerate(hero))
    html = f'''<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#101719"><meta name="description" content="Зеркалиус на телефоне: четыре новых трека, рингтоны, 20 звуков уведомлений и {count} обоев. Серпинский, Аниматрицы, маятники, ромбы и RGB. Слушать и скачать бесплатно.">
<title>Зеркалиус — тема на телефон</title><link rel="stylesheet" href="page.css?v=2">
</head><body><a class="skip" href="#tracks">К музыке</a>
<header class="masthead"><a class="wordmark" href="../../index.html"><span aria-hidden="true">◇</span> ЗЕРКАЛИУС</a>
<nav aria-label="На странице"><a href="#tracks">Музыка</a><a href="#signals">Сигналы</a><a href="#wallpapers">Обои</a></nav></header>
<main><section class="hero" aria-labelledby="title"><div class="hero-copy"><p class="eyebrow">ТЕМА НА ТЕЛЕФОН / ВЫПУСК 02</p>
<h1 id="title">Зеркалиус.<br><em>В кармане.</em></h1>
<p class="lead">Маятниковый ритм на звонок.<br>Несколько нот — на сообщение.<br>Движение, остановленное на экране.</p>
<p class="hero-count">4 новых трека <span>·</span> 20 сигналов <span>·</span> {count} обоев</p>
<div class="hero-actions"><a href="downloads/zerkalius-phone-theme.zip" download>↓ Скачать весь набор</a><a href="#tracks">Сначала послушать ↘</a></div>
<p class="small">MP3 · M4R · WAV · PNG. Без регистрации.</p><p class="new-release"><a href="#geometric">Новое: 15 цветных обоев — Серпинский, Аниматрицы и RGB ↓</a></p></div><div class="hero-art" aria-label="Примеры обоев на экране телефона">{hero_html}</div></section>

<section id="tracks" class="section"><header class="section-heading"><div><p class="eyebrow">01 / МУЗЫКА И ЗВОНКИ</p><h2>Ещё один оборот.</h2></div><p>Две электронные и две камерные композиции. Внутри каждой — короткая версия на звонок.</p></header>
<div class="tracks">{''.join(track_html)}</div>
<details class="originals"><summary>Два трека, с которых всё началось</summary><div class="original-grid">
<article><h3>Маятниковый привод</h3><p>Робо-техно · 128 BPM</p>{player('../../mayatnik/synthesis-album/pendulum-drive.mp3','Маятниковый привод')}{link('../../mayatnik/synthesis-album/pendulum-drive.mp3','Скачать MP3')}</article>
<article><h3>Канон двух берегов</h3><p>Камерная вариация · 84 BPM</p>{player('../../mayatnik/synthesis-album/two-shores-canon.mp3','Канон двух берегов')}{link('../../mayatnik/synthesis-album/two-shores-canon.mp3','Скачать MP3')}</article></div></details>
<p class="section-download">{link('downloads/zerkalius-music.zip','↓ Музыка и рингтоны одним архивом')}</p></section>

<section id="signals" class="section"><header class="section-heading"><div><p class="eyebrow">02 / SMS И УВЕДОМЛЕНИЯ</p><h2>Маленькие вести.</h2></div><p>Двадцать коротких фрагментов из шести мелодий. Название исходного трека и место вырезки указаны рядом.</p></header>
<div class="signals">{''.join(notification_html)}</div><p class="section-download">{link('downloads/zerkalius-notifications.zip','↓ Все 20 сигналов · MP3 + WAV')}</p></section>

<section id="wallpapers" class="section"><header class="section-heading"><div><p class="eyebrow">03 / ОБОИ</p><h2>Геометрия в цвете.</h2></div><p>{count} изображений 1440 × 3200. Верхняя часть свободнее — под часы. Картинки без надписей; часы выше показаны только в примере.</p></header>
<div id="geometric" class="collection-intro"><p class="eyebrow">НОВОЕ / 15 ЦВЕТНЫХ ПОЛЕЙ</p><nav class="theme-nav" aria-label="Темы новых обоев">{theme_nav}<a href="#atlas">Первый атлас</a><a href="#mono">Чёрно-белые</a></nav><p>{link('downloads/zerkalius-geometric-wallpapers.zip','↓ Только 15 новых обоев · PNG')}</p></div>
{geometric_html}
<div class="gallery-heading" id="atlas"><h3>Первый атлас · цвет</h3><a href="#mono">К чёрно-белым ↓</a></div><div class="wallpapers">{gallery('color')}</div>
<div class="gallery-heading" id="mono"><h3>Чёрное и белое</h3><span>В том числе на чёрном фоне</span></div><div class="wallpapers">{gallery('mono')}</div>
<p class="section-download">{link('downloads/zerkalius-wallpapers.zip','↓ Все обои · PNG')}</p></section>

<section id="install" class="section practical"><header class="section-heading"><div><p class="eyebrow">04 / НА ВАШЕМ ТЕЛЕФОНЕ</p><h2>Скачать. Выбрать. Оставить.</h2></div></header>
<div class="help-grid"><article><h3>Android</h3><p>Скачайте MP3. Для звонка выберите свой файл в настройках звука; при необходимости поместите его в папку <b>Ringtones</b>. Звук уведомлений выбирается отдельно, иногда в настройках самого приложения. Названия пунктов зависят от телефона.</p><a href="https://support.google.com/android/answer/9082609?hl=ru" target="_blank" rel="noopener">Инструкция Google ↗</a></article>
<article><h3>iPhone</h3><p>Сохраните MP3 в «Файлы», импортируйте его в GarageBand и экспортируйте как рингтон. При экспорте можно назначить звук звонка или сообщения. Здесь версии на звонок короче 30 секунд. M4R приложен для способов переноса, которые поддерживают этот формат.</p><a href="https://support.apple.com/ru-ru/120692" target="_blank" rel="noopener">Инструкция Apple ↗</a></article>
<article><h3>Экран</h3><p>Откройте обои в полном размере и сохраните PNG в фотографии или загрузки. Затем выберите картинку в настройках обоев. Перед установкой подвиньте кадр под часы и значки — пропорции экранов различаются.</p></article></div></section>

<section class="about section" id="logic"><p class="eyebrow">ЧТО С ЧЕМ ВЗАИМОДЕЙСТВУЕТ</p><h2>У звука и рисунка<br>общие корни.</h2>
<div class="about-copy"><p>Два маятника создают клеточные поля A и B. Сдвиг, отражение, задержка и операция наложения меняют общий рисунок. Например, XOR оставляет несовпадения, а AND — общие единицы.</p>
<p>В музыке гармония, мотивы и форма сочинены отдельно. Данные полей участвуют в изменении нот, акцентов и звучания. Короткие сигналы — вырезки из готовых композиций с мягкими краями. Обои используют геометрию тех же построений в вертикальной художественной композиции.</p>
<p><a href="../pendulum-music/">Предыдущие композиции и видео с маятниками ↗</a><br><a href="../../mayatnik/synthesis-gallery.html">Маятниковый атлас ↗</a><br><a href="../../mayatnik/Zerkalius-mayatnik-synthesis.html">Открыть Синтез ↗</a></p></div></section>
</main><footer><a class="wordmark" href="../Zerkalius-issledovanie.html">◇ В исследования</a><p>Зеркалиус · тема на телефон · 02</p><p><a href="music.json">Происхождение музыки</a> · <a href="wallpapers.json">Рецепты обоев</a> · <a href="https://github.com/MIkhailNkmnme/Binary-Drum-Machine/tree/main/issledovanie/phone-theme">Исходники</a></p></footer>
<p id="playback-status" class="sr-only" role="status" aria-live="polite"></p>
'''
    html += '<scr' + 'ipt src="page.js?v=1" defer></scr' + 'ipt></body></html>\n'
    (ROOT / 'index.html').write_text('\n'.join(line.rstrip() for line in html.splitlines())+'\n', encoding='utf-8')
    print(f'Built page: {len(tracks)} new tracks, {len(signals)} notifications, {len(papers)} wallpapers')

if __name__ == '__main__':
    main()
