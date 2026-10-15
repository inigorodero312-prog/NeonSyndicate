'use strict';
// ───────── Datos del juego ─────────
const TILE = 48;          // píxeles por tile
const BLOCK = 11;         // tiles por celda (3 de calle + 8 de manzana)
const WB = 12;            // celdas por lado
const WW = WB * BLOCK + 3, WH = WB * BLOCK + 3;
const T = { ROAD: 0, WALK: 1, BUILD: 2, FLOOR: 3, WALL: 4, CRATE: 5, VOID: 6, TOXIC: 7 };
// Tiles que bloquean el movimiento y los que bloquean las balas
const SOLID_MOVE = new Uint8Array(8); [T.BUILD, T.WALL, T.CRATE, T.VOID].forEach(t => SOLID_MOVE[t] = 1);
const SOLID_BULLET = SOLID_MOVE;

const FONT_UI = "'Bahnschrift','Segoe UI Semibold','Segoe UI','Roboto Condensed','Arial Narrow',sans-serif";
// Rotulación de cartel/pared: Impact y Ink Free vienen con Windows; si faltan, se usan las alternativas
const FONT_DISP = "Impact,'Haettenschweiler','Arial Narrow Bold','Franklin Gothic Heavy','Bahnschrift',sans-serif";
const FONT_TAG = "'Ink Free','Segoe Print','Bradley Hand ITC','Comic Sans MS',cursive";
const FONT_MONO = "'Cascadia Mono','Consolas','DejaVu Sans Mono',monospace";

// ───────── Distritos ─────────
const DISTRICTS = [
  { id: 0, name: 'Barrio Bajo', desc: 'Callejones, bandas y neón barato.', req: 1, base: 0, accent: '#ff2bd6',
    ground: '#231d35', walk: '#312a45', roof: '#3c3258', roofHi: '#51457a', wall: '#483f69',
    spawn: { grunt: 48, thug: 28, drone: 12, kamikaze: 12 }, mix: { b: 0.60, p: 0.14, c: 0.26 },
    signs: ['BAR', 'NEO', '24H', 'FIDEOS', 'KARAOKE', 'PRÉSTAMOS'] },
  { id: 1, name: 'Distrito Industrial', desc: 'Fábricas, humo y capataces blindados.', req: 4, base: 2, accent: '#ff8a1a',
    ground: '#2b231b', walk: '#382e23', roof: '#4d3c2c', roofHi: '#665139', wall: '#5e4b39',
    spawn: { grunt: 22, thug: 18, drone: 12, sniper: 6, heavy: 10, frenzy: 4, welder: 28 }, mix: { b: 0.50, p: 0.18, c: 0.32 },
    signs: ['FUNDICIÓN', 'ALTO VOLTAJE', 'CARGA', 'ACERO-9', 'PELIGRO', 'TURNO 3'] },
  { id: 2, name: 'Franja Neón', desc: 'Casinos, clubes y cíborgs fuera de control.', req: 7, base: 4, accent: '#19f0ff',
    ground: '#15233b', walk: '#1d2d4a', roof: '#283d63', roofHi: '#36528c', wall: '#314878',
    spawn: { grunt: 14, thug: 8, drone: 20, sniper: 12, frenzy: 20, phantom: 26 }, mix: { b: 0.54, p: 0.26, c: 0.20 },
    signs: ['CASINO', 'LÁSER', 'HOLO', 'CLUB ZERO', 'SUSHI', 'VR 4U'] },
  { id: 3, name: 'Torres Corp', desc: 'Seguridad corporativa de última generación.', req: 10, base: 6, accent: '#7fb4ff',
    ground: '#17212f', walk: '#202d40', roof: '#2c3c57', roofHi: '#3e547b', wall: '#3d527a',
    spawn: { grunt: 8, drone: 16, sniper: 14, heavy: 26, frenzy: 10, medic: 26 }, mix: { b: 0.68, p: 0.22, c: 0.10 },
    signs: ['OMNICORP', 'KIRO TECH', 'NEXUS', 'SEGURIDAD', 'I+D', 'ACCESO'] },
  { id: 4, name: 'Los Páramos', desc: 'Ruinas tóxicas donde nada es lo que parece.', req: 13, base: 8, accent: '#9cff3a',
    ground: '#1c2719', walk: '#263422', roof: '#384c32', roofHi: '#4c6644', wall: '#4e6a46',
    spawn: { thug: 16, drone: 8, sniper: 12, heavy: 12, frenzy: 22, spitter: 30 }, mix: { b: 0.26, p: 0.44, c: 0.30 },
    signs: ['RUINAS', 'RADIO', 'ZONA 9', 'CHATARRA', 'AGUA?', 'NO PASAR'] },
];
// Nivel mínimo del jugador para que aparezca el contrato del jefe de cada distrito
const BOSS_REQ = [3, 6, 9, 12, 16];
const CAP_TIERS = [10, 15, 20, 25, 30];
// Operaciones que hay que completar en un distrito para liberarlo (desbloquean el contrato del jefe)
const LIB_NEED = [3, 3, 4, 4, 5];
// Cabecillas (misión «Cazarrecompensas»): uno por distrito; base = tipo de enemigo en el que se inspiran
const LIEUTENANTS = [
  { name: 'TUERCA EL COJO', base: 'thug', title: 'Lugarteniente de Don Cromo' },
  { name: 'CAPATAZ ARCO', base: 'welder', title: 'Brazo derecho de Madre Soldadura' },
  { name: 'LA SOMBRA ROSA', base: 'phantom', title: 'Guardaespaldas de la Reina Neón' },
  { name: 'GERENTE VANTA', base: 'heavy', title: 'Jefe de seguridad del Director' },
  { name: 'EL DESECHO', base: 'spitter', title: 'Creación de Hegemón' },
];
const OP_NAMES = { hack: 'SABOTAJE', charges: 'CARGAS', hunt: 'CAZA', purge: 'LIMPIEZA', raid: 'ASALTO', deliver: 'ENTREGA', boss: 'JEFE', locked: 'JEFE' };

// ───────── Armas ─────────
const WEAPONS = {
  pistol: { name: 'Kiro-9', desc: 'Pistola de pulso fiable.', kind: 'gun', dmg: 13, rate: 3.4, spread: 0.04, pellets: 1, speed: 820, range: 720, col: '#19f0ff', size: 4 },
  smg: { name: 'Zumbador-5', desc: 'Subfusil de cadencia altísima.', kind: 'gun', dmg: 6.6, rate: 10, spread: 0.11, pellets: 1, speed: 800, range: 580, col: '#ffe14a', size: 3 },
  shotgun: { name: 'Aplastador SG', desc: 'Escopeta que arrasa de cerca.', kind: 'gun', dmg: 7, rate: 1.25, spread: 0.30, pellets: 7, speed: 700, range: 400, col: '#ff8a1a', size: 3, knock: 1 },
  smart: { name: 'Pistola Inteligente', desc: 'Las balas persiguen al objetivo.', kind: 'gun', dmg: 9.5, rate: 3.8, spread: 0.08, pellets: 1, speed: 640, range: 680, col: '#9cff3a', size: 4, homing: 3.6 },
  rail: { name: 'Riel Gauss', desc: 'Atraviesa todo. Un disparo, un pasillo.', kind: 'gun', dmg: 80, rate: 0.85, spread: 0, pellets: 1, speed: 2000, range: 1400, col: '#ffffff', size: 5, pierce: 99, beam: true },
  grenade: { name: 'Lanzabombas', desc: 'Granadas con explosión en área.', kind: 'gun', dmg: 46, rate: 1.05, spread: 0.03, pellets: 1, speed: 560, range: 640, col: '#ff3355', size: 6, explode: 100 },
  katana: { name: 'Katana Monofilo', desc: 'Corta y desvía las balas enemigas.', kind: 'melee', dmg: 38, rate: 2.3, reach: 96, arc: 2.1, col: '#7fe9ff' },
};
const TIERS = [
  { name: 'Común', mult: 1.0, col: '#c8d0e0' },
  { name: 'Rara', mult: 1.3, col: '#4aa3ff' },
  { name: 'Épica', mult: 1.7, col: '#c05cff' },
  { name: 'Legendaria', mult: 2.3, col: '#ffb020' },
];

// ───────── Personajes ─────────
const CHARS = [
  { id: 'solo', name: 'DANTE "SOLO"', role: 'Mercenario', weapon: 'smg', ability: 'adren', hp: 120, speed: 225, cost: 0, col: '#ffe14a',
    desc: 'Veterano de mil tiroteos. Aguanta y no deja de disparar.',
    abName: 'Adrenalina', abDesc: '6 s: +60% cadencia, +25% velocidad, +20% daño.', abCd: 16 },
  { id: 'kira', name: 'KIRA "NULL"', role: 'Netrunner', weapon: 'smart', ability: 'hack', hp: 90, speed: 232, cost: 120, col: '#9cff3a',
    desc: 'Frágil pero letal: sus balas buscan y su mente hackea.',
    abName: 'Intrusión', abDesc: 'Onda que aturde 4 s a los enemigos y destruye drones y torretas.', abCd: 13 },
  { id: 'mox', name: 'MOX "FUSIBLE"', role: 'Técnico', weapon: 'shotgun', ability: 'turret', hp: 108, speed: 220, cost: 200, col: '#ff8a1a',
    desc: 'Improvisa defensas con chatarra y arrasa de cerca.',
    abName: 'Torreta', abDesc: 'Despliega una torreta automática durante 14 s.', abCd: 15 },
  { id: 'ronin', name: 'RONIN "HOJA"', role: 'Samurái callejero', weapon: 'katana', ability: 'ghost', hp: 138, speed: 242, cost: 300, col: '#19f0ff',
    desc: 'Cuerpo a cuerpo. Su hoja desvía balas. Riesgo y recompensa.',
    abName: 'Corte Fantasma', abDesc: 'Atraviesa a los enemigos con una embestida invulnerable (daño x3).', abCd: 7 },
];

// ───────── Mejoras al subir de nivel ─────────
// base: disponibles desde el principio. cost: se desbloquean en el Taller con Chips.
const PERKS = [
  { id: 'dmg', name: 'Cañones recalibrados', desc: '+12% de daño', base: 1 },
  { id: 'rate', name: 'Servos acelerados', desc: '+10% de cadencia', base: 1 },
  { id: 'hp', name: 'Tejido sintético', desc: '+25 vida máxima y cura 25', base: 1 },
  { id: 'speed', name: 'Actuadores de pierna', desc: '+8% de velocidad', base: 1 },
  { id: 'dashcd', name: 'Sistema de impulso', desc: '-15% recarga de esquiva', base: 1 },
  { id: 'abcd', name: 'Núcleo de energía', desc: '-14% recarga de habilidad', base: 1 },
  { id: 'magnet', name: 'Imán neural', desc: '+35% radio de recogida', base: 1 },
  { id: 'regen', name: 'Nanobots', desc: '+1.2 de vida por segundo', base: 1 },
  { id: 'armor', name: 'Subdérmico blindado', desc: '-8% de daño recibido', cost: 60 },
  { id: 'crit', name: 'Procesador táctico', desc: '+8% de crítico (x2 daño)', cost: 80 },
  { id: 'cred', name: 'Contrabandista', desc: '+30% de créditos', cost: 90 },
  { id: 'xp', name: 'Interfaz de aprendizaje', desc: '+20% de experiencia', cost: 100 },
  { id: 'pierce', name: 'Balas perforantes', desc: 'Las balas atraviesan +1 enemigo', cost: 110 },
  { id: 'dashx', name: 'Reflejos dobles', desc: '+1 carga de esquiva', cost: 120 },
  { id: 'life', name: 'Succión de vida', desc: 'Recuperas 2.5% del daño hecho', cost: 140 },
  { id: 'shield', name: 'Escudo cinético', desc: '+40 de escudo que se recarga', cost: 160 },
  { id: 'explo', name: 'Munición explosiva', desc: 'Los disparos explotan en área pequeña', cost: 180 },
  { id: 'multi', name: 'Disparo doble', desc: '+1 proyectil por disparo', cost: 220 },
];

// ───────── Enemigos ─────────
const ENEMIES = {
  grunt: { name: 'Pandillero', hp: 42, spd: 108, r: 12, xp: 7, cred: 6, col: '#ff4d6d', pref: 230, shoot: { cd: 1.5, dmg: 8, spd: 340, n: 1, spread: 0.05 } },
  thug: { name: 'Matón', hp: 88, spd: 152, r: 14, xp: 9, cred: 7, col: '#ff9a3c', melee: { dmg: 13, cd: 0.9 } },
  drone: { name: 'Dron', hp: 30, spd: 170, r: 10, xp: 7, cred: 5, col: '#4de1ff', fly: true, pref: 270, shoot: { cd: 1.25, dmg: 6, spd: 380, n: 1, spread: 0.03 } },
  sniper: { name: 'Francotirador', hp: 38, spd: 88, r: 12, xp: 12, cred: 10, col: '#c05cff', pref: 520, snipe: { cd: 3.3, dmg: 30, tele: 0.9, spd: 1150 } },
  heavy: { name: 'Guardia pesado', hp: 235, spd: 74, r: 17, xp: 20, cred: 16, col: '#7fb4ff', pref: 210, armor: 0.25, shoot: { cd: 2.1, dmg: 6, spd: 420, n: 5, spread: 0.32 } },
  frenzy: { name: 'Cíborg frenético', hp: 128, spd: 142, r: 14, xp: 16, cred: 12, col: '#ff3355', melee: { dmg: 12, cd: 0.7 }, charge: { cd: 3.2, tele: 0.55, spd: 640, dur: 0.45, dmg: 20 } },
  kamikaze: { name: 'Chico bomba', hp: 36, spd: 188, r: 13, xp: 8, cred: 6, col: '#ffd23f', fuse: { range: 120, time: 0.55, r: 92, dmg: 30 } },
  welder: { name: 'Soldador', hp: 165, spd: 92, r: 15, xp: 14, cred: 12, col: '#ff8a1a', pref: 130, armor: 0.15, shoot: { cd: 0.14, dmg: 3.8, spd: 420, n: 3, spread: 0.13, life: 0.46, burst: 9, burstCd: 1.7 } },
  phantom: { name: 'Asesino holo', hp: 78, spd: 176, r: 12, xp: 14, cred: 11, col: '#19f0ff', melee: { dmg: 15, cd: 0.8 }, blink: { cd: 3.6, near: 110 } },
  medic: { name: 'Dron médico', hp: 64, spd: 150, r: 11, xp: 16, cred: 14, col: '#5dff9a', fly: true, pref: 330, heal: { r: 250, rate: 0.09 }, shoot: { cd: 2.2, dmg: 5, spd: 360, n: 1, spread: 0.04 } },
  spitter: { name: 'Mutante escupidor', hp: 118, spd: 98, r: 14, xp: 15, cred: 12, col: '#9cff3a', pref: 360, spit: { cd: 2.7, r: 74, dmg: 17, tele: 0.95 } },
  turret: { name: 'Torreta', hp: 105, spd: 0, r: 14, xp: 10, cred: 8, col: '#ffd23f', fixed: true, pref: 0, shoot: { cd: 0.3, dmg: 5, spd: 410, n: 1, spread: 0.06, burst: 3, burstCd: 1.8 } },
};

// ───────── Jefes ─────────
const BOSSES = [
  { id: 0, name: 'DON CROMO', title: 'Rey del Barrio Bajo', hp: 1500, spd: 125, r: 30, col: '#ff2bd6', minion: 'grunt',
    atk: { 1: ['fan', 'charge', 'summon'], 2: ['fan', 'ring', 'charge', 'summon'], 3: ['fan', 'ring', 'charge', 'bomb', 'summon'] },
    reward: { chips: 60, cred: 320, xp: 320 } },
  { id: 1, name: 'MADRE SOLDADURA', title: 'Capataz del Distrito Industrial', hp: 3100, spd: 92, r: 36, col: '#ff8a1a', minion: 'drone',
    atk: { 1: ['slam', 'fan', 'bomb'], 2: ['slam', 'ring', 'bomb', 'summon'], 3: ['slam', 'ring', 'bomb', 'laser', 'summon'] },
    reward: { chips: 100, cred: 520, xp: 700 } },
  { id: 2, name: 'REINA NEÓN', title: 'Soberana de la Franja', hp: 4900, spd: 155, r: 28, col: '#19f0ff', minion: 'frenzy',
    atk: { 1: ['spiral', 'charge', 'fan'], 2: ['spiral', 'laser', 'charge', 'fan'], 3: ['spiral', 'laser', 'charge', 'ring', 'bomb'] },
    reward: { chips: 160, cred: 800, xp: 1300 } },
  { id: 3, name: 'EL DIRECTOR', title: 'Presidente de Torres Corp', hp: 7600, spd: 105, r: 32, col: '#7fb4ff', minion: 'heavy',
    atk: { 1: ['bomb', 'fan', 'summon'], 2: ['bomb', 'laser', 'fan', 'summon', 'ring'], 3: ['bomb', 'laser', 'spiral', 'summon', 'slam', 'ring'] },
    reward: { chips: 240, cred: 1200, xp: 2400 } },
  { id: 4, name: 'HEGEMÓN', title: 'La Mente de los Páramos', hp: 12800, spd: 135, r: 38, col: '#9cff3a', minion: 'frenzy',
    atk: { 1: ['spiral', 'charge', 'slam', 'fan'], 2: ['spiral', 'laser', 'charge', 'bomb', 'summon', 'ring'], 3: ['spiral', 'laser', 'charge', 'bomb', 'summon', 'ring', 'slam'] },
    reward: { chips: 400, cred: 2500, xp: 5000 } },
];

// ───────── Misiones ─────────
function toClient(c) { return c.startsWith('el ') ? 'al ' + c.slice(3) : 'a ' + c; }
const CLIENTS = ['el Gato', 'Doña Pixel', 'Mr. Chasis', 'la Tía Voltio', 'Sombra', 'el Cuervo', 'Madame Byte', 'Cojo Tuerca'];

// ───────── Taller (meta-progresión, se paga con Chips) ─────────
const META = {
  weapons: { shotgun: 90, smart: 120, katana: 130, rail: 260, grenade: 300 },
  capCosts: [100, 220, 380, 600],
  vitCosts: [60, 120, 200],
  fundCosts: [40, 90, 160],
  cloneCost: 220,
  raidCost: 70,
};
const FREE_WEAPONS = ['pistol', 'smg'];

function xpFor(level) { return Math.round(26 + 16 * (level - 1) + 3.0 * (level - 1) * (level - 1)); }

const TIPS = [
  'Los distritos están bloqueados por nivel. Sube de nivel para abrir las barreras.',
  'Para liberar un distrito completa sus operaciones (sabotajes, cargas, cazas, limpiezas). Entonces su jefe sale a la luz.',
  'Un distrito liberado tiene menos enemigos y el Ripper te hace descuento, pero la corporación endurece el resto de la ciudad.',
  'Los Chips que ganas al morir se gastan en el Taller para desbloquear de todo.',
  'La esquiva te hace invulnerable un instante. Úsala contra los ataques marcados en rojo.',
  'Los jefes tienen fases: cuanto más daño reciben, más rápido y peligroso se vuelven.',
  'Habla con los fixers para conseguir contratos y con el Ripper para comprar armas.',
];
