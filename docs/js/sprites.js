'use strict';
// ───────── Sprites cenitales (vista desde arriba) de jugadores y enemigos, estilo calle ─────────
// Cada uno se pinta una vez mirando a +x con contorno de tinta, y al dibujarlo se gira hacia donde apunta.
const TopArt = (() => {
  const RES = 2, cache = {};
  const mixc = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`; };
  function canvasFor(w, h) {
    const c = document.createElement('canvas'); c.width = Math.ceil(w * RES); c.height = Math.ceil(h * RES);
    const g = c.getContext('2d'); g.scale(RES, RES); g.translate(w / 2, h / 2); g.lineJoin = 'round'; g.lineCap = 'round';
    return { c, g, w, h };
  }
  const fillInk = (g, fill, lw = 3) => { g.fillStyle = fill; g.fill(); g.lineWidth = lw; g.strokeStyle = INK; g.stroke(); };
  const ellipse = (g, x, y, rx, ry, fill, lw = 3, rot = 0) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); fillInk(g, fill, lw); };
  const rect = (g, x, y, w, h, fill, lw = 2.5, r = 2) => { rrectPath(g, x, y, w, h, r); fillInk(g, fill, lw); };
  function rrectPath(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r);
    g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  const poly = (g, pts, fill, lw = 2.5) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); fillInk(g, fill, lw); };
  // brazo: cápsula con contorno
  function arm(g, x1, y1, x2, y2, w, fill) {
    g.strokeStyle = INK; g.lineWidth = w + 4; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.strokeStyle = fill; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  }
  const shade = (g, x, y, rx, ry, rot = 0) => { g.fillStyle = 'rgba(255,255,255,0.16)'; g.beginPath(); g.ellipse(x - rx * 0.18, y - ry * 0.28, rx * 0.7, ry * 0.5, rot, 0, TAU); g.fill(); };

  // ───── Jugadores ─────
  const players = {
    solo(g) { // bomber negra, gorra negra con visera amarilla
      arm(g, 1, -12, 14, -5, 6.5, '#1d1c26'); arm(g, 1, 12, 14, 5, 6.5, '#1d1c26');
      ellipse(g, 0, 0, 9.5, 15.5, '#1d1c26'); shade(g, 0, 0, 9.5, 15.5);
      g.fillStyle = '#ffd400'; g.fillRect(-9, -3.5, 4, 7); g.fillRect(-1, -14, 2.4, 6); g.fillRect(-1, 8, 2.4, 6);
      ellipse(g, 15.5, -4.5, 3.6, 3.6, '#c98b5d', 2); ellipse(g, 15.5, 4.5, 3.6, 3.6, '#c98b5d', 2);
      ellipse(g, 0, 0, 8.2, 8.2, '#c98b5d', 2.5);
      poly(g, [[5, -6.5], [14.5, -5], [14.5, 5], [5, 6.5]], '#ffd400', 2.5);                       // visera
      g.beginPath(); g.arc(0, 0, 7.8, 0, TAU); fillInk(g, '#1b1a22', 2.5); g.fillStyle = '#ffd400'; g.beginPath(); g.arc(0, 0, 2.2, 0, TAU); g.fill();
    },
    kira(g) { // sudadera negra con vivos lima, pelo lima, cascos rosas
      arm(g, 1, -12, 14, -5, 6, '#22212c'); arm(g, 1, 12, 14, 5, 6, '#22212c');
      ellipse(g, 0, 0, 9, 15, '#22212c'); shade(g, 0, 0, 9, 15);
      g.fillStyle = '#a6ff3c'; g.fillRect(-9, -2, 4.5, 4); g.fillRect(2, -14, 2.2, 6); g.fillRect(2, 8, 2.2, 6);
      ellipse(g, 15, -4.5, 3.4, 3.4, '#f2d0b6', 2); ellipse(g, 15, 4.5, 3.4, 3.4, '#f2d0b6', 2);
      poly(g, [[-9, -4], [-16, -7], [-12, 0], [-16, 7], [-9, 4]], '#7ecf2a', 2.2);               // coletas de pelo
      ellipse(g, 0, 0, 8.6, 8.6, '#a6ff3c', 2.5);
      g.fillStyle = 'rgba(20,90,10,0.35)'; g.beginPath(); g.ellipse(-1, 2, 6.5, 5.5, 0, 0, TAU); g.fill();
      rect(g, -3.5, -12, 7, 4.2, '#ff2e88', 2, 2); rect(g, -3.5, 7.8, 7, 4.2, '#ff2e88', 2, 2);   // auriculares
      g.strokeStyle = '#ff2e88'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-1, -8); g.lineTo(-1, 8); g.stroke();
      g.fillStyle = 'rgba(20,255,120,0.85)'; g.fillRect(6, -6, 3, 12);                              // visor holográfico
    },
    mox(g) { // chaleco naranja sobre sudadera gris, casco con gafas de soldador
      arm(g, 1, -12, 14, -5, 6.8, '#707483'); arm(g, 1, 12, 14, 5, 6.8, '#707483');
      ellipse(g, 0, 0, 10, 15.5, '#707483'); ellipse(g, 0, 0, 8, 14, '#ff7a1a', 2.5); shade(g, 0, 0, 8, 14);
      g.fillStyle = '#f4f0e6'; g.fillRect(-6, -9, 3, 18); g.fillRect(2, -9, 3, 18);
      ellipse(g, 15.5, -4.5, 3.8, 3.8, '#d1a56c', 2); ellipse(g, 15.5, 4.5, 3.8, 3.8, '#d1a56c', 2);
      ellipse(g, 0, 0, 8.6, 8.6, '#92603d', 2.5);
      g.beginPath(); g.arc(-0.5, 0, 8, 0, TAU); fillInk(g, '#ff8a1a', 2.5); shade(g, -0.5, 0, 8, 8);
      g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(-6, 0); g.lineTo(2, 0); g.stroke();
      ellipse(g, 6.5, -3.6, 3, 3, '#ffe14a', 2); ellipse(g, 6.5, 3.6, 3, 3, '#ffe14a', 2);
    },
    ronin(g) { // chaqueta negra con vivos cian, moño y cresta cian
      arm(g, 1, -12, 14, -5, 6.2, '#18171f'); arm(g, 1, 12, 14, 5, 6.2, '#18171f');
      ellipse(g, 0, 0, 9.2, 15.5, '#18171f'); shade(g, 0, 0, 9.2, 15.5);
      g.fillStyle = '#19e0ff'; g.fillRect(-9, -2, 5, 4); g.fillRect(-2, -14, 2.4, 6); g.fillRect(-2, 8, 2.4, 6);
      ellipse(g, 15, -4.5, 3.4, 3.4, '#d9b48a', 2); ellipse(g, 15, 4.5, 3.4, 3.4, '#d9b48a', 2);
      ellipse(g, -8, 0, 4.6, 4.6, '#111017', 2.2);                                                     // moño
      ellipse(g, 0, 0, 8.4, 8.4, '#d9b48a', 2.5);
      g.beginPath(); g.arc(0, 0, 7.8, 0, TAU); fillInk(g, '#111017', 2.5);
      poly(g, [[-7, -2.6], [-3, -4.4], [2, -2.8], [8, -2], [8, 2], [2, 2.8], [-3, 4.4], [-7, 2.6]], '#19e0ff', 2);  // cresta cian
      g.fillStyle = '#f3f1ea'; g.fillRect(3.4, -8, 2.6, 16);                                           // cinta
    },
  };

  // ───── Enemigos ─────
  const SOFT = { kamikaze: 1, welder: 1, phantom: 1, medic: 1, spitter: 1 };
  const enemies = {
    grunt(g, r, col) { // pandillero: sudadera, pañuelo del color de la banda, pistola
      const hood = mixc(col, '#15101c', 0.62);
      arm(g, r * 0.1, -r * 0.95, r * 1.0, -r * 0.3, r * 0.5, hood); arm(g, r * 0.1, r * 0.95, r * 1.0, r * 0.3, r * 0.5, hood);
      ellipse(g, 0, 0, r * 0.8, r * 1.18, hood); shade(g, 0, 0, r * 0.8, r * 1.18);
      g.fillStyle = col; g.fillRect(-r * 0.78, -r * 0.18, r * 0.32, r * 0.36);
      ellipse(g, r * 1.05, -r * 0.3, r * 0.3, r * 0.3, '#c99a76', 2); ellipse(g, r * 1.05, r * 0.3, r * 0.3, r * 0.3, '#c99a76', 2);
      poly(g, [[-r * 0.55, -r * 0.1], [-r * 1.12, -r * 0.34], [-r * 0.95, 0], [-r * 1.12, r * 0.34], [-r * 0.55, r * 0.1]], col, 2);   // nudo del pañuelo
      ellipse(g, 0, 0, r * 0.62, r * 0.62, '#c99a76', 2.5);
      g.beginPath(); g.arc(-r * 0.05, 0, r * 0.64, -2.1, 2.1, true); g.lineTo(-r * 0.05 + Math.cos(2.1) * r * 0.64, Math.sin(2.1) * r * 0.64); g.closePath(); g.fillStyle = col; g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
      rect(g, r * 0.9, -r * 0.2, r * 0.95, r * 0.4, '#2a2833', 2.2, 1.5);
    },
    thug(g, r, col) { // matón: cazadora de cuero con pinchos y bate
      const jk = mixc(col, '#20120a', 0.55);
      arm(g, 0, -r * 1.05, r * 0.95, -r * 0.45, r * 0.62, jk); arm(g, 0, r * 1.05, r * 0.95, r * 0.45, r * 0.62, jk);
      ellipse(g, 0, 0, r * 0.88, r * 1.3, jk); shade(g, 0, 0, r * 0.88, r * 1.3);
      for (const sy of [-1, 1]) for (let k = 0; k < 3; k++) poly(g, [[-r * 0.25 + k * r * 0.3, sy * r * 1.15], [-r * 0.1 + k * r * 0.3, sy * r * 1.62], [r * 0.05 + k * r * 0.3, sy * r * 1.15]], '#c9c5d4', 1.8);
      ellipse(g, r * 0.95, -r * 0.45, r * 0.33, r * 0.33, '#b98a64', 2); ellipse(g, r * 0.95, r * 0.45, r * 0.33, r * 0.33, '#b98a64', 2);
      arm(g, r * 0.95, r * 0.45, r * 2.1, -r * 0.35, r * 0.34, '#8a5a30');
      ellipse(g, r * 2.1, -r * 0.35, r * 0.26, r * 0.26, '#6a4220', 1.8);
      ellipse(g, 0, 0, r * 0.6, r * 0.6, '#b98a64', 2.5);
      g.strokeStyle = '#7a1f1f'; g.lineWidth = 2; g.beginPath(); g.moveTo(r * 0.1, -r * 0.5); g.lineTo(r * 0.3, r * 0.2); g.stroke();   // cicatriz
    },
    drone(g, r, col) { // dron: cuerpo rombo, cuatro rotores, lente
      for (const [ax, ay] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(ax * r * 0.95, ay * r * 0.95); g.stroke(); }
      g.save(); g.rotate(Math.PI / 4); rect(g, -r * 0.62, -r * 0.62, r * 1.24, r * 1.24, '#0e1c26', 3, 3); g.restore();
      g.fillStyle = col; g.beginPath(); g.arc(r * 0.32, 0, r * 0.3, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(r * 0.32, -r * 0.14, r * 0.16, r * 0.1);
      g.fillStyle = '#ffd81f'; g.fillRect(-r * 0.55, -r * 0.1, r * 0.3, r * 0.2);
    },
    sniper(g, r, col) { // francotirador: abrigo largo con capucha y rifle
      const co = mixc(col, '#120a1a', 0.6);
      poly(g, [[r * 0.8, -r * 0.3], [-r * 1.05, -r * 1.2], [-r * 0.55, 0], [-r * 1.05, r * 1.2], [r * 0.8, r * 0.3]], co, 3); shade(g, -r * 0.1, 0, r * 0.8, r);
      g.strokeStyle = col; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-r * 0.9, -r * 0.9); g.lineTo(-r * 0.4, 0); g.lineTo(-r * 0.9, r * 0.9); g.stroke();
      arm(g, r * 0.1, -r * 0.7, r * 1.0, -r * 0.2, r * 0.4, co); arm(g, r * 0.1, r * 0.7, r * 0.9, r * 0.22, r * 0.4, co);
      rect(g, r * 0.6, -r * 0.16, r * 2.1, r * 0.32, '#23212e', 2.4, 1.5);
      rect(g, r * 1.1, -r * 0.42, r * 0.5, r * 0.26, '#1a1824', 2, 1); g.fillStyle = col; g.fillRect(r * 2.35, -r * 0.1, r * 0.35, r * 0.2);
      ellipse(g, 0, 0, r * 0.6, r * 0.6, co, 2.8); ellipse(g, r * 0.12, 0, r * 0.36, r * 0.34, '#d2b8c8', 2);
    },
    heavy(g, r, col) { // guardia pesado: armadura antidisturbios con placas rayadas
      const ar = mixc(col, '#0c1220', 0.55);
      arm(g, 0, -r * 1.0, r * 0.9, -r * 0.4, r * 0.7, ar); arm(g, 0, r * 1.0, r * 0.9, r * 0.4, r * 0.7, ar);
      rect(g, -r * 0.85, -r * 1.2, r * 1.7, r * 2.4, ar, 3.2, r * 0.45); shade(g, 0, 0, r * 0.85, r * 1.2);
      for (const sy of [-1, 1]) { rect(g, -r * 0.5, sy > 0 ? r * 0.7 : -r * 1.4, r * 1.0, r * 0.7, '#2a3a5a', 2.6, 3); g.fillStyle = '#ffd81f'; for (let k = 0; k < 3; k++) g.fillRect(-r * 0.4 + k * r * 0.3, (sy > 0 ? r * 0.82 : -r * 1.28), r * 0.14, r * 0.46); }
      rect(g, r * 0.7, -r * 0.5, r * 1.3, r * 1.0, '#1c2438', 2.8, 3); g.fillStyle = col; g.fillRect(r * 1.75, -r * 0.3, r * 0.4, r * 0.6);
      ellipse(g, 0, 0, r * 0.62, r * 0.62, '#2a3a5a', 3);
      g.fillStyle = '#ffd81f'; g.fillRect(r * 0.18, -r * 0.4, r * 0.34, r * 0.8); g.strokeStyle = INK; g.lineWidth = 1.5; g.strokeRect(r * 0.18, -r * 0.4, r * 0.34, r * 0.8);
    },
    frenzy(g, r, col) { // cíborg punk: cresta, hombreras de pinchos, brazo-cuchilla
      const jk = mixc(col, '#1a0a10', 0.6);
      arm(g, 0, r * 1.0, r * 0.9, r * 0.35, r * 0.55, jk);
      arm(g, 0, -r * 1.0, r * 1.0, -r * 0.4, r * 0.55, '#8a8798'); poly(g, [[r * 1.0, -r * 0.7], [r * 2.3, -r * 0.45], [r * 1.0, -r * 0.2]], '#d8d6e2', 2.2);
      ellipse(g, 0, 0, r * 0.82, r * 1.22, jk); shade(g, 0, 0, r * 0.82, r * 1.22);
      for (const sy of [-1, 1]) for (let k = 0; k < 3; k++) poly(g, [[-r * 0.3 + k * r * 0.3, sy * r * 1.1], [-r * 0.15 + k * r * 0.3, sy * r * 1.65], [r * 0.0 + k * r * 0.3, sy * r * 1.1]], col, 1.8);
      ellipse(g, r * 0.95, r * 0.35, r * 0.3, r * 0.3, '#b98a64', 2);
      ellipse(g, 0, 0, r * 0.6, r * 0.6, '#b98a64', 2.5);
      g.fillStyle = col; g.beginPath(); for (let k = 0; k < 6; k++) { const px = -r * 0.5 + k * r * 0.2; g.moveTo(px, -r * 0.14); g.lineTo(px + r * 0.1, -r * 0.55); g.lineTo(px + r * 0.2, -r * 0.14); g.lineTo(px + r * 0.2, r * 0.14); g.lineTo(px + r * 0.1, r * 0.55); g.lineTo(px, r * 0.14); } g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
    },
    kamikaze(g, r, col) { // chico bomba: sudadera amarilla con chaleco de dinamita y detonador
      const hd = mixc(col, '#2a2208', 0.45);
      arm(g, 0, -r * 0.9, r * 1.05, -r * 0.3, r * 0.45, hd); arm(g, 0, r * 0.9, r * 1.05, r * 0.3, r * 0.45, hd);
      ellipse(g, 0, 0, r * 0.78, r * 1.1, hd); shade(g, 0, 0, r * 0.78, r * 1.1);
      for (let k = -2; k <= 2; k++) rect(g, -r * 0.55, k * r * 0.34 - r * 0.15, r * 1.0, r * 0.28, '#d8262f', 2, 1.5);
      g.strokeStyle = INK; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-r * 0.55, -r * 0.7); g.lineTo(r * 0.45, r * 0.7); g.moveTo(-r * 0.55, r * 0.7); g.lineTo(r * 0.45, -r * 0.7); g.stroke();
      ellipse(g, r * 1.1, -r * 0.3, r * 0.28, r * 0.28, '#c99a76', 2); ellipse(g, r * 1.1, r * 0.3, r * 0.28, r * 0.28, '#c99a76', 2);
      rect(g, r * 1.0, -r * 0.18, r * 0.55, r * 0.36, '#2a2833', 1.8, 1.5); g.fillStyle = '#ff3355'; g.fillRect(r * 1.3, -r * 0.09, r * 0.16, r * 0.18);
      ellipse(g, 0, 0, r * 0.6, r * 0.6, '#c99a76', 2.5);
      g.beginPath(); g.arc(-r * 0.05, 0, r * 0.64, -1.9, 1.9, true); g.closePath(); g.fillStyle = col; g.fill(); g.lineWidth = 2.4; g.strokeStyle = INK; g.stroke();
      rect(g, r * 0.12, -r * 0.5, r * 0.22, r * 1.0, '#1b1a22', 1.8, 1); g.fillStyle = '#7fe9ff'; g.fillRect(r * 0.15, -r * 0.4, r * 0.16, r * 0.8);
    },
    welder(g, r, col) { // soldador: mono naranja, bombona a la espalda, careta y soplete
      const ov = mixc(col, '#2a1408', 0.5);
      ellipse(g, -r * 0.75, 0, r * 0.45, r * 0.8, '#3a3b46', 2.8); g.fillStyle = '#c9c5d4'; g.fillRect(-r * 1.05, -r * 0.35, r * 0.18, r * 0.7);
      arm(g, 0, -r * 1.05, r * 1.0, -r * 0.4, r * 0.6, ov); arm(g, 0, r * 1.05, r * 1.0, r * 0.4, r * 0.6, ov);
      ellipse(g, 0, 0, r * 0.86, r * 1.25, ov); shade(g, 0, 0, r * 0.86, r * 1.25);
      g.fillStyle = '#ffd81f'; g.fillRect(-r * 0.2, -r * 1.2, r * 0.22, r * 0.5); g.fillRect(-r * 0.2, r * 0.7, r * 0.22, r * 0.5);
      ellipse(g, r * 1.0, -r * 0.4, r * 0.3, r * 0.3, '#3a3b46', 2); ellipse(g, r * 1.0, r * 0.4, r * 0.3, r * 0.3, '#3a3b46', 2);
      rect(g, r * 0.9, -r * 0.2, r * 1.5, r * 0.4, '#4a4c5a', 2.4, 1.5); g.fillStyle = '#ff8a1a'; g.fillRect(r * 2.25, -r * 0.14, r * 0.3, r * 0.28);
      ellipse(g, 0, 0, r * 0.66, r * 0.66, '#3a3b46', 3);
      rect(g, r * 0.1, -r * 0.5, r * 0.5, r * 1.0, '#101018', 2, 2); g.fillStyle = '#ff9a2a'; g.fillRect(r * 0.2, -r * 0.34, r * 0.28, r * 0.68);
    },
    phantom(g, r, col) { // asesino holo: traje negro con circuitos cian, capucha y dos hojas
      const sk = mixc(col, '#05121a', 0.78);
      arm(g, 0, -r * 0.85, r * 1.15, -r * 0.45, r * 0.4, sk); arm(g, 0, r * 0.85, r * 1.15, r * 0.45, r * 0.4, sk);
      poly(g, [[r * 1.05, -r * 0.55], [r * 2.5, -r * 0.7], [r * 1.1, -r * 0.3]], '#dff9ff', 1.8);
      poly(g, [[r * 1.05, r * 0.55], [r * 2.5, r * 0.7], [r * 1.1, r * 0.3]], '#dff9ff', 1.8);
      ellipse(g, 0, 0, r * 0.7, r * 1.05, sk); shade(g, 0, 0, r * 0.7, r * 1.05);
      g.strokeStyle = col; g.lineWidth = 1.8; g.beginPath(); g.moveTo(-r * 0.4, -r * 0.8); g.lineTo(0, -r * 0.2); g.lineTo(r * 0.3, -r * 0.3); g.moveTo(-r * 0.4, r * 0.8); g.lineTo(0, r * 0.2); g.lineTo(r * 0.3, r * 0.3); g.stroke();
      poly(g, [[-r * 0.5, -r * 0.1], [-r * 1.5, -r * 0.35], [-r * 1.1, 0], [-r * 1.5, r * 0.35], [-r * 0.5, r * 0.1]], mixc(col, '#05121a', 0.55), 1.8);   // capa
      ellipse(g, 0, 0, r * 0.58, r * 0.58, '#0a1820', 2.6);
      g.fillStyle = col; g.fillRect(r * 0.12, -r * 0.34, r * 0.36, r * 0.1); g.fillRect(r * 0.12, r * 0.24, r * 0.36, r * 0.1);
    },
    medic(g, r, col) { // dron médico: casco blanco con cruz verde y focos
      for (const [ax, ay] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(ax * r * 0.95, ay * r * 0.95); g.stroke(); }
      ellipse(g, 0, 0, r * 0.82, r * 0.82, '#e9f1f4', 3); shade(g, 0, 0, r * 0.82, r * 0.82);
      g.fillStyle = col; g.fillRect(-r * 0.16, -r * 0.5, r * 0.32, r * 1.0); g.fillRect(-r * 0.5, -r * 0.16, r * 1.0, r * 0.32);
      g.strokeStyle = INK; g.lineWidth = 1.4; g.strokeRect(-r * 0.16, -r * 0.5, r * 0.32, r * 1.0); g.strokeRect(-r * 0.5, -r * 0.16, r * 1.0, r * 0.32);
      ellipse(g, r * 0.62, 0, r * 0.2, r * 0.2, '#0e1c26', 1.8); g.fillStyle = '#ff3355'; g.fillRect(r * 0.58, -r * 0.05, r * 0.1, r * 0.1);
    },
    spitter(g, r, col) { // mutante escupidor: encorvado, piel verde, bolsa de ácido y garras
      const sk = mixc(col, '#0c1a08', 0.42);
      arm(g, 0, -r * 1.0, r * 1.2, -r * 0.5, r * 0.55, sk); arm(g, 0, r * 1.0, r * 1.2, r * 0.5, r * 0.55, sk);
      for (const sy of [-1, 1]) for (let k = 0; k < 3; k++) poly(g, [[r * 1.15 + k * r * 0.1, sy * r * (0.35 + k * 0.14)], [r * 1.7, sy * r * (0.55 + k * 0.2)], [r * 1.25 + k * r * 0.1, sy * r * (0.55 + k * 0.14)]], '#e6e2c8', 1.6);
      ellipse(g, -r * 0.35, 0, r * 0.9, r * 1.3, sk); shade(g, -r * 0.35, 0, r * 0.9, r * 1.3);
      ellipse(g, -r * 0.6, -r * 0.3, r * 0.38, r * 0.38, '#b6ff5a', 2); ellipse(g, -r * 0.55, r * 0.45, r * 0.3, r * 0.3, '#b6ff5a', 2); ellipse(g, -r * 0.2, 0.1 * r, r * 0.26, r * 0.26, '#d8ff8a', 1.8);
      ellipse(g, r * 0.5, 0, r * 0.62, r * 0.6, mixc(col, '#0c1a08', 0.2), 2.6);
      g.fillStyle = '#1a0a08'; g.beginPath(); g.ellipse(r * 0.85, 0, r * 0.26, r * 0.32, 0, 0, TAU); g.fill();
      g.fillStyle = '#ff3355'; g.fillRect(r * 0.55, -r * 0.35, r * 0.14, r * 0.12); g.fillRect(r * 0.55, r * 0.23, r * 0.14, r * 0.12);
    },
    turret(g, r, col) { // torreta: caja de chapa con franjas de peligro
      rect(g, -r, -r, r * 2, r * 2, '#2a2818', 3.2, 3);
      g.save(); rrectPath(g, -r + 1.5, -r + 1.5, r * 2 - 3, r * 2 - 3, 2); g.clip();
      g.fillStyle = col; for (let k = -4; k < 6; k++) { g.beginPath(); g.moveTo(-r + k * 8, r); g.lineTo(-r + k * 8 + 4, r); g.lineTo(-r + k * 8 + 4 + r * 0.6, r - 5); g.lineTo(-r + k * 8 + r * 0.6, r - 5); g.fill(); g.beginPath(); g.moveTo(-r + k * 8, -r); g.lineTo(-r + k * 8 + 4, -r); g.lineTo(-r + k * 8 + 4 + r * 0.6, -r + 5); g.lineTo(-r + k * 8 + r * 0.6, -r + 5); g.fill(); }
      g.restore();
      ellipse(g, 0, 0, r * 0.62, r * 0.62, '#3a3822', 2.8);
    },
  };
  // Jefes: torso enorme, hombreras de pinchos, corona y cadena de oro
  function bossArt(g, r, col, id) {
    const bd = mixc(col, '#0c0814', 0.62);
    arm(g, 0, -r * 0.95, r * 0.95, -r * 0.45, r * 0.5, bd); arm(g, 0, r * 0.95, r * 0.95, r * 0.45, r * 0.5, bd);
    ellipse(g, 0, 0, r * 0.82, r * 1.12, bd, 4.5); shade(g, 0, 0, r * 0.82, r * 1.12);
    const n = 4 + id;
    g.fillStyle = col; for (const sy of [-1, 1]) for (let k = 0; k < n; k++) { const t = (k - (n - 1) / 2) * r * 0.28; poly(g, [[t - r * 0.12, sy * r * 1.0], [t, sy * r * 1.45], [t + r * 0.12, sy * r * 1.0]], col, 2.4); }
    g.strokeStyle = '#ffd23a'; g.lineWidth = 3.2; g.beginPath(); g.ellipse(0, 0, r * 0.5, r * 0.8, 0, -1.2, 1.2); g.stroke();
    ellipse(g, r * 0.95, -r * 0.45, r * 0.26, r * 0.26, '#b98a64', 2.2); ellipse(g, r * 0.95, r * 0.45, r * 0.26, r * 0.26, '#b98a64', 2.2);
    ellipse(g, 0, 0, r * 0.5, r * 0.5, '#b98a64', 3.5);
    g.fillStyle = col; g.beginPath(); for (let k = 0; k < 7; k++) { const a = -1.2 + k * 0.4; g.moveTo(Math.cos(a - 0.16) * r * 0.46, Math.sin(a - 0.16) * r * 0.46); g.lineTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82); g.lineTo(Math.cos(a + 0.16) * r * 0.46, Math.sin(a + 0.16) * r * 0.46); }
    g.fill(); g.lineWidth = 2.4; g.strokeStyle = INK; g.stroke();
    g.fillStyle = '#ffd23a'; g.fillRect(r * 0.25, -r * 0.14, r * 0.2, r * 0.28);
  }

  // ───── Versión renderizada en 3D (si las imágenes cargaron) ─────
  // Reduce un recorte de imagen al tamaño final en pasos de 1/2 para que quede nítido
  function resample(src, sx, sy, sw, sh, dw, dh) {
    let c = src, x = sx, y = sy, w = sw, h = sh;
    while (w > dw * 2 || h > dh * 2) {
      const nw = Math.max(dw, Math.ceil(w / 2)), nh = Math.max(dh, Math.ceil(h / 2));
      const t = document.createElement('canvas'); t.width = nw; t.height = nh;
      const tg = t.getContext('2d'); tg.imageSmoothingQuality = 'high'; tg.drawImage(c, x, y, w, h, 0, 0, nw, nh);
      c = t; x = 0; y = 0; w = nw; h = nh;
    }
    const o = document.createElement('canvas'); o.width = dw; o.height = dh;
    const g = o.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, x, y, w, h, 0, 0, dw, dh);
    return o;
  }
  function photo(imgKey, world) {
    const im = Art.imgs[imgKey]; if (!im) return null;
    const px = Math.ceil(world * RES);
    return { c: resample(im, 0, 0, im.width, im.height, px, px), w: world, h: world, photo: true };
  }
  // Largo en pantalla de cada arma (px de mundo); el grosor se ensancha un poco para que se lea
  const WLEN = { pistol: 19, smg: 30, shotgun: 46, smart: 24, rail: 58, grenade: 38, katana: 64 }, WTHICK = 1.5;
  function weapon(id) {
    const key = 'w' + id + (Art.ready ? 'P' : ''); if (cache[key] !== undefined) return cache[key];
    const im = Art.imgs['w:' + id], M = Art.META.weapons[id];
    if (!im || !M) { if (Art.ready) cache[key] = null; return null; }
    const [x0, y0, x1, y1] = M.bbox, bw = x1 - x0, bh = y1 - y0, s = (WLEN[id] || 24) / bw, sy = s * WTHICK;
    const dw = Math.ceil(bw * s * RES), dh = Math.ceil(bh * sy * RES);
    const gx = 128 - M.ox * M.ppm;      // columna de la imagen donde está la empuñadura
    return (cache[key] = { c: resample(im, x0, y0, bw, bh, dw, dh), w: bw * s, h: bh * sy, gx: (gx - x0) * s, gy: (128 - y0) * sy });
  }

  function player(id) {
    const ph = Art.ready && Art.has('p:' + id);
    const key = 'p' + id + (ph ? 'P' : ''); if (cache[key]) return cache[key];
    if (ph) return (cache[key] = photo('p:' + id, Art.META.players[id].world));
    const o = canvasFor(64, 64); (players[id] || players.solo)(o.g); return (cache[key] = o);
  }
  function enemy(e) {
    const ik = e.boss ? 'b:' + e.bossId : 'e:' + e.type, M = e.boss ? Art.META.bosses[e.bossId] : Art.META.enemies[e.type];
    const ph = Art.ready && M && Art.has(ik);
    const key = (e.boss ? 'b' + e.bossId + '|' + e.r : 'e' + e.type + '|' + e.r + '|' + e.col) + (ph ? 'P' : ''); if (cache[key]) return cache[key];
    if (ph) return (cache[key] = photo(ik, Math.round(M.world * e.r / M.r)));
    const r = e.r, S = Math.ceil(r * (e.boss ? 3.9 : 5.0) + 16), o = canvasFor(S, S);
    if (e.boss) bossArt(o.g, r, e.col, e.bossId); else (enemies[e.type] || enemies.grunt)(o.g, r, e.col);
    if (!e.boss && SOFT[e.type]) {     // luz suave desde arriba a la izquierda para acercarse al estilo de los modelos 3D
      const g = o.g, gr = g.createRadialGradient(-r * 0.4, -r * 0.7, r * 0.15, 0, 0, r * 2.3);
      gr.addColorStop(0, 'rgba(255,255,255,0.30)'); gr.addColorStop(0.45, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,16,0.42)');
      g.globalCompositeOperation = 'source-atop'; g.fillStyle = gr; g.fillRect(-S, -S, S * 2, S * 2); g.globalCompositeOperation = 'source-over';
    }
    return (cache[key] = o);
  }
  // Versión blanca (destello al recibir un golpe)
  function flashOf(o) {
    if (o.flash) return o.flash;
    const c = document.createElement('canvas'); c.width = o.c.width; c.height = o.c.height; const g = c.getContext('2d');
    g.drawImage(o.c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
    return (o.flash = c);
  }
  function draw(g, o, flash) { g.imageSmoothingQuality = 'high'; g.drawImage(flash ? flashOf(o) : o.c, -o.w / 2, -o.h / 2, o.w, o.h); }
  return { player, enemy, weapon, draw };
})();
