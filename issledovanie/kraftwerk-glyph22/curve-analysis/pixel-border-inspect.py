"""Read source PNG colors; draw a schematic RGB-stripe LCD, not a screen photo."""
from pathlib import Path
from collections import Counter
import hashlib, json, html
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
source = HERE / 'pixel-border-source.png'
im = Image.open(source).convert('RGBA')
counts = Counter(im.getdata())
report = {
    'source': source.name, 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'size': list(im.size), 'colorCount': len(counts),
    'colors': [{'rgba': list(c), 'hex': '#%02X%02X%02X' % c[:3], 'pixels': n}
               for c, n in counts.most_common()],
    'allOpaque': all(c[3] == 255 for c in counts),
    'interpretation': 'Only source PNG values. Does not measure display subpixels or optical fringes.',
    'diagram': 'Illustrative horizontal RGB-stripe LCD. Gaps exaggerated; actual panel unknown.',
    'references': [
        'https://learn.microsoft.com/en-us/typography/cleartype/truetypecleartype',
        'https://learn.microsoft.com/en-us/typography/cleartype/'
    ]
}
(HERE/'pixel-border-check.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

W, H = 1500, 1150
paper = Image.new('RGB', (W,H), '#111722')
draw = ImageDraw.Draw(paper)
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
       '<title>Пиксель, RGB-субпиксели и промежутки — условная схема LCD</title>',
       f'<rect width="{W}" height="{H}" fill="#111722"/>']
fonts={}
def font(size):
    if size not in fonts:
        candidates = ['C:/Windows/Fonts/arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']
        path = next((p for p in candidates if Path(p).exists()), None)
        fonts[size] = ImageFont.truetype(path, size) if path else ImageFont.load_default()
    return fonts[size]
def text(x,y,s,size=28,color='#e8edf5'):
    draw.text((x,y),s,font=font(size),fill=color,anchor='lt')
    svg.append(f'<text x="{x}" y="{y+size*.80}" font-family="Arial,DejaVu Sans,sans-serif" font-size="{size}" fill="{color}">{html.escape(s)}</text>')
def rect(x,y,w,h,color,outline=None):
    draw.rectangle((x,y,x+w-1,y+h-1),fill=color,outline=outline,width=2)
    svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{color}"'+(f' stroke="{outline}" stroke-width="2"' if outline else '')+'/>')
def line(points,color='#adc0d7',width=3):
    draw.line(points,fill=color,width=width)
    svg.append(f'<polyline points="'+ ' '.join(f'{x},{y}' for x,y in points)+f'" fill="none" stroke="{color}" stroke-width="{width}"/>')
def arrow(x1,y1,x2,y2,color='#adc0d7'):
    import math
    line([(x1,y1),(x2,y2)],color,3)
    a=math.atan2(y2-y1,x2-x1); L=12
    line([(x2-L*math.cos(a-.5),y2-L*math.sin(a-.5)),(x2,y2),(x2-L*math.cos(a+.5),y2-L*math.sin(a+.5))],color,3)

text(55,35,'ПИКСЕЛЬ → СУБПИКСЕЛИ → ГРАНИЦА',42)
text(55,94,'Условная RGB-полоса LCD. Это схема, а не микрофотография вашего экрана.',25,'#b4c1d3')
rect(40,145,1420,325,'#1c2635')
text(65,167,'1. ОДИН ПИКСЕЛЬ ЭКРАНА',30)
rect(80,230,160,160,'#e8edf5')
text(66,412,'Издали: один цвет',25)
arrow(270,310,415,310)
text(290,259,'увеличим',23)

# Three active apertures within one pixel; identical gap width at its boundary.
x0,y0,pitch,subw,gap = 455,230,294,90,8
for pix in range(2):
    px=x0+pix*pitch
    rect(px-4,y0-4,294,168,'#000000')
    for k,c in enumerate(['#e80000','#00ed00','#0000f5']):
        rect(px+k*98,y0,subw,160,c)
        text(px+k*98+33,y0+62,'RGB'[k],31,'#ffffff' if k!=1 else '#0b3010')
    line([(px,y0-13),(px,y0-25),(px+286,y0-25),(px+286,y0-13)],'#efcc79')
    text(px+72,y0-57,f'Пиксель {pix+1}',25,'#efcc79')
text(1100,245,'R = 232',25,'#ffb3ad')
text(1100,282,'G = 237',25,'#baffba')
text(1100,319,'B = 245',25,'#b6caff')
text(1080,369,'Вместе: #E8EDF5',25)
arrow(510,425,549,370)
text(505,430,'зазор внутри пикселя',22)
arrow(875,425,745,370)
text(835,430,'зазор между пикселями',22)

rect(40,490,1420,400,'#1c2635')
text(65,511,'2. СВЕТЛАЯ ПОЛОСА МЕЖДУ ТЁМНЫМИ ПИКСЕЛЯМИ',30)
startx,y,pp=190,615,280
for p,rgb in enumerate([(44,47,53),(232,237,245),(232,237,245),(44,47,53)]):
    px=startx+p*pp
    text(px+43,570,'тёмный' if p in (0,3) else 'светлый',25,'#b4c1d3')
    rect(px,y,pp,145,'#000000')
    for k,value in enumerate(rgb):
        col=[0,0,0]; col[k]=value
        rect(px+4+k*92,y+4,84,137,'#%02x%02x%02x'%tuple(col))
        text(px+28+k*92,y+50,'RGB'[k],28,'#ffffff')
    line([(px,y+153),(px,y+164),(px+pp-4,y+164),(px+pp-4,y+153)],'#8494aa',2)
arrow(435,840,474,730,'#ff6e65')
text(90,839,'Первый яркий субпиксель — R',27,'#ffada6')
arrow(1060,840,1022,730,'#779bff')
text(910,839,'Последний яркий — B',27,'#adc3ff')

text(60,920,'3. ЧТО ОЗНАЧАЮТ ТЁМНЫЕ ЩЕЛИ',30)
text(60,973,'Это промежутки между светящимися областями, а не ещё один «междупиксель».',28)
text(60,1015,'Щели здесь увеличены для ясности. У реальных экранов форма и порядок RGB различаются.',25,'#b4c1d3')
text(60,1057,'Обычное увеличение PNG увеличивает его пиксели; субпиксели панели оно не фотографирует.',25,'#b4c1d3')
svg.append('</svg>')
(HERE/'pixel-subpixel-diagram.svg').write_text('\n'.join(svg),encoding='utf-8')
paper.save(HERE/'pixel-subpixel-diagram.png')
print(json.dumps(report,ensure_ascii=False))
