"""Independent validation of multiplicity witnesses and alternating-square routes."""
from pathlib import Path
from collections import Counter, defaultdict
import hashlib
import json

ROOT=Path(__file__).resolve().parent
source=json.loads((ROOT.parent/'analysis.json').read_text(encoding='utf-8'))
thickness=json.loads((ROOT/'thickness.json').read_text(encoding='utf-8'))
dashed=json.loads((ROOT/'dashed.json').read_text(encoding='utf-8'))
graphs={g['id']:g for g in source['graphs'] if g['stable']}

def ends(e):
    x,y=map(int,e[1:].split(','))
    return (x,y),(x+(e[0]=='H'),y+(e[0]=='V'))

def components(vertices, edges):
    adj={v:set() for v in vertices}
    for e in edges:
        a,b=ends(e);adj[a].add(b);adj[b].add(a)
    unseen=set(adj);parts=[]
    while unseen:
        first=unseen.pop();todo=[first];part={first}
        while todo:
            for v in adj[todo.pop()] & unseen:
                unseen.remove(v);part.add(v);todo.append(v)
        parts.append(part)
    return parts

counts=Counter();unique=defaultdict(dict)
for case in thickness['cases']:
    g=graphs[case['graphId']];edges=set(g['edges'])
    edge_rows={e['edge']:e for e in case['edges']}
    assert set(edge_rows)==edges
    degrees=Counter(v for e in edges for v in ends(e))
    original_parts=components(degrees, edges)
    odd={v for v,n in degrees.items() if n%2}
    for variant, permitted in [('A','thick'),('B','thin')]:
        result=case['variants'][variant]
        allowed={e for e,r in edge_rows.items() if r['class']==permitted}
        assert allowed==set(result['allowedEdges'])
        permitted_parts=components(degrees,allowed)
        odd_components=sum(len(p & odd)%2 for p in permitted_parts)
        possible=len(original_parts)==1 and odd_components<=2
        assert possible==result['possible']
        counts[variant+'_possible']+=possible
        unique[variant].setdefault(g['id'],set()).add(possible)
        if not possible:
            counts['impossibilityCertificates']+=1
            continue
        route=result['route'];vertices=list(map(tuple,route['vertices']))
        traversals=route['edges']
        assert len(vertices)==len(traversals)+1
        for a,b,e in zip(vertices,vertices[1:],traversals):
            assert set((a,b))==set(ends(e))
        multiplicities=Counter(traversals)
        assert set(multiplicities)==edges
        assert all(n in (1,2) for n in multiplicities.values())
        duplicated={e for e,n in multiplicities.items() if n==2}
        assert duplicated<=allowed and duplicated==set(result['doubledEdges'])
        counts['solidRoutes']+=1

dash_rows=[]
for r in dashed['graphs']:
    g=graphs[r['id']]
    target=set()
    for e in g['edges']:
        a,b=ends(e)
        target.update(((2*a[0],2*a[1]),(a[0]+b[0],a[1]+b[1]),(2*b[0],2*b[1])))
    assert target==set(map(tuple,r['target']))
    if r['status']!='found':
        dash_rows.append({'id':r['id'],'status':r['status']})
        continue
    route=list(map(tuple,r['route']));paint=route[::2]
    assert len(route)==2*len(target)-1
    assert set(paint)==target and len(set(paint))==len(paint)
    segments=[];kinds=[]
    for a,b in zip(route,route[1:]):
        dx,dy=b[0]-a[0],b[1]-a[1]
        assert max(abs(dx),abs(dy))==1
        segments.append(tuple(sorted((a,b))))
        kinds.append('D' if dx and dy else 'H' if dx else 'V')
    assert len(segments)==len(set(segments))
    assert all({a,b}!={'H','V'} for a,b in zip(kinds,kinds[1:]))
    dash_rows.append({'id':r['id'],'status':'found','paintedSquares':len(target),
                     'blankVisits':len(route)//2,'moves':len(route)-1,
                     'blankVisitsOnTarget':sum(p in target for p in route[1::2]),
                     'repeatedPaintedSquares':0,'repeatedSegments':0})

assert len(graphs)==len(dashed['graphs'])==45
assert len(thickness['cases'])==60 and counts['solidRoutes']==70
report={'passed':True,'solid':dict(counts),
        'uniqueGeometryPossible':{v:sum(True in outcomes for outcomes in items.values()) for v,items in unique.items()},
        'dashed':dict(Counter(r['status'] for r in dash_rows)),'dashedGraphs':dash_rows,
        'inputSha256':{name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in ('thickness.json','dashed.json')},
        'scope':'Route and impossibility checks independent of solver implementations; the image measurement has its separate sensitivity report.'}
(ROOT/'independent-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k not in ('dashedGraphs','inputSha256')}))
