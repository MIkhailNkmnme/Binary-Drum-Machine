"""Codex — независимый исследователь Хоррориуса, 2026-10-12.
Measured hole sizes and separate browser/packed memory estimates."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

base=Path(__file__).resolve().parent
holes={r['rows']:r for r in json.loads((base/'horrorius-hole-results.json').read_text(encoding='utf-8'))['results']}
packed={r['rows']:r for r in json.loads((base/'horrorius-packed-results.json').read_text(encoding='utf-8'))['results']}
capacity=json.loads((base/'horrorius-capacity-results.json').read_text(encoding='utf-8'))
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':11})
def style(ax):
    ax.set_facecolor('#161e28');ax.tick_params(colors='#b8c7d6');ax.grid(alpha=.13,color='#aebccc')
    for spine in ax.spines.values():spine.set_color('#526171')
def figure(axes):
    fig,axs=plt.subplots(axes,1,figsize=(11,3.4*axes),constrained_layout=True)
    fig.patch.set_facecolor('#10151d')
    fig.suptitle('Codex · независимый исследователь Хоррориуса · 12.10.2026',color='#8d9caa',fontsize=10)
    for ax in axs:style(ax)
    return fig,axs
fig,axs=figure(3)
for ax,counts in zip(axs,[(384,512),(768,1024),(600,640)]):
    for N,col in zip(counts,['#70e0d7','#ffd35f']):
        rows=holes[N]['results'];xs=[r['vertices'] for r in rows]
        ax.plot(xs,[r['largest']['height'] for r in rows],color=col,linewidth=1.8,label=f'{N} строк — измерено')
        ax.plot(xs,[r['largestEnvelope'] for r in rows],color=col,alpha=.5,linestyle='--',label=f'{N} — огибающая с обрезкой')
    ax.axhline(16,color='#ff8a83',linestyle=':',alpha=.7)
    ax.set_title(f'{counts[0]} и {counts[1]} строк: высота крупнейшего сплошного нулевого треугольника',color='#edf3ff',loc='left',pad=10)
    ax.set_xlabel('Вершин n',color='#c8d6e5');ax.set_ylabel('Высота, строк',color='#c8d6e5')
    ax.legend(facecolor='#161e28',edgecolor='#526171',labelcolor='#dce8f3',fontsize=9)
axs[0].axvline(128,color='#ff8a83',alpha=.4)
axs[0].annotate('384/3 = 128:\nдыра ещё высотой 67 строк',(128,67),xytext=(50,150),color='#ffb4aa',fontsize=10,
                arrowprops={'arrowstyle':'->','color':'#ffb4aa'})
fig.savefig(base/'horrorius-hole-check.png',dpi=160,facecolor=fig.get_facecolor())

fig,axs=figure(2)
counts=[4096,8192,16384];browser=[]
for N in counts:
    target=packed[N]['targetVertices']
    browser.append(next(r['withOneCanvasBackingMiB'] for r in capacity['memory'] if r['rows']==N and r['vertices']==target))
x=[0,1,2]
axs[0].bar([v-.18 for v in x],browser,width=.36,color='#ffd35f',label='Маятник v0.006: оценка массивов, кадров и RGBA')
axs[0].bar([v+.18 for v in x],[packed[N]['allocatedMiB'] for N in counts],width=.36,color='#70e0d7',label='Упакованная модель: только поле битов')
axs[0].set_yscale('log');axs[0].set_xticks(x,[str(N) for N in counts]);axs[0].set_ylabel('МиБ, логарифмическая шкала',color='#c8d6e5')
axs[0].set_title('Память: разные режимы, оба до N/3 с запасом',color='#edf3ff',loc='left')
axs[0].legend(facecolor='#161e28',edgecolor='#526171',labelcolor='#dce8f3',fontsize=9)
for i,N in enumerate(counts):
    r=packed[N];secs=r['seconds'] if r['measuredFullTarget'] else r['estimatedFullTargetSeconds']
    axs[1].bar(i,secs,color='#70e0d7' if r['measuredFullTarget'] else '#ffd35f',hatch=None if r['measuredFullTarget'] else '///')
    axs[1].text(i,secs+12,f'{secs:.1f} с'+(' — оценка' if not r['measuredFullTarget'] else ' — измерено'),ha='center',color='#dce8f3',fontsize=10)
axs[1].set_xticks(x,[str(N) for N in counts]);axs[1].set_ylim(0,760);axs[1].set_ylabel('Секунды',color='#c8d6e5')
axs[1].set_title('Битовая модель: полный расчёт 4096 и 8192; 16384 — проба 64 вершин',color='#edf3ff',loc='left')
fig.savefig(base/'horrorius-capacity.png',dpi=160,facecolor=fig.get_facecolor())
