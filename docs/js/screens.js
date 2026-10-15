'use strict';
// ───────── Pantallas, HUD y menús ─────────
const ACC = '#19f0ff', MAG = '#ff2bd6', YEL = '#ffe14a', GRN = '#5dff9a', RED = '#ff3355';

function uiBegin() { ctx.setTransform(U.s, 0, 0, U.s, 0, 0); ctx.textBaseline = 'alphabetic'; }
function dim(a = 0.62) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(4,2,12,${a})`; ctx.fillRect(0, 0, U.cw, U.ch); uiBegin();
}
function bigText(str, x, y, size, col, align = 'center', o = {}) {
  sprayText(str, x, y, size, col, Object.assign({ align, jitter: size >= 40 ? 1 : 0.45, drips: size >= 38, dripLen: 0.14 }, o));
}
function heading(str, sub) {
  bigText(str, U.w / 2, 70, 40, ACC, 'center', { rot: -0.012, dripLen: 0.12 });
  if (sub) text(sub, U.w / 2, 103, 15, '#cfc7b4', 'center', '600');
}
// Etiqueta pegada (rótulo con borde blanco y sombra dura)
function stickerTag(str, x, y, col, size = 15, rot = 0, ink = INK) {
  const w = dispW(str, size) + 22, h = size * 1.55;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = 'rgba(5,3,10,0.8)'; rrect(-w / 2 + 3, -h / 2 + 4, w, h, 4); ctx.fill();
  rrect(-w / 2, -h / 2, w, h, 4); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  rrect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, 3); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.stroke();
  dispText(str, 0, size * 0.36, size, ink, 'center', { lw: 0, sh: 0 });
  ctx.restore();
  return w;
}

// ───────── Título ─────────
// Plantilla de la cuadrilla: cada personaje con su posición, altura y fila (la de atrás más pequeña)
function crewLayout() {
  const x0 = 470, x1 = U.w - 20, cx = (x0 + x1) / 2, sp = Math.min(1, (x1 - x0) / 800), H = U.h;
  return [
    { id: 'mox', x: cx - 262 * sp, h: H * 0.50, feet: H - 84, flip: false, tag: -0.07 },
    { id: 'ronin', x: cx + 276 * sp, h: H * 0.51, feet: H - 82, flip: true, tag: 0.06 },
    { id: 'solo', x: cx - 92 * sp, h: H * 0.60, feet: H - 52, flip: false, tag: -0.04 },
    { id: 'kira', x: cx + 118 * sp, h: H * 0.57, feet: H - 58, flip: true, tag: 0.05 },
  ];
}
function drawCrew(t) {
  const L = crewLayout();
  // sombras y firmas en la pared
  for (const c of L) {
    const ch = CHARS.find(q => q.id === c.id);
    drawCrewTag(ch.name.replace(/^.*"(.*)"$/, '$1'), c.x + (c.flip ? 10 : -10), c.feet - c.h * 0.50, ch.col, c.h * 0.20, c.tag, false);
  }
  for (const c of L) {
    const bob = Math.sin(t * 1.7 + c.x * 0.01) * 0.006;
    ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.beginPath(); ctx.ellipse(c.x, c.feet + 4, c.h * 0.26, c.h * 0.035, 0, 0, TAU); ctx.fill();
    CharArt.draw(ctx, c.id, c.x, c.feet, c.h, { flip: c.flip, sy: 1 + bob });
  }
}
function drawTitle(dt) {
  drawCityBackdrop(Game.t);
  // velo oscuro a la izquierda para que se lea el menú
  const gr = ctx.createLinearGradient(0, 0, 470 * U.s, 0); gr.addColorStop(0, 'rgba(4,2,10,0.9)'); gr.addColorStop(0.75, 'rgba(4,2,10,0.7)'); gr.addColorStop(1, 'rgba(4,2,10,0)');
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = gr; ctx.fillRect(0, 0, 470 * U.s, U.ch); uiBegin();
  drawCrew(Game.t);
  // logotipo de graffiti
  const lx = 60;
  const sN = 100 * 330 / sprayW('NEON', 100), sS = 100 * 400 / sprayW('SYNDICATE', 100);
  sprayText('NEON', lx + 165, 150, sN, '#ff2e88', { rot: -0.045, jitter: 1.2 });
  sprayText('SYNDICATE', lx + 200, 232, sS, '#12e6ff', { rot: -0.03, jitter: 1.2 });
  stickerTag('ROGUELIKE DE CALLE · CIUDAD PROCEDURAL', lx + 196, 268, '#ffd81f', 12.5, -0.012);
  // menú
  const x = lx, w = 300; let y = 300;
  const ri = getRunInfo();
  if (ri) {
    if (uiButton(x, y, w, 56, 'CARGAR PARTIDA', { size: 20, accent: GRN, sub: `${ri.name.replace(/"/g, '')} · Nv ${ri.level} · ${ri.where}` })) startLoading('continue', ri.charId);
    y += 66;
  }
  if (uiButton(x, y, w, 50, 'NUEVA PARTIDA', { size: 21, accent: MAG })) { Game.state = 'select'; Game.sel = SAVE.lastChar; }
  y += 60;
  if (Net.avail) {
    if (uiButton(x, y, w, 46, 'COOPERATIVO LAN', { size: 19, accent: ACC, sub: 'Hasta 4 jugadores en red local' })) coopOpen();
    y += 56;
  }
  if (uiButton(x, y, w, 42, 'TALLER', { size: 18, accent: YEL, sub: `${fmt(SAVE.chips)} Chips` })) { Game.state = 'workshop'; Game.tab = 0; }
  y += 52;
  if (uiButton(x, y, w, 38, 'CONTROLES', { size: 17 })) { Game.back = 'title'; Game.state = 'controls'; }
  y += 48;
  // Build web (GamePix): sin botón SALIR ni atajos de escritorio. GamePix prohíbe el botón de cerrar.
  const mus = Snd.isMusicOn(), isApp = false;
  if (uiButton(x, y, isApp ? 144 : w, 38, mus ? 'MÚSICA: SÍ' : 'MÚSICA: NO', { size: 15 })) { Snd.setMusic(!mus); SAVE.music = !mus; saveGame(); }
  if (isApp && uiButton(x + 156, y, 144, 38, 'SALIR', { size: 16, accent: RED })) { window.close(); }
  const st = SAVE.stats;
  text(`Partidas ${st.runs}  ·  Mejor nivel ${st.best}  ·  Bajas ${fmt(st.kills)}  ·  Jefes ${st.bosses}`, 24, U.h - 11, 13, '#d9d0bb', 'left', '700');
  text((isApp ? 'F11 pantalla completa  ·  ' : '') + 'Los Chips ganados se conservan al caer', U.w - 24, U.h - 11, 13, '#b8b09c', 'right', '600');
}

// ───────── Pantalla de carga ─────────
function startLoading(kind, charId, cfg) {
  Game.load = { kind, charId, cfg, t: 0, frames: 0, done: false, tip: pick(TIPS) };
  Game.state = 'loading';
}
function drawLoading(dt) {
  const Ld = Game.load; Ld.t += dt; Ld.frames++;
  const ch = CHARS.find(c => c.id === Ld.charId) || CHARS[0];
  drawCityBackdrop(Game.t);
  const gr = ctx.createLinearGradient(0, 0, 640 * U.s, 0); gr.addColorStop(0, 'rgba(4,2,10,0.82)'); gr.addColorStop(1, 'rgba(4,2,10,0)');
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = gr; ctx.fillRect(0, 0, 640 * U.s, U.ch); uiBegin();
  // personaje enorme a la derecha, con su firma detrás
  const hh = U.h * 0.82, px = U.w - Math.min(330, U.w * 0.27), feet = U.h - 40, bob = Math.sin(Game.t * 1.7) * 0.006;
  const nick = ch.name.replace(/^.*"(.*)"$/, '$1');
  sprayText(nick, px - 20, feet - hh * 0.42, hh * 0.22, ch.col, { rot: -0.07, jitter: 1 });
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(px, feet + 4, hh * 0.24, hh * 0.03, 0, 0, TAU); ctx.fill();
  CharArt.draw(ctx, ch.id, px, feet, hh, { flip: ch.id === 'kira' || ch.id === 'ronin', sy: 1 + bob });
  // panel izquierdo
  const x = 60, w = 480;
  const sz = 100 * w / sprayW(ch.name.replace(/"/g, ''), 100);
  sprayText(ch.name.replace(/"/g, ''), x + 12, 150, Math.min(78, sz), ch.col, { align: 'left', rot: -0.025, jitter: 1 });
  stickerTag(ch.role.toUpperCase(), x + dispW(ch.role.toUpperCase(), 16) / 2 + 22, 186, '#ffd81f', 16, 0.02);
  const wd = WEAPONS[ch.weapon];
  paper(x, 222, w, 150, { rot: -0.012, col: PAPER });
  dispText('ARMA INICIAL', x + 22, 262, 15, '#6b5a3a', 'left', { lw: 0, sh: 0 });
  dispText(wd.name.toUpperCase(), x + 22, 292, 26, INK, 'left', { lw: 0, sh: 0 });
  dispText('HABILIDAD', x + 22, 326, 15, '#6b5a3a', 'left', { lw: 0, sh: 0 });
  dispText(ch.abName.toUpperCase(), x + 22, 356, 26, INK, 'left', { lw: 0, sh: 0 });
  paper(x + 14, 406, w - 24, 122, { rot: 0.014, col: '#ffd81f' });
  dispText('CONSEJO DE LA CALLE', x + 38, 442, 15, INK, 'left', { lw: 0, sh: 0 });
  wrapText(Ld.tip, x + 38, 470, w - 72, 20, 15.5, INK, 'left', '700');
  // barra de progreso (trazo de spray)
  const p = clamp(Ld.t / 1.7, 0, 1), e = p * p * (3 - 2 * p), by = U.h - 98;
  text(Ld.kind === 'continue' ? 'CARGANDO LA PARTIDA' : Ld.kind.startsWith('coop') ? 'SINCRONIZANDO LA PARTIDA' : (e < 0.5 ? 'LEVANTANDO LA CIUDAD' : 'REPARTIENDO LAS BANDAS'), x + 4, by - 14, 14, '#e8dfc8', 'left', '800');
  text(`${Math.floor(e * 100)}%`, x + w, by - 14, 14, ch.col, 'right', '800');
  ctx.fillStyle = INK; rrect(x - 3, by - 3, w + 6, 30, 8); ctx.fill();
  ctx.fillStyle = '#2a2634'; rrect(x, by, w, 24, 6); ctx.fill();
  ctx.save(); rrect(x, by, Math.max(14, w * e), 24, 6); ctx.fillStyle = ch.col; ctx.fill(); ctx.clip();
  ctx.fillStyle = 'rgba(11,10,16,0.35)'; for (let k = -2; k < w / 18 + 2; k++) { const qx = x + k * 18 + ((Game.t * 40) % 18); ctx.beginPath(); ctx.moveTo(qx, by + 24); ctx.lineTo(qx + 9, by); ctx.lineTo(qx + 18, by); ctx.lineTo(qx + 9, by + 24); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x, by, w, 7); ctx.restore();
  rrect(x, by, w, 24, 6); ctx.strokeStyle = 'rgba(236,227,200,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
  // trabajo pesado después de pintar unos fotogramas
  if (!Ld.done && Ld.frames >= 4) {
    Ld.done = true;
    if (Ld.kind === 'continue') { if (!loadRun(null, { stay: true })) { Game.state = 'title'; return; } }
    else if (Ld.kind === 'coophost') {
      const roster = Ld.cfg.roster.map(r => Object.assign({}, r, { meta: r.id === 0 ? null : (Net.peers.get(r.id) || {}).meta }));
      newCoopHostRun(Ld.cfg.seed, roster, { stay: true });
      for (const pl of S.players) { const pr = Net.peers.get(pl.id); if (pr) pr.pl = pl; }
    } else if (Ld.kind === 'coopclient') {
      newCoopClientRun(Ld.cfg.seed, Ld.cfg.roster, Net.myId, { stay: true });
      Net.lastSnap = 0; Net.sendHost(['loaded']);
    }
    else newRun(Ld.charId, { stay: true });
    Ld.tDone = Ld.t;
  }
  if (Ld.done && Ld.t >= 1.7) Game.state = 'play';
}

// ───────── Selección de personaje ─────────
function drawSelect(dt) {
  drawCityBackdrop(Game.t); dim(0.5);
  bigText('ELIGE TU PERSONAJE', U.w / 2, 54, 38, ACC, 'center', { rot: -0.01, dripLen: 0.1 });
  text(`Cada uno empieza con un arma y una habilidad únicas  ·  Chips: ${fmt(SAVE.chips)}`, U.w / 2, 90, 14, '#d6cfbd', 'center', '600');
  const cw = 250, ch = 510, gap = 18, total = CHARS.length * cw + (CHARS.length - 1) * gap, x0 = (U.w - total) / 2, y0 = 128;
  CHARS.forEach((c, i) => {
    const x = x0 + i * (cw + gap), owned = SAVE.chars.includes(c.id), sel = Game.sel === c.id;
    const lift = sel ? -6 : 0;
    panel(x, y0 + lift, cw, ch, sel ? c.col : '#6a6a80', owned ? 0.95 : 0.85, 14);
    // retrato: ráfaga de color con el personaje saliéndose del marco
    const ax = x + 12, ay = y0 + lift + 18, aw = cw - 24, ah = 176;
    ctx.save(); ctx.beginPath(); ctx.rect(ax, ay, aw, ah); ctx.clip();
    ctx.fillStyle = owned ? mixHex(c.col, '#0b0a10', 0.72) : '#1a1822'; ctx.fillRect(ax, ay, aw, ah);
    ctx.fillStyle = owned ? rgba(c.col, 0.32) : 'rgba(255,255,255,0.05)'; ctx.beginPath();
    for (let k = 0; k < 16; k++) { const a0 = (k / 16) * TAU + Game.t * 0.05, a1 = a0 + TAU / 32; ctx.moveTo(ax + aw / 2, ay + ah * 0.75); ctx.lineTo(ax + aw / 2 + Math.cos(a0) * 400, ay + ah * 0.75 + Math.sin(a0) * 400); ctx.lineTo(ax + aw / 2 + Math.cos(a1) * 400, ay + ah * 0.75 + Math.sin(a1) * 400); }
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(ax, ay + ah - 20, aw, 20);
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(ax, ay, aw, ah);
    const feet = ay + ah + 2, fh = ah + 22;
    if (CharArt.drawBust(ctx, c.id, ax, ay, aw, ah, { sil: !owned, flip: i % 2 === 1 })) { ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(ax, ay, aw, ah); }
    else CharArt.draw(ctx, c.id, x + cw / 2, feet, fh, { sil: !owned, flip: i % 2 === 1, sy: sel ? 1 + Math.sin(Game.t * 3) * 0.008 : 1 });
    if (!owned) { sprayText('?', x + cw / 2, ay + ah * 0.58, 90, '#ffe14a', { jitter: 0.3, drips: false }); stickerTag('BLOQUEADO', x + cw / 2, ay + 22, '#ff3355', 14, -0.06, '#fff'); }
    else if (sel) stickerTag('ELEGIDO', x + cw - 54, ay + 20, c.col, 13, 0.08);
    const px = x + cw / 2, ty = y0 + lift;
    dispText(c.name.replace(/"/g, ''), px, ty + 236, 22, owned ? '#fff' : '#a7a2b4', 'center');
    text(c.role.toUpperCase(), px, ty + 256, 13, owned ? c.col : '#8a8698', 'center', '800');
    text(`VIDA ${c.hp}   ·   VEL ${c.speed}`, px, ty + 274, 12, '#a9b3cf', 'center', '700');
    wrapText(c.desc, x + 16, ty + 298, cw - 32, 17, 13.5, '#d6cfbd', 'left');
    const wd = WEAPONS[c.weapon];
    text('ARMA INICIAL', x + 16, ty + 348, 11, '#9d97a8', 'left', '800');
    text(wd.name, x + 16, ty + 366, 16, wd.col, 'left', '800');
    text('HABILIDAD', x + 16, ty + 392, 11, '#9d97a8', 'left', '800');
    text(c.abName, x + 16, ty + 410, 16, c.col, 'left', '800');
    wrapText(c.abDesc, x + 16, ty + 428, cw - 32, 15, 12.5, '#c3bdb0', 'left');
    if (owned) {
      if (uiButton(x + 16, y0 + ch - 40, cw - 32, 30, sel ? 'ELEGIDO' : 'ELEGIR', { size: 14, accent: c.col })) Game.sel = c.id;
    } else {
      const can = SAVE.chips >= c.cost;
      if (uiButton(x + 16, y0 + ch - 40, cw - 32, 30, `DESBLOQUEAR · ${c.cost} Chips`, { size: 13, accent: YEL, disabled: !can })) {
        SAVE.chips -= c.cost; SAVE.chars.push(c.id); Game.sel = c.id; saveGame(); Snd.play('buy');
      }
    }
  });
  const by = y0 + ch + 20;
  if (uiButton(U.w / 2 - 280, by, 180, 46, 'VOLVER', { size: 17, accent: '#8896b8' })) Game.state = 'title';
  if (uiButton(U.w / 2 - 80, by, 360, 46, 'COMENZAR PARTIDA', { size: 20, accent: MAG, disabled: !SAVE.chars.includes(Game.sel) })) {
    SAVE.lastChar = Game.sel; saveGame(); startLoading('new', Game.sel);
  }
}
// Mezcla de dos colores hex (para fondos de retrato)
function mixHex(a, b, t) { const A = hexToRgb(a), B = hexToRgb(b); return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`; }

// ───────── Taller (desbloqueos permanentes) ─────────
function workshopItems(tab) {
  const items = [];
  const add = (o) => items.push(o);
  if (tab === 0) {
    for (const c of CHARS) add({ name: c.name, sub: c.role, desc: `Arma: ${WEAPONS[c.weapon].name} · Habilidad: ${c.abName}`, cost: c.cost, owned: SAVE.chars.includes(c.id), free: c.cost === 0, col: c.col, buy: () => SAVE.chars.push(c.id) });
  } else if (tab === 1) {
    for (const id of FREE_WEAPONS) add({ name: WEAPONS[id].name, sub: 'Arma', desc: WEAPONS[id].desc, cost: 0, owned: true, free: true, col: WEAPONS[id].col });
    for (const id in META.weapons) add({ name: WEAPONS[id].name, sub: 'Arma', desc: WEAPONS[id].desc + ' Aparecerá en tiendas y botín.', cost: META.weapons[id], owned: SAVE.weapons.includes(id), col: WEAPONS[id].col, buy: () => SAVE.weapons.push(id) });
  } else if (tab === 2) {
    for (const p of PERKS) if (p.cost) add({ name: p.name, sub: 'Implante', desc: p.desc + '. Aparece al subir de nivel.', cost: p.cost, owned: SAVE.perks.includes(p.id), col: MAG, buy: () => SAVE.perks.push(p.id) });
  } else {
    const u = SAVE.up;
    if (u.cap < CAP_TIERS.length - 1) add({ name: `Nivel máximo ${CAP_TIERS[u.cap + 1]}`, sub: 'Límite de nivel', desc: `Ahora el límite es nivel ${CAP_TIERS[u.cap]}. Abre las zonas más duras.`, cost: META.capCosts[u.cap], owned: false, col: YEL, buy: () => u.cap++ });
    else add({ name: `Nivel máximo ${CAP_TIERS[u.cap]}`, sub: 'Límite de nivel', desc: 'Has alcanzado el límite máximo.', cost: 0, owned: true, col: YEL });
    if (u.vit < 3) add({ name: `Vitalidad +10% (${u.vit + 1}/3)`, sub: 'Mejora', desc: 'Más vida máxima en todas las partidas.', cost: META.vitCosts[u.vit], owned: false, col: GRN, buy: () => u.vit++ });
    else add({ name: 'Vitalidad +30%', sub: 'Mejora', desc: 'Completada.', cost: 0, owned: true, col: GRN });
    if (u.fund < 3) add({ name: `Fondos iniciales (${u.fund + 1}/3)`, sub: 'Mejora', desc: `Empiezas con ${[150, 300, 500][u.fund]} ¢.`, cost: META.fundCosts[u.fund], owned: false, col: YEL, buy: () => u.fund++ });
    else add({ name: 'Fondos iniciales', sub: 'Mejora', desc: 'Empiezas con 500 ¢.', cost: 0, owned: true, col: YEL });
    add({ name: 'Clon de respaldo', sub: 'Mejora', desc: 'Revives una vez por partida con el 50% de vida.', cost: META.cloneCost, owned: !!u.clone, col: ACC, buy: () => { u.clone = 1; } });
    add({ name: 'Contactos: asaltos', sub: 'Contratos', desc: 'Los fixers ofrecen asaltos a cargamentos de bandas rivales.', cost: META.raidCost, owned: !!SAVE.raid, col: MAG, buy: () => { SAVE.raid = true; } });
  }
  return items;
}
function drawWorkshop(dt) {
  drawCityBackdrop(Game.t); dim(0.55);
  heading('TALLER', 'Gasta tus Chips en desbloqueos permanentes. Todo empieza muy limitado.');
  bigText(`${fmt(SAVE.chips)} CHIPS`, U.w - 40, 60, 24, YEL, 'right');
  const tabs = ['PERSONAJES', 'ARMAS', 'IMPLANTES', 'MEJORAS'], tw = 170, tx0 = (U.w - tabs.length * tw - 3 * 10) / 2;
  tabs.forEach((n, i) => { if (uiButton(tx0 + i * (tw + 10), 116, tw, 38, n, { size: 15, accent: Game.tab === i ? MAG : '#5a5a78' })) Game.tab = i; });
  const items = workshopItems(Game.tab), cols = 3, cw = 340, gap = 20, ch = 100, x0 = (U.w - (cols * cw + (cols - 1) * gap)) / 2, y0 = 176;
  items.forEach((it, i) => {
    const x = x0 + (i % cols) * (cw + gap), y = y0 + Math.floor(i / cols) * (ch + 12);
    panel(x, y, cw, ch, it.owned ? '#3a5a4a' : it.col, 0.88, 10);
    ctx.fillStyle = it.owned ? 'rgba(93,255,154,0.8)' : it.col; ctx.fillRect(x + 12, y + 18, 6, 26);
    text(it.name, x + 28, y + 30, 17, it.owned ? '#cfe9dc' : '#fff', 'left', '800');
    text(it.sub.toUpperCase(), x + 28, y + 46, 11, it.owned ? GRN : it.col, 'left', '700');
    wrapText(it.desc, x + 14, y + 64, cw - 28 - 110, 15, 12.5, '#aab6d4');
    if (it.owned) text(it.free ? 'INCLUIDO' : 'DESBLOQUEADO', x + cw - 14, y + 30, 12, GRN, 'right', '800');
    else {
      const can = SAVE.chips >= it.cost;
      if (uiButton(x + cw - 112, y + ch - 40, 100, 30, `${it.cost} Chips`, { size: 14, accent: YEL, disabled: !can })) {
        SAVE.chips -= it.cost; it.buy(); saveGame(); Snd.play('buy');
      }
    }
  });
  if (uiButton(U.w / 2 - 110, U.h - 64, 220, 44, 'VOLVER', { size: 18, accent: '#8896b8' })) Game.state = 'title';
}

// ───────── Controles ─────────
function drawControls(dt) {
  drawCityBackdrop(Game.t); dim(0.6);
  heading('CONTROLES');
  const rows = TouchUI.on ? [
    ['Stick izquierdo', 'Moverte (toca y arrastra en la mitad izquierda)'], ['Stick derecho', 'Apuntar; dispara mientras lo inclinas'], ['ESQUIVA', 'Esquiva (invulnerable un instante)'],
    ['HABILIDAD', 'Habilidad del personaje'], ['USAR', 'Aparece junto a fixers, Ripper, pisos francos y cofres'], ['Barra de armas', 'Toca un arma para cambiarla'],
    ['MAPA', 'Mapa completo'], ['II', 'Pausa'], ['Atrás (Android)', 'Pausa / volver'],
  ] : [
    ['W A S D', 'Moverte'], ['Ratón', 'Apuntar'], ['Clic izquierdo', 'Disparar / atacar'], ['Shift', 'Esquivar (invulnerable un instante)'],
    ['Espacio', 'Habilidad del personaje'], ['E', 'Interactuar: fixer, Ripper, piso franco, cofres'], ['1 · 2 · 3 / Rueda / Q', 'Cambiar de arma'],
    ['M', 'Mapa completo'], ['Esc', 'Pausa'], ['F11', 'Pantalla completa'],
  ];
  const x = U.w / 2 - 330;
  rows.forEach((r, i) => {
    const y = 150 + i * 42;
    panel(x, y, 660, 34, '#3a3a5a', 0.8, 8);
    text(r[0], x + 20, y + 23, 16, ACC, 'left', '800'); text(r[1], x + 250, y + 23, 15, '#dbe4ff', 'left', '600');
  });
  wrapText('Sube de nivel para abrir las barreras entre distritos. Acepta contratos con los fixers: entregas, asaltos, sabotajes, cargas, cazas y limpiezas. Completa las operaciones de un distrito para liberarlo y que salga su jefe; cada distrito liberado endurece el resto de la ciudad. En los pisos francos (puerta verde) puedes guardar la partida y descansar. Al morir conservas los Chips para desbloquear más cosas en el Taller.', x, 590, 660, 20, 14.5, '#9fb0d0', 'left');
  if (uiButton(U.w / 2 - 110, U.h - 62, 220, 44, 'VOLVER', { size: 18, accent: '#8896b8' })) Game.state = Game.back || 'title';
}

// ───────── HUD ─────────
function drawMinimap() {
  const mr = TouchUI.on ? TouchUI.miniRect() : null, size = mr ? mr.size : 188, x = mr ? mr.x : U.w - size - 18, y = mr ? mr.y : U.h - size - 18, vt = 44;
  chamfer(x - 4, y - 4, size + 8, size + 8, 12); ctx.fillStyle = 'rgba(6,4,14,0.9)'; ctx.fill();
  ctx.save(); chamfer(x, y, size, size, 10); ctx.clip();
  ctx.fillStyle = '#050309'; ctx.fillRect(x, y, size, size);
  const px = P.x / TILE, py = P.y / TILE, sx = px - vt / 2, sy = py - vt / 2;
  const x0 = Math.max(0, sx), y0 = Math.max(0, sy), x1 = Math.min(WW, sx + vt), y1 = Math.min(WH, sy + vt);
  ctx.imageSmoothingEnabled = false;
  if (x1 > x0 && y1 > y0) ctx.drawImage(S.mapFog, x0, y0, x1 - x0, y1 - y0, x + ((x0 - sx) / vt) * size, y + ((y0 - sy) / vt) * size, ((x1 - x0) / vt) * size, ((y1 - y0) / vt) * size);
  ctx.imageSmoothingEnabled = true;
  const mp = (wx, wy) => ({ x: x + ((wx / TILE - sx) / vt) * size, y: y + ((wy / TILE - sy) / vt) * size });
  const explored = (wx, wy) => S.explored[clamp(Math.floor(wy / TILE), 0, WH - 1) * WW + clamp(Math.floor(wx / TILE), 0, WW - 1)];
  for (const h of S.world.hubs) { const c = S.world.cellCenter(h.cx, h.cy); if (!explored(c.x, c.y)) continue; const m = mp(c.x, c.y); ctx.fillStyle = MAG; ctx.fillRect(m.x - 7, m.y - 3, 5, 6); ctx.fillStyle = GRN; ctx.fillRect(m.x + 2, m.y - 3, 5, 6); }
  for (const h of S.world.houses) { if (!explored(h.x, h.y)) continue; const m = mp(h.x, h.y); drawHouseIcon(m.x, m.y, 1, S.houseId === h.id); }
  for (const l of S.world.lairs) { if (S.defeated[l.district]) continue; const c = S.world.cellCenter(l.cx, l.cy); if (!explored(c.x, c.y)) continue; const m = mp(c.x, c.y); ctx.strokeStyle = RED; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(m.x - 4, m.y - 4); ctx.lineTo(m.x + 4, m.y + 4); ctx.moveTo(m.x + 4, m.y - 4); ctx.lineTo(m.x - 4, m.y + 4); ctx.stroke(); }
  for (const e of S.enemies) { if (e.dead || !e.aggro && !e.boss) continue; const m = mp(e.x, e.y); if (m.x < x || m.y < y || m.x > x + size || m.y > y + size) continue; ctx.fillStyle = e.boss ? RED : '#ff6a7a'; ctx.beginPath(); ctx.arc(m.x, m.y, e.boss ? 5 : 2.2, 0, TAU); ctx.fill(); }
  const tg = missionTarget();
  if (tg) {
    let m = mp(tg.x, tg.y);
    const inside = m.x > x + 8 && m.x < x + size - 8 && m.y > y + 8 && m.y < y + size - 8;
    if (!inside) { const a = Math.atan2(m.y - (y + size / 2), m.x - (x + size / 2)), r = size / 2 - 10; m = { x: x + size / 2 + Math.cos(a) * r, y: y + size / 2 + Math.sin(a) * r }; }
    ctx.fillStyle = YEL; ctx.beginPath(); ctx.moveTo(m.x, m.y - 7); ctx.lineTo(m.x + 6, m.y); ctx.lineTo(m.x, m.y + 7); ctx.lineTo(m.x - 6, m.y); ctx.closePath(); ctx.fill();
  }
  for (const o of S.players) {
    if (o === P) continue;
    const m = mp(o.x, o.y); if (m.x < x || m.y < y || m.x > x + size || m.y > y + size) continue;
    if (o.dead) { ctx.strokeStyle = RED; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(m.x - 4, m.y - 4); ctx.lineTo(m.x + 4, m.y + 4); ctx.moveTo(m.x + 4, m.y - 4); ctx.lineTo(m.x - 4, m.y + 4); ctx.stroke(); continue; }
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(m.x, m.y, 5.5, 0, TAU); ctx.fill(); ctx.fillStyle = o.ch.col; ctx.beginPath(); ctx.arc(m.x, m.y, 4, 0, TAU); ctx.fill();
  }
  const pm = mp(P.x, P.y);
  ctx.save(); ctx.translate(pm.x, pm.y); ctx.rotate(P.ang); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.restore();
  chamfer(x, y, size, size, 10); ctx.strokeStyle = rgba(DISTRICTS[S.district].accent, 0.9); ctx.lineWidth = 2; ctx.stroke();
  text(DISTRICTS[S.district].name.toUpperCase(), x + size / 2, y - 10, 12, DISTRICTS[S.district].accent, 'center', '800');
}

// Icono de piso franco: casita verde (rellena si es donde guardaste por última vez)
function drawHouseIcon(x, y, k, saved) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  ctx.fillStyle = saved ? GRN : '#0b0a10'; ctx.strokeStyle = GRN; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(-5, 4); ctx.lineTo(-5, -1); ctx.lineTo(0, -6); ctx.lineTo(5, -1); ctx.lineTo(5, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function missionObjective() {
  const m = S.mission; if (!m) return null;
  const tg = missionTarget(), dm = tg ? Math.round(dist(P.x, P.y, tg.x, tg.y) / TILE * 2) : 0;
  let obj = '', extra = '';
  if (m.type === 'deliver') {
    if (m.stage === 0) obj = 'Recoge el paquete';
    else { obj = `Entrégalo ${toClient(m.client)}`; extra = `Tiempo: ${Math.max(0, Math.ceil(m.t))} s`; }
  } else if (m.type === 'raid') {
    if (m.stage === 0) { const n = campLeft(m); obj = m.camp.spawned ? `Elimina a la banda (${n} restantes)` : 'Ve al campamento enemigo'; }
    else if (m.stage === 1) obj = 'Toma el cargamento del campamento';
    else obj = 'Lleva el cargamento al fixer';
  } else if (m.type === 'boss') {
    obj = S.boss ? `Derrota a ${BOSSES[m.bossId].name}` : `Llega a la guarida de ${BOSSES[m.bossId].name}`;
  } else if (m.type === 'hack') {
    const pct = Math.floor(100 * clamp(m.prog / m.need, 0, 1));
    obj = m.stage === 0 ? 'Ve a la antena de la banda' : `Hackeando la antena… ${pct}%. Quédate cerca y aguanta.`;
    if (m.stage === 1) extra = `${pct}%`;
  } else if (m.type === 'charges') {
    const n = m.points.filter(q => q.done).length;
    obj = `Coloca las cargas en los puntos marcados (${n}/${m.points.length})`; extra = `${n}/${m.points.length}`;
  } else if (m.type === 'hunt') {
    const e = m.eid >= 0 ? S.enemies.find(x => x.id === m.eid && !x.dead) : null;
    obj = e ? `Elimina a ${m.ltName} y a su escolta` : `Busca a ${m.ltName} en ${DISTRICTS[m.district].name}`;
  } else if (m.type === 'purge') {
    obj = S.district === m.district ? `Abate enemigos en ${DISTRICTS[m.district].name} (${m.kills}/${m.need})` : `Ve a ${DISTRICTS[m.district].name}`;
    extra = `${m.kills}/${m.need}`;
  }
  return { title: m.title, obj, extra, dm, hasTg: !!tg };
}
function drawArrowToTarget() {
  const tg = missionTarget(); if (!tg || S.boss) return;
  const z = U.s, sx = (tg.x - S.cam.x) * z + U.cw / 2, sy = (tg.y - S.cam.y) * z + U.ch / 2;
  const m = 60 * z;
  if (sx > m && sx < U.cw - m && sy > m && sy < U.ch - m) return;
  const cx = U.cw / 2, cy = U.ch / 2, a = Math.atan2(sy - cy, sx - cx);
  const rx = cx - m * 1.6, ry = cy - m * 1.2;
  const px = cx + Math.cos(a) * rx, py = cy + Math.sin(a) * ry;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.save(); ctx.translate(px, py); ctx.rotate(a);
  ctx.fillStyle = 'rgba(255,225,74,0.9)'; ctx.shadowColor = YEL; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.moveTo(16 * z, 0); ctx.lineTo(-8 * z, -11 * z); ctx.lineTo(-8 * z, 11 * z); ctx.closePath(); ctx.fill();
  ctx.restore(); uiBegin();
}

function drawHUD(dt) {
  uiBegin();
  drawArrowToTarget();
  // ─ Vida / nivel (arriba izquierda)
  const x = 16, y = 14, w = 316;
  panel(x, y, w, 116, P.ch.col, 0.86, 10);
  dispText(P.ch.name.replace(/"/g, ''), x + 16, y + 31, 19, P.ch.col, 'left');
  dispText(`NV ${P.level}${P.level >= levelCap() ? ' MÁX' : ''}`, x + w - 16, y + 31, 19, '#fff', 'right');
  hbar(x + 16, y + 40, w - 32, 16, P.hp / P.maxhp, P.hp / P.maxhp < 0.3 ? RED : GRN);
  text(`${Math.ceil(P.hp)} / ${Math.ceil(P.maxhp)}`, x + w / 2, y + 53, 12, '#fff', 'center', '800');
  if (P.shieldMax > 0) hbar(x + 16, y + 60, w - 32, 4, P.shield / P.shieldMax, '#4aa3ff');
  hbar(x + 16, y + 70, w - 32, 7, P.level >= levelCap() ? 1 : P.xp / P.xpNext, P.level >= levelCap() ? '#ff8a1a' : ACC);
  text(P.level >= levelCap() ? 'NIVEL MÁXIMO' : `XP ${Math.floor(P.xp)} / ${P.xpNext}`, x + 16, y + 98, 12, '#cfc7b4', 'left', '700');
  dispText(`${fmt(P.cred)} ¢`, x + w - 16, y + 102, 20, YEL, 'right');
  // ─ Compañeros (cooperativo)
  let tmY = 140;
  if (Net.active) {
    for (const o of S.players) {
      if (o === P) continue;
      panel(x, tmY, 230, 46, o.dead ? RED : o.ch.col, 0.82, 8);
      text(o.name, x + 14, tmY + 25, 14, o.dead ? '#ff8a9a' : '#fff', 'left', '800');
      text(o.dead ? 'CAÍDO' : `NV ${o.level}`, x + 216, tmY + 25, 12, o.dead ? RED : '#cfc7b4', 'right', '800');
      hbar(x + 14, tmY + 31, 202, 7, o.dead ? 0 : o.hp / o.maxhp, o.hp / o.maxhp < 0.3 ? RED : GRN);
      tmY += 54;
    }
  }
  // ─ Esquiva y habilidad (abajo izquierda)
  const ax = 20, ay = U.h - 86;
  panel(ax, ay, 200, 66, P.ch.col, 0.82, 10);
  const ready = P.abCd <= 0, cd = P.ch.abCd * P.abCdMul;
  ctx.fillStyle = ready ? rgba(P.ch.col, 0.28) : 'rgba(255,255,255,0.06)'; ctx.fillRect(ax + 10, ay + 10, 46, 46);
  if (!ready) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(ax + 10, ay + 10, 46, 46 * (P.abCd / cd)); }
  ctx.strokeStyle = ready ? P.ch.col : '#555'; ctx.lineWidth = 2; ctx.strokeRect(ax + 10, ay + 10, 46, 46);
  text(ready ? (TouchUI.on ? 'LISTA' : 'ESPACIO') : Math.ceil(P.abCd) + ' s', ax + 33, ay + 38, ready ? 9 : 16, '#fff', 'center', '800');
  text(P.ch.abName.toUpperCase(), ax + 66, ay + 26, 13, P.ch.col, 'left', '800');
  for (let i = 0; i < P.dashMax; i++) { ctx.fillStyle = i < P.dashCharges ? ACC : 'rgba(255,255,255,0.14)'; ctx.fillRect(ax + 66 + i * 26, ay + 36, 22, 8); }
  text(TouchUI.on ? 'ESQUIVA' : 'SHIFT · ESQUIVA', ax + 66, ay + 58, 10, '#8896b8', 'left', '700');
  // ─ Armas (abajo centro)
  const sw = 168, sh = 48, gx = 8, tw = P.weapons.length * sw + (P.weapons.length - 1) * gx, sx0 = U.w / 2 - tw / 2, sy = U.h - sh - 16;
  Game.wslots = [];
  P.weapons.forEach((wp, i) => {
    const d = WEAPONS[wp.id], tc = TIERS[wp.tier].col, sx = sx0 + i * (sw + gx), act = i === P.cur;
    Game.wslots.push({ x: sx, y: sy - 10, w: sw, h: sh + 26, i });
    ctx.fillStyle = 'rgba(5,3,10,0.8)'; rrect(sx + 4, sy + 5, sw, sh, 6); ctx.fill();
    rrect(sx, sy, sw, sh, 6); ctx.fillStyle = act ? '#201c2c' : '#17141f'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    rrect(sx + 2.5, sy + 2.5, sw - 5, sh - 5, 4); ctx.lineWidth = act ? 2.5 : 1.2; ctx.strokeStyle = act ? tc : 'rgba(236,227,200,0.35)'; ctx.stroke();
    text(`${i + 1}`, sx + 10, sy + 18, 12, '#8896b8', 'left', '800');
    text(d.name, sx + 26, sy + 20, 13.5, act ? '#fff' : '#a0a8c0', 'left', '800');
    text(`${TIERS[wp.tier].name}${wp.up ? ' +' + wp.up : ''}`, sx + 26, sy + 38, 11, tc, 'left', '700');
    ctx.fillStyle = d.col; ctx.fillRect(sx + sw - 22, sy + 12, 12, 4);
    if (act && P.fireCd > 0) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(sx + 6, sy + sh - 5, (sw - 12) * clamp(P.fireCd * (d.rate * P.rateMul), 0, 1), 2); }
  });
  // ─ Misión (arriba derecha)
  const mo = missionObjective(), mw = 330, mx = U.w - mw - 16;
  if (mo) {
    panel(mx, 14, mw, 92, YEL, 0.82, 10);
    text(mo.title.toUpperCase(), mx + 16, 38, 13.5, YEL, 'left', '800');
    const n = wrapText(mo.obj, mx + 16, 58, mw - 32, 17, 14, '#fff', 'left', '600');
    text(`${mo.hasTg ? mo.dm + ' m' : ''}${mo.hasTg && mo.extra ? '   ·   ' : ''}${mo.extra || ''}`, mx + 16, 96, 13, mo.extra && S.mission.t < 20 ? RED : '#9fb0d0', 'left', '700');
  } else {
    panel(mx, 14, mw, 52, '#4a4a6a', 0.7, 10);
    text('SIN MISIÓN · Habla con un fixer (marcador magenta)', mx + 16, 45, 13, '#9fb0d0', 'left', '600');
  }
  // ─ Liberación del distrito actual
  {
    const d = DISTRICTS[S.district], k = libDone(S.district), need = LIB_NEED[S.district], done = S.defeated[S.district], ly = mo ? 112 : 72;
    panel(mx, ly, mw, 24, done ? GRN : d.accent, 0.78, 6);
    text(done ? `${d.name.toUpperCase()} · LIBERADO` : `${d.name.toUpperCase()} · LIBERACIÓN`, mx + 12, ly + 16.5, 11, done ? GRN : d.accent, 'left', '800');
    if (!done) for (let i = 0; i < need; i++) { ctx.fillStyle = i < k ? d.accent : 'rgba(255,255,255,0.18)'; ctx.fillRect(mx + mw - 12 - (need - i) * 16, ly + 7, 12, 10); }
  }
  // ─ Barra del jefe
  let ny = 124;
  if (S.mission && S.mission.type === 'hunt' && !S.boss) {
    const lt = S.mission.eid >= 0 ? S.enemies.find(x => x.id === S.mission.eid && !x.dead) : null;
    if (lt && dist(lt.x, lt.y, P.x, P.y) < 900) {
      const col = DISTRICTS[S.mission.district].accent, bw = 440, bx = U.w / 2 - bw / 2, by = 16;
      panel(bx, by, bw, 50, col, 0.88, 8);
      text(S.mission.ltName, bx + 16, by + 22, 16, col, 'left', '800');
      hbar(bx + 16, by + 30, bw - 32, 11, lt.hp / lt.maxhp, col);
      ny = 84;
    }
  }
  if (S.boss && !S.boss.dead) {
    const b = S.boss, bw = 560, bx = U.w / 2 - bw / 2, by = 18;
    panel(bx, by, bw, 62, b.col, 0.88, 10);
    text(b.def.name, bx + 18, by + 26, 20, b.col, 'left', '800', b.col);
    text(`FASE ${b.phase}`, bx + bw - 18, by + 26, 14, '#fff', 'right', '800');
    hbar(bx + 18, by + 36, bw - 36, 14, b.hp / b.maxhp, b.col);
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(bx + 18 + (bw - 36) * 0.66, by + 34, 2, 18); ctx.fillRect(bx + 18 + (bw - 36) * 0.33, by + 34, 2, 18);
    ny = 96;
  }
  // ─ Avisos
  S.notes.forEach((n, i) => {
    const a = clamp(n.t / 0.6, 0, 1), yy = ny + i * 30;
    ctx.globalAlpha = a;
    const tw2 = textW(n.text, 16, '700') + 40;
    ctx.fillStyle = 'rgba(5,3,10,0.75)'; rrect(U.w / 2 - tw2 / 2 + 3, yy - 17, tw2, 28, 5); ctx.fill();
    rrect(U.w / 2 - tw2 / 2, yy - 20, tw2, 28, 5); ctx.fillStyle = '#17131f'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    rrect(U.w / 2 - tw2 / 2 + 2, yy - 18, tw2 - 4, 24, 3); ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(n.col, 0.9); ctx.stroke();
    text(n.text, U.w / 2, yy, 16, n.col, 'center', '700');
    ctx.globalAlpha = 1;
  });
  // ─ Banner de distrito
  if (S.banner) {
    const b = S.banner, a = clamp(Math.min(b.t, b.max - b.t) / 0.5, 0, 1);
    ctx.globalAlpha = a; bigText(b.text, U.w / 2, U.h * 0.24, 46, b.col); text(b.sub, U.w / 2, U.h * 0.24 + 30, 17, '#dbe4ff', 'center', '600'); ctx.globalAlpha = 1;
  }
  if (S.gateHint) {
    const d = DISTRICTS[S.gateHint], p = 0.6 + 0.4 * Math.sin(S.time * 8);
    ctx.globalAlpha = p; bigText('ACCESO RESTRINGIDO', U.w / 2, U.h * 0.36, 28, d.accent);
    text(`${d.name} requiere nivel ${d.req}`, U.w / 2, U.h * 0.36 + 28, 17, '#fff', 'center', '700'); ctx.globalAlpha = 1;
  }
  // ─ Interacción
  if (S.interact) {
    const it = S.interact, lab = TouchUI.on ? it.label : `[E]  ${it.label}`, tw3 = textW(lab, 17, '800') + 44, py = U.h - 130;
    panel(U.w / 2 - tw3 / 2, py, tw3, 38, it.type === 'house' ? GRN : ACC, 0.92, 8);
    text(lab, U.w / 2, py + 26, 17, '#fff', 'center', '800');
  }
  // ─ Ayuda inicial
  if (S.hint > 0 && S.time > 1) {
    ctx.globalAlpha = clamp(S.hint / 2, 0, 1);
    const hy = tmY + (Net.active ? 0 : 0);
    panel(16, hy, 316, 118, ACC, 0.8, 8);
    text('CÓMO JUGAR', 32, hy + 24, 13, ACC, 'left', '800');
    (TouchUI.on ? ['Stick izquierdo: moverte', 'Stick derecho: apuntar y disparar', 'Botones: esquiva, habilidad y USAR', 'Toca un arma abajo para cambiarla'] : ['WASD moverte · Ratón apuntar', 'Clic disparar · Shift esquivar', 'Espacio habilidad · E interactuar', 'M mapa · Esc pausa']).forEach((l, i) => text(l, 32, hy + 46 + i * 19, 13.5, '#dbe4ff', 'left', '600'));
    ctx.globalAlpha = 1;
  }
  drawMinimap();
  if (S.hold) { bigText('ESPERANDO A LOS DEMÁS JUGADORES…', U.w / 2, U.h * 0.45, 30, ACC); }
  if (Net.active && P.dead && !S.over) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = 'rgba(120,0,20,0.22)'; ctx.fillRect(0, 0, U.cw, U.ch); uiBegin();
    bigText('HAS CAÍDO', U.w / 2, U.h * 0.28, 44, RED);
    text('Un compañero puede reanimarte acercándose y pulsando E.', U.w / 2, U.h * 0.28 + 30, 16, '#ffd6dc', 'center', '700');
  }
  // ─ Mira
  if (P.dead) return;
  const mxp = In.ux, myp = In.uy, wd = WEAPONS[currentWeapon().id];
  const cross = () => { ctx.beginPath(); ctx.arc(mxp, myp, 11, 0, TAU); ctx.moveTo(mxp - 18, myp); ctx.lineTo(mxp - 6, myp); ctx.moveTo(mxp + 6, myp); ctx.lineTo(mxp + 18, myp); ctx.moveTo(mxp, myp - 18); ctx.lineTo(mxp, myp - 6); ctx.moveTo(mxp, myp + 6); ctx.lineTo(mxp, myp + 18); ctx.stroke(); };
  ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 5.5; cross(); ctx.strokeStyle = wd.col; ctx.lineWidth = 2.4; cross();
}

// ───────── Pausa ─────────
function drawPause(dt) {
  dim(0.6);
  const coop = Net.active, canAb = !!S.mission && !Net.client;
  const rows = 4 + (coop ? 0 : 1) + (canAb ? 1 : 0), w = 360, bh = 46, g = 10;
  const h = 62 + rows * (bh + g) + 76 + bh + 52, y = U.h / 2 - h / 2 + 20, x = U.w / 2 - w / 2;
  panel(x - 24, y - 20, w + 48, h, ACC, 0.92, 14);
  bigText('PAUSA', U.w / 2, y + 30, 34, ACC);
  if (coop) text('Cooperativo: la partida sigue en marcha', U.w / 2, y + 52, 12, '#9fb0d0', 'center', '700');
  let by = y + 62;
  const B = (label, o) => { const r = uiButton(x, by, w, bh, label, o); by += bh + g; return r; };
  if (B('CONTINUAR', { size: 19, accent: MAG })) Game.state = 'play';
  if (B('MAPA', { size: 17 })) Game.state = 'map';
  if (!coop) {
    const info = getRunInfo(), cs = canSaveHere();
    if (B('GUARDAR PARTIDA', { size: 17, accent: GRN, disabled: !cs.ok, sub: cs.ok ? (info ? `Último: Nv ${info.level} · ${info.where}` : null) : null })) {
      const r = saveRun(null); Game.pauseMsg = r.ok ? { t: 'Partida guardada. Cárgala desde el menú principal.', c: GRN } : { t: r.why, c: RED };
    }
  }
  if (B('CONTROLES', { size: 17 })) { Game.back = 'pause'; Game.state = 'controls'; }
  if (canAb) { if (B('ABANDONAR MISIÓN', { size: 16, accent: '#ff8a1a' })) { abandonMission(); Game.state = 'play'; } }
  const mus = Snd.isMusicOn();
  if (B(mus ? 'MÚSICA: SÍ' : 'MÚSICA: NO', { size: 16 })) { Snd.setMusic(!mus); SAVE.music = !mus; saveGame(); }
  text(`VOLUMEN  ${Math.round(Snd.getVolume() * 100)}%`, U.w / 2, by + 20, 15, '#dbe4ff', 'center', '700');
  if (uiButton(x, by + 28, 80, 34, '–', { size: 20 })) { Snd.setVolume(Snd.getVolume() - 0.1); SAVE.vol = Snd.getVolume(); saveGame(); }
  if (uiButton(x + w - 80, by + 28, 80, 34, '+', { size: 20 })) { Snd.setVolume(Snd.getVolume() + 0.1); SAVE.vol = Snd.getVolume(); saveGame(); }
  by += 76;
  const sur = coop ? (Net.host ? 'TERMINAR PARTIDA (conservas los Chips)' : 'SALIR DE LA PARTIDA (conservas los Chips)') : 'RENDIRSE (conservas los Chips)';
  if (uiButton(x, by, w, bh, sur, { size: 14, accent: RED })) { Game.pauseMsg = null; endRun(false); }
  if (Game.pauseMsg) wrapText(Game.pauseMsg.t, U.w / 2, by + bh + 22, w, 17, 13.5, Game.pauseMsg.c, 'center', '700');
}

// ───────── Subida de nivel ─────────
function openLevelUp() { P.choosing = true; Game.choices = rollPerkChoices(P); Game.state = 'levelup'; }
function drawLevelUp(dt) {
  dim(0.7);
  bigText(`¡NIVEL ${P.level}!`, U.w / 2, U.h / 2 - 192, 44, YEL, 'center', { dripLen: 0.12 });
  text('Elige una mejora', U.w / 2, U.h / 2 - 154, 17, '#dbe4ff', 'center', '600');
  const cw = 270, ch = 250, gap = 24, n = Game.choices.length, x0 = U.w / 2 - (n * cw + (n - 1) * gap) / 2, y0 = U.h / 2 - 130;
  Game.choices.forEach((p, i) => {
    const x = x0 + i * (cw + gap), hov = hoverRect(x, y0, cw, ch);
    panel(x, y0, cw, ch, hov ? YEL : ACC, 0.94, 14);
    if (hov) { ctx.strokeStyle = YEL; ctx.lineWidth = 3; ctx.shadowColor = YEL; ctx.shadowBlur = 18; chamfer(x, y0, cw, ch, 14); ctx.stroke(); ctx.shadowBlur = 0; }
    text(String(i + 1), x + 18, y0 + 34, 22, '#7d89a6', 'left', '800');
    const have = perkCount(P, p.id);
    if (have) text(`Nv ${have} → ${have + 1}`, x + cw - 18, y0 + 32, 13, GRN, 'right', '800');
    wrapText(p.name, x + 18, y0 + 90, cw - 36, 26, 21, '#fff', 'left', '800');
    wrapText(p.desc, x + 18, y0 + 150, cw - 36, 20, 16, '#b8c4e0', 'left', '600');
    if (!p.base) text('IMPLANTE DESBLOQUEADO', x + 18, y0 + ch - 18, 11, MAG, 'left', '800');
    if ((hov && In.clicked) || keyHit('Digit' + (i + 1))) { In.clicked = false; chooseLevelPerk(p); }
  });
}
function chooseLevelPerk(p) {
  Snd.play('buy');
  if (Net.client) {
    Net.sendHost(['perk', p.id]); applyPerkLocal(p.id);
    Game.state = 'play'; return;
  }
  applyPerk(P, p.id); P.pendingLevel--;
  if (P.pendingLevel > 0) { Game.choices = rollPerkChoices(P); } else { P.choosing = false; Game.state = 'play'; }
}
// El cliente refleja al instante la mejora elegida (el anfitrión confirma en la siguiente instantánea)
function applyPerkLocal(id) { P.perks[id] = (P.perks[id] || 0) + 1; }

// ───────── Piso franco (guardar y descansar) ─────────
function drawHouse(dt) {
  dim(0.72);
  const H = Game.house; H.t += dt;
  const w = 760, h = 430, x = U.w / 2 - w / 2, y = U.h / 2 - h / 2 - 10, col = GRN;
  panel(x, y, w, h, col, 0.95, 14);
  // habitación
  drawSafeRoom(x + 22, y + 22, 330, h - 44, H.t);
  const bx = x + 376, bw = w - 376 - 24;
  bigText('PISO FRANCO', bx + bw / 2, y + 58, 34, col);
  text(`${DISTRICTS[H.h.district].name}  ·  nadie te sigue hasta aquí`, bx + bw / 2, y + 82, 14, '#9fb0d0', 'center', '600');
  const coop = Net.active;
  const info = getRunInfo(), saved = info && info.house === H.h.id;
  let by = y + 112;
  const can = canSaveHere();
  const lab = S.saveT >= 0 && saved ? 'GUARDAR DE NUEVO' : 'GUARDAR PARTIDA';
  const sub = coop ? 'No disponible en cooperativo' : (info ? `Último guardado: Nv ${info.level} · ${info.where}` : 'Aún no has guardado esta partida');
  if (uiButton(bx, by, bw, 58, lab, { size: 20, accent: col, sub, disabled: coop })) {
    const r = saveRun(H.h); H.msg = r.ok ? { t: 'Partida guardada. Puedes cargarla desde el menú o si caes.', c: GRN } : { t: r.why, c: RED };
  }
  by += 70;
  const rc = restCost(), need = P.hp < P.maxhp - 0.5;
  if (uiButton(bx, by, bw, 58, need ? `DESCANSAR · ${rc} ¢` : 'DESCANSAR', { size: 20, accent: YEL, disabled: !need || P.cred < rc, sub: need ? 'Recupera toda la vida' : 'Ya estás al máximo' })) {
    if (Net.client) { Net.sendHost(['rest']); Snd.play('heal'); } else restPlayer(P);
    H.msg = { t: 'Has dormido unas horas. Vida y habilidad al máximo.', c: GRN };
  }
  by += 70;
  if (uiButton(bx, by, bw, 46, 'SALIR A LA CALLE', { size: 17, accent: '#8896b8' }) || keyHit('KeyE') || keyHit('Escape')) closeHouse();
  if (H.msg) wrapText(H.msg.t, bx, by + 74, bw, 18, 14, H.msg.c, 'left', '700');
  else if (!coop && !can.ok) wrapText(can.why, bx, by + 74, bw, 18, 14, '#ff8a9a', 'left', '700');
  else if (coop) wrapText('En cooperativo la partida no se guarda. El mundo sigue en marcha, pero aquí dentro nadie puede hacerte daño.', bx, by + 74, bw, 18, 14, '#9fb0d0', 'left', '600');
}
function drawSafeRoom(x, y, w, h, t) {
  ctx.save(); rrect(x, y, w, h, 4); ctx.clip();
  const fl = y + h * 0.74;
  // pared con papel pintado
  ctx.fillStyle = '#2d2240'; ctx.fillRect(x, y, w, fl - y);
  ctx.fillStyle = 'rgba(255,255,255,0.05)'; for (let k = 0; k < w; k += 22) ctx.fillRect(x + k, y, 10, fl - y);
  const wg = ctx.createLinearGradient(0, y, 0, fl); wg.addColorStop(0, 'rgba(0,0,0,0.4)'); wg.addColorStop(1, 'rgba(0,0,0,0.05)'); ctx.fillStyle = wg; ctx.fillRect(x, y, w, fl - y);
  // ventana con skyline, lluvia y reflejo de neón
  const wx = x + 26, wy = y + 26, ww = 124, wh = 118;
  ctx.save(); ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
  const sg = ctx.createLinearGradient(0, wy, 0, wy + wh); sg.addColorStop(0, '#12062a'); sg.addColorStop(1, '#7a1d55'); ctx.fillStyle = sg; ctx.fillRect(wx, wy, ww, wh);
  const r = new RNG(21); let bx = wx - 4;
  while (bx < wx + ww) { const bw = r.range(16, 30), bh = r.range(30, 84); ctx.fillStyle = '#150a28'; ctx.fillRect(bx, wy + wh - bh, bw, bh); ctx.fillStyle = r.chance(0.5) ? '#19f0ff' : '#ff2bd6'; ctx.fillRect(bx, wy + wh - bh, bw, 2);
    for (let k = 0; k < 6; k++) if (r.chance(0.35)) { ctx.fillStyle = 'rgba(255,225,140,0.8)'; ctx.fillRect(bx + 3 + r.int(0, 3) * 6, wy + wh - bh + 7 + k * 10, 4, 5); } bx += bw + 2; }
  ctx.strokeStyle = 'rgba(190,215,255,0.5)'; ctx.lineWidth = 1.2; ctx.beginPath();
  for (let k = 0; k < 18; k++) { const rx = wx + ((k * 23 + t * 55) % ww), ry = wy + ((k * 41 + t * 190) % wh); ctx.moveTo(rx, ry); ctx.lineTo(rx - 3, ry + 11); }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.beginPath(); ctx.moveTo(wx + 10, wy + wh); ctx.lineTo(wx + 50, wy); ctx.lineTo(wx + 74, wy); ctx.lineTo(wx + 34, wy + wh); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.strokeRect(wx, wy, ww, wh); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.moveTo(wx, wy + wh * 0.5); ctx.lineTo(wx + ww, wy + wh * 0.5); ctx.stroke();
  ctx.fillStyle = '#5a5568'; ctx.fillRect(wx - 8, wy + wh, ww + 16, 9); ctx.strokeRect(wx - 8, wy + wh, ww + 16, 9);
  // cortinas
  for (const [cx0, dir] of [[wx - 16, 1], [wx + ww - 8, -1]]) { ctx.fillStyle = '#7a1f3a'; ctx.fillRect(cx0, wy - 8, 24, wh + 20); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); for (let k = 1; k < 4; k++) { ctx.moveTo(cx0 + k * 6, wy - 8); ctx.lineTo(cx0 + k * 6, wy + wh + 12); } ctx.stroke(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(cx0, wy - 8, 24, wh + 20); }
  ctx.fillStyle = '#4a4550'; ctx.fillRect(wx - 22, wy - 14, ww + 44, 7); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(wx - 22, wy - 14, ww + 44, 7);
  // póster y pintada
  paper(x + 204, y + 36, 76, 104, { rot: 0.05, col: '#ff2e88', tape: false });
  dispText('LIVE', x + 242, y + 98, 28, '#fff', 'center', { lw: 0, sh: 0 }); ctx.fillStyle = '#ffe14a'; ctx.fillRect(x + 214, y + 106, 56, 5); ctx.fillStyle = INK; ctx.fillRect(x + 214, y + 116, 56, 3); ctx.fillRect(x + 214, y + 123, 40, 3);
  sprayText('NULL', x + 254, y + 178, 30, '#12e6ff', { rot: -0.08, jitter: 0.6 });
  // suelo de tablas y rodapié
  ctx.fillStyle = '#3b2b24'; ctx.fillRect(x, fl, w, y + h - fl);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); for (let k = 0; k < 6; k++) { ctx.moveTo(x, fl + 10 + k * 16); ctx.lineTo(x + w, fl + 10 + k * 16); } ctx.stroke();
  ctx.fillStyle = '#17121f'; ctx.fillRect(x, fl - 7, w, 9); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(x - 2, fl - 7, w + 4, 9);
  // cama con manta naranja
  const bx0 = x + 14, by0 = fl - 52;
  ctx.fillStyle = '#4a3322'; ctx.fillRect(bx0, by0 + 20, 174, 40); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.strokeRect(bx0, by0 + 20, 174, 40);
  ctx.fillStyle = '#4a3322'; ctx.fillRect(bx0 - 6, by0 - 6, 12, 70); ctx.strokeRect(bx0 - 6, by0 - 6, 12, 70);
  ctx.fillStyle = '#e9e1c8'; ctx.fillRect(bx0 + 8, by0 + 6, 160, 24); ctx.strokeRect(bx0 + 8, by0 + 6, 160, 24);
  ctx.fillStyle = '#ff7a1a'; ctx.fillRect(bx0 + 54, by0 + 6, 114, 30); ctx.strokeRect(bx0 + 54, by0 + 6, 114, 30);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 4; k++) ctx.fillRect(bx0 + 70 + k * 26, by0 + 6, 8, 30);
  ctx.fillStyle = '#f4f0e6'; ctx.fillRect(bx0 + 12, by0 + 2, 36, 18); ctx.strokeRect(bx0 + 12, by0 + 2, 36, 18);
  // mesilla con lámpara
  const nx = x + 196, ny = fl - 40;
  ctx.fillStyle = '#5a4030'; ctx.fillRect(nx, ny, 36, 40); ctx.strokeRect(nx, ny, 36, 40); ctx.fillStyle = INK; ctx.fillRect(nx + 6, ny + 14, 24, 3);
  ctx.fillStyle = '#c9c4d4'; ctx.fillRect(nx + 16, ny - 18, 4, 18); ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.moveTo(nx + 6, ny - 16); ctx.lineTo(nx + 30, ny - 16); ctx.lineTo(nx + 24, ny - 34); ctx.lineTo(nx + 12, ny - 34); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  const fk = 0.85 + 0.15 * Math.sin(t * 8) * (Math.sin(t * 0.7) > 0.96 ? 0.2 : 1);
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55 * fk; ctx.drawImage(glowSprite('#ffd27a', 64), nx - 44, ny - 80, 124, 124); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  // tele de tubo sobre una caja: pantalla verde de guardado
  const tx = x + 246, ty = fl - 58;
  ctx.fillStyle = '#6a4a2c'; ctx.fillRect(tx - 6, ty + 30, 80, 28); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.strokeRect(tx - 6, ty + 30, 80, 28);
  ctx.fillStyle = '#34313c'; ctx.fillRect(tx, ty - 8, 68, 40); ctx.strokeRect(tx, ty - 8, 68, 40);
  ctx.fillStyle = '#0c2a1a'; ctx.fillRect(tx + 5, ty - 3, 48, 30);
  ctx.fillStyle = 'rgba(93,255,154,0.75)'; for (let k = 0; k < 4; k++) ctx.fillRect(tx + 9, ty + 1 + k * 6, 14 + ((k * 7 + Math.floor(t * 3)) % 4) * 6, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 30; k += 3) ctx.fillRect(tx + 5, ty - 3 + k, 48, 1);
  ctx.fillStyle = Math.sin(t * 4) > 0 ? '#5dff9a' : '#1d5a38'; ctx.beginPath(); ctx.arc(tx + 60, ty + 22, 3, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.22; ctx.drawImage(glowSprite('#5dff9a', 64), tx - 20, ty - 26, 110, 90); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
  rrect(x, y, w, h, 4); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
}

// ───────── Liberación de distritos (indicadores) ─────────
// Fila con los 5 distritos: liberado / operaciones hechas
function drawLibStrip(cx, y) {
  const w = 128, gap = 8, tot = 5 * w + 4 * gap; let x = cx - tot / 2;
  for (const d of DISTRICTS) {
    const done = S.defeated[d.id], k = libDone(d.id), need = LIB_NEED[d.id], locked = gateLv() < d.req;
    const col = done ? GRN : locked ? '#555569' : d.accent;
    ctx.fillStyle = 'rgba(8,6,16,0.85)'; rrect(x, y, w, 31, 6); ctx.fill(); ctx.strokeStyle = rgba(col, 0.9); ctx.lineWidth = 1.5; ctx.stroke();
    text(d.name.toUpperCase(), x + w / 2, y + 12, 10, col, 'center', '800');
    if (done) text('LIBERADO', x + w / 2, y + 25, 11, GRN, 'center', '800');
    else if (locked) text(`NIVEL ${d.req}`, x + w / 2, y + 25, 11, '#8a8aa0', 'center', '700');
    else { for (let i = 0; i < need; i++) { ctx.fillStyle = i < k ? col : 'rgba(255,255,255,0.14)'; ctx.fillRect(x + w / 2 - need * 9 + i * 18 + 2, y + 17, 14, 7); } }
    x += w + gap;
  }
}

// ───────── Fixer (contratos) ─────────
function openBoard(hub) {
  if (!S.boards[hub.id]) S.boards[hub.id] = makeContracts(hub);
  Game.board = { hub, list: S.boards[hub.id] }; Game.state = 'board'; Snd.play('click');
}
function closeBoard() { Game.state = 'play'; }
function drawBoard(dt) {
  dim(0.7);
  const w = 760, x = U.w / 2 - w / 2, y = 70;
  heading('FIXER — CONTRATOS', `${DISTRICTS[Game.board.hub.district].name}  ·  Un contrato activo a la vez`);
  drawLibStrip(U.w / 2, 114);
  const list = Game.board.list.map((c, i) => c && Object.assign({ idx: i }, c)).filter(Boolean);
  let yy = y + 84;
  if (S.mission) {
    panel(x, yy, w, 60, YEL, 0.9, 10);
    text(`MISIÓN ACTIVA: ${S.mission.title}`, x + 18, yy + 26, 16, YEL, 'left', '800');
    text('Complétala (o abandónala desde la pausa) antes de aceptar otra.', x + 18, yy + 48, 13, '#9fb0d0', 'left', '600');
    yy += 72;
  }
  const cardH = clamp(Math.floor((U.h - 76 - yy) / Math.max(1, list.length)) - 10, 64, 94);
  list.forEach((c, i) => {
    const h = cardH, locked = c.type === 'locked', col = c.type === 'boss' || locked ? RED : c.type === 'deliver' ? ACC : c.type === 'raid' ? MAG : c.op ? DISTRICTS[c.district].accent : ACC;
    panel(x, yy, w, h, locked ? '#5a4a5a' : col, 0.9, 10);
    text((OP_NAMES[c.type] || 'ENTREGA') + (c.op ? ` · +1 LIBERACIÓN` : '') + (locked ? ' · BLOQUEADO' : '') + (c.recLevel ? `  ·  NIVEL RECOMENDADO ${c.recLevel}` : ''), x + 18, yy + 20, 11, col, 'left', '800');
    text(c.title, x + 18, yy + 38, 18, locked ? '#9a8a9a' : '#fff', 'left', '800');
    wrapText(c.desc, x + 18, yy + 55, w - 250, 14, 12.5, '#aab6d4', 'left');
    text('★'.repeat(c.risk) + '☆'.repeat(Math.max(0, 5 - c.risk)), x + w - 18, yy + 21, 15, '#ffb020', 'right', '800');
    text(`${fmt(c.reward.cred)} ¢  ·  ${fmt(c.reward.xp)} XP${c.reward.chips ? '  ·  ' + c.reward.chips + ' Chips' : ''}`, x + w - 18, yy + 39, 13, YEL, 'right', '800');
    if (uiButton(x + w - 148, yy + h - 32, 130, 26, locked ? 'BLOQUEADO' : 'ACEPTAR', { size: 14, accent: col, disabled: !!S.mission || locked })) {
      if (Net.client) { Net.sendHost(['accept', Game.board.hub.id, c.idx]); Game.state = 'play'; }
      else if (acceptContract(Game.board.list[c.idx], P)) { Game.state = 'play'; Game.board.list[c.idx] = null; }
    }
    yy += h + 10;
  });
  if (!list.length) text('No hay contratos disponibles ahora mismo.', U.w / 2, yy + 30, 16, '#9fb0d0', 'center');

  if (uiButton(U.w / 2 - 100, U.h - 64, 200, 42, 'CERRAR', { size: 17, accent: '#8896b8' }) || keyHit('KeyE')) Game.state = 'play';
}

// ───────── Ripper (tienda) ─────────
function openShop(hub) {
  if (!S.shops[hub.id]) S.shops[hub.id] = makeShop(hub);
  Game.shop = { hub, items: S.shops[hub.id] }; Game.state = 'shop'; Snd.play('click');
}
function drawShop(dt) {
  dim(0.7);
  heading('EL RIPPER', S.defeated[Game.shop.hub.district] ? 'Distrito liberado  ·  -15% en todo' : 'Cibernética, armas y remiendos  ·  Pago en créditos');
  bigText(`${fmt(P.cred)} ¢`, U.w - 40, 60, 26, YEL, 'right');
  const w = 700, x = U.w / 2 - w / 2; let y = 124;
  for (const it of Game.shop.items) {
    const h = 74, price = itemPrice(it, P, Game.shop.hub), avail = itemAvailable(it), can = avail && P.cred >= price;
    const col = it.kind === 'weapon' ? TIERS[it.w.tier].col : GRN;
    panel(x, y, w, h, avail ? col : '#444458', 0.9, 10);
    text(it.name, x + 18, y + 30, 18, avail ? '#fff' : '#7d7d92', 'left', '800');
    if (it.kind === 'weapon') {
      const d = WEAPONS[it.w.id];
      text(`${TIERS[it.w.tier].name.toUpperCase()}  ·  daño ${Math.round(d.dmg * weaponMult(it.w) * (d.pellets || 1))}  ·  cadencia ${d.rate}/s`, x + 18, y + 50, 12, avail ? col : '#666', 'left', '800');
      text(d.desc, x + 18, y + 66, 12, '#9fb0d0', 'left', '500');
    } else text(it.desc, x + 18, y + 54, 13, '#9fb0d0', 'left', '500');
    const lab = !avail ? (it.sold ? 'VENDIDO' : it.kind === 'heal' ? 'VIDA LLENA' : 'AGOTADO') : `${fmt(price)} ¢`;
    if (uiButton(x + w - 140, y + 20, 122, 34, lab, { size: 15, accent: YEL, disabled: !can })) { if (Net.client) { Net.sendHost(['buy', Game.shop.hub.id, it.id]); Snd.play('buy'); } else buyItem(it, P, Game.shop.hub); }
    y += h + 8;
  }
  const w2 = P.weapons.map((wp, i) => `${i + 1}: ${WEAPONS[wp.id].name}`).join('   ');
  text(`Llevas → ${w2}  ·  Comprar un arma con 3 equipadas sustituye la actual`, U.w / 2, y + 22, 13, '#9fb0d0', 'center', '600');
  if (uiButton(U.w / 2 - 100, U.h - 64, 200, 42, 'CERRAR', { size: 17, accent: '#8896b8' }) || keyHit('KeyE')) Game.state = 'play';
}

// ───────── Mapa completo ─────────
function drawMapScreen(dt) {
  dim(0.82);
  const sc = Math.floor(Math.min((U.h - 215) / WH, (U.w - 80) / WW) * 10) / 10, mw = WW * sc, mh = WH * sc, mx = U.w / 2 - mw / 2, my = 112;
  heading('MAPA DE LA CIUDAD', `Semilla ${S.seed}`);
  panel(mx - 8, my - 8, mw + 16, mh + 16, ACC, 0.95, 12);
  ctx.fillStyle = '#050309'; ctx.fillRect(mx, my, mw, mh);
  ctx.imageSmoothingEnabled = false; ctx.drawImage(S.mapFog, mx, my, mw, mh); ctx.imageSmoothingEnabled = true;
  const wp = (wx, wy) => ({ x: mx + (wx / TILE) * sc, y: my + (wy / TILE) * sc });
  // etiquetas de distrito
  for (const d of DISTRICTS) {
    let sx = 0, sy = 0, n = 0;
    for (let cy = 0; cy < WB; cy++) for (let cx = 0; cx < WB; cx++) if (S.world.cellD[cy][cx] === d.id) { sx += cx; sy += cy; n++; }
    if (!n) continue;
    const c = S.world.cellCenter(Math.round(sx / n), Math.round(sy / n)), p = wp(c.x, c.y), locked = gateLv() < d.req;
    ctx.globalAlpha = 0.9; text(d.name.toUpperCase(), p.x, p.y, 14, d.accent, 'center', '800', d.accent);
    const st = S.defeated[d.id] ? 'LIBERADO' : locked ? `BLOQUEADO · NV ${d.req}` : `OPERACIONES ${libDone(d.id)}/${LIB_NEED[d.id]}`;
    text(st, p.x, p.y + 16, 11, S.defeated[d.id] ? GRN : locked ? '#ff8a9a' : '#ffe14a', 'center', '700'); ctx.globalAlpha = 1;
  }
  for (const h of S.world.hubs) { const c = S.world.cellCenter(h.cx, h.cy); if (!S.explored[Math.floor(c.y / TILE) * WW + Math.floor(c.x / TILE)]) continue; const p = wp(c.x, c.y); ctx.fillStyle = MAG; ctx.fillRect(p.x - 6, p.y - 3, 5, 6); ctx.fillStyle = GRN; ctx.fillRect(p.x + 1, p.y - 3, 5, 6); }
  for (const h of S.world.houses) { if (!S.explored[Math.floor(h.y / TILE) * WW + Math.floor(h.x / TILE)]) continue; const p = wp(h.x, h.y); drawHouseIcon(p.x, p.y, 1.25, S.houseId === h.id); }
  for (const l of S.world.lairs) { if (S.defeated[l.district]) continue; const c = S.world.cellCenter(l.cx, l.cy), p = wp(c.x, c.y); ctx.strokeStyle = RED; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x - 5, p.y - 5); ctx.lineTo(p.x + 5, p.y + 5); ctx.moveTo(p.x + 5, p.y - 5); ctx.lineTo(p.x - 5, p.y + 5); ctx.stroke(); }
  const tg = missionTarget(); if (tg) { const p = wp(tg.x, tg.y); ctx.fillStyle = YEL; ctx.beginPath(); ctx.moveTo(p.x, p.y - 8); ctx.lineTo(p.x + 7, p.y); ctx.lineTo(p.x, p.y + 8); ctx.lineTo(p.x - 7, p.y); ctx.closePath(); ctx.fill(); }
  for (const o of S.players) { if (o === P) continue; const q = wp(o.x, o.y); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(q.x, q.y, 6, 0, TAU); ctx.fill(); ctx.fillStyle = o.dead ? RED : o.ch.col; ctx.beginPath(); ctx.arc(q.x, q.y, 4.5, 0, TAU); ctx.fill(); text(o.name, q.x, q.y - 10, 11, '#fff', 'center', '800'); }
  const pp = wp(P.x, P.y); ctx.save(); ctx.translate(pp.x, pp.y); ctx.rotate(P.ang); ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill(); ctx.restore(); ctx.shadowBlur = 0;
  text('◆ objetivo   ✕ guarida de jefe   ▮ fixer / Ripper   ⌂ piso franco   ▲ tú', U.w / 2, my + mh + 32, 13, '#9fb0d0', 'center', '600');
  if (uiButton(U.w / 2 - 90, U.h - 54, 180, 38, 'CERRAR', { size: 16, accent: '#8896b8' })) Game.state = 'play';
}

// ───────── Fin de partida ─────────
function drawEnd(dt) {
  dim(0.82);
  const sm = S.summary, win = sm.victory, cx = U.w / 2, y = 110;
  bigText(win ? 'LEYENDA DE LA CIUDAD' : 'HAS CAÍDO', cx, y, 54, win ? YEL : RED);
  text(win ? 'Hegemón ha caído. Nadie volverá a mandar en estas calles.' : 'La ciudad no perdona. Pero tus Chips sí te acompañan.', cx, y + 34, 17, '#dbe4ff', 'center', '600');
  const w = 560, x = cx - w / 2, rows = [
    ['Nivel alcanzado', sm.level], ['Enemigos abatidos', fmt(sm.kills)], ['Misiones completadas', sm.missions], ['Jefes eliminados', sm.bosses],
    ['Distritos liberados', `${sm.libs || 0} / 5`], ['Distrito más lejano', DISTRICTS[sm.district].name], ['Tiempo de partida', `${Math.floor(sm.time / 60)} min ${Math.floor(sm.time % 60)} s`],
  ];
  panel(x, y + 66, w, 290, win ? YEL : RED, 0.92, 14);
  rows.forEach((r, i) => { text(r[0], x + 28, y + 100 + i * 32, 17, '#9fb0d0', 'left', '600'); text(String(r[1]), x + w - 28, y + 100 + i * 32, 18, '#fff', 'right', '800'); });
  text('CHIPS GANADOS', x + 28, y + 336, 17, YEL, 'left', '800'); bigText(`+${fmt(sm.chips)}`, x + w - 28, y + 338, 28, YEL, 'right');
  text(`Total: ${fmt(SAVE.chips)} Chips  ·  Gástalos en el Taller`, cx, y + 392, 15, '#9fb0d0', 'center', '700');
  const by = y + 416, ri = !win && !sm.coop && getRunInfo();
  if (sm.msg) text(sm.msg, cx, y + 412, 14, '#ff8a9a', 'center', '700');
  if (ri) {
    if (uiButton(cx - 190, by + 58, 380, 44, `CARGAR PARTIDA · Nv ${ri.level} · ${ri.where}`, { size: 16, accent: GRN })) { if (!loadRun()) Game.state = 'title'; }
  }
  if (uiButton(cx - 290, by, 180, 48, 'TALLER', { size: 18, accent: YEL })) { Net.leave(); Game.state = 'workshop'; Game.tab = 0; }
  if (sm.coop) {
    if (uiButton(cx - 90, by, 380, 48, 'VOLVER AL MENÚ', { size: 18, accent: '#8896b8' })) { Net.leave(); Game.state = 'title'; }
  } else {
    if (uiButton(cx - 90, by, 200, 48, 'OTRA PARTIDA', { size: 18, accent: MAG })) { Game.state = 'select'; Game.sel = SAVE.lastChar; }
    if (uiButton(cx + 130, by, 160, 48, 'MENÚ', { size: 18, accent: '#8896b8' })) Game.state = 'title';
  }
}
