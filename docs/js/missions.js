'use strict';
// ───────── Interacción, misiones, tienda y ciclo de la partida ─────────

// ───────── Interacción ─────────
function hubPos(h) { const c = S.world.cellCenter(h.cx, h.cy); return { fixer: { x: c.x - 70, y: c.y }, shop: { x: c.x + 70, y: c.y }, c }; }
function findInteract() {
  S.interact = null;
  if (P.dead) return;
  let best = null, bd = 1e9;
  const consider = (type, obj, x, y, label, rad) => {
    const d = dist(P.x, P.y, x, y);
    if (d < rad && d < bd) { bd = d; best = { type, obj, label, x, y }; }
  };
  const m = S.mission;
  if (m) {
    if (m.type === 'deliver') {
      if (m.stage === 0) consider('mpick', m, m.a.x, m.a.y, 'Recoger el paquete', 80);
      else consider('mdrop', m, m.b.x, m.b.y, `Entregar ${toClient(m.client)}`, 80);
    } else if (m.type === 'raid' && m.stage === 2) {
      const hp = hubPos(S.world.hubs[m.hub]);
      consider('mreturn', m, hp.fixer.x, hp.fixer.y, 'Entregar el cargamento al fixer', 90);
    }
  }
  for (const h of S.world.hubs) {
    const hp = hubPos(h);
    consider('fixer', h, hp.fixer.x, hp.fixer.y, 'Hablar con el fixer', 80);
    consider('shop', h, hp.shop.x, hp.shop.y, 'Visitar al Ripper', 80);
  }
  for (const h of S.world.houses) consider('house', h, h.x, h.y, 'Entrar al piso franco', 86);
  for (const p of S.pickups) {
    if (p.kind === 'weapon') consider('weapon', p, p.x, p.y, `Tomar ${WEAPONS[p.w.id].name} (${TIERS[p.w.tier].name})`, 56);
    else if (p.kind === 'chest') consider('chest', p, p.x, p.y, 'Abrir cofre', 60);
    else if (p.kind === 'stash') consider('stash', p, p.x, p.y, 'Tomar el cargamento', 70);
  }
  for (const o of S.players) if (o !== P && o.dead) consider('revive', o, o.x, o.y, `Reanimar a ${o.name}`, 80);
  S.interact = best;
}
function doInteract() {
  const it = S.interact; if (!it) return;
  if (it.type === 'house') { openHouse(it.obj); return; }
  if (it.type === 'fixer') { if (Net.client) Net.reqBoard(it.obj.id); else openBoard(it.obj); return; }
  if (it.type === 'shop') { if (Net.client) Net.reqShop(it.obj.id); else openShop(it.obj); return; }
  if (Net.client) { Net.sendHost(['int', it.type, it.obj && it.obj.id !== undefined ? it.obj.id : 0]); return; }
  runInteract(P, it);
}
function equipWeapon(pl, p) {
  if (pl.weapons.length < 3) { pl.weapons.push(p.w); pl.cur = pl.weapons.length - 1; }
  else { spawnPickup('weapon', pl.x, pl.y, 0, { w: pl.weapons[pl.cur], vx: 0, vy: 0 }); pl.weapons[pl.cur] = p.w; }
  const i = S.pickups.indexOf(p); if (i >= 0) S.pickups.splice(i, 1);
  sndTo(pl, 'weapon'); notifyTo(pl, `Arma equipada: ${WEAPONS[p.w.id].name} · ${TIERS[p.w.tier].name}`, TIERS[p.w.tier].col);
}
// Ejecuta una interacción de un jugador (en el anfitrión o en partida individual)
function runInteract(pl, it) {
  if (pl.dead && it.type !== 'revive') return;
  if (it.type === 'weapon') {
    equipWeapon(pl, it.obj);
  } else if (it.type === 'chest') {
    const p = it.obj; const i = S.pickups.indexOf(p); if (i < 0) return; S.pickups.splice(i, 1);
    pl.cred += p.v; S.credEarned += p.v; sndTo(pl, 'buy'); addParts(p.x, p.y, 16, '#ffe14a', 240, 0.6);
    notifyTo(pl, `Cofre: +${fmt(p.v)} ¢`, '#ffe14a');
    const d = S.world.districtAtPx(p.x, p.y);
    if (Math.random() < 0.5) spawnPickup('weapon', p.x, p.y, 0, { w: rollWeapon(d >= 2 ? 1 : 0, Math.min(3, 1 + d)) });
    if (Math.random() < 0.6) spawnPickup('hp', p.x, p.y, 40);
  } else if (it.type === 'stash') {
    const i = S.pickups.indexOf(it.obj); if (i < 0 || !S.mission) return; S.pickups.splice(i, 1);
    S.mission.stage = 2; S.mission.carrier = pl.id; pl.carry = true; for (const q of S.players) sndTo(q, 'mission');
    notifyAll(`${pl.name} lleva el cargamento. Llévalo al fixer. ¡Cuidado con las emboscadas!`, '#ffe14a', 5);
    ambush(3 + Math.floor(avgLv() / 5), 0, pl);
  } else if (it.type === 'mpick') {
    const m = S.mission; if (!m || m.stage !== 0) return;
    m.stage = 1; m.t = m.time; m.carrier = pl.id; pl.carry = true; for (const q of S.players) sndTo(q, 'mission');
    notifyAll(`${pl.name} lleva el paquete. Entrégalo ${toClient(m.client)} antes de que se acabe el tiempo.`, '#ffe14a', 5);
  } else if (it.type === 'mdrop' || it.type === 'mreturn') {
    completeMission(pl);
  } else if (it.type === 'revive') {
    revivePlayer(it.obj, pl);
  }
}
// Petición de interacción llegada desde un cliente: se comprueba cerca y existencia
function hostInteract(pl, type, ref) {
  if (pl.dead && type !== 'revive') return;
  const m = S.mission;
  if (type === 'weapon' || type === 'chest' || type === 'stash') {
    const p = S.pickups.find(q => q.id === ref && q.kind === type);
    if (p && dist(p.x, p.y, pl.x, pl.y) < 150) runInteract(pl, { type, obj: p });
  } else if (type === 'mpick') {
    if (m && m.type === 'deliver' && m.stage === 0 && dist(m.a.x, m.a.y, pl.x, pl.y) < 170) runInteract(pl, { type, obj: m });
  } else if (type === 'mdrop') {
    if (m && m.type === 'deliver' && m.stage === 1 && dist(m.b.x, m.b.y, pl.x, pl.y) < 170) runInteract(pl, { type, obj: m });
  } else if (type === 'mreturn') {
    if (m && m.type === 'raid' && m.stage === 2 && dist(hubPos(S.world.hubs[m.hub]).fixer.x, hubPos(S.world.hubs[m.hub]).fixer.y, pl.x, pl.y) < 180) runInteract(pl, { type, obj: m });
  } else if (type === 'revive') {
    const t = plById(ref);
    if (t && t.dead && t !== pl && dist(t.x, t.y, pl.x, pl.y) < 160) runInteract(pl, { type, obj: t });
  }
}

// ───────── Misiones ─────────
function accessibleCells() {
  const out = [], lv = gateLv();
  for (let cy = 0; cy < WB; cy++) for (let cx = 0; cx < WB; cx++) if (lv >= DISTRICTS[S.world.cellD[cy][cx]].req) out.push({ cx, cy });
  return out;
}
function makeDelivery(hub) {
  const acc = accessibleCells();
  const cd = (a, b) => Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy);
  const near = acc.filter(c => cd(c, hub) >= 1 && cd(c, hub) <= 4);
  const A = pick(near.length ? near : acc);
  const far = acc.filter(c => { const d = cd(c, A); return d >= 4 && d <= 10; });
  const B = pick(far.length ? far : acc.filter(c => c !== A));
  const a = S.world.crossing(A.cx, A.cy), b = S.world.crossing(B.cx, B.cy);
  const dB = S.world.cellD[B.cy][B.cx], len = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const k = cd(A, B), tier = 1 + 0.15 * DISTRICTS[dB].base;
  const client = pick(CLIENTS);
  return { type: 'deliver', title: 'Entrega de paquete', client, desc: `Recoge el paquete y llévaselo ${toClient(client)} (${DISTRICTS[dB].name}). Habrá emboscadas.`,
    a, b, time: Math.round(len / 175 + 35), total: dist(a.x, a.y, b.x, b.y), hub: hub.id,
    reward: { cred: Math.round((70 + 24 * k) * tier), xp: Math.round((55 + 20 * k) * tier * (1 + avgLv() * 0.06)) }, risk: 1 + (dB > 1 ? 1 : 0) };
}
function makeRaid(hub) {
  const lv = gateLv();
  const cands = S.world.camps.filter(c => !c.cleared && !c.spawned && lv >= DISTRICTS[c.district].req && Math.abs(c.cx - hub.cx) + Math.abs(c.cy - hub.cy) <= 9);
  if (!cands.length) return null;
  const c = pick(cands), d = c.district, tier = 1 + 0.2 * DISTRICTS[d].base;
  return { type: 'raid', title: `Asalto al cargamento (${DISTRICTS[d].name})`, desc: 'Una banda guarda un cargamento. Elimina a todos, toma el cargamento y vuelve con el fixer.',
    camp: c, hub: hub.id, reward: { cred: Math.round(200 * tier), xp: Math.round(180 * tier * (1 + avgLv() * 0.06)) }, risk: 2 + (d > 1 ? 1 : 0) };
}
function makeBossContract(d) {
  const b = BOSSES[d], lair = S.world.lairs.find(l => l.district === d);
  if (!lair) return null;
  const c = S.world.cellCenter(lair.cx, lair.cy);
  return { type: 'boss', title: `Eliminar a ${b.name}`, desc: `${b.title}. Se esconde en su guarida en ${DISTRICTS[d].name}. Objetivo prioritario.`,
    bossId: d, pos: c, reward: b.reward, risk: 3 + Math.min(1, d), recLevel: BOSS_REQ[d] + 1 };
}
// ───────── Liberación de distritos ─────────
// Cada distrito tiene un número de operaciones (asaltos, sabotajes, cargas, cazas, limpiezas). Al completarlas
// el jefe sale a la luz; al derrotarlo el distrito queda LIBERADO (menos enemigos, descuentos) y la corporación
// responde: el resto de la ciudad se vuelve más peligroso.
const libCount = () => { let n = 0; for (let d = 0; d < 5; d++) if (S.defeated[d]) n++; return n; };
const libDone = (d) => (S.lib && S.lib[d]) || 0;
const libReady = (d) => libDone(d) >= LIB_NEED[d];
const opTier = (d) => 1 + 0.2 * DISTRICTS[d].base;
function opReward(d, k = 1) {
  const t = opTier(d) * k;
  return { cred: Math.round(170 * t), xp: Math.round(150 * t * (1 + avgLv() * 0.06)), chips: 5 + 3 * d };
}
function cellsOf(d, types) {
  const out = [];
  for (let cy = 0; cy < WB; cy++) for (let cx = 0; cx < WB; cx++) if (S.world.cellD[cy][cx] === d && types.includes(S.world.cellT[cy][cx])) out.push({ cx, cy });
  return out;
}
function distCenter(d) {      // calle abierta cerca del centro del distrito
  const cs = cellsOf(d, ['b', 'p', 'c', 'h', 'l']);
  let sx = 0, sy = 0; for (const c of cs) { sx += c.cx; sy += c.cy; }
  sx /= Math.max(1, cs.length); sy /= Math.max(1, cs.length);
  cs.sort((a, b) => Math.hypot(a.cx - sx, a.cy - sy) - Math.hypot(b.cx - sx, b.cy - sy));
  return S.world.crossing(cs[0].cx, cs[0].cy);
}
function plazaPos(d, avoid) {   // centro libre de una plaza (o de un compuesto) del distrito
  let cs = cellsOf(d, ['p']); if (!cs.length) cs = cellsOf(d, ['c']); if (!cs.length) cs = cellsOf(d, ['b']);
  const free = cs.filter(c => !(avoid || []).some(a => Math.abs(a.cx - c.cx) + Math.abs(a.cy - c.cy) < 2));
  const c = pick(free.length ? free : cs), p = S.world.cellCenter(c.cx, c.cy);
  const f = findFree(p.x, p.y, 16);
  return { x: Math.round(f.x), y: Math.round(f.y), cx: c.cx, cy: c.cy };
}
function makeHack(d) {
  const pos = plazaPos(d);
  return { type: 'hack', op: true, district: d, title: `Sabotaje de antena (${DISTRICTS[d].name})`,
    desc: 'La banda controla el barrio desde una antena. Llega hasta ella y mantente a su lado mientras la hackeas. Llegarán refuerzos.',
    pos: { x: pos.x, y: pos.y }, need: 17 + 2 * d, prog: 0, wave: 0, reward: opReward(d), risk: 2 + (d > 1 ? 1 : 0) };
}
function makeCharges(d) {
  const cs = cellsOf(d, ['b', 'p', 'c']), pts = [];
  for (let k = 0; k < 40 && pts.length < 3 && cs.length; k++) {
    const c = pick(cs); if (pts.some(q => Math.abs(q.cx - c.cx) + Math.abs(q.cy - c.cy) < 3)) continue;
    const p = S.world.crossing(c.cx, c.cy); pts.push({ cx: c.cx, cy: c.cy, x: Math.round(p.x + TILE), y: Math.round(p.y + TILE), t: 0, done: false });
  }
  while (pts.length < 3) { const c = pick(cs), p = S.world.crossing(c.cx, c.cy); pts.push({ cx: c.cx, cy: c.cy, x: Math.round(p.x + TILE), y: Math.round(p.y + TILE), t: 0, done: false }); }
  return { type: 'charges', op: true, district: d, title: `Cargas explosivas (${DISTRICTS[d].name})`,
    desc: 'Coloca tres cargas en los puntos marcados del barrio. Quédate junto a cada una unos segundos. Cada colocación atrae a la banda.',
    points: pts, reward: opReward(d, 1.15), risk: 2 + (d > 1 ? 1 : 0) };
}
function makeHunt(d) {
  const L = LIEUTENANTS[d], pos = plazaPos(d);
  return { type: 'hunt', op: true, district: d, title: `Caza de ${L.name}`, desc: `${L.title}. Se esconde en ${DISTRICTS[d].name} con su escolta. Elimínalo.`,
    pos: { x: pos.x, y: pos.y }, ltName: L.name, eid: -1, reward: opReward(d, 1.3), risk: 3 + (d > 2 ? 1 : 0) };
}
function makePurge(d) {
  const need = Math.round((12 + 3 * d + avgLv() * 0.5) * coopCount()), c = distCenter(d);
  return { type: 'purge', op: true, district: d, title: `Limpieza de calles (${DISTRICTS[d].name})`,
    desc: `Las pandillas patrullan ${DISTRICTS[d].name}. Abate a ${need} enemigos dentro del distrito. Aparecerán más de lo normal.`,
    pos: { x: Math.round(c.x), y: Math.round(c.y) }, need, kills: 0, reward: opReward(d, 0.95), risk: 2 + (d > 2 ? 1 : 0) };
}
// Distrito al que apuntan las operaciones de un fixer: el suyo y, si ya está liberado, el primero accesible sin liberar
function opDistrict(hub) {
  const lv = gateLv();
  if (!S.defeated[hub.district] && lv >= DISTRICTS[hub.district].req) return hub.district;
  for (let d = 0; d < 5; d++) if (!S.defeated[d] && lv >= DISTRICTS[d].req) return d;
  return -1;
}
function makeContracts(hub) {
  const list = [];
  list.push(makeDelivery(hub));
  const od = opDistrict(hub);
  if (od >= 0) {
    const kinds = [makeHack, makeCharges, makeHunt, makePurge].sort(() => Math.random() - 0.5);
    const raid = S.players.some(p => p.meta.raid) ? makeRaid(hub) : null;
    const n = raid ? 2 : 3;
    for (let i = 0; i < n; i++) { try { list.push(kinds[i](od)); } catch (err) { /* ignorar */ } }
    if (raid) { raid.district = raid.camp.district; raid.op = true; list.push(raid); }
  } else { list.push(makeDelivery(hub)); }
  const lv = gateLv();
  for (let d = 0; d < 5; d++) {
    if (S.defeated[d] || lv < DISTRICTS[d].req) continue;
    if (lv >= BOSS_REQ[d] && libReady(d)) { const b = makeBossContract(d); if (b) list.push(b); }
    else if (d === od) list.push(lockedBoss(d));
  }
  return list;
}
function lockedBoss(d) {
  const b = BOSSES[d], why = !libReady(d) ? `Libera el distrito: ${libDone(d)}/${LIB_NEED[d]} operaciones` : `Necesitas nivel ${BOSS_REQ[d]}`;
  return { type: 'locked', title: `Eliminar a ${b.name}`, desc: `${b.title}. ${why}.`, reward: b.reward, risk: 3 + Math.min(1, d), recLevel: BOSS_REQ[d] + 1, bossId: d };
}
// Versión de un contrato que se puede enviar por red (sin referencias circulares)
function plainContract(c) { return c ? Object.assign({}, c, { camp: c.camp ? c.camp.id : undefined }) : null; }

function acceptContract(c, by) {
  if (!c || c.type === 'locked') { notifyTo(by || P, 'Ese contrato todavía no está disponible.', '#ff8a1a'); return false; }
  if (S.mission) { notifyTo(by || P, 'Ya hay una misión activa.', '#ff8a1a'); return false; }
  S.mission = Object.assign({}, c, { stage: 0, t: c.time || 0, ambush: 0, accepted: S.time, carrier: -1 });
  if (c.points) S.mission.points = c.points.map(q => Object.assign({}, q));
  if (c.pos) S.mission.pos = { x: c.pos.x, y: c.pos.y };
  if (c.type === 'raid') c.camp.raid = true;
  for (const pl of S.players) sndTo(pl, 'mission');
  notifyAll(`Misión aceptada: ${c.title}`, '#ffe14a', 4);
  return true;
}
function clearCarry() { for (const pl of S.players) pl.carry = false; }
function failMission(reason) {
  const m = S.mission; if (!m) return;
  if (m.type === 'raid') m.camp.raid = false;
  clearCarry(); S.mission = null; for (const pl of S.players) sndTo(pl, 'deny');
  notifyAll(`MISIÓN FALLIDA: ${reason}`, '#ff3355', 5);
}
function abandonMission() {
  const m = S.mission; if (!m) return;
  if (m.type === 'raid') m.camp.raid = false;
  if (m.type === 'boss' && S.boss) { S.boss.dead = true; S.boss.silent = true; S.boss = null; Snd.setIntensity(0); }
  if (m.type === 'hunt' && m.eid >= 0) { const e = S.enemies.find(x => x.id === m.eid); if (e) { e.dead = true; e.silent = true; } }
  clearCarry(); S.mission = null;
  notifyAll('Misión abandonada.', '#ff8a1a');
}
function completeMission(by) {
  const m = S.mission; if (!m) return;
  for (const pl of S.players) {
    const c = Math.round(m.reward.cred * pl.credMul);
    pl.cred += c; S.credEarned += c; gainXP(pl, m.reward.xp);
    addRing(pl.x, pl.y, 200, '#ffe14a', 0.6); sndTo(pl, 'mission');
  }
  clearCarry(); S.missionsDone++;
  if (m.type === 'raid') m.camp.raid = false;
  notifyAll(`MISIÓN COMPLETADA: +${fmt(m.reward.cred)} ¢ · +${fmt(m.reward.xp)} XP${m.op && m.reward.chips ? ' · +' + m.reward.chips + ' Chips' : ''}`, '#5dff9a', 5);
  if (m.op) addLiberation(m.district, m.reward.chips || 0);
  S.mission = null; S.boards = {};
}
function addLiberation(d, chips) {
  if (d === undefined || d < 0) return;
  S.bonusChips += chips;
  S.lib[d] = (S.lib[d] || 0) + 1;
  const dd = DISTRICTS[d];
  if (S.defeated[d]) return;
  if (S.lib[d] === LIB_NEED[d]) {
    notifyAll(`${dd.name}: la banda se tambalea. ¡${BOSSES[d].name} sale a la luz! Pide su contrato a un fixer.`, dd.accent, 6.5);
    for (const pl of S.players) sndTo(pl, 'level');
  } else if (S.lib[d] < LIB_NEED[d]) notifyAll(`Liberación de ${dd.name}: ${S.lib[d]}/${LIB_NEED[d]}`, dd.accent, 4);
}
function campLeft(m) { return m.camp.enemies ? m.camp.enemies.filter(e => !e.dead).length : (m.campLeft || 0); }
function missionTarget() {
  const m = S.mission; if (!m) return null;
  if (m.type === 'deliver') return m.stage === 0 ? m.a : m.b;
  if (m.type === 'raid') {
    if (m.stage === 0) return { x: m.camp.x, y: m.camp.y };
    if (m.stage === 1) return { x: m.camp.x, y: m.camp.y };
    const hp = hubPos(S.world.hubs[m.hub]); return hp.fixer;
  }
  if (m.type === 'boss') return S.boss && !S.boss.dead ? { x: S.boss.x, y: S.boss.y } : m.pos;
  if (m.type === 'hack') return m.pos;
  if (m.type === 'charges') {
    let best = null, bd = 1e18;
    for (const q of m.points) { if (q.done) continue; const d = dist(P.x, P.y, q.x, q.y); if (d < bd) { bd = d; best = q; } }
    return best;
  }
  if (m.type === 'hunt') { const e = m.eid >= 0 ? S.enemies.find(x => x.id === m.eid && !x.dead) : null; return e ? { x: e.x, y: e.y } : m.pos; }
  if (m.type === 'purge') return S.district === m.district ? null : m.pos;
  return null;
}
function updateMission(dt) {
  const m = S.mission; if (!m) return;
  if (m.type === 'deliver' && m.stage === 1) {
    m.t -= dt;
    if (m.t <= 0) { failMission('se acabó el tiempo.'); return; }
    const car = plById(m.carrier), who = car && !car.dead ? car : nearestPl(m.b.x, m.b.y);
    if (who) {
      const d = dist(who.x, who.y, m.b.x, m.b.y), lv = avgLv();
      if (m.ambush === 0 && d < m.total * 0.66) { m.ambush = 1; ambush(3 + Math.floor(lv / 5), 0, who); }
      else if (m.ambush === 1 && d < m.total * 0.3) { m.ambush = 2; ambush(4 + Math.floor(lv / 4), 1, who); }
    }
  }
  if (m.type === 'boss') {
    if (!S.boss && nearestDist(m.pos.x, m.pos.y) < 760) spawnBoss(m.bossId, m.pos);
  }
  if (m.type === 'hack') updateHack(m, dt);
  else if (m.type === 'charges') updateCharges(m, dt);
  else if (m.type === 'hunt') updateHunt(m, dt);
}
// Sabotaje: hay que permanecer junto a la antena mientras se hackea; si te alejas el progreso retrocede
function updateHack(m, dt) {
  const near = S.players.filter(p => !p.dead && dist(p.x, p.y, m.pos.x, m.pos.y) < 150);
  if (near.length) {
    if (m.stage === 0) { m.stage = 1; notifyAll('Hackeo en marcha. Mantente junto a la antena.', '#19f0ff', 4); for (const q of S.players) sndTo(q, 'hack'); }
    m.prog += dt;
    const marks = [0.28, 0.58, 0.85];
    if (m.wave < marks.length && m.prog >= marks[m.wave] * m.need) {
      m.wave++;
      ambush(3 + Math.floor(avgLv() / 5) + m.district, m.district > 1 ? 1 : 0, near[0]);
    }
    if (m.prog >= m.need) completeMission(near[0]);
  } else if (m.stage === 1) m.prog = Math.max(0, m.prog - dt * 0.6);
}
// Cargas: tres puntos; cada uno exige unos segundos de permanencia y atrae una emboscada
function updateCharges(m, dt) {
  for (const q of m.points) {
    if (q.done) continue;
    const near = S.players.filter(p => !p.dead && dist(p.x, p.y, q.x, q.y) < 90);
    if (near.length) {
      q.t += dt;
      if (q.t >= 2.2) {
        q.done = true; q.t = 2.2; m.stage++;
        for (const pl of S.players) sndTo(pl, 'mission');
        addRing(q.x, q.y, 160, '#ff8a1a', 0.6); addParts(q.x, q.y, 18, '#ff8a1a', 240, 0.6, 4);
        const left = m.points.filter(z => !z.done).length;
        if (left) { notifyAll(`Carga colocada (${m.points.length - left}/${m.points.length}). ¡La banda viene hacia aquí!`, '#ff8a1a', 4); ambush(2 + m.district + Math.floor(avgLv() / 6), m.district > 2 ? 1 : 0, near[0]); }
        else { completeMission(near[0]); return; }
      }
    } else q.t = Math.max(0, q.t - dt * 2);
  }
}
// Caza: el cabecilla y su escolta aparecen al acercarse
function updateHunt(m, dt) {
  let e = m.eid >= 0 ? S.enemies.find(x => x.id === m.eid && !x.dead) : null;
  if (m.eid >= 0 && !e) m.eid = -1;
  if (!e && nearestDist(m.pos.x, m.pos.y) < 760) {
    const d = m.district, L = enemyLevelFor(d) + 2, f = findFree(m.pos.x, m.pos.y, 20);
    e = spawnEnemy(LIEUTENANTS[d].base, f.x, f.y, { level: L, lieut: { name: m.ltName } });
    e.aggro = true; e.mob = true; m.eid = e.id; m.stage = 1;
    const n = Math.round((3 + Math.floor(d / 2) + Math.floor(avgLv() / 7)) * coopCount());
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, g = findFree(f.x + Math.cos(a) * 130, f.y + Math.sin(a) * 130, 14);
      const o = spawnEnemy(weightedPick(DISTRICTS[d].spawn), g.x, g.y, { level: L - 2, elite: false });
      o.mob = true; o.aggro = true;
    }
    S.banner = { text: m.ltName, sub: LIEUTENANTS[d].title, col: DISTRICTS[d].accent, t: 3.6, max: 3.6 };
    notifyAll(`¡${m.ltName} os ha visto!`, DISTRICTS[d].accent, 4); for (const q of S.players) sndTo(q, 'warn');
    if (Net.host) Net.toAll(['ban', m.ltName, LIEUTENANTS[d].title, DISTRICTS[d].accent]);
  }
}
// Se llama desde killEnemy
function missionOnKill(e, killer) {
  const m = S.mission; if (!m || e.boss) return;
  if (m.type === 'hunt' && e.lieut && e.id === m.eid) { completeMission(killer); return; }
  if (m.type === 'purge' && !e.lieut && S.world.districtAtPx(e.x, e.y) === m.district) {
    m.kills++;
    if (m.kills >= m.need) completeMission(killer);
    else if (m.kills % 5 === 0) notifyAll(`Limpieza: ${m.kills}/${m.need}`, '#ffe14a', 2.2);
  }
}
function onBossKilled(e) {
  S.bossKills++; S.defeated[e.bossId] = true;
  const b = BOSSES[e.bossId];
  for (const pl of S.players) { const c = Math.round(b.reward.cred * pl.credMul); pl.cred += c; }
  S.bonusChips += b.reward.chips;
  xpAll(b.reward.xp);
  S.lib[e.bossId] = Math.max(S.lib[e.bossId] || 0, LIB_NEED[e.bossId]);
  spawnPickup('weapon', e.x, e.y, 0, { w: rollWeapon(2, 3, 0.2), vx: 0, vy: 0 });
  spawnPickup('hp', e.x + 30, e.y, 60);
  notifyAll(`${b.name} ELIMINADO · +${b.reward.chips} Chips`, '#ffe14a', 6);
  if (e.bossId < 4) {
    const dd = DISTRICTS[e.bossId];
    S.banner = { text: 'DISTRITO LIBERADO', sub: `${dd.name} es vuestro. La corporación endurece el resto de la ciudad.`, col: '#5dff9a', t: 5, max: 5 };
    if (Net.host) Net.toAll(['ban', 'DISTRITO LIBERADO', `${dd.name} es vuestro. La corporación endurece el resto de la ciudad.`, '#5dff9a']);
    notifyAll(`${dd.name} liberado: menos enemigos y -15% en el Ripper. El resto de la ciudad ahora es más duro.`, '#5dff9a', 7);
  }
  S.boss = null; Snd.setIntensity(0);
  if (S.mission && S.mission.type === 'boss' && S.mission.bossId === e.bossId) { S.missionsDone++; S.mission = null; S.boards = {}; }
  if (e.bossId === 4) { S.victory = true; S.winT = 2.5; }
}

// ───────── Tienda del Ripper ─────────
function makeShop(hub) {
  const d = hub.district, items = [];
  items.push({ id: 'heal', kind: 'heal', name: 'Botiquín nano', desc: 'Restaura el 60% de tu vida.', repeat: true });
  items.push({ id: 'armor', kind: 'armor', name: 'Placa dérmica', desc: '-8% de daño recibido (máx. 4 compras).', repeat: true });
  items.push({ id: 'upg', kind: 'upgrade', name: 'Mejora del arma actual', desc: '+15% de daño al arma que llevas (máx. 5).', repeat: true });
  const prices = [90, 210, 440, 850];
  for (let i = 0; i < 2; i++) {
    let w = rollWeapon(d >= 2 ? 1 : 0, Math.min(3, 1 + d), 0.05);
    for (let k = 0; k < 8 && items.some(o => o.kind === 'weapon' && o.w.id === w.id); k++) w = rollWeapon(d >= 2 ? 1 : 0, Math.min(3, 1 + d), 0.05);
    items.push({ id: 'w' + i, kind: 'weapon', w, name: WEAPONS[w.id].name, desc: WEAPONS[w.id].desc, price: Math.round(prices[w.tier] * (1 + 0.08 * d)) });
  }
  return items;
}
function itemPrice(it, pl = P, hub = null) {
  let p;
  if (it.kind === 'heal') p = Math.round(30 + pl.level * 8);
  else if (it.kind === 'armor') p = 140 + 70 * pl.armorBought;
  else if (it.kind === 'upgrade') p = 80 + 55 * (currentWeapon(pl).up || 0);
  else p = it.price;
  return hub && S.defeated[hub.district] ? Math.round(p * 0.85) : p;     // distrito liberado: descuento
}
function itemAvailable(it, pl = P) {
  if (it.sold) return false;
  if (it.kind === 'armor') return pl.armorBought < 4;
  if (it.kind === 'upgrade') return (currentWeapon(pl).up || 0) < 5;
  if (it.kind === 'heal') return pl.hp < pl.maxhp - 0.5;
  return true;
}
function buyItem(it, pl = P, hub = null) {
  const price = itemPrice(it, pl, hub);
  if (pl.dead || !itemAvailable(it, pl) || pl.cred < price) { sndTo(pl, 'deny'); return false; }
  pl.cred -= price;
  if (it.kind === 'heal') healPlayer(pl, pl.maxhp * 0.6);
  else if (it.kind === 'armor') { pl.armorBought++; recalcPlayer(pl); }
  else if (it.kind === 'upgrade') currentWeapon(pl).up = (currentWeapon(pl).up || 0) + 1;
  else if (it.kind === 'weapon') {
    if (pl.weapons.length < 3) { pl.weapons.push(it.w); pl.cur = pl.weapons.length - 1; }
    else pl.weapons[pl.cur] = it.w;
    it.sold = true;
  }
  sndTo(pl, 'buy'); return true;
}

// ───────── Piso franco ─────────
function openHouse(h) {
  Game.house = { h, msg: null, t: 0 }; Game.state = 'house'; Snd.play('click');
  P.busy = true; if (Net.client) Net.sendHost(['busy', 1]);
}
function closeHouse() {
  Game.state = 'play'; P.busy = false; if (Net.client) Net.sendHost(['busy', 0]);
}
function restCost(pl = P) { return Math.round(25 + pl.level * 7); }
function restPlayer(pl) {
  const rc = restCost(pl);
  if (pl.dead || pl.hp >= pl.maxhp - 0.5 || pl.cred < rc) return false;
  pl.cred -= rc; pl.hp = pl.maxhp; pl.shield = pl.shieldMax; pl.abCd = 0; pl.dashCharges = pl.dashMax; sndTo(pl, 'heal');
  return true;
}

// ───────── Fin de la partida ─────────
function computeChips(pl, st) {
  const kills = Net.active ? st.kills / Math.sqrt(Math.max(1, st.players || 1)) : st.kills;
  return Math.max(5, Math.floor(pl.level * 6 + kills * 0.35 + st.missions * 18 + st.district * 12 + (st.libs || 0) * 20) + st.bonus);
}
function endStats(victory) {
  return { victory: !!victory, kills: S.kills, missions: S.missionsDone, bosses: S.bossKills, district: S.maxDistrict, bonus: S.bonusChips, time: S.time, players: S.players.length, libs: libCount() };
}
function endRun(victory) {
  if (S.over) return;
  const st = endStats(victory);
  if (Net.host) Net.toAll(['end', st]);
  else if (Net.client) Net.sendHost(['quit']);
  settleRun(st);
}
// Cada jugador cobra sus Chips en su propio ordenador
function settleRun(st) {
  if (S.over) return;
  S.over = true;
  const victory = st.victory;
  // Si la partida viene de un guardado, solo se pagan los Chips/bajas que aún no se habían cobrado
  const total = computeChips(P, st) + (victory ? 150 : 0), pd = S.paid;
  const chips = Math.max(0, total - pd.chips), kills = Math.max(0, st.kills - pd.kills), bosses = Math.max(0, st.bosses - pd.bosses);
  S.summary = { chips, victory, level: P.level, kills: st.kills, missions: st.missions, bosses: st.bosses, time: st.time, district: st.district, coop: Net.active, players: st.players, libs: st.libs || 0 };
  SAVE.chips += chips;
  pd.chips = Math.max(pd.chips, total); pd.kills = st.kills; pd.bosses = st.bosses;
  SAVE.stats.runs++; SAVE.stats.kills += kills; SAVE.stats.bosses += bosses;
  SAVE.stats.best = Math.max(SAVE.stats.best, P.level);
  if (victory) SAVE.stats.wins++;
  saveGame();
  // ── GamePix: puntaje/nivel de la partida y publicidad entre partidas (nunca durante el juego) ──
  GPx.score(SAVE.stats.kills);
  GPx.level(P.level);
  if (victory) GPx.happy();
  GPx.interstitial();
  if (!Net.active) { if (victory) clearRunSave(); else markRunPaid(); }
  Game.state = victory ? 'victory' : 'dead';
  Snd.setIntensity(0);
}

// ───────── Nueva partida ─────────
function makeRunState(world, seed) {
  S = { world, seed, time: 0, enemies: [], bullets: [], cbul: [], ebullets: [], parts: [], texts: [], pickups: [], turrets: [], zones: [], beams: [],
    rings: [], streaks: [], afterimages: [], notes: [], banner: null, shake: 0, kills: 0, bossKills: 0, missionsDone: 0, defeated: {}, lib: [0, 0, 0, 0, 0], mission: null,
    boards: {}, shops: {}, cam: { x: 0, y: 0 }, maxDistrict: 0, district: 0, spawnT: 4, interact: null, over: false, victory: false,
    gateHint: null, flowT: 0, explored: new Uint8Array(WW * WH), lastTile: -1, boss: null, hint: 14, bonusChips: 0, credEarned: 0, winT: 0,
    runId: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), paid: { chips: 0, kills: 0, bosses: 0 }, houseId: -1, saveT: -1,
    players: [], nid: 1, fxq: [], hold: false };
  S.mapFog = document.createElement('canvas'); S.mapFog.width = WW; S.mapFog.height = WH;
  return S;
}
function startPosition(i) {
  const c = S.world.cellCenter(S.world.hubs[0].cx, S.world.hubs[0].cy);
  const off = [[0, 90], [-60, 100], [60, 100], [0, 130]][i] || [0, 90];
  return findFree(c.x + off[0], c.y + off[1], 12);
}
function enterRun(opts, label) {
  const f = P;
  S.cam.x = f.x; S.cam.y = f.y;
  S.district = S.world.districtAtPx(P.x, P.y);
  S.banner = { text: DISTRICTS[S.district].name.toUpperCase(), sub: label || DISTRICTS[S.district].desc, col: DISTRICTS[S.district].accent, t: 3.6, max: 3.6 };
  revealAround(true);
  if (!opts.stay) Game.state = 'play';
}
function newRun(charId, o = {}) {
  Net.leave();
  const ch = CHARS.find(c => c.id === charId) || CHARS[0];
  const seed = (Math.random() * 4294967295) >>> 0;
  const world = new World(seed);
  world.buildMapBase(); clearChunkCache();
  makeRunState(world, seed);
  P = makePlayerObj(ch, SAVE, 0, ch.name); S.players = [P];
  const f = startPosition(0); P.x = f.x; P.y = f.y;
  enterRun(o);
}
// Cooperativo · anfitrión. roster = [{ id, charId, name, meta }] (el id 0 es el anfitrión)
function newCoopHostRun(seed, roster, o = {}) {
  const world = new World(seed);
  world.buildMapBase(); clearChunkCache();
  makeRunState(world, seed);
  S.players = roster.map((r, i) => {
    const ch = CHARS.find(c => c.id === r.charId) || CHARS[0];
    const pl = makePlayerObj(ch, r.id === 0 ? SAVE : r.meta, r.id, r.name);
    const f = startPosition(i); pl.x = f.x; pl.y = f.y; pl.dx = pl.x; pl.dy = pl.y; pl.idx = i;
    if (r.id !== 0) pl.net = { fire: false, t: 0, seq: 0 };
    return pl;
  });
  P = S.players[0];
  Net.live = true;
  S.hold = true;                 // espera a que todos los clientes terminen de cargar
  enterRun(o, 'Cooperativo');
}
// Cooperativo · cliente
function newCoopClientRun(seed, roster, myId, o = {}) {
  const world = new World(seed);
  world.buildMapBase(); clearChunkCache();
  makeRunState(world, seed);
  S.players = roster.map((r, i) => {
    const ch = CHARS.find(c => c.id === r.charId) || CHARS[0];
    const pl = makePlayerObj(ch, r.id === myId ? SAVE : { up: {}, perks: [], weapons: [], chars: [], raid: false }, r.id, r.name);
    const f = startPosition(i); pl.x = f.x; pl.y = f.y; pl.dx = pl.x; pl.dy = pl.y; pl.idx = i;
    return pl;
  });
  P = plById(myId);
  Net.live = true;
  enterRun(o, 'Cooperativo');
}

// ───────── Pisos francos: guardar y cargar la partida a mitad de run (solo en partida individual) ─────────
const RUN_KEY = 'neonSyndicate.run.v1';
let _runInfo;   // caché del resumen del guardado (undefined = sin leer)
function readRunSave() {
  try {
    const o = unpackSave(GPx.store.get(RUN_KEY));
    if (!o || o.v !== 1 || !o.P || !o.S || !CHARS.find(c => c.id === o.charId)) return null;
    return o;
  } catch (e) { return null; }
}
function getRunInfo() {
  if (_runInfo === undefined) { const o = readRunSave(); _runInfo = o ? o.info : null; }
  return _runInfo;
}
function clearRunSave() { try { GPx.store.del(RUN_KEY); } catch (e) { /* ignorar */ } _runInfo = null; }
// Tras terminar una partida cargada, el guardado recuerda lo ya cobrado para no cobrarlo dos veces
function markRunPaid() {
  const o = readRunSave(); if (!o || o.runId !== S.runId) return;
  o.paid = Object.assign({}, S.paid);
  try { GPx.store.set(RUN_KEY, packSave(o)); } catch (e) { /* ignorar */ }
}
function canSaveHere() {
  if (Net.active) return { ok: false, why: 'No se puede guardar en una partida cooperativa.' };
  if (S.boss && !S.boss.dead) return { ok: false, why: 'No se puede guardar en pleno combate contra un jefe.' };
  for (const e of S.enemies) {
    if (e.dead || !e.aggro) continue;
    if (dist(e.x, e.y, P.x, P.y) < 480) return { ok: false, why: 'Hay enemigos cerca. Despeja la zona antes de guardar.' };
  }
  return { ok: true };
}
// house = piso franco donde se guarda, o null para guardar desde la pausa (punto exacto)
function serializeRun(house) {
  const w = S.world, ex = [];
  let cur = 0, n = 0;                                  // exploración en tramos (ceros, unos, ceros…)
  for (let i = 0; i < S.explored.length; i++) { const b = S.explored[i] ? 1 : 0; if (b === cur) n++; else { ex.push(n); cur = b; n = 1; } }
  ex.push(n);
  const m = S.mission ? Object.assign({}, S.mission, { camp: S.mission.camp ? S.mission.camp.id : undefined }) : null;
  const keep = ['weapon', 'chest', 'stash'];
  const where = DISTRICTS[house ? house.district : S.district].name;
  return {
    v: 1, runId: S.runId, when: Date.now(), seed: S.seed, charId: P.ch.id, paid: Object.assign({}, S.paid), houseId: house ? house.id : -1,
    pos: house ? undefined : { x: Math.round(P.x), y: Math.round(P.y), ang: P.ang },
    info: { name: P.ch.name, charId: P.ch.id, level: P.level, district: S.maxDistrict, time: Math.floor(S.time), house: house ? house.id : -1, where, when: Date.now() },
    S: {
      time: S.time, kills: S.kills, bossKills: S.bossKills, missionsDone: S.missionsDone, defeated: S.defeated, lib: S.lib, maxDistrict: S.maxDistrict,
      bonusChips: S.bonusChips, credEarned: S.credEarned, mission: m, shops: S.shops, ex,
      camps: w.camps.map(c => (c.cleared ? 1 : 0)),
      pickups: S.pickups.filter(p => keep.includes(p.kind)).map(p => ({ kind: p.kind, x: p.x, y: p.y, v: p.v, w: p.w })),
    },
    P: { level: P.level, xp: P.xp, cred: P.cred, perks: P.perks, weapons: P.weapons, cur: P.cur, hp: P.hp, clones: P.clones, armorBought: P.armorBought, carry: P.carry, abCd: P.abCd },
  };
}
function saveRun(house) {
  const c = canSaveHere();
  if (!c.ok) { Snd.play('deny'); return c; }
  try {
    const o = serializeRun(house || null);
    GPx.store.set(RUN_KEY, packSave(o));
    _runInfo = o.info; S.houseId = house ? house.id : S.houseId; S.saveT = S.time;
    Snd.play('mission'); return { ok: true };
  } catch (e) { Snd.play('deny'); return { ok: false, why: 'No se pudo escribir el guardado en el disco.' }; }
}
function loadRun(o, opts = {}) {
  o = o || readRunSave(); if (!o) return false;
  Net.leave();
  const ch = CHARS.find(c => c.id === o.charId);
  const world = new World(o.seed); world.buildMapBase(); clearChunkCache();
  makeRunState(world, o.seed);
  const s = o.S;
  S.runId = o.runId; S.paid = Object.assign({ chips: 0, kills: 0, bosses: 0 }, o.paid || {});
  S.time = s.time || 0; S.kills = s.kills || 0; S.bossKills = s.bossKills || 0; S.missionsDone = s.missionsDone || 0; S.defeated = s.defeated || {}; S.lib = (s.lib && s.lib.length === 5) ? s.lib : [0, 0, 0, 0, 0];
  for (let d = 0; d < 5; d++) if (S.defeated[d]) S.lib[d] = Math.max(S.lib[d], LIB_NEED[d]);
  S.maxDistrict = s.maxDistrict || 0; S.bonusChips = s.bonusChips || 0; S.credEarned = s.credEarned || 0; S.shops = s.shops || {};
  S.hint = 0; S.houseId = o.houseId; S.saveT = S.time;
  // exploración
  let pos = 0, bit = 0;
  for (const n of (s.ex || [])) { if (bit) S.explored.fill(1, pos, pos + n); pos += n; bit ^= 1; }
  const g = S.mapFog.getContext('2d');
  for (let i = 0; i < S.explored.length; i++) if (S.explored[i]) { const x = i % WW, y = (i / WW) | 0; g.drawImage(world.mapBase, x, y, 1, 1, x, y, 1, 1); }
  (s.camps || []).forEach((cl, i) => { if (world.camps[i] && cl) world.camps[i].cleared = true; });
  for (const p of (s.pickups || [])) S.pickups.push({ id: S.nid++, kind: p.kind, x: p.x, y: p.y, v: p.v || 0, w: p.w, vx: 0, vy: 0, t: 0, life: 1e9 });
  // jugador
  P = makePlayerObj(ch, SAVE, 0, ch.name); S.players = [P];
  const q = o.P;
  P.level = q.level; P.xp = q.xp; P.xpNext = xpFor(q.level); P.cred = q.cred; P.perks = q.perks || {};
  P.weapons = q.weapons && q.weapons.length ? q.weapons : P.weapons; P.cur = clamp(q.cur || 0, 0, P.weapons.length - 1);
  P.clones = q.clones || 0; P.armorBought = q.armorBought || 0; P.carry = !!q.carry; P.abCd = q.abCd || 0;
  recalcPlayer(P, true); P.hp = Math.min(P.maxhp, q.hp); P.dashCharges = P.dashMax; P.shield = P.shieldMax;
  // misión en curso
  if (s.mission) {
    const m = Object.assign({}, s.mission, { carrier: s.mission.carrier === undefined ? -1 : s.mission.carrier });
    if (m.type === 'hunt') m.eid = -1;
    if (m.camp !== undefined) { m.camp = world.camps[m.camp]; if (m.camp) m.camp.raid = true; }
    S.mission = m;
  }
  // se reaparece en el piso franco donde se guardó, o en el punto exacto si se guardó desde la pausa
  const h = o.pos || world.houses.find(x => x.id === o.houseId) || world.houses[0];
  const f = findFree(h.x, h.y, P.r);
  P.x = f.x; P.y = f.y; P.ang = o.pos ? (o.pos.ang || 0) : -Math.PI / 2;
  if (o.pos) P.invuln = 2;
  enterRun(opts, 'Partida cargada');
  return true;
}

// ───────── Bucle de la simulación (partida individual y anfitrión) ─────────
function updateRun(dt) {
  if (S.hold) { if (Net.host) Net.hostTick(dt); return; }
  S.time += dt;
  S.flowT -= dt;
  const gl = gateLv();
  S.players.forEach((pl, i) => { pl.idx = i; });
  if (S.flowT <= 0) { S.flowT = 0.3; S.players.forEach((pl, i) => { if (!pl.dead && FlowSet[i]) FlowSet[i].build(S.world, pl.x, pl.y, gl); }); }
  for (const pl of S.players) { if (pl === P) updateLocalPlayer(pl, dt); else updateRemote(pl, dt); }
  updateEnemies(dt);
  updateBullets(dt);
  updateEBullets(dt);
  updateZones(dt);
  updateTurrets(dt);
  updatePickups(dt);
  updateCamps(dt);
  updateSpawner(dt);
  updateMission(dt);
  updateDistrict(dt);
  updateFx(dt);
  updateCamera(dt);
  revealAround(false);
  findInteract();
  if (keyHit('KeyE') && Game.state === 'play') doInteract();
  // limpieza de enemigos
  for (let i = S.enemies.length - 1; i >= 0; i--) {
    const e = S.enemies[i];
    if (e.dead) S.enemies.splice(i, 1);
    else if (!e.camp && !e.boss && !e.mob && nearestDist(e.x, e.y) > 1900) S.enemies.splice(i, 1);
  }
  // mejoras de nivel de los jugadores remotos: se les envían las opciones
  if (Net.host) for (const pl of S.players) {
    if (pl !== P && pl.pendingLevel > 0 && !pl.choosing) { pl.choosing = true; pl.choices = rollPerkChoices(pl); Net.toPlayer(pl, ['lvl', pl.choices.map(p => p.id)]); }
  }
  Snd.setIntensity(S.boss ? 1 : clamp(S.enemies.filter(e => e.aggro).length / 8, 0, 0.7));
  if (S.victory && !S.over) { S.winT -= dt; if (S.winT <= 0) endRun(true); }
  if (Net.host) Net.hostTick(dt);
}
