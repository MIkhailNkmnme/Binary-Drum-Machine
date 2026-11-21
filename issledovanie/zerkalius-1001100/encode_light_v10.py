from pathlib import Path
import subprocess
P=Path(__file__).resolve().parent
source=P/'zerkalius-1001100-symbiosis-fullhd-v10-seven.mp4'
output=P/'zerkalius-1001100-symbiosis-v10-light-720p.mp4'
subprocess.run(['ffmpeg','-hide_banner','-loglevel','warning','-y','-i',str(source),'-vf','scale=1280:720:flags=lanczos','-c:v','libx264','-preset','slow','-b:v','900k','-maxrate','1200k','-bufsize','2400k','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart','-progress',str(P/'encode-light-progress.txt'),str(output)],check=True)
print(output.name,output.stat().st_size,flush=True)
