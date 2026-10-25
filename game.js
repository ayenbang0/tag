// tag: rules engine + bot. no DOM, runs in browser or node.
(function (root) {
'use strict';

const COLS = 25, ROWS = 25, CAP = 600, COOL = 4, MAXSTR = 4;   // strength 1 + up to 3 upgrades
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]; // e ne nw w sw se
const TYPES = ['Bomb', 'Dash', 'Push', 'Teleport', 'Wall', 'Grab', 'Return'];

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

// ---------- state ----------

function newState() {
  const rs = offset(0, HR), cs = offset(COLS - 1, HR);
  const s = {
    turn: 'R', n: 0, steps: 0, moving: false, noMove: false, slow: 0, over: null, passes: 0, nid: 1,
    sim: false, hist: {}, flash: null, log: [], beacons: pickBeacons([rs, cs]),
    p: {
      R: { q: rs.q, r: rs.r, f: 0, frozen: 0, grab: 0, v: [0, 0, 0, 0] },
      C: { q: cs.q, r: cs.r, f: 3, frozen: 0, grab: 0, v: null },
    },
    runes: [],
  };
  startTurn(s);
  return s;
}

function clone(s) {
  const cp = p => Object.assign({}, p, { v: p.v && p.v.slice() });
  return {
    turn: s.turn, n: s.n, steps: s.steps, moving: s.moving, noMove: s.noMove, slow: s.slow, over: s.over,
    passes: s.passes, nid: s.nid, sim: true, hist: null, flash: null, log: null, beacons: s.beacons,
    p: { C: cp(s.p.C), R: cp(s.p.R) },
    runes: s.runes.map(r => Object.assign({}, r, { shape: r.shape && r.shape.map(h => h.slice()) })),
  };
}

const say = (s, m) => { if (s.log) s.log.push(m); };
const flash = (s, hexes) => { if (!s.sim) s.flash = { n: s.n, hexes: hexes.map(h => h.slice()) }; };

const runeAt = (s, q, r) => s.runes.find(x => x.q === q && x.r === r);
const playerAt = (s, q, r) =>
  (s.p.C.q === q && s.p.C.r === r) ? 'C' : (s.p.R.q === q && s.p.R.r === r) ? 'R' : null;

function startTurn(s) {
  const p = s.p[s.turn];
  s.steps = 0; s.moving = false; s.noMove = false;
  s.slow = p.grab; p.grab = 0;      // grab penalty applies to this turn only
  if (p.frozen > 0) { p.frozen--; s.noMove = true; say(s, name(s.turn) + ' is frozen, cannot move'); }
}

function hash(s) {
  return JSON.stringify([s.turn, s.p, s.runes.map(r => [r.type, r.q, r.r, r.str, r.cd, r.dir, r.owner, r.shape])]);
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
  if (!cellMap[key(q, r)]) return false;
  const ru = runeAt(s, q, r);
  if (ru && ru.type === 'Wall') return false;
  const o = s.p[other(w)];
  if (o.q === q && o.r === r) return w === 'C';
  return true;
}

// walls may never cut the runner off from a beacon it still needs
function beaconsOpen(s, extra) {
  const blocked = {};
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
  const bi = s.runes.findIndex(b => b.type === 'Bomb' && b.shape.some(h => h[0] === p.q && h[1] === p.r));
  if (bi >= 0) {
    const b = s.runes[bi];
    p.frozen = b.str; s.steps = 0;
    s.runes.splice(bi, 1);
    flash(s, b.shape);
    say(s, name(w) + ' sets off a bomb, frozen ' + b.str);
    return;
  }
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
      while (n < ru.str) {
        const q = p.q + dq, r = p.r + dr, wl = runeAt(s, q, r);
        if (!cellMap[key(q, r)] || (wl && wl.type === 'Wall') || (o.q === q && o.r === r)) break;
        p.q = q; p.r = r; n++;
      }
      ru.cd = COOL;
      say(s, name(w) + ' is pushed ' + n);
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
    case 'Return': {
      let q = CENTER.q, r = CENTER.r;
      if (o.q === q && o.r === r && w === 'R') {
        const free = cells
          .filter(h => !isCenter(h.q, h.r) && !playerAt(s, h.q, h.r) && !runeAt(s, h.q, h.r))
          .sort((a, b) => dist(a, CENTER) - dist(b, CENTER))[0];
        q = free.q; r = free.r;
      }
      p.q = q; p.r = r; ru.cd = Math.max(1, COOL + 1 - ru.str);
      say(s, name(w) + ' returns to center');
      break;
    }
    case 'Grab':
      o.grab += ru.str; ru.cd = COOL;
      say(s, name(other(w)) + ' loses ' + ru.str + ' movement next turn');
      break;
  }
}

// ---------- actions ----------

function beginMove(s) {
  if (s.over || s.noMove || s.moving) return false;
  s.moving = true; s.steps = Math.max(1, 2 - s.slow); s.passes = 0;
  return true;
}

function step(s, d) {
  if (s.over || !s.moving || s.steps <= 0) return false;
  const w = s.turn, p = s.p[w], q = p.q + DIRS[d][0], r = p.r + DIRS[d][1];
  if (!canEnter(s, w, q, r)) return false;
  p.q = q; p.r = r; p.f = d; s.steps--;
  if (!check(s)) { trigger(s, w); check(s); }
  if (!s.over && s.steps <= 0) endTurn(s);
  return true;
}

function stopMove(s) { if (s.moving && !s.over) endTurn(s); }

// normal runes go within 2 of the caster; a grab must be at least 4 away
function placeOk(s, type, q, r) {
  const w = s.turn;
  if (!cellMap[key(q, r)]) return false;
  const d = dist(s.p[w], { q, r });
  if (type === 'Grab' ? d < 4 : d > 2) return false;
  if (beaconIdx(s, q, r) >= 0 || isCenter(q, r) || runeAt(s, q, r) || playerAt(s, q, r)) return false;
  if (type === 'Bomb' && s.runes.some(x => x.type === 'Bomb' && x.owner === w)) return false;
  return true;
}

function shapeOk(shape, q, r) {
  if (!shape || shape.length !== 6) return false;
  const seen = {};
  let hasOrigin = false;
  for (const h of shape) {
    if (!cellMap[key(h[0], h[1])] || seen[key(h[0], h[1])]) return false;
    if (dist({ q: h[0], r: h[1] }, { q, r }) > 2) return false;
    seen[key(h[0], h[1])] = 1;
    if (h[0] === q && h[1] === r) hasOrigin = true;
  }
  return hasOrigin;
}

const dirOk = d => Number.isInteger(d) && d >= 0 && d < 6;

// a bomb and anything overlapping it are both destroyed
function addRune(s, rn) {
  rn.id = s.nid++; rn.cd = 0;
  if (rn.type === 'Bomb') {
    const hit = s.runes.filter(x => rn.shape.some(h => h[0] === x.q && h[1] === x.r));
    if (hit.length) {
      s.runes = s.runes.filter(x => !hit.includes(x));
      flash(s, rn.shape);
      say(s, 'bomb overlaps a rune: both destroyed');
      return false;
    }
  }
  const b = s.runes.find(x => x.type === 'Bomb' && x.shape.some(h => h[0] === rn.q && h[1] === rn.r));
  if (b) {
    s.runes.splice(s.runes.indexOf(b), 1);
    flash(s, b.shape);
    say(s, 'rune placed in a bomb zone: both destroyed');
    return false;
  }
  s.runes.push(rn);
  return true;
}

// one wall action puts down 1-3 walls
function wallsOk(s, hexes) {
  if (!hexes || hexes.length < 1 || hexes.length > 3) return false;
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
  hexes.forEach(h => addRune(s, { type: 'Wall', q: h[0], r: h[1], str: 1, owner: w, dir: s.p[w].f, shape: null }));
  s.passes = 0; endTurn(s);
  return true;
}

// opt: { shape } for a bomb, { dir } for a push
function place(s, type, q, r, opt) {
  if (type === 'Wall') return placeWalls(s, [[q, r]]);
  opt = opt || {};
  if (s.over || s.moving || !placeOk(s, type, q, r)) return false;
  if (type === 'Bomb' && !shapeOk(opt.shape, q, r)) return false;
  if (type === 'Push' && !dirOk(opt.dir)) return false;
  const w = s.turn;
  say(s, name(w) + ' places ' + type);
  addRune(s, { type, q, r, str: 1, owner: w, dir: type === 'Push' ? opt.dir : s.p[w].f, shape: type === 'Bomb' ? opt.shape.map(h => h.slice()) : null });
  s.passes = 0; endTurn(s);
  return true;
}

function retype(s, id, type, opt) {
  opt = opt || {};
  if (s.over || s.moving) return false;
  const w = s.turn, p = s.p[w], rn = s.runes.find(x => x.id === id);
  if (!rn || dist(p, rn) > 1 || rn.type === type || type === 'Grab') return false;
  if (type === 'Wall' && (playerAt(s, rn.q, rn.r) || !beaconsOpen(s, [[rn.q, rn.r]]))) return false;
  if (type === 'Bomb' && (s.runes.some(x => x !== rn && x.type === 'Bomb' && x.owner === w) || !shapeOk(opt.shape, rn.q, rn.r))) return false;
  if (type === 'Push' && !dirOk(opt.dir)) return false;
  s.runes.splice(s.runes.indexOf(rn), 1);
  say(s, name(w) + ' turns ' + rn.type + ' into ' + type);
  addRune(s, {
    type, q: rn.q, r: rn.r, str: rn.str, owner: w, dir: type === 'Push' ? opt.dir : p.f,
    shape: type === 'Bomb' ? opt.shape.map(h => h.slice()) : null,
  });
  s.passes = 0; endTurn(s);
  return true;
}

function bump(s, id) {
  if (s.over || s.moving) return false;
  const rn = s.runes.find(x => x.id === id);
  if (!rn || dist(s.p[s.turn], rn) > 2 || rn.str >= MAXSTR) return false;
  rn.str++;
  say(s, name(s.turn) + ' upgrades ' + rn.type + ' to ' + (rn.str - 1) + '/3');
  s.passes = 0; endTurn(s);
  return true;
}

const leftHex = s => {
  const p = s.p[s.turn], d = DIRS[(p.f + 1) % 6];
  return { q: p.q + d[0], r: p.r + d[1] };
};

function removeLeft(s) {
  if (s.over || s.moving) return false;
  const h = leftHex(s), rn = runeAt(s, h.q, h.r);
  if (!rn) return false;
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
  const l = leftHex(s);
  return {
    move: !s.noMove && DIRS.some(d => canEnter(s, w, p.q + d[0], p.r + d[1])),
    place: placeTargets(s).length > 0 || placeTargets(s, 'Grab').length > 0,
    type: near(1),
    str: near(2, r => r.str < MAXSTR),
    remove: !!runeAt(s, l.q, l.r),
  };
}

// ---------- bot ----------

function bfs(s, from) {
  const d = { [key(from.q, from.r)]: 0 }, qu = [from];
  for (let i = 0; i < qu.length; i++) {
    const c = qu[i], cd = d[key(c.q, c.r)];
    for (const [dq, dr] of DIRS) {
      const nq = c.q + dq, nr = c.r + dr, k = key(nq, nr);
      if (d[k] !== undefined || !cellMap[k]) continue;
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

function evalState(s, who) {
  if (s.over) return s.over.w === who ? 1e6 : s.over.w ? -1e6 : 0;
  const R = s.p.R, C = s.p.C, me = s.p[who];
  const dC = bfs(s, C), dR = bfs(s, R);
  const gap = dC[key(R.q, R.r)] === undefined ? 99 : dC[key(R.q, R.r)];
  const seen = R.v.filter(Boolean).length;
  let sc = -me.frozen * 60 - me.grab * 40;
  if (who === 'R') {
    sc += seen * 400 - nearestBeacon(s, dR).d * 12 + Math.min(gap, 6) * 10;
    const reach = s.turn === 'C' ? (s.noMove ? 0 : Math.max(1, 2 - s.slow)) : 2;
    if (gap <= reach) sc -= 5000; else if (gap <= reach + 1) sc -= 60;
  } else {
    sc -= gap * 20 + seen * 300;
    const tb = nearestBeacon(s, dR);                       // wait where the runner has to go
    if (tb.c && dC[key(tb.c.q, tb.c.r)] !== undefined) sc -= Math.min(dC[key(tb.c.q, tb.c.r)], 40) * 9;
    s.beacons.forEach((c, i) => { if (!R.v[i]) sc += Math.min(dR[key(c.q, c.r)] === undefined ? 15 : dR[key(c.q, c.r)], 15) * 2; });
  }
  return sc;
}

// the bot only knows where the other side's bombs are, not their zones
function fog(s, who) {
  const c = clone(s);
  c.runes.forEach(r => { if (r.type === 'Bomb' && r.owner !== who) r.shape = [[r.q, r.r]]; });
  return c;
}

function pickShape(s, h) {
  const pool = cells.filter(c => !(c.q === h.q && c.r === h.r) && dist(c, h) <= 2);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return [[h.q, h.r]].concat(pool.slice(0, 5).map(c => [c.q, c.r]));
}

function botPlan(s0) {
  const who = s0.turn, foe = other(who), base = fog(s0, who);
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
  const add = (ops, st, bonus) => cands.push({ ops, score: evalState(st, who) + (bonus || 0) + Math.random() * 8 });

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
  if (own < 5) {
    const near = placeTargets(base);
    for (const h of near) {
      const k = key(h.q, h.r);
      for (const t of ['Bomb', 'Dash', 'Teleport', 'Return']) {
        if (!placeOk(base, t, h.q, h.r)) continue;
        let b = 0;
        if (mine(k) && (t === 'Dash' || (t === 'Teleport' && pairs > 0))) b += 28;
        if (theirs(k) && t === 'Bomb') b += 26;
        const opt = t === 'Bomb' ? { shape: pickShape(base, h) } : {};
        const c = clone(base);
        place(c, t, h.q, h.r, opt);
        add([{ k: 'place', t, q: h.q, r: h.r, opt }], c, b);
      }
      if (mine(k) && goal) {
        let bd = 0, bs = 1e9;
        DIRS.forEach((v, d) => { const s2 = dist({ q: h.q + v[0], r: h.r + v[1] }, goal); if (s2 < bs) { bs = s2; bd = d; } });
        const opt = { dir: bd }, c = clone(base);
        place(c, 'Push', h.q, h.r, opt);
        add([{ k: 'place', t: 'Push', q: h.q, r: h.r, opt }], c, 22);
      }
    }
    const wv = near.filter(h => wallsOk(base, [[h.q, h.r]]));
    wv.forEach(h => {
      const c = clone(base);
      placeWalls(c, [[h.q, h.r]]);
      add([{ k: 'walls', hexes: [[h.q, h.r]] }], c, theirs(key(h.q, h.r)) ? 26 : 0);
    });
    const wt = wv.filter(h => theirs(key(h.q, h.r))).slice(0, 3).map(h => [h.q, h.r]);
    if (wt.length > 1 && wallsOk(base, wt)) {
      const c = clone(base);
      placeWalls(c, wt);
      add([{ k: 'walls', hexes: wt }], c, 26 + 6 * wt.length);
    }
    const far = cells.filter(h => mine(key(h.q, h.r)) && placeOk(base, 'Grab', h.q, h.r)).sort(() => Math.random() - .5).slice(0, 6);
    far.forEach(h => {
      const c = clone(base);
      place(c, 'Grab', h.q, h.r);
      add([{ k: 'place', t: 'Grab', q: h.q, r: h.r, opt: {} }], c, 18);
    });
  }
  for (const rn of base.runes) {
    if (dist(base.p[who], rn) > 2 || rn.str >= MAXSTR) continue;
    let b = 0;
    if (rn.owner === who && ((mine(key(rn.q, rn.r)) && rn.type === 'Dash') || (theirs(key(rn.q, rn.r)) && rn.type === 'Wall'))) b = 6;
    const c = clone(base);
    bump(c, rn.id);
    add([{ k: 'bump', id: rn.id }], c, b);
  }
  if (avail(base).remove) {
    const l = leftHex(base), rn = runeAt(base, l.q, l.r);
    const c = clone(base);
    removeLeft(c);
    add([{ k: 'remove' }], c, rn.owner === foe && mine(key(rn.q, rn.r)) && rn.type !== 'Dash' ? 15 : 0);
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
    case 'retype': return retype(s, op.id, op.t, op.opt);
    case 'bump': return bump(s, op.id);
    case 'remove': return removeLeft(s);
    case 'pass': return pass(s);
  }
}

root.Tag = {
  COLS, ROWS, MAXSTR, DIRS, TYPES, CENTER, cells, cellMap,
  key, dist, name, other, newState, beginMove, step, stopMove, place, placeWalls, wallsOk, retype, bump, removeLeft, pass,
  avail, placeOk, placeTargets, shapeOk, beaconsOpen, leftHex, runeAt, playerAt, canEnter, botPlan, applyOp,
};
})(typeof window !== 'undefined' ? window : globalThis);
