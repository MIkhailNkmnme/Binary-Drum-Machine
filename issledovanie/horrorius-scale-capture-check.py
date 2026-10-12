"""Codex — независимый исследователь Хоррориуса · 12.10.2026.
Check the actual encoded files, independent rational spot checks, and every cropped tile."""
import hashlib,json,sys
from fractions import Fraction
from pathlib import Path
import numpy as np
from PIL import Image
folder=Path(sys.argv[1]);m=json.loads((folder/'manifest.json').read_text(encoding='utf-8'));source_path=folder/m['source']
assert hashlib.sha256(source_path.read_bytes()).hexdigest()==m['sourceSha256']
source=np.asarray(Image.open(source_path).convert('RGB'));w,h=m['outputFieldSize'];checked_pixels=0;hashes=set()
for case in m['cases']:
    im=Image.open(folder/case['file']);field=np.asarray(im.convert('RGB'))[:h,:w]
    assert im.info['Author'].startswith('Codex')
    digest=hashlib.sha256(field.tobytes()).hexdigest();assert digest==case['sampledFieldSha256'];hashes.add(digest)
    scale=Fraction(case['scale']);px,py=map(Fraction,case['phase']);cx,cy=map(Fraction,m['centerSourceCells'])
    for y in [0,1,h//4,h//2,h-2,h-1]:
        for x in [0,1,w//4,w//2,w-2,w-1]:
            sx=int((cx+(Fraction(2*x+1-w,2)-px)/scale)//1);sy=int((cy+(Fraction(2*y+1-h,2)-py)/scale)//1)
            expected=source[sy,sx] if 0<=sx<source.shape[1] and 0<=sy<source.shape[0] else np.zeros(3,dtype=np.uint8)
            assert np.array_equal(field[y,x],expected);checked_pixels+=1
    x0,y0,x1,y1=case['tileRectangleInOutput'];tile=Image.open(folder/case['tileFile'])
    assert tile.info['Author'].startswith('Codex');assert np.array_equal(np.asarray(tile.convert('RGB'))[:y1-y0,:x1-x0],field[y0:y1,x0:x1])
assert len(hashes)==m['uniqueImageCount']
out={'author':'Codex — независимый исследователь Хоррориуса · 12.10.2026','sourceSha256':m['sourceSha256'],'cases':len(m['cases']),
     'uniqueSampledImages':len(hashes),'allEncodedImageHashesMatch':True,'allCentralCropsMatch':True,'independentRationalPixelChecks':checked_pixels,
     'sourceUnchanged':True,'scope':'selected finite scales and phases; exact nearest sampling; not a claim to enumerate continuous zoom'}
(folder/'verification.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(out,ensure_ascii=False))
