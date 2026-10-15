'use strict';
// ───────── Fondo de calle: pared de ladrillo, carteles pegados, grafitis y acera ─────────
// Se pinta una sola vez en un lienzo oculto (por tamaño de ventana) y encima se animan solo los neones,
// la farola y la antena. Lo usan el título, la selección, el taller y la pantalla de carga.
const Street = (() => {
  let cache = null, key = '';
  const BRICKS = ['#6a2e28', '#74352b', '#5c2822', '#7e3f2f', '#4f2420', '#68302a'];
  const geo = (W, H) => ({ wallTop: Math.round(H * 0.30), floorY: Math.round(H - 104), curbY: Math.round(H - 38) });

  function brickPattern() {
    const c = document.createElement('canvas'); c.width = 216; c.height = 120;
    const g = c.getContext('2d'), r = new RNG(5);
    g.fillStyle = '#26110f'; g.fillRect(0, 0, 216, 120);
    for (let row = 0; row < 8; row++) for (let col = -1; col < 6; col++) {
      const x = col * 36 + (row % 2 ? 18 : 0), y = row * 15;
      g.fillStyle = BRICKS[r.int(0, BRICKS.length - 1)]; g.fillRect(x + 1, y + 1, 34, 13);
      g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(x + 1, y + 1, 34, 3);
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x + 1, y + 11, 34, 3);
      if (r.chance(0.28)) { g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x + 4 + r.int(0, 20), y + 4, r.int(3, 9), 5); }
    }
    return c;
  }

  // ── carteles pegados ──
  function poster(kind, x, y, w, h, rot) {
    const cols = { wanted: '#e8dcb8', gig: '#ff2e88', drip: '#ffd81f', kara: '#12e6ff', flat: '#ece3c8' };
    paper(x, y, w, h, { rot, col: cols[kind] });
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot); ctx.translate(-w / 2, -h / 2);
    ctx.beginPath(); ctx.rect(4, 4, w - 8, h - 8); ctx.clip();
    if (kind === 'wanted') {
      dispText('SE BUSCA', w / 2, h * 0.17, h * 0.15, INK, 'center', { lw: 0, sh: 0 });
      ctx.fillStyle = INK; ctx.fillRect(10, h * 0.20, w - 20, 3);
      // retrato: cráneo, cresta y gafas
      const cx = w / 2, cy = h * 0.44, r = w * 0.2;
      ctx.fillStyle = '#d9a37a'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#ff2bd6'; ctx.beginPath(); for (let k = 0; k < 5; k++) { ctx.moveTo(cx - r * 0.5 + k * r * 0.25, cy - r * 0.85); ctx.lineTo(cx - r * 0.38 + k * r * 0.25, cy - r * 1.55); ctx.lineTo(cx - r * 0.25 + k * r * 0.25, cy - r * 0.85); } ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.fillRect(cx - r * 0.85, cy - r * 0.22, r * 1.7, r * 0.42); ctx.fillStyle = '#ffe14a'; ctx.fillRect(cx - r * 0.7, cy - r * 0.15, r * 0.5, r * 0.12);
      ctx.fillRect(cx + r * 0.2, cy - r * 0.15, r * 0.5, r * 0.12);
      ctx.fillStyle = INK; ctx.fillRect(cx - r * 0.45, cy + r * 0.45, r * 0.9, 4);
      dispText('DON CROMO', w / 2, h * 0.79, h * 0.12, INK, 'center', { lw: 0, sh: 0 });
      text('VIVO O MUERTO', w / 2, h * 0.865, h * 0.055, '#3a2a1c', 'center', '800');
      dispText('5.000 ¢', w / 2, h * 0.96, h * 0.1, '#b3122e', 'center', { lw: 0, sh: 0 });
    } else if (kind === 'gig') {
      ctx.fillStyle = '#ff7ab0'; ctx.beginPath();
      for (let k = 0; k < 14; k++) { const a0 = (k / 14) * TAU, a1 = ((k + 0.5) / 14) * TAU; ctx.moveTo(w / 2, h * 0.42); ctx.lineTo(w / 2 + Math.cos(a0) * w * 2, h * 0.42 + Math.sin(a0) * w * 2); ctx.lineTo(w / 2 + Math.cos(a1) * w * 2, h * 0.42 + Math.sin(a1) * w * 2); }
      ctx.fill();
      dispText('SYNDI', w / 2, h * 0.33, h * 0.2, '#fff', 'center', { lw: h * 0.03, sh: 3 });
      dispText('CATE', w / 2, h * 0.52, h * 0.2, '#ffe14a', 'center', { lw: h * 0.03, sh: 3 });
      ctx.fillStyle = INK; ctx.fillRect(10, h * 0.62, w - 20, h * 0.1); dispText('EN VIVO', w / 2, h * 0.695, h * 0.075, '#fff', 'center', { lw: 0, sh: 0 });
      text('VIE · 23:00 · EL SÓTANO', w / 2, h * 0.84, h * 0.055, INK, 'center', '800');
      text('ENTRADA LIBRE', w / 2, h * 0.92, h * 0.05, INK, 'center', '700');
    } else if (kind === 'drip') {
      ctx.fillStyle = INK; for (const yy of [6, h - 24]) for (let k = -1; k < w / 18 + 1; k++) { ctx.beginPath(); ctx.moveTo(k * 18, yy); ctx.lineTo(k * 18 + 9, yy); ctx.lineTo(k * 18 + 18 + 9, yy + 18); ctx.lineTo(k * 18 + 18, yy + 18); ctx.fill(); }
      dispText('NEURO', w / 2, h * 0.34, h * 0.22, INK, 'center', { lw: 0, sh: 0 });
      dispText('DRIP', w / 2, h * 0.55, h * 0.22, '#ff2bd6', 'center', { lw: h * 0.025, sh: 3 });
      ctx.fillStyle = '#ff2bd6'; for (let k = 0; k < 4; k++) { const dx = w * (0.2 + k * 0.2); ctx.beginPath(); ctx.arc(dx, h * 0.66 + (k % 2) * 10, 5, 0, TAU); ctx.fill(); }
      text('¿YA LO HAS PROBADO?', w / 2, h * 0.76, h * 0.055, INK, 'center', '800');
    } else if (kind === 'kara') {
      ctx.fillStyle = INK; ctx.fillRect(0, 0, w, h * 0.3);
      dispText('KARAOKE', w / 2, h * 0.22, h * 0.17, '#12e6ff', 'center', { lw: 0, sh: 0 });
      dispText('NEÓN', w / 2, h * 0.52, h * 0.2, INK, 'center', { lw: 0, sh: 0 });
      text('24 HORAS', w / 2, h * 0.65, h * 0.07, INK, 'center', '800');
      ctx.fillStyle = '#ff2bd6'; ctx.beginPath(); ctx.arc(w * 0.5, h * 0.85, h * 0.09, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = INK; ctx.fillRect(w * 0.5 - 3, h * 0.78, 6, h * 0.1); ctx.fillRect(w * 0.5 - 10, h * 0.78, 20, 5);
    }
    ctx.restore();
  }

  function sticker(x, y, r, col, kind) {
    ctx.save(); ctx.translate(x, y); ctx.rotate((hash2(x | 0, y | 0, 3) - 0.5) * 0.8);
    ctx.fillStyle = '#f2ecda'; ctx.beginPath(); ctx.arc(0, 0, r + 3, 0, TAU); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    if (kind === 0) { ctx.beginPath(); ctx.moveTo(r * 0.2, -r * 0.7); ctx.lineTo(-r * 0.4, r * 0.1); ctx.lineTo(0, r * 0.1); ctx.lineTo(-r * 0.2, r * 0.7); ctx.lineTo(r * 0.4, -r * 0.1); ctx.lineTo(0, -r * 0.1); ctx.closePath(); ctx.fill(); }
    else if (kind === 1) { dispText('NS', 0, r * 0.32, r * 0.95, INK, 'center', { lw: 0, sh: 0 }); }
    else if (kind === 2) { ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r * 0.14, 0, TAU); ctx.fill(); }
    else { ctx.beginPath(); for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * TAU / 5, b = a + TAU / 10; ctx.lineTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7); ctx.lineTo(Math.cos(b) * r * 0.3, Math.sin(b) * r * 0.3); } ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }

  function paint(W, H) {
    const { wallTop, floorY, curbY } = geo(W, H);
    // cielo
    let g = ctx.createLinearGradient(0, 0, 0, wallTop + 30);
    g.addColorStop(0, '#08051a'); g.addColorStop(0.6, '#2a0f40'); g.addColorStop(1, '#7a1d55');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, wallTop + 40);
    // luna rosa
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; ctx.drawImage(glowSprite('#ff2bd6', 64), W * 0.72 - 200, wallTop - 170, 400, 400); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffb0d8'; ctx.beginPath(); ctx.arc(W * 0.72, wallTop - 20, 46, 0, TAU); ctx.fill();
    // siluetas de edificios detrás de la pared
    const r = new RNG(1337), cols = ['#19f0ff', '#ff2bd6', '#ffe14a'];
    for (let layer = 0; layer < 2; layer++) {
      let x = -20;
      while (x < W + 40) {
        const bw = r.range(46, 120), bh = r.range(60, 200) * (layer ? 0.7 : 1), sh = layer ? '#1a0b30' : '#120824';
        ctx.fillStyle = sh; ctx.fillRect(x, wallTop + 10 - bh, bw, bh + 30);
        ctx.fillStyle = rgba(cols[r.int(0, 2)], 0.7); ctx.fillRect(x, wallTop + 10 - bh, bw, 2);
        for (let j = 0; j < bh / 18; j++) for (let i = 0; i < bw / 13; i++) if (r.chance(0.3)) { ctx.fillStyle = r.chance(0.25) ? rgba(cols[r.int(0, 2)], 0.8) : 'rgba(255,225,140,0.6)'; ctx.fillRect(x + 4 + i * 13, wallTop + 10 - bh + 8 + j * 18, 6, 8); }
        x += bw + r.range(2, 16);
      }
    }
    // azotea con trastos (sobre la cornisa)
    const roof = (x, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, wallTop - 14 - h, w, h + 2); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(x, wallTop - 14 - h, w, h + 2); };
    roof(W * 0.08, 70, 34, '#3a3644'); roof(W * 0.34, 54, 24, '#4a4654'); roof(W * 0.57, 90, 40, '#33303d');
    ctx.fillStyle = '#6a6678'; for (let k = 0; k < 4; k++) ctx.fillRect(W * 0.08 + 8 + k * 15, wallTop - 14 - 28, 8, 22);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(W * 0.46, wallTop - 14); ctx.lineTo(W * 0.46, wallTop - 120); ctx.moveTo(W * 0.46 - 22, wallTop - 90); ctx.lineTo(W * 0.46 + 22, wallTop - 90); ctx.moveTo(W * 0.46 - 14, wallTop - 62); ctx.lineTo(W * 0.46 + 14, wallTop - 62); ctx.stroke();
    // pared de ladrillo
    ctx.save(); ctx.beginPath(); ctx.rect(0, wallTop, W, floorY - wallTop); ctx.clip();
    ctx.fillStyle = ctx.createPattern(brickPattern(), 'repeat'); ctx.fillRect(0, wallTop, W, floorY - wallTop);
    g = ctx.createLinearGradient(0, wallTop, 0, floorY); g.addColorStop(0, 'rgba(8,3,18,0.62)'); g.addColorStop(0.3, 'rgba(8,3,18,0.18)'); g.addColorStop(0.8, 'rgba(8,3,18,0.28)'); g.addColorStop(1, 'rgba(4,2,10,0.7)');
    ctx.fillStyle = g; ctx.fillRect(0, wallTop, W, floorY - wallTop);
    // manchas de humedad
    for (let k = 0; k < 22; k++) { const x = r.range(0, W), len = r.range(40, 220); const gg = ctx.createLinearGradient(0, wallTop, 0, wallTop + len); gg.addColorStop(0, 'rgba(0,0,0,0.30)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gg; ctx.fillRect(x, wallTop, r.range(5, 16), len); }
    // tuberías y cables
    for (const px of [W * 0.035, W * 0.955]) { ctx.fillStyle = '#6d6a78'; ctx.fillRect(px - 7, wallTop, 14, floorY - wallTop); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(px - 5, wallTop, 3, floorY - wallTop); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(px - 7, wallTop, 14, floorY - wallTop); for (let yy = wallTop + 30; yy < floorY; yy += 120) { ctx.fillStyle = '#4a4756'; ctx.fillRect(px - 11, yy, 22, 8); ctx.strokeRect(px - 11, yy, 22, 8); } }
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    for (const [y0, sag] of [[wallTop + 30, 26], [wallTop + 46, 34]]) { ctx.beginPath(); ctx.moveTo(0, y0); ctx.quadraticCurveTo(W * 0.5, y0 + sag, W, y0 - 6); ctx.stroke(); }
    // persiana metálica
    const sx = W * 0.58, sw = W * 0.2, sy = floorY - 210;
    ctx.fillStyle = '#4b4856'; ctx.fillRect(sx, sy, sw, 210);
    for (let yy = sy + 6; yy < floorY; yy += 9) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(sx, yy, sw, 3); ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(sx, yy + 3, sw, 2); }
    ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.strokeRect(sx, sy, sw, 210); ctx.fillStyle = '#2c2a34'; ctx.fillRect(sx - 6, sy - 10, sw + 12, 14); ctx.strokeRect(sx - 6, sy - 10, sw + 12, 14);
    ctx.fillStyle = '#ffd81f'; ctx.fillRect(sx + sw / 2 - 9, floorY - 22, 18, 14); ctx.strokeRect(sx + sw / 2 - 9, floorY - 22, 18, 14);
    // ventana con rejas
    const wx = W * 0.34, wy = wallTop + 70, ww = 96, wh = 82;
    ctx.fillStyle = '#ffb347'; ctx.fillRect(wx, wy, ww, wh); g = ctx.createLinearGradient(0, wy, 0, wy + wh); g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(wx, wy, ww, wh);
    ctx.fillStyle = INK; ctx.fillRect(wx + 30, wy + 30, 30, 52); ctx.beginPath(); ctx.arc(wx + 45, wy + 30, 15, 0, TAU); ctx.fill();   // silueta
    ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.strokeRect(wx, wy, ww, wh); ctx.lineWidth = 4; ctx.beginPath(); for (let k = 1; k < 5; k++) { ctx.moveTo(wx + k * ww / 5, wy); ctx.lineTo(wx + k * ww / 5, wy + wh); } ctx.stroke();
    ctx.fillStyle = '#4a4650'; ctx.fillRect(wx - 8, wy + wh, ww + 16, 10); ctx.strokeRect(wx - 8, wy + wh, ww + 16, 10);
    // carteles
    poster('wanted', W * 0.405, wallTop + 40, 120, 168, -0.04);
    poster('gig', W * 0.535, wallTop + 118, 108, 148, 0.05);
    poster('drip', W * 0.705, wallTop + 36, 104, 140, 0.03);
    poster('kara', W * 0.885, wallTop + 74, 100, 140, -0.05);
    poster('gig', W * 0.19, wallTop + 120, 90, 124, -0.03);
    // pegatinas
    for (let k = 0; k < 16; k++) { const px = r.range(W * 0.04, W * 0.96), py = r.range(wallTop + 20, floorY - 30); sticker(px, py, r.range(9, 15), cols[k % 3], k % 4); }
    ctx.restore();
    // cornisa y rodapié
    ctx.fillStyle = '#4a4650'; ctx.fillRect(-4, wallTop - 14, W + 8, 18); ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(-4, wallTop - 14, W + 8, 4);
    ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.strokeRect(-4, wallTop - 14, W + 8, 18);
    ctx.fillStyle = '#34313c'; ctx.fillRect(-4, floorY - 6, W + 8, 10); ctx.strokeRect(-4, floorY - 6, W + 8, 10);
    // acera
    g = ctx.createLinearGradient(0, floorY, 0, curbY); g.addColorStop(0, '#2b2833'); g.addColorStop(1, '#5a5663');
    ctx.fillStyle = g; ctx.fillRect(0, floorY + 4, W, curbY - floorY - 4);
    ctx.strokeStyle = 'rgba(0,0,0,0.38)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let x = -W; x < W * 2; x += 150) { ctx.moveTo(x, floorY + 4); ctx.lineTo(W / 2 + (x - W / 2) * 1.55, curbY); }
    ctx.moveTo(0, floorY + (curbY - floorY) * 0.42); ctx.lineTo(W, floorY + (curbY - floorY) * 0.42); ctx.stroke();
    for (let k = 0; k < 40; k++) { ctx.fillStyle = `rgba(0,0,0,${r.range(0.06, 0.2)})`; ctx.fillRect(r.range(0, W), r.range(floorY + 10, curbY - 4), r.range(2, 6), r.range(1, 3)); }
    // bordillo y calzada
    ctx.fillStyle = '#85808f'; ctx.fillRect(0, curbY, W, 9); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(0, curbY, W, 3); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(-4, curbY, W + 8, 9);
    ctx.fillStyle = '#121018'; ctx.fillRect(0, curbY + 9, W, H - curbY);
    // charcos con reflejos
    for (let k = 0; k < 5; k++) { const px = r.range(W * 0.1, W * 0.9), py = r.range(floorY + 30, curbY - 8); ctx.fillStyle = rgba(cols[k % 3], 0.22); ctx.beginPath(); ctx.ellipse(px, py, r.range(30, 70), 6, 0, 0, TAU); ctx.fill(); }
    // letrero de neón "BAR" (tubos; el brillo se anima encima)
    ctx.save(); ctx.translate(W * 0.205, wallTop + 56); ctx.fillStyle = '#17131f'; rrect(-4, -6, 88, 50, 6); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
    ctx.restore();
  }

  function build(W, H, s) {
    const c = document.createElement('canvas'); c.width = Math.ceil(W * s); c.height = Math.ceil(H * s);
    const prev = ctx; ctx = c.getContext('2d'); ctx.scale(s, s); ctx.textBaseline = 'alphabetic';
    try { paint(W, H); } finally { ctx = prev; }
    return c;
  }

  // Dibuja el fondo (estático + neones/farola animados). Debe llamarse con la UI en modo lógico.
  function draw(t) {
    const W = U.w, H = U.h, k = W.toFixed(0) + 'x' + H.toFixed(0) + '@' + U.s.toFixed(3);
    if (key !== k) { cache = build(W, H, U.s); key = k; }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(cache, 0, 0, U.cw, U.ch); uiBegin();
    const { wallTop, floorY } = geo(W, H);
    // cartel de neón "BAR": parpadea
    const fl = (Math.sin(t * 37) > 0.93 || (Math.sin(t * 2.3) > 0.985)) ? 0.25 : 1;
    const nx = W * 0.205, ny = wallTop + 56;
    ctx.save(); ctx.translate(nx, ny);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.8 * fl; ctx.drawImage(glowSprite('#19f0ff', 64), -50, -50, 190, 140); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.font = `400 42px ${FONT_DISP}`; ctx.textAlign = 'center'; ctx.fillStyle = fl > 0.5 ? '#bff9ff' : '#2a6a74'; ctx.strokeStyle = '#19f0ff'; ctx.lineWidth = 2; ctx.fillText('BAR', 40, 36); ctx.strokeText('BAR', 40, 36);
    ctx.restore();
    // luz cálida de la ventana
    const wx = W * 0.34, wy = wallTop + 70;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 + 0.04 * Math.sin(t * 1.7); ctx.drawImage(glowSprite('#ffb347', 64), wx - 60, wy - 50, 216, 190); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // luz roja de la antena
    ctx.fillStyle = Math.sin(t * 3) > 0 ? '#ff3355' : '#4a0f1a'; ctx.beginPath(); ctx.arc(W * 0.46, wallTop - 124, 4, 0, TAU); ctx.fill();
    // farola
    const lx = W * 0.452, top = wallTop + 54, base = floorY + 40;
    ctx.fillStyle = '#2b2933'; ctx.fillRect(lx - 4, top, 8, base - top); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(lx - 4, top, 8, base - top);
    ctx.fillStyle = '#2b2933'; ctx.fillRect(lx - 4, top - 4, 44, 8); ctx.strokeRect(lx - 4, top - 4, 44, 8);
    ctx.fillStyle = '#ffe9a8'; ctx.fillRect(lx + 28, top + 4, 22, 6);
    const flk = 0.9 + 0.1 * Math.sin(t * 9) + (Math.sin(t * 1.3) > 0.992 ? -0.5 : 0);
    ctx.globalCompositeOperation = 'lighter';
    const cone = ctx.createLinearGradient(0, top + 10, 0, base); cone.addColorStop(0, `rgba(255,224,150,${0.22 * flk})`); cone.addColorStop(1, 'rgba(255,224,150,0)');
    ctx.fillStyle = cone; ctx.beginPath(); ctx.moveTo(lx + 28, top + 10); ctx.lineTo(lx + 50, top + 10); ctx.lineTo(lx + 150, base); ctx.lineTo(lx - 70, base); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.9 * flk; ctx.drawImage(glowSprite('#ffe9a8', 64), lx + 8, top - 30, 84, 84); ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  return { draw };
})();

function drawCityBackdrop(t) { Street.draw(t); drawRain(0.016); uiBegin(); }

// Firma de cada personaje, pintada en la pared sobre su cabeza (título)
function drawCrewTag(name, x, y, col, size, rot, faded) {
  ctx.save(); if (faded) ctx.globalAlpha = 0.45;
  sprayText(name, x, y, size, faded ? '#7a7388' : col, { rot, jitter: 0.8 });
  ctx.restore();
}
