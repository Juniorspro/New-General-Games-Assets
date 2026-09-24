/* ============================================================================
   aeroplaza/js/reinos/plaza.js — la isla del centro, donde empieza todo:
   pasto que se mueve, un lago transparente, el globo de vidrio que flota y
   derrama la cascada, peceras, la estación de tren, la tienda, el probador,
   la huerta de frutas, la loma del mirador y la ciudad de vidrio del otro
   lado del agua. Es la sala donde más gente se cruza.
   ========================================================================== */
import * as THREE from 'three';
import { Mundo, azar, ruido2, suaveEntre } from '../mundo.js';
import { terreno, agua, pasto, flores, arboles, palmeras, piedras, TEX, brilloso, materialVidrio } from '../naturaleza.js';
import { Orbes, Mariposas, Cardumen, Burbujas, Frutas, pecera, globoCascada, discoMalla } from '../objetos.js';
import { estacion, tiendaAfuera, probadorCabina, farol, banco } from '../edificios.js';

const R1 = ruido2(3), R2 = ruido2(8);
const LAGO = [18, -12], ESTACION = [-30, 20], TIENDA = [30, 26], PLAZA = [0, 6], LOMA = [-30, -26], HUERTA = [-4, -38], PROBADOR = [9, 18];
const plano = (h, x, z, [cx, cz], r, borde, y) => { const d = Math.hypot(x - cx, z - cz); return h + (y - h) * suaveEntre(r + borde, r, d); };

export function alturaPlaza(x, z) {
  const r = Math.hypot(x, z), a = Math.atan2(z, x);
  const costa = 72 + R1(Math.cos(a) * 1.6 + 5, Math.sin(a) * 1.6 + 5) * 9 + Math.sin(a * 3 + 1) * 3;
  let h = 1.6 + (R1(x * 0.028, z * 0.028) * 1.5 + R2(x * 0.09, z * 0.09) * 0.35) * suaveEntre(costa - 6, costa - 26, r);
  h += 7.5 * Math.exp(-((x - LOMA[0]) ** 2 + (z - LOMA[1]) ** 2) / 260);
  h += 2.2 * Math.exp(-((x - 40) ** 2 + (z + 30) ** 2) / 200);
  /* la playa baja hacia el mar */
  const t = suaveEntre(costa - 12, costa + 4, r);
  h = h + (-2.4 - h) * t;
  if (r > costa + 4) h = -2.4 - Math.min(9, (r - costa - 4) * 0.16);
  /* el lago: un cuenco */
  const dl = Math.hypot(x - LAGO[0], z - LAGO[1]);
  if (dl < 19) h = h + (-2.8 + (dl / 12) ** 2 * 1.2 - h) * suaveEntre(19, 9, dl);
  /* lo plano donde van las construcciones */
  h = plano(h, x, z, ESTACION, 8, 6, 1.6);
  h = plano(h, x, z, TIENDA, 8, 6, 1.7);
  h = plano(h, x, z, PLAZA, 10, 6, 1.65);
  h = plano(h, x, z, PROBADOR, 3, 3, 1.7);
  return h;
}
/* los caminos de piedra clara: de la estación a la plaza, a la tienda y al lago */
const CAMINOS = [[ESTACION, PLAZA], [PLAZA, TIENDA], [PLAZA, [10, -2]], [PLAZA, [-10, -30]], [PLAZA, PROBADOR]];
function enCamino(x, z) {
  let m = Infinity;
  for (const [[ax, az], [bx, bz]] of CAMINOS) {
    const vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
    const ondula = Math.sin(t * 9 + ax) * 1.2;
    m = Math.min(m, Math.hypot(x - ax - vx * t - ondula * vz / Math.hypot(vx, vz), z - az - vz * t + ondula * vx / Math.hypot(vx, vz)));
  }
  return m;
}
/* el color de verdad del suelo (la textura de Rezona solo le pone el grano) */
const PASTO = [0.3, 0.7, 0.14], PASTO2 = [0.45, 0.8, 0.16], ARENA = [0.97, 0.9, 0.72], CAMINO = [0.86, 0.84, 0.78], ROCA = [0.62, 0.7, 0.66];
const mezcla = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function colorSuelo(x, z, h, pend) {
  const dp = Math.hypot(x - PLAZA[0], z - PLAZA[1]);
  if (dp < 10) { const anillo = Math.floor(dp / 2.5) % 2; return anillo ? [0.84, 0.88, 0.94, 1] : [0.55, 0.76, 0.94, 1]; }
  const cam = enCamino(x, z);
  if (cam < 1.6 && h > 0.8) return [...CAMINO, 0.9];
  if (h < 1.05) { const k = suaveEntre(-2.5, 1.0, h); return [...mezcla([0.8, 0.78, 0.62], ARENA, k), 1]; }
  if (pend > 0.3) return [...ROCA, 0.4];
  const v = 0.9 + R2(x * 0.2, z * 0.2) * 0.15;
  const c = mezcla(PASTO, PASTO2, suaveEntre(-0.3, 0.5, R1(x * 0.05 + 9, z * 0.05)) * 0.8 + (h - 1.6) * 0.04).map((q) => q * v);
  const borde = suaveEntre(1.05, 1.5, h);
  return [...mezcla(ARENA, c, borde), (1 - borde) * 0.8];
}
const hayPasto = (x, z) => { const h = alturaPlaza(x, z); return h > 1.2 && enCamino(x, z) > 2 && Math.hypot(x - PLAZA[0], z - PLAZA[1]) > 10.5 && Math.hypot(x - ESTACION[0], z - ESTACION[1]) > 7.5 && Math.hypot(x - TIENDA[0], z - TIENDA[1]) > 8.5; };

export function crearPlaza(ctx) {
  const A = alturaPlaza;
  const mundo = new Mundo(A); mundo.agua = 0; mundo.limite = 150;
  const g = new THREE.Group();
  const Q = ctx.calidad;
  g.add(terreno(A, { tam: 300, seg: Q.pasto > 0.5 ? 240 : 170, color: colorSuelo }));
  const mar = agua(0, A, { rect: [-150, -150, 300] }); g.add(mar);
  g.add(pasto(A, hayPasto, { n: Math.round(16000 * Q.pasto) }));
  g.add(flores(A, (x, z) => hayPasto(x, z) && R2(x * 0.06 + 3, z * 0.06) > 0.1, { n: Math.round(1400 * Math.max(0.4, Q.pasto)), area: [-80, -80, 160] }));

  /* árboles redondos en manchones, palmeras en la playa */
  const r = azar(41), arb = [], pal = [], pie = [];
  for (let i = 0; i < 140 && arb.length < 46; i++) {
    const a = r() * 6.28, d = 20 + r() * 44, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!hayPasto(x, z) || Math.hypot(x - LAGO[0], z - LAGO[1]) < 20 || Math.hypot(x - HUERTA[0], z - HUERTA[1]) < 9 || enCamino(x, z) < 3.5) continue;
    if (arb.some(([ax, az]) => Math.hypot(ax - x, az - z) < 5)) continue;
    arb.push([x, z, 0.8 + r() * 0.6]);
  }
  /* la huerta: árboles de fruta en fila */
  const huerta = [];
  for (let i = 0; i < 6; i++) { const x = HUERTA[0] - 7 + (i % 3) * 7, z = HUERTA[1] - 3 + Math.floor(i / 3) * 7; huerta.push([x, z, 1.0]); }
  g.add(arboles(A, [...arb, ...huerta]));
  for (const [x, z, e] of [...arb, ...huerta]) mundo.cilindro(x, z, 0.35 * e, A(x, z) - 1, A(x, z) + 2.4 * e);
  for (let i = 0; i < 60 && pal.length < 22; i++) {
    const a = r() * 6.28, d = 60 + r() * 12, x = Math.cos(a) * d, z = Math.sin(a) * d, h = A(x, z);
    if (h < 0.25 || h > 1.3) continue;
    if (pal.some(([ax, az]) => Math.hypot(ax - x, az - z) < 6)) continue;
    pal.push([x, z, 0.9 + r() * 0.4, Math.atan2(-z, x) + Math.PI + (r() - 0.5)]);
  }
  g.add(palmeras(A, pal));
  for (const [x, z] of pal) mundo.cilindro(x, z, 0.3, A(x, z) - 1, A(x, z) + 5);
  for (let i = 0; i < 30; i++) { const a = r() * 6.28, d = 12 + r() * 60, x = Math.cos(a) * d, z = Math.sin(a) * d; if (enCamino(x, z) < 2.5 || Math.hypot(x - PLAZA[0], z - PLAZA[1]) < 12) continue; pie.push([x, z, 0.4 + r() * 1.2]); }
  pie.push([LAGO[0] - 13, LAGO[1] + 6, 1.6], [LAGO[0] + 12, LAGO[1] - 8, 2], [LAGO[0] + 4, LAGO[1] + 14, 1.3]);
  g.add(piedras(A, pie));
  for (const [x, z, e] of pie) if (e > 0.7) mundo.cilindro(x, z, e * 0.85, A(x, z) - 2, A(x, z) + e * 0.55);

  /* lo construido */
  const est = estacion(mundo, ESTACION[0], ESTACION[1], Math.PI * 0.95, A(...ESTACION)); g.add(est);
  const tienda = tiendaAfuera(mundo, TIENDA[0], TIENDA[1], -Math.PI * 0.8, A(...TIENDA)); g.add(tienda);
  const prob = probadorCabina(mundo, PROBADOR[0], PROBADOR[1], Math.PI * 0.85, A(...PROBADOR)); g.add(prob);
  const faroles = [];
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.2, x = PLAZA[0] + Math.cos(a) * 10.6, z = PLAZA[1] + Math.sin(a) * 10.6; const f = farol(mundo, x, z, A(x, z)); g.add(f); faroles.push(f); }
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.6, x = PLAZA[0] + Math.cos(a) * 8, z = PLAZA[1] + Math.sin(a) * 8; g.add(banco(mundo, x, z, A(x, z), -a - Math.PI / 2)); }

  /* la fuente de burbujas en el medio de la plaza: de ahí salen las grandes que se manejan */
  const fuente = new THREE.Group(); fuente.position.set(PLAZA[0], A(...PLAZA), PLAZA[1]);
  const pileta = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.5, 0.7, 40), brilloso('#ffffff')); pileta.position.y = 0.35; fuente.add(pileta);
  const aguaF = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.9, 0.1, 40), new THREE.MeshPhysicalMaterial({ color: '#3fe0ff', roughness: 0.02, clearcoat: 1, emissive: '#1ab8e0', emissiveIntensity: 0.35, transparent: true, opacity: 0.85 })); aguaF.position.y = 0.66; fuente.add(aguaF);
  const pico = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 1.4, 20), brilloso('#bfefff')); pico.position.y = 1.2; fuente.add(pico);
  const bola = new THREE.Mesh(new THREE.SphereGeometry(0.7, 28, 20), materialVidrio('#dffaff', 0.35)); bola.position.y = 2.3; fuente.add(bola);
  g.add(fuente);
  mundo.cilindro(PLAZA[0], PLAZA[1], 3.4, A(...PLAZA) - 1, A(...PLAZA) + 0.7, { tipo: 'piedra' });
  mundo.cilindro(PLAZA[0], PLAZA[1], 0.6, A(...PLAZA), A(...PLAZA) + 2.9);

  /* el globo con la cascada sobre el lago, y peceras */
  const globo = globoCascada(LAGO[0], 17, LAGO[1], 5.2, 0); g.add(globo);
  const peceras = [[8, -1], [-15, 9], [27, 6], [-2, -20]].map(([x, z], i) => { const p = pecera(x, A(x, z), z, 0.9 + (i % 2) * 0.35); g.add(p); mundo.cilindro(x, z, 1.2, A(x, z) - 1, A(x, z) + 0.5 + (0.9 + (i % 2) * 0.35) * 2); return p; });

  /* la ciudad del otro lado del agua: el dibujo de Rezona, lejos, en tres paños */
  const ciudad = new THREE.Group(), matCiudad = [];
  if (TEX.ciudad) {
    for (let i = 0; i < 3; i++) {
      const m = new THREE.MeshBasicMaterial({ map: TEX.ciudad, transparent: true, fog: false, depthWrite: false, alphaTest: 0.02 });
      const a = -0.95 + i * 0.95, d = 780, W = 520 - i % 2 * 90, H = W * 0.558;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(W, H), m); p.position.set(Math.sin(a) * d, H / 2 - 10, -Math.cos(a) * d); p.lookAt(0, H / 2 - 10, 0);
      if (i === 1) p.scale.x = -1;
      p.renderOrder = -4; ciudad.add(p); matCiudad.push(m);
    }
  }
  g.add(ciudad);

  /* las cosas vivas */
  const orbLug = [];
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; orbLug.push([PLAZA[0] + Math.cos(a) * 14, A(PLAZA[0] + Math.cos(a) * 14, PLAZA[1] + Math.sin(a) * 14) + 0.9, PLAZA[1] + Math.sin(a) * 14]); }
  for (let i = 0; i < 8; i++) { const t = i / 7, x = ESTACION[0] + (PLAZA[0] - ESTACION[0]) * t, z = ESTACION[1] + (PLAZA[1] - ESTACION[1]) * t; orbLug.push([x, A(x, z) + 0.9, z]); }
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; orbLug.push([LOMA[0] + Math.cos(a) * 4, A(LOMA[0] + Math.cos(a) * 4, LOMA[1] + Math.sin(a) * 4) + 1.2, LOMA[1] + Math.sin(a) * 4]); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; orbLug.push([LAGO[0] + Math.cos(a) * 9, 0.9, LAGO[1] + Math.sin(a) * 9]); }
  const rt = azar(77);
  for (let i = 0; i < 12; i++) { const a = rt() * 6.28, d = 64 + rt() * 6, x = Math.cos(a) * d, z = Math.sin(a) * d; orbLug.push([x, Math.max(0.2, A(x, z)) + 0.9, z]); }
  const orbes = new Orbes(g, orbLug);
  const mariposas = new Mariposas(g, [[-8, A(-8, 24), 24, 6], [-24, A(-24, -6), -6, 7], [22, A(22, 12), 12, 6], [HUERTA[0], A(...HUERTA), HUERTA[1], 8], [-40, A(-40, 4), 4, 6]], 26);
  const cardumenes = [new Cardumen(g, new THREE.Vector3(LAGO[0], 12, LAGO[1]), { radio: 13, n: 22 }), new Cardumen(g, new THREE.Vector3(-10, 9, -5), { radio: 20, n: 18, colores: ['#3fd0ff', '#ffffff', '#7ff6ff'], vel: -0.18, largo: 0.45 })];
  const burbujas = new Burbujas(g, [[LAGO[0], 0, LAGO[1], 16, 0], [PLAZA[0], A(...PLAZA) + 2.3, PLAZA[1], 1.2]], { n: 70, alto: 16, tam: [0.15, 0.75] });
  const frutasLug = [];
  huerta.forEach(([x, z], i) => { const y = A(x, z); const tipos = ['frutilla', 'arandano', 'lima', 'dorada', 'uva', 'frutilla']; for (let k = 0; k < 3; k++) { const a = k * 2.1 + i; frutasLug.push([x + Math.cos(a) * 1.6, y + 2.6 + (k % 2) * 0.8, z + Math.sin(a) * 1.6, tipos[(i + k) % tipos.length]]); } });
  const frutas = new Frutas(g, frutasLug);

  /* discos escondidos (cada reino tiene los suyos) */
  const discos = [
    { id: 'disco-loma', p: new THREE.Vector3(LOMA[0], A(...LOMA) + 1.3, LOMA[1]), cancion: 'colina' },
    { id: 'disco-lago', p: new THREE.Vector3(LAGO[0] + 13, A(LAGO[0] + 12, LAGO[1] - 8) + 2.2, LAGO[1] - 8), cancion: 'arrecife' },
  ].map((d) => { const m = discoMalla(); m.position.copy(d.p); g.add(m); return { ...d, malla: m }; });

  /* la gente del lugar (NPC): dónde está cada uno. Las misiones están en misiones.js */
  const npcs = [
    { id: 'nimbo', pos: [PLAZA[0] + 4, PLAZA[1] + 5.5], rot: Math.PI * 1.2 },
    { id: 'lima', pos: [HUERTA[0] + 3, HUERTA[1] + 8], rot: Math.PI },
    { id: 'burbu', pos: [LAGO[0] - 9, LAGO[1] - 10], rot: 0.7 },
    { id: 'vendedora', pos: [TIENDA[0] - 5, TIENDA[1] - 7], rot: -0.6 },
  ].map((n) => ({ ...n, y: A(n.pos[0], n.pos[1]) }));

  /* lo interactivo */
  mundo.interactivo({ id: 'tren', pos: est.userData.puntoTren, radio: 3.2, accion: 'viajar', icono: '🚆' });
  mundo.interactivo({ id: 'tienda', pos: tienda.userData.puerta, radio: 2.4, accion: 'entrar_tienda', icono: '🛍️' });
  mundo.interactivo({ id: 'probador', pos: new THREE.Vector3(PROBADOR[0], A(...PROBADOR), PROBADOR[1]), radio: 2.4, accion: 'probador', icono: '👕' });
  mundo.interactivo({ id: 'fuente', pos: new THREE.Vector3(PLAZA[0], A(...PLAZA) + 0.7, PLAZA[1]), radio: 4.2, accion: 'burbuja', icono: '🫧' });

  /* se llega por la estación: se aparece en el camino a la plaza, mirándola */
  const ix = ESTACION[0] + (PLAZA[0] - ESTACION[0]) * 0.36, iz = ESTACION[1] + (PLAZA[1] - ESTACION[1]) * 0.36;
  const inicio = new THREE.Vector3(ix, A(ix, iz) + 0.1, iz), rumboInicio = Math.atan2(PLAZA[0] - ix, PLAZA[1] - iz);
  let t = 0;
  return {
    id: 'plaza', mundo, grupo: g, mar, inicio, rumboInicio, musica: 'colina', cielo: { aurora: 0 },
    orbes, mariposas, burbujas, frutas, discos, npcs, cardumenes,
    estacion: est, tienda, fuenteBurbujas: new THREE.Vector3(PLAZA[0], A(...PLAZA) + 3, PLAZA[1]),
    actualizar(dt, jp, cielo) {
      t += dt;
      globo.userData.actualizar(t, dt);
      for (const p of peceras) p.userData.actualizar(t);
      for (const c of cardumenes) c.actualizar(dt);
      frutas.actualizar(dt);
      bola.rotation.y = t * 0.5;
      for (const d of discos) { d.malla.rotation.y = t * 1.6; d.malla.position.y = d.p.y + Math.sin(t * 2) * 0.12; }
      /* de noche se prenden los faroles y las ventanas de la ciudad */
      const noche = 1 - cielo.dia;
      for (const f of faroles) f.userData.luz.material.emissiveIntensity = 0.3 + noche * 3.2;
      for (const m of matCiudad) m.color.setScalar(0.3 + cielo.dia * 0.7).lerp(new THREE.Color('#ffc9a8'), cielo.atardecer * 0.4);
      est.userData.tren.position.y = 1.9 + Math.sin(t * 1.4) * 0.04;
    },
  };
}
