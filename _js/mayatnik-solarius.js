/* v1: load the selected Mayatnik axis as an editable Solarius scene. */
(() => {
  'use strict';
  if (new URLSearchParams(location.search).get('mayatnik') !== 'axis') return;
  try {
    const data = JSON.parse(localStorage.getItem('zerk_mayatnik_solarius') || 'null');
    if (!data || !Array.isArray(data.rows) || !data.rows.length || data.rows.length > 256 ||
        data.rows.some((row,i) => typeof row !== 'string' || row.length !== i+1 || !/^[01]+$/.test(row))) {
      throw Error('Сначала выбери ось на Маятнике');
    }
    const rows = data.rows.slice();
    const axis = Number.isFinite(data.axis) ? (data.axis >= 0 ? '+' : '') + data.axis : 'конус';
    const title = `Маятник · ось ${axis} · кадр ${Number(data.k)||0}`;
    window.ZZ_MAYATNIK_SOURCE = {title, rows:rows.length, source:data};
    window.ZZ_PRESET_DATA = {name:'mayatnik-axis', title, state:{
      rows, lanes:[rows.slice()], lane:0, laneCount:1, cur:0,
      rowsSequenceRevision:window.ZZ_ROWS_SEQUENCE_REVISION,
      show01:true, coneSpin:0, coneOnlySel:false, coneSlits:'cut', cone3d:false,
      win:{'w-cone':{collapsed:false}}
    }};
  } catch (e) {
    document.addEventListener('DOMContentLoaded', () => {
      const note = document.createElement('p');note.textContent = e.message;
      note.style.cssText = 'color:#ff7373;font:12px monospace;margin:8px';
      document.querySelector('#top')?.after(note);
    });
  }
})();
