"""Render the research figure's PNG and animated GIF from the shared SVG source.

Requires Node.js, Pillow, Playwright, and Chromium (or CHROMIUM_PATH).
Run: python issledovanie/serpinski-pikseli-animaciya.py
"""
from pathlib import Path
from io import BytesIO
import json
import os
import re
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

FOLDER = Path(__file__).resolve().parent
MODULE = FOLDER / "serpinski-pikseli-nalozhenie.mjs"
STEM = FOLDER / "serpinski-pikseli-nalozhenie"
PHASES = ("right", "center", "left")
DURATIONS = (1600, 1800, 1400)

def source(phase):
    code = ("import {makeSvg} from " + json.dumps(MODULE.as_uri()) +
            "; process.stdout.write(makeSvg({gridPhase:" + json.dumps(phase) + "}));")
    return subprocess.check_output(["node", "--input-type=module", "-e", code], text=True, encoding="utf-8")

def render():
    svgs = {phase: source(phase) for phase in PHASES}
    (STEM.with_suffix(".svg")).write_text(svgs["center"] + "\n", encoding="utf-8")
    root = ET.fromstring(svgs["center"])
    size = int(root.get("width")), int(root.get("height"))
    frames = []
    bitmaps = []
    browser_path = os.environ.get("CHROMIUM_PATH") or shutil.which("chromium")
    with sync_playwright() as pw:
        kwargs = dict(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        if browser_path:
            kwargs["executable_path"] = browser_path
        browser = pw.chromium.launch(**kwargs)
        page = browser.new_page(viewport={"width": size[0], "height": size[1]}, device_scale_factor=1)
        for phase in PHASES:
            page.set_content("<style>html,body{margin:0;background:#080b11}</style>" + svgs[phase])
            page.evaluate("document.fonts.ready")
            aligned = page.locator("[data-aligned-panel]").evaluate_all("""groups=>groups.map(g=>{
              const r=g.getBoundingClientRect();return {id:g.dataset.alignedPanel,
              bottom:r.bottom,right:r.right,expectedBottom:+g.dataset.rowBottom,expectedRight:+g.dataset.columnRight}
            })""")
            assert len(aligned) == 12
            assert all(abs(a["bottom"]-a["expectedBottom"])<.01 and abs(a["right"]-a["expectedRight"])<.01 for a in aligned), aligned
            assert page.locator("[data-dimension]").count() == 24
            guides = page.locator("[data-edge-guide]").evaluate_all("""paths=>paths.map(p=>({
              axis:p.dataset.edgeGuide, value:+p.dataset.edgeCoordinate,
              sources:p.dataset.edgeSources.split(' '), d:p.getAttribute('d')
            }))""")
            panels = page.locator("[data-aligned-panel] > g:first-child").evaluate_all("""groups=>groups.map(g=>{
              const r=g.querySelector('rect');return {id:g.id,x:+r.getAttribute('x'),y:+r.getAttribute('y'),
              width:+r.getAttribute('width'),height:+r.getAttribute('height')}
            })""")
            assert sum(g["axis"] == "horizontal" for g in guides) == 9
            assert sum(g["axis"] == "vertical" for g in guides) == 16
            assert len({(g["axis"], g["value"]) for g in guides}) == len(guides)
            for panel in panels:
                for side, axis, value in [("top", "horizontal", panel["y"]),
                        ("bottom", "horizontal", panel["y"]+panel["height"]),
                        ("left", "vertical", panel["x"]),
                        ("right", "vertical", panel["x"]+panel["width"])]:
                    matches = [g for g in guides if panel["id"]+":"+side in g["sources"]]
                    assert len(matches) == 1 and matches[0]["axis"] == axis and matches[0]["value"] == value
                    assert matches[0]["d"] == (f"M60 {value}H1770" if axis == "horizontal" else f"M{value} 145V958")
            assert page.locator("marker,[marker-end]").count() == 0
            assert page.locator("[data-full-grid]").count() == 0
            assert page.locator("[data-moving-grid]").count() == 3
            assert page.locator("[data-static-grid]").count() == 9
            assert page.locator("#moving-grid-16 [data-bit]").count() == 144
            bitmaps.append(page.locator('[id^="moving-grid-"]').evaluate_all("groups=>groups.map(g=>g.outerHTML)"))
            for native_rows, rows, columns, cell in [(16, 8, 15, 12), (24, 16, 31, 9), (32, 24, 47, 8)]:
                grid = page.locator('[data-moving-grid="moving-grid-'+str(native_rows)+'"]')
                assert int(grid.get_attribute("data-previous-rows")) == rows
                assert float(grid.get_attribute("data-square-size")) == cell
                assert grid.get_attribute("data-position") == phase
                assert grid.evaluate("(g)=>getComputedStyle(g).strokeWidth") == "1px"
                width = (2*native_rows-1)*6
                left = 1730-width+(width-columns*cell)*{"right":1,"center":.5,"left":0}[phase]
                assert float(grid.get_attribute("data-left")) == left
                assert float(grid.get_attribute("data-width")) == columns*cell
                # The moving shape is exactly the third-column square overlay,
                # translated horizontally; no rectangular full grid is substituted.
                fixed_grid = page.locator('#previous-'+str(rows)+'-squares [data-position="'+phase+'"]')
                fixed = fixed_grid.locator('path').get_attribute("d")
                moving = grid.locator("path").get_attribute("d")
                fixed_left = left-440
                colors={"right":"#ff4048","center":"#40dc70","left":"#408cff"}
                assert grid.get_attribute('stroke') == fixed_grid.get_attribute('stroke') == colors[phase]
                assert float(fixed_grid.get_attribute('data-left')) == fixed_left
                for position in PHASES:
                    fixed_variant = page.locator('#previous-'+str(rows)+'-squares [data-position="'+position+'"]')
                    assert fixed_variant.get_attribute('stroke') == colors[position]
                    assert float(fixed_variant.get_attribute('data-left')) == 1290-width+(width-columns*cell)*{"right":1,"center":.5,"left":0}[position]
                coordinates = lambda d, x: [(cmd,float(px)-x,float(py)) for cmd,px,py in re.findall(r'([ML])([\d.]+) ([\d.]+)',d)]
                assert coordinates(fixed,fixed_left) == coordinates(moving,left)
            raw = page.screenshot()
            frame = Image.open(BytesIO(raw)).convert("RGB")
            frames.append(frame)
            if phase == "center":
                STEM.with_suffix(".png").write_bytes(raw)
            # Preview frames stay outside the repository.
            frame.save(Path(tempfile.gettempdir()) / ("serpinski-grid-" + phase + ".png"))
        browser.close()
    assert bitmaps[0] == bitmaps[1] == bitmaps[2], "The bits must remain visible and stationary"
    # One shared palette prevents unchanged columns from changing colour.
    montage = Image.new("RGB", (size[0], size[1] * len(frames)))
    for i, frame in enumerate(frames):
        montage.paste(frame, (0, i*size[1]))
    palette = montage.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    indexed = [f.quantize(palette=palette, dither=Image.Dither.NONE) for f in frames]
    indexed[0].save(STEM.with_suffix(".gif"), save_all=True, append_images=indexed[1:],
                    duration=DURATIONS, loop=0, disposal=1, optimize=False)
    with Image.open(STEM.with_suffix(".gif")) as gif:
        assert gif.n_frames == 3 and gif.info["loop"] == 0 and gif.size == size
        decoded = []
        for i in range(gif.n_frames):
            gif.seek(i)
            assert gif.info["duration"] == DURATIONS[i]
            decoded.append(gif.convert("RGB"))
        stable = (0, 145, 1320, 960)
        assert all(ImageChops.difference(decoded[0].crop(stable), f.crop(stable)).getbbox() is None for f in decoded[1:])
        for box in [(1544,180,1730,276), (1448,408,1730,552), (1352,690,1730,882)]:
            assert all(ImageChops.difference(decoded[i].crop(box), decoded[j].crop(box)).getbbox() for i,j in [(0,1),(1,2),(0,2)])
    print(json.dumps({"size": size, "frames": len(frames), "durations": DURATIONS,
          "loop": 0, "unchangedColumns": 3, "animatedPanels": 3,
          "gifBytes": STEM.with_suffix(".gif").stat().st_size}))

if __name__ == "__main__":
    render()
