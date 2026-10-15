'use strict';
// ───────── Simulación: estado de partida, jugadores, armas, enemigos, objetos ─────────
// Soporta 1 jugador (modo normal) o hasta 4 (cooperativo LAN). En cooperativo, el anfitrión simula todo
// (S.players = todos los jugadores) y los clientes envían su posición/entrada y reciben el estado.
let S = null;      // estado de la partida actual
let P = null;      // jugador local (el de este ordenador)
let SAVE = null;   // progreso permanente
const Game = { state: 'title', t: 0 };

const PERK_MAX = { armor: 6, crit: 5, dashx: 2, multi: 2, pierce: 3, shield: 4, explo: 1, life: 4, dashcd: 5, abcd: 5 };
const levelCap = (pl = P) => CAP_TIERS[pl.meta.up.cap | 0];

// ───────── Efectos (se envían a los clientes cuando hay cooperativo) ─────────
const FX_RX = 1250, FX_RY = 900;     // alcance (px) en el que un cliente ve un efecto
function fxq(ev) { if (Net.host) S.fxq.push(ev); }
function notify(str, col = '#19f0ff', dur = 3.4) {
  if (!S) return;
  S.notes.push({ text: str, col, t: dur, max: dur });
  if (S.notes.length > 4) S.notes.shift();
}
function notifyAll(str, col = '#19f0ff', dur = 3.4) { notify(str, col, dur); if (Net.host) Net.toAll(['n', str, col, dur]); }
function notifyTo(pl, str, col = '#19f0ff', dur = 3.4) {
  if (!pl || pl === P) notify(str, col, dur);
  else if (Net.host) Net.toPlayer(pl, ['n', str, col, dur]);
}
function sndTo(pl, name) {
  if (!pl || pl === P) Snd.play(name);
  else if (Net.host) Net.toPlayer(pl, ['sp', name]);
}
function addText(x, y, str, col = '#fff', size = 16) { S.texts.push({ x, y, vy: -48, t: 0.85, max: 0.85, str, col, size }); fxq(['t', x, y, str, col, size]); }
function addParts(x, y, n, col, spd = 160, life = 0.5, size = 3) {
  if (S.parts.length > 700) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, s = rnd(0.2, 1) * spd;
    S.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(0.5, 1) * life, max: life, size: rnd(size * 0.6, size * 1.3), col });
  }
  fxq(['p', x, y, n, col, spd, life, size]);
}
function addRing(x, y, max, col, t = 0.45) { S.rings.push({ x, y, r: 6, max, col, t, tmax: t }); fxq(['r', x, y, max, col, t]); }
// Vibración de pantalla: se atenúa con la distancia a nuestro jugador
function shake(m, x, y) {
  if (x !== undefined) {
    fxq(['sh', x, y, m]);
    if (P) m *= clamp(1 - (dist(x, y, P.x, P.y) - 250) / 700, 0, 1);
  }
  S.shake = Math.max(S.shake, m);
}
function shakePl(pl, m) { if (pl === P) shake(m); else if (Net.host) Net.toPlayer(pl, ['sh2', m]); }
// Sonido posicional: lo oye quien esté cerca (src = jugador que lo origina, para que no se repita en su propio ordenador)
function sfx(name, x, y, src = -1) {
  if (!P || dist(x, y, P.x, P.y) < 1100) Snd.play(name);
  fxq(['s', x, y, name, src]);
}
function mouseWorld() {
  return { x: S.cam.x + (In.mx - U.cw / 2) / U.s, y: S.cam.y + (In.my - U.ch / 2) / U.s };
}
function weightedPick(tbl) {
  let sum = 0; for (const k in tbl) sum += tbl[k];
  let r = Math.random() * sum;
  for (const k in tbl) { r -= tbl[k]; if (r <= 0) return k; }
  return Object.keys(tbl)[0];
}

// ───────── Jugadores: consultas ─────────
const plById = (id) => S.players.find(p => p.id === id) || null;
const alivePls = () => S.players.filter(p => !p.dead);
function nearestPl(x, y) {
  let best = null, bd = 1e18;
  for (const p of S.players) { if (p.dead) continue; const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y); if (d < bd) { bd = d; best = p; } }
  return best;
}
function nearestDist(x, y) { const p = nearestPl(x, y); return p ? dist(x, y, p.x, p.y) : 1e9; }
function gateLv() { let m = 1; for (const p of S.players) m = Math.max(m, p.level); return m; }                 // barreras: la del más fuerte
function avgLv() { let a = 0; for (const p of S.players) a += p.level; return Math.max(1, Math.round(a / Math.max(1, S.players.length))); }
const nPlayers = () => Math.max(1, S.players.length);
const coopHp = () => 1 + 0.45 * (nPlayers() - 1);       // más vida de enemigos con más jugadores
const coopCount = () => 1 + 0.35 * (nPlayers() - 1);    // más enemigos
const coopXp = () => 1 + 0.4 * (nPlayers() - 1);        // más experiencia por orbe

function findFree(x, y, r) {
  const lv = S && S.players.length ? gateLv() : 99;
  if (!blockedCircle(S.world, x, y, r, lv)) return { x, y };
  for (let rad = 16; rad < 420; rad += 16) for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU, nx = x + Math.cos(a) * rad, ny = y + Math.sin(a) * rad;
    if (!blockedCircle(S.world, nx, ny, r, lv)) return { x: nx, y: ny };
  }
  return { x, y };
}
function moveBy(e, dx, dy, lv) {
  if (lv === undefined) lv = gateLv();
  const w = S.world;
  if (!blockedCircle(w, e.x + dx, e.y, e.r, lv)) e.x += dx;
  if (!blockedCircle(w, e.x, e.y + dy, e.r, lv)) e.y += dy;
}

// ───────── Armas y jugador ─────────
function weaponPool() {
  const set = new Set(FREE_WEAPONS);
  const add = (meta) => {
    (meta.weapons || []).forEach(w => set.add(w));
    (meta.chars || []).forEach(id => { const c = CHARS.find(x => x.id === id); if (c) set.add(c.weapon); });
  };
  if (S && S.players && S.players.length) S.players.forEach(pl => { add(pl.meta); set.add(pl.ch.weapon); });
  else add(SAVE);
  return [...set];
}
function rollWeapon(minTier, maxTier, luck = 0) {
  const id = pick(weaponPool());
  let tier = minTier;
  for (let t = minTier + 1; t <= maxTier; t++) { if (Math.random() < 0.45 + luck) tier = t; else break; }
  return { id, tier, up: 0 };
}
function weaponMult(w) { return TIERS[w.tier].mult * (1 + 0.15 * (w.up || 0)); }

// meta = progreso permanente del dueño (SAVE para el jugador local; lo que envía el cliente para los remotos)
function makePlayerObj(ch, meta, id = 0, name = '') {
  const up = meta.up || {};
  const p = {
    id, name: name || ch.name, ch, meta, x: 0, y: 0, r: 12, vx: 0, vy: 0, ang: 0, level: 1, xp: 0, xpNext: xpFor(1),
    cred: [0, 150, 300, 500][up.fund | 0] || 0, perks: {}, weapons: [{ id: ch.weapon, tier: 0, up: 0 }], cur: 0,
    fireCd: 0, dashCd: 0, dashCharges: 1, dashT: 0, dashX: 0, dashY: 0, invuln: 0, abCd: 0, buff: { adren: 0 },
    swing: 0, swingAng: 0, swingFlip: 1, ghost: null, hurtT: 0, sinceHit: 9, carry: false, clones: up.clone ? 1 : 0,
    shield: 0, toxT: 0, armorBought: 0, recoil: 0,
    dead: false, pendingLevel: 0, choosing: false, busy: false, kills: 0, dx: 0, dy: 0, dang: 0, net: null, idx: 0,
  };
  recalcPlayer(p, true);
  p.hp = p.maxhp; p.dashCharges = p.dashMax;
  return p;
}
const perkCount = (pl, id) => pl.perks[id] || 0;
function recalcPlayer(pl, first) {
  const k = (id) => perkCount(pl, id), ch = pl.ch, up = pl.meta.up || {};
  const oldMax = pl.maxhp || 0;
  pl.maxhp = ch.hp * (1 + 0.1 * (up.vit | 0)) + 25 * k('hp');
  if (!first && pl.maxhp > oldMax) pl.hp = Math.min(pl.maxhp, pl.hp + (pl.maxhp - oldMax));
  pl.speed = ch.speed * (1 + 0.08 * k('speed'));
  pl.dmgMul = 1 + 0.12 * k('dmg'); pl.rateMul = 1 + 0.10 * k('rate');
  pl.dashCdMul = Math.pow(0.85, k('dashcd')); pl.abCdMul = Math.pow(0.86, k('abcd'));
  pl.magnetR = 130 * (1 + 0.35 * k('magnet')); pl.regen = 1.2 * k('regen');
  pl.armorPct = Math.min(0.6, 0.08 * (k('armor') + pl.armorBought));
  pl.crit = 0.05 + 0.08 * k('crit'); pl.credMul = 1 + 0.3 * k('cred'); pl.xpMul = 1 + 0.2 * k('xp');
  pl.pierceN = k('pierce'); pl.dashMax = 1 + k('dashx'); pl.lifesteal = 0.025 * k('life');
  pl.shieldMax = 40 * k('shield'); pl.explo = k('explo'); pl.multi = k('multi');
}
function applyPerk(pl, id) {
  pl.perks[id] = (pl.perks[id] || 0) + 1;
  if (id === 'hp') pl.hp = Math.min(pl.maxhp + 25, pl.hp + 25);
  recalcPlayer(pl);
  if (id === 'shield') pl.shield = pl.shieldMax;
  if (id === 'dashx') pl.dashCharges = Math.min(pl.dashMax, pl.dashCharges + 1);
}
function rollPerkChoices(pl) {
  const unlocked = pl.meta.perks || [];
  const avail = PERKS.filter(p => (p.base || unlocked.includes(p.id)) && (perkCount(pl, p.id) < (PERK_MAX[p.id] || 99)));
  const out = [];
  while (out.length < 3 && avail.length) out.push(avail.splice(Math.floor(Math.random() * avail.length), 1)[0]);
  return out;
}

function healPlayer(pl, n) {
  const before = pl.hp; pl.hp = Math.min(pl.maxhp, pl.hp + n);
  if (pl.hp > before) addText(pl.x, pl.y - 24, '+' + Math.ceil(pl.hp - before), '#5dff9a', 15);
}
function hurtPlayer(pl, dmg, x, y) {
  if (pl.dead || pl.invuln > 0 || S.over) return false;
  dmg *= (1 - pl.armorPct);
  pl.sinceHit = 0;
  if (pl.shield > 0) { const a = Math.min(pl.shield, dmg); pl.shield -= a; dmg -= a; }
  pl.hurtT = 0.25;
  if (dmg > 0) { pl.hp -= dmg; addText(pl.x + rnd(-8, 8), pl.y - 22, '-' + Math.ceil(dmg), '#ff4d6d', 17); }
  shakePl(pl, Math.min(10, 3 + dmg * 0.25));
  sfx('hurt', pl.x, pl.y);
  addParts(pl.x, pl.y, 6, '#ff3355', 140, 0.35);
  if (pl.hp <= 0) killPlayer(pl);
  return true;
}
function killPlayer(pl) {
  if (pl.clones > 0) {
    pl.clones--; pl.hp = pl.maxhp * 0.5; pl.invuln = 3;
    addRing(pl.x, pl.y, 320, '#19f0ff', 0.7); shake(14, pl.x, pl.y); sfx('boom', pl.x, pl.y);
    for (const e of S.enemies) { const d = dist(e.x, e.y, pl.x, pl.y); if (d < 320 && !e.boss) { e.stun = 2.5; e.kx = Math.cos(angleTo(pl.x, pl.y, e.x, e.y)) * 500; e.ky = Math.sin(angleTo(pl.x, pl.y, e.x, e.y)) * 500; } }
    notifyTo(pl, 'CLON DE RESPALDO ACTIVADO', '#19f0ff', 4);
    return;
  }
  if (Net.host) downPlayer(pl); else endRun(false);
}
// Cooperativo: el jugador cae y sus compañeros pueden reanimarlo; si caen todos, termina la partida
function downPlayer(pl) {
  pl.dead = true; pl.hp = 0; pl.invuln = 0; pl.dashT = 0; pl.ghost = null; pl.buff.adren = 0; pl.vx = pl.vy = 0; pl.carry = false;
  addRing(pl.x, pl.y, 90, '#ff3355', 0.6); addParts(pl.x, pl.y, 16, '#ff3355', 220, 0.6, 4);
  notifyAll(`${pl.name} ha caído. ¡Acércate y reanímalo!`, '#ff3355', 4.5);
  if (!S.players.some(p => !p.dead)) endRun(false);
}
function revivePlayer(target, by) {
  if (!target.dead) return;
  target.dead = false; target.hp = target.maxhp * 0.4; target.invuln = 2.5; target.hurtT = 0;
  addRing(target.x, target.y, 150, '#5dff9a', 0.6); addParts(target.x, target.y, 20, '#5dff9a', 240, 0.6, 4);
  sfx('heal', target.x, target.y);
  notifyAll(`${by ? by.name : 'Alguien'} ha reanimado a ${target.name}.`, '#5dff9a', 3.6);
}

function gainXP(pl, n) {
  n *= pl.xpMul;
  const cap = levelCap(pl);
  if (pl.level >= cap) { pl.cred += Math.round(n * 0.35); return; }
  pl.xp += n;
  while (pl.xp >= pl.xpNext && pl.level < cap) {
    pl.xp -= pl.xpNext; pl.level++; pl.xpNext = xpFor(pl.level); pl.pendingLevel++;
    sndTo(pl, 'level'); addRing(pl.x, pl.y, 260, '#ffe14a', 0.7); addParts(pl.x, pl.y, 26, '#ffe14a', 280, 0.8);
    healPlayer(pl, pl.maxhp * 0.2);
    if (Net.host) notifyAll(`${pl.name}: ¡NIVEL ${pl.level}!`, '#ffe14a', 3); else notifyTo(pl, `¡NIVEL ${pl.level}!`, '#ffe14a', 3);
    for (const d of DISTRICTS) if (d.req === pl.level && d.id > 0) notifyTo(pl, `Barrera abierta: ${d.name}`, d.accent, 4.5);
    if (pl.level === cap) notifyTo(pl, 'NIVEL MÁXIMO. Mejora el límite en el Taller con Chips.', '#ff8a1a', 5);
  }
  if (pl.level >= cap) pl.xp = 0;
}
function xpAll(v) { for (const pl of S.players) gainXP(pl, v); }

// ───────── Disparo ─────────
const currentWeapon = (pl = P) => pl.weapons[pl.cur];
function playerFire(pl) {
  if (pl.fireCd > 0 || pl.dead) return;
  const w = pl.weapons[pl.cur]; if (!w) return;
  const def = WEAPONS[w.id];
  const rate = def.rate * pl.rateMul * (pl.buff.adren > 0 ? 1.6 : 1);
  pl.fireCd = 1 / rate;
  const dmgBase = def.dmg * weaponMult(w) * pl.dmgMul * (pl.buff.adren > 0 ? 1.2 : 1);
  if (def.kind === 'melee') { meleeSwing(pl, def, dmgBase); return; }
  const cos = Net.client;                       // en un cliente los disparos propios son solo visuales
  const list = cos ? S.cbul : S.bullets;
  const n = def.pellets + pl.multi;
  const mx = pl.x + Math.cos(pl.ang) * 18, my = pl.y + Math.sin(pl.ang) * 18;
  for (let i = 0; i < n; i++) {
    let a = pl.ang + (Math.random() - 0.5) * def.spread * 2;
    if (def.pellets === 1 && pl.multi) a += (i - (n - 1) / 2) * 0.12;
    const crit = Math.random() < pl.crit;
    const dmg = dmgBase * (crit ? 2 : 1);
    if (def.beam) { fireBeam(pl, mx, my, a, dmg, crit, def); continue; }
    list.push({
      x: mx, y: my, vx: Math.cos(a) * def.speed, vy: Math.sin(a) * def.speed, dmg, r: def.size, life: def.range / def.speed,
      pierce: (def.pierce || 0) + pl.pierceN, hit: [], col: def.col, homing: def.homing || 0, explode: def.explode || 0, crit, knock: def.knock || 0,
      gren: !!def.explode, boom: def.explode ? 0 : (pl.explo ? 46 : 0), pl, cos,
    });
  }
  sfx(w.id, pl.x, pl.y, pl.id);
  addParts(mx, my, 3, def.col, 120, 0.15, 2.5);
  pl.recoil = 3;
  if (pl === P) shake(def.kind === 'gun' && def.pellets > 3 ? 2.5 : 0.8);
}
function fireBeam(pl, x, y, a, dmg, crit, def) {
  const dx = Math.cos(a), dy = Math.sin(a);
  let len = def.range;
  for (let d = 0; d < def.range; d += 12) if (bulletBlocked(S.world, x + dx * d, y + dy * d)) { len = d; break; }
  if (!Net.client) {
    for (const e of S.enemies) {
      if (e.dead) continue;
      const t = clamp((e.x - x) * dx + (e.y - y) * dy, 0, len);
      const px = x + dx * t, py = y + dy * t;
      if (dist(px, py, e.x, e.y) < e.r + 8) damageEnemy(e, dmg, { crit, ang: a, knock: 120, pl });
    }
  }
  S.streaks.push({ x1: x, y1: y, x2: x + dx * len, y2: y + dy * len, col: def.col, t: 0.18, tmax: 0.18, w: 5 });
  fxq(['sk', x, y, x + dx * len, y + dy * len, def.col, 0.18, 5, pl.id]);
  if (pl === P) shake(5);
}
function meleeSwing(pl, def, dmg) {
  pl.swing = 0.2; pl.swingAng = pl.ang; pl.swingFlip *= -1;
  const reach = def.reach, half = def.arc / 2;
  let hit = false;
  if (!Net.client) {
    for (const e of S.enemies) {
      if (e.dead) continue;
      const d = dist(pl.x, pl.y, e.x, e.y);
      if (d > reach + e.r) continue;
      let da = Math.abs(angleTo(pl.x, pl.y, e.x, e.y) - pl.ang); if (da > Math.PI) da = TAU - da;
      if (da > half) continue;
      const crit = Math.random() < pl.crit;
      damageEnemy(e, dmg * (crit ? 2 : 1), { crit, ang: pl.ang, knock: 260, pl });
      hit = true;
    }
    deflectBullets(pl, reach, half);
  }
  if (pl === P) moveBy(pl, Math.cos(pl.ang) * 10, Math.sin(pl.ang) * 10, gateLv());
  sfx('katana', pl.x, pl.y, pl.id);
  if (hit && pl === P) shake(3);
}
function deflectBullets(pl, reach, half) {   // desviar balas enemigas con la hoja
  for (let i = S.ebullets.length - 1; i >= 0; i--) {
    const b = S.ebullets[i];
    const d = dist(pl.x, pl.y, b.x, b.y);
    if (d > reach + 10) continue;
    let da = Math.abs(angleTo(pl.x, pl.y, b.x, b.y) - pl.ang); if (da > Math.PI) da = TAU - da;
    if (da > half + 0.3) continue;
    S.ebullets.splice(i, 1);
    const sp = 700, a = pl.ang + rnd(-0.1, 0.1);
    S.bullets.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: b.dmg * 3 + 8, r: 4, life: 1, pierce: 0, hit: [], col: '#7fe9ff', homing: 0, explode: 0, crit: false, knock: 0, boom: 0, pl });
    addParts(b.x, b.y, 5, '#7fe9ff', 160, 0.25);
  }
}

function explodeAt(x, y, r, dmg, col = '#ff8a1a', pl = null) {
  addRing(x, y, r, col, 0.35); addParts(x, y, 14, col, 260, 0.5, 4); sfx('boom', x, y); shake(r > 80 ? 8 : 3, x, y);
  for (const e of S.enemies) {
    if (e.dead) continue;
    const d = dist(x, y, e.x, e.y);
    if (d < r + e.r) damageEnemy(e, dmg * (1 - 0.5 * clamp(d / (r + e.r), 0, 1)), { ang: angleTo(x, y, e.x, e.y), knock: 300, pl });
  }
}
function miniBlast(x, y, r, dmg, col, except, pl) {
  addRing(x, y, r, col, 0.2); addParts(x, y, 4, col, 160, 0.25, 2.5);
  for (const e of S.enemies) {
    if (e.dead || e === except) continue;
    if (dist(x, y, e.x, e.y) < r + e.r) damageEnemy(e, dmg, { noLife: true, pl });
  }
}

// Balas del jugador. Con cos=true (cliente) solo son visuales: no hacen daño, el anfitrión decide los impactos.
function updateBullets(dt) {
  stepBullets(S.bullets, dt);
  if (S.cbul.length) stepBullets(S.cbul, dt);
}
function stepBullets(bl, dt) {
  for (let i = bl.length - 1; i >= 0; i--) {
    const b = bl[i];
    b.life -= dt;
    if (b.homing) {
      let best = null, bd = 420;
      for (const e of S.enemies) { if (e.dead || b.hit.includes(e)) continue; const d = dist(b.x, b.y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
      if (best) {
        const sp = Math.hypot(b.vx, b.vy), cur = Math.atan2(b.vy, b.vx), tgt = angleTo(b.x, b.y, best.x, best.y);
        let da = tgt - cur; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
        const na = cur + clamp(da, -b.homing * dt, b.homing * dt);
        b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
      }
    }
    const step = Math.hypot(b.vx, b.vy) * dt, n = Math.max(1, Math.ceil(step / 14));
    let dead = false;
    for (let s = 0; s < n && !dead; s++) {
      b.x += (b.vx * dt) / n; b.y += (b.vy * dt) / n;
      if (bulletBlocked(S.world, b.x, b.y)) { dead = true; addParts(b.x, b.y, 4, b.col, 120, 0.2, 2); break; }
      for (const e of S.enemies) {
        if (e.dead || b.hit.includes(e)) continue;
        if (dist(b.x, b.y, e.x, e.y) < e.r + b.r) {
          b.hit.push(e);
          if (!b.cos) {
            damageEnemy(e, b.dmg, { crit: b.crit, ang: Math.atan2(b.vy, b.vx), knock: b.knock ? 160 : 0, pl: b.pl });
            if (b.boom) miniBlast(b.x, b.y, b.boom, b.dmg * 0.4, b.col, e, b.pl);
          }
          if (b.gren) { dead = true; break; }
          if (b.pierce > 0) b.pierce--; else { dead = true; break; }
        }
      }
    }
    if (b.life <= 0) dead = true;
    if (dead) {
      if (b.gren && !b.cos) explodeAt(b.x, b.y, b.explode, b.dmg, '#ff8a1a', b.pl);
      bl.splice(i, 1);
    }
  }
}
function updateEBullets(dt) {
  const bl = S.ebullets;
  for (let i = bl.length - 1; i >= 0; i--) {
    const b = bl[i];
    b.life -= dt;
    const step = Math.hypot(b.vx, b.vy) * dt, n = Math.max(1, Math.ceil(step / 14));
    let dead = false;
    for (let s = 0; s < n && !dead; s++) {
      b.x += (b.vx * dt) / n; b.y += (b.vy * dt) / n;
      if (bulletBlocked(S.world, b.x, b.y)) { dead = true; addParts(b.x, b.y, 3, b.col, 90, 0.2, 2); break; }
      for (const pl of S.players) {
        if (pl.dead || pl.invuln > 0) continue;
        if (dist(b.x, b.y, pl.x, pl.y) < pl.r + b.r) { hurtPlayer(pl, b.dmg, b.x, b.y); dead = true; break; }
      }
      if (dead) break;
      for (const t of S.turrets) if (dist(b.x, b.y, t.x, t.y) < 14) { t.hp -= b.dmg; dead = true; break; }
    }
    if (b.life <= 0) dead = true;
    if (dead) bl.splice(i, 1);
  }
}
function updateTurrets(dt) {
  for (let i = S.turrets.length - 1; i >= 0; i--) {
    const t = S.turrets[i];
    t.life -= dt; t.cd -= dt;
    if (t.life <= 0 || t.hp <= 0) { addParts(t.x, t.y, 12, '#ff8a1a', 200, 0.5); S.turrets.splice(i, 1); continue; }
    let best = null, bd = 440;
    for (const e of S.enemies) { if (e.dead) continue; const d = dist(t.x, t.y, e.x, e.y); if (d < bd && hasLOS(S.world, t.x, t.y, e.x, e.y)) { bd = d; best = e; } }
    if (best) {
      t.ang = angleTo(t.x, t.y, best.x, best.y);
      if (t.cd <= 0) {
        const o = t.pl || P;
        t.cd = 0.22; const a = t.ang + rnd(-0.05, 0.05);
        S.bullets.push({ x: t.x + Math.cos(a) * 14, y: t.y + Math.sin(a) * 14, vx: Math.cos(a) * 760, vy: Math.sin(a) * 760, dmg: 8 * o.dmgMul * (1 + 0.1 * o.level), r: 3, life: 0.7, pierce: 0, hit: [], col: '#ff8a1a', homing: 0, explode: 0, crit: false, knock: 0, boom: 0, pl: o });
        sfx('smg', t.x, t.y);
      }
    }
  }
}

// ───────── Esquiva y habilidades ─────────
function tryDash(pl, ix, iy) {
  if (pl.dashCharges < 1 || pl.dashT > 0 || pl.ghost || pl.dead) return false;
  let dx = ix, dy = iy;
  if (!dx && !dy) { dx = Math.cos(pl.ang); dy = Math.sin(pl.ang); }
  pl.dashCharges--; if (pl.dashCharges < pl.dashMax - 0 && pl.dashCd <= 0) pl.dashCd = 1.7 * pl.dashCdMul;
  pl.dashT = 0.16; pl.dashX = dx; pl.dashY = dy; pl.invuln = Math.max(pl.invuln, 0.26);
  sfx('dash', pl.x, pl.y); addParts(pl.x, pl.y, 8, pl.ch.col, 140, 0.3);
  return true;
}
// aim: punto del mundo al que apunta el jugador (para la torreta)
function useAbility(pl, aim) {
  if (pl.dead) return;
  if (pl.abCd > 0) { sndTo(pl, 'deny'); return; }
  const id = pl.ch.ability;
  if (id === 'adren') {
    pl.buff.adren = 6; addRing(pl.x, pl.y, 140, '#ffe14a', 0.5); addParts(pl.x, pl.y, 24, '#ffe14a', 260, 0.6);
  } else if (id === 'hack') {
    addRing(pl.x, pl.y, 300, '#9cff3a', 0.6); addRing(pl.x, pl.y, 220, '#9cff3a', 0.45); sfx('hack', pl.x, pl.y);
    for (const e of S.enemies) {
      if (e.dead) continue;
      if (dist(pl.x, pl.y, e.x, e.y) > 300 + e.r) continue;
      if ((e.def.fly || e.def.fixed) && !e.boss) {
        if (e.elite) damageEnemy(e, e.maxhp * 0.6, { pl }); else damageEnemy(e, e.maxhp * 2, { pl });
      } else { e.stun = e.boss ? 1.2 : (e.elite ? 2.4 : 4); e.hacked = e.stun; }
      addParts(e.x, e.y, 6, '#9cff3a', 120, 0.4);
    }
  } else if (id === 'turret') {
    const m = aim || { x: pl.x + Math.cos(pl.ang) * 160, y: pl.y + Math.sin(pl.ang) * 160 };
    let tx = m.x, ty = m.y; const d = dist(pl.x, pl.y, tx, ty);
    if (d > 200) { tx = pl.x + (tx - pl.x) / d * 200; ty = pl.y + (ty - pl.y) / d * 200; }
    const f = findFree(tx, ty, 12);
    S.turrets.push({ x: f.x, y: f.y, hp: 140, life: 14, cd: 0.3, ang: pl.ang, pl });
    addRing(f.x, f.y, 70, '#ff8a1a', 0.4);
  } else if (id === 'ghost') {
    pl.ghost = { t: 0.22, dx: Math.cos(pl.ang), dy: Math.sin(pl.ang), hit: [] };
    pl.invuln = Math.max(pl.invuln, 0.4);
  }
  sfx('ability', pl.x, pl.y);
  pl.abCd = pl.ch.abCd * pl.abCdMul;
}
// Embestida de Ronin: mueve al jugador y (en el anfitrión) corta a quien atraviesa
function runGhost(pl, dt) {
  const g = pl.ghost; g.t -= dt;
  moveBy(pl, g.dx * 1150 * dt, g.dy * 1150 * dt, gateLv());
  pl.invuln = Math.max(pl.invuln, 0.1);
  if (!Net.client) {
    const dmg = 3 * WEAPONS.katana.dmg * weaponMult(pl.weapons[0]) * pl.dmgMul;
    for (const e of S.enemies) {
      if (e.dead || g.hit.includes(e)) continue;
      if (dist(pl.x, pl.y, e.x, e.y) < e.r + 34) { g.hit.push(e); damageEnemy(e, dmg, { crit: true, ang: pl.ang, knock: 200, pl }); addParts(e.x, e.y, 8, '#7fe9ff', 220, 0.3); }
    }
  }
  S.afterimages.push({ x: pl.x, y: pl.y, ang: pl.ang, t: 0.3, col: pl.ch.col, id: pl.id });
  if (g.t <= 0) pl.ghost = null;
}

// ───────── Actualización de los jugadores ─────────
// Temporizadores comunes. En un cliente la vida, la regeneración y las recargas las manda el anfitrión.
function tickPlayer(pl, dt) {
  pl.fireCd = Math.max(0, pl.fireCd - dt); pl.invuln = Math.max(0, pl.invuln - dt); pl.hurtT = Math.max(0, pl.hurtT - dt);
  pl.abCd = Math.max(0, pl.abCd - dt); pl.swing = Math.max(0, pl.swing - dt); pl.buff.adren = Math.max(0, pl.buff.adren - dt);
  pl.recoil = Math.max(0, pl.recoil - dt * 30); pl.sinceHit += dt;
  if (pl !== P && pl.dashT > 0) pl.dashT = Math.max(0, pl.dashT - dt);     // el jugador local gasta la esquiva al moverse
  if (pl.dashCharges < pl.dashMax) { pl.dashCd -= dt; if (pl.dashCd <= 0) { pl.dashCharges++; pl.dashCd = 1.7 * pl.dashCdMul; } }
  if (Net.client) return;
  if (pl.dead) return;
  if (pl.regen > 0) pl.hp = Math.min(pl.maxhp, pl.hp + pl.regen * dt);
  if (pl.shieldMax > 0 && pl.sinceHit > 3 && pl.shield < pl.shieldMax) pl.shield = Math.min(pl.shieldMax, pl.shield + 22 * dt);
  if (pl.busy || pl.choosing) pl.invuln = Math.max(pl.invuln, 0.2);       // mientras eliges mejora o estás en un piso franco
}
function toxicTile(pl, dt) {
  if (Net.client || pl.dead) return;
  const tt = S.world.tileAt(Math.floor(pl.x / TILE), Math.floor(pl.y / TILE));
  if (tt === T.TOXIC && pl.dashT <= 0) { pl.toxT += dt; if (pl.toxT > 0.5) { pl.toxT = 0; hurtPlayer(pl, 4 + pl.level * 0.3); } }
}

// Jugador de este ordenador (teclado/ratón/táctil)
function updateLocalPlayer(pl, dt) {
  const live = Game.state === 'play' && !pl.dead;
  const m = mouseWorld();
  if (live) pl.ang = Math.atan2(m.y - pl.y, m.x - pl.x);
  tickPlayer(pl, dt);
  let ix = 0, iy = 0;
  if (live) {
    if (keyDown('KeyW') || keyDown('ArrowUp')) iy -= 1;
    if (keyDown('KeyS') || keyDown('ArrowDown')) iy += 1;
    if (keyDown('KeyA') || keyDown('ArrowLeft')) ix -= 1;
    if (keyDown('KeyD') || keyDown('ArrowRight')) ix += 1;
    const il = Math.hypot(ix, iy); if (il > 0) { ix /= il; iy /= il; }
    if (In.ax || In.ay) { const al = Math.hypot(In.ax, In.ay); ix = al > 1 ? In.ax / al : In.ax; iy = al > 1 ? In.ay / al : In.ay; }   // stick táctil (analógico)
    if (keyHit('ShiftLeft') || keyHit('ShiftRight')) { if (tryDash(pl, ix, iy) && Net.client) Net.sendHost(['dash', pl.dashX, pl.dashY]); }
    if (keyHit('Space')) {
      if (Net.client) clientAbility(pl); else useAbility(pl, m);
    }
    if (keyHit('Digit1') && pl.weapons[0]) pl.cur = 0;
    if (keyHit('Digit2') && pl.weapons[1]) pl.cur = 1;
    if (keyHit('Digit3') && pl.weapons[2]) pl.cur = 2;
    if (keyHit('KeyQ') || In.wheel !== 0) pl.cur = (pl.cur + (In.wheel < 0 ? -1 : 1) + pl.weapons.length) % pl.weapons.length;
  }
  if (pl.dead) { pl.vx = pl.vy = 0; return; }
  if (pl.ghost) {
    runGhost(pl, dt);
  } else if (pl.dashT > 0) {
    pl.dashT -= dt;
    moveBy(pl, pl.dashX * 640 * dt, pl.dashY * 640 * dt, gateLv());
    S.afterimages.push({ x: pl.x, y: pl.y, ang: pl.ang, t: 0.22, col: pl.ch.col, id: pl.id });
  } else {
    const sp = pl.speed * (pl.buff.adren > 0 ? 1.25 : 1) * (pl.carry ? 0.93 : 1);
    const k = 1 - Math.exp(-dt * 16);
    pl.vx = lerp(pl.vx, ix * sp, k); pl.vy = lerp(pl.vy, iy * sp, k);
    moveBy(pl, pl.vx * dt, pl.vy * dt, gateLv());
  }
  toxicTile(pl, dt);
  if (live && In.down) playerFire(pl);
}
// Cliente: la habilidad la ejecuta el anfitrión; aquí solo se anticipa la embestida de Ronin
function clientAbility(pl) {
  if (pl.abCd > 0) { Snd.play('deny'); return; }
  Net.sendHost(['ab', pl.ang, mouseWorld().x, mouseWorld().y]); pl.abLock = 0.35;
  if (pl.ch.ability === 'ghost') { pl.ghost = { t: 0.22, dx: Math.cos(pl.ang), dy: Math.sin(pl.ang), hit: [] }; pl.invuln = Math.max(pl.invuln, 0.4); }
  pl.abCd = pl.ch.abCd * pl.abCdMul;
}
// Jugador remoto (en el anfitrión): su posición la manda su ordenador
function updateRemote(pl, dt) {
  tickPlayer(pl, dt);
  if (pl.dead) return;
  if (pl.ghost) runGhost(pl, dt);
  else if (pl.net && pl.net.fire && !pl.busy && !pl.choosing) playerFire(pl);
  toxicTile(pl, dt);
}

// ───────── Daño a enemigos y muertes ─────────
function damageEnemy(e, dmg, o = {}) {
  if (e.dead) return;
  if (e.invuln > 0) return;
  if (e.def.armor) dmg *= (1 - e.def.armor);
  if (e.shielded) dmg *= 0.35;
  e.hp -= dmg; e.flash = 0.09; e.aggro = true;
  const pl = o.pl || null;
  if (pl) e.lastPl = pl;
  if (o.knock && !e.boss && !e.def.fixed) { e.kx += Math.cos(o.ang) * o.knock; e.ky += Math.sin(o.ang) * o.knock; }
  if (pl && pl.lifesteal && !o.noLife && !pl.dead) pl.hp = Math.min(pl.maxhp, pl.hp + dmg * pl.lifesteal);
  addText(e.x + rnd(-10, 10), e.y - e.r - 6, String(Math.ceil(dmg)), o.crit ? '#ffe14a' : '#ffffff', o.crit ? 20 : 14);
  sfx(o.crit ? 'crit' : 'hit', e.x, e.y);
  addParts(e.x, e.y, 2, e.def.col || '#fff', 100, 0.2, 2);
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  if (e.dead) return;
  e.dead = true; S.kills++;
  const L = e.level, mult = e.elite ? 3 : 1;
  const killer = (e.lastPl && !e.lastPl.dead ? e.lastPl : null) || nearestPl(e.x, e.y) || P;
  killer.kills++;
  addParts(e.x, e.y, e.boss ? 60 : 16, e.boss ? e.col : e.def.col, e.boss ? 420 : 240, e.boss ? 1.1 : 0.6, 4);
  addRing(e.x, e.y, e.boss ? 220 : 60, e.boss ? e.col : e.def.col, e.boss ? 0.8 : 0.3);
  sfx(e.boss ? 'boom' : 'kill', e.x, e.y); shake(e.boss ? 16 : e.elite ? 5 : 1.5, e.x, e.y);
  const xp = e.xpV * (1 + 0.1 * L) * mult * coopXp();
  const orbs = e.boss ? 14 : e.elite ? 4 : 2;
  for (let i = 0; i < orbs; i++) spawnPickup('xp', e.x, e.y, xp / orbs);
  const cr = e.credV * (1 + 0.12 * L) * mult * killer.credMul;
  const cn = e.boss ? 10 : e.elite ? 3 : 1;
  for (let i = 0; i < cn; i++) if (e.boss || e.elite || Math.random() < 0.8) spawnPickup('cred', e.x, e.y, Math.max(1, Math.round(cr / cn)));
  const hurt = S.players.some(p => !p.dead && p.hp < p.maxhp * 0.5);
  if (!e.boss && Math.random() < 0.06 + (hurt ? 0.06 : 0)) spawnPickup('hp', e.x, e.y, 22 + L * 2);
  if (e.elite && !e.boss && Math.random() < 0.6) {
    const d = e.def && S.world.districtAtPx(e.x, e.y);
    spawnPickup('weapon', e.x, e.y, 0, { w: rollWeapon(d >= 2 ? 1 : 0, Math.min(3, 1 + d)) });
  }
  if (e.camp) { e.camp.enemies = e.camp.enemies.filter(x => x !== e); if (!e.camp.cleared && e.camp.enemies.every(x => x.dead)) onCampCleared(e.camp); }
  missionOnKill(e, killer);
  if (e.lieut) { spawnPickup('weapon', e.x, e.y, 0, { w: rollWeapon(1, 3, 0.15), vx: 0, vy: 0 }); spawnPickup('hp', e.x + 26, e.y, 50); }
  if (e.boss) onBossKilled(e);
}

// ───────── Objetos recogibles ─────────
function spawnPickup(kind, x, y, v, extra) {
  const a = Math.random() * TAU, s = rnd(40, 140);
  const p = Object.assign({ id: S.nid++, kind, x, y, v, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: (kind === 'weapon' || kind === 'chest' || kind === 'stash') ? 1e9 : 40 }, extra || {});
  S.pickups.push(p);
  return p;
}
function updatePickups(dt) {
  for (let i = S.pickups.length - 1; i >= 0; i--) {
    const p = S.pickups[i];
    p.t += dt; p.life -= dt;
    if (p.life <= 0) { S.pickups.splice(i, 1); continue; }
    const f = Math.exp(-dt * 4);
    p.vx *= f; p.vy *= f;
    if (!blockedCircle(S.world, p.x + p.vx * dt, p.y, 5, 99)) p.x += p.vx * dt;
    if (!blockedCircle(S.world, p.x, p.y + p.vy * dt, 5, 99)) p.y += p.vy * dt;
    if (p.kind === 'xp' || p.kind === 'cred' || p.kind === 'hp') {
      // el jugador vivo más cercano (para la vida, el más cercano al que le falte vida)
      let pl = null, bd = 1e18;
      for (const q of S.players) {
        if (q.dead) continue;
        if (p.kind === 'hp' && Net.host && q.hp >= q.maxhp - 0.5) continue;
        const d = (q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y);
        if (d < bd) { bd = d; pl = q; }
      }
      if (!pl) continue;
      const d = Math.sqrt(bd);
      const mr = pl.magnetR * (p.kind === 'hp' ? 0.7 : 1);
      if (d < mr && p.t > 0.25) { const a = angleTo(p.x, p.y, pl.x, pl.y), s = 520; p.x += Math.cos(a) * s * dt; p.y += Math.sin(a) * s * dt; }
      if (d < pl.r + 12) {
        if (p.kind === 'xp') gainXP(pl, p.v);
        else if (p.kind === 'cred') { pl.cred += p.v; S.credEarned += p.v; }
        else { healPlayer(pl, p.v); sndTo(pl, 'heal'); S.pickups.splice(i, 1); continue; }
        sndTo(pl, 'pickup'); S.pickups.splice(i, 1);
      }
    }
  }
}

// ───────── Campamentos y generación ambiental ─────────
// Cada distrito liberado endurece al resto de la ciudad (la corporación responde)
function enemyLevelFor(d) { return Math.max(1, Math.round(DISTRICTS[d].base + avgLv() * 0.55 + 1.6 * libCount())); }

function spawnCamp(camp) {
  camp.spawned = true; camp.enemies = [];
  const dd = DISTRICTS[camp.district], L = enemyLevelFor(camp.district), lv = avgLv();
  let n = Math.round((rndi(4, 6) + Math.floor(lv / 6) + (camp.raid ? 3 : 0)) * coopCount());
  const x0 = camp.cx * BLOCK + 4, y0 = camp.cy * BLOCK + 4;
  const tiles = [];
  for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) if (!SOLID_MOVE[S.world.tileAt(x0 + i, y0 + j)]) tiles.push({ x: x0 + i, y: y0 + j });
  for (let i = tiles.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [tiles[i], tiles[j]] = [tiles[j], tiles[i]]; }
  for (let i = 0; i < n && tiles.length; i++) {
    const t = tiles.pop(); const type = weightedPick(dd.spawn);
    const e = spawnEnemy(type, (t.x + 0.5) * TILE, (t.y + 0.5) * TILE, { camp, level: L });
    e.aggroR = 430; camp.enemies.push(e);
  }
  const nt = (camp.district >= 1 || camp.raid) ? rndi(1, 2) : 0;
  for (let i = 0; i < nt && tiles.length; i++) {
    const t = tiles.pop();
    const e = spawnEnemy('turret', (t.x + 0.5) * TILE, (t.y + 0.5) * TILE, { camp, level: L, elite: false });
    e.aggroR = 520; camp.enemies.push(e);
  }
}
function despawnCamp(camp) {
  for (const e of camp.enemies) { e.dead = true; e.silent = true; }
  camp.enemies = []; camp.spawned = false;
}
function onCampCleared(camp) {
  camp.cleared = true;
  const L = enemyLevelFor(camp.district);
  const isRaid = S.mission && S.mission.type === 'raid' && S.mission.camp === camp;
  const lp = findFree(camp.x, camp.y, 14);
  if (isRaid) {
    spawnPickup('stash', lp.x, lp.y, 0, { vx: 0, vy: 0 });
    S.mission.stage = 1; for (const pl of S.players) sndTo(pl, 'mission');
    notifyAll('Campamento despejado. Toma el cargamento.', '#ffe14a', 5);
  } else {
    spawnPickup('chest', lp.x, lp.y, Math.round((60 + L * 22) * (P ? P.credMul : 1)), { vx: 0, vy: 0 });
    notifyAll('Campamento despejado. Hay un cofre.', '#19f0ff');
  }
  xpAll(40 + L * 12);
}

function updateCamps(dt) {
  for (const c of S.world.camps) {
    if (c.cleared) continue;
    const d = nearestDist(c.x, c.y);
    if (!c.spawned && d < 950) spawnCamp(c);
    else if (c.spawned && d > 1900 && !c.raid) despawnCamp(c);
  }
}

function updateSpawner(dt) {
  S.spawnT -= dt;
  if (S.spawnT > 0) return;
  const lv = avgLv(), np = nPlayers(), pm = S.mission && S.mission.type === 'purge' ? S.mission : null;
  const purging = pm && S.players.some(p => !p.dead && S.world.districtAtPx(p.x, p.y) === pm.district);
  S.spawnT = (rnd(1.8, 3.4) - Math.min(1.0, lv * 0.03)) / (1 + 0.45 * (np - 1)) * (purging ? 0.42 : 1);
  const cap = Math.round((5 + Math.min(8, Math.floor(lv / 2))) * coopCount() * (purging ? 1.7 : 1));
  let amb = 0; for (const e of S.enemies) if (!e.dead && !e.camp && !e.boss && !e.mob) amb++;
  if (amb >= cap || S.boss) return;
  const live = alivePls(); if (!live.length) return;
  const pl = pick(live);
  for (let tries = 0; tries < 14; tries++) {
    const a = rnd(0, TAU), r = rnd(740, 980);
    const x = pl.x + Math.cos(a) * r, y = pl.y + Math.sin(a) * r;
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (tx < 2 || ty < 2 || tx >= WW - 2 || ty >= WH - 2) continue;
    if (blockedCircle(S.world, x, y, 16, gateLv())) continue;
    const d = S.world.districtAtPx(x, y);
    if (pl.level < DISTRICTS[d].req) continue;
    if (S.defeated[d] && !(pm && pm.district === d) && Math.random() < 0.7) continue;     // distrito liberado: calles más tranquilas
    if (nearestDist(x, y) < 640) continue;
    let nearHub = false;
    for (const h of S.world.hubs) { const c = S.world.cellCenter(h.cx, h.cy); if (dist(x, y, c.x, c.y) < 520) nearHub = true; }
    for (const h of S.world.houses) if (dist(x, y, h.x, h.y) < 460) nearHub = true;
    if (nearHub) continue;
    const type = weightedPick(DISTRICTS[d].spawn), L = enemyLevelFor(d);
    const grp = 1 + (Math.random() < 0.45 ? 1 : 0) + (lv > 6 && Math.random() < 0.3 ? 1 : 0);
    for (let g = 0; g < grp; g++) {
      const f = findFree(x + rnd(-40, 40), y + rnd(-40, 40), 16);
      const e = spawnEnemy(g === 0 ? type : weightedPick(DISTRICTS[d].spawn), f.x, f.y, { level: L });
      e.aggroR = 600;
    }
    return;
  }
}
function ambush(n, tier = 0, pl) {
  pl = pl && !pl.dead ? pl : (nearestPl(P.x, P.y) || P);
  const d = S.world.districtAtPx(pl.x, pl.y), L = enemyLevelFor(d);
  n = Math.round(n * coopCount());
  for (let i = 0; i < n; i++) {
    for (let tries = 0; tries < 10; tries++) {
      const a = rnd(0, TAU), r = rnd(380, 560);
      const x = pl.x + Math.cos(a) * r, y = pl.y + Math.sin(a) * r;
      if (blockedCircle(S.world, x, y, 16, gateLv())) continue;
      const e = spawnEnemy(weightedPick(DISTRICTS[d].spawn), x, y, { level: L + tier, elite: i === 0 && tier > 0 });
      e.aggro = true; e.mob = true; break;
    }
  }
  notifyAll('¡EMBOSCADA! Una banda rival os ha encontrado.', '#ff3355', 3.5); for (const q of S.players) sndTo(q, 'warn');
}

// ───────── Niebla del mapa, distrito y cámara (solo del jugador local) ─────────
function revealAround(force) {
  const tx = Math.floor(P.x / TILE), ty = Math.floor(P.y / TILE), idx = ty * WW + tx;
  if (!force && idx === S.lastTile) return;
  S.lastTile = idx;
  const g = S.mapFog.getContext('2d'), R = 13;
  for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
    if (i * i + j * j > R * R) continue;
    const x = tx + i, y = ty + j;
    if (x < 0 || y < 0 || x >= WW || y >= WH) continue;
    const k = y * WW + x;
    if (S.explored[k]) continue;
    S.explored[k] = 1;
    g.drawImage(S.world.mapBase, x, y, 1, 1, x, y, 1, 1);
  }
}

function updateDistrict(dt) {
  const d = S.world.districtAtPx(P.x, P.y);
  if (d !== S.district) {
    S.district = d; S.maxDistrict = Math.max(S.maxDistrict, d);
    S.banner = { text: DISTRICTS[d].name.toUpperCase(), sub: DISTRICTS[d].desc, col: DISTRICTS[d].accent, t: 3.4, max: 3.4 };
    Snd.play('mission');
  }
  // aviso de barrera
  S.gateHint = null;
  const tx = Math.floor(P.x / TILE), ty = Math.floor(P.y / TILE);
  for (let j = -2; j <= 2 && !S.gateHint; j++) for (let i = -2; i <= 2; i++) {
    const x = tx + i, y = ty + j;
    if (x < 0 || y < 0 || x >= WW || y >= WH) continue;
    const g = S.world.gate[y * WW + x];
    if (g && gateLv() < DISTRICTS[g].req) { S.gateHint = g; break; }
  }
}
// Si el jugador local está caído, la cámara sigue al compañero vivo más cercano
function camTarget() {
  if (!P.dead) return P;
  return nearestPl(P.x, P.y) || P;
}
function updateCamera(dt) {
  const tg = camTarget(), m = mouseWorld();
  const tx = tg.x + (tg === P ? (m.x - P.x) * 0.15 : 0), ty = tg.y + (tg === P ? (m.y - P.y) * 0.15 : 0);
  const k = 1 - Math.exp(-dt * 8);
  S.cam.x = lerp(S.cam.x, tx, k); S.cam.y = lerp(S.cam.y, ty, k);
  S.shake = Math.max(0, S.shake - dt * 28);
}
function updateFx(dt) {
  for (let i = S.parts.length - 1; i >= 0; i--) {
    const p = S.parts[i]; p.life -= dt;
    if (p.life <= 0) { S.parts.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; const f = Math.exp(-dt * 3); p.vx *= f; p.vy *= f;
  }
  for (let i = S.texts.length - 1; i >= 0; i--) { const t = S.texts[i]; t.t -= dt; t.y += t.vy * dt; if (t.t <= 0) S.texts.splice(i, 1); }
  for (let i = S.rings.length - 1; i >= 0; i--) { const r = S.rings[i]; r.t -= dt; r.r = lerp(6, r.max, 1 - r.t / r.tmax); if (r.t <= 0) S.rings.splice(i, 1); }
  for (let i = S.streaks.length - 1; i >= 0; i--) { S.streaks[i].t -= dt; if (S.streaks[i].t <= 0) S.streaks.splice(i, 1); }
  for (let i = S.afterimages.length - 1; i >= 0; i--) { S.afterimages[i].t -= dt; if (S.afterimages[i].t <= 0) S.afterimages.splice(i, 1); }
  for (let i = S.notes.length - 1; i >= 0; i--) { S.notes[i].t -= dt; if (S.notes[i].t <= 0) S.notes.splice(i, 1); }
  if (S.banner) { S.banner.t -= dt; if (S.banner.t <= 0) S.banner = null; }
  if (S.hint > 0) S.hint -= dt;
}

// ───────── Zonas de peligro (bombas, golpes) ─────────
function updateZones(dt) {
  for (let i = S.zones.length - 1; i >= 0; i--) {
    const z = S.zones[i]; z.t -= dt;
    if (z.t > 0) continue;
    addRing(z.x, z.y, z.r * 1.2, z.col, 0.35); addParts(z.x, z.y, 18, z.col, 300, 0.5, 4); sfx('boom', z.x, z.y); shake(7, z.x, z.y);
    for (const pl of S.players) if (!pl.dead && dist(pl.x, pl.y, z.x, z.y) < z.r + pl.r) hurtPlayer(pl, z.dmg, z.x, z.y);
    if (z.ring) for (let k = 0; k < z.ring; k++) { const a = (k / z.ring) * TAU; eBullet(z.x, z.y, a, 260, z.dmg * 0.35, z.col, 4); }
    S.zones.splice(i, 1);
  }
  for (let i = S.beams.length - 1; i >= 0; i--) {
    const b = S.beams[i]; b.t -= dt;
    if (b.owner) { if (b.owner.dead) { S.beams.splice(i, 1); continue; } b.x = b.owner.x; b.y = b.owner.y; }
    if (b.t <= 0) { S.beams.splice(i, 1); continue; }
    if (b.tele > 0) { b.tele -= dt; if (b.tele > 0) continue; }
    b.ang += b.spin * dt;
    const bx = b.x + Math.cos(b.ang) * b.len, by = b.y + Math.sin(b.ang) * b.len;
    b.tick -= dt;
    if (b.tick > 0) continue;
    for (const pl of S.players) {
      if (pl.dead) continue;
      const t = clamp(((pl.x - b.x) * (bx - b.x) + (pl.y - b.y) * (by - b.y)) / (b.len * b.len), 0, 1);
      const px = b.x + (bx - b.x) * t, py = b.y + (by - b.y) * t;
      if (dist(px, py, pl.x, pl.y) < 16 + pl.r) { b.tick = 0.18; hurtPlayer(pl, b.dmg * 0.18, pl.x, pl.y); }
    }
  }
}
function eBullet(x, y, a, spd, dmg, col = '#ff4d6d', r = 4, life = 3) {
  S.ebullets.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, dmg, r, col, life });
}
