"""Codex — независимый исследователь Хоррориуса · 12.10.2026.
Positive controls: deliberately plant local symmetry in each of the four directions.
"""
import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np

HERE=Path(__file__).resolve().parent
temp=Path(tempfile.mkdtemp(prefix='horrorius-symmetry-test-'))
rng=np.random.default_rng(723441);base=rng.integers(1,3,size=(96,96),dtype=np.uint8)
vertical=base.copy();vertical[24:72,48:64]=vertical[24:72,32:48][:,::-1]
diag=base.copy()
for y in range(96):
    for x in range(96):
        if x>y and abs(x-y)<=32 and 70<=x+y<=110:diag[y,x]=diag[x,y]
result={}
for family,a in [('V',vertical),('H',vertical.T),('D+',diag),('D-',diag[:,::-1])]:
    name={'V':'v','H':'h','D+':'plus','D-':'minus'}[family];binary=temp/(name+'.bin');output=temp/(name+'.json')
    a.tofile(binary)
    subprocess.run(['node',str(HERE/'horrorius-symmetry-scan.cjs'),'96','96',str(binary),str(output)],check=True,capture_output=True)
    data=json.loads(output.read_text(encoding='utf-8'));count=sum(f['family']==family for f in data['findings'])
    assert count>0,(family,data['count']);result[family]=count
print(json.dumps({'author':'Codex — независимый исследователь Хоррориуса','positiveControls':result,'allFourDirectionsDetected':True}))
