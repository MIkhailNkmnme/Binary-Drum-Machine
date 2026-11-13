"""Package user-facing downloads without temporary renders or dependencies."""
from pathlib import Path
import json
import zipfile
import hashlib
import sys

ROOT = Path(__file__).resolve().parent

def main():
    music = json.loads((ROOT/'music.json').read_text(encoding='utf-8-sig'))
    art = json.loads((ROOT/'wallpapers.json').read_text(encoding='utf-8-sig'))
    downloads = ROOT/'downloads'
    downloads.mkdir(exist_ok=True)
    sound, notices, walls = [], [], []
    for t in music['tracks']:
        sound.append((t['src'], 'Tracks/'+Path(t['src']).name))
        for fmt in ['mp3','m4r']:
            src=t['ringtone'][fmt]
            sound.append((src, 'Ringtones/'+Path(src).name))
    for name in ['pendulum-drive','two-shores-canon']:
        sound.append(('../../mayatnik/synthesis-album/'+name+'.mp3', 'Tracks/'+name+'.mp3'))
    for n in music['notifications']:
        for fmt in ['src','wav']:
            src=n[fmt]
            notices.append((src, 'Notifications/'+Path(src).name))
    for p in art['wallpapers']:
        walls.append((p['src'], 'Wallpapers/'+p['variant']+'/'+Path(p['src']).name))
    geometric=[(p['src'], 'Wallpapers/'+p['category']+'/'+Path(p['src']).name)
               for p in art['wallpapers'] if p.get('category')]
    groups={'zerkalius-music':sound, 'zerkalius-notifications':notices,
            'zerkalius-wallpapers':walls, 'zerkalius-phone-theme':sound+notices+walls}
    if geometric: groups['zerkalius-geometric-wallpapers']=geometric
    instructions=(ROOT/'DOWNLOADS.txt').read_bytes()
    report=[]
    if '--wallpapers-only' in sys.argv:
        groups={key:value for key,value in groups.items() if key not in ['zerkalius-music','zerkalius-notifications']}
        previous=json.loads((downloads/'manifest.json').read_text(encoding='utf-8'))
        report=[row for row in previous if Path(row['file']).stem not in groups]
    for name,files in groups.items():
        target=downloads/(name+'.zip')
        with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
            z.writestr('READ-ME.txt',instructions)
            for source,entry in files:
                z.write((ROOT/source).resolve(),entry)
        with zipfile.ZipFile(target) as z:
            assert z.testzip() is None
            for source,entry in files:
                assert z.read(entry)==(ROOT/source).read_bytes(),entry
        data=target.read_bytes()
        report.append({'file':'downloads/'+target.name,'bytes':len(data),'files':len(files)+1,
                       'sha256':hashlib.sha256(data).hexdigest(),'verifiedAgainstSources':True})
        print(target.name, len(files)+1, round(len(data)/1024/1024,2), 'MiB')
    (ROOT/'downloads/manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

if __name__=='__main__':
    main()
