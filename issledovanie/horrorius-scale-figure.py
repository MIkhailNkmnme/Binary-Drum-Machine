"""Codex — независимый исследователь Хоррориуса · 12.10.2026.
Synthetic sampling counterexample, computed from the bit array."""
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
bits=np.indices((16,16)).sum(axis=0)%2
density=bits.reshape(8,2,8,2).mean(axis=(1,3))
fig,axes=plt.subplots(1,4,figsize=(12,4.1),constrained_layout=True)
fig.patch.set_facecolor('#10151d')
images=[bits,bits[::2,::2],bits[::2,1::2],density]
titles=['Исходные биты 16×16','Выбор каждого 2-го:\nвсе нули','Сдвиг выбора на 1:\nвсе единицы','Точный подсчёт 2×2:\nвезде 50% единиц']
for ax,img,title in zip(axes,images,titles):
    ax.imshow(img,cmap='gray',vmin=0,vmax=1,interpolation='nearest')
    ax.set_title(title,color='#e0e9f4',fontsize=11);ax.axis('off')
fig.suptitle('Codex · независимый исследователь Хоррориуса · 12.10.2026',color='#91a6bb',fontsize=10)
fig.text(.5,.025,'Одни исходные данные: выбор отдельных пикселей меняет вид, точная плотность сохраняет состав.',ha='center',color='#a9bfce',fontsize=10)
fig.savefig(Path(__file__).with_name('horrorius-scale-check.png'),dpi=150,facecolor=fig.get_facecolor())
