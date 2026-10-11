"""Codex — независимый исследователь Хоррориуса, 2026-10-12.
Plot the complete, certified edge motifs, not just sampled rows."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

base = Path(__file__).resolve().parent
data = {r['vertices']: r for r in json.loads((base / 'horrorius-edge-results.json').read_text(encoding='utf-8'))['results']}
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 12})
fig, axes = plt.subplots(2, 1, figsize=(11, 6.6), constrained_layout=True)
fig.patch.set_facecolor('#10151d')
fig.suptitle('Codex · независимый исследователь Хоррориуса · 12.10.2026', color='#8d9caa', fontsize=10)
for ax, n in zip(axes, [48, 64]):
    row = data[n]
    period, first, motif = row['provenEventualEdgePeriod'], row['strip']['firstRow'], row['edgeMotif']
    xs = list(range(2*n, 2*n+3*period+1))
    ys = [motif[(r-first) % period] for r in xs]
    ax.set_facecolor('#161e28')
    ax.step(xs, ys, where='post', color='#70e0d7', linewidth=1.8)
    for r in range(2*n, xs[-1]+1, period):
        ax.axvline(r, color='#ffd35f', linestyle='--', alpha=.7)
    if n == 48:
        ax.scatter([96,120],[1,9],color='#ff8a83',s=70,zorder=3)
        ax.annotate('r=96: d=1; r=120: d=9\nсдвиг n/2=24 не повторяет край',
                    (120,9),xytext=(127,10.3),color='#ffb4aa',fontsize=10,
                    arrowprops={'arrowstyle':'->','color':'#ffb4aa'})
    ax.set_title(f'{n} вершин · точный период края {period} строк', color='#edf3ff', loc='left', pad=10)
    ax.set_ylabel('Отступ первого 0\nот c = −r', color='#c8d6e5')
    ax.set_xlabel('Строка r (от 0)', color='#c8d6e5')
    ax.set_xlim(xs[0],xs[-1])
    ax.set_ylim(-.5,max(ys)+2.5)
    ax.tick_params(colors='#b8c7d6')
    ax.grid(alpha=.13,color='#aebccc')
    for spine in ax.spines.values(): spine.set_color('#526171')
fig.savefig(base/'horrorius-edge-period.png',dpi=160,facecolor=fig.get_facecolor())
