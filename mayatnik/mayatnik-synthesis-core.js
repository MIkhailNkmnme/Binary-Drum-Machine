/* Mayatnik Synthesis: independent, synchronous CPU layers; no DOM or timers.
 * window.MayatnikSynthesisCore.create({width,height,rule='circuit',wrap=false,
 *   trailFrames=8,recoveryFrames=6}) -> engine. Dimensions are 1..512.
 * Weighted Generations rule='weighted': stateWeights is 7 integers 0..10;
 *   positionWeights is 8 integers 0..10, ordered NW,N,NE,W,E,SW,S,SE.
 *   WG Rule084 defaults: [0,1,2,1,0,0,1] and [2,1,2,1,1,2,1,2].
 *   Every neighbour contributes stateWeight*positionWeight (outside=state 0).
 *   Sum 5 births; sums 5/6 sustain state 1; states 2..6 age unconditionally.
 *   Rule semantics reference (algorithm below independently implemented):
 *   https://github.com/MiDevel/mcell-webapp/blob/main/src/engines/EngineWeightedGenerations.ts
 * reset(bits): clear every layer and establish the initial source (no changes).
 * configure(options): update rule/wrap/durations without resetting history;
 *   dimensions are fixed. States outside a new rule's range become zero.
 * observe(bits,{advance=false}): only advance=true consumes a source tick.
 *   Raw 0<->1 changes set changed=1, direction=new bit, trail=trailFrames.
 *   Neutral -1 is absence: entering/leaving it creates no change event.
 *   Recovered bits accept changes when ready, then hold for recoveryFrames
 *   complete future source ticks; ignored source changes are not queued.
 * step({bits,injectChanges=false}={}): optionally observe a source tick first,
 *   inject last raw changes into zero CA cells, then calculate one CA tick.
 *   Each observed change mask is injected at most once; changed stays readable.
 *   Injection precedes the synchronous update, so newborn input may age/die.
 * seed(bits): replace CA with state 1 where bit==1, reset CA generation only.
 * Getters: state (Uint8Array), trail (Uint32Array), direction (Int8Array),
 *   recovered (Int8Array), changed (Uint8Array), generation, width, height,
 *   options (deep copy). Option weight arrays are copied on input and output.
 *   Layer arrays are live read views; callers must not mutate them.
 * MayatnikSynthesisCore.rules exposes frozen rule metadata (states and bitmasks
 *   birth/survive bitmasks, whose bit N specifies the outcome for N live
 *   neighbours; weighted birth/survive are arrays of accepted weight sums).
 * snapshot(): JSON-safe complete state; restore(snapshot): validate everything
 *   before replacing state, including dimensions (which may differ).
 * Circuit Genesis B1234/S2345/C8; Fireworks B13/S2/C21: only state 1
 *   contributes to Moore counts, dying cells progress 2..C-1 then 0.
 * Replicator B1357/S1357 is XOR of the eight neighbours, excluding center.
 * All mutators return the engine. Independent implementation, no dependencies.
 */
(function (global) {
  'use strict';

  const RULES = Object.freeze({
    circuit: Object.freeze({ states: 8, birth: 30, survive: 60 }),
    fireworks: Object.freeze({ states: 21, birth: 10, survive: 4 }),
    replicator: Object.freeze({ states: 2, birth: 170, survive: 170 }),
    weighted: Object.freeze({ states: 7, birth: Object.freeze([5]), survive: Object.freeze([5, 6]) })
  });
  const MAX_FRAMES = 65535;
  const DEFAULT_STATE_WEIGHTS = Object.freeze([0, 1, 2, 1, 0, 0, 1]);
  const DEFAULT_POSITION_WEIGHTS = Object.freeze([2, 1, 2, 1, 1, 2, 1, 2]);

  function copyOptions(value) {
    return Object.assign({}, value, {
      stateWeights: Array.from(value.stateWeights || DEFAULT_STATE_WEIGHTS),
      positionWeights: Array.from(value.positionWeights || DEFAULT_POSITION_WEIGHTS)
    });
  }

  function integer(value, min, max, name) {
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new RangeError(name + ' must be an integer from ' + min + ' to ' + max);
    }
    return value;
  }

  function readOptions(input, base) {
    const result = copyOptions(base);
    if (input.rule !== undefined) {
      if (!Object.prototype.hasOwnProperty.call(RULES, input.rule)) {
        throw new RangeError('Unknown synthesis rule');
      }
      result.rule = input.rule;
    }
    if (input.wrap !== undefined) {
      if (typeof input.wrap !== 'boolean') throw new TypeError('wrap must be boolean');
      result.wrap = input.wrap;
    }
    for (const key of ['trailFrames', 'recoveryFrames']) {
      if (input[key] !== undefined) result[key] = integer(input[key], 0, MAX_FRAMES, key);
    }
    for (const [key, length] of [['stateWeights', 7], ['positionWeights', 8]]) {
      if (input[key] !== undefined) result[key] = Array.from(readArray(input[key], length, 0, 10, Uint8Array, key));
    }
    return result;
  }

  function readArray(source, size, min, max, Type, name) {
    if (!source || source.length !== size) throw new RangeError(name + ' length mismatch');
    const result = new Type(size);
    for (let i = 0; i < size; i++) {
      const value = source[i];
      if (!Number.isInteger(value) || value < min || value > max) {
        throw new RangeError(name + '[' + i + '] is outside ' + min + '..' + max);
      }
      result[i] = value;
    }
    return result;
  }

  function create(input) {
    input = input || {};
    let width = integer(input.width, 1, 512, 'width');
    let height = integer(input.height, 1, 512, 'height');
    let options = readOptions(input, {
      rule: 'circuit', wrap: false, trailFrames: 8, recoveryFrames: 6
    });
    let size = width * height;
    let state = new Uint8Array(size);
    let next = new Uint8Array(size);
    let trail = new Uint32Array(size);
    let direction = new Int8Array(size);
    let recovered = new Int8Array(size).fill(-1);
    let previous = new Int8Array(size).fill(-1);
    let cooldown = new Uint32Array(size);
    let changed = new Uint8Array(size);
    let pending = new Uint8Array(size);
    let generation = 0;

    function sourceBits(bits) {
      return readArray(bits, size, -1, 1, Int8Array, 'bits');
    }

    const engine = {
      get width() { return width; },
      get height() { return height; },
      get state() { return state; },
      get trail() { return trail; },
      get direction() { return direction; },
      get recovered() { return recovered; },
      get changed() { return changed; },
      get generation() { return generation; },
      get options() { return copyOptions(options); },

      reset(bits) {
        const initial = sourceBits(bits);
        previous.set(initial);
        recovered.set(initial);
        state.fill(0);
        next.fill(0);
        trail.fill(0);
        direction.fill(0);
        cooldown.fill(0);
        changed.fill(0);
        pending.fill(0);
        generation = 0;
        return engine;
      },

      configure(updates) {
        updates = updates || {};
        if ((updates.width !== undefined && updates.width !== width) ||
            (updates.height !== undefined && updates.height !== height)) {
          throw new RangeError('Create or restore an engine to change dimensions');
        }
        const configured = readOptions(updates, options);
        if (configured.rule !== options.rule) {
          const limit = RULES[configured.rule].states;
          for (let i = 0; i < size; i++) if (state[i] >= limit) state[i] = 0;
        }
        options = configured;
        return engine;
      },

      observe(bits, control) {
        if (!control || control.advance !== true) return engine;
        const incoming = sourceBits(bits);
        changed.fill(0);
        pending.fill(0);
        for (let i = 0; i < size; i++) {
          const bit = incoming[i];
          const before = previous[i];
          if (trail[i] > 0) trail[i]--;
          if (bit < 0) {
            trail[i] = 0;
            direction[i] = 0;
            recovered[i] = -1;
            cooldown[i] = 0;
          } else {
            if (before >= 0 && before !== bit) {
              changed[i] = 1;
              pending[i] = 1;
              direction[i] = bit;
              trail[i] = options.trailFrames;
            }
            if (before < 0 || recovered[i] < 0) {
              recovered[i] = bit;
              cooldown[i] = 0;
            } else if (cooldown[i] > 0) {
              cooldown[i]--;
            } else if (recovered[i] !== bit) {
              recovered[i] = bit;
              cooldown[i] = options.recoveryFrames;
            }
          }
          previous[i] = bit;
        }
        return engine;
      },

      seed(bits) {
        const incoming = sourceBits(bits);
        for (let i = 0; i < size; i++) state[i] = incoming[i] === 1 ? 1 : 0;
        next.fill(0);
        pending.fill(0);
        generation = 0;
        return engine;
      },

      step(control) {
        control = control || {};
        if (generation >= Number.MAX_SAFE_INTEGER) throw new RangeError('CA generation limit reached');
        if (control.bits !== undefined) engine.observe(control.bits, { advance: true });
        if (control.injectChanges === true) {
          for (let i = 0; i < size; i++) if (pending[i] && state[i] === 0) state[i] = 1;
          pending.fill(0);
        }
        const rule = RULES[options.rule];
        const weighted = options.rule === 'weighted';
        const stateWeights = options.stateWeights;
        const positionWeights = options.positionWeights;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const index = y * width + x;
            let neighbours = 0;
            let position = 0;
            for (let dy = -1; dy <= 1; dy++) {
              let ny = y + dy;
              if (options.wrap) ny = (ny + height) % height;
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                let nx = x + dx;
                if (options.wrap) nx = (nx + width) % width;
                const neighbour = nx < 0 || nx >= width || ny < 0 || ny >= height ? 0 : state[ny * width + nx];
                if (weighted) neighbours += stateWeights[neighbour] * positionWeights[position];
                else if (neighbour === 1) neighbours++;
                position++;
              }
            }
            const current = state[index];
            if (current === 0) next[index] = weighted ? (neighbours === 5 ? 1 : 0) : (rule.birth >> neighbours) & 1;
            else if (current === 1) {
              const survives = weighted ? neighbours === 5 || neighbours === 6 : (rule.survive >> neighbours) & 1;
              next[index] = survives ? 1 : (rule.states > 2 ? 2 : 0);
            } else next[index] = current + 1 < rule.states ? current + 1 : 0;
          }
        }
        const old = state;
        state = next;
        next = old;
        generation++;
        return engine;
      },

      snapshot() {
        return {
          version: 1, width, height, options: copyOptions(options), generation,
          state: Array.from(state), trail: Array.from(trail), direction: Array.from(direction),
          recovered: Array.from(recovered), previous: Array.from(previous),
          cooldown: Array.from(cooldown), changed: Array.from(changed), pending: Array.from(pending)
        };
      },

      restore(saved) {
        if (!saved || saved.version !== 1 || !saved.options ||
            typeof saved.options !== 'object' || Array.isArray(saved.options)) {
          throw new TypeError('Invalid synthesis snapshot');
        }
        for (const key of ['rule', 'wrap', 'trailFrames', 'recoveryFrames']) {
          if (!Object.prototype.hasOwnProperty.call(saved.options, key) || saved.options[key] === undefined) {
            throw new TypeError('Missing snapshot option: ' + key);
          }
        }
        const restoredWidth = integer(saved.width, 1, 512, 'width');
        const restoredHeight = integer(saved.height, 1, 512, 'height');
        const restoredSize = restoredWidth * restoredHeight;
        const restoredOptions = readOptions(saved.options, {
          rule: 'circuit', wrap: false, trailFrames: 8, recoveryFrames: 6
        });
        const restoredGeneration = integer(saved.generation, 0, Number.MAX_SAFE_INTEGER, 'generation');
        const restoredState = readArray(saved.state, restoredSize, 0, RULES[restoredOptions.rule].states - 1, Uint8Array, 'state');
        const restoredTrail = readArray(saved.trail, restoredSize, 0, MAX_FRAMES, Uint32Array, 'trail');
        const restoredDirection = readArray(saved.direction, restoredSize, 0, 1, Int8Array, 'direction');
        const restoredRecovered = readArray(saved.recovered, restoredSize, -1, 1, Int8Array, 'recovered');
        const restoredPrevious = readArray(saved.previous, restoredSize, -1, 1, Int8Array, 'previous');
        const restoredCooldown = readArray(saved.cooldown, restoredSize, 0, MAX_FRAMES, Uint32Array, 'cooldown');
        const restoredChanged = readArray(saved.changed, restoredSize, 0, 1, Uint8Array, 'changed');
        const restoredPending = readArray(saved.pending, restoredSize, 0, 1, Uint8Array, 'pending');
        const restoredNext = new Uint8Array(restoredSize);
        width = restoredWidth;
        height = restoredHeight;
        size = restoredSize;
        options = restoredOptions;
        generation = restoredGeneration;
        state = restoredState;
        next = restoredNext;
        trail = restoredTrail;
        direction = restoredDirection;
        recovered = restoredRecovered;
        previous = restoredPrevious;
        cooldown = restoredCooldown;
        changed = restoredChanged;
        pending = restoredPending;
        return engine;
      }
    };
    return engine;
  }

  global.MayatnikSynthesisCore = Object.freeze({ create, rules: RULES });
})(window);
