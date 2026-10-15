'use strict';
// ───────── Render de la escena de juego ─────────

function glow(x, y, r, col, a = 1) {
  const spr = glowSprite(col, 64);
  ctx.globalAlpha = a; ctx.drawImage(spr, x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1;
}

function stall(x, y, accent, awn, label, cross, t) {
  // sombra
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x - 28, y - 6, 58, 34);
  // mostrador
  ctx.fillStyle = INK; ctx.fillRect(x - 30, y - 18, 60, 38);
  ctx.fillStyle = '#3a3038'; ctx.fillRect(x - 27, y - 15, 54, 32);
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x - 27, y - 15, 54, 4);
  // toldo a rayas
  for (let k = 0; k < 6; k++) { ctx.fillStyle = k % 2 ? '#f2ecda' : awn; ctx.fillRect(x - 27 + k * 9, y - 15, 9, 13); }
  ctx.fillStyle = INK; ctx.fillRect(x - 28, y - 3, 56, 3);
  // cartel de neón
  ctx.globalCompositeOperation = 'lighter'; glow(x, y - 8, 70, accent, 0.40 + 0.1 * Math.sin(t * 3 + x)); ctx.globalCompositeOperation = 'source-over';
  if (cross) { ctx.fillStyle = INK; ctx.fillRect(x - 5, y + 2, 10, 14); ctx.fillRect(x - 9, y + 6, 18, 6); ctx.fillStyle = '#5dff9a'; ctx.fillRect(x - 3, y + 3.5, 6, 11); ctx.fillRect(x - 7.5, y + 7.5, 15, 3); }
  else { ctx.fillStyle = accent; ctx.fillRect(x - 20, y + 5, 40, 5); ctx.fillStyle = INK; ctx.fillRect(x - 20, y + 5, 40, 1.5); }
  // rótulo
  const w = ctx.measureText ? 0 : 0;
  ctx.font = `400 15px ${FONT_DISP}`; ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.strokeText(label, x, y - 28); ctx.fillStyle = '#fff'; ctx.fillText(label, x, y - 28);
}
function drawHubProps(t) {
  const w = S.world;
  for (const h of w.hubs) {
    const hp = hubPos(h), d = DISTRICTS[h.district];
    stall(hp.fixer.x, hp.fixer.y, '#ff2bd6', '#ff2e88', 'FIXER', false, t);
    stall(hp.shop.x, hp.shop.y, '#5dff9a', '#2fbf71', 'RIPPER', true, t);
    // anillo de zona segura (pintado en el suelo)
    ctx.strokeStyle = S.defeated[h.district] ? rgba('#5dff9a', 0.5) : rgba(d.accent, 0.35); ctx.lineWidth = 3; ctx.setLineDash([14, 14]);
    ctx.beginPath(); ctx.arc(hp.c.x, hp.c.y, 118, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  for (const l of w.lairs) {
    if (S.defeated[l.district]) continue;
    const c = w.cellCenter(l.cx, l.cy), pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
    ctx.strokeStyle = `rgba(255,51,85,${0.35 + 0.3 * pulse})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(c.x, c.y, 130, 0, TAU); ctx.stroke();
    ctx.setLineDash([14, 14]); ctx.beginPath(); ctx.arc(c.x, c.y, 100, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(c.x - 22, c.y - 22); ctx.lineTo(c.x + 22, c.y + 22); ctx.moveTo(c.x + 22, c.y - 22); ctx.lineTo(c.x - 22, c.y + 22); ctx.stroke();
  }
}
// Luz verde sobre la puerta de cada piso franco (y un halo en la acera)
function drawHouses(ox, oy, vw, vh, t) {
  for (const h of S.world.houses) {
    if (h.x < ox - 160 || h.x > ox + vw + 160 || h.y < oy - 160 || h.y > oy + vh + 160) continue;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.4 + h.id);
    ctx.globalCompositeOperation = 'lighter';
    glow(h.x, h.ty * TILE + 10, 80, '#5dff9a', 0.30 + 0.16 * pulse);
    ctx.globalAlpha = 0.18 + 0.1 * pulse; ctx.fillStyle = '#5dff9a'; ctx.beginPath(); ctx.ellipse(h.x, h.y + 4, 62, 20, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (S.houseId === h.id) { // guardado aquí
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(h.x + 62, h.ty * TILE - 6, 11, 0, TAU); ctx.fill();
      ctx.fillStyle = '#5dff9a'; ctx.beginPath(); ctx.arc(h.x + 62, h.ty * TILE - 6, 8.5, 0, TAU); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(h.x + 57.5, h.ty * TILE - 6); ctx.lineTo(h.x + 61, h.ty * TILE - 2); ctx.lineTo(h.x + 67, h.ty * TILE - 11); ctx.stroke();
    }
  }
}

function drawGates(ox, oy, vw, vh, t) {
  const x0 = Math.max(0, Math.floor(ox / TILE)), x1 = Math.min(WW - 1, Math.floor((ox + vw) / TILE));
  const y0 = Math.max(0, Math.floor(oy / TILE)), y1 = Math.min(WH - 1, Math.floor((oy + vh) / TILE));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const g = S.world.gate[y * WW + x];
    if (!g || gateLv() >= DISTRICTS[g].req) continue;
    if (SOLID_MOVE[S.world.t[y * WW + x]]) continue;
    const col = DISTRICTS[g].accent, px = x * TILE, py = y * TILE;
    const fl = 0.6 + 0.4 * Math.sin(t * 6 + x * 1.7 + y * 2.3);
    ctx.fillStyle = rgba(col, 0.10 + 0.06 * fl); ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = rgba(col, 0.55 * fl);
    for (let k = 0; k < 4; k++) ctx.fillRect(px + 6 + k * 12, py, 2, TILE);
    ctx.fillStyle = rgba(col, 0.9); ctx.fillRect(px, py, TILE, 3); ctx.fillRect(px, py + TILE - 3, TILE, 3);
  }
}

const GUNS = { pistol: { l: 17, w: 6 }, smg: { l: 23, w: 7 }, shotgun: { l: 33, w: 8 }, smart: { l: 20, w: 7 }, rail: { l: 40, w: 6 }, grenade: { l: 27, w: 11 } };
function drawPlayer(pl, t) {
  const col = pl.ch.col, spr = TopArt.player(pl.ch.id);
  if (pl.dead) { drawDowned(pl, spr, t); return; }
  // postimágenes
  if (pl === P) for (const a of S.afterimages) { ctx.save(); ctx.globalAlpha = (a.t / 0.3) * 0.4; ctx.translate(a.x, a.y); ctx.rotate(a.ang); TopArt.draw(ctx, spr, true); ctx.restore(); }
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.beginPath(); ctx.ellipse(pl.x, pl.y + 10, 14, 6.5, 0, 0, TAU); ctx.fill();
  if (pl.buff.adren > 0) { ctx.globalCompositeOperation = 'lighter'; glow(pl.x, pl.y, 60, '#ffe14a', 0.5); ctx.globalCompositeOperation = 'source-over'; }
  ctx.save(); ctx.translate(pl.x, pl.y); ctx.rotate(pl.ang);
  const w = currentWeapon(), def = WEAPONS[w.id];
  TopArt.draw(ctx, spr, pl.hurtT > 0);
  // arma (encima de las manos)
  const ws = TopArt.weapon(w.id);
  if (ws && def.kind === 'gun') {
    ctx.imageSmoothingQuality = 'high'; ctx.drawImage(ws.c, Math.max(20, 9 + ws.gx) - pl.recoil - ws.gx, -ws.gy, ws.w, ws.h);
  } else if (ws) {
    ctx.save(); ctx.translate(18, 4.5 * pl.swingFlip); ctx.scale(1, pl.swingFlip); ctx.rotate(-0.3);
    ctx.imageSmoothingQuality = 'high'; ctx.drawImage(ws.c, -ws.gx, -ws.gy, ws.w, ws.h); ctx.restore();
  } else if (def.kind === 'gun') {
    const G = GUNS[w.id] || GUNS.pistol, x0 = 9 - pl.recoil;
    ctx.fillStyle = INK; ctx.fillRect(x0 - 2, -G.w / 2 - 2, G.l + 4, G.w + 4);
    ctx.fillStyle = '#3a3846'; ctx.fillRect(x0, -G.w / 2, G.l, G.w);
    ctx.fillStyle = def.col; ctx.fillRect(x0 + G.l - 7, -G.w / 2 + 1.2, 7, G.w - 2.4);
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(x0, -G.w / 2, G.l, 1.6);
    if (w.id === 'shotgun') { ctx.fillStyle = INK; ctx.fillRect(x0, -0.7, G.l, 1.4); }
  } else {
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(8, 7 * pl.swingFlip); ctx.lineTo(36, -3 * pl.swingFlip); ctx.stroke();
    ctx.strokeStyle = '#e6fbff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(11, 6 * pl.swingFlip); ctx.lineTo(35, -2.5 * pl.swingFlip); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(9, 6.4 * pl.swingFlip); ctx.lineTo(13, 5.6 * pl.swingFlip); ctx.stroke();
  }
  ctx.restore();
  if (pl.invuln > 0.05 && pl.dashT > 0 || pl.ghost) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pl.x, pl.y, pl.r + 6, 0, TAU); ctx.stroke(); }
  if (pl.shield > 0) { ctx.strokeStyle = `rgba(80,180,255,${0.25 + 0.4 * pl.shield / pl.shieldMax})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pl.x, pl.y, pl.r + 7, 0, TAU); ctx.stroke(); }
  if (pl.invuln > 0.3 && !pl.ghost && pl.dashT <= 0) { ctx.strokeStyle = `rgba(25,240,255,${0.4 + 0.3 * Math.sin(t * 20)})`; ctx.beginPath(); ctx.arc(pl.x, pl.y, pl.r + 9, 0, TAU); ctx.stroke(); }
  // tajo de katana
  if (pl.swing > 0 && def.kind === 'melee') {
    const k = 1 - pl.swing / 0.2, half = def.arc / 2;
    ctx.save(); ctx.translate(pl.x, pl.y);
    ctx.globalCompositeOperation = 'lighter';
    const a0 = pl.swingAng - half * pl.swingFlip, a1 = pl.swingAng + half * pl.swingFlip;
    ctx.strokeStyle = `rgba(127,233,255,${0.9 * (1 - k)})`; ctx.lineWidth = 10 * (1 - k) + 2;
    ctx.beginPath(); ctx.arc(0, 0, def.reach * (0.65 + 0.3 * k), a0, a1, pl.swingFlip < 0); ctx.stroke();
    ctx.restore();
  }
  drawNameTag(pl, t);
}
function drawNameTag(pl, t) {
  if (!Net.active || pl === P) return;
  ctx.font = `800 12px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = INK;
  ctx.strokeText(pl.name, pl.x, pl.y - 30); ctx.fillStyle = pl.ch.col; ctx.fillText(pl.name, pl.x, pl.y - 30);
  const bw = 30; ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(pl.x - bw / 2 - 1, pl.y - 26, bw + 2, 5);
  ctx.fillStyle = '#5dff9a'; ctx.fillRect(pl.x - bw / 2, pl.y - 25, bw * clamp(pl.hp / pl.maxhp, 0, 1), 3);
}
// Jugador caído (cooperativo): hay que acercarse y pulsar E para reanimarlo
function drawDowned(pl, spr, t) {
  ctx.save(); ctx.translate(pl.x, pl.y); ctx.rotate(pl.ang); ctx.globalAlpha = 0.45; TopArt.draw(ctx, spr, false); ctx.restore(); ctx.globalAlpha = 1;
  const pulse = 0.5 + 0.5 * Math.sin(t * 5);
  ctx.strokeStyle = rgba('#ff3355', 0.5 + 0.4 * pulse); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(pl.x, pl.y, 26 + pulse * 5, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#ff3355'; ctx.fillRect(pl.x - 3, pl.y - 52, 6, 16); ctx.fillRect(pl.x - 8, pl.y - 47, 16, 6);
  ctx.font = `800 12px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText(pl.name, pl.x, pl.y - 58); ctx.fillStyle = '#fff'; ctx.fillText(pl.name, pl.x, pl.y - 58);
}

function drawEnemy(e, t) {
  const def = e.def, flash = e.flash > 0;
  if (e.type === 'medic' && !e.dead) {   // aura de curación
    const pu = 0.5 + 0.5 * Math.sin(t * 3 + e.id);
    ctx.strokeStyle = rgba('#5dff9a', 0.16 + 0.16 * pu); ctx.lineWidth = 2; ctx.setLineDash([10, 12]);
    ctx.beginPath(); ctx.arc(e.x, e.y, def.heal.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + (def.fly ? 20 : 9), e.r, e.r * 0.45, 0, 0, TAU); ctx.fill();
  const yoff = def.fly ? -8 + Math.sin(t * 5 + e.wob) * 2 : 0;
  ctx.save(); ctx.translate(e.x, e.y + yoff);
  if (e.elite) { ctx.globalCompositeOperation = 'lighter'; glow(0, 0, e.r * 3, '#ffb020', 0.5); ctx.globalCompositeOperation = 'source-over'; }
  const r = e.r, spr = TopArt.enemy(e);
  if (e.type === 'turret') {
    TopArt.draw(ctx, spr, flash);
    ctx.rotate(e.ang);
    if (spr.photo) {
      const bl = r + 17, gr = ctx.createLinearGradient(0, -5, 0, 5);
      gr.addColorStop(0, '#9aa0ae'); gr.addColorStop(0.35, '#4a4e5c'); gr.addColorStop(0.7, '#1e2029'); gr.addColorStop(1, '#0c0d12');
      ctx.fillStyle = '#07070b'; ctx.fillRect(2, -6.2, bl, 12.4); ctx.fillStyle = gr; ctx.fillRect(3, -5, bl - 2, 10);
      ctx.fillStyle = '#12131a'; ctx.fillRect(bl - 6, -6.5, 7, 13); ctx.fillStyle = e.col; ctx.fillRect(bl - 3, -2, 3, 4);
    } else {
      ctx.fillStyle = INK; ctx.fillRect(0, -6, r + 15, 12); ctx.fillStyle = '#3a3822'; ctx.fillRect(1, -4, r + 12, 8);
      ctx.fillStyle = e.col; ctx.fillRect(r + 5, -3.5, 7, 7);
    }
  } else {
    ctx.rotate(e.ang);
    TopArt.draw(ctx, spr, flash);
    if (e.type === 'drone' || e.type === 'medic') {
      ctx.rotate(-e.ang);
      for (const [ax, ay] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        ctx.save(); ctx.translate(ax * r * 0.95, ay * r * 0.95); ctx.rotate(t * 16 + ax * ay);
        ctx.fillStyle = 'rgba(200,225,240,0.22)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.52, 0, TAU); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 0.5, 0); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 0.5, 0); ctx.stroke();
        ctx.restore();
      }
    } else if (e.boss) {
      ctx.rotate(-e.ang);
      const n = 6 + e.bossId, ph = e.phase;
      for (let k = 0; k < n; k++) { const a = (k / n) * TAU + t * 0.6; ctx.fillStyle = e.col; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 1.22, Math.sin(a) * r * 1.22, 4 + ph, 0, TAU); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); }
    }
  }
  ctx.restore();
  if (e.elite) { ctx.strokeStyle = '#ffb020'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y + yoff, e.r + 5, 0, TAU); ctx.stroke(); }
  if (e.stun > 0) {
    ctx.strokeStyle = e.hacked ? '#9cff3a' : '#ffe14a'; ctx.lineWidth = 2;
    ctx.beginPath(); for (let k = 0; k < 3; k++) { const a = t * 6 + k * 2.1; ctx.moveTo(e.x + Math.cos(a) * (e.r + 4), e.y + Math.sin(a) * (e.r + 4)); ctx.lineTo(e.x + Math.cos(a + 0.5) * (e.r + 10), e.y + Math.sin(a + 0.5) * (e.r + 10)); } ctx.stroke();
  }
  if (e.invuln > 0 && e.boss) { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 8, 0, TAU); ctx.stroke(); }
  // barra de vida
  if (!e.boss && e.hp < e.maxhp) {
    const bw = 26 + e.r, bx = e.x - bw / 2, by = e.y - e.r - 14 + yoff;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
    ctx.fillStyle = e.elite ? '#ffb020' : '#ff3355'; ctx.fillRect(bx, by, bw * clamp(e.hp / e.maxhp, 0, 1), 3);
  }
  // líneas de aviso
  if (e.state === 'aim' && e.type === 'sniper') {
    ctx.strokeStyle = `rgba(192,92,255,${0.35 + 0.5 * (1 - e.st / e.def.snipe.tele)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.ang) * 1100, e.y + Math.sin(e.ang) * 1100); ctx.stroke();
  }
  if (e.state === 'fuse' && def.fuse) {   // mecha encendida: zona de explosión
    const k = clamp(1 - e.st / def.fuse.time, 0, 1), bl = Math.sin(t * 40) > 0;
    ctx.fillStyle = rgba('#ff3355', 0.08 + 0.3 * k); ctx.beginPath(); ctx.arc(e.x, e.y, def.fuse.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = bl ? '#ffffff' : '#ff3355'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x, e.y, def.fuse.r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, def.fuse.r * k, 0, TAU); ctx.stroke();
  }
  if (e.lieut) {   // cabecilla de una misión de caza
    const nm = (S.mission && S.mission.ltName) || def.name, col = DISTRICTS[S.world.districtAtPx(e.x, e.y)].accent;
    ctx.font = `800 13px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = INK;
    ctx.strokeText(nm, e.x, e.y - e.r - 24 + yoff); ctx.fillStyle = col; ctx.fillText(nm, e.x, e.y - e.r - 24 + yoff);
  }
  if (e.state === 'tele' && e.type === 'frenzy') {
    ctx.strokeStyle = `rgba(255,51,85,${0.35 + 0.5 * (1 - e.st / e.def.charge.tele)})`; ctx.lineWidth = e.r * 1.6;
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.ang) * 300, e.y + Math.sin(e.ang) * 300); ctx.stroke();
  }
  if (e.boss && e.atk) {
    const a = e.atk;
    if (a.name === 'charge' && a.t < 0.7) {
      ctx.strokeStyle = `rgba(255,51,85,${0.3 + 0.5 * (a.t / 0.7)})`; ctx.lineWidth = e.r * 1.6;
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(a.ang) * 520, e.y + Math.sin(a.ang) * 520); ctx.stroke();
    }
    if (a.name === 'fan' && a.t < 0.5) {
      ctx.fillStyle = `rgba(255,51,85,${0.10 + 0.2 * a.t})`; ctx.beginPath(); ctx.moveTo(e.x, e.y);
      ctx.arc(e.x, e.y, 460, a.ang - 0.5, a.ang + 0.5); ctx.closePath(); ctx.fill();
    }
  }
}

function drawPickups(t) {
  for (const p of S.pickups) {
    const bob = Math.sin(t * 4 + p.t * 3) * 2;
    if (p.kind === 'xp') { ctx.globalCompositeOperation = 'lighter'; glow(p.x, p.y + bob, 14, '#19f0ff', 0.9); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#c8fbff'; ctx.fillRect(p.x - 2, p.y - 2 + bob, 4, 4); }
    else if (p.kind === 'cred') { ctx.fillStyle = '#ffe14a'; ctx.beginPath(); ctx.arc(p.x, p.y + bob, 4.5, 0, TAU); ctx.fill(); ctx.strokeStyle = '#7a5a00'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalCompositeOperation = 'lighter'; glow(p.x, p.y + bob, 12, '#ffe14a', 0.5); ctx.globalCompositeOperation = 'source-over'; }
    else if (p.kind === 'hp') { ctx.fillStyle = '#5dff9a'; ctx.fillRect(p.x - 3, p.y - 8 + bob, 6, 16); ctx.fillRect(p.x - 8, p.y - 3 + bob, 16, 6); ctx.globalCompositeOperation = 'lighter'; glow(p.x, p.y + bob, 22, '#5dff9a', 0.7); ctx.globalCompositeOperation = 'source-over'; }
    else if (p.kind === 'weapon') {
      const tc = TIERS[p.w.tier].col;
      ctx.globalCompositeOperation = 'lighter'; glow(p.x, p.y + bob, 38, tc, 0.7); ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#10101c'; ctx.fillRect(p.x - 14, p.y - 5 + bob, 28, 10); ctx.strokeStyle = tc; ctx.lineWidth = 2; ctx.strokeRect(p.x - 14, p.y - 5 + bob, 28, 10);
      ctx.fillStyle = WEAPONS[p.w.id].col; ctx.fillRect(p.x + 4, p.y - 2 + bob, 9, 4);
    } else if (p.kind === 'chest' || p.kind === 'stash') {
      const c = p.kind === 'stash' ? '#ff2bd6' : '#ffe14a';
      ctx.globalCompositeOperation = 'lighter'; glow(p.x, p.y, 54, c, 0.6 + 0.2 * Math.sin(t * 4)); ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#1a1424'; ctx.fillRect(p.x - 16, p.y - 12, 32, 24); ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.strokeRect(p.x - 16, p.y - 12, 32, 24);
      ctx.fillStyle = c; ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
    }
  }
}

function drawMissionMarkers(t) {
  const m = S.mission; if (!m) return;
  const pulse = 0.5 + 0.5 * Math.sin(t * 4);
  const mark = (x, y, col, label) => {
    ctx.strokeStyle = rgba(col, 0.5 + 0.4 * pulse); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, 50 + pulse * 8, 0, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter'; glow(x, y, 90, col, 0.35); ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - 74 - pulse * 6); ctx.lineTo(x - 9, y - 90 - pulse * 6); ctx.lineTo(x + 9, y - 90 - pulse * 6); ctx.closePath(); ctx.fill();
    if (label) { ctx.font = `bold 12px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(label, x, y - 98 - pulse * 6); }
  };
  const tg = missionTarget();
  if (tg && !(m.type === 'boss' && S.boss)) mark(tg.x, tg.y, '#ffe14a', m.type === 'boss' ? 'GUARIDA' : 'OBJETIVO');
}

// Antena de sabotaje, puntos de las cargas y zona de limpieza
function drawOpMarkers(t) {
  const m = S.mission; if (!m) return;
  const pulse = 0.5 + 0.5 * Math.sin(t * 4);
  if (m.type === 'hack') {
    const x = m.pos.x, y = m.pos.y, k = clamp(m.prog / m.need, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(x, y + 14, 22, 9, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x - 14, y + 12); ctx.lineTo(x, y - 40); ctx.lineTo(x + 14, y + 12); ctx.moveTo(x - 9, y - 6); ctx.lineTo(x + 9, y - 6); ctx.moveTo(x - 5, y - 24); ctx.lineTo(x + 5, y - 24); ctx.stroke();
    ctx.strokeStyle = '#8fa3b8'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#1b2230'; ctx.fillRect(x - 16, y + 4, 32, 14); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(x - 16, y + 4, 32, 14); ctx.fillStyle = k > 0 ? '#19f0ff' : '#ff3355'; ctx.fillRect(x - 12, y + 8, 24 * Math.max(0.15, k), 6);
    ctx.globalCompositeOperation = 'lighter'; glow(x, y - 40, 40 + 14 * pulse, k > 0 ? '#19f0ff' : '#ff3355', 0.7); ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 3; ctx.strokeStyle = rgba('#19f0ff', 0.3 + 0.2 * pulse); ctx.setLineDash([12, 12]); ctx.beginPath(); ctx.arc(x, y, 150, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    if (k > 0) { ctx.lineWidth = 6; ctx.strokeStyle = '#19f0ff'; ctx.beginPath(); ctx.arc(x, y, 150, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke(); }
  } else if (m.type === 'charges') {
    for (const q of m.points) {
      const k = clamp(q.t / 2.2, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(q.x, q.y + 8, 14, 6, 0, 0, TAU); ctx.fill();
      if (q.done) {
        ctx.fillStyle = '#5dff9a'; ctx.beginPath(); ctx.arc(q.x, q.y, 11, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(q.x - 5, q.y); ctx.lineTo(q.x - 1, q.y + 4); ctx.lineTo(q.x + 6, q.y - 5); ctx.stroke();
        continue;
      }
      ctx.fillStyle = '#17141f'; ctx.beginPath(); ctx.arc(q.x, q.y, 12, 0, TAU); ctx.fill(); ctx.strokeStyle = '#ff8a1a'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#d8262f'; ctx.fillRect(q.x - 7, q.y - 4, 14, 8);
      ctx.fillStyle = Math.sin(t * 12 + q.x) > 0 ? '#ffe14a' : '#ff3355'; ctx.beginPath(); ctx.arc(q.x, q.y - 9, 2.6, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; glow(q.x, q.y, 54, '#ff8a1a', 0.35 + 0.2 * pulse); ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = 3; ctx.strokeStyle = rgba('#ff8a1a', 0.35 + 0.2 * pulse); ctx.beginPath(); ctx.arc(q.x, q.y, 90, 0, TAU); ctx.stroke();
      if (k > 0) { ctx.lineWidth = 6; ctx.strokeStyle = '#ffe14a'; ctx.beginPath(); ctx.arc(q.x, q.y, 90, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke(); }
    }
  }
}

function drawBulletsAndFx(t) {
  ctx.globalCompositeOperation = 'lighter';
  for (const b of S.bullets.concat(S.cbul)) {
    const sp = Math.hypot(b.vx, b.vy) || 1;
    ctx.strokeStyle = b.col; ctx.lineWidth = b.r * 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - (b.vx / sp) * (b.gren ? 4 : 16), b.y - (b.vy / sp) * (b.gren ? 4 : 16)); ctx.stroke();
    glow(b.x, b.y, b.r * 3.2, b.col, 0.85);
  }
  for (const b of S.ebullets) {
    glow(b.x, b.y, b.r * 4, b.col, 0.9);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.7, 0, TAU); ctx.fill();
  }
  for (const s of S.streaks) {
    ctx.strokeStyle = s.col; ctx.globalAlpha = s.t / s.tmax; ctx.lineWidth = s.w * (s.t / s.tmax + 0.3);
    ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.globalAlpha = 1;
  }
  for (const p of S.parts) { ctx.globalAlpha = clamp(p.life / p.max, 0, 1); glow(p.x, p.y, p.size * 2.4, p.col, 1); }
  ctx.globalAlpha = 1;
  for (const r of S.rings) { ctx.strokeStyle = r.col; ctx.globalAlpha = clamp(r.t / r.tmax, 0, 1); ctx.lineWidth = 4 * (r.t / r.tmax) + 1; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke(); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

function drawZonesAndBeams(t) {
  for (const z of S.zones) {
    const k = 1 - z.t / z.tmax;
    ctx.fillStyle = rgba(z.col, 0.08 + 0.3 * k); ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba(z.col, 0.8); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = rgba('#ffffff', 0.7); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(z.x, z.y, z.r * k, 0, TAU); ctx.stroke();
  }
  for (const b of S.beams) {
    const x2 = b.x + Math.cos(b.ang) * b.len, y2 = b.y + Math.sin(b.ang) * b.len;
    if (b.tele > 0) { ctx.strokeStyle = `rgba(255,51,85,${0.25 + 0.4 * Math.abs(Math.sin(t * 25))})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(x2, y2); ctx.stroke(); continue; }
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(b.col, 0.55); ctx.lineWidth = 26; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
}

function drawTurrets(t) {
  for (const tr of S.turrets) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(tr.x, tr.y + 8, 13, 6, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(tr.x, tr.y);
    ctx.fillStyle = '#2b1a0c'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = '#ff8a1a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.rotate(tr.ang); ctx.fillStyle = INK; ctx.fillRect(1, -5.5, 21, 11); ctx.fillStyle = '#ff8a1a'; ctx.fillRect(3, -3.5, 17, 7);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,138,26,0.9)'; ctx.fillRect(tr.x - 12, tr.y - 22, 24 * clamp(tr.life / 14, 0, 1), 2);
  }
}

function renderScene(dt) {
  const z = U.s, t = S.time;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#05040a'; ctx.fillRect(0, 0, U.cw, U.ch);
  const sx = (Math.random() - 0.5) * S.shake, sy = (Math.random() - 0.5) * S.shake;
  const vw = U.cw / z, vh = U.ch / z;
  const ox = S.cam.x - vw / 2, oy = S.cam.y - vh / 2;
  ctx.setTransform(z, 0, 0, z, -Math.round(ox * z) + sx, -Math.round(oy * z) + sy);
  drawWorld(ctx, S.world, ox, oy, vw, vh);
  drawGates(ox, oy, vw, vh, t);
  drawHubProps(t);
  drawHouses(ox, oy, vw, vh, t);
  drawMissionMarkers(t);
  drawOpMarkers(t);
  drawZonesAndBeams(t);
  drawPickups(t);
  drawTurrets(t);
  const vis = (e) => e.x > ox - 80 && e.x < ox + vw + 80 && e.y > oy - 80 && e.y < oy + vh + 80;
  for (const e of S.enemies) if (!e.dead && vis(e)) drawEnemy(e, t);
  for (const pl of S.players) if (pl !== P) drawPlayer(pl, t);
  drawPlayer(P, t);
  drawBulletsAndFx(t);
  // números de daño
  ctx.textAlign = 'center';
  for (const tx of S.texts) {
    ctx.globalAlpha = clamp(tx.t / tx.max * 1.6, 0, 1);
    ctx.font = `800 ${tx.size}px ${FONT_UI}`; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(tx.str, tx.x, tx.y); ctx.fillStyle = tx.col; ctx.fillText(tx.str, tx.x, tx.y);
  }
  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawRain(dt);
  ctx.drawImage(vignette, 0, 0);
  if (P.hurtT > 0) { ctx.fillStyle = `rgba(255,30,60,${P.hurtT * 0.45})`; ctx.fillRect(0, 0, U.cw, U.ch); }
}
