"""Combine the original atlas with the geometric collection without duplicate IDs."""
import json
from pathlib import Path

root=Path(__file__).resolve().parent
read=lambda name: json.loads((root/name).read_text(encoding='utf-8-sig'))
extra=read('wallpapers-geometric.json')['wallpapers']
ids={p['id'] for p in extra}
assert len(ids)==len(extra)
base=[p for p in read('wallpapers.json')['wallpapers'] if p['id'] not in ids]
papers=base+extra
assert len({p['id'] for p in papers})==len(papers)
(root/'wallpapers.json').write_text(json.dumps({'wallpapers':papers},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'{len(base)} existing + {len(extra)} geometric = {len(papers)} wallpapers')
