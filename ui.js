(function () {
'use strict';
const T = Tag;
const $ = id => document.getElementById(id);
const TAU = Math.PI * 2, SQ = Math.sqrt(3);
const cv = $('c'), cx = cv.getContext('2d'), stage = $('stage'), menuEl = $('menu');

const COL = {
  Bomb: '#ff7a3d', Dash: '#ffd23f', Push: '#6fdc8c', Teleport: '#b583ff', Wall: '#9aa7bd', Grab: '#ff7eb6', Return: '#5ea8ff',
  C: '#ee5a5f', R: '#3cc8e6', gold: '#f2b84b', ice: '#a8ecff', zone: '#b583ff',
  move: '#6fdc8c', place: '#ffd23f', type: '#b583ff', str: '#5ea8ff', remove: '#ff6b6b', end: '#9aa7bd',
};
const DESC = {
  Bomb: 'hidden 6-hex zone you draw; freezes whoever walks in (strength = turns). one per player',
  Dash: '+2 + strength extra steps',
  Push: 'shoves strength hexes along the arrow, no triggers',
  Teleport: 'jump to another teleport, + strength steps',
  Wall: 'blocks movement. strength = durability',
  Grab: 'ends the move; next strength moves are 1 step',
  Return: 'go to the center. higher strength = shorter cooldown',
};
const ACT = {
  move: 'move: up to 2 steps', place: 'place a rune within 2', type: 'change a rune type within 1',
  str: 'bump a rune strength within 2', remove: 'remove the rune on your left (dashed)', end: 'end move',
};

// ---------- icons ----------

const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
};

function head(c, x, y, ang, s) {
  c.beginPath();
  c.moveTo(x + Math.cos(ang) * s, y + Math.sin(ang) * s);
  c.lineTo(x + Math.cos(ang + 2.5) * s, y + Math.sin(ang + 2.5) * s);
  c.lineTo(x + Math.cos(ang - 2.5) * s, y + Math.sin(ang - 2.5) * s);
  c.closePath(); c.fill();
}

const RUNE_G = {
  Bomb(c, r) {
    c.beginPath(); c.arc(-r * .05, r * .18, r * .58, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(r * .3, -r * .28); c.quadraticCurveTo(r * .55, -r * .75, r * .85, -r * .62); c.stroke();
    c.lineWidth *= .7;
    for (let i = 0; i < 4; i++) {
      const a = i * TAU / 4 + .4;
      c.beginPath();
      c.moveTo(r * .85 + Math.cos(a) * r * .12, -r * .62 + Math.sin(a) * r * .12);
      c.lineTo(r * .85 + Math.cos(a) * r * .3, -r * .62 + Math.sin(a) * r * .3);
      c.stroke();
    }
    c.globalAlpha = .55; c.strokeStyle = '#fff';
    c.beginPath(); c.arc(-r * .2, r * .05, r * .3, Math.PI * 1.1, Math.PI * 1.55); c.stroke();
  },
  Dash(c, r) {
    c.beginPath();
    [[.18, -.95], [-.5, .1], [-.08, .1], [-.2, .95], [.5, -.2], [.08, -.2]].forEach((p, i) => (i ? c.lineTo : c.moveTo).call(c, p[0] * r, p[1] * r));
    c.closePath(); c.fill();
  },
  Push(c, r, d) {
    c.rotate(-d * Math.PI / 3);
    c.beginPath(); c.moveTo(-r * .8, 0); c.lineTo(r * .3, 0); c.stroke();
    c.beginPath(); c.moveTo(r * .9, 0); c.lineTo(r * .2, -r * .58); c.lineTo(r * .2, r * .58); c.closePath(); c.fill();
  },
  Teleport(c, r) {
    c.beginPath(); c.arc(0, 0, r * .78, 0, TAU); c.stroke();
    c.beginPath(); c.arc(0, 0, r * .45, 0, TAU); c.stroke();
    c.beginPath(); c.arc(0, 0, r * .13, 0, TAU); c.fill();
  },
  Wall(c, r) {
    const w = r * 1.5, h = r * 1.15;
    c.strokeRect(-w / 2, -h / 2, w, h);
    c.beginPath();
    c.moveTo(-w / 2, -h / 6); c.lineTo(w / 2, -h / 6); c.moveTo(-w / 2, h / 6); c.lineTo(w / 2, h / 6);
    c.moveTo(0, -h / 2); c.lineTo(0, -h / 6); c.moveTo(-w / 4, -h / 6); c.lineTo(-w / 4, h / 6);
    c.moveTo(w / 4, -h / 6); c.lineTo(w / 4, h / 6); c.moveTo(0, h / 6); c.lineTo(0, h / 2);
    c.stroke();
  },
  Grab(c, r) {
    c.beginPath(); c.arc(0, r * .6, r * .26, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(-r * .12, r * .4); c.quadraticCurveTo(-r * .95, -r * .05, -r * .5, -r * .85); c.stroke();
    c.beginPath(); c.moveTo(r * .12, r * .4); c.quadraticCurveTo(r * .95, -r * .05, r * .5, -r * .85); c.stroke();
    c.beginPath(); c.moveTo(0, r * .35); c.lineTo(0, -r * .95); c.stroke();
  },
  Return(c, r) {
    const a0 = .7, a1 = 5.3, rr = r * .66;
    c.beginPath(); c.arc(0, 0, rr, a0, a1); c.stroke();
    head(c, Math.cos(a1) * rr, Math.sin(a1) * rr, a1 + Math.PI / 2, r * .38);
    c.beginPath(); c.arc(0, 0, r * .14, 0, TAU); c.fill();
  },
};

const ACT_G = {
  move(c, r) {
    c.beginPath(); c.moveTo(-r * .9, 0); c.lineTo(r * .35, 0); c.stroke();
    head(c, r * .95, 0, 0, r * .6);
    c.beginPath(); c.moveTo(-r * .9, -r * .5); c.lineTo(-r * .3, -r * .5); c.moveTo(-r * .9, r * .5); c.lineTo(-r * .3, r * .5); c.stroke();
  },
  place(c, r) {
    c.beginPath(); c.arc(0, 0, r * .85, 0, TAU); c.stroke();
    c.beginPath(); c.moveTo(-r * .45, 0); c.lineTo(r * .45, 0); c.moveTo(0, -r * .45); c.lineTo(0, r * .45); c.stroke();
  },
  type(c, r) {
    c.beginPath(); c.arc(0, 0, r * .7, Math.PI * .15, Math.PI * .85); c.stroke();
    head(c, Math.cos(Math.PI * .85) * r * .7, Math.sin(Math.PI * .85) * r * .7, Math.PI * .85 + Math.PI / 2, r * .35);
    c.beginPath(); c.arc(0, 0, r * .7, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
    head(c, Math.cos(Math.PI * 1.85) * r * .7, Math.sin(Math.PI * 1.85) * r * .7, Math.PI * 1.85 + Math.PI / 2, r * .35);
  },
  str(c, r) {
    [.5, 1, 1.5].forEach((h, i) => c.fillRect(-r * .85 + i * r * .6, r * .8 - h * r * .8, r * .42, h * r * .8));
  },
  remove(c, r) {
    c.beginPath(); c.moveTo(-r * .6, -r * .6); c.lineTo(r * .6, r * .6); c.moveTo(r * .6, -r * .6); c.lineTo(-r * .6, r * .6); c.stroke();
  },
  end(c, r) { c.fillRect(-r * .55, -r * .55, r * 1.1, r * 1.1); },
};

function glyph(c, set, id, r, col, dir) {
  c.save();
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = Math.max(1.3, r * .16);
  set[id](c, r, dir || 0);
  c.restore();
}

function drawPlayer(c, w, x, y, r, f) {
  const col = COL[w];
  c.save(); c.translate(x, y);
  c.fillStyle = 'rgba(0,0,0,.35)';
  c.beginPath(); c.ellipse(0, r * .75, r * .85, r * .3, 0, 0, TAU); c.fill();
  c.save(); c.rotate(-f * Math.PI / 3);
  c.fillStyle = col;
  c.beginPath(); c.moveTo(r * 1.3, 0); c.lineTo(r * .85, -r * .3); c.lineTo(r * .85, r * .3); c.closePath(); c.fill();
  c.restore();
  if (w === 'C') {
    c.fillStyle = col;
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8 + .2;
      c.beginPath();
      c.moveTo(Math.cos(a - .22) * r * .9, Math.sin(a - .22) * r * .9);
      c.lineTo(Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2);
      c.lineTo(Math.cos(a + .22) * r * .9, Math.sin(a + .22) * r * .9);
      c.closePath(); c.fill();
    }
  }
  const g = c.createRadialGradient(-r * .3, -r * .3, r * .1, 0, 0, r);
  g.addColorStop(0, w === 'C' ? '#ff9a9d' : '#9be9fb'); g.addColorStop(1, col);
  c.fillStyle = g; c.strokeStyle = '#fff'; c.lineWidth = Math.max(1.5, r * .1);
  c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#fff'; c.strokeStyle = '#fff'; c.lineCap = 'round'; c.lineJoin = 'round';
  if (w === 'C') {
    c.beginPath(); c.ellipse(0, 0, r * .46, r * .3, 0, 0, TAU); c.fill();
    c.fillStyle = '#3a0d10'; c.beginPath(); c.arc(0, 0, r * .17, 0, TAU); c.fill();
  } else {
    c.lineWidth = r * .2;
    for (const o of [-.1, .3]) { c.beginPath(); c.moveTo(-r * .3 + o * r, -r * .38); c.lineTo(r * .1 + o * r, 0); c.lineTo(-r * .3 + o * r, r * .38); c.stroke(); }
  }
  c.restore();
}

function drawFlag(c, x, y, r, on) {
  c.save(); c.translate(x, y);
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = COL.gold; c.fillStyle = COL.gold; c.lineWidth = Math.max(1.3, r * .13);
  c.beginPath(); c.moveTo(-r * .35, r * .8); c.lineTo(-r * .35, -r * .8); c.stroke();
  c.beginPath(); c.moveTo(-r * .35, -r * .8); c.lineTo(r * .7, -r * .4); c.lineTo(-r * .35, 0); c.closePath();
  if (on) c.fill(); else { c.globalAlpha = .6; c.stroke(); }
  c.restore();
}

const iconCache = {};
function iconURL(kind, id, extra) {
  const k = kind + id + (extra || '');
  if (iconCache[k]) return iconCache[k];
  const s = 48, c = document.createElement('canvas');
  c.width = c.height = s * 2;
  const g = c.getContext('2d');
  g.scale(2, 2); g.translate(s / 2, s / 2);
  if (kind === 'rune') glyph(g, RUNE_G, id, s * .32, COL[id], 0);
  else if (kind === 'act') glyph(g, ACT_G, id, s * .3, COL[id]);
  else if (kind === 'player') drawPlayer(g, id, 0, 0, s * .3, 0);
  else drawFlag(g, 0, 0, s * .4, extra === '1');
  return (iconCache[k] = c.toDataURL());
}

// ---------- geometry ----------

const U = h => ({ x: SQ * (h.q + h.r / 2), y: 1.5 * h.r });
let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
T.cells.forEach(h => {
  const u = U(h);
  bx0 = Math.min(bx0, u.x); bx1 = Math.max(bx1, u.x); by0 = Math.min(by0, u.y); by1 = Math.max(by1, u.y);
});
const view = { W: 1, H: 1, SZ: 20, ox: 0, oy: 0, dpr: 1, grid: null };
const px = u => ({ x: view.ox + u.x * view.SZ, y: view.oy + u.y * view.SZ });

function hexPath(c, x, y, r) {
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 180 * (60 * i + 30);
    (i ? c.lineTo : c.moveTo).call(c, x + r * Math.cos(a), y + r * Math.sin(a));
  }
  c.closePath();
}

function layout() {
  const r = stage.getBoundingClientRect();
  const W = Math.max(200, Math.floor(r.width)), H = Math.max(200, Math.floor(r.height));
  view.dpr = window.devicePixelRatio || 1;
  view.W = W; view.H = H;
  view.SZ = Math.min(W / (bx1 - bx0 + 2.4), H / (by1 - by0 + 3.2));
  view.ox = (W - (bx1 - bx0) * view.SZ) / 2 - bx0 * view.SZ;
  view.oy = (H - (by1 - by0) * view.SZ) / 2 - by0 * view.SZ + 8;
  cv.width = W * view.dpr; cv.height = H * view.dpr;
  const g = document.createElement('canvas');
  g.width = cv.width; g.height = cv.height;
  const c = g.getContext('2d');
  c.scale(view.dpr, view.dpr);
  const tone = ['#1a2132', '#1c2436', '#1e2739'];
  c.lineWidth = 1; c.strokeStyle = '#2b3650';
  T.cells.forEach(h => {
    const p = px(U(h));
    hexPath(c, p.x, p.y, view.SZ * .96);
    c.fillStyle = tone[((h.q - h.r) % 3 + 3) % 3];
    c.fill(); c.stroke();
  });
  view.grid = g;
  if (S) renderMenu(false);
}

function hexAt(e) {
  const b = cv.getBoundingClientRect();
  const x = (e.clientX - b.left - view.ox) / view.SZ, y = (e.clientY - b.top - view.oy) / view.SZ;
  const fq = SQ / 3 * x - y / 3, fr = 2 / 3 * y;
  let q = Math.round(fq), r = Math.round(fr), s = Math.round(-fq - fr);
  const dq = Math.abs(q - fq), dr = Math.abs(r - fr), ds = Math.abs(s + fq + fr);
  if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
  return T.cellMap[T.key(q, r)] || null;
}

// ---------- state ----------

let S, human, ui, busy = false, hover = null;
const A = { pl: {}, known: {}, pops: {}, ghosts: [], rip: [], flashObj: null, prevHex: {}, prevV: [0, 0, 0, 0] };

function newGame() {
  human = Math.random() < 0.5 ? 'C' : 'R';
  S = T.newState();
  ui = { mode: null, type: 'Dash', pend: null, menu: null, pick: null };
  busy = false;
  A.known = {}; A.pops = {}; A.ghosts = []; A.rip = []; A.flashObj = null; A.prevV = [0, 0, 0, 0];
  ['C', 'R'].forEach(w => { A.pl[w] = U(S.p[w]); A.pl[w] = { x: A.pl[w].x, y: A.pl[w].y }; A.prevHex[w] = { q: S.p[w].q, r: S.p[w].r }; });
  $('over').className = '';
  next();
}

const mine = () => S.turn === human && !busy && !S.over;
const ripple = (hex, col, max, dur) => { const u = U(hex); A.rip.push({ x: u.x, y: u.y, col, max: max || 2, dur: dur || 650, t: performance.now() }); };

// diff the state against what is on screen so animations know what changed
function sync() {
  const now = performance.now();
  const ids = {};
  S.runes.forEach(r => { ids[r.id] = r; });
  Object.keys(A.known).forEach(id => {
    if (!ids[id]) {
      const k = A.known[id];
      A.ghosts.push({ r: k, t: now });
      if (k.type === 'Bomb') ripple(k, COL.Bomb, 3.2, 800);
      delete A.known[id];
    }
  });
  S.runes.forEach(r => {
    const k = A.known[r.id];
    if (!k) A.pops[r.id] = now;
    else if (r.cd > k.cd) ripple(r, COL[r.type], 1.8, 600);
    A.known[r.id] = { id: r.id, type: r.type, q: r.q, r: r.r, str: r.str, dir: r.dir, cd: r.cd };
  });
  ['C', 'R'].forEach(w => {
    const p = S.p[w], pv = A.prevHex[w];
    if (T.dist(pv, p) >= 3) { ripple(pv, COL[w], 1.6, 600); ripple(p, COL[w], 2, 700); }
    A.prevHex[w] = { q: p.q, r: p.r };
  });
  S.p.R.v.forEach((v, i) => { if (v && !A.prevV[i]) ripple(T.CORNERS[i], COL.gold, 3, 1000); A.prevV[i] = v; });
  if (S.flash && S.flash !== A.flashObj) { A.flashObj = S.flash; A.flashT = now; }
  panel();
  renderOver();
}

// ---------- flow ----------

function next() {
  sync();
  if (S.over) return;
  if (S.turn === human) {
    if (!Object.values(T.avail(S)).some(Boolean)) { T.pass(S); next(); }
    return;
  }
  if (!busy) { busy = true; sync(); setTimeout(botTurn, 550); }
}

function botTurn() {
  const who = S.turn, ops = T.botPlan(S);
  let i = 0;
  (function run() {
    if (S.over || S.turn !== who || i >= ops.length) {
      if (!S.over && S.turn === who) T.stopMove(S);
      busy = false; next(); return;
    }
    T.applyOp(S, ops[i++]);
    if (S.over || S.turn !== who) { busy = false; next(); return; }
    sync();
    setTimeout(run, 330);
  })();
}

function done() { ui.mode = null; ui.pend = null; ui.menu = null; renderMenu(false); next(); }

function endMove() { if (mine() && S.moving) { T.stopMove(S); done(); } }

function cancel() {
  if (!mine() || S.moving) return;
  if (ui.mode === 'shape') ui.mode = ui.pend.retype != null ? 'type' : 'place';
  else ui.mode = null;
  ui.pend = null; ui.menu = null;
  renderMenu(false); sync();
}

function click(h) {
  const p = S.p[human], m = S.moving ? 'move' : ui.mode;
  if (m === 'move') {
    const d = T.DIRS.findIndex(v => p.q + v[0] === h.q && p.r + v[1] === h.r);
    if (d < 0) return;
    if (!S.moving && !T.beginMove(S)) return;
    if (T.step(S, d)) { if (S.turn !== human || S.over) done(); else sync(); }
  } else if (m === 'place') {
    if (!T.placeOk(S, ui.type, h.q, h.r)) return;
    if (ui.type === 'Bomb') { ui.pend = { q: h.q, r: h.r, shape: [[h.q, h.r]], retype: null }; ui.mode = 'shape'; sync(); }
    else if (T.place(S, ui.type, h.q, h.r)) done();
  } else if (m === 'type') {
    const rn = T.runeAt(S, h.q, h.r);
    if (!rn || rn.type === ui.type || T.dist(p, rn) > 1) return;
    if (ui.type === 'Bomb') {
      if (S.runes.some(x => x !== rn && x.type === 'Bomb' && x.owner === human)) return;
      ui.pend = { q: rn.q, r: rn.r, shape: [[rn.q, rn.r]], retype: rn.id }; ui.mode = 'shape'; sync();
    } else if (T.retype(S, rn.id, ui.type)) done();
  } else if (m === 'str') {
    const rn = T.runeAt(S, h.q, h.r);
    if (rn && T.bump(S, rn.id)) done();
  } else if (m === 'shape') {
    const pd = ui.pend;
    if (T.dist(h, pd) > 2 || (h.q === pd.q && h.r === pd.r)) return;
    const i = pd.shape.findIndex(v => v[0] === h.q && v[1] === h.r);
    if (i >= 0) pd.shape.splice(i, 1); else pd.shape.push([h.q, h.r]);
    if (pd.shape.length === 6) {
      const ok = pd.retype != null ? T.retype(S, pd.retype, 'Bomb', pd.shape) : T.place(S, 'Bomb', pd.q, pd.r, pd.shape);
      if (ok) { done(); return; }
    }
    sync();
  }
}

cv.addEventListener('click', e => {
  const h = hexAt(e);
  if (!h || !mine()) return;
  const p = S.p[human];
  if (h.q === p.q && h.r === p.r && ui.mode !== 'shape') {
    if (ui.menu) ui.menu = null;
    else { ui.mode = null; ui.pend = null; ui.menu = S.moving ? 'moving' : 'main'; }
    renderMenu(true); sync();
    return;
  }
  if (ui.menu) { ui.menu = null; renderMenu(false); sync(); return; }
  click(h);
});
cv.addEventListener('mousemove', e => { hover = hexAt(e); });
cv.addEventListener('mouseleave', () => { hover = null; });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') cancel();
  else if ((e.key === 'Enter' || e.key === ' ') && S.moving) { e.preventDefault(); endMove(); }
});
$('new').onclick = newGame;
$('again').onclick = newGame;

// ---------- action ring ----------

function menuItems() {
  const a = T.avail(S);
  if (ui.menu === 'moving') return [{ id: 'end', label: ACT.end, ok: true, kind: 'act' }];
  if (ui.menu === 'rune') {
    const placing = ui.pick === 'place';
    const hasBomb = S.runes.some(x => x.type === 'Bomb' && x.owner === human);
    return T.TYPES.map(t => ({
      id: t, label: t + ': ' + DESC[t], kind: 'rune',
      ok: !(t === 'Bomb' && hasBomb) && (!placing || T.placeTargets(S, t).length > 0),
    }));
  }
  return ['move', 'place', 'type', 'str', 'remove'].map(id => ({ id, label: ACT[id], ok: !!a[id], kind: 'act' }));
}

function renderMenu(anim) {
  menuEl.innerHTML = '';
  if (!ui.menu || !mine()) { ui.menu = ui.menu && mine() ? ui.menu : null; return; }
  const items = menuItems();
  const g = px(A.pl[human] || U(S.p[human]));
  const R = Math.max(58, view.SZ * 2.6), pad = R + 30;
  const x = Math.min(Math.max(g.x, pad), view.W - pad), y = Math.min(Math.max(g.y, pad), view.H - pad);
  const ring = document.createElement('div');
  ring.className = 'mring';
  ring.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + 2 * R + 'px;height:' + 2 * R + 'px';
  menuEl.appendChild(ring);
  const btns = items.map((it, i) => {
    const b = document.createElement('button');
    const ang = -Math.PI / 2 + i * TAU / items.length;
    const fx = x + (items.length === 1 ? 0 : Math.cos(ang) * R), fy = y + (items.length === 1 ? -R : Math.sin(ang) * R);
    b.className = 'mi';
    b.style.setProperty('--mc', COL[it.id]);
    b.style.left = (anim ? x : fx) + 'px'; b.style.top = (anim ? y : fy) + 'px';
    b.disabled = !it.ok;
    b.title = it.label;
    b.innerHTML = '<img alt="" src="' + iconURL(it.kind, it.id) + '">';
    b.onmouseenter = () => { $('toast').textContent = it.label; $('toast').className = ''; };
    b.onmouseleave = () => panel();
    b.onclick = e => { e.stopPropagation(); onMenu(it.id); };
    menuEl.appendChild(b);
    return [b, fx, fy];
  });
  const go = () => {
    ring.classList.add('in');
    btns.forEach(([b, fx, fy]) => { b.classList.add('in'); b.style.left = fx + 'px'; b.style.top = fy + 'px'; });
  };
  if (anim) requestAnimationFrame(() => requestAnimationFrame(go)); else go();
}

function onMenu(id) {
  if (!mine()) return;
  if (id === 'end') { endMove(); return; }
  if (id === 'remove') { ui.menu = null; if (T.removeLeft(S)) done(); else renderMenu(false); return; }
  if (id === 'place' || id === 'type') { ui.menu = 'rune'; ui.pick = id; renderMenu(true); sync(); return; }
  if (T.TYPES.includes(id)) { ui.type = id; ui.mode = ui.pick; ui.menu = null; renderMenu(false); sync(); return; }
  ui.mode = id; ui.menu = null; renderMenu(false); sync();
}

// ---------- panel ----------

function hintText() {
  if (S.over) return 'game over';
  if (S.turn !== human || busy) return 'bot is thinking';
  if (S.moving) return 'click a neighbouring hex (' + S.steps + ' step' + (S.steps === 1 ? '' : 's') + ' left) - or click your piece to end the move';
  switch (ui.mode) {
    case 'move': return 'click a highlighted neighbour to step';
    case 'place': return 'place ' + ui.type + ': click a highlighted hex' + (ui.type === 'Bomb' ? ' (then draw its zone)' : '');
    case 'shape': return 'draw the bomb zone: ' + (6 - ui.pend.shape.length) + ' more hex(es) within 2 of the bomb (esc to go back)';
    case 'type': return 'convert to ' + ui.type + ': click a highlighted rune';
    case 'str': return 'click a highlighted rune to raise its strength';
    default: return 'your turn - click your piece to choose an action' + (S.noMove ? ' (frozen: no moving)' : '');
  }
}

const you = $('you'), corners = $('corners');
T.TYPES.forEach(t => {
  const leg = $('leg');
  const im = document.createElement('img'); im.src = iconURL('rune', t);
  const d = document.createElement('div'); d.textContent = t + ': ' + DESC[t];
  leg.appendChild(im); leg.appendChild(d);
});

function panel() {
  const t = $('toast');
  t.textContent = hintText();
  t.className = (S.turn !== human || busy) && !S.over ? 'bot' : '';
  you.innerHTML = '<img alt="" src="' + iconURL('player', human) + '"><span style="color:' + COL[human] + '">you are the ' + T.name(human) + '</span>';
  $('turn').textContent = S.over ? 'game over' : 'turn ' + (S.n + 1) + ' - ' + (S.turn === human ? 'yours' : 'bot (' + T.name(S.turn) + ')');
  corners.innerHTML = 'corners ' + S.p.R.v.map(v => '<img alt="" src="' + iconURL('flag', 'f', v ? '1' : '0') + '">').join('');
  const fl = p => [p.frozen ? 'frozen ' + p.frozen : '', p.grab ? 'grab ' + p.grab : ''].filter(Boolean).join(', ') || 'ok';
  $('stat').textContent = 'chaser: ' + fl(S.p.C) + '  |  runner: ' + fl(S.p.R);
  const log = $('log');
  log.innerHTML = '';
  S.log.slice(-9).forEach(l => {
    const d = document.createElement('div');
    d.className = l.startsWith('chaser') ? 'lC' : l.startsWith('runner') ? 'lR' : '';
    d.textContent = l;
    log.appendChild(d);
  });
}

function renderOver() {
  const o = $('over');
  if (!S.over) { o.className = ''; return; }
  const w = S.over.w, win = w === human;
  o.style.setProperty('--oc', w === null ? '#9aa7bd' : win ? '#6fdc8c' : '#ff6b6b');
  $('overT').textContent = w === null ? 'tie' : win ? 'you win' : 'you lose';
  $('overP').textContent = S.over.why;
  o.className = 'show';
}

// ---------- drawing ----------

function highlights() {
  const hl = {};
  if (!mine() || ui.menu) return hl;
  const p = S.p[human], m = S.moving ? 'move' : ui.mode;
  const add = h => { hl[T.key(h.q, h.r)] = 1; };
  if (m === 'move') T.DIRS.forEach(d => { const q = p.q + d[0], r = p.r + d[1]; if (T.canEnter(S, human, q, r)) add({ q, r }); });
  else if (m === 'place') T.cells.filter(h => T.placeOk(S, ui.type, h.q, h.r)).forEach(add);
  else if (m === 'type') S.runes.filter(r => T.dist(p, r) <= 1 && r.type !== ui.type).forEach(add);
  else if (m === 'str') S.runes.filter(r => T.dist(p, r) <= 2).forEach(add);
  else if (m === 'shape') T.cells.filter(h => T.dist(h, ui.pend) <= 2).forEach(add);
  return hl;
}

function modeColor() {
  const m = S.moving ? 'move' : ui.mode;
  return m === 'place' || m === 'type' ? COL[ui.type] : m === 'shape' ? COL.zone : COL[m] || COL.move;
}

const easeBack = x => 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2);

function render(t) {
  const c = cx, SZ = view.SZ, hr = SZ * .96;
  c.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  c.clearRect(0, 0, view.W, view.H);
  if (view.grid) c.drawImage(view.grid, 0, 0, view.W, view.H);
  const pulse = .5 + .5 * Math.sin(t / 260);

  // corner + center marks
  T.CORNERS.forEach((h, i) => {
    const p = px(U(h)), on = S.p.R.v[i];
    hexPath(c, p.x, p.y, hr); c.fillStyle = rgba(COL.gold, on ? .22 : .08); c.fill();
    if (on) { c.shadowColor = COL.gold; c.shadowBlur = 12; }
    drawFlag(c, p.x, p.y, SZ * .62, !!on);
    c.shadowBlur = 0;
  });
  const ce = px(U(T.CENTER));
  c.strokeStyle = 'rgba(223,229,240,.35)'; c.lineWidth = 1.5; c.setLineDash([3, 4]);
  c.beginPath(); c.arc(ce.x, ce.y, SZ * .5, 0, TAU); c.stroke(); c.setLineDash([]);
  c.fillStyle = 'rgba(223,229,240,.35)'; c.beginPath(); c.arc(ce.x, ce.y, SZ * .08, 0, TAU); c.fill();

  // own bomb zones, draft zone, revealed zones
  S.runes.forEach(r => {
    if (r.type !== 'Bomb' || r.owner !== human) return;
    r.shape.forEach(h => {
      const p = px(U({ q: h[0], r: h[1] }));
      hexPath(c, p.x, p.y, hr); c.fillStyle = rgba(COL.zone, .16); c.fill();
      c.strokeStyle = rgba(COL.zone, .7); c.lineWidth = 1.2; c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]);
    });
  });
  if (ui.pend) ui.pend.shape.forEach(h => {
    const p = px(U({ q: h[0], r: h[1] }));
    hexPath(c, p.x, p.y, hr); c.fillStyle = rgba(COL.zone, .5); c.fill();
  });
  if (S.flash && S.n - S.flash.n <= 1) S.flash.hexes.forEach(h => {
    const p = px(U({ q: h[0], r: h[1] }));
    hexPath(c, p.x, p.y, hr); c.fillStyle = rgba('#ff4d4d', .22 + .2 * pulse); c.fill();
  });

  // action highlights
  const hl = highlights(), mc = modeColor();
  Object.keys(hl).forEach(k => {
    const p = px(U(T.cellMap[k]));
    hexPath(c, p.x, p.y, hr);
    c.fillStyle = rgba(mc, .14 + .16 * pulse); c.fill();
    c.strokeStyle = rgba(mc, .85); c.lineWidth = 1.6; c.stroke();
  });

  // runes
  S.runes.forEach(r => {
    const p = px(U(r));
    let sc = 1;
    if (A.pops[r.id]) { const a = (t - A.pops[r.id]) / 320; if (a < 1) sc = Math.max(.01, easeBack(a)); }
    drawRune(c, r, p.x, p.y, SZ, sc, 1);
  });
  A.ghosts = A.ghosts.filter(g => t - g.t < 380);
  A.ghosts.forEach(g => {
    const a = (t - g.t) / 380, p = px(U(g.r));
    drawRune(c, g.r, p.x, p.y, SZ, 1 + a * .5, 1 - a);
  });

  // dashed marker on the removable rune
  if (mine() && !S.moving && !ui.menu) {
    const l = T.leftHex(S), rn = T.runeAt(S, l.q, l.r);
    if (rn) {
      const p = px(U(l));
      hexPath(c, p.x, p.y, hr); c.strokeStyle = rgba(COL.remove, .55 + .35 * pulse); c.lineWidth = 1.6;
      c.setLineDash([4, 3]); c.lineDashOffset = -t / 80; c.stroke(); c.setLineDash([]); c.lineDashOffset = 0;
    }
  }

  // ripples
  A.rip = A.rip.filter(r => t - r.t < r.dur);
  A.rip.forEach(r => {
    const a = (t - r.t) / r.dur, p = px(r);
    c.strokeStyle = rgba(r.col, 1 - a); c.lineWidth = 1 + 3 * (1 - a);
    c.beginPath(); c.arc(p.x, p.y, SZ * (.3 + r.max * a), 0, TAU); c.stroke();
  });

  // players
  ['C', 'R'].forEach(w => {
    const d = A.pl[w], p = px(d), pl = S.p[w], r = SZ * .5;
    if (S.turn === w && !S.over) {
      c.strokeStyle = rgba(COL[w], .35 + .35 * pulse); c.lineWidth = 2;
      c.beginPath(); c.arc(p.x, p.y, r * (1.5 + .12 * pulse), 0, TAU); c.stroke();
    }
    drawPlayer(c, w, p.x, p.y, r, pl.f);
    if (pl.frozen || (S.turn === w && S.noMove)) {
      c.strokeStyle = COL.ice; c.lineWidth = 2; c.setLineDash([5, 4]); c.lineDashOffset = -t / 50;
      c.beginPath(); c.arc(p.x, p.y, r * 1.45, 0, TAU); c.stroke();
      c.setLineDash([]); c.lineDashOffset = 0;
      c.fillStyle = rgba(COL.ice, .18); c.beginPath(); c.arc(p.x, p.y, r * 1.45, 0, TAU); c.fill();
    }
    if (pl.grab) {
      c.strokeStyle = COL.Grab; c.lineWidth = 2; c.setLineDash([2, 4]); c.lineDashOffset = t / 60;
      c.beginPath(); c.arc(p.x, p.y, r * 1.7, 0, TAU); c.stroke();
      c.setLineDash([]); c.lineDashOffset = 0;
    }
  });
  if (mine() && !ui.menu && !ui.mode && !S.moving) {
    const p = px(A.pl[human]);
    c.strokeStyle = rgba('#fff', .3 + .5 * pulse); c.lineWidth = 1.5; c.setLineDash([3, 4]); c.lineDashOffset = -t / 70;
    c.beginPath(); c.arc(p.x, p.y, SZ * .72, 0, TAU); c.stroke(); c.setLineDash([]); c.lineDashOffset = 0;
  }

  if (hover && mine()) {
    const p = px(U(hover));
    hexPath(c, p.x, p.y, hr); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1.5; c.stroke();
  }
}

function drawRune(c, r, x, y, SZ, sc, alpha) {
  const col = COL[r.type], cool = r.cd > 0;
  c.save();
  c.translate(x, y); c.scale(sc, sc);
  c.globalAlpha = alpha * (cool ? .55 : 1);
  hexPath(c, 0, 0, SZ * .8);
  c.fillStyle = r.type === 'Wall' ? '#39425a' : 'rgba(10,13,19,.88)'; c.fill();
  c.strokeStyle = col; c.lineWidth = 1.8; c.stroke();
  if (r.type === 'Bomb' && r.owner === human) { c.strokeStyle = COL.zone; c.setLineDash([2, 2]); hexPath(c, 0, 0, SZ * .88); c.stroke(); c.setLineDash([]); }
  glyph(c, RUNE_G, r.type, SZ * .42, col, r.dir);
  c.fillStyle = col;
  for (let i = 0; i < r.str; i++) { c.beginPath(); c.arc((i - (r.str - 1) / 2) * SZ * .22, SZ * .6, SZ * .075, 0, TAU); c.fill(); }
  if (cool) {
    c.globalAlpha = alpha;
    c.fillStyle = '#fff'; c.font = 'bold ' + Math.round(SZ * .5) + 'px system-ui, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(r.cd, SZ * .5, -SZ * .45);
  }
  c.restore();
}

let last = 0;
function frame(t) {
  requestAnimationFrame(frame);
  if (!S || !view.grid) return;
  const dt = Math.min(.05, (t - last) / 1000 || 0); last = t;
  ['C', 'R'].forEach(w => {
    const d = A.pl[w], g = U(S.p[w]), k = 1 - Math.exp(-dt * 14);
    d.x += (g.x - d.x) * k; d.y += (g.y - d.y) * k;
  });
  render(t);
}

if (window.ResizeObserver) new ResizeObserver(layout).observe(stage);
window.addEventListener('resize', layout);
layout();
newGame();
requestAnimationFrame(frame);
})();
