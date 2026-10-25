const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {shortCaption}=require('./hub-button-text.js');
test('T01–T03 retain root vowels and omit signs after removed final vowels',()=>{
  for(const [full,short]of [['Ширина','Ширн'],['Центр','Центръ'],['Цвет','Цветъ'],['Заливка','Зливк'],['Зеркала','Зеркл'],['ЗЕРКАЛА','ЗЕРКЛ'],['Шаблоны','Шаблн'],['Ось','Ось'],['Пуск','Пускъ'],['ЦВЕТ','ЦВЕТЪ'],['Биты','Бит'],['Подъём','Подъёмъ'],['Объект','Объектъ'],['Ь Ъ','Ь Ъ']])assert.equal(shortCaption(full),short,full);
});
test('both adjacent vowels survive and original neighbours are used',()=>{
  for(const [full,short]of [['Маятник','Маятнкъ'],['Маятнкъ','Маятнкъ'],['Пауза','Пауза'],['Линия','Лния'],['Геоцентр','Геоцнтръ'],['Копия','Кпия'],['Свободная','Свбдная']])assert.equal(shortCaption(full),short,full);
});
test('explicit project captions override the general word rule',()=>{
  for(const [full,short]of [['Загиб Верт','Згибъ Верт'],['Шрна по Оси','Шрна по Оси'],['С нуля','Съ нля'],['С засечками','Съ зсчкми'],['С','Съ']])assert.equal(shortCaption(full),short,full);
});
test('mixed captions retain numbers, English, filenames, identifiers, URLs and glyphs',()=>{
  assert.equal(shortCaption('↶ Отмена | ↷ Повтор: PNG 4K · 12,5 %'),'↶ Отмна | ↷ Пвторъ: PNG 4K · 12,5 %');
  assert.equal(shortCaption('Соль · Do Re Mi'),'Соль · Do Re Mi');
  const protectedText='Ширина.txt Ширина.myt Настройки.mayatnik-backup Ширина_json abcШирина https://example.com/Ширина';
  assert.equal(shortCaption(protectedText),protectedText);
});
test('unknown roots retain vowels instead of choosing an arbitrary first or last vowel',()=>{
  assert.equal(shortCaption('Карапуз'),'Карапузъ');
});
test('project vocabulary is vowel-marked and retains at least one vowel',()=>{
  const source=fs.readFileSync(require.resolve('./hub-button-text.js'),'utf8');
  const marked=source.match(/const roots=new Map\(`([^`]+)`/)[1].trim().split(/\s+/);
  for(const word of marked){
    assert.match(word[word.indexOf('*')+1],/[аеёиоуыэюя]/u,word);
    const full=word.replace('*',''),short=shortCaption(full);
    assert.match(short,/[аеёиоуыэюя]/iu,full);
    assert.match(shortCaption(full.toUpperCase()),/[АЕЁИОУЫЭЮЯ]/u,full);
  }
});
test('the same compact text can represent different full words: observers must retain the full source',()=>{
  assert.equal(shortCaption('Цвета'),'Цвет');
  assert.equal(shortCaption('Цвет'),'Цветъ');
  assert.equal(shortCaption('Строка'),'Строк');
  assert.equal(shortCaption('Строк'),'Строкъ');
});
test('observer reuses full sources, updates dynamic captions and preserves explicit descriptions',()=>{
  const source=fs.readFileSync(require.resolve('./hub-button-text.js'),'utf8'),context={module:{exports:{}},Node:{TEXT_NODE:3,ELEMENT_NODE:1},NodeFilter:{SHOW_TEXT:4},MutationObserver:class {observe(){} disconnect(){}}};
  vm.runInNewContext(source,context);
  const attributes={'aria-label':'Полная доступная команда'},owner={isConnected:true,dataset:{},title:'Полная подсказка',closest(selector){return selector.startsWith('script,')?(this.excluded?this:null):this;},getAttribute:key=>attributes[key]??null,setAttribute:(key,value)=>{attributes[key]=value;}};
  const node={nodeType:3,data:'Цвета',parentElement:owner},body={nodeType:1,matches:()=>false};
  const doc={body,createTreeWalker(){let done=false;return {nextNode(){if(done)return false;done=true;this.currentNode=node;return true;}};}};
  const observed=context.module.exports.observe(doc);
  assert.equal(node.data,'Цвет');
  for(let i=0;i<3;i++)observed.apply(body);
  assert.equal(node.data,'Цвет','a repeated observation must not append the sign');
  node.data='Ширина';observed.apply(node);assert.equal(node.data,'Ширн');
  observed.apply(node);assert.equal(node.data,'Ширн');
  assert.equal(owner.title,'Полная подсказка');assert.equal(attributes['aria-label'],'Полная доступная команда');
  owner.excluded=true;node.data='Пользовательское имя';observed.apply(node);assert.equal(node.data,'Пользовательское имя');
});
