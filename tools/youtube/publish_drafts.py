# -*- coding: utf-8 -*-
"""Публикация четырёх черновиков: опознание по имени файла в заголовке,
заполнение названия и описания, ответ про детей, «Открытый доступ», публикация."""
import os, time, json
import tkinter as tk
from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains

PROFILE = r"E:\NineToZero\ff-prof"
SHOTS = r"E:\NineToZero\video-gen\shots"
CHANNEL = "UCfSuKG2l-kwR5faL9TsStyg"

TAIL = """

Сделано в Зеркалиусе: https://1001100.online
Все треки и генераторы: https://github.com/MIkhailNkmnme/Binary-Drum-Machine/tree/main/issledovanie

#Zerkalius #BitMusic #GenerativeMusic #Techno #BinaryDrumMachine"""

ITEMS = {
    "glyphs": ("Zerkalius — Глифы · музыка из битов и графов",
               "Трек 2:53, 88 тактов, 124 BPM. Бас собран из цифр шрифта Крафтверка 5×6, лид — из графов "
               "глифов 8×12: клетка включается, если у неё есть ребро, строка из восьми клеток даёт число до 255.\n\n"
               "2306 событий, пик 0,695, клиппинга нет. Вступление 0:00, подъём 0:37, основа 1:02, "
               "проигрыш 1:33, основа 2 1:49, конец 2:44." + TAIL),
    "numbers67": ("Zerkalius — Numbers · 67 BPM, счёт цифрами роботом",
                  "1:57, 32 такта, 67 BPM — темп разобранного референса Karl Bartos «Numbers». Счёт идёт не по "
                  "такту, а по пульсу 0,896 с: 66 цифр через пульс.\n\nГолос: цифры синтезированы, понижены с "
                  "формантами, кольцевая модуляция 58 Гц, биткрашер 6 бит, полоса 220–4200 Гц. "
                  "Музыка приседает под голосом на 0,38." + TAIL),
    "loop": ("Zerkalius — Kraftwerk Bits · петля без шва",
             "46,080 секунд, 125 BPM, 24 такта. Длина кратна семплу: 2 032 128 семплов, поэтому стык точный — "
             "скачок 4 при обычном шаге 2197.\n\nВключайте повтор: шва не слышно. MP3 добавляет задержку "
             "кодека, WAV в репозитории зацикливается идеально." + TAIL),
    "letters": ("Zerkalius — ZERKALIUS по буквам · голос как партия",
                "46 секунд. Каждая буква синтезирована отдельно, расчеловечена и получила ступень до-минора: "
                "A −3, E −1, I 0, K +2, L +4, R +5, S +7, U −3, Z −1.\n\nСлово идёт по букве на восьмую, "
                "в петлю помещается 7 проговариваний. Музыка приседает под голосом на −4,7 дБ." + TAIL),
}

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
    time.sleep(0.4)
    ActionChains(driver).move_to_element(element).click().perform()


def find_button(driver, wanted, timeout=30, exact=True):
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


def find_clickable(driver, wanted, timeout=8):
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


def visible_fields(driver):
    return driver.execute_script("""
      return Array.from(document.querySelectorAll('[contenteditable=true]'))
        .filter(el => { const r = el.getBoundingClientRect(); return r.width > 100 && r.height > 10; })
        .map(el => ({ aria: (el.getAttribute('aria-label')||'').slice(0,90), text: (el.innerText||'').trim() }));
    """)


def set_text(driver, element, text):
    click_mouse(driver, element)
    clipboard.clipboard_clear()
    clipboard.clipboard_append(text)
    clipboard.update()
    time.sleep(0.3)
    ActionChains(driver).key_down(Keys.CONTROL).send_keys("a").key_up(Keys.CONTROL).perform()
    time.sleep(0.2)
    ActionChains(driver).key_down(Keys.CONTROL).send_keys("v").key_up(Keys.CONTROL).perform()
    time.sleep(1.2)
    got = driver.execute_script("return arguments[0].innerText.trim().length;", element)
    if got < 5:
        # Вставка не сработала: фокус внутрь и ввод через execCommand.
        driver.execute_script("arguments[0].focus();", element)
        time.sleep(0.3)
        driver.execute_script("document.execCommand('selectAll', false, null); document.execCommand('insertText', false, arguments[1]);", element, text)
        time.sleep(1.2)
        got = driver.execute_script("return arguments[0].innerText.trim().length;", element)
    return got


def publish_one(driver):
    edit = find_button(driver, "Редактировать черновик", exact=False, timeout=40)
    if not edit:
        log("нет кнопки редактирования")
        return None
    click_mouse(driver, edit)
    time.sleep(12)

    for _ in range(15):
        info = visible_fields(driver)
        if len(info) >= 2:
            break
        time.sleep(2)
    else:
        log("поля не появились")
        return None

    current = info[0]["text"].lower()
    key = next((name for name in ITEMS if name in current), None)
    log("черновик:", repr(info[0]["text"][:40]), "-> ключ:", key)
    if not key:
        log("не опознан")
        return None

    title, desc = ITEMS[key]
    elements = [e for e in driver.find_elements(By.CSS_SELECTOR, "[contenteditable=true]")
                if e.is_displayed() and e.rect["width"] > 100]
    title_field, desc_field = elements[0], elements[1]

    length = set_text(driver, title_field, title)
    log("название:", length, repr(title[:40]))
    if length < 10:
        log("название не ввелось")
        return None

    length = set_text(driver, desc_field, desc)
    log("описание:", length, "символов")
    if length < 100:
        log("описание не ввелось")
        return None

    kids = find_clickable(driver, "Нет, это видео не для детей", timeout=8)
    if kids:
        click_mouse(driver, kids)
        log("ответил: не для детей")

    for step in range(5):
        if find_clickable(driver, "Открытый доступ", timeout=3):
            break
        nxt = find_button(driver, "Далее", timeout=8)
        if not nxt:
            log("нет Далее, шаг", step + 1)
            shot(driver, "p3-nonav")
            break
        click_mouse(driver, nxt)
        time.sleep(5)
        kids = find_clickable(driver, "Нет, это видео не для детей", timeout=3)
        if kids:
            click_mouse(driver, kids)

    public = find_clickable(driver, "Открытый доступ", timeout=8)
    if not public:
        log("нет шага доступа")
        shot(driver, "p3-nopublic")
        return None
    click_mouse(driver, public)
    time.sleep(2)

    publish = find_button(driver, "Опубликовать", timeout=12)
    if not publish:
        log("нет Опубликовать")
        shot(driver, "p3-nopublish")
        return None
    click_mouse(driver, publish)
    log("опубликовано")
    time.sleep(14)
    links = []
    for a in driver.find_elements(By.CSS_SELECTOR, "a[href*='youtu.be']"):
        href = a.get_attribute("href")
        if href and href not in links:
            links.append(href)
    return {"key": key, "title": title, "link": links[0] if links else None}


driver = webdriver.Firefox(options=opts)
results = []
try:
    driver.set_window_size(1600, 1000)
    driver.get(f"https://studio.youtube.com/channel/{CHANNEL}/videos")
    time.sleep(22)
    for attempt in range(5):
        log("=== черновик", attempt + 1, "===")
        try:
            result = publish_one(driver)
        except Exception as error:
            log("ошибка:", error)
            result = None
        results.append(result)
        if result is None:
            break
        driver.get(f"https://studio.youtube.com/channel/{CHANNEL}/videos")
        time.sleep(15)
finally:
    json.dump({"results": results, "log": LOG},
              open(os.path.join(SHOTS, "publish3.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print("ИТОГ:", json.dumps(results, ensure_ascii=False))
    driver.quit()
