"""Render the inferred unit edges over the evidence and record ambiguous segments."""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent


def crop_glyph(source, glyph):
    x, y, dx, dy = glyph['alignment']
    left = round(x - 1.2 * dx)
    top = round(y - 1.2 * dy)
    right = round(x + 9.2 * dx)
    bottom = round(y + 13.2 * dy)
    crop = source.crop((left,top,right,bottom)).resize((168,240),Image.Resampling.BICUBIC)
    points = {n['id']:((x + n['x'] * dx-left)*168/(right-left),
                      (y + n['y'] * dy-top)*240/(bottom-top)) for n in glyph['nodes']}
    return crop, points


def draw_overlay(source, glyph):
    crop, points = crop_glyph(source,glyph)
    under = Image.blend(crop,Image.new('RGB',crop.size,'#111720'),.33)
    pen = ImageDraw.Draw(under)
    degree = {}
    for edge in glyph['edges']:
        a, b = edge['from'], edge['to']
        pen.line((points[a],points[b]),fill='#5ce4d6' if edge['score']>=.60 else '#ff8c59',width=2)
        degree[a] = degree.get(a,0) + 1
        degree[b] = degree.get(b,0) + 1
    for point,count in degree.items():
        if count == 4:
            x,y = points[point]
            pen.ellipse((x-3,y-3,x+3,y+3),fill='#ffd56e')
    selected = {edge['id'] for edge in glyph['edges']}
    for edge in glyph['uncertainEdges']:
        if edge['id'] in selected:
            continue
        a,b = points[edge['from']],points[edge['to']]
        pen.ellipse(((a[0]+b[0])/2-2,(a[1]+b[1])/2-2,(a[0]+b[0])/2+2,(a[1]+b[1])/2+2),fill='#ff649a')
    return crop, under


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--graphs',type=Path,default=HERE/'graphs.json')
    p.add_argument('--captures',type=Path,default=HERE.parent/'drafts/witnesses')
    p.add_argument('--output',type=Path,default=HERE/'overlays')
    args=p.parse_args()
    args.output.mkdir(parents=True,exist_ok=True)
    graphs=json.loads(args.graphs.read_text(encoding='utf-8'))
    for i, frame in enumerate(graphs['frames'],1):
        source=Image.open(args.captures/frame['witness']['file']).convert('RGB')
        sheet=Image.new('RGB',(4*180+16,529),'#10151e')
        d=ImageDraw.Draw(sheet)
        d.text((10,7),f"{frame['witness']['file']}   /   {frame['witness']['after']:.3f} s   /   yellow trace and inferred edges",fill='#e7dbc2')
        for glyph in frame['glyphs']:
            original, over=draw_overlay(source,glyph)
            x=10+(glyph['slot']-1)*180
            sheet.paste(original,(x,26))
            sheet.paste(over,(x,276))
            flag = glyph.get('confidence','draft')
            d.text((x,516),f"{glyph['slot']} · {flag}",fill='#dbe4f0')
        sheet.save(args.output/f'{i:02d}.jpg',quality=90,subsampling=0)


if __name__=='__main__':
    main()
