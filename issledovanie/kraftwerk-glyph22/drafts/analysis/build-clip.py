from pathlib import Path
from PIL import Image
import argparse,json,bisect,subprocess

parser=argparse.ArgumentParser()
parser.add_argument('--captures',type=Path,required=True)
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
src=args.captures
args.output.mkdir(parents=True,exist_ok=True)
samples=json.loads((src/'samples.json').read_text(encoding='utf-8'))
if len(samples)<568:
    parser.error('The original timing reconstruction requires all 568 captures.')
samples.sort(key=lambda s:(s['before']+s['after'])/2)
times=[(s['before']+s['after'])/2 for s in samples]
out=args.output/'glyph22-screen-excerpt-silent.mp4'
# Screenshot pixels differ from CSS pixels; these bounds isolate the video.
crop=(23,67,1327,801)
w,h=crop[2]-crop[0],crop[3]-crop[1]
cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pixel_format','rgb24','-video_size',f'{w}x{h}','-framerate','30','-i','pipe:0','-an','-c:v','libx264','-crf','18','-preset','medium','-pix_fmt','yuv420p','-movflags','+faststart','-metadata','comment=Screen-frame reconstruction of source 00:00-00:22; silent; timestamps preserved; not native source video',str(out)]
proc=subprocess.Popen(cmd,stdin=subprocess.PIPE)
mapping=[];last_file=None;frame=None
for i in range(660):
 t=i/30
 at=bisect.bisect_left(times,t)
 candidates=[j for j in (at-1,at) if 0<=j<len(times)]
 j=min(candidates,key=lambda j:abs(times[j]-t))
 s=samples[j]
 if s['file']!=last_file:
  frame=Image.open(src/s['file']).convert('RGB').crop(crop).tobytes()
  last_file=s['file']
 proc.stdin.write(frame)
 mapping.append({'output_time':t,'source_capture_midpoint':times[j],'source_file':s['file']})
proc.stdin.close()
assert proc.wait()==0
report={'source':'https://www.youtube.com/watch?v=BNYdUn7gmmI','start':0,'end':22,'duration':22,'audio':False,'native_source_download':False,'method':'Nearest timestamped browser screenshot resampled at 30 fps; source playback time preserved. Existing camera movement/crossfades remain.','captures':len(samples),'output_frames':660,'max_sample_time_error':max(abs(r['output_time']-r['source_capture_midpoint']) for r in mapping),'crop_screenshot_pixels':crop,'frames':mapping}
(args.output/'glyph22-clip-provenance.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='frames'},ensure_ascii=False))
