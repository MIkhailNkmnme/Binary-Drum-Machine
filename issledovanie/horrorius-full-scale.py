"""Codex — независимый исследователь Хоррориуса · 12.10.2026.
Render the WHOLE static frame on each pilot sampling grid, with no viewport crop.
Usage: python -B issledovanie/horrorius-full-scale.py
"""
import hashlib
import html
import importlib.util
import json
import math
import zipfile
from fractions import Fraction
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('capture',HERE/'horrorius-scale-capture.py')
capture=importlib.util.module_from_spec(spec);spec.loader.exec_module(capture)
AUTHOR=capture.AUTHOR

def whole_geometry(case,manifest):
    s=Fraction(case['scale']);cx,cy=map(Fraction,manifest['centerSourceCells'])
    px,py=map(Fraction,case['phase']);vw,vh=manifest['outputFieldSize']
    # Integer translation of the old screen grid; fractional phases stay identical.
    bx=Fraction(vw,2)+px-s*cx;by=Fraction(vh,2)+py-s*cy
    left,top=math.floor(bx),math.floor(by)
    fx,fy=bx-left,by-top;sw,sh=manifest['sourceSize']
    return (math.ceil(fx+s*sw),math.ceil(fy+s*sh)),(fx,fy),(-left,-top)

def run():
    pilot=HERE/'horrorius-scale-N2048-n96';out=HERE/'horrorius-full-N2048-n96';out.mkdir(exist_ok=True)
    manifest=json.loads((pilot/'manifest.json').read_text(encoding='utf-8'))
    source_path=pilot/'source-original.png';source=np.asarray(Image.open(source_path).convert('RGB'))
    source_hash=hashlib.sha256(source_path.read_bytes()).hexdigest()
    assert source_hash==manifest['sourceSha256']
    result={'author':AUTHOR,'source':'../horrorius-scale-N2048-n96/source-original.png',
        'sourceSha256':source_hash,'sourceSize':manifest['sourceSize'],'sourceCapture':manifest['sourceCapture'],
        'scope':'whole source footprint at each scale, no 1024x768 viewport crop; exact same sampling grids as pilot',
        'algorithm':'floor((outputPixel+.5-fractionalOrigin)/scale); black outside source',
        'captions':'none in full PNGs; author and parameters in PNG metadata','cases':[]}
    cards=[];previews=[]
    for i,case in enumerate(manifest['cases']):
        size,phase,old_offset=whole_geometry(case,manifest);w,h=size;s=Fraction(case['scale'])
        xs=capture.indices(w,'0',str(s),str(phase[0]-Fraction(w,2)))
        ys=capture.indices(h,'0',str(s),str(phase[1]-Fraction(h,2)))
        # Boundaries enclose the entire projected source rectangle, rather than a viewport.
        assert phase[0]>=0 and phase[1]>=0
        assert Fraction(w)>=phase[0]+s*source.shape[1] and Fraction(h)>=phase[1]+s*source.shape[0]
        image=Image.new('RGB',size,(0,0,0));vx=(xs>=0)&(xs<source.shape[1])
        for y in range(0,h,128):
            yy=ys[y:y+128];vy=(yy>=0)&(yy<source.shape[0]);strip=np.zeros((len(yy),w,3),dtype=np.uint8)
            strip[np.ix_(vy,vx)]=source[yy[vy,None],xs[None,vx]]
            image.paste(Image.fromarray(strip),(0,y))
        full_name=case['file'].replace('view-','full-')
        params={'file':full_name,'scale':case['scale'],'pilotPhase':case['phase'],
            'size':list(size),'fractionalOrigin':[str(v) for v in phase],
            'pilotViewportOffsetInFullImage':list(old_offset),'completeProjectedSource':True}
        capture.png(image,out/full_name,params)
        # Check the encoded PNG itself. Its old viewport, padded black where outside,
        # must match every already verified pilot pixel; this also checks grid alignment.
        encoded=Image.open(out/full_name)
        ox,oy=old_offset;vw,vh=manifest['outputFieldSize']
        old_crop=np.asarray(encoded.crop((ox,oy,ox+vw,oy+vh)))
        expected=np.asarray(Image.open(pilot/case['file']).crop((0,0,vw,vh)))
        assert np.array_equal(old_crop,expected),full_name
        params['pilotViewportPixelsMatch']=True
        params['fileSha256']=hashlib.sha256((out/full_name).read_bytes()).hexdigest()
        # Independent Fraction calculations at corners and throughout each dimension.
        for j in [0,1,w//4,w//2,3*w//4,w-2,w-1]:
            assert xs[j]==math.floor((Fraction(j)+Fraction(1,2)-phase[0])/s)
        for j in [0,1,h//4,h//2,3*h//4,h-2,h-1]:
            assert ys[j]==math.floor((Fraction(j)+Fraction(1,2)-phase[1])/s)
        result['cases'].append(params)
        thumb=image.resize((960,240),Image.Resampling.LANCZOS)
        if case['phase']==['0','0']:previews.append((case['scale'],thumb))
        preview_name=full_name.replace('full-','preview-');capture.png(thumb,out/preview_name,{'previewOf':full_name,'note':'smoothed overview of the entire frame'})
        cards.append(f'<article><h2>Масштаб {html.escape(case["scale"])} · сетка {case["phase"][0]} px</h2><a href="{full_name}"><img loading="lazy" src="{preview_name}" alt="Весь кадр при масштабе {html.escape(case["scale"])}"></a><p>{w}×{h} пикселей · <a href="{full_name}" download>Скачать целый PNG</a> · <a href="{full_name}">Открыть PNG</a></p></article>')
        encoded.close();image.close()
        print(f'{i+1}/51 {full_name} {w}x{h}',flush=True)
    result['verification']={'wholeFrames':len(result['cases']),'completeProjectedBounds':True,
        'all51OldViewportsMatchPixelForPixel':True,'matchedViewportPixels':51*1024*768,
        'independentFractionIndices':len(result['cases'])*14,'sourceUnchanged':hashlib.sha256(source_path.read_bytes()).hexdigest()==source_hash}
    (out/'manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    sheet=Image.new('RGB',(960,64+4*278),'#10191d');draw=ImageDraw.Draw(sheet)
    draw.text((12,8),'Один кадр целиком · четыре масштаба',font=capture.font(21),fill='#d7ebe7')
    draw.text((12,37),AUTHOR,font=capture.font(13),fill='#8aa69f')
    selected=[p for p in previews if p[0] in ['1/4','1/2','1','35/32']]
    for i,(scale,thumb) in enumerate(selected):
        y=64+i*278;sheet.paste(thumb,(0,y));draw.text((12,y+245),'Масштаб '+scale+' · весь кадр, без обрезания',font=capture.font(16),fill='#bbddd4')
    capture.png(sheet,out/'whole-frames-sheet.png',{'note':'four smoothed whole-frame overviews, not source crops'})
    page=f'''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Хоррориус · целые кадры · Codex</title>
<style>body{{background:#0b1216;color:#d7e8e3;font:16px system-ui;margin:20px}}a{{color:#8ce0ce}}main{{max-width:1200px}}article{{background:#142127;padding:14px;margin:20px 0}}img{{width:100%;height:auto}}h2{{font-size:19px}}p{{line-height:1.5}}</style>
<main><h1>Целый кадр на каждом масштабе</h1><p>{AUTHOR}</p>
<p>Кадр n=96, 2048 строк. Здесь <b>51 целое изображение</b>: 17 масштабов × три положения пиксельной сетки. В каждом PNG помещается весь исходный кадр; окна 1024×768 и центральных вырезок здесь нет. Подпись и параметры находятся в метаданных, поверх рисунка ничего не добавлено.</p>
<p>Миниатюры показывают кадр целиком со сглаживанием. Скачайте отдельный PNG и откройте его в размере 1:1, чтобы увидеть именно сохранённый вариант выборки. При уменьшении выбирается часть исходных клеток; все исходные биты остаются в <a href="../horrorius-scale-N2048-n96/source-original.png">оригинале</a>.</p>
<p><a href="../{out.name}.zip" download><b>Скачать все целые кадры ZIP</b></a> · <a href="manifest.json">Размеры, параметры и проверка</a> · <a href="../horrorius-full-scale.py">Скрипт</a></p>
{''.join(cards)}</main></html>'''
    (out/'index.html').write_text(page,encoding='utf-8')
    with zipfile.ZipFile(out.with_suffix('.zip'),'w',compression=zipfile.ZIP_STORED) as z:
        for p in sorted(out.iterdir()):
            if p.is_file():z.write(p,str(Path(out.name)/p.name))
        z.write(source_path,str(Path(pilot.name)/source_path.name))
        z.write(pilot/'manifest.json',str(Path(pilot.name)/'manifest.json'))
        for p in pilot.glob('view-*.png'):z.write(p,str(Path(pilot.name)/p.name))
        z.write(Path(__file__),Path(__file__).name)
        z.write(HERE/'horrorius-scale-capture.py','horrorius-scale-capture.py')
    print(json.dumps(result['verification']),flush=True)

if __name__=='__main__':run()
