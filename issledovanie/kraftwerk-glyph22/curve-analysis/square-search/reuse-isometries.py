"""Transfer exact witnesses between translated/rotated/reflected identical target rasters."""
import argparse
import json
from pathlib import Path

MATRICES=[(1,0,0,1),(-1,0,0,1),(1,0,0,-1),(-1,0,0,-1),(0,1,1,0),(0,-1,1,0),(0,1,-1,0),(0,-1,-1,0)]
def transform(point,m):
    x,y=point;a,b,c,d=m
    return a*x+b*y,c*x+d*y
def normal(points):
    mx=min(p[0] for p in points);my=min(p[1] for p in points)
    return tuple(sorted((x-mx,y-my) for x,y in points)),(mx,my)
def direction(a,b):
    dx,dy=b[0]-a[0],b[1]-a[1]
    return 'D' if dx and dy else 'H' if dx else 'V'
def validate(result):
    route=list(map(tuple,result['route']));target=set(map(tuple,result['target']))
    assert len(route)==2*len(target)-1 and len(set(route[::2]))==len(target) and set(route[::2])==target
    segments=[tuple(sorted((a,b))) for a,b in zip(route,route[1:])]
    assert len(set(segments))==len(segments)
    assert all(max(abs(a[0]-b[0]),abs(a[1]-b[1]))==1 for a,b in zip(route,route[1:]))
    classes=[direction(a,b) for a,b in zip(route,route[1:])]
    assert all({a,b}!={'H','V'} for a,b in zip(classes,classes[1:]))
    result['classes']=classes
def components(target):
    remaining=set(map(tuple,target));result=[]
    while remaining:
        todo=[min(remaining)];seen=set()
        while todo:
            a=todo.pop()
            if a in seen:continue
            seen.add(a)
            for b in remaining-seen:
                dx,dy=abs(a[0]-b[0]),abs(a[1]-b[1])
                if max(dx,dy)<=2 and (dx,dy)!=(1,1):todo.append(b)
        remaining-=seen;result.append(sorted(seen))
    return result
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--routes',type=Path,required=True);args=parser.parse_args()
    report=json.loads((args.routes/'batch.json').read_text(encoding='utf-8'));glyphs=[g for f in report['frames'] for g in f['glyphs']]
    lookup={}
    for g in glyphs:
        if g['status']!='found':continue
        for matrix in MATRICES:
            key,minimum=normal([transform(p,matrix) for p in g['target']]);lookup.setdefault(key,(g,matrix,minimum))
    transferred=[]
    for g in glyphs:
        if g['status']=='found':continue
        key,minimum=normal(g['target'])
        if key not in lookup:continue
        assert g['status']!='proven_disconnected'
        source,matrix,src_min=lookup[key];shift=(minimum[0]-src_min[0],minimum[1]-src_min[1])
        route=[list(transform(p,matrix)) for p in source['route']]
        for p in route:p[0]+=shift[0];p[1]+=shift[1]
        g.update(status='found',route=route,paintCount=len(g['target']),moves=len(route)-1,zeroVisits=(len(route)-1)//2,
          blankVisitsOnTarget=sum(tuple(p) in set(map(tuple,g['target'])) for p in route[1::2]),
          noRepeatedPaintCell=True,noRepeatedGeometricSegment=True,
          transferredFrom={'frame':source['frame'],'slot':source['slot'],'matrix':matrix,'translation':shift},
          priorSearch={'status':'time_limit','calls':g.get('calls'),'seconds':g.get('seconds')})
        g.pop('reason',None)
        transferred.append([g['frame'],g['slot'],source['frame'],source['slot']])
    for g in glyphs:
        if g['status']=='found':validate(g)
        if g['status']=='proven_disconnected':
            g['paintComponents']=components(g['target']);assert len(g['paintComponents'])>1
        (args.routes/f'frame-{g["frame"]:02d}-glyph-{g["slot"]}.json').write_text(json.dumps(g,ensure_ascii=False,indent=2),encoding='utf-8')
    statuses=[g['status'] for g in glyphs];report['counts']={s:statuses.count(s) for s in sorted(set(statuses))}
    report['isometryTransfers']=transferred;report['allFoundRoutesRevalidated']=True
    (args.routes/'batch.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'counts':report['counts'],'transferred':transferred}))
if __name__=='__main__':main()
