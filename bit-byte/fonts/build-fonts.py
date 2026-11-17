"""Generate BitByte Operator assets from the checked-in Azbuk font sources.
Requires Python fonttools + brotli and Node.js. No network access is used.
The generated font software and this generator are distributed under OFL-1.1.
"""
from pathlib import Path
import json
import shutil
import subprocess
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parents[1] / "azbuk" / "fonts"
FAMILY = "BitByte Operator"

# Execute the same source algorithm used by Azbuk, with its original masks.
node_source = r"""
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const context = {window: {}};
vm.createContext(context);
for (const file of ['operator-masks.js', 'operator-cyrillic.js']) {
  vm.runInContext(fs.readFileSync(path.join(process.argv[1], file), 'utf8'), context, {filename: file});
}
process.stdout.write(JSON.stringify(context.window.AzbukOperatorCyrillic));
"""
variants = json.loads(subprocess.check_output(["node", "-e", node_source, str(SOURCE)], text=True, encoding="utf-8"))
alphabet = [chr(code) for code in range(0x410, 0x450)] + ["Ё", "ё"]

for weight, font_id in [("Regular", "operator"), ("Bold", "operator-bold")]:
    font = TTFont(SOURCE / ("8bitOperatorPlus-" + weight + ".ttf"), recalcTimestamp=False)
    masks = variants[font_id]["masks"]
    descend = variants[font_id]["descend"]
    order = font.getGlyphOrder()
    # Match the original left bearing and right side spacing of the capital H.
    reference = font.getBestCmap()[ord("H")]
    original = font["glyf"][reference]
    advance, bearing = font["hmtx"][reference]
    right_space = advance - original.xMax
    for char in alphabet:
        name = "uni%04X" % ord(char)
        rows = masks[char]
        width = max(map(len, rows)) * 100
        bottom_rows = descend.get(char, 0)
        pen = TTGlyphPen(None)
        for row_index, row in enumerate(rows):
            # Rows end at baseline minus descend; every occupied cell is 100 square units.
            bottom = (len(rows) - bottom_rows - row_index - 1) * 100
            for column, bit in enumerate(row):
                if bit != "1":
                    continue
                left = bearing + column * 100
                pen.moveTo((left, bottom))
                pen.lineTo((left, bottom + 100))
                pen.lineTo((left + 100, bottom + 100))
                pen.lineTo((left + 100, bottom))
                pen.closePath()
        font["glyf"][name] = pen.glyph()
        font["hmtx"][name] = (bearing + width + right_space, bearing)
        if name not in order:
            order.append(name)
        for table in font["cmap"].tables:
            if table.isUnicode():
                table.cmap[ord(char)] = name
    font.setGlyphOrder(order)
    font["maxp"].numGlyphs = len(order)
    font["OS/2"].ulUnicodeRange1 |= 1 << 9  # Cyrillic coverage
    font["OS/2"].usLastCharIndex = max(font["OS/2"].usLastCharIndex, 0x451)
    # Rename every family/full/PostScript/style record. Reserved name remains only
    # in attribution/license text, never in the derived font's identifying names.
    names = font["name"]
    replacement_ids = {0, 1, 2, 3, 4, 6, 13, 14, 16, 17, 18, 21, 22}
    names.names = [record for record in names.names if record.nameID not in replacement_ids]
    values = {
        0: "Copyright (c) 2009 - 2014 Grand Chaos Productions. Cyrillic masks: Zerkulis Azbuk project.",
        1: FAMILY, 2: weight, 3: FAMILY + " " + weight + "; Azbuk Cyrillic 1",
        4: FAMILY + " " + weight, 6: "BitByteOperator-" + weight,
        13: "Licensed under the SIL Open Font License, Version 1.1. Derived from 8-bit Operator+ by Grand Chaos Productions (2009-2014).",
        14: "https://openfontlicense.org", 16: FAMILY, 17: weight,
    }
    for name_id, value in values.items():
        names.setName(value, name_id, 3, 1, 0x409)
        names.setName(value, name_id, 1, 0, 0)
    stem = "bitbyte-operator-" + weight.lower()
    font.flavor = None
    font.save(HERE / (stem + ".ttf"))
    font.flavor = "woff2"
    font.save(HERE / (stem + ".woff2"))

# Standalone SVG outlines use the ORIGINAL Bold digit contours, not reconstructed
# masks or text rendering. Their visual bounds run from y=.20 through y=.85.
original = TTFont(SOURCE / "8bitOperatorPlus-Bold.ttf", recalcTimestamp=False)
glyphs = original.getGlyphSet()
paths = {}
for digit in "01":
    glyph = glyphs[original.getBestCmap()[ord(digit)]]
    bounds = BoundsPen(glyphs)
    glyph.draw(bounds)
    xmin, ymin, xmax, ymax = bounds.bounds
    scale = .65 / (ymax - ymin)
    transform = (scale, 0, 0, -scale, .5 - scale * (xmin + xmax) / 2, .85 + scale * ymin)
    number = lambda value: format(value, ".6f").rstrip("0").rstrip(".") or "0"
    pen = SVGPathPen(glyphs, ntos=number)
    glyph.draw(TransformPen(pen, transform))
    paths[digit] = {"path": pen.getCommands()}
(HERE / "operator-digits.js").write_text(
    "// Original 8-bit Operator+ Bold outlines; Grand Chaos Productions, 2009-2014; OFL-1.1.\n"
    "window.BitByteOperatorDigits = " + json.dumps(paths, ensure_ascii=False, separators=(",", ":")) + ";\n",
    encoding="utf-8")
shutil.copyfile(SOURCE / "SIL Open Font License.txt", HERE / "SIL Open Font License.txt")
