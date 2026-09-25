/* ============================================================================
   aeroplaza/js/reinos/juegos.js — la ZONA DE JUEGOS, un mapa entero para jugar
   (25/09: "rearmá un mapa solo para una zona de juegos, con puertas que te
   teletransportan… sillas donde te sentás y jugás de a dos, más de 10 juegos,
   no solo en sillas, actividades como una canchita de fútbol").
   - En el medio, una plaza de vidrio con 11 puertas que teletransportan: al
     Parkour (sus 6 mapas), al Runner, al Tiro de Burbujas, a cada lugar del
     mapa (es grande) y de vuelta a la isla. Cada lugar tiene su puerta "Al
     centro".
   - Los juegos (15):
     mesas (mesas.js): damas, ta-te-ti, cuatro en línea, memotest y piedra,
       papel o tijera, de a dos con quien se siente enfrente o contra la compu;
     canchita de fútbol: la pelota se empuja corriendo y se patea con E; los
       goles cuentan por arco y la pelota va por la red (manda el último que
       la tocó);
     básquet: E tira al aro (según la distancia y para dónde mirás), dobles y
       triples, racha y récord;
     bolos: dos pistas, dos tiros por cuadro, chuza y spare;
     trampolines: siete, uno gigante; cuenta los rebotes seguidos;
     hamacas: te subís y se hamaca (moviendo el palito, más alto); tobogán: se baja solo,
       deslizándose;
     pista de baile: 64 baldosas que siguen el tema de la zona; E baila;
     y las tres puertas de juego (parkour, runner, tiro).
   ========================================================================== */
import * as THREE from 'three';
import { Mundo, azar, ruido2, suaveEntre } from '../mundo.js';
import { terreno, agua, pasto, flores, arboles, palmeras, brilloso, materialVidrio, materialBurbuja, UNI } from '../naturaleza.js';
import { Orbes, Burbujas, discoMalla, Chispas } from '../objetos.js';
import { letrero, fundir } from '../edificios.js';
import { Mesas } from '../mesas.js';
import { modelo } from '../modelos.js';
import { trampolinDe, cadenaHamaca, asientoHamaca } from '../construcciones.js';
import { t, sumar } from '../textos.js';

sumar({
  es: { reino_juegos: 'Zona de Juegos', reino_juegos_d: 'Un mapa entero para jugar: mesas de a dos, fútbol, básquet, bolos, trampolines, hamacas y las puertas a los juegos.', canal_juegos: 'Zona de Juegos',
    portal_ir: 'Entrar · {n}', portal_parkour: 'Parkour', portal_runner: 'Runner', portal_tiro: 'Tiro de Burbujas', portal_mesas: 'Mesas', portal_cancha: 'Canchita', portal_basquet: 'Básquet', portal_bolos: 'Bolos', portal_trampolines: 'Trampolines', portal_hamacas: 'Hamacas y tobogán', portal_baile: 'Pista de baile', portal_isla: 'Volver a la isla', portal_centro: 'Al centro',
    zona_jc: 'Plaza de las puertas', zona_jmesas: 'Las mesas', zona_jcancha: 'La canchita', zona_jbasquet: 'Básquet', zona_jbolos: 'Bolos', zona_jtramp: 'Trampolines', zona_jhamacas: 'Hamacas y tobogán', zona_jbaile: 'Pista de baile',
    jg_patear: 'Patear', jg_gol: '⚽ ¡Gol! Azul {a} – {b} Rosa', jg_encestar: 'Tirar al aro', jg_doble: '🏀 ¡Doble! Racha {n}', jg_triple: '🏀 ¡Triple! Racha {n}', jg_afuera: 'Afuera', jg_aro: '¡Uy, el aro!', jg_record: '🏆 Récord de racha: {n}',
    jg_bolos: 'Tirar la bola', jg_chuza: '🎳 ¡Chuza!', jg_spare: '🎳 ¡Spare!', jg_pinos: '🎳 {n} pinos', jg_rebotes: '🤸 ¡{n} rebotes seguidos!', jg_hamaca: 'Hamacarse', jg_bailar: 'Bailar', can_juegos: 'Zona de Juegos' },
  en: { reino_juegos: 'Game Zone', reino_juegos_d: 'A whole map to play: two-player tables, soccer, basketball, bowling, trampolines, swings and the doors to the games.', canal_juegos: 'Game Zone',
    portal_ir: 'Enter · {n}', portal_parkour: 'Parkour', portal_runner: 'Runner', portal_tiro: 'Bubble Shooting', portal_mesas: 'Tables', portal_cancha: 'Soccer field', portal_basquet: 'Basketball', portal_bolos: 'Bowling', portal_trampolines: 'Trampolines', portal_hamacas: 'Swings & slide', portal_baile: 'Dance floor', portal_isla: 'Back to the island', portal_centro: 'To the center',
    zona_jc: 'Door plaza', zona_jmesas: 'The tables', zona_jcancha: 'Soccer field', zona_jbasquet: 'Basketball', zona_jbolos: 'Bowling', zona_jtramp: 'Trampolines', zona_jhamacas: 'Swings & slide', zona_jbaile: 'Dance floor',
    jg_patear: 'Kick', jg_gol: '⚽ Goal! Blue {a} – {b} Pink', jg_encestar: 'Shoot', jg_doble: '🏀 Two points! Streak {n}', jg_triple: '🏀 Three points! Streak {n}', jg_afuera: 'Miss', jg_aro: 'Ouch, the rim!', jg_record: '🏆 Best streak: {n}',
    jg_bolos: 'Roll the ball', jg_chuza: '🎳 Strike!', jg_spare: '🎳 Spare!', jg_pinos: '🎳 {n} pins', jg_rebotes: '🤸 {n} bounces in a row!', jg_hamaca: 'Swing', jg_bailar: 'Dance', can_juegos: 'Game Zone' },
  pt: { reino_juegos: 'Zona de Jogos', reino_juegos_d: 'Um mapa inteiro para jogar: mesas para dois, futebol, basquete, boliche, camas elásticas, balanços e as portas para os jogos.', canal_juegos: 'Zona de Jogos',
    portal_ir: 'Entrar · {n}', portal_parkour: 'Parkour', portal_runner: 'Runner', portal_tiro: 'Tiro de Bolhas', portal_mesas: 'Mesas', portal_cancha: 'Campinho', portal_basquet: 'Basquete', portal_bolos: 'Boliche', portal_trampolines: 'Camas elásticas', portal_hamacas: 'Balanços e escorregador', portal_baile: 'Pista de dança', portal_isla: 'Voltar à ilha', portal_centro: 'Ao centro',
    zona_jc: 'Praça das portas', zona_jmesas: 'As mesas', zona_jcancha: 'O campinho', zona_jbasquet: 'Basquete', zona_jbolos: 'Boliche', zona_jtramp: 'Camas elásticas', zona_jhamacas: 'Balanços e escorregador', zona_jbaile: 'Pista de dança',
    jg_patear: 'Chutar', jg_gol: '⚽ Gol! Azul {a} – {b} Rosa', jg_encestar: 'Arremessar', jg_doble: '🏀 Cesta de dois! Sequência {n}', jg_triple: '🏀 Cesta de três! Sequência {n}', jg_afuera: 'Fora', jg_aro: 'Ai, o aro!', jg_record: '🏆 Recorde de sequência: {n}',
    jg_bolos: 'Jogar a bola', jg_chuza: '🎳 Strike!', jg_spare: '🎳 Spare!', jg_pinos: '🎳 {n} pinos', jg_rebotes: '🤸 {n} pulos seguidos!', jg_hamaca: 'Balançar', jg_bailar: 'Dançar', can_juegos: 'Zona de Jogos' },
});

const PISO = 1.0;
const R1 = ruido2(401), R2 = ruido2(77);
/* los lugares del mapa (también son las zonas: el aviso de dónde estás y la música) */
export const AREAS = {
  jc: { c: [0, 0], r: 16, icono: '🎮' },
  jmesas: { c: [0, -60], r: 16, icono: '🎲', portal: 'mesas' },
  jcancha: { c: [62, -12], r: 21, icono: '⚽', portal: 'cancha' },
  jbasquet: { c: [46, 46], r: 13, icono: '🏀', portal: 'basquet' },
  jbolos: { c: [-62, -12], r: 16, icono: '🎳', portal: 'bolos' },
  jtramp: { c: [-46, 46], r: 13, icono: '🤸', portal: 'trampolines' },
  jhamacas: { c: [0, 68], r: 15, icono: '🛝', portal: 'hamacas' },
  jbaile: { c: [40, -58], r: 10, icono: '🪩', portal: 'baile' },
};
/* una sola vez cada zona (main.js las compara por id, pero así tampoco se arma nada nuevo cada medio segundo) */
const ZONAS_J = Object.fromEntries(Object.entries(AREAS).map(([id, a]) => [id, { id, c: a.c, r: a.r, icono: a.icono, musica: 'juegos' }]));
const DESTINOS = ['parkour', 'runner', 'tiro', 'mesas', 'cancha', 'basquet', 'bolos', 'trampolines', 'hamacas', 'baile', 'isla'];
const COLOR_PORTAL = { parkour: '#56d05a', runner: '#ff5fb0', tiro: '#ffd23f', mesas: '#39b8f0', cancha: '#3fd08a', basquet: '#ff9a3d', bolos: '#9b7bff', trampolines: '#ff6fb0', hamacas: '#43d8cd', baile: '#c77bff', isla: '#7fe8ff', centro: '#bff0ff' };
/* el tobogán: una rampa que es parte del piso (así el muñeco la baja sola) */
const RAMPA = { x0: 7.2, x1: 16.5, z: 66, a: 0.62, y0: PISO + 4.2, y1: PISO + 0.05 };
const enRampa = (x, z) => x > RAMPA.x0 && x < RAMPA.x1 && Math.abs(z - RAMPA.z) < RAMPA.a;
const alturaRampa = (x) => { const u = Math.min(1, Math.max(0, (x - RAMPA.x0) / (RAMPA.x1 - RAMPA.x0))); return RAMPA.y1 + (RAMPA.y0 - RAMPA.y1) * Math.pow(1 - u, 1.5); };

/* el piso: una meseta chata (para jugar), lomas alrededor y el mar */
function alturaBase(x, z) {
  const d = Math.hypot(x, z) + R2(x * 0.06, z * 0.06) * 3;
  if (d < 100) return PISO;
  if (d < 118) return PISO + Math.pow((d - 100) / 18, 1.6) * (3 + R1(x * 0.05, z * 0.05) * 1.5);
  return PISO + 4 - (d - 118) * 0.9;
}
export function alturaJuegos(x, z) { return enRampa(x, z) ? alturaRampa(x) : alturaBase(x, z); }
function colorJuegos(x, z, h) {
  if (h < 0.6) return [0.98, 0.92, 0.72, 0.1];
  const v = 0.88 + R2(x * 0.18, z * 0.18) * 0.12;
  return [0.36 * v, 0.84 * v, 0.3 * v, 1];
}

/* la película que gira adentro de las puertas */
const PORTAL_FS = /* glsl */`
  uniform float uT; uniform vec3 uColor; varying vec2 vUv;
  void main() { vec2 c = vUv - 0.5; float r = length(c) * 2.0; float a = atan(c.y, c.x);
    float remo = sin(a * 3.0 + r * 10.0 - uT * 3.2) * 0.5 + 0.5; float borde = smoothstep(1.0, 0.86, r);
    vec3 col = mix(uColor, vec3(1.0), pow(max(0.0, 1.0 - r), 3.0) * 0.85 + remo * 0.22);
    gl_FragColor = vec4(col, borde * (0.5 + remo * 0.35)); }`;

export function crearJuegos(ctx) {
  const A = alturaJuegos;
  const mundo = new Mundo(A); mundo.agua = 0; mundo.limite = 108;
  const g = new THREE.Group(), fijo = new THREE.Group(), r = azar(9);
  g.add(terreno(alturaBase, { tam: 280, seg: 200, color: colorJuegos }));
  const mar = agua(0, alturaBase, { rect: [-140, -140, 280], colorPlaya: '#5ff0e0', colorHondo: '#0b62c0' }); g.add(mar);
  const mats = {}; const mat = (c, o) => (mats[c + JSON.stringify(o || {})] ||= brilloso(c, o));
  const blanco = mat('#ffffff', { roughness: 0.18 }), aqua = mat('#43d8cd', { emissive: '#1fb0ea', emissiveIntensity: 0.35 }), vidrio = materialVidrio('#e6fbff', 0.28);
  const caja = (x, y, z, w, h, d, m = blanco, grupo = fijo) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); grupo.add(o); return o; };
  const cil = (x, y, z, r0, r1, h, m = blanco, grupo = fijo, seg = 20) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m); o.position.set(x, y, z); grupo.add(o); return o; };

  /* ------------------------------------------------ caminos del centro a cada lugar */
  const matCamino = mat('#f4fbff', { roughness: 0.35 });
  for (const [k, a] of Object.entries(AREAS)) {
    if (k === 'jc') continue;
    const [x, z] = a.c, L = Math.hypot(x, z) - a.r * 0.6 - 14, ang = Math.atan2(x, z);
    const c = new THREE.Mesh(new THREE.PlaneGeometry(3.2, L).rotateX(-Math.PI / 2), matCamino); c.position.set(Math.sin(ang) * (14 + L / 2), PISO + 0.02, Math.cos(ang) * (14 + L / 2)); c.rotation.y = ang; fijo.add(c);
    for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, L), aqua); b.position.set(c.position.x + Math.cos(ang) * 1.7 * s, PISO + 0.05, c.position.z - Math.sin(ang) * 1.7 * s); b.rotation.y = ang; fijo.add(b); }
  }

  /* ------------------------------------------------ la plaza de las puertas */
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(15, 15.4, 0.12, 64), materialVidrio('#dff8ff', 0.6)); plaza.position.y = PISO + 0.04; plaza.receiveShadow = true; g.add(plaza);
  const anillo = new THREE.Mesh(new THREE.TorusGeometry(15.1, 0.12, 8, 96).rotateX(Math.PI / 2), aqua); anillo.position.y = PISO + 0.12; fijo.add(anillo);
  mundo.cilindro(0, 0, 15.2, PISO - 1, PISO + 0.1);
  /* la torre del medio: un tubo de vidrio con anillos de luz que suben */
  const torre = new THREE.Group(); torre.position.set(0, PISO, 0); g.add(torre);
  const tubo = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 10, 32, 1, true), materialVidrio('#bff0ff', 0.25)); tubo.position.y = 5; tubo.renderOrder = 3; torre.add(tubo);
  cil(0, PISO + 0.4, 0, 2.1, 2.4, 0.8, blanco); mundo.cilindro(0, 0, 2.2, PISO - 1, PISO + 0.8);
  const anillos = [0, 1, 2, 3].map((i) => { const a = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.07, 8, 40).rotateX(Math.PI / 2), brilloso(['#56d05a', '#39b8f0', '#ff6fb0', '#ffd23f'][i], { emissive: ['#56d05a', '#39b8f0', '#ff6fb0', '#ffd23f'][i], emissiveIntensity: 0.9 })); torre.add(a); return a; });
  const esfera = new THREE.Mesh(new THREE.SphereGeometry(1.2, 32, 20), materialBurbuja(1)); esfera.position.y = 11.2; esfera.renderOrder = 4; torre.add(esfera);
  for (let k = 0; k < 4; k++) { const c = letrero('🎮 ' + t('reino_juegos'), { ancho: 5.4, alto: 1.1, tinta: '#1a78c2', borde: '#7fd3ff', tam: 92 }); const a = k * Math.PI / 2; c.position.set(Math.sin(a) * 1.75, PISO + 8.4, Math.cos(a) * 1.75); c.rotation.y = a; g.add(c); }
  /* las puertas: arco de gelatina, la película que gira y el cartel */
  const uT = UNI.uT, portales = [];
  const hacerPortal = (x, z, rot, destino, grupo = g) => {
    const P = new THREE.Group(); P.position.set(x, PISO, z); P.rotation.y = rot; grupo.add(P);
    const col = COLOR_PORTAL[destino];
    /* el aro con su pedestal (construcciones.js, copiado del GLB); la membrana del color de la puerta gira adentro */
    const arco = modelo('portalJuegos', { escala: 1 }); P.add(arco); mundo.cilindro(x, z, 1.5, PISO - 1, PISO + 0.32);
    const brillo = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.05, 8, 64), new THREE.MeshBasicMaterial({ color: col })); brillo.position.y = 1.72; brillo.position.z = 0.16; P.add(brillo);
    const brillo2 = brillo.clone(); brillo2.position.z = -0.16; P.add(brillo2);
    const pel = new THREE.Mesh(new THREE.CircleGeometry(1.07, 48), new THREE.ShaderMaterial({ uniforms: { uT, uColor: { value: new THREE.Color(col) } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: PORTAL_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    pel.position.y = 1.72; pel.renderOrder = 3; P.add(pel);
    const cartel = letrero(t('portal_' + destino), { ancho: 2.6, alto: 0.55, tinta: '#1a78c2', borde: col, tam: 120 }); cartel.position.y = 3.5; P.add(cartel);
    const cartel2 = cartel.clone(); cartel2.rotation.y = Math.PI; P.add(cartel2);
    const pos = new THREE.Vector3(x, PISO, z);
    mundo.interactivo({ id: 'portal-' + destino + '-' + portales.length, accion: 'portal', destino, pos, radio: 1.9, icono: '🌀', textoFn: () => t('portal_ir', { n: t('portal_' + destino) }) });
    portales.push({ P, destino, pos, arco, pel });
    return P;
  };
  DESTINOS.forEach((d, i) => { const a = i / DESTINOS.length * Math.PI * 2 + Math.PI; hacerPortal(Math.sin(a) * 10.8, Math.cos(a) * 10.8, a + Math.PI, d); });
  /* a dónde lleva cada puerta de lugar (y la de "al centro" de cada lugar) */
  const llegadas = {};
  for (const [k, a] of Object.entries(AREAS)) {
    if (!a.portal) continue;
    /* (la puerta va al costado del camino: si no, al llegar quedaba entre la cámara y el muñeco) */
    const [x, z] = a.c, ang = Math.atan2(-x, -z), d = a.r * 0.62, lx = Math.cos(ang), lz = -Math.sin(ang);
    const px = x + Math.sin(ang) * d, pz = z + Math.cos(ang) * d;
    hacerPortal(px + lx * 3.8, pz + lz * 3.8, ang, 'centro');
    llegadas[a.portal] = { p: new THREE.Vector3(px - Math.sin(ang) * 1.5, PISO + 0.1, pz - Math.cos(ang) * 1.5), rumbo: ang + Math.PI };
  }

  /* ------------------------------------------------ las mesas, bajo una pérgola de vidrio */
  const [mx, mz] = AREAS.jmesas.c;
  const JM = ['damas', 'tateti', 'cuatro', 'memo', 'ppt', 'damas'];
  const mesas = new Mesas(g, mundo, JM.map((juego, i) => ({ juego, x: mx + (i % 3 - 1) * 6, z: mz + (Math.floor(i / 3) - 0.5) * 6.5, rot: 0, y: PISO })));
  caja(mx, PISO + 4.2, mz, 21, 0.12, 15, vidrio);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { cil(mx + sx * 10, PISO + 2.1, mz + sz * 7, 0.18, 0.2, 4.2); mundo.cilindro(mx + sx * 10, mz + sz * 7, 0.22, PISO - 1, PISO + 4.2); }
  for (let i = 0; i < 6; i++) { const c = letrero(t('mesa_' + JM[i]), { ancho: 2.2, alto: 0.45, tinta: '#1a78c2', borde: '#7fd3ff', tam: 118 }); c.position.set(mx + (i % 3 - 1) * 6, PISO + 2.4, mz + (Math.floor(i / 3) - 0.5) * 6.5); g.add(c); const c2 = c.clone(); c2.rotation.y = Math.PI; g.add(c2); }

  /* ------------------------------------------------ la canchita de fútbol */
  const [cx, cz] = AREAS.jcancha.c, LX = 14, LZ = 8.5;
  const cvC = document.createElement('canvas'); cvC.width = 1024; cvC.height = 620; { const q = cvC.getContext('2d'); for (let i = 0; i < 10; i++) { q.fillStyle = i % 2 ? '#46c24a' : '#3fb244'; q.fillRect(i * 102.4, 0, 103, 620); } q.strokeStyle = '#ffffff'; q.lineWidth = 8; q.strokeRect(16, 16, 992, 588); q.beginPath(); q.moveTo(512, 16); q.lineTo(512, 604); q.stroke(); q.beginPath(); q.arc(512, 310, 80, 0, 7); q.stroke(); q.strokeRect(16, 190, 110, 240); q.strokeRect(898, 190, 110, 240); }
  const texC = new THREE.CanvasTexture(cvC); texC.colorSpace = THREE.SRGBColorSpace; texC.anisotropy = 4;
  const campo = new THREE.Mesh(new THREE.PlaneGeometry(LX * 2 + 1, LZ * 2 + 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: texC, roughness: 0.8 })); campo.position.set(cx, PISO + 0.03, cz); campo.receiveShadow = true; g.add(campo);
  /* los bordes bajitos de vidrio (con entradas en las esquinas) y los arcos */
  for (const s of [-1, 1]) { caja(cx, PISO + 0.25, cz + s * (LZ + 0.6), LX * 2 - 6, 0.5, 0.15, vidrio); mundo.caja(cx, cz + s * (LZ + 0.6), LX - 3, 0.1, PISO - 1, PISO + 0.5); }
  const arcos = [-1, 1].map((s) => {
    /* el arco (construcciones.js, copiado del GLB): la boca mira a la cancha */
    const G2 = modelo('arcoFutbol', { escala: 1 }); G2.position.set(cx + s * LX, PISO, cz); G2.rotation.y = -s * Math.PI / 2; g.add(G2);
    for (const zz of [-2.5, 2.5]) mundo.cilindro(cx + s * LX, cz + zz, 0.12, PISO - 1, PISO + 2.2);
    mundo.caja(cx + s * (LX + 1.45), cz, 0.05, 2.6, PISO - 1, PISO + 2.2);
    return G2;
  });
  /* la pelota (de gelatina con pentágonos celestes) y el marcador */
  const cvP = document.createElement('canvas'); cvP.width = 256; cvP.height = 128; { const q = cvP.getContext('2d'); q.fillStyle = '#ffffff'; q.fillRect(0, 0, 256, 128); q.fillStyle = '#1a8fd8'; for (let i = 0; i < 12; i++) { const x = (i % 6) * 44 + (i >= 6 ? 22 : 0), y = i >= 6 ? 88 : 36; q.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28 - 1.57; q.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); } q.fill(); } }
  const texP = new THREE.CanvasTexture(cvP); texP.colorSpace = THREE.SRGBColorSpace;
  const RP = 0.36;
  const pelotaM = new THREE.Mesh(new THREE.SphereGeometry(RP, 28, 18), new THREE.MeshPhysicalMaterial({ map: texP, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 })); pelotaM.castShadow = true; g.add(pelotaM);
  const pelota = { p: new THREE.Vector3(cx, PISO + RP, cz), v: new THREE.Vector3(), ultimo: null, tToque: 0, tRed: 0, tEnviar: 0, marcador: [0, 0], tGol: 0 };
  const cvM = document.createElement('canvas'); cvM.width = 512; cvM.height = 160; const texM = new THREE.CanvasTexture(cvM); texM.colorSpace = THREE.SRGBColorSpace;
  const pintarMarcador = () => { const q = cvM.getContext('2d'); const gr = q.createLinearGradient(0, 0, 0, 160); gr.addColorStop(0, '#1a3a6a'); gr.addColorStop(1, '#0b1f3f'); q.fillStyle = gr; q.fillRect(0, 0, 512, 160); q.font = '900 92px sans-serif'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillStyle = '#6fd6ff'; q.fillText(String(pelota.marcador[0]), 150, 84); q.fillStyle = '#ffffff'; q.fillText('–', 256, 80); q.fillStyle = '#ff9ad8'; q.fillText(String(pelota.marcador[1]), 362, 84); texM.needsUpdate = true; };
  pintarMarcador();
  for (const s of [-1, 1]) { const tab = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 1.5), new THREE.MeshBasicMaterial({ map: texM })); tab.position.set(cx, PISO + 4.4, cz + s * (LZ + 2.4)); tab.rotation.y = s > 0 ? Math.PI : 0; g.add(tab); cil(cx - 2, PISO + 1.8, cz + s * (LZ + 2.4), 0.08, 0.08, 3.6); cil(cx + 2, PISO + 1.8, cz + s * (LZ + 2.4), 0.08, 0.08, 3.6); }
  mundo.interactivo({ id: 'patear', accion: 'patear', pos: () => pelota.p, radio: 1.5, icono: '⚽', textoFn: () => t('jg_patear') });

  /* ------------------------------------------------ básquet */
  const [bx, bz] = AREAS.jbasquet.c;
  const cvB = document.createElement('canvas'); cvB.width = 512; cvB.height = 512; { const q = cvB.getContext('2d'); q.fillStyle = '#9fdcff'; q.fillRect(0, 0, 512, 512); q.strokeStyle = '#ffffff'; q.lineWidth = 7; q.strokeRect(10, 10, 492, 492); q.beginPath(); q.arc(492, 256, 330, Math.PI * 0.62, Math.PI * 1.38); q.stroke(); q.strokeRect(362, 186, 140, 140); }
  const texB = new THREE.CanvasTexture(cvB); texB.colorSpace = THREE.SRGBColorSpace;
  const pisoB = new THREE.Mesh(new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: texB, roughness: 0.5 })); pisoB.position.set(bx, PISO + 0.03, bz); g.add(pisoB);
  const ARO = new THREE.Vector3(bx + 5.6, PISO + 3.05, bz);
  /* el aro (construcciones.js, copiado del GLB): el aro queda justo en ARO y el tablero 0,45 atrás */
  const aroM = modelo('aroBasquet', { escala: 1 }); aroM.position.set(ARO.x + 0.45, PISO, ARO.z); aroM.rotation.y = -Math.PI / 2; g.add(aroM);
  mundo.cilindro(ARO.x + 1.8, bz, 0.62, PISO - 1, PISO + 0.36); mundo.cilindro(ARO.x + 1.8, bz, 0.13, PISO - 1, PISO + 3.4);
  const redB = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.15, 0.42, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.7 })); redB.position.set(ARO.x, ARO.y - 0.21, ARO.z); g.add(redB);
  const pelB = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 14), brilloso('#ff9a3d', { roughness: 0.35 })); pelB.visible = false; pelB.castShadow = true; g.add(pelB);
  const basquet = { vuela: null, racha: 0, mejor: 0 };
  mundo.interactivo({ id: 'encestar', accion: 'encestar', pos: new THREE.Vector3(bx, PISO, bz), radio: 7.5, icono: '🏀', textoFn: () => t('jg_encestar') });

  /* ------------------------------------------------ bolos: dos pistas hacia -x */
  const [lx0, lz0] = AREAS.jbolos.c;
  const PISTAS = [lz0 - 2.4, lz0 + 2.4].map((z) => ({ z, x0: lx0 + 10, x1: lx0 - 8.5 }));
  const matPista = new THREE.MeshPhysicalMaterial({ color: '#e8f8ff', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
  const perfilPino = [[0, 0], [0.06, 0.02], [0.09, 0.12], [0.07, 0.24], [0.045, 0.3], [0.06, 0.37], [0.05, 0.42], [0, 0.45]].map(([x, y]) => new THREE.Vector2(x, y));
  const geoPino = new THREE.LatheGeometry(perfilPino, 14), matPino = brilloso('#ffffff', { roughness: 0.2 }), matFaja = brilloso('#ff6fb0', {});
  const bolos = PISTAS.map((P, i) => {
    const pista = new THREE.Mesh(new THREE.BoxGeometry(P.x0 - P.x1 + 2, 0.06, 1.7), matPista); pista.position.set((P.x0 + P.x1) / 2 - 1, PISO + 0.04, P.z); pista.receiveShadow = true; g.add(pista);
    for (const s of [-1, 1]) caja((P.x0 + P.x1) / 2 - 1, PISO + 0.02, P.z + s * 1.05, P.x0 - P.x1 + 2, 0.04, 0.4, aqua);
    caja(P.x1 - 1.6, PISO + 0.6, P.z, 0.3, 1.2, 2.6, blanco); mundo.caja(P.x1 - 1.6, P.z, 0.15, 1.3, PISO - 1, PISO + 1.2);
    const pinos = [];
    for (let fila = 0; fila < 4; fila++) for (let k = 0; k <= fila; k++) {
      const m = new THREE.Group(); const cuerpo = new THREE.Mesh(geoPino, matPino); cuerpo.castShadow = true; m.add(cuerpo); const faja = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.03, 12), matFaja); faja.position.y = 0.33; m.add(faja);
      const px = P.x1 + 0.9 - fila * 0.32, pz = P.z + (k - fila / 2) * 0.32; m.position.set(px, PISO + 0.07, pz); g.add(m);
      pinos.push({ m, x0: px, z0: pz, de: false, v: new THREE.Vector3(), caida: 0, dir: 0, t: 0 });
    }
    const bola = new THREE.Mesh(new THREE.SphereGeometry(0.2, 22, 16), new THREE.MeshPhysicalMaterial({ color: '#2f5dff', roughness: 0.1, clearcoat: 1, metalness: 0.2 })); bola.visible = false; bola.castShadow = true; g.add(bola);
    mundo.interactivo({ id: 'bolos' + i, accion: 'bolos', pista: i, pos: new THREE.Vector3(P.x0 + 1.2, PISO, P.z), radio: 1.6, icono: '🎳', textoFn: () => t('jg_bolos') });
    return { ...P, pinos, bola, tira: null, tiro: 1, caidosAntes: 0 };
  });

  /* ------------------------------------------------ trampolines */
  const [tx0, tz0] = AREAS.jtramp.c;
  const tramp = [];
  const TR = [[0, 0, 2.6, 24], [-6, -4, 1.4, 13], [6, -4, 1.4, 15], [-7, 4, 1.4, 14], [7, 4, 1.4, 16], [-2.5, 7.5, 1.2, 12], [2.5, -8, 1.2, 18]];
  TR.forEach(([dx, dz, R, fuerza], i) => {
    const x = tx0 + dx, z = tz0 + dz, col = ['#ff6fb0', '#39b8f0', '#56d05a', '#ffd23f', '#c77bff', '#43d8cd', '#ff9a3d'][i];
    /* el armazón (construcciones.js, copiado del GLB) y la tela, que se hunde en cada rebote */
    const arm = trampolinDe(R); arm.position.set(x, PISO, z); g.add(arm);
    const tela = new THREE.Mesh(new THREE.CircleGeometry(R - 0.2, 48).rotateX(-Math.PI / 2), brilloso('#1a3a6a', { roughness: 0.55, side: THREE.DoubleSide, borde: 0.1 })); tela.position.set(x, PISO + 0.34, z); g.add(tela);
    const anillo = new THREE.Mesh(new THREE.TorusGeometry(R - 0.2, 0.03, 6, 48).rotateX(Math.PI / 2), brilloso(col, { emissive: col, emissiveIntensity: 0.3 })); anillo.position.set(x, PISO + 0.35, z); g.add(anillo);
    const s = mundo.cilindro(x, z, R - 0.1, PISO - 1, PISO + 0.36, { rebote: fuerza, sinTecho: true, clave: 'tramp' + i });
    s.alRebotar = () => { tela.userData.aplasta = 1; if (reinoJ.J) { reinoJ.saltosTramp++; const n = reinoJ.saltosTramp; if ([5, 10, 20, 30].includes(n)) { reinoJ.J.avisar(t('jg_rebotes', { n }), 'bien'); reinoJ.J.sfx('gota', { k: n / 5 }); } } };
    tramp.push({ tela, x, z, R });
  });

  /* ------------------------------------------------ hamacas y tobogán */
  const [hx, hz] = AREAS.jhamacas.c;
  const hamacas = [];
  /* el armazón (construcciones.js, copiado del GLB): dos A de aqua y la barra a 5,3 m */
  const armH = modelo('hamacas', { escala: 1 }); armH.position.set(hx - 8, PISO, hz); g.add(armH);
  for (const s of [-1, 1]) for (const e of [-1, 1]) mundo.cilindro(hx - 8 + s * 5.4, hz + e * 1.35, 0.16, PISO - 1, PISO + 1.5);
  const geoCadena = cadenaHamaca(3.9), geoAsiento = asientoHamaca(), matCadena = new THREE.MeshStandardMaterial({ color: '#e8eef4', metalness: 1, roughness: 0.2 });
  for (let i = 0; i < 3; i++) {
    const px = hx - 8 + (i - 1) * 3.2, pz = hz, L = 3.9, colA = ['#ff6fb0', '#39b8f0', '#ffd23f'][i];
    const piv = new THREE.Group(); piv.position.set(px, PISO + 5.3, pz); g.add(piv);
    for (const e of [-0.32, 0.32]) { const c = new THREE.Mesh(geoCadena, matCadena); c.position.set(e, -0.08, 0); piv.add(c); }
    const asiento = new THREE.Mesh(geoAsiento, brilloso(colA, { roughness: 0.2 })); asiento.position.y = -L - 0.03; asiento.castShadow = true; piv.add(asiento);
    const H = {
      piv, L, ang: 0, w: 0, jinete: null, rumbo: 0, bajoAgua: false, pose: 'hamaca', px, pz, p: new THREE.Vector3(px, PISO + 1, pz),   // (p: dónde está, para la cámara y la red)
      manejar(dt, E, quiere, cuanto) {
        /* un péndulo: empujar (adelante/atrás) suma cuando va para ese lado; solo se hamaca despacio */
        const empuje = (cuanto || 0) * 1.8 * Math.sign(this.w || 1) + 0.35 * Math.sign(this.w || 1) * (Math.abs(this.ang) < 0.25 ? 1 : 0);
        this.w += (-9.8 / this.L * Math.sin(this.ang) + empuje - this.w * 0.12) * dt;
        this.ang += this.w * dt; this.ang = Math.max(-1.15, Math.min(1.15, this.ang));
        this.piv.rotation.x = -this.ang; this.hamacaFase = this.ang; this.p.copy(this.asiento());
      },
      asiento() { return new THREE.Vector3(this.px, PISO + 5.3 - Math.cos(this.ang) * (this.L - 0.05) - 0.34, this.pz + Math.sin(this.ang) * (this.L - 0.05)); },
      puedeBajar() { return true; },
      salida() { return new THREE.Vector3(this.px, PISO + 0.1, this.pz + 1.6); },
    };
    hamacas.push(H);
    mundo.interactivo({ id: 'hamaca' + i, accion: 'hamaca', hamaca: i, pos: new THREE.Vector3(px, PISO, pz), radio: 1.5, icono: '🛝', textoFn: () => t('jg_hamaca') });
  }
  /* el tobogán: torre con escalera, la plataforma y la rampa (que es parte del piso) */
  const TX = RAMPA.x0 - 1.4;
  /* la torre (construcciones.js, copiada del GLB): postes, plataforma a 4,2 m, barandas de vidrio y la cúpula */
  const torreT = modelo('torreTobogan', { escala: 1 }); torreT.position.set(TX, PISO, RAMPA.z); g.add(torreT);
  mundo.caja(TX, RAMPA.z, 1.4, 1.4, PISO - 1, RAMPA.y0);
  for (const s of [-1, 1]) mundo.caja(TX, RAMPA.z + s * 1.3, 1.4, 0.08, RAMPA.y0 - 0.2, RAMPA.y0 + 1.1);
  const escalones = 12;
  for (let i = 0; i < escalones; i++) {
    const y = PISO + (i + 1) * (RAMPA.y0 - PISO) / escalones, x = TX - 1.4 - (escalones - i) * 0.36;
    caja(x + 0.18, y - 0.08, RAMPA.z, 0.4, 0.16, 1.1, mat('#bff0ff', { roughness: 0.25 })); mundo.caja(x + 0.18, RAMPA.z, 0.2, 0.55, PISO - 1, y);
  }
  /* la rampa: una canaleta celeste en U (como la del GLB) que sigue alturaRampa, con los bordes redondos (y sólidos a los costados) */
  { const N = 60, K = 12, pos = [], idx = [];
    const perfil = Array.from({ length: K + 1 }, (_, k) => { const u = k / K * Math.PI; return [-Math.cos(u) * (RAMPA.a + 0.1), 0.02 + (1 - Math.sin(u)) * 0.38]; });
    perfil.unshift([-(RAMPA.a + 0.16), 0.44]); perfil.push([RAMPA.a + 0.16, 0.44]);
    const P = perfil.length;
    for (let i = 0; i <= N; i++) { const x = RAMPA.x0 + (RAMPA.x1 - RAMPA.x0) * i / N, y = alturaRampa(x); for (const [dz, dy] of perfil) pos.push(x, y + dy, RAMPA.z + dz); if (i < N) for (let k = 0; k < P - 1; k++) { const a = i * P + k, b = a + P; idx.push(a, b, a + 1, a + 1, b, b + 1); } }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const rampa = new THREE.Mesh(geo, brilloso('#6fc4ff', { roughness: 0.08, side: THREE.DoubleSide, borde: 0.45 })); rampa.castShadow = true; g.add(rampa);
    /* los pasamanos de la escalera, blancos */
    for (const sz of [-0.62, 0.62]) { const pts = [new THREE.Vector3(TX - 1.4 - escalones * 0.36, PISO + 0.9, RAMPA.z + sz), new THREE.Vector3(TX - 1.3, RAMPA.y0 + 0.95, RAMPA.z + sz)]; const t2 = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 4, 0.05, 8), blanco); fijo.add(t2); for (const q of [0, 1]) cil(pts[q].x, (pts[q].y + (q ? RAMPA.y0 : PISO)) / 2, pts[q].z, 0.04, 0.04, pts[q].y - (q ? RAMPA.y0 : PISO)); }
    for (let i = 0; i < 8; i++) { const x = RAMPA.x0 + (RAMPA.x1 - RAMPA.x0) * (i + 0.5) / 8, y = alturaRampa(x); for (const s of [-1, 1]) mundo.caja(x, RAMPA.z + s * (RAMPA.a + 0.15), (RAMPA.x1 - RAMPA.x0) / 16 + 0.05, 0.08, y - 1, y + 0.45); if (i < 7) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, y - PISO, 8), blanco); p.position.set(x, (y + PISO) / 2, RAMPA.z - RAMPA.a - 0.2); fijo.add(p); } }
  }

  /* ------------------------------------------------ la pista de baile */
  const [dx0, dz0] = AREAS.jbaile.c, NB = 8, LB = 1.2;
  const baldosas = new THREE.InstancedMesh(new THREE.BoxGeometry(LB - 0.06, 0.1, LB - 0.06), new THREE.MeshStandardMaterial({ roughness: 0.2, emissive: '#ffffff', emissiveIntensity: 0.55 }), NB * NB);
  { const M4 = new THREE.Matrix4(); for (let i = 0; i < NB * NB; i++) { M4.makeTranslation(dx0 + (i % NB - NB / 2 + 0.5) * LB, PISO + 0.05, dz0 + (Math.floor(i / NB) - NB / 2 + 0.5) * LB); baldosas.setMatrixAt(i, M4); baldosas.setColorAt(i, new THREE.Color('#ffffff')); } }
  g.add(baldosas); mundo.caja(dx0, dz0, NB * LB / 2, NB * LB / 2, PISO - 1, PISO + 0.1);
  const bolaDisco = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 2), new THREE.MeshStandardMaterial({ color: '#dfe8f0', metalness: 1, roughness: 0.12, flatShading: true })); bolaDisco.position.set(dx0, PISO + 5.4, dz0); g.add(bolaDisco);
  cil(dx0, PISO + 6.2, dz0, 0.02, 0.02, 1.4);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { cil(dx0 + sx * 5.6, PISO + 3.3, dz0 + sz * 5.6, 0.12, 0.14, 6.6); }
  const haces = [0, 1, 2, 3].map((i) => { const h = new THREE.Mesh(new THREE.ConeGeometry(1.4, 5.2, 20, 1, true), new THREE.MeshBasicMaterial({ color: ['#ff6fb0', '#39b8f0', '#56d05a', '#ffd23f'][i], transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); h.position.set(dx0, PISO + 5.4, dz0); g.add(h); return h; });
  mundo.interactivo({ id: 'baile', accion: 'baile', pos: new THREE.Vector3(dx0, PISO, dz0), radio: 5.6, icono: '🪩', textoFn: () => t('jg_bailar') });

  /* ------------------------------------------------ árboles, flores, pasto, burbujas y orbes */
  const libre = (x, z) => Object.values(AREAS).every((a) => Math.hypot(x - a.c[0], z - a.c[1]) > a.r + 3) && Object.values(AREAS).every((a) => { if (a === AREAS.jc) return true; const ang = Math.atan2(a.c[0], a.c[1]); const px = Math.sin(ang), pz = Math.cos(ang), s = x * px + z * pz, d = Math.abs(x * pz - z * px); return s < 14 || s > Math.hypot(...a.c) - a.r * 0.5 || d > 3.5; });
  const arb = [], pal = [];
  for (let i = 0; i < 260 && arb.length + pal.length < 90; i++) { const a = r() * 6.28, d = 20 + r() * 80, x = Math.sin(a) * d, z = Math.cos(a) * d; if (!libre(x, z)) continue; (d > 70 ? pal : arb).push([x, z, 0.7 + r() * 0.5, r() * 6.28]); }
  g.add(arboles(A, arb.filter((q, i) => i % 2 === 0))); g.add(arboles(A, arb.filter((q, i) => i % 2 === 1), { variante: 'arbolRosa', tintes: ['#ffffff', '#ffe6f4'] }));
  g.add(palmeras(A, pal));
  for (const [x, z, e] of [...arb, ...pal]) mundo.cilindro(x, z, 0.35 * e, PISO - 1, PISO + 2.5 * e);
  const hayPasto = (x, z) => A(x, z) > 0.8 && libre(x, z) && Math.hypot(x, z) > 16;
  g.add(pasto(A, hayPasto, { n: Math.round(14000 * ctx.calidad.pasto), area: [-110, -110, 220] }));
  g.add(flores(A, hayPasto, { n: 700, area: [-100, -100, 200] }));
  const burbujas = new Burbujas(g, [[0, PISO, 0, 12], [dx0, PISO, dz0, 5], [tx0, PISO, tz0, 7]], { n: 70, alto: 20, tam: [0.2, 0.9] });
  const orbLug = [];
  for (const [k, a] of Object.entries(AREAS)) for (let i = 0; i < 6; i++) { const b = i / 6 * 6.28; orbLug.push([a.c[0] + Math.cos(b) * (a.r + 1.5), PISO + 1, a.c[1] + Math.sin(b) * (a.r + 1.5)]); }
  for (let i = 0; i < 8; i++) { const b = i / 8 * 6.28; orbLug.push([tx0 + Math.cos(b) * 1.8, PISO + 9 + (i % 3) * 2, tz0 + Math.sin(b) * 1.8]); }   // los altos, con el trampolín gigante
  const orbes = new Orbes(g, orbLug, { color: '#ffd6f5' });
  const discos = [{ id: 'disco-juegos', p: new THREE.Vector3(TX, RAMPA.y0 + 1.2, RAMPA.z), cancion: 'juegos' }].map((d) => { const m = discoMalla(); m.position.copy(d.p); g.add(m); return { ...d, malla: m }; });
  const chispas = new Chispas(g, '#ffffff', 120);
  /* el tren, para ir a los demás reinos */
  const anden = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.3, 0.4, 6), blanco); anden.position.set(-9, PISO + 0.2, 18); g.add(anden);
  mundo.cilindro(-9, 18, 3, PISO - 1, PISO + 0.4);
  mundo.interactivo({ id: 'tren', pos: new THREE.Vector3(-9, PISO + 0.4, 18), radio: 3, accion: 'viajar', icono: '🚆' });

  g.add(fundir(fijo));

  /* ------------------------------------------------ lo que se mueve */
  const G3 = new THREE.Vector3(0, -18, 0), tmp = new THREE.Vector3();
  let tt = 0;
  const reinoJ = {
    id: 'juegos', mundo, grupo: g, mar, inicio: new THREE.Vector3(0, PISO + 0.12, 5.5), rumboInicio: 0, musica: 'juegos', cielo: { arcoiris: 0.6 },
    orbes, discos, npcs: [], burbujas, mesas, pelota, hamacas, llegadas, portales, basquet, bolos, tramp, ARO, RAMPA, PISO, CANCHA: { cx, cz, LX, LZ }, saltosTramp: 0, J: null,
    zonaEn(x, z) { let mejor = null, md = 1e9; for (const [id, a] of Object.entries(AREAS)) { const d = Math.hypot(x - a.c[0], z - a.c[1]); if (d < a.r && d < md) { md = d; mejor = ZONAS_J[id]; } } return mejor; },
    alEntrar(J) { this.J = J; },
    /* el tobogán: en la rampa se baja solo, deslizándose */
    antesDelJugador(dt, yo) {
      if (yo.modo !== 'pie') return;
      const p = yo.p;
      if (enRampa(p.x, p.z) && Math.abs(p.y - alturaRampa(p.x)) < 0.35 && p.x < RAMPA.x1 - 0.4) {
        if (!yo.mov || yo.mov.tipo !== 'desliza') yo.empezarMov('desliza', new THREE.Vector2(1, 0), 8, 0.7);
        const M = yo.mov; M.dur = Math.max(M.dur, M.t + 0.45); M.dir.set(1, 0); M.v0 = Math.max(M.v0, 6 + (RAMPA.y0 - p.y) * 1.6 + M.t * 6);
      }
      /* los trampolines: si toca el piso, se corta la racha de rebotes */
      if (yo.enPiso && yo.pisando?.clave?.startsWith('tramp') !== true) this.saltosTramp = 0;
    },
    /* E: patear, tirar al aro, tirar la bola */
    patear(yo, J) { const f = new THREE.Vector3(Math.sin(yo.rumbo), 0, Math.cos(yo.rumbo)); pelota.v.copy(f.multiplyScalar(13.5)).add(new THREE.Vector3(0, 4.2, 0)); pelota.ultimo = J.id; pelota.tEnviar = 1.2; pelota.tRed = 0; J.sfx('pop'); },
    tirarAro(yo, J) {
      if (basquet.vuela) return;
      const mano = new THREE.Vector3(yo.p.x + Math.sin(yo.rumbo) * 0.4, yo.p.y + 1.6, yo.p.z + Math.cos(yo.rumbo) * 0.4);
      const aAro = ARO.clone().sub(mano), dist = Math.hypot(aAro.x, aAro.z);
      /* la puntería: según la distancia y cuánto se mira para el aro */
      let da = Math.atan2(aAro.x, aAro.z) - yo.rumbo; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283;
      const err = (0.05 + dist * 0.028) * (Math.random() - 0.5) * 2 + Math.abs(da) * 0.55 * Math.sign(Math.random() - 0.5);
      const blanco3 = ARO.clone().add(new THREE.Vector3(err * 0.8, 0, err * 0.6 * (Math.random() - 0.5) * 2));
      const T = 0.62 + dist * 0.07, v = blanco3.clone().sub(mano).sub(G3.clone().multiplyScalar(0.5 * T * T)).divideScalar(T);
      basquet.vuela = { p: mano, v, t: 0, arriba: true, triple: dist > 6.2, contado: false };
      pelB.visible = true; J.sfx('salto');
    },
    tirarBolos(yo, J, i) {
      const B = bolos[i]; if (B.tira) return;
      let da = yo.rumbo - (-Math.PI / 2); while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283; da = Math.max(-0.1, Math.min(0.1, da * 0.3));
      B.tira = { p: new THREE.Vector3(B.x0, PISO + 0.27, B.z + Math.max(-0.5, Math.min(0.5, yo.p.z - B.z))), v: new THREE.Vector3(-Math.cos(da) * (10 + Math.random() * 2), 0, Math.sin(da) * 10), curva: (Math.random() - 0.5) * 1.2, t: 0, fin: 0 };
      B.bola.visible = true; J.sfx('ola');
    },
    /* la red: la pelota y los goles */
    recibir(a) {
      if (a.type === 'pelota' && Array.isArray(a.p) && Array.isArray(a.v) && a.p.every(Number.isFinite) && a.v.every(Number.isFinite)) { pelota.p.set(...a.p); pelota.v.set(...a.v); pelota.ultimo = a.id; }
      else if (a.type === 'gol' && Array.isArray(a.m)) { pelota.marcador = a.m.slice(0, 2).map((n) => Math.max(0, Math.min(99, n | 0))); pintarMarcador(); pelota.tGol = 1.6; }
      else if (a.type === 'mesa') mesas.recibir(a);
    },
    actualizar(dt, jp, cielo) {
      tt += dt;
      const J = this.J, yo = J?.yo;
      /* la torre y las puertas */
      anillos.forEach((a, i) => { a.position.y = ((tt * 1.6 + i * 2.5) % 10); a.material.emissiveIntensity = 0.6 + Math.sin(tt * 3 + i) * 0.3; });
      esfera.position.y = 11.2 + Math.sin(tt * 1.3) * 0.25;
      for (const P of portales) P.pel.scale.setScalar(1 + Math.sin(tt * 2.2 + P.pos.z) * 0.02);
      if (J) mesas.actualizar(dt, J, J.remotos);
      /* ---- la pelota */
      const P = pelota;
      if (P.tGol > 0) { P.tGol -= dt; if (P.tGol <= 0) { P.p.set(cx, PISO + RP + 1.5, cz); P.v.set(0, 0, 0); P.ultimo = null; } }
      P.v.addScaledVector(G3, dt); P.p.addScaledVector(P.v, dt);
      if (P.p.y < PISO + RP) { P.p.y = PISO + RP; P.v.y = Math.abs(P.v.y) > 1.5 ? -P.v.y * 0.5 : 0; const k = Math.exp(-dt * 0.9); P.v.x *= k; P.v.z *= k; }
      const lxp = P.p.x - cx, lzp = P.p.z - cz;
      if (P.tGol <= 0 && Math.abs(lxp) > LX && Math.abs(lzp) < 2.4 && P.p.y < PISO + 2.2) {
        /* ¡gol! lo cuenta quien la tocó último (o cualquiera si nadie) */
        const lado = lxp > 0 ? 0 : 1;
        if (!P.ultimo || P.ultimo === J?.id) { P.marcador[lado]++; pintarMarcador(); J?.red.accion({ type: 'gol', m: P.marcador }); }
        P.tGol = 1.6; J?.avisar(t('jg_gol', { a: P.marcador[0], b: P.marcador[1] }), 'bien'); J?.sfx('restaura'); J?.festejoEn?.(P.p.clone());
      }
      if (Math.abs(lxp) > LX + 1.3) { P.p.x = cx + Math.sign(lxp) * (LX + 1.3); P.v.x *= -0.4; }
      else if (Math.abs(lxp) > LX - RP && Math.abs(lzp) > 2.5) { P.p.x = cx + Math.sign(lxp) * (LX - RP); P.v.x *= -0.7; }
      if (Math.abs(lzp) > LZ + 0.4) { P.p.z = cz + Math.sign(lzp) * (LZ + 0.4); P.v.z *= -0.7; }
      /* los toques: corriendo contra la pelota se la empuja (los demás también, con lo que se ve de ellos) */
      P.tToque -= dt;
      const tocar = (x, z, vx, vz, id) => {
        const dx = P.p.x - x, dz = P.p.z - z, d = Math.hypot(dx, dz);
        if (d > RP + 0.5 || P.p.y > PISO + 1.1 || P.tToque > 0) return false;
        const vel = Math.hypot(vx, vz), nx = dx / (d || 1), nz = dz / (d || 1), f = Math.max(3, vel * 1.35);
        P.v.set(nx * f + vx * 0.25, Math.max(P.v.y, 1.2 + vel * 0.12), nz * f + vz * 0.25); P.p.x = x + nx * (RP + 0.52); P.p.z = z + nz * (RP + 0.52);
        P.tToque = 0.18; P.ultimo = id; return true;
      };
      if (yo && tocar(yo.p.x, yo.p.z, yo.v.x, yo.v.z, J.id)) { P.tEnviar = 1.2; J.sfx('pop'); }
      if (J) for (const rm of J.remotos.m.values()) tocar(rm.x, rm.z, 0, 0, rm.id);
      if (J && P.ultimo === J.id && P.tEnviar > 0) { P.tEnviar -= dt; P.tRed -= dt; if (P.tRed <= 0) { P.tRed = 0.1; J.red.accion({ type: 'pelota', p: [P.p.x, P.p.y, P.p.z].map((v) => +v.toFixed(2)), v: [P.v.x, P.v.y, P.v.z].map((v) => +v.toFixed(2)) }); } }
      pelotaM.position.copy(P.p);
      const vh = Math.hypot(P.v.x, P.v.z); if (vh > 0.05) pelotaM.rotateOnWorldAxis(tmp.set(P.v.z, 0, -P.v.x).normalize(), vh * dt / RP);
      /* ---- básquet */
      const V = basquet.vuela;
      if (V) {
        V.t += dt; const antes = V.p.y; V.v.addScaledVector(G3, dt); V.p.addScaledVector(V.v, dt);
        /* el tablero */
        if (V.p.x > ARO.x + 0.42 && V.p.x < ARO.x + 0.6 && Math.abs(V.p.z - ARO.z) < 0.9 && Math.abs(V.p.y - ARO.y - 0.45) < 0.55) { V.p.x = ARO.x + 0.42; V.v.x = -Math.abs(V.v.x) * 0.55; }
        /* el aro: al cruzar su altura bajando */
        if (!V.contado && antes > ARO.y && V.p.y <= ARO.y) {
          const d = Math.hypot(V.p.x - ARO.x, V.p.z - ARO.z);
          if (d < 0.14) { V.contado = true; basquet.racha++; J?.avisar(t(V.triple ? 'jg_triple' : 'jg_doble', { n: basquet.racha }), 'bien'); J?.sfx('restaura'); J?.festejoEn?.(ARO.clone()); redB.userData.sacude = 1;
            if (J && basquet.racha > (J.G.juegos?.basquet || 0)) { J.G.juegos = { ...(J.G.juegos || {}), basquet: basquet.racha }; if (basquet.racha >= 3) J.avisar(t('jg_record', { n: basquet.racha }), 'bien'); J.guardar(); } }
          else if (d < 0.38) { V.v.x += (V.p.x - ARO.x) * 12; V.v.z += (V.p.z - ARO.z) * 12; V.v.y = Math.abs(V.v.y) * 0.4; J?.avisar(t('jg_aro')); J?.sfx('hongo'); }
          else { V.contado = true; if (basquet.racha) J?.avisar(t('jg_afuera')); basquet.racha = 0; }
        }
        if (V.p.y < PISO + 0.12) { V.p.y = PISO + 0.12; V.v.y = Math.abs(V.v.y) * 0.55; V.v.x *= 0.8; V.v.z *= 0.8; if (!V.contado) { V.contado = true; basquet.racha = 0; } }
        pelB.position.copy(V.p);
        if (V.t > 3.2) { basquet.vuela = null; pelB.visible = false; }
      }
      if (redB.userData.sacude) { redB.userData.sacude = Math.max(0, redB.userData.sacude - dt * 2); redB.scale.set(1, 1 + Math.sin(tt * 30) * 0.15 * redB.userData.sacude, 1); }
      /* ---- bolos */
      for (const B of bolos) {
        const T = B.tira;
        if (T) {
          T.t += dt;
          if (T.fin === 0) {
            T.v.z += T.curva * dt * (T.t > 0.6 ? 1 : 0.2); T.p.addScaledVector(T.v, dt);
            if (Math.abs(T.p.z - B.z) > 0.82) T.p.z = B.z + Math.sign(T.p.z - B.z) * 0.95, T.v.z = 0, T.p.y = PISO + 0.18;   // a la canaleta
            B.bola.position.copy(T.p); B.bola.rotation.z += T.v.x * dt / 0.2;
            for (const q of B.pinos) {
              if (q.caida > 0 || q.fuera) continue;
              const qx = q.m.position.x, qz = q.m.position.z;
              if (Math.hypot(T.p.x - qx, T.p.z - qz) < 0.3) { q.caida = 0.001; q.v.set(T.v.x * 0.45 + (Math.random() - 0.5) * 2, 0, (qz - T.p.z) * 9 + (Math.random() - 0.5) * 2); T.v.multiplyScalar(0.93); J?.sfx('letra', { f: 600 + Math.random() * 500 }); }
            }
            if (T.p.x < B.x1 - 1.3) T.fin = 0.001;
          } else T.fin += dt;
          /* los pinos que caen empujan a los de al lado */
          for (const q of B.pinos) {
            if (q.caida <= 0 || q.fuera) continue;
            q.caida = Math.min(1, q.caida + dt * 3); q.m.position.addScaledVector(q.v, dt); q.v.multiplyScalar(Math.exp(-dt * 2.5));
            q.m.rotation.set(0, 0, 0); q.m.rotateOnWorldAxis(tmp.set(q.v.z, 0, -q.v.x).normalize(), q.caida * 1.45);
            for (const o of B.pinos) if (o !== q && o.caida === 0 && !o.fuera && Math.hypot(o.m.position.x - q.m.position.x, o.m.position.z - q.m.position.z) < 0.24 && q.v.length() > 0.8) { o.caida = 0.001; o.v.copy(q.v).multiplyScalar(0.7).add(new THREE.Vector3((Math.random() - 0.5), 0, (Math.random() - 0.5))); }
          }
          if (T.fin > 1.3) {
            const caidos = B.pinos.filter((q) => q.caida > 0 || q.fuera).length, nuevos = caidos - B.caidosAntes;
            if (B.tiro === 1 && caidos === 10) { J?.avisar(t('jg_chuza'), 'bien'); J?.sfx('restaura'); J?.festejoEn?.(new THREE.Vector3(B.x1 + 0.5, PISO + 0.5, B.z)); B.tiro = 3; }
            else if (B.tiro === 2 && caidos === 10) { J?.avisar(t('jg_spare'), 'bien'); J?.sfx('restaura'); B.tiro = 3; }
            else { J?.avisar(t('jg_pinos', { n: nuevos })); B.tiro++; }
            for (const q of B.pinos) if (q.caida > 0) { q.fuera = true; q.m.visible = false; }
            B.caidosAntes = caidos;
            if (B.tiro > 2) { for (const q of B.pinos) { q.caida = 0; q.fuera = false; q.m.visible = true; q.m.position.set(q.x0, PISO + 0.07, q.z0); q.m.rotation.set(0, 0, 0); q.v.set(0, 0, 0); } B.tiro = 1; B.caidosAntes = 0; }
            B.tira = null; B.bola.visible = false;
          }
        }
      }
      /* ---- trampolines, hamacas, baile */
      for (const q of tramp) { const a = q.tela.userData.aplasta || 0; q.tela.position.y = PISO + 0.34 - a * 0.28; q.tela.userData.aplasta = Math.max(0, a - dt * 4); }
      for (const H of hamacas) if (!H.jinete) { H.w += (-9.8 / H.L * Math.sin(H.ang) - H.w * 0.6) * dt; H.ang += H.w * dt; H.piv.rotation.x = -H.ang; }
      const pulso = 0.7222, b = Math.floor(tt / pulso), fase = (tt % pulso) / pulso, colB = new THREE.Color();
      for (let i = 0; i < NB * NB; i++) {
        const cxb = i % NB - 3.5, czb = Math.floor(i / NB) - 3.5, patron = Math.floor(b / 8) % 4;
        let on = patron === 0 ? ((i % NB + Math.floor(i / NB) + b) % 2) : patron === 1 ? (Math.abs(Math.round(Math.hypot(cxb, czb)) - (b % 5)) < 1 ? 1 : 0) : patron === 2 ? ((i % NB + Math.floor(i / NB) - b) % 4 === 0 ? 1 : 0) : (Math.sin(i * 12.9 + b * 3.1) > 0.3 ? 1 : 0);
        const tono = (i * 0.037 + b * 0.13) % 1;
        colB.setHSL(tono, 0.85, on ? 0.62 - fase * 0.18 : 0.22); baldosas.setColorAt(i, colB);
      }
      baldosas.instanceColor.needsUpdate = true;
      bolaDisco.rotation.y += dt * 0.6;
      /* (el cono con la punta en la bola: se lo gira y se lo baja por su propio eje) */
      haces.forEach((h, i) => { h.rotation.set(Math.sin(tt * 0.9 + i * 1.6) * 0.65, 0, Math.cos(tt * 0.7 + i * 1.6) * 0.65); h.position.set(dx0, PISO + 5.4, dz0); h.translateY(-2.6); });
      for (const d of discos) { d.malla.rotation.y = tt * 1.6; d.malla.position.y = d.p.y + Math.sin(tt * 2) * 0.12; }
      chispas.actualizar(dt);
    },
  };
  return reinoJ;
}

/* la miniatura del canal del menú: la plaza de las puertas desde arriba */
export function miniaturaJuegos(W = 320, H = 200) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const cielo = g.createLinearGradient(0, 0, 0, H); cielo.addColorStop(0, '#6fd0ff'); cielo.addColorStop(0.55, '#dff8ff'); cielo.addColorStop(0.56, '#6fd06a'); cielo.addColorStop(1, '#3faa44');
  g.fillStyle = cielo; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(223,248,255,0.9)'; g.beginPath(); g.ellipse(W / 2, H * 0.74, W * 0.42, H * 0.16, 0, 0, 7); g.fill();
  const cols = Object.values(COLOR_PORTAL);
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, x = W / 2 + Math.cos(a) * W * 0.34, y = H * 0.72 + Math.sin(a) * H * 0.12; g.strokeStyle = cols[i]; g.lineWidth = 5; g.beginPath(); g.ellipse(x, y - 16, 10, 16, 0, 0, 7); g.stroke(); g.fillStyle = cols[i] + '88'; g.fill(); }
  g.fillStyle = 'rgba(191,240,255,0.8)'; g.fillRect(W / 2 - 10, H * 0.2, 20, H * 0.5);
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(W / 2, H * 0.18, 16, 0, 7); g.fill();
  g.font = '900 30px sans-serif'; g.textAlign = 'center'; g.fillText('🎮', W / 2, H * 0.45);
  return c;
}
