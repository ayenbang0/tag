(function () {
'use strict';
const T = Tag;
const $ = id => document.getElementById(id);
const cv = $('c'), cx = cv.getContext('2d');

const SZ = 34, SQ = Math.sqrt(3);
const pos = h => ({ x: SZ * SQ * (h.q + h.r / 2), y: SZ * 1.5 * h.r });
let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
T.cells.forEach(h => {
  const p = pos(h);
  minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x);
  miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y);
});
const W = Math.ceil(maxx - minx + 2 * SZ), H = Math.ceil(maxy - miny + 2 * SZ);
const OX = SZ - minx, OY = SZ - miny;
const dpr = window.devicePixelRatio || 1;
cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px';

const DESC = {
  Bomb: 'hidden 6-hex zone; freezes whoever walks in',
  Dash: '+2+str steps',
  Push: 'shoves str hexes along the arrow',
  Teleport: 'jump to another teleport, +str steps',
  Wall: 'blocks movement; str = durability',
  Grab: 'ends the move; next str moves are 1 step',
  Return: 'go to center; higher str = shorter cooldown',
};
const ACTS = [['move', 'move'], ['place', 'place'], ['type', 'type'], ['str', 'strength'], ['remove', 'remove']];

let S, human, ui, busy = false, hover = null;

function newGame() {
  human = Math.random() < 0.5 ? 'C' : 'R';
  S = T.newState();
  ui = { mode: null, type: 'Dash', pend: null };
  busy = false;
  next();
}

// ---------- flow ----------

function mine() { return S.turn === human && !busy && !S.over; }

function next() {
  draw();
  if (S.over) return;
  if (S.turn === human) {
    if (!Object.values(T.avail(S)).some(Boolean)) { T.pass(S); next(); }
    return;
  }
  if (!busy) { busy = true; draw(); setTimeout(botTurn, 600); }
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
    draw();
    setTimeout(run, 380);
  })();
}

function done() { ui.mode = null; ui.pend = null; next(); }

function setMode(m) {
  if (!mine() || (S.moving && m !== 'move')) return;
  if (m === 'remove') { if (T.removeLeft(S)) done(); return; }
  ui.mode = ui.mode === m ? null : m;
  ui.pend = null;
  draw();
}

function endMove() { if (mine() && S.moving) { T.stopMove(S); done(); } }

function cancel() {
  if (!mine() || S.moving) return;
  if (ui.mode === 'shape') ui.mode = ui.pend.retype != null ? 'type' : 'place';
  else ui.mode = null;
  ui.pend = null;
  draw();
}

function click(h) {
  if (!mine() || !h) return;
  const p = S.p[human], m = S.moving ? 'move' : ui.mode;
  if (m === 'move') {
    const d = T.DIRS.findIndex(v => p.q + v[0] === h.q && p.r + v[1] === h.r);
    if (d < 0) return;
    if (!S.moving && !T.beginMove(S)) return;
    if (T.step(S, d)) { if (S.turn !== human || S.over) done(); else draw(); }
  } else if (m === 'place') {
    if (!T.placeOk(S, ui.type, h.q, h.r)) return;
    if (ui.type === 'Bomb') { ui.pend = { q: h.q, r: h.r, shape: [[h.q, h.r]], retype: null }; ui.mode = 'shape'; draw(); }
    else if (T.place(S, ui.type, h.q, h.r)) done();
  } else if (m === 'type') {
    const rn = T.runeAt(S, h.q, h.r);
    if (!rn || rn.type === ui.type || T.dist(p, rn) > 1) return;
    if (ui.type === 'Bomb') {
      if (S.runes.some(x => x !== rn && x.type === 'Bomb' && x.owner === human)) return;
      ui.pend = { q: rn.q, r: rn.r, shape: [[rn.q, rn.r]], retype: rn.id }; ui.mode = 'shape'; draw();
    } else if (T.retype(S, rn.id, ui.type)) done();
  } else if (m === 'str') {
    const rn = T.runeAt(S, h.q, h.r);
    if (rn && T.bump(S, rn.id)) done();
  } else if (m === 'shape') {
    const pd = ui.pend;
    if (!T.cellMap[T.key(h.q, h.r)] || T.dist(h, pd) > 2 || (h.q === pd.q && h.r === pd.r)) return;
    const i = pd.shape.findIndex(v => v[0] === h.q && v[1] === h.r);
    if (i >= 0) pd.shape.splice(i, 1); else pd.shape.push([h.q, h.r]);
    if (pd.shape.length === 6) {
      const ok = pd.retype != null ? T.retype(S, pd.retype, 'Bomb', pd.shape) : T.place(S, 'Bomb', pd.q, pd.r, pd.shape);
      if (ok) { done(); return; }
    }
    draw();
  }
}

// ---------- input ----------

function hexAt(e) {
  const b = cv.getBoundingClientRect();
  const x = (e.clientX - b.left) * (W / b.width) - OX, y = (e.clientY - b.top) * (H / b.height) - OY;
  const fq = (SQ / 3 * x - y / 3) / SZ, fr = (2 / 3 * y) / SZ;
  let q = Math.round(fq), r = Math.round(fr), s = Math.round(-fq - fr);
  const dq = Math.abs(q - fq), dr = Math.abs(r - fr), ds = Math.abs(s + fq + fr);
  if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
  return T.cellMap[T.key(q, r)] || null;
}
cv.addEventListener('click', e => click(hexAt(e)));
cv.addEventListener('mousemove', e => { hover = hexAt(e); draw(); });
cv.addEventListener('mouseleave', () => { hover = null; draw(); });
document.addEventListener('keydown', e => {
  if (e.key >= '1' && e.key <= '5') setMode(ACTS[e.key - 1][0]);
  else if (e.key === 'Escape') cancel();
  else if (e.key === 'Enter' || e.key === ' ') { if (S.moving) { e.preventDefault(); endMove(); } }
});
$('new').onclick = newGame;

// ---------- panel ----------

const acts = $('acts'), pal = $('pal');
const actBtn = {}, palBtn = {};
ACTS.forEach(([id, label], i) => {
  const b = document.createElement('button');
  b.textContent = (i + 1) + ' ' + label;
  b.onclick = () => setMode(id);
  acts.appendChild(b); actBtn[id] = b;
});
const endBtn = document.createElement('button');
endBtn.textContent = 'end move';
endBtn.onclick = endMove;
acts.appendChild(endBtn);
T.TYPES.forEach(t => {
  const b = document.createElement('button');
  b.textContent = T.LETTER[t] + ' ' + t.toLowerCase();
  b.title = DESC[t];
  b.onclick = () => { ui.type = t; draw(); };
  pal.appendChild(b); palBtn[t] = b;
});

function hintText() {
  if (S.over) return '';
  if (S.turn !== human) return 'bot is playing...';
  if (S.moving) return 'click an adjacent hex to step (' + S.steps + ' left). enter or "end move" to stop.';
  const a = T.avail(S);
  switch (ui.mode) {
    case 'move': return 'click an adjacent hex.';
    case 'place': return 'pick a rune below, then click a highlighted hex (within 2).' + (ui.type === 'Bomb' ? ' bomb: you will then draw its zone.' : '');
    case 'shape': return 'draw the zone: click ' + (6 - ui.pend.shape.length) + ' more hex(es) within 2 of the bomb. esc to go back.';
    case 'type': return 'pick a rune below, then click a rune within 1 to convert it.';
    case 'str': return 'click a rune within 2 to bump its strength (1-3, wraps).';
    default:
      return 'choose an action (1-5).' + (a.move ? '' : ' move: ' + (S.noMove ? 'frozen.' : 'blocked.'));
  }
}

function panel() {
  const you = human === 'C' ? 'chaser (black disc)' : 'runner (white disc)';
  const R = S.p.R, C = S.p.C;
  const cor = R.v.map(v => (v ? 'x' : '.')).join('');
  const fl = p => (p.frozen ? ' frozen ' + p.frozen : '') + (p.grab ? ' grab ' + p.grab : '');
  let t = 'you: ' + you + '\n';
  if (S.over) {
    const w = S.over.w;
    t += (w === null ? 'tie' : w === human ? 'you win' : 'you lose') + ': ' + S.over.why + '\n';
  } else {
    t += 'turn ' + (S.n + 1) + ': ' + (S.turn === human ? 'you' : 'bot') + ' (' + T.name(S.turn) + ')\n';
  }
  t += 'corners [' + cor + ']\n';
  t += 'chaser' + (fl(C) || ' ok') + ' / runner' + (fl(R) || ' ok');
  $('stat').textContent = t;
  const can = mine(), a = can ? T.avail(S) : {};
  ACTS.forEach(([id]) => {
    actBtn[id].disabled = !can || (S.moving && id !== 'move') || (id !== 'move' && !a[id]) || (id === 'move' && !a.move && !S.moving);
    actBtn[id].className = (S.moving ? id === 'move' : ui.mode === id || (ui.mode === 'shape' && id === (ui.pend.retype != null ? 'type' : 'place'))) ? 'on' : '';
  });
  endBtn.disabled = !(can && S.moving);
  T.TYPES.forEach(t2 => { palBtn[t2].className = ui.type === t2 ? 'on' : ''; });
  $('hint').textContent = hintText();
  $('log').textContent = S.log.slice(-8).join('\n');
}

// ---------- board ----------

function hexPath(p, r) {
  cx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 180 * (60 * i + 30);
    const x = p.x + r * Math.cos(a), y = p.y + r * Math.sin(a);
    if (i) cx.lineTo(x, y); else cx.moveTo(x, y);
  }
  cx.closePath();
}

function highlights() {
  const hl = {};
  if (!mine()) return hl;
  const p = S.p[human], m = S.moving ? 'move' : ui.mode;
  const add = h => { hl[T.key(h.q, h.r)] = 1; };
  if (m === 'move') T.DIRS.forEach(d => { const q = p.q + d[0], r = p.r + d[1]; if (T.canEnter(S, human, q, r)) add({ q, r }); });
  else if (m === 'place') T.cells.filter(h => T.placeOk(S, ui.type, h.q, h.r)).forEach(add);
  else if (m === 'type') S.runes.filter(r => T.dist(p, r) <= 1 && r.type !== ui.type).forEach(add);
  else if (m === 'str') S.runes.filter(r => T.dist(p, r) <= 2).forEach(add);
  else if (m === 'shape') T.cells.filter(h => T.dist(h, ui.pend) <= 2).forEach(add);
  return hl;
}

function draw() {
  panel();
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx.clearRect(0, 0, W, H);
  cx.lineWidth = 1;
  const hl = highlights();
  const zone = {};
  S.runes.forEach(r => { if (r.type === 'Bomb' && r.owner === human) r.shape.forEach(h => { zone[T.key(h[0], h[1])] = 1; }); });
  const seen = {};
  if (S.flash && S.n - S.flash.n <= 1) S.flash.hexes.forEach(h => { seen[T.key(h[0], h[1])] = 1; });
  const draft = {};
  if (ui.pend) ui.pend.shape.forEach(h => { draft[T.key(h[0], h[1])] = 1; });

  T.cells.forEach(h => {
    const k = T.key(h.q, h.r), p = pos(h);
    p.x += OX; p.y += OY;
    hexPath(p, SZ - 1);
    cx.fillStyle = draft[k] ? '#bbb' : hl[k] ? '#e2e2e2' : seen[k] ? '#f1d4d0' : zone[k] ? '#f3ecec' : '#fff';
    cx.fill();
    cx.strokeStyle = '#888';
    cx.stroke();
    if (zone[k]) { cx.strokeStyle = '#b55'; cx.setLineDash([3, 3]); hexPath(p, SZ - 5); cx.stroke(); cx.setLineDash([]); }
    const ci = T.CORNERS.findIndex(c => c.q === h.q && c.r === h.r);
    if (ci >= 0) {
      cx.strokeStyle = '#111'; cx.fillStyle = S.p.R.v[ci] ? '#111' : '#fff';
      cx.beginPath(); cx.rect(p.x - 25, p.y - 25, 8, 8); cx.fill(); cx.stroke();
    } else if (h.q === T.CENTER.q && h.r === T.CENTER.r) {
      cx.strokeStyle = '#111'; cx.beginPath(); cx.arc(p.x, p.y, 6, 0, 7); cx.stroke();
    }
  });

  S.runes.forEach(r => {
    const p = pos(r); p.x += OX; p.y += OY;
    drawRune(r, p);
  });

  [['C', '#111', '#111'], ['R', '#fff', '#111']].forEach(([w, fill, line]) => {
    const pl = S.p[w], p = pos(pl); p.x += OX; p.y += OY;
    cx.fillStyle = fill; cx.strokeStyle = line; cx.lineWidth = 2;
    cx.beginPath(); cx.arc(p.x, p.y, SZ * 0.4, 0, 7); cx.fill(); cx.stroke();
    const a = Math.PI / 180 * (-60 * pl.f);
    cx.beginPath();
    cx.moveTo(p.x + Math.cos(a) * SZ * 0.5, p.y + Math.sin(a) * SZ * 0.5);
    cx.lineTo(p.x + Math.cos(a) * SZ * 0.78, p.y + Math.sin(a) * SZ * 0.78);
    cx.stroke();
    cx.lineWidth = 1;
  });

  if (mine() && !S.moving) {
    const l = T.leftHex(S), h = T.cellMap[T.key(l.q, l.r)];
    if (h) {
      const p = pos(h); p.x += OX; p.y += OY;
      cx.strokeStyle = '#111'; cx.setLineDash([2, 3]); hexPath(p, SZ - 4); cx.stroke(); cx.setLineDash([]);
    }
  }
  if (hover) {
    const p = pos(hover); p.x += OX; p.y += OY;
    cx.strokeStyle = '#111'; cx.lineWidth = 2; hexPath(p, SZ - 1); cx.stroke(); cx.lineWidth = 1;
  }
}

function drawRune(r, p) {
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  if (r.type === 'Wall') {
    cx.fillStyle = '#555'; hexPath(p, SZ - 6); cx.fill();
    cx.fillStyle = '#fff';
  } else {
    cx.fillStyle = r.cd > 0 ? '#aaa' : '#111';
  }
  cx.font = 'bold 16px ui-monospace, Menlo, Consolas, monospace';
  cx.fillText(T.LETTER[r.type], p.x, p.y - 3);
  for (let i = 0; i < r.str; i++) {
    cx.beginPath(); cx.arc(p.x - (r.str - 1) * 3 + i * 6, p.y + 12, 2, 0, 7); cx.fill();
  }
  if (r.cd > 0) {
    cx.font = '10px ui-monospace, Menlo, Consolas, monospace';
    cx.fillText(r.cd, p.x + 18, p.y - 14);
  }
  if (r.type === 'Push') {
    const a = Math.PI / 180 * (-60 * r.dir), ex = p.x + Math.cos(a) * 26, ey = p.y + Math.sin(a) * 26;
    cx.strokeStyle = cx.fillStyle; cx.lineWidth = 1.5;
    cx.beginPath(); cx.moveTo(p.x + Math.cos(a) * 14, p.y + Math.sin(a) * 14); cx.lineTo(ex, ey);
    cx.lineTo(ex - Math.cos(a - 0.6) * 6, ey - Math.sin(a - 0.6) * 6);
    cx.moveTo(ex, ey); cx.lineTo(ex - Math.cos(a + 0.6) * 6, ey - Math.sin(a + 0.6) * 6);
    cx.stroke(); cx.lineWidth = 1;
  }
}

newGame();
})();
