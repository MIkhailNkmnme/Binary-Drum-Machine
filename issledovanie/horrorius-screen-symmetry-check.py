"""Codex — независимый исследователь Хоррориуса · 12.10.2026.
Check independent raw/reflected statistics on every saved detected region;
positive/negative controls and a small bit-noise example test the model's limits.
"""
import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

HERE=Path(__file__).resolve().parent;OUT=HERE/'horrorius-screen-symmetry'
spec=importlib.util.spec_from_file_location('observer',HERE/'horrorius-screen-symmetry.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
report=json.loads((OUT/'report.json').read_text(encoding='utf-8'));verified=0
for item in report['screens']:
    a=np.asarray(Image.open(OUT/item['inputFile']).convert('RGB'));white=np.all(a==[232,237,245],axis=2);valid=white|np.all(a==[91,100,117],axis=2)
    for x0,y0,x1,y1 in item['excludedTooltips']:valid[y0:y1,x0:x1]=False
    smooth=Image.fromarray((white*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(report['analysisBlurRadiusScreenPixels']))
    bits=Image.fromarray((white*255).astype(np.uint8));mask=Image.fromarray((valid*255).astype(np.uint8))
    for f in item['regions']:
        angle=f['angleTransform'];a_=smooth.rotate(angle,Image.Resampling.BILINEAR,expand=True) if angle else smooth
        b_=bits.rotate(angle,Image.Resampling.NEAREST,expand=True) if angle else bits
        v_=mask.rotate(angle,Image.Resampling.NEAREST,expand=True) if angle else mask
        aa=np.asarray(a_).astype(np.float64)/255;bb=np.asarray(b_)>0;vv=np.asarray(v_)>0
        if f['direction']=='H':aa=aa.T;bb=bb.T;vv=vv.T
        L,R,T,B=[f[k] for k in ['left','right','top','bottom']];p=aa[T:B,L:R];q=p[:,::-1]
        corr=float(np.corrcoef(p.ravel(),q.ravel())[0,1]);raw=float(np.mean(bb[T:B,L:R]==bb[T:B,L:R][:,::-1]))
        assert abs(corr-f['modelCorrelation'])<2e-5 and abs(raw-f['rawPixelEquality'])<1e-12
        def direct_rows(p):return np.array([np.corrcoef(row,row[::-1])[0,1] for row in p])
        inside=direct_rows(p);assert inside.min()>=report['threshold']-2e-5 and vv[T:B,L:R].all()
        before=direct_rows(aa[T-1:T,L:R])[0];after=direct_rows(aa[B:B+1,L:R])[0]
        assert before<report['threshold'] and after<report['threshold']
        outer=direct_rows(aa[T:B,L-1:R+1]);j=f['normalOutsideFailure']['row']-T
        assert outer[j]<report['threshold']
        verified+=1
    # Store the actual screen 0/1 values and their valid-pixel mask, losslessly.
    np.savez_compressed(OUT/f'screen-{item["number"]}-bits.npz',bits=white.astype(np.uint8),valid=valid)
shape=(72,96);x=np.arange(shape[1])+.5-shape[1]/2;y=np.arange(shape[0])[:,None]
model=(np.exp(-((x-18)/7)**2)+np.exp(-((x+18)/7)**2))[None,:]*(.55+.45*np.exp(-((y-36)/18)**2))
scores,_,_=s.row_stats(model,np.ones(shape,bool));assert np.allclose(scores,1)
asym=model.copy();asym[:,:shape[1]//2]=0;scores,_,_=s.row_stats(asym,np.ones(shape,bool));assert scores.max()<.85
rng=np.random.default_rng(23678);left=(rng.random((72,48))<(.15+.7*model[:,:48])).astype(np.uint8)
noisy=np.concatenate((left,left[:,::-1]),axis=1);flip=rng.random((72,48))<.1;noisy[:,48:]^=flip.astype(np.uint8)
raw=float(np.mean(noisy==noisy[:,::-1]));blur=np.asarray(Image.fromarray(noisy*255).filter(ImageFilter.GaussianBlur(2))).astype(float)/255
rho=float(np.corrcoef(blur.ravel(),blur[:,::-1].ravel())[0,1]);assert raw<1 and rho>raw
result={'author':s.AUTHOR,'verifiedApproximateRegions':verified,'allSavedStatisticsMatchDirectCorrelation':True,
    'allInsideRowScoresPass':True,'allThreeOutsideScoreChecksFail':True,
    'controls':{'exactSmoothSymmetryScore':1,'asymmetricControlRejected':True,'bitNoiseRawEquality':raw,'bitNoiseSmoothedCorrelation':rho},
    'scope':'verifies the declared model and encoded user screenshots; not a validation against human observers or physical monitor optics'}
(OUT/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(result,ensure_ascii=False))
