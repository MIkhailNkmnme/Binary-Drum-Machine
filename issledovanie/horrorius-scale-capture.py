"""Codex — независимый исследователь Хоррориуса · 12.10.2026.
One static source frame, exact nearest-cell sampling on many output grids.
No simulation steps, invented bits, interpolation, or changes to the source PNG.
Usage: python issledovanie/horrorius-scale-capture.py --source image.png --out folder
       --center 4863.5,1407.5 --size 1024x768
"""
import argparse
import hashlib
import html
import json
import shutil
import zipfile
from fractions import Fraction
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont, PngImagePlugin

AUTHOR = 'Codex — независимый исследователь Хоррориуса · 12.10.2026'
SCALES = ['1/4','1/3','3/8','1/2','5/8','2/3','3/4','4/5','7/8','15/16','1','17/16','35/32','9/8','5/4','3/2','2']
PHASES = ['0','1/3','2/3']

def indices(length, center, scale, phase):
    """floor(center + ((i+.5)-length/2-phase)/scale), using exact integers."""
    c,s,p = map(Fraction,(center,scale,phase))
    if s<=0: raise ValueError('Scale must be positive')
    i=np.arange(length,dtype=np.int64)
    numerator=c.numerator*2*p.denominator*s.numerator+((2*i+1-length)*p.denominator-2*p.numerator)*s.denominator*c.denominator
    denominator=2*p.denominator*s.numerator*c.denominator
    return numerator//denominator

def sample(source, size, center, scale, phase=('0','0')):
    w,h=size;xs=indices(w,center[0],scale,phase[0]);ys=indices(h,center[1],scale,phase[1])
    out=np.zeros((h,w,3),dtype=np.uint8)
    vx=(xs>=0)&(xs<source.shape[1]);vy=(ys>=0)&(ys<source.shape[0])
    out[np.ix_(vy,vx)]=source[ys[vy,None],xs[None,vx],:3]
    return out, {'sourceColumns':[int(xs.min()),int(xs.max())],'sourceRows':[int(ys.min()),int(ys.max())],
                 'outsideSourcePixels':int(w*h-int(vx.sum())*int(vy.sum()))}

def font(size):
    for name in ['C:/Windows/Fonts/segoeui.ttf','C:/Windows/Fonts/arial.ttf','DejaVuSans.ttf']:
        try:return ImageFont.truetype(name,size)
        except OSError:pass
    return ImageFont.load_default()

def png(image,path,parameters):
    info=PngImagePlugin.PngInfo();info.add_text('Author',AUTHOR);info.add_text('Parameters',json.dumps(parameters,ensure_ascii=False))
    image.save(path,pnginfo=info)

def caption(field, line):
    image=Image.new('RGB',(field.shape[1],field.shape[0]+48),'#10191d');image.paste(Image.fromarray(field),(0,0))
    d=ImageDraw.Draw(image);d.text((10,field.shape[0]+4),line,font=font(12 if field.shape[1]<500 else 14),fill='#b8e4dd')
    signature=AUTHOR if field.shape[1]>=500 else 'Codex · Хоррориус · 12.10.2026'
    d.text((10,field.shape[0]+25),signature,font=font(12),fill='#809994')
    return image

def pack(out):
    """Keep the gallery folder and its parent scripts together for offline links."""
    out=Path(out);archive=out.with_suffix('.zip')
    with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_STORED) as z:
        for file in sorted(out.iterdir()):
            if file.is_file():z.write(file,str(Path(out.name)/file.name))
        for name in ['horrorius-scale-capture.py','horrorius-scale-capture-test.py','horrorius-scale-capture-check.py','horrorius-mark-motif.py']:
            file=Path(__file__).with_name(name)
            if file.exists():z.write(file,name)
    return archive

def run(args):
    source_path=Path(args.source);out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    size=tuple(map(int,args.size.lower().split('x')))
    if len(size)!=2 or min(size)<32 or max(size)>4096:raise ValueError('Output size must be 32…4096 pixels')
    original=Image.open(source_path).convert('RGB');source=np.asarray(original)
    center=tuple(args.center.split(',')) if args.center else (str(Fraction(original.width,2)),str(Fraction(original.height,2)))
    if len(center)!=2:raise ValueError('Center requires x,y')
    scales=args.scales.split(',') if args.scales else SCALES
    source_hash=hashlib.sha256(source_path.read_bytes()).hexdigest()
    source_info=json.loads(source_path.with_suffix('.json').read_text(encoding='utf-8')) if source_path.with_suffix('.json').exists() else {}
    frame=source_info.get('completedVertices');frame_label=f'n={frame}' if frame is not None else 'статичный'
    if source_path.resolve()!=(out/'source-original.png').resolve():shutil.copyfile(source_path,out/'source-original.png')
    manifest={'author':AUTHOR,'date':'2026-10-12','source':'source-original.png','sourceSha256':source_hash,
      'sourceSize':[original.width,original.height],'outputFieldSize':list(size),'centerSourceCells':list(center),
      'algorithm':'exact nearest cell: floor(center+((pixel+.5)-viewport/2-phase)/scale); out-of-source black',
      'scope':'one unchanged source frame; finite pilot sweep, not every possible continuous zoom; captions outside the sampled field',
      'sourceCapture':source_info,'scales':scales,'phasesInScreenPixels':PHASES,'cases':[]}
    hashes={};unique=[]
    for si,scale in enumerate(scales):
        for pi,phase in enumerate(PHASES):
            field,bounds=sample(source,size,center,scale,(phase,phase));digest=hashlib.sha256(field.tobytes()).hexdigest()
            case={'scale':scale,'scaleDecimal':float(Fraction(scale)),'phase':[phase,phase],'sampledFieldSha256':digest,**bounds}
            name=f'view-{si+1:02d}-phase-{pi}.png';case['file']=name
            case['duplicateOfSamePixels']=digest in hashes
            if digest in hashes:case['pixelDuplicateOf']=hashes[digest]
            else:hashes[digest]=name;unique.append(case)
            tw=min(256,size[0]);th=min(256,size[1]);tx=(size[0]-tw)//2;ty=(size[1]-th)//2
            case['tileFile']=f'tile-{si+1:02d}-phase-{pi}.png';case['tileRectangleInOutput']=[tx,ty,tx+tw,ty+th]
            png(caption(field,f'Кадр {frame_label} · масштаб {scale} · сдвиг сетки ({phase}, {phase}) px'),out/name,case)
            png(caption(field[ty:ty+th,tx:tx+tw],f'{frame_label} · s={scale} · φ={phase}'),out/case['tileFile'],case)
            manifest['cases'].append(case)
    manifest['caseCount']=len(manifest['cases']);manifest['uniqueImageCount']=len(unique)
    (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    thumb=(320,240);columns=3;rows=len(scales);sheet=Image.new('RGB',(columns*thumb[0],64+rows*(thumb[1]+40)),'#10191d');d=ImageDraw.Draw(sheet)
    d.text((12,8),'Один исходный кадр · разные масштабы и сдвиги сетки',font=font(18),fill='#d7ebe7');d.text((12,35),AUTHOR,font=font(13),fill='#8aa69f')
    for i,case in enumerate(manifest['cases']):
        im=Image.open(out/case['file']).crop((0,0,*size)).resize(thumb,Image.Resampling.LANCZOS)
        x=(i%columns)*thumb[0];y=64+(i//columns)*(thumb[1]+40);sheet.paste(im,(x,y));d.text((x+8,y+thumb[1]+8),f"{case['scale']} · фаза {case['phase'][0]} px",font=font(13),fill='#bbddd4')
    png(sheet,out/'all-views-sheet.png',{'note':'overview thumbnails are smoothed; individual PNGs retain the exact sampled output pixels','sourceSha256':source_hash})
    # Small comparison sheet for an inline preview: six phase-zero views.
    wanted=['1/3','1/2','2/3','4/5','1','35/32'];selected=[c for c in manifest['cases'] if c['scale'] in wanted and c['phase']==['0','0']]
    preview=Image.new('RGB',(960,64+3*400),'#10191d');pd=ImageDraw.Draw(preview);pd.text((12,8),f'Один кадр {frame_label} · шесть отображений',font=font(21),fill='#d7ebe7');pd.text((12,38),AUTHOR,font=font(13),fill='#8aa69f')
    for i,case in enumerate(selected[:6]):
        im=Image.open(out/case['file']).crop((0,0,*size)).resize((480,360),Image.Resampling.LANCZOS)
        x=(i%2)*480;y=64+(i//2)*400;preview.paste(im,(x,y));pd.text((x+12,y+365),'Масштаб '+case['scale'],font=font(16),fill='#bbddd4')
    png(preview,out/'six-views.png',{'sourceSha256':source_hash,'scales':wanted,'phase':['0','0'],'note':'smoothed thumbnails; see separate PNGs at 1:1'})
    near=[s for s in ['15/16','1','17/16','35/32','9/8','5/4'] if s in scales];detail=Image.new('RGB',(1536,64+max(1,(len(near)+2)//3)*552),'#10191d');dd=ImageDraw.Draw(detail)
    dd.text((12,8),f'Один кадр {frame_label} · центральные фрагменты разных отображений',font=font(21),fill='#d7ebe7');dd.text((12,38),AUTHOR,font=font(13),fill='#8aa69f')
    for i,scale in enumerate(near):
        case=next(c for c in manifest['cases'] if c['scale']==scale and c['phase']==['0','0'])
        im=Image.open(out/case['tileFile']).crop((0,0,256,256)).resize((512,512),Image.Resampling.NEAREST)
        x=(i%3)*512;y=64+(i//3)*552;detail.paste(im,(x,y));dd.text((x+12,y+518),'Масштаб '+scale,font=font(17),fill='#bbddd4')
    png(detail,out/'near-one-tiles.png',{'sourceSha256':source_hash,'scales':near,'phase':['0','0'],'note':'256x256 central output crops; magnified exactly 2x with nearest cells'})
    cards=[]
    for case in manifest['cases']:
        cards.append(f'<div><a href="{case["file"]}"><img loading="lazy" src="{case["file"]}" alt="Масштаб {html.escape(case["scale"])}"><span>Масштаб {html.escape(case["scale"])} · фаза {case["phase"][0]} px</span></a><a href="{case["tileFile"]}">Центральный фрагмент 256×256 →</a></div>')
    extra=''
    if out.name=='horrorius-scale-N2048-n96':
        extra='<p><b>Это первый прогон с окнами.</b> <a href="../horrorius-full-N2048-n96/index.html">Новая серия: целый кадр на каждом масштабе →</a></p>'
        if (out/'one-motif.html').exists():extra+='<p><a href="one-motif.html">Обведённые примеры: по одному выбранному участку в каждой части →</a></p>'
    page=f'''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Хоррориус · один кадр · Codex</title>
<style>body{{background:#0b1216;color:#d7e8e3;font:15px system-ui;margin:20px}}a{{color:#8ce0ce}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}}.grid a{{display:block;background:#142127;padding:10px;text-decoration:none}}img{{width:100%;height:auto}}span{{display:block;margin:8px}}p{{line-height:1.5;max-width:1000px}}</style>
<h1>Один кадр · разные отображения</h1>{extra}<p>{AUTHOR}</p><p>Исходник: {original.width}×{original.height} пикселей, кадр {frame_label}. Один и тот же участок с центром ({', '.join(center)}) в координатах исходных клеток.
{len(manifest['cases'])} проверенных сочетаний, {len(unique)} разных изображений. Это первая конечная серия, а не все возможные масштабы.
Миниатюры сглажены; щелчок открывает отдельный PNG {size[0]}×{size[1]} пикселей плюс подпись. Для сравнения сетки открывайте его в размере 1:1.</p>
<p><a href="source-original.png">Полный исходный кадр</a> · <a href="manifest.json">Все параметры и контрольные суммы</a> · <a href="all-views-sheet.png">Общий лист</a> · <a href="../horrorius-scale-capture.py">Скрипт</a></p>
<p><a href="near-one-tiles.png">Крупно: фрагменты возле масштаба 1:1</a> · <a href="../{html.escape(out.name)}.zip">Скачать всю серию ZIP</a></p>
<a href="near-one-tiles.png"><img src="near-one-tiles.png" alt="Шесть центральных фрагментов одного кадра" style="max-width:1100px;display:block;margin:20px 0"></a>
<div class="grid">{''.join(cards)}</div></html>'''
    (out/'index.html').write_text(page,encoding='utf-8')
    archive=pack(out)
    print(json.dumps({'folder':str(out.resolve()),'archive':str(archive.resolve()),'cases':len(manifest['cases']),'unique':len(unique),'sourceSha256':source_hash},ensure_ascii=False))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--source',required=True);parser.add_argument('--out',required=True);parser.add_argument('--center');parser.add_argument('--size',default='1024x768');parser.add_argument('--scales')
    run(parser.parse_args())
