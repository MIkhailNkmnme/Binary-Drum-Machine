"""Codex — независимый исследователь Хоррориуса · 12.10.2026.
User-requested visual annotation of ONE motif in each of the six comparison panels.
The source PNGs are unchanged. This is a manual visual selection, not segmentation proof.
"""
import importlib.util
import json
import math
from fractions import Fraction
from pathlib import Path

from PIL import Image, ImageDraw

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('capture',HERE/'horrorius-scale-capture.py')
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
folder=HERE/'horrorius-scale-N2048-n96'
manifest=json.loads((folder/'manifest.json').read_text(encoding='utf-8'))
sheet=Image.open(folder/'near-one-tiles.png').convert('RGB');d=ImageDraw.Draw(sheet)
scales=['15/16','1','17/16','35/32','9/8','5/4']
# Visually selected round motif at a common source position, 64 source cells wide.
# This outline identifies the example; it is not a claim of a unique natural contour.
source_center=(Fraction('4863.5'),Fraction('1451.5'));half=Fraction(32)
cx,cy=map(Fraction,manifest['centerSourceCells']);vw,vh=manifest['outputFieldSize']
notes={'author':c.AUTHOR,'selection':'one manually selected visible motif at the same source location in each panel',
    'sourceCenterCells':[str(v) for v in source_center],'sourceHalfSizeCells':str(half),
    'scope':'visual annotation, not exact bit equality or automatic segmentation','cases':[]}
for i,scale in enumerate(scales):
    case=next(v for v in manifest['cases'] if v['scale']==scale and v['phase']==['0','0']);s=Fraction(scale)
    x=Fraction(vw,2)+s*(source_center[0]-cx);y=Fraction(vh,2)+s*(source_center[1]-cy);r=s*half
    bounds=(math.floor(x-r),math.floor(y-r),math.ceil(x+r),math.ceil(y+r))
    tx,ty,_,_=case['tileRectangleInOutput'];panelx=(i%3)*512;panely=64+(i//3)*552
    ellipse=[float(panelx+2*(x-r-tx)),float(panely+2*(y-r-ty)),
             float(panelx+2*(x+r-tx)),float(panely+2*(y+r-ty))]
    d.ellipse([ellipse[0]-2,ellipse[1]-2,ellipse[2]+2,ellipse[3]+2],outline='#0b1216',width=8)
    d.ellipse(ellipse,outline='#ff8f48',width=4)
    label=(int(ellipse[0])-2,int(ellipse[1])-32);d.rectangle((label[0]-3,label[1]-2,label[0]+29,label[1]+27),fill='#10191d')
    d.text(label,str(i+1),font=c.font(23),fill='#ffb16e')
    original=Image.open(folder/case['file']).crop(bounds)
    meta={'scale':scale,'caseFile':case['file'],'rectangleInSampledView':list(bounds),
          'sourceSelection':notes['sourceCenterCells'],'selection':'manual visual motif'}
    name=f'one-motif-{i+1:02d}.png';c.png(original,folder/name,meta)
    marked=original.resize((original.width*6,original.height*6),Image.Resampling.NEAREST)
    md=ImageDraw.Draw(marked);md.ellipse((2,2,marked.width-3,marked.height-3),outline='#ff8f48',width=4)
    c.png(marked,folder/f'one-motif-{i+1:02d}-marked.png',meta)
    notes['cases'].append({'number':i+1,'file':name,**meta,'outlineInComparisonSheet':ellipse})
# New header explicitly distinguishes several motifs per panel from the one selected.
d.rectangle((0,0,sheet.width,63),fill='#10191d')
d.text((12,8),'Обвёл по одному мотиву · в каждом прежнем фрагменте узоров несколько',font=c.font(20),fill='#d7ebe7')
d.text((12,37),c.AUTHOR,font=c.font(13),fill='#8aa69f')
c.png(sheet,folder/'one-motif-outlined.png',notes)
(folder/'one-motif-selection.json').write_text(json.dumps(notes,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(folder/'one-motif.html').write_text('''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Хоррориус · обведённый пример · Codex</title>
<style>body{background:#0b1216;color:#d7e8e3;font:15px system-ui;margin:16px}a{color:#8ce0ce}img{width:100%;max-width:900px;height:auto;display:block}p{max-width:1000px;line-height:1.5}</style>
<h1 style="font-size:24px">Обведён один выбранный участок в каждой части</h1>
<p>Во всех шести фрагментах узоров несколько. Оранжевым отмечено одно и то же исходное место: в №4 округлый мотив читается ясно; на соседних масштабах он меняется или распадается. Обводка выбрана визуально, это не автоматическая граница фигуры.</p>
<a href="one-motif-outlined.png"><img src="one-motif-outlined.png" alt="По одному обведённому участку в шести масштабах"></a>
<p>Codex — независимый исследователь Хоррориуса · 12.10.2026. <a href="one-motif-outlined.png" download>Скачать обводку PNG</a> · <a href="one-motif-04.png" download>Выбранный мотив №4 без обводки</a> · <a href="../horrorius-full-N2048-n96/index.html">Целые кадры по масштабам</a></p></html>''',encoding='utf-8')
print('Six manual motif outlines and six exact clean crops saved.')
