"""A five-step square-cell loop; phase flips at every transition, including diagonal."""
from pathlib import Path
import json
HERE=Path(__file__).resolve().parent
route=[(0,0),(1,0),(0,1),(0,2),(-1,1)]
directions=[]
for a,b in zip(route,route[1:]+route[:1]):
 dx,dy=b[0]-a[0],b[1]-a[1]
 assert max(abs(dx),abs(dy))==1
 directions.append('D' if dx and dy else 'H' if dx else 'V')
assert directions==['H','D','V','D','D']
assert all({a,b}!={'H','V'} for a,b in zip(directions,directions[1:]+directions[:1]))
rows=[]
for laps in range(1,5):
 counts=[0]*5; visits=[[] for _ in route]
 for n in range(laps*5):
  bit=1-n%2;counts[n%5]+=bit;visits[n%5].append(bit)
 rows.append({'laps':laps,'steps':laps*5,'visits':visits,'litVisits':counts,'or':[int(n>0) for n in counts],'xor':[n%2 for n in counts]})
assert [r['xor'] for r in rows]==[[1,0,1,0,1],[1,1,1,1,1],[0,1,0,1,0],[0,0,0,0,0]]
assert [sum(r['or']) for r in rows]==[3,5,5,5]
assert sum(d=='D' for d in directions)==3
report={'version':'0.001','status':'Illustration of an agreed rule; not a reconstruction of the target glyph.',
 'rule':'One transition to a neighbouring cell is one step, including diagonal; bit(n)=1-(n mod 2).',
 'positions':route,'directions':directions,'junctionRule':'No direct H to V or V to H, including the cycle closure.',
 'counting':'Sample the departure cell once per step. A return cell belongs to the next lap, so a cycle boundary is not counted twice.',
 'closedLoopPhaseRule':'A return flips phase iff its number of steps is odd. On the eight-neighbour lattice this is equivalent to an odd number of diagonal steps.',
 'lapResults':rows,'checks':{'allowedTransitions':True,'cycleClosureAllowed':True,'fiveDistinctCells':len(set(route))==5,'threeDiagonalSteps':True,'twoLapsFillAllFiveCells':True,'fourLapsXorClearsAll':True}}
(HERE/'dashed-thread.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
parts=['<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#10151f"/><g font-family="Arial,sans-serif" fill="#e1e7f0">']
def text(x,y,t,size=19,color='#e1e7f0'):parts.append(f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}">{t}</text>')
def cell(x,y,bit,size=35):parts.append(f'<rect x="{x}" y="{y}" width="{size}" height="{size}" fill="{"#fff" if bit else "#10151f"}" stroke="#4b586e" stroke-width="1"/>')
text(30,40,'Пунктир 1–0–1–0: диагональ тоже один шаг',28)
text(30,73,'Белое = 1. Пустой квадрат = 0. Фаза сохраняется при поворотах и переключается после каждого шага.',18)
for y,label,bits in [(112,'Фаза A',[1,0]*4),(160,'Фаза B',[0,1]*4),(208,'A OR B / A XOR B',[1]*8),(256,'A AND B',[0]*8)]:
 text(30,y+25,label,20)
 for i,b in enumerate(bits):cell(280+i*43,y,b)
text(690,137,'На одном простом ряду два сдвинутых',19)
text(690,166,'пунктира заполняют пробелы друг друга.',19)
text(690,215,'0 не стирает накопленную 1:',19)
text(690,244,'1 OR 0 = 1; 1 XOR 0 = 1.',19,'#ffdf98')
text(30,342,'Петля: вправо → диагональ → вверх → диагональ → диагональ',23)
text(30,372,'5 клеток; 5 переходов за круг; 3 диагонали. Направления H → D → V → D → D → H.',17)
for j,row in enumerate(rows):
 ox=55+j*310;oy=423;size=42
 text(ox-10,410,f'{row["laps"]} круг · XOR',21)
 for i,(x,y) in enumerate(route):
  # Cartesian y points upward; square 0 is at the lower centre.
  px=ox+(x+1)*(size+1);py=oy+(2-y)*(size+1)
  cell(px,py,row['xor'][i],size)
  text(px+15,py+27,str(i),17,'#10151f' if row['xor'][i] else '#a4b0c1')
 text(ox-10,586,f'Белых: {sum(row["xor"])} из 5',19)
 text(ox-10,615,'OR: '+str(sum(row['or']))+' из 5',17,'#a9d9ff')
text(30,663,'Номера 0–4 показывают порядок обхода; после 4 — снова 0. Серые рамки обозначают места клеток.',17)
text(30,695,'Это пример механизма. Маршрут для исходного глифа ещё не найден.',19,'#ffbb71')
parts.append('</g></svg>');(HERE/'dashed-thread.svg').write_text(''.join(parts),encoding='utf-8')
print(json.dumps({'directions':directions,'xorLit':[sum(r['xor']) for r in rows],'orLit':[sum(r['or']) for r in rows],'checks':report['checks']}))
