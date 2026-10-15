'use strict';
// ───────── Cooperativo LAN: menú, sala de espera y selección de personaje ─────────

const Coop = { name: '', ip: '', focus: '', t: 0 };

function coopName() { return Coop.name || (Coop.name = (SAVE.coopName || 'Jugador')); }

// Campo de texto sencillo (modo inmediato). Devuelve el valor nuevo.
function textField(id, x, y, w, h, val, o = {}) {
  const hov = hoverRect(x, y, w, h);
  if (In.clicked && hov) { Coop.focus = id; In.clicked = false; Snd.play('click'); }
  const foc = Coop.focus === id;
  if (foc && In.typed) {
    for (const ch of In.typed) {
      if (ch === '\b') val = val.slice(0, -1);
      else if (val.length < (o.max || 20) && (!o.filter || o.filter.test(ch))) val += ch;
    }
  }
  ctx.fillStyle = 'rgba(5,3,10,0.85)'; rrect(x + 3, y + 4, w, h, 6); ctx.fill();
  rrect(x, y, w, h, 6); ctx.fillStyle = foc ? '#241f33' : '#17141f'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  rrect(x + 2.5, y + 2.5, w - 5, h - 5, 4); ctx.lineWidth = 1.6; ctx.strokeStyle = foc ? (o.accent || ACC) : 'rgba(236,227,200,0.4)'; ctx.stroke();
  const caret = foc && Math.floor(Game.t * 2) % 2 === 0 ? '|' : '';
  text((val || (foc ? '' : o.hint || '')) + caret, x + 14, y + h / 2 + 6, 17, val ? '#fff' : '#77758a', 'left', '700');
  return val;
}

function coopOpen() {
  Net.leave(); Net.found = {}; Net.msg = '';
  Game.state = 'coop'; Coop.focus = '';
  if (Net.avail) window.NSNet.browse(true);
}
function coopClose(to) {
  if (Net.avail) window.NSNet.browse(false);
  Net.leave(); Game.state = to || 'title';
}

function drawCoop(dt) {
  drawCityBackdrop(Game.t); dim(0.62);
  heading('COOPERATIVO LAN', 'Hasta 4 jugadores en la misma red  ·  Cada ordenador necesita el juego instalado');
  const cx = U.w / 2;
  if (!Net.avail) {
    panel(cx - 360, 190, 720, 200, YEL, 0.92, 12);
    wrapText('El cooperativo en red local solo está disponible en la versión de PC (Windows). Instala el juego en los ordenadores y ábrelo desde allí.', cx - 330, 250, 660, 24, 17, '#dbe4ff', 'left', '600');
    if (uiButton(cx - 100, U.h - 90, 200, 46, 'VOLVER', { size: 18, accent: '#8896b8' }) || keyHit('Escape')) coopClose('title');
    return;
  }
  // limpiar partidas que ya no se anuncian
  const now = performance.now();
  for (const k in Net.found) if (now - Net.found[k].t > 4500) delete Net.found[k];
  const lx = cx - 440, rx = cx + 20, w = 420, y0 = 140;
  // ── Columna izquierda: nombre y crear partida
  panel(lx, y0, w, 330, MAG, 0.92, 12);
  text('TU NOMBRE', lx + 22, y0 + 44, 14, '#9d97a8', 'left', '800');
  Coop.name = textField('name', lx + 22, y0 + 54, w - 44, 42, coopName(), { max: 14, hint: 'Tu nombre', accent: MAG });
  text('CREAR UNA PARTIDA', lx + 22, y0 + 138, 14, '#9d97a8', 'left', '800');
  wrapText('Tú eres el anfitrión: los demás se unirán a tu ordenador. Cada jugador elige un personaje distinto (también los que aún tenga bloqueados).', lx + 22, y0 + 160, w - 44, 18, 13.5, '#c9c2b0', 'left', '600');
  if (uiButton(lx + 22, y0 + 232, w - 44, 54, 'CREAR PARTIDA', { size: 21, accent: MAG })) {
    SAVE.coopName = coopName().trim() || 'Jugador'; saveGame();
    (async () => {
      const ok = await Net.hostGame(SAVE.coopName, Net.freeCharFor(SAVE.lastChar));
      if (ok) { Game.state = 'lobby'; Coop.focus = ''; }
    })();
  }
  const ipTxt = Net.ips.length ? 'Tu IP en la red: ' + Net.ips.join('  ·  ') : '';
  if (ipTxt) text(ipTxt, lx + 22, y0 + 314, 13, '#9fb0d0', 'left', '600');
  // ── Columna derecha: unirse
  panel(rx, y0, w, 330, ACC, 0.92, 12);
  text('PARTIDAS ENCONTRADAS', rx + 22, y0 + 44, 14, '#9d97a8', 'left', '800');
  const games = Object.values(Net.found);
  let gy = y0 + 56;
  if (!games.length) text('Buscando partidas en la red…', rx + 22, gy + 28, 15, '#77758a', 'left', '600');
  games.slice(0, 3).forEach((g) => {
    const full = g.info.players >= g.info.max || g.info.started, bad = g.info.ver !== NET_VER;
    if (uiButton(rx + 22, gy, w - 44, 46, `${g.info.name}  ·  ${g.info.players}/${g.info.max}`, { size: 17, accent: ACC, disabled: full || bad, sub: bad ? 'Versión distinta' : full ? 'Completa' : g.ip })) joinTo(g.ip, g.port);
    gy += 54;
  });
  text('O ESCRIBE LA IP DEL ANFITRIÓN', rx + 22, y0 + 240, 14, '#9d97a8', 'left', '800');
  Coop.ip = textField('ip', rx + 22, y0 + 250, w - 44 - 130, 42, Coop.ip, { max: 40, filter: /[0-9a-zA-Z.\-]/, hint: '192.168.1.10', accent: ACC });
  if (uiButton(rx + w - 22 - 120, y0 + 250, 120, 42, 'ENTRAR', { size: 17, accent: GRN, disabled: !Coop.ip.trim() })) joinTo(Coop.ip.trim(), Net.port);
  if (Net.msg) wrapText(Net.msg, cx, y0 + 372, 860, 20, 15, '#ff8a9a', 'center', '700');
  if (uiButton(cx - 100, U.h - 74, 200, 46, 'VOLVER', { size: 18, accent: '#8896b8' }) || (keyHit('Escape') && !Coop.focus)) coopClose('title');
  if (keyHit('Escape')) Coop.focus = '';
}
function joinTo(ip, port) {
  SAVE.coopName = coopName().trim() || 'Jugador'; saveGame();
  Net.msg = 'Conectando…';
  (async () => {
    const ok = await Net.joinGame(ip, SAVE.coopName, SAVE.lastChar, port);
    if (ok) { Net.msg = ''; Game.state = 'lobby'; Coop.focus = ''; Coop.joined = performance.now(); }
  })();
}
Net.freeCharFor = function (pref) { return pref || CHARS[0].id; };

// ───────── Sala de espera ─────────
function mySlot() { return Net.lobby && Net.lobby.slots.find(s => s.id === Net.myId); }
function drawLobby(dt) {
  drawCityBackdrop(Game.t); dim(0.66);
  const isHost = Net.role === 'host';
  if (!Net.role || !Net.lobby) { Game.state = 'coop'; return; }
  heading(isHost ? 'SALA DE ESPERA — ANFITRIÓN' : 'SALA DE ESPERA', isHost ? 'Los jugadores se unirán a tu IP. Empieza cuando todos estén listos.' : 'Elige tu personaje y pulsa LISTO.');
  // La partida ha empezado (llega el mensaje del anfitrión)
  if (Game.coopStart && !isHost) {
    const cfg = Game.coopStart; Game.coopStart = null;
    const me = cfg.roster.find(r => r.id === Net.myId);
    startLoading('coopclient', me ? me.charId : SAVE.lastChar, cfg);
    return;
  }
  const slots = Net.lobby.slots, cx = U.w / 2;
  // ── 4 plazas
  const sw = 232, sg = 16, x0 = cx - (4 * sw + 3 * sg) / 2, y0 = 126, sh = 236;
  for (let i = 0; i < 4; i++) {
    const s = slots[i], x = x0 + i * (sw + sg);
    const ch = s ? CHARS.find(c => c.id === s.charId) : null;
    panel(x, y0, sw, sh, ch ? ch.col : '#555570', 0.9, 12);
    if (!s) { text('LIBRE', x + sw / 2, y0 + 130, 20, '#6e6c80', 'center', '800'); text('Esperando jugador…', x + sw / 2, y0 + 154, 13, '#5e5c70', 'center', '600'); continue; }
    const ax = x + 12, ay = y0 + 18, aw = sw - 24, ah = 128;
    ctx.save(); ctx.beginPath(); ctx.rect(ax, ay, aw, ah); ctx.clip();
    ctx.fillStyle = mixHex(ch.col, '#0b0a10', 0.72); ctx.fillRect(ax, ay, aw, ah); ctx.restore();
    if (!CharArt.drawBust(ctx, ch.id, ax, ay, aw, ah, { flip: i % 2 === 1 })) CharArt.draw(ctx, ch.id, x + sw / 2, ay + ah + 2, ah + 20, { flip: i % 2 === 1 });
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(ax, ay, aw, ah);
    dispText(s.name, x + sw / 2, y0 + 176, 21, '#fff', 'center');
    text(ch.name.replace(/"/g, ''), x + sw / 2, y0 + 196, 13, ch.col, 'center', '800');
    if (s.id === 0) stickerTag('ANFITRIÓN', x + sw / 2, y0 + 220, YEL, 12, -0.03);
    else if (s.ready) stickerTag('LISTO', x + sw / 2, y0 + 220, GRN, 12, 0.03);
    else text('Eligiendo…', x + sw / 2, y0 + 224, 13, '#8e8ca0', 'center', '700');
    if (isHost && s.id !== 0 && uiButton(x + sw - 34, y0 + 8, 28, 24, 'X', { size: 11, accent: RED })) Net.kickSlot(s.id);
    if (s.id === Net.myId) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.strokeRect(x - 4, y0 - 4, sw + 8, sh + 8); ctx.setLineDash([]); }
  }
  // ── Selección de personaje (todos disponibles; los bloqueados también valen en cooperativo)
  const me = mySlot();
  text('ELIGE PERSONAJE  ·  Cada uno solo puede estar una vez en la partida  ·  Los bloqueados se pueden usar en cooperativo', cx, y0 + sh + 36, 14, '#d6cfbd', 'center', '700');
  const cw = 236, cg = 14, cx0 = cx - (CHARS.length * cw + (CHARS.length - 1) * cg) / 2, cy0 = y0 + sh + 50, chh = 188;
  CHARS.forEach((c, i) => {
    const x = cx0 + i * (cw + cg), owner = Net.takenBy(c.id), mine = me && me.charId === c.id, taken = owner !== null && !mine;
    const owned = SAVE.chars.includes(c.id);
    panel(x, cy0, cw, chh, taken ? '#444458' : c.col, 0.88, 10);
    dispText(c.name.replace(/"/g, ''), x + 14, cy0 + 36, 19, taken ? '#807e92' : '#fff', 'left');
    text(c.role.toUpperCase(), x + 14, cy0 + 54, 12, taken ? '#6e6c80' : c.col, 'left', '800');
    text(`${WEAPONS[c.weapon].name}  ·  ${c.abName}`, x + 14, cy0 + 74, 12, '#a9b3cf', 'left', '700');
    wrapText(c.desc, x + 14, cy0 + 94, cw - 28, 15, 12, '#c3bdb0', 'left');
    if (!owned && !taken) stickerTag('BLOQUEADO · VALE EN COOP', x + cw / 2, cy0 + 20 - 14, YEL, 9.5, 0.02);
    const lab = mine ? 'ELEGIDO' : taken ? 'OCUPADO · ' + (Net.lobby.slots.find(s => s.id === owner) || {}).name : 'ELEGIR';
    if (uiButton(x + 14, cy0 + chh - 44, cw - 28, 32, lab, { size: 13, accent: c.col, disabled: taken || mine })) Net.setPick(c.id);
  });
  // ── Botones
  const by = U.h - 74;
  if (isHost) {
    const n = slots.length, ok = Net.canStart();
    if (uiButton(cx - 360, by, 200, 46, 'CERRAR SALA', { size: 17, accent: '#8896b8' }) || (keyHit('Escape') && !Coop.focus)) { coopOpen(); return; }
    if (uiButton(cx - 140, by, 500, 46, n < 2 ? 'COMENZAR (puedes jugar tú solo)' : ok ? `COMENZAR · ${n} JUGADORES` : 'Esperando a que todos estén listos…', { size: 18, accent: MAG, disabled: !ok })) hostStart();
  } else {
    if (uiButton(cx - 360, by, 200, 46, 'SALIR', { size: 17, accent: '#8896b8' }) || (keyHit('Escape') && !Coop.focus)) { coopOpen(); return; }
    const rdy = me && me.ready;
    if (uiButton(cx - 140, by, 500, 46, rdy ? 'LISTO ✓  (pulsa para cancelar)' : 'LISTO', { size: 20, accent: rdy ? YEL : GRN })) Net.setReady(!rdy);
  }
  if (Net.msg) text(Net.msg, cx, by - 14, 15, '#ff8a9a', 'center', '700');
}
function hostStart() {
  if (!Net.canStart()) return;
  const cfg = Net.buildStart();
  Net.started = true; Net._announce();
  Net.toAll(['start', cfg]);
  const me = cfg.roster.find(r => r.id === 0);
  startLoading('coophost', me.charId, cfg);
}
