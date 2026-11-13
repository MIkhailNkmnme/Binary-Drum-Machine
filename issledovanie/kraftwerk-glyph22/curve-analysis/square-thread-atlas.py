"""Independent verification and four-row plates for all 19 recorded frames."""
from pathlib import Path
import json,importlib.util,collections,html
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('checker',HERE/'square-thread-check.py');checker=importlib.util.module_from_spec(spec);spec.loader.exec_module(checker)
batch=json.loads((HERE/'square-thread-batch.json').read_text(encoding='utf-8'))
source=json.loads((HERE/'graphs.json').read_text(encoding='utf-8'))
OUT=HERE/'square-frames';OUT.mkdir(exist_ok=True)
totals=collections.Counter();verified=[];rows=[]
def esc(s):return html.escape(str(s))
for f in batch['frames']:
 index=f['index'];parts=['<svg xmlns="http://www.w3.org/2000/svg" width="1680" height="1360" viewBox="0 0 1680 1360"><rect width="1680" height="1360" fill="#10151f"/><g font-family="Arial,sans-serif" fill="#e1e7f0">']
 def text(x,y,s,size=18,fill='#e1e7f0'):parts.append(f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}">{esc(s)}</text>')
 text(28,38,f'Кадр {index:02d} · четыре нити из заполненных квадратов',27)
 text(28,70,'Белый квадрат / пустой шаг. Одинаковый номер метки — одна общая геометрическая точка пути.',18)
 frows=[]
 for slot,g in enumerate(f['glyphs'],1):
  original=source['frames'][index-1]['glyphs'][slot-1];target=checker.target_from_edges(original['edges'])
  assert target==set(map(tuple,g['target']))
  status=g['status'];totals[status]+=1;top=92+(slot-1)*308
  text(28,top+25,f'Глиф {slot}',22)
  xs=[p[0] for p in target];ys=[p[1] for p in target];mx,my=min(xs),min(ys);scale=min(170/(max(xs)-mx+1),215/(max(ys)-my+1))
  for x,y in target:parts.append(f'<rect x="{28+(x-mx)*scale:.2f}" y="{top+48+(y-my)*scale:.2f}" width="{scale:.2f}" height="{scale:.2f}" fill="#fff" shape-rendering="crispEdges"/>')
  if status=='found':
   result=checker.validate(g['route'],target);g['independentCheck']=result
   verified.append({'frame':index,'slot':slot,**result})
   text(240,top+25,f'{len(target)} белых + {len(target)-1} пустых · {result["moves"]} переходов · J{result["geometricMeetingPoints"]} общих точек',20,'#7be6d4')
   text(240,top+53,'Белые клетки и отрезки пути не повторяются. OR = XOR цели.',17)
   n=len(g['route']);left=252;width=1380;pitch=width/(n-1);lineY=top+180
   parts.append(f'<line x1="{left}" x2="{left+width}" y1="{lineY}" y2="{lineY}" stroke="#536177"/>')
   for i in range(n):
    x=left+i*pitch;s=max(2.5,min(6,pitch*.72));parts.append(f'<rect x="{x-s/2:.2f}" y="{lineY-s/2:.2f}" width="{s:.2f}" height="{s:.2f}" fill="{"#fff" if i%2==0 else "#10151f"}" stroke="#536177" stroke-width=".5"/>')
   labels=[]
   for number,meeting in enumerate(result['meetingPoints'],1):
    for position in meeting['positions']:labels.append((left+position*pitch,str(number)))
   lanes=[-999]*9
   for x,label in sorted(labels):
    lane=next((k for k,right in enumerate(lanes) if x-13>right),None)
    assert lane is not None,('labels need more lanes',index,slot,x)
    lanes[lane]=x+13;y=lineY-15-lane*12
    parts.append(f'<line x1="{x:.2f}" x2="{x:.2f}" y1="{lineY-6}" y2="{y+3}" stroke="#34475e" stroke-width=".6"/>')
    parts.append(f'<text x="{x:.2f}" y="{y}" text-anchor="middle" font-size="10" fill="#a9d9ff">{label}</text>')
   text(left,lineY+32,'Начало · 1',15);text(left+width-72,lineY+32,'1 · конец',15)
   text(left,lineY+59,'Метка между квадратами — пересечение диагоналей на половине шага.',15,'#a4b0c1')
   frows.append({'slot':slot,'status':status,'cells':len(target),'moves':result['moves'],'meetings':result['geometricMeetingPoints']})
  else:
   proven='disconnected' in status
   if proven:
    components=checker.white_components(target);assert len(components)>1
    g['independentComponents']=components
   text(240,top+100,'Разрыв графа допустимых белых посещений' if proven else 'Маршрут пока не найден за отведённый поиск',23,'#ffbb71')
   text(240,top+140,'Это барьер только для выбранного растра и запрета лишней белой краски.' if proven else 'Ограничение времени не является доказательством невозможности.',18)
   text(240,top+176,'Исходные клетки и данные поиска сохранены; выдуманный проход не подставлен.',18)
   frows.append({'slot':slot,'status':status,'cells':len(target),**({'independentComponents':components} if proven else {})})
  parts.append(f'<line x1="28" x2="1650" y1="{top+286}" y2="{top+286}" stroke="#344055"/>')
 rows.append({'frame':index,'glyphs':frows});parts.append('</g></svg>')
 (OUT/f'frame-{index:02d}.svg').write_text(''.join(parts),encoding='utf-8')
report={'version':'0.001','totals':dict(totals),'frames':rows,'verifiedRoutes':verified,'limitations':'Counts exact for the 2x raster of inferred graphs. Allowed direction types H/D/V; 90 and 135 degree oriented turns are permitted. No extra painted cells allowed. Time limits are not impossibility proofs.'}
(HERE/'square-thread-batch-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'totals':dict(totals),'checked':len(verified),'plates':len(rows)}))
