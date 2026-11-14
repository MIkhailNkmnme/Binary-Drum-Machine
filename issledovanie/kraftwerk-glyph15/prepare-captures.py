"""Import only the video rectangle from time-stamped browser screenshots.

Raw browser captures stay outside the public repository. Usage:
python prepare-captures.py PATH_TO_RAW_CAPTURE_DIRECTORY
"""
from pathlib import Path
from PIL import Image
import json
import sys
import hashlib

root=Path(__file__).resolve().parent
raw=Path(sys.argv[1]).resolve()
out=root/'captures'
out.mkdir(exist_ok=True)
rows=json.loads((raw/'samples.json').read_text(encoding='utf-8'))
crop=(16,68,1353,816)
valid=[]
for row in rows:
    assert 0 <= row['before'] <= row['after']
    assert row['file'].startswith('s') and Path(row['file']).name==row['file']
    if row['before']>15:
        continue
    with Image.open(raw/row['file']) as im:
        assert im.size==(1905,904), (row['file'], im.size)
        im.crop(crop).save(out/row['file'])
    valid.append(dict(row, sha256=hashlib.sha256((out/row['file']).read_bytes()).hexdigest()))
report={'source':'https://www.youtube.com/watch?v=72x7kbeeGwQ',
        'title':'Kraftwerk live 2025 Coachella soundboard',
        'intervalSeconds':[0,15], 'nativeDownload':False,
        'method':'Screenshots of the video area during playback at 0.25 speed. The screen capture occurred between before/after playback times; these are not guaranteed native decoded frames.',
        'crop':list(crop), 'size':[1337,748], 'playbackRateDuringCapture':0.25,
        'captured':len(rows), 'included':len(valid),
        'maxCaptureBracket':max(r['after']-r['before'] for r in valid),
        'maxGapBetweenBrackets':max(valid[i+1]['before']-valid[i]['after'] for i in range(len(valid)-1)),
        'samples':valid}
(out/'samples.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='samples'}))
