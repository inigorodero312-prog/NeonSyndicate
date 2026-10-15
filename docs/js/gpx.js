'use strict';
// ───────── Puente con el SDK de GamePix ─────────
// Todas las llamadas degradan a no-op si el SDK no está presente (build de Electron,
// desarrollo local, o si integration.gamepix.com no carga). Nunca rompe el juego.
const GPx = (() => {
  const sdk = () => (typeof window.GamePix !== 'undefined' && window.GamePix) || null;
  const safe = (fn) => { try { return fn(); } catch (e) { console.warn('[GPx]', (e && e.message) || e); } };

  let announced = false;      // loaded() ya llamado
  let adBusy = false;         // hay un anuncio en pantalla → el juego debe estar pausado
  let adWatchdog = 0;
  let lastScore = null, lastLevel = null;

  function show(kind, done) {
    const s = sdk();
    if (!s || !announced || adBusy) { if (done) done(false); return; }
    adBusy = true;
    let settled = false;
    const fin = (ok) => {
      if (settled) return;
      settled = true; adBusy = false; clearTimeout(adWatchdog);
      if (done) done(!!ok);
    };
    // Si el SDK nunca resuelve la promesa, no dejamos el juego congelado para siempre.
    adWatchdog = setTimeout(() => { console.warn('[GPx] ' + kind + ': sin respuesta del SDK, sigo'); fin(false); }, 45000);
    const p = safe(() => (kind === 'interstitial' ? s.interstitialAd() : s.rewardAd()));
    if (p && typeof p.then === 'function') p.then((r) => fin(r && r.success)).catch(() => fin(false));
    else fin(false);
  }

  const api = {
    get present() { return !!sdk(); },
    get blocked() { return adBusy; },   // el bucle del juego no debe avanzar mientras es true
    get lang() { const s = sdk(); return (s && safe(() => s.lang())) || 'es'; },

    // Progreso de carga (0-100). Debe ir antes que cualquier otra llamada del SDK.
    loading(pct) {
      const s = sdk(); if (!s) return;
      const n = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
      safe(() => s.loading(n));
    },
    // «Ya cargué»: obligatorio antes de llamar a ads, score o level.
    ready() {
      const s = sdk(); if (!s || announced) return;
      announced = true;
      safe(() => s.loaded());
      console.log('[GPx] SDK listo · idioma =', api.lang);
    },

    interstitial(done) { show('interstitial', done); },
    reward(done) { show('reward', done); },

    score(n) {
      const s = sdk(); if (!s || !announced) return;
      const v = Math.max(0, Math.round(Number(n) || 0));
      if (v === lastScore) return;
      lastScore = v;
      safe(() => s.updateScore(v));
    },
    level(n) {
      const s = sdk(); if (!s || !announced) return;
      const v = Math.max(1, Math.round(Number(n) || 1));
      if (v === lastLevel) return;
      lastLevel = v;
      safe(() => s.updateLevel(v));
    },
    happy() { const s = sdk(); if (s && announced) safe(() => s.happyMoment()); },

    // Guardado: usa GamePix.localStorage cuando está disponible (en iframe el localStorage
    // normal se purga con políticas de terceros) y escribe también el local como respaldo.
    store: {
      get(k) {
        const s = sdk();
        if (s && s.localStorage) { const v = safe(() => s.localStorage.getItem(k)); if (v != null) return v; }
        return safe(() => window.localStorage.getItem(k)) || null;
      },
      set(k, v) {
        const str = String(v), s = sdk();
        if (s && s.localStorage) safe(() => s.localStorage.setItem(k, str));
        safe(() => window.localStorage.setItem(k, str));
      },
      del(k) {
        const s = sdk();
        if (s && s.localStorage) safe(() => s.localStorage.removeItem(k));
        safe(() => window.localStorage.removeItem(k));
      },
    },
  };
  return api;
})();
