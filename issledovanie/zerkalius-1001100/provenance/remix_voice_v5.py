import pathlib,json,wave,math,subprocess
import numpy as np
P=pathlib.Path(__file__).resolve().parent;SR=48000
timeline=json.loads((P/'voice-timeline.json').read_text(encoding='utf-8'))
def read(name):
    with wave.open(str(P/name),'rb') as f:
        rate=f.getframerate();ch=f.getnchannels();a=np.frombuffer(f.readframes(f.getnframes()),'<i2').astype(np.float32)/32768
    return a.reshape(-1,ch),rate
def write(name,a):
    with wave.open(str(P/name),'wb') as f:
        f.setnchannels(1 if a.ndim==1 else a.shape[1]);f.setsampwidth(2);f.setframerate(SR);f.writeframes(np.clip(np.rint(a*32768),-32768,32767).astype('<i2').tobytes())
def fragment(name):
    a,sr=read(name);v=a[:,0]
    x=np.arange(round(len(v)*SR/sr))*sr/SR
    v=np.interp(x,np.arange(len(v)),v).astype(np.float32)
    rms=math.sqrt(float(np.mean(v*v)));gain=min(.043/max(rms,1e-8),.19/max(float(np.max(abs(v))),1e-8))
    return v*gain
mix,_=read('zerkalius-1001100-full-mix.wav')
old=np.zeros(len(mix),np.float32);new=np.zeros_like(old);changed=[]
for e in timeline['events']:
    start=round(e['start']*SR);v=fragment(e['file']);old[start:start+len(v)]+=v
    replace=e['language']=='ru' and e['kind']=='digit' and e['digitIndex'] in (0,3,4)
    if replace:v=fragment('voice-adiin-v5.wav');changed.append(e['start'])
    new[start:start+len(v)]+=v
gain=10**(-3/20);new*=gain
delta=new-old
# Change only the original dry voice and its existing two quiet reflections.
mix+=delta[:,None]*.7071
for delay,side,reflection in [(round(.029*SR),0,.055),(round(.037*SR),1,.045)]:mix[delay:,side]+=delta[:-delay]*reflection
write('zerkalius-1001100-mix-v5.wav',mix)
write('zerkalius-1001100-voice-v5.wav',new)
write('adiin-context-v5.wav',mix[round(46*SR):round(59.5*SR)])
manifest={'voiceGainDb':-3,'voiceLinearGain':gain,'replacedRussianOneStarts':changed,'newPronunciation':'ади́ин','newWordSeconds':len(fragment('voice-adiin-v5.wav'))/SR,
          'music':'Existing lossless mix retained; only old vocal contribution replaced. Original music, ducking and timings unchanged.',
          'sourceMix':'zerkalius-1001100-full-mix.wav','outputMix':'zerkalius-1001100-mix-v5.wav','peak':float(np.max(abs(mix))),
          'captionSpelling':'Один / один remains unchanged.'}
(P/'voice-remix-v5.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(manifest,ensure_ascii=True),flush=True)
