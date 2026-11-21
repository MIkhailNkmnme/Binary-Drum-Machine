import pathlib,json,zlib,math,subprocess,os
import numpy as np
from PIL import Image,ImageDraw,ImageFont
P=pathlib.Path(__file__).resolve().parent;S=P/'even-scene-v10';OUT=P/'symbiosis-fullhd-v10-render';OUT.mkdir(exist_ok=True)
scene=json.loads((S/'manifest.json').read_text(encoding='utf-8'))
W,H=1920,1080
fonts={n:ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',n) for n in (28,36)}
yy,xx=np.mgrid[0:H,0:W];rad=np.exp(-(((xx-W*.5)/(W*.55))**2+((yy-H*.47)/(H*.7))**2)*2)
base=Image.fromarray(np.stack([5+rad*5,9+rad*11,18+rad*18],axis=-1).astype('uint8')).convert('RGBA')
palette=np.array([[0,0,0,0],[5,10,18,248],[224,178,88,248],[99,45,57,248],[224,117,112,248]],np.uint8)
for item in scene['frames']:
    i=item['index']
    target=OUT/f'step-{i:04}.png'
    if target.exists():continue
    original=P/'symbiosis-fullhd-v3-render'/target.name
    if i<336 and original.exists():
        os.link(original,target)
        continue
    labels=np.frombuffer(zlib.decompress((S/item['file']).read_bytes()),np.uint8).reshape(scene['crop']['height'],scene['crop']['width'])
    # Render directly from the 2052x1024 source; do not upscale the old video.
    art=Image.fromarray(palette[labels]).resize((1400,699),Image.Resampling.LANCZOS)
    im=base.copy();layer=Image.new('RGBA',(W,H));layer.alpha_composite(art,(260,150))
    angle=8*math.sin(2*math.pi*i/8)
    layer=layer.rotate(angle,resample=Image.Resampling.BICUBIC,center=(960,150),expand=False)
    im.alpha_composite(layer);d=ImageDraw.Draw(im)
    d.text((960,38),'Z E R K A L I U S',font=fonts[36],fill=(156,167,180),anchor='mt')
    d.text((960,96),'1 0 0   1 1 0 0',font=fonts[28],fill=(88,108,128),anchor='mt')
    d.ellipse((955,145,965,155),fill=(218,164,103))
    for side,cx in enumerate((570,1350)):
        ang=math.sin(2*math.pi*i/8+side*.22)*.56;cy=275;length=352
        ex=cx+math.sin(ang)*length;ey=cy+math.cos(ang)*length
        color=(104,174,194) if side==0 else (227,173,103)
        d.arc((cx-356,cy-356,cx+356,cy+356),45,135,fill=(37,51,63),width=2)
        d.line((cx,cy,ex,ey),fill=(6,12,20),width=9);d.line((cx,cy,ex,ey),fill=color,width=3)
        d.ellipse((cx-5,cy-5,cx+5,cy+5),fill=color)
        d.polygon([(ex,ey-29),(ex+29,ey),(ex,ey+29),(ex-29,ey)],fill=(8,15,24,255),outline=color,width=3)
        slot=i%8;strength=1 if slot in (0,4,5) else .25 if slot!=3 else .08
        lc=tuple(int(c*strength) for c in color);r=8+8*strength
        d.ellipse((cx-r,740-r,cx+r,740+r),fill=lc)
    d.rectangle((0,958,W,H),fill=(7,12,20,255))
    image=im.convert('RGB');image.save(OUT/f'step-{i:04}.png')
    if i==0:image.save(P/'symbiosis-fullhd-v10-preview.jpg',quality=95)
    if i%48==0:print(f'Full HD: {i+1}/{scene["count"]} positions',flush=True)
