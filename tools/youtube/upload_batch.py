# -*- coding: utf-8 -*-
"""Пакетная загрузка готовых треков в YouTube Studio.

Один проход на файл: диалог загрузки, название, описание, ответ про детей,
«Далее» до шага доступа, «Открытый доступ», «Опубликовать».
"""
import os, sys, time, json
import tkinter as tk
from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains

PROFILE = r"E:\NineToZero\ff-prof"
SHOTS = r"E:\NineToZero\video-gen\shots"
CHANNEL = "UCfSuKG2l-kwR5faL9TsStyg"
OUT = r"E:\NineToZero\video-gen\out"

COMMON = """
Сделано в Зеркалиусе: https://1001100.online
Все треки и генераторы: https://github.com/MIkhailNkmnme/Binary-Drum-Machine/tree/main/issledovanie

#Zerkalius #BitMusic #GenerativeMusic #Techno #BinaryDrumMachine"""

ITEMS = [
    {
        "file": "glyphs.mp4",
        "title": "Zerkalius — Глифы · музыка из битов и графов",
        "desc": "Трек 2:53, 88 тактов, 124 BPM. Бас собран из цифр шрифта Крафтверка 5×6, лид — "
                "из графов глифов 8×12: клетка включается, если у неё есть ребро, строка из восьми "
                "клеток даёт число до 255.\n\n2306 событий, пик 0,695, клиппинга нет. "
                "Секции: вступление 0:00, подъём 0:37, основа 1:02, проигрыш 1:33, основа 2 1:49, конец 2:44."
                + COMMON,
    },
    {
        "file": "numbers67.mp4",
        "title": "Zerkalius — Numbers · 67 BPM, счёт цифрами роботом",
        "desc": "1:57, 32 такта, 67 BPM — темп разобранного референса Karl Bartos «Numbers». "
                "Счёт идёт не по такту, а по пульсу 0,896 с: 66 цифр через пульс.\n\n"
                "Голос: цифры синтезированы, понижены с формантами, кольцевая модуляция 58 Гц, "
                "биткрашер 6 бит, полоса 220–4200 Гц. Музыка приседает под голосом на 0,38."
                + COMMON,
    },
    {
        "file": "loop.mp4",
        "title": "Zerkalius — Kraftwerk Bits · петля без шва",
        "desc": "46,080 секунд, 125 BPM, 24 такта. Длина кратна семплу: 2 032 128 семплов, "
                "поэтому стык точный — скачок 4 при обычном шаге 2197.\n\n"
                "Включайте повтор: шва не слышно. MP3 добавляет задержку кодека, WAV в репозитории "
                "зацикливается идеально." + COMMON,
    },
    {
        "file": "letters.mp4",
        "title": "Zerkalius — ZERKALIUS по буквам · голос как партия",
        "desc": "46 секунд. Каждая буква синтезирована отдельно, расчеловечена и получила ступень "
                "до-минора: A −3, E −1, I 0, K +2, L +4, R +5, S +7, U −3, Z −1.\n\n"
                "Слово идёт по букве на восьмую, в петлю помещается 7 проговариваний. "
                "Музыка приседает под голосом на −4,7 дБ." + COMMON,
    },
]

opts = Options()
opts.profile = PROFILE
opts.page_load_strategy = "eager"
opts.set_preference("browser.sessionstore.resume_from_crash", False)

clipboard = tk.Tk()
clipboard.withdraw()
LOG = []


def log(*args):
    text = " ".join(str(a) for a in args)
    print(text, flush=True)
    LOG.append(text)


def shot(driver, name):
    try:
        driver.save_screenshot(os.path.join(SHOTS, name + ".png"))
    except Exception as error:
        log("снимок:", error)


def click_mouse(driver, element):
    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", element)
    time.sleep(0.3)
    ActionChains(driver).move_to_element(element).click().perform()


def find_button(driver, wanted, timeout=15, exact=True):
    deadline = time.time() + timeout
    while time.time() < deadline:
        for b in driver.find_elements(By.TAG_NAME, "button"):
            try:
                text = (b.text or "").strip().replace("\n", " ")
                if b.is_displayed() and ((text == wanted) if exact else (wanted.lower() in text.lower())):
                    return b
            except Exception:
                continue
        time.sleep(1)
    return None


def find_clickable(driver, wanted, timeout=10):
    deadline = time.time() + timeout
    while time.time() < deadline:
        for el in driver.find_elements(By.XPATH, f"//*[normalize-space(.)='{wanted}']"):
            try:
                if el.is_displayed():
                    return el
            except Exception:
                continue
        time.sleep(1)
    return None


def paste(driver, element, text):
    clipboard.clipboard_clear()
    clipboard.clipboard_append(text)
    clipboard.update()
    click_mouse(driver, element)
    time.sleep(0.4)
    ActionChains(driver).key_down(Keys.CONTROL).send_keys("a").key_up(Keys.CONTROL).perform()
    time.sleep(0.2)
    ActionChains(driver).key_down(Keys.CONTROL).send_keys("v").key_up(Keys.CONTROL).perform()
    time.sleep(1.0)


def upload(driver, item):
    path = os.path.join(OUT, item["file"])
    log("--- загружаю:", item["file"])
    driver.get(f"https://studio.youtube.com/channel/{CHANNEL}/videos")
    time.sleep(12)

    create = find_button(driver, "Создать", exact=True)
    if not create:
        log("нет кнопки Создать")
        return False
    click_mouse(driver, create)
    time.sleep(2)

    menu = find_clickable(driver, "Добавить видео", timeout=12)
    if not menu:
        log("нет пункта Добавить видео")
        return False
    click_mouse(driver, menu)
    time.sleep(5)

    field = None
    for _ in range(40):
        files = driver.find_elements(By.CSS_SELECTOR, "input[type=file]")
        if files:
            field = files[-1]
            break
        time.sleep(1)
    if not field:
        log("нет поля файла")
        return False
    field.send_keys(path)
    log("файл отдан:", round(os.path.getsize(path) / 1048576, 1), "МБ")

    edits = []
    for _ in range(40):
        time.sleep(2)
        edits = [e for e in driver.find_elements(By.CSS_SELECTOR, "[contenteditable=true]") if e.is_displayed()]
        if len(edits) >= 2:
            break
    if len(edits) < 2:
        log("нет полей названия и описания")
        return False

    paste(driver, edits[0], item["title"])
    paste(driver, edits[1], item["desc"])
    log("название и описание введены:", len(edits[0].text), "/", len(edits[1].text))

    kids = find_clickable(driver, "Нет, это видео не для детей", timeout=8)
    if kids:
        click_mouse(driver, kids)
        log("ответил: не для детей")

    for step in range(5):
        if find_clickable(driver, "Открытый доступ", timeout=3):
            break
        nxt = find_button(driver, "Далее", timeout=8)
        if not nxt:
            log("Далее не найдено на шаге", step + 1)
            break
        click_mouse(driver, nxt)
        time.sleep(5)
        kids = find_clickable(driver, "Нет, это видео не для детей", timeout=4)
        if kids:
            click_mouse(driver, kids)

    public = find_clickable(driver, "Открытый доступ", timeout=10)
    if not public:
        log("нет шага Открытый доступ")
        shot(driver, "up-fail-" + item["file"])
        return False
    click_mouse(driver, public)
    time.sleep(2)

    publish = find_button(driver, "Опубликовать", timeout=15)
    if not publish:
        log("нет кнопки Опубликовать")
        shot(driver, "up-nopub-" + item["file"])
        return False
    click_mouse(driver, publish)
    log("нажал Опубликовать")
    time.sleep(14)

    links = []
    for a in driver.find_elements(By.CSS_SELECTOR, "a[href*='youtu.be']"):
        href = a.get_attribute("href")
        if href and href not in links:
            links.append(href)
    log("ссылки:", links[:3])
    return links[0] if links else True


driver = webdriver.Firefox(options=opts)
results = {}
try:
    driver.set_window_size(1600, 1000)
    for item in ITEMS:
        try:
            results[item["file"]] = upload(driver, item)
        except Exception as error:
            log("ошибка на", item["file"], ":", error)
            results[item["file"]] = "ошибка"
        time.sleep(4)
finally:
    json.dump({"results": results, "log": LOG},
              open(os.path.join(SHOTS, "batch-upload.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print("ИТОГ:", json.dumps(results, ensure_ascii=False))
    driver.quit()
