"""Codex — независимый исследователь Хоррориуса · 12.10.2026.
Read the actual films: each nonblack apex in row zero is a placed vertex."""
import json
from pathlib import Path
from PIL import Image
base=Path(__file__).resolve().parent
results=[]
for name in ['mayatnik-256.gif','mayatnik-512.gif']:
    im=Image.open(base.parent/'rezultaty'/name)
    frames=[]
    for i in range(im.n_frames):
        im.seek(i)
        row=im.convert('RGB').crop((0,0,im.width,1))
        vertices=sum(row.getpixel((x,0))!=(0,0,0) for x in range(row.width))
        frames.append({'frameIndex':i,'vertices':vertices,'durationMs':im.info.get('duration')})
    results.append({'name':name,'width':im.width,'height':im.height,'frameCount':im.n_frames,'frames':frames})
out={'author':'Codex — независимый исследователь Хоррориуса','date':'2026-10-12','method':'count nonblack apex cells in row zero of actual decoded GIF frames','results':results}
(base/'horrorius-gif-check.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for r in results:print(r['name'],r['frameCount'],[f['vertices'] for f in r['frames']],sorted(set(f['durationMs'] for f in r['frames'])))
