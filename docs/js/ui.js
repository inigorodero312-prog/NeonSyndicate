'use strict';
// ───────── Entrada, lienzo y utilidades de interfaz (modo inmediato) ─────────
const In = { mx: 0, my: 0, ux: 0, uy: 0, ax: 0, ay: 0, down: false, rdown: false, clicked: false, wheel: 0, keys: {}, pressed: {}, typed: '' };
const U = { s: 1, w: 1280, h: 720, cw: 1280, ch: 720, dpr: 1 };
let canvas = null, ctx = null, vignette = null;

function setupCanvas() {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('keydown', (e) => {
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!e.repeat) In.pressed[e.code] = true;
    In.keys[e.code] = true;
    if (e.key === 'Backspace') In.typed += '\b';
    else if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) In.typed += e.key;
  });
  window.addEventListener('paste', (e) => { try { In.typed += (e.clipboardData.getData('text') || '').replace(/[\r\n]/g, ''); } catch (err) { /* nada */ } });
  window.addEventListener('keyup', (e) => { In.keys[e.code] = false; });
  window.addEventListener('blur', () => { In.keys = {}; In.down = false; });
  // Evita que la rueda haga scroll a la página cuando el juego va dentro de un iframe (recomendación del SDK)
  window.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
  if (typeof TouchUI !== 'undefined') TouchUI.setup();
  canvas.addEventListener('mousemove', (e) => setMouse(e));
  canvas.addEventListener('mousedown', (e) => {
    setMouse(e);
    if (e.button === 0) { In.down = true; In.clicked = true; }
    if (e.button === 2) In.rdown = true;
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) In.down = false; if (e.button === 2) In.rdown = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => { In.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
}
function setMouse(e) {
  const r = canvas.getBoundingClientRect();
  In.mx = (e.clientX - r.left) * (U.cw / r.width);
  In.my = (e.clientY - r.top) * (U.ch / r.height);
  In.ux = In.mx / U.s; In.uy = In.my / U.s;
}
function resizeCanvas() {
  const dpr = clamp(window.devicePixelRatio || 1, 1, 1.5);
  canvas.width = Math.max(320, Math.floor(window.innerWidth * dpr));
  canvas.height = Math.max(240, Math.floor(window.innerHeight * dpr));
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  U.dpr = dpr; U.cw = canvas.width; U.ch = canvas.height;
  U.s = Math.min(U.ch / 720, U.cw / 1100);
  U.w = U.cw / U.s; U.h = U.ch / U.s;
  // viñeta
  vignette = document.createElement('canvas'); vignette.width = U.cw; vignette.height = U.ch;
  const g = vignette.getContext('2d');
  const grd = g.createRadialGradient(U.cw / 2, U.ch / 2, Math.min(U.cw, U.ch) * 0.35, U.cw / 2, U.ch / 2, Math.hypot(U.cw, U.ch) * 0.62);
  grd.addColorStop(0, 'rgba(4,2,12,0)'); grd.addColorStop(1, 'rgba(4,2,12,0.78)');
  g.fillStyle = grd; g.fillRect(0, 0, U.cw, U.ch);
}
const keyDown = (c) => !!In.keys[c];
const keyHit = (c) => !!In.pressed[c];
function endFrameInput() { In.clicked = false; In.pressed = {}; In.wheel = 0; In.typed = ''; }

// ───────── Dibujo de texto y paneles (coordenadas lógicas de la UI) ─────────
// Estilo "pared de barrio": pegatinas con borde blanco y sombra dura, cinta adhesiva, carteles pegados y
// rotulación de spray con contorno de tinta.
const PAPER = '#ece3c8';
const _hasLS = typeof CanvasRenderingContext2D !== 'undefined' && 'letterSpacing' in CanvasRenderingContext2D.prototype;
function setLS(px) { if (_hasLS) ctx.letterSpacing = px + 'px'; }

function text(str, x, y, size = 16, color = '#fff', align = 'left', weight = '600', glow = null, font = FONT_UI) {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 6; }
  ctx.fillStyle = color; ctx.fillText(str, x, y);
  if (glow) { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }
}
function textW(str, size = 16, weight = '600', font = FONT_UI) {
  ctx.font = `${weight} ${size}px ${font}`;
  return ctx.measureText(str).width;
}
// Texto de cartel: tipografía gruesa, contorno de tinta y sombra dura (para títulos, números y etiquetas)
function dispText(str, x, y, size, color = '#fff', align = 'left', o = {}) {
  ctx.font = `400 ${size}px ${FONT_DISP}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round'; setLS(o.ls === undefined ? size * 0.03 : o.ls);
  const lw = o.lw === undefined ? Math.max(2.5, size * 0.14) : o.lw, sh = o.sh === undefined ? Math.max(2, size * 0.09) : o.sh;
  if (lw > 0) {
    ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.fillStyle = INK;
    if (sh) { ctx.strokeText(str, x + sh, y + sh); ctx.fillText(str, x + sh, y + sh); }
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = color; ctx.fillText(str, x, y);
  setLS(0);
}
function dispW(str, size) { ctx.font = `400 ${size}px ${FONT_DISP}`; setLS(size * 0.03); const w = ctx.measureText(str).width; setLS(0); return w; }
function wrapText(str, x, y, maxW, lh, size = 15, color = '#c9d3ea', align = 'left', weight = '500') {
  ctx.font = `${weight} ${size}px ${FONT_UI}`;
  const words = str.split(' '); let line = '', n = 0;
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { text(line, x, y + n * lh, size, color, align, weight); n++; line = w; }
    else line = t;
  }
  if (line) { text(line, x, y + n * lh, size, color, align, weight); n++; }
  return n;
}
function rrect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
function chamfer(x, y, w, h, c) { rrect(x, y, w, h, Math.min(c * 0.5, 7)); }

let _noisePat = null;
function noisePattern() {
  if (_noisePat) return _noisePat;
  const c = document.createElement('canvas'); c.width = c.height = 96;
  const g = c.getContext('2d'), r = new RNG(77);
  for (let i = 0; i < 1100; i++) {
    const a = r.range(0.03, 0.13);
    g.fillStyle = r.chance(0.5) ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a * 1.7})`;
    g.fillRect(r.int(0, 95), r.int(0, 95), r.chance(0.2) ? 2 : 1, r.chance(0.1) ? 2 : 1);
  }
  return (_noisePat = ctx.createPattern(c, 'repeat'));
}
// Cinta adhesiva (esquinas de los carteles)
function tape(x, y, rot, w = 54, h = 17) {
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-w / 2 + 2, -h / 2 + 3, w, h);
  ctx.fillStyle = 'rgba(230,218,170,0.88)'; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(-w / 2, -h / 2, w, h * 0.3);
  ctx.strokeStyle = 'rgba(70,58,30,0.5)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let k = 0; k < 3; k++) { ctx.moveTo(-w / 2, -h / 2 + 3 + k * 5); ctx.lineTo(-w / 2 + 3, -h / 2 + 4.5 + k * 5); ctx.moveTo(w / 2, -h / 2 + 3 + k * 5); ctx.lineTo(w / 2 - 3, -h / 2 + 4.5 + k * 5); }
  ctx.stroke(); ctx.restore();
}
// Cartel de papel pegado (bordes rotos). Devuelve nada; el contenido se dibuja encima.
function paper(x, y, w, h, o = {}) {
  const rot = o.rot || 0, col = o.col || PAPER, r = new RNG(Math.floor(x * 7 + y * 13 + w) >>> 0);
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot);
  const pts = [], n = Math.max(8, Math.round((w + h) / 24));
  const edge = (ax, ay, bx, by, k) => { for (let i = 0; i < k; i++) { const t = i / k; pts.push([ax + (bx - ax) * t + r.range(-2.2, 2.2), ay + (by - ay) * t + r.range(-2.2, 2.2)]); } };
  edge(-w / 2, -h / 2, w / 2, -h / 2, n); edge(w / 2, -h / 2, w / 2, h / 2, n >> 1); edge(w / 2, h / 2, -w / 2, h / 2, n); edge(-w / 2, h / 2, -w / 2, -h / 2, n >> 1);
  const path = () => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); };
  ctx.save(); ctx.translate(5, 6); path(); ctx.fillStyle = 'rgba(5,3,10,0.7)'; ctx.fill(); ctx.restore();
  path(); ctx.fillStyle = col; ctx.fill();
  ctx.save(); path(); ctx.clip(); ctx.fillStyle = noisePattern(); ctx.globalAlpha = 0.55; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(0,0,0,0.07)'; ctx.fillRect(-w / 2, -h / 2 + h * 0.5 - 1, w, 2);   // pliegue
  ctx.restore();
  path(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
  if (o.tape !== false && w > 90) { tape(-w / 2 - 6, -h / 2 - 5, -0.5, 46, 15); tape(w / 2 - 40, -h / 2 - 6, 0.45, 46, 15); }
  ctx.restore();
}

function panel(x, y, w, h, accent = '#19f0ff', alpha = 0.86, cut = 12) {
  const r = 5;
  ctx.fillStyle = 'rgba(5,3,10,0.8)'; rrect(x + 6, y + 7, w, h, r); ctx.fill();            // sombra dura
  rrect(x - 2, y - 2, w + 4, h + 4, r + 2); ctx.fillStyle = INK; ctx.fill();
  rrect(x, y, w, h, r); ctx.fillStyle = `rgba(19,16,27,${Math.min(0.985, alpha + 0.1)})`; ctx.fill();
  ctx.save(); rrect(x, y, w, h, r); ctx.clip();
  ctx.fillStyle = noisePattern(); ctx.fillRect(x, y, w, h);
  ctx.fillStyle = accent; ctx.fillRect(x, y, w, 7);                                         // franja de acento con rayas
  ctx.fillStyle = 'rgba(11,10,16,0.6)'; ctx.beginPath();
  for (let k = -1; k < w / 16 + 1; k++) { const px = x + k * 16; ctx.moveTo(px, y + 7); ctx.lineTo(px + 7, y); ctx.lineTo(px + 14, y); ctx.lineTo(px + 7, y + 7); }
  ctx.fill();
  ctx.strokeStyle = rgba(accent, 0.28); ctx.lineWidth = 1.5; ctx.strokeRect(x + 7.5, y + 14.5, w - 15, h - 22);
  ctx.restore();
  rrect(x + 1, y + 1, w - 2, h - 2, r); ctx.strokeStyle = 'rgba(236,227,200,0.85)'; ctx.lineWidth = 2; ctx.stroke(); // borde de pegatina
  if (w > 170 && h > 70) { tape(x + 12, y - 8, -0.16); tape(x + w - 62, y - 9, 0.14); }
}
function uiButton(x, y, w, h, label, o = {}) {
  const accent = o.accent || '#19f0ff', disabled = !!o.disabled;
  const hover = !disabled && In.ux >= x && In.ux <= x + w && In.uy >= y && In.uy <= y + h;
  const rot = hover ? 0 : (hash2(label.length * 31 + label.charCodeAt(0), Math.round(x) + Math.round(y) * 3, 11) - 0.5) * 0.03;
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot); if (hover) ctx.translate(-1, -2);
  const bx = -w / 2, by = -h / 2, off = hover ? 7 : 4;
  ctx.fillStyle = 'rgba(5,3,10,0.85)'; rrect(bx + off, by + off + 1, w, h, 6); ctx.fill();
  rrect(bx, by, w, h, 6); ctx.fillStyle = disabled ? '#2b2931' : hover ? accent : '#1b1823'; ctx.fill();
  ctx.save(); rrect(bx, by, w, h, 6); ctx.clip();
  if (disabled) { ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 3; ctx.beginPath(); for (let k = -h; k < w; k += 10) { ctx.moveTo(bx + k, by + h); ctx.lineTo(bx + k + h, by); } ctx.stroke(); }
  else if (hover) { ctx.fillStyle = 'rgba(255,255,255,0.24)'; ctx.fillRect(bx, by, w, h * 0.4); }
  else { ctx.fillStyle = accent; ctx.fillRect(bx, by, 9, h); ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(bx + 9, by, w - 9, h * 0.5); }
  ctx.restore();
  rrect(bx, by, w, h, 6); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  rrect(bx + 2.5, by + 2.5, w - 5, h - 5, 4); ctx.lineWidth = 1.5; ctx.strokeStyle = disabled ? 'rgba(200,200,210,0.22)' : hover ? 'rgba(11,10,16,0.55)' : 'rgba(236,227,200,0.7)'; ctx.stroke();
  let size = (o.size || 18) * 1.1; const maxW = w - (hover || disabled ? 22 : 34);
  while (size > 11 && dispW(label, size) > maxW) size -= 0.5;
  const ty = o.sub ? by + h / 2 - 1 : by + h / 2 + size * 0.36;
  dispText(label, 4, ty, size, disabled ? '#85838f' : hover ? INK : '#fff', 'center', { lw: hover || disabled ? 0 : Math.max(2, size * 0.09), sh: 0 });
  if (o.sub) text(o.sub, 4, by + h - 9, 12, disabled ? '#77757f' : hover ? INK : accent, 'center', '700');
  ctx.restore();
  if (hover && In.clicked) { In.clicked = false; Snd.play('click'); return true; }
  return false;
}
function hbar(x, y, w, h, frac, color, bg = '#2a2634') {
  ctx.fillStyle = INK; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
  const fw = Math.max(0, w * clamp(frac, 0, 1));
  ctx.fillStyle = color; ctx.fillRect(x, y, fw, h);
  if (h >= 7) { ctx.fillStyle = 'rgba(255,255,255,0.30)'; ctx.fillRect(x, y, fw, Math.max(1, h * 0.28)); ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(x, y + h * 0.72, fw, h * 0.28); }
  if (h >= 10) { ctx.fillStyle = 'rgba(11,10,16,0.5)'; for (let tx = x + 16; tx < x + fw; tx += 16) ctx.fillRect(tx, y, 2, h); }
}
function hoverRect(x, y, w, h) { return In.ux >= x && In.ux <= x + w && In.uy >= y && In.uy <= y + h; }

// ───────── Rotulación de graffiti (letra a letra, con contorno, relieve, brillo y chorretones) ─────────
const _sprayCache = new Map();
function sprayText(str, x, y, size, fill, o = {}) {
  const align = o.align || 'center', rot = o.rot || 0, jit = o.jitter === undefined ? 1 : o.jitter, s = U.s;
  const key = [str, size, fill, align, jit, o.drips, o.ext, o.shadow, o.dripLen, s].join('|');
  let e = _sprayCache.get(key);
  if (!e) {
    if (_sprayCache.size > 90) _sprayCache.clear();
    const m = document.createElement('canvas').getContext('2d');
    m.font = `400 ${size}px ${FONT_DISP}`;
    const ls = size * 0.045, chars = [...str], ws = chars.map(c => m.measureText(c).width + ls);
    const total = ws.reduce((a, b) => a + b, 0) - ls, pad = size * 0.5, W = Math.ceil(total + pad * 2), Hh = Math.ceil(size * 2.1), base = size * 1.25;
    const c = document.createElement('canvas'); c.width = Math.ceil(W * s); c.height = Math.ceil(Hh * s);
    const g = c.getContext('2d'); g.scale(s, s); g.font = `400 ${size}px ${FONT_DISP}`; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
    const lw = Math.max(3, size * 0.16), ext = o.ext === undefined ? Math.max(2, Math.round(size * 0.09)) : o.ext;
    let cx = pad; const pos = [];
    chars.forEach((ch, i) => {
      if (ch === ' ') { cx += ws[i]; return; }
      const a = (hash2(i * 17 + chars.length * 3, size | 0, 5) - 0.5) * 0.12 * jit, dy = (hash2(i, chars.length, 9) - 0.5) * size * 0.07 * jit;
      g.save(); g.translate(cx + (ws[i] - ls) / 2, base + dy); g.rotate(a); g.translate(-(ws[i] - ls) / 2, 0);
      g.strokeStyle = INK; g.fillStyle = o.shadow || INK; g.lineWidth = lw;
      for (let k = ext; k >= 1; k--) { g.strokeText(ch, k * 0.7, k); g.fillText(ch, k * 0.7, k); }
      g.strokeText(ch, 0, 0); g.fillStyle = fill; g.fillText(ch, 0, 0);
      g.save(); g.beginPath(); g.rect(-size * 0.2, -size * 1.1, ws[i] + size * 0.4, size * 0.62); g.clip(); g.fillStyle = 'rgba(255,255,255,0.34)'; g.fillText(ch, 0, 0); g.restore();
      g.restore(); pos.push({ x: cx + (ws[i] - ls) / 2, dy, w: ws[i] }); cx += ws[i];
    });
    if (o.drips !== false) pos.forEach((p, i) => {
      if (hash2(i * 5 + 1, chars.length, 21) > 0.30) return;
      const len = size * (0.22 + (o.dripLen === undefined ? 0.4 : o.dripLen) * hash2(i, 3, 33)), dx = p.x + (hash2(i, 9, 4) - 0.5) * p.w * 0.4, y0 = base + p.dy + size * 0.02;
      g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = size * 0.1 + 3.5; g.beginPath(); g.moveTo(dx, y0); g.lineTo(dx, y0 + len); g.stroke();
      g.strokeStyle = fill; g.lineWidth = size * 0.1; g.beginPath(); g.moveTo(dx, y0 - 2); g.lineTo(dx, y0 + len); g.stroke();
      g.fillStyle = fill; g.beginPath(); g.arc(dx, y0 + len, size * 0.075, 0, TAU); g.fill();
    });
    e = { c, W, Hh, base, total, pad }; _sprayCache.set(key, e);
  }
  const ox = align === 'center' ? -e.total / 2 : align === 'right' ? -e.total : 0;
  ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
  ctx.drawImage(e.c, ox - e.pad, -e.base, e.W, e.Hh);
  ctx.restore();
  return e.total;
}
function sprayW(str, size) { const m = document.createElement('canvas').getContext('2d'); m.font = `400 ${size}px ${FONT_DISP}`; return [...str].reduce((a, c) => a + m.measureText(c).width + size * 0.045, 0) - size * 0.045; }

// Lluvia (pantalla)
const rain = [];
for (let i = 0; i < 90; i++) rain.push({ x: Math.random(), y: Math.random(), s: 0.7 + Math.random() * 0.8 });
function drawRain(dt) {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.strokeStyle = 'rgba(170,205,255,0.22)'; ctx.lineWidth = 1; ctx.beginPath();
  for (const r of rain) {
    r.y += dt * 1.4 * r.s; r.x -= dt * 0.18 * r.s;
    if (r.y > 1) { r.y = -0.05; r.x = Math.random() * 1.2; }
    if (r.x < -0.1) r.x = 1.1;
    const x = r.x * U.cw, y = r.y * U.ch;
    ctx.moveTo(x, y); ctx.lineTo(x - 4 * U.s, y + 16 * U.s);
  }
  ctx.stroke(); ctx.restore();
}
