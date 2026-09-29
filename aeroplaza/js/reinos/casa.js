/* ============================================================================
   aeroplaza/js/reinos/casa.js — la casa: una isla que flota entre las nubes,
   con un patio redondo bajo una cúpula de vidrio abierta. Se ponen muebles en
   una grilla de medio metro (modo construir). El plano se guarda en la
   computadora y además queda retenido en el broker, así quien viaja en tren
   puede visitarla aunque su dueño no esté.
   (vuelta 48) El sistema de construcción: cada cosa del plano es { k, x, z, r, c?, y? } (c: su color; y: sobre
   qué altura quedó, arriba de una plataforma o una tarima). Las piezas nuevas están en casa-piezas.js. Lo quieto se
   funde por material (una llamada de dibujo por color, aunque haya 200 cosas); lo que se mueve queda aparte.
   (vuelta 49) Para construir como en Sims Mobile (obra.js), la casa sabe decir qué se tocó (elegir, con un rayo),
   mostrar la huella de lo elegido (celeste, verde si entra, roja si no), las guías de lo que se dibuja (paredes,
   cuartos, pisos) y bajar las paredes que tapan (cortar: las de adelante del punto que se mira).
   ========================================================================== */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Mundo, ruido2, suaveEntre } from '../mundo.js';
import { terreno, pasto, flores, arboles, brilloso, materialVidrio, materialBurbuja } from '../naturaleza.js';
import { pecera, puntoSuave } from '../objetos.js';
import { modelo } from '../modelos.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PIEZAS, mat as matCompartido } from './casa-piezas.js';

const R1 = ruido2(90);
export function alturaCasa(x, z) {
  const r = Math.hypot(x, z);
  if (r > 26) return -60;
  const h = 1 + R1(x * 0.08, z * 0.08) * 0.4;
  return h + (-30 - h) * suaveEntre(20, 26, r);
}
/* (vuelta 48: un material por color, compartido; si no, cada mueble traía los suyos y no se podían fundir) */
const mat = (c, o) => matCompartido(c, o);
/* cada mueble: una función que arma su grupo, con su "caja" de choque [ancho, fondo, alto] */
export const FABRICA = {
  mesa: () => { const g = new THREE.Group(); const t = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.08, 32), materialVidrio('#bff4ff', 0.5)); t.position.y = 0.75; g.add(t); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.35, 0.75, 16), mat('#ffffff')); p.position.y = 0.37; g.add(p); return [g, [1.6, 1.6, 0.8]]; },
  silla: () => { const g = new THREE.Group(); const s = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.08, 0.5, 2, 0.04), mat('#b6f03a')); s.position.y = 0.45; g.add(s); const r = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.5, 0.06, 2, 0.03), mat('#b6f03a')); r.position.set(0, 0.72, -0.22); g.add(r); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8), mat('#ffffff')); p.position.y = 0.22; g.add(p); return [g, [0.6, 0.6, 0.5]]; },
  planta: () => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.45, 16), mat('#ffffff')); m.position.y = 0.22; g.add(m); for (let i = 0; i < 6; i++) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mat('#56e05a')); h.scale.set(0.5, 1.4, 0.3); const a = i / 6 * 6.28; h.position.set(Math.cos(a) * 0.15, 0.75, Math.sin(a) * 0.15); h.rotation.set(Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5); g.add(h); } return [g, [0.6, 0.6, 1]]; },
  pecera: () => [pecera(0, 0, 0, 0.55), [1, 1, 1.6]],
  alfombra: () => { const g = new THREE.Group(); const a = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.03, 40), mat('#ffe14a', { roughness: 0.8 })); a.position.y = 0.015; g.add(a); const b = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.05, 6, 40), mat('#ff9a3d', { roughness: 0.8 })); b.rotation.x = Math.PI / 2; b.position.y = 0.035; g.add(b); return [g, [0, 0, 0]]; },
  estante: () => { const g = new THREE.Group(); for (let i = 0; i < 4; i++) { const e = new THREE.Mesh(new RoundedBoxGeometry(1.4, 0.06, 0.4, 2, 0.03), mat('#ffffff')); e.position.y = 0.2 + i * 0.5; g.add(e); for (let k = 0; k < 3; k++) { const l = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.35, 0.3, 2, 0.03), mat(['#ff6fb0', '#39d6ff', '#ffe14a', '#56e05a'][(i + k) % 4])); l.position.set(-0.45 + k * 0.2 + i * 0.05, 0.4 + i * 0.5, 0); g.add(l); } } for (const s of [-1, 1]) { const p = new THREE.Mesh(new RoundedBoxGeometry(0.06, 1.9, 0.4, 2, 0.03), mat('#ffffff')); p.position.set(s * 0.7, 0.95, 0); g.add(p); } return [g, [1.5, 0.5, 1.9]]; },
  radio: () => { const g = new THREE.Group(); const c = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.4, 0.25, 3, 0.1), mat('#39d6ff')); c.position.y = 0.2; g.add(c); for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 20), mat('#e8f4ff')); p.rotation.x = Math.PI / 2; p.position.set(s * 0.2, 0.2, 0.13); g.add(p); } return [g, [0.7, 0.3, 0.4]]; },
  puff: () => { const g = new THREE.Group(); const p = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), mat('#ff7a3d', { roughness: 0.6 })); p.scale.y = 0.65; p.position.y = 0.32; g.add(p); return [g, [1, 1, 0.6]]; },
  arbolito: () => { const g = new THREE.Group(); const t = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 1.2, 10), mat('#c79a6a')); t.position.y = 0.6; g.add(t); const c = new THREE.Mesh(new THREE.SphereGeometry(0.7, 18, 12), mat('#56e05a')); c.position.y = 1.5; g.add(c); return [g, [0.6, 0.6, 2.2]]; },
  fuente: () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.4, 28), mat('#ffffff')); b.position.y = 0.2; g.add(b); const a = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.05, 28), new THREE.MeshPhysicalMaterial({ color: '#3fe0ff', emissive: '#1ab8e0', emissiveIntensity: 0.5, roughness: 0.02 })); a.position.y = 0.4; g.add(a); const c = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), materialVidrio('#dffaff', 0.5)); c.position.y = 0.75; g.add(c); return [g, [1.8, 1.8, 0.5]]; },
  globo: () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 16), materialBurbuja()); b.position.y = 1.6; g.add(b); const h = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 1.1, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' })); h.position.y = 0.55; g.add(h); return [g, [0, 0, 0]]; },
};

/* (vuelta 48) las piezas nuevas (obra, muebles y deco), con su color */
for (const [k, P] of Object.entries(PIEZAS)) FABRICA[k] = (c) => P.f(c || P.color);
export const RADIO_OBRA = 9.8, MAX_COSAS = 200, BASE = 1.4;
/* (vuelta 49) las piezas que van en la línea de una pared (2 m de largo): se dibujan de corrido y una reemplaza a otra */
export const PAREDES = new Set(['pared', 'ventana', 'puerta', 'media', 'baranda']);
/* lo que ocupa una cosa en el piso (medio ancho y medio fondo, girado) y si está adentro */
function adentro(m, w, d, x, z, margen = 0) {
  const dx = x - m.x, dz = z - m.z, c = Math.cos(m.r || 0), s = Math.sin(m.r || 0);
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  return Math.abs(lx) <= w / 2 + margen && Math.abs(lz) <= d / 2 + margen;
}
const MEDIDAS = new Map();
export function medidas(k) { let M = MEDIDAS.get(k); if (!M && FABRICA[k]) { const [, wdh] = FABRICA[k](); M = wdh; MEDIDAS.set(k, M); } return M || [1, 1, 1]; }
/* (vuelta 49) la caja de lo que se ve de una pieza, sin girar (para la huella y las guías) */
const CAJAS = new Map();
export function cajaLocal(k) {
  let B = CAJAS.get(k);
  if (!B && FABRICA[k]) { const [o] = FABRICA[k](); o.updateMatrixWorld(true); B = new THREE.Box3().setFromObject(o); if (B.isEmpty()) B.set(new THREE.Vector3(-0.3, 0, -0.3), new THREE.Vector3(0.3, 0.3, 0.3)); CAJAS.set(k, B); }
  return B || new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
}
/* la altura del piso en (x, z): la del patio o la de lo que se pisa (plataforma, tarima, piso) */
export function alturaEn(plano, x, z, sin = null) {
  let y = 0;
  for (const m of plano) {
    const P = PIEZAS[m.k]; if (!P?.piso || m === sin) continue;
    const [w, d] = medidas(m.k);
    if (adentro(m, w, d, x, z, -0.05)) y = Math.max(y, (m.y || 0) + P.piso);
  }
  return y;
}
/* la cosa que está en (x, z) o más cerca (hasta 1,2 m): primero la de arriba de todo */
export function cosaEn(plano, x, z) {
  let mejor = null, md = 1.2;
  for (const m of plano) {
    const [w, d] = medidas(m.k), W = Math.max(0.6, w), D = Math.max(0.6, d);
    const dx = x - m.x, dz = z - m.z, c = Math.cos(m.r || 0), s = Math.sin(m.r || 0);
    const lx = Math.max(0, Math.abs(dx * c - dz * s) - W / 2), lz = Math.max(0, Math.abs(dx * s + dz * c) - D / 2);
    const dist = Math.hypot(lx, lz) - (m.y || 0) * 0.01 - (PIEZAS[m.k]?.piso ? -0.05 : 0.05);
    if (dist < md) { md = dist; mejor = m; }
  }
  return mejor;
}
/* fundir lo quieto por material: las mallas con los atributos de siempre (las de construcciones.js traen otros) */
function fundir(grupo) {
  grupo.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(grupo.matrixWorld).invert(), porMat = new Map(), sacar = [];
  for (const o of grupo.children) {
    if (o.userData.actualizar || o.userData.pantalla || o.userData.techo) continue;
    o.traverse((q) => {
      if (!q.isMesh || Array.isArray(q.material) || q.material.transparent) return;
      const a = Object.keys(q.geometry.attributes).sort().join();
      if (a !== 'normal,position,uv') return;
      const gg = (q.geometry.index ? q.geometry.toNonIndexed() : q.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, q.matrixWorld));
      (porMat.get(q.material) || porMat.set(q.material, []).get(q.material)).push(gg); sacar.push(q);
    });
  }
  for (const q of sacar) q.removeFromParent();
  const fundidos = new THREE.Group(); fundidos.name = 'fundidos';
  for (const [m, gs] of porMat) { const f = new THREE.Mesh(gs.length > 1 ? mergeGeometries(gs) : gs[0], m); f.castShadow = true; f.receiveShadow = true; fundidos.add(f); for (const g of gs) if (gs.length > 1) g.dispose(); }
  grupo.add(fundidos);
}

/* los muebles armados en construcciones.js (copiando las referencias de
   Rezona): se miden por su ancho o su alto y la caja de choque sale del mueble.
   La tele guarda su pantalla (cambia de color) y la lámpara suma su luz */
const ARMADOS = { sofa: ['m-sofa', { ancho: 2.4 }], sillon: ['m-sillon', { alto: 1.35 }], cama: ['m-cama', { ancho: 2.3 }], tele: ['m-tele', { alto: 1.3 }], lampara: ['m-lampara', { alto: 1.9 }] };
for (const [k, [n, medida]] of Object.entries(ARMADOS)) {
  FABRICA[k] = () => {
    const m = modelo(n, medida), T = m.userData.tam;
    if (m.userData.bocha) {
      const luz = new THREE.Mesh(new THREE.SphereGeometry(m.userData.radio * 1.35, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff4c0', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
      luz.position.copy(m.userData.bocha); m.add(luz);
    }
    return [m, [T.x * 0.9, T.z * 0.9, T.y]];
  };
}

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
  /* la casa de Rezona, atrás del patio (se entra al patio; la casa es el decorado) */
  const cm = modelo('casa', { ancho: 9.5 });
  { const y = A(0, -15); cm.position.set(0, y - 0.1, -15); g.add(cm); const T = cm.userData.tam; mundo.caja(0, -15, T.x * 0.45, T.z * 0.45, y - 1, y + T.y * 0.9, 0, { tipo: 'piedra' }); }
  /* la isla por abajo: una roca que se afina, y nubes alrededor */
  const roca = new THREE.Mesh(new THREE.ConeGeometry(24, 30, 20, 4), brilloso('#b89a7a', { roughness: 0.7 })); roca.rotation.x = Math.PI; roca.position.y = -16; g.add(roca);
  const muebles = new THREE.Group(); g.add(muebles);
  const solidos = [], techos = [];
  let verTechos = true;
  /* (rapido: construyendo, sin fundir, así cada toque es al instante; al terminar se funde) */
  const armar = (lista, rapido = false) => {
    for (const o of muebles.children) o.traverse((q) => { if (q.isMesh && q.parent?.name === 'fundidos') q.geometry.dispose(); });
    muebles.clear(); for (const s of solidos) mundo.quitar(s); solidos.length = 0; techos.length = 0;
    for (const m of lista) {
      const f = FABRICA[m.k]; if (!f) continue;
      const [o, [w, d, h], cajas] = f(m.c); const y0 = BASE + (m.y || 0);
      o.position.set(m.x, y0, m.z); o.rotation.y = m.r || 0; o.traverse((q) => { if (q.isMesh) { q.castShadow = true; } });
      o.userData.m = m; muebles.add(o);
      if (PIEZAS[m.k]?.techo) { o.userData.techo = true; o.visible = verTechos; techos.push(o); }
      const c = Math.cos(m.r || 0), s = Math.sin(m.r || 0);
      /* (los choques propios de la pieza, en su lugar girado: la puerta se atraviesa por el medio; la escalera, de a escalones) */
      if (cajas) for (const [bx, bz, bw, bd, b0, b1] of cajas) solidos.push(mundo.caja(m.x + bx * c + bz * s, m.z - bx * s + bz * c, bw / 2, bd / 2, y0 + b0, y0 + b1, m.r || 0, { mueble: m }));
      else if (h > 0) solidos.push(mundo.caja(m.x, m.z, w / 2, d / 2, y0, y0 + h, m.r || 0, { mueble: m }));
    }
    if (!rapido) fundir(muebles);
    ctx.alArmar?.(muebles);
  };
  armar(plano);
  /* (vuelta 49) la huella de lo elegido: un rectángulo en el piso, con el borde marcado (celeste elegido, verde si
     entra donde está, rojo si no). Va apenas arriba del piso de la cosa y el mueble la tapa: se ve el borde alrededor */
  const texHuella = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const q = c.getContext('2d');
    q.fillStyle = 'rgba(255,255,255,0.32)'; q.strokeStyle = '#fff'; q.lineWidth = 12;
    q.beginPath(); if (q.roundRect) q.roundRect(8, 8, 112, 112, 22); else q.rect(8, 8, 112, 112); q.fill(); q.stroke();
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
  })();
  const COLOR_HUELLA = { sel: '#39d6ff', ok: '#56e05a', mal: '#ff4f6e' };
  const huella = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: texHuella, color: COLOR_HUELLA.sel, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  huella.rotation.order = 'YXZ'; huella.renderOrder = 8; huella.visible = false; g.add(huella);
  /* las guías de lo que se está dibujando: cajas de vidrio de color, una por pieza (se reusan) */
  const MAT_GUIA = { ok: '#5fe3ff', ya: '#ffffff', mal: '#ff4f6e', quita: '#ff4f6e' };
  for (const [e, c] of Object.entries(MAT_GUIA)) MAT_GUIA[e] = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: e === 'ya' ? 0.18 : e === 'quita' ? 0.4 : 0.45, depthWrite: false, toneMapped: false });
  const cajaGuia = new THREE.BoxGeometry(1, 1, 1), guias = [];
  const grupoDe = (m) => muebles.children.find((o) => o.userData.m === m) || null;
  const _rayo = [];
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
    id: 'casa', mundo, grupo: g, inicio: new THREE.Vector3(0, 1.45, 7), rumboInicio: Math.PI, musica: 'casa', cielo: { aurora: 0 },
    discos: [], orbes: null, npcs: [], dueño, plano,
    rehacer(lista, rapido = false) { this.plano = lista; armar(lista, rapido); },
    grupoDe,
    /* lo que tocó el rayo (lo de más adelante que se vea), o null */
    elegir(rc) {
      muebles.updateMatrixWorld(true);   // (lo recién rearmado todavía no pasó por un cuadro)
      _rayo.length = 0; rc.intersectObjects(muebles.children, true, _rayo);
      for (const h of _rayo) {
        let o = h.object, visible = true;
        while (o && o.parent !== muebles) { if (!o.visible) visible = false; o = o.parent; }
        if (o && visible && o.visible && o.userData.m) return o.userData.m;
      }
      return null;
    },
    /* l: { k, x, z, r, y } o null; estado: sel, ok o mal */
    huella(l, estado = 'sel') {
      if (!l) { huella.visible = false; return; }
      const B = cajaLocal(l.k), m = 0.2;
      const cx = (B.min.x + B.max.x) / 2, cz = (B.min.z + B.max.z) / 2, c = Math.cos(l.r || 0), s = Math.sin(l.r || 0);
      huella.scale.set(Math.max(0.5, B.max.x - B.min.x) + m, Math.max(0.5, B.max.z - B.min.z) + m, 1);
      /* (arriba del piso que tenga abajo: si no, el piso fino del living la tapa) */
      const y = Math.max(l.y || 0, alturaEn(this.plano, l.x, l.z, this.plano.find((m) => m === l) || null));
      huella.position.set(l.x + cx * c + cz * s, BASE + y + (PIEZAS[l.k]?.piso || 0) + 0.035, l.z - cx * s + cz * c);
      huella.rotation.set(-Math.PI / 2, l.r || 0, 0);
      huella.material.color.set(COLOR_HUELLA[estado] || COLOR_HUELLA.sel); huella.visible = true;
    },
    /* lista: [{ k, x, z, r, y, e }] (e: ok, ya, mal o quita), o vacía para sacarlas */
    guias(lista = []) {
      while (guias.length < lista.length) { const q = new THREE.Mesh(cajaGuia, MAT_GUIA.ok); q.renderOrder = 7; g.add(q); guias.push(q); }
      guias.forEach((q, i) => {
        const l = lista[i]; q.visible = !!l; if (!l) return;
        const B = cajaLocal(l.k), cx = (B.min.x + B.max.x) / 2, cz = (B.min.z + B.max.z) / 2, c = Math.cos(l.r || 0), s = Math.sin(l.r || 0);
        const h = Math.max(0.08, B.max.y - B.min.y);
        q.material = MAT_GUIA[l.e] || MAT_GUIA.ok;
        q.scale.set(Math.max(0.3, B.max.x - B.min.x) + 0.04, h + 0.04, Math.max(0.2, B.max.z - B.min.z) + 0.04);
        q.position.set(l.x + cx * c + cz * s, BASE + (l.y || 0) + B.min.y + h / 2, l.z - cx * s + cz * c); q.rotation.y = l.r || 0;
      });
    },
    /* las paredes que tapan: modo cortadas (las de adelante de foco, mirando para la cámara), bajas (todas) o
       enteras (todas arriba, con los techos). Lo colgado de una pared baja se esconde con ella */
    cortar(modo, foco, yaw) {
      const vx = Math.sin(yaw), vz = Math.cos(yaw), techosSi = modo === 'enteras';
      if (verTechos !== techosSi) { verTechos = techosSi; for (const o of techos) o.visible = techosSi; }
      for (const o of muebles.children) {
        const m = o.userData.m; if (!m) continue;
        const k = m.k, colgado = PIEZAS[k]?.pared, pared = (PAREDES.has(k) && k !== 'baranda') || k === 'columna';
        if (!pared && !colgado) continue;
        let baja = modo === 'bajas';
        if (modo === 'cortadas') {
          const delante = (m.x - foco.x) * vx + (m.z - foco.z) * vz > 0.3;
          const mira = k === 'columna' || Math.abs(Math.sin(m.r || 0) * vx + Math.cos(m.r || 0) * vz) > 0.4;
          baja = delante && mira;
        }
        if (colgado) o.visible = !baja && !o.userData.oculto;
        else { const sy = baja ? 0.14 : 1; if (o.scale.y !== sy) o.scale.y = sy; o.visible = !o.userData.oculto; }
      }
    },
    cosaEn(x, z) { return cosaEn(this.plano, x, z); },
    alturaEn(x, z) { return alturaEn(this.plano, x, z); },
    verTechos(si) { verTechos = si; for (const o of techos) o.visible = si; },
    get techosVisibles() { return verTechos; },
    get muebles() { return muebles; },
    get huellaVisible() { return huella.visible; },
    get guiasVisibles() { return guias.filter((q) => q.visible).length; },
    cercano(jp) { return cosaEn(this.plano, jp.x, jp.z); },
    actualizar(dt) { t += dt; if (huella.visible) huella.material.opacity = 0.75 + Math.sin(t * 5) * 0.25; for (const o of muebles.children) { if (o.userData.pantalla) o.userData.pantalla.material.color.setHSL((t * 0.05) % 1, 0.7, 0.7); if (o.userData.actualizar) o.userData.actualizar(t); } },
  };
}
