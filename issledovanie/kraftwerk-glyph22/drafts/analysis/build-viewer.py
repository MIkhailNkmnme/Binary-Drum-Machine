from pathlib import Path
from PIL import Image
import argparse,json,html,zipfile

parser=argparse.ArgumentParser()
parser.add_argument('--output',type=Path,required=True,help='Directory with plate, findings and clip.')
parser.add_argument('--captures',type=Path,default=Path(__file__).resolve().parent.parent/'witnesses')
args=parser.parse_args()
out=args.output
lookup={s.get('originalFile',s['file']):s['file'] for s in json.loads((args.captures/'samples.json').read_text(encoding='utf-8'))}
data=json.loads((out/'glyph22-findings.json').read_text(encoding='utf-8'))
svg=(out/'glyph22-four-glyphs.svg').read_text(encoding='utf-8')
rows=[]
for n,row in enumerate(data['rows']):
 w=row['witness'];t=(w['before']+w['after'])/2
 name=f"{row['state']:02d}" if row['state'] is not None else 'Переход'
 image_name=f'glyph22-evidence-{n+1:02d}.jpg'
 Image.open(args.captures/lookup.get(w['file'],w['file'])).crop((23,67,1327,801)).save(out/image_name,quality=94)
 rows.append({'label':name,'time':t,'image':image_name,'window':row.get('transitionWindowSeconds')})

page='''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Четыре глифа — разбор первых 22 секунд</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#10151f;color:#e8e9ee;font:16px/1.55 system-ui,sans-serif}main{max-width:1420px;margin:auto;padding:28px}h1{font-size:clamp(27px,4vw,43px);line-height:1.12;color:#ffe0a3}h2{font-size:23px}a{color:#a9d9ff}p{max-width:1000px}small,.muted{color:#b8becb}.layout{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(350px,1fr);gap:26px}.media{position:sticky;top:15px;align-self:start}video,#evidence{width:100%;height:auto;display:block;background:#080b12;border-radius:8px}.states{display:flex;flex-wrap:wrap;gap:6px;margin:15px 0}button{font:inherit;padding:6px 10px;cursor:pointer;background:#202a39;color:#e8e9ee;border:1px solid #49556a;border-radius:5px}button[aria-pressed=true]{border-color:#ffe0a3;color:#ffe0a3}label{cursor:pointer}.plate svg{width:100%;height:auto}.plate.hide-red path[fill="#df483d"]{display:none}.note{padding:15px 18px;border-left:3px solid #c5a56c;background:#18202d}.downloads{display:flex;gap:14px;flex-wrap:wrap}code{color:#ffe0a3}table{border-collapse:collapse;width:100%;max-width:950px}td,th{border-bottom:1px solid #343b48;padding:8px;text-align:left}details{margin:18px 0}summary{cursor:pointer}figcaption{font-size:14px;color:#b8becb;margin-top:6px}@media(max-width:880px){main{padding:16px}.layout{grid-template-columns:1fr}.media{position:static}}
</style><main>
<p class="muted">Разбор записи · 13 ноября 2026</p>
<h1>Четыре глифа: первые 22 секунды</h1>
<p>17 устойчивых эпизодов, включая повторяющиеся рисунки, и два дополнительных опорных кадра (один смешанный переход подтверждён). В каждой строке четыре глифа в исходном порядке слева направо.</p>
<p>Источник: <a href="https://www.youtube.com/watch?v=BNYdUn7gmmI">Kraftwerk Koncert 2026 — Veszprém, YouTube</a>. Доступная запись содержит движение камеры, свечение экрана и монтажные переходы.</p>
<div class="downloads"><a href="glyph22-four-glyphs.png" download>Рисунок PNG</a><a href="glyph22-four-glyphs.svg" download>Вектор SVG</a><a href="glyph22-screen-excerpt-silent.mp4" download>22 секунды MP4</a><a href="glyph22-findings.json" download>Времена и наблюдения JSON</a></div>
<h2>Что меняется</h2>
<p><b>Геометрия и цвет — два различимых процесса.</b> Оси и поперечины остаются на своих местах, меняются ступени, квадратные просветы и нижние края. Красная кайма меняется и при том же основном рисунке. Её нельзя автоматически считать новой геометрией.</p>
<p>Шестнадцать переходов хорошо описывает приближение <code>tₙ ≈ 1,717 + 1,2472·n секунды</code>, где <code>n = 0…15</code>. Это оценка по серединам интервалов наблюдения: наибольшее отклонение около 0,07 с. Практически — смена формы раз в 1,25 с. Это закон времени смены, а не формула следующей фигуры.</p>
<table><tr><th>Сравнение</th><th>Наблюдение</th></tr><tr><td>04 → 13</td><td>Около 5-й и 16-й секунд возвращается визуально очень похожая четвёрка, включая маленькие просветы; красный слой отличается.</td></tr><tr><td>06 → 12</td><td>Верхние ступени похожи, но у третьего глифа появляется нижний просвет. Простого перемещения всего силуэта недостаточно.</td></tr><tr><td>15 → 16, около 19,19 с</td><td>В выбранном переходном кадре позиции 2 и 4 уже сменились, 1 и 3 ещё прежние.</td></tr><tr><td>16 → 17, около 20,46 с</td><td>Уточнение: графы этого кадра совпали со следующим; смешанная геометрия не подтверждена.</td></tr></table>
<p class="note"><b>Точное правило выбора следующего рисунка не установлено.</b> Одинаковый видеоряд можно получить переключением заранее подготовленных масок, процедурным изменением клеток и другими способами. Фрагмент не доказывает XOR-эволюцию, клеточный автомат, вращение 3D-модели или случайный генератор.</p>
<details><summary>Как описать обводку клеточной модели</summary><p>Удобная модель для воспроизведения этого вида рисунка: занятая клетка — 1, пустая — 0. Между двумя соседними клетками проводится ребро, если их значения различаются: <code>ребро = a XOR b</code>. Поэтому при добавлении клетки общая граница с занятой соседней клеткой исчезает, а открытые стороны появляются. Нулевая клетка внутри занятой области даёт квадратное отверстие. Это объясняет способ построения контура по маске, но не определяет, почему автор выбирает следующую маску. В этой работе исходные биты не восстановлены точно; SVG обводит наблюдаемые светлые области.</p></details>
<h2>Видео, опорные кадры и перерисовка</h2>
<p class="muted">Видео собрано из 568 снимков браузера с сохранением времени исходного воспроизведения; ровно 22 с, без звука. Это экранная реконструкция, не скачанный оригинал. Максимальная разница между временем выбранного снимка и временем выходного кадра — 0,040 с.</p>
<div class="layout"><div class="media"><video id="clip" controls playsinline preload="metadata" src="glyph22-screen-excerpt-silent.mp4"></video><div id="states" class="states" aria-label="Опорные состояния"></div><p id="caption"></p><a id="evidenceLink" href="glyph22-evidence-01.jpg"><img id="evidence" src="glyph22-evidence-01.jpg" alt="Опорный кадр источника для сравнения с обводкой"></a><figcaption>Нажмите номер, чтобы поставить видео на опорный кадр и показать его отдельно. Указано время середины захвата; точный интервал before…after сохранён в JSON.</figcaption><p><label><input id="red" type="checkbox" checked> Показывать красный слой на рисунке</label></p></div><div class="plate" id="plate">__SVG__</div></div>
<h2>Границы точности</h2><p>Перерисовка сохраняет различимые жёлтые и красные контуры опорных кадров. В участке 8,5–14 с сцена мелкая: часть тонких краёв сливается. После примерно 20,8 с крайние глифы обрезаются и начинается наложение следующего плана; последний ряд взят до этого. Неуверенные линии не заменены выдуманной идеальной сеткой. Один смешанный набор подтверждён; второй опорный кадр совпал со следующим, а не гарантия, что в исходных 60 кадрах/с нет других коротких переходов. Вклад камерного захвата в красное мерцание не отделён от экранной анимации.</p>
<script>
const rows=__ROWS__,clip=document.querySelector('#clip'),states=document.querySelector('#states');
function select(i){const r=rows[i];clip.pause();clip.currentTime=r.time;document.querySelector('#evidence').src=r.image;document.querySelector('#evidenceLink').href=r.image;document.querySelector('#caption').textContent=`${r.label} · опорное время ${r.time.toFixed(3)} с`+(r.window?` · смена в интервале ${r.window[0]}–${r.window[1]} с`:'');[...states.children].forEach((b,k)=>b.setAttribute('aria-pressed',String(k===i)));}
rows.forEach((r,i)=>{const b=document.createElement('button');b.textContent=r.label;b.title=`Показать ${r.time.toFixed(3)} с`;b.onclick=()=>select(i);states.append(b)});
document.querySelector('#red').onchange=e=>document.querySelector('#plate').classList.toggle('hide-red',!e.target.checked);
document.querySelector('#caption').textContent='Выберите строку перерисовки для сравнения с источником.';
</script></main></html>'''.replace('__SVG__',svg).replace('__ROWS__',json.dumps(rows,ensure_ascii=False))
page=page.replace('<h2>Видео, опорные кадры и перерисовка</h2>', '''<details><summary>Проверка поворотов, клеточной сетки и повторов</summary><p>Для сравнения взяты четыре исходные маски 8×12 из <a href="https://1001100.online/issledovanie/xor-bitglyphs/#counts">предыдущего исследования битглифов</a>. В каждой есть сплошная поперечина, но максимум одно замкнутое отверстие. В видео одновременно видны несколько внутренних петель и отделение/присоединение верхней клетки. Если трактовать все жёлтые линии как границу одной маски, одни лишь повороты и отражения фиксированных фигур это не объясняют: такие преобразования сохраняют число отверстий и связность.</p><p>Полная сетка всех занятых клеток тоже не объясняет длинные плечи без поперечных перемычек. Выборочная обводка, изменение маски или их сочетание остаются совместимыми с записью. Похожая четвёрка 04/13 разделена девятью сменами, а 04/12 через восемь смен различается: точный восьмишаговый цикл не подтверждён.</p></details><h2>Видео, опорные кадры и перерисовка</h2>''')
page=page.replace('.media{position:sticky;top:15px;align-self:start}', '.media{position:sticky;top:15px;align-self:start;max-height:calc(100vh - 30px);overflow-y:auto;padding-right:8px}')
page=page.replace('.media{position:static}', '.media{position:static;max-height:none;overflow:visible}')
(out/'glyph22-study.html').write_text(page,encoding='utf-8')
names=['glyph22-study.html','glyph22-four-glyphs.png','glyph22-four-glyphs.svg','glyph22-findings.json','glyph22-screen-excerpt-silent.mp4','glyph22-clip-provenance.json']+[r['image'] for r in rows]
with zipfile.ZipFile(out/'glyph22-study.zip','w',zipfile.ZIP_DEFLATED,compresslevel=5) as z:
 for name in names:z.write(out/name,name)
with zipfile.ZipFile(out/'glyph22-study.zip') as z:assert z.testzip() is None
print('Built local viewer and ZIP:',len(names),'files')
