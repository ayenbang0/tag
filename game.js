// tag: rules engine + bot. no DOM, runs in browser or node.
(function (root) {
'use strict';

const COLS = 25, ROWS = 25, CAP = 600, COOL = 4, MAXLV = 3;   // a rune can be upgraded 3 times
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]; // e ne nw w sw se
const TYPES = ['Dash', 'Push', 'Teleport', 'Wall'];
const SETUP_RUNES = 3, SETUP_GAP = 5;   // runes each player lays down before turn 1, and the no-go radius around the foe
const reach = t => (t === 'Dash' || t === 'Push' ? 3 : 2);   // how far from yourself a rune may be placed

// starting strength and the strength each upgrade adds (dash and push jump by 2)
const baseStr = t => (t === 'Push' ? 2 : 1);
const stepStr = t => (t === 'Dash' || t === 'Push' ? 2 : 1);

const key = (q, r) => q + ',' + r;
const dist = (a, b) => {
  const dq = a.q - b.q, dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
};
const other = w => (w === 'C' ? 'R' : 'C');
const name = w => (w === 'C' ? 'chaser' : 'runner');

const cells = [], cellMap = {};
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const h = { q: c - ((r - (r & 1)) >> 1), r };
    cells.push(h);
    cellMap[key(h.q, h.r)] = h;
  }
}
const offset = (c, r) => cells[r * COLS + c];
const HC = Math.floor(COLS / 2), HR = Math.floor(ROWS / 2);
const CENTER = offset(HC, HR);
const isCenter = (q, r) => q === CENTER.q && r === CENTER.r;
const beaconIdx = (s, q, r) => s.beacons.findIndex(h => h.q === q && h.r === r);
const rockAt = (s, q, r) => !!s.rocks[key(q, r)];
const nbrs = h => DIRS.map(d => cellMap[key(h.q + d[0], h.r + d[1])]).filter(Boolean);

// one beacon per quadrant, random, away from the starts, the center and each other
function pickBeacons(starts) {
  const boxes = [[2, HC - 2, 2, HR - 2], [HC + 2, COLS - 3, 2, HR - 2], [2, HC - 2, HR + 2, ROWS - 3], [HC + 2, COLS - 3, HR + 2, ROWS - 3]];
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  for (let t = 0; t < 500; t++) {
    const pick = boxes.map(b => offset(rnd(b[0], b[1]), rnd(b[2], b[3])));
    const ok = pick.every((h, i) => starts.every(s => dist(h, s) >= 7) && dist(h, CENTER) >= 4 && pick.every((o, j) => i === j || dist(h, o) >= 9));
    if (ok) return pick;
  }
  return boxes.map(b => offset((b[0] + b[1]) >> 1, (b[2] + b[3]) >> 1));
}

// scattered boulders in small clusters. both starts and every beacon stay connected.
function genRocks(beacons, starts) {
  const near = (h, list, d) => list.some(o => dist(h, o) <= d);
  for (let attempt = 0; attempt < 80; attempt++) {
    const rocks = {}, want = 45 + Math.floor(Math.random() * 25);
    let n = 0, guard = 0;
    while (n < want && guard++ < 2000) {
      let cur = cells[Math.floor(Math.random() * cells.length)];
      const size = 1 + Math.floor(Math.random() * 4);
      for (let i = 0; i < size && cur; i++) {
        if (!rocks[key(cur.q, cur.r)] && !near(cur, starts, 3) && !near(cur, beacons, 1) && dist(cur, CENTER) >= 2) { rocks[key(cur.q, cur.r)] = 1; n++; }
        const nb = nbrs(cur);
        cur = nb[Math.floor(Math.random() * nb.length)];
      }
    }
    const seen = { [key(starts[0].q, starts[0].r)]: 1 }, qu = [starts[0]];
    for (let i = 0; i < qu.length; i++) for (const h of nbrs(qu[i])) {
      const k = key(h.q, h.r);
      if (!seen[k] && !rocks[k]) { seen[k] = 1; qu.push(h); }
    }
    if (seen[key(starts[1].q, starts[1].r)] && beacons.every(b => seen[key(b.q, b.r)])) return rocks;
  }
  return {};
}

// ---------- state ----------

function newState() {
  const rs = offset(0, HR), cs = offset(COLS - 1, HR), beacons = pickBeacons([rs, cs]);
  const s = {
    turn: 'R', n: 0, steps: 0, moving: false, over: null, passes: 0, nid: 1,
    sim: false, hist: {}, log: [], beacons, rocks: genRocks(beacons, [rs, cs]),
    setup: { R: SETUP_RUNES, C: SETUP_RUNES },
    p: {
      R: { q: rs.q, r: rs.r, v: [0, 0, 0, 0] },
      C: { q: cs.q, r: cs.r, v: null },
    },
    runes: [],
  };
  scatter(s);
  startTurn(s);
  return s;
}

// 4-6 dashes and 3-6 pushes lying around the board before anyone places anything
function scatter(s) {
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const free = cells.filter(h => beaconIdx(s, h.q, h.r) < 0 && !isCenter(h.q, h.r) && !rockAt(s, h.q, h.r) && !playerAt(s, h.q, h.r));
  for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [free[i], free[j]] = [free[j], free[i]]; }
  const put = (type, n) => {
    for (let i = 0; i < n; i++) {
      const h = free.pop();
      addRune(s, { type, q: h.q, r: h.r, owner: null, dir: type === 'Push' ? rnd(0, 5) : 0 });
    }
  };
  put('Dash', rnd(4, 6));
  put('Push', rnd(3, 6));
}

function clone(s) {
  const cp = p => Object.assign({}, p, { v: p.v && p.v.slice() });
  return {
    turn: s.turn, n: s.n, steps: s.steps, moving: s.moving, over: s.over,
    passes: s.passes, nid: s.nid, sim: true, hist: null, log: null, beacons: s.beacons,
    setup: s.setup && Object.assign({}, s.setup),
    rocks: Object.assign({}, s.rocks),
    p: { C: cp(s.p.C), R: cp(s.p.R) },
    runes: s.runes.map(r => Object.assign({}, r)),
  };
}

const say = (s, m) => { if (s.log) s.log.push(m); };

const runeAt = (s, q, r) => s.runes.find(x => x.q === q && x.r === r);
const playerAt = (s, q, r) =>
  (s.p.C.q === q && s.p.C.r === r) ? 'C' : (s.p.R.q === q && s.p.R.r === r) ? 'R' : null;

function startTurn(s) {
  s.steps = 0; s.moving = false;
}

function hash(s) {
  return JSON.stringify([s.turn, s.p, Object.keys(s.rocks).length, s.runes.map(r => [r.type, r.q, r.r, r.str, r.cd, r.dir, r.owner])]);
}

function endTurn(s) {
  s.runes.forEach(r => { if (r.cd > 0) r.cd--; });
  s.turn = other(s.turn); s.n++;
  s.moving = false; s.steps = 0;
  if (s.n >= CAP) { s.over = { w: null, why: 'turn cap (' + CAP + ' turns)' }; return; }
  startTurn(s);
  if (!s.sim) {
    const h = hash(s);
    s.hist[h] = (s.hist[h] || 0) + 1;
    if (s.hist[h] >= 3) s.over = { w: null, why: 'position repeated 3 times' };
  }
}

// capture + beacon bookkeeping
function check(s) {
  const c = s.p.C, r = s.p.R;
  if (c.q === r.q && c.r === r.r) { s.over = { w: 'C', why: 'runner caught' }; return true; }
  const i = beaconIdx(s, r.q, r.r);
  if (i >= 0 && !r.v[i]) { r.v[i] = 1; say(s, 'runner reaches a beacon (' + r.v.filter(Boolean).length + '/4)'); }
  if (r.v.every(Boolean)) { s.over = { w: 'R', why: 'runner lit all four beacons' }; return true; }
  return false;
}

function canEnter(s, w, q, r) {
  if (!cellMap[key(q, r)] || rockAt(s, q, r)) return false;
  const ru = runeAt(s, q, r);
  if (ru && ru.type === 'Wall') return false;
  const o = s.p[other(w)];
  if (o.q === q && o.r === r) return w === 'C';
  return true;
}

// walls may never cut the runner off from a beacon it still needs
function beaconsOpen(s, extra) {
  const blocked = Object.assign({}, s.rocks);
  s.runes.forEach(r => { if (r.type === 'Wall') blocked[key(r.q, r.r)] = 1; });
  extra.forEach(h => { blocked[key(h[0], h[1])] = 1; });
  const R = s.p.R, seen = { [key(R.q, R.r)]: 1 }, qu = [R];
  for (let i = 0; i < qu.length; i++) {
    for (const [dq, dr] of DIRS) {
      const q = qu[i].q + dq, r = qu[i].r + dr, k = key(q, r);
      if (seen[k] || blocked[k] || !cellMap[k]) continue;
      seen[k] = 1; qu.push({ q, r });
    }
  }
  return s.beacons.every((b, i) => R.v[i] || seen[key(b.q, b.r)]);
}

// ---------- rune effects ----------

function trigger(s, w) {
  const p = s.p[w], o = s.p[other(w)];
  const ru = runeAt(s, p.q, p.r);
  if (!ru || ru.cd > 0) return;
  switch (ru.type) {
    case 'Dash':
      s.steps += 2 + ru.str; ru.cd = COOL;
      say(s, name(w) + ' dashes, +' + (2 + ru.str) + ' steps');
      break;
    case 'Push': {
      const [dq, dr] = DIRS[ru.dir];
      let n = 0;
      ru.cd = COOL;      // set first so a loop of pushes cannot fire this one again
      say(s, name(w) + ' is pushed ' + ru.str);
      // the pushed player takes the effect of every rune they are shoved onto
      while (n < ru.str) {
        const q = p.q + dq, r = p.r + dr, wl = runeAt(s, q, r);
        if (!cellMap[key(q, r)] || rockAt(s, q, r) || (wl && wl.type === 'Wall') || (o.q === q && o.r === r)) break;
        p.q = q; p.r = r; n++;
        if (check(s)) break;
        trigger(s, w);
        if (check(s) || p.q !== q || p.r !== r) break;     // a teleport or another push carried them off
      }
      break;
    }
    case 'Teleport': {
      const t = s.runes.filter(x => x !== ru && x.type === 'Teleport' && !playerAt(s, x.q, x.r));
      if (!t.length) break;
      const d = t[Math.floor(Math.random() * t.length)];
      p.q = d.q; p.r = d.r; ru.cd = COOL; d.cd = COOL; s.steps += ru.str;
      say(s, name(w) + ' teleports, +' + ru.str + ' step');
      break;
    }
  }
}

// ---------- actions ----------

function beginMove(s) {
  if (s.over || s.moving || s.setup) return false;
  s.moving = true; s.steps = 2; s.passes = 0;
  return true;
}

function step(s, d) {
  if (s.over || !s.moving || s.steps <= 0) return false;
  const w = s.turn, p = s.p[w], q = p.q + DIRS[d][0], r = p.r + DIRS[d][1];
  if (!canEnter(s, w, q, r)) return false;
  p.q = q; p.r = r; s.steps--;
  if (!check(s)) { trigger(s, w); check(s); }
  if (!s.over && s.steps <= 0) endTurn(s);
  return true;
}

function stopMove(s) { if (s.moving && !s.over) endTurn(s); }

// dash and push go within 3 of the caster, the rest within 2. during setup a rune can go
// anywhere that is more than SETUP_GAP hexes from the other player.
function placeOk(s, type, q, r) {
  const w = s.turn;
  if (!cellMap[key(q, r)]) return false;
  if (s.setup) { if (dist(s.p[other(w)], { q, r }) <= SETUP_GAP) return false; }
  else if (dist(s.p[w], { q, r }) > reach(type)) return false;
  return !(beaconIdx(s, q, r) >= 0 || isCenter(q, r) || rockAt(s, q, r) || runeAt(s, q, r) || playerAt(s, q, r));
}

const dirOk = d => Number.isInteger(d) && d >= 0 && d < 6;

function addRune(s, rn) {
  rn.id = s.nid++; rn.cd = 0; rn.lv = 0; rn.str = baseStr(rn.type);
  s.runes.push(rn);
  return true;
}

// a placement ends the turn, or in setup hands the next placement to whoever still has runes left
function finishPlace(s) {
  s.passes = 0;
  if (!s.setup) { endTurn(s); return; }
  const w = s.turn, o = other(w);
  s.setup[w]--;
  if (s.setup[o] > 0) s.turn = o;
  else if (s.setup[w] <= 0) {
    s.setup = null; s.turn = 'R'; s.n = 0; startTurn(s);
    if (!s.sim) s.hist[hash(s)] = 1;
  }
}

// one wall action puts down 1-3 walls
function wallsOk(s, hexes) {
  if (!hexes || hexes.length < 1 || hexes.length > (s.setup ? 1 : 3)) return false;
  const seen = {};
  for (const h of hexes) {
    const k = key(h[0], h[1]);
    if (seen[k] || !placeOk(s, 'Wall', h[0], h[1])) return false;
    seen[k] = 1;
  }
  return beaconsOpen(s, hexes);
}

function placeWalls(s, hexes) {
  if (s.over || s.moving || !wallsOk(s, hexes)) return false;
  const w = s.turn;
  say(s, name(w) + ' places ' + hexes.length + ' wall' + (hexes.length > 1 ? 's' : ''));
  hexes.forEach(h => addRune(s, { type: 'Wall', q: h[0], r: h[1], owner: w, dir: 0 }));
  finishPlace(s);
  return true;
}

// one push action puts down 1-2 pushes, each with its own direction: [{ q, r, dir }]
function pushesOk(s, list) {
  if (!Array.isArray(list) || list.length < 1 || list.length > (s.setup ? 1 : 2)) return false;
  const seen = {};
  for (const h of list) {
    if (!h || !dirOk(h.dir)) return false;
    const k = key(h.q, h.r);
    if (seen[k] || !placeOk(s, 'Push', h.q, h.r)) return false;
    seen[k] = 1;
  }
  return true;
}

function placePushes(s, list) {
  if (s.over || s.moving || !pushesOk(s, list)) return false;
  const w = s.turn;
  say(s, name(w) + ' places ' + list.length + ' push' + (list.length > 1 ? 'es' : ''));
  list.forEach(h => addRune(s, { type: 'Push', q: h.q, r: h.r, owner: w, dir: h.dir }));
  finishPlace(s);
  return true;
}

// opt: { dir } for a single push
function place(s, type, q, r, opt) {
  opt = opt || {};
  if (type === 'Wall') return placeWalls(s, [[q, r]]);
  if (type === 'Push') return placePushes(s, [{ q, r, dir: opt.dir }]);
  if (s.over || s.moving || !placeOk(s, type, q, r)) return false;
  const w = s.turn;
  say(s, name(w) + ' places ' + type);
  addRune(s, { type, q, r, owner: w, dir: 0 });
  finishPlace(s);
  return true;
}

// an upgrade adds 1 strength (dash and push: 2). three upgrades at most.
function bump(s, id) {
  if (s.over || s.moving || s.setup) return false;
  const rn = s.runes.find(x => x.id === id);
  if (!rn || dist(s.p[s.turn], rn) > 2 || rn.lv >= MAXLV) return false;
  rn.lv++; rn.str += stepStr(rn.type);
  say(s, name(s.turn) + ' upgrades ' + rn.type + ' to ' + rn.lv + '/' + MAXLV);
  s.passes = 0; endTurn(s);
  return true;
}

// remove any rune within 1 of you (a wall loses 1 durability instead)
function removeRune(s, id) {
  if (s.over || s.moving || s.setup) return false;
  const rn = s.runes.find(x => x.id === id);
  if (!rn || dist(s.p[s.turn], rn) > 1) return false;
  if (rn.type === 'Wall' && rn.str > 1) rn.str--;
  else s.runes.splice(s.runes.indexOf(rn), 1);
  say(s, name(s.turn) + ' removes ' + rn.type);
  s.passes = 0; endTurn(s);
  return true;
}

function pass(s) {
  if (s.over) return;
  say(s, name(s.turn) + ' has no legal action');
  if (++s.passes >= 2) { s.over = { w: null, why: 'neither player can act' }; return; }
  endTurn(s);
}

function placeTargets(s, type) {
  return cells.filter(h => placeOk(s, type || 'Dash', h.q, h.r));
}

function avail(s) {
  const w = s.turn, p = s.p[w];
  const near = (n, f) => s.runes.some(r => dist(p, r) <= n && (!f || f(r)));
  return {
    move: !s.setup && DIRS.some(d => canEnter(s, w, p.q + d[0], p.r + d[1])),
    place: placeTargets(s, 'Dash').length > 0 || placeTargets(s, 'Wall').length > 0,
    str: near(2, r => r.lv < MAXLV),
    remove: near(1),
  };
}

// ---------- bot ----------

function bfs(s, from) {
  const d = { [key(from.q, from.r)]: 0 }, qu = [from];
  for (let i = 0; i < qu.length; i++) {
    const c = qu[i], cd = d[key(c.q, c.r)];
    for (const [dq, dr] of DIRS) {
      const nq = c.q + dq, nr = c.r + dr, k = key(nq, nr);
      if (d[k] !== undefined || !cellMap[k] || s.rocks[k]) continue;
      const ru = runeAt(s, nq, nr);
      if (ru && ru.type === 'Wall') continue;
      d[k] = cd + 1; qu.push({ q: nq, r: nr });
    }
  }
  return d;
}

function nearestBeacon(s, dR) {
  let best = 99, bc = null;
  s.beacons.forEach((c, i) => {
    const d = dR[key(c.q, c.r)];
    if (!s.p.R.v[i] && d !== undefined && d < best) { best = d; bc = c; }
  });
  return { d: best, c: bc };
}

// numbers describing a position from `who`'s point of view; this is what the learned model sees
const NFEAT = 23 + TYPES.length;
function features(s, who, dC, dR) {
  const R = s.p.R, C = s.p.C;
  dC = dC || bfs(s, C); dR = dR || bfs(s, R);
  const d0 = (m, h) => (m[key(h.q, h.r)] === undefined ? 60 : m[key(h.q, h.r)]);
  const gap = d0(dC, R);
  const unlit = s.beacons.map((b, i) => ({ b, i })).filter(o => !R.v[o.i])
    .map(o => ({ r: d0(dR, o.b), c: d0(dC, o.b) })).sort((a, b) => a.r - b.r);
  const f = [who === 'R' ? 1 : -1, s.turn === who ? 1 : -1, R.v.filter(Boolean).length / 4, gap / 40, dist(C, R) / 40];
  for (let i = 0; i < 4; i++) f.push(unlit[i] ? unlit[i].r / 40 : 0);
  for (let i = 0; i < 4; i++) f.push(unlit[i] ? unlit[i].c / 40 : 0);
  f.push(dist(C, CENTER) / 20, dist(R, CENTER) / 20);
  const cnt = {}; let lvs = 0;
  s.runes.forEach(r => { cnt[r.type] = (cnt[r.type] || 0) + 1; lvs += r.lv; });
  TYPES.forEach(t => f.push(Math.min(4, cnt[t] || 0) / 4));
  f.push(s.runes.length ? lvs / s.runes.length / 3 : 0);
  f.push(gap <= 2 ? 1 : 0, gap <= 4 ? 1 : 0, Math.min(1, s.n / 200));
  return f;
}

let BRAIN = null;      // optional learned model: { score(s, who, dC, dR) -> number }
function setBrain(b) { BRAIN = b; }

function evalState(s, who) {
  if (s.over) return s.over.w === who ? 1e6 : s.over.w ? -1e6 : 0;
  const R = s.p.R, C = s.p.C;
  const dC = bfs(s, C), dR = bfs(s, R);
  const gap = dC[key(R.q, R.r)] === undefined ? 99 : dC[key(R.q, R.r)];
  const seen = R.v.filter(Boolean).length;
  let sc = 0;
  if (who === 'R') {
    sc += seen * 400 - nearestBeacon(s, dR).d * 12 + Math.min(gap, 6) * 10;
    if (gap <= 2) sc -= 5000; else if (gap <= 3) sc -= 60;
  } else {
    sc -= gap * 20 + seen * 300;
    const tb = nearestBeacon(s, dR);                       // wait where the runner has to go
    if (tb.c && dC[key(tb.c.q, tb.c.r)] !== undefined) sc -= Math.min(dC[key(tb.c.q, tb.c.r)], 40) * 9;
    s.beacons.forEach((c, i) => { if (!R.v[i]) sc += Math.min(dR[key(c.q, c.r)] === undefined ? 15 : dR[key(c.q, c.r)], 15) * 2; });
  }
  if (BRAIN) sc += BRAIN.score(s, who, dC, dR);
  return sc;
}

// opt.noise: how much random jitter to add to each candidate's score (self-play uses a lot)
function botPlan(s0, opt) {
  const noise = (opt && opt.noise) || 8;
  const who = s0.turn, foe = other(who), base = clone(s0);
  const R = base.p.R, C = base.p.C;
  const dC = bfs(base, C), dR = bfs(base, R);
  const gap = dC[key(R.q, R.r)];
  const tgt = nearestBeacon(base, dR);
  const dT = tgt.c ? bfs(base, tgt.c) : {};
  const onRun = k => tgt.c && dR[k] !== undefined && dT[k] !== undefined && dR[k] + dT[k] === tgt.d;
  const onChase = k => gap !== undefined && dC[k] !== undefined && dR[k] !== undefined && dC[k] + dR[k] === gap;
  const mine = who === 'R' ? onRun : onChase, theirs = who === 'R' ? onChase : onRun;
  const pairs = base.runes.filter(r => r.type === 'Teleport').length;
  const goal = who === 'R' ? tgt.c : R;

  const cands = [];
  const add = (ops, st, bonus) => cands.push({ ops, score: evalState(st, who) + (bonus || 0) + Math.random() * noise });

  let budget = 500;
  (function dfs(st, ops) {
    if (budget-- <= 0) return;
    if (st.moving) { const c = clone(st); stopMove(c); add(ops.concat({ k: 'stop' }), c); }
    for (let d = 0; d < 6; d++) {
      const c = clone(st);
      if (!c.moving && !beginMove(c)) return;
      if (!step(c, d)) continue;
      const o = ops.concat({ k: 'step', d });
      if (c.over || c.turn !== who) add(o, c); else dfs(c, o);
    }
  })(base, []);

  const own = base.runes.filter(r => r.owner === who).length;
  if (base.setup || own < 5) {
    // in setup the whole board is open, so only look at a random sample of hexes
    const sample = list => {
      if (!base.setup) return list;
      const a = list.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a.slice(0, 70);
    };
    for (const h of sample(placeTargets(base, 'Push'))) {
      const k = key(h.q, h.r);
      for (const t of ['Dash', 'Teleport']) {
        if (!placeOk(base, t, h.q, h.r)) continue;
        const b = mine(k) && (t === 'Dash' || (t === 'Teleport' && pairs > 0)) ? 28 : 0;
        const c = clone(base);
        place(c, t, h.q, h.r);
        add([{ k: 'place', t, q: h.q, r: h.r, opt: {} }], c, b);
      }
      if (goal) {
        let bd = 0, bs = 1e9;
        DIRS.forEach((v, d) => { const s2 = dist({ q: h.q + v[0], r: h.r + v[1] }, goal); if (s2 < bs) { bs = s2; bd = d; } });
        const list = [{ q: h.q, r: h.r, dir: bd }], c = clone(base);
        placePushes(c, list);
        add([{ k: 'pushes', list }], c, mine(k) ? 22 : 0);
      }
    }
    const wv = sample(placeTargets(base, 'Wall')).filter(h => wallsOk(base, [[h.q, h.r]]));
    wv.forEach(h => {
      const c = clone(base);
      placeWalls(c, [[h.q, h.r]]);
      add([{ k: 'walls', hexes: [[h.q, h.r]] }], c, theirs(key(h.q, h.r)) ? 26 : 0);
    });
    const wt = base.setup ? [] : wv.filter(h => theirs(key(h.q, h.r))).slice(0, 3).map(h => [h.q, h.r]);
    if (wt.length > 1 && wallsOk(base, wt)) {
      const c = clone(base);
      placeWalls(c, wt);
      add([{ k: 'walls', hexes: wt }], c, 26 + 6 * wt.length);
    }
  }
  for (const rn of base.runes) {
    if (dist(base.p[who], rn) > 2 || rn.lv >= MAXLV) continue;
    let b = 0;
    if (rn.owner === who && ((mine(key(rn.q, rn.r)) && rn.type === 'Dash') || (theirs(key(rn.q, rn.r)) && rn.type === 'Wall'))) b = 6;
    const c = clone(base);
    bump(c, rn.id);
    add([{ k: 'bump', id: rn.id }], c, b);
  }
  for (const rn of base.runes) {
    if (dist(base.p[who], rn) > 1) continue;
    const c = clone(base);
    removeRune(c, rn.id);
    add([{ k: 'remove', id: rn.id }], c, rn.owner === foe && mine(key(rn.q, rn.r)) && rn.type !== 'Dash' ? 15 : 0);
  }
  if (!cands.length) return [{ k: 'pass' }];
  cands.sort((a, b) => b.score - a.score);
  return cands[0].ops;
}

function applyOp(s, op) {
  switch (op.k) {
    case 'step': if (!dirOk(op.d)) return false; if (!s.moving && !beginMove(s)) return false; return step(s, op.d);
    case 'stop': return stopMove(s);
    case 'place': return place(s, op.t, op.q, op.r, op.opt);
    case 'walls': return placeWalls(s, op.hexes);
    case 'pushes': return placePushes(s, op.list);
    case 'bump': return bump(s, op.id);
    case 'remove': return removeRune(s, op.id);
    case 'pass': return pass(s);
  }
}

root.Tag = {
  COLS, ROWS, MAXLV, NFEAT, SETUP_RUNES, SETUP_GAP, DIRS, TYPES, CENTER, cells, cellMap,
  key, dist, name, other, newState, beginMove, step, stopMove, place, placeWalls, wallsOk, placePushes, pushesOk, bump, removeRune, pass,
  avail, placeOk, placeTargets, reach, beaconsOpen, runeAt, rockAt, playerAt, canEnter, botPlan, applyOp, features, bfs, setBrain,
};
})(typeof window !== 'undefined' ? window : globalThis);
