from pathlib import Path
p=Path(__file__).resolve().parent
s=(p/'build_adin.cjs').read_text(encoding='utf-8')
s=s.replace('voice-adin-v3','voice-odiin-v4').replace("{id:'a',duration:.070}","{id:'o',duration:.055}").replace("{id:'i',duration:.270}","{id:'i',duration:.430}").replace("{id:'n',duration:.105}","{id:'n',duration:.110}").replace('а-ди́н','оди́ин').replace('Short unstressed a','Short o').replace('Short stressed a-din','Long stressed o-diin')
(p/'build_odiin_v4.cjs').write_text(s,encoding='utf-8')
s=(p/'remix_voice_v3.py').read_text(encoding='utf-8').replace('voice-adin-v3','voice-odiin-v4').replace('mix-v3','mix-v4').replace('voice-v3','voice-v4').replace('adin-context-v3','odiin-context-v4').replace('voice-remix-v3','voice-remix-v4').replace('а-ди́н','оди́ин')
(p/'remix_voice_v4.py').write_text(s,encoding='utf-8')
