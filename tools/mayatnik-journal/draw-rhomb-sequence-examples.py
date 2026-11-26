"""Render selected exact source frames with bit-level highlighted matches."""

import json
from pathlib import Path
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont


REPO = Path(__file__).resolve().parents[2]
NODE_SOURCE = """
const {createPackedRhomb}=require('./tools/mayatnik-journal/rhomb-packed.cjs');
const {patterns,scan,steps}=require('./tools/mayatnik-journal/search-rhomb-sequences.cjs');
const {height,frame,reverse,pattern,dir}=JSON.parse(process.argv[1]);
const model=createPackedRhomb(height,{reverseAtContact:reverse});
while (model.frame<frame) model.advance();
const [,count,r,c,er,ec]=scan(model).find(row=>row[0]===pattern)[1].find(q=>q[0]===dir);
const text=patterns[pattern-5];
const [dx,dy]=steps[dir];
const out=Buffer.alloc(model.width*height);
for(let y=0;y<height;y++) for(let x=0;x<model.width;x++) out[y*model.width+x]=model.cell(y,x)+1;
for(let i=0;i<text.length;i++){
  if(model.cell(r-1+i*dy,c-1+i*dx)!==Number(text[i])) throw Error('Bit mismatch');
}
console.log(JSON.stringify({width:model.width,text,count,r,c,er,ec,dx,dy}));
process.stdout.write(out);
"""
BACKGROUND = "#091824"
INK = "#e1f1ee"
MUTED = "#b8d4df"
MARK = "#fbd171"
LATTICE = ["#18374a", "#245976", "#cde9e4"]
FONTS = {
    "title": ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 24),
    "body": ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16),
    "bits": ("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 16),
}


def text(draw, point, value, mode="body", fill=INK):
    source, size = FONTS[mode]
    draw.text(point, value, font=ImageFont.truetype(source, size), fill=fill)


def render(node, output, name, height, frame, reverse, pattern, direction):
    options = dict(height=height, frame=frame, reverse=reverse, pattern=pattern, dir=direction)
    payload = subprocess.check_output([node, "-e", NODE_SOURCE, json.dumps(options)], cwd=REPO)
    header, cells = payload.split(b"\n", 1)
    match = json.loads(header)
    width = match["width"]
    source = Image.frombytes("P", (width, height), cells)
    palette = [int(color[i:i+2], 16) for color in [*LATTICE, MARK] for i in (1, 3, 5)]
    source.putpalette(palette + [0] * (768 - len(palette)))
    src = source.convert("RGB")
    panel = Image.new("RGB", (1120, 570), BACKGROUND)
    draw = ImageDraw.Draw(panel)
    arrow = ["→", "↓", "↘", "↙"][direction]
    mode = "Разворот" if reverse else "Обычный ход"
    r, c, er, ec = (match[q] for q in ("r", "c", "er", "ec"))
    text(draw, (24, 19), f"Кадр {frame:,}  ·  {width} × {height}  ·  {mode}".replace(",", " "), "title")
    text(draw, (24, 55), f"Строка {pattern}  {arrow}  {r}:{c}  →  {er}:{ec}", fill=MARK)
    text(draw, (24, 82), match["text"], "bits")
    points = [(c - 1 + i * match["dx"], r - 1 + i * match["dy"]) for i in range(pattern)]
    if height <= 8:
        factor = 48
        view = (24, 128)
        panel.paste(src.resize((width * factor, height * factor), Image.Resampling.NEAREST), view)
        for y in range(height):
            for x in range(width):
                value = cells[y * width + x]
                p = view[0] + x * factor, view[1] + y * factor
                if value:
                    text(draw, (p[0] + 18, p[1] + 13), str(value - 1), "bits",
                         fill=BACKGROUND if value == 2 else INK)
        for i, (x, y) in enumerate(points):
            a = view[0] + x * factor, view[1] + y * factor
            draw.rectangle((a[0] + 2, a[1] + 2, a[0] + factor - 3, a[1] + factor - 3), fill=MARK)
            text(draw, (a[0] + 18, a[1] + 13), match["text"][i], "bits", BACKGROUND)
    else:
        logical_w = 785
        logical_h = round(logical_w * height / width)
        view = (24, 129)
        panel.paste(src.resize((logical_w, logical_h), Image.Resampling.BOX if height > 512 else Image.Resampling.NEAREST), view)
        projected = [(view[0] + (x + 0.5) * logical_w / width, view[1] + (y + 0.5) * logical_h / height)
                     for x, y in points]
        draw.line(projected, fill=MARK, width=3)
        if height > 512:
            x, y = projected[len(projected) // 2]
            draw.ellipse((x - 11, y - 11, x + 11, y + 11), outline=MARK, width=2)
        crop_box = (max(0, min(c, ec) - 6), max(0, min(r, er) - 4),
                    min(width, max(c, ec) + 5), min(height, max(r, er) + 3))
        crop = src.crop(crop_box)
        factor = min(270 // crop.width, 402 // crop.height)
        patch = (831, 129)
        panel.paste(crop.resize((crop.width * factor, crop.height * factor), Image.Resampling.NEAREST), patch)
        for x, y in points:
            px = patch[0] + (x - crop_box[0]) * factor
            py = patch[1] + (y - crop_box[1]) * factor
            draw.rectangle((px, py, px + factor - 1, py + factor - 1), fill=MARK)
        text(draw, (831, 540), "Увеличение цепочки", fill=MUTED)
    text(draw, (24, 540), "Жёлтым выделены только биты совпадения.", fill=MUTED)
    panel.save(output / (name + ".png"), optimize=True)
    if pattern >= 35:
        highlighted = source.copy()
        for point in points:
            highlighted.putpixel(point, 3)
        highlighted.save(output / (name + "-full.png"), optimize=True)


if __name__ == "__main__":
    destination = Path(sys.argv[2])
    destination.mkdir(parents=True, exist_ok=True)
    for args in (
        ("n8-f3-row5", 8, 3, False, 5, 2),
        ("n128-f15004-row24", 128, 15004, False, 24, 2),
        ("n4096-f1489-row37", 4096, 1489, True, 37, 1),
        ("n4096-f13652-row35", 4096, 13652, False, 35, 1),
    ):
        render(sys.argv[1], destination, *args)
        print(args[0], flush=True)
