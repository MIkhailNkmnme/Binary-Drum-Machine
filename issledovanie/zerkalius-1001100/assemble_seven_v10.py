"""450-second extension of the accepted v9 procedural mix; no global normalization."""
import json, math, pathlib, subprocess, wave
import numpy as np

P = pathlib.Path(__file__).resolve().parent
SR, DUR = 48000, 450
N = SR * DUR
VOICE_GAIN = .375 * 10**(-3/20)
RAINGAIN = .5

def read(name):
    with wave.open(str(P/name), 'rb') as f:
        sr, channels = f.getframerate(), f.getnchannels()
        a = np.frombuffer(f.readframes(f.getnframes()), '<i2').astype(np.float32).reshape(-1,channels)/32768
    return a,sr

def write(name,a):
    with wave.open(str(P/name),'wb') as f:
        f.setnchannels(1 if a.ndim==1 else a.shape[1]);f.setsampwidth(2);f.setframerate(SR)
        for start in range(0,len(a),SR*10):
            f.writeframes(np.clip(np.rint(a[start:start+SR*10]*32768),-32768,32767).astype('<i2').tobytes())

original = json.loads((P/'voice-timeline.json').read_text(encoding='utf-8'))
extra = json.loads((P/'extra-voice-timeline-v10.json').read_text(encoding='utf-8'))
events = original['events'] + extra['events']
music = np.zeros((N,2),np.float32)

def tone(at,dur,freq,level,pan=0,soft=False):
    start=round(at*SR);count=min(round(dur*SR),N-start)
    if count<=0:return
    t=np.arange(count,dtype=np.float32)/SR
    env=(1-np.exp(-t/(.09 if soft else .014)))*np.exp(-t/(1.1 if soft else .19))*np.minimum(1,(dur-t)/.12).clip(0,1)
    v=(np.sin(2*np.pi*freq*t)+.17*np.sin(4*np.pi*freq*t+.1))*env*level
    music[start:start+count,0]+=v*math.sqrt((1-pan)/2)
    music[start:start+count,1]+=v*math.sqrt((1+pan)/2)

bits=[1,0,0,1,1,0,0];slots=[0,1,2,4,5,6,7]
factors=[1,1,1.122462,1,1.33484,1,1,1,1.122462,1,1.33484,1,1,1,1]
for k in range(48,DUR*96//60):
    at=k*.625;factor=factors[int(at/30)]
    tail=max(0,min(1,(DUR-at)/24)) if at>=420 else 1
    tone(at,.55,55,.105*tail)
    if k%8 in slots:
        ix=slots.index(k%8);freq=[220,261.6256,329.6276][ix%3]*factor
        tone(at,1.5,freq,(.045 if bits[ix] else .016)*tail,-.45)
        tone(at+.3125,1.5,freq*1.5,.024*tail,.45)
for at in range(30,DUR,5):
    tail=max(0,min(1,(DUR-at)/24)) if at>=420 else 1
    for f in (110,164.8138,261.6256):tone(at,5,f,.027*tail,soft=True)
np.tanh(music*1.4,out=music)
intro,_=read('zerkalius-1001100-sketch.wav');music[:len(intro)]=intro
music[30*SR:31*SR]*=np.linspace(0,1,SR,dtype=np.float32)[:,None]
vocal=np.zeros(N,np.float32);duck=np.zeros(N,np.float32)
levels=[]
for e in events:
    if e['language']=='ru' and e['kind']=='digit' and e.get('digitIndex') in (0,3,4):
        e['file']='voice-adiin-v5.wav'
    v,sr=read(e['file']);v=v[:,0]
    if sr!=SR:v=np.interp(np.arange(round(len(v)*SR/sr))*sr/SR,np.arange(len(v)),v).astype(np.float32)
    rms=float(np.sqrt(np.mean(v*v)));peak=float(np.max(abs(v)))
    gain=min(.043/max(rms,1e-8),.19/max(peak,1e-8))
    v*=gain*VOICE_GAIN
    start=round(e['start']*SR);vocal[start:start+len(v)]+=v
    e['duration']=len(v)/SR
    ds=max(0,start-round(.15*SR));de=min(N,start+len(v)+round(.4*SR))
    env=np.ones(de-ds,np.float32);attack=start-ds;release=de-start-len(v)
    if attack:env[:attack]=np.linspace(0,1,attack)
    if release:env[-release:]=np.linspace(1,0,release)
    duck[ds:de]=np.maximum(duck[ds:de],env)
    levels.append({'language':e['language'],'text':e['text'],'start':e['start'],'duration':e['duration'],'rawRms':rms,'normalizationGain':gain,'finalGain':gain*VOICE_GAIN,'finalRms':float(np.sqrt(np.mean(v*v)))})
music*=1-.58*duck[:,None]
del duck
music[-8*SR:]*=np.linspace(1,0,8*SR,dtype=np.float32)[:,None]
voice=np.repeat((vocal*.7071)[:,None],2,axis=1)
for delay,side,gain in [(round(.029*SR),0,.055),(round(.037*SR),1,.045)]:voice[delay:,side]+=vocal[:-delay]*gain
del vocal
write('zerkalius-1001100-voice-v10-seven.wav',voice)
music+=voice;del voice
print('Music and seven procedural voices assembled',flush=True)

noise=P/'rain-noise-source-v10.wav'
if not noise.exists():
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','lavfi','-i',
        'anoisesrc=color=pink:sample_rate=48000:seed=1001100:duration=450[a];anoisesrc=color=pink:sample_rate=48000:seed=1001101:duration=450[b];[a][b]amerge=inputs=2,highpass=f=350,lowpass=f=6000',
        '-c:a','pcm_s16le',str(noise)],check=True)
rain,_=read(noise.name)
rain*=.0045/np.sqrt(np.mean(rain**2,axis=0))
rng=np.random.default_rng(1001100)
for _ in range(round(DUR*7)):
    length=int(rng.uniform(.025,.065)*SR);start=int(rng.integers(0,N-length));t=np.arange(length)/SR
    drop=np.convolve(rng.standard_normal(length),[.12,.2,.36,.2,.12],'same')
    drop*=(1-np.exp(-t/.002))*np.exp(-t/.012)*rng.uniform(.004,.012)
    pan=rng.uniform(.1,.9)
    rain[start:start+length]+=(drop[:,None]*np.array([np.sqrt(1-pan),np.sqrt(pan)])).astype(np.float32)
t=np.arange(N,dtype=np.float32)/SR
knots=np.arange(0,DUR+6,5)
level=np.interp(t,knots,rng.uniform(.78,1.22,len(knots))).astype(np.float32)
level*=np.clip(t/3,0,1)*np.clip((DUR-t)/10,0,1)*RAINGAIN
speech=np.zeros(N,np.float32)
for e in events:
    start,duration=e['start'],e['duration'];a=max(0,int((start-.2)*SR));b=min(N,int((start+duration+.5)*SR))
    local=t[a:b]
    env=np.minimum(np.clip((local-start+.2)/.2,0,1),np.clip((start+duration+.5-local)/.5,0,1))
    speech[a:b]=np.maximum(speech[a:b],env)
level*=1-.55*speech;rain*=level[:,None]
del t,level,speech
write('rain-bed-v10-seven.wav',rain)
music+=rain;del rain

# Keep the accepted first three languages and their entire accompaniment PCM-exact.
accepted,_=read('zerkalius-1001100-mix-rain-v9.wav')
music[:180*SR]=accepted[:180*SR]
# Extend past the old outro; blend the original rain texture at the join for 250 ms.
join=180*SR;fade=np.linspace(0,1,SR//4,dtype=np.float32)[:,None]
music[join:join+len(fade)]=accepted[join:join+len(fade)]*(1-fade)+music[join:join+len(fade)]*fade
peak=float(np.max(abs(music)))
if peak>=1:raise RuntimeError(f'Unexpected clipping: {peak}')
write('zerkalius-1001100-mix-v10-seven.wav',music)
del music,accepted
timeline={'duration':DUR,'events':events,'extraVoiceSourceCommit':extra['sourceCommit']}
(P/'voice-timeline-v10-seven.json').write_text(json.dumps(timeline,ensure_ascii=False,indent=2),encoding='utf-8')

def stamp(t):
    cs=round(t*100);h,cs=divmod(cs,360000);m,cs=divmod(cs,6000);s,cs=divmod(cs,100)
    return f'{h}:{m:02}:{s:02}.{cs:02}'
ass=(P/'full-captions.ass').read_text(encoding='utf-8-sig').split('[Events]')[0]
default=next(line for line in ass.splitlines() if line.startswith('Style: Default'))
ass+=default.replace('Style: Default,Segoe UI','Style: Japanese,Yu Gothic')+'\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'
for i,e in enumerate(events):
    start=e['start'];end=start+e['duration']+.65
    if i+1<len(events):end=min(end,events[i+1]['start']-.1)
    caption=e['text'];style='Japanese' if e['language']=='ja' else 'Default'
    if e['kind']=='digit':caption='{\\c&H79B9EF&}'+caption
    if e['kind']=='title':end=start+1.9
    ass+=f'Dialogue: 0,{stamp(start)},{stamp(end)},{style},,0,0,0,,{{\\fad(120,250)}}{caption}\n'
(P/'full-captions-v10.ass').write_text(ass,encoding='utf-8-sig')
manifest={'durationSeconds':DUR,'languages':['ru','en','de','fr','it','es','ja'],'blockStarts':[30,90,150,210,270,330,390],
    'voiceGain':VOICE_GAIN,'voiceDb':20*math.log10(VOICE_GAIN),'rainGainRelativeToV4':RAINGAIN,'rainBaseRms':.00225,
    'musicDuckAmount':.58,'rainSpeechGain':.45,'globalNormalization':False,'peak':peak,
    'acceptedPrefixSeconds':180,'prefixSource':'zerkalius-1001100-mix-rain-v9.wav','joinBlendSeconds':.25,
    'voiceSourceCommit':extra['sourceCommit'],'voiceEvents':levels,
    'provenance':'Original mathematical synthesis only; original v9 prefix retained. No external voices, samples, music or recordings.'}
(P/'seven-language-v10-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'450-second mix ready; peak {peak:.6f}; accepted voice gain {VOICE_GAIN:.8f}; rain gain {RAINGAIN}',flush=True)
