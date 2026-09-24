/* ============================================================================
   aeroplaza/js/reinos/casa.js — la casa: una isla que flota entre las nubes,
   con un patio redondo bajo una cúpula de vidrio abierta. Se ponen muebles en
   una grilla de medio metro (modo construir). El plano se guarda en la
   computadora y además queda retenido en el broker, así quien viaja en tren
   puede visitarla aunque su dueño no esté.
   ========================================================================== */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Mundo, ruido2, suaveEntre } from '../mundo.js';
import { terreno, pasto, flores, arboles, brilloso, materialVidrio, materialBurbuja } from '../naturaleza.js';
import { pecera, puntoSuave } from '../objetos.js';

const R1 = ruido2(90);
export function alturaCasa(x, z) {
  const r = Math.hypot(x, z);
  if (r > 26) return -60;
  const h = 1 + R1(x * 0.08, z * 0.08) * 0.4;
  return h + (-30 - h) * suaveEntre(20, 26, r);
}
const mat = (c, o) => brilloso(c, o);
/* cada mueble: una función que arma su grupo, con su "caja" de choque [ancho, fondo, alto] */
export const FABRICA = {
  sofa: () => { const g = new THREE.Group(); const b = new THREE.Mesh(new RoundedBoxGeometry(2.2, 0.5, 0.9, 3, 0.2), mat('#6fd0ff')); b.position.y = 0.35; g.add(b); const r = new THREE.Mesh(new RoundedBoxGeometry(2.2, 0.7, 0.3, 3, 0.14), mat('#6fd0ff')); r.position.set(0, 0.75, -0.35); g.add(r); for (const s of [-1, 1]) { const a = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.55, 0.9, 3, 0.14), mat('#3fb0ff')); a.position.set(s * 1.1, 0.55, 0); g.add(a); } return [g, [2.4, 1, 1]]; },
  sillon: () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), mat('#ff9ad8', { side: THREE.DoubleSide })); b.rotation.x = Math.PI; b.position.y = 0.75; g.add(b); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.25, 0.4, 12), mat('#ffffff')); p.position.y = 0.2; g.add(p); return [g, [1.2, 1.2, 0.9]]; },
  mesa: () => { const g = new THREE.Group(); const t = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.08, 32), materialVidrio('#bff4ff', 0.5)); t.position.y = 0.75; g.add(t); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.35, 0.75, 16), mat('#ffffff')); p.position.y = 0.37; g.add(p); return [g, [1.6, 1.6, 0.8]]; },
  silla: () => { const g = new THREE.Group(); const s = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.08, 0.5, 2, 0.04), mat('#b6f03a')); s.position.y = 0.45; g.add(s); const r = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.5, 0.06, 2, 0.03), mat('#b6f03a')); r.position.set(0, 0.72, -0.22); g.add(r); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8), mat('#ffffff')); p.position.y = 0.22; g.add(p); return [g, [0.6, 0.6, 0.5]]; },
  cama: () => { const g = new THREE.Group(); const b = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.45, 2.2, 3, 0.18), mat('#ffffff')); b.position.y = 0.25; g.add(b); const c = new THREE.Mesh(new RoundedBoxGeometry(1.45, 0.14, 1.5, 3, 0.07), mat('#9b7bff')); c.position.set(0, 0.52, 0.3); g.add(c); const a = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.16, 0.4, 3, 0.08), mat('#dff4ff')); a.position.set(0, 0.55, -0.8); g.add(a); return [g, [1.6, 2.3, 0.6]]; },
  lampara: () => { const g = new THREE.Group(); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.2, 1.4, 10), mat('#ffffff')); p.position.y = 0.7; g.add(p); const b = new THREE.Mesh(new THREE.SphereGeometry(0.35, 20, 14), new THREE.MeshStandardMaterial({ color: '#fffbe0', emissive: '#ffe9a0', emissiveIntensity: 1.8, transparent: true, opacity: 0.9 })); b.position.y = 1.6; g.add(b); return [g, [0.5, 0.5, 1.9]]; },
  planta: () => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.45, 16), mat('#ffffff')); m.position.y = 0.22; g.add(m); for (let i = 0; i < 6; i++) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mat('#56e05a')); h.scale.set(0.5, 1.4, 0.3); const a = i / 6 * 6.28; h.position.set(Math.cos(a) * 0.15, 0.75, Math.sin(a) * 0.15); h.rotation.set(Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5); g.add(h); } return [g, [0.6, 0.6, 1]]; },
  pecera: () => [pecera(0, 0, 0, 0.55), [1, 1, 1.6]],
  tele: () => { const g = new THREE.Group(); const c = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.9, 0.8, 4, 0.2), mat('#e8eef5')); c.position.y = 1.05; g.add(c); const p = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.65), new THREE.MeshBasicMaterial({ color: '#7fd6ff' })); p.position.set(0, 1.05, 0.41); g.add(p); g.userData.pantalla = p; const m = new THREE.Mesh(new RoundedBoxGeometry(1.2, 0.6, 0.7, 3, 0.15), mat('#ffffff')); m.position.y = 0.3; g.add(m); return [g, [1.2, 0.8, 1.5]]; },
  alfombra: () => { const g = new THREE.Group(); const a = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.03, 40), mat('#ffe14a', { roughness: 0.8 })); a.position.y = 0.015; g.add(a); const b = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.05, 6, 40), mat('#ff9a3d', { roughness: 0.8 })); b.rotation.x = Math.PI / 2; b.position.y = 0.035; g.add(b); return [g, [0, 0, 0]]; },
  estante: () => { const g = new THREE.Group(); for (let i = 0; i < 4; i++) { const e = new THREE.Mesh(new RoundedBoxGeometry(1.4, 0.06, 0.4, 2, 0.03), mat('#ffffff')); e.position.y = 0.2 + i * 0.5; g.add(e); for (let k = 0; k < 3; k++) { const l = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.35, 0.3, 2, 0.03), mat(['#ff6fb0', '#39d6ff', '#ffe14a', '#56e05a'][(i + k) % 4])); l.position.set(-0.45 + k * 0.2 + i * 0.05, 0.4 + i * 0.5, 0); g.add(l); } } for (const s of [-1, 1]) { const p = new THREE.Mesh(new RoundedBoxGeometry(0.06, 1.9, 0.4, 2, 0.03), mat('#ffffff')); p.position.set(s * 0.7, 0.95, 0); g.add(p); } return [g, [1.5, 0.5, 1.9]]; },
  radio: () => { const g = new THREE.Group(); const c = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.4, 0.25, 3, 0.1), mat('#39d6ff')); c.position.y = 0.2; g.add(c); for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 20), mat('#e8f4ff')); p.rotation.x = Math.PI / 2; p.position.set(s * 0.2, 0.2, 0.13); g.add(p); } return [g, [0.7, 0.3, 0.4]]; },
  puff: () => { const g = new THREE.Group(); const p = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), mat('#ff7a3d', { roughness: 0.6 })); p.scale.y = 0.65; p.position.y = 0.32; g.add(p); return [g, [1, 1, 0.6]]; },
  arbolito: () => { const g = new THREE.Group(); const t = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 1.2, 10), mat('#c79a6a')); t.position.y = 0.6; g.add(t); const c = new THREE.Mesh(new THREE.SphereGeometry(0.7, 18, 12), mat('#56e05a')); c.position.y = 1.5; g.add(c); return [g, [0.6, 0.6, 2.2]]; },
  fuente: () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.4, 28), mat('#ffffff')); b.position.y = 0.2; g.add(b); const a = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.05, 28), new THREE.MeshPhysicalMaterial({ color: '#3fe0ff', emissive: '#1ab8e0', emissiveIntensity: 0.5, roughness: 0.02 })); a.position.y = 0.4; g.add(a); const c = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), materialVidrio('#dffaff', 0.5)); c.position.y = 0.75; g.add(c); return [g, [1.8, 1.8, 0.5]]; },
  globo: () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 16), materialBurbuja()); b.position.y = 1.6; g.add(b); const h = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 1.1, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' })); h.position.y = 0.55; g.add(h); return [g, [0, 0, 0]]; },
};

export function crearCasa(ctx, { plano = [], dueño = null } = {}) {
  const A = alturaCasa;
  const mundo = new Mundo(A); mundo.agua = null; mundo.limite = 24;
  const g = new THREE.Group();
  g.add(terreno(A, { tam: 60, seg: 90, color: (x, z, h) => h > 0.5 ? [0.33, 0.72, 0.16, 0] : [0.62, 0.55, 0.45, 0.2] }));
  g.add(pasto(A, (x, z) => A(x, z) > 0.6 && Math.hypot(x, z) > 11, { n: Math.round(5000 * ctx.calidad.pasto), area: [-30, -30, 60], R: 22 }));
  g.add(flores(A, (x, z) => A(x, z) > 0.6 && Math.hypot(x, z) > 12, { n: 300, area: [-26, -26, 52] }));
  g.add(arboles(A, [[-16, 8, 0.8], [14, -12, 0.9], [8, 16, 0.7], [-10, -15, 0.8]]));
  for (const [x, z] of [[-16, 8], [14, -12], [8, 16], [-10, -15]]) mundo.cilindro(x, z, 0.3, 0, 3);
  /* el patio y la cúpula */
  const patio = new THREE.Mesh(new THREE.CylinderGeometry(10.5, 10.8, 0.4, 48), brilloso('#f4f8ff', { roughness: 0.25 })); patio.position.y = 1.2; patio.receiveShadow = true; g.add(patio);
  const borde = new THREE.Mesh(new THREE.TorusGeometry(10.5, 0.18, 10, 64), brilloso('#7fd6ff')); borde.rotation.x = Math.PI / 2; borde.position.y = 1.4; g.add(borde);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const arco = new THREE.Mesh(new THREE.TorusGeometry(10.3, 0.1, 8, 40, Math.PI), brilloso('#ffffff')); arco.position.y = 1.4; arco.rotation.y = a; g.add(arco); }
  mundo.cilindro(0, 0, 10.6, -5, 1.4, { tipo: 'piedra' });
  /* la isla por abajo: una roca que se afina, y nubes alrededor */
  const roca = new THREE.Mesh(new THREE.ConeGeometry(24, 30, 20, 4), brilloso('#b89a7a', { roughness: 0.7 })); roca.rotation.x = Math.PI; roca.position.y = -16; g.add(roca);
  const muebles = new THREE.Group(); g.add(muebles);
  const solidos = [];
  const armar = (lista) => {
    muebles.clear(); for (const s of solidos) mundo.quitar(s); solidos.length = 0;
    for (const m of lista) {
      const f = FABRICA[m.k]; if (!f) continue;
      const [o, [w, d, h]] = f(); o.position.set(m.x, 1.4, m.z); o.rotation.y = m.r || 0; o.traverse((q) => { if (q.isMesh) { q.castShadow = true; } });
      o.userData.m = m; muebles.add(o);
      if (h > 0) { const s = mundo.caja(m.x, m.z, w / 2, d / 2, 1.4, 1.4 + h, m.r || 0, { mueble: m }); solidos.push(s); }
    }
  };
  armar(plano);
  /* el fantasma del mueble que se está por poner */
  let fantasma = null;
  const ponerFantasma = (k) => {
    if (fantasma) g.remove(fantasma); fantasma = null; if (!k) return;
    const [o] = FABRICA[k](); o.traverse((q) => { if (q.isMesh) { q.material = q.material.clone(); q.material.transparent = true; q.material.opacity = 0.5; q.material.depthWrite = false; } });
    fantasma = o; g.add(o);
  };
  mundo.interactivo({ id: 'tren', pos: new THREE.Vector3(0, 1.4, 8.5), radio: 2.4, accion: 'viajar', icono: '🚆' });
  /* el atril de construir, al lado de la entrada (solo en la casa propia) */
  if (!dueño) {
    const atril = new THREE.Group(); atril.position.set(3.2, 1.4, 6.6);
    const pata = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 1, 10), brilloso('#ffffff')); pata.position.y = 0.5; atril.add(pata);
    const tabla = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.6, 0.08, 3, 0.04), brilloso('#ffe14a', { emissive: '#ffb000', emissiveIntensity: 0.3 })); tabla.position.y = 1.15; tabla.rotation.x = -0.4; atril.add(tabla);
    g.add(atril);
    mundo.cilindro(3.2, 6.6, 0.2, 1.4, 2.4);
    mundo.interactivo({ id: 'construir', pos: new THREE.Vector3(3.2, 1.4, 6.6), radio: 2.2, accion: 'construir', icono: '🔨' });
  }
  const anden = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.1, 6), brilloso('#bfe9ff')); anden.position.set(0, 1.45, 8.5); g.add(anden);
  let t = 0;
  return {
    id: 'casa', mundo, grupo: g, inicio: new THREE.Vector3(0, 1.45, 7), rumboInicio: Math.PI, musica: 'titulo', cielo: { aurora: 0 },
    discos: [], orbes: null, npcs: [], dueño, plano,
    rehacer(lista) { this.plano = lista; armar(lista); },
    ponerFantasma,
    /* dónde caería el mueble: medio metro adelante del jugador, en la grilla */
    moverFantasma(jp, rumbo, giro) {
      if (!fantasma) return null;
      const x = Math.round((jp.x + Math.sin(rumbo) * 2) * 2) / 2, z = Math.round((jp.z + Math.cos(rumbo) * 2) * 2) / 2;
      const dentro = Math.hypot(x, z) < 9.8;
      fantasma.position.set(x, 1.4, z); fantasma.rotation.y = giro; fantasma.visible = true;
      fantasma.traverse((q) => { if (q.isMesh) q.material.opacity = dentro ? 0.55 : 0.2; });
      return dentro ? { x, z } : null;
    },
    cercano(jp) { let m = null, md = 2.2; for (const o of muebles.children) { const d = Math.hypot(o.position.x - jp.x, o.position.z - jp.z); if (d < md) { md = d; m = o.userData.m; } } return m; },
    actualizar(dt) { t += dt; for (const o of muebles.children) { if (o.userData.pantalla) o.userData.pantalla.material.color.setHSL((t * 0.05) % 1, 0.7, 0.7); if (o.userData.actualizar) o.userData.actualizar(t); } },
  };
}
