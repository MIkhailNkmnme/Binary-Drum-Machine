"""Codex — независимый исследователь Хоррориуса · 12.10.2026."""
import importlib.util
from pathlib import Path
from fractions import Fraction
import numpy as np
spec=importlib.util.spec_from_file_location('capture',Path(__file__).with_name('horrorius-scale-capture.py'));capture=importlib.util.module_from_spec(spec);spec.loader.exec_module(capture)
for scale in capture.SCALES:
    for center in ['0','3/2','1407.5','4863.5']:
        for phase in capture.PHASES:
            actual=capture.indices(33,center,scale,phase)
            expected=[int((Fraction(center)+(Fraction(2*i+1-33,2)-Fraction(phase))/Fraction(scale))//1) for i in range(33)]
            assert np.array_equal(actual,expected),(scale,center,phase)
source=np.arange(6*8*3,dtype=np.uint8).reshape(6,8,3)
field,bounds=capture.sample(source,(8,6),('4','3'),'1')
assert np.array_equal(source,field),'1:1 must preserve every source pixel'
field,_=capture.sample(source,(8,6),('0','0'),'1')
assert np.all(field[:3]==0) and np.all(field[:,:4]==0),'out of source must remain empty black'
print('Passed: exact rational coordinates for all scales/phases; 1:1 identity; outside-source handling')
