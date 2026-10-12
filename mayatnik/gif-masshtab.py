#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
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
    ap.add_argument('kadr')
    ap.add_argument('--w', type=int, default=1280); ap.add_argument('--h', type=int, default=720)
    ap.add_argument('--ot', type=float, default=1.0); ap.add_argument('--do', type=float, default=None)
    ap.add_argument('--kadrov', type=int, default=48); ap.add_argument('--masshtaby', default=None)
    ap.add_argument('--centr', default=None); ap.add_argument('--ms', type=int, default=90)
    ap.add_argument('--obratno', action='store_true'); ap.add_argument('--metka', action='store_true')
    ap.add_argument('--png', action='store_true'); ap.add_argument('--out', default=None)
    a = ap.parse_args()

    src, pal = load(a.kadr)
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

    base = os.path.splitext(a.kadr)[0]
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
