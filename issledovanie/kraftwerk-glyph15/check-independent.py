"""Independent adjacency/degree check; does not import the extraction code."""
from pathlib import Path
from collections import defaultdict, Counter
import json
import hashlib

root=Path(__file__).resolve().parent
data=json.loads((root/'analysis.json').read_text(encoding='utf-8'))
source=json.loads((root/'captures/samples.json').read_text(encoding='utf-8'))
graphs={g['id']:g for g in data['graphs']}
counts=Counter()
rows=[]
for graph in graphs.values():
    edges=graph['edges'];assert len(edges)==len(set(edges))
    adj=defaultdict(set)
    for e in edges:
        x,y=map(int,e[1:].split(','));a=(x,y)
        if e[0]=='H':
            assert 0<=x<8 and 0<=y<=12
            b=(x+1,y)
        else:
            assert e[0]=='V' and 0<=x<=8 and 0<=y<12
            b=(x,y+1)
        adj[a].add(b);adj[b].add(a)
    components=[];unseen=set(adj)
    while unseen:
        stack=[unseen.pop()];part=set(stack)
        while stack:
            for b in adj[stack.pop()]:
                if b in unseen:
                    unseen.remove(b);part.add(b);stack.append(b)
        components.append(part)
    odd=sum(len(v)%2 for v in adj.values())
    can_walk=len(components)==1 and odd in (0,2)
    strokes=sum(max(1,sum(len(adj[v])%2 for v in c)//2) for c in components)
    expected=graph['topology']
    assert expected['edgeCount']==len(edges)
    assert expected['vertexCount']==len(adj)
    assert expected['components']==len(components)
    assert expected['oddCount']==odd
    assert expected['eulerTrail']==can_walk
    assert expected['eulerCircuit']==(can_walk and odd==0)
    assert expected['cycleRank']==len(edges)-len(adj)+len(components)
    squares=[]
    for y in range(12):
        for x in range(8):
            if {f'H{x},{y}',f'H{x},{y+1}',f'V{x},{y}',f'V{x+1},{y}'}<=set(edges):
                squares.append((x,y))
    assert len(squares)==len(expected['unitSquareCycles'])
    rows.append({'id':graph['id'],'stable':graph['stable'],'edges':len(edges),'components':len(components),'oddVertices':odd,'minimumStrokes':strokes,'oneStroke':can_walk,'squares':len(squares)})
    if graph['stable']:
        counts['stableGraphs']+=1
        counts['oneStroke']+=can_walk
        counts['disconnected']+=len(components)>1
for row in source['samples']:
    assert hashlib.sha256((root/'captures'/row['file']).read_bytes()).hexdigest()==row['sha256']
for transition in data['transitions']:
    a=data['episodes'][transition['fromState']-1]
    b=data['episodes'][transition['toState']-1]
    for slot,change in enumerate(transition['changes']):
        before=set(graphs[a['glyphIds'][slot]]['edges'])
        after=set(graphs[b['glyphIds'][slot]]['edges'])
        assert set(change['added'])==after-before
        assert set(change['removed'])==before-after
        assert change['xorCount']==len(before^after)
assert len(data['episodes'])==15 and counts['stableGraphs']==45
assert counts['oneStroke']==13 and counts['disconnected']==9
result={'passed':True,'sourceImageHashesChecked':len(source['samples']),'graphsChecked':len(rows),'transitionsChecked':len(data['transitions'])*4,'summary':dict(counts),'graphs':rows,'scope':'Independent graph topology and set differences. Image extraction confidence is reported separately in validation.json.'}
(root/'independent-check.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in result.items() if k!='graphs'}))
