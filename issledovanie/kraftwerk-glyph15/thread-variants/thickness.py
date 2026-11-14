"""Measure screenshot stroke widths and test restricted edge doubling exactly.
No topology-derived width labels. Width masks are conditional pixel thresholds.
Run from any directory: python thickness.py (numpy and Pillow required).
"""
from pathlib import Path
import json, hashlib
from collections import defaultdict, Counter
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parent
BASE=ROOT.parent

def ends(k):
    o=k[0];x,y=map(int,k[1:].split(','));return (x,y),(x+(o=='H'),y+(o=='V'))

def width(profile):
    p=np.asarray(profile);i=int(np.argmax(p));peak=float(p[i]);half=peak/2
    if peak<.2:return None
    l=i;r=i
    while l>0 and p[l-1]>=half:l-=1
    while r<len(p)-1 and p[r+1]>=half:r+=1
    if l==0 or r==len(p)-1:return None
    left=l-(p[l]-half)/(p[l]-p[l-1]);right=r+(p[r]-half)/(p[r]-p[r+1])
    return float(right-left)

def measure(lum,g,key,bg):
    o,x,y=key[0],*map(int,key[1:].split(','));along=np.linspace(.3,.7,11);off=np.arange(-10,11)
    if o=='H':
        xs=np.rint(g['x'][x]+along*(g['x'][x+1]-g['x'][x])).astype(int);ys=round(g['y'][y])+off
        profiles=1-lum[ys[None,:],xs[:,None]]/bg
    else:
        ys=np.rint(g['y'][y]+along*(g['y'][y+1]-g['y'][y])).astype(int);xs=round(g['x'][x])+off
        profiles=1-lum[ys[:,None],xs[None,:]]/bg
    values=[width(p) for p in profiles];values=[v for v in values if v is not None]
    return dict(fwhm=float(np.median(values)),crossSectionMin=float(min(values)),crossSectionMax=float(max(values)),profile=np.round(np.median(profiles,axis=0),4).tolist())

def measure_all(a):
    cases=[]
    for ep in a['episodes']:
        indices=[i for i in range(ep['startIndex'],ep['endIndex']+1) if a['frames'][i]['confident'] and a['frames'][i]['glyphIds']==ep['glyphIds']]
        chosen=sorted({indices[round((len(indices)-1)*q)] for q in [.25,.5,.75]})
        images=[]
        for i in chosen:
            f=a['frames'][i];im=np.asarray(Image.open(BASE/'captures'/f['file']).convert('RGB'),dtype=float);images.append((f,im[:,:,:2].mean(2)))
        for si,gid in enumerate(ep['glyphIds']):
            keys=a['graphs'][gid-1]['edges'];out=[]
            for k in keys:
                mm=[measure(lum,a['grid']['slots'][si],k,f['background']) for f,lum in images]
                ww=[m['fwhm'] for m in mm]
                out.append(dict(edge=k,orientation=k[0],width=round(float(np.median(ww)),4),frameMin=round(min(ww),4),frameMax=round(max(ww),4),crossSectionMin=round(min(m['crossSectionMin'] for m in mm),4),crossSectionMax=round(max(m['crossSectionMax'] for m in mm),4),profile=mm[len(mm)//2]['profile']))
            cases.append(dict(state=ep['id'],slot=si+1,graphId=gid,start=ep['start'],end=ep['end'],samples=[f['file'] for f,lum in images],edges=out))
    return cases

def distribution(values):
    v=np.array(values);centers=np.quantile(v,[.25,.75])
    for _ in range(30):
        group=np.argmin(abs(v[:,None]-centers),axis=1);new=np.array([v[group==j].mean() for j in range(2)])
        if np.max(abs(new-centers))<1e-7:break
        centers=new
    cs=[v[group==j] for j in range(2)];q=[float(n) for n in np.quantile(v,[0,.05,.25,.5,.75,.95,1])]
    counts,bins=np.histogram(v,bins=np.arange(1.5,12.51,.25))
    return dict(count=len(values),quantiles=dict(zip(['min','p05','p25','median','p75','p95','max'],q)),histogram=[dict(fromPx=round(float(bins[i]),2),toPx=round(float(bins[i+1]),2),count=int(n)) for i,n in enumerate(counts)],twoMeans=[dict(center=float(c),count=len(w),minimum=float(min(w)),maximum=float(max(w)),sd=float(np.std(w))) for c,w in zip(centers,cs)],twoMeansThreshold=float(np.mean(centers)),warning='K-means always produces two clusters even on a continuous distribution; this is not proof of two physical stroke widths.')

def adjacency(keys,vertices=None):
    adj={v:[] for v in (vertices or [])}
    for k in keys:
        u,v=ends(k);adj.setdefault(u,[]).append((v,k));adj.setdefault(v,[]).append((u,k))
    return adj

def components(adj):
    seen=set();out=[]
    for v in sorted(adj):
        if v in seen:continue
        todo=[v];seen.add(v);part=[]
        while todo:
            u=todo.pop();part.append(u)
            for w,k in adj[u]:
                if w not in seen:seen.add(w);todo.append(w)
        out.append(sorted(part))
    return out

def odd_vertices(keys):
    return {v for v,es in adjacency(keys).items() if len(es)%2}

def euler_route(keys,doubles):
    copies=[]
    for k in sorted(keys):
        copies.extend([k]*(2 if k in doubles else 1))
    adj=defaultdict(list)
    for i,k in enumerate(copies):
        u,v=ends(k);adj[u].append((v,i));adj[v].append((u,i))
    odd=sorted(v for v,es in adj.items() if len(es)%2);start=odd[0] if odd else min(adj)
    used=set();stack=[(start,None)];path=[]
    while stack:
        v,_=stack[-1]
        while adj[v] and adj[v][-1][1] in used:adj[v].pop()
        if adj[v]:
            u,i=adj[v].pop();used.add(i);stack.append((u,i))
        else:path.append(stack.pop())
    path.reverse();return dict(vertices=[list(v) for v,i in path],edges=[copies[i] for v,i in path[1:]],closed=path[0][0]==path[-1][0])

def solve(keys,allowed):
    keys=set(keys);allowed=set(allowed);full=adjacency(keys);parts=components(full);odd=odd_vertices(keys);adj=adjacency(allowed,full);parts_allowed=components(adj)
    oddparts=[part for part in parts_allowed if len(set(part)&odd)%2]
    result=dict(allowedEdges=sorted(allowed),originalOddVertices=[list(v) for v in sorted(odd)],originalComponents=len(parts),oddAllowedComponentCount=len(oddparts),oddAllowedComponents=[dict(vertices=[list(v) for v in p],originalOddVertices=[list(v) for v in sorted(set(p)&odd)]) for p in oddparts])
    if len(parts)!=1:return dict(**result,possible=False,reason='disconnected-original-graph',doubledEdges=[],route=None)
    if len(oddparts)>2:return dict(**result,possible=False,reason='more-than-two-odd-allowed-components',doubledEdges=[],route=None)
    if len(odd)<=2:doubles=set()
    else:
        final_odd={min(set(p)&odd) for p in oddparts};target=odd^final_odd;doubles=set()
        # Spanning-forest parity elimination constructs a T-join using each
        # permitted edge at most once. It deliberately does not minimize length.
        for part in parts_allowed:
            root=part[0];parent={root:None};order=[root]
            for v in order:
                for w,k in adj[v]:
                    if w not in parent:parent[w]=(v,k);order.append(w)
            pending={v:v in target for v in part}
            for v in reversed(order[1:]):
                p,k=parent[v]
                if pending[v]:doubles.add(k);pending[p]=not pending[p]
            assert not pending[root]
    route=euler_route(keys,doubles)
    return dict(**result,possible=True,reason='constructed-exact-parity-solution',doubledEdges=sorted(doubles),route=route)

def verify_route(keys,allowed,result):
    if not result['possible']:return None
    route=result['route'];vs=[tuple(v) for v in route['vertices']];es=route['edges'];expected=Counter({k:2 if k in result['doubledEdges'] else 1 for k in keys})
    ok=len(vs)==len(es)+1 and Counter(es)==expected and set(result['doubledEdges'])<=set(allowed)
    ok=ok and all(set(ends(k))=={u,v} for k,u,v in zip(es,vs,vs[1:]))
    return bool(ok)

def strict_control(keys,doubled):
    parts=components(adjacency(keys));odd=odd_vertices(list(keys)+list(doubled));possible=len(parts)==1 and len(odd)<=2
    return dict(possible=possible,originalComponents=len(parts),oddVertices=[list(v) for v in sorted(odd)],oddCount=len(odd),doubledEdges=sorted(doubled),reason='fixed-multiplicities-eulerian' if possible else 'disconnected-original-graph' if len(parts)>1 else 'more-than-two-odd-vertices',route=euler_route(keys,set(doubled)) if possible else None)

def draw_width_change(data):
    cs=[c for c in data['cases'] if c['graphId']==19];out=Image.new('RGB',(800,480),'#faf8ef');dr=ImageDraw.Draw(out);font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',20);small=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',15)
    dr.text((15,12),'Same centerline graph G19; left outer arm edge V0,5 changes width',font=font,fill='#222')
    for j,c in enumerate(cs):
        file=c['samples'][1];im=Image.open(BASE/'captures'/file).convert('RGB');crop=im.crop((64,329,121,386)).resize((342,342),Image.Resampling.NEAREST);x=20+j*395
        out.paste(crop,(x,70));e=next(e for e in c['edges'] if e['edge']=='V0,5')
        dr.text((x,43),f"S{c['state']:02d} / {file}",font=small,fill='#222');dr.text((x,420),f"FWHM {e['width']:.3f} px: {e['class']}",font=font,fill='#222');dr.text((x,448),'Nearest-neighbor 6x; source pixels retained',font=small,fill='#444')
    out.save(ROOT/'source-thickness-change.png')

def exhaustive_check():
    # Independent enumeration: every present/absent/allowed labelling on the
    # seven edges of a 2 by 1 rectangle; brute force every doubling subset.
    universe=['H0,0','H1,0','H0,1','H1,1','V0,0','V1,0','V2,0'];tested=0
    for code in range(1,3**len(universe)):
        n=code;keys=[];allowed=[]
        for k in universe:
            d=n%3;n//=3
            if d:keys.append(k)
            if d==2:allowed.append(k)
        connected=len(components(adjacency(keys)))==1;brute=False
        if connected:
            for mask in range(1<<len(allowed)):
                mult=keys+[k for i,k in enumerate(allowed) if mask&(1<<i)]
                if len(odd_vertices(mult))<=2:brute=True;break
        answer=solve(keys,allowed)
        assert answer['possible']==brute,(keys,allowed,answer)
        if brute:assert verify_route(keys,allowed,answer)
        tested+=1
    return tested

def draw_atlas(data):
    W=1060;RH=205;H=130+15*RH;im=Image.new('RGB',(W,H),'#faf8ef');dr=ImageDraw.Draw(im);font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',13);small=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',11)
    svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><rect width="100%" height="100%" fill="#faf8ef"/>']
    def text(x,y,t,size=13,color='#222'):
        dr.text((x,y),t,font=font if size==13 else small,fill=color);svg.append(f'<text x="{x}" y="{y+size}" font-family="Arial,sans-serif" font-size="{size}" fill="{color}">{t}</text>')
    text(15,12,'Measured thin / thick edges and conditional one-thread solutions')
    text(15,34,'A: only thick may repeat. B: only thin may repeat. Orange = selected doubled edge.')
    text(15,56,'Blue = thin; black = thick. Red border = no permitted one-thread solution.')
    text(15,78,'Thickness is a raster measurement, not proof of actual drawing multiplicity.')
    for c in data['cases']:
        basey=130+(c['state']-1)*RH;basex=10+(c['slot']-1)*262
        text(basex,basey,f"S{c['state']:02d} / glyph {c['slot']} / {c['start']:.2f}-{c['end']:.2f}s",11)
        for mi,mode in enumerate(['A','B']):
            r=c['variants'][mode];ox=basex+17+mi*125;oy=basey+38;step=9
            if not r['possible']:
                dr.rectangle((ox-7,oy-7,ox+79,oy+115),outline='#b62e35',width=1);svg.append(f'<rect x="{ox-7}" y="{oy-7}" width="86" height="122" fill="none" stroke="#b62e35" stroke-dasharray="4 3"/>')
            for e in c['edges']:
                k=e['edge'];u,v=ends(k);coords=(ox+u[0]*step,oy+u[1]*step,ox+v[0]*step,oy+v[1]*step);color='#dc6515' if k in r['doubledEdges'] else '#2466aa' if e['class']=='thin' else '#151914';w=1.2 if e['class']=='thin' else 2.8
                dr.line(coords,fill=color,width=1 if e['class']=='thin' else 3);svg.append(f'<path d="M{coords[0]} {coords[1]}L{coords[2]} {coords[3]}" stroke="{color}" stroke-width="{w}" stroke-linecap="round"/>')
            label=f"{mode}: {'YES' if r['possible'] else 'NO'}; double {len(r['doubledEdges'])}"
            text(ox-10,oy+122,label,11,'#155b35' if r['possible'] else '#b62e35')
            if r['possible']:text(ox-10,oy+137,'closed' if r['route']['closed'] else 'open',11)
            else:text(ox-10,oy+137,'disconnected' if r['originalComponents']>1 else f"odd groups: {r['oddAllowedComponentCount']}",11)
    svg.append('</svg>');(ROOT/'thickness-atlas.svg').write_text(''.join(svg),encoding='utf8');im.save(ROOT/'thickness-atlas.png')

def main():
    a=json.loads((BASE/'analysis.json').read_text(encoding='utf8'));cases=measure_all(a)
    stats={o:distribution([e['width'] for c in cases for e in c['edges'] if o=='all' or e['orientation']==o]) for o in ['all','H','V']}
    data=dict(schemaVersion=1,method=dict(width='FWHM of normalized R/G darkness across perpendicular 21-pixel profiles; median of 11 central cross sections (30-70% edge length), then median across three confident screenshots.',meaning='Observed raster width, not traversal multiplicity. No classification is fitted to Euler success.'),distributions=stats,cases=cases)
    threshold=4.7;all_edges=[e for c in cases for e in c['edges']];thin=[e for e in all_edges if e['width']<threshold];thick=[e for e in all_edges if e['width']>=threshold]
    data['classification']=dict(thresholdPx=threshold,thinCount=len(thin),thickCount=len(thick),medianGap=[max(e['width'] for e in thin),min(e['width'] for e in thick)],allSampleMediansGap=[max(e['frameMax'] for e in thin),min(e['frameMin'] for e in thick)],allCrossSectionsGap=[max(e['crossSectionMax'] for e in thin),min(e['crossSectionMin'] for e in thick)],interpretation='Two well-separated raster width groups are observed in both orientations, with a small tail of extra-wide strokes. Thickness alone does not establish repeat count or authoring intent.')
    for c in cases:
        for e in c['edges']:e['class']='thin' if e['width']<threshold else 'thick'
        keys=[e['edge'] for e in c['edges']]
        c['variants']={mode:solve(keys,[e['edge'] for e in c['edges'] if e['class']==cl]) for mode,cl in [('A','thick'),('B','thin')]}
        c['strictVariants']={mode:strict_control(keys,[e['edge'] for e in c['edges'] if e['class']==cl]) for mode,cl in [('A','thick'),('B','thin')]}
    data['solver']=dict(criterion='The original graph must be connected. In the graph of permitted doubling edges, including isolated original vertices, count components containing an odd number of original odd-degree vertices. A trail exists iff this count is 0 or 2.',construction='Spanning-forest T-join; each permitted edge is doubled at most once. Hierholzer traversal of the resulting multigraph. No shortest-route claim.',variants=dict(A='Every original edge traversed once; only measured thick edges may receive a second traversal.',B='Every original edge traversed once; only measured thin edges may receive a second traversal.'))
    data['summary']={mode:dict(possible=sum(c['variants'][mode]['possible'] for c in cases),impossible=sum(not c['variants'][mode]['possible'] for c in cases),disconnected=sum(c['variants'][mode]['originalComponents']>1 for c in cases),parityObstruction=sum(c['variants'][mode]['originalComponents']==1 and not c['variants'][mode]['possible'] for c in cases),closedRoutes=sum(c['variants'][mode]['possible'] and c['variants'][mode]['route']['closed'] for c in cases),addedPossibleOverNoRepeats=sum(c['variants'][mode]['possible'] and len(c['variants'][mode]['originalOddVertices'])>2 for c in cases)) for mode in ['A','B']}
    data['strictSummary']={mode:dict(possible=sum(c['strictVariants'][mode]['possible'] for c in cases),impossible=sum(not c['strictVariants'][mode]['possible'] for c in cases),disconnected=sum(c['strictVariants'][mode]['originalComponents']>1 for c in cases),oddCountHistogram=dict(sorted(Counter(c['strictVariants'][mode]['oddCount'] for c in cases).items()))) for mode in ['A','B']}
    data['strictMeaning']=dict(A='Every thick edge exactly twice, every thin edge exactly once; control, not the optional-repeat request.',B='Every thin edge exactly twice, every thick edge exactly once; control, not the optional-repeat request.')
    grouped=defaultdict(list)
    for c in cases:grouped[c['graphId']].append(c)
    groups=[]
    for gid,cs in sorted(grouped.items()):
        masks={tuple(e['edge'] for e in c['edges'] if e['class']=='thin') for c in cs};classes=defaultdict(set)
        for c in cs:
            for e in c['edges']:classes[e['edge']].add(e['class'])
        changed=sorted(k for k,v in classes.items() if len(v)>1)
        groups.append(dict(graphId=gid,caseRefs=[dict(state=c['state'],slot=c['slot']) for c in cs],distinctWidthMasks=len(masks),classChangingEdges=changed,widthChanges=[dict(edge=k,observations=[dict(state=c['state'],slot=c['slot'],width=next(e['width'] for e in c['edges'] if e['edge']==k),widthClass=next(e['class'] for e in c['edges'] if e['edge']==k)) for c in cs]) for k in changed],variants={m:dict(possibleAny=any(c['variants'][m]['possible'] for c in cs),possibleAll=all(c['variants'][m]['possible'] for c in cs)) for m in ['A','B']}))
    data['graphGroups']=groups
    data['uniqueGeometrySummary']=dict(count=len(groups),varyingWidthMasks=sum(g['distinctWidthMasks']>1 for g in groups),distinctGeometryAndWidthMasks=sum(g['distinctWidthMasks'] for g in groups),variants={m:dict(possibleAny=sum(g['variants'][m]['possibleAny'] for g in groups),possibleAll=sum(g['variants'][m]['possibleAll'] for g in groups),impossibleAll=sum(not g['variants'][m]['possibleAny'] for g in groups)) for m in ['A','B']})
    sweep=[]
    for t in np.arange(3.25,6.501,.25):
        row=dict(threshold=round(float(t),2),thinEdges=int(sum(e['width']<t for e in all_edges)))
        for mode,thick_allowed in [('A',True),('B',False)]:row[mode]=sum(solve([e['edge'] for e in c['edges']],[e['edge'] for e in c['edges'] if (e['width']>=t)==thick_allowed])['possible'] for c in cases)
        sweep.append(row)
    data['thresholdSensitivity']=sweep
    (ROOT/'thickness.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf8')
    draw_atlas(data);draw_width_change(data)
    check=dict(sourceAnalysisSha256=hashlib.sha256((BASE/'analysis.json').read_bytes()).hexdigest(),cases=len(cases),edgeOccurrences=len(all_edges),sampleCount=len({f for c in cases for f in c['samples']}),constructedRoutes=sum(c['variants'][m]['possible'] for c in cases for m in ['A','B']),allConstructedRoutesVerified=all(verify_route([e['edge'] for e in c['edges']],c['variants'][m]['allowedEdges'],c['variants'][m]) for c in cases for m in ['A','B'] if c['variants'][m]['possible']),exhaustiveSmallGraphCases=exhaustive_check(),allCrossSectionsAgreeOnWidthClass=all(not(e['crossSectionMin']<threshold<e['crossSectionMax']) for e in all_edges),allSampleMediansAgreeOnWidthClass=all(not(e['frameMin']<threshold<e['frameMax']) for e in all_edges),classification=data['classification'],summary=data['summary'])
    check['uniqueGeometrySummary']=data['uniqueGeometrySummary']
    check['geometryWithChangingWidthMask']=[g for g in groups if g['distinctWidthMasks']>1]
    check['strictSummary']=data['strictSummary']
    check['strictRoutesVerified']=all(verify_route([e['edge'] for e in c['edges']],c['strictVariants'][m]['doubledEdges'],c['strictVariants'][m]) for c in cases for m in ['A','B'] if c['strictVariants'][m]['possible'])
    (ROOT/'thickness-check.json').write_text(json.dumps(check,ensure_ascii=False,indent=2),encoding='utf8');print(json.dumps(check,ensure_ascii=False,indent=2));print('SWEEP',sweep)

if __name__=='__main__':main()
