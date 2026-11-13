"""Independent checks of square-thread witnesses. No search code is imported."""
from pathlib import Path
from collections import Counter,defaultdict
import json,math
HERE=Path(__file__).resolve().parent
def target_from_edges(edges):
 out=set()
 for edge in edges:
  a=tuple(map(int,edge['from'].split(',')));b=tuple(map(int,edge['to'].split(',')))
  assert abs(a[0]-b[0])+abs(a[1]-b[1])==1
  out.update(((2*a[0],2*a[1]),(a[0]+b[0],a[1]+b[1]),(2*b[0],2*b[1])))
 return out
def validate(route,target):
 route=list(map(tuple,route));target=set(map(tuple,target));paint=route[::2]
 assert len(route)==2*len(target)-1
 assert set(paint)==target and len(paint)==len(set(paint))
 segments=[];kinds=[];directions=[];diag_mids=defaultdict(list)
 for i,(a,b) in enumerate(zip(route,route[1:])):
  dx,dy=b[0]-a[0],b[1]-a[1]
  assert max(abs(dx),abs(dy))==1
  segments.append(tuple(sorted((a,b))));directions.append((dx,dy))
  kinds.append('D' if dx and dy else 'H' if dx else 'V')
  if dx and dy:diag_mids[(a[0]+b[0],a[1]+b[1])].append(i+.5)
 assert len(segments)==len(set(segments))
 assert all({a,b}!={'H','V'} for a,b in zip(kinds,kinds[1:]))
 counts=Counter(paint);or_result={p for p,n in counts.items() if n>0};xor_result={p for p,n in counts.items() if n%2}
 assert or_result==xor_result==target
 visits=defaultdict(list)
 for i,p in enumerate(route):visits[(2*p[0],2*p[1])].append(i)
 for p,indices in diag_mids.items():
  if len(indices)>1:visits[p].extend(indices)
 meetings=[{'point':[p[0]/2,p[1]/2],'positions':indices} for p,indices in sorted(visits.items()) if len(indices)>1]
 angles=Counter()
 for a,b in zip(directions,directions[1:]):
  cosine=(a[0]*b[0]+a[1]*b[1])/math.sqrt((a[0]**2+a[1]**2)*(b[0]**2+b[1]**2))
  angle=round(math.degrees(math.acos(max(-1,min(1,cosine)))))
  angles[angle]+=1
 return {'paintedCells':len(target),'blankVisits':len(route)//2,'positions':len(route),'moves':len(route)-1,
  'blankVisitsOnTarget':sum(p in target for p in route[1::2]),'repeatedPaintCells':0,'repeatedSegments':0,'directHVTurns':0,
  'orEqualsTarget':True,'xorEqualsTarget':True,'geometricMeetingPoints':len(meetings),'meetingPoints':meetings,
  'turnAnglesDegrees':dict(sorted(angles.items())),
  'minimality':'With N different required white cells and strict alternating 1/0, an open route starting and ending on 1 needs at least 2N-1 positions. This witness attains the bound.'}
def white_components(target):
 """A necessary reachability graph, enumerated independently via all intermediate zero cells."""
 target=set(map(tuple,target));adj={p:set() for p in target}
 directions=[(x,y) for x in [-1,0,1] for y in [-1,0,1] if x or y]
 kind=lambda d:'D' if d[0] and d[1] else 'H' if d[0] else 'V'
 for p in target:
  for a in directions:
   for b in directions:
    if {kind(a),kind(b)}=={'H','V'}:continue
    q=(p[0]+a[0]+b[0],p[1]+a[1]+b[1])
    if q in target and q!=p:adj[p].add(q)
 left=set(target);components=[]
 while left:
  root=left.pop();front=[root];component={root}
  while front:
   for q in adj[front.pop()] & left:left.remove(q);component.add(q);front.append(q)
  components.append(sorted(component))
 return sorted(components,key=len,reverse=True)
if __name__=='__main__':
 data=json.loads((HERE/'square-thread-route.json').read_text(encoding='utf-8'))
 graph=json.loads((HERE/'boolean-thread.json').read_text(encoding='utf-8'))['graph']
 target=target_from_edges(graph['edges']);assert target==set(map(tuple,data['target']))
 checked=validate(data['route'],target)
 (HERE/'square-thread-check.json').write_text(json.dumps(checked,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps({k:v for k,v in checked.items() if k!='meetingPoints'}))
