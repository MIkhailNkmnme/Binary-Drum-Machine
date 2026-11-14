"""Build a silent 15-second inspection clip from timestamped video screenshots.

The output is a reconstruction of browser observations, not a native video cut.
Pillow and ffmpeg are required. No audio is included.
"""
from pathlib import Path
from PIL import Image
import json
import subprocess
import hashlib

root=Path(__file__).resolve().parent
source=json.loads((root/'captures/samples.json').read_text(encoding='utf-8'))
samples=source['samples']
fps=30
target=root/'source-excerpt-silent.mp4'
frames=[]
# Keep the four glyphs and their heading, exclude browser-player controls.
crop=(0,70,1337,650)
proc=subprocess.Popen(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo',
    '-pix_fmt','rgb24','-s','1337x580','-r',str(fps),'-i','pipe:0','-an',
    '-vf','pad=ceil(iw/2)*2:ceil(ih/2)*2','-c:v','libx264','-crf','19',
    '-pix_fmt','yuv420p','-movflags','+faststart',str(target)],stdin=subprocess.PIPE)
last=None
pixels=None
for frame in range(15*fps):
    time=frame/fps
    row=min(samples,key=lambda s:abs((s['before']+s['after'])/2-time))
    if row['file']!=last:
        with Image.open(root/'captures'/row['file']) as im:
            pixels=im.convert('RGB').crop(crop).tobytes()
        last=row['file']
    proc.stdin.write(pixels)
    frames.append({'frame':frame,'outputTime':time,'source':row['file'],
        'captureBracket':[row['before'],row['after']],
        'midpointError':abs(time-(row['before']+row['after'])/2)})
proc.stdin.close()
assert proc.wait()==0
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(target)]))
assert len(probe['streams'])==1 and probe['streams'][0]['codec_type']=='video'
assert abs(float(probe['format']['duration'])-15)<.001
report={'source':source['source'],'method':'Nearest timestamp-bracket midpoint, browser screenshots; no native-source download. Not every decoded source frame is guaranteed captured.',
    'duration':15,'fps':fps,'frames':450,'audio':False,'cropWithinVideoScreenshot':list(crop),
    'width':1338,'height':580,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
    'maxMidpointError':max(f['midpointError'] for f in frames),'mapping':frames}
(root/'excerpt-provenance.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='mapping'}))
