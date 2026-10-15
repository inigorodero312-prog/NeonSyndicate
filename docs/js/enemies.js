'use strict';
// ───────── Enemigos y jefes ─────────

function spawnEnemy(type, x, y, o = {}) {
  const def = ENEMIES[type];
  const d = S.world.districtAtPx(x, y);
  const L = o.level || enemyLevelFor(d);
  const cm = coopHp();
  const elite = o.elite !== undefined ? o.elite : (!def.fixed && Math.random() < 0.05 + 0.007 * Math.min(L, 12));
  const hpMul = (1 + 0.22 * (L - 1)) * (elite ? 2.4 : 1) * cm;
  const e = {
    id: S.nid++, type, def, boss: false, x, y, r: def.r * (elite ? 1.25 : 1), hp: def.hp * hpMul, maxhp: def.hp * hpMul, level: L, elite,
    dmgMul: (1 + 0.12 * (L - 1)) * (elite ? 1.4 : 1), spd: def.spd * (elite ? 1.12 : 1) * rnd(0.93, 1.07),
    aggro: false, aggroR: 520, cd: rnd(0.5, def.shoot ? def.shoot.cd : 1.2), stun: 0, flash: 0, kx: 0, ky: 0, ang: 0,
    strafe: Math.random() < 0.5 ? 1 : -1, strafeT: rnd(1, 3), los: true, losT: Math.random() * 0.2, camp: o.camp || null, dead: false,
    state: 'move', st: 0, burst: 0, mob: false, xpV: def.xp, credV: def.cred, col: def.col, chargeCd: rnd(1, 3), invuln: 0, contactCd: 0,
  };
  if (o.lieut) {   // cabecilla de una misión de caza: más grande, más duro y con nombre propio
    e.lieut = true; e.elite = true; e.r = def.r * 1.4; e.hp = e.maxhp = def.hp * (1 + 0.22 * (L - 1)) * 5.2 * cm; e.dmgMul = (1 + 0.12 * (L - 1)) * 1.5;
    e.spd = def.spd * 1.08; e.xpV = def.xp * 7; e.credV = def.cred * 9; e.aggroR = 640; e.def = Object.assign({}, def, { name: o.lieut.name });
  }
  S.enemies.push(e);
  return e;
}

function enemyFire(e, a, sh, col) {
  const n = sh.n || 1;
  for (let i = 0; i < n; i++) {
    const aa = a + (n > 1 ? (i / (n - 1) - 0.5) * 2 * sh.spread : (Math.random() - 0.5) * sh.spread * 2);
    eBullet(e.x + Math.cos(aa) * e.r, e.y + Math.sin(aa) * e.r, aa, sh.spd, sh.dmg * e.dmgMul, col || e.def.col, sh.life ? 5 : 4, sh.life || 3);
  }
  sfx('smg', e.x, e.y);
}
function chaseDir(e, d, tg) {
  if (e.los || d < 120) { const a = angleTo(e.x, e.y, tg.x, tg.y); return { x: Math.cos(a), y: Math.sin(a) }; }
  const f = (FlowSet[tg.idx] || Flow).dir(e.x, e.y);
  if (f) return f;
  const a = angleTo(e.x, e.y, tg.x, tg.y); return { x: Math.cos(a), y: Math.sin(a) };
}
// Explosión de un enemigo que hiere a los jugadores cercanos
function blastPlayers(x, y, r, dmg, col) {
  addRing(x, y, r * 1.2, col, 0.35); addParts(x, y, 20, col, 320, 0.5, 4); sfx('boom', x, y); shake(8, x, y);
  for (const pl of S.players) if (!pl.dead && dist(pl.x, pl.y, x, y) < r + pl.r) hurtPlayer(pl, dmg, x, y);
}
// El dron médico cura a los enemigos cercanos
function healAllies(e, dt) {
  const h = e.def.heal;
  for (const o of S.enemies) {
    if (o.dead || o === e || o.boss || o.hp >= o.maxhp || o.def.fixed) continue;
    if (dist(e.x, e.y, o.x, o.y) < h.r) o.hp = Math.min(o.maxhp, o.hp + o.maxhp * h.rate * dt * (e.stun > 0 ? 0 : 1));
  }
}
function stepEnemy(e, vx, vy, dt) {
  if (e.def.fly) { e.x += vx * dt; e.y += vy * dt; } else moveBy(e, vx * dt, vy * dt);
}

function updateEnemies(dt) {
  const list = S.enemies;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.dead) continue;
    e.flash = Math.max(0, e.flash - dt);
    if (e.invuln > 0) e.invuln -= dt;
    e.contactCd = Math.max(0, e.contactCd - dt);
    const tg = nearestPl(e.x, e.y);
    if (!tg) continue;
    const d = dist(e.x, e.y, tg.x, tg.y);
    e.tg = tg.id;
    if (d > 1500) { if (e.boss) e.hp = Math.min(e.maxhp, e.hp + 60 * dt); continue; }
    if (Math.abs(e.kx) + Math.abs(e.ky) > 5) {
      if (e.def.fly) { e.x += e.kx * dt; e.y += e.ky * dt; } else moveBy(e, e.kx * dt, e.ky * dt);
      const f = Math.exp(-dt * 8); e.kx *= f; e.ky *= f;
    }
    if (e.stun > 0) { e.stun -= dt; if (e.stun <= 0) e.hacked = 0; continue; }
    e.losT -= dt;
    if (e.losT <= 0) { e.losT = 0.2 + Math.random() * 0.1; e.los = hasLOS(S.world, e.x, e.y, tg.x, tg.y); }
    if (e.boss) { updateBoss(e, dt, d, tg); continue; }
    if (!e.aggro) {
      if (d < e.aggroR && (d < 280 || e.los)) e.aggro = true; else continue;
    }
    const def = e.def, toP = angleTo(e.x, e.y, tg.x, tg.y);
    e.ang = toP;
    let mvx = 0, mvy = 0, sp = e.spd;
    if (def.heal) healAllies(e, dt);

    if (def.fixed) {
      e.cd -= dt;
      if (e.los && d < 580 && e.cd <= 0) {
        enemyFire(e, toP, def.shoot);
        e.burst++;
        if (e.burst >= def.shoot.burst) { e.burst = 0; e.cd = def.shoot.burstCd; } else e.cd = def.shoot.cd;
      }
      continue;
    }

    if (def.snipe) { // francotirador
      const sn = def.snipe;
      if (e.state === 'aim') {
        e.st -= dt; sp = 0;
        if (e.st > 0.25) e.ang = toP;
        if (e.st <= 0) {
          eBullet(e.x, e.y, e.ang, sn.spd, sn.dmg * e.dmgMul, '#c05cff', 5, 2);
          sfx('rail', e.x, e.y); e.state = 'move'; e.cd = sn.cd * rnd(0.9, 1.2);
        }
      } else {
        e.cd -= dt;
        if (e.cd <= 0 && e.los && d < 800 && d > 160) { e.state = 'aim'; e.st = sn.tele; sfx('tele', e.x, e.y); }
        if (d > def.pref + 60) { const c = chaseDir(e, d, tg); mvx = c.x; mvy = c.y; }
        else if (d < def.pref - 120) { mvx = -Math.cos(toP); mvy = -Math.sin(toP); }
      }
    } else if (def.fuse) { // chico bomba: corre hacia ti y detona tras una mecha corta
      const fu = def.fuse;
      if (e.state === 'fuse') {
        e.st -= dt; const c = chaseDir(e, d, tg); mvx = c.x; mvy = c.y; sp = e.spd * 0.8;      // sigue avanzando con la mecha encendida
        if (e.st <= 0) { blastPlayers(e.x, e.y, fu.r, fu.dmg * e.dmgMul, def.col); e.hp = 0; killEnemy(e); continue; }
      } else {
        const c = chaseDir(e, d, tg); mvx = c.x; mvy = c.y;
        if (d < fu.range && e.los) { e.state = 'fuse'; e.st = fu.time; sfx('tele', e.x, e.y); }
      }
    } else if (def.charge) { // cíborg frenético
      const ch = def.charge;
      if (e.state === 'tele') {
        e.st -= dt; sp = 0;
        if (e.st > 0.2) e.ang = toP;
        if (e.st <= 0) { e.state = 'charge'; e.st = ch.dur; e.hitC = false; }
      } else if (e.state === 'charge') {
        e.st -= dt; mvx = Math.cos(e.ang); mvy = Math.sin(e.ang); sp = ch.spd;
        if (!e.hitC && d < e.r + tg.r + 4) { e.hitC = true; hurtPlayer(tg, ch.dmg * e.dmgMul, e.x, e.y); }
        if (e.st <= 0) { e.state = 'move'; e.chargeCd = ch.cd * rnd(0.9, 1.3); }
      } else {
        e.chargeCd -= dt;
        if (e.chargeCd <= 0 && e.los && d < 420 && d > 120) { e.state = 'tele'; e.st = ch.tele; e.ang = toP; sfx('tele', e.x, e.y); }
        const c = chaseDir(e, d, tg); mvx = c.x; mvy = c.y;
        if (d < e.r + tg.r + 8) { mvx = mvy = 0; if (e.contactCd <= 0) { e.contactCd = def.melee.cd; hurtPlayer(tg, def.melee.dmg * e.dmgMul, e.x, e.y); } }
      }
    } else if (def.melee) { // matón
      if (def.blink) { // asesino holo: se teletransporta junto al jugador
        e.blinkCd = (e.blinkCd === undefined ? rnd(1, 2.5) : e.blinkCd) - dt;
        if (e.blinkCd <= 0 && d > 240 && d < 700) {
          e.blinkCd = def.blink.cd * rnd(0.85, 1.3);
          const a = tg.ang + Math.PI + rnd(-1.2, 1.2), f = findFree(tg.x + Math.cos(a) * def.blink.near, tg.y + Math.sin(a) * def.blink.near, e.r);
          addParts(e.x, e.y, 10, def.col, 220, 0.35); addRing(e.x, e.y, 50, def.col, 0.25);
          e.x = f.x; e.y = f.y; e.kx = e.ky = 0; e.los = true;
          addParts(e.x, e.y, 12, def.col, 240, 0.4); addRing(e.x, e.y, 60, def.col, 0.3); sfx('dash', e.x, e.y);
        }
      }
      const c = chaseDir(e, d, tg); mvx = c.x; mvy = c.y;
      if (d < e.r + tg.r + 8) {
        mvx = mvy = 0;
        if (e.contactCd <= 0) { e.contactCd = def.melee.cd; hurtPlayer(tg, def.melee.dmg * e.dmgMul, e.x, e.y); addParts(tg.x, tg.y, 4, '#ff9a3c', 120, 0.25); }
      }
    } else if (def.spit) { // mutante escupidor: lanza charcos tóxicos a donde vas a estar
      const sp2 = def.spit, pref = def.pref;
      if (d > pref + 50) { const c = chaseDir(e, d, tg); mvx = c.x; mvy = c.y; }
      else if (d < pref - 90 && e.los) { mvx = -Math.cos(toP); mvy = -Math.sin(toP); }
      else { e.strafeT -= dt; if (e.strafeT <= 0) { e.strafe *= -1; e.strafeT = rnd(1.2, 3); } const pa = toP + (Math.PI / 2) * e.strafe; mvx = Math.cos(pa) * 0.6; mvy = Math.sin(pa) * 0.6; }
      e.cd -= dt;
      if (e.cd <= 0 && e.los && d < 600) {
        const f = findFree(tg.x + (tg.vx || 0) * 0.45, tg.y + (tg.vy || 0) * 0.45, 10);
        S.zones.push({ x: f.x, y: f.y, r: sp2.r, t: sp2.tele, tmax: sp2.tele, col: def.col, dmg: sp2.dmg * e.dmgMul, ring: 6 });
        sfx('tele', e.x, e.y); e.cd = sp2.cd * rnd(0.9, 1.25);
      }
    } else if (def.shoot) { // a distancia (pandillero, dron, guardia)
      const sh = def.shoot, pref = def.pref;
      if (d > pref + 50) { const c = chaseDir(e, d, tg); mvx = c.x; mvy = c.y; }
      else if (d < pref - 70 && e.los) { mvx = -Math.cos(toP); mvy = -Math.sin(toP); }
      else {
        e.strafeT -= dt; if (e.strafeT <= 0) { e.strafe *= -1; e.strafeT = rnd(1.2, 3); }
        const pa = toP + (Math.PI / 2) * e.strafe; mvx = Math.cos(pa) * 0.7; mvy = Math.sin(pa) * 0.7;
      }
      e.cd -= dt;
      const reach = sh.life ? sh.spd * sh.life + 30 : pref + 280;
      if (e.cd <= 0 && e.los && d < reach) {
        enemyFire(e, toP, sh);
        if (sh.burst) { e.burst = (e.burst || 0) + 1; if (e.burst >= sh.burst) { e.burst = 0; e.cd = sh.burstCd * rnd(0.9, 1.2); } else e.cd = sh.cd; }
        else e.cd = sh.cd * rnd(0.9, 1.25);
      }
    }
    if (def.fly) { e.wob = (e.wob || 0) + dt * 3; mvx += Math.cos(e.wob) * 0.25; mvy += Math.sin(e.wob * 1.3) * 0.25; }
    stepEnemy(e, mvx * sp, mvy * sp, dt);
    // separación entre enemigos
    for (let j = i + 1; j < list.length; j++) {
      const o = list[j];
      if (o.dead || o.boss || !!o.def.fly !== !!e.def.fly || o.def.fixed) continue;
      const dx = e.x - o.x, dy = e.y - o.y, dd = Math.hypot(dx, dy), mn = e.r + o.r;
      if (dd < mn && dd > 0.01) { const push = (mn - dd) * 0.5; moveBy(e, (dx / dd) * push, (dy / dd) * push); moveBy(o, (-dx / dd) * push, (-dy / dd) * push); }
    }
  }
}

// ───────── Jefes ─────────
function spawnBoss(id, pos) {
  const b = BOSSES[id];
  const lv = gateLv();
  const L = Math.max(1, Math.round(avgLv() * 0.8 + id * 2));
  const hp = b.hp * (1 + 0.07 * Math.max(0, lv - BOSS_REQ[id])) * (1 + 0.8 * (nPlayers() - 1));
  const f = findFree(pos.x, pos.y, b.r);
  const e = {
    id: S.nid++, type: 'boss', boss: true, bossId: id, def: { name: b.name, col: b.col, fly: false }, x: f.x, y: f.y, r: b.r, hp, maxhp: hp, level: L, elite: false,
    dmgMul: 1 + 0.07 * (L - 1), spd: b.spd, aggro: true, stun: 0, flash: 0, kx: 0, ky: 0, ang: 0, phase: 1, cd: 2.4, atk: null, lastAtk: '',
    los: true, losT: 0, invuln: 1.4, xpV: 0, credV: 0, col: b.col, camp: null, mob: false, dead: false, contactCd: 0, strafe: 1, strafeT: 2,
  };
  S.enemies.push(e); S.boss = e;
  if (Net.host) Net.toAll(['ban', b.name, b.title, b.col]);
  S.banner = { text: b.name, sub: b.title, col: b.col, t: 4, max: 4 };
  sfx('boss', e.x, e.y); shake(10);
  notifyAll(`¡${b.name} os ha visto!`, b.col, 4);
}

function endBossAttack(e) {
  const ph = e.phase;
  e.lastAtk = e.atk ? e.atk.name : '';
  e.atk = null;
  e.cd = [2.0, 1.55, 1.15][ph - 1] * rnd(0.85, 1.15);
}

function updateBoss(e, dt, d, tg) {
  const b = BOSSES[e.bossId];
  const hpf = e.hp / e.maxhp;
  const ph = hpf > 0.66 ? 1 : hpf > 0.33 ? 2 : 3;
  if (ph !== e.phase) {
    e.phase = ph; e.invuln = 1.4; e.atk = null; e.cd = 1.2;
    notifyAll(`${b.name}: FASE ${ph}`, b.col, 3); addRing(e.x, e.y, 320, b.col, 0.7); shake(14); sfx('boss', e.x, e.y);
    for (let k = 0; k < 16; k++) eBullet(e.x, e.y, (k / 16) * TAU, 240, 8 * e.dmgMul, b.col, 5);
  }
  const toP = angleTo(e.x, e.y, tg.x, tg.y);
  if (e.atk) runBossAttack(e, dt, d, toP, tg);
  else {
    e.cd -= dt;
    const pref = 290;
    let mvx = 0, mvy = 0;
    if (d > pref + 60) { const c = chaseDir(e, d, tg); mvx = c.x; mvy = c.y; }
    else if (d < pref - 90) { mvx = -Math.cos(toP); mvy = -Math.sin(toP); }
    else { e.strafeT -= dt; if (e.strafeT <= 0) { e.strafe *= -1; e.strafeT = rnd(1.5, 3); } const pa = toP + (Math.PI / 2) * e.strafe; mvx = Math.cos(pa) * 0.6; mvy = Math.sin(pa) * 0.6; }
    const sp = e.spd * (0.7 + 0.15 * ph);
    moveBy(e, mvx * sp * dt, mvy * sp * dt);
    if (e.cd <= 0) {
      let pool = b.atk[ph].filter(n => n !== e.lastAtk);
      if (!pool.length) pool = b.atk[ph];
      const name = pick(pool);
      e.atk = { name, t: 0, n: 0, init: false };
    }
  }
  for (const q of S.players) if (!q.dead && dist(e.x, e.y, q.x, q.y) < e.r + q.r && e.contactCd <= 0) { e.contactCd = 0.8; hurtPlayer(q, 14 * e.dmgMul, e.x, e.y); }
}

function runBossAttack(e, dt, d, toP, tg) {
  const a = e.atk, b = BOSSES[e.bossId], ph = e.phase, col = b.col;
  a.t += dt;
  const dm = e.dmgMul;
  switch (a.name) {
    case 'fan': {
      const volleys = 2 + (ph > 2 ? 1 : 0);
      if (a.t < 0.35) a.ang = toP;
      if (!a.init) { a.init = true; a.ang = toP; sfx('tele', e.x, e.y); }
      if (a.n < volleys && a.t >= 0.5 + a.n * 0.4) {
        const cnt = 5 + ph * 2;
        for (let i = 0; i < cnt; i++) eBullet(e.x, e.y, a.ang - 0.5 + (i / (cnt - 1)) * 1.0, 330 + ph * 30, 10 * dm, col, 5);
        a.n++; a.ang = angleTo(e.x, e.y, tg.x, tg.y); sfx('shotgun', e.x, e.y);
      }
      if (a.n >= volleys && a.t > 0.5 + volleys * 0.4 + 0.2) endBossAttack(e);
      break;
    }
    case 'ring': {
      if (!a.init) { a.init = true; sfx('tele', e.x, e.y); }
      if (a.n < 2 && a.t >= 0.5 + a.n * 0.55) {
        const cnt = 14 + ph * 4, off = a.n * (TAU / cnt / 2);
        for (let i = 0; i < cnt; i++) eBullet(e.x, e.y, off + (i / cnt) * TAU, 230 + ph * 20, 9 * dm, col, 5);
        a.n++; addRing(e.x, e.y, 90, col, 0.3); sfx('boom', e.x, e.y);
      }
      if (a.t > 1.9) endBossAttack(e);
      break;
    }
    case 'spiral': {
      if (!a.init) { a.init = true; a.ang = toP; a.nextT = 0.4; sfx('tele', e.x, e.y); }
      if (a.t >= a.nextT && a.t < 2.1) {
        a.nextT += 0.07; a.ang += 0.42;
        const arms = ph >= 3 ? 3 : 2;
        for (let k = 0; k < arms; k++) eBullet(e.x, e.y, a.ang + (k * TAU) / arms, 270, 8 * dm, col, 4);
      }
      if (a.t > 2.4) endBossAttack(e);
      break;
    }
    case 'charge': {
      if (!a.init) { a.init = true; a.ang = toP; sfx('tele', e.x, e.y); }
      if (a.t < 0.5) a.ang = toP;
      if (a.t >= 0.7 && a.t < 1.25) {
        moveBy(e, Math.cos(a.ang) * 740 * dt, Math.sin(a.ang) * 740 * dt);
        if (!a.hit) for (const q of S.players) if (!q.dead && dist(e.x, e.y, q.x, q.y) < e.r + q.r + 6) { a.hit = true; hurtPlayer(q, 26 * dm, e.x, e.y); }
        if (Math.random() < 0.6) addParts(e.x, e.y, 1, col, 80, 0.3, 4);
      }
      if (a.t > 1.8) endBossAttack(e);
      break;
    }
    case 'slam': {
      const total = ph >= 3 ? 2 : 1;
      if (a.n < total && a.t >= 0.2 + a.n * 1.1) {
        S.zones.push({ x: tg.x, y: tg.y, r: 118 + ph * 10, t: 0.95, tmax: 0.95, col, dmg: 30 * dm, ring: 8 + ph * 2 });
        a.n++; sfx('tele', e.x, e.y);
      }
      if (a.t > 1.5 + (total - 1) * 1.1) endBossAttack(e);
      break;
    }
    case 'bomb': {
      if (!a.init) {
        a.init = true;
        const n = 4 + ph;
        for (let i = 0; i < n; i++) {
          const ox = i === 0 ? 0 : rnd(-260, 260), oy = i === 0 ? 0 : rnd(-260, 260);
          S.zones.push({ x: tg.x + ox, y: tg.y + oy, r: 78, t: 1.0 + i * 0.16, tmax: 1.0 + i * 0.16, col, dmg: 24 * dm });
        }
        sfx('tele', e.x, e.y);
      }
      if (a.t > 1.9) endBossAttack(e);
      break;
    }
    case 'laser': {
      if (!a.init) {
        a.init = true;
        const cnt = ph >= 3 ? 3 : 2, dir = Math.random() < 0.5 ? 1 : -1;
        for (let k = 0; k < cnt; k++) S.beams.push({ x: e.x, y: e.y, ang: toP + (k * TAU) / cnt, len: 1000, t: 3.6, tele: 0.8, spin: (0.8 + 0.12 * ph) * dir, dmg: 70 * dm, tick: 0, col, owner: e });
        sfx('boss', e.x, e.y);
      }
      if (a.t > 4.0) endBossAttack(e);
      break;
    }
    case 'summon': {
      if (!a.init && a.t >= 0.4) {
        a.init = true;
        let alive = 0; for (const x of S.enemies) if (!x.dead && x.summoner === e) alive++;
        const n = Math.min(3 + ph, 9 - alive);
        for (let i = 0; i < n; i++) {
          const ang = (i / Math.max(1, n)) * TAU + Math.random();
          const f = findFree(e.x + Math.cos(ang) * 100, e.y + Math.sin(ang) * 100, 14);
          const m = spawnEnemy(b.minion, f.x, f.y, { level: Math.max(1, e.level - 2), elite: false });
          m.aggro = true; m.mob = true; m.summoner = e; addParts(f.x, f.y, 8, col, 180, 0.4);
        }
        addRing(e.x, e.y, 160, col, 0.5); sfx('ability', e.x, e.y);
      }
      if (a.t > 1.1) endBossAttack(e);
      break;
    }
    default: endBossAttack(e);
  }
}
