'use strict';
// ───────── Arte de los personajes (dibujado por código, estilo calle) ─────────
// Cada personaje se pinta una vez en un lienzo oculto (sprite) y luego se reutiliza en título,
// selección y pantalla de carga. Unidades: origen en los pies, y negativo = arriba.

const CharArt = (() => {
  const RES = 2, CW = 560, CHH = 470, FX = 280, FY = 440, FIG_H = 330;
  const cache = {};

  // ── constructores de trazado ──
  const poly = (pts) => (g) => { g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); };
  const ell = (x, y, rx, ry, rot = 0) => (g) => { g.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot)); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.closePath(); };
  const rr = (x, y, w, h, r) => (g) => {
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r);
    g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  };
  const mirror = (pts) => pts.map(p => [-p[0], p[1]]);

  // Forma con contorno de tinta, sombreado "cel" (media luna) y luz de borde
  function shape(g, build, fill, o = {}) {
    const lw = o.lw === undefined ? 5 : o.lw;
    g.beginPath(); build(g); g.fillStyle = fill; g.fill();
    if (o.shade !== false) {
      g.save(); g.clip();
      g.beginPath(); g.rect(-900, -900, 1800, 1800);
      g.save(); g.translate(o.sx === undefined ? -8 : o.sx, o.sy === undefined ? -7 : o.sy); build(g); g.restore();
      g.fillStyle = o.shade || 'rgba(10,6,24,0.30)'; g.fill('evenodd');
      if (o.light !== false) {
        g.beginPath(); g.rect(-900, -900, 1800, 1800);
        g.save(); g.translate(5, 4); build(g); g.restore();
        g.fillStyle = o.light || 'rgba(255,255,255,0.14)'; g.fill('evenodd');
      }
      g.restore();
    }
    if (lw > 0) { g.beginPath(); build(g); g.lineWidth = lw; g.lineJoin = 'round'; g.strokeStyle = INK; g.stroke(); }
  }
  // Extremidad (cápsula con contorno)
  function limb(g, x1, y1, x2, y2, w, fill, o = {}) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = INK; g.lineWidth = w + 9; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.strokeStyle = fill; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, s = o.side === undefined ? 1 : o.side;
    g.strokeStyle = 'rgba(10,6,24,0.30)'; g.lineWidth = w * 0.38;
    g.beginPath(); g.moveTo(x1 + nx * w * 0.3 * s, y1 + ny * w * 0.3 * s); g.lineTo(x2 + nx * w * 0.3 * s, y2 + ny * w * 0.3 * s); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.13)'; g.lineWidth = w * 0.14;
    g.beginPath(); g.moveTo(x1 - nx * w * 0.32 * s, y1 - ny * w * 0.32 * s); g.lineTo(x2 - nx * w * 0.32 * s, y2 - ny * w * 0.32 * s); g.stroke();
  }
  // Franja de color a lo largo de un tramo de extremidad
  function band(g, x1, y1, x2, y2, t0, t1, w, col) {
    const ax = x1 + (x2 - x1) * t0, ay = y1 + (y2 - y1) * t0, bx = x1 + (x2 - x1) * t1, by = y1 + (y2 - y1) * t1;
    const l = Math.hypot(x2 - x1, y2 - y1) || 1, nx = -(y2 - y1) / l * w / 2, ny = (x2 - x1) / l * w / 2;
    g.fillStyle = col; g.beginPath(); g.moveTo(ax + nx, ay + ny); g.lineTo(bx + nx, by + ny); g.lineTo(bx - nx, by - ny); g.lineTo(ax - nx, ay - ny); g.closePath(); g.fill();
    g.strokeStyle = INK; g.lineWidth = 2.5; g.beginPath(); g.moveTo(ax + nx, ay + ny); g.lineTo(bx + nx, by + ny); g.moveTo(ax - nx, ay - ny); g.lineTo(bx - nx, by - ny); g.stroke();
  }
  const line = (g, pts, col, w, cap = 'round') => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = cap; g.lineJoin = 'round'; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke(); };
  const dot = (g, x, y, r, col, ink = 0) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = col; g.fill(); if (ink) { g.lineWidth = ink; g.strokeStyle = INK; g.stroke(); } };
  const mix = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`; };

  // Zapatilla / bota. dir=+1 la punta mira a la derecha
  function boot(g, cx, dir, col, sole, trim, high = true) {
    const m = (p) => [cx + p[0] * dir, p[1]];
    const pts = [[-22, high ? -50 : -34], [22, high ? -50 : -34], [25, -26], [48, -19], [54, -7], [50, 0], [-26, 0], [-27, -22]].map(m);
    shape(g, poly(pts), col, { shade: 'rgba(10,6,24,0.32)' });
    shape(g, poly([[-27, -9], [50, -9], [55, -7], [51, 0], [-26, 0]].map(m)), sole, { lw: 3.5, shade: false });
    g.save(); g.beginPath(); poly(pts)(g); g.clip();
    for (let k = 0; k < 3; k++) line(g, [m([-6, -43 + k * 8]), m([16, -45 + k * 8])], trim, 3.5);
    line(g, [m([22, -26]), m([48, -19])], trim, 3);
    g.restore();
  }

  // ── Personajes ──
  const figs = {};

  // DANTE "SOLO" — mercenario de bomber negra y gorra, amarillo taxi
  figs.solo = (g) => {
    const SK = '#c98b5d', JK = '#1d1c26', YL = '#ffd400', OR = '#ff7a1a', PT = '#3a3a46';
    // arma (detrás del cuerpo)
    // piernas
    limb(g, -27, -118, -31, -24, 46, PT, { side: 1 }); limb(g, 27, -118, 33, -24, 46, PT, { side: 1 });
    band(g, -27, -118, -31, -24, 0.18, 0.32, 40, YL); band(g, 27, -118, 33, -24, 0.18, 0.32, 40, YL);
    shape(g, rr(-52, -92, 26, 24, 5), '#2e2e39', { lw: 3.5 }); shape(g, rr(28, -92, 26, 24, 5), '#2e2e39', { lw: 3.5 });
    boot(g, -31, -1, '#1b1a22', YL, '#f4f0e6'); boot(g, 33, 1, '#1b1a22', YL, '#f4f0e6');
    // brazo izquierdo (izquierda de pantalla) colgando
    limb(g, -64, -198, -88, -146, 40, JK); limb(g, -88, -146, -84, -100, 36, JK);
    band(g, -88, -146, -84, -100, 0.62, 0.9, 36, YL); band(g, -64, -198, -88, -146, 0.5, 0.6, 38, YL);
    // torso (bomber)
    shape(g, (c) => { c.moveTo(-30, -218); c.bezierCurveTo(-54, -216, -74, -208, -76, -188); c.lineTo(-68, -106); c.quadraticCurveTo(0, -92, 68, -106); c.lineTo(76, -188); c.bezierCurveTo(74, -208, 54, -216, 30, -218); c.quadraticCurveTo(0, -198, -30, -218); c.closePath(); }, JK);
    // camiseta blanca con estampado
    shape(g, poly([[-23, -212], [23, -212], [18, -106], [-18, -106]]), '#f2ede0', { lw: 3.5, shade: 'rgba(10,6,24,0.16)' });
    g.save(); g.beginPath(); poly([[-23, -212], [23, -212], [18, -106], [-18, -106]])(g); g.clip();
    dot(g, 0, -156, 17, YL, 3.5); line(g, [[-8, -160], [-8, -158]], INK, 4); line(g, [[8, -160], [8, -158]], INK, 4); line(g, [[-8, -148], [0, -143], [8, -148]], INK, 3.5);
    g.restore();
    // solapas, cremallera y forro naranja
    line(g, [[-24, -214], [-19, -108]], INK, 5); line(g, [[24, -214], [19, -108]], INK, 5);
    line(g, [[-30, -212], [-26, -112]], OR, 4); line(g, [[30, -212], [26, -112]], OR, 4);
    // canesú con letras
    shape(g, rr(-60, -112, 120, 14, 6), '#15141c', { lw: 3.5, shade: false });
    for (let k = 0; k < 7; k++) line(g, [[-52 + k * 17, -110], [-52 + k * 17, -100]], YL, 3, 'butt');
    // parche en el pecho
    shape(g, rr(-62, -178, 26, 26, 5), OR, { lw: 3.5 }); line(g, [[-56, -172], [-42, -158]], INK, 3.5); line(g, [[-42, -172], [-56, -158]], INK, 3.5);
    // cadenas de oro
    for (const [r, ry] of [[30, 38], [24, 52]]) {
      g.beginPath(); g.ellipse(0, -222, r, ry * 0.55, 0, 0.12 * Math.PI, 0.88 * Math.PI); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
      g.lineWidth = 3.5; g.strokeStyle = '#ffd23a'; g.stroke();
    }
    shape(g, poly([[0, -176], [11, -190], [0, -200], [-11, -190]]), '#ffd23a', { lw: 3.5, shade: 'rgba(120,70,0,0.35)' }); line(g, [[-3, -192], [3, -188]], INK, 2.5);
    // cuello y cabeza
    shape(g, rr(-18, -236, 36, 30, 8), '#a86e45', { lw: 4, shade: 'rgba(10,6,24,0.3)' });
    shape(g, (c) => { c.moveTo(0, -314); c.bezierCurveTo(32, -314, 46, -292, 45, -266); c.bezierCurveTo(44, -244, 36, -224, 16, -216); c.quadraticCurveTo(0, -211, -16, -216); c.bezierCurveTo(-36, -224, -44, -244, -45, -266); c.bezierCurveTo(-46, -292, -32, -314, 0, -314); c.closePath(); }, SK);
    // orejas
    shape(g, ell(-46, -262, 7, 12), SK, { lw: 3.5 }); shape(g, ell(46, -262, 7, 12), SK, { lw: 3.5 });
    // barba de tres días
    g.save(); g.beginPath(); g.moveTo(0, -314); g.bezierCurveTo(32, -314, 46, -292, 45, -266); g.bezierCurveTo(44, -244, 36, -224, 16, -216); g.quadraticCurveTo(0, -211, -16, -216); g.bezierCurveTo(-36, -224, -44, -244, -45, -266); g.bezierCurveTo(-46, -292, -32, -314, 0, -314); g.clip();
    g.fillStyle = 'rgba(30,16,10,0.42)'; g.beginPath(); g.moveTo(-50, -246); g.quadraticCurveTo(0, -232, 50, -246); g.lineTo(50, -200); g.lineTo(-50, -200); g.closePath(); g.fill();
    g.fillStyle = SK; g.beginPath(); g.ellipse(0, -231, 14, 6, 0, 0, TAU); g.fill();
    g.restore();
    // nariz y boca
    line(g, [[-2, -250], [4, -238], [-3, -236]], 'rgba(60,30,18,0.8)', 3.5);
    line(g, [[-14, -226], [-2, -223], [14, -229]], INK, 4);
    line(g, [[8, -227], [34, -214]], '#e8d6a8', 3); // palillo
    // gafas de sol
    const lensL = [[-38, -258], [-5, -258], [-8, -238], [-34, -236]], lensR = mirror(lensL);
    shape(g, poly(lensL), '#0b0a10', { lw: 4, shade: false, light: false }); shape(g, poly(lensR), '#0b0a10', { lw: 4, shade: false, light: false });
    line(g, [[-5, -256], [5, -256]], INK, 4);
    for (const s of [-1, 1]) { line(g, [[s * 28, -256], [s * 20, -240]], 'rgba(255,212,0,0.85)', 4); line(g, [[s * 17, -256], [s * 12, -244]], 'rgba(255,212,0,0.55)', 2.5); }
    line(g, [[-38, -256], [-46, -258]], INK, 4); line(g, [[38, -256], [46, -258]], INK, 4);
    // gorra
    shape(g, (c) => { c.moveTo(-47, -270); c.bezierCurveTo(-50, -312, -26, -334, 0, -334); c.bezierCurveTo(26, -334, 50, -312, 47, -270); c.quadraticCurveTo(0, -283, -47, -270); c.closePath(); }, '#1b1a22');
    line(g, [[0, -333], [0, -278]], 'rgba(255,255,255,0.12)', 2.5); line(g, [[-24, -328], [-28, -276]], 'rgba(255,255,255,0.1)', 2.5); line(g, [[24, -328], [28, -276]], 'rgba(255,255,255,0.1)', 2.5);
    shape(g, ell(0, -308, 10, 10), YL, { lw: 3.5 }); line(g, [[-5, -308], [5, -308]], INK, 3); line(g, [[0, -313], [0, -303]], INK, 3);
    shape(g, (c) => { c.moveTo(-52, -274); c.quadraticCurveTo(0, -292, 52, -274); c.quadraticCurveTo(66, -258, 40, -256); c.quadraticCurveTo(0, -268, -40, -256); c.quadraticCurveTo(-66, -258, -52, -274); c.closePath(); }, YL, { shade: 'rgba(120,70,0,0.35)' });
    // brazo derecho con el subfusil
    limb(g, 64, -198, 90, -150, 40, JK); limb(g, 90, -150, 112, -126, 36, JK);
    band(g, 64, -198, 90, -150, 0.5, 0.6, 38, YL);
    // subfusil Zumbador-5
    g.save(); g.translate(108, -124); g.rotate(-0.14);
    shape(g, rr(-24, -11, 98, 24, 6), '#25242f', { lw: 4.5 });
    shape(g, rr(70, -7, 40, 9, 3), '#15141b', { lw: 4 });
    shape(g, rr(-4, 10, 20, 38, 4), '#15141b', { lw: 4 });
    shape(g, rr(26, 8, 14, 22, 3), '#15141b', { lw: 4 });
    shape(g, rr(-10, -20, 64, 11, 4), '#2f2e3b', { lw: 4 });
    g.fillStyle = YL; g.fillRect(-20, -4, 82, 5); g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(-20, -4, 82, 5);
    g.restore();
    shape(g, ell(106, -124, 20, 18), '#17161e', { lw: 4 }); // guante
    for (let k = 0; k < 3; k++) line(g, [[98 + k * 8, -112], [98 + k * 8, -104]], SK, 5);
    // brillos de metal
    line(g, [[-14, -172], [-8, -176]], 'rgba(255,255,255,0.6)', 2.5);
    shape(g, ell(-84, -96, 17, 16), '#17161e', { lw: 4 });
  };

  const star = (cx, cy, R, r, n = 5, rot = -Math.PI / 2) => (g) => {
    for (let i = 0; i < n * 2; i++) { const a = rot + (i * Math.PI) / n, d = i % 2 ? r : R; (i ? g.lineTo : g.moveTo).call(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d); }
    g.closePath();
  };
  const headPath = (rx, top, chin, jaw) => (c) => {
    c.moveTo(0, top); c.bezierCurveTo(rx * 0.7, top, rx + 1, top + 22, rx, top + 48);
    c.bezierCurveTo(rx - 1, top + 70, jaw, chin - 12, 14, chin - 2); c.quadraticCurveTo(0, chin + 3, -14, chin - 2);
    c.bezierCurveTo(-jaw, chin - 12, -rx + 1, top + 70, -rx, top + 48); c.bezierCurveTo(-rx - 1, top + 22, -rx * 0.7, top, 0, top); c.closePath();
  };

  // KIRA "NULL" — netrunner: sudadera enorme, pelo lima, visor y cascos rosas
  figs.kira = (g) => {
    const SK = '#f2d0b6', HAIR = '#a6ff3c', HD = 'rgba(20,90,10,0.38)', HOOD = '#1a1921', LIME = '#a6ff3c', PINK = '#ff2e88', LEG = '#22212c';
    // saya del hombro: capucha acumulada
    shape(g, ell(0, -224, 52, 24), '#121118', { lw: 4 });
    // piernas (mallas) y zapatillas plataforma
    limb(g, -22, -122, -27, -28, 36, LEG); limb(g, 22, -122, 28, -28, 36, LEG);
    line(g, [[-38, -116], [-44, -34]], LIME, 4.5); line(g, [[38, -116], [45, -34]], LIME, 4.5);
    shape(g, rr(-42, -84, 30, 24, 7), '#2d2c3a', { lw: 3.5 }); shape(g, rr(14, -84, 30, 24, 7), '#2d2c3a', { lw: 3.5 });
    boot(g, -28, -1, '#f4f2ec', LIME, PINK, false); boot(g, 30, 1, '#f4f2ec', LIME, PINK, false);
    shape(g, rr(-58, -12, 70, 12, 5), LIME, { lw: 3.5, shade: 'rgba(20,90,10,0.35)' }); shape(g, rr(-4, -12, 70, 12, 5), LIME, { lw: 3.5, shade: 'rgba(20,90,10,0.35)' });
    // sudadera
    shape(g, (c) => { c.moveTo(-28, -218); c.bezierCurveTo(-56, -216, -80, -208, -84, -186); c.lineTo(-90, -102); c.quadraticCurveTo(0, -88, 90, -102); c.lineTo(84, -186); c.bezierCurveTo(80, -208, 56, -216, 28, -218); c.quadraticCurveTo(0, -198, -28, -218); c.closePath(); }, HOOD);
    shape(g, (c) => { c.moveTo(-52, -150); c.lineTo(52, -150); c.lineTo(62, -108); c.lineTo(-62, -108); c.closePath(); }, '#14131a', { lw: 4, shade: false });
    line(g, [[-30, -150], [-38, -108]], LIME, 3); line(g, [[30, -150], [38, -108]], LIME, 3);
    // cordones y pegatinas
    line(g, [[-12, -208], [-16, -158]], '#ecece8', 3.5); line(g, [[12, -208], [10, -168]], '#ecece8', 3.5); dot(g, -16, -156, 4.5, LIME, 2.5); dot(g, 10, -166, 4.5, LIME, 2.5);
    shape(g, star(-56, -176, 17, 8), PINK, { lw: 3.5 }); shape(g, rr(30, -190, 30, 30, 4), '#f1efe8', { lw: 3.5, shade: false });
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if ((r * 7 + c * 3 + r * c) % 3) { g.fillStyle = INK; g.fillRect(34 + c * 6, -186 + r * 6, 4.5, 4.5); }
    shape(g, poly([[-70, -130], [-58, -130], [-64, -144]]), LIME, { lw: 3, shade: false });
    // brazo izquierdo (cubo holográfico)
    limb(g, -70, -198, -104, -170, 44, HOOD); limb(g, -104, -170, -112, -134, 40, HOOD);
    band(g, -104, -170, -112, -134, 0.7, 0.95, 40, LIME);
    shape(g, ell(-114, -118, 16, 15), SK, { lw: 4 }); for (let k = 0; k < 3; k++) line(g, [[-122 + k * 8, -126], [-124 + k * 8, -136]], SK, 6);
    // brazo derecho con pistola inteligente
    limb(g, 70, -198, 98, -164, 44, HOOD); limb(g, 98, -164, 126, -148, 40, HOOD);
    band(g, 98, -164, 126, -148, 0.72, 0.98, 40, LIME);
    g.save(); g.translate(130, -150);
    shape(g, rr(-2, -14, 74, 19, 6), '#eceef4', { lw: 4.5 }); shape(g, rr(66, -11, 28, 9, 3), '#8d94a8', { lw: 4 }); shape(g, poly([[2, 2], [28, 2], [20, 42], [-6, 42]]), '#272632', { lw: 4.5 });
    g.fillStyle = LIME; g.fillRect(6, -10, 56, 4); g.shadowColor = LIME; g.shadowBlur = 10; g.fillRect(6, -10, 56, 4); g.shadowBlur = 0;
    g.restore();
    shape(g, ell(132, -140, 15, 14), SK, { lw: 4 });
    // cuello + braga con sonrisa cosida
    shape(g, rr(-14, -236, 28, 28, 6), '#e2bda0', { lw: 4 });
    shape(g, (c) => { c.moveTo(-36, -230); c.quadraticCurveTo(0, -214, 36, -230); c.lineTo(40, -206); c.quadraticCurveTo(0, -192, -40, -206); c.closePath(); }, '#121118');
    g.beginPath(); for (let k = 0; k <= 10; k++) { const x = -30 + k * 6, y = -214 + (k % 2 ? -4 : 3) + 8 * Math.pow(x / 36, 2) * 0.5; k ? g.lineTo(x, y) : g.moveTo(x, y); } g.lineWidth = 3.5; g.strokeStyle = LIME; g.lineJoin = 'miter'; g.stroke();
    // pelo (atrás): mechón largo a la derecha
    shape(g, (c) => { c.moveTo(-48, -270); c.bezierCurveTo(-58, -320, -20, -346, 16, -340); c.bezierCurveTo(54, -332, 68, -298, 68, -262); c.bezierCurveTo(70, -240, 64, -222, 52, -204); c.bezierCurveTo(46, -224, 48, -240, 42, -256); c.lineTo(-40, -256); c.closePath(); }, HAIR, { shade: HD });
    // cabeza
    shape(g, headPath(42, -312, -208, 32), SK);
    g.save(); g.beginPath(); headPath(42, -312, -208, 32)(g); g.clip();
    g.fillStyle = 'rgba(40,130,30,0.28)'; g.fillRect(-60, -330, 44, 80);
    line(g, [[-36, -294], [-28, -282], [-36, -270], [-26, -262]], LIME, 2.5); line(g, [[-28, -282], [-18, -286]], LIME, 2.5); dot(g, -18, -286, 2.5, LIME);
    line(g, [[-38, -276], [-32, -272]], LIME, 2.5);
    g.restore();
    line(g, [[-8, -226], [0, -224], [11, -230]], '#d02070', 4); dot(g, 2, -240, 2.6, 'rgba(120,60,50,0.85)');
    // visor
    shape(g, rr(-52, -268, 104, 30, 14), '#0e0d14', { lw: 4.5, shade: false, light: false });
    g.shadowColor = LIME; g.shadowBlur = 14; shape(g, rr(-42, -256, 84, 7, 3.5), LIME, { lw: 0, shade: false, light: false }); g.shadowBlur = 0;
    line(g, [[-34, -264], [-22, -242]], 'rgba(255,255,255,0.3)', 5); line(g, [[-14, -264], [-8, -250]], 'rgba(255,255,255,0.22)', 3);
    for (let k = 0; k < 4; k++) dot(g, 28 + k * 5, -243, 1.6, LIME);
    // cascos rosas
    g.beginPath(); g.moveTo(-58, -274); g.quadraticCurveTo(0, -378, 58, -274); g.lineCap = 'round'; g.lineWidth = 14; g.strokeStyle = INK; g.stroke(); g.lineWidth = 7.5; g.strokeStyle = PINK; g.stroke();
    // pinchos del pelo
    shape(g, poly([[-36, -312], [-30, -354], [-12, -322]]), HAIR, { lw: 4, shade: HD }); shape(g, poly([[-12, -326], [4, -372], [22, -326]]), HAIR, { lw: 4, shade: HD }); shape(g, poly([[18, -326], [40, -358], [46, -310]]), HAIR, { lw: 4, shade: HD });
    // flequillo largo
    shape(g, (c) => { c.moveTo(-48, -284); c.bezierCurveTo(-54, -330, 10, -352, 48, -312); c.bezierCurveTo(62, -292, 64, -270, 60, -246); c.lineTo(52, -242); c.bezierCurveTo(50, -262, 38, -276, 10, -277); c.bezierCurveTo(-8, -277, -30, -284, -48, -284); c.closePath(); }, HAIR, { shade: HD });
    line(g, [[-10, -330], [4, -300]], 'rgba(255,255,255,0.35)', 3); line(g, [[18, -326], [34, -296]], 'rgba(255,255,255,0.3)', 3);
    shape(g, ell(-58, -262, 13, 24), PINK, { lw: 4 }); shape(g, ell(-58, -262, 6, 14), LIME, { lw: 3, shade: false });
    shape(g, ell(58, -262, 13, 24), PINK, { lw: 4 }); shape(g, ell(58, -262, 6, 14), LIME, { lw: 3, shade: false });
  };

  // MOX "FUSIBLE" — técnico: gorro, gafas de soldar, barba, chaleco reflectante y escopeta
  figs.mox = (g) => {
    const SK = '#92603d', BEARD = '#3b2417', VEST = '#ff7a1a', HOODIE = '#707483', PANT = '#6e553a', GLOVE = '#d1a56c', BELT = '#5a3d25';
    // piernas anchas
    limb(g, -31, -116, -35, -26, 54, PANT); limb(g, 31, -116, 37, -26, 54, PANT);
    shape(g, rr(-62, -88, 36, 28, 6), VEST, { lw: 3.5 }); shape(g, rr(28, -88, 36, 28, 6), VEST, { lw: 3.5 });
    boot(g, -36, -1, '#54422f', '#1b1a22', '#ffd400'); boot(g, 38, 1, '#54422f', '#1b1a22', '#ffd400');
    g.fillStyle = 'rgba(25,224,255,0.75)'; for (const [x, y, r] of [[-46, -62, 5], [-38, -52, 3], [-52, -48, 3.5]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(255,46,136,0.75)'; for (const [x, y, r] of [[50, -56, 5], [42, -44, 3], [58, -44, 3.5]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    // llave inglesa en la mano izquierda
    g.save(); g.translate(-100, -102); g.rotate(0.2);
    shape(g, rr(-8, -4, 16, 84, 6), '#b4bac8', { lw: 4.5 }); shape(g, rr(-8, 6, 16, 34, 4), VEST, { lw: 3.5 });
    shape(g, ell(0, 86, 19, 19), '#b4bac8', { lw: 4.5 }); shape(g, poly([[-6, 96], [6, 96], [4, 112], [-4, 112]]), INK, { lw: 0, shade: false });
    g.restore();
    // torso: sudadera gris y chaleco reflectante
    limb(g, -80, -198, -108, -152, 48, HOODIE); limb(g, -108, -152, -104, -112, 44, HOODIE);
    shape(g, (c) => { c.moveTo(-32, -216); c.bezierCurveTo(-58, -214, -86, -208, -90, -184); c.lineTo(-84, -104); c.quadraticCurveTo(0, -92, 84, -104); c.lineTo(90, -184); c.bezierCurveTo(86, -208, 58, -214, 32, -216); c.quadraticCurveTo(0, -198, -32, -216); c.closePath(); }, HOODIE);
    const vL = poly([[-68, -212], [-16, -214], [-20, -106], [-80, -106], [-88, -188]]), vR = poly(mirror([[-68, -212], [-16, -214], [-20, -106], [-80, -106], [-88, -188]]));
    for (const v of [vL, vR]) {
      shape(g, v, VEST, { lw: 4.5, shade: 'rgba(120,40,0,0.3)' });
      g.save(); g.beginPath(); v(g); g.clip(); g.fillStyle = '#e2e6ee'; g.fillRect(-100, -158, 200, 13); g.fillRect(-100, -126, 200, 9); g.fillRect(-60, -230, 10, 140); g.fillRect(50, -230, 10, 140); g.restore();
    }
    shape(g, rr(-82, -190, 28, 22, 4), '#e5671a', { lw: 3.5 }); shape(g, rr(54, -190, 28, 22, 4), '#e5671a', { lw: 3.5 });
    g.fillStyle = 'rgba(255,46,136,0.8)'; for (const [x, y, r] of [[-40, -190, 6], [-33, -178, 3.5], [-48, -176, 3]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(25,224,255,0.8)'; for (const [x, y, r] of [[36, -118, 5], [44, -126, 3], [30, -128, 3]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    // respirador al cuello
    line(g, [[-26, -204], [-36, -228]], INK, 5); line(g, [[26, -204], [36, -228]], INK, 5);
    shape(g, (c) => { c.moveTo(-28, -204); c.quadraticCurveTo(0, -190, 28, -204); c.lineTo(23, -168); c.quadraticCurveTo(0, -154, -23, -168); c.closePath(); }, '#5a5f6c', { lw: 4.5 });
    shape(g, ell(-24, -180, 10, 10), VEST, { lw: 3.5 }); shape(g, ell(24, -180, 10, 10), VEST, { lw: 3.5 }); for (let k = 0; k < 3; k++) line(g, [[-8, -188 + k * 7], [8, -188 + k * 7]], INK, 2.5);
    // cinturón de herramientas
    shape(g, rr(-78, -118, 156, 18, 5), BELT, { lw: 4 }); shape(g, rr(-10, -118, 20, 18, 3), '#d9a93a', { lw: 3.5, shade: false });
    shape(g, rr(-72, -102, 30, 28, 5), '#6b4a2c', { lw: 4 }); shape(g, rr(42, -102, 30, 28, 5), '#6b4a2c', { lw: 4 });
    line(g, [[22, -100], [28, -66]], '#7a4f2c', 7); shape(g, rr(14, -108, 28, 12, 3), '#aeb4c2', { lw: 3.5 });
    // cuello y cabeza ancha
    shape(g, rr(-18, -236, 36, 30, 8), '#7b4f31', { lw: 4 });
    shape(g, headPath(48, -308, -206, 40), SK);
    shape(g, ell(-50, -258, 8, 13), SK, { lw: 3.5 }); shape(g, ell(50, -258, 8, 13), SK, { lw: 3.5 });
    // ojos y cejas
    for (const s of [-1, 1]) {
      shape(g, ell(s * 19, -256, 9, 6.5), '#f6f1e6', { lw: 3, shade: false, light: false }); dot(g, s * 19 + s * 1.5, -256, 3.8, '#241410'); dot(g, s * 19 - s * 0.5, -258, 1.3, '#fff');
      line(g, [[s * 33, -270], [s * 8, -266]], BEARD, 7);
    }
    shape(g, ell(0, -241, 9, 7.5), '#82552f', { lw: 3.5, shade: false });
    // barba, bigote y sonrisa
    shape(g, (c) => { c.moveTo(-50, -260); c.bezierCurveTo(-54, -224, -34, -192, 0, -190); c.bezierCurveTo(34, -192, 54, -224, 50, -260); c.lineTo(38, -258); c.quadraticCurveTo(22, -246, 0, -246); c.quadraticCurveTo(-22, -246, -38, -258); c.closePath(); }, BEARD, { shade: 'rgba(0,0,0,0.35)' });
    shape(g, (c) => { c.moveTo(-18, -226); c.quadraticCurveTo(0, -208, 18, -226); c.quadraticCurveTo(0, -222, -18, -226); c.closePath(); }, '#f6f1e6', { lw: 3, shade: false, light: false });
    g.fillStyle = '#ffd23a'; g.fillRect(3, -224, 6, 6);
    shape(g, (c) => { c.moveTo(-30, -240); c.quadraticCurveTo(-12, -254, 0, -243); c.quadraticCurveTo(12, -254, 30, -240); c.quadraticCurveTo(12, -231, 0, -236); c.quadraticCurveTo(-12, -231, -30, -240); c.closePath(); }, BEARD, { shade: 'rgba(0,0,0,0.3)' });
    // gorro y gafas de soldar
    shape(g, (c) => { c.moveTo(-52, -270); c.bezierCurveTo(-58, -326, -26, -346, 0, -346); c.bezierCurveTo(26, -346, 58, -326, 52, -270); c.quadraticCurveTo(0, -284, -52, -270); c.closePath(); }, '#2d2c37');
    shape(g, (c) => { c.moveTo(-54, -276); c.quadraticCurveTo(0, -298, 54, -276); c.lineTo(51, -258); c.quadraticCurveTo(0, -280, -51, -258); c.closePath(); }, VEST, { shade: 'rgba(120,40,0,0.3)' });
    for (let k = -4; k <= 4; k++) line(g, [[k * 11, -284 + Math.abs(k) * 1.5], [k * 11, -265 + Math.abs(k) * 1.2]], 'rgba(120,40,0,0.5)', 2.5, 'butt');
    line(g, [[-50, -306], [50, -306]], INK, 12); line(g, [[-50, -306], [50, -306]], '#1b1a22', 7);
    for (const s of [-1, 1]) {
      shape(g, ell(s * 24, -308, 19, 19), '#c18d33', { lw: 4.5 }); shape(g, ell(s * 24, -308, 12.5, 12.5), '#ff9a3a', { lw: 3, shade: false });
      dot(g, s * 24 - 4, -313, 3.5, 'rgba(255,255,255,0.85)');
    }
    line(g, [[-6, -308], [6, -308]], '#c18d33', 5);
    // brazo derecho con la escopeta Aplastador
    limb(g, 80, -198, 110, -170, 48, HOODIE); limb(g, 110, -170, 120, -138, 44, HOODIE);
    g.save(); g.translate(116, -136); g.rotate(-0.62);
    shape(g, rr(-62, -9, 56, 26, 7), '#7e5230', { lw: 4.5 });
    shape(g, rr(-8, -11, 56, 25, 4), '#2d2c37', { lw: 4.5 }); g.fillStyle = VEST; g.fillRect(2, -4, 36, 5);
    shape(g, rr(44, -9, 118, 11, 3), '#42424f', { lw: 4.5 }); shape(g, rr(44, 5, 100, 9, 3), '#2d2c37', { lw: 4 });
    shape(g, rr(66, -1, 44, 19, 6), '#7e5230', { lw: 4.5 });
    g.restore();
    shape(g, ell(118, -132, 20, 18), GLOVE, { lw: 4 }); for (let k = 0; k < 3; k++) line(g, [[110 + k * 8, -122], [110 + k * 8, -114]], '#b98a52', 4);
    shape(g, ell(-100, -102, 20, 18), GLOVE, { lw: 4 });
  };

  // RONIN "HOJA" — samurái callejero: cresta cian, máscara de colmillos, chándal negro y katana
  figs.ronin = (g) => {
    const SK = '#d9b48a', JK = '#18171f', CY = '#19e0ff', WH = '#f3f1ea', PT = '#1f1e29';
    // vaina en la cadera izquierda
    g.save(); g.translate(-48, -122); g.rotate(2.72);
    shape(g, rr(0, -7, 118, 14, 6), '#14131a', { lw: 4 }); shape(g, rr(100, -8, 18, 16, 4), CY, { lw: 3.5 }); shape(g, rr(-6, -9, 22, 18, 4), '#c9ced9', { lw: 3.5 });
    g.restore();
    // piernas anchas con franja cian
    limb(g, -27, -118, -31, -26, 46, PT); limb(g, 27, -118, 31, -26, 46, PT);
    line(g, [[-46, -116], [-50, -34]], CY, 5); line(g, [[46, -116], [50, -34]], CY, 5);
    band(g, -27, -118, -31, -26, 0.84, 0.94, 48, '#2d2c3b'); band(g, 27, -118, 31, -26, 0.84, 0.94, 48, '#2d2c3b');
    boot(g, -31, -1, WH, CY, JK); boot(g, 33, 1, WH, CY, JK);
    // brazo izquierdo
    limb(g, -66, -198, -90, -152, 40, JK); limb(g, -90, -152, -86, -108, 36, JK);
    band(g, -90, -152, -86, -108, 0.66, 0.74, 36, CY); band(g, -90, -152, -86, -108, 0.82, 0.9, 36, CY);
    // torso
    shape(g, (c) => { c.moveTo(-28, -216); c.bezierCurveTo(-52, -214, -72, -206, -74, -186); c.lineTo(-68, -102); c.quadraticCurveTo(0, -92, 68, -102); c.lineTo(74, -186); c.bezierCurveTo(72, -206, 52, -214, 28, -216); c.quadraticCurveTo(0, -198, -28, -216); c.closePath(); }, JK);
    line(g, [[-62, -196], [-60, -108]], CY, 5); line(g, [[62, -196], [60, -108]], CY, 5);
    shape(g, rr(-68, -112, 136, 13, 5), '#101017', { lw: 3.5, shade: false });
    line(g, [[0, -208], [0, -112]], '#2e2d3d', 4); dot(g, 0, -190, 4, '#c9ced9', 2.5);
    g.beginPath(); g.arc(0, -158, 21, 0, TAU); g.lineWidth = 11; g.strokeStyle = INK; g.stroke(); g.lineWidth = 5.5; g.strokeStyle = CY; g.stroke();
    line(g, [[-16, -144], [18, -174]], INK, 11); line(g, [[-16, -144], [18, -174]], CY, 5.5);
    line(g, [[-14, -206], [-17, -166]], WH, 3.5); line(g, [[14, -206], [17, -166]], WH, 3.5); dot(g, -17, -164, 3.6, '#c9ced9', 2); dot(g, 17, -164, 3.6, '#c9ced9', 2);
    // cresta cian (detrás de la cabeza)
    shape(g, poly([[-20, -298], [-27, -340], [-12, -322], [-8, -362], [2, -328], [12, -362], [16, -322], [28, -340], [22, -298]]), CY, { lw: 4.5, shade: 'rgba(0,60,100,0.38)' });
    // cuello + cabeza
    shape(g, rr(-14, -234, 28, 28, 6), '#bf9970', { lw: 4 });
    shape(g, headPath(41, -312, -210, 33), SK);
    g.save(); g.beginPath(); headPath(41, -312, -210, 33)(g); g.clip();
    g.fillStyle = 'rgba(20,18,40,0.5)'; g.fillRect(-60, -330, 38, 90); g.fillRect(22, -330, 38, 90);
    g.fillStyle = CY; g.beginPath(); g.moveTo(-12, -314); g.quadraticCurveTo(0, -300, 12, -314); g.lineTo(11, -272); g.quadraticCurveTo(0, -262, -11, -272); g.closePath(); g.fill();
    line(g, [[-30, -296], [-24, -284]], CY, 2.5); line(g, [[-34, -286], [-27, -274]], CY, 2.5); line(g, [[30, -296], [24, -284]], CY, 2.5); line(g, [[34, -286], [27, -274]], CY, 2.5);
    g.restore();
    // ojos, cejas y cicatriz
    for (const s of [-1, 1]) {
      shape(g, (c) => { c.moveTo(s * 7, -258); c.quadraticCurveTo(s * 18, -268, s * 30, -259); c.quadraticCurveTo(s * 18, -252, s * 7, -258); c.closePath(); }, '#f6f1e6', { lw: 3, shade: false, light: false });
      dot(g, s * 19, -259, 3.6, '#2a1b12'); dot(g, s * 18, -260.5, 1.2, '#fff');
      line(g, [[s * 33, -274], [s * 7, -265]], INK, 6.5);
    }
    line(g, [[-26, -286], [-19, -250]], '#b5555e', 3.5); for (let k = 0; k < 3; k++) line(g, [[-28 + k * 3, -278 + k * 10], [-17 + k * 3, -277 + k * 10]], '#d9a0a4', 2.2);
    // máscara con colmillos
    shape(g, (c) => { c.moveTo(-45, -256); c.quadraticCurveTo(0, -244, 45, -256); c.lineTo(36, -222); c.quadraticCurveTo(20, -205, 0, -205); c.quadraticCurveTo(-20, -205, -36, -222); c.closePath(); }, '#15141b', { lw: 4.5 });
    g.beginPath(); g.moveTo(-44, -255); g.quadraticCurveTo(0, -243, 44, -255); g.lineWidth = 4; g.strokeStyle = CY; g.stroke();
    for (let k = -2; k <= 2; k++) { const big = Math.abs(k) === 2 ? 1.5 : 1; shape(g, poly([[k * 12 - 6, -238], [k * 12 + 6, -238], [k * 12, -238 + 13 * big]]), WH, { lw: 2.5, shade: false, light: false }); }
    line(g, [[-14, -236], [14, -236]], WH, 3);
    shape(g, poly([[-44, -246], [-80, -226], [-72, -216], [-46, -234]]), CY, { lw: 3.5, shade: false }); shape(g, poly([[-42, -240], [-72, -204], [-62, -200], [-40, -230]]), '#15141b', { lw: 3.5, shade: false });
    dot(g, -42, -240, 7, '#15141b', 3.5);
    // cuello alto del chándal
    shape(g, poly([[-30, -214], [-26, -248], [-50, -236], [-66, -204]]), JK, { lw: 4.5 }); shape(g, poly(mirror([[-30, -214], [-26, -248], [-50, -236], [-66, -204]])), JK, { lw: 4.5 });
    line(g, [[-26, -246], [-48, -234]], CY, 3); line(g, [[26, -246], [48, -234]], CY, 3);
    // brazo derecho con la katana
    limb(g, 66, -198, 96, -170, 40, JK); limb(g, 96, -170, 100, -138, 36, JK);
    band(g, 96, -170, 100, -138, 0.7, 0.8, 36, CY);
    g.save(); g.translate(100, -134); g.rotate(-1.12);
    g.beginPath(); g.moveTo(14, -5); g.quadraticCurveTo(100, -17, 188, -2); g.lineTo(184, 3); g.quadraticCurveTo(100, 3, 14, 7); g.closePath();
    g.fillStyle = '#eaf0f8'; g.fill(); g.lineWidth = 4.5; g.lineJoin = 'round'; g.strokeStyle = INK; g.stroke();
    g.shadowColor = CY; g.shadowBlur = 12; line(g, [[24, 3], [176, 1]], CY, 2.6); g.shadowBlur = 0; line(g, [[24, -3], [150, -9]], 'rgba(255,255,255,0.9)', 2.2);
    shape(g, rr(-38, -7, 54, 14, 5), '#1b1a22', { lw: 4.5 });
    for (let k = 0; k < 4; k++) { line(g, [[-32 + k * 11, -6], [-24 + k * 11, 6]], CY, 2.5); line(g, [[-24 + k * 11, -6], [-32 + k * 11, 6]], CY, 2.5); }
    shape(g, ell(-40, 0, 7, 8), '#c9ced9', { lw: 3.5 }); shape(g, rr(11, -17, 7, 34, 3), '#dfe3ec', { lw: 3.5 });
    g.restore();
    shape(g, ell(100, -130, 17, 16), '#1b1a22', { lw: 4 }); for (let k = 0; k < 3; k++) line(g, [[92 + k * 8, -120], [92 + k * 8, -113]], WH, 3);
    shape(g, ell(-86, -100, 17, 16), '#1b1a22', { lw: 4 }); for (let k = 0; k < 3; k++) line(g, [[-94 + k * 8, -90], [-94 + k * 8, -83]], WH, 3);
  };

  function paint(id) {
    const c = document.createElement('canvas'); c.width = CW * RES; c.height = CHH * RES;
    const g = c.getContext('2d'); g.scale(RES, RES); g.translate(FX, FY);
    if (figs[id]) figs[id](g);
    return c;
  }
  function sprite(id, kind) {
    const key = id + (kind || '');
    if (cache[key]) return cache[key];
    if (kind === 'sil') { // silueta oscura con borde de luz del color del personaje (bloqueado)
      const base = sprite(id), col = (CHARS.find(c => c.id === id) || {}).col || '#ffffff';
      const dark = document.createElement('canvas'); dark.width = base.width; dark.height = base.height;
      let g = dark.getContext('2d'); g.drawImage(base, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#1a1726'; g.fillRect(0, 0, dark.width, dark.height);
      const rim = document.createElement('canvas'); rim.width = base.width; rim.height = base.height;
      g = rim.getContext('2d'); g.drawImage(base, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, rim.width, rim.height);
      const c = document.createElement('canvas'); c.width = base.width; c.height = base.height; g = c.getContext('2d');
      g.globalAlpha = 0.85;
      for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; g.drawImage(rim, Math.cos(a) * 5, Math.sin(a) * 5); }
      g.globalAlpha = 1; g.drawImage(dark, 0, 0);
      return (cache[key] = c);
    }
    return (cache[key] = paint(id));
  }
  // ── Versión renderizada en 3D (si las imágenes cargaron) ──
  const photoSil = {};
  function photoSilhouette(id) { // silueta oscura con borde de luz del color del personaje (bloqueado)
    if (photoSil[id]) return photoSil[id];
    const base = Art.mip('c:' + id, 1), col = (CHARS.find(c => c.id === id) || {}).col || '#ffffff';
    const dark = document.createElement('canvas'); dark.width = base.width; dark.height = base.height;
    let g = dark.getContext('2d'); g.drawImage(base, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#1a1726'; g.fillRect(0, 0, dark.width, dark.height);
    const rim = document.createElement('canvas'); rim.width = base.width; rim.height = base.height;
    g = rim.getContext('2d'); g.drawImage(base, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, rim.width, rim.height);
    const c = document.createElement('canvas'); c.width = base.width; c.height = base.height; g = c.getContext('2d');
    g.globalAlpha = 0.85;
    for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; g.drawImage(rim, Math.cos(a) * 3, Math.sin(a) * 3); }
    g.globalAlpha = 1; g.drawImage(dark, 0, 0);
    return (photoSil[id] = c);
  }
  function photoDraw(g, id, x, y, h, o) {
    const M = Art.META.chars[id]; if (!M || !Art.has('c:' + id)) return false;
    const k = h / M.figH, flip = o.flip ? -1 : 1, m = g.getTransform(), dev = Math.hypot(m.a, m.b) * k;
    const src = o.sil ? photoSilhouette(id) : Art.mip('c:' + id, Art.levelFor(dev, 2));
    g.save(); g.translate(x, y);
    if (o.rot) g.rotate(o.rot);
    g.scale(flip * k * (o.sx || 1), k * (o.sy || 1));
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(src, -M.fx, -M.fy, M.iw, M.ih);
    g.restore();
    return true;
  }
  // Busto del personaje encajado en un rectángulo (tarjetas de selección). Devuelve false si no hay imagen.
  function drawBust(g, id, x, y, w, h, o = {}) {
    const M = Art.META.chars[id]; if (!M || !Art.has('c:' + id)) return false;
    const src = o.sil ? photoSilhouette(id) : Art.mip('c:' + id, 1), f = 2, [bx, by, bw, bh] = M.bust;
    const s0x = Math.max(bx, 0), s0y = Math.max(by, 0), s1x = Math.min(bx + bw, M.iw), s1y = Math.min(by + bh, M.ih);
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    if (o.flip) { g.translate(x + w, y); g.scale(-1, 1); } else g.translate(x, y);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(src, s0x / f, s0y / f, (s1x - s0x) / f, (s1y - s0y) / f, (s0x - bx) / bw * w, (s0y - by) / bh * h, (s1x - s0x) / bw * w, (s1y - s0y) / bh * h);
    g.restore();
    return true;
  }
  // Dibuja al personaje con los pies en (x, y) y altura total h
  function draw(g, id, x, y, h, o = {}) {
    if (photoDraw(g, id, x, y, h, o)) return;
    const k = h / FIG_H, spr = sprite(id, o.sil ? 'sil' : ''), flip = o.flip ? -1 : 1;
    g.save(); g.translate(x, y);
    if (o.rot) g.rotate(o.rot);
    g.scale(flip * k * (o.sx || 1), k * (o.sy || 1));
    g.drawImage(spr, -FX, -FY, CW, CHH);
    g.restore();
  }
  return { sprite, draw, drawBust, FIG_H, FX, FY, CW, CHH };
})();
