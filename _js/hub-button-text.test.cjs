const {test}=require('node:test');
const assert=require('node:assert/strict');
const {shortCaption}=require('./hub-button-text.js');
test('button words use original neighbours and preserve soft and hard signs',()=>{
  for(const [full,short]of[['Ширина','Шрна'],['Центр','Цнтръ'],['Цвет','Цвтъ'],['Заливка','Злвка'],['Ось','Ось'],['Пуск','Пскъ'],['ЦВЕТ','ЦВТЪ'],['Биты','Бты'],['Подъём','Пдъёмъ'],['Объект','Объектъ']])assert.equal(shortCaption(full),short);
});
test('mixed captions keep numbers, English, glyphs and punctuation',()=>{
  assert.equal(shortCaption('↶ Отмена | ↷ Повтор: PNG 4K · 12,5 %'),'↶ Отмна | ↷ Пвтръ: PNG 4K · 12,5 %');
  assert.equal(shortCaption('Соль · Do Re Mi'),'Сль · Do Re Mi');
});
test('reapplying captions copied into other button groups adds no extra changes',()=>{
  for(const full of ['Центр Цвет Ось','Сохранить','Зеркалиус','Шаблоны Маятника','Подъём 12'])assert.equal(shortCaption(shortCaption(full)),shortCaption(full));
});
