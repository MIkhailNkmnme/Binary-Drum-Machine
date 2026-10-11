const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const source = readFileSync(__dirname + '/zz-ui.js', 'utf8');

function fixture() {
  const ctx = vm.createContext({});
  for (const name of ['fillDraft', 'fillLen', 'fillToggleBit', 'fillFreeDraft', 'coneFreeCan', 'coneRing', 'cutBit', 'cutPer']) {
    const start = source.indexOf('function ' + name + '(');
    assert.ok(start >= 0, name);
    let end = source.indexOf('\n', start);
    for (;;) {
      try { new vm.Script(source.slice(start, end)).runInContext(ctx); break; }
      catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        end = source.indexOf('\n', end + 1); if (end < 0) throw error;
      }
    }
  }
  vm.runInContext(`
    var Z={rows:['10'],fillCells:'.10',fillV128:true,voidHits:{h:{'7:2':4}}},
      coneGeom={dpr:1,cx:0,cy:0,r0:20,dr:10,N:1,fill:true},
      calls=0,rot=0,cut=null,alt=false,free=false,coneRDown=null,handler;
    function renderRows(){calls++;} function renderCone(){calls++;} function save(){calls++;}
    function coneFillCut(){return cut;} function coneFillRot(){return rot;}
    function coneCutSym(){return false;} function coneCutAlt(){return alt;}
    function coneFillPart(u){return ((u/cut.step+rot)%cut.P+cut.P)%cut.P;}
    function coneFreeOn(){return free;}
    function $(){return {getBoundingClientRect:()=>({left:0,top:0})};}
    var cv={addEventListener:(type,fn)=>handler=fn};
  `, ctx);
  const listener = source.match(/  cv\.addEventListener\("contextmenu", \(e\) => \{ e\.preventDefault\(\); const D = coneRDown;[\s\S]*?\}\);/);
  assert.ok(listener, 'outer ring context menu handler');
  vm.runInContext(listener[0], ctx);
  return code => vm.runInContext(code, ctx);
}

test('right-click changes one draft bit, retaining other bits and laser marks', () => {
  const run = fixture();
  assert.equal(run('fillToggleBit(1); Z.fillCells'), '.00');
  assert.equal(run('fillToggleBit(1); Z.fillCells'), '.10');
  assert.equal(run('Z.voidHits.h["7:2"]'), 4);
  assert.equal(run('Z.rows.length'), 1);
});

test('empty cells toggle as zero, and a full draft waits for its normal commit step', () => {
  const run = fixture();
  assert.equal(run('fillToggleBit(0); Z.fillCells'), '110');
  assert.equal(run('fillToggleBit(2); Z.fillCells'), '111');
  assert.equal(run('Z.rows.length'), 1);
});

test('cut gaps and invalid indexes leave the draft unchanged', () => {
  const run = fixture();
  for (const index of [-1, 3, 0.5, NaN]) assert.equal(run(`fillToggleBit(${index})`), false);
  assert.equal(run('Z.fillCells'), '.10');
  assert.equal(run('calls'), 0);
});

test('a rotated outer ring selects the bit actually under the pointer', () => {
  const run = fixture();
  assert.equal(run('rot=1; handler({clientX:0,clientY:-35,preventDefault(){}}); Z.fillCells'), '.00');
});

test('right-click in an alternating slit leaves all draft bits intact', () => {
  const run = fixture();
  assert.equal(run(`alt=true; cut={step:2*Math.PI/5,P:5};
    handler({clientX:35*Math.sin(1.5*cut.step),clientY:-35*Math.cos(1.5*cut.step),preventDefault(){}});
    Z.fillCells`), '.10');
  assert.equal(run('calls'), 0);
});

test('right-button dragging never edits or clears draft bits', () => {
  const run = fixture();
  assert.equal(run('coneRDown=[0,-35]; handler({clientX:12,clientY:-35,preventDefault(){}}); Z.fillCells'), '.10');
  assert.equal(run('calls'), 0);
});

test('free placement edits the chosen part without modifying the ordinary draft', () => {
  const run = fixture();
  assert.equal(run('cut={P:5}; Z.fillFree=".10.."; fillToggleBit(1,true); Z.fillFree'), '.00..');
  assert.equal(run('Z.fillCells'), '.10');
  assert.equal(run('fillToggleBit(4,true)'), false);
});
