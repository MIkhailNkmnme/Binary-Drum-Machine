import json, pathlib, wave
import numpy as np

P = pathlib.Path(__file__).resolve().parent
SR = 48000

def read(name):
    with wave.open(str(P/name), 'rb') as f:
        assert f.getframerate() == SR and f.getsampwidth() == 2
        return np.frombuffer(f.readframes(f.getnframes()), '<i2').astype(np.float32).reshape(-1, f.getnchannels()) / 32768

def write(name, a):
    with wave.open(str(P/name), 'wb') as f:
        f.setnchannels(a.shape[1]); f.setsampwidth(2); f.setframerate(SR)
        f.writeframes(np.clip(np.rint(a*32768), -32768, 32767).astype('<i2').tobytes())

mix = read('zerkalius-1001100-mix-v4.wav')
rain = read('rain-noise-source-v4.wav')
assert rain.shape == mix.shape
rain *= .0045 / np.sqrt(np.mean(rain**2, axis=0))
rng = np.random.default_rng(1001100)
N = len(rain)
for _ in range(round(210*7)):
    length = int(rng.uniform(.025, .065)*SR)
    start = int(rng.integers(0, N-length))
    t = np.arange(length)/SR
    drop = np.convolve(rng.standard_normal(length), [.12,.2,.36,.2,.12], 'same')
    drop *= (1-np.exp(-t/.002))*np.exp(-t/.012)
    drop *= rng.uniform(.004,.012)
    pan = rng.uniform(.1,.9)
    rain[start:start+length] += (drop[:,None]*np.array([np.sqrt(1-pan),np.sqrt(pan)])).astype(np.float32)

t = np.arange(N, dtype=np.float32)/SR
level = np.interp(t, np.arange(0,216,5), rng.uniform(.78,1.22,44)).astype(np.float32)
level *= np.clip(t/3,0,1)*np.clip((210-t)/10,0,1)
speech = np.zeros(N, np.float32)
timeline = json.loads((P/'voice-timeline.json').read_text(encoding='utf-8'))
for e in timeline['events']:
    start = e['start']; duration = e['duration']
    if e['language']=='ru' and e['kind']=='digit' and e['digitIndex'] in (0,3,4): duration=.6880208333333333
    a=max(0,int((start-.2)*SR)); b=min(N,int((start+duration+.5)*SR))
    local=t[a:b]
    env=np.minimum(np.clip((local-start+.2)/.2,0,1),np.clip((start+duration+.5-local)/.5,0,1))
    speech[a:b]=np.maximum(speech[a:b],env)
level *= 1-.55*speech
rain *= level[:,None]
result=mix+rain
assert np.max(abs(result)) < 1
write('rain-bed-v4.wav', rain)
write('zerkalius-1001100-mix-rain-v4.wav', result)
write('odiin-rain-context-v4.wav', result[46*SR:int(59.5*SR)])
manifest={
 'source':'Original procedural sound only: two seeded pink-noise generators, bandpass 350–6000 Hz, damped random-noise droplets. No samples or borrowed recording.',
 'noiseSeeds':[1001100,1001101], 'dropletSeed':1001100, 'dropletsPerSecond':7,
 'baseRms':.0045, 'speechRainGain':.45, 'fadeInSeconds':3, 'fadeOutSeconds':10,
 'durationSeconds':N/SR, 'rainRms':float(np.sqrt(np.mean(rain**2))),
 'rainPeak':float(np.max(abs(rain))), 'mixPeak':float(np.max(abs(result))),
 'musicAndVoice':'v4 mix retained at original level; rain added without global normalization.',
 'video':'zerkalius-1001100-symbiosis-fullhd-v4-rain.mp4'
}
(P/'rain-v4-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(manifest,ensure_ascii=True))
