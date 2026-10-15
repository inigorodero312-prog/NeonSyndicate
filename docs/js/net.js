'use strict';
// ───────── Cooperativo LAN: transporte, protocolo e instantáneas ─────────
// El anfitrión ejecuta toda la simulación. Los clientes mandan su estado (posición, apuntado, disparo) y sus
// acciones; el anfitrión les devuelve instantáneas (~20 Hz) con lo que ven a su alrededor.
const NET_VER = 'NS-COOP-1';
const NET_MAX = 4;
const SNAP_DT = 0.05, IN_DT = 1 / 30;
const SNAP_RX = 1350, SNAP_RY = 980;                 // zona (px) alrededor del jugador que se le envía
const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;

const Net = {
  live: false,            // hay una partida cooperativa en marcha (no solo el lobby)
  role: null,             // 'host' | 'client' | null
  myId: 0,
  peers: new Map(),       // anfitrión: conexiones (id → { id, ip, name, charId, ready, meta, pl, loaded, joined })
  lobby: null,            // { slots:[{id,name,charId,ready}], cfg }
  found: {},              // partidas descubiertas en la LAN
  ips: [], port: 47800, msg: '', started: false,
  snapT: 0, inT: 0, lastSnap: 0, seq: 0, stats: null, _pk: '', q: null, cboss: null, startCfg: null, welcome: false,
  get avail() { return typeof window !== 'undefined' && !!window.NSNet; },
  get active() { return this.live && !!this.role; },
  get host() { return this.live && this.role === 'host'; },
  get client() { return this.live && this.role === 'client'; },
  get inLobby() { return !this.live && !!this.role; },

  // ───────── Envío ─────────
  _enc(m) { return JSON.stringify(m); },
  toAll(m) { if (this.role === 'host' && this.avail) window.NSNet.broadcast(this._enc(m)); },
  toId(id, m) { if (this.role === 'host' && this.avail) window.NSNet.send(id, this._enc(m)); },
  toPlayer(pl, m) { if (pl && this.peers.has(pl.id)) this.toId(pl.id, m); },
  sendHost(m) { if (this.role === 'client' && this.avail) window.NSNet.send(0, this._enc(m)); },

  leave() {
    if (this.role === 'host' && this.avail) { try { this.toAll(['bye']); } catch (e) { /* nada */ } }
    if (this.role && this.avail) { window.NSNet.announce(null); window.NSNet.browse(false); window.NSNet.close(); }
    this.live = false; this.role = null; this.peers.clear(); this.lobby = null; this.started = false; this.msg = '';
    this.q = []; this.cboss = null; this.stats = null;
  },
  init() {
    if (!this.avail) return;
    window.NSNet.onEvent((ev) => this._ev(ev));
    window.NSNet.ips().then((l) => { this.ips = l || []; });
  },
  _ev(ev) {
    if (ev.t === 'found') { const k = ev.info.id || (ev.ip + ':' + (ev.info.port || 47800)), old = this.found[k], loop = ev.ip.startsWith('127.');
      if (!old || !loop || performance.now() - old.t > 3000) this.found[k] = { ip: loop && old ? old.ip : ev.ip, port: ev.info.port || 47800, info: ev.info, t: performance.now() };
      else old.t = performance.now();
      return; }
    if (ev.t === 'err') { this.msg = 'Error de red: ' + ev.m; return; }
    if (ev.t === 'conn') { if (this.role === 'host') this._hostConn(ev.id, ev.ip); return; }
    if (ev.t === 'close') { if (this.role === 'host') this._hostClose(ev.id); else if (this.role === 'client') this._clientClose(); return; }
    if (ev.t === 'msg') {
      let m; try { m = JSON.parse(ev.d); } catch (e) { return; }
      if (!Array.isArray(m)) return;
      try { if (this.role === 'host') this._hostMsg(ev.id, m); else if (this.role === 'client') this._clientMsg(m); }
      catch (err) { console.error('ERROR-NET', m[0], err && err.stack || err); }
    }
  },

  // ───────── Lobby: anfitrión ─────────
  metaOf(S0) { return { up: S0.up, perks: S0.perks, weapons: S0.weapons, chars: S0.chars, raid: !!S0.raid }; },
  takenBy(charId, except) { if (!this.lobby) return null; const s = this.lobby.slots.find(x => x.charId === charId && x.id !== except); return s ? s.id : null; },
  freeChar(pref) {
    if (pref && this.takenBy(pref) === null) return pref;
    const c = CHARS.find(c => this.takenBy(c.id) === null); return c ? c.id : CHARS[0].id;
  },
  async hostGame(name, charId) {
    this.leave(); this.msg = '';
    if (!this.avail) { this.msg = 'El cooperativo LAN solo está en la versión de PC (Windows).'; return false; }
    const r = await window.NSNet.host(this.port);
    if (!r.ok) { this.msg = r.error === 'EADDRINUSE' ? 'El puerto 47800 ya está en uso (¿otra partida abierta?).' : 'No se pudo abrir la partida: ' + r.error; return false; }
    this.role = 'host'; this.myId = 0; this.ips = r.ips || this.ips; this.peers.clear();
    this.lobby = { slots: [{ id: 0, name, charId, ready: true }] };
    this._announce();
    return true;
  },
  _announce() {
    if (this.role !== 'host' || !this.lobby || !this.avail) return;
    window.NSNet.announce({ id: this.gid || (this.gid = Math.random().toString(36).slice(2, 9)), name: this.lobby.slots[0].name, players: this.lobby.slots.length, max: NET_MAX, ver: NET_VER, started: this.started });
  },
  _lobbyBroadcast() {
    if (this.role !== 'host' || !this.lobby) return;
    this.toAll(['lobby', this.lobby.slots]);
    this._announce();
  },
  _hostConn(id, ip) {
    if (this.started || this.live) { this.toId(id, ['reject', 'La partida ya ha empezado.']); setTimeout(() => window.NSNet.kick(id), 300); return; }
    if (this.lobby.slots.length >= NET_MAX) { this.toId(id, ['reject', 'La partida está llena (máximo 4).']); setTimeout(() => window.NSNet.kick(id), 300); return; }
    this.peers.set(id, { id, ip, name: '', charId: null, ready: false, meta: null, pl: null, loaded: false, joined: false, lastIn: 0 });
  },
  _hostClose(id) {
    const p = this.peers.get(id); if (!p) return;
    this.peers.delete(id);
    if (this.lobby && !this.live) {
      const i = this.lobby.slots.findIndex(s => s.id === id);
      if (i >= 0) { this.lobby.slots.splice(i, 1); this._lobbyBroadcast(); }
    }
    if (this.live && p.pl) {
      const i = S.players.indexOf(p.pl); if (i >= 0) S.players.splice(i, 1);
      notifyAll(`${p.name} se ha desconectado.`, '#ff8a1a', 4);
      if (S.mission && S.mission.carrier === p.id) { S.mission.carrier = -1; }
    }
  },
  canStart() { return this.role === 'host' && this.lobby && this.lobby.slots.every(s => s.ready) && this.lobby.slots.length >= 1; },
  // Devuelve la configuración que usa la partida (la misma para todos)
  buildStart() {
    const seed = (Math.random() * 4294967295) >>> 0;
    const roster = this.lobby.slots.map(s => ({ id: s.id, charId: s.charId, name: s.name }));
    return { seed, roster };
  },

  // ───────── Lobby: cliente ─────────
  async joinGame(ip, name, charId, port) {
    this.leave(); this.msg = '';
    if (!this.avail) { this.msg = 'El cooperativo LAN solo está en la versión de PC (Windows).'; return false; }
    const r = await window.NSNet.connect(ip, port || this.port);
    if (!r.ok) { this.msg = r.error === 'TIMEOUT' ? 'No hay respuesta de ese ordenador. Revisa la IP y el cortafuegos.' : 'No se pudo conectar (' + r.error + ').'; return false; }
    this.role = 'client'; this.myId = 0; this.lobby = { slots: [] }; this.welcome = false;
    this.sendHost(['hello', { ver: NET_VER, name, charId, meta: this.metaOf(SAVE) }]);
    return true;
  },
  setPick(charId) {
    if (this.role === 'host') {
      const me = this.lobby.slots[0]; if (this.takenBy(charId, 0) !== null) return false;
      me.charId = charId; this._lobbyBroadcast(); return true;
    }
    if (this.role === 'client') { this.sendHost(['pick', charId]); return true; }
    return false;
  },
  setReady(v) { if (this.role === 'client') this.sendHost(['ready', v ? 1 : 0]); },
  kickSlot(id) { if (this.role === 'host' && id) { window.NSNet.kick(id); } },

  // ───────── Mensajes que recibe el anfitrión ─────────
  _hostMsg(id, m) {
    const p = this.peers.get(id); if (!p) return;
    const k = m[0];
    if (k === 'hello') {
      const o = m[1] || {};
      if (o.ver !== NET_VER) { this.toId(id, ['reject', 'Versión distinta del juego. Instala la misma en todos los ordenadores.']); setTimeout(() => window.NSNet.kick(id), 300); return; }
      if (this.lobby.slots.length >= NET_MAX || this.started) { this.toId(id, ['reject', 'La partida está llena.']); return; }
      p.name = String(o.name || 'Jugador').slice(0, 14); p.meta = o.meta || { up: {}, perks: [], weapons: [], chars: [], raid: false };
      p.charId = this.freeChar(o.charId); p.joined = true;
      // nombres repetidos → se numeran
      let n = p.name, c = 2; while (this.lobby.slots.some(s => s.name === n)) n = p.name + ' ' + (c++);
      p.name = n;
      this.lobby.slots.push({ id, name: p.name, charId: p.charId, ready: false });
      this.toId(id, ['welcome', id]);
      this._lobbyBroadcast();
      return;
    }
    if (!p.joined) return;
    if (k === 'pick' && !this.live) {
      const s = this.lobby.slots.find(x => x.id === id);
      if (s && CHARS.some(c => c.id === m[1]) && this.takenBy(m[1], id) === null) s.charId = m[1];
      this._lobbyBroadcast(); return;
    }
    if (k === 'ready' && !this.live) { const s = this.lobby.slots.find(x => x.id === id); if (s) { s.ready = !!m[1]; this._lobbyBroadcast(); } return; }
    if (!this.live) return;
    if (k === 'loaded') { p.loaded = true; return; }
    if (k === 'quit') { window.NSNet.kick(id); return; }
    const pl = p.pl; if (!pl || !S) return;
    switch (k) {
      case 'in': {
        const x = +m[1], y = +m[2];
        if (!isFinite(x) || !isFinite(y)) break;
        if (!pl.dead && !pl.ghost) { pl.x = clamp(x, 8, WW * TILE - 8); pl.y = clamp(y, 8, WH * TILE - 8); }
        pl.ang = +m[3] || 0; pl.vx = +m[4] || 0; pl.vy = +m[5] || 0;
        pl.net.fire = !!m[6] && !pl.busy && !pl.choosing;
        if (pl.weapons[m[7] | 0]) pl.cur = m[7] | 0;
        pl.net.t = S.time; break;
      }
      case 'dash': { const dx = +m[1] || 0, dy = +m[2] || 0; tryDash(pl, dx, dy); break; }
      case 'ab': { pl.ang = +m[1] || pl.ang; useAbility(pl, { x: +m[2] || pl.x, y: +m[3] || pl.y }); break; }
      case 'int': hostInteract(pl, m[1], m[2]); break;
      case 'busy': pl.busy = !!m[1]; break;
      case 'perk': {
        if (pl.choosing && pl.choices && pl.choices.some(c => c.id === m[1])) {
          applyPerk(pl, m[1]); pl.pendingLevel = Math.max(0, pl.pendingLevel - 1); pl.choosing = false; pl.choices = null;
        }
        break;
      }
      case 'board': {
        const hub = S.world.hubs[m[1] | 0]; if (!hub) break;
        const hp = hubPos(hub); if (dist(pl.x, pl.y, hp.fixer.x, hp.fixer.y) > 260) break;
        if (!S.boards[hub.id]) S.boards[hub.id] = makeContracts(hub);
        this.toId(id, ['board', hub.id, S.boards[hub.id].map(plainContract), S.mission ? S.mission.title : '']); break;
      }
      case 'accept': {
        const list = S.boards[m[1] | 0]; if (!list) break;
        const c = list[m[2] | 0]; if (!c) break;
        if (acceptContract(c, pl)) list[m[2] | 0] = null;
        break;
      }
      case 'shop': {
        const hub = S.world.hubs[m[1] | 0]; if (!hub) break;
        const hp = hubPos(hub); if (dist(pl.x, pl.y, hp.shop.x, hp.shop.y) > 260) break;
        if (!S.shops[hub.id]) S.shops[hub.id] = makeShop(hub);
        this.toId(id, ['shop', hub.id, S.shops[hub.id]]); break;
      }
      case 'buy': {
        const items = S.shops[m[1] | 0]; if (!items) break;
        const it = items.find(x => x.id === m[2]); if (it) buyItem(it, pl, S.world.hubs[m[1] | 0]);
        this.toId(id, ['shop', m[1] | 0, items]); break;
      }
      case 'rest': {
        let ok = false;
        for (const h of S.world.houses) if (dist(pl.x, pl.y, h.x, h.y) < 260) ok = true;
        if (ok) restPlayer(pl);
        break;
      }
    }
  },

  // ───────── Mensajes que recibe el cliente ─────────
  _clientClose() {
    if (this.live && S && !S.over) {
      const st = this.stats || { victory: false, kills: S.kills, missions: S.missionsDone, bosses: S.bossKills, district: S.maxDistrict, bonus: S.bonusChips, time: S.time, players: S.players.length };
      settleRun(st);
      if (S.summary) S.summary.msg = 'Se perdió la conexión con el anfitrión.';
    } else if (!this.live) {
      this.msg = 'Se perdió la conexión con el anfitrión.';
      this.role = null; this.lobby = null;
      if (Game.state === 'lobby' || Game.state === 'loading') Game.state = 'coop';
    }
  },
  _clientMsg(m) {
    switch (m[0]) {
      case 'welcome': this.myId = m[1]; this.welcome = true; break;
      case 'reject': this.msg = m[1] || 'El anfitrión ha rechazado la conexión.'; this.role = null; this.lobby = null; window.NSNet.close(); if (Game.state === 'lobby') Game.state = 'coop'; break;
      case 'bye': this.msg = 'El anfitrión ha cerrado la partida.'; if (!this.live) { this.role = null; this.lobby = null; if (Game.state === 'lobby') Game.state = 'coop'; } break;
      case 'lobby': this.lobby = { slots: m[1] }; break;
      case 'start': this.onStart(m[1]); break;
      case 'go': if (S) S.hold = false; break;
      case 'snap': if (this.live && S) this.applySnap(m); break;
      case 'n': notify(m[1], m[2], m[3]); break;
      case 'sp': Snd.play(m[1]); break;
      case 'sh2': if (S) S.shake = Math.max(S.shake, m[1]); break;
      case 'ban': if (S) { S.banner = { text: m[1], sub: m[2], col: m[3], t: 4, max: 4 }; } break;
      case 'lvl': this.q = m[1]; break;
      case 'end': if (S && !S.over) { this.stats = m[1]; settleRun(m[1]); } break;
      case 'board': {
        const hub = S.world.hubs[m[1]]; if (!hub) break;
        Game.board = { hub, list: m[2], active: m[3] }; Game.state = 'board'; Snd.play('click'); break;
      }
      case 'shop': {
        const hub = S.world.hubs[m[1]]; if (!hub) break;
        if (Game.state !== 'shop') Snd.play('click');
        Game.shop = { hub, items: m[2] }; Game.state = 'shop'; break;
      }
    }
  },
  onStart(cfg) {
    // lo atiende la pantalla de lobby (carga del mundo)
    this.startCfg = cfg; this.started = true;
    Game.coopStart = cfg;
  },

  // Peticiones de interfaz del cliente
  reqBoard(id) { this.sendHost(['board', id]); },
  reqShop(id) { this.sendHost(['shop', id]); },

  // ───────── Anfitrión: bucle de red durante la partida ─────────
  hostTick(dt) {
    // esperar a que todos terminen de cargar
    if (S.hold) {
      S.holdT = (S.holdT || 0) + dt;
      let all = true; for (const p of this.peers.values()) if (p.pl && !p.loaded) all = false;
      if (all || S.holdT > 15) { S.hold = false; this.toAll(['go']); }
      S.fxq.length = 0; return;
    }
    this.snapT += dt;
    if (this.snapT < SNAP_DT) return;
    this.snapT = 0;
    for (const p of this.peers.values()) { if (p.pl && p.loaded) this.toId(p.id, this.buildSnap(p)); }
    S.fxq.length = 0;
  },
  buildSnap(peer) {
    const pl = peer.pl;
    const cpl = pl.dead ? (nearestPl(pl.x, pl.y) || pl) : pl;
    const cx = cpl.x, cy = cpl.y;
    const inb = (x, y) => Math.abs(x - cx) < SNAP_RX && Math.abs(y - cy) < SNAP_RY;
    const me = {
      hp: r1(pl.hp), sh: r1(pl.shield), lv: pl.level, xp: Math.floor(pl.xp), xn: pl.xpNext, cr: pl.cred, pk: pl.perks, ab: pl.armorBought, cl: pl.clones,
      w: pl.weapons, cur: pl.cur, abcd: r2(pl.abCd), dead: pl.dead ? 1 : 0, carry: pl.carry ? 1 : 0, iv: r2(pl.invuln), ht: r2(pl.hurtT), pend: pl.pendingLevel,
      adr: r2(pl.buff.adren), kills: pl.kills,
    };
    const others = [];
    for (const q of S.players) {
      if (q === pl) continue;
      const w = q.weapons[q.cur] || q.weapons[0];
      const f = (q.dashT > 0 ? 1 : 0) | (q.ghost ? 2 : 0) | (q.buff.adren > 0 ? 4 : 0) | (q.invuln > 0.3 ? 8 : 0) | (q.hurtT > 0 ? 16 : 0) | (q.carry ? 32 : 0);
      others.push([q.id, r1(q.x), r1(q.y), r2(q.ang), Math.round(q.hp), Math.round(q.maxhp), q.level, q.dead ? 1 : 0, f, w.id, w.tier, q.swing > 0 ? r2(q.swing) : 0, q.swingFlip, r2(q.swingAng), q.shieldMax > 0 ? r2(q.shield / q.shieldMax) : 0]);
    }
    const en = [];
    for (const e of S.enemies) {
      if (e.dead || !inb(e.x, e.y)) continue;
      const f = (e.elite ? 1 : 0) | (e.stun > 0 ? 2 : 0) | (e.hacked > 0 ? 4 : 0) | (e.flash > 0 ? 8 : 0) | (e.boss ? 16 : 0) | (e.invuln > 0 ? 32 : 0) | (e.aggro ? 64 : 0) | (e.lieut ? 128 : 0);
      const a = [e.id, e.type, r1(e.x), r1(e.y), r2(e.ang), Math.round(e.hp), Math.round(e.maxhp), r1(e.r), f, e.state || '', r2(e.st || 0), e.level];
      if (e.boss) a.push(e.bossId, e.phase, e.atk ? e.atk.name : '', e.atk ? r2(e.atk.t) : 0, e.atk && e.atk.ang !== undefined ? r2(e.atk.ang) : 0);
      en.push(a);
    }
    const bl = [];
    for (const b of S.bullets) { if (b.pl === pl || !inb(b.x, b.y)) continue; bl.push([r1(b.x), r1(b.y), Math.round(b.vx), Math.round(b.vy), b.r, b.col, b.gren ? 1 : 0]); }
    const eb = [];
    for (const b of S.ebullets) { if (!inb(b.x, b.y)) continue; eb.push([r1(b.x), r1(b.y), Math.round(b.vx), Math.round(b.vy), b.r, b.col]); }
    const tu = [];
    for (const t of S.turrets) if (inb(t.x, t.y)) tu.push([r1(t.x), r1(t.y), r2(t.ang), r1(t.life), t.pl ? t.pl.id : 0]);
    const pk = [];
    for (const p of S.pickups) {
      if (!inb(p.x, p.y)) continue;
      const a = [p.id, p.kind, r1(p.x), r1(p.y), Math.round(p.v || 0)];
      if (p.w) a.push(p.w.id, p.w.tier, p.w.up || 0);
      pk.push(a);
    }
    const zo = [];
    for (const z of S.zones) if (inb(z.x, z.y)) zo.push([r1(z.x), r1(z.y), z.r, r2(z.t), z.tmax, z.col, z.ring || 0]);
    const be = [];
    for (const b of S.beams) be.push([r1(b.x), r1(b.y), r2(b.ang), b.len, r2(b.t), r2(b.tele), b.col, b.spin]);
    let mi = null;
    if (S.mission) {
      mi = plainContract(S.mission);
      if (S.mission.camp) mi.camp = { id: S.mission.camp.id, x: S.mission.camp.x, y: S.mission.camp.y, spawned: !!S.mission.camp.spawned };
      mi.campLeft = S.mission.type === 'raid' ? campLeft(S.mission) : 0;
    }
    const bo = S.boss && !S.boss.dead ? [S.boss.bossId, r1(S.boss.x), r1(S.boss.y), Math.round(S.boss.hp), Math.round(S.boss.maxhp), S.boss.phase] : null;
    const st = [r1(S.time), S.kills, S.bossKills, S.missionsDone, S.maxDistrict, S.bonusChips, S.defeated, S.lib];
    // efectos (partículas, sonidos…) cercanos a este jugador
    const fx = [];
    for (const ev of S.fxq) {
      const k = ev[0];
      if (k === 's' && ev[4] === peer.id) continue;
      if (k === 'sk' && ev[8] === peer.id) continue;
      const ex = ev[1], ey = ev[2];
      if (Math.abs(ex - cx) < FX_RX && Math.abs(ey - cy) < FX_RY) fx.push(ev);
    }
    return ['snap', me, others, en, bl, eb, tu, pk, zo, be, mi, bo, st, fx];
  },
  applySnap(m) {
    this.lastSnap = performance.now();
    const me = m[1];
    const q = P;
    q.shield = me.sh; q.level = me.lv; q.xp = me.xp; q.xpNext = me.xn; q.cred = me.cr; q.clones = me.cl;
    const pkj = JSON.stringify(me.pk) + '|' + me.ab + '|' + me.lv;
    if (pkj !== this._pk) { this._pk = pkj; q.perks = me.pk; q.armorBought = me.ab; recalcPlayer(q, true); q.dashCharges = Math.min(q.dashCharges, q.dashMax); }
    q.hp = me.hp;
    const wl = q.weapons.length;
    q.weapons = me.w;
    if (wl !== me.w.length) q.cur = me.cur; else q.cur = clamp(q.cur, 0, me.w.length - 1);
    if (!(q.abLock > 0)) q.abCd = me.abcd;
    const wasDead = q.dead; q.dead = !!me.dead; if (q.dead && !wasDead) { q.vx = q.vy = 0; }
    q.carry = !!me.carry; q.invuln = Math.max(q.invuln, me.iv); q.hurtT = Math.max(q.hurtT, me.ht); q.buff.adren = me.adr; q.kills = me.kills;
    q.pendingLevel = me.pend;
    // otros jugadores
    const seen = new Set();
    for (const a of m[2]) {
      const o = plById(a[0]); if (!o) continue;
      seen.add(o.id);
      o.tx = a[1]; o.ty = a[2]; o.ang = a[3]; o.hp = a[4]; o.maxhp = a[5]; o.level = a[6]; o.dead = !!a[7];
      const f = a[8]; o.dashT = (f & 1) ? 0.1 : 0; o.ghost = (f & 2) ? { t: 0.1, dx: 0, dy: 0, hit: [] } : null; o.buff.adren = (f & 4) ? 1 : 0;
      o.invuln = (f & 8) ? 0.5 : 0; o.hurtT = (f & 16) ? 0.1 : 0; o.carry = !!(f & 32);
      o.weapons = [{ id: a[9], tier: a[10], up: 0 }]; o.cur = 0; o.swing = a[11]; o.swingFlip = a[12]; o.swingAng = a[13];
      o.shieldMax = a[14] > 0 ? 1 : 0; o.shield = a[14];
      if (dist(o.x, o.y, o.tx, o.ty) > 300) { o.x = o.tx; o.y = o.ty; }
    }
    for (let i = S.players.length - 1; i >= 0; i--) { const o = S.players[i]; if (o !== P && !seen.has(o.id)) S.players.splice(i, 1); }
    // enemigos
    const old = new Map(); for (const e of S.enemies) old.set(e.id, e);
    const out = [];
    for (const a of m[3]) {
      let e = old.get(a[0]);
      if (!e) e = { id: a[0], x: a[2], y: a[3], wob: Math.random() * 6, kx: 0, ky: 0, dead: false, camp: null, hp: 1 };
      e.type = a[1]; e.tx = a[2]; e.ty = a[3]; e.ang = a[4]; e.hp = a[5]; e.maxhp = a[6]; e.r = a[7];
      const f = a[8]; e.elite = !!(f & 1); e.stun = (f & 2) ? 1 : 0; e.hacked = (f & 4) ? 1 : 0; e.flash = (f & 8) ? 0.1 : 0; e.boss = !!(f & 16); e.invuln = (f & 32) ? 1 : 0; e.aggro = !!(f & 64); e.lieut = !!(f & 128);
      e.state = a[9]; e.st = a[10]; e.level = a[11];
      if (e.boss) {
        e.bossId = a[12]; e.phase = a[13]; const B = BOSSES[e.bossId];
        e.def = { name: B.name, col: B.col, fly: false }; e.col = B.col; e.atk = a[14] ? { name: a[14], t: a[15], ang: a[16] } : null;
      } else { e.def = ENEMIES[e.type]; e.col = e.def.col; }
      if (dist(e.x, e.y, e.tx, e.ty) > 260) { e.x = e.tx; e.y = e.ty; }
      out.push(e);
    }
    S.enemies = out;
    S.bullets = m[4].map(a => ({ x: a[0], y: a[1], vx: a[2], vy: a[3], r: a[4], col: a[5], gren: !!a[6] }));
    S.ebullets = m[5].map(a => ({ x: a[0], y: a[1], vx: a[2], vy: a[3], r: a[4], col: a[5] }));
    S.turrets = m[6].map(a => ({ x: a[0], y: a[1], ang: a[2], life: a[3] }));
    // objetos: se conservan los existentes para suavizar el movimiento
    const po = new Map(); for (const p of S.pickups) po.set(p.id, p);
    S.pickups = m[7].map(a => {
      let p = po.get(a[0]) || { id: a[0], x: a[2], y: a[3], t: Math.random() * 3 };
      p.kind = a[1]; p.tx = a[2]; p.ty = a[3]; p.v = a[4]; if (a.length > 5) p.w = { id: a[5], tier: a[6], up: a[7] };
      return p;
    });
    S.zones = m[8].map(a => ({ x: a[0], y: a[1], r: a[2], t: a[3], tmax: a[4], col: a[5], ring: a[6] }));
    S.beams = m[9].map(a => ({ x: a[0], y: a[1], ang: a[2], len: a[3], t: a[4], tele: a[5], col: a[6], spin: a[7] }));
    S.mission = m[10];
    if (m[11]) {
      const b = m[11], B = BOSSES[b[0]];
      S.boss = { boss: true, bossId: b[0], x: b[1], y: b[2], hp: b[3], maxhp: b[4], phase: b[5], col: B.col, def: { name: B.name }, dead: false };
    } else S.boss = null;
    const st = m[12];
    S.kills = st[1]; S.bossKills = st[2]; S.missionsDone = st[3]; S.maxDistrict = Math.max(S.maxDistrict, st[4]); S.bonusChips = st[5]; S.defeated = st[6]; S.lib = st[7] || [0, 0, 0, 0, 0];
    this.stats = { victory: false, kills: S.kills, missions: S.missionsDone, bosses: S.bossKills, district: S.maxDistrict, bonus: S.bonusChips, time: st[0], players: S.players.length };
    // efectos
    for (const ev of m[13]) this.applyFx(ev);
  },
  applyFx(ev) {
    switch (ev[0]) {
      case 't': S.texts.push({ x: ev[1], y: ev[2], vy: -48, t: 0.85, max: 0.85, str: ev[3], col: ev[4], size: ev[5] }); break;
      case 'p': addParts(ev[1], ev[2], ev[3], ev[4], ev[5], ev[6], ev[7]); break;
      case 'r': S.rings.push({ x: ev[1], y: ev[2], r: 6, max: ev[3], col: ev[4], t: ev[5], tmax: ev[5] }); break;
      case 's': if (dist(ev[1], ev[2], P.x, P.y) < 1100) Snd.play(ev[3]); break;
      case 'sh': { const k = clamp(1 - (dist(ev[1], ev[2], P.x, P.y) - 250) / 700, 0, 1); S.shake = Math.max(S.shake, ev[3] * k); break; }
      case 'sk': S.streaks.push({ x1: ev[1], y1: ev[2], x2: ev[3], y2: ev[4], col: ev[5], t: ev[6], tmax: ev[6], w: ev[7] }); break;
    }
  },
};

// ───────── Simulación del cliente (sin autoridad: solo predicción y suavizado) ─────────
function updateRunClient(dt) {
  if (!S) return;
  S.time += dt;
  const k = 1 - Math.exp(-dt * 22);
  // jugador local
  updateLocalPlayer(P, dt);
  P.abLock = Math.max(0, (P.abLock || 0) - dt);
  P.dashCharges = Math.min(P.dashCharges, P.dashMax);
  // suavizado de los demás
  for (const o of S.players) {
    if (o === P) continue;
    if (o.tx !== undefined) { o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k; }
    o.swing = Math.max(0, o.swing - dt); o.hurtT = Math.max(0, o.hurtT - dt);
    if (o.ghost || o.dashT > 0) S.afterimages.push({ x: o.x, y: o.y, ang: o.ang, t: 0.22, col: o.ch.col, id: o.id });
  }
  for (const e of S.enemies) { e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; e.wob += dt * 3; }
  for (const p of S.pickups) { if (p.tx !== undefined) { p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; } p.t += dt; }
  for (const b of S.bullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
  for (const b of S.ebullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
  stepBullets(S.cbul, dt);
  for (const z of S.zones) z.t -= dt;
  for (const b of S.beams) { b.t -= dt; if (b.tele > 0) b.tele -= dt; else b.ang += b.spin * dt; }
  for (const t of S.turrets) t.life -= dt;
  updateFx(dt);
  updateCamera(dt);
  revealAround(false);
  updateDistrict(dt);
  findInteract();
  if (keyHit('KeyE') && Game.state === 'play') doInteract();
  // envío de nuestro estado
  Net.inT += dt;
  if (Net.inT >= IN_DT) {
    Net.inT = 0;
    const live = Game.state === 'play' && !P.dead;
    Net.sendHost(['in', r1(P.x), r1(P.y), r2(P.ang), Math.round(P.vx), Math.round(P.vy), live && In.down ? 1 : 0, P.cur]);
  }
  // si el anfitrión deja de responder
  if (Net.lastSnap && performance.now() - Net.lastSnap > 9000 && !S.over) Net._clientClose();
}
