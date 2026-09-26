# Zerkalius — добавить пресет конуса (v0.001, 2026-09-27).
# Слово пользователя: «сохранил пресет — как его дальше, например в Мультфильмы? тебе прислать или скрипт сделаем?»
#
# Берёт файл «💾 Всё» из Zazerkalius (zazerkalius-vse-….json) и кладёт его сюда пресетом:
#   <имя>.js   — состояние страницы (window.ZZ_PRESET_DATA = {...}); .js, а не .json — чтобы открывалось и с диска (file://),
#                где браузер не даёт читать .json;
#   spisok.js  — список пресетов (window.ZZ_PRESETY = [...]); по нему «Битмультфильмы» сами строят живые карточки.
# Посмотреть пресет: zazerkalius/Zerkalius-zazerkalius.html?solo=cone&preset=<имя> — только смотрит и крутит, память не трогает.
#
#   python dobavit.py <файл.json> <имя> "Название" ["подпись"]
#   python dobavit.py --del <имя>          — убрать пресет из списка и его файл
#
# Имя — латиницей, цифры и дефис (oktaedr-70). Тот же пресет ещё раз — заменяется на месте, в списке остаётся где был.
import json, os, re, sys, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
SPISOK = os.path.join(HERE, "spisok.js")
# раскладка экрана, свои шаблоны и копия умолчания для показа не нужны — только утяжеляют файл
SKIP = ["home", "win", "dockOrder", "z", "layoutVer", "rowsH", "rowsW", "ctw", "cgrpPos", "padPos", "tpl", "tplRef", "pins"]


def read_list():
    if not os.path.exists(SPISOK):
        return []
    t = open(SPISOK, encoding="utf-8").read()
    m = re.search(r"window\.ZZ_PRESETY\s*=\s*(\[.*\])\s*;", t, re.S)
    return json.loads(m.group(1)) if m else []


def write_list(lst):
    body = json.dumps(lst, ensure_ascii=False, indent=1)
    open(SPISOK, "w", encoding="utf-8", newline="\n").write(
        "// Пресеты конуса Zazerkalius — пишет dobavit.py, руками не править.\nwindow.ZZ_PRESETY = " + body + ";\n")


def main(a):
    if len(a) >= 2 and a[0] == "--del":
        name = a[1]
        lst = [p for p in read_list() if p["name"] != name]
        write_list(lst)
        f = os.path.join(HERE, name + ".js")
        if os.path.exists(f):
            os.remove(f)
        print("убран:", name, "· в списке", len(lst))
        return
    if len(a) < 3:
        print(__doc__ or "", "\nнужно: dobavit.py <файл.json> <имя> \"Название\" [\"подпись\"]")
        sys.exit(1)
    src, name, title = a[0], a[1], a[2]
    note = a[3] if len(a) > 3 else ""
    if not re.fullmatch(r"[a-z0-9-]+", name):
        sys.exit("имя — латиница, цифры, дефис: " + name)
    d = json.load(open(src, encoding="utf-8"))
    st = d.get("state") if isinstance(d, dict) and "state" in d else d
    if not isinstance(st, dict) or not isinstance(st.get("rows"), list):
        sys.exit("это не файл «💾 Всё» из Zazerkalius: " + src)
    st = {k: v for k, v in st.items() if k not in SKIP}
    data = {"name": name, "title": title, "page": d.get("page", ""), "saved": d.get("saved", ""), "state": st}
    out = os.path.join(HERE, name + ".js")
    open(out, "w", encoding="utf-8", newline="\n").write(
        "// Пресет конуса «" + title + "» — пишет dobavit.py.\nwindow.ZZ_PRESET_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    rows = st.get("rows", [])
    item = {"name": name, "title": title, "note": note, "rows": len(rows), "date": datetime.date.today().isoformat()}
    lst = read_list()
    for i, p in enumerate(lst):
        if p["name"] == name:
            lst[i] = item
            break
    else:
        lst.append(item)
    write_list(lst)
    print(f"пресет {name}: {len(rows)} строк, {os.path.getsize(out) // 1024} КБ · в списке {len(lst)}")
    print(f"смотреть: zazerkalius/Zerkalius-zazerkalius.html?solo=cone&preset={name}")


if __name__ == "__main__":
    main(sys.argv[1:])
