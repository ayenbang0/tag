// tag: pixel-art front end + online play. everything is drawn at native low resolution
// on one canvas and scaled up by whole numbers, so edges stay hard.
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
const ZONE = '#9b5fc0', ICE = PAL.a;

const SHORT = {
  Bomb: 'HIDDEN 6-HEX ZONE, FREEZES WHOEVER WALKS IN. ONE EACH',
  Dash: '+2 PLUS STRENGTH EXTRA STEPS',
  Push: 'SHOVES YOU ALONG ITS ARROW. YOU PICK THE DIRECTION',
  Teleport: 'JUMP TO ANOTHER TELEPORT, + STRENGTH STEPS',
  Wall: 'BLOCKS MOVEMENT. UP TO 3 PER PLACEMENT. NEVER SEALS A BEACON',
  Grab: 'PLACE 4+ HEXES AWAY. STEPPING ON IT SLOWS THE OTHER PLAYER',
  Return: 'GO TO THE CENTER. MORE STRENGTH = FASTER RECHARGE',
};
const ACT = {
  move: 'MOVE UP TO 2 STEPS', place: 'PLACE A RUNE WITHIN 2', type: 'CHANGE A RUNE TYPE WITHIN 1',
  str: 'UPGRADE A RUNE WITHIN 2 (MAX 3 TIMES)', remove: 'REMOVE THE RUNE ON YOUR LEFT', end: 'END MOVE',
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
 '*:.....|#.#.#|.###.|#####|.###.|#.#.#|.....;\':..#..|..#..|.....|.....|.....|.....|.....;_:.....|.....|.....|.....|.....|.....|#####;' +
 '[:.###.|.#...|.#...|.#...|.#...|.#...|.###.;]:.###.|...#.|...#.|...#.|...#.|...#.|.###.')
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
T.TYPES.forEach(t => { if (t !== 'Push') { SP.runeG[t] = gray(SP.rune[t]); SP.runeW[t] = white(SP.rune[t]); } });
SP.pushG = SP.push.map(gray); SP.pushW = SP.push.map(white);

SP.act.move = art(['......w.....', '......ww....', '......www...', '......wwww..', 'wwwwwwwwwww.', 'wwwwwwwwwwww', 'wwwwwwwwwww.', '......wwww..', '......www...', '......ww....', '......w.....']);
SP.act.place = art(['.....ww.....', '.....ww.....', '.....ww.....', '..wwwwwwww..', '..wwwwwwww..', '.....ww.....', '.....ww.....', '.....ww.....']);
SP.act.type = art(['.......w....', '.......ww...', '..wwwwwwww..', '.......ww...', '.......w....', '....w.......', '...ww.......', '..wwwwwwww..', '...ww.......', '....w.......']);
SP.act.str = art(['.....ww.....', '....wwww....', '...wwwwww...', '..wwwwwwww..', '.....ww.....', '.....ww.....', '.....ww.....', '.....ww.....', '..wwwwwwww..']);
SP.act.remove = art(['.ww......ww.', '..ww....ww..', '...ww..ww...', '....wwww....', '.....ww.....', '....wwww....', '...ww..ww...', '..ww....ww..', '.ww......ww.']);
SP.act.end = fromFn(14, 14, (i, j) => (i >= 3 && i <= 10 && j >= 3 && j <= 10 ? PAL.w : null));
SP.beacon = art([
  '.....yy.....', '....yyyy....', '...yywwyy...', '..yywwyyyy..', '...yyyyyy...', '....yyyy....',
  '.....yy.....', '....dddd....', '...dddddd...', '..dddddddd..'], true);
SP.beaconOff = remap(SP.beacon, (r, g, b) => (isDark(r, g, b) ? PAL.k : r > 200 && g > 150 ? '#8a6d3b' : PAL.d));

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
const TILE_BEACON = hexSprite('#4a3b32', PAL.d);
const hsCache = {};
const hs = (fill, edge, dither) => { const k = fill + edge + dither; return hsCache[k] || (hsCache[k] = hexSprite(fill, edge, dither)); };

// rune plate: the rim thickens with each upgrade (0-3)
function plateSprite(color, lv) {
  return fromFn(HW, TH, (px, py) => {
    if (!inHex(px, py, 7, 8.2)) return null;
    if (!inHex(px, py, 6, 7.2)) return color;
    if (lv >= 2 && !inHex(px, py, 5, 6.2)) return lv >= 3 ? color : (((px + py) & 1) ? color : PAL.k);
    return PAL.k;
  });
}
const PLATE = {}, PLATE_G = [];
T.TYPES.forEach(t => { PLATE[t] = [0, 1, 2, 3].map(lv => plateSprite(RC[t], lv)); });
[0, 1, 2, 3].forEach(lv => { PLATE_G[lv] = plateSprite(PAL.d, lv); });

// ---------- layout ----------

const BW = HW * T.COLS + HW / 2, BH = DY * (T.ROWS - 1) + TH;
const PANEL_W = 150;
const cv = document.getElementById('c'), scr = cv.getContext('2d');
const nat = mk(10, 10), g = nat.getContext('2d');
const L = { NW: 0, NH: 0, bx: 4, by: 6, px: 0, py: 0, land: true };

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

// ---------- game state ----------

let S = null, human = 'R', mode = 'bot', screen = 'menu', busy = false, ui = null;
const M = { x: -1, y: -1 };
const A = { pl: {}, known: {}, pops: {}, ghosts: [], rip: [], parts: [], prevHex: {}, prevV: [0, 0, 0, 0], flash: null };
const now = () => performance.now();
const newUi = () => ({ mode: null, type: 'Dash', pend: null, menu: null, pick: null, menuT: 0, help: false, tip: '', walls: null });
ui = newUi();

function resetAnim() {
  A.known = {}; A.pops = {}; A.ghosts = []; A.rip = []; A.parts = []; A.flash = null; A.prevV = [0, 0, 0, 0];
  ['C', 'R'].forEach(w => { const c = hc(S.p[w]); A.pl[w] = { x: c.x, y: c.y }; A.prevHex[w] = { q: S.p[w].q, r: S.p[w].r }; });
}

// a fresh game; role is optional (random when omitted)
function resetGame(role) {
  human = role || (Math.random() < 0.5 ? 'C' : 'R');
  S = T.newState();
  ui = newUi(); busy = false;
  resetAnim();
  screen = 'game';
  next();
}

const mine = () => !!S && screen === 'game' && S.turn === human && !busy && !S.over;
const foeName = () => (mode === 'bot' ? 'BOT' : 'OPPONENT');
const ripple = (h, col, max, dur) => { const c = hc(h); A.rip.push({ x: c.x, y: c.y, col, max: max || 20, dur: dur || 600, t: now() }); };
function burst(h, cols, n, sp, life) {
  const c = hc(h), t = now();
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, v = (.3 + Math.random()) * sp;
    A.parts.push({ x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t, life: life * (.6 + Math.random() * .6), col: cols[i % cols.length] });
  }
}

// diff the state against what is on screen so animations know what changed
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
    else if (r.str > k.str) { ripple(r, PAL.w, 16, 450); burst(r, [PAL.y, PAL.w], 6, 40, 400); }
    A.known[r.id] = { id: r.id, type: r.type, q: r.q, r: r.r, str: r.str, dir: r.dir, cd: r.cd };
  });
  ['C', 'R'].forEach(w => {
    const p = S.p[w], pv = A.prevHex[w], d = T.dist(pv, p);
    if (d >= 3) { ripple(pv, PC[w], 20, 500); ripple(p, PC[w], 26, 600); burst(pv, [PC[w], PAL.w], 8, 50, 400); burst(p, [PC[w], PAL.w], 8, 50, 400); }
    else if (d > 0) burst(pv, [PAL.d, PAL.s], 3, 22, 350);
    A.prevHex[w] = { q: p.q, r: p.r };
  });
  S.p.R.v.forEach((v, i) => {
    if (v && !A.prevV[i]) { ripple(S.beacons[i], PAL.y, 34, 900); burst(S.beacons[i], [PAL.y, PAL.w, PAL.o], 14, 60, 800); }
    A.prevV[i] = v;
  });
  if (S.flash && S.flash !== A.flash) A.flash = S.flash;
}

// runs after every state change on the machine that owns the rules (bot game or host)
function next() {
  sync();
  if (mode !== 'guest') {
    if (!S.over && !S.moving && !Object.values(T.avail(S)).some(Boolean)) { T.pass(S); next(); return; }
    broadcast();
  }
  if (S.over) return;
  if (mode === 'bot' && S.turn !== human && !busy) { busy = true; setTimeout(botTurn, 550); }
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

function clearUi() { ui.mode = null; ui.pend = null; ui.menu = null; ui.walls = null; }
function done() { clearUi(); next(); }

// every player action goes through here; a guest only sends it to the host
function doOp(op) {
  if (!mine()) return false;
  if (mode === 'guest') { net.send('op', op); if (op.k !== 'step') clearUi(); return true; }
  const ok = T.applyOp(S, op);
  if (!ok) return false;
  if (op.k === 'step' && S.moving && S.turn === human && !S.over) next(); else done();
  return true;
}

function endMove() { if (mine() && S.moving) doOp({ k: 'stop' }); }
function cancel() {
  if (screen === 'game') {
    if (ui.help) { ui.help = false; return; }
    if (!mine() || S.moving) return;
    if (ui.mode === 'shape' || ui.mode === 'dir') ui.mode = ui.pend.retype != null ? 'type' : 'place';
    else if (ui.mode === 'walls') { ui.mode = 'place'; ui.walls = null; }
    else ui.mode = null;
    ui.pend = null; ui.menu = null;
  } else if (screen === 'join' || screen === 'host' || screen === 'wait' || screen === 'msg') toMenu();
}

function boardClick(h) {
  const p = S.p[human], m = S.moving ? 'move' : ui.mode;
  if (m === 'move') {
    if (S.noMove && !S.moving) return;
    const d = T.DIRS.findIndex(v => p.q + v[0] === h.q && p.r + v[1] === h.r);
    if (d < 0 || !T.canEnter(S, human, h.q, h.r)) return;
    doOp({ k: 'step', d });
  } else if (m === 'place') {
    if (!T.placeOk(S, ui.type, h.q, h.r)) return;
    if (ui.type === 'Wall') { if (T.wallsOk(S, [[h.q, h.r]])) { ui.walls = [[h.q, h.r]]; ui.mode = 'walls'; } }
    else if (ui.type === 'Bomb') { ui.pend = { q: h.q, r: h.r, shape: [[h.q, h.r]], retype: null }; ui.mode = 'shape'; }
    else if (ui.type === 'Push') { ui.pend = { q: h.q, r: h.r, retype: null }; ui.mode = 'dir'; }
    else doOp({ k: 'place', t: ui.type, q: h.q, r: h.r, opt: {} });
  } else if (m === 'walls') {
    const i = ui.walls.findIndex(v => v[0] === h.q && v[1] === h.r);
    if (i >= 0) { ui.walls.splice(i, 1); if (!ui.walls.length) { ui.walls = null; ui.mode = 'place'; } return; }
    const next2 = ui.walls.concat([[h.q, h.r]]);
    if (ui.walls.length >= 3 || !T.wallsOk(S, next2)) return;
    ui.walls = next2;
    if (ui.walls.length === 3) confirmWalls();
  } else if (m === 'dir') {
    const pd = ui.pend, d = T.DIRS.findIndex(v => pd.q + v[0] === h.q && pd.r + v[1] === h.r);
    if (d < 0) return;
    if (pd.retype != null) doOp({ k: 'retype', id: pd.retype, t: 'Push', opt: { dir: d } });
    else doOp({ k: 'place', t: 'Push', q: pd.q, r: pd.r, opt: { dir: d } });
  } else if (m === 'type') {
    const rn = T.runeAt(S, h.q, h.r);
    if (!rn || rn.type === ui.type || T.dist(p, rn) > 1 || ui.type === 'Grab') return;
    if (ui.type === 'Wall' && !T.beaconsOpen(S, [[rn.q, rn.r]])) return;
    if (ui.type === 'Bomb') {
      if (S.runes.some(x => x !== rn && x.type === 'Bomb' && x.owner === human)) return;
      ui.pend = { q: rn.q, r: rn.r, shape: [[rn.q, rn.r]], retype: rn.id }; ui.mode = 'shape';
    } else if (ui.type === 'Push') { ui.pend = { q: rn.q, r: rn.r, retype: rn.id }; ui.mode = 'dir'; }
    else doOp({ k: 'retype', id: rn.id, t: ui.type, opt: {} });
  } else if (m === 'str') {
    const rn = T.runeAt(S, h.q, h.r);
    if (rn && T.dist(p, rn) <= 2 && rn.str < T.MAXSTR) doOp({ k: 'bump', id: rn.id });
  } else if (m === 'shape') {
    const pd = ui.pend;
    if (T.dist(h, pd) > 2 || (h.q === pd.q && h.r === pd.r)) return;
    const i = pd.shape.findIndex(v => v[0] === h.q && v[1] === h.r);
    if (i >= 0) pd.shape.splice(i, 1); else pd.shape.push([h.q, h.r]);
    if (pd.shape.length === 6) {
      if (pd.retype != null) doOp({ k: 'retype', id: pd.retype, t: 'Bomb', opt: { shape: pd.shape } });
      else doOp({ k: 'place', t: 'Bomb', q: pd.q, r: pd.r, opt: { shape: pd.shape } });
    }
  }
}
function confirmWalls() { if (mine() && ui.walls && ui.walls.length) doOp({ k: 'walls', hexes: ui.walls }); }

// ---------- action ring ----------

let menuMemo = { key: '', items: [] };
function menuItems() {
  const k = [S.n, S.nid, S.moving, ui.menu, ui.pick, S.steps].join('|');
  if (menuMemo.key === k) return menuMemo.items;
  const a = T.avail(S);
  let items;
  if (ui.menu === 'moving') items = [{ id: 'end', tip: ACT.end, ok: true, kind: 'act' }];
  else if (ui.menu === 'rune') {
    const placing = ui.pick === 'place', hasBomb = S.runes.some(x => x.type === 'Bomb' && x.owner === human);
    items = T.TYPES.map(t => ({
      id: t, tip: t + ': ' + SHORT[t], kind: 'rune',
      ok: !(t === 'Bomb' && hasBomb) && (placing ? (t === 'Wall' ? T.placeTargets(S, 'Wall').some(h => T.wallsOk(S, [[h.q, h.r]])) : T.placeTargets(S, t).length > 0) : t !== 'Grab'),
    }));
  } else items = ['move', 'place', 'type', 'str', 'remove'].map(id => ({ id, tip: ACT[id], ok: !!a[id], kind: 'act' }));
  menuMemo = { key: k, items };
  return items;
}

function onMenu(id) {
  if (!mine()) return;
  if (id === 'end') { endMove(); return; }
  if (id === 'remove') { ui.menu = null; doOp({ k: 'remove' }); return; }
  if (id === 'place' || id === 'type') { ui.menu = 'rune'; ui.pick = id; ui.menuT = now(); return; }
  if (T.TYPES.includes(id)) { ui.type = id; ui.mode = ui.pick; ui.menu = null; return; }
  ui.mode = id; ui.menu = null;
}

function openMenu() {
  if (ui.menu) { ui.menu = null; return; }
  ui.mode = null; ui.pend = null; ui.walls = null; ui.menu = S.moving ? 'moving' : 'main'; ui.menuT = now();
}

// ---------- online ----------

const APP_ID = 'tag-pixel-chase-v1';
const net = { room: null, mod: null, peer: null, code: '', host: false, input: '', status: '', msg: '', sentLog: 0, copied: 0, timer: 0, acts: {} };
net.send = (name, data) => {
  const a = net.acts[name];
  if (a && net.peer) { try { a.send(data, { target: net.peer }); } catch (e) { /* peer gone */ } }
};
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const linkFor = code => location.href.split('#')[0] + '#' + code;
const guestRole = () => T.other(human);

function snapFor(role) {
  const o = {};
  ['turn', 'n', 'steps', 'moving', 'noMove', 'slow', 'over', 'passes', 'nid', 'beacons', 'p', 'flash'].forEach(k => { o[k] = S[k]; });
  // the other side never learns the shape of your bomb zones
  o.runes = S.runes.map(r => (r.type === 'Bomb' && r.owner !== role ? Object.assign({}, r, { shape: [[r.q, r.r]] }) : r));
  return o;
}

function broadcast() {
  if (mode !== 'host' || !net.peer) return;
  net.send('snap', { s: snapFor(guestRole()), lines: S.log.slice(net.sentLog) });
  net.sentLog = S.log.length;
}

function leaveRoom() {
  try { if (net.room) net.room.leave(); } catch (e) { /* ignore */ }
  net.room = null; net.peer = null; net.acts = {}; clearTimeout(net.timer);
}
function toMenu() { leaveRoom(); mode = 'bot'; screen = 'menu'; S = null; busy = false; history.replaceState(null, '', location.pathname + location.search); }
function fail(msg) { leaveRoom(); net.msg = msg; screen = 'msg'; }

async function openRoom(code, asHost) {
  net.host = asHost; net.code = code; net.status = 'CONNECTING';
  screen = asHost ? 'host' : 'wait';
  let m;
  try { net.mod = net.mod || await import('./vendor/trystero-torrent.js'); m = net.mod; }
  catch (e) { fail('ONLINE PLAY NEEDS THE GAME TO BE SERVED OVER HTTP(S), E.G. GITHUB PAGES. IT CANNOT RUN FROM A FILE.'); return; }
  leaveRoom();
  let room;
  try { room = m.joinRoom({ appId: APP_ID }, 'tag-' + code); }
  catch (e) { fail('COULD NOT OPEN A ROOM: ' + String(e && e.message || e).slice(0, 60)); return; }
  net.room = room;
  const acts = { op: room.makeAction('op'), snap: room.makeAction('snap'), start: room.makeAction('start'), rematch: room.makeAction('rematch') };
  net.acts = acts;
  acts.op.onMessage = (d, meta) => { if (asHost && meta.peerId === net.peer) onRemoteOp(d); };
  acts.snap.onMessage = d => { if (!asHost) onSnap(d); };
  acts.start.onMessage = d => { if (!asHost) onStart(d); };
  acts.rematch.onMessage = (d, meta) => { if (asHost && meta.peerId === net.peer) startHosted(); };
  room.onPeerJoin = id => {
    if (net.peer) return;                      // two players only
    net.peer = id;
    if (asHost) startHosted(); else net.status = 'WAITING FOR THE HOST';
  };
  room.onPeerLeave = id => {
    if (id !== net.peer) return;
    net.peer = null;
    if (screen === 'game' && S && !S.over) { net.msg = 'YOUR OPPONENT LEFT THE GAME.'; screen = 'msg'; }
    else if (screen === 'game') net.status = 'OPPONENT LEFT';
    else if (asHost) net.status = 'WAITING FOR OPPONENT';
  };
  net.status = asHost ? 'WAITING FOR OPPONENT' : 'LOOKING FOR THE GAME';
  if (!asHost) net.timer = setTimeout(() => { if (screen === 'wait' && !net.peer) fail('NO GAME FOUND FOR CODE ' + code + '. CHECK THE CODE AND TRY AGAIN.'); }, 40000);
}

function hostGame() { mode = 'host'; openRoom(newCode(), true); }
function joinGame(code) { mode = 'guest'; openRoom(code, false); }

function startHosted() {
  mode = 'host';
  resetGame();
  net.sentLog = S.log.length;
  net.send('start', { role: guestRole(), snap: snapFor(guestRole()), lines: S.log.slice() });
}
function onStart(d) {
  mode = 'guest'; human = d.role;
  S = Object.assign({ sim: false, hist: {}, log: d.lines.slice() }, d.snap);
  ui = newUi(); busy = false; resetAnim(); screen = 'game';
  sync();
}
function onSnap(d) {
  if (mode !== 'guest' || !S) return;
  const log = S.log.concat(d.lines);
  S = Object.assign({ sim: false, hist: {}, log }, d.s);
  if (S.over || S.turn !== human) clearUi();
  sync();
}
function onRemoteOp(op) {
  if (mode !== 'host' || screen !== 'game' || S.over || S.turn === human || !op) { broadcast(); return; }
  try { T.applyOp(S, op); } catch (e) { /* malformed op from the other side: ignore */ }
  next();
}

function newGameButton() {
  if (mode === 'guest') { net.send('rematch', 1); net.status = 'ASKED FOR A REMATCH'; }
  else if (mode === 'host') startHosted();
  else resetGame();
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
  if (screen !== 'game') return;
  if (ui.help) { ui.help = false; return; }
  const h = hexAt(p.x, p.y);
  if (!h || !mine()) return;
  const me = S.p[human];
  if (h.q === me.q && h.r === me.r && ui.mode !== 'shape' && ui.mode !== 'walls' && ui.mode !== 'dir') { openMenu(); return; }
  if (ui.menu) { ui.menu = null; return; }
  boardClick(h);
});
document.addEventListener('keydown', e => {
  if (screen === 'join') {
    if (e.key === 'Backspace') net.input = net.input.slice(0, -1);
    else if (e.key === 'Enter') { if (net.input.length === 5) joinGame(net.input); }
    else if (e.key === 'Escape') toMenu();
    else if (/^[a-zA-Z0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && net.input.length < 5) net.input += e.key.toUpperCase();
    return;
  }
  if (e.key === 'Escape') cancel();
  else if (e.key === 'Enter' || e.key === ' ') {
    if (screen === 'game' && S.moving) { e.preventDefault(); endMove(); }
    else if (screen === 'game' && ui.mode === 'walls') { e.preventDefault(); confirmWalls(); }
  }
});
document.addEventListener('paste', e => {
  if (screen !== 'join') return;
  const t = ((e.clipboardData && e.clipboardData.getData('text')) || '').toUpperCase();
  const m = t.match(/#?([A-Z0-9]{5})\s*$/);
  if (m) net.input = m[1];
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

function button(label, x, y, w, h, fn, tip, sc) {
  sc = sc || 1;
  const hot = fn && M.x >= x && M.y >= y && M.x < x + w && M.y < y + h;
  const col = !fn ? PAL.d : hot ? PAL.w : PAL.s;
  px1(x, y, w, h, PAL.k);
  px1(x, y, w, 1, hot ? PAL.w : PAL.d); px1(x, y + h - 1, w, 1, hot ? PAL.w : PAL.d);
  px1(x, y, 1, h, hot ? PAL.w : PAL.d); px1(x + w - 1, y, 1, h, hot ? PAL.w : PAL.d);
  text(g, label, x + Math.floor((w - tw(label, sc)) / 2), y + Math.floor((h - 7 * sc) / 2) + (sc === 1 ? 0 : 0), col, sc);
  buttons.push({ x, y, w, h, fn });
  if (hot && tip) ui.tip = tip;
}

// ---------- scene ----------

function highlightCells() {
  const hl = {};
  if (!mine() || ui.menu) return hl;
  const p = S.p[human], m = S.moving ? 'move' : ui.mode;
  const add = h => { hl[T.key(h.q, h.r)] = h; };
  if (m === 'move') T.DIRS.forEach(d => { const q = p.q + d[0], r = p.r + d[1]; if (T.canEnter(S, human, q, r)) add(T.cellMap[T.key(q, r)]); });
  else if (m === 'place') T.cells.filter(h => T.placeOk(S, ui.type, h.q, h.r) && (ui.type !== 'Wall' || T.wallsOk(S, [[h.q, h.r]]))).forEach(add);
  else if (m === 'walls') T.cells.filter(h => !ui.walls.some(v => v[0] === h.q && v[1] === h.r) && ui.walls.length < 3 && T.wallsOk(S, ui.walls.concat([[h.q, h.r]]))).forEach(add);
  else if (m === 'dir') T.DIRS.forEach(d => { const h = T.cellMap[T.key(ui.pend.q + d[0], ui.pend.r + d[1])]; if (h) add(h); });
  else if (m === 'type') S.runes.filter(r => T.dist(p, r) <= 1 && r.type !== ui.type && ui.type !== 'Grab').forEach(add);
  else if (m === 'str') S.runes.filter(r => T.dist(p, r) <= 2 && r.str < T.MAXSTR).forEach(add);
  else if (m === 'shape') T.cells.filter(h => T.dist(h, ui.pend) <= 2).forEach(add);
  return hl;
}
function modeColor() {
  const m = S.moving ? 'move' : ui.mode;
  return m === 'place' || m === 'type' ? RC[ui.type] : m === 'shape' ? ZONE : m === 'walls' ? RC.Wall : m === 'dir' ? RC.Push : ACOL[m] || PAL.l;
}

function drawRune(r, p, white, t) {
  const cool = r.cd > 0, lv = Math.min(3, r.str - 1);
  img(cool ? PLATE_G[lv] : PLATE[r.type][lv], p.x - 8, p.y - 9);
  const icon = r.type === 'Push' ? (white ? SP.pushW[r.dir] : cool ? SP.pushG[r.dir] : SP.push[r.dir])
    : (white ? SP.runeW[r.type] : cool ? SP.runeG[r.type] : SP.rune[r.type]);
  img(icon, p.x - 7, p.y - 8);
  // three upgrade slots: a lit pip per upgrade
  const col = cool ? PAL.d : RC[r.type];
  for (let i = 0; i < 3; i++) {
    if (i < lv) px1(p.x - 5 + i * 4, p.y + 6, 2, 2, col); else px1(p.x - 5 + i * 4, p.y + 7, 2, 1, PAL.e);
  }
  if (lv === 3 && !cool && (Math.floor(t / 280) & 1)) { px1(p.x + 5, p.y - 8, 1, 3, PAL.w); px1(p.x + 4, p.y - 7, 3, 1, PAL.w); }
  if (cool) {
    const rows = TINY[Math.min(9, r.cd)].split('|');
    rows.forEach((row, y) => { for (let i = 0; i < 3; i++) if (row[i] === '#') px1(p.x + 3 + i, p.y - 7 + y, 1, 1, PAL.w); });
  }
  if (r.type === 'Bomb' && r.owner === human) px1(p.x - 7, p.y - 6, 2, 2, ZONE);
}

function scene(t) {
  const phase = Math.floor(t / 350) & 1, pulse = Math.floor(t / 250) % 4;
  const isBeacon = h => S.beacons.some(c => c.q === h.q && c.r === h.r);

  T.cells.forEach(h => {
    const tp = tilePos(h);
    img(isBeacon(h) ? TILE_BEACON : TILE[rng(h.q * 73 + h.r * 19 + 7) % 6], tp.x, tp.y);
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
  if (ui.pend && ui.pend.shape) ui.pend.shape.forEach(h => { const tp = tilePos({ q: h[0], r: h[1] }); img(hs(ZONE, ZONE), tp.x, tp.y); });
  if (ui.walls) ui.walls.forEach(h => { const tp = tilePos({ q: h[0], r: h[1] }); img(hs(PAL.s, PAL.w, phase), tp.x, tp.y); });
  if (A.flash && S.flash === A.flash && S.n - A.flash.n <= 1) A.flash.hexes.forEach(h => {
    const tp = tilePos({ q: h[0], r: h[1] });
    img(hs(PAL.r, PAL.o, (pulse & 1)), tp.x, tp.y);
  });

  // action highlights (a grab can go almost anywhere, so it only gets outlines)
  const hl = highlightCells(), mc = modeColor();
  const rimOnly = ui.mode === 'place' && ui.type === 'Grab';
  Object.keys(hl).forEach(k => {
    const tp = tilePos(hl[k]);
    if (!rimOnly) img(hs(mc, null, phase), tp.x, tp.y);
    img(hs(null, mc), tp.x, tp.y);
  });

  // beacons
  S.beacons.forEach((h, i) => {
    const c = ctr(h), on = S.p.R.v[i];
    img(on ? SP.beacon : SP.beaconOff, c.x - 7, c.y - 8 + (on ? (Math.floor(t / 300) & 1) : 0));
    if (on && phase) { px1(c.x + 4, c.y - 7, 1, 1, PAL.w); px1(c.x - 5, c.y - 3, 1, 1, PAL.w); }
  });

  // runes
  S.runes.forEach(r => {
    const c = ctr(r), age = t - (A.pops[r.id] || 0);
    drawRune(r, c, flicker(age, 240), t);
  });
  A.ghosts = A.ghosts.filter(gh => t - gh.t < 300);
  A.ghosts.forEach(gh => { if (flicker(t - gh.t, 300)) drawRune(gh.r, ctr(gh.r), true, t); });

  // push direction picker: arrows on the six neighbours
  if (ui.mode === 'dir' && ui.pend && mine()) {
    const c = ctr(ui.pend);
    img(PLATE.Push[0], c.x - 8, c.y - 9);
    T.DIRS.forEach((v, d) => {
      const h = T.cellMap[T.key(ui.pend.q + v[0], ui.pend.r + v[1])];
      if (h) { const n = ctr(h); img(SP.push[d], n.x - 7, n.y - 8); }
    });
  }

  // removable rune marker
  if (mine() && !S.moving && !ui.menu) {
    const l = T.leftHex(S), rn = T.runeAt(S, l.q, l.r);
    if (rn) { const tp = tilePos(l); img(hs(null, PAL.r), tp.x, tp.y); if (phase) img(hs(PAL.r, null, 0), tp.x, tp.y); }
  }
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
  ['C', 'R'].sort((a, b) => A.pl[a].y - A.pl[b].y).forEach(w => {
    const d = A.pl[w], pl = S.p[w], x = L.bx + d.x, y = L.by + d.y;
    const bob = S.turn === w && !S.over && (Math.floor(t / 380) & 1) ? 1 : 0;
    px1(x - 5, y + 4, 10, 2, '#14151f');
    if (pl.frozen || (S.turn === w && S.noMove)) {
      ring(x, y - 1, 10, ICE, true, Math.floor(t / 120));
      ring(x, y - 1, 9, ICE, true, Math.floor(t / 120) + 1);
    }
    if (pl.grab || (S.turn === w && S.slow)) ring(x, y - 1, 12, PAL.r, true, Math.floor(t / 90));
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
    } else img(actIcon(it.id, it.ok ? col : PAL.d), x - 7, y - 7);
    if (hot) ui.tip = it.tip;
    buttons.push({ x: x - 9, y: y - 9, w: 18, h: 18, fn: it.ok ? () => onMenu(it.id) : null });
  });
}

// ---------- panel ----------

function hintText() {
  if (S.over) return 'GAME OVER';
  if (S.turn !== human || busy) return mode === 'bot' ? 'BOT IS THINKING...' : 'WAITING FOR YOUR OPPONENT...';
  if (S.moving) return 'CLICK A NEIGHBOURING HEX (' + S.steps + ' STEP' + (S.steps === 1 ? '' : 'S') + ' LEFT). CLICK YOUR PIECE TO END THE MOVE.';
  switch (ui.mode) {
    case 'move': return 'CLICK A HIGHLIGHTED NEIGHBOUR TO STEP.';
    case 'place': return ui.type === 'Grab' ? 'PLACE GRAB: ANY HEX AT LEAST 4 AWAY FROM YOU (OUTLINED).'
      : ui.type === 'Wall' ? 'PLACE WALL: CLICK UP TO 3 HEXES, THEN CONFIRM.'
      : 'PLACE ' + ui.type + ': CLICK A HIGHLIGHTED HEX.' + (ui.type === 'Bomb' ? ' THEN DRAW ITS ZONE.' : ui.type === 'Push' ? ' THEN PICK A DIRECTION.' : '');
    case 'walls': return 'WALLS ' + ui.walls.length + '/3. CLICK MORE HEXES (CLICK AGAIN TO UNDO), THEN CONFIRM (ENTER).';
    case 'dir': return 'PICK THE PUSH DIRECTION: CLICK AN ARROW HEX. ESC TO GO BACK.';
    case 'shape': return 'DRAW THE ZONE: ' + (6 - ui.pend.shape.length) + ' MORE HEX(ES) WITHIN 2 OF THE BOMB. ESC TO GO BACK.';
    case 'type': return 'CONVERT TO ' + ui.type + ': CLICK A HIGHLIGHTED RUNE.';
    case 'str': return 'CLICK A HIGHLIGHTED RUNE TO UPGRADE IT (MAX 3).';
    default: {
      const hv = hexAt(M.x, M.y), rn = hv && T.runeAt(S, hv.q, hv.r);
      if (rn) return rn.type + ' UPGRADED ' + (rn.str - 1) + '/3' + (rn.cd ? ', RECHARGING ' + rn.cd : '') + '.';
      return 'YOUR TURN. CLICK YOUR PIECE TO PICK AN ACTION.' + (S.noMove ? ' (FROZEN: NO MOVING)' : '');
    }
  }
}

function panelA(x, y, w) {
  text(g, 'TAG', x, y, PAL.w, 3);
  button(mode === 'bot' ? 'NEW GAME' : 'REMATCH', x + w - 62, y, 62, 14, newGameButton);
  button('HELP', x + w - 62, y + 17, 62, 14, () => { ui.help = !ui.help; });
  button('MENU', x + w - 62, y + 34, 62, 14, toMenu);
  y += 52;
  img(SP[human], x, y - 1);
  text(g, 'YOU: ' + T.name(human), x + 18, y + 3, PC[human]);
  y += 18;
  if (mode !== 'bot') { text(g, 'ROOM ' + net.code + (net.peer ? '' : ' (ALONE)'), x, y, PAL.d); y += 11; }
  text(g, S.over ? 'GAME OVER' : 'TURN ' + (S.n + 1) + ' - ' + (S.turn === human ? 'YOURS' : mode === 'bot' ? 'BOT' : 'THEIRS'), x, y, PAL.s);
  y += 12;
  text(g, 'BEACONS', x, y + 2, PAL.s);
  S.p.R.v.forEach((v, i) => img(v ? SP.beacon : SP.beaconOff, x + 50 + i * 15, y - 2));
  y += 15;
  const fl = p => [p.frozen ? 'FROZEN ' + p.frozen : '', p.grab ? 'SLOW -' + p.grab : ''].filter(Boolean).join(' ') || 'OK';
  const st = w2 => S.p[w2].frozen || S.p[w2].grab ? ICE : PAL.s;
  text(g, 'CHASER ' + fl(S.p.C), x, y, st('C'));
  text(g, 'RUNNER ' + fl(S.p.R), x, y + 10, st('R'));
  return y + 24;
}

function panelB(x, y, w, h) {
  const n = Math.floor(w / 6);
  const lines = wrap(ui.tip || hintText(), n);
  lines.slice(0, 4).forEach((l, i) => text(g, l, x, y + i * 10, ui.tip ? PAL.w : PAL.y));
  y += 44;
  if (mine() && ui.mode === 'walls' && ui.walls) {
    button('CONFIRM ' + ui.walls.length + ' WALL' + (ui.walls.length > 1 ? 'S' : ''), x, y - 2, Math.min(w, 110), 14, confirmWalls);
    y += 16; h -= 16;
  }
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
  'RUNNER: LIGHT ALL 4 BEACONS TO WIN.',
  'TIE: SAME POSITION 3X, NO ACTIONS, 600 TURNS.',
  'ONE ACTION PER TURN. CLICK YOUR PIECE:',
  ' MOVE     UP TO 2 STEPS (FACING = LAST STEP)',
  ' PLACE    A RUNE WITHIN 2. WALLS: UP TO 3 AT ONCE',
  ' TYPE     CHANGE A RUNE WITHIN 1',
  ' UPGRADE  A RUNE WITHIN 2, MAX 3 TIMES',
  ' REMOVE   THE RUNE ON YOUR LEFT (RED EDGE)',
  'NO RUNES ON BEACONS, THE CENTER OR PLAYERS.',
  'WALLS CAN NEVER SEAL OFF A BEACON.',
  'RUNES HIT BOTH PLAYERS. FROZEN = NO MOVING.',
];
const HELPD = {
  Bomb: 'HIDDEN 6-HEX ZONE. FREEZES WHOEVER WALKS IN',
  Dash: '+2 PLUS STRENGTH EXTRA STEPS',
  Push: 'SHOVES YOU ALONG ITS ARROW. YOU CHOOSE THE WAY',
  Teleport: 'JUMP TO ANOTHER ONE, + STRENGTH STEPS',
  Wall: 'BLOCKS MOVEMENT. UP TO 3 PER PLACEMENT',
  Grab: 'PLACED 4+ AWAY. STEPPING ON IT SLOWS THE OTHER PLAYER BY STRENGTH',
  Return: 'GO TO CENTER. MORE STRENGTH = FASTER RECHARGE',
};
function drawHelp() {
  const x = L.bx + 6, y = L.by + 6, w = BW - 12, h = BH - 12;
  px1(x, y, w, h, PAL.d); px1(x + 1, y + 1, w - 2, h - 2, PAL.k);
  HELP.forEach((l, i) => text(g, l, x + 8, y + 8 + i * 9, i < 3 ? PAL.y : PAL.s));
  let yy = y + 8 + HELP.length * 9 + 6;
  T.TYPES.forEach(t => {
    img(t === 'Push' ? SP.push[0] : SP.rune[t], x + 6, yy - 4);
    text(g, t, x + 24, yy, RC[t]);
    const ls = wrap(HELPD[t], 46);
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
  button(mode === 'bot' ? 'PLAY AGAIN' : 'REMATCH', x + Math.floor((bw - 72) / 2), y + 50, 72, 16, newGameButton);
}

// ---------- title and online screens ----------

function drawScreen(t) {
  const W = L.NW, H = L.NH, cx = Math.floor(W / 2);
  const bob = Math.floor(t / 400) & 1;
  const title = 'TAG';
  text(g, title, cx - Math.floor(tw(title, 8) / 2), 26, PAL.w, 8);
  g.drawImage(SP.C, cx - 120, 24 - bob * 2, 56, 56);
  g.drawImage(SP.R, cx + 64, 24 + bob * 2, 56, 56);
  const line = (s, y, col, sc) => text(g, s, cx - Math.floor(tw(s, sc) / 2), y, col || PAL.s, sc || 1);
  const bw = 170, bx = cx - bw / 2;
  if (screen === 'menu') {
    line('CHASE ACROSS 625 HEXES. BEND THE RULES WITH RUNES.', 96, PAL.s);
    button('PLAY VS BOT', bx, 124, bw, 22, () => { mode = 'bot'; resetGame(); }, '', 2);
    button('HOST ONLINE GAME', bx, 154, bw, 22, hostGame, '', 2);
    button('JOIN ONLINE GAME', bx, 184, bw, 22, () => { net.input = ''; screen = 'join'; }, '', 2);
    line('ONLINE IS PEER TO PEER: NO ACCOUNT, NO SERVER.', 224, PAL.d);
    line('HOST SHARES A 5-LETTER CODE OR LINK.', 235, PAL.d);
  } else if (screen === 'host') {
    line('YOUR ROOM CODE', 100, PAL.s);
    line(net.code, 114, PAL.y, 6);
    const link = linkFor(net.code);
    wrap(link.replace(/^https?:\/\//, ''), 56).slice(0, 2).forEach((l, i) => line(l, 166 + i * 10, PAL.d));
    button(Date.now() - net.copied < 1500 ? 'COPIED!' : 'COPY LINK', bx, 192, bw, 20, () => {
      try { navigator.clipboard.writeText(link); net.copied = Date.now(); } catch (e) { /* no clipboard */ }
    }, '', 2);
    line(net.status + '.'.repeat(Math.floor(t / 400) % 4), 224, PAL.l);
    button('CANCEL', bx, 242, bw, 18, toMenu);
  } else if (screen === 'join') {
    line('ENTER THE ROOM CODE', 104, PAL.s);
    const bwid = 5 * 36 + 8;
    px1(cx - bwid / 2, 124, bwid, 44, PAL.d); px1(cx - bwid / 2 + 2, 126, bwid - 4, 40, PAL.k);
    const shown = net.input + ((Math.floor(t / 400) & 1) && net.input.length < 5 ? '_' : '');
    text(g, shown, cx - Math.floor(tw(shown, 5) / 2) + 2, 133, PAL.y, 5);
    line('TYPE IT OR PASTE A LINK', 176, PAL.d);
    button('JOIN', bx, 194, bw, 22, net.input.length === 5 ? () => joinGame(net.input) : null, '', 2);
    button('BACK', bx, 224, bw, 18, toMenu);
  } else if (screen === 'wait') {
    line('JOINING ROOM ' + net.code, 120, PAL.y, 2);
    line(net.status + '.'.repeat(Math.floor(t / 400) % 4), 150, PAL.l);
    line('THIS CAN TAKE A FEW SECONDS.', 166, PAL.d);
    button('CANCEL', bx, 200, bw, 20, toMenu);
  } else if (screen === 'msg') {
    wrap(net.msg, 44).forEach((l, i) => line(l, 130 + i * 11, PAL.o));
    button('BACK TO MENU', bx, 130 + wrap(net.msg, 44).length * 11 + 20, bw, 22, toMenu, '', 2);
  }
}

// ---------- loop ----------

let last = 0;
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (t - last) / 1000 || 0); last = t;
  buttons.length = 0;
  if (ui) ui.tip = '';
  g.fillStyle = PAL.k; g.fillRect(0, 0, L.NW, L.NH);
  if (screen === 'game' && S) {
    ['C', 'R'].forEach(w => {
      const d = A.pl[w], c = hc(S.p[w]), k = 1 - Math.exp(-dt * 16);
      d.x += (c.x - d.x) * k; d.y += (c.y - d.y) * k;
      if (Math.abs(c.x - d.x) < .4) d.x = c.x;
      if (Math.abs(c.y - d.y) < .4) d.y = c.y;
    });
    scene(t);
    if (ui.help) drawHelp();
    if (S.over) drawOver();
    if (L.land) { const e = panelA(L.px, L.py, PANEL_W); panelB(L.px, e + 4, PANEL_W, L.NH - e - 10); }
    else { const e = panelA(L.px, L.py, 160); panelB(L.px + 170, L.py, BW - 170, 112); }
  } else drawScreen(t);
  scr.drawImage(nat, 0, 0, cv.width, cv.height);
}

window.addEventListener('resize', layout);
layout();
const hash = (location.hash || '').replace('#', '').toUpperCase();
if (/^[A-Z0-9]{5}$/.test(hash)) joinGame(hash);
requestAnimationFrame(frame);
})();
