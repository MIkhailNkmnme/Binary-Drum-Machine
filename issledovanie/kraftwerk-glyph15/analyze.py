"""Reproduce grid reconstruction from captured player images; no topology repair.

Run: python analyze.py. Python 3, numpy, Pillow. The input screenshot timestamps
are brackets, not exact native video PTS. All 212 potential edges per slot are
measured; confidence never depends on Euler parity or a desired contour.
"""
from pathlib import Path
import json, math, hashlib
from collections import Counter, defaultdict
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
EDGES = [('H',x,y) for y in range(13) for x in range(8)] + [('V',x,y) for y in range(12) for x in range(9)]
KEYS = [f'{o}{x},{y}' for o,x,y in EDGES]
INDEX = {k:i for i,k in enumerate(KEYS)}

def ends(k):
    o=k[0]; x,y=map(int,k[1:].split(','))
    return (x,y),(x+(o=='H'),y+(o=='V'))

def topology(keys):
    adj=defaultdict(list)
    for k in keys:
        a,b=ends(k); adj[a].append(b);adj[b].append(a)
    seen=set(); comps=[]
    for n in adj:
        if n in seen:continue
        stack=[n];component=[];seen.add(n)
        while stack:
            v=stack.pop();component.append(list(v))
            for w in adj[v]:
                if w not in seen:seen.add(w);stack.append(w)
        comps.append(component)
    odd=[list(n) for n,v in adj.items() if len(v)%2]
    cells=[];s=set(keys)
    for y in range(12):
        for x in range(8):
            if {f'H{x},{y}',f'H{x},{y+1}',f'V{x},{y}',f'V{x+1},{y}'}<=s:cells.append([x,y])
    return dict(edgeCount=len(keys),vertexCount=len(adj),components=len(comps),componentVertices=comps,oddVertices=odd,oddCount=len(odd),eulerTrail=len(comps)==1 and len(odd) in (0,2),eulerCircuit=len(comps)==1 and not odd,cycleRank=len(keys)-len(adj)+len(comps),unitSquareCycles=cells)

def calibrate(samples):
    chosen=[s for s in samples if 2<float(s['before'])<6][::10]
    if not chosen:chosen=samples[-5:]
    d=np.mean([1-np.asarray(Image.open(ROOT/'captures'/s['file']).convert('RGB'),dtype=float)[:,:,:2].mean(2)/255 for s in chosen],axis=0)
    xp=d[185:563,:].sum(0);yp=d[:,75:1251].sum(1)
    def fit(proj,guess,step,count):
        out=[]
        for j in range(count):
            q=guess+j*step;l=round(q)-3;r=round(q)+4
            p=proj[l:r];ii=int(np.argmax(p))+l
            # Intensity-weighted centroid within the central 3 px of a thick line.
            out.append(round(float(np.average(np.arange(ii-1,ii+2),weights=proj[ii-1:ii+2]+1e-9)),3))
        return out
    return [dict(x=fit(xp,g,30.7,9),y=fit(yp,189.5,30.65,13)) for g in [79.5,386.5,694.0,1001.5]]

def sampling(grid):
    # Central half of each edge avoids junctions; transverse 7 px tolerates
    # resampling displacement. Median over length prevents isolated dark pixels.
    xx=[];yy=[]
    for g in grid:
        gx=[];gy=[]
        for o,x,y in EDGES:
            if o=='H':
                xs=np.linspace(.25*g['x'][x+1]+.75*g['x'][x],.75*g['x'][x+1]+.25*g['x'][x],13)
                ys=np.full(13,g['y'][y])
                px=xs[:,None]+np.zeros((13,7));py=ys[:,None]+np.arange(-3,4)
            else:
                ys=np.linspace(.25*g['y'][y+1]+.75*g['y'][y],.75*g['y'][y+1]+.25*g['y'][y],13)
                xs=np.full(13,g['x'][x])
                px=xs[:,None]+np.arange(-3,4);py=ys[:,None]+np.zeros((13,7))
            gx.append(np.rint(px).astype(int));gy.append(np.rint(py).astype(int))
        xx.append(gx);yy.append(gy)
    return np.array(xx),np.array(yy)

def old_graphs():
    a=json.loads((ROOT.parent/'kraftwerk-glyph22/curve-analysis/graphs.json').read_text(encoding='utf8'))
    out=[]
    for fi,f in enumerate(a['frames']):
        for si,g in enumerate(f['glyphs']):
            edges=[]
            for e in g['edges']:
                p=tuple(map(int,e['from'].split(',')));q=tuple(map(int,e['to'].split(',')))
                edges.append((p,q))
            out.append(dict(frameIndex=fi,state=f['state'],slot=si+1,edges=edges,confidence=g.get('confidence'),witness=f['witness']))
    return out

def match_old(keys,old):
    new=set(keys);matches=[]
    for g in old:
        best=None
        for dx in range(-2,3):
            for dy in range(-1,2):
                aligned=set()
                for a,b in g['edges']:
                    x=min(a[0],b[0])+dx;y=min(a[1],b[1])+dy;o='H' if a[1]==b[1] else 'V'
                    aligned.add(f'{o}{x},{y}')
                dist=len(new^aligned)
                if best is None or dist<best['xorCount']:best=dict(xorCount=dist,shift=[dx,dy],onlyNew=sorted(new-aligned),onlyOld=sorted(aligned-new))
        matches.append({**{k:v for k,v in g.items() if k!='edges'},**best})
    matches.sort(key=lambda g:g['xorCount'])
    return dict(minimumXor=matches[0]['xorCount'],bestMatches=[g for g in matches if g['xorCount']==matches[0]['xorCount']],all76Distances=[dict(frameIndex=g['frameIndex'],state=g['state'],slot=g['slot'],xorCount=g['xorCount'],shift=g['shift']) for g in matches])

def draw_outputs(data):
    episodes=data['episodes'];W=1050;RH=255;H=55+RH*len(episodes)
    im=Image.new('RGB',(W,H),'#faf8ef');dr=ImageDraw.Draw(im)
    font_path='C:/Windows/Fonts/arial.ttf'
    font=ImageFont.truetype(font_path,15);small=ImageFont.truetype(font_path,12)
    svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><rect width="100%" height="100%" fill="#faf8ef"/><style>text{{font-family:Arial,sans-serif;fill:#222}} .grid{{stroke:#dcdacb;stroke-width:.6}} .edge{{stroke:#171914;stroke-width:3;stroke-linecap:round}} .added{{stroke:#d4510b;stroke-width:3.5}}</style>']
    title='Kraftwerk / first 15 s / measured stable states / orange: added edges'
    dr.text((15,12),title,font=font,fill='#222');svg.append(f'<text x="15" y="28" font-size="17">{title}</text>')
    previous=None
    for ei,ep in enumerate(episodes):
        y0=55+ei*RH
        label=f"S{ei+1:02d}   {ep['observedFrom']:.3f}–{ep['observedTo']:.3f} s   {ep['sampleCount']} samples"
        dr.text((15,y0),label,font=font,fill='#222');svg.append(f'<text x="15" y="{y0+15}" font-size="15">{label}</text>')
        for si,gid in enumerate(ep['glyphIds']):
            graph=data['graphs'][gid-1];ox=si*250+70;oy=y0+35;step=15
            for x in range(9):
                dr.line((ox+x*step,oy,ox+x*step,oy+12*step),fill='#dcdacb');svg.append(f'<path class="grid" d="M{ox+x*step} {oy}v{12*step}"/>')
            for y in range(13):
                dr.line((ox,oy+y*step,ox+8*step,oy+y*step),fill='#dcdacb');svg.append(f'<path class="grid" d="M{ox} {oy+y*step}h{8*step}"/>')
            old=set(data['graphs'][previous[si]-1]['edges']) if previous else set(graph['edges'])
            for k in graph['edges']:
                a,b=ends(k);p=(ox+a[0]*step,oy+a[1]*step,ox+b[0]*step,oy+b[1]*step);color='#d4510b' if k not in old else '#171914'
                dr.line(p,fill=color,width=3);svg.append(f'<path class="{"added" if k not in old else "edge"}" d="M{p[0]} {p[1]}L{p[2]} {p[3]}"/>')
            t=graph['topology'];label=f"{si+1}: G{gid:02d} E={t['edgeCount']} C={t['components']} odd={t['oddCount']} squares={len(t['unitSquareCycles'])}"
            dr.text((si*250+15,oy+190),label,font=small,fill='#222');svg.append(f'<text x="{si*250+15}" y="{oy+202}" font-size="12">{label}</text>')
        previous=ep['glyphIds']
    svg.append('</svg>');(ROOT/'atlas.svg').write_text(''.join(svg),encoding='utf8');im.save(ROOT/'atlas.png')
    witness=next((f for f in data['frames'] if f['file']=='s0148.png'),data['frames'][-1]);im=Image.open(ROOT/'captures'/witness['file']).convert('RGB');dr=ImageDraw.Draw(im)
    for si,g in enumerate(data['grid']['slots']):
        for x in g['x']:dr.line((x,g['y'][0],x,g['y'][-1]),fill='#57a8b3',width=1)
        for y in g['y']:dr.line((g['x'][0],y,g['x'][-1],y),fill='#57a8b3',width=1)
        for idx,k in enumerate(KEYS):
            a,b=ends(k)
            if witness['edgeScores'][si][idx]>.5:dr.line((g['x'][a[0]],g['y'][a[1]],g['x'][b[0]],g['y'][b[1]]),fill='#fa4c77',width=2)
    im.save(ROOT/'overlay-check.png')

def main():
    manifest=json.loads((ROOT/'captures/samples.json').read_text(encoding='utf8'));samples=manifest['samples'];grid=calibrate(samples);xx,yy=sampling(grid)
    frames=[];graphs=[];registry={}
    for s in samples:
        im=np.asarray(Image.open(ROOT/'captures'/s['file']).convert('RGB'),dtype=float);lum=im[:,:,:2].mean(2)
        # The 95th percentile is a robust background estimate. R/G are used to
        # avoid treating yellow's absent blue component as a dark line.
        bg=float(np.percentile(lum[185:564,75:1252],95));scores=np.clip((bg-np.median(np.min(lum[yy,xx],axis=-1),axis=-1))/max(bg,1),0,1)
        valid=bg>=20;uncertain=[np.where((a>=.3)&(a<=.7))[0].tolist() for a in scores];ids=[]
        for si,a in enumerate(scores):
            key=tuple(np.where(a>.5)[0].tolist())
            if key not in registry:
                gid=len(graphs)+1;registry[key]=gid;ks=[KEYS[i] for i in key];graphs.append(dict(id=gid,edges=ks,topology=topology(ks),occurrences=[]))
            gid=registry[key];ids.append(gid);graphs[gid-1]['occurrences'].append(dict(file=s['file'],slot=si+1,before=s['before'],after=s['after'],confident=valid and not uncertain[si]))
        frames.append(dict(**s,mid=(s['before']+s['after'])/2,background=round(bg,3),visible=valid,glyphIds=ids,confident=valid and not any(uncertain),uncertainEdges=[[KEYS[i] for i in u] for u in uncertain],edgeScores=np.round(scores,3).tolist()))
    # Consecutive confident observations of the exact same four edge sets form
    # a run. Uncertain frames are retained as gaps, never silently repaired.
    runs=[]
    for fi,f in enumerate(frames):
        if f['confident']:
            if runs and runs[-1]['endIndex']==fi-1 and runs[-1]['glyphIds']==f['glyphIds']:runs[-1]['endIndex']=fi
            else:runs.append(dict(startIndex=fi,endIndex=fi,glyphIds=f['glyphIds']))
    episodes=[]
    for run in runs:
        a,b=run['startIndex'],run['endIndex']
        if b-a+1<2:continue
        if episodes and episodes[-1]['glyphIds']==run['glyphIds'] and all(not f['confident'] for f in frames[episodes[-1]['endIndex']+1:a]):
            ep=episodes[-1];ep['endIndex']=b;ep['sampleCount']+=b-a+1;ep['observedTo']=frames[b]['after'];ep['gaps'].append([frames[ep['lastRunEnd']+1]['before'],frames[a-1]['after']]);ep['lastRunEnd']=b
        else:episodes.append(dict(**run,id=len(episodes)+1,observedFrom=frames[a]['before'],observedTo=frames[b]['after'],sampleCount=b-a+1,lastRunEnd=b,gaps=[],witness=frames[(a+b)//2]['file']))
    transitions=[]
    for prev,cur in zip(episodes,episodes[1:]):
        changes=[]
        for ga,gb in zip(prev['glyphIds'],cur['glyphIds']):
            a=set(graphs[ga-1]['edges']);b=set(graphs[gb-1]['edges']);delta=topology(sorted(a^b));changes.append(dict(removed=sorted(a-b),added=sorted(b-a),xorCount=len(a^b),xorOddVertices=delta['oddVertices'],xorOddCount=delta['oddCount'],isUnionOfClosedCycles=delta['oddCount']==0))
        transitions.append(dict(fromState=prev['id'],toState=cur['id'],bracket=[frames[prev['endIndex']]['before'],frames[cur['startIndex']]['after']],changes=changes,intermediateSamples=[f['file'] for f in frames[prev['endIndex']+1:cur['startIndex']]]))
    stable_ids=sorted({g for e in episodes for g in e['glyphIds']});old=old_graphs()
    for g in graphs:
        g['stable']=g['id'] in stable_ids
        if g['stable']:g['oldComparison']=match_old(g['edges'],old)
    stable_sets=[set(graphs[i-1]['edges']) for i in stable_ids]
    per_slot=[]
    for si in range(4):
        sets=[set(graphs[e['glyphIds'][si]-1]['edges']) for e in episodes]
        per_slot.append(dict(slot=si+1,invariantEdges=sorted(set.intersection(*sets)) if sets else [],unionEdges=sorted(set.union(*sets)) if sets else [],uniqueGraphs=len({e['glyphIds'][si] for e in episodes})))
    same=defaultdict(list)
    for e in episodes:same[tuple(e['glyphIds'])].append(e['id'])
    stats=dict(sampleCount=len(frames),observedUntil=frames[-1]['after'],visibleFrames=sum(f['visible'] for f in frames),confidentFrames=sum(f['confident'] for f in frames),episodes=len(episodes),uniqueStableGraphs=len(stable_ids),allCandidateGraphs=len(graphs),stableConnected=sum(graphs[i-1]['topology']['components']==1 for i in stable_ids),stableEulerTrail=sum(graphs[i-1]['topology']['eulerTrail'] for i in stable_ids),stableEulerCircuit=sum(graphs[i-1]['topology']['eulerCircuit'] for i in stable_ids),exactOldMatches=sum(graphs[i-1]['oldComparison']['minimumXor']==0 for i in stable_ids),repeatedFourGlyphStates=[v for v in same.values() if len(v)>1])
    for ep in episodes:
        ep.update(start=ep['observedFrom'],end=ep['observedTo'],witnessFile=ep['witness'],glyphs=[dict(id=gid,edges=graphs[gid-1]['edges'],stats=graphs[gid-1]['topology']) for gid in ep['glyphIds']])
        # Compatible but less certain frames are exposed separately; they do not
        # silently extend the strict confidence interval printed in the atlas.
        a,b=ep['startIndex'],ep['endIndex']
        while a>0 and frames[a-1]['glyphIds']==ep['glyphIds']:a-=1
        while b+1<len(frames) and frames[b+1]['glyphIds']==ep['glyphIds']:b+=1
        ep['compatibleCandidateRange']=[frames[a]['before'],frames[b]['after']]
    transition_mid=np.array([np.mean(t['bracket']) for t in transitions]);ticks=np.arange(1,len(transitions)+1)
    slope,intercept=np.polyfit(ticks,transition_mid,1)
    empirical=dict(transitionFit=dict(formula='time = intercept + period * transitionIndex',periodSeconds=float(slope),interceptSeconds=float(intercept),maximumResidualSeconds=float(max(abs(transition_mid-(intercept+slope*ticks)))),timingCaveat='Regression of screenshot bracket midpoints; approximate 1 Hz, not native-frame precision.'),allFourSlotsChangeAtEveryObservedTransition=all(all(c['xorCount'] for c in t['changes']) for t in transitions),degreeParityPatternsPerSlot=[len({tuple(tuple(p) for p in sorted(graphs[e['glyphIds'][si]-1]['topology']['oddVertices'])) for e in episodes}) for si in range(4)],unitSquareCycleCountRange=[min(len(graphs[i-1]['topology']['unitSquareCycles']) for i in stable_ids),max(len(graphs[i-1]['topology']['unitSquareCycles']) for i in stable_ids)],conclusions=['The visible reconstruction lies on an 8 by 12 square-cell lattice in every slot.','Four slots update together at approximately one-second intervals.','One exact four-glyph state repeats at 2-3 and 11-12 seconds; this does not establish a global period.','Changing odd-degree vertex sets rule out a fixed graph modified ONLY by XOR of complete cycles, including unit squares.','Unit square cycles are present in many states, but no authoring algorithm is identified.'])
    data=dict(schemaVersion=1,source=manifest['source'],scopeSeconds=[0,15],method=dict(sampling='median along central 50% of each edge; minimum across transverse 7 pixels',brightness='mean red and green; normalized by frame ROI 95th percentile yellow background',threshold=.5,uncertaintyBand=[.3,.7],minimumBackground=20,stableRunMinimumFrames=2,noTopologyRepair=True,timing='Before/after player time brackets; neither exact decoded PTS nor native video frames',oldComparison='All 76 old raster reconstructions; integer translations dx -2..2, dy -1..1; no rotation/reflection; minimum edge symmetric difference. Old raster is not ground truth.'),grid=dict(cells=[8,12],edgeKeys=KEYS,slots=grid),stats=stats,perSlot=per_slot,invariantAcrossAllStableGraphs=sorted(set.intersection(*stable_sets)) if stable_sets else [],episodes=episodes,transitions=transitions,graphs=graphs,frames=frames)
    data['summary']=stats;data['empirical']=empirical
    cycle_tests=[c for t in transitions for c in t['changes']]
    empirical['cycleXorHypothesis']=dict(testedSlotTransitions=len(cycle_tests),allEvenDegreeDifferences=sum(c['isUnionOfClosedCycles'] for c in cycle_tests),oddDegreeDifferences=sum(not c['isUnionOfClosedCycles'] for c in cycle_tests),interpretation='An XOR of complete cycles has even degree at every vertex. Odd vertices in the measured symmetric difference refute a cycle-only update for that transition; even degree is necessary and sufficient for decomposition into grid face boundaries, but does not identify the authoring algorithm.')
    empirical['lagNineStateComparisons']=[dict(fromState=a['id'],toState=b['id'],identicalSlots=[ga==gb for ga,gb in zip(a['glyphIds'],b['glyphIds'])],xorCounts=[len(set(graphs[ga-1]['edges'])^set(graphs[gb-1]['edges'])) for ga,gb in zip(a['glyphIds'],b['glyphIds'])]) for a,b in zip(episodes,episodes[9:])]
    (ROOT/'analysis.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf8');draw_outputs(data)
    validation=dict(stats=stats,checks=dict(allInputsRead=len(frames)==len(samples),allEdgeScoresInUnitInterval=all(0<=v<=1 for f in frames for a in f['edgeScores'] for v in a),allGraphsOn8x12Grid=all(k in INDEX for g in graphs for k in g['edges']),handshakeLemma=all(g['topology']['oddCount']%2==0 for g in graphs),noTopologyRepair=True),inputManifestSha256=hashlib.sha256((ROOT/'captures/samples.json').read_bytes()).hexdigest(),limits=['Screenshot timing brackets are not native frame PTS.','Underexposed initial frames are retained but not assigned stable episodes.','Intermediate-threshold edges are retained explicitly; no Euler or contour correction.','Grid calibrated from bright frames; geometry represents visible stroke centerlines, not the artist source code.','Topology treats every visible crossing as a joined vertex.'])
    sensitivity=[]
    for ep in episodes:
        f=next(f for f in frames if f['file']==ep['witness']);im=np.asarray(Image.open(ROOT/'captures'/f['file']).convert('RGB'),dtype=float);lum=im[:,:,:2].mean(2);bg=f['background'];ref=np.array(f['edgeScores'])>.5
        shifted=[]
        for dx,dy in [(0,0),(-1,0),(1,0),(0,-1),(0,1)]:
            score=np.clip((bg-np.median(np.min(lum[yy+dy,xx+dx],axis=-1),axis=-1))/max(bg,1),0,1)
            shifted.append(dict(offset=[dx,dy],changedEdgesAtThresholds={str(t):int(np.sum((score>t)!=ref)) for t in [.3,.4,.5,.6,.7]}))
        sensitivity.append(dict(state=ep['id'],witness=ep['witness'],measurements=shifted))
    validation['witnessSensitivity']=sensitivity
    validation['checks']['allWitnessesUnchangedUnderOnePixelShiftAndThreshold03to07']=all(not n for r in sensitivity for m in r['measurements'] for n in m['changedEdgesAtThresholds'].values())
    validation['empirical']=empirical
    (ROOT/'validation.json').write_text(json.dumps(validation,ensure_ascii=False,indent=2),encoding='utf8');print(json.dumps(stats,ensure_ascii=False,indent=2));print('EPISODES',[(e['id'],round(e['observedFrom'],3),round(e['observedTo'],3),e['glyphIds']) for e in episodes]);print('CHECKS',validation['checks'])

if __name__=='__main__':main()
