// tag: the bot's learned model. a small neural net that scores positions from the
// point of view of one side (-1 = losing for sure, +1 = winning for sure). it is
// trained on the outcome of every game it sees, including the human's moves, and
// it is blended into the bot's hand-written scoring more as it gains experience.
(function (root) {
'use strict';
const T = root.Tag;
const H1 = 24, H2 = 12, SCALE = 900, GAMMA = 0.97, KEY = 'tag-brain-v3';

const arr = n => new Float64Array(n);
function initNet() {
  const n = T.NFEAT, r = (fan) => (Math.random() * 2 - 1) * Math.sqrt(1 / fan);
  const fill = (a, fan) => { for (let i = 0; i < a.length; i++) a[i] = r(fan); return a; };
  return { W1: fill(arr(H1 * n), n), b1: arr(H1), W2: fill(arr(H2 * H1), H1), b2: arr(H2), W3: fill(arr(H2), H2), b3: arr(1) };
}

function forward(net, x) {
  const n = T.NFEAT, h1 = arr(H1), h2 = arr(H2);
  for (let i = 0; i < H1; i++) { let s = net.b1[i]; for (let k = 0; k < n; k++) s += net.W1[i * n + k] * x[k]; h1[i] = Math.tanh(s); }
  for (let j = 0; j < H2; j++) { let s = net.b2[j]; for (let i = 0; i < H1; i++) s += net.W2[j * H1 + i] * h1[i]; h2[j] = Math.tanh(s); }
  let o = net.b3[0]; for (let j = 0; j < H2; j++) o += net.W3[j] * h2[j];
  return { h1, h2, out: Math.tanh(o) };
}

// one gradient step on a minibatch of { x, y, w }; returns the mean squared error
function trainBatch(net, batch, lr) {
  const n = T.NFEAT;
  const g = { W1: arr(H1 * n), b1: arr(H1), W2: arr(H2 * H1), b2: arr(H2), W3: arr(H2), b3: arr(1) };
  let loss = 0;
  for (const smp of batch) {
    const f = forward(net, smp.x), e = f.out - smp.y;
    loss += e * e * smp.w;
    const d3 = e * smp.w * (1 - f.out * f.out);
    g.b3[0] += d3;
    const dh2 = arr(H2), dh1 = arr(H1);
    for (let j = 0; j < H2; j++) { g.W3[j] += d3 * f.h2[j]; dh2[j] = d3 * net.W3[j] * (1 - f.h2[j] * f.h2[j]); }
    for (let j = 0; j < H2; j++) {
      g.b2[j] += dh2[j];
      for (let i = 0; i < H1; i++) { g.W2[j * H1 + i] += dh2[j] * f.h1[i]; dh1[i] += dh2[j] * net.W2[j * H1 + i]; }
    }
    for (let i = 0; i < H1; i++) {
      const d = dh1[i] * (1 - f.h1[i] * f.h1[i]);
      g.b1[i] += d;
      for (let k = 0; k < n; k++) g.W1[i * n + k] += d * smp.x[k];
    }
  }
  const s = lr / batch.length;
  for (const k of Object.keys(g)) for (let i = 0; i < g[k].length; i++) net[k][i] -= s * g[k][i];
  return loss / batch.length;
}

const brain = {
  net: initNet(), games: 0, loss: 0, buf: [],

  // how much the bot trusts the model; grows with the number of games it has learned from
  weight() { return Math.min(0.6, this.games / 60); },
  score(s, who, dC, dR) {
    const w = this.weight();
    return w > 0 ? w * SCALE * forward(this.net, T.features(s, who, dC, dR)).out : 0;
  },

  // snapshot of a position after a turn, from both sides' point of view
  snap(s, mover) {
    const dC = T.bfs(s, s.p.C), dR = T.bfs(s, s.p.R);
    return { mover, R: T.features(s, 'R', dC, dR), C: T.features(s, 'C', dC, dR) };
  },

  // turn a finished game into training samples and learn from them.
  // humanRole: the side a person played, whose moves are weighted up (learn from the user).
  finish(rec, over, humanRole) {
    if (!rec.length || !over) return null;
    const N = rec.length, out = [];
    rec.forEach((r, i) => {
      const m = r.mover, o = m === 'R' ? 'C' : 'R';
      const z = over.w === null ? 0 : over.w === m ? 1 : -1;
      let w = over.w === null ? 0.5 : 1;
      if (z < 0 && i >= N - 8) w *= 2;                 // the moves that lost it
      if (humanRole && m === humanRole) w *= 1.5;      // a person's choices are worth copying
      const y = z * Math.pow(GAMMA, N - 1 - i);
      out.push({ x: r[m], y, w }, { x: r[o], y: -y, w });
    });
    return this.learn(out);
  },

  learn(samples) {
    this.buf.push(...samples);
    if (this.buf.length > 4000) this.buf.splice(0, this.buf.length - 4000);
    let loss = 0, steps = 0;
    for (let e = 0; e < 8; e++) {
      const pool = samples.slice();
      for (let i = 0; i < 160 && this.buf.length; i++) pool.push(this.buf[Math.floor(Math.random() * this.buf.length)]);
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      for (let b = 0; b < pool.length; b += 16) { loss += trainBatch(this.net, pool.slice(b, b + 16), 0.015); steps++; }
    }
    this.games++;
    this.loss = loss / Math.max(1, steps);
    this.save();
    return { games: this.games, loss: this.loss, samples: samples.length };
  },

  save() {
    try {
      const r = a => Array.from(a, v => Math.round(v * 1e4) / 1e4);
      const net = {}; Object.keys(this.net).forEach(k => { net[k] = r(this.net[k]); });
      const buf = this.buf.slice(-300).map(b => ({ x: b.x.map(v => Math.round(v * 1e3) / 1e3), y: Math.round(b.y * 1e3) / 1e3, w: b.w }));
      localStorage.setItem(KEY, JSON.stringify({ net, games: this.games, loss: this.loss, buf }));
    } catch (e) { /* storage full or unavailable: the model just won't persist */ }
  },
  load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!d || !d.net || d.net.W1.length !== H1 * T.NFEAT) return false;
      Object.keys(this.net).forEach(k => { this.net[k] = Float64Array.from(d.net[k]); });
      this.games = d.games || 0; this.loss = d.loss || 0; this.buf = d.buf || [];
      return true;
    } catch (e) { return false; }
  },
  reset() {
    this.net = initNet(); this.games = 0; this.loss = 0; this.buf = [];
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  },
};

brain.load();
T.setBrain(brain);
root.Brain = brain;
})(typeof window !== 'undefined' ? window : globalThis);
