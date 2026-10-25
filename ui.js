// tag: pixel-art front end. everything is drawn at native low resolution on one canvas
// and scaled up by whole numbers, so edges stay hard.
(function () {
'use strict';
const T = Tag;
const TAU = Math.PI * 2;

// sweetie-16 palette
const PAL = {
  k: '#1a1c2c', p: '#5d275d', r: '#b13e53', o: '#ef7d57', y: '#ffcd75', l: '#a7f070', g: '#38b764', t: '#257179',
  n: '#29366f', b: '#3b5dc9', c: '#41a6f6', a: '#73eff7', w: '#f4f4f4', s: '#94b0c2', d: '#566c86', e: '#333c57',
};
const RC = { Bomb: PAL.o, Dash: PAL.y, Push: PAL.l, Teleport: PAL.a, Wall: PAL.s, Grab: PAL.r, Return: PAL.c };
const PC = { C: PAL.r, R: PAL.a };
const ZONE = '#9b5fc0', GOLD = PAL.y, ICE = PAL.a;

const SHORT = {
  Bomb: 'HIDDEN 6-HEX ZONE, FREEZES WHOEVER WALKS IN. ONE EACH',
  Dash: '+2 PLUS STRENGTH EXTRA STEPS',
  Push: 'SHOVES STRENGTH HEXES ALONG THE ARROW, NO TRIGGERS',
  Teleport: 'JUMP TO ANOTHER TELEPORT, + STRENGTH STEPS',
  Wall: 'BLOCKS MOVEMENT. STRENGTH = DURABILITY',
  Grab: 'ENDS YOUR MOVE. NEXT MOVES ARE 1 STEP',
  Return: 'GO TO THE CENTER. MORE STRENGTH = FASTER RECHARGE',
};
const ACT = {
  move: 'MOVE UP TO 2 STEPS', place: 'PLACE A RUNE WITHIN 2', type: 'CHANGE A RUNE TYPE WITHIN 1',
  str: 'RAISE A RUNE STRENGTH WITHIN 2', remove: 'REMOVE THE RUNE ON YOUR LEFT', end: 'END MOVE',
};
const ACOL = { move: PAL.l, place: PAL.y, type: ZONE, str: PAL.c, remove: PAL.r, end: PAL.s };

// ---------- bitmap font (5x7) ----------

const FONT = {};
('A:.###.|#...#|#...#|#####|#...#|#...#|#...#;B:####.|#...#|#...#|####.|#...#|#...#|####.;C:.####|#....|#....|#....|#....|#....|.####;' +
 'D:####.|#...#|#...#|#...#|#...#|#...#|####.;E:#####|#....|#....|####.|#....|#....|#####;F:#####|#....|#....|####.|#....|#....|#....;' +
 'G:.####|#....|#....|#.###|#...#|#...#|.###.;H:#...#|#...#|#...#|#####|#...#|#...#|#...#;I:#####|..#..|..#..|..#..|..#..|..#..|#####;' +
 'J:..###|...#.|...#.|...#.|...#.|#..#.|.##..;K:#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#;L:#....|#....|#....|#....|#....|#....|#####;' +
 'M:#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#;N:#...#|##..#|#.#.#|#..##|#...#|#...#|#...#;O:.###.|#...#|#...#|#...#|#...#|#...#|.###.;' +
 'P:####.|#...#|#...#|####.|#....|#....|#....;Q:.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#;R:####.|#...#|#...#|####.|#.#..|#..#.|#...#;' +
 'S:.####|#....|#....|.###.|....#|....#|####.;T:#####|..#..|..#..|..#..|..#..|..#..|..#..;U:#...#|#...#|#...#|#...#|#...#|#...#|.###.;' +
 'V:#...#|#...#|#...#|#...#|#...#|.#.#.|..#..;W:#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#;X:#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#;' +
 'Y:#...#|#...#|.#.#.|..#..|..#..|..#..|..#..;Z:#####|....#|...#.|..#..|.#...|#....|#####;' +
 '0:.###.|#...#|#..##|#.#.#|##..#|#...#|.###.;1:..#..|.##..|..#..|..#..|..#..|..#..|.###.;2:.###.|#...#|....#|...#.|..#..|.#...|#####;' +
 '3:.###.|#...#|....#|..##.|....#|#...#|.###.;4:...#.|..##.|.#.#.|#..#.|#####|...#.|...#.;5:#####|#....|####.|....#|....#|#...#|.###.;' +
 '6:..##.|.#...|#....|####.|#...#|#...#|.###.;7:#####|....#|...#.|..#..|.#...|.#...|.#...;8:.###.|#...#|#...#|.###.|#...#|#...#|.###.;' +
 '9:.###.|#...#|#...#|.####|....#|...#.|.##..;' +
 ':.....|..#..|..#..|.....|..#..|..#..|.....;.:.....|.....|.....|.....|.....|.##..|.##..;,:.....|.....|.....|.....|..##.|...#.|..#..;' +
 '!:..#..|..#..|..#..|..#..|..#..|.....|..#..;?:.###.|#...#|....#|...#.|..#..|.....|..#..;-:.....|.....|.....|#####|.....|.....|.....;' +
 '+:.....|..#..|..#..|#####|..#..|..#..|.....;/:....#|....#|...#.|..#..|.#...|#....|#....;(:...#.|..#..|.#...|.#...|.#...|..#..|...#.;' +
 '):.#...|..#..|...#.|...#.|...#.|..#..|.#...;>:#....|.#...|..#..|...#.|..#..|.#...|#....;<:....#|...#.|..#..|.#...|..#..|...#.|....#;' +
 '=:.....|.....|#####|.....|#####|.....|.....;%:#...#|#..#.|...#.|..#..|.#...|#..#.|#...#;#:.#.#.|#####|.#.#.|.#.#.|#####|.#.#.|.#.#.;' +
 '*:.....|#.#.#|.###.|#####|.###.|#.#.#|.....;\':..#..|..#..|.....|.....|.....|.....|.....;_:.....|.....|.....|.....|.....|.....|#####')
  .split(';').forEach(s => { if (s) FONT[s[0]] = s.slice(2).split('|'); });

const TINY = { 0: '###|#.#|#.#|#.#|###', 1: '.#.|##.|.#.|.#.|###', 2: '###|..#|###|#..|###', 3: '###|..#|###|..#|###', 4: '#.#|#.#|###|..#|..#',
  5: '###|#..|###|..#|###', 6: '###|#..|###|#.#|###', 7: '###|..#|..#|..#|..#', 8: '###|#.#|###|#.#|###', 9: '###|#.#|###|..#|###' };

function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').imageSmoothingEnabled = false; return c; }

const glyphCache = {};
function glyphImg(ch, col) {
  const k = ch + col;
  if (glyphCache[k]) return glyphCache[k];
  const rows = FONT[ch] || FONT['?'], c = mk(5, 7), x = c.getContext('2d');
  x.fillStyle = col;
  rows.forEach((row, y) => { for (let i = 0; i < 5; i++) if (row[i] === '#') x.fillRect(i, y, 1, 1); });
  return (glyphCache[k] = c);
}
function text(g, s, x, y, col, sc) {
  sc = sc || 1;
  for (const ch of String(s).toUpperCase()) {
    if (ch !== ' ') g.drawImage(glyphImg(ch, col), x, y, 5 * sc, 7 * sc);
    x += 6 * sc;
  }
}
const tw = (s, sc) => String(s).length * 6 * (sc || 1) - (sc || 1);
function wrap(s, n) {
  const out = []; let cur = '';
  String(s).toUpperCase().split(' ').forEach(w => {
    if ((cur + ' ' + w).trim().length > n) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  });
  if (cur) out.push(cur);
  return out;
}

// ---------- sprites ----------

function art(rows, outline) {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  const c = mk(w + 2, h + 2), x = c.getContext('2d');
  rows.forEach((row, y) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.') { x.fillStyle = PAL[row[i]]; x.fillRect(i + 1, y + 1, 1, 1); } });
  return outline ? outlined(c) : c;
}
function outlined(c) {
  const x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height;
  const solid = (i, j) => i >= 0 && j >= 0 && i < W && j < H && d[(j * W + i) * 4 + 3] > 0;
  x.fillStyle = PAL.k;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++)
    if (!solid(i, j) && (solid(i - 1, j) || solid(i + 1, j) || solid(i, j - 1) || solid(i, j + 1))) x.fillRect(i, j, 1, 1);
  return c;
}
function remap(c, fn) {
  const o = mk(c.width, c.height), x = o.getContext('2d'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  for (let j = 0; j < c.height; j++) for (let i = 0; i < c.width; i++) {
    const k = (j * c.width + i) * 4;
    if (d[k + 3] > 0) { const col = fn(d[k], d[k + 1], d[k + 2]); if (col) { x.fillStyle = col; x.fillRect(i, j, 1, 1); } }
  }
  return o;
}
const isDark = (r, g, b) => r + g + b < 120;
const gray = c => remap(c, (r, g, b) => (isDark(r, g, b) ? PAL.k : PAL.d));
const white = c => remap(c, () => PAL.w);

function fromFn(w, h, fn) {
  const c = mk(w, h), x = c.getContext('2d');
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const col = fn(i, j); if (col) { x.fillStyle = col; x.fillRect(i, j, 1, 1); } }
  return c;
}

const SP = { rune: {}, runeG: {}, runeW: {}, act: {}, push: [] };

SP.C = art([
  '.k........k.', '.kk......kk.', '.krk....krk.', '.krrkkkkrrk.', 'krrrrrrrrrrk', 'krwwrrrrwwrk',
  'krwkrrrrkwrk', 'krrrrrrrrrrk', 'krkkkkkkkkrk', '.krkwkkwkrk.', '.kkrrrrrrkk.', '..kkkkkkkk..']);
SP.R = art([
  '...kkkkkk...', '..kbbbbbbk..', '.kbbccccbbk.', '.kbccccccbk.', '.kbckcckcbk.', '.kbccccccbk.',
  '..kbbbbbbk..', '.kbbwwwwbbk.', '.kbbbbbbbbk.', '..kbbkkbbk..', '..kookkook..', '...kk..kk...']);

SP.rune.Bomb = art([
  '........y...', '.......yoy..', '.......ko...', '....kkkk....', '...kddddk...', '..kdwwddek..',
  '..kdwddddk..', '..kddddddk..', '..kddddddk..', '...kddddk...', '....kkkk....'], false);
SP.rune.Dash = art([
  '.......yyy..', '......yyy...', '.....yyy....', '....yyyyyy..', '...yyyyyy...', '......yyy...',
  '.....yyy....', '....yyy.....', '...yyy......', '..yy........'], true);
SP.rune.Teleport = outlined(fromFn(14, 14, (i, j) => {
  const d = Math.hypot(i + .5 - 7, j + .5 - 7);
  return d < 1.2 ? PAL.w : d < 2.6 ? PAL.a : d < 4.2 ? PAL.b : d < 6 ? PAL.a : null;
}));
SP.rune.Wall = outlined(fromFn(14, 11, (i, j) => {
  if (i < 1 || i > 12 || j < 1 || j > 9) return null;
  const x = i - 1, y = j - 1;
  if (y % 3 === 2) return PAL.d;
  if (((x + (Math.floor(y / 3) % 2) * 3) % 6) === 5) return PAL.d;
  return y % 3 === 0 ? PAL.w : PAL.s;
}));
SP.rune.Grab = art([
  '.rr.rr.rr...', '.rr.rr.rr...', '.rr.rr.rr...', '.rrrrrrrrr..', '.rrrrrrrrrr.', '.rrrrrrrrrr.',
  '..rrrrrrrr..', '...rrrrrr...', '....rrrr....'], true);
SP.rune.Return = art([
  '.....cc.....', '....cccc....', '...cccccc...', '..cccccccc..', '.cccccccccc.', '..wwwwwwww..',
  '..wwwbbwww..', '..wwwbbwww..', '..wwwbbwww..'], true);
for (let d = 0; d < 6; d++) {
  const a = -d * Math.PI / 3, c = mk(14, 14), x = c.getContext('2d');
  x.fillStyle = PAL.l;
  const dot = (px, py) => x.fillRect(Math.round(px) - 1, Math.round(py) - 1, 2, 2);
  for (let t = -5; t <= 4; t += .5) dot(7 + Math.cos(a) * t, 7 + Math.sin(a) * t);
  const tx = 7 + Math.cos(a) * 5.5, ty = 7 + Math.sin(a) * 5.5;
  for (const s of [-.65, .65]) for (let t = 0; t <= 3.5; t += .5) dot(tx + Math.cos(a + Math.PI + s) * t, ty + Math.sin(a + Math.PI + s) * t);
  SP.push.push(outlined(c));
}
T.TYPES.forEach(t => {
  if (t !== 'Push') { SP.runeG[t] = gray(SP.rune[t]); SP.runeW[t] = white(SP.rune[t]); }
});
SP.pushG = SP.push.map(gray); SP.pushW = SP.push.map(white);

SP.act.move = art(['......w.....', '......ww....', '......www...', '......wwww..', 'wwwwwwwwwww.', 'wwwwwwwwwwww', 'wwwwwwwwwww.', '......wwww..', '......www...', '......ww....', '......w.....']);
SP.act.place = art(['.....ww.....', '.....ww.....', '.....ww.....', '..wwwwwwww..', '..wwwwwwww..', '.....ww.....', '.....ww.....', '.....ww.....']);
SP.act.type = art(['.......w....', '.......ww...', '..wwwwwwww..', '.......ww...', '.......w....', '....w.......', '...ww.......', '..wwwwwwww..', '...ww.......', '....w.......']);
SP.act.str = fromFn(14, 14, (i, j) => {
  const x = i - 1, y = j - 1;
  if (y < 1 || y > 10) return null;
  const bars = [[1, 3], [5, 6], [9, 9]];
  for (const [bx, bh] of bars) if (x >= bx && x < bx + 2 && y > 10 - bh) return PAL.w;
  return null;
});
SP.act.remove = art(['.ww......ww.', '..ww....ww..', '...ww..ww...', '....wwww....', '.....ww.....', '....wwww....', '...ww..ww...', '..ww....ww..', '.ww......ww.']);
SP.act.end = fromFn(14, 14, (i, j) => (i >= 3 && i <= 10 && j >= 3 && j <= 10 ? PAL.w : null));
SP.flag = art(['.dyyyyyy....', '.dyyyyyyy...', '.dyyyyyyyy..', '.dyyyyyyy...', '.dyyyyyy....', '.d..........', '.d..........', '.d..........', '.d..........', '.d..........', 'ddd.........'], true);
SP.flagOff = remap(SP.flag, (r, g, b) => (isDark(r, g, b) ? PAL.k : r > 200 && g > 150 ? '#8a6d3b' : PAL.d));

// ---------- hex tiles ----------

const HW = 16, DY = 14, TH = 19;
const inHex = (px, py, a, R) => {
  const dx = Math.abs(px + .5 - 8), dy = Math.abs(py + .5 - 9.5);
  return dx <= a && dy + dx * (R / 2) / a <= R;
};
function hexSprite(fill, edge, dither) {
  return fromFn(HW, TH, (px, py) => {
    if (!inHex(px, py, 7, 8.2)) return null;
    const rim = !inHex(px, py, 6, 7.2);
    if (dither !== undefined && ((px + py + dither) & 1)) return null;
    return rim && edge ? edge : fill;
  });
}
const rng = n => { n = (n ^ 61) ^ (n >>> 16); n += n << 3; n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return n >>> 0; };
function stoneTile(v) {
  const c = hexSprite(PAL.e), x = c.getContext('2d');
  x.fillStyle = '#3d4766';
  for (let i = 0; i < 3; i++) {
    const r = rng(v * 17 + i * 31), px = 3 + (r % 10), py = 4 + ((r >> 5) % 11);
    if (inHex(px, py, 5.5, 6.5)) x.fillRect(px, py, 1, 1);
  }
  return c;
}
const TILE = [0, 1, 2, 3, 4, 5].map(stoneTile);
const TILE_CORNER = hexSprite('#4a3b32', PAL.d);
const hsCache = {};
const hs = (fill, edge, dither) => { const k = fill + edge + dither; return hsCache[k] || (hsCache[k] = hexSprite(fill, edge, dither)); };
const PLATE = {};
T.TYPES.forEach(t => { PLATE[t] = hexSprite(PAL.k, RC[t]); });
const PLATE_G = hexSprite(PAL.k, PAL.d);

// ---------- layout ----------

const BW = HW * T.COLS + HW / 2, BH = DY * (T.ROWS - 1) + TH;   // 328 x 285
const PANEL_W = 150;
const cv = document.getElementById('c'), scr = cv.getContext('2d');
const nat = mk(10, 10), g = nat.getContext('2d');
const L = { NW: 0, NH: 0, bx: 4, by: 6, px: 0, py: 0, land: true, cssScale: 1 };

function layout() {
  const dpr = window.devicePixelRatio || 1, wd = innerWidth * dpr, hd = innerHeight * dpr;
  const land = { NW: 4 + BW + 4 + PANEL_W + 4, NH: 6 + BH + 6 }, port = { NW: 4 + BW + 4, NH: 6 + BH + 4 + 112 + 4 };
  const fl = Math.min(wd / land.NW, hd / land.NH), fp = Math.min(wd / port.NW, hd / port.NH);
  const sl = Math.floor(fl), sp = Math.floor(fp);
  L.land = sl !== sp ? sl > sp : fl >= fp;
  const dim = L.land ? land : port;
  const sc = Math.max(1, L.land ? sl : sp);
  L.NW = dim.NW; L.NH = dim.NH;
  L.px = L.land ? 4 + BW + 4 : 4; L.py = L.land ? 6 : 6 + BH + 4;
  nat.width = L.NW; nat.height = L.NH; g.imageSmoothingEnabled = false;
  cv.width = L.NW * sc; cv.height = L.NH * sc; scr.imageSmoothingEnabled = false;
  const css = Math.min(sc / dpr, innerWidth / L.NW, innerHeight / L.NH);
  cv.style.width = Math.floor(L.NW * css) + 'px'; cv.style.height = Math.floor(L.NH * css) + 'px';
}

const hc = h => ({ x: HW * h.q + 8 * h.r + 8, y: DY * h.r + 9 });   // board-local center of a hex

function hexAt(nx, ny) {
  const lx = nx - L.bx, ly = ny - L.by;
  if (lx < 0 || ly < 0 || lx > BW || ly > BH) return null;
  const rf = (ly - 9) / DY, qf = (lx - 8) / HW - rf / 2, sf = -qf - rf;
  let q = Math.round(qf), r = Math.round(rf), s = Math.round(sf);
  const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
  return T.cellMap[T.key(q, r)] || null;
}

// ---------- state & effects ----------

let S, human, ui, busy = false;
const M = { x: -1, y: -1 };
const A = { pl: {}, known: {}, pops: {}, ghosts: [], rip: [], parts: [], prevHex: {}, prevV: [0, 0, 0, 0], flash: null };
const now = () => performance.now();

function newGame() {
  human = Math.random() < 0.5 ? 'C' : 'R';
  S = T.newState();
  ui = { mode: null, type: 'Dash', pend: null, menu: null, pick: null, menuT: 0, help: false, tip: '' };
  busy = false;
  A.known = {}; A.pops = {}; A.ghosts = []; A.rip = []; A.parts = []; A.flash = null; A.prevV = [0, 0, 0, 0];
  ['C', 'R'].forEach(w => { const c = hc(S.p[w]); A.pl[w] = { x: c.x, y: c.y }; A.prevHex[w] = { q: S.p[w].q, r: S.p[w].r }; });
  next();
}

const mine = () => S.turn === human && !busy && !S.over;
const ripple = (h, col, max, dur) => { const c = hc(h); A.rip.push({ x: c.x, y: c.y, col, max: max || 20, dur: dur || 600, t: now() }); };
function burst(h, cols, n, sp, life) {
  const c = hc(h), t = now();
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, v = (.3 + Math.random()) * sp;
    A.parts.push({ x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t, life: life * (.6 + Math.random() * .6), col: cols[i % cols.length] });
  }
}

function sync() {
  const t = now(), ids = {};
  S.runes.forEach(r => { ids[r.id] = r; });
  Object.keys(A.known).forEach(id => {
    if (!ids[id]) {
      const k = A.known[id];
      A.ghosts.push({ r: k, t });
      if (k.type === 'Bomb') { ripple(k, PAL.o, 38, 700); burst(k, [PAL.o, PAL.y, PAL.r, PAL.w], 16, 70, 600); }
      delete A.known[id];
    }
  });
  S.runes.forEach(r => {
    const k = A.known[r.id];
    if (!k) A.pops[r.id] = t;
    else if (r.cd > k.cd) ripple(r, RC[r.type], 22, 500);
    A.known[r.id] = { id: r.id, type: r.type, q: r.q, r: r.r, str: r.str, dir: r.dir, cd: r.cd };
  });
  ['C', 'R'].forEach(w => {
    const p = S.p[w], pv = A.prevHex[w], d = T.dist(pv, p);
    if (d >= 3) { ripple(pv, PC[w], 20, 500); ripple(p, PC[w], 26, 600); burst(pv, [PC[w], PAL.w], 8, 50, 400); burst(p, [PC[w], PAL.w], 8, 50, 400); }
    else if (d > 0) burst(pv, [PAL.d, PAL.s], 3, 22, 350);
    A.prevHex[w] = { q: p.q, r: p.r };
  });
  S.p.R.v.forEach((v, i) => { if (v && !A.prevV[i]) { ripple(T.CORNERS[i], GOLD, 34, 900); burst(T.CORNERS[i], [PAL.y, PAL.w, PAL.o], 14, 60, 800); } A.prevV[i] = v; });
  if (S.flash && S.flash !== A.flash) A.flash = S.flash;
}

function next() {
  sync();
  if (S.over) return;
  if (S.turn === human) {
    if (!Object.values(T.avail(S)).some(Boolean)) { T.pass(S); next(); }
    return;
  }
  if (!busy) { busy = true; setTimeout(botTurn, 550); }
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
    setTimeout(run, 300);
  })();
}

function done() { ui.mode = null; ui.pend = null; ui.menu = null; next(); }
function endMove() { if (mine() && S.moving) { T.stopMove(S); done(); } }
function cancel() {
  if (ui.help) { ui.help = false; return; }
  if (!mine() || S.moving) return;
  if (ui.mode === 'shape') ui.mode = ui.pend.retype != null ? 'type' : 'place'; else ui.mode = null;
  ui.pend = null; ui.menu = null;
}

function boardClick(h) {
  const p = S.p[human], m = S.moving ? 'move' : ui.mode;
  if (m === 'move') {
    const d = T.DIRS.findIndex(v => p.q + v[0] === h.q && p.r + v[1] === h.r);
    if (d < 0) return;
    if (!S.moving && !T.beginMove(S)) return;
    if (T.step(S, d)) { if (S.turn !== human || S.over) done(); else sync(); }
  } else if (m === 'place') {
    if (!T.placeOk(S, ui.type, h.q, h.r)) return;
    if (ui.type === 'Bomb') { ui.pend = { q: h.q, r: h.r, shape: [[h.q, h.r]], retype: null }; ui.mode = 'shape'; }
    else if (T.place(S, ui.type, h.q, h.r)) done();
  } else if (m === 'type') {
    const rn = T.runeAt(S, h.q, h.r);
    if (!rn || rn.type === ui.type || T.dist(p, rn) > 1) return;
    if (ui.type === 'Bomb') {
      if (S.runes.some(x => x !== rn && x.type === 'Bomb' && x.owner === human)) return;
      ui.pend = { q: rn.q, r: rn.r, shape: [[rn.q, rn.r]], retype: rn.id }; ui.mode = 'shape';
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
      if (ok) done();
    }
  }
}

// ---------- action ring ----------

function menuItems() {
  const a = T.avail(S);
  if (ui.menu === 'moving') return [{ id: 'end', tip: ACT.end, ok: true, kind: 'act' }];
  if (ui.menu === 'rune') {
    const placing = ui.pick === 'place', hasBomb = S.runes.some(x => x.type === 'Bomb' && x.owner === human);
    return T.TYPES.map(t => ({ id: t, tip: t + ': ' + SHORT[t], kind: 'rune', ok: !(t === 'Bomb' && hasBomb) && (!placing || T.placeTargets(S, t).length > 0) }));
  }
  return ['move', 'place', 'type', 'str', 'remove'].map(id => ({ id, tip: ACT[id], ok: !!a[id], kind: 'act' }));
}

function onMenu(id) {
  if (!mine()) return;
  if (id === 'end') { endMove(); return; }
  if (id === 'remove') { ui.menu = null; if (T.removeLeft(S)) done(); return; }
  if (id === 'place' || id === 'type') { ui.menu = 'rune'; ui.pick = id; ui.menuT = now(); return; }
  if (T.TYPES.includes(id)) { ui.type = id; ui.mode = ui.pick; ui.menu = null; return; }
  ui.mode = id; ui.menu = null;
}

function openMenu() {
  if (ui.menu) { ui.menu = null; return; }
  ui.mode = null; ui.pend = null; ui.menu = S.moving ? 'moving' : 'main'; ui.menuT = now();
}

// ---------- input ----------

const buttons = [];
function toNative(e) {
  const b = cv.getBoundingClientRect();
  return { x: (e.clientX - b.left) / b.width * L.NW, y: (e.clientY - b.top) / b.height * L.NH };
}
cv.addEventListener('mousemove', e => { const p = toNative(e); M.x = p.x; M.y = p.y; });
cv.addEventListener('mouseleave', () => { M.x = M.y = -1; });
cv.addEventListener('click', e => {
  const p = toNative(e);
  for (let i = buttons.length - 1; i >= 0; i--) {
    const b = buttons[i];
    if (p.x >= b.x && p.y >= b.y && p.x < b.x + b.w && p.y < b.y + b.h) { if (b.fn) b.fn(); return; }
  }
  if (ui.help) { ui.help = false; return; }
  const h = hexAt(p.x, p.y);
  if (!h || !mine()) return;
  const me = S.p[human];
  if (h.q === me.q && h.r === me.r && ui.mode !== 'shape') { openMenu(); return; }
  if (ui.menu) { ui.menu = null; return; }
  boardClick(h);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') cancel();
  else if ((e.key === 'Enter' || e.key === ' ') && S.moving) { e.preventDefault(); endMove(); }
});

// ---------- drawing helpers ----------

const px1 = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
const img = (c, x, y) => g.drawImage(c, Math.round(x), Math.round(y));
function ring(cx, cy, r, col, dash, phase) {
  g.fillStyle = col;
  const n = Math.max(12, Math.round(r * 7));
  for (let i = 0; i < n; i++) {
    if (dash && (((i >> 1) + phase) & 1)) continue;
    const a = i / n * TAU;
    g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
  }
}
const tilePos = h => ({ x: L.bx + HW * h.q + 8 * h.r, y: L.by + DY * h.r });
const ctr = h => { const c = hc(h); return { x: L.bx + c.x, y: L.by + c.y }; };
const flicker = (age, ms) => age < ms && (Math.floor(age / 60) % 2 === 0);

function button(label, x, y, w, h, fn, tip) {
  const hot = M.x >= x && M.y >= y && M.x < x + w && M.y < y + h;
  px1(x, y, w, h, PAL.k);
  px1(x, y, w, 1, hot ? PAL.w : PAL.d); px1(x, y + h - 1, w, 1, hot ? PAL.w : PAL.d);
  px1(x, y, 1, h, hot ? PAL.w : PAL.d); px1(x + w - 1, y, 1, h, hot ? PAL.w : PAL.d);
  text(g, label, x + Math.floor((w - tw(label)) / 2), y + 4, hot ? PAL.w : PAL.s);
  buttons.push({ x, y, w, h, fn, tip });
  if (hot && tip) ui.tip = tip;
}

// ---------- scene ----------

function highlightCells() {
  const hl = {};
  if (!mine() || ui.menu) return hl;
  const p = S.p[human], m = S.moving ? 'move' : ui.mode;
  const add = h => { hl[T.key(h.q, h.r)] = h; };
  if (m === 'move') T.DIRS.forEach(d => { const q = p.q + d[0], r = p.r + d[1]; if (T.canEnter(S, human, q, r)) add(T.cellMap[T.key(q, r)]); });
  else if (m === 'place') T.cells.filter(h => T.placeOk(S, ui.type, h.q, h.r)).forEach(add);
  else if (m === 'type') S.runes.filter(r => T.dist(p, r) <= 1 && r.type !== ui.type).forEach(add);
  else if (m === 'str') S.runes.filter(r => T.dist(p, r) <= 2).forEach(add);
  else if (m === 'shape') T.cells.filter(h => T.dist(h, ui.pend) <= 2).forEach(add);
  return hl;
}
function modeColor() {
  const m = S.moving ? 'move' : ui.mode;
  return m === 'place' || m === 'type' ? RC[ui.type] : m === 'shape' ? ZONE : ACOL[m] || PAL.l;
}

function drawRune(r, p, alpha, white) {
  const cool = r.cd > 0;
  img(cool ? PLATE_G : PLATE[r.type], p.x - 8, p.y - 9);
  const icon = r.type === 'Push' ? (white ? SP.pushW[r.dir] : cool ? SP.pushG[r.dir] : SP.push[r.dir])
    : (white ? SP.runeW[r.type] : cool ? SP.runeG[r.type] : SP.rune[r.type]);
  img(icon, p.x - 7, p.y - 8);
  const col = cool ? PAL.d : RC[r.type], n = r.str, wd = 3 * n - 1, x0 = p.x - Math.floor(wd / 2);
  for (let i = 0; i < n; i++) px1(x0 + i * 3, p.y + 6, 2, 2, col);
  if (cool) {
    const rows = TINY[Math.min(9, r.cd)].split('|');
    rows.forEach((row, y) => { for (let i = 0; i < 3; i++) if (row[i] === '#') px1(p.x + 3 + i, p.y - 7 + y, 1, 1, PAL.w); });
  }
  if (r.type === 'Bomb' && r.owner === human) { px1(p.x - 7, p.y - 6, 2, 2, ZONE); }
}

function scene(t) {
  const phase = Math.floor(t / 350) & 1, pulse = Math.floor(t / 250) % 4;
  buttons.length = 0;
  ui.tip = '';

  // tiles
  T.cells.forEach(h => {
    const tp = tilePos(h);
    const corner = T.CORNERS.some(c => c.q === h.q && c.r === h.r);
    img(corner ? TILE_CORNER : TILE[rng(h.q * 73 + h.r * 19 + 7) % 6], tp.x, tp.y);
  });
  const ce = ctr(T.CENTER);
  [[0, 0], [0, -3], [0, 3], [-3, 0], [3, 0]].forEach(o => px1(ce.x + o[0], ce.y + o[1], 1, 1, PAL.s));

  // zones
  S.runes.forEach(r => {
    if (r.type !== 'Bomb' || r.owner !== human) return;
    r.shape.forEach(h => {
      const tp = tilePos({ q: h[0], r: h[1] });
      img(hs(ZONE, null, phase), tp.x, tp.y); img(hs(null, ZONE), tp.x, tp.y);
    });
  });
  if (ui.pend) ui.pend.shape.forEach(h => { const tp = tilePos({ q: h[0], r: h[1] }); img(hs(ZONE, ZONE), tp.x, tp.y); });
  if (A.flash && S.flash === A.flash && S.n - A.flash.n <= 1) A.flash.hexes.forEach(h => {
    const tp = tilePos({ q: h[0], r: h[1] });
    img(hs(PAL.r, PAL.o, (pulse & 1)), tp.x, tp.y);
  });

  // action highlights
  const hl = highlightCells(), mc = modeColor();
  Object.keys(hl).forEach(k => {
    const tp = tilePos(hl[k]);
    img(hs(mc, null, phase), tp.x, tp.y); img(hs(null, mc), tp.x, tp.y);
  });

  // flags
  T.CORNERS.forEach((h, i) => {
    const c = ctr(h), on = S.p.R.v[i];
    img(on ? SP.flag : SP.flagOff, c.x - 7, c.y - 8 + (on ? (Math.floor(t / 300) & 1) : 0));
  });

  // runes
  S.runes.forEach(r => {
    const c = ctr(r), age = t - (A.pops[r.id] || 0);
    drawRune(r, c, 1, flicker(age, 240));
  });
  A.ghosts = A.ghosts.filter(gh => t - gh.t < 300);
  A.ghosts.forEach(gh => { if (flicker(t - gh.t, 300)) { const c = ctr(gh.r); drawRune(gh.r, c, 1, true); } });

  // removable rune marker
  if (mine() && !S.moving && !ui.menu) {
    const l = T.leftHex(S), rn = T.runeAt(S, l.q, l.r);
    if (rn) { const tp = tilePos(l); img(hs(null, PAL.r), tp.x, tp.y); if (phase) img(hs(PAL.r, null, 0), tp.x, tp.y); }
  }
  // hover outline
  const hv = hexAt(M.x, M.y);
  if (hv && mine()) { const tp = tilePos(hv); img(hs(null, PAL.w), tp.x, tp.y); }

  // ripples
  A.rip = A.rip.filter(r => t - r.t < r.dur);
  A.rip.forEach(r => {
    const a = (t - r.t) / r.dur, rad = Math.max(2, Math.floor(a * r.max / 2) * 2);
    ring(L.bx + r.x, L.by + r.y, rad, r.col, a > .55, 0);
    if (rad > 4) ring(L.bx + r.x, L.by + r.y, rad - 2, r.col, true, 1);
  });

  // pieces
  ['C', 'R'].map(w => w).sort((a, b) => A.pl[a].y - A.pl[b].y).forEach(w => {
    const d = A.pl[w], pl = S.p[w], x = L.bx + d.x, y = L.by + d.y;
    const bob = S.turn === w && !S.over && (Math.floor(t / 380) & 1) ? 1 : 0;
    px1(x - 5, y + 4, 10, 2, '#14151f');
    if (pl.frozen || (S.turn === w && S.noMove)) {
      ring(x, y - 1, 10, ICE, true, Math.floor(t / 120));
      ring(x, y - 1, 9, ICE, true, Math.floor(t / 120) + 1);
    }
    if (pl.grab) ring(x, y - 1, 12, PAL.r, true, Math.floor(t / 90));
    img(SP[w], x - 7, y - 9 - bob);
    const a = -pl.f * Math.PI / 3, fx = x + Math.cos(a) * 9, fy = y - 1 + Math.sin(a) * 8.5;
    px1(fx - 2, fy - 2, 4, 4, PAL.k); px1(fx - 1, fy - 1, 2, 2, PC[w]);
  });
  if (mine() && !ui.menu && !ui.mode && !S.moving) {
    const d = A.pl[human];
    ring(L.bx + d.x, L.by + d.y - 1, 13, PAL.w, true, Math.floor(t / 150));
  }

  // particles
  A.parts = A.parts.filter(p => t - p.t < p.life);
  A.parts.forEach(p => {
    const a = (t - p.t) / 1000, k = (t - p.t) / p.life;
    px1(L.bx + p.x + p.vx * a, L.by + p.y + p.vy * a + 14 * a * a, k > .6 ? 1 : 2, k > .6 ? 1 : 2, p.col);
  });

  // action ring
  if (ui.menu && mine()) drawMenu(t);
}

const actCache = {};
const actIcon = (id, col) => actCache[id + col] || (actCache[id + col] = remap(SP.act[id], () => col));

function drawMenu(t) {
  const items = menuItems(), d = A.pl[human], R = items.length >= 7 ? 33 : 27;
  const cx = Math.min(Math.max(L.bx + d.x, L.bx + R + 12), L.bx + BW - R - 12), cy = Math.min(Math.max(L.by + d.y, L.by + R + 12), L.by + BH - R - 12);
  const k = Math.min(1, (t - ui.menuT) / 180), kk = Math.floor(k * 4) / 4;
  ring(cx, cy, R * kk, PAL.d, true, 0);
  items.forEach((it, i) => {
    const a = -Math.PI / 2 + i * TAU / items.length;
    const x = Math.round(cx + (items.length === 1 ? 0 : Math.cos(a) * R) * kk), y = Math.round(cy + (items.length === 1 ? -R : Math.sin(a) * R) * kk);
    const hot = M.x >= x - 9 && M.x < x + 9 && M.y >= y - 9 && M.y < y + 9;
    const col = !it.ok ? PAL.d : it.kind === 'rune' ? RC[it.id] : ACOL[it.id];
    px1(x - 9, y - 9, 18, 18, col);
    px1(x - 8, y - 8, 16, 16, hot && it.ok ? PAL.e : PAL.k);
    if (it.kind === 'rune') {
      const ic = it.id === 'Push' ? SP.push[0] : SP.rune[it.id];
      img(it.ok ? ic : (it.id === 'Push' ? SP.pushG[0] : SP.runeG[it.id]), x - 7, y - 7);
    } else {
      img(actIcon(it.id, it.ok ? col : PAL.d), x - 7, y - 7);
    }
    if (hot) ui.tip = it.tip;
    buttons.push({ x: x - 9, y: y - 9, w: 18, h: 18, fn: it.ok ? () => onMenu(it.id) : null });
  });
}

// ---------- panel ----------

function hintText() {
  if (S.over) return 'GAME OVER';
  if (S.turn !== human || busy) return 'BOT IS THINKING...';
  if (S.moving) return 'CLICK A NEIGHBOURING HEX (' + S.steps + ' STEP' + (S.steps === 1 ? '' : 'S') + ' LEFT). CLICK YOUR PIECE TO END THE MOVE.';
  switch (ui.mode) {
    case 'move': return 'CLICK A HIGHLIGHTED NEIGHBOUR TO STEP.';
    case 'place': return 'PLACE ' + ui.type + ': CLICK A HIGHLIGHTED HEX.' + (ui.type === 'Bomb' ? ' THEN DRAW ITS ZONE.' : '');
    case 'shape': return 'DRAW THE ZONE: ' + (6 - ui.pend.shape.length) + ' MORE HEX(ES) WITHIN 2 OF THE BOMB. ESC TO GO BACK.';
    case 'type': return 'CONVERT TO ' + ui.type + ': CLICK A HIGHLIGHTED RUNE.';
    case 'str': return 'CLICK A HIGHLIGHTED RUNE TO RAISE ITS STRENGTH.';
    default: return 'YOUR TURN. CLICK YOUR PIECE TO PICK AN ACTION.' + (S.noMove ? ' (FROZEN: NO MOVING)' : '');
  }
}

function panelA(x, y, w) {
  text(g, 'TAG', x, y, PAL.w, 3);
  button('NEW GAME', x + w - 62, y, 62, 14, newGame);
  button('HELP', x + w - 62, y + 17, 62, 14, () => { ui.help = !ui.help; });
  y += 36;
  img(SP[human], x, y - 1);
  text(g, 'YOU: ' + T.name(human), x + 18, y + 3, PC[human]);
  y += 18;
  text(g, S.over ? 'GAME OVER' : 'TURN ' + (S.n + 1) + ' - ' + (S.turn === human ? 'YOURS' : 'BOT'), x, y, PAL.s);
  y += 12;
  text(g, 'FLAGS', x, y + 2, PAL.s);
  S.p.R.v.forEach((v, i) => img(v ? SP.flag : SP.flagOff, x + 40 + i * 15, y - 2));
  y += 15;
  const fl = p => [p.frozen ? 'FROZEN ' + p.frozen : '', p.grab ? 'GRAB ' + p.grab : ''].filter(Boolean).join(' ') || 'OK';
  text(g, 'CHASER ' + fl(S.p.C), x, y, S.p.C.frozen || S.p.C.grab ? ICE : PAL.s);
  text(g, 'RUNNER ' + fl(S.p.R), x, y + 10, S.p.R.frozen || S.p.R.grab ? ICE : PAL.s);
  return y + 24;
}

function panelB(x, y, w, h) {
  const n = Math.floor(w / 6);
  const lines = wrap(ui.tip || hintText(), n);
  lines.slice(0, 4).forEach((l, i) => text(g, l, x, y + i * 10, ui.tip ? PAL.w : PAL.y));
  y += 44;
  px1(x, y - 4, w, 1, PAL.d);
  const rows = Math.floor((h - 46) / 10);
  S.log.slice(-rows).forEach((l, i, a) => {
    const col = l.startsWith('chaser') ? PAL.r : l.startsWith('runner') ? PAL.a : PAL.d;
    px1(x, y + i * 10 + 2, 3, 3, col);
    text(g, l.slice(0, n - 2), x + 6, y + i * 10, i === a.length - 1 ? PAL.w : PAL.s);
  });
}

const HELP = [
  'CHASER: STEP ON THE RUNNER TO WIN.',
  'RUNNER: TOUCH ALL 4 CORNER FLAGS TO WIN.',
  'TIE: SAME POSITION 3X, NO ACTIONS, 400 TURNS.',
  'ONE ACTION PER TURN. CLICK YOUR PIECE:',
  ' MOVE    UP TO 2 STEPS (FACING = LAST STEP)',
  ' PLACE   A RUNE WITHIN 2',
  ' TYPE    CHANGE A RUNE WITHIN 1',
  ' STR     RAISE A RUNE (1-3) WITHIN 2',
  ' REMOVE  THE RUNE ON YOUR LEFT (RED EDGE)',
  'NO RUNES ON CORNERS, CENTER OR PLAYERS.',
  'RUNES HIT BOTH PLAYERS. FROZEN = NO MOVING.',
];
const HELPD = {
  Bomb: 'HIDDEN 6-HEX ZONE. FREEZES WHOEVER WALKS IN',
  Dash: '+2 PLUS STRENGTH EXTRA STEPS',
  Push: 'SHOVES YOU ALONG THE ARROW, NO TRIGGERS',
  Teleport: 'JUMP TO ANOTHER ONE, + STRENGTH STEPS',
  Wall: 'BLOCKS MOVEMENT. STRENGTH = DURABILITY',
  Grab: 'ENDS YOUR MOVE. NEXT MOVES = 1 STEP',
  Return: 'GO TO CENTER. MORE STRENGTH = FASTER RECHARGE',
};
function drawHelp() {
  const x = L.bx + 6, y = L.by + 6, w = BW - 12, h = BH - 12;
  px1(x, y, w, h, PAL.d); px1(x + 1, y + 1, w - 2, h - 2, PAL.k);
  HELP.forEach((l, i) => text(g, l, x + 8, y + 8 + i * 9, i < 3 ? PAL.y : PAL.s));
  let yy = y + 8 + HELP.length * 9 + 5;
  T.TYPES.forEach(t => {
    img(t === 'Push' ? SP.push[0] : SP.rune[t], x + 6, yy - 4);
    text(g, t, x + 24, yy, RC[t]);
    const ls = wrap(HELPD[t], 36);
    ls.forEach((l, i) => text(g, l, x + 80, yy + i * 9, PAL.s));
    yy += Math.max(ls.length * 9, 12) + 3;
  });
  text(g, 'CLICK ANYWHERE TO CLOSE', x + 8, y + h - 12, PAL.d);
}

function drawOver() {
  const w = S.over.w, win = w === human, col = w === null ? PAL.s : win ? PAL.l : PAL.r;
  const bw = 210, bh = 74, x = L.bx + Math.floor((BW - bw) / 2), y = L.by + Math.floor((BH - bh) / 2);
  px1(x, y, bw, bh, col); px1(x + 2, y + 2, bw - 4, bh - 4, PAL.k);
  const t = w === null ? 'TIE' : win ? 'YOU WIN' : 'YOU LOSE';
  text(g, t, x + Math.floor((bw - tw(t, 3)) / 2), y + 10, col, 3);
  const why = S.over.why.toUpperCase();
  text(g, why, x + Math.floor((bw - tw(why)) / 2), y + 36, PAL.s);
  button('PLAY AGAIN', x + Math.floor((bw - 72) / 2), y + 50, 72, 16, newGame);
}

// ---------- loop ----------

let last = 0;
function frame(t) {
  requestAnimationFrame(frame);
  if (!S) return;
  const dt = Math.min(.05, (t - last) / 1000 || 0); last = t;
  ['C', 'R'].forEach(w => {
    const d = A.pl[w], c = hc(S.p[w]), k = 1 - Math.exp(-dt * 16);
    d.x += (c.x - d.x) * k; d.y += (c.y - d.y) * k;
    if (Math.abs(c.x - d.x) < .4) d.x = c.x;
    if (Math.abs(c.y - d.y) < .4) d.y = c.y;
  });
  g.fillStyle = PAL.k; g.fillRect(0, 0, L.NW, L.NH);
  scene(t);
  if (ui.help) drawHelp();
  if (S.over) drawOver();
  if (L.land) { const e = panelA(L.px, L.py, PANEL_W); panelB(L.px, e + 4, PANEL_W, L.NH - e - 10); }
  else { const e = panelA(L.px, L.py, 160); panelB(L.px + 170, L.py, BW - 170, 112); }
  scr.drawImage(nat, 0, 0, cv.width, cv.height);
}

window.addEventListener('resize', layout);
layout();
newGame();
requestAnimationFrame(frame);
})();
