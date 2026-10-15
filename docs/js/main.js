'use strict';
// ───────── Guardado, bucle principal y estados ─────────
const SAVE_KEY = 'neonSyndicate.save.v1';

function defaultSave() {
  return {
    chips: 0, chars: ['solo'], weapons: [], perks: [], raid: false,
    up: { cap: 0, vit: 0, fund: 0, clone: 0 },
    stats: { runs: 0, kills: 0, bosses: 0, best: 1, wins: 0 },
    lastChar: 'solo', vol: 0.7, music: true, coopName: '',
  };
}
function loadGame() {
  const d = defaultSave();
  try {
    const o = unpackSave(GPx.store.get(SAVE_KEY));
    if (o) {
      Object.assign(d, o);
      d.up = Object.assign(defaultSave().up, o.up || {});
      d.stats = Object.assign(defaultSave().stats, o.stats || {});
      if (!Array.isArray(d.chars) || !d.chars.includes('solo')) d.chars = ['solo'].concat(d.chars || []);
    }
  } catch (e) { /* sin guardado previo */ }
  return d;
}
function saveGame() {
  try { GPx.store.set(SAVE_KEY, packSave(SAVE)); } catch (e) { /* ignorar */ }
}

// En cooperativo el mundo sigue en marcha aunque abras menús; en solitario solo avanza en estado 'play'.
function runScene(update, dt) {
  if (Net.active && S && !S.over) {
    const busy = Game.state !== 'play';
    if (P.busy !== busy) { P.busy = busy; if (Net.client) Net.sendHost(['busy', busy ? 1 : 0]); }
    if (Net.client) updateRunClient(dt); else updateRun(dt);
    if (Net.client) {
      if (Net.q && Game.state === 'play') { Game.choices = Net.q.map(id => PERKS.find(p => p.id === id)).filter(Boolean); Net.q = null; if (Game.choices.length) Game.state = 'levelup'; }
    } else if (P.pendingLevel > 0 && Game.state === 'play' && !P.choosing) openLevelUp();
    renderScene(dt);
    return;
  }
  if (update) {
    updateRun(dt);
    if (P.pendingLevel > 0 && Game.state === 'play') openLevelUp();
  }
  renderScene(update ? dt : 0);
}

function step(dt) {
  Game.t += dt;
  TouchUI.update();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  canvas.style.cursor = Game.state === 'play' ? 'none' : 'default';
  uiBegin();
  switch (Game.state) {
    case 'title': drawTitle(dt); break;
    case 'loading': drawLoading(dt); break;
    case 'select':
      drawSelect(dt); if (keyHit('Escape')) Game.state = 'title'; break;
    case 'workshop':
      drawWorkshop(dt); if (keyHit('Escape')) Game.state = 'title'; break;
    case 'controls':
      if (Game.back === 'pause') { runScene(false, dt); uiBegin(); }
      drawControls(dt); if (keyHit('Escape')) Game.state = Game.back || 'title'; break;
    case 'coop': drawCoop(dt); break;
    case 'lobby': drawLobby(dt); break;
    case 'play':
      if (keyHit('Escape') || keyHit('KeyP')) { Game.state = 'pause'; Game.pauseMsg = null; }
      else if (keyHit('KeyM')) Game.state = 'map';
      runScene(Game.state === 'play' || Game.state === 'levelup', dt);
      uiBegin(); drawHUD(dt);
      break;
    case 'pause':
      runScene(false, dt); uiBegin(); drawHUD(dt); drawPause(dt);
      if (keyHit('Escape') || keyHit('KeyP')) Game.state = 'play';
      break;
    case 'levelup':
      runScene(false, dt); uiBegin(); drawHUD(dt); drawLevelUp(dt); break;
    case 'house':
      runScene(false, dt); uiBegin(); drawHouse(dt); break;
    case 'board':
      runScene(false, dt); uiBegin(); drawBoard(dt); if (keyHit('Escape')) Game.state = 'play'; break;
    case 'shop':
      runScene(false, dt); uiBegin(); drawShop(dt); if (keyHit('Escape')) Game.state = 'play'; break;
    case 'map':
      runScene(false, dt); uiBegin(); drawMapScreen(dt);
      if (keyHit('Escape') || keyHit('KeyM')) Game.state = 'play'; break;
    case 'dead':
    case 'victory':
      runScene(false, 0); uiBegin(); drawEnd(dt); break;
    default: Game.state = 'title';
  }
  TouchUI.draw();
  endFrameInput();
}

let _last = 0, _gpxReady = false;
function frame(ts) {
  requestAnimationFrame(frame);
  if (window.__NS && window.__NS.manual) return;
  // Con un anuncio de GamePix en pantalla el juego queda pausado (requisito del SDK).
  if (GPx.blocked) { _last = ts; return; }
  const dt = clamp((ts - _last) / 1000 || 0.016, 0.001, 0.05);
  _last = ts;
  if (!Art.ready) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#05040a'; ctx.fillRect(0, 0, canvas.width, canvas.height); return; }   // esperando a las imágenes
  if (_ldEl) { _ldEl.remove(); _ldEl = null; }
  if (!_gpxReady) { _gpxReady = true; GPx.ready(); }   // primer fotograma real: avisamos al SDK
  try { step(dt); } catch (err) { console.error('ERROR-FRAME', err && err.stack || err); }
}

let _ldEl = document.getElementById('ld');
function initGame() {
  setupCanvas();
  SAVE = loadGame();
  Snd.setVolume(SAVE.vol); Snd.setMusic(SAVE.music);
  const wake = () => Snd.init();
  window.addEventListener('pointerdown', wake); window.addEventListener('keydown', wake);
  // Pausa y silencio solo cuando la pestaña/juego deja de estar visible (no al hacer clic fuera del iframe)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (Game.state === 'play' && !Net.active) Game.state = 'pause'; Snd.hide(true); } else Snd.hide(false);
  });
  window.addEventListener('error', (e) => console.error('ERROR-GLOBAL', e.message, e.filename + ':' + e.lineno));
  requestAnimationFrame(frame);
}

/*@DEV*/
// Botón «atrás» de Android: devuelve false si hay que cerrar la app (estás en el menú principal)
window.__androidBack = () => {
  if (Game.state === 'title') return false;
  In.pressed.Escape = true; return true;
};
window.__NS = {
  Game, step, newRun, tick: step,
  get S() { return S; }, get P() { return P; }, get SAVE() { return SAVE; }, In,
  setSave(s) { SAVE = s; }, manual: false, Net, Coop, U,
  loadRunFile(o) { return loadRun(o, { stay: false }); },
  saveRun, readRunSave, getRunInfo, loadRun, saveGame, unpackSave, packSave,
  acceptContract, makeDelivery, openHouse, openBoard, openShop, endRun, startLoading, xpAll, spawnEnemy,
  makeContracts, makeHack, makeCharges, makeHunt, makePurge, makeRaid, makeBossContract, libCount, findFree, completeMission, enemyLevelFor, itemPrice, damageEnemy, killEnemy, plainContract,
};
/*@END*/

Net.init();
initGame();
