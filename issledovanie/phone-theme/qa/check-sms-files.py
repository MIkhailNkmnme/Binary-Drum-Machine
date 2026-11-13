"""Check the release page, download payloads, and preservation of older assets."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
from collections import Counter
import hashlib
import json
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
BASELINE = 'bcef7e553aac516af59aed6508d7f406a1d9b931'

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.refs = [], []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        self.refs.extend(attrs[k] for k in ['src', 'href'] if attrs.get(k))

page = Page()
page.feed((ROOT/'index.html').read_text(encoding='utf-8'))
assert len(page.ids) == len(set(page.ids)), 'Duplicate DOM ID'
local = []
for ref in page.refs:
    u = urlsplit(ref)
    if u.scheme or u.netloc:
        continue
    if not u.path:
        assert unquote(u.fragment) in page.ids, ref
    else:
        target = (ROOT/unquote(u.path)).resolve()
        assert target.exists(), ref
    local.append(ref)

signals = json.loads((ROOT/'sms.json').read_text(encoding='utf-8'))['signals']
assert len(signals) == 20
assert len({s['id'] for s in signals}) == 20
for s in signals:
    assert s['id'] in page.ids
    assert 0 < s['duration'] < .7
    assert s['src'] in local and s['wav'] in local
    assert len(s['recipe']['notes']) in [1, 2]

sha = lambda b: hashlib.sha256(b).hexdigest()
archives = json.loads((ROOT/'downloads/manifest.json').read_text(encoding='utf-8'))
for row in archives:
    data = (ROOT/row['file']).read_bytes()
    assert sha(data) == row['sha256']
for name in ['zerkalius-sms.zip', 'zerkalius-phone-theme.zip']:
    with zipfile.ZipFile(ROOT/'downloads'/name) as z:
        assert z.testzip() is None
        for s in signals:
            for fmt in ['src', 'wav']:
                assert z.read('SMS/'+Path(s[fmt]).name) == (ROOT/s[fmt]).read_bytes()

git = lambda *args: subprocess.check_output(['git', *args], cwd=REPO)
prefix = ROOT.relative_to(REPO).as_posix()+'/'
old_paths = git('ls-tree', '-r', '--name-only', BASELINE, prefix+'audio', prefix+'wallpapers', prefix+'art').decode('utf-8').splitlines()
for rel in old_paths:
    before = git('show', BASELINE+':'+rel)
    after = (REPO/rel).read_bytes()
    if Path(rel).suffix in ['.svg','.cjs','.json']:
        before, after = before.replace(b'\r\n',b'\n'), after.replace(b'\r\n',b'\n')
    assert before == after, rel
report = {
    'localReferences': len(local), 'brokenReferences': [], 'uniqueIds': len(page.ids),
    'signals': len(signals), 'durationRange': [min(s['duration'] for s in signals), max(s['duration'] for s in signals)],
    'noteCounts': dict(Counter(len(s['recipe']['notes']) for s in signals)),
    'archivesChecked': len(archives), 'smsArchiveCopiesChecked': 80,
    'oldAssetsUnchanged': len(old_paths), 'baseline': BASELINE,
    'physicalPhoneInstallationTested': False,
}
(ROOT/'qa/sms-files.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
