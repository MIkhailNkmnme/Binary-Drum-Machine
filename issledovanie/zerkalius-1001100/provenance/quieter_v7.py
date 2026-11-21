import pathlib, json, wave, math
import numpy as np
P=pathlib.Path(__file__).resolve().parent
SR=48000
def read(name):
    with wave.open(str(P/name),'rb') as f:
        rate=f.getframerate(); channels=f.getnchannels()
        a=np.frombuffer(f.readframes(f.getnframes()),'<i2').astype(np.float64).reshape(-1,channels)/32768
    return a,rate
def write(name,a):
    with wave.open(str(P/name),'wb') as f:
        f.setnchannels(a.shape[1]); f.setsampwidth(2); f.setframerate(SR)
        f.writeframes(np.clip(np.rint(a*32768),-32768,32767).astype('<i2').tobytes())
mix,_=read('zerkalius-1001100-mix-rain-v5.wav')
dry,_=read('zerkalius-1001100-mix-v5.wav')
rain=mix-dry
voice=np.zeros(len(mix),np.float32)
timeline=json.loads((P/'voice-timeline.json').read_text(encoding='utf-8'))
for e in timeline['events']:
    name=e['file']
    if e['language']=='ru' and e['kind']=='digit' and e['digitIndex'] in (0,3,4):name='voice-adiin-v5.wav'
    a,sr=read(name); v=a[:,0].astype(np.float32)
    x=np.arange(round(len(v)*SR/sr))*sr/SR
    v=np.interp(x,np.arange(len(v)),v).astype(np.float32)
    rms=math.sqrt(float(np.mean(v*v)))
    v*=min(.043/max(rms,1e-8),.19/max(float(np.max(abs(v))),1e-8))
    start=round(e['start']*SR);voice[start:start+len(v)]+=v
voice*=10**(-3/20)
stem=np.repeat((voice*.7071)[:,None],2,axis=1).astype(np.float64)
for delay,side,gain in [(round(.029*SR),0,.055),(round(.037*SR),1,.045)]:
    stem[delay:,side]+=voice[:-delay]*gain
previous,_=read('zerkalius-1001100-mix-rain-v6.wav')
result=previous-.25*stem
assert np.max(abs(result))<1
write('zerkalius-1001100-mix-rain-v7.wav',result)
write('zerkalius-1001100-voice-v7.wav',(.25*voice)[:,None])
write('quiet-context-v7.wav',result[46*SR:int(59.5*SR)])
assert np.array_equal(result[stem==0],previous[stem==0])
report={'voiceGainRelativeToV6':.5,'rainGainRelativeToV6':1,'musicGainRelativeToV6':1,'gainChangeDb':20*math.log10(.5),'totalVoiceGainDb':-3+20*math.log10(.25),'pronunciation':'ади́ин','duration':len(result)/SR,'peak':float(np.max(abs(result))),'sourceVideo':'zerkalius-1001100-symbiosis-fullhd-v6-rain.mp4','outputVideo':'zerkalius-1001100-symbiosis-fullhd-v7-rain.mp4','silentVoiceRegionsUnchanged':True}
(P/'quiet-v7-manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=True))
