/* ============================================================================
   aeroplaza/js/reinos/aqua.js — el mar abierto: una isla de playa con el hotel
   blanco de balcones redondos, palmeras y reposeras; islotes; delfines que se
   montan; la carrera de aros dorados sobre el agua; y abajo, el arrecife con
   corales, peces y aros hundidos.
   ========================================================================== */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Mundo, azar, ruido2, suaveEntre } from '../mundo.js';
import { terreno, agua, pasto, palmeras, piedras, brilloso, materialVidrio } from '../naturaleza.js';
import { Orbes, Cardumen, Burbujas, discoMalla, Chispas } from '../objetos.js';
import { Delfin } from '../delfin.js';
import { letrero } from '../edificios.js';

const R1 = ruido2(21), R2 = ruido2(5);
const ISLOTES = [[70, -40, 12], [-65, -55, 10], [-80, 40, 14], [45, 75, 9]];
export function alturaAqua(x, z) {
  const r = Math.hypot(x, z);
  let h = -11 + R1(x * 0.03, z * 0.03) * 2.5;
  /* la isla del hotel */
  const isla = 34 + R2(Math.atan2(z, x) * 1.5, 1) * 5;
  h = Math.max(h, 1.4 - Math.pow(Math.max(0, r - 10) / (isla - 10), 2) * 4.4 + R1(x * 0.1, z * 0.1) * 0.3);
  for (const [ix, iz, ir] of ISLOTES) { const d = Math.hypot(x - ix, z - iz); h = Math.max(h, 1.0 - Math.pow(d / ir, 2) * 3.8); }
  /* el arrecife: una meseta a -4,5 m al este */
  const dr = Math.hypot(x - 38, z + 5);
  if (dr < 22) h = Math.max(h, -4.6 + R2(x * 0.3, z * 0.3) * 0.5 - suaveEntre(12, 22, dr) * 3);
  return h;
}
function colorAqua(x, z, h) {
  if (h > 0.6) { const k = suaveEntre(0.6, 1.6, h); return [0.96 - k * 0.1, 0.9 - k * 0.05, 0.72 - k * 0.2, 1 - k * 0.6]; }
  if (h > -3) return [0.92, 0.85, 0.66, 1];
  const k = suaveEntre(-11, -3, h);
  return [0.55 + k * 0.3, 0.72 + k * 0.1, 0.72, 1];
}

export function crearAqua(ctx) {
  const A = alturaAqua;
  const mundo = new Mundo(A); mundo.agua = 0; mundo.limite = 175;
  const g = new THREE.Group();
  g.add(terreno(A, { tam: 360, seg: 200, color: colorAqua }));
  const mar = agua(0, A, { rect: [-180, -180, 360], colorPlaya: '#3ff5e6', colorHondo: '#0a5fd0' }); g.add(mar);
  g.add(pasto(A, (x, z) => A(x, z) > 1.0 && Math.hypot(x, z) < 24, { n: Math.round(6000 * ctx.calidad.pasto), area: [-180, -180, 360] }));

  /* el hotel: una torre blanca redonda con balcones y vidrio celeste */
  const hotel = new THREE.Group(); hotel.position.set(-6, A(-6, -6), -6);
  const pisos = 7;
  for (let i = 0; i < pisos; i++) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(6.2 - i * 0.25, 6.2 - i * 0.25, 0.5, 40), brilloso('#ffffff')); p.position.y = i * 3.2 + 0.25; p.castShadow = true; p.receiveShadow = true; hotel.add(p);
    const v = new THREE.Mesh(new THREE.CylinderGeometry(5.4 - i * 0.25, 5.4 - i * 0.25, 2.7, 40, 1, true), new THREE.MeshPhysicalMaterial({ color: '#7fdcff', roughness: 0.03, metalness: 0.2, clearcoat: 1, transparent: true, opacity: 0.75, emissive: '#2a9fd0', emissiveIntensity: 0.15 }));
    v.position.y = i * 3.2 + 1.85; hotel.add(v);
    const baranda = new THREE.Mesh(new THREE.TorusGeometry(6.1 - i * 0.25, 0.06, 6, 60), brilloso('#bfefff')); baranda.rotation.x = Math.PI / 2; baranda.position.y = i * 3.2 + 1.3; hotel.add(baranda);
  }
  const techo = new THREE.Mesh(new THREE.SphereGeometry(4.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), materialVidrio('#bff4ff', 0.3)); techo.position.y = pisos * 3.2 + 0.3; hotel.add(techo);
  const cartelH = letrero('HOTEL AQUA', { ancho: 7, alto: 1.4, tinta: '#1a8fd0', borde: '#7fdcff' }); cartelH.position.set(0, pisos * 3.2 + 1.5, 5.2); hotel.add(cartelH);
  g.add(hotel);
  mundo.cilindro(-6, -6, 6.2, -5, A(-6, -6) + pisos * 3.2);
  /* reposeras y sombrillas */
  const r = azar(8);
  for (let i = 0; i < 7; i++) {
    const a = 0.3 + i * 0.32, d = 20, x = Math.cos(a) * d, z = Math.sin(a) * d, y = A(x, z);
    const somb = new THREE.Group(); somb.position.set(x, y, z);
    const palo = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 8), brilloso('#ffffff')); palo.position.y = 1.3; somb.add(palo);
    const tela = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.6, 12, 1, true), brilloso(['#ff6fb0', '#3fd0ff', '#ffe14a'][i % 3], { side: THREE.DoubleSide })); tela.position.y = 2.6; somb.add(tela);
    const rep = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.2, 2, 2, 0.08), brilloso('#ffffff')); rep.position.set(1.2, 0.35, 0); rep.rotation.x = -0.1; somb.add(rep);
    g.add(somb); mundo.cilindro(x, z, 0.12, y, y + 2.6); mundo.caja(x + 1.2 * 1, z, 0.4, 1, y, y + 0.45, 0, {});
  }
  const pal = [];
  for (let i = 0; i < 16; i++) { const a = r() * 6.28, d = 14 + r() * 14, x = Math.cos(a) * d, z = Math.sin(a) * d; if (A(x, z) < 0.4 || Math.hypot(x + 6, z + 6) < 9) continue; pal.push([x, z, 0.9 + r() * 0.5, r() * 6.28]); }
  for (const [ix, iz] of ISLOTES) for (let k = 0; k < 3; k++) pal.push([ix + (r() - 0.5) * 6, iz + (r() - 0.5) * 6, 0.8 + r() * 0.4, r() * 6.28]);
  g.add(palmeras(A, pal.filter(([x, z]) => A(x, z) > 0.2)));
  for (const [x, z] of pal) if (A(x, z) > 0.2) mundo.cilindro(x, z, 0.3, A(x, z) - 1, A(x, z) + 5);

  /* el muelle y la estación (el tren llega volando) */
  const muelle = new THREE.Group();
  const tabla = new THREE.Mesh(new RoundedBoxGeometry(3, 0.3, 18, 2, 0.1), brilloso('#e8d2b0', { roughness: 0.5 })); tabla.position.set(0, 1.1, 0); muelle.add(tabla);
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 4, 8), brilloso('#ffffff')); p.position.set(s * 1.3, -0.8, -8 + i * 3.2); muelle.add(p); }
  muelle.position.set(0, 0, 36); g.add(muelle);
  mundo.caja(0, 36, 1.5, 9, -5, 1.25);
  const anden = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.2, 0.5, 6), brilloso('#eef7ff')); anden.position.set(0, 1.0, 47); g.add(anden);
  mundo.cilindro(0, 47, 4, -5, 1.25);

  /* el arrecife: corales de colores y peces */
  const coral = new THREE.Group();
  const colores = ['#ff6fb0', '#ffb13d', '#e46fff', '#3fffd0', '#ff4f6e', '#fff27a'];
  for (let i = 0; i < 60; i++) {
    const a = r() * 6.28, d = r() * 16, x = 38 + Math.cos(a) * d, z = -5 + Math.sin(a) * d, y = A(x, z);
    const tipo = i % 3, c = colores[i % colores.length];
    let m;
    if (tipo === 0) { m = new THREE.Mesh(new THREE.ConeGeometry(0.3 + r() * 0.3, 1.2 + r() * 1.5, 8), brilloso(c, { emissive: c, emissiveIntensity: 0.15 })); m.position.set(x, y + 0.6, z); }
    else if (tipo === 1) { m = new THREE.Mesh(new THREE.SphereGeometry(0.5 + r() * 0.6, 14, 10), brilloso(c, { emissive: c, emissiveIntensity: 0.12 })); m.scale.y = 0.6; m.position.set(x, y + 0.2, z); }
    else { m = new THREE.Mesh(new THREE.TorusKnotGeometry(0.35, 0.1, 40, 6), brilloso(c, { emissive: c, emissiveIntensity: 0.15 })); m.position.set(x, y + 0.6, z); }
    coral.add(m);
  }
  g.add(coral);
  const peces = [new Cardumen(g, new THREE.Vector3(38, -2.5, -5), { radio: 9, n: 24, alto: 1.2 }), new Cardumen(g, new THREE.Vector3(-20, -3, 50), { radio: 14, n: 18, colores: ['#ffe14a', '#ffffff'], vel: -0.2 })];
  const burbujas = new Burbujas(g, [[38, -4, -5, 16], [-6, 0, 30, 6]], { n: 40, alto: 6, tam: [0.08, 0.3] });

  /* la carrera: diez aros dorados en ronda alrededor de la isla, sobre el agua */
  const aros = [];
  const matAro = brilloso('#ffd23f', { metalness: 0.7, roughness: 0.15, emissive: '#ffb000', emissiveIntensity: 0.3 });
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + i / 10 * Math.PI * 2, rr = 52 + Math.sin(i * 1.7) * 8, x = Math.cos(a) * rr, z = Math.sin(a) * rr, y = i % 3 === 1 ? 3.2 : 1.2;
    const aro = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.22, 12, 40), matAro.clone()); aro.position.set(x, y, z);
    aro.rotation.y = a; g.add(aro);
    aros.push({ p: new THREE.Vector3(x, y, z), m: aro, n: new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)) });
  }
  /* aros hundidos en el arrecife (dan orbes) */
  const hundidos = [];
  for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28, x = 38 + Math.cos(a) * 8, z = -5 + Math.sin(a) * 8, y = -2.6; const m = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.15, 10, 32), brilloso('#3fffd0', { emissive: '#1fd0b0', emissiveIntensity: 0.6 })); m.position.set(x, y, z); m.rotation.y = a; g.add(m); hundidos.push({ p: m.position, m, hecho: false }); }

  const delfines = [0, 1, 2, 3, 4].map((i) => new Delfin(g, new THREE.Vector3(i % 2 ? 10 : -10, 0, 20 + i * 4), 42 + i * 5, 0, i * 1.3));
  const orbLug = [];
  for (let i = 0; i < 20; i++) { const a = i / 20 * 6.28, d = 16 + (i % 2) * 6, x = Math.cos(a) * d, z = Math.sin(a) * d; orbLug.push([x, Math.max(A(x, z), 0) + 0.9, z]); }
  for (const [ix, iz] of ISLOTES) for (let k = 0; k < 4; k++) { const a = k / 4 * 6.28; orbLug.push([ix + Math.cos(a) * 4, A(ix + Math.cos(a) * 4, iz + Math.sin(a) * 4) + 0.9, iz + Math.sin(a) * 4]); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; orbLug.push([38 + Math.cos(a) * 12, -3, -5 + Math.sin(a) * 12]); }
  const orbes = new Orbes(g, orbLug);
  const discos = [{ id: 'disco-hotel', p: new THREE.Vector3(ISLOTES[0][0], A(ISLOTES[0][0], ISLOTES[0][1]) + 1.3, ISLOTES[0][1]), cancion: 'ciudad' }].map((d) => { const m = discoMalla(); m.position.copy(d.p); g.add(m); return { ...d, malla: m }; });
  const npcs = [{ id: 'coral', pos: [4, 38], rot: Math.PI, y: 1.25 }, { id: 'guia', pos: [10, 12], rot: -2.5, y: A(10, 12) }];
  mundo.interactivo({ id: 'tren', pos: new THREE.Vector3(0, 1.25, 47), radio: 3.4, accion: 'viajar', icono: '🚆' });
  for (const d of delfines) mundo.interactivo({ id: 'delfin', pos: () => d.p, radio: 3.2, accion: 'montar', icono: '🐬', delfin: d, activo: true });
  const chispas = new Chispas(g, '#ffe98a', 100);
  const carrera = { i: -1, t: 0, activa: false };
  let t = 0;
  return {
    id: 'aqua', mundo, grupo: g, mar, inicio: new THREE.Vector3(0, 1.3, 44), rumboInicio: Math.PI, musica: 'arrecife', cielo: { aurora: 0 },
    orbes, discos, npcs, delfines, aros, carrera, burbujas,
    /* la carrera: se cuenta el paso por el plano de cada aro, en orden */
    pasoPorAro(p, antes) {
      const res = [];
      const cual = carrera.activa ? carrera.i + 1 : 0;
      const A2 = aros[cual];
      if (A2) {
        const d0 = antes.clone().sub(A2.p).dot(A2.n), d1 = p.clone().sub(A2.p).dot(A2.n);
        if (Math.sign(d0) !== Math.sign(d1) && p.distanceTo(A2.p) < 3.2) {
          chispas.soltar(A2.p, 24, 5);
          if (cual === 0) { carrera.activa = true; carrera.i = 0; carrera.t = 0; res.push({ tipo: 'empieza' }); }
          else { carrera.i = cual; res.push({ tipo: 'aro', n: cual + 1 }); }
          if (cual === aros.length - 1) { carrera.activa = false; res.push({ tipo: 'fin', s: carrera.t }); carrera.i = -1; }
        }
      }
      for (const h of hundidos) if (!h.hecho && p.distanceTo(h.p) < 1.6) { h.hecho = true; h.m.material.emissiveIntensity = 0.05; chispas.soltar(h.p, 20, 3); res.push({ tipo: 'hundido' }); }
      return res;
    },
    actualizar(dt, jp, cielo) {
      t += dt; if (carrera.activa) carrera.t += dt;
      for (const d of delfines) d.actualizar(dt);
      for (const p of peces) p.actualizar(dt);
      burbujas.actualizar(dt, null);
      chispas.actualizar(dt);
      aros.forEach((a, i) => { const toca = carrera.activa ? i === carrera.i + 1 : i === 0; a.m.material.emissiveIntensity = toca ? 0.8 + Math.sin(t * 6) * 0.4 : 0.15; a.m.scale.setScalar(toca ? 1 + Math.sin(t * 4) * 0.05 : 1); });
      for (const d of discos) { d.malla.rotation.y = t * 1.6; d.malla.position.y = d.p.y + Math.sin(t * 2) * 0.12; }
      cartelH.material.emissiveIntensity = 0.25 + (1 - cielo.dia) * 1.2;
    },
  };
}
