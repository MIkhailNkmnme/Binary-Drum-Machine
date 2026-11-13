import argparse
from pathlib import Path
root=Path(__file__).parent
import cv2 as cv
import numpy as np
from PIL import Image,ImageDraw,ImageFont
import json
from xml.sax.saxutils import escape

src = None
out = None
samples = {}
# Clock intervals are reviewed independently from the chosen sharp view of a state.
# centre of first outline stem, pitch between stems, top and bottom of all four figures
views=[
 (538,567,81,373,474),
 (561,568,81,374,475),
 (28,558,82,369,473),
 (67,550,81,355,458),
 (95,560,81,357,459),
 (117,564,82,354,457),
 (149,581,71,367,465),
 (196,610,41,392,447),
 (226,626,41,391,443),
 (248,631,41,389,443),
 (287,619,47,405,462),
 (319,579,72,364,455),
 (334,564,84,339,443),
 (382,478,137,278,458),
 (408,399,183,263,498),
 (444,290,262,274,607),
 (461,213,315,263,671),
]
onsets=[None,(1.63,1.77),(2.96,3.08),(4.15,4.29),(5.35,5.47),(6.67,6.78),
 (7.90,8.02),(9.08,9.18),(10.41,10.51),(11.59,11.72),(12.91,13.02),
 (14.12,14.36),(15.43,15.58),(16.51,16.76),(17.84,17.95),(19.16,19.27),(20.35,20.46)]
mixed={
  15:((422,373,212,265,530),'Переход 15–16', 'Слоты 2 и 4 сменились раньше'),
  16:((457,230,305,263,651),'Переход 16–17', 'Слоты 3 и 4 сменились раньше'),
}
evidence=[]
for i,v in enumerate(views):
    evidence.append((i+1,v,onsets[i],None))
    if i+1 in mixed:
        mixed_view,*mixed_labels=mixed[i+1]
        evidence.append((None,mixed_view,None,mixed_labels))

def strip(s):
 n,cx,d,y0,y1=s
 im=Image.open(src/samples[n]['file']).convert('RGB')
 return im.crop((round(cx-.64*d),y0-8,round(cx+3.64*d),y1+8))

def masks(view):
    n,cx,d,y0,y1=view
    im=np.array(Image.open(src/samples[n]['file']).convert('RGB'))
    x0=round(cx-.64*d);x1=round(cx+3.64*d); y0-=8; y1+=8
    crop=im[y0:y1,x0:x1]
    h,w=crop.shape[:2]
    r,g,b=np.moveaxis(crop.astype(np.float32),2,0)
    luminance=.60*g+.40*r
    radius=max(3,round(d*.15))
    floor=cv.morphologyEx(luminance,cv.MORPH_OPEN,cv.getStructuringElement(cv.MORPH_ELLIPSE,(radius|1,radius|1)))
    signal=luminance-floor
    brightness=np.quantile(luminance,.97)
    contrast=np.quantile(signal,.96)
    gold=(signal > max(3,contrast*.28)) & (luminance > brightness*.59) & (r-g < max(15,brightness*.23))
    red=(r-g>max(9,brightness*.18)) & (r>brightness*.59) & (r-b>brightness*.21)
    def clear(mask):
        mask=mask.astype(np.uint8)
        size=max(3,round((d/70)**2))
        k,labels,stats,_=cv.connectedComponentsWithStats(mask)
        keep=np.array(stats[:,4]>=size)
        keep[0]=False
        return (keep[labels]*255).astype(np.uint8)
    support=np.zeros((h,w),np.uint8)
    for i in range(4):
        mid=cx+i*d-x0
        support[:,max(0,round(mid-.48*d)):round(mid+.48*d)]=1
    return clear(red & (support>0)),clear(gold & (support>0)),(w,h)

def paths(mask):
    contours,_=cv.findContours(mask,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE)
    commands=[]
    for contour in contours:
        pts=cv.approxPolyDP(contour,.52,True).reshape(-1,2)
        if len(pts)<3:
            continue
        commands.append('M'+'L'.join(f'{x} {y}' for x,y in pts)+'Z')
    return ''.join(commands)

def export():
    width=1340
    rowsize=204
    height=150+len(evidence)*rowsize+70
    canvas=Image.new('RGB',(width,height),'#10151f')
    draw=ImageDraw.Draw(canvas)
    def font(family,size):
        try:
            return ImageFont.truetype(str(font_dir/family) if font_dir else family,size)
        except OSError:
            return ImageFont.truetype('DejaVuSerif.ttf' if family.startswith('georgia') else 'DejaVuSans.ttf',size)
    serif=font('georgia.ttf',62); regular=font('segoeui.ttf',21); mono=font('consola.ttf',20)
    svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img">',
        '<title>Четыре глифа · первые 22 секунды</title>',
        '<desc>Векторная трассировка различимых устойчивых состояний. Обводки переданы по отдельным опорным кадрам.</desc>',
        f'<rect width="{width}" height="{height}" fill="#10151f"/>']
    def txt(x,y,message,fs=21,c='#b8becb',f=regular,family='Segoe UI'):
        draw.text((x,y),message,font=f,fill=c,anchor='ls')
        svg.append(f'<text x="{x}" y="{y}" font-family="{family}, sans-serif" font-size="{fs}" fill="{c}">{escape(message)}</text>')
    def line(x,y,x2,y2,c):
        draw.line((x,y,x2,y2),fill=c)
        svg.append(f'<path d="M{x} {y}L{x2} {y2}" stroke="{c}"/>')
    txt(52,82,'Четыре глифа',62,'#ffe0a3',serif,'Georgia')
    txt(56,117,'Первые 22 секунды · 17 устойчивых состояний и 2 переходных · обводки опорных кадров')
    rows=[]
    for i,(state,v,interval,transition) in enumerate(evidence):
        top=150+i*rowsize
        n,cx,d,_,_=v
        data=samples[n]
        name=f'{state:02d}' if state else transition[0]
        red,gold,(w,h)=masks(v)
        ycenter=(h-1)/2
        scale=151/h
        x0=330
        cell=240
        raw_left=round(cx-.64*d)
        line(52,top,1287,top,'#343b48')
        fs=48 if state else 29
        txt(55,top+68,name,fs,'#f6d9a1',font('georgia.ttf',fs),'Georgia')
        txt(55,top+103,f'Кадр {data["after"]:.3f} с',20,f=mono,family='Consolas')
        if transition:
            txt(55,top+133,transition[1],16,f=font('segoeui.ttf',16))
        elif interval:
            txt(55,top+133,f'Смена {interval[0]:.2f}–{interval[1]:.2f} с',20,f=mono,family='Consolas')
        else:
            txt(55,top+133,'Вступление из темноты',20)
        glyphs=[]
        for j in range(4):
            center=cx+j*d-raw_left
            left=max(0,round(center-.48*d));right=min(w,round(center+.48*d))
            if right <= left:
                continue
            target=x0+j*cell+cell/2
            gx=target+(left-center)*scale
            gy=top+89-ycenter*scale
            for mask,fill in [(red,'#df483d'),(gold,'#ffdf98')]:
                cut=mask[:,left:right]
                glyph=paths(cut)
                svg.append(f'<path fill="{fill}" fill-rule="evenodd" transform="translate({gx:.3f} {gy:.3f}) scale({scale:.6f})" d="{glyph}"/>')
                m=Image.fromarray(cut).resize((round((right-left)*scale),round(h*scale)),Image.Resampling.BICUBIC)
                canvas.paste(fill,(round(gx),round(gy),round(gx)+m.width,round(gy)+m.height),m)
            txt(round(target-6),top+188,str(j+1),20,f=mono,family='Consolas')
            glyphs.append({'slot':j+1,'sourceX':[left+raw_left,right+raw_left],'yellowPixels':int(np.count_nonzero(gold[:,left:right])),
              'redPixels':int(np.count_nonzero(red[:,left:right]))})
        rows.append({'state':state,'witness':data,'transitionWindowSeconds':interval,'intermediate':transition,'glyphs':glyphs})
    line(52,height-64,1287,height-64,'#343b48')
    txt(54,height-30,'Жёлтый и красный — наблюдаемые слои. Времена смены даны по выборке кадров.')
    svg.append('</svg>')
    (out/'glyph22-four-glyphs.svg').write_text('\n'.join(svg),encoding='utf-8')
    canvas.save(out/'glyph22-four-glyphs.png',optimize=True)
    y=np.mean([interval for interval in onsets if interval],axis=1)
    x=np.arange(len(y))
    period,offset=np.polyfit(x,y,1)
    result={'source':'https://www.youtube.com/watch?v=BNYdUn7gmmI','seconds':[0,22],
        'sampledScreenshots':len(samples), 'sampleSet':'published witnesses or supplied captures','stableStates':len(views),'intermediateStates':len(mixed),'rows':rows,
        'timingFit':{'periodSeconds':round(float(period),4),'firstTransitionSeconds':round(float(offset),4),
            'maximumResidualSeconds':round(float(np.max(np.abs(y-(period*x+offset)))),4),
            'basis':'Центры 16 наблюдаемых интервалов смены. Номер первой смены равен нулю.'},
        'comparisons':[
          {'states':[4,13],'finding':'Визуально возвращается весь набор из четырёх глифов, вплоть до сходных квадратных просветов и кончиков. Цвет каймы заметно различается.'},
          {'states':[6,12],'finding':'Верхние ступени похожи, но у третьего глифа во втором наборе появляется нижний просвет. Сдвиг целого контура этого не объясняет.'},
          {'state':14,'sampleRange':[380,389],'finding':'Красная кайма несколько раз меняет интенсивность при той же геометрии. Длительность её общего цикла по выборке не установлена.'}
        ],
        'method':'Фигуры выровнены по четырём позициям и масштабированы по высоте. Яркие жёлтые и красные области выделены из указанных JPEG; SVG обводит эти области как замкнутые векторные контуры.',
        'limits':['Время JPEG известно в пределах before…after, а границы смены оценены по выборке.',
          'Переходные смеси, изменения цвета внутри устойчивого рисунка, вход из темноты и монтажная склейка не считаются устойчивыми состояниями.',
          'Тонкие края местами сливаются из-за свечения, JPEG и уменьшения сцены в 8,5–14 с. Это трассировка наблюдаемого контура, а точная исходная квадратная сетка не восстановлена.',
          'После примерно 20,8 с крайние глифы обрезаются и накладывается следующий план. Последний ряд взят из более раннего кадра.',
          'Клеточная маска на сетке согласуется с формой. Неподвижные части и меняющиеся клетки видны, но операция выбора следующей маски не определяется по записи.',
          'Красный цвет выделен по JPEG. Нельзя отделить вклад экранной анимации от захвата камеры без исходного слоя.'],
        'findings':['Ось, поперечина и положение каждого из четырёх глифов сохраняются. Ступени по бокам, квадратные просветы и нижний край меняются.',
          'Устойчивая геометрия меняется примерно каждые 1,25 с, красная кайма пульсирует чаще и может исчезать при той же жёлтой геометрии.',
          'На отдельных переходах глифы меняются в соседних кадрах, поэтому краткие смешанные наборы возможны.']}
    (out/'glyph22-findings.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')

if __name__=='__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--captures', type=Path, default=root.parent/'witnesses')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--font-dir', type=Path)
    args = parser.parse_args()
    src, out, font_dir = args.captures, args.output, args.font_dir
    out.mkdir(parents=True, exist_ok=True)
    samples = {int(Path(s['file']).stem):s for s in json.loads((src/'samples.json').read_text(encoding='utf-8'))}
    assert len(views)==len(onsets)
    sheet=Image.new('RGB',(960,((len(views)+2)//3)*140),'#171a21')
    draw=ImageDraw.Draw(sheet)
    for i,v in enumerate(views):
        x,y=i%3*320,i//3*140
        red,gold,_=masks(v)
        recolor=np.empty((*red.shape,3),np.uint8)
        recolor[:]=[20,24,32]
        recolor[red>0]=[230,60,55]
        recolor[gold>0]=[255,223,152]
        im=Image.fromarray(recolor)
        im.thumbnail((315,115))
        sheet.paste(im,(x,y))
        draw.text((x+4,y+116),f'{v[0]:04d}    {samples[v[0]]["after"]:.3f}',fill='white')
    sheet.save(out/'draft-paths.jpg')
    export()
