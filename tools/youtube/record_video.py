# -*- coding: utf-8 -*-
"""Запись видео из Маятника: открывает страницу, ждёт готовый файл в папке загрузок."""
import sys, time, os
from selenium import webdriver
from selenium.webdriver.firefox.options import Options

SECONDS = sys.argv[1] if len(sys.argv) > 1 else "96"
OUT = r"E:\NineToZero\video-gen\out"
EXTRA = sys.argv[2] if len(sys.argv) > 2 else ""
PAGE = ("file:///E:/NineToZero/video-gen/index.html?sec=" + SECONDS
        + "&fps=30&w=160&h=90&scale=8" + EXTRA)

opts = Options()
opts.add_argument("-headless")
opts.set_preference("browser.download.folderList", 2)
opts.set_preference("browser.download.dir", OUT)
opts.set_preference("browser.download.useDownloadDir", True)
opts.set_preference("browser.download.alwaysOpenPanel", False)
opts.set_preference("browser.download.manager.showWhenStarting", False)
opts.set_preference("browser.helperApps.neverAsk.saveToDisk", "video/webm,application/octet-stream")
opts.set_preference("media.autoplay.default", 0)
opts.set_preference("dom.disable_beforeunload", True)

driver = webdriver.Firefox(options=opts)
try:
    driver.set_window_size(1400, 900)
    driver.get(PAGE)
    deadline = time.time() + float(SECONDS) * 2.2 + 60
    state = None
    while time.time() < deadline:
        state = driver.execute_script("return window.__video || null;")
        if state and (state.get("ready") or state.get("error")):
            break
        time.sleep(1)
    print("состояние:", state)
    time.sleep(3)
    files = [f for f in os.listdir(OUT) if f.endswith(".webm")]
    for name in files:
        path = os.path.join(OUT, name)
        print("файл:", name, round(os.path.getsize(path) / 1048576, 2), "МБ")
finally:
    driver.quit()
