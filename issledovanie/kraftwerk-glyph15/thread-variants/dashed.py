"""Reuse exact square-thread witnesses, then search the remaining stable glyphs.

The target is the existing half-cell raster convention: graph endpoints at 2x
coordinates plus every edge midpoint. This is not an extraction of video pixels.
Run: python dashed.py --seconds 4 [--retry 12]
"""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import sys
from collections import Counter

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent
STUDY = ROOT.parent
OLD = STUDY.parent / 'kraftwerk-glyph22' / 'curve-analysis'

def load_module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

solver = load_module('square_solver', OLD/'square-search/find-routes.py')
checker = load_module('square_checker', OLD/'square-thread-check.py')
MATRICES = [(1,0,0,1),(-1,0,0,1),(1,0,0,-1),(-1,0,0,-1),
            (0,1,1,0),(0,-1,1,0),(0,1,-1,0),(0,-1,-1,0)]

def transform(p, m):
    x,y=p; a,b,c,d=m
    return a*x+b*y,c*x+d*y

def normal(points):
    mx=min(p[0] for p in points);my=min(p[1] for p in points)
    return tuple(sorted((x-mx,y-my) for x,y in points)),(mx,my)

def convert(g):
    vertices=set();edges=[]
    for key in g['edges']:
        x,y=map(int,key[1:].split(','));a=(x,y)
        b=(x+(key[0]=='H'), y+(key[0]=='V'))
        vertices.update((a,b))
        edges.append({'from':f'{a[0]},{a[1]}','to':f'{b[0]},{b[1]}'})
    return {'nodes':[{'id':f'{x},{y}','x':x,'y':y} for x,y in sorted(vertices)],'edges':edges}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--seconds',type=float,default=4)
    parser.add_argument('--retry',type=float,default=0)
    args=parser.parse_args()
    source=json.loads((STUDY/'analysis.json').read_text(encoding='utf-8'))
    oldfile=OLD/'square-search/routes/batch.json'
    old=json.loads(oldfile.read_text(encoding='utf-8'))
    lookup={}
    def register(row, provenance):
        if row['status']!='found':return
        for m in MATRICES:
            key,minimum=normal([transform(p,m) for p in row['target']])
            lookup.setdefault(key,(row,m,minimum,provenance))
    for f in old['frames']:
        for slot,row in enumerate(f['glyphs'],1):
            register(row,{'study':'glyph22','frame':f['index'],'slot':slot})
    prior={}
    if (ROOT/'dashed.json').exists():
        prior={r['id']:r for r in json.loads((ROOT/'dashed.json').read_text(encoding='utf-8'))['graphs']}
        for row in prior.values():
            if row['status']=='found': register(row,{'study':'glyph15','id':row['id']})
    rows=[]
    for g in source['graphs']:
        if not g['stable']:continue
        graph=convert(g);target=solver.raster(graph)
        key,minimum=normal(target)
        if g['id'] in prior and prior[g['id']]['status'] in ('found','proven_disconnected'):
            row=prior[g['id']]
        elif key in lookup:
            oldrow,m,oldmin,provenance=lookup[key]
            shift=(minimum[0]-oldmin[0],minimum[1]-oldmin[1])
            route=[list(transform(p,m)) for p in oldrow['route']]
            for p in route:p[0]+=shift[0];p[1]+=shift[1]
            row={'status':'found','target':target,'targetCount':len(target),'route':route,
                 'transferredFrom':{**provenance,'matrix':m,'translation':shift}}
        else:
            seconds=args.retry if g['id'] in prior and args.retry else args.seconds
            row=solver.solve(graph,seconds=seconds,seed=108+g['id']+(1000 if args.retry else 0))
        row['id']=g['id']
        if row['status']=='found':
            row['independentCheck']=checker.validate(row['route'],target)
            register(row,{'study':'glyph15','id':g['id']})
        else:
            components=checker.white_components(target)
            row['reachabilityComponents']=[list(c) for c in components]
            if len(components)>1:row['status']='proven_disconnected'
        rows.append(row)
        print(f"G{g['id']}: {row['status']} ({len(target)} cells)",flush=True)
    report={'sourceSha256':hashlib.sha256((STUDY/'analysis.json').read_bytes()).hexdigest(),
            'oldRoutesSha256':hashlib.sha256(oldfile.read_bytes()).hexdigest(),
            'model':{'cellPitch':'one half of the reconstructed edge lattice',
                     'paint':'even route positions paint one filled square exactly once',
                     'blank':'odd route positions paint nothing and erase nothing; may revisit a target cell',
                     'steps':'8 neighbours, each transition toggles 1/0, no direct H/V or V/H change',
                     'repetitions':'no repeated painted cell or geometric segment; point crossings allowed',
                     'scope':'a separate constructive raster model, not the source artist algorithm or pixel-perfect video width'},
            'counts':dict(Counter(r['status'] for r in rows)),
            'episodes':[{'id':e['id'],'glyphIds':e['glyphIds']} for e in source['episodes']],
            'graphs':rows}
    (ROOT/'dashed.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report['counts']),flush=True)

if __name__=='__main__':main()
