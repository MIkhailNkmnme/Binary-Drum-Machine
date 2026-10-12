#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
gif-masshtab.py — «отъезд камеры» от битового кадра: GIF, где кадр уменьшается так же, как его уменьшает экран.

2026-10-12, слово пользователя: «нужен гиф-аниматор, который из битового кадра любой величины (100 %) сделает более мелкие,
и при этом так сжать и удалить пиксели, чтобы они виделись так, как виделись бы при просмотре большого файла на компе
в уменьшенном масштабе».

Как экран уменьшает картинку (сверено со снимками пользователя пиксель в пиксель, «Исследование», раздел 21):
без усреднения — каждый экранный пиксель берёт ровно один бит, тот, что под его серединой; остальные биты выброшены.
Экранный пиксель (X, Y) окна шириной W и высотой H при масштабе z и центре (cx, cy) показывает бит
    ( ⌊(X + ½ − W/2) / z + cx⌋ , ⌊(Y + ½ − H/2) / z + cy⌋ ).
Отсюда и «другая картинка на каждом масштабе»: при разном z в окно попадают разные биты.

Запуск (из папки Binary-Drum-Machine):
  python mayatnik/gif-masshtab.py КАДР.png
  python mayatnik/gif-masshtab.py КАДР.png --w 1280 --h 720 --kadrov 60 --ms 90 --metka
  python mayatnik/gif-masshtab.py horr            заготовка вместо файла (список — --spisok)
Заготовки (2026-10-12, «пусть там всегда будут заготовки хорр, зерк послед и ещё какие-нибудь»):
  horr      Хоррориус: 512 строк, 513 вершин — кадр из XorRora_512x512.xlsx (ключи --stroki, --vershin меняют)
  horr96    Хоррориус 2024 строки, кадр 96 — тот, что на снимках экрана пользователя («Исследование», раздел 21)
  zerk      начальная последовательность Зеркалиуса (_js/initial-rows.js), бит — кирпичик 2 × 1, ряды по центру
  hub       кадр Хоррориуса хаба и Треугольника по умолчанию (_js/horr-rows.js, 128 строк), так же кирпичиками
  serp      треугольник Серпинского — правило 90 из одной точки (--stroki, 1024)
  zatuh     затухающий маятник: те же вершины в обратном порядке, ±512 → 0 — чистая геометрия без шума (1024 строки)
  anim      Аниматрица 90: Серпинский после P/4 + 1 проходов волны — самый густой кадр цикла (--stroki, 512)
  bity8192  большой кадр бит в бит (E:\GD\_pzl\mayatnik-big\N8192-n2859-bity\), если он посчитан
Цвета заготовок: 1 — светлый, 0 — серый, пусто — тёмный (как на странице Маятника). GIF заготовок по умолчанию
ложится в E:\GD\_pzl\mayatnik-big\gif\<заготовка>-masshtab.gif.
Ключи:
  --w, --h       размер окна (экрана), по умолчанию 1280 × 720
  --ot           начальный масштаб, 1 = 100 % (по умолчанию 1)
  --do           конечный масштаб; по умолчанию — «весь кадр в окне»
  --kadrov       сколько кадров между ними (масштаб меняется в одно и то же число раз за кадр), 48
  --masshtaby    вместо плавного ряда — свой список, например 1,0.66,0.52,0.31,0.24,0.19,0.15,0.115
  --centr        точка, к которой отъезжает камера: «x,y» в пикселях кадра; по умолчанию — середина кадра
  --ms           длительность кадра, мс (90); последний кадр держится втрое дольше
  --obratno      добавить обратный ход — GIF туда и обратно
  --metka        подпись масштаба в углу («37 %»)
  --png          сохранить и каждый кадр отдельным PNG
  --out          имя GIF; по умолчанию рядом с кадром: <имя>-masshtab.gif
  --cveta        цвета нулей и единиц в GIF: seryi (как Маятник), ChB (1 чёрные, 0 белые), BCh (1 белые, 0 чёрные),
                 BK (1 белые, 0 красные), KB (1 красные, 0 белые); имя GIF получает приставку цвета
  --romby S      вместе с --razmery: ещё PNG ромбами впритык — подслой конуса якоря (ряд r — r + 1 бит, как треугольники
                 Зеркалиуса), бит — ромб с полудиагональю S px, ряды сдвинуты на полромба, пусто прозрачное
  --razmery      только PNG Хоррориуса разных размеров, без GIF: --razmery 64,128,256,512,1024,2048
                 (в E:\GD\_pzl\mayatnik-big\png\, пиксель = бит; второй файл — с прозрачным пустым местом)
Цвета кадра сохраняются как есть (палитра исходника); за краем кадра — тёмный фон.
"""
import argparse, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

Image.MAX_IMAGE_PIXELS = None   # битовые кадры бывают по сотне миллионов пикселей — это не «бомба», а наш кадр


def load(path):
    """Кадр → (массив индексов цвета, палитра). Палитровый PNG берётся как есть, прочие — сводятся к своим цветам."""
    im = Image.open(path)
    if im.mode == 'P':
        pal = im.getpalette()[:768]
        return np.asarray(im, dtype=np.uint8), pal
    if im.mode in ('1', 'L'):
        a = np.asarray(im.convert('L'), dtype=np.uint8)
        vals = np.unique(a)
        if len(vals) <= 255:
            lut = np.zeros(256, np.uint8); lut[vals] = np.arange(len(vals))
            pal = []
            for v in vals: pal += [int(v)] * 3
            return lut[a], pal
    q = im.convert('RGB').quantize(colors=255, method=Image.Quantize.FASTOCTREE)
    return np.asarray(q, dtype=np.uint8), q.getpalette()[:768]


HERE = os.path.dirname(os.path.abspath(__file__))
PZL = os.path.normpath(os.path.join(HERE, '..', '..', '..'))          # E:\GD\_pzl — рядом с сайтом, вне git
PAL3 = [13, 15, 22, 91, 100, 117, 232, 237, 245]                       # 0 пусто, 1 ноль, 2 один — цвета Маятника
# Цвета PNG разных размеров (--razmery): (цвет нуля, цвет единицы); пустое место всегда прозрачное.
# Имя — буквы «единица, ноль»: ЧБ — единицы чёрные на белом, БЧ — белые на чёрном, БК — белые на красном, КБ — красные на белом.
CVETA = {'seryi': ((91, 100, 117), (232, 237, 245)),
         'ChB':   ((255, 255, 255), (0, 0, 0)),
         'BCh':   ((0, 0, 0), (255, 255, 255)),
         'BK':    ((220, 0, 0), (255, 255, 255)),
         'KB':    ((255, 255, 255), (220, 0, 0))}


def pendulum(N, offs):
    """Маятник (ядро MAYATNIK, ТРЕУГСЖАТИЯ): вершины по списку сдвигов, конус каждой — до низа,
    клетка = старое ⊕ левый ⊕ правый родитель (родители уже пересчитаны), пусто считается 0.
    Возвращает поле 0 пусто / 1 ноль / 2 один."""
    lo, hi = min(offs), max(offs)
    W = hi - lo + 2 * (N - 1) + 3; A = (N - 1) - lo + 1
    v = np.zeros((N, W), np.uint8); f = np.zeros((N, W), bool)          # бит и «заполнено»
    for o in offs:
        c = A + o
        v[0, c] = 1; f[0, c] = True                                       # вершина — всегда 1
        for r in range(1, N):
            s = slice(c - r, c + r + 1, 2)
            v[r, s] ^= v[r - 1, c - r - 1:c + r:2] ^ v[r - 1, c - r + 1:c + r + 2:2]
            f[r, s] = True
    return np.where(f, v + 1, 0).astype(np.uint8)


def rhombs(F, N, n, S):
    """Подслой конуса якоря ромбами впритык: бит (r, c), c = −r, −r + 2, …, +r от якоря — ромб с центром (c·S, r·S)
    и полудиагоналями S по горизонтали и по вертикали (|dx| + |dy| ≤ S). Такие ромбы одного подслоя покрывают
    плоскость без щелей и наложений; ряд r — r + 1 ромбов, соседние ряды сдвинуты на полромба. Вне конуса — пусто (0)."""
    cols = np.nonzero((F > 0).any(0))[0]
    A = (N - 1) - min(pend_offs(n)) + 1                 # столбец якоря в поле pendulum()
    Wd, Hd = 2 * N * S + 1, N * S + S + 1
    out = np.zeros((Hd, Wd), np.uint8)
    X = np.arange(Wd)[None, :] / S - N                  # в клетках, якорь — 0
    for y0 in range(0, Hd, 512):                        # полосами — экономно по памяти
        Y = (np.arange(y0, min(Hd, y0 + 512))[:, None]) / S - 0.5
        a, b = X + Y, X - Y                             # повёрнутые координаты: центры — где a и b чётные
        Aa, Bb = 2 * np.round(a / 2), 2 * np.round(b / 2)
        c = ((Aa + Bb) / 2).astype(np.int64); r = ((Aa - Bb) / 2).astype(np.int64)
        ok = (r >= 0) & (r < N) & (np.abs(c) <= r)
        rr, cc = np.where(ok, r, 0), np.where(ok, A + c, 0)
        v = F[rr, cc]
        out[y0:y0 + Y.shape[0]] = np.where(ok, v, 0)
    return out


def pend_offs(n):   # якорь, −1, +1, −2, +2, …
    return [0 if k == 0 else (-((k + 1) >> 1) if k % 2 else (k >> 1)) for k in range(n)]


def rows_js(path, name):
    """Строки бит из модуля _js (const NAME = Object.freeze([ "…", … ]))."""
    import re
    t = open(path, encoding='utf-8').read()
    body = t[t.index(name):]
    return re.findall(r'"([01]+)"', body[:body.index(']')])


def brick(rows):
    """Строки разной длины (ряд r — r + 1 бит) — треугольником по центру: бит — кирпичик 2 × 1, соседние ряды сдвинуты на полбита."""
    R = len(rows); L = max(len(x) for x in rows); W = 2 * L
    out = np.zeros((R, W), np.uint8)
    for r, s in enumerate(rows):
        x0 = (W - 2 * len(s)) // 2
        for k, ch in enumerate(s):
            out[r, x0 + 2 * k:x0 + 2 * k + 2] = 2 if ch == '1' else 1
    return out


def serp(N):
    W = 2 * N + 1; A = N; v = np.zeros((N, W), np.uint8); v[0, A] = 1
    for r in range(1, N): v[r, 1:-1] = v[r - 1, :-2] ^ v[r - 1, 2:]
    cone = np.abs(np.arange(W)[None, :] - A) <= np.arange(N)[:, None]
    return np.where(cone, v + 1, 0).astype(np.uint8)


def animatrica(N):
    """Серпинский и P/4 + 1 проходов волны: каждая строка ⊕ уже переписанная строка над ней (цикл P = 2^m ≥ N)."""
    s = serp(N); v = (s == 2).astype(np.uint8); cone = s > 0
    P = 1
    while P < N: P *= 2
    for _ in range(P // 4 + 1):
        for i in range(1, N): v[i] ^= v[i - 1]
    return np.where(cone, v + 1, 0).astype(np.uint8)


def preset(name, a):
    """Заготовка → (поле индексов, палитра, имя)."""
    if name == 'horr':
        N = a.stroki or 512; n = a.vershin or (N + 1)
        return pendulum(N, pend_offs(n)), PAL3, f'horr-{N}x{n}'
    if name == 'horr96':
        return pendulum(2024, pend_offs(96)), PAL3, 'horr-2024x96'
    if name == 'zerk':
        return brick(rows_js(os.path.join(HERE, '..', '_js', 'initial-rows.js'), 'ZZ_INITIAL_ROWS')), PAL3, 'zerk'
    if name == 'hub':
        return brick(rows_js(os.path.join(HERE, '..', '_js', 'horr-rows.js'), 'ZZ_HORR_ROWS')), PAL3, 'hub-horr128'
    if name == 'serp':
        N = a.stroki or 1024; return serp(N), PAL3, f'serp-{N}'
    if name == 'zatuh':
        N = a.stroki or 1024; M = (a.vershin or (N + 1)) // 2
        return pendulum(N, list(reversed(pend_offs(2 * M + 1)))), PAL3, f'zatuh-{N}x{2 * M + 1}'
    if name == 'anim':
        N = a.stroki or 512; return animatrica(N), PAL3, f'anim-{N}'
    if name == 'bity8192':
        p = os.path.join(PZL, 'mayatnik-big', 'N8192-n2859-bity', 'kadr-002859-bity.png')
        if not os.path.exists(p): sys.exit('Нет файла ' + p + ' — посчитать: node mayatnik/mayatnik-big.cjs --rows 8192 --bits')
        src, pal = load(p); return src, pal, 'bity8192'
    return None


PRESETS = ['horr', 'horr96', 'zerk', 'hub', 'serp', 'zatuh', 'anim', 'bity8192']


def frame(src, z, W, H, cx, cy, bg):
    """Один экранный кадр: ближайший бит под серединой каждого экранного пикселя, за краем — фон."""
    Hs, Ws = src.shape
    xs = np.floor((np.arange(W) + 0.5 - W / 2) / z + cx).astype(np.int64)
    ys = np.floor((np.arange(H) + 0.5 - H / 2) / z + cy).astype(np.int64)
    okx = (xs >= 0) & (xs < Ws); oky = (ys >= 0) & (ys < Hs)
    out = np.full((H, W), bg, np.uint8)
    out[np.ix_(oky, okx)] = src[np.ix_(ys[oky], xs[okx])]
    return out


def main():
    ap = argparse.ArgumentParser(description='GIF: битовый кадр уменьшается так, как его уменьшает экран (без усреднения)')
    ap.add_argument('kadr', nargs='?', default='horr', help='PNG-кадр или заготовка: ' + ', '.join(PRESETS))
    ap.add_argument('--spisok', action='store_true', help='показать заготовки')
    ap.add_argument('--stroki', type=int, default=None); ap.add_argument('--vershin', type=int, default=None)
    ap.add_argument('--cveta', default=None, help='цвета нулей и единиц: seryi, ChB, BCh, BK, KB')
    ap.add_argument('--romby', type=int, default=0, help='с --razmery: ещё PNG ромбами впритык (подслой конуса якоря), полудиагональ ромба в пикселях')
    ap.add_argument('--razmery', default=None, help='только PNG Хоррориуса этих размеров, например 64,128,256,512 (вершин — N + 1 или --vershin)')
    ap.add_argument('--w', type=int, default=1280); ap.add_argument('--h', type=int, default=720)
    ap.add_argument('--ot', type=float, default=1.0); ap.add_argument('--do', type=float, default=None)
    ap.add_argument('--kadrov', type=int, default=48); ap.add_argument('--masshtaby', default=None)
    ap.add_argument('--centr', default=None); ap.add_argument('--ms', type=int, default=90)
    ap.add_argument('--obratno', action='store_true'); ap.add_argument('--metka', action='store_true')
    ap.add_argument('--png', action='store_true'); ap.add_argument('--out', default=None)
    a = ap.parse_args()

    if a.spisok:
        print(__doc__[__doc__.index('Заготовки'):__doc__.index('Ключи:')]); return
    if a.razmery:   # «png разных размеров Хоррориуса»: только кадры, пиксель = бит, без GIF
        D = os.path.join(PZL, 'mayatnik-big', 'png'); os.makedirs(D, exist_ok=True)
        for N in [int(x) for x in a.razmery.split(',')]:
            n = a.vershin or (N + 1)
            F = pendulum(N, pend_offs(n)); cols = np.nonzero((F > 0).any(0))[0]; F = F[:, cols.min():cols.max() + 1]
            if a.romby:   # «ромбами тоже, впритык и только битами»: подслой конуса якоря, бит — ромб, без щелей
                Fr = rhombs(pendulum(N, pend_offs(n)), N, n, a.romby)
                ir = Image.fromarray(Fr, 'P')
                for nm, (c0, c1) in CVETA.items():
                    ir.putpalette([0, 0, 0] + list(c0) + list(c1) + [0] * 759)
                    ir.save(os.path.join(D, f'horr-{N}x{n}-romby{a.romby}-{nm}.png'), optimize=True, transparency=bytes([0]) + bytes([255] * 255))
                print(f'  ромбами (полудиагональ {a.romby} px): {Fr.shape[1]} × {Fr.shape[0]}')
            im = Image.fromarray(F, 'P'); tr = bytes([0]) + bytes([255] * 255)   # пусто (индекс 0) — прозрачное
            for nm, (c0, c1) in CVETA.items():       # «с разными вариантами и с ЧБ, БЧ… БК — красный вместо чёрного»
                im.putpalette([0, 0, 0] + list(c0) + list(c1) + [0] * 759)
                im.save(os.path.join(D, f'horr-{N}x{n}-{nm}.png'), optimize=True, transparency=tr)
            print(f'{N} строк, {n} вершин: {F.shape[1]} × {F.shape[0]} — {len(CVETA)} цветов: ' + ', '.join(CVETA))
        return
    if a.kadr in PRESETS:
        src, pal, nm = preset(a.kadr, a)
        os.makedirs(os.path.join(PZL, 'mayatnik-big', 'gif'), exist_ok=True)
        base = os.path.join(PZL, 'mayatnik-big', 'gif', nm)
        im = Image.fromarray(src, 'P'); im.putpalette(pal + [0] * (768 - len(pal))); im.save(base + '.png')   # сам кадр, 1 пиксель = 1 бит
    else:
        src, pal = load(a.kadr); base = os.path.splitext(a.kadr)[0]
    if a.cveta:   # цвета 0 и 1 кадра-заготовки или трёхцветного битового PNG: seryi, ChB, BCh, BK, KB
        if a.cveta not in CVETA: sys.exit('Цвета: ' + ', '.join(CVETA))
        if int(src.max()) <= 2:
            c0, c1 = CVETA[a.cveta]; pal = [13, 15, 22] + list(c0) + list(c1); base += '-' + a.cveta
    Hs, Ws = src.shape
    W, H = a.w, a.h
    cx, cy = (Ws / 2, Hs / 2) if not a.centr else map(float, a.centr.split(','))
    fit = min(W / Ws, H / Hs)
    if a.masshtaby:
        zs = [float(v) for v in a.masshtaby.split(',')]
    else:
        z0, z1 = a.ot, (a.do if a.do else fit)
        n = max(2, a.kadrov)
        zs = [z0 * (z1 / z0) ** (i / (n - 1)) for i in range(n)]
    # палитра: цвета кадра + фон + цвет метки
    used = int(src.max()) + 1
    bg, ink = used, used + 1
    pal = (pal + [0] * 768)[:768]
    pal[bg * 3:bg * 3 + 3] = [13, 15, 22]; pal[ink * 3:ink * 3 + 3] = [255, 210, 0]
    try: font = ImageFont.truetype('consola.ttf', max(14, H // 30))
    except OSError: font = ImageFont.load_default()

    out = a.out or base + '-masshtab.gif'
    print(f'Кадр {Ws} × {Hs}, окно {W} × {H}, масштабов {len(zs)}: от {zs[0] * 100:.2f} % до {zs[-1] * 100:.2f} %'
          f' (весь кадр в окне — {fit * 100:.2f} %)')
    ims = []
    for i, z in enumerate(zs):
        f = Image.fromarray(frame(src, z, W, H, cx, cy, bg), 'P'); f.putpalette(pal)
        if a.metka:
            t = f'{z * 100:.1f} %' if z < 0.1 else f'{z * 100:.0f} %'
            ImageDraw.Draw(f).text((10, 8), t, fill=ink, font=font)
        if a.png: f.save(f'{base}-m{i + 1:03d}.png')
        ims.append(f)
        sys.stdout.write(f'\r  кадр {i + 1} / {len(zs)} · {z * 100:.2f} %   '); sys.stdout.flush()
    seq = ims + (ims[-2:0:-1] if a.obratno else [])
    dur = [a.ms] * len(seq)
    dur[len(ims) - 1] = a.ms * 3
    seq[0].save(out, save_all=True, append_images=seq[1:], duration=dur, loop=0, optimize=False, disposal=1)
    print(f'\nГотово: {out} — {len(seq)} кадров, {os.path.getsize(out) / 1e6:.1f} МБ')


if __name__ == '__main__':
    main()
