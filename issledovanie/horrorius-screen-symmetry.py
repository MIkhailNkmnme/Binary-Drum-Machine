"""Codex — независимый исследователь Хоррориуса · 12.10.2026.
Study the USER'S SCREEN PIXELS, not inferred source bits.
Raw equality and a declared approximate reflection model are separate quantities.
Gaussian smoothing is an analysis parameter, not a universal model of human sight.
"""
import hashlib
import argparse
import importlib.util
import json
import math
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE=Path(__file__).resolve().parent;OUT=HERE/'horrorius-screen-symmetry';OUT.mkdir(exist_ok=True)
spec=importlib.util.spec_from_file_location('capture',HERE/'horrorius-scale-capture.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
AUTHOR=c.AUTHOR
FILES=['codex-clipboard-c0902ca5-c84e-4d4b-b4af-507b488f32f4.png','codex-clipboard-68ac7ae4-810c-4776-b40e-74671f469f2c.png',
       'codex-clipboard-4165edcd-dbc7-4262-83d2-81d98c3d02f4.png','codex-clipboard-72bb19a7-8ac2-4325-bc77-c0efef20b03e.png',
       'codex-clipboard-4cf01435-69d0-4700-86bf-70e9c042b6bc.png']
THRESHOLD=.85;MINVAR=.000625;RADII=[8,16,24,32];BLUR=2

def row_stats(a,valid):
    variance=np.var(a,axis=1);score=1-np.mean((a-a[:,::-1])**2,axis=1)/(2*np.maximum(variance,1e-12))
    return score,variance,valid.all(axis=1)

def candidates(a,valid,raw,direction):
    if direction=='H':a=a.T;valid=valid.T;raw=raw.T
    H,W=a.shape;result=[]
    integral=np.pad(np.cumsum(a,axis=1,dtype=np.float64),((0,0),(1,0)))
    square=np.pad(np.cumsum(a*a,axis=1,dtype=np.float64),((0,0),(1,0)))
    goodint=np.pad(np.cumsum(valid,axis=1,dtype=np.int32),((0,0),(1,0)))
    rawint=np.pad(np.cumsum(raw,axis=1,dtype=np.float64),((0,0),(1,0)))
    for r in RADII:
        for even in [False,True]:
            length=2*r if even else 2*r+1;N=W-length+1
            if N<1:continue
            mean=(integral[:,length:]-integral[:,:-length])/length
            var=(square[:,length:]-square[:,:-length])/length-mean*mean
            density=(rawint[:,length:]-rawint[:,:-length])/length
            mask=(goodint[:,length:]-goodint[:,:-length])==length
            dif=np.zeros((H,N),np.float32)
            for d in range(r):
                left=r-1-d if even else r-1-d;right=r+d if even else r+1+d
                dif+=(a[:,left:left+N]-a[:,right:right+N])**2
            score=1-dif/(length*np.maximum(var,1e-12))
            good=mask&(var>=MINVAR)&(density>=.1)&(density<=.9)&(score>=THRESHOLD)
            for col in np.flatnonzero(np.any(good,axis=0)):
                changes=np.diff(np.r_[False,good[:,col],False].astype(np.int8));starts=np.flatnonzero(changes==1);ends=np.flatnonzero(changes==-1)
                for y0,y1 in zip(starts,ends):
                    if y1-y0<12 or y0<1 or y1>=H or length*(y1-y0)<256:continue
                    if not mask[y0-1,col] or not mask[y1,col] or var[y0-1,col]<MINVAR or var[y1,col]<MINVAR:continue
                    if score[y0-1,col]>=THRESHOLD or score[y1,col]>=THRESHOLD:continue
                    if not .25<=length/(y1-y0)<=4:continue
                    result.append({'direction':direction,'left':int(col),'right':int(col+length),'top':int(y0),'bottom':int(y1),
                        'initialRadius':r,'even':even,'minimumRowScore':float(score[y0:y1,col].min()),'rank':float(length*(y1-y0)*np.mean(score[y0:y1,col]))})
    return result

def grow(f,a,valid,raw):
    direction=f['direction']
    if direction=='H':a=a.T;valid=valid.T;raw=raw.T
    H,W=a.shape;left=f['left'];right=f['right'];top=f['top'];bottom=f['bottom'];failure=None
    for step in range(96):
        L=left-1;R=right+1
        if L<0 or R>W:return None
        score,var,ok=row_stats(a[top:bottom,L:R],valid[top:bottom,L:R])
        bad=np.flatnonzero((score<THRESHOLD)|(var<MINVAR)|~ok)
        if len(bad):
            j=int(bad[0]);
            if not ok[j] or var[j]<MINVAR:return None
            failure={'row':top+j,'score':float(score[j])};break
        left=L;right=R
    if failure is None:return None
    scores,vars_,ok=row_stats(a[top-1:bottom+1,left:right],valid[top-1:bottom+1,left:right])
    if not ok.all() or vars_[0]<MINVAR or vars_[-1]<MINVAR or scores[0]>=THRESHOLD or scores[-1]>=THRESHOLD:return None
    interior=a[top:bottom,left:right];mirror=interior[:,::-1];v=float(np.var(interior));correlation=1-float(np.mean((interior-mirror)**2))/(2*max(v,1e-12))
    bits=raw[top:bottom,left:right];equality=float((bits==bits[:,::-1]).mean())
    f={k:v for k,v in f.items() if k!='rank'};f.update({'left':left,'right':right,'modelCorrelation':correlation,'rawPixelEquality':equality,
        'minimumRowScore':float(scores[1:-1].min()),'beforeScore':float(scores[0]),'afterScore':float(scores[-1]),'normalOutsideFailure':failure})
    return f

def overlap(a,b):
    ax=[p[0] for p in a];ay=[p[1] for p in a];bx=[p[0] for p in b];by=[p[1] for p in b]
    inter=max(0,min(max(ax),max(bx))-max(min(ax),min(bx)))*max(0,min(max(ay),max(by))-max(min(ay),min(by)))
    area=min((max(ax)-min(ax))*(max(ay)-min(ay)),(max(bx)-min(bx))*(max(by)-min(by)))
    return inter/max(1,area)


def run(inputs=None,folder=None,blur=2,threshold=.85):
    global OUT,BLUR,THRESHOLD
    if not 0<=blur<=12 or not 0<threshold<=1:raise ValueError('Blur 0…12; threshold (0,1]')
    if folder is not None:OUT=Path(folder)
    OUT.mkdir(parents=True,exist_ok=True);BLUR=blur;THRESHOLD=threshold
    source_files=list(inputs) if inputs else FILES
    report={'author':AUTHOR,'input':'user-provided PNG screenshots copied byte for byte','threshold':THRESHOLD,
        'analysisBlurRadiusScreenPixels':BLUR,'minimumRowStddev':math.sqrt(MINVAR),'initialHalfWidths':RADII,
        'scope':'approximate correlation of reflected smoothed screen pixels; a declared model, not a validated universal human perception metric; source generation and monitor optics are not inferred','screens':[]}
    for index,filename in enumerate(source_files,1):
        path=OUT/f'screen-{index}.png'
        if inputs:
            src=Path(filename)
            if src.resolve()!=path.resolve():path.write_bytes(src.read_bytes())
        elif not path.exists():path.write_bytes((Path('C:/Users/Mhl/AppData/Local/Temp')/filename).read_bytes())
        image=Image.open(path).convert('RGB');pixels=np.asarray(image);H,W=pixels.shape[:2]
        grey=np.all(pixels==[91,100,117],axis=2);white=np.all(pixels==[232,237,245],axis=2);valid=grey|white;excluded=[]
        if not inputs and index==4:excluded.append([400,375,665,407])
        if not inputs and index==5:excluded.append([0,32,240,62])
        for x0,y0,x1,y1 in excluded:valid[y0:y1,x0:x1]=False
        raw=white.astype(np.float32);smooth=Image.fromarray((raw*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(BLUR))
        chosen=[];raw_candidate_count=0
        for angle in [0,45]:
            rot=smooth.rotate(angle,Image.Resampling.BILINEAR,expand=True) if angle else smooth
            rotmask=Image.fromarray((valid*255).astype(np.uint8)).rotate(angle,Image.Resampling.NEAREST,expand=True) if angle else Image.fromarray((valid*255).astype(np.uint8))
            rotbits=Image.fromarray((raw*255).astype(np.uint8)).rotate(angle,Image.Resampling.NEAREST,expand=True) if angle else Image.fromarray((raw*255).astype(np.uint8))
            arr=np.asarray(rot).astype(np.float32)/255;mask=np.asarray(rotmask)>0;bits=np.asarray(rotbits)>0
            RW,RH=rot.size;theta=math.radians(angle)
            def back(x,y):
                dx=x-RW/2;dy=y-RH/2
                return [W/2+math.cos(theta)*dx-math.sin(theta)*dy,H/2+math.sin(theta)*dx+math.cos(theta)*dy]
            proposed=[]
            for direction in ['V','H']:proposed+=candidates(arr,mask,bits,direction)
            raw_candidate_count+=len(proposed);selected_here=[]
            for candidate in sorted(proposed,key=lambda f:f['rank'],reverse=True):
                if len(selected_here)>=12:break
                f=grow(candidate,arr,mask,bits)
                if f is None:continue
                left,right,top,bottom=[f[k] for k in ['left','right','top','bottom']]
                p=[(left,top),(right,top),(right,bottom),(left,bottom)]
                axis=[((left+right)/2,top),((left+right)/2,bottom)]
                if f['direction']=='H':p=[(y,x) for x,y in p];axis=[(y,x) for x,y in axis]
                p=[back(x,y) for x,y in p];axis=[back(x,y) for x,y in axis]
                if any(overlap(p,old['polygon'])>.6 for old in chosen+selected_here):continue
                f.update({'angleTransform':angle,'axisAngleInScreenDegrees':(90 if f['direction']=='V' else 0)+angle,'polygon':p,'axisEndpoints':axis,
                    'rawEqualityGrid':'native screen pixels' if angle==0 else 'nearest rotated screen sampling grid'})
                selected_here.append(f)
            chosen+=selected_here
            print(f'Screen {index}: rotation {angle}, {len(proposed)} candidates, {len(selected_here)} selected',flush=True)
        annotated=image.copy();draw=ImageDraw.Draw(annotated)
        for number,f in enumerate(chosen,1):
            f['id']=number;p=[tuple(pt) for pt in f['polygon']];draw.line(p+[p[0]],fill='#ffad47',width=2);draw.line([tuple(pt) for pt in f['axisEndpoints']],fill='#30e5d3',width=2)
            draw.text((min(x for x,y in p)+2,min(y for x,y in p)+1),str(number),font=c.font(13),fill='#fff0bd',stroke_width=1,stroke_fill='#071013')
        # Exact raw-screen reference scan uses the same 0/1 classes and excludes tooltip.
        symbols=np.where(valid,np.where(white,2,1),0).astype(np.uint8);binary=OUT/f'screen-{index}-palette.bin';binary.write_bytes(symbols.tobytes());exactfile=OUT/f'screen-{index}-exact.json'
        subprocess.run(['node',str(HERE/'horrorius-symmetry-scan.cjs'),str(W),str(H),str(binary),str(exactfile)],check=True,capture_output=True)
        binary.unlink();exact=json.loads(exactfile.read_text(encoding='utf-8'))
        item={'number':index,'inputFile':path.name,'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'size':[W,H],
            'excludedTooltips':excluded,'classifiedPixels':int(valid.sum()),'differentColorsInEntirePNG':len(np.unique(pixels.reshape(-1,3),axis=0)),
            'candidateCount':raw_candidate_count,'shownApproximateRegions':len(chosen),'exactRegionsAtPriorThresholds':exact['count'],'regions':chosen}
        c.png(annotated,OUT/f'screen-{index}-annotated.png',item);report['screens'].append(item)
    (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps([(s['number'],s['exactRegionsAtPriorThresholds'],s['shownApproximateRegions']) for s in report['screens']]),flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--inputs',nargs='+');parser.add_argument('--out');parser.add_argument('--blur',type=float,default=2);parser.add_argument('--threshold',type=float,default=.85)
    args=parser.parse_args();run(args.inputs,args.out,args.blur,args.threshold)
