"""Re-render the owner's 194-frame GIF as a silent colour-treated film."""
from pathlib import Path
import json, hashlib, shutil, subprocess
import numpy as np
from PIL import Image,ImageDraw,ImageFont
P=Path(__file__).resolve().parent
source=P/'central-axis-source.gif'
if not source.exists():
    raise FileNotFoundError('Place the original central-axis-source.gif beside this script')
out=P/'central-axis-v2-frames';out.mkdir(exist_ok=True)
im=Image.open(source)
W,H=1920,1080
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',22)
small=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',17)
palette={'background':[5,11,20],'blueToTurquoise':[64,180,195],'goldToAmber':[225,151,67],'lightGoldToIvory':[247,226,184]}
size=(round(im.width*1032/im.height),1032)
position=((W-size[0])//2,24)
durations=[]
for index in range(im.n_frames):
    im.seek(index);a=np.asarray(im.convert('RGB'));rgb=np.zeros_like(a);rgb[:]=palette['background']
    blue=(a[:,:,2]>80)&(a[:,:,0]<60)
    gold=(a[:,:,0]>200)&(a[:,:,1]<225)
    ivory=(a[:,:,0]>200)&(a[:,:,1]>=225)
    rgb[blue]=palette['blueToTurquoise'];rgb[gold]=palette['goldToAmber'];rgb[ivory]=palette['lightGoldToIvory']
    picture=Image.fromarray(rgb).resize(size,Image.Resampling.NEAREST)
    canvas=Image.new('RGB',(W,H),tuple(palette['background']));canvas.paste(picture,position)
    draw=ImageDraw.Draw(canvas)
    draw.text((W-32,H-56),'ZERKALIUS',font=font,fill=(94,119,133),anchor='ra')
    draw.text((W-32,H-30),'Центральная ось',font=small,fill=(73,94,108),anchor='ra')
    filename=f'frame-{index:04}.png';canvas.save(out/filename)
    durations.append(im.info.get('duration',100)/1000)
    if index==32:canvas.save(P/'central-axis-v2-preview.jpg',quality=96)
    if index%48==0:print(f'Rendered {index+1}/{im.n_frames}',flush=True)
listing='ffconcat version 1.0\n'
for i,duration in enumerate(durations):listing+=f"file 'central-axis-v2-frames/frame-{i:04}.png'\nduration {duration:.3f}\n"
listing+=f"file 'central-axis-v2-frames/frame-{len(durations)-1:04}.png'\n"
(P/'central-axis-v2.ffconcat').write_text(listing,encoding='utf-8')
total=sum(durations)
output='central-axis-templates-v2-amber-turquoise-1080p.mp4'
subprocess.run(['ffmpeg','-hide_banner','-loglevel','warning','-y','-f','concat','-safe','0','-i','central-axis-v2.ffconcat','-t',f'{total:.3f}','-vf','fps=30','-an','-c:v','libx264','-preset','slow','-crf','15','-pix_fmt','yuv420p','-movflags','+faststart','-progress','central-axis-v2-progress.txt',output],cwd=P,check=True)
manifest={'source':'central-axis-source.gif','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceSize':list(im.size),'sourceFrames':len(durations),'sourceDurationSeconds':total,'sourceFrameDurations':durations,'output':output,'resolution':[W,H],'fps':30,'pictureSize':list(size),'picturePosition':list(position),'palette':palette,'scaling':'Nearest neighbour; no invented detail or frame interpolation. Full GIF canvas preserved without cropping.','audio':'None, matching original.','referenceVideo':'https://www.youtube.com/watch?v=Fyc9d5H1E8U','status':'New colour/framing version for user review; original YouTube video retained.'}
(P/'central-axis-v2-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(output, (P/output).stat().st_size,flush=True)
