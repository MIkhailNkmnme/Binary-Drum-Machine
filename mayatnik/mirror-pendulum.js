/* v1: exact pendulum frames for Zerkalius; empty cells retain their coordinates. */
(() => {
  'use strict';
  const core = typeof module !== 'undefined' && module.exports ? require('./mayatnik-core.js') : MAYATNIK;
  class MirrorPendulum {
    constructor(depth = 512, limit = 512) {
      this.depth = Math.max(8, Math.min(1024, Math.round(Number(depth) || 512)));
      this.limit = Math.max(1, Math.min(4096, Math.round(Number(limit) || 512)));
      const geo = core.geometry('pend', this.limit, this.depth);
      this.anchor = geo.anchor;
      this.field = core.field(geo.W, this.depth, 'empty');
      this.frame = 0;
      this.revision = 0;
      this.checkpoints = new Map([[0, this.field.val.slice()]]);
      this.interval = Math.max(16, Math.ceil(this.limit * this.field.val.length / 24000000));
    }
    step() {
      if (this.frame >= this.limit) return false;
      core.cone(this.field, this.anchor + core.offset('pend', this.frame), this.depth);
      this.frame++; this.revision++;
      this._rows = null; this._balance = null;
      if (this.frame % this.interval === 0) this.checkpoints.set(this.frame, this.field.val.slice());
      return true;
    }
    seek(target, budget = 12) {
      target = Math.max(0, Math.min(this.limit, Math.round(Number(target) || 0)));
      if (target < this.frame) {
        let nearest = 0;
        for (const n of this.checkpoints.keys()) if (n <= target && n > nearest) nearest = n;
        this.field.val.set(this.checkpoints.get(nearest)); this.frame = nearest; this.revision++;
        this._rows = null; this._balance = null;
      }
      const start = performance.now();
      while (this.frame < target && performance.now() - start < budget) this.step();
      return this.frame === target;
    }
    rows() {
      if (this._rows) return this._rows;
      const {W, H, val} = this.field, R = [];
      for (let r = 0; r < H; r++) {
        let s = '';
        for (let c = 0; c < W; c++) { const v = val[r * W + c]; s += v < 0 ? '.' : String(v); }
        R.push(s);
      }
      return this._rows = R;
    }
    balance() {
      if (this._balance) return this._balance;
      let zero = 0, one = 0;
      for (const v of this.field.val) { if (v === 0) zero++; else if (v === 1) one++; }
      return this._balance = {zero, one, empty: this.field.val.length - zero - one};
    }
    color(r, c, mode = 0, colored = true) {
      const {W, val} = this.field, original = mode & 2 ? W - 1 - c : c, v = val[r * W + original];
      if (v < 0) return null;
      const bit = v ^ (mode & 1);
      if (this._spanFrame !== this.frame) { this._spanFrame = this.frame; this._span = core.span('pend', this.frame); }
      const [lo, hi] = this._span;
      const t = colored ? core.tint(r, original - this.anchor, bit, lo, hi, false) : 0;
      return t === 1 ? '#4f9bff' : t === 2 ? '#ff5a4f' : bit ? '#e8edf5' : '#5b6475';
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = MirrorPendulum;
  else window.ZZMirrorPendulum = MirrorPendulum;
})();
