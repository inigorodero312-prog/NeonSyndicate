'use strict';
// ───────── Mundo procedural ─────────
// El mapa es una rejilla de celdas de 11x11 tiles (3 de calle + manzana de 8x8).
// Los distritos se reparten por celdas (Voronoi con ruido) y están separados por barreras
// que se abren al alcanzar cierto nivel.

class World {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.W = WW; this.H = WH;
    this.t = new Uint8Array(WW * WH);     // tipo de tile
    this.v = new Uint8Array(WW * WH);     // variación decorativa
    this.d = new Uint8Array(WW * WH);     // distrito
    this.gate = new Uint8Array(WW * WH);  // distrito cuya barrera protege este tile (0 = ninguna)
    this.cellD = []; this.cellT = [];     // distrito / tipo por celda
    this.hubs = []; this.lairs = []; this.camps = []; this.houses = [];
    this.hf = new Uint8Array(WW * WH);    // fachada de piso franco: 1 = cuerpo, 2/3 = puerta izq/der
    this.generate();
  }

  tileAt(x, y) {
    if (x < 0 || y < 0 || x >= WW || y >= WH) return T.VOID;
    return this.t[y * WW + x];
  }
  districtAtPx(px, py) {
    const x = clamp(Math.floor(px / TILE), 0, WW - 1), y = clamp(Math.floor(py / TILE), 0, WH - 1);
    return this.d[y * WW + x];
  }
  set(x, y, t) { if (x >= 0 && y >= 0 && x < WW && y < WH) this.t[y * WW + x] = t; }

  generate() {
    const rng = new RNG(this.seed);
    // 1) Distritos por celda
    const ids = rng.shuffle([1, 2, 3, 4]);
    const sites = [{ x: 6, y: 6, w: 0.74, id: 0 }];
    const corners = [[2.3, 2.3], [9.7, 2.3], [2.3, 9.7], [9.7, 9.7]];
    corners.forEach((c, i) => sites.push({ x: c[0] + rng.range(-0.8, 0.8), y: c[1] + rng.range(-0.8, 0.8), w: 1, id: ids[i] }));
    for (let cy = 0; cy < WB; cy++) {
      this.cellD[cy] = []; this.cellT[cy] = [];
      for (let cx = 0; cx < WB; cx++) {
        let best = 1e9, bid = 0;
        const n = valueNoise(cx * 0.45, cy * 0.45, this.seed) - 0.5;
        for (const s of sites) {
          const dd = Math.hypot(cx + 0.5 - s.x, cy + 0.5 - s.y) * s.w * (1 + n * 0.55);
          if (dd < best) { best = dd; bid = s.id; }
        }
        this.cellD[cy][cx] = bid;
      }
    }
    // 2) Tipo de manzana por celda
    for (let cy = 0; cy < WB; cy++) for (let cx = 0; cx < WB; cx++) {
      const mix = DISTRICTS[this.cellD[cy][cx]].mix;
      const r = rng.next();
      this.cellT[cy][cx] = r < mix.b ? 'b' : r < mix.b + mix.p ? 'p' : 'c';
    }
    // 3) Asegurar plazas (hubs y guarida) y compuestos en cada distrito
    for (let d = 0; d < 5; d++) {
      const cells = [];
      for (let cy = 0; cy < WB; cy++) for (let cx = 0; cx < WB; cx++) if (this.cellD[cy][cx] === d) cells.push({ cx, cy });
      const want = d === 0 ? 4 : 3;
      const plazas = () => cells.filter(c => this.cellT[c.cy][c.cx] === 'p');
      while (plazas().length < want) {
        const cand = cells.filter(c => this.cellT[c.cy][c.cx] === 'b');
        if (!cand.length) break;
        const c = rng.pick(cand); this.cellT[c.cy][c.cx] = 'p';
      }
      const comps = () => cells.filter(c => this.cellT[c.cy][c.cx] === 'c');
      while (comps().length < 2) {
        const cand = cells.filter(c => this.cellT[c.cy][c.cx] === 'b');
        if (!cand.length) break;
        const c = rng.pick(cand); this.cellT[c.cy][c.cx] = 'c';
      }
      // hubs
      if (!plazas().length && cells.length) { const c0 = cells[0]; this.cellT[c0.cy][c0.cx] = 'p'; }
      const pl = plazas();
      const cenX = d === 0 ? 5.5 : cells.reduce((a, c) => a + c.cx, 0) / cells.length;
      const cenY = d === 0 ? 5.5 : cells.reduce((a, c) => a + c.cy, 0) / cells.length;
      pl.sort((a, b) => Math.hypot(a.cx - cenX, a.cy - cenY) - Math.hypot(b.cx - cenX, b.cy - cenY));
      const hub1 = pl[0];
      this.cellT[hub1.cy][hub1.cx] = 'h';
      this.hubs.push({ id: this.hubs.length, district: d, cx: hub1.cx, cy: hub1.cy });
      let rest = pl.slice(1);
      if (d === 0 && rest.length) {
        rest.sort((a, b) => Math.hypot(b.cx - hub1.cx, b.cy - hub1.cy) - Math.hypot(a.cx - hub1.cx, a.cy - hub1.cy));
        const hub2 = rest[0];
        this.cellT[hub2.cy][hub2.cx] = 'h';
        this.hubs.push({ id: this.hubs.length, district: d, cx: hub2.cx, cy: hub2.cy });
        rest = rest.slice(1);
      }
      if (rest.length) {
        rest.sort((a, b) => Math.hypot(b.cx - hub1.cx, b.cy - hub1.cy) - Math.hypot(a.cx - hub1.cx, a.cy - hub1.cy));
        const lair = rest[0];
        this.cellT[lair.cy][lair.cx] = 'l';
        this.lairs.push({ district: d, cx: lair.cx, cy: lair.cy });
      }
    }
    // 4) Tiles
    for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
      const i = y * WW + x;
      const cx = Math.min(Math.floor(x / BLOCK), WB - 1), cy = Math.min(Math.floor(y / BLOCK), WB - 1);
      this.d[i] = this.cellD[cy][cx];
      this.v[i] = Math.floor(hash2(x, y, this.seed) * 255);
      const lx = x - cx * BLOCK, ly = y - cy * BLOCK;
      const road = lx < 3 || ly < 3 || x >= WB * BLOCK || y >= WB * BLOCK;
      this.t[i] = road ? T.ROAD : T.FLOOR;
    }
    for (let cy = 0; cy < WB; cy++) for (let cx = 0; cx < WB; cx++) {
      this.fillBlock(cx, cy, this.cellT[cy][cx], this.cellD[cy][cx], new RNG(Math.floor(hash2(cx, cy, this.seed + 7) * 4294967295)));
    }
    // borde del mundo
    for (let x = 0; x < WW; x++) { this.set(x, 0, T.VOID); this.set(x, WH - 1, T.VOID); }
    for (let y = 0; y < WH; y++) { this.set(0, y, T.VOID); this.set(WW - 1, y, T.VOID); }
    // 5) Barreras entre distritos
    for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
      const i = y * WW + x, d = this.d[i];
      if (d === 0) continue;
      if ((x > 0 && this.d[i - 1] !== d) || (x < WW - 1 && this.d[i + 1] !== d) ||
        (y > 0 && this.d[i - WW] !== d) || (y < WH - 1 && this.d[i + WW] !== d)) this.gate[i] = d;
    }
    // 5b) Pisos francos
    this.placeHouses(rng);
    // 6) Campamentos en compuestos
    for (let cy = 0; cy < WB; cy++) for (let cx = 0; cx < WB; cx++) {
      if (this.cellT[cy][cx] !== 'c') continue;
      this.camps.push({ id: this.camps.length, cx, cy, district: this.cellD[cy][cx], x: (cx * BLOCK + 7) * TILE, y: (cy * BLOCK + 7) * TILE,
        cleared: false, spawned: false, enemies: [], raid: false, loot: false });
    }
  }

  // Pisos francos: edificios de 6x6 con puerta al sur, repartidos por los distritos
  placeHouses(rng) {
    const want = [3, 2, 2, 2, 2];
    const cheb = (a, b) => Math.max(Math.abs(a.cx - b.cx), Math.abs(a.cy - b.cy));
    const hot = []; // celdas que no queremos cerca (hubs, guaridas, compuestos)
    for (let cy = 0; cy < WB; cy++) for (let cx = 0; cx < WB; cx++) { const t = this.cellT[cy][cx]; if (t === 'h' || t === 'l' || t === 'c') hot.push({ cx, cy, t }); }
    for (let d = 0; d < 5; d++) {
      let cells = [];
      for (let cy = 0; cy < WB; cy++) for (let cx = 0; cx < WB; cx++) if (this.cellD[cy][cx] === d && this.cellT[cy][cx] === 'b') cells.push({ cx, cy });
      if (cells.length < 2) // distrito casi sin manzanas de edificios: se aprovechan plazas libres
        for (let cy = 0; cy < WB; cy++) for (let cx = 0; cx < WB; cx++) if (this.cellD[cy][cx] === d && this.cellT[cy][cx] === 'p') cells.push({ cx, cy });
      for (let k = 0; k < want[d] && cells.length; k++) {
        let best = null, bs = -1e9;
        for (const relax of [false, true]) {
          for (const c of cells) {
            let s = 0, nh = 99, bad = false;
            for (const h of hot) {
              const ch = cheb(c, h), man = Math.abs(c.cx - h.cx) + Math.abs(c.cy - h.cy);
              if (h.t !== 'c' && ch <= 1) { if (!relax) { bad = true; break; } s -= 3; } // lejos de plazas y guaridas si se puede
              if (man <= 1) s -= 2.5;                            // mejor no pegado a un compuesto enemigo
              nh = Math.min(nh, ch);
            }
            if (bad) continue;
            s += Math.min(nh, 4) * 0.6;
            for (const o of this.houses) { const dd = cheb(c, o); if (dd < 3) s -= 6; else s += Math.min(dd, 6) * 0.4; }
            if (d === 0 && k === 0) { const h0 = this.hubs[0]; s -= Math.abs(cheb(c, h0) - 3) * 3; } // el primero cerca del inicio
            s += rng.next() * 0.8;
            if (s > bs) { bs = s; best = c; }
          }
          if (best) break;
        }
        if (!best) break;
        cells = cells.filter(c => c !== best);
        this.stampHouse(best.cx, best.cy, d);
      }
    }
  }
  stampHouse(cx, cy, d) {
    const x0 = cx * BLOCK + 3, y0 = cy * BLOCK + 3;
    const rect = (ax, ay, w, h, t) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(ax + i, ay + j, t); };
    rect(x0, y0, 8, 8, T.WALK); rect(x0 + 1, y0 + 1, 6, 6, T.BUILD);
    for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) this.hf[(y0 + 1 + j) * WW + x0 + 1 + i] = 1;
    this.hf[(y0 + 6) * WW + x0 + 3] = 2; this.hf[(y0 + 6) * WW + x0 + 4] = 3;
    const names = ['Piso franco', 'Piso franco', 'Piso franco'];
    this.houses.push({ id: this.houses.length, cx, cy, district: d, tx: x0 + 3, ty: y0 + 6,
      x: (x0 + 4) * TILE, y: (y0 + 7.1) * TILE,           // punto de interacción: la acera frente a la puerta
      name: names[this.houses.length % names.length] });
  }

  fillBlock(cx, cy, type, d, rng) {
    const x0 = cx * BLOCK + 3, y0 = cy * BLOCK + 3;
    const rect = (ax, ay, w, h, t) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(ax + i, ay + j, t); };
    if (type === 'b') {
      rect(x0, y0, 8, 8, T.WALK);
      let bx = x0 + 1, by = y0 + 1, bw = 6, bh = 6;
      if (rng.chance(0.28)) { // edificio más pequeño con patio
        if (rng.chance(0.5)) { bw = rng.pick([3, 4]); if (rng.chance(0.5)) bx += 6 - bw; }
        else { bh = rng.pick([3, 4]); if (rng.chance(0.5)) by += 6 - bh; }
        rect(x0 + 1, y0 + 1, 6, 6, T.FLOOR);
        for (let k = 0; k < 4; k++) this.set(x0 + 1 + rng.int(0, 5), y0 + 1 + rng.int(0, 5), T.CRATE);
      }
      rect(bx, by, bw, bh, T.BUILD);
      if (bw >= 5 && bh >= 5 && rng.chance(0.45)) { // callejón
        if (rng.chance(0.5)) { const k = rng.int(2, bw - 3); for (let j = 0; j < bh; j++) this.set(bx + k, by + j, T.WALK); }
        else { const k = rng.int(2, bh - 3); for (let i = 0; i < bw; i++) this.set(bx + i, by + k, T.WALK); }
      }
      if (d === 4) { // ruinas
        for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) if (rng.chance(0.3)) this.set(bx + i, by + j, T.FLOOR);
      }
    } else if (type === 'p' || type === 'h' || type === 'l') {
      rect(x0, y0, 8, 8, T.FLOOR);
      const n = type === 'p' ? rng.int(5, 9) : rng.int(3, 5);
      for (let k = 0; k < n; k++) {
        const i = rng.int(0, 7), j = rng.int(0, 7);
        if (type !== 'p' && i >= 2 && i <= 5 && j >= 2 && j <= 5) continue; // centro libre
        this.set(x0 + i, y0 + j, T.CRATE);
      }
      if (d === 4 && type === 'p') {
        for (let b = 0; b < 3; b++) {
          const px = rng.int(1, 6), py = rng.int(1, 6), r = rng.int(1, 2);
          for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
            if (i * i + j * j <= r * r + 1) { const tx = x0 + px + i, ty = y0 + py + j; if (tx >= x0 && ty >= y0 && tx < x0 + 8 && ty < y0 + 8) this.set(tx, ty, T.TOXIC); }
          }
        }
      }
    } else if (type === 'c') {
      rect(x0, y0, 8, 8, T.WALL);
      rect(x0 + 1, y0 + 1, 6, 6, T.FLOOR);
      const sides = rng.shuffle([0, 1, 2, 3]).slice(0, rng.int(2, 3));
      for (const s of sides) {
        const k = rng.int(1, 5);
        for (let w = 0; w < 2; w++) {
          if (s === 0) this.set(x0 + k + w, y0, T.FLOOR);
          else if (s === 1) this.set(x0 + k + w, y0 + 7, T.FLOOR);
          else if (s === 2) this.set(x0, y0 + k + w, T.FLOOR);
          else this.set(x0 + 7, y0 + k + w, T.FLOOR);
        }
      }
      const n = rng.int(4, 8);
      for (let q = 0; q < n; q++) this.set(x0 + 2 + rng.int(0, 3), y0 + 2 + rng.int(0, 3), T.CRATE);
    }
  }

  // Posiciones útiles (en píxeles)
  cellCenter(cx, cy) { return { x: (cx * BLOCK + 7) * TILE, y: (cy * BLOCK + 7) * TILE }; }
  crossing(cx, cy) { return { x: (cx * BLOCK + 1.5) * TILE, y: (cy * BLOCK + 1.5) * TILE }; }

  // Mapa en miniatura (1 px por tile)
  buildMapBase() {
    const c = document.createElement('canvas'); c.width = WW; c.height = WH;
    const g = c.getContext('2d');
    for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
      const i = y * WW + x, t = this.t[i], d = DISTRICTS[this.d[i]];
      let col;
      if (t === T.ROAD) col = '#2a2840';
      else if (t === T.WALK) col = '#1d1b2e';
      else if (t === T.BUILD) col = rgba(d.accent, 0.38);
      else if (t === T.WALL) col = rgba(d.accent, 0.75);
      else if (t === T.CRATE) col = '#3a3548';
      else if (t === T.TOXIC) col = '#4aa21e';
      else if (t === T.VOID) col = '#000';
      else col = '#23213a';
      g.fillStyle = '#05040a'; g.fillRect(x, y, 1, 1);
      g.fillStyle = col; g.fillRect(x, y, 1, 1);
    }
    this.mapBase = c;
  }
}

// ───────── Colisión con el mundo ─────────
function tileSolidMove(world, tx, ty, playerLevel) {
  if (tx < 0 || ty < 0 || tx >= WW || ty >= WH) return true;
  const i = ty * WW + tx;
  if (SOLID_MOVE[world.t[i]]) return true;
  const g = world.gate[i];
  if (g && playerLevel < DISTRICTS[g].req) return true;
  return false;
}
function blockedCircle(world, x, y, r, playerLevel) {
  const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r) / TILE);
  const y0 = Math.floor((y - r) / TILE), y1 = Math.floor((y + r) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (!tileSolidMove(world, tx, ty, playerLevel)) continue;
    const nx = clamp(x, tx * TILE, tx * TILE + TILE), ny = clamp(y, ty * TILE, ty * TILE + TILE);
    const dx = x - nx, dy = y - ny;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}
function bulletBlocked(world, x, y) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= WW || ty >= WH) return true;
  return SOLID_BULLET[world.t[ty * WW + tx]] === 1;
}
function hasLOS(world, x1, y1, x2, y2) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.ceil(d / 20);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (bulletBlocked(world, lerp(x1, x2, t), lerp(y1, y2, t))) return false;
  }
  return true;
}

// ───────── Campo de flujo hacia el jugador (para que los enemigos rodeen edificios) ─────────
function makeFlow() {
  return {
  R: 34, ox: 0, oy: 0, n: 0, dist: null, tx: -1, ty: -1, age: 99,
  build(world, px, py, level) {
    const R = this.R, n = R * 2 + 1;
    const cx = Math.floor(px / TILE), cy = Math.floor(py / TILE);
    this.ox = cx - R; this.oy = cy - R; this.n = n;
    if (!this.dist || this.dist.length !== n * n) this.dist = new Int16Array(n * n);
    const dist = this.dist; dist.fill(-1);
    const q = new Int32Array(n * n); let qh = 0, qt = 0;
    dist[R * n + R] = 0; q[qt++] = R * n + R;
    while (qh < qt) {
      const cur = q[qh++], ux = cur % n, uy = (cur / n) | 0, dcur = dist[cur];
      for (let k = 0; k < 4; k++) {
        const vx = ux + (k === 0 ? 1 : k === 1 ? -1 : 0), vy = uy + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (vx < 0 || vy < 0 || vx >= n || vy >= n) continue;
        const vi = vy * n + vx; if (dist[vi] !== -1) continue;
        if (tileSolidMove(world, this.ox + vx, this.oy + vy, level)) continue;
        dist[vi] = dcur + 1; q[qt++] = vi;
      }
    }
    this.age = 0;
  },
  // Dirección (vector unitario) desde (x,y) hacia el jugador, o null si fuera del campo
  dir(x, y) {
    if (!this.dist) return null;
    const n = this.n, tx = Math.floor(x / TILE) - this.ox, ty = Math.floor(y / TILE) - this.oy;
    if (tx < 1 || ty < 1 || tx >= n - 1 || ty >= n - 1) return null;
    const cur = this.dist[ty * n + tx];
    if (cur < 0) return null;
    let best = cur, bx = 0, by = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      if (!i && !j) continue;
      const v = this.dist[(ty + j) * n + (tx + i)];
      if (v < 0) continue;
      if (i && j && (this.dist[ty * n + tx + i] < 0 || this.dist[(ty + j) * n + tx] < 0)) continue;
      const cost = v + (i && j ? 0.4 : 0);
      if (cost < best) { best = cost; bx = i; by = j; }
    }
    if (!bx && !by) return null;
    const l = Math.hypot(bx, by);
    // objetivo = centro del tile vecino
    const gx = (this.ox + tx + bx + 0.5) * TILE, gy = (this.oy + ty + by + 0.5) * TILE;
    const dx = gx - x, dy = gy - y, dl = Math.hypot(dx, dy) || 1;
    return { x: dx / dl, y: dy / dl };
  },
};
}
const FlowSet = [makeFlow(), makeFlow(), makeFlow(), makeFlow()];
const Flow = FlowSet[0];

// ───────── Dibujo del mundo (por chunks cacheados) ─────────
// Estilo calle: asfalto agrietado, aceras con bordillo, fachadas de ladrillo / chapa / paneles con ventanas,
// azoteas con trastos, pintadas, carteles pegados y cajas de madera.
const CH = 16;
const _chunks = new Map();
// Material de fachada por distrito
const FACADE = [
  { base: '#7a3a2d', dark: '#3d1a15', hi: '#9a5440', kind: 'brick' },
  { base: '#74502f', dark: '#3b2616', hi: '#9a6a3c', kind: 'metal' },
  { base: '#1f2c4a', dark: '#0b1222', hi: '#35507f', kind: 'panel' },
  { base: '#465d84', dark: '#1a2640', hi: '#7a98c6', kind: 'glass' },
  { base: '#5e6652', dark: '#262c20', hi: '#7f8a6c', kind: 'rubble' },
];
const TAGS = ['SOLO', 'NULL', 'ZAS', 'FUSIBLE', 'HOJA', 'BARRIO', 'K.O.', 'NS', 'VIVA', '24H', 'CROMO', 'RATA'];
const TAG_COLS = ['#ff2e88', '#12e6ff', '#ffd81f', '#a6ff1f', '#ff7a1a', '#f4f0e6'];

function drawWindow(g, wx, wy, w, h, kind, accent, v) {
  g.fillStyle = INK; g.fillRect(wx - 2, wy - 2, w + 4, h + 4);
  if (kind === 0) { g.fillStyle = '#0a0912'; g.fillRect(wx, wy, w, h); g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(wx, wy, w, 2); }
  else if (kind === 1) { g.fillStyle = '#ffcf6b'; g.fillRect(wx, wy, w, h); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(wx, wy + h * 0.55, w, h * 0.45); g.fillStyle = INK; g.fillRect(wx + w * 0.3, wy + h * 0.35, w * 0.4, h * 0.65); }
  else if (kind === 2) { g.fillStyle = accent; g.fillRect(wx, wy, w, h); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(wx, wy, w, 2); }
  else if (kind === 3) { g.fillStyle = '#6f6b7a'; g.fillRect(wx, wy, w, h); g.fillStyle = 'rgba(0,0,0,0.35)'; for (let k = 2; k < h; k += 3) g.fillRect(wx, wy + k, w, 1); }
  else { g.fillStyle = '#8fb6d8'; g.fillRect(wx, wy, w, h); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(wx, wy + h); g.lineTo(wx + w * 0.5, wy); g.lineTo(wx + w * 0.8, wy); g.lineTo(wx + w * 0.3, wy + h); g.fill(); }
  if (kind !== 3) { g.fillStyle = INK; g.fillRect(wx + w / 2 - 0.5, wy, 1.5, h); }
}

function drawFacade(g, world, x, y, px, py, di, d, v, full) {
  const F = FACADE[di], fh = full ? TILE : 26, fy = py + TILE - fh;
  g.fillStyle = F.base; g.fillRect(px, fy, TILE, fh);
  if (F.kind === 'brick') {
    g.fillStyle = F.dark;
    for (let r = 0; r < Math.ceil(fh / 8); r++) { g.fillRect(px, fy + r * 8 + 6, TILE, 1.4); const off = (r % 2) * 8 + ((v >> 3) % 4); for (let c = 0; c < 5; c++) g.fillRect(px + off + c * 12, fy + r * 8 - 2, 1.4, 8); }
    g.fillStyle = 'rgba(255,255,255,0.07)'; for (let k = 0; k < 4; k++) g.fillRect(px + ((v * (k + 3)) % 40), fy + ((v * (k + 5)) % Math.max(1, fh - 6)), 8, 4);
  } else if (F.kind === 'metal') {
    for (let c = 0; c < TILE; c += 6) { g.fillStyle = (c / 6) % 2 ? F.hi : F.base; g.fillRect(px + c, fy, 3, fh); g.fillStyle = F.dark; g.fillRect(px + c + 3, fy, 3, fh); }
    g.fillStyle = 'rgba(160,70,20,0.35)'; g.fillRect(px + (v % 30), fy, 6 + (v % 6), fh);
  } else if (F.kind === 'panel') {
    g.fillStyle = F.dark; g.fillRect(px, fy + 8, TILE, 2); g.fillRect(px, fy + fh - 10, TILE, 2); g.fillStyle = rgba(d.accent, 0.5); g.fillRect(px, fy + fh - 4, TILE, 2);
  } else if (F.kind === 'glass') {
    g.fillStyle = F.dark; for (let c = 0; c <= TILE; c += 12) g.fillRect(px + c, fy, 1.6, fh); g.fillRect(px, fy + fh * 0.5, TILE, 1.6);
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.beginPath(); g.moveTo(px, fy + fh); g.lineTo(px + 18, fy); g.lineTo(px + 28, fy); g.lineTo(px + 10, fy + fh); g.fill();
  } else {
    g.fillStyle = F.dark; for (let k = 0; k < 5; k++) g.fillRect(px + ((v * (k + 2)) % 40), fy + ((v * (k + 7)) % Math.max(1, fh - 8)), 8 + k * 2, 4);
    g.fillStyle = 'rgba(120,170,60,0.4)'; g.fillRect(px + (v % 24), fy + fh - 9, 20, 6);
  }
  // ventanas, puerta o persiana
  const hv = hash2(x, y, world.seed + 3), hw = hash2(x * 3 + 1, y, world.seed + 4);
  const wy = full ? py + 6 : fy + 4, wh = 11;
  if (!full) {
    if (hv < 0.10) { // puerta
      g.fillStyle = INK; g.fillRect(px + 14, fy + 4, 20, fh - 4); g.fillStyle = hw < 0.5 ? '#2c2a38' : rgba(d.accent, 0.55); g.fillRect(px + 16, fy + 6, 16, fh - 6);
      g.fillStyle = '#ffd81f'; g.fillRect(px + 28, fy + 14, 2.5, 2.5);
    } else if (hv < 0.22) { // persiana metálica con pintada
      g.fillStyle = INK; g.fillRect(px + 5, fy + 3, TILE - 10, fh - 3); g.fillStyle = '#6b6877'; g.fillRect(px + 7, fy + 5, TILE - 14, fh - 5);
      g.fillStyle = 'rgba(0,0,0,0.3)'; for (let k = 7; k < fh - 2; k += 3) g.fillRect(px + 7, fy + k, TILE - 14, 1);
      g.save(); g.translate(px + TILE / 2, fy + fh - 6); g.rotate(-0.1); g.font = `bold 13px ${FONT_TAG}`; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = INK; g.strokeText(TAGS[Math.floor(hw * TAGS.length)], 0, 0); g.fillStyle = TAG_COLS[(v + 2) % TAG_COLS.length]; g.fillText(TAGS[Math.floor(hw * TAGS.length)], 0, 0); g.restore();
    } else {
      for (let k = 0; k < 2; k++) {
        const hh = hash2(x * 5 + k, y, world.seed + 9), kind = hh < 0.28 ? 1 : hh < 0.42 ? 2 : hh < 0.58 ? 3 : hh < 0.66 ? 4 : 0;
        drawWindow(g, px + 7 + k * 21, wy, 12, wh, kind, d.accent, v);
        if (hh > 0.88) { g.fillStyle = INK; g.fillRect(px + 6 + k * 21, wy + wh + 3, 15, 8); g.fillStyle = '#8a8798'; g.fillRect(px + 7 + k * 21, wy + wh + 4, 13, 6); g.fillStyle = '#3a3846'; g.beginPath(); g.arc(px + 13.5 + k * 21, wy + wh + 7, 2.6, 0, TAU); g.fill(); } // aire acondicionado
        else if (hh > 0.8 && hh <= 0.88) { g.fillStyle = INK; g.fillRect(px + 6 + k * 21, wy + wh + 2, 15, 5); g.fillStyle = '#3f7a3a'; g.fillRect(px + 7 + k * 21, wy + wh + 1, 13, 4); } // jardinera
      }
      if (hv > 0.82 && hv < 0.92) { // pintada de spray
        g.save(); g.translate(px + TILE / 2, fy + fh - 5); g.rotate((hw - 0.5) * 0.3); g.font = `bold 15px ${FONT_TAG}`; g.textAlign = 'center'; g.lineWidth = 3.5; g.strokeStyle = INK; const w = TAGS[Math.floor(hw * TAGS.length)]; g.strokeText(w, 0, 0); g.fillStyle = TAG_COLS[(v + 4) % TAG_COLS.length]; g.fillText(w, 0, 0); g.restore();
      } else if (hv > 0.94) { // cartel pegado
        g.save(); g.translate(px + 30, fy + 11); g.rotate((hw - 0.5) * 0.5); g.fillStyle = INK; g.fillRect(-8, -9, 16, 20); g.fillStyle = TAG_COLS[v % TAG_COLS.length]; g.fillRect(-6.5, -7.5, 13, 17); g.fillStyle = INK; g.fillRect(-4, -3, 8, 2); g.fillRect(-4, 2, 8, 2); g.restore();
      }
    }
  }
  // sombra del alero y borde inferior de tinta
  g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(px, fy, TILE, 3);
  g.fillStyle = INK; g.fillRect(px, py + TILE - 3, TILE, 3); g.fillRect(px, fy - 1, TILE, 2);
}

function drawHouseDoor(g, world, px, py, side, d) { // side 2 = mitad izquierda, 3 = mitad derecha (puerta doble de 2 tiles)
  g.save(); g.beginPath(); g.rect(px, py, TILE, TILE); g.clip();
  const F = FACADE[d.id];
  g.fillStyle = F.base; g.fillRect(px, py, TILE, TILE);
  g.fillStyle = F.dark; for (let r = 0; r < 6; r++) g.fillRect(px, py + r * 8 + 6, TILE, 1.4);
  const cx = side === 2 ? px + TILE : px;       // centro de la puerta doble (borde común de las 2 tiles)
  g.fillStyle = INK; g.fillRect(cx - 40, py + 8, 80, TILE - 8);                  // marco
  g.fillStyle = '#13402a'; g.fillRect(cx - 36, py + 12, 33, TILE - 12); g.fillRect(cx + 3, py + 12, 33, TILE - 12);
  g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(cx - 36, py + 12, 33, 4); g.fillRect(cx + 3, py + 12, 33, 4);
  g.fillStyle = '#5dff9a'; g.fillRect(cx - 30, py + 18, 21, 12); g.fillRect(cx + 9, py + 18, 21, 12);     // cristales iluminados
  g.fillStyle = INK; g.fillRect(cx - 21, py + 18, 2, 12); g.fillRect(cx + 19, py + 18, 2, 12);
  g.fillStyle = '#ffd81f'; g.fillRect(cx - 8, py + 30, 3, 9); g.fillRect(cx + 5, py + 30, 3, 9);          // tiradores
  g.fillStyle = INK; g.fillRect(cx - 1, py + 12, 2, TILE - 12);
  // toldo a rayas
  for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#f2ecda' : '#2fbf71'; g.fillRect(cx - 44 + k * 11, py, 11, 9); }
  g.fillStyle = INK; g.fillRect(cx - 44, py + 8, 88, 3);
  g.fillStyle = INK; g.fillRect(px, py + TILE - 3, TILE, 3);
  g.restore();
}

function renderChunk(world, ccx, ccy) {
  const size = CH * TILE;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.textBaseline = 'middle'; g.textAlign = 'center';
  const tile = (x, y) => world.tileAt(x, y);
  for (let ty = 0; ty < CH; ty++) for (let tx = 0; tx < CH; tx++) {
    const x = ccx * CH + tx, y = ccy * CH + ty, px = tx * TILE, py = ty * TILE;
    if (x < 0 || y < 0 || x >= WW || y >= WH) { g.fillStyle = '#030208'; g.fillRect(px, py, TILE, TILE); continue; }
    const i = y * WW + x, t = world.t[i], d = DISTRICTS[world.d[i]], v = world.v[i];
    const rot = x >= WB * BLOCK ? x - WB * BLOCK : x % BLOCK, roy = y >= WB * BLOCK ? y - WB * BLOCK : y % BLOCK;
    if (t === T.ROAD) {
      g.fillStyle = '#201e2b'; g.fillRect(px, py, TILE, TILE);
      g.fillStyle = `rgba(255,255,255,${0.012 + (v % 9) * 0.003})`; g.fillRect(px, py, TILE, TILE);
      for (let k = 0; k < 7; k++) { g.fillStyle = k % 2 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.28)'; g.fillRect(px + ((v * (k + 3) + k * 17) % 44), py + ((v * (k + 5) + k * 29) % 44), 2 + (k % 3), 2); }
      const hStrip = roy < 3 && rot >= 3, vStrip = rot < 3 && roy >= 3;
      g.fillStyle = 'rgba(255,208,40,0.62)';
      if (hStrip && roy === 1) { for (let k = 0; k < 2; k++) g.fillRect(px + 4 + k * 24, py + TILE / 2 - 2, 15, 4); }
      if (vStrip && rot === 1) { for (let k = 0; k < 2; k++) g.fillRect(px + TILE / 2 - 2, py + 4 + k * 24, 4, 15); }
      g.fillStyle = 'rgba(236,230,214,0.34)';
      if (hStrip && (rot === 3 || rot === 10)) { for (let k = 0; k < 5; k++) g.fillRect(px + 8, py + 4 + k * 9, TILE - 16, 4.5); }
      if (vStrip && (roy === 3 || roy === 10)) { for (let k = 0; k < 5; k++) g.fillRect(px + 4 + k * 9, py + 8, 4.5, TILE - 16); }
      if (v % 11 === 0) { g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(px + 4, py + 10 + (v % 20)); g.lineTo(px + 18, py + 18 + (v % 9)); g.lineTo(px + 26, py + 14 + (v % 12)); g.lineTo(px + 44, py + 26); g.stroke(); }
      if (v % 61 === 0) { g.fillStyle = '#25222d'; g.beginPath(); g.arc(px + 24, py + 24, 12, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 2.5; g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(px + 14, py + 24); g.lineTo(px + 34, py + 24); g.moveTo(px + 24, py + 14); g.lineTo(px + 24, py + 34); g.stroke(); }
      if (v > 235) { g.fillStyle = rgba(d.accent, 0.12); g.beginPath(); g.ellipse(px + 24, py + 26, 15 + (v % 5), 8, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(px + 14, py + 22, 14, 2); }
      if (v > 244) { g.save(); g.translate(px + 24, py + 24); g.rotate(((v % 7) - 3) * 0.08); g.font = `bold 17px ${FONT_TAG}`; g.lineWidth = 3; g.strokeStyle = INK; g.fillStyle = TAG_COLS[v % TAG_COLS.length]; g.strokeText(TAGS[v % TAGS.length], 0, 0); g.fillText(TAGS[v % TAGS.length], 0, 0); g.restore(); }
    } else if (t === T.WALK || t === T.FLOOR || t === T.CRATE || t === T.TOXIC) {
      if (t === T.WALK) {
        g.fillStyle = d.walk; g.fillRect(px, py, TILE, TILE);
        g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(px, py, TILE, TILE);
        g.strokeStyle = 'rgba(0,0,0,0.34)'; g.lineWidth = 2; g.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
        g.fillStyle = 'rgba(255,255,255,0.045)'; g.fillRect(px + 2, py + 2, TILE - 4, 3);
        if (v % 7 === 0) { g.fillStyle = 'rgba(0,0,0,0.30)'; g.beginPath(); g.arc(px + 8 + (v % 30), py + 8 + ((v * 3) % 30), 2 + (v % 3), 0, TAU); g.fill(); }
        if (v % 19 === 0) { g.fillStyle = '#e8dcb0'; g.fillRect(px + 12 + (v % 20), py + 14 + (v % 16), 5, 3); }
        if (v % 23 === 0) { g.fillStyle = INK; g.fillRect(px + 14, py + 10, 20, 12); g.fillStyle = '#3a3846'; for (let k = 0; k < 4; k++) g.fillRect(px + 16 + k * 5, py + 11, 2, 10); }
        if (tile(x, y - 1) === T.BUILD) { const gg = g.createLinearGradient(0, py, 0, py + 14); gg.addColorStop(0, 'rgba(0,0,0,0.5)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gg; g.fillRect(px, py, TILE, 14); }
        // bordillo
        const cur = (cx0, cy0, cw0, ch0, ix, iy, iw, ih) => { g.fillStyle = INK; g.fillRect(cx0, cy0, cw0, ch0); g.fillStyle = '#9c97a8'; g.fillRect(ix, iy, iw, ih); };
        if (tile(x, y - 1) === T.ROAD) cur(px, py, TILE, 6, px, py + 1, TILE, 3);
        if (tile(x, y + 1) === T.ROAD) cur(px, py + TILE - 6, TILE, 6, px, py + TILE - 5, TILE, 3);
        if (tile(x - 1, y) === T.ROAD) cur(px, py, 6, TILE, px + 1, py, 3, TILE);
        if (tile(x + 1, y) === T.ROAD) cur(px + TILE - 6, py, 6, TILE, px + TILE - 5, py, 3, TILE);
        // felpudo del piso franco
        const hu = world.hf[(y - 1) * WW + x];
        if (y > 0 && (hu === 2 || hu === 3)) { g.fillStyle = INK; g.fillRect(px + (hu === 2 ? 4 : 0), py + 8, TILE - 4, 14); g.fillStyle = '#2fbf71'; g.fillRect(px + (hu === 2 ? 6 : 0), py + 10, TILE - 8, 10); }
      } else {
        g.fillStyle = d.ground; g.fillRect(px, py, TILE, TILE);
        g.fillStyle = 'rgba(255,255,255,0.045)'; g.fillRect(px, py, TILE, TILE);
        g.strokeStyle = 'rgba(0,0,0,0.30)'; g.lineWidth = 1.5; g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        if (v % 5 === 0) { g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(px + 6, py + 12 + (v % 18)); g.lineTo(px + 20, py + 20 + (v % 10)); g.lineTo(px + 30, py + 16 + (v % 14)); g.lineTo(px + 42, py + 30); g.stroke(); }
        if (v % 9 === 0) { g.fillStyle = rgba(d.accent, 0.10); g.fillRect(px + 8, py + 10, 14, 3); g.fillRect(px + 8, py + 18, 22, 3); }
        if (world.d[i] === 4 && v % 6 === 0) { g.fillStyle = 'rgba(110,170,50,0.5)'; g.beginPath(); g.arc(px + 10 + (v % 26), py + 36, 4, 0, TAU); g.fill(); }
      }
      if (t === T.TOXIC) {
        const grd = g.createRadialGradient(px + 24, py + 24, 2, px + 24, py + 24, 34);
        grd.addColorStop(0, 'rgba(120,255,60,0.55)'); grd.addColorStop(1, 'rgba(40,120,20,0.25)');
        g.fillStyle = '#0a1a08'; g.fillRect(px, py, TILE, TILE);
        g.fillStyle = grd; g.fillRect(px, py, TILE, TILE);
        g.fillStyle = 'rgba(190,255,120,0.5)';
        for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(px + 8 + ((v * (k + 3)) % 32), py + 8 + ((v * (k + 5)) % 32), 2 + k, 0, TAU); g.fill(); }
        g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
      }
      if (t === T.CRATE) {
        g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(px + 7, py + 10, TILE - 8, TILE - 8);
        g.fillStyle = '#7a5634'; g.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
        g.fillStyle = '#5c3e24'; for (let k = 0; k < 4; k++) g.fillRect(px + 4, py + 15 + k * 8 - 4, TILE - 8, 1.6);
        g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(px + 4, py + 4, TILE - 8, 4);
        g.strokeStyle = INK; g.lineWidth = 3; g.strokeRect(px + 4, py + 4, TILE - 8, TILE - 8);
        g.strokeStyle = '#4a3220'; g.lineWidth = 3; g.beginPath(); g.moveTo(px + 8, py + 8); g.lineTo(px + TILE - 8, py + TILE - 8); g.moveTo(px + TILE - 8, py + 8); g.lineTo(px + 8, py + TILE - 8); g.stroke();
        g.fillStyle = TAG_COLS[v % TAG_COLS.length]; g.fillRect(px + 14, py + 18, 7, 7); g.strokeStyle = INK; g.lineWidth = 1.5; g.strokeRect(px + 14, py + 18, 7, 7);
      }
    } else if (t === T.WALL) {
      const F = FACADE[world.d[i]];
      g.fillStyle = d.wall; g.fillRect(px, py, TILE, TILE);
      for (let c0 = 0; c0 < TILE; c0 += 6) { g.fillStyle = (c0 / 6) % 2 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.22)'; g.fillRect(px + c0, py, 3, TILE); }
      g.fillStyle = 'rgba(0,0,0,0.38)'; g.fillRect(px, py + TILE - 10, TILE, 10);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(px, py, TILE, 5);
      g.fillStyle = rgba(F.hi, 0.7); g.fillRect(px, py + TILE / 2 - 2, TILE, 4);
      g.strokeStyle = INK; g.lineWidth = 3; g.strokeRect(px + 1.5, py + 1.5, TILE - 3, TILE - 3);
      if (tile(x, y - 1) !== T.WALL) { g.strokeStyle = '#a9a5b6'; g.lineWidth = 1.5; g.beginPath(); for (let k = 0; k <= 6; k++) { g.lineTo(px + k * 8, py + (k % 2 ? 9 : 1)); } g.stroke(); }  // alambrada
      if (v % 7 === 0) { g.save(); g.translate(px + 24, py + 30); g.rotate(((v % 5) - 2) * 0.07); g.font = `bold 15px ${FONT_TAG}`; g.lineWidth = 3.5; g.strokeStyle = INK; g.fillStyle = TAG_COLS[(v >> 2) % TAG_COLS.length]; g.strokeText(TAGS[v % TAGS.length], 0, 0); g.fillText(TAGS[v % TAGS.length], 0, 0); g.restore(); }
    } else if (t === T.BUILD) {
      const di = world.d[i], F = FACADE[di], hf = world.hf[i];
      // azotea
      g.fillStyle = d.roof; g.fillRect(px, py, TILE, TILE);
      g.fillStyle = 'rgba(255,255,255,0.03)'; g.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
      for (let k = 0; k < 9; k++) { g.fillStyle = k % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.25)'; g.fillRect(px + ((v * (k + 3) + k * 13) % 44), py + ((v * (k + 7) + k * 31) % 44), 2, 2); }
      g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 1.5; g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
      // trastos de azotea
      const hr = hash2(x, y, world.seed + 13);
      if (hf !== 1) {
        if (hr < 0.10) { g.fillStyle = INK; g.fillRect(px + 8, py + 9, 22, 18); g.fillStyle = '#6d6a78'; g.fillRect(px + 10, py + 11, 18, 14); g.fillStyle = '#3a3846'; g.beginPath(); g.arc(px + 19, py + 18, 5.5, 0, TAU); g.fill(); g.strokeStyle = '#9a96a6'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(px + 14, py + 18); g.lineTo(px + 24, py + 18); g.moveTo(px + 19, py + 13); g.lineTo(px + 19, py + 23); g.stroke(); }
        else if (hr < 0.17) { g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(px + 27, py + 31, 14, 6, 0, 0, TAU); g.fill(); g.fillStyle = INK; g.beginPath(); g.arc(px + 24, py + 22, 13, 0, TAU); g.fill(); g.fillStyle = '#7a5a3a'; g.beginPath(); g.arc(px + 24, py + 22, 10.5, 0, TAU); g.fill(); g.strokeStyle = '#4a3220'; g.lineWidth = 1.5; g.beginPath(); g.arc(px + 24, py + 22, 6, 0, TAU); g.stroke(); }
        else if (hr < 0.23) { g.fillStyle = INK; g.fillRect(px + 10, py + 12, 26, 16); g.fillStyle = '#25445a'; g.fillRect(px + 12, py + 14, 22, 12); g.strokeStyle = 'rgba(160,220,255,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(px + 20, py + 14); g.lineTo(px + 20, py + 26); g.moveTo(px + 27, py + 14); g.lineTo(px + 27, py + 26); g.moveTo(px + 12, py + 20); g.lineTo(px + 34, py + 20); g.stroke(); }
        else if (hr < 0.28) { g.fillStyle = INK; g.beginPath(); g.arc(px + 24, py + 22, 11, 0, TAU); g.fill(); g.fillStyle = '#d8d4c4'; g.beginPath(); g.arc(px + 24, py + 22, 8.5, 0, TAU); g.fill(); g.fillStyle = '#8a8698'; g.beginPath(); g.arc(px + 24, py + 22, 3, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(px + 24, py + 22); g.lineTo(px + 33, py + 12); g.stroke(); }
        else if (hr > 0.93) { g.fillStyle = '#ff3355'; g.beginPath(); g.arc(px + 36, py + 12, 3, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.5; g.stroke(); }
      }
      // parapeto en los bordes
      const nb = [tile(x, y - 1) !== T.BUILD, tile(x + 1, y) !== T.BUILD, tile(x, y + 1) !== T.BUILD, tile(x - 1, y) !== T.BUILD];
      const lip = hf === 1 ? '#3d6b56' : F.hi;
      g.fillStyle = INK;
      if (nb[0]) g.fillRect(px, py, TILE, 6); if (nb[1]) g.fillRect(px + TILE - 6, py, 6, TILE); if (nb[3]) g.fillRect(px, py, 6, TILE);
      g.fillStyle = lip;
      if (nb[0]) g.fillRect(px, py + 1, TILE, 3); if (nb[1]) g.fillRect(px + TILE - 5, py, 3, TILE); if (nb[3]) g.fillRect(px + 2, py, 3, TILE);
      if (hf === 1) { g.fillStyle = 'rgba(93,255,154,0.85)'; if (nb[0]) g.fillRect(px, py + 4, TILE, 1.5); if (nb[1]) g.fillRect(px + TILE - 7, py, 1.5, TILE); if (nb[3]) g.fillRect(px + 5, py, 1.5, TILE); }
      if (nb[2]) {
        if (hf === 2 || hf === 3) drawHouseDoor(g, world, px, py, hf, d);
        else drawFacade(g, world, x, y, px, py, di, d, v, false);
      }
      // rótulo "PISO FRANCO" en la azotea sobre la puerta (mitad por tile)
      const hb = y + 1 < WH ? world.hf[(y + 1) * WW + x] : 0;
      if (hf === 1 && (hb === 2 || hb === 3)) {
        const cx = hb === 2 ? px + TILE : px;
        g.save(); g.beginPath(); g.rect(px, py, TILE, TILE); g.clip();
        g.fillStyle = INK; g.fillRect(cx - 42, py + TILE - 26, 84, 20); g.fillStyle = '#0f2a1c'; g.fillRect(cx - 39, py + TILE - 23, 78, 14);
        g.font = `400 13px ${FONT_DISP}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#5dff9a'; g.fillText('PISO FRANCO', cx, py + TILE - 15);
        g.restore();
      }
    } else { // VOID
      g.fillStyle = '#040309'; g.fillRect(px, py, TILE, TILE);
      g.strokeStyle = 'rgba(255,40,90,0.10)'; g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
    }
  }
  // carteles de neón colgados de las fachadas (segunda pasada, con brillo)
  for (let ty = 0; ty < CH - 1; ty++) for (let tx = 1; tx < CH - 1; tx++) {
    const x = ccx * CH + tx, y = ccy * CH + ty;
    if (x < 0 || y < 0 || x >= WW || y >= WH) continue;
    if (world.t[y * WW + x] !== T.BUILD || world.tileAt(x, y + 1) === T.BUILD || world.hf[y * WW + x]) continue;
    if (hash2(x, y, world.seed + 91) > 0.09) continue;
    const d = DISTRICTS[world.d[y * WW + x]];
    const word = d.signs[Math.floor(hash2(x, y, world.seed + 5) * d.signs.length)];
    const col = hash2(x, y, world.seed + 6) < 0.5 ? d.accent : '#ffe14a';
    const sx = tx * TILE + TILE / 2, sy = ty * TILE + TILE - 24, sw = Math.max(34, word.length * 7 + 12);
    g.save(); g.fillStyle = INK; g.fillRect(sx - sw / 2 - 2, sy - 9, sw + 4, 18); g.fillStyle = '#0e0b16'; g.fillRect(sx - sw / 2, sy - 7, sw, 14);
    g.font = `bold 11px ${FONT_UI}`; g.shadowColor = col; g.shadowBlur = 8; g.fillStyle = '#fff'; g.fillText(word, sx, sy + 1); g.fillText(word, sx, sy + 1);
    g.restore();
    g.fillStyle = INK; g.fillRect(sx - sw / 2 - 1, sy - 13, 2, 5); g.fillRect(sx + sw / 2 - 1, sy - 13, 2, 5);
  }
  return c;
}

function drawWorld(ctx, world, camX, camY, vw, vh) {
  const size = CH * TILE;
  const c0 = Math.floor(camX / size), c1 = Math.floor((camX + vw) / size);
  const r0 = Math.floor(camY / size), r1 = Math.floor((camY + vh) / size);
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
    if (cx < -1 || cy < -1 || cx > Math.ceil(WW / CH) || cy > Math.ceil(WH / CH)) continue;
    const key = cx * 1000 + cy;
    let c = _chunks.get(key);
    if (!c) { c = renderChunk(world, cx, cy); _chunks.set(key, c); }
    ctx.drawImage(c, cx * size, cy * size, size + 1, size + 1);
  }
  if (_chunks.size > 46) { // expulsar los lejanos
    const mx = Math.floor((camX + vw / 2) / size), my = Math.floor((camY + vh / 2) / size);
    for (const k of _chunks.keys()) {
      const kx = Math.round(k / 1000), ky = k - kx * 1000;
      if (Math.abs(kx - mx) > 3 || Math.abs(ky - my) > 3) _chunks.delete(k);
      if (_chunks.size <= 36) break;
    }
  }
}
function clearChunkCache() { _chunks.clear(); }
