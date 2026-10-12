"""Codex — независимый исследователь Хоррориуса · 12.10.2026.
Prepare lossless palette inputs for reproducing the whole-frame symmetry scans.
Usage: python -B issledovanie/horrorius-symmetry-prepare.py --out path/to/work
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image

HERE=Path(__file__).resolve().parent
parser=argparse.ArgumentParser();parser.add_argument('--out',required=True);args=parser.parse_args()
out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
for name,file in [('source','horrorius-scale-N2048-n96/source-original.png'),('rendered','horrorius-full-N2048-n96/full-13-phase-0.png')]:
    im=np.asarray(Image.open(HERE/file).convert('RGB'));valid=np.any(im!=0,axis=2);ys,xs=np.nonzero(valid)
    box=[int(xs.min()),int(ys.min()),int(xs.max())+1,int(ys.max())+1];a=im[box[1]:box[3],box[0]:box[2],0]
    symbols=np.where(a==232,2,np.where(a==91,1,0)).astype('uint8');symbols.tofile(out/(name+'.bin'))
    meta={'author':'Codex — независимый исследователь Хоррориуса','image':file,'bbox':box,'width':a.shape[1],'height':a.shape[0]}
    (out/(name+'-input.json')).write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(name,a.shape[1],a.shape[0])
