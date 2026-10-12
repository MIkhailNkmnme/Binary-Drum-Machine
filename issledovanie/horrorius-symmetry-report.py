"""Codex — независимый исследователь Хоррориуса · 12.10.2026.
Independently verify every reflection and its three stopping witnesses, then draw.
Raw scans produced by horrorius-symmetry-scan.cjs; source PNGs remain unchanged.
"""
import hashlib
import importlib.util
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE=Path(__file__).resolve().parent;OUT=HERE/'horrorius-symmetry-N2048-n96';OUT.mkdir(exist_ok=True)
spec=importlib.util.spec_from_file_location('capture',HERE/'horrorius-scale-capture.py')
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
AUTHOR=c.AUTHOR

def palette(im):
    a=np.asarray(im.convert('RGB'));return np.where(a[:,:,0]==232,2,np.where(a[:,:,0]==91,1,0)).astype('uint8')

def coords(f,n,t,H):
    if f=='V':return n/2,t
    if f=='H':return t,n/2
    if f=='D+':return (t+n)/2,(t-n)/2
    v=t-H+1;return (n+v)/2,(n-v)/2

def polygon(f,H):
    a=f['axis'];m=f['normalRadius'];t0,t1=f['tangent']
    return [coords(f['family'],a+d,t,H) for d,t in [(-m,t0),(m,t0),(m,t1),(-m,t1)]]

def reflect(f,x,y):
    a=f['axis'];k=f['family']
    if k=='V':return a-x,y
    if k=='H':return x,a-y
    if k=='D+':return y+a,x-a
    return a-y,a-x

def verify(data,a):
    H,W=a.shape;pixels=0
    for f in data['findings']:
        p=polygon(f,H);xmin=math.ceil(min(v[0] for v in p));xmax=math.floor(max(v[0] for v in p));ymin=math.ceil(min(v[1] for v in p));ymax=math.floor(max(v[1] for v in p))
        yy,xx=np.mgrid[ymin:ymax+1,xmin:xmax+1];fam=f['family'];axis=f['axis'];m=f['normalRadius'];t0,t1=f['tangent']
        normal=2*xx if fam=='V' else 2*yy if fam=='H' else xx-yy if fam=='D+' else xx+yy
        tangent=yy if fam=='V' else xx if fam=='H' else xx+yy if fam=='D+' else xx-yy+H-1
        mask=(abs(normal-axis)<=m)&(tangent>=t0)&(tangent<=t1);x,y=xx[mask],yy[mask];rx,ry=reflect(f,x,y)
        assert len(x)==f['pixels'] and np.all(a[y,x]==a[ry,rx]) and np.all(a[y,x]!=0)
        for kind,pair in f['witnesses'].items():
            (x1,y1),(x2,y2)=pair;assert reflect(f,x1,y1)==(x2,y2) and a[y1,x1]!=a[y2,x2]
            normal=2*x1 if fam=='V' else 2*y1 if fam=='H' else x1-y1 if fam=='D+' else x1+y1
            tangent=y1 if fam=='V' else x1 if fam=='H' else x1+y1 if fam=='D+' else x1-y1+H-1
            if kind=='normalOutside':assert abs(normal-axis)>m and t0<=tangent<=t1
            if kind=='before':assert tangent==t0-1 and abs(normal-axis)<=m
            if kind=='after':assert tangent==t1+1 and abs(normal-axis)<=m
        pixels+=len(x)
    return {'regions':len(data['findings']),'independentlyComparedPixels':pixels,'everyInteriorPixelMatches':True,
            'outsideMismatchPairs':3*len(data['findings']),'allOutsideWitnessesDiffer':True}

source_meta={'file':'../horrorius-scale-N2048-n96/source-original.png','bbox':[2000,0,6190,2048]}
render_meta={'file':'../horrorius-full-N2048-n96/full-13-phase-0.png','bbox':[2188,1,6771,2241]}
datasets={}
for name,meta in [('source',source_meta),('rendered',render_meta)]:
    path=OUT/(name+'-findings.json')
    if not path.exists():
        prefix='horrorius-source-symmetry-findings.json' if name=='source' else 'horrorius-symmetry-findings.json'
        path.write_bytes((Path('C:/Users/Mhl/AppData/Local/Temp')/prefix).read_bytes())
    data=json.loads(path.read_text(encoding='utf-8'));im=Image.open(OUT/meta['file']);a=palette(im.crop(tuple(meta['bbox'])))
    data['input']=meta;data['inputSha256']=hashlib.sha256((OUT/meta['file']).read_bytes()).hexdigest();data['verification']=verify(data,a)
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');datasets[name]=data

source=datasets['source'];H=source['height'];compact=[]
for f in source['findings']:
    span=f['tangent'][1]-f['tangent'][0]+1;ratio=(f['normalRadius']+1)/span
    if f['normalRadius']>=32 and .25<=ratio<=4:
        f=dict(f);f['id']=len(compact)+1;compact.append(f)
# Choose well-spaced examples over the ENTIRE frame, including the upper half.
chosen=[];cells=set()
source_pixels=palette(Image.open(OUT/source_meta['file']).crop(tuple(source_meta['bbox'])))
textured=[]
for f in compact:
    if f['family']!='V':continue
    left=math.ceil((f['axis']-f['normalRadius'])/2);right=math.floor((f['axis']+f['normalRadius'])/2)+1
    t0,t1=f['tangent'];density=(source_pixels[t0:t1+1,left:right]==2).mean(axis=1)
    if np.all(density>=.15):
        f['minimumWhiteFractionPerRow']=float(density.min());textured.append(f)
for f in sorted(textured,key=lambda v:v['pixels'],reverse=True):
    p=polygon(f,H);cx=sum(v[0] for v in p)/4;cy=sum(v[1] for v in p)/4;cell=(int(cx//256),int(cy//160))
    if cell in cells:continue
    cells.add(cell);chosen.append(f)
    if len(chosen)>=64:break
chosen.sort(key=lambda v:(v['tangent'][0],v['axis']))
for old in OUT.glob('region-*.png'):
    assert old.resolve().parent==OUT.resolve();old.unlink()  # Only this script's generated context crops.
full=Image.open(OUT/render_meta['file']).convert('RGB');draw=ImageDraw.Draw(full);bbox=source_meta['bbox']
fm=json.loads((HERE/'horrorius-full-N2048-n96/manifest.json').read_text(encoding='utf-8'))['cases'][36]
scale=35/32;fx,fy=map(lambda v:float(__import__('fractions').Fraction(v)),fm['fractionalOrigin'])
def project(point):return fx+scale*(point[0]+bbox[0]+.5),fy+scale*(point[1]+bbox[1]+.5)
records=[];cards=[]
for f in chosen:
    p=polygon(f,H);q=[project(v) for v in p];draw.line(q+[q[0]],fill='#50efbf',width=3)
    t0,t1=f['tangent'];endpoints=[project(coords(f['family'],f['axis'],t,H)) for t in [t0,t1]]
    draw.line(endpoints,fill='#ffc65a',width=3);draw.text((q[0][0]+3,q[0][1]+3),str(f['id']),font=c.font(17),fill='#ffb87c',stroke_width=2,stroke_fill='#10191d')
    for pair in f['witnesses'].values():
        for pt in pair:
            x,y=project(pt);draw.ellipse((x-3,y-3,x+3,y+3),fill='#ff5269')
    xs=[v[0] for v in q];ys=[v[1] for v in q];rectangle=[max(0,math.floor(min(xs))-12),max(0,math.floor(min(ys))-12),min(full.width,math.ceil(max(xs))+13),min(full.height,math.ceil(max(ys))+13)]
    f['projectedPolygon']=q;f['projectedRectangleWithContext']=rectangle;f['file']=f'region-{f["id"]:04d}.png';records.append(f)
# Draw complete image first so context crops include all surrounding annotations.
c.png(full,OUT/'whole-frame-axes.png',{'author':AUTHOR,'scale':'35/32','selectedSourceRegions':len(chosen),
    'note':'projected exact SOURCE-bit domains; displayed pixels at this scale may differ under reflection'})
for f in records:
    tile=full.crop(f['projectedRectangleWithContext']);c.png(tile,OUT/f['file'],f)
    cards.append(f'<article><h3>Область {f["id"]} · исходные строки {f["tangent"][0]}…{f["tangent"][1]}</h3><a href="{f["file"]}"><img loading="lazy" src="{f["file"]}" alt="Симметричная область {f["id"]}"></a></article>')
# Full frame overview: includes all source margins. Crop only blank side margins in
# the separate detail view, explicitly labelled as a detail of the active figure.
overview=full.resize((1800,round(full.height*1800/full.width)),Image.Resampling.LANCZOS)
canvas=Image.new('RGB',(1800,overview.height+70),'#10191d');canvas.paste(overview,(0,70));d=ImageDraw.Draw(canvas)
d.text((16,8),f'Весь кадр · {len(chosen)} примера локальной симметрии исходных битов',font=c.font(23),fill='#d7ebe7')
d.text((16,40),AUTHOR+' · зелёное: область; жёлтое: ось; красное: несовпадение снаружи',font=c.font(15),fill='#9ab9ad')
c.png(canvas,OUT/'whole-frame-overview.png',{'note':'smoothed overview; original full-size annotated frame is separate'})
upper=full.crop((3250,120,5750,1250));c.png(upper,OUT/'upper-areas.png',{'note':'upper detail with source-domain projections, not the entire frame'})
report={'author':AUTHOR,'sourceVerification':source['verification'],'renderedVerification':datasets['rendered']['verification'],
    'sourceCountsByAxis':{fam:sum(f['family']==fam for f in source['findings']) for fam in ['V','H','D+','D-']},
    'renderedCountsByAxis':{fam:sum(f['family']==fam for f in datasets['rendered']['findings']) for fam in ['V','H','D+','D-']},
    'compactRegions':len(compact),'texturedCompactRegions':len(textured),'shownExamples':len(chosen),'examplesStartingAboveSourceRow1024':sum(f['tangent'][0]<1024 for f in chosen),
    'scope':'four exact lattice axis families and finite width thresholds; not all possible shapes or arbitrary angles; annotations on scaled frame project source domains',
    'selected':records}
(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(OUT/'compact-regions.json').write_text(json.dumps({'author':AUTHOR,'regions':compact},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(OUT/'textured-regions.json').write_text(json.dumps({'author':AUTHOR,'selection':'at least 15% white cells in every source row; avoids empty grey holes','regions':textured},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
page=f'''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Хоррориус · локальные оси симметрии · Codex</title>
<style>body{{background:#0b1216;color:#d7e8e3;font:16px system-ui;margin:18px}}a{{color:#8ce0ce}}p{{max-width:1200px;line-height:1.5}}.main{{width:100%;max-width:1500px}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:15px}}article{{background:#142127;padding:10px}}article img{{max-width:100%;height:auto}}</style>
<h1>Локальные оси симметрии на всём кадре</h1><p>{AUTHOR}</p>
<p>Проверены вертикальные, горизонтальные и две диагональные оси 45°. В исходном кадре найдено <b>{source['count']} точных ограниченных областей</b>; {len(compact)} имеют достаточно компактную форму. Из них {len(textured)} содержат узор в каждой строке, без захода в пустые серые дыры. Здесь отмечены {len(chosen)} распределённых по кадру примера, в том числе {report['examplesStartingAboveSourceRow1024']} начинаются выше строки 1024. Все найденные области при этих параметрах — с вертикальной осью; остальные направления не прошли критерий.</p>
<p><b>Зелёная рамка — область, жёлтая линия — ось, красные точки — пары, которые уже не совпадают за границей.</b> Внутри исходных областей сравнен каждый отражённый пиксель, а снаружи проверены нарушения слева/справа, сверху и снизу. Пустые одноцветные области исключены.</p>
<p>На увеличенном кадре 35/32 показана проекция симметрии <b>исходных битов</b>. Пиксельная выборка масштаба может слегка нарушать видимую симметрию: точных ограниченных областей в самом экранном PNG при тех же параметрах — {datasets['rendered']['count']}. Это отдельный результат, а не обещание симметрии каждого экранного пикселя.</p>
<p>Поиск ограничен четырьмя направлениями, четырьмя минимальными ширинами, длиной ≥16 и площадью ≥384 пикселей. Прямоугольные области максимальны по ширине при своём диапазоне строк; соседние строки нарушают ту же симметрию. Это не перечень всех возможных контуров.</p>
<p><a href="whole-frame-axes.png">Весь кадр с осями PNG, 1:1</a> · <a href="upper-areas.png">Области выше — крупно</a> · <a href="textured-regions.json">Все области с узором в каждой строке</a> · <a href="compact-regions.json">Все компактные области</a> · <a href="report.json">Проверка и параметры</a> · <a href="source-findings.json">Все исходные области</a> · <a href="../horrorius-symmetry-N2048-n96.zip">Скачать PNG, данные и код ZIP</a></p>
<a href="whole-frame-axes.png"><img class="main" src="whole-frame-overview.png" alt="Весь кадр с отмеченными локальными осями симметрии"></a>
<h2>Отдельные примеры с контекстом и несовпадением снаружи</h2><div class="grid">{''.join(cards)}</div></html>'''
(OUT/'index.html').write_text(page,encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='selected'},ensure_ascii=False))
