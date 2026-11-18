"""Build the local music catalog from repository manifests and documented releases.
Run from any directory: python music/build-catalog.py. No media is generated,
probed or played. Node loads only the declarative example records, not renderers.
"""
from pathlib import Path
import json
import posixpath
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
GROUPS = [("albums", "Альбом Синтеза"), ("xorrom", "Xorrom и музыкальный ковёр"),
          ("bits", "Музыка из битов"), ("voices", "Голос и буквы"),
          ("phone", "Композиции и звонки"), ("signals", "SMS и уведомления"),
          ("live", "Живые видеообои"), ("fractals", "Клеточные и музыкальные фракталы"),
          ("visuals", "Битмультфильмы без звука"), ("tools", "Живые инструменты")]
items = []

def read(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8-sig"))

def url(path):
    return "../" + path

def relative(base, path):
    return posixpath.normpath(posixpath.join(base, path))

def link(label, path):
    return {"label": label, "url": url(path)}

def add(id, title, group, description, recipe, source, links=(), **media):
    record = {"id": id, "title": title, "group": group, "description": description,
              "recipe": recipe, "source": {"label": "Исходник и правила построения", "url": url(source)},
              **media, "links": list(links)}
    items.append(record)
    return record

def artifact(folder, stem, suffix):
    # Resolve declared release stems against the actual local release inventory.
    return next(p.relative_to(ROOT).as_posix() for p in (ROOT / folder).iterdir()
                if p.stem == stem and p.suffix == suffix)

# Album titles, tempo and visual work come from the album's construction record.
album_dir = "mayatnik/synthesis-album"
album = read(album_dir + "/construction-parameters.json")
for work in album["music"]:
    stem = work["file"]
    art = next(item for item in album["art"] if item["id"] == work["work"])
    tempo = work["options"]["tempo"]
    add("album-" + stem, work["title"], "albums", str(tempo) + " BPM · два маятника и собственная аранжировка.",
        "Гармония, мотив, ритм и форма сочинены заранее; состояния A, B и результата меняют отдельные ноты, акценты, партии и панораму. "
        "Бочка вычисляется из синуса с падающей частотой, ударные — из собственного шума, мелодические инструменты — из гармоник. "
        "Видео показывает развивающееся поле и художественный слой «" + art["title"] + "»; звуковая дорожка собрана из этой композиции.",
        "mayatnik/mayatnik-synthesis-music.js",
        [link("Как сделано", "issledovanie/pendulum-music/README.md"),
         link("Основа без влияния поля", artifact(album_dir, stem + "-base", ".mp3")),
         link("Параметры композиции и картины", album_dir + "/construction-parameters.json"),
         link("Галерея Синтеза", "mayatnik/synthesis-gallery.html")],
        audio=url(artifact(album_dir, stem, ".mp3")), video=url(artifact(album_dir, stem, ".mp4")),
        poster=url(artifact(album_dir, stem + "-cover", ".jpg")), duration=work["seconds"])

# Four readings of one saved field; manifests supply all published file paths.
carpet = read("mayatnik/audio-examples/manifest.json")
videos = {item["id"]: item for item in read("mayatnik/audio-examples/videos.json")["items"]}
for item in carpet["items"]:
    add("xorrom-" + item["id"], item["name"], "xorrom", item["description"],
        "Один исходный кадр Маятника: 128 строк, 31 вершина и пустой фон. Xorrom читает строки сверху вниз: "
        "число единиц либо RGB-категории определяют ступени лада, аккорды и арпеджио. Осцилляторы, гармоники, огибающие и эффекты вычисляют звук. "
        "Видео выделяет текущую строку по временной карте того же WAV; тембр «Робот» здесь не произносит слова.",
        "mayatnik/audio-examples/build.cjs",
        [link("Как сделано", "mayatnik/audio-examples/guide.txt"), link("Настройки", "mayatnik/" + item["preset"]),
         link("Кадр .mayatnik", "mayatnik/" + item["work"]), link("Музыкальный ковёр", "mayatnik/music-carpet/"),
         link("Сборка видео", "mayatnik/audio-examples/build-video.cjs")],
        audio=url("mayatnik/" + item["audio"]), video=url("mayatnik/" + videos[item["id"]]["path"]),
        poster=url("mayatnik/" + item["thumbnail"]), duration=item["duration"])

# Teaching WAVs have a full new source passport dated 2026-11-18.
for item in read("mayatnik/instruction/assets/xorrom-demos.json")["items"]:
    add("instruction-" + item["id"], item["title"], "xorrom", item["description"],
        "Единственная начальная единица и нулевая граница порождают Rule 90: каждый следующий бит — XOR двух верхних соседей. "
        "Xorrom переводит RGB-категории собственного поля в ступени лада и вычисляет осцилляторный тембр. "
        "Учебные части соединены без промежутков, внешних записей и эффектов; точные настройки и ноты сохранены в паспорте.",
        "mayatnik/instruction/assets/build-xorrom-demos.cjs",
        [link("Паспорт и партитура", "mayatnik/instruction/assets/xorrom-demos.json"),
         link("Инструкция Xorrom", "mayatnik/instruction/index.html#xorrom")],
        audio=url("mayatnik/instruction/assets/" + item["file"]), duration=item["durationSeconds"])

bit_releases = [
    ("kraftwerk-bits", "Kraftwerk Bits", "kraftwerk-bit-track.cjs", "kraftwerk-spectrum.png"),
    ("zerkalius-glyphs", "Глифы Зеркалиуса", "zerkalius-glyph-track.cjs", "zerkalius-glyphs-spectrum.png"),
    ("zerkalius-loop", "Петля Зеркалиуса", "zerkalius-loop.cjs", "zerkalius-loop-spectrum.png")]
for stem, title, code, image in bit_releases:
    folder = "issledovanie/bit-music"
    links = [link("Как сделано", folder + "/README.md"), link("Синтезатор", "mayatnik/mayatnik-bit-synthesis.js")]
    if (ROOT / folder / (stem + ".mid")).is_file():
        links.append(link("MIDI", folder + "/" + stem + ".mid"))
    add("bits-" + stem, title, "bits", "Инструментальная композиция из графических битовых данных.",
        "Строки и столбцы масок цифр задают ступени минора и мелодические события; «Глифы» добавляют данные графов. "
        "Ритм и аранжировка заданы программой; собственные синтезаторы вычисляют гармоники, ударные и огибающие. "
        "В петле сохранён средний из трёх проходов для переноса хвостов. Визуальные маски реконструируют внешний графический материал; "
        "это не импорт нот или звука песни. Обложка здесь — спектрограмма собственного результата, а не видеоклип.",
        folder + "/" + code, links, audio=url(artifact(folder, stem, ".mp3")), poster=url(folder + "/" + image))

for stem, title, code in [("numbers-67-synth", "Numbers · синтетический счёт", "tools/voice/mix_synth_numbers.py"),
                           ("loop-letters-synth", "ZERKALIUS · побуквенный голос", "tools/voice/build_letters.py")]:
    add("voice-" + stem, title, "voices", "Собственный формантный голос на вычисленной музыкальной подложке.",
        "Импульсный возбудитель и детерминированный шум проходят через три параллельных резонатора; правила фонем собирают цифры или названия букв. "
        "Numbers использует собственную 32-тактовую аранжировку при 67 BPM; буквы — собственную битовую петлю. Микшер размещает речь по пульсу и приглушает музыку. "
        "Записи человека, SAPI и готовый TTS не используются; разборчивость оценивается отдельно пользователем.",
        code, [link("Как сделано", "tools/voice/README.md"), link("Описание выпуска", "issledovanie/bit-voice/README.md"),
               link("Формантный движок", "tools/voice/formant_voice.py")],
        audio=url(artifact("issledovanie/bit-voice", stem, ".mp3")))

for stem, title in [("procedural-v1-digits", "Голос знаков · цифры 0–9"),
                     ("procedural-v1-letters-ru", "Голос знаков · русский алфавит"),
                     ("procedural-v1-bank", "Голос знаков · полный банк 69 знаков")]:
    add("voice-" + stem, title, "voices", "Процедурный банк букв и цифр · экспериментальный голос.",
        "Шестьдесят синусоидальных гармоник, собственный xorshift-шум и четыре резонатора создают фонемы. "
        "Явная партитура задаёт названия букв и цифр, мягкость, смычки и переходы. WAV вычислен из формул; в полном банке клипы разделены короткими паузами. "
        "При чтении в приложении время слова дополнительно подстраивается под долю.",
        "mayatnik/sign-voice/generate_procedural_bank.py",
        [link("Как сделано", "mayatnik/sign-voice/README.md"), link("Смещения и фонемные партитуры", "mayatnik/sign-voice/procedural-v1-bank.json"),
         link("Запустить голос знаков", "mayatnik/Zerkalius-mayatnik-synthesis.html?synthExample=sign-voice")],
        audio=url(artifact("mayatnik/sign-voice", stem, ".wav")))

berlin = "issledovanie/pendulum-music/berlin-cycle"
add("berlin-cycle", "Берлинский цикл", "bits", "Эскиз · 96 BPM · две развивающиеся последовательности.",
    "Две сочинённые последовательности из восьми и семи нот движутся через четыре гармонические области. "
    "Маятники XOR со следом влияют на окончания фраз, тембр и панораму. Расстроенные осцилляторы, медленный дрейф частоты и собственный шум вычисляют звук; "
    "внешняя фонограмма не используется. Сохранены события и параметры; отдельного локального видеоролика у этого эскиза нет.",
    "mayatnik/mayatnik-synthesis-berlin.js",
    [link("Как сделано", berlin + "/README.md"), link("MIDI", berlin + "/berlin-cycle.mid"),
     link("WAV", berlin + "/berlin-cycle.wav"), link("Партитура", berlin + "/score.json"),
     link("Живой опыт", "mayatnik/Zerkalius-mayatnik-synthesis.html?synthExample=berlin-cycle&gpu=0")],
    audio=url(artifact(berlin, "berlin-cycle", ".mp3")), duration=read(berlin + "/score.json")["durationSeconds"])

phone = "issledovanie/phone-theme"
phone_music = read(phone + "/music.json")
for item in phone_music["tracks"]:
    recipe = ("Новый мотив и гармонический цикл сочинены для этой аранжировки. Маятники меняют динамику, события сопровождения и панораму. "
              "Собственный движок вычисляет гармоники lead, фортепиано, баса и ударных; затем добавляет короткое эхо и фильтрацию. "
              "Полная карта нот и состояний поля сохранена в JSON; это продолжение собственных композиций Синтеза.")
    links = [link("Как сделано", phone + "/music/README-music.md"), link("Партитура", phone + "/" + item["recipe"])]
    midi = phone + "/" + item["recipe"].replace("-score.json", ".mid")
    if (ROOT / midi).is_file():
        links.append(link("MIDI", midi))
    add("phone-" + item["id"], item["title"], "phone", item["description"], recipe,
        phone + "/music/build-music.cjs", links, audio=url(phone + "/" + item["src"]), duration=item["duration"])
    ring = item["ringtone"]
    add("ringtone-" + item["id"], item["title"] + " · звонок", "phone", "Короткая версия собственной композиции.",
        "Фрагмент готового собственного MP3 от " + str(round(ring["start"], 3)) + " до " + str(round(ring["end"], 3)) + " секунды. "
        "Вырезан по музыкальной фразе: входной фейд 25 мс, выходной 650 мс. Звук наследует исходный синтез; это монтаж, а не новая независимая композиция.",
        phone + "/music/build-music.cjs", links + [link("M4R для телефона", phone + "/" + ring["m4r"])],
        audio=url(phone + "/" + ring["mp3"]), duration=ring["duration"], tags=["звонок"])

for item in phone_music["notifications"]:
    add("signal-" + item["id"], item["title"], "signals", "Уведомление · из «" + item["sourceTitle"] + "».",
        "Вырезка собственной рассчитанной композиции: " + str(item["start"]) + "–" + str(item["end"]) + " с. "
        "Стереоканалы сведены в моно как их среднее; атака 18 мс и затухание 160 мс сглаживают края. "
        "Источник, интервал и точный фильтр сохранены в манифесте; это не отдельный звуковой эффект из чужой библиотеки.",
        phone + "/music/build-music.cjs", [link("Как сделано", phone + "/music/README-music.md"),
        link("WAV", phone + "/" + item["wav"]), link("Источник фрагмента", relative(phone, item["source"])),
        link("Манифест", phone + "/music.json")], audio=url(phone + "/" + item["src"]), duration=item["duration"], tags=["уведомление"])

for item in read(phone + "/sms.json")["signals"]:
    add("signal-" + item["id"], item["title"], "signals", "SMS · ноты из «" + item["sourceTitle"] + "».",
        "Отдельная нота либо пара нот взяты из собственной JSON-партитуры и синтезированы заново. "
        "Сохранены высота и семейство тембра, но задана короткая огибающая: атака 3 мс, экспоненциальный спад и завершение 18 мс. "
        "Нет музыкальной подложки, эха и реверберации. Это переработка нот, а не вырезка готового MP3.",
        phone + "/music/build-sms.cjs", [link("Как сделано", phone + "/music/README-sms.md"),
        link("WAV", phone + "/" + item["wav"]), link("Исходная партитура", phone + "/" + item["recipe"]["sourceScore"]),
        link("Рецепт сигнала", phone + "/sms.json")], audio=url(phone + "/" + item["src"]), duration=item["duration"], tags=["SMS"])

wallpaper_records = read(phone + "/wallpapers.json")["wallpapers"]
wallpaper_records += read(phone + "/wallpapers-geometric.json")["wallpapers"]
posters = {item["id"]: item["thumb"] for item in wallpaper_records}
for item in read(phone + "/live/manifest.json")["items"]:
    add("live-" + item["id"], item["title"] + (" · монохром" if item["variant"] == "mono" else " · цвет"), "live",
        "Живое построение · 128 шагов · вертикальное видео со звуком.",
        "Видеокадры вычисляются из живого рецепта. Та же строка поля сворачивается в 16 полос и задаёт нотные события; RGB-сцены читают каналы отдельно. "
        "Битовые гармоники, резонаторы и собственная ритмическая сетка создают музыку. Формантный робот из осцилляторов и шума произносит «ноль», «один», «Зеркалиус». "
        "Сборщик соединяет собственные кадры и звук; темп 137 BPM — рабочая настройка, бесшовность не заявлена.",
        phone + "/build-live.cjs", [link("Как сделано", phone + "/README.md"), link("Голос робота", "tools/voice/README.md"),
        link("Открыть живой рецепт", relative(phone, item["source"])), link("MIDI", phone + "/" + item["midi"]["path"]),
        link("Партитура", phone + "/" + item["score"]["path"])],
        audio=url(phone + "/" + item["audio"]["path"]), video=url(phone + "/" + item["video"]["path"]),
        poster=url(phone + "/" + posters[item["id"]]), duration=item["duration"])

# This module exports declarative records in Node; no synthesis or rendering runs.
examples = json.loads(subprocess.check_output(["node", "-e", "process.stdout.write(JSON.stringify(require(process.argv[1])))",
                       str(ROOT / "mayatnik/mayatnik-synthesis-examples.js")], encoding="utf-8"))
for item in examples:
    add("fractal-" + item["id"], item["label"], "fractals", item["settings"],
        "Модель клеточного автомата, геометрии либо игры хаоса строит кадры. В клеточных рядах взвешенная сумма активных клеток выбирает пентатонику; "
        "в хаосе нота зависит от вершины, в других геометриях — от координаты. Плотность меняет октаву, силу и панораму. "
        "Общий собственный синтезатор вычисляет фортепиано и ударные; сборщик соединяет кадры и рассчитанный WAV в 12-секундное видео.",
        "issledovanie/cellular-visual-labs/render-examples.cjs",
        [link("Как сделано и параметры", "issledovanie/cellular-visual-labs/"),
         link("Открыть живой опыт", "mayatnik/Zerkalius-mayatnik-synthesis.html?synthExample=" + item["id"]),
         link("Код геометрических моделей", "mayatnik/mayatnik-synthesis-fractals.js")],
        video=url(artifact("issledovanie/cellular-visual-labs/examples", item["id"], ".mp4")), duration=12)

# Explicit release inventory from the Results/Stand pages and the 2026-11-18 audit.
visuals = [("rezultaty/glyphen-xor-3d-mp3-20261112.mp4", "Glyphen XOR · 3D"),
 ("rezultaty/binarnoe-prishestvie-20261027.mp4", "Бинарное пришествие"),
 ("rezultaty/rec-0005-20261027.mp4", "Бинарная крест-Антенна"),
 ("rezultaty/rombo-kvadratus-20261027.mp4", "Ромбо-квадратус"),
 ("rezultaty/rec-0003-20261027.mp4", "Запись 0003"),
 ("rezultaty/mayatnik-tochka-os-1.mp4", "Маятник: раскраска по Точке Оси · вариант 1"),
 ("rezultaty/prilyot-zerkaliusa.mp4", "Прилёт Зеркалиуса"),
 ("stend/assets/loop-zoom-x4.mp4", "Петля по пикселям · увеличение ×4"),
 ("stend/assets/growth-1080.mp4", "Рост битов · 1080p"),
 ("stend/assets/growth-4k.mp4", "Рост битов · 4K")]
for path, title in visuals:
    source = "rezultaty/Zerkalius-rezultaty.html" if path.startswith("rezultaty/") else "stend/Zerkalius-stend.html"
    add("visual-" + Path(path).stem, title, "visuals", "Визуальный ролик без звуковой дорожки.",
        "Сохранённый видеоряд геометрических построений Зеркалиуса. В текущем файле нет аудиодорожки; "
        "у пяти старых битмультфильмов она удалена 18 ноября после уточнения происхождения музыки. "
        "Точный воспроизводимый паспорт исходной записи для этой карточки не восстановлен; текущая страница показывает сохранённое видео.",
        source, [link("Исходная галерея", source), link("Сведения о происхождении и очистке", "audit/reports/2026-11-18-music-inventory.md")],
        video=url(path), tags=["без звука"])

tools = [
 ("synthesis", "Синтез · два маятника и музыкальные модели", "mayatnik/Zerkalius-mayatnik-synthesis.html", "mayatnik/mayatnik-synthesis-music.js",
  "Два поля и логические операции управляют частью нот, динамикой и панорамой; гармония и форма задаются отдельно. Осцилляторы, собственный шум и огибающие вычисляют звук. Включите «Звук» и запустите построение."),
 ("xorrom", "Маятник · Xorrom", "mayatnik/Zerkalius-mayatnik.html", "mayatnik/mayatnik-xorrom.js",
  "Xorrom читает единицы и RGB-категории поля, переводит их в ступени лада и синтезирует ноты, аккорды и сопровождение. Можно менять тембр, огибающую, фильтр и эффекты; готовая фонограмма не требуется."),
 ("bit-synthesis", "Гармоники битов, Шеппард и Щелчок", "mayatnik/Zerkalius-mayatnik-synthesis.html", "mayatnik/mayatnik-bit-synthesis.js",
  "Число и маски строки задают сумму синусоидальных гармоник с огибающей. Это собственный битовый синтез; название «Шеппард» не доказывает классический бесконечный подъём."),
 ("hub", "Хаб · стекание со звуком", "index.html", "_js/hub-rhomb-music.js",
  "При стекании по соседним единицам звучит синус. Строка циклически выбирает До–Си; атака 12 мс, экспоненциальный спад и остановка через 370 мс. Это вычисленный тон, не фрагмент песни."),
 ("zz", "Зазеркалиус · читающие головки", "zazerkalius/Zerkalius-zazerkalius.html", "zazerkalius/zz-ui.js",
  "Единица запускает ноту, ноль оставляет паузу. Высота зависит от строки или битового окна; синус, треугольник, квадрат и пила создаются осцилляторами. Колокол добавляет синус на частоте 2,76 от основной."),
 ("synchrophasotron", "Синхрофазотрон · музыкальное чтение", "sinhrofazotron/Zerkalius-sinhrofazotron.html", "sinhrofazotron/zz-ui.js",
  "Читающие головки превращают единицы поля в события выбранного лада, нули — в паузы. Высота зависит от строки или окна битов. Тембры вычисляются осцилляторами; выбор головки и темпа выполняется в инструменте."),
 ("synchrorhomb", "Синхроромб · музыкальное чтение", "sinhroromb/Zerkalius-sinhroromb.html", "sinhroromb/zz-ui.js",
  "Битовое поле управляет нотами читающих головок. Лад, темп и положение головки выбираются в приложении; звук создаётся собственными осцилляторами и огибающими."),
 ("sign-voice", "Голос знаков · ввести свои буквы и цифры", "mayatnik/Zerkalius-mayatnik-synthesis.html?synthExample=sign-voice", "mayatnik/mayatnik-synthesis-sign-clock.js",
  "Текст либо верхняя строка выделенного поля превращается в последовательность имён знаков. Процедурный банк вычислен из гармоник, шума, резонаторов и фонемных правил; музыкальная доля управляет моментом запуска слова.")]
for id, title, destination, source, recipe in tools:
    add("tool-" + id, title, "tools", "Живой инструмент · запуск и параметры на исходной странице.", recipe,
        source, [link("Открыть инструмент", destination), link("Как устроено", "audit/reports/2026-11-18-music-inventory.md")], tags=["инструмент"])

catalog = {"version": 1, "groups": [{"id": id, "label": label} for id, label in GROUPS], "items": items}
(HERE / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"items": len(items), "groups": {id: sum(item["group"] == id for item in items) for id, _ in GROUPS}}, ensure_ascii=True))
