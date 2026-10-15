'use strict';
// ───────── Audio sintetizado (WebAudio) ─────────
const Snd = (() => {
  let ac = null, master = null, sfxG = null, musG = null, nbuf = null;
  let musicOn = true, vol = 0.7, intensity = 0;
  const last = {};

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = vol; master.connect(ac.destination);
      sfxG = ac.createGain(); sfxG.gain.value = 0.85; sfxG.connect(master);
      musG = ac.createGain(); musG.gain.value = musicOn ? 0.30 : 0; musG.connect(master);
      nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      startMusic();
    } catch (e) { ac = null; }
  }

  function tone(f, dur, type = 'square', v = 0.15, slide = 0, delay = 0, dest = null) {
    if (!ac) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || sfxG); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, v = 0.2, freq = 2000, type = 'lowpass', slide = 0, delay = 0, dest = null) {
    if (!ac) return;
    const t = ac.currentTime + delay;
    const s = ac.createBufferSource(); s.buffer = nbuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t);
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || sfxG); s.start(t); s.stop(t + dur + 0.02);
  }

  const S = {
    pistol() { tone(980, 0.09, 'square', 0.10, 0.25); noise(0.05, 0.12, 5000, 'highpass'); },
    smg() { tone(780, 0.06, 'square', 0.07, 0.4); noise(0.04, 0.08, 4500, 'highpass'); },
    shotgun() { noise(0.22, 0.32, 2200, 'lowpass', 0.3); tone(140, 0.18, 'sawtooth', 0.16, 0.4); },
    smart() { tone(700, 0.1, 'triangle', 0.12, 1.6); tone(1400, 0.06, 'sine', 0.05); },
    rail() { tone(2400, 0.35, 'sawtooth', 0.14, 0.08); noise(0.3, 0.2, 6000, 'highpass', 0.2); },
    grenade() { tone(220, 0.18, 'sawtooth', 0.15, 0.4); noise(0.1, 0.12, 900); },
    katana() { noise(0.16, 0.2, 1200, 'bandpass', 5); tone(1900, 0.12, 'sine', 0.05, 0.5); },
    hit() { tone(320, 0.05, 'square', 0.07, 0.5); },
    crit() { tone(900, 0.08, 'square', 0.1, 1.5); tone(1500, 0.08, 'triangle', 0.07); },
    kill() { noise(0.2, 0.2, 1500, 'lowpass', 0.2); tone(200, 0.2, 'sawtooth', 0.08, 0.3); },
    hurt() { tone(160, 0.22, 'sawtooth', 0.2, 0.4); noise(0.12, 0.2, 800); },
    pickup() { tone(880, 0.07, 'sine', 0.09, 1.4); },
    heal() { tone(520, 0.1, 'sine', 0.1, 1.6); tone(780, 0.14, 'sine', 0.08, 1.5, 0.08); },
    weapon() { tone(500, 0.08, 'square', 0.08); tone(750, 0.1, 'square', 0.08, 1, 0.07); },
    dash() { noise(0.18, 0.2, 500, 'bandpass', 6); },
    ability() { tone(220, 0.4, 'sawtooth', 0.15, 3); tone(660, 0.35, 'triangle', 0.1, 2, 0.05); },
    hack() { for (let i = 0; i < 6; i++) tone(400 + Math.random() * 1400, 0.06, 'square', 0.07, 1, i * 0.05); },
    boom() { noise(0.55, 0.45, 700, 'lowpass', 0.15); tone(90, 0.4, 'sawtooth', 0.22, 0.3); },
    level() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'square', 0.1, 1, i * 0.08)); },
    click() { tone(1100, 0.035, 'square', 0.05); },
    buy() { tone(1200, 0.06, 'square', 0.08); tone(1600, 0.08, 'square', 0.08, 1, 0.06); },
    deny() { tone(150, 0.15, 'sawtooth', 0.1, 0.7); },
    warn() { tone(110, 0.5, 'sawtooth', 0.18, 0.5); tone(112, 0.5, 'sawtooth', 0.14, 0.5); },
    mission() { [392, 523, 659].forEach((f, i) => tone(f, 0.14, 'triangle', 0.12, 1, i * 0.09)); },
    boss() { tone(70, 1.0, 'sawtooth', 0.22, 0.6); noise(0.8, 0.18, 300, 'lowpass', 0.5); },
    tele() { tone(300, 0.25, 'sawtooth', 0.07, 2.2); },
  };

  function play(name) {
    if (!ac || !S[name]) return;
    const now = performance.now();
    if (last[name] && now - last[name] < 28) return;
    last[name] = now;
    S[name]();
  }

  // ── Música: bajo + arpegio en bucle ──
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const roots = [45, 41, 48, 43];
  const chords = [[0, 3, 7, 12], [0, 4, 7, 12], [0, 4, 7, 12], [0, 4, 7, 11]];
  const bassPat = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0];
  let step = 0, nextT = 0, timer = null;
  const spb = 60 / 104 / 4;

  function kick(t) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.14);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g); g.connect(musG); o.start(t); o.stop(t + 0.2);
  }
  function hat(t, v) {
    const s = ac.createBufferSource(); s.buffer = nbuf;
    const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ac.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    s.connect(f); f.connect(g); g.connect(musG); s.start(t); s.stop(t + 0.05);
  }
  function note(m, t, dur, type, v, cutoff) {
    const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = type; o.frequency.value = mtof(m);
    f.type = 'lowpass'; f.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(musG); o.start(t); o.stop(t + dur + 0.02);
  }
  function playStep(s, t) {
    const bar = Math.floor(s / 16) % 4, st = s % 16, root = roots[bar], ch = chords[bar];
    if (st % 4 === 0) kick(t);
    if (st % 2 === 1) hat(t, st % 4 === 3 ? 0.10 : 0.05);
    if (st % 8 === 4) { hat(t, 0.16); }
    if (bassPat[st]) note(root - 12 + (st % 8 === 6 ? 12 : 0), t, spb * 1.6, 'sawtooth', 0.22, 520);
    if (st % 2 === 0) {
      const m = root + 12 + ch[(st / 2 + bar) % ch.length | 0];
      note(m + (intensity > 0.5 ? 12 : 0), t, spb * 1.5, 'square', 0.035 + 0.04 * intensity, 1800 + 2400 * intensity);
    }
  }
  function sched() {
    if (!ac) return;
    if (nextT < ac.currentTime) nextT = ac.currentTime + 0.05;
    while (nextT < ac.currentTime + 0.3) { playStep(step, nextT); nextT += spb; step = (step + 1) % 64; }
  }
  function startMusic() { nextT = ac.currentTime + 0.1; if (!timer) timer = setInterval(sched, 70); }

  return {
    init, play,
    setVolume(v) { vol = clamp(v, 0, 1); if (master) master.gain.value = vol; },
    getVolume() { return vol; },
    toggleMusic() { musicOn = !musicOn; if (musG) musG.gain.value = musicOn ? 0.30 : 0; return musicOn; },
    setMusic(on) { musicOn = on; if (musG) musG.gain.value = on ? 0.30 : 0; },
    isMusicOn() { return musicOn; },
    hide(on) { if (!ac) return; try { if (on) ac.suspend(); else ac.resume(); } catch (e) { /* nada */ } },
    setIntensity(v) { intensity = v; },
  };
})();
