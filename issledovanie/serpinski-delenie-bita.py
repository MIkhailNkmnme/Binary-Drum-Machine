"""Render the separate bit subdivision figure. Same dependencies as the main GIF renderer."""
from pathlib import Path
from io import BytesIO
import json
import os
import shutil
import subprocess
from PIL import Image
from playwright.sync_api import sync_playwright

FOLDER=Path(__file__).resolve().parent
STEM=FOLDER/'serpinski-delenie-bita'

def render():
    subprocess.run(['node',str(STEM.with_suffix('.mjs'))],check=True)
    with sync_playwright() as pw:
        kwargs=dict(headless=True)
        chrome=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
        if chrome:kwargs['executable_path']=chrome
        browser=pw.chromium.launch(**kwargs)
        page=browser.new_page(viewport={'width':1840,'height':1240},device_scale_factor=1)
        page.set_content('<style>html,body{margin:0;background:#080b11}</style>'+STEM.with_suffix('.svg').read_text(encoding='utf-8'))
        page.evaluate('document.fonts.ready')
        assert page.locator('[data-bit-sample]').count()==18
        assert page.locator('[data-first-row-grid][data-step-ticks="6"]').count()==18
        data=page.locator('[data-bit-sample]').evaluate_all('''groups=>groups.map(g=>{
          const p=g.querySelector('[data-other-grid]');return {id:g.dataset.bitSample,size:+g.dataset.sizeTicks,
          x:p.dataset.xParts.split(' ').map(Number),y:p.dataset.yParts.split(' ').map(Number)}
        })''')
        for sample in data:
            assert sum(sample['x'])==sum(sample['y'])==sample['size'],sample
            assert min(sample['x']+sample['y'])>0,sample
        by_id={s['id']:s for s in data}
        # Exact known cuts, in twelfths of the first bit.
        assert by_id['8-16-small-center']['x']==[6,6]
        assert by_id['16-24-small-center']['x']==[3,9]
        assert by_id['24-32-small-center']['x']==[2,10]
        assert by_id['24-32-small-right']['x']==[4,8]
        assert by_id['24-32-large-center']['x']==[2,12,2]
        assert all(s['y']==[12,s['size']-12] for s in data if s['id'].split('-')[2]=='large')
        raw=page.screenshot()
        assert Image.open(BytesIO(raw)).size==(1840,1240)
        STEM.with_suffix('.png').write_bytes(raw)
        browser.close()
    print(json.dumps({'size':[1840,1240],'samples':18,'exactDivisionSums':True,'firstRowFineGridStep':'1/2'}))

if __name__=='__main__':render()
