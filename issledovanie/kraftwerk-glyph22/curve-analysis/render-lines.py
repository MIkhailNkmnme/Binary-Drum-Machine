"""Render inferred glyph graphs and their edge-once line decompositions."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from xml.sax.saxutils import escape
import json,math,zipfile

HERE=Path(__file__).resolve().parent
data=json.loads((HERE/'analysis.json').read_text(encoding='utf-8'))
W,H,ROW=1680,1060,214
BG='#10151f';FG='#e1e7f0';DIM='#9caabf';GOLD='#ffe0a3';PINK='#ff8bb3'
COLORS=['#75e2dc','#ffcf78','#c4a3ff','#ff96c5','#9ae799','#9cc5ff','#f7ab7e','#cce28b','#c2cedb','#d49ef2']
FONT_DIR=Path('C:/Windows/Fonts')
def font(size):
 for p in [FONT_DIR/'segoeui.ttf',Path('DejaVuSans.ttf')]:
  try:return ImageFont.truetype(str(p),size)
  except OSError:pass
 return ImageFont.load_default()

class Plot:
 def __init__(self,h):
  self.im=Image.new('RGB',(W,h),BG);self.d=ImageDraw.Draw(self.im)
  self.svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{h}" viewBox="0 0 {W} {h}" role="img"><title>Глифы и развёртки линий</title><rect width="100%" height="100%" fill="{BG}"/>']
 def text(self,x,y,s,size=20,color=FG):
  self.d.text((x,y),str(s),font=font(size),fill=color)
  self.svg.append(f'<text x="{x:.2f}" y="{y+size:.2f}" font-family="Segoe UI, sans-serif" font-size="{size}" fill="{color}">{escape(str(s))}</text>')
 def line(self,x1,y1,x2,y2,color=FG,width=2,dash=False):
  self.d.line((x1,y1,x2,y2),fill=color,width=width)
  self.svg.append(f'<path d="M{x1:.2f} {y1:.2f}L{x2:.2f} {y2:.2f}" stroke="{color}" stroke-width="{width}" fill="none"'+(' stroke-dasharray="5 4"' if dash else '')+'/>')
 def dot(self,x,y,r=4,color=GOLD):
  self.d.ellipse((x-r,y-r,x+r,y+r),fill=color)
  self.svg.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r}" fill="{color}"/>')
 def save(self,stem):
  stem.parent.mkdir(parents=True,exist_ok=True)
  self.im.save(stem.with_suffix('.png'))
  stem.with_suffix('.svg').write_text('\n'.join(self.svg+['</svg>']),encoding='utf-8')

def heading(p,f,dy=0):
 t=(f['witness']['before']+f['witness']['after'])/2
 name=f"состояние {f['state']:02d}" if f['state'] is not None else ('смешанный переход' if f['index']==16 else 'опорный кадр перехода')
 p.text(38,dy+18,f"Кадр {f['index']:02d} · {t:.3f} с · {name}",32,GOLD)
 p.text(40,dy+62,'Четыре строки: один глиф → минимальный набор непрерывных проходов, каждое ребро ровно один раз.',20)
 p.text(40,dy+93,'Общие точки J = X + B. X: четыре ветви; B: другие стыки. Повтор метки = та же точка. Цвет = отдельный штрих.',17,DIM)
 p.text(40,dy+119,'Числа точны для восстановленного графа. Связи на видеозаписи местами неоднозначны; оригинал рядом в просмотрщике.',16,PINK)

def draw_glyph(p,g,y):
 a=g['analysis'];nodes={n['id']:n for n in a['nodes']}; labels={};nx=nb=0
 for n in a['nodes']:
  if n['degree']>=3:
   if n['kind']=='crossing':nx+=1;labels[n['id']]=f'X{nx}'
   else:nb+=1;labels[n['id']]=f'B{nb}'
 p.line(36,y,W-36,y,'#303a4b',1)
 p.text(42,y+9,f"Глиф {g['slot']}",24,GOLD)
 variants=g['thresholdComparison']['variants'];values=[v['analysis']['crossingCount'] for v in variants]
 xrange=str(a['crossingCount']) if min(values)==max(values) else f"{a['crossingCount']} (при других порогах {min(values)}–{max(values)})"
 status='ДА' if a['canDrawSingleStroke'] else 'НЕТ'
 p.text(277,y+9,f"Один штрих: {status} · Общих точек J: {a['junctionCount']} · X: {xrange} · Компонент: {a['componentCount']} · Нечётных: {len(a['oddNodes'])}",20)
 confidence='низкая различимость' if g['confidence']=='low' else 'оцифрованная модель'
 p.text(277,y+40,f"Минимум штрихов: {a['minimumTrails']} · Развилок B: {nb} · Длина: {a['edgeCount']} клеточных рёбер · {confidence}",18,PINK if g['confidence']=='low' else DIM)
 if not g['thresholdComparison']['stableDecision']:
  p.text(277,y+65,'ВНИМАНИЕ: ответ «один штрих» меняется при включении слабых линий.',17,PINK)
 # Every source graph edge has the color of its corresponding traversal.
 sx,sy,scale=65,y+49,10
 active=[n for n in a['nodes'] if n['degree']]
 minx=min((n['x'] for n in active),default=0);miny=min((n['y'] for n in active),default=0)
 xy=lambda n:(sx+(n['x']-minx)*scale,sy+(n['y']-miny)*scale)
 for trail in a['trails']:
  color=COLORS[trail['id']%len(COLORS)]
  for e in trail['edges']:
   x1,y1=xy(nodes[e['from']]);x2,y2=xy(nodes[e['to']]);p.line(x1,y1,x2,y2,color,3)
 for n in active:
  x,z=xy(n)
  if n['id'] in labels:
   p.dot(x,z,3,GOLD if n['kind']=='crossing' else PINK)
   if n['kind']=='crossing':p.text(x+4,z-12,labels[n['id']],11,GOLD)
  elif n['degree']==1:p.dot(x,z,3,FG)
 x=285.;span=W-330;gap=15;available=span-gap*max(0,len(a['trails'])-1);unit=available/max(1,a['totalLength']);baseline=y+132
 lane_ends=[-1000.]*4;lane_offsets=[-42,-24,18,36]
 sequences=[]
 for i,trail in enumerate(a['trails']):
  color=COLORS[i%len(COLORS)];length=trail['length']*unit
  p.line(x,baseline,x+length,baseline,color,4)
  p.dot(x,baseline,3,color);p.dot(x+length,baseline,3,color)
  p.text(x+length/2-6,y+183,f"{i+1}"+('к' if trail['closed'] else ''),12,color)
  seq=[]
  for j,v in enumerate(trail['visits']):
   label=labels.get(v['node'])
   if not label:continue
   # Closure duplicates the chosen cut; retain it but explicitly mark it.
   mark=label+('*' if v['isClosure'] else '')
   px=x+v['distance']*unit
   lane=next((k for k,end in enumerate(lane_ends) if px-12>end),min(range(4),key=lambda k:lane_ends[k]))
   lane_ends[lane]=px+max(18,len(mark)*7)
   offset=lane_offsets[lane]
   p.dot(px,baseline,4,GOLD if label.startswith('X') else PINK)
   p.line(px,baseline,px,baseline+(offset+14 if offset<0 else offset),DIM,1)
   p.text(px-9,baseline+offset,mark,12,GOLD if label.startswith('X') else PINK)
   seq.append(mark)
  sequences.append(f"{i+1}:"+('–'.join(seq) if seq else 'без X/B'))
  x+=length+gap
 p.text(277,y+198,'Номера внизу — штрихи; к = замкнутый. * — повтор точки разреза замкнутого штриха, не новое пересечение.',12,DIM)

atlas=Plot(H*len(data['frames']))
for f in data['frames']:
 p=Plot(H);heading(p,f);heading(atlas,f,(f['index']-1)*H)
 for k,g in enumerate(f['glyphs']):
  draw_glyph(p,g,160+k*ROW);draw_glyph(atlas,g,(f['index']-1)*H+160+k*ROW)
 p.save(HERE/'frames'/f"frame-{f['index']:02d}")
atlas.save(HERE/'all-frames')
print('Rendered 19 frames x 4 lines and full atlas.')
