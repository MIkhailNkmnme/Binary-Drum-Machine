"""Generate Glyphen's square AzBuk faces from the current published source.

Run from any directory: python build-fonts.py
Dependencies: fonttools and brotli (WOFF2 compression).
No browser, source JavaScript execution, localStorage, or tests are involved.
"""

import hashlib
import json
import re
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen


HERE = Path(__file__).resolve().parent
SOURCE = HERE.parents[2] / "Zerkalius-azbuk.html"
CELL = 128
EM = 1024
# A fixed OpenType timestamp makes unchanged source builds reproducible.
TIMESTAMP = 3876768000


def read_source():
    text = SOURCE.read_text(encoding="utf-8")
    # BASE.thin is a JSON object within the page's JavaScript declaration.
    match = re.search(r"const BASE\s*=\s*\{\s*thin:\s*(\{.*?\})\s*\};", text, re.S)
    masks = json.loads(match.group(1))
    desc_match = re.search(r"const DESCEND\s*=\s*(\{[^;]+\});", text)
    descend = json.loads(desc_match.group(1).replace("'", '"'))
    version = re.search(r"<title>[^<]*v([\d.]+)</title>", text).group(1)
    payload = json.dumps([masks, descend], ensure_ascii=False, sort_keys=True).encode("utf-8")
    return masks, descend, version, hashlib.sha256(payload).hexdigest()[:12]


def outline(rows, descent=0):
    pen = TTGlyphPen(None)
    # Preserve the existing font's square cells and horizontal run contours.
    # AzBuk lettering() places each glyph at h - DESCEND above the baseline.
    for row_index, row in enumerate(rows):
        bottom = (len(rows) - descent - row_index - 1) * CELL
        for run in re.finditer("1+", row):
            left, right = run.start() * CELL, run.end() * CELL
            pen.moveTo((left, bottom))
            pen.lineTo((left, bottom + CELL))
            pen.lineTo((right, bottom + CELL))
            pen.lineTo((right, bottom))
            pen.closePath()
    return pen.glyph()


def build(masks, descend, source_version, digest, mono=False):
    family = "AzBuk Mono" if mono else "AzBuk Thin"
    stem = "xor-azbuk-mono" if mono else "xor-azbuk-thin"
    glyph_order = [".notdef", "uni0020"] + [f"uni{ord(ch):04X}" for ch in sorted(masks, key=ord)]
    cmap = {32: "uni0020", **{ord(ch): f"uni{ord(ch):04X}" for ch in masks}}
    glyphs = {".notdef": outline(["11111"] * 8), "uni0020": outline(["000"])}
    metrics = {".notdef": (768, 0), "uni0020": (768 if mono else 512, 0)}
    for ch, rows in masks.items():
        name = cmap[ord(ch)]
        glyphs[name] = outline(rows, descend.get(ch, 0))
        width = (max(map(len, rows)) + 1) * CELL
        # Keep the established Mono contract used by search: fixed digits and
        # spaces, with the same proportional letter/punctuation spacing as Thin.
        metrics[name] = (768 if mono and ch in "0123456789" else width, 0)

    fb = FontBuilder(EM, isTTF=True)
    fb.setupGlyphOrder(glyph_order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics(metrics)
    # Preserve the old total line height (1280), now allowing two descender rows.
    fb.setupHorizontalHeader(ascent=1024, descent=-256, lineGap=0)
    fb.setupOS2(
        sTypoAscender=1024, sTypoDescender=-256, sTypoLineGap=0,
        usWinAscent=1024, usWinDescent=256, sxHeight=640, sCapHeight=896,
        usWeightClass=400, usWidthClass=5, fsType=4, fsSelection=64,
        achVendID="AZBK",
    )
    fb.setupNameTable({
        "copyright": "AzBuk glyph set",
        "familyName": family,
        "styleName": "Regular",
        "uniqueFontIdentifier": f"{family}; AzBuk {source_version}; {digest}",
        "fullName": family,
        "psName": family.replace(" ", "") + "-Regular",
        "version": f"Version 1.1; AzBuk {source_version}; {digest}",
        "description": "Square glyphs from Zerkalius-azbuk.html BASE.thin and DESCEND.",
    })
    fb.setupPost()
    fb.setupMaxp()
    fb.font["head"].created = fb.font["head"].modified = TIMESTAMP
    fb.font["head"].fontRevision = 1.1
    fb.font.recalcTimestamp = False
    fb.save(HERE / f"{stem}.ttf")
    if not mono:
        fb.font.flavor = "woff2"
        fb.font.save(HERE / f"{stem}.woff2")
    print(f"Generated {stem}: AzBuk {source_version}, masks {digest}")


if __name__ == "__main__":
    data = read_source()
    build(*data)
    build(*data, mono=True)
