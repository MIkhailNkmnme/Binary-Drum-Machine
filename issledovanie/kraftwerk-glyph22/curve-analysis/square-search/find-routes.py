"""Find strictly alternating filled-cell paths; standard Python only.

Usage: python find-routes.py --source graphs.json --out-dir routes --seconds 2
Source may be a {frames:[{glyphs:[graph,...]},...]} file or {graph: graph}.
Only active edge endpoints become target cells; isolated placeholders are ignored.
"""
import argparse
import json
import random
import time
from pathlib import Path

DIRECTIONS=[(dx,dy) for dx in (-1,0,1) for dy in (-1,0,1) if dx or dy]

def direction(a,b):
    dx,dy=b[0]-a[0],b[1]-a[1]
    return 'D' if dx and dy else 'H' if dx else 'V'

def compatible(a,b):
    return {a,b}!={'H','V'}

def segment(a,b):
    return tuple(sorted((a,b)))

def raster(graph):
    coords={str(n['id']):(n['x'],n['y']) for n in graph['nodes']}
    result=set()
    for edge in graph['edges']:
        a,b=coords[str(edge['from'])],coords[str(edge['to'])]
        assert abs(a[0]-b[0])+abs(a[1]-b[1])==1
        result.update(((2*a[0],2*a[1]),(a[0]+b[0],a[1]+b[1]),(2*b[0],2*b[1])))
    return sorted(result)

def solve(graph,seconds=2,seed=106):
    started=time.monotonic();deadline=started+seconds
    target=raster(graph);target_set=set(target);n=len(target)
    if n==0:return {'status':'empty','targetCount':0}
    adj=[[] for _ in target]
    for i,(x,y) in enumerate(target):
        for j,(u,v) in enumerate(target):
            dx,dy=abs(u-x),abs(v-y)
            if i!=j and max(dx,dy)<=2 and (dx,dy)!=(1,1):adj[i].append(j)
    masks=[sum(1<<v for v in neighbours) for neighbours in adj]
    full=(1<<n)-1
    def component(seed_bit,R):
        todo=seed_bit;seen=0
        while todo:
            bit=todo&-todo;todo-=bit;seen|=bit
            todo|=masks[bit.bit_length()-1]&R&~seen
        return seen
    components=[];remaining=full
    while remaining:
        part=component(remaining&-remaining,remaining)
        components.append(part.bit_count());remaining&=~part
    base={'target':target,'targetCount':n,'paintGraphEdges':sum(map(len,adj))//2,'paintGraphComponents':components,'componentCount':len(components),'seed':seed}
    if len(components)>1:
        return {**base,'status':'proven_disconnected','reason':'Necessary two-step reachability graph is disconnected; no exact target-only alternating walk can cover every component under this model. This does not exclude other resolutions or temporary non-target paint with later cancellation.'}
    rng=random.Random(seed);calls=0;connector_calls=0;solution=None
    def choose_connectors(paint_order):
        nonlocal connector_calls
        opts=[]
        for a,b in zip(paint_order,paint_order[1:]):
            available=[]
            for dx,dy in DIRECTIONS:
                z=(a[0]+dx,a[1]+dy)
                if z==b or max(abs(z[0]-b[0]),abs(z[1]-b[1]))!=1:continue
                c1,c2=direction(a,z),direction(z,b)
                if compatible(c1,c2):available.append((z,c1,c2))
            available.sort(key=lambda q:(q[0] in target_set,q[1]!='D'))
            opts.append(available)
        chosen=[];used=set()
        def assign(k,previous=None):
            nonlocal connector_calls
            connector_calls+=1
            if connector_calls%1000==0 and time.monotonic()>deadline:raise TimeoutError
            if k==len(opts):return True
            a,b=paint_order[k],paint_order[k+1]
            for z,c1,c2 in opts[k]:
                es=(segment(a,z),segment(z,b))
                if not compatible(previous,c1) or es[0] in used or es[1] in used:continue
                chosen.append(z);used.update(es)
                if assign(k+1,c2):return True
                chosen.pop();used.difference_update(es)
            return False
        if not assign(0):return None
        route=[]
        for a,z in zip(paint_order,chosen):route.extend((a,z))
        route.append(paint_order[-1])
        return route
    try:
        for attempt in range(1000):
            path=[];local_calls=0
            root=sorted(range(n),key=lambda i:len(adj[i])+rng.random()*4)[attempt%min(12,n)] if attempt<4 else rng.randrange(n)
            def dfs(u,R):
                nonlocal calls,local_calls,solution
                calls+=1;local_calls+=1
                if calls%1000==0 and time.monotonic()>deadline:raise TimeoutError
                if local_calls>1000:return False
                path.append(u)
                if not R:
                    route=choose_connectors([target[i] for i in path])
                    if route is not None:solution=route;return True
                    path.pop();return False
                if component(R&-R,R)!=R:path.pop();return False
                cur=1<<u;ones=0;bits=R
                while bits:
                    bit=bits&-bits;bits-=bit
                    deg=(masks[bit.bit_length()-1]&(R|cur)).bit_count()
                    if deg<=1:ones+=1
                    if deg==0 or ones>1:path.pop();return False
                choices=[];bits=masks[u]&R
                while bits:
                    bit=bits&-bits;bits-=bit;choices.append(bit.bit_length()-1)
                rng.shuffle(choices);choices.sort(key=lambda v:(masks[v]&R).bit_count())
                for v in choices:
                    if dfs(v,R^(1<<v)):return True
                path.pop();return False
            if dfs(root,full^(1<<root)):break
            if time.monotonic()>deadline:raise TimeoutError
    except TimeoutError:
        return {**base,'status':'time_limit','calls':calls,'connectorCalls':connector_calls,'seconds':time.monotonic()-started,'reason':'No witness found within the time limit; not a proof of impossibility.'}
    if solution is None:
        return {**base,'status':'search_limit','calls':calls,'connectorCalls':connector_calls,'seconds':time.monotonic()-started,'reason':'Restart budget exhausted; not a proof of impossibility.'}
    route=solution;paint=route[::2];blank=route[1::2]
    classes=[direction(a,b) for a,b in zip(route,route[1:])]
    segments=[segment(a,b) for a,b in zip(route,route[1:])]
    assert len(route)==2*n-1
    assert set(paint)==target_set and len(set(paint))==n
    assert len(set(segments))==len(segments)
    assert all(max(abs(a[0]-b[0]),abs(a[1]-b[1]))==1 for a,b in zip(route,route[1:]))
    assert all(compatible(a,b) for a,b in zip(classes,classes[1:]))
    return {**base,'status':'found','target':target,'route':route,'classes':classes,'paintCount':n,'moves':len(route)-1,'zeroVisits':len(blank),'blankVisitsOnTarget':sum(z in target_set for z in blank),'noRepeatedPaintCell':True,'noRepeatedGeometricSegment':True,'unitLengthOverlapCheck':'All segments are horizontal, vertical or diagonal neighbour edges; positive-length overlap would require identical unordered endpoints, which are excluded. Point crossings are permitted.','minimality':'With N distinct white cells and strict 1,0 alternation starting and ending at1, at least2N-2 transitions are necessary; this witness attains that bound.','calls':calls,'connectorCalls':connector_calls,'seconds':time.monotonic()-started}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,required=True);parser.add_argument('--out-dir',type=Path,required=True);parser.add_argument('--seconds',type=float,default=2)
    args=parser.parse_args();source=json.loads(args.source.read_text(encoding='utf-8'));args.out_dir.mkdir(parents=True,exist_ok=True)
    jobs=[]
    if 'frames' in source:
        for i,frame in enumerate(source['frames'],1):
            for slot,g in enumerate(frame['glyphs'],1):jobs.append((i,slot,g))
    else:jobs=[(4,1,source['graph'])]
    results=[]
    for i,slot,graph in jobs:
        result=solve(graph,args.seconds);result.update(frame=i,slot=slot)
        name=f'frame-{i:02d}-glyph-{slot}.json';(args.out_dir/name).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        results.append({k:result[k] for k in ('frame','slot','status','targetCount','moves','calls','seconds') if k in result}|{'file':name})
        print(f'{i:02d}/{slot}: {result["status"]}; {result["targetCount"]} cells'+(f'; {result["moves"]} moves' if 'moves' in result else ''),flush=True)
    summary={'sourceFile':args.source.name,'secondsPerVariant':args.seconds,'model':'Filled square cells at active nodes scaled2 and unit-edge midpoints. Paint even positions only; blanks do not erase. Eight-neighbour transitions; no direct H/V class change. No further bound on oriented turn angle. Every target cell painted once and every geometric segment used at most once.','results':results,'counts':{s:sum(r['status']==s for r in results) for s in sorted({r['status'] for r in results})}}
    (args.out_dir/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(summary['counts']),flush=True)

if __name__=='__main__':main()
