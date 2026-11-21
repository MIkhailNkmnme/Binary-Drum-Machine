import os,sys,json,math,wave,pathlib,subprocess,hashlib,shutil
import numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter
P=pathlib.Path(__file__).resolve().parent
os.chdir(P)
SR=48000; DUR=210; W=960; H=540; FPS=24
timeline=json.loads((P/'voice-timeline.json').read_text(encoding='utf-8'))
bits=[1,0,0,1,1,0,0]; slots=[0,1,2,4,5,6,7]; beat=.625
def read_wav(file):
    with wave.open(str(file),'rb') as f:
        sr=f.getframerate();ch=f.getnchannels();a=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').astype(np.float32)/32768
    return a.reshape(-1,ch),sr
def write_wav(file,a):
    with wave.open(str(file),'wb') as f:
        f.setnchannels(1 if a.ndim==1 else a.shape[1]);f.setsampwidth(2);f.setframerate(SR);f.writeframes((np.clip(a,-1,1)*32767).astype('<i2').tobytes())
def music():
    a=np.zeros((DUR*SR,2),np.float32)
    def tone(at,dur,freq,level,pan=0,soft=False):
        start=round(at*SR);count=min(round(dur*SR),len(a)-start)
        if count<=0:return
        t=np.arange(count,dtype=np.float32)/SR
        env=(1-np.exp(-t/(.09 if soft else .014)))*np.exp(-t/(1.1 if soft else .19))*np.minimum(1,(dur-t)/.12).clip(0,1)
        v=(np.sin(2*np.pi*freq*t)+.17*np.sin(4*np.pi*freq*t+.1))*env*level
        a[start:start+count,0]+=v*math.sqrt((1-pan)/2);a[start:start+count,1]+=v*math.sqrt((1+pan)/2)
    for k in range(48,DUR*96//60):
        at=k*beat;section=int(at/30)
        factor=[1,1,1.122462,1,1.33484,1,1][section]
        tail=max(0,min(1,(210-at)/24)) if at>=180 else 1
        tone(at,.55,55,.105*tail)
        slot=k%8
        if slot in slots:
            ix=slots.index(slot);freq=[220,261.6256,329.6276][ix%3]*factor
            tone(at,1.5,freq,(.045 if bits[ix] else .016)*tail,-.45)
            tone(at+.3125,1.5,freq*1.5,.024*tail,.45)
    for at in range(30,210,5):
        tail=max(0,min(1,(210-at)/24)) if at>=180 else 1
        for f in (110,164.8138,261.6256):tone(at,5,f,.027*tail,soft=True)
    a=np.tanh(a*1.4)
    first,_=read_wav(P/'zerkalius-1001100-sketch.wav');a[:len(first)]=first
    # Short return from the original sketch's closing fade at 30 seconds.
    a[30*SR:31*SR]*=np.linspace(0,1,SR,dtype=np.float32)[:,None]
    vocal=np.zeros(DUR*SR,np.float32);duck=np.zeros(DUR*SR,np.float32)
    levels=[]
    for event in timeline['events']:
        v,sr=read_wav(P/event['file']);v=v[:,0]
        x=np.arange(round(len(v)*SR/sr))*sr/SR
        v=np.interp(x,np.arange(len(v)),v).astype(np.float32)
        rms=math.sqrt(float(np.mean(v*v)));gain=min(.043/max(rms,1e-8),.19/max(float(np.max(abs(v))),1e-8))
        v*=gain
        start=round(event['start']*SR);vocal[start:start+len(v)]+=v
        ds=max(0,start-round(.15*SR));de=min(len(duck),start+len(v)+round(.4*SR))
        envelope=np.ones(de-ds,np.float32);attack=start-ds;release=de-start-len(v)
        if attack:envelope[:attack]=np.linspace(0,1,attack)
        if release:envelope[-release:]=np.linspace(1,0,release)
        duck[ds:de]=np.maximum(duck[ds:de],envelope)
        levels.append({'text':event['text'],'start':event['start'],'duration':len(v)/SR,'rms':float(np.sqrt(np.mean(v*v))),'peak':float(np.max(abs(v)))})
    a*=1-.58*duck[:,None]
    a+=vocal[:,None]*.7071
    # Extremely short, low-level room reflection, no long reverb masking words.
    for delay,side,gain in [(round(.029*SR),0,.055),(round(.037*SR),1,.045)]:a[delay:,side]+=vocal[:-delay]*gain
    a[-8*SR:]*=np.linspace(1,0,8*SR)[:,None]
    peak=float(np.max(abs(a)))
    if peak>.97:a*=.97/peak
    write_wav(P/'zerkalius-1001100-full-mix.wav',a)
    write_wav(P/'zerkalius-1001100-voice-only.wav',vocal)
    (P/'mix-levels.json').write_text(json.dumps({'duration':DUR,'peak':float(np.max(abs(a))),'voiceEvents':levels,'duckAmount':.58,'sampleRate':SR},ensure_ascii=False,indent=2),encoding='utf-8')
    print('210-second music and three-language voice mix ready',flush=True)

def ass_time(t):
    cs=round(t*100);h,cs=divmod(cs,360000);m,cs=divmod(cs,6000);s,cs=divmod(cs,100);return f'{h}:{m:02}:{s:02}.{cs:02}'
def subtitles():
    text='''[Script Info]
ScriptType: v4.00+
PlayResX: 960
PlayResY: 540
WrapStyle: 2
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Segoe UI,25,&H00E1DDD5,&H00E1DDD5,&H00120B06,&H00120B06,0,0,0,0,100,100,0,0,1,1.2,0,2,20,20,48,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''
    for event_index,e in enumerate(timeline['events']):
        start=e['start'];end=start+e['duration']+.65
        if event_index+1<len(timeline['events']):end=min(end,timeline['events'][event_index+1]['start']-.1)
        caption=e['text']
        if e['kind']=='digit':caption='{\\c&H79B9EF&}'+caption
        if e['kind']=='title':end=start+1.9
        text+=f'Dialogue: 0,{ass_time(start)},{ass_time(end)},Default,,0,0,0,,{{\\fad(120,250)}}{caption}\n'
    (P/'full-captions.ass').write_text(text,encoding='utf-8-sig')

fonts={n:ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',n) for n in (16,20)}
yy,xx=np.mgrid[0:H,0:W]
rad=np.exp(-(((xx-W*.5)/(W*.55))**2+((yy-H*.47)/(H*.7))**2)*2)
base=Image.fromarray(np.stack([5+rad*5,9+rad*11,18+rad*18],axis=-1).astype('uint8'))
fields=np.fromfile(P/'pendulum-fields.bin',dtype=np.int8).reshape(48,256,511)
fy,fx=np.mgrid[0:256,0:511]
triangle=(abs(fx-255)<=fy*1.7+3)
# A narrow red central structure, surrounded by the yellow granular field.
center=(abs(fx-255)<(3+10*(.5+.5*np.sin(fy*.1))**3))
def field_image(t,width,height):
    phase=(t/30*94)%94;index=int(phase);frac=phase-index
    def ping(i):return i if i<48 else 94-i
    v0=fields[ping(index)];v1=fields[ping((index+1)%94)]
    val=(v0==1)*(1-frac)+(v1==1)*frac
    # Colours are a new animation treatment, not the screenshot's exact bit palette.
    rgb=np.zeros((256,511,4),np.uint8)
    light=.83+.08*np.sin(2*np.pi*t/5)
    wing=(abs(fx-255)>fy*1.1)&triangle
    rgb[:,:,0]=np.where(center,245,val*245)*light
    rgb[:,:,1]=np.where(center,27,np.where(wing,val*28,val*218))*light
    rgb[:,:,2]=np.where(center,68,val*13)*light
    rgb[:,:,3]=triangle.astype(np.uint8)*235
    a=Image.fromarray(rgb).resize((width,height),Image.Resampling.NEAREST)
    d=ImageDraw.Draw(a);cx=width//2
    d.line((cx,0,cx,height),fill=(212,61,112,230),width=1)
    d.polygon([(cx-width*.12,height*.75),(cx+width*.12,height*.75),(cx,height*.94)],fill=(3,7,14,255),outline=(216,81,90,230),width=1)
    return a
def loop(variant):
    outfile=P/('clock-motion-loop.mp4' if variant=='clock' else 'journal-motion-loop.mp4')
    cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','960x540','-r','24','-i','-','-an','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p',str(outfile)]
    proc=subprocess.Popen(cmd,stdin=subprocess.PIPE)
    for frame in range(30*FPS):
        t=frame/FPS;im=base.copy().convert('RGBA');d=ImageDraw.Draw(im)
        d.text((480,34),'Z E R K A L I U S',font=fonts[20],fill=(156,167,180),anchor='mt')
        d.text((480,65),'1 0 0   1 1 0 0',font=fonts[16],fill=(88,108,128),anchor='mt')
        if variant=='clock':
            art=field_image(t,370,270)
            # Subdued evolving field between the two clock pendulums.
            art.putalpha(art.getchannel('A').point(lambda v:int(v*.46)))
            layer=Image.new('RGBA',(W,H));layer.alpha_composite(art,(295,110))
            layer=layer.rotate(5*math.sin(2*math.pi*t/5),resample=Image.Resampling.BICUBIC,center=(480,110),expand=False)
            im.alpha_composite(layer);d=ImageDraw.Draw(im)
            for side,cx in enumerate((285,675)):
                ang=math.sin(2*math.pi*t/5+side*.22)*.56;cy=154;length=176
                ex=cx+math.sin(ang)*length;ey=cy+math.cos(ang)*length
                color=(104,174,194) if side==0 else (227,173,103)
                d.arc((cx-178,cy-178,cx+178,cy+178),45,135,fill=(33,47,59),width=1)
                d.line((cx,cy,ex,ey),fill=color,width=2);d.ellipse((cx-3,cy-3,cx+3,cy+3),fill=color)
                d.polygon([(ex,ey-15),(ex+15,ey),(ex,ey+15),(ex-15,ey)],outline=color,width=2)
                phase=(t%5)/beat;slot=int(phase);pulse=math.exp(-(phase-slot)*5)*(1 if slot in (0,4,5) else .25) if slot!=3 else 0
                lc=tuple(int(c*max(.13,pulse)) for c in color);r=4+4*pulse
                d.ellipse((cx-r,370-r,cx+r,370+r),fill=lc)
        else:
            art=field_image(t,640,300)
            layer=Image.new('RGBA',(W,H));layer.alpha_composite(art,(160,105))
            layer=layer.rotate(8*math.sin(2*math.pi*t/5),resample=Image.Resampling.BICUBIC,center=(480,105),expand=False)
            im.alpha_composite(layer);d=ImageDraw.Draw(im)
            d.ellipse((477,102,483,108),fill=(233,175,117))
        d.rectangle((0,425,W,H),fill=(7,12,20,255))
        if frame==12*FPS:im.convert('RGB').save(P/(variant+'-full-preview.jpg'))
        proc.stdin.write(im.convert('RGB').tobytes())
        if frame and frame%(10*FPS)==0:print(variant+' loop: '+str(frame//FPS)+'/30 seconds',flush=True)
    proc.stdin.close()
    if proc.wait():raise RuntimeError('Loop encoding failed')
    print(variant+' animated loop ready',flush=True)

def mux(variant):
    source='zerkalius-1001100-sketch.mp4' if variant=='clock' else 'zerkalius-1001100-journal.mp4'
    loopfile='clock-motion-loop.mp4' if variant=='clock' else 'journal-motion-loop.mp4'
    output='zerkalius-1001100-'+variant+'-210s.mp4'
    filt="[0:v]trim=duration=30,setpts=PTS-STARTPTS[v0];[1:v]trim=duration=180,setpts=PTS-STARTPTS[v1];[v0][v1]concat=n=2:v=1:a=0,ass=full-captions.ass,fade=t=out:st=200:d=10[v]"
    cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-i',source,'-stream_loop','5','-i',loopfile,'-i','zerkalius-1001100-full-mix.wav','-filter_complex',filt,'-map','[v]','-map','2:a','-t','210','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',output]
    subprocess.run(cmd,check=True)
    print(output+' ready',flush=True)

if __name__=='__main__':
    mode=sys.argv[1] if len(sys.argv)>1 else 'all'
    if mode in ('all','audio'):music();subtitles()
    if mode in ('all','clock'):loop('clock');mux('clock')
    if mode in ('all','journal'):loop('journal');mux('journal')
