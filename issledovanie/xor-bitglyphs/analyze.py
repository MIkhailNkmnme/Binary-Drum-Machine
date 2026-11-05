"""Exact enumeration of the traced bitglyphs; stdlib only. No app/browser tests.
Run: python issledovanie/xor-bitglyphs/analyze.py
Coordinates are cell-centre indices; +x right, +y down, pivot (0,0).
"""
from pathlib import Path
from collections import Counter
from fractions import Fraction
from itertools import permutations, combinations
import json, re, hashlib

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SOURCE = ROOT / 'mayatnik/mayatnik-xor-axes-templates.js'
text = SOURCE.read_text(encoding='utf-8')
mask_source = text.split('const masks=[', 1)[1].split('];', 1)[0]
rows = re.findall(r"'([01]{8})'", mask_source)
masks = [rows[i:i+12] for i in range(0, len(rows), 12)]
P = [{(x-r[0].index('1'), y) for y,row in enumerate(r) for x,v in enumerate(row) if v=='1'} for r in masks]
DIR4 = [(1,0),(-1,0),(0,1),(0,-1)]
DIR8 = [(x,y) for x in (-1,0,1) for y in (-1,0,1) if x or y]
NAMES = ['identity','rotate90','rotate180','rotate270','mirrorX','mirrorY','mirrorDiagonal','mirrorAntidiagonal']
def turn(p,t):
    x,y=p
    return [(x,y),(-y,x),(-x,-y),(y,-x)][t]
def transform(p,k):
    x,y=p
    return [(x,y),(-y,x),(-x,-y),(y,-x),(-x,y),(x,-y),(y,x),(-y,-x)][k]
def bbox(cells):
    return (min(x for x,y in cells),min(y for x,y in cells),max(x for x,y in cells),max(y for x,y in cells))
def normal(cells):
    x0,y0,_,_=bbox(cells)
    return tuple(sorted((x-x0,y-y0) for x,y in cells))
def orbit(cells):
    return [normal({transform(p,k) for p in cells}) for k in range(8)]
def components(cells,dirs=DIR4):
    rest=set(cells); out=[]
    while rest:
        start=min(rest); rest.remove(start); seen={start}; stack=[start]
        while stack:
            x,y=stack.pop()
            for dx,dy in dirs:
                q=x+dx,y+dy
                if q in rest: rest.remove(q);seen.add(q);stack.append(q)
        out.append(seen)
    return sorted(out,key=lambda c:(-len(c),min(c)))
def frac(v): return str(v)
def topology(cells,border):
    cc=components(cells)
    holes=[c for c in cc if not c&border]
    return {'components':len(cc),'outsideConnectedCells':sum(len(c) for c in cc if c&border),
            'holes':len(holes),'holeAreas':sorted(map(len,holes)),
            'holeCoordinates':[sorted(c) for c in holes]}
def metrics(cells,neutral=set(),bounds=None):
    x0,y0,x1,y1=bounds or bbox(cells|neutral)
    w=x1-x0+1;h=y1-y0+1
    box={(x,y) for x in range(x0,x1+1) for y in range(y0,y1+1)}
    border={(x,y) for x,y in box if x in (x0,x1) or y in (y0,y1)}
    empty=box-cells; zero=empty-neutral
    sym=[NAMES[k] for k,s in enumerate(orbit(cells)) if s==normal(cells)]
    return {'bounds':[x0,y0,x1,y1],'width':w,'height':h,'area':w*h,
      'ones':len(cells),'zeros':len(zero),'neutralCells':len(neutral),'nonOneCells':len(empty),
      'borderCells':len(border),'borderZeros':len(border&zero),'borderOnes':len(border&cells),'borderNeutral':len(border&neutral),
      'rectangleGeometricPerimeter':2*(w+h),'silhouettePerimeter':sum((x+dx,y+dy) not in cells for x,y in cells for dx,dy in DIR4),
      'onesComponents4':len(components(cells)),'onesComponentAreas4':list(map(len,components(cells))),
      'onesComponents8':len(components(cells,DIR8)),'zerosTopology4':topology(zero,border),'nonOneTopology4':topology(empty,border),
      'symmetries':sym,'symmetryOrder':len(sym),'d4OrbitSize':len(set(orbit(cells))),
      'rowOnes':[sum((x,y) in cells for x in range(x0,x1+1)) for y in range(y0,y1+1)],
      'columnOnes':[sum((x,y) in cells for y in range(y0,y1+1)) for x in range(x0,x1+1)],
      'centroidRelativeToPivot':{'x':frac(Fraction(sum(x for x,y in cells),len(cells))),'y':frac(Fraction(sum(y for x,y in cells),len(cells)))},
      'rows':[''.join('1' if (x,y) in cells else '2' if (x,y) in neutral else '0' for x in range(x0,x1+1)) for y in range(y0,y1+1)]}
def arrangement(ts):
    arms=[{turn(p,t) for p in ps if p!=(0,0)} for ps,t in zip(P,ts)]
    hits=Counter(p for arm in arms for p in arm)
    union=set(hits);xor={p for p,n in hits.items() if n%2}
    return arms,hits,union,xor
def equiv(a,b):
    return [NAMES[k] for k,shape in enumerate(orbit(a)) if shape==normal(b)]
raw=[]
for i,(ps,mask) in enumerate(zip(P,masks)):
    pivot=mask[0].index('1')
    raw.append({'id':i+1,'label':['I','II','III','IV'][i],'pivotInRawRectangle':[pivot,0],
                'metrics':metrics(ps,bounds=(-pivot,0,7-pivot,11)),
                'withoutPivot':metrics(ps-{(0,0)},bounds=(-pivot,0,7-pivot,11))})
crosses=[]; sets=[]; unions=[]; overlaps=[]
for i,ts in enumerate(permutations(range(4))):
    arms,hits,union,xor=arrangement(ts); sets.append(xor);unions.append(union)
    overlaps.append({p for p,n in hits.items() if n>1})
    crosses.append({'id':i+1,'turns':list(ts),'variant':24*sum(t*4**j for j,t in enumerate(ts)),
      'metrics':metrics(xor,{(0,0)}),'unionMetrics':metrics(union,{(0,0)}),
      'multiplicityHistogram':dict(sorted(Counter(hits.values()).items())),
      'overlapCoordinates':sorted(p for p,n in hits.items() if n>1),
      'pairwiseArmIntersections':[{'pair':[a+1,b+1],'cells':len(arms[a]&arms[b])} for a,b in combinations(range(4),2)]})
default_turns=(2,3,0,1)
default_index=list(permutations(range(4))).index(default_turns)
groups={}
for i,ps in enumerate(sets): groups.setdefault(min(orbit(ps)),[]).append(i+1)
rotgroups={}
for i,ps in enumerate(sets): rotgroups.setdefault(min(orbit(ps)[:4]),[]).append(i+1)
distances=[{'pair':[a+1,b+1],'hamming':len(sets[a]^sets[b])} for a,b in combinations(range(24),2)]
rawpair=[{'pair':[a+1,b+1],'d4Equivalences':equiv(P[a],P[b]),'commonPivotHamming':len(P[a]^P[b]),'intersection':len(P[a]&P[b])} for a,b in combinations(range(4),2)]
raw_union=set.union(*P); raw_intersection=set.intersection(*P); raw_xor=set()
for ps in P:raw_xor^=ps
keys=['ones','zeros','nonOneCells','width','height','borderZeros','borderOnes','silhouettePerimeter','onesComponents4','onesComponents8','symmetryOrder']
ranges={key:{'min':min(c['metrics'][key] for c in crosses),'max':max(c['metrics'][key] for c in crosses),'values':sorted(set(c['metrics'][key] for c in crosses))} for key in keys}
hole_types=[]
for ids in groups.values():
    z=crosses[ids[0]-1]['metrics']['zerosTopology4']
    hole_types.append({'crossIds':ids,'holes':z['holes'],'holeAreas':z['holeAreas'],
                       'outsideConnectedZeros':z['outsideConnectedCells'],'enclosedZeros':sum(z['holeAreas'])})
core=set.intersection(*sets); envelope=set.union(*sets)
coverage=Counter(p for ps in sets for p in ps)
data={'schemaVersion':1,'source':{'path':'mayatnik/mayatnik-xor-axes-templates.js','sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'scope':'Exact traced masks, not a claim of original artwork pixel fidelity'},
 'conventions':{'coordinates':'Integer cell centres, x right/y down, common pivot (0,0). Quarter turn maps (x,y) to (-y,x), clockwise on screen.',
 'raw':'Full 8 columns by 12 rows; grey pivot counts as occupied 1.',
 'cross':'One arm in each direction, common pivot removed from arms, recorded as neutral 2. zeros excludes this neutral cell; nonOneCells includes it.',
 'symmetry':'D4 transforms with crop/translation normalization; no colour inversion. Neutral pivot not counted as occupied.',
 'topology':'4-neighbour holes cannot reach rectangle border. zerosTopology4 excludes neutral; nonOneTopology4 includes it.',
 'perimeter':'silhouettePerimeter counts exposed unit edges of 1-cells. borderZeros counts unique zero cells on bounding rectangle border; corners counted once.',
 'centroid':'Mean occupied cell-centre coordinates relative to pivot centre, reduced exact rational strings.'},
 'rawFigures':raw,'rawPairwise':rawpair,
 'rawCommonPivotUnturned':{'union':metrics(raw_union),'intersection':metrics(raw_intersection),'xor':metrics(raw_xor),'intersectionCoordinates':sorted(raw_intersection)},
 'defaultCrossId':default_index+1,'defaultTurns':list(default_turns),'crosses':crosses,
 'crossSummary':{'count':24,'distinctExactRasters':len(set(normal(ps) for ps in sets)),'d4Classes':list(groups.values()),'rotationClasses':list(rotgroups.values()),
  'metricRanges':ranges,'hammingHistogram':dict(sorted(Counter(d['hamming'] for d in distances).items())),
  'hammingPairs':distances,'sharedCore':metrics(core,{(0,0)},(-11,-11,11,11)),
  'unionEnvelope':metrics(envelope,{(0,0)},(-11,-11,11,11)),
  'coverageHistogram':dict(sorted(Counter(coverage.values()).items())),
  'sharedCoreCoordinates':sorted(core),'allOverlapCoordinateSets':[sorted(c) for c in {tuple(sorted(o)) for o in overlaps}],
  'allMultiplicityHistograms':[dict(h) for h in {tuple(sorted(Counter(arrangement(ts)[1].values()).items())) for ts in permutations(range(4))}],
  'holeTypesByD4Class':hole_types,
  'neutralEffect':{'rawTotalOccupied':sum(map(len,P)),'fourRemovedPivots':4,'totalArmHits':sum(map(len,P))-4,
      'unionWithOccupiedCommonPivot':115,'unionWithNeutralCommonPivot':114,
      'xorWithOccupiedCommonPivot':113,'xorWithNeutralCommonPivot':113,
      'explanation':'All four occupied pivots cancel in XOR (4 mod 2 = 0), so black cells are unchanged. Neutral reservation changes that centre from binary 0 to value 2. In union, including pivot adds one occupied cell.'},
  'findings':[
      'Each of the 24 permutations has 115 arm hits: 113 singly covered cells and one doubly covered cell. Hence union=114 and XOR=113.',
      'The cancelled cell is always the rotated (-2,1) protrusion of figure I; its partner is whichever other figure points toward it. No threefold or fourfold arm overlap occurs.',
      'Every rectangle is 23x23: the furthest nonpivot row is y=11, and one arm is assigned to each of the four directions.',
      'Border cells: 2*23+2*23-4=88. The four arm ends contribute 1+1+2+1=5 occupied border cells, leaving 83 zero border cells.',
      'All 24 silhouettes have perimeter176, six 4-neighbour components, and one 8-neighbour component; two of the 4-neighbour components are isolated single cells.',
      'All 24 rasters differ. They form six rotational classes of four. None has nontrivial D4 symmetry and no reflected raster occurs among the 24.',
      'The shared 72-cell core and 168-cell envelope both have quarter-turn rotational symmetry but no mirror symmetry.',
      'Exactly72 cells occur in every cross;40 cells occur in6 crosses,44 in12,12 in18,72 in24. The remaining360 nonneutral cells never occur.',
      'Zero holes distinguish the six rotational classes: their area multisets are all different. There are7 or8 holes, with12 to20 enclosed zero cells.',
      'The closest distinct crosses differ in10 cells, the furthest in70. Raw III and IV differ in5 cells at the common pivot.',
      'Figures II and IV each have a diagonally attached final cell:2 components by side adjacency,1 by side or corner adjacency. Figures I and III each enclose one single-cell zero hole.',
      'The four unturned raw masks aligned at their pivots have a20-cell common intersection with a vertical mirror axis, even though none of the individual masks has an exact symmetry.'
  ]}}
HERE.mkdir(parents=True,exist_ok=True)
(HERE/'analysis.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def svg_grid(cells,neutral,bounds,scale=20,ox=0,oy=0,outline=True):
    x0,y0,x1,y1=bounds;w=x1-x0+1;h=y1-y0+1
    out=[f'<rect x="{ox}" y="{oy}" width="{w*scale}" height="{h*scale}" fill="#fd0000"/>']
    for x,y in sorted(cells|neutral):
        color='#777771' if (x,y) in neutral else '#000'
        out.append(f'<rect x="{ox+(x-x0)*scale}" y="{oy+(y-y0)*scale}" width="{scale}" height="{scale}" fill="{color}"/>')
    if outline:
        for x in range(w+1):out.append(f'<path d="M{ox+x*scale},{oy}v{h*scale}" stroke="#fff" stroke-opacity=".19" stroke-width=".5"/>')
        for y in range(h+1):out.append(f'<path d="M{ox},{oy+y*scale}h{w*scale}" stroke="#fff" stroke-opacity=".19" stroke-width=".5"/>')
    return ''.join(out)
def svg_doc(w,h,title,body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="{title}"><title>{title}</title><rect width="{w}" height="{h}" fill="#181614"/><g font-family="monospace" fill="#f4f0e8">{body}</g></svg>\n'
assets=HERE/'assets';assets.mkdir(exist_ok=True)
for i,(ps,item) in enumerate(zip(P,raw)):
    m=item['metrics'];b=m['bounds'];scale=28
    body=f'<text x="18" y="30" font-size="20">Фигура {item["label"]} · 8 × 12</text>'
    body+=svg_grid(ps,{(0,0)},b,scale,36,58)
    for y,n in enumerate(m['rowOnes']):body+=f'<text x="274" y="{58+y*scale+20}" font-size="14">{n}</text>'
    for x,n in enumerate(m['columnOnes']):body+=f'<text x="{42+x*scale}" y="417" font-size="12">{n}</text>'
    body+=f'<text x="18" y="450" font-size="14">1: {m["ones"]} · 0: {m["zeros"]} · край 0: {m["borderZeros"]}</text><text x="18" y="476" font-size="14">Периметр силуэта: {m["silhouettePerimeter"]}</text><text x="18" y="502" font-size="12">Серый центр включён в единицы</text>'
    (assets/f'figure-{i+1}.svg').write_text(svg_doc(340,522,f'Фигура {item["label"]}: клетки и суммы строк и столбцов',body),encoding='utf-8')
body=''
for i,(ps,item) in enumerate(zip(sets,crosses)):
    col=i%6;row=i//6;ox=col*190+15;oy=row*222+35;m=item['metrics']
    body+=f'<text x="{ox}" y="{oy-12}" font-size="13">{i+1:02} · {"".join(map(str,item["turns"]))}</text>'
    body+=svg_grid(ps,{(0,0)},m['bounds'],7,ox,oy,False)
    body+=f'<text x="{ox}" y="{oy+180}" font-size="11">P={m["silhouettePerimeter"]} · C₄={m["onesComponents4"]}</text>'
(assets/'crosses-24.svg').write_text(svg_doc(1140,888,'Все 24 креста: номера, повороты I–IV, периметр и компоненты',body),encoding='utf-8')
for name,ps in [('default-cross',sets[default_index]),('shared-core',core),('union-envelope',envelope)]:
    m=metrics(ps,{(0,0)},(-11,-11,11,11))
    body=svg_grid(ps,{(0,0)},(-11,-11,11,11),16,20,20)+f'<text x="20" y="418" font-size="14">1: {m["ones"]} · 0: {m["zeros"]} · центр: 2</text>'
    (assets/f'{name}.svg').write_text(svg_doc(408,440,name,body),encoding='utf-8')
print(json.dumps({'written':'analysis.json + 8 SVG assets','rawOnes':[len(ps) for ps in P],
 'crossCount':len(crosses),'ones':ranges['ones'],'defaultCrossId':default_index+1,
 'coreOnes':len(core),'envelopeOnes':len(envelope),'holeTypesByD4Class':hole_types},ensure_ascii=False))
