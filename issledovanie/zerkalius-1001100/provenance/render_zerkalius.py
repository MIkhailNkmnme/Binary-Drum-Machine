import math, pathlib, subprocess, wave, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = pathlib.Path(__file__).resolve().parent
W,H,FPS,SECONDS,SR = 960,540,24,30,48000
FONT = 'C:/Windows/Fonts/segoeui.ttf'
fonts = {n:ImageFont.truetype(FONT,n) for n in (16,20,25,30)}
lyrics = [
 ['Ночью лампа на пульте мигает.','Семь импульсов. И снова тишина.'],
 ['My finger taps the same rhythm.','I wait in the quiet.'],
 ['Dann antwortet eine leise Stimme.','Ich bin noch hier.']]
names=['Зеркалиус.','Zerkalius.','Zerkalius.']
words=[['Один','ноль','ноль','один','один','ноль','ноль'],
       ['One','zero','zero','one','one','zero','zero'],
       ['Eins','null','null','eins','eins','null','null']]
bits=[1,0,0,1,1,0,0]
slots=[0,1,2,4,5,6,7]
beat=60/96

# All sound is computed from oscillators. No recordings or audio inputs.
audio=np.zeros((SECONDS*SR,2),np.float64)
def tone(at,duration,freq,level,pan=0,soft=False):
    start=int(at*SR); count=min(int(duration*SR),len(audio)-start)
    if count<=0:return
    t=np.arange(count)/SR
    env=(1-np.exp(-t/(.09 if soft else .014)))*np.exp(-t/(1.1 if soft else .19))
    env*=np.minimum(1,(duration-t)/.12).clip(0,1)
    signal=(np.sin(2*np.pi*freq*t)+.17*np.sin(2*np.pi*freq*2*t+.1))*env*level
    audio[start:start+count,0]+=signal*math.sqrt((1-pan)/2)
    audio[start:start+count,1]+=signal*math.sqrt((1+pan)/2)

for k in range(48):
    at=k*beat
    tone(at,.55,55,.105)
    # Original three-note motif is driven by the seven-bit sequence.
    phase=k%8
    if phase in slots:
        ix=slots.index(phase)
        tone(at,1.5,[220,261.6256,329.6276][ix%3],.045 if bits[ix] else .016,-.45)
        if at>=10:tone(at+.3125,1.5,[220,261.6256,329.6276][ix%3]*1.5,.028,.45)
for at in range(0,30,5):
    for freq in (110,164.8138,261.6256):tone(at,5,freq,.027,soft=True)
fade=np.minimum(np.arange(len(audio))/SR/1.2,1)*np.minimum((len(audio)-np.arange(len(audio)))/SR/2,1)
audio*=fade[:,None]
audio=np.tanh(audio*1.4)
with wave.open(str(OUT/'zerkalius-1001100-sketch.wav'),'wb') as f:
    f.setnchannels(2);f.setsampwidth(2);f.setframerate(SR)
    f.writeframes((audio*32767).astype('<i2').tobytes())

yy,xx=np.mgrid[0:H,0:W]
rad=np.exp(-(((xx-W*.5)/(W*.55))**2+((yy-H*.47)/(H*.7))**2)*2)
bg=np.stack([5+rad*5,9+rad*11,18+rad*18],axis=-1).astype('uint8')
base=Image.fromarray(bg)
def text_center(draw,y,text,size,color):
    draw.text((W/2,y),text,font=fonts[size],fill=color,anchor='mt')

cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24',
     '-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i',str(OUT/'zerkalius-1001100-sketch.wav'),
     '-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:a','aac',
     '-b:a','192k','-movflags','+faststart','-shortest',str(OUT/'zerkalius-1001100-sketch.mp4')]
p=subprocess.Popen(cmd,stdin=subprocess.PIPE)
for frame in range(SECONDS*FPS):
    t=frame/FPS; act=min(2,int(t/10)); local=t-act*10
    im=base.copy(); d=ImageDraw.Draw(im)
    text_center(d,34,'Z E R K A L I U S',20,(156,167,180))
    text_center(d,65,'1 0 0   1 1 0 0',16,(88,108,128))
    glow=Image.new('RGB',(W,H)); g=ImageDraw.Draw(glow)
    # A pair of mirrored pendulums: call, delayed reply, shared motion.
    for side,cx in enumerate((352,608)):
        strength=1 if side==0 else (0.1 if act==0 else .7)
        delay=0 if side==0 or act==2 else .3125
        ang=math.sin(2*math.pi*(t-delay)/5)*.65
        cy=180; length=116
        ex=cx+math.sin(ang)*length; ey=cy+math.cos(ang)*length
        col=tuple(int(c*strength) for c in ((104,164,188) if side==0 else (227,173,103)))
        d.arc((cx-118,cy-118,cx+118,cy+118),45,135,fill=(34,48,60),width=1)
        d.line((cx,cy,ex,ey),fill=col,width=2)
        d.ellipse((cx-3,cy-3,cx+3,cy+3),fill=col)
        shape=[(ex,ey-13),(ex+13,ey),(ex,ey+13),(ex-13,ey)]
        d.polygon(shape,outline=col,width=2);g.polygon(shape,fill=col)
        phase=((t-delay)%5)/beat
        slot=int(phase); fraction=phase-slot
        pulse=math.exp(-fraction*5)*(1 if slot in (0,4,5) else .25) if slot!=3 else 0
        r=5+5*pulse
        lamp=(cx,342)
        lc=tuple(int(c*max(.13,pulse)) for c in col)
        d.ellipse((cx-r,342-r,cx+r,342+r),fill=lc)
        g.ellipse((cx-r*2,342-r*2,cx+r*2,342+r*2),fill=lc)
    im=Image.fromarray(np.minimum(np.asarray(im,dtype=np.uint16)+np.asarray(glow.filter(ImageFilter.GaussianBlur(13)),dtype=np.uint16),255).astype('uint8'))
    d=ImageDraw.Draw(im)
    if local<4.2:
        alpha=min(1,local/.6,(4.2-local)/.6)
        col=tuple(int(c*max(0,alpha)) for c in (205,211,214))
        for j,line in enumerate(lyrics[act]):text_center(d,410+j*37,line,25,col)
    else:
        text_center(d,402,names[act],25,(205,211,214))
        elapsed=local-4.6
        for ix,slot in enumerate(slots):
            x=290+ix*63; active=slot*beat<=elapsed<(slot+1)*beat
            d.text((x,447),str(bits[ix]),font=fonts[30],anchor='mt',fill=(239,190,116) if active else (66,85,102))
        if elapsed>=0:
            match=[ix for ix,s in enumerate(slots) if s*beat<=elapsed<(s+1)*beat]
            label=words[act][match[0]] if match else '…'
            text_center(d,490,label,16,(157,171,182))
    if t<1 or t>28:
        amount=min(1,t, max(0,(30-t)/2))
        im=Image.fromarray((np.asarray(im)*amount).astype('uint8'))
    if frame==18*FPS:im.save(OUT/'zerkalius-1001100-preview.jpg')
    p.stdin.write(im.tobytes())
p.stdin.close()
if p.wait()!=0:raise RuntimeError('Video encoding failed')
(OUT/'zerkalius-1001100-manifest.json').write_text(json.dumps({
    'title':'Zerkalius 1001100 — video sketch','seconds':30,'bpm':96,'fps':24,
    'size':[960,540],'source':pathlib.Path(__file__).name,
    'audio':'Original oscillator synthesis; no audio inputs; no speech in this sketch.',
    'visuals':'Original procedural mirrored pendulums, two lamps and lyric captions.',
    'sequence':bits,'pause':'One empty beat after the third digit.',
    'status':'Preview, not a completed vocal track.'},ensure_ascii=False,indent=2),encoding='utf-8')
print(OUT/'zerkalius-1001100-sketch.mp4')
