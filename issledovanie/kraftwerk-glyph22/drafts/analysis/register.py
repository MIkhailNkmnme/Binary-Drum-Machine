import argparse
from pathlib import Path
base=Path(__file__).parent
import cv2
import numpy as np
import json
from PIL import Image,ImageDraw

src = None
def load(s):
    img=cv2.imread(str(src/s['file']))
    t=s['after']
    if t<8.4: x0,y0,x1,y1=470,315,890,475
    elif t<14.1: x0,y0,x1,y1=480,315,870,475
    elif t<16.3: x0,y0,x1,y1=450,310,925,475
    elif t<18.6: x0,y0,x1,y1=320,280,1030,490
    else: x0,y0,x1,y1=35,245,1320,625
    img=img[y0:y1,x0:x1]
    b,g,r=np.moveaxis(img.astype(np.float32),2,0)
    return img, g - .59*b - .2*r, (x0,y0)

def locate(s):
    img, metric, (x0,y0) = load(s)
    b,g,r = np.moveaxis(img.astype(np.float32),2,0)
    mask = (g > max(52, np.quantile(g,.991)*.64)) & (r > g*.9) & (g-b > 12) & (metric > max(18,metric.max()*.46))
    mask = mask.astype('uint8')
    n,lab,stats,cen=cv2.connectedComponentsWithStats(cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((3,3),'uint8')))
    comps=[(x,y,w,h,a) for x,y,w,h,a in stats[1:] if h>12 and w>10 and .35 < w/h < 1.04 and a > w*h*.10]
    return mask, [(x+x0,y+y0,w,h,a) for x,y,w,h,a in comps]

if __name__=='__main__':
 parser = argparse.ArgumentParser()
 parser.add_argument('--captures', type=Path, default=base.parent/'witnesses')
 src = parser.parse_args().captures
 fs = sorted(json.loads((src/'samples.json').read_text(encoding='utf-8')),key=lambda s:s['after'])
 for second in [1,2,3,5,7,8.2,8.6,9,11,14,14.4,15,16,17,18,19,20,20.6,21.1]:
    s=min(fs,key=lambda s:abs(s['after']-second))
    img,metric,_=load(s)
    peak=metric.max()
    mask=(metric>max(35,peak*.67)).astype('uint8')
    n,_,stats,centers=cv2.connectedComponentsWithStats(cv2.dilate(mask,np.ones((3,3),'uint8')))
    mask, comps=locate(s)
    print(second,s['file'],comps)
