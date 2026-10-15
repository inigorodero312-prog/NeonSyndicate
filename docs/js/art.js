'use strict';
// ───────── Arte renderizado en 3D (retratos, sprites cenitales y armas) ─────────
// Las imágenes están en assets/. Si alguna no carga, el juego usa el arte dibujado por código.
const Art = (() => {
  const META = {"chars":{"solo":{"file":"assets/chars/solo.webp","iw":1100,"ih":1100,"fx":474.4,"fy":1063.0,"figH":983.0,"bust":[225,20,640,498]},"kira":{"file":"assets/chars/kira.webp","iw":1100,"ih":1100,"fx":474.4,"fy":1063.0,"figH":922.0,"bust":[225,81,640,498]},"mox":{"file":"assets/chars/mox.webp","iw":1100,"ih":1100,"fx":474.4,"fy":1063.0,"figH":964.0,"bust":[225,39,640,498]},"ronin":{"file":"assets/chars/ronin.webp","iw":1100,"ih":1100,"fx":474.4,"fy":1063.0,"figH":1024.0,"bust":[225,-21,640,498]}},"players":{"solo":{"file":"assets/top/p_solo.webp","size":256,"world":64},"kira":{"file":"assets/top/p_kira.webp","size":256,"world":64},"mox":{"file":"assets/top/p_mox.webp","size":256,"world":64},"ronin":{"file":"assets/top/p_ronin.webp","size":256,"world":64}},"enemies":{"grunt":{"file":"assets/top/e_grunt.webp","size":256,"world":76,"r":12},"thug":{"file":"assets/top/e_thug.webp","size":256,"world":86,"r":14},"drone":{"file":"assets/top/e_drone.webp","size":256,"world":66,"r":10},"sniper":{"file":"assets/top/e_sniper.webp","size":256,"world":76,"r":12},"heavy":{"file":"assets/top/e_heavy.webp","size":256,"world":101,"r":17},"frenzy":{"file":"assets/top/e_frenzy.webp","size":256,"world":86,"r":14},"turret":{"file":"assets/top/e_turret.webp","size":256,"world":86,"r":14}},"bosses":{"0":{"file":"assets/top/b_0.webp","size":384,"world":133,"r":30},"1":{"file":"assets/top/b_1.webp","size":384,"world":157,"r":36},"2":{"file":"assets/top/b_2.webp","size":384,"world":126,"r":28},"3":{"file":"assets/top/b_3.webp","size":384,"world":141,"r":32},"4":{"file":"assets/top/b_4.webp","size":384,"world":165,"r":38}},"weapons":{"pistol":{"file":"assets/top/w_pistol.webp","size":256,"bbox":[23,110,224,146],"ppm":800.0,"ox":0.075},"smg":{"file":"assets/top/w_smg.webp","size":256,"bbox":[9,115,247,141],"ppm":355.556,"ox":0.08},"shotgun":{"file":"assets/top/w_shotgun.webp","size":256,"bbox":[3,119,250,137],"ppm":228.571,"ox":0.17},"smart":{"file":"assets/top/w_smart.webp","size":256,"bbox":[11,111,232,145],"ppm":711.111,"ox":0.11},"rail":{"file":"assets/top/w_rail.webp","size":256,"bbox":[1,119,253,137],"ppm":177.778,"ox":0.31},"grenade":{"file":"assets/top/w_grenade.webp","size":256,"bbox":[8,107,248,149],"ppm":278.261,"ox":0.12},"katana":{"file":"assets/top/w_katana.webp","size":256,"bbox":[6,112,247,140],"ppm":213.333,"ox":0.26}}};
  const imgs = {};
  let pending = 0, ready = false, total = 0, done = 0;
  function finish() { if (!ready) { ready = true; GPx.loading(100); } }
  function progress() { done++; if (typeof GPx !== 'undefined') GPx.loading(total ? (done * 100) / total : 100); }
  function load(key, file) {
    pending++; total++;
    const im = new Image();
    im.onload = () => { imgs[key] = im; progress(); if (--pending === 0) finish(); };
    im.onerror = () => { progress(); if (--pending === 0) finish(); };
    im.src = file;
  }
  for (const id in META.chars) load('c:' + id, META.chars[id].file);
  for (const id in META.players) load('p:' + id, META.players[id].file);
  for (const id in META.enemies) load('e:' + id, META.enemies[id].file);
  for (const id in META.bosses) load('b:' + id, META.bosses[id].file);
  for (const id in META.weapons) load('w:' + id, META.weapons[id].file);
  setTimeout(finish, 6000);   // por si algo se queda colgado

  // Cadena de reducciones (mip) para que al escalar a la baja salga limpio
  const mips = {};
  function mip(key, L) {
    const im = imgs[key]; if (!im) return null;
    if (L <= 0) return im;
    const k = key + '#' + L; if (mips[k]) return mips[k];
    const src = mip(key, L - 1), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(im.width / Math.pow(2, L))); c.height = Math.max(1, Math.round(im.height / Math.pow(2, L)));
    const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(src, 0, 0, c.width, c.height);
    return (mips[k] = c);
  }
  // Escoge el nivel de reducción cuyo tamaño aún sea >= al tamaño final en pantalla
  function levelFor(dev, maxL) { let L = 0; while (L < maxL && dev <= 1 / Math.pow(2, L + 1)) L++; return L; }
  return { META, imgs, mip, levelFor, get ready() { return ready; }, has: (k) => !!imgs[k] };
})();
