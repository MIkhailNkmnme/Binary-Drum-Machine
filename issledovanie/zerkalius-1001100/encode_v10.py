import pathlib,subprocess
p=pathlib.Path(__file__).resolve().parent
frames=list((p/'symbiosis-fullhd-v10-render').glob('step-*.png'))
if len(frames)!=720:raise RuntimeError(f'Need 720 frames, found {len(frames)}')
cmd=['ffmpeg','-hide_banner','-loglevel','warning','-y','-framerate','8/5','-i','symbiosis-fullhd-v10-render/step-%04d.png','-i','zerkalius-1001100-mix-v10-seven.wav','-vf','fps=24,ass=full-captions-v10.ass,fade=t=in:st=0:d=1,fade=t=out:st=440:d=10','-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart','-progress','encode-v10-progress.txt','zerkalius-1001100-symbiosis-fullhd-v10-seven.mp4']
subprocess.run(cmd,cwd=p,check=True)
print('Seven-language FullHD MP4 ready',flush=True)
