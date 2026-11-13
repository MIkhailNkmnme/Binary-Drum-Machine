import argparse
import json
from pathlib import Path
import numpy as np
from PIL import Image

def colour_index(n,box):
    x0,y0,x1,y1=box
    im=np.asarray(Image.open(src/samples[n]['file']).crop(box).convert('RGB'),dtype=np.float32)
    r,g,b=np.moveaxis(im,2,0)
    area=(r>np.percentile(r,83)) & (r>1.09*b)
    return float(np.quantile((r-g)[area]/(r[area]+1),.8))

if __name__=='__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--captures', type=Path, required=True)
    src = parser.parse_args().captures
    samples = {int(Path(s['file']).stem):s for s in json.loads((src/'samples.json').read_text(encoding='utf-8'))}
    if any(n not in samples for a,b in [(49,111),(379,390),(427,457)] for n in range(a,b)):
        parser.error('The exploratory color series requires additional, unpublished captures.')
    records=[]
    for start,stop,box in [(49,111,(510,350,835,466)),(379,390,(398,277,978,451)),(427,457,(172,260,1254,620))]:
        time=[];red=[]
        for n in range(start,stop):
            time.append(samples[n]['after'])
            red.append(colour_index(n,box))
        records.append((start,stop,time,red))
    freq=np.linspace(1,12,1101)
    for start,stop,time,red in records:
        signal=np.asarray(red)-np.mean(red)
        powers=np.abs(np.exp(2j*np.pi*np.asarray(time)[:,None]*freq[None,:]).T @ signal)
        peak=freq[np.argmax(powers)]
        print(start,stop,peak,round(1/peak,3),[(round(t,3),round(x,2)) for t,x in zip(time,red)])
