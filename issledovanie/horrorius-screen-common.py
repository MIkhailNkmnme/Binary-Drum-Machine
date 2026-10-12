"""Codex — независимый исследователь Хоррориуса · 12.10.2026.
Measure shared properties and mirrored partner patches directly on the screenshots.
"""
import collections
import json
from pathlib import Path

import numpy as np
from PIL import Image

HERE=Path(__file__).resolve().parent;OUT=HERE/'horrorius-screen-symmetry'
report=json.loads((OUT/'report.json').read_text(encoding='utf-8'))
regions=[f for s in report['screens'] for f in s['regions']]
result={'author':report['author'],'axisCounts':dict(collections.Counter(str(f['axisAngleInScreenDegrees']) for f in regions)),
    'modelCorrelationRange':[min(f['modelCorrelation'] for f in regions),max(f['modelCorrelation'] for f in regions)],
    'rawEqualityRange':[min(f['rawPixelEquality'] for f in regions),max(f['rawPixelEquality'] for f in regions)],'screens':[],
    'scope':'measured shared reflection properties, not a claim that all regions are the same motif or all five screenshots share a verified source frame'}
for item in report['screens'][:4]:
    a=np.asarray(Image.open(OUT/item['inputFile']).convert('RGB'));white=np.all(a==[232,237,245],axis=2);grey=np.all(a==[91,100,117],axis=2);mask=white|grey
    for x0,y0,x1,y1 in item['excludedTooltips']:mask[y0:y1,x0:x1]=False
    y=int(np.flatnonzero(mask.any(axis=1))[0]);x=np.flatnonzero(mask[y]);center=(int(x.min())+int(x.max()))/2
    xx=np.arange(a.shape[1]);rx=(2*center-xx).astype(int);keep=(rx>=0)&(rx<a.shape[1]);xx=xx[keep];rx=rx[keep]
    m=mask[:,xx]&mask[:,rx];eq=white[:,xx]==white[:,rx]
    partners=[];physicalAxis=center+.5
    bounds={f['id']:tuple(round(v) for v in [min(p[0] for p in f['polygon']),min(p[1] for p in f['polygon']),max(p[0] for p in f['polygon']),max(p[1] for p in f['polygon'])]) for f in item['regions'] if f['angleTransform']==0}
    for id1,b1 in bounds.items():
        L,T,R,B=b1;wanted=(round(2*physicalAxis-R),T,round(2*physicalAxis-L),B)
        for id2,b2 in bounds.items():
            if id2<=id1 or b2!=wanted:continue
            l,t,r,b=b2;patch=white[T:B,L:R];other=white[t:b,l:r][:,::-1]
            if patch.shape!=other.shape:continue
            partners.append({'ids':[id1,id2],'pixels':int(patch.size),'rawEqualityUnderWholeFrameReflection':float(np.mean(patch==other))})
    result['screens'].append({'number':item['number'],'wholeShapeAxisBetweenPixelIndices':center,
        'comparedVisibleFieldPixels':int(m.sum()),'wholeShapeRawReflectionEquality':float(eq[m].mean()),'partnerRegions':partners})
(OUT/'common-properties.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,ensure_ascii=False))
