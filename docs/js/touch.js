'use strict';
// ───────── Controles táctiles (móvil/tablet) ─────────
// Stick izquierdo flotante = moverse. Stick derecho flotante = apuntar y disparar (dispara mientras está inclinado).
// Botones: esquiva, habilidad, interactuar, pausa y mapa. Tocar un arma de la barra inferior la selecciona.
// Se activa solo (pantalla táctil) o al recibir el primer toque. En PC con ratón/teclado no cambia nada.
const TouchUI = (() => {
  const T = { on: false, move: null, aim: null, aimAng: 0, ids: {}, pulse: 0 };
  const R = 70;              // radio del stick (unidades lógicas de la interfaz)
  const FIRE_MIN = 20;       // inclinación mínima del stick de apuntado para disparar
  const AIM_DIST = 240;      // distancia (px de mundo) a la que se pone la mira
  const AIM_ASSIST = 0.12;   // ayuda de puntería (rad): suaviza lo impreciso del dedo

  const lp = (t) => {
    const r = canvas.getBoundingClientRect();
    return { x: (t.clientX - r.left) * (U.cw / r.width) / U.s, y: (t.clientY - r.top) * (U.ch / r.height) / U.s };
  };
  const hit = (b, p, k = 1.3) => Math.hypot(p.x - b.x, p.y - b.y) <= b.r * k;
  const inRect = (r, p) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

  // Posiciones de los botones (dependen del tamaño lógico de la pantalla)
  function btns() {
    const w = U.w, h = U.h;
    return {
      dash: { x: w - 84, y: h - 124, r: 46, code: 'ShiftLeft' },
      abil: { x: w - 200, y: h - 86, r: 38, code: 'Space' },
      use: { x: w - 84, y: h - 240, r: 40, code: 'KeyE' },
      pause: { x: 376, y: 38, r: 22, code: 'Escape' },
      map: { x: 430, y: 38, r: 22, code: 'KeyM' },
    };
  }
  function miniRect() { const s = 150; return { x: U.w - s - 16, y: 116, w: s, h: s, size: s }; }
  function closeChip() { return { x: U.w - 70, y: 38, r: 26, code: 'Escape' }; }

  function enable() { if (!T.on) { T.on = true; document.documentElement.classList.add('touch'); } }

  // ───── Eventos ─────
  function onStart(e) {
    enable(); e.preventDefault();
    for (const t of e.changedTouches) {
      const p = lp(t), st = { role: 'none', ox: p.x, oy: p.y, x: p.x, y: p.y };
      T.ids[t.identifier] = st;
      if (Game.state !== 'play') {
        In.mx = p.x * U.s; In.my = p.y * U.s; In.ux = p.x; In.uy = p.y; In.clicked = true; st.role = 'ui';
        if (Game.state === 'map' && hit(closeChip(), p)) { In.pressed.Escape = true; In.clicked = false; }
        continue;
      }
      const B = btns();
      let done = false;
      for (const k of ['pause', 'map', 'dash', 'abil']) if (!done && hit(B[k], p)) { In.pressed[B[k].code] = true; st.role = 'btn'; st.btn = k; done = true; }
      if (!done && S.interact && hit(B.use, p)) { In.pressed.KeyE = true; st.role = 'btn'; st.btn = 'use'; done = true; }
      if (!done && Game.wslots) for (const s of Game.wslots) if (inRect(s, p)) { In.pressed['Digit' + (s.i + 1)] = true; st.role = 'btn'; done = true; break; }
      if (done || inRect(miniRect(), p)) continue;
      if (p.x < U.w * 0.5) { if (!T.move) { st.role = 'move'; T.move = st; } }
      else if (!T.aim) { st.role = 'aim'; T.aim = st; }
    }
  }
  function onMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const st = T.ids[t.identifier]; if (!st) continue;
      const p = lp(t); st.x = p.x; st.y = p.y;
      if (st.role === 'ui') { In.mx = p.x * U.s; In.my = p.y * U.s; In.ux = p.x; In.uy = p.y; }
    }
  }
  function onEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const st = T.ids[t.identifier]; if (!st) continue;
      if (st.role === 'move') T.move = null;
      if (st.role === 'aim') T.aim = null;
      if (st.role === 'ui' && Game.state !== 'play') { In.ux = In.uy = In.mx = In.my = -1e4; }
      delete T.ids[t.identifier];
    }
    if (!T.move) { In.ax = 0; In.ay = 0; }
    if (!T.aim) In.down = false;
  }

  function setup() {
    const o = { passive: false };
    canvas.addEventListener('touchstart', onStart, o);
    canvas.addEventListener('touchmove', onMove, o);
    canvas.addEventListener('touchend', onEnd, o);
    canvas.addEventListener('touchcancel', onEnd, o);
    // El audio necesita un gesto del usuario: el fin de un toque cuenta
    window.addEventListener('touchend', () => Snd.init(), { passive: true });
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) enable();
    // Pausar al salir de la app / apagar la pantalla
    document.addEventListener('visibilitychange', () => { if (document.hidden && Game.state === 'play') Game.state = 'pause'; });
  }

  // Vector del stick (con zona muerta); arrastra el origen si el dedo se pasa del radio
  function vec(st, dead) {
    let dx = st.x - st.ox, dy = st.y - st.oy; const len = Math.hypot(dx, dy);
    if (len > R) { const ex = len - R; st.ox += dx / len * ex; st.oy += dy / len * ex; dx = st.x - st.ox; dy = st.y - st.oy; }
    const l = Math.hypot(dx, dy) || 1, m = Math.min(len, R) / R, mm = m < dead ? 0 : (m - dead) / (1 - dead);
    return { x: dx / l, y: dy / l, m: mm, len: Math.min(len, R * 1.6) };
  }

  // Al principio de cada fotograma: convierte los dedos en entrada del juego
  function update() {
    if (!T.on) return;
    if (Game.state !== 'play') {
      T.move = null; T.aim = null; In.ax = 0; In.ay = 0; In.down = false;
      for (const id in T.ids) if (T.ids[id].role === 'move' || T.ids[id].role === 'aim') T.ids[id].role = 'none';
      return;
    }
    T.pulse += 0.016;
    if (T.move) { const v = vec(T.move, 0.12); In.ax = v.x * v.m; In.ay = v.y * v.m; } else { In.ax = 0; In.ay = 0; }
    let fire = false;
    if (T.aim) {
      const v = vec(T.aim, 0);
      const dx = T.aim.x - T.aim.ox, dy = T.aim.y - T.aim.oy, raw = Math.hypot(dx, dy);
      if (raw > 10) T.aimAng = Math.atan2(dy, dx);
      fire = raw >= FIRE_MIN;
    }
    let ang = T.aimAng;
    if (fire) { // ayuda de puntería: si hay un enemigo casi en la línea, la mira se corrige hacia él
      let best = null, bd = AIM_ASSIST;
      for (const e of S.enemies) {
        if (e.dead || (!e.aggro && !e.boss)) continue;
        const d = dist(P.x, P.y, e.x, e.y); if (d > 640) continue;
        let da = Math.atan2(e.y - P.y, e.x - P.x) - ang; da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) < bd) { bd = Math.abs(da); best = da; }
      }
      if (best !== null) ang += best * 0.7;
    }
    In.down = fire;
    const px = (P.x - S.cam.x) * U.s + U.cw / 2, py = (P.y - S.cam.y) * U.s + U.ch / 2;
    In.mx = px + Math.cos(ang) * AIM_DIST * U.s; In.my = py + Math.sin(ang) * AIM_DIST * U.s;
    In.ux = In.mx / U.s; In.uy = In.my / U.s;
  }

  // ───── Dibujo ─────
  function stick(base, st, col, label) {
    const idle = !st;
    const ox = idle ? base.x : st.ox, oy = idle ? base.y : st.oy;
    ctx.save();
    ctx.globalAlpha = idle ? 0.32 : 0.7;
    ctx.beginPath(); ctx.arc(ox, oy, R, 0, TAU); ctx.fillStyle = 'rgba(8,6,16,0.42)'; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(ox, oy, R - 3, 0, TAU); ctx.stroke();
    let kx = ox, ky = oy;
    if (!idle) { const dx = st.x - ox, dy = st.y - oy, l = Math.hypot(dx, dy) || 1, c = Math.min(l, R); kx = ox + dx / l * c; ky = oy + dy / l * c; }
    ctx.globalAlpha = idle ? 0.4 : 0.92;
    ctx.beginPath(); ctx.arc(kx, ky, 30, 0, TAU); ctx.fillStyle = idle ? 'rgba(236,227,200,0.2)' : rgba(col, 0.55); ctx.fill();
    ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(236,227,200,0.85)'; ctx.stroke();
    if (idle && label) text(label, ox, oy + R + 22, 12, 'rgba(236,227,200,0.65)', 'center', '800');
    ctx.restore();
  }
  function round(b, label, col, o = {}) {
    ctx.save();
    ctx.globalAlpha = o.dim ? 0.5 : 0.9;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fillStyle = 'rgba(10,8,18,0.7)'; ctx.fill();
    if (o.cool > 0) { // recarga: el sector oscuro se vacía
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.arc(b.x, b.y, b.r - 3, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(o.cool, 0, 1)); ctx.closePath(); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
    }
    ctx.lineWidth = 4.5; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke();
    ctx.lineWidth = o.pulse ? 3 + 1.5 * Math.sin(T.pulse * 9) : 2.4; ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 4, 0, TAU); ctx.stroke();
    let size = o.size || 15; const maxW = b.r * 1.55;
    while (size > 9 && dispW(label, size) > maxW) size -= 0.5;
    dispText(label, b.x, b.y + size * 0.36 + (o.dy || 0), size, '#fff', 'center', { lw: Math.max(2, size * 0.12), sh: 0 });
    ctx.restore();
  }
  function draw() {
    if (!T.on) return;
    uiBegin();
    if (Game.state === 'map') { round(closeChip(), 'X', ACC, { size: 22 }); return; }
    if (Game.state !== 'play') return;
    const B = btns(), col = P.ch.col;
    stick({ x: 170, y: U.h - 172 }, T.move, '#19f0ff', 'MOVER');
    stick({ x: U.w - 410, y: U.h - 172 }, T.aim, '#ff2e88', 'APUNTAR · DISPARAR');
    round(B.pause, 'II', '#8896b8', { size: 18 }); round(B.map, 'MAPA', '#8896b8', { size: 12 });
    // esquiva con sus cargas
    round(B.dash, 'ESQUIVA', ACC, { size: 15, dy: -4, dim: P.dashCharges < 1 });
    for (let i = 0; i < P.dashMax; i++) { const w = 12, gap = 4, x0 = B.dash.x - (P.dashMax * w + (P.dashMax - 1) * gap) / 2; ctx.fillStyle = i < P.dashCharges ? ACC : 'rgba(255,255,255,0.18)'; ctx.fillRect(x0 + i * (w + gap), B.dash.y + 14, w, 5); }
    const cd = P.ch.abCd * P.abCdMul, ready = P.abCd <= 0;
    round(B.abil, ready ? 'HABILIDAD' : String(Math.ceil(P.abCd)), col, { size: ready ? 12 : 22, cool: ready ? 0 : P.abCd / cd, dim: !ready });
    if (S.interact) round(B.use, 'USAR', S.interact.type === 'house' ? GRN : ACC, { size: 17, pulse: true });
  }

  return { T, setup, update, draw, miniRect, get on() { return T.on; }, set on(v) { if (v) enable(); else { T.on = false; document.documentElement.classList.remove('touch'); } } };
})();
