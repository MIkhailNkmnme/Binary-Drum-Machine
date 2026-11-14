"""Check local links, atlas structure and exact bytes inside the compact bundle."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parent

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs, self.ids = [], []
        self.states = self.svgs = 0
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if 'id' in a:
            self.ids.append(a['id'])
        self.states += tag == 'section' and a.get('class') == 'state'
        self.svgs += tag == 'svg'
        for key in ('href', 'src', 'poster'):
            if key in a:
                self.refs.append(a[key])

page = Page()
page.feed((root / 'index.html').read_text(encoding='utf-8'))
assert page.states == 15 and page.svgs == 60
assert len(page.ids) == len(set(page.ids)), 'Duplicate HTML IDs'
local = []
for ref in page.refs:
    u = urlsplit(ref)
    if u.scheme or u.netloc:
        continue
    if not u.path:
        assert not u.fragment or u.fragment in page.ids, ref
    else:
        target = root / unquote(u.path)
        assert target.exists(), ref
    local.append(ref)

bundle = root / 'glyph15-study.zip'
with zipfile.ZipFile(bundle) as z:
    assert z.testzip() is None, 'ZIP CRC failure'
    entries = z.namelist()
    assert len(entries) == len(set(entries)), 'Duplicate ZIP entries'
    verified = []
    for name in entries:
        if name == 'READ-ME.txt':
            continue
        assert z.read(name) == (root / name).read_bytes(), name
        verified.append(name)
report = dict(states=page.states, glyphs=page.svgs, localReferences=len(local),
              zipFiles=len(entries), zipFilesCompared=len(verified),
              zipBytes=bundle.stat().st_size,
              zipSha256=hashlib.sha256(bundle.read_bytes()).hexdigest(), passed=True)
(root / 'bundle-check.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report))
