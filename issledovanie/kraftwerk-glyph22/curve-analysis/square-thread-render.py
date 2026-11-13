"""Render the independently checked witness as a mathematical figure and silent MP4."""
from pathlib import Path
import json,subprocess,shutil
from PIL import Image,ImageDraw,ImageFont
HERE=Path(__file__).resolve().parent
data=json.loads((HERE/'square-thread-route.json').read_text(encoding='utf-8'))
check=json.loads((HERE/'square-thread-check.json').read_text(encoding='utf-8'))
route=list(map(tuple,data['route']));target=set(map(tuple,data['target']))
assert len(route)==187 and len(target)==94 and check['repeatedSegments']==0
def font(size):
 for f in ['C:/Windows/Fonts/arial.ttf','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']:
  if Path(f).is_file():return ImageFont.truetype(f,size)
 return ImageFont.load_default(size=size)
F=font(22);S=font(17);H=font(29)
W,HGT=1100,680;size=16;background='#10151f';white='#ffffff';dim='#9eacc1';cyan='#64dfdf'
xs=[p[0] for p in route];ys=[p[1] for p in route];minx,miny=min(xs)-1,min(ys)-1
def at(p,panel):return (35+panel*360+(p[0]-minx)*size,123+(p[1]-miny)*size)
def square(draw,p,panel,colour):
 x,y=at(p,panel);draw.rectangle((x,y,x+size-1,y+size-1),fill=colour)
def centre(p,panel):x,y=at(p,panel);return(x+size/2,y+size/2)
def frame(n):
 im=Image.new('RGB',(W,HGT),background);draw=ImageDraw.Draw(im)
 draw.text((28,18),'Одна пунктирная нить собирает глиф',font=H,fill='#ffe0a3')
 draw.text((28,58),'1 = заполненный квадрат; 0 = пустой шаг. Диагональ тоже переключает фазу.',font=S,fill=dim)
 for k,label in enumerate(['Цель: 94 квадрата','Накопленный след','Путь нити до этого шага']):draw.text((28+k*360,92),label,font=F,fill='#e1e7f0')
 for p in target:square(draw,p,0,white);square(draw,p,1,'#1e2735');square(draw,p,2,'#1e2735')
 for p in route[:n+1:2]:square(draw,p,1,white)
 for a,b in zip(route[:n],route[1:n+1]):draw.line((centre(a,2),centre(b,2)),fill='#7c91ad',width=2)
 for i,p in enumerate(route[:n+1]):
  x,y=centre(p,2);r=2 if i%2 else 3;draw.ellipse((x-r,y-r,x+r,y+r),fill=cyan if i%2 else white)
 p=route[n];x,y=centre(p,2);draw.ellipse((x-7,y-7,x+7,y+7),outline='#ffbb71',width=2)
 lit=(n//2)+1
 draw.text((28,580),f'Позиция {n+1}/187   |   переходов {n}/186   |   фаза {1-n%2}   |   белых {lit}/94',font=F,fill='#ffe0a3')
 draw.text((28,618),'Серый путь и голубые нули — пояснение; в итоговый белый след они не входят.',font=S,fill=dim)
 draw.text((28,647),'Путь не повторяет отрезков. Каждый белый квадрат записан один раз: OR = XOR.',font=S,fill=cyan)
 return im
frame(len(route)-1).save(HERE/'square-thread-result.png')
ffmpeg=shutil.which('ffmpeg')
if not ffmpeg:raise SystemExit('ffmpeg is required to render the MP4; final PNG was created.')
output=HERE/'square-thread-route.mp4'
process=subprocess.Popen([ffmpeg,'-hide_banner','-loglevel','error','-y','-f','rawvideo','-pixel_format','rgb24','-video_size',f'{W}x{HGT}','-framerate','10','-i','pipe:0','-an','-c:v','libx264','-crf','19','-preset','medium','-pix_fmt','yuv420p','-movflags','+faststart',str(output)],stdin=subprocess.PIPE)
for n in range(len(route)):process.stdin.write(frame(n).tobytes())
last=frame(len(route)-1).tobytes()
for _ in range(20):process.stdin.write(last)
process.stdin.close();assert process.wait()==0
print(json.dumps({'frames':len(route)+20,'fps':10,'durationSeconds':(len(route)+20)/10,'videoBytes':output.stat().st_size,'size':[W,HGT]}))
