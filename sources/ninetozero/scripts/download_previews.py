from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
import json,requests,subprocess,hashlib,re,os,shutil
ROOT=Path(__file__).resolve().parents[1]
notes=json.loads((ROOT/'releases.json').read_text(encoding='utf-8-sig'))
print(json.dumps({'keys':list(notes),'release_keys':list(notes['releases'][0]),'track_keys':list(notes['releases'][0]['tracks'][0])}),flush=True)
(ROOT/'audio').mkdir(exist_ok=True)
def download(item):
    release_index,track_index,track=item
    title=track.get('title') or track.get('name') or str(track_index)
    slug=re.sub('[^a-z0-9]+','-',title.lower()).strip('-')[:80]
    target=ROOT/'audio'/f'{release_index:02d}-{track_index:02d}-{slug}-preview.m4a'
    try:
        if not target.exists():
            r=requests.get(track['previewUrl'],timeout=40);r.raise_for_status()
            target.write_bytes(r.content)
        probe=subprocess.run([os.environ.get('FFMPEG_PROBE') or shutil.which('ffprobe') or 'ffprobe','-v','error','-show_entries','format=duration:stream=codec_name,codec_type','-of','json',str(target)],check=True,capture_output=True,text=True)
        media=json.loads(probe.stdout)
        if not any(s.get('codec_type')=='audio' for s in media.get('streams',[])):raise ValueError('No audio stream')
        duration=float(media.get('format',{}).get('duration',0))
        if duration<=0:raise ValueError('Empty audio')
        return release_index,track_index,{'file':target.relative_to(ROOT).as_posix(),'duration_seconds':duration,'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'status':'saved','kind':'preview','mime':'audio/mp4'}
    except Exception as error:return release_index,track_index,{'status':'error','error':str(error),'kind':'preview'}
jobs=[(r,t,track) for r,release in enumerate(notes['releases']) for t,track in enumerate(release['tracks']) if track.get('previewUrl')]
with ThreadPoolExecutor(max_workers=4) as pool:
    for future in as_completed([pool.submit(download,job) for job in jobs]):
        r,t,data=future.result();notes['releases'][r]['tracks'][t]['local_audio']=data
        print(json.dumps({'release_index':r,'track_index':t,**data}),flush=True)
notes['audio_note_ru']='Сохранены публичные превью Apple Music, доступные по официальным LISTEN-ссылкам. Это фрагменты, не полные композиции. Длительность каждого сохранённого файла измерена FFprobe отдельно от длительности полного трека.'
(ROOT/'releases.json').write_text(json.dumps(notes,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Saved release catalog',flush=True)
