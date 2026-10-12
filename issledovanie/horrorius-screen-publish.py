"""Codex — независимый исследователь Хоррориуса · 12.10.2026.
Present the fixed, verified screen-pixel measurements with switchable overlays.
"""
import json
import zipfile
from pathlib import Path

HERE=Path(__file__).resolve().parent;OUT=HERE/'horrorius-screen-symmetry'
report=json.loads((OUT/'report.json').read_text(encoding='utf-8'));common=json.loads((OUT/'common-properties.json').read_text(encoding='utf-8'))
for screen in report['screens']:
    screen['exact']=json.loads((OUT/f'screen-{screen["number"]}-exact.json').read_text(encoding='utf-8'))['findings']
    for f in screen['regions']:f['rawEqualityGrid']='native screen pixels' if f['angleTransform']==0 else 'nearest rotated screen sampling grid'
# Document the raw comparison grid in JSON without repeating the calculation.
clean={k:v for k,v in report.items()};clean['screens']=[{k:v for k,v in s.items() if k!='exact'} for s in report['screens']]
(OUT/'report.json').write_text(json.dumps(clean,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
payload=json.dumps({'report':report,'common':common},ensure_ascii=False).replace('</',r'<\/')
page='''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Хоррориус · симметрия экранных пикселей · Codex</title>
<style>body{background:#0b1216;color:#d7e8e3;font:15px system-ui;margin:16px}a{color:#8ce0ce}p{max-width:1100px;line-height:1.5}h1{font-size:25px}button,select{background:#17272d;color:#d7e8e3;border:1px solid #4b6b68;padding:8px;border-radius:4px}button[aria-pressed=true]{background:#335e53;border-color:#91e7cc}.bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:16px 0}.view{overflow:auto;max-height:75vh;border:1px solid #395451;background:#000}.scene{position:relative}.scene img{display:block;image-rendering:crisp-edges}.scene svg{position:absolute;left:0;top:0}.scene svg text{pointer-events:none}#info{background:#17272d;padding:12px;max-width:1100px;margin:10px 0}table{border-collapse:collapse;margin:12px 0}td,th{border:1px solid #395451;padding:6px 12px;text-align:left}.note{color:#a6bcb6}</style>
<h1>Симметрия того, что уже видно на экране</h1>
<p><b>Codex — независимый исследователь Хоррориуса · 12.10.2026.</b> Использовал пять PNG пользователя в их исходном размере. Пиксели поля уже есть: серый = 0, белый = 1. Определять алгоритм монитора для этих снимков не требуется.</p>
<p>Здесь две проверки. <b>«Строго 0/1»</b> сравнивает реальные экранные биты. <b>«Приблизительная»</b> ищет отражение крупного распределения светлого и тёмного: анализирую картинку с Gaussian Blur 2 экранных пикселя и порогом корреляции ρ ≥ 0,85 в каждом сечении. Это измерительная модель; согласие человека с ней ещё не проверено. Сами исходные PNG остаются неизменными.</p>
<p>Граница приблизительной области определяется падением этой корреляции сбоку, сверху и снизу. Оранжевая рамка — приблизительная область, бирюзовая линия — ось. Зелёные рамки в строгом режиме означают точное совпадение. Некоторые области перекрываются.</p>
<div class="bar"><label>Снимок <select id="screen"></select></label><button id="approx" aria-pressed="true">Приблизительная</button><button id="exact" aria-pressed="false">Строго 0/1</button><button id="overlay" aria-pressed="true">Рамки</button><a id="original">Исходный PNG</a><a id="marked">PNG с обводками</a></div>
<p id="counts"></p><p id="shared"></p><div id="info">Нажмите на рамку для показателей выбранной области.</div>
<div class="view"><div id="scene" class="scene"><img id="image" alt="Исходные экранные пиксели"><svg id="svg" xmlns="http://www.w3.org/2000/svg"></svg></div></div>
<p class="note">Изображение задано в размере 1 CSS-пиксель на пиксель PNG. Масштаб страницы и плотность пикселей устройства могут дополнительно менять показ. Все приведённые измерения выполнены над файлами PNG, а не над вторично уменьшенной миниатюрой.</p>
<p><a href="../horrorius-screen-symmetry.zip">Скачать снимки, массивы 0/1, маски и код ZIP</a> · <a href="report.json">Все измерения</a> · <a href="common-properties.json">Что общего у находок</a> · <a href="verification.json">Независимая проверка</a> · <a href="../horrorius-screen-symmetry.py">Скрипт для новых PNG</a></p>
<h2>Пять размеров — пять разных экранных картинок</h2><table><thead><tr><th>Снимок</th><th>Размер PNG</th><th>Точные области</th><th>Показанные приблизительные</th></tr></thead><tbody id="table"></tbody></table>
<p>В снимках 1–3 всего четыре цвета: два цвета поля, чёрное снаружи и цвет панели. В снимках 4–5 дополнительные цвета относятся также к подсказке и её тексту; эти участки исключены из анализа. По четырём общим видам измерил общую вертикальную зеркальность видимого поля: первые три — 100%, четвёртый — 99,93%. Многие локальные находки имеют побитно совпадающего зеркального двойника на другой стороне фигуры. Это не означает, что все находки одинаковы между собой или при разных масштабах.</p>
<p>Чтобы анализировать другие размеры: сохранить PNG экранного вида, запустить скрипт с <code>--inputs image.png --out output-folder --blur 2 --threshold 0.85</code>. Для будущего вида без скриншота понадобятся исходный кадр и точные параметры масштабирования/сдвига. Скриншот сохраняет цифровой результат; физические свойства монитора и восприятие конкретного человека по нему не измерены.</p>
<script id="data" type="application/json">PAYLOAD</script><script>
const data=JSON.parse(document.getElementById('data').textContent),$=id=>document.getElementById(id);let selected=4,mode='approx',overlay=true;
const pct=v=>(v*100).toFixed(2)+'%';
data.report.screens.forEach((s,i)=>{$('screen').add(new Option('№'+s.number+' · '+s.size.join('×'),i));const row=document.createElement('tr');[s.number,s.size.join('×'),s.exactRegionsAtPriorThresholds,s.shownApproximateRegions].forEach(v=>{const cell=document.createElement('td');cell.textContent=v;row.append(cell)});$('table').append(row)});$('screen').value=selected;
function exactGeometry(f,H){const a=f.axis,m=f.normalRadius,t=f.tangent;const point=(n,v)=>f.family==='V'?[n/2+.5,v+.5]:f.family==='H'?[v+.5,n/2+.5]:f.family==='D+'?[(v+n)/2+.5,(v-n)/2+.5]:[(n+v-H+1)/2+.5,(n-v+H-1)/2+.5];return {polygon:[point(a-m,t[0]),point(a+m,t[0]),point(a+m,t[1]),point(a-m,t[1])],axisEndpoints:[point(a,t[0]),point(a,t[1])]}}
function draw(){const s=data.report.screens[selected],[W,H]=s.size;$('image').src=s.inputFile;$('image').width=W;$('image').height=H;$('scene').style.width=W+'px';$('scene').style.height=H+'px';$('svg').setAttribute('width',W);$('svg').setAttribute('height',H);$('svg').setAttribute('viewBox','0 0 '+W+' '+H);$('svg').style.display=overlay?'block':'none';$('original').href=s.inputFile;$('marked').href='screen-'+s.number+'-annotated.png';$('counts').textContent='Снимок №'+s.number+': '+s.exactRegionsAtPriorThresholds+' точных областей при прежних порогах; '+s.shownApproximateRegions+' показанных приблизительных примеров.';
 const shared=data.common.screens.find(v=>v.number===s.number);$('shared').textContent=shared?'Общая вертикальная зеркальность видимых пикселей поля: '+pct(shared.wholeShapeRawReflectionEquality)+'. Проверенные пары локальных двойников: '+shared.partnerRegions.map(v=>v.ids.join('–')).join(', ')+'.':'Это увеличенный фрагмент: здесь проверены локальные области.';
 $('info').textContent='Нажмите на рамку для показателей выбранной области.';$('approx').setAttribute('aria-pressed',mode==='approx');$('exact').setAttribute('aria-pressed',mode==='exact');$('overlay').setAttribute('aria-pressed',overlay);
 const rows=mode==='approx'?s.regions:s.exact;const color=mode==='approx'?'#ffb153':'#59edbd';$('svg').innerHTML=rows.map((f,i)=>{const g=mode==='approx'?f:exactGeometry(f,H),id=mode==='approx'?f.id:i+1;const p=g.polygon;return '<g data-i="'+i+'" style="cursor:pointer"><polygon points="'+p.map(pt=>pt.join(',')).join(' ')+'" fill="transparent" stroke="'+color+'" stroke-width="2"/><polyline points="'+g.axisEndpoints.map(pt=>pt.join(',')).join(' ')+'" fill="none" stroke="#30e5d3" stroke-width="2"/><text x="'+(p[0][0]+3)+'" y="'+(p[0][1]+13)+'" fill="#fff2cc" stroke="#071013" stroke-width=".4" font-size="13">'+id+'</text></g>'}).join('');
 $('svg').querySelectorAll('[data-i]').forEach(g=>g.addEventListener('click',()=>{const f=rows[+g.dataset.i];$('info').textContent=mode==='approx'?'Область №'+f.id+' · ось '+f.axisAngleInScreenDegrees+'° · корреляция сглаженного рисунка ρ='+f.modelCorrelation.toFixed(3)+' · точное совпадение '+pct(f.rawPixelEquality)+(f.angleTransform?' в повёрнутой выборке':' экранных пикселей')+' · минимум по сечениям '+f.minimumRowScore.toFixed(3)+' · перед/после области '+f.beforeScore.toFixed(3)+' / '+f.afterScore.toFixed(3)+' (порог '+data.report.threshold+').':'Точная область №'+(+g.dataset.i+1)+' · направление '+f.family+' · '+f.pixels+' совпадающих пикселей · несовпадающие пары за тремя границами сохранены в JSON.'}));}
$('screen').addEventListener('change',()=>{selected=+$('screen').value;draw()});$('approx').addEventListener('click',()=>{mode='approx';draw()});$('exact').addEventListener('click',()=>{mode='exact';draw()});$('overlay').addEventListener('click',()=>{overlay=!overlay;draw()});draw();
</script></html>'''.replace('PAYLOAD',payload)
(OUT/'index.html').write_text(page,encoding='utf-8')
with zipfile.ZipFile(OUT.with_suffix('.zip'),'w',compression=zipfile.ZIP_STORED) as z:
    for file in OUT.iterdir():
        if file.is_file():z.write(file,str(Path(OUT.name)/file.name))
    for name in ['horrorius-screen-symmetry.py','horrorius-screen-symmetry-check.py','horrorius-screen-common.py','horrorius-screen-publish.py','horrorius-symmetry-scan.cjs','horrorius-scale-capture.py']:
        z.write(HERE/name,name)
print('Interactive overlay gallery and ZIP ready.')
