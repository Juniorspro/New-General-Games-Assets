/* ============================================================================
   aeroplaza/js/meeple.js — el muñeco de cada jugador: gelatina brillante,
   cabeza aparte, cuerpo de campana, brazos y patas redondeados (el muñequito
   de los programas de chat de los 2000, pero de vidrio y con cuerpo).
   Está armado con piezas sueltas y no con un esqueleto: cada pieza cuelga de
   su articulación y las animaciones son rotaciones (caminar, correr, saltar,
   nadar, flotar, sentarse, saludar, bailar, montar). Así se ve perfecto de
   cerca y cuesta poco.
   La apariencia es un objeto chiquito que viaja por la red:
     { color, color2, motivo, cubre, material, sombrero, anteojos, espalda,
       peinado, colorPelo, particulas }
   ========================================================================== */
import * as THREE from 'three';
import { CLIPS, aplicarClip, CUADROS_CHOP } from './animador.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const MATERIALES = ['gelatina', 'vidrio', 'perla', 'cromo', 'mate', 'neon'];
export const MOTIVOS = ['ninguno', 'agua', 'nubes', 'tierra', 'galaxia', 'hojas', 'burbujas', 'flores', 'aurora'];
export const SOMBREROS = ['ninguno', 'conico', 'gorro', 'galera', 'corona', 'flor', 'auriculares', 'casco', 'aureola', 'brote', 'gorra', 'explorador', 'hongo', 'capitan'];
export const ANTEOJOS = ['ninguno', 'sol', 'redondos', 'visor'];
export const ESPALDAS = ['ninguno', 'alas', 'mochila', 'aleta', 'molinete'];
export const PEINADOS = ['ninguno', 'mechon', 'rulos', 'pinches', 'melena', 'rodete', 'colitas', 'cresta', 'nube'];
export const PARTICULAS = ['ninguna', 'burbujas', 'estrellas', 'hojas', 'notas'];
export const OJOS = ['ovalos', 'redondos', 'felices', 'ninguno'];

export const APARIENCIA_INICIAL = () => ({
  color: '#2f9bff', color2: '#b8f0ff', motivo: 'agua', cubre: 0.42, material: 'gelatina', degrade: 0.55, ojos: 'ovalos', motivoCabeza: 'igual',
  sombrero: 'ninguno', anteojos: 'ninguno', espalda: 'ninguno', peinado: 'ninguno', colorPelo: '#ffd23f', particulas: 'ninguna',
});

/* las texturas de los motivos las carga main.js (Rezona) y las deja acá */
export const TEXTURAS_MOTIVO = {};

/* ---------------------------------------------------------------- geometrías */
/* Las medidas salen de los videos de referencia (el muñeco de Frutiger Space):
   cabeza grande y aparte, cuerpo de cúpula con la base plana, brazos largos y
   gruesos colgando de los hombros, piernas cortas y separadas. 1,21 m en total.
   Cada vértice lleva:
   - aAlto: la altura en la pose de reposo (para el uv del motivo);
   - aParte: de 0 (abajo) a 1 (arriba) DENTRO de su pieza: el degradé y el
     motivo van por pieza, como en el original (cada pieza tiene su "agua" abajo);
   - aUvm: uv cilíndrico alrededor del eje de la pieza. */
export const MEDIDAS = { cabezaY: 1.1, cabezaR: 0.215, hombroX: 0.292, hombroY: 0.79, caderaX: 0.128, caderaY: 0.42 };
function conAlto(g, dy, dx = 0) {
  /* la geometría queda en su lugar de la pose de reposo; la malla se corre
     -articulación adentro de su articulación, así gira desde ahí */
  g.translate(dx, dy, 0);
  g.computeBoundingBox();
  const bb = g.boundingBox, y0 = bb.min.y, y1 = bb.max.y;
  const p = g.attributes.position, n = p.count;
  const alto = new Float32Array(n), parte = new Float32Array(n), uvm = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    alto[i] = y; parte[i] = (y - y0) / (y1 - y0);
    uvm[i * 2] = (Math.atan2(x - dx, z) / (Math.PI * 2) + 0.5) * 2;
    uvm[i * 2 + 1] = y * 2.2;
  }
  g.setAttribute('aAlto', new THREE.BufferAttribute(alto, 1));
  g.setAttribute('aParte', new THREE.BufferAttribute(parte, 1));
  g.setAttribute('aUvm', new THREE.BufferAttribute(uvm, 2));
  return g;
}
function capsula(r, largo, seg = 16) { return new THREE.CapsuleGeometry(r, largo, 6, seg); }

let GEOS = null;
function geometrias() {
  if (GEOS) return GEOS;
  /* el cuerpo: una cúpula torneada, de base casi plana y hombros redondos */
  /* (en los videos las piernas son largas: la base del cuerpo va a 0,38) */
  const P = [[0, 0.38], [0.17, 0.38], [0.222, 0.392], [0.243, 0.425], [0.252, 0.49], [0.252, 0.59], [0.243, 0.675], [0.222, 0.745], [0.184, 0.798], [0.128, 0.83], [0.064, 0.846], [0, 0.85]];
  const cuerpo = new THREE.LatheGeometry(new THREE.SplineCurve(P.map(([x, y]) => new THREE.Vector2(x, y))).getPoints(30), 36);
  cuerpo.computeVertexNormals();
  const M = MEDIDAS;
  GEOS = {
    cuerpo: conAlto(cuerpo, 0),
    cabeza: conAlto(new THREE.SphereGeometry(M.cabezaR, 36, 24), M.cabezaY),
    /* el brazo, gordo, cuelga del hombro por fuera del cuerpo hasta la base: 0,5 m */
    brazo: [-1, 1].map((s) => conAlto(capsula(0.084, 0.33).translate(0, -0.2, 0), M.hombroY, s * M.hombroX)),
    /* las piernas, casi tan altas como la cabeza, con una ranura entre las dos */
    pierna: [-1, 1].map((s) => conAlto(capsula(0.11, 0.2).translate(0, -0.2, 0), M.caderaY, s * M.caderaX)),
  };
  return GEOS;
}

/* los ojos: dos óvalos verticales como lentes de gelatina, del color del cuerpo
   pero más hondos, con un filo oscuro y el reflejo arriba (así en los videos).
   Van pegados a la esfera de la cabeza, mirando para afuera */
const matsOjo = new Map();
function matOjo(c, k, env) {
  const h = c.getHexString() + k;
  if (!matsOjo.has(h)) matsOjo.set(h, new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: env }));
  return matsOjo.get(h);
}
function ojos(tipo, color, color2) {
  const g = new THREE.Group();
  if (tipo === 'ninguno') return g;
  const c = new THREE.Color(color).lerp(new THREE.Color(color2 || color), 0.25);
  const lente = matOjo(c.clone().multiplyScalar(0.5).lerp(new THREE.Color('#0b1a33'), 0.18), 'l', 2.6);
  const filo = matOjo(c.clone().multiplyScalar(0.2).lerp(new THREE.Color('#0b1a33'), 0.5), 'f', 1);
  const brillo = matsOjo.get('brillo') || new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 });
  matsOjo.set('brillo', brillo);
  const R = MEDIDAS.cabezaR, redondo = tipo === 'redondos';
  const ax = redondo ? 0.07 : 0.06, ay = redondo ? 0.07 : 0.155;
  for (const s of [-1, 1]) {
    const ojo = new THREE.Group();
    /* sobre la esfera, a 20° del centro y apenas abajo del ecuador */
    const az = s * 0.35, el = -0.03;
    ojo.position.set(Math.sin(az) * Math.cos(el) * R * 0.975, Math.sin(el) * R, Math.cos(az) * Math.cos(el) * R * 0.975);
    ojo.lookAt(ojo.position.clone().multiplyScalar(2));
    let forma;
    if (tipo === 'felices') { forma = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.011, 8, 16, Math.PI), filo); forma.position.y = -0.01; }
    else {
      forma = new THREE.Group();
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 12), filo); f.scale.set(ax * 1.18, ay * 1.08, 0.022); forma.add(f);
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 12), lente); l.scale.set(ax, ay, 0.036); l.position.z = 0.004; forma.add(l);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), brillo); b.scale.set(ax * 0.32, ay * (redondo ? 0.3 : 0.24), 0.008); b.position.set(-0.012 * s, ay * 0.24, 0.02); forma.add(b);
    }
    ojo.add(forma);
    ojo.userData.forma = forma;
    g.add(ojo);
  }
  return g;
}

/* ---------------------------------------------------------------- materiales */
const cacheMat = new Map();
export function materialMeeple(A, pieza = 'cuerpo') {
  /* la cabeza puede llevar otro motivo (la "Tierra" en la cabeza de los videos): entonces la cubre entera */
  const mot = pieza === 'cabeza' && A.motivoCabeza && A.motivoCabeza !== 'igual' ? A.motivoCabeza : A.motivo;
  const cubre = pieza === 'cabeza' && A.motivoCabeza && A.motivoCabeza !== 'igual' ? (mot === 'ninguno' ? 0 : 1.2) : A.cubre;
  const clave = [A.color, A.color2, mot, (+cubre).toFixed(2), A.material, (+(A.degrade ?? 0.55)).toFixed(2)].join('|');
  if (cacheMat.has(clave)) return cacheMat.get(clave);
  const tipo = A.material;
  const m = new THREE.MeshPhysicalMaterial({
    color: A.color, roughness: tipo === 'mate' ? 0.62 : tipo === 'cromo' ? 0.08 : 0.14,
    metalness: tipo === 'cromo' ? 1 : 0, clearcoat: tipo === 'mate' ? 0 : 1, clearcoatRoughness: 0.05,
    iridescence: tipo === 'perla' ? 1 : tipo === 'vidrio' ? 0.4 : 0.15, iridescenceIOR: 1.35,
    sheen: tipo === 'perla' ? 1 : 0.3, sheenColor: new THREE.Color(A.color2), sheenRoughness: 0.4,
    transparent: tipo === 'vidrio', opacity: tipo === 'vidrio' ? 0.62 : 1, envMapIntensity: tipo === 'cromo' ? 3.2 : 2.2,
  });
  const tex = mot !== 'ninguno' ? TEXTURAS_MOTIVO[mot] : null;
  const U = {
    uTex: { value: tex }, uHay: { value: tex ? 1 : 0 }, uCubre: { value: cubre }, uCol2: { value: new THREE.Color(A.color2) }, uDegrade: { value: A.degrade ?? 0.55 },
    uBrillo: { value: tipo === 'neon' ? 1.6 : tipo === 'gelatina' ? 0.55 : tipo === 'vidrio' ? 0.8 : 0.25 },
    uAdentro: { value: tipo === 'neon' ? 0.55 : tipo === 'gelatina' ? 0.22 : tipo === 'vidrio' ? 0.12 : 0.0 },
  };
  m.userData.U = U;
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aAlto, aParte; attribute vec2 aUvm; varying float vAlto, vParte; varying vec2 vUvm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlto = aAlto; vParte = aParte; vUvm = aUvm;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vAlto, vParte; varying vec2 vUvm; uniform sampler2D uTex; uniform float uHay, uCubre, uBrillo, uAdentro, uDegrade; uniform vec3 uCol2;')
      /* el degradé de cada pieza (arriba el color, abajo el segundo) y el motivo,
         que sube desde abajo de CADA pieza hasta "cubre", con el borde en ola */
      .replace('#include <map_fragment>', `#include <map_fragment>
        diffuseColor.rgb = mix(uCol2, diffuseColor.rgb, mix(1.0, smoothstep(0.0, 0.85, vParte), uDegrade));
        float ola = sin(vUvm.x * 6.2832 * 1.5) * 0.045 + sin(vUvm.x * 6.2832 * 3.3 + 1.7) * 0.02;
        float banda = 1.0 - smoothstep(uCubre - 0.03, uCubre + 0.03, vParte + ola);
        if (uHay > 0.5) {
          vec3 mt = texture2D(uTex, vUvm).rgb;
          diffuseColor.rgb = mix(diffuseColor.rgb, mt, banda);
          /* un filo blanco espumoso en el borde del motivo, como en los videos */
          diffuseColor.rgb += vec3(0.85) * (1.0 - smoothstep(0.0, 0.035, abs(vParte + ola - uCubre))) * step(0.01, uCubre) * step(uCubre, 1.0);
        }`)
      /* la gelatina: brilla de adentro y tiene el borde encendido (fresnel) */
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float fres = pow(1.0 - saturate(dot(normalize(vNormal), normalize(vViewPosition))), 2.6);
        totalEmissiveRadiance += mix(diffuseColor.rgb, uCol2, 0.5) * fres * uBrillo + diffuseColor.rgb * uAdentro;`);
  };
  m.customProgramCacheKey = () => 'meeple';
  cacheMat.set(clave, m);
  return m;
}
const matsSimples = new Map();
function simple(color, o = {}) {
  const k = color + JSON.stringify(o);
  if (!matsSimples.has(k)) matsSimples.set(k, new THREE.MeshPhysicalMaterial({ color, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, ...o }));
  return matsSimples.get(k);
}

/* ---------------------------------------------------------------- accesorios */
/* todos colgados de la cabeza (centro en 0,0,0, radio 0,235) o de la espalda */
function sombrero(tipo, col) {
  const g = new THREE.Group(), m = simple(col);
  const add = (geo, mat = m, x = 0, y = 0, z = 0, rx = 0, rz = 0) => { const q = new THREE.Mesh(geo, mat); q.position.set(x, y, z); q.rotation.set(rx, 0, rz); q.castShadow = true; g.add(q); return q; };
  switch (tipo) {
    case 'conico': add(new THREE.ConeGeometry(0.36, 0.2, 40), simple('#e8b04a', { roughness: 0.5, clearcoat: 0.3 }), 0, 0.26); break;
    case 'gorro': add(new THREE.SphereGeometry(0.25, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 0.05); add(new THREE.TorusGeometry(0.235, 0.04, 12, 40), simple('#ffffff'), 0, 0.06, 0, Math.PI / 2); add(new THREE.SphereGeometry(0.07, 16, 12), simple('#ffffff'), 0, 0.31); break;
    case 'galera': add(new THREE.CylinderGeometry(0.34, 0.34, 0.025, 40), m, 0, 0.2); add(new THREE.CylinderGeometry(0.19, 0.2, 0.3, 40), m, 0, 0.36); add(new THREE.CylinderGeometry(0.205, 0.205, 0.05, 40), simple('#ff5fa2'), 0, 0.25); break;
    case 'corona': for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; add(new THREE.ConeGeometry(0.045, 0.12, 12), simple('#ffd23f', { metalness: 1, roughness: 0.15 }), Math.sin(a) * 0.15, 0.3, Math.cos(a) * 0.15); } add(new THREE.TorusGeometry(0.155, 0.03, 10, 40), simple('#ffd23f', { metalness: 1, roughness: 0.15 }), 0, 0.23, 0, Math.PI / 2); break;
    case 'flor': for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(new THREE.SphereGeometry(0.06, 14, 10), simple(col), Math.sin(a) * 0.07 + 0.1, 0.22, Math.cos(a) * 0.07); } add(new THREE.SphereGeometry(0.045, 14, 10), simple('#ffe25a'), 0.1, 0.235, 0); break;
    case 'auriculares': add(new THREE.TorusGeometry(0.25, 0.022, 10, 40, Math.PI), m, 0, 0.02, 0, 0, 0); add(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 24), m, 0.25, 0, 0, 0, Math.PI / 2); add(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 24), m, -0.25, 0, 0, 0, Math.PI / 2); break;
    case 'casco': add(new THREE.SphereGeometry(0.33, 36, 24), new THREE.MeshPhysicalMaterial({ color: '#dff6ff', roughness: 0.02, transmission: 0, transparent: true, opacity: 0.28, clearcoat: 1, iridescence: 1 }), 0, 0.02); break;
    case 'aureola': add(new THREE.TorusGeometry(0.17, 0.025, 12, 40), new THREE.MeshBasicMaterial({ color: '#fff5b0' }), 0, 0.36, 0, Math.PI / 2); break;
    case 'brote': add(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 8), simple('#4caf2a'), 0, 0.29); { const h = add(new THREE.SphereGeometry(0.07, 14, 10), simple('#6fdc3a'), 0.05, 0.36); h.scale.set(1, 0.4, 0.6); const h2 = add(new THREE.SphereGeometry(0.07, 14, 10), simple('#6fdc3a'), -0.05, 0.34); h2.scale.set(1, 0.4, 0.6); } break;
    case 'gorra': add(new THREE.SphereGeometry(0.245, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 0.04); { const v = add(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 32, 1, false, -Math.PI / 2, Math.PI), m, 0, 0.06, 0.12); v.scale.set(1, 1, 1.2); } break;
    /* los de las misiones nuevas: el de exploración (Brújula), el hongo (Musgo) y la gorra de capitán (Marea) */
    case 'explorador': { const k = simple('#e8d3a0', { roughness: 0.6 }); add(new THREE.CylinderGeometry(0.38, 0.4, 0.025, 40), k, 0, 0.17); add(new THREE.CylinderGeometry(0.2, 0.23, 0.17, 32), k, 0, 0.27); add(new THREE.SphereGeometry(0.2, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), k, 0, 0.35).scale.y = 0.35; add(new THREE.CylinderGeometry(0.233, 0.233, 0.045, 32), simple('#5a8f3a'), 0, 0.21); break; }
    case 'hongo': { const c = add(new THREE.SphereGeometry(0.34, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), simple('#ff4f6e', { clearcoat: 1 }), 0, 0.1); c.scale.y = 0.62; for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + 0.3, e = 0.5 + (i % 2) * 0.35; add(new THREE.SphereGeometry(0.045, 12, 8), simple('#ffffff'), Math.cos(a) * Math.sin(e) * 0.33, 0.1 + Math.cos(e) * 0.2, Math.sin(a) * Math.sin(e) * 0.33).scale.y = 0.4; } add(new THREE.SphereGeometry(0.07, 12, 8), simple('#ffffff'), 0, 0.31, 0).scale.y = 0.4; break; }
    case 'capitan': { add(new THREE.CylinderGeometry(0.27, 0.235, 0.13, 36), simple('#ffffff'), 0, 0.22); add(new THREE.CylinderGeometry(0.238, 0.238, 0.06, 36), simple('#1d3f7a'), 0, 0.17); const v = add(new THREE.CylinderGeometry(0.21, 0.21, 0.02, 32, 1, false, -Math.PI / 2, Math.PI), simple('#1a2230'), 0, 0.15, 0.1); v.scale.set(1, 1, 1.15); v.rotation.x = 0.2; add(new THREE.TorusGeometry(0.035, 0.012, 8, 18), simple('#ffd23f', { metalness: 1, roughness: 0.2 }), 0, 0.23, 0.26); break; }
  }
  return g;
}
function anteojos(tipo, col) {
  const g = new THREE.Group();
  const vidrio = new THREE.MeshPhysicalMaterial({ color: tipo === 'sol' ? '#1a2a44' : '#bff4ff', roughness: 0.02, metalness: 0.2, clearcoat: 1, transparent: true, opacity: tipo === 'sol' ? 0.92 : 0.45, iridescence: 1 });
  const marco = simple(col, { metalness: 0.6 });
  if (tipo === 'visor') { const v = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.09, 40, 1, true, -1.1, 2.2), new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.02, transparent: true, opacity: 0.75, iridescence: 1, side: THREE.DoubleSide, emissive: col, emissiveIntensity: 0.4 })); v.position.set(0, 0.03, 0); g.add(v); return g; }
  for (const s of [-1, 1]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 28), vidrio); l.rotation.x = Math.PI / 2; l.position.set(s * 0.09, 0.03, 0.225); g.add(l);
    const a = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 8, 28), marco); a.position.copy(l.position); g.add(a);
  }
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.04, 8), marco); p.rotation.z = Math.PI / 2; p.position.set(0, 0.04, 0.23); g.add(p);
  return g;
}
function espalda(tipo, col) {
  const g = new THREE.Group();
  if (tipo === 'alas') {
    const m = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.05, transparent: true, opacity: 0.55, iridescence: 1, side: THREE.DoubleSide, clearcoat: 1 });
    for (const s of [-1, 1]) { const f = new THREE.Shape(); f.moveTo(0, 0); f.bezierCurveTo(0.12, 0.3, 0.42, 0.34, 0.44, 0.1); f.bezierCurveTo(0.42, -0.08, 0.2, -0.16, 0, 0); const w = new THREE.Mesh(new THREE.ShapeGeometry(f, 20), m); w.scale.x = s; w.position.set(s * 0.05, 0.68, -0.2); w.rotation.y = s * 0.5; w.userData.ala = s; g.add(w); }
  } else if (tipo === 'mochila') {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.04, transparent: true, opacity: 0.6, clearcoat: 1, iridescence: 0.8 })); b.position.set(0, 0.6, -0.24); g.add(b);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), simple('#ff8a3d')); f.position.set(0.04, 0.56, -0.28); g.add(f);
  } else if (tipo === 'aleta') {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 16), simple(col)); f.scale.z = 0.35; f.rotation.x = -0.5; f.position.set(0, 0.8, -0.17); g.add(f);
  } else if (tipo === 'molinete') {
    /* el molinete de papel en un palito (el premio de Brisa): gira más rápido cuando se corre */
    const palo = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 8), simple('#ffffff')); palo.position.set(0.1, 0.78, -0.22); palo.rotation.z = -0.25; g.add(palo);
    const rueda = new THREE.Group(); rueda.position.set(0.18, 1.08, -0.2); rueda.userData.gira = 1;
    ['#ff6fb0', '#39d6ff', '#ffe14a', '#56e05a'].forEach((c, i) => {
      const f = new THREE.Shape(); f.moveTo(0, 0); f.lineTo(0.16, 0.02); f.quadraticCurveTo(0.17, 0.13, 0.02, 0.15); f.lineTo(0, 0);
      const a = new THREE.Mesh(new THREE.ShapeGeometry(f, 6), simple(c, { side: THREE.DoubleSide })); a.rotation.z = i * Math.PI / 2; rueda.add(a);
    });
    const eje = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), simple('#ffffff')); eje.position.z = 0.01; rueda.add(eje);
    g.add(rueda);
  }
  return g;
}
function peinado(tipo, col) {
  const g = new THREE.Group(), m = simple(col, { roughness: 0.3, sheen: 1, sheenColor: new THREE.Color('#ffffff') });
  const bola = (r, x, y, z, sx = 1, sy = 1, sz = 1) => { const q = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), m); q.position.set(x, y, z); q.scale.set(sx, sy, sz); g.add(q); return q; };
  switch (tipo) {
    case 'mechon': { const c = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 16), m); c.position.set(0, 0.27, 0.02); c.rotation.x = 0.4; g.add(c); break; }
    case 'rulos': for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; bola(0.07, Math.sin(a) * 0.13, 0.19 + (i % 2) * 0.02, Math.cos(a) * 0.13 - 0.02); } bola(0.08, 0, 0.23, 0); break;
    case 'pinches': for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 2.2, c = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 12), m); c.position.set(Math.sin(a) * 0.14, 0.2 + Math.cos(a) * 0.06, -0.03); c.rotation.z = -a * 0.6; g.add(c); } break;
    case 'melena': { const c = new THREE.Mesh(new THREE.SphereGeometry(0.255, 32, 16, Math.PI * 0.18, Math.PI * 1.64, 0, Math.PI * 0.62), m); c.rotation.y = Math.PI; c.position.y = 0.01; g.add(c); break; }
    case 'rodete': bola(0.2, 0, 0.1, -0.03, 1.2, 0.6, 1.2); bola(0.1, 0, 0.3, -0.06); break;
    case 'colitas': bola(0.2, 0, 0.1, -0.03, 1.2, 0.6, 1.2); for (const s of [-1, 1]) { bola(0.075, s * 0.25, 0.08, -0.05); bola(0.06, s * 0.3, -0.02, -0.05); } break;
    case 'cresta': for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 10), m); c.position.set(0, 0.24 - Math.abs(i - 2) * 0.01, 0.12 - i * 0.07); c.rotation.x = -0.25 + i * 0.12; g.add(c); } break;
    case 'nube': for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; bola(0.1, Math.sin(a) * 0.17, 0.15 + Math.sin(i * 1.7) * 0.03, Math.cos(a) * 0.15 - 0.02); } bola(0.15, 0, 0.26, -0.02); break;
  }
  g.traverse((o) => { o.castShadow = true; });
  return g;
}

/* ---------------------------------------------------------------- carteles */
/* el nombre flotando arriba (y el globo de chat): un sprite con un canvas */
function cartel(texto, { tinta = '#29384a', borde = 'rgba(255,255,255,0.95)', alto = 48, max = 22 } = {}) {
  /* el nombre flota en texto solo, oscuro con un borde blanco (como en los videos) */
  const t = String(texto).slice(0, max);
  const c = document.createElement('canvas'), g = c.getContext('2d');
  const fuente = `800 ${alto * 0.66}px "Nunito","Arial Rounded MT Bold","Segoe UI",system-ui,sans-serif`;
  g.font = fuente;
  const w = Math.ceil(g.measureText(t).width + alto * 0.6);
  c.width = w; c.height = alto;
  g.font = fuente; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.strokeStyle = borde; g.lineWidth = alto * 0.16; g.strokeText(t, w / 2, alto / 2 + 1);
  g.fillStyle = tinta; g.fillText(t, w / 2, alto / 2 + 1);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  const k = 0.0046;
  s.scale.set(w * k, alto * k, 1);
  s.renderOrder = 5;
  return s;
}
/* el globo de chat parte el texto en renglones */
function globo(texto) {
  const palabras = String(texto).slice(0, 90).split(/\s+/), lineas = [];
  let l = '';
  for (const p of palabras) { if ((l + ' ' + p).trim().length > 24) { lineas.push(l); l = p; } else l = (l + ' ' + p).trim(); }
  if (l) lineas.push(l);
  const alto = 40, w = 320, h = lineas.length * alto + 22;
  const c = document.createElement('canvas'); c.width = w; c.height = h + 16;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,0.95)'; g.strokeStyle = '#8fd8ff'; g.lineWidth = 3;
  g.beginPath(); g.roundRect(2, 2, w - 4, h - 4, 18); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(w / 2 - 12, h - 3); g.lineTo(w / 2, h + 14); g.lineTo(w / 2 + 12, h - 3); g.fill();
  g.fillStyle = '#35506b'; g.font = '600 26px "Nunito","Arial Rounded MT Bold","Segoe UI",system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  lineas.forEach((q, i) => g.fillText(q, w / 2, 12 + alto / 2 + i * alto));
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  s.scale.set(w * 0.0052, (h + 16) * 0.0052, 1); s.center.set(0.5, 0); s.renderOrder = 6;
  return s;
}

/* ---------------------------------------------------------------- el muñeco */
const suave = (a, b, k) => a + (b - a) * k;
export class Meeple {
  static estiloAnim = 'suave';   // cómo pasan las poses: 'suave' | 'lineal' | 'chop' (Opciones › Imagen)
  constructor(apariencia = APARIENCIA_INICIAL(), nombre = '') {
    const G = geometrias();
    this.raiz = new THREE.Group();          // en el piso, mirando a +z
    this.cadera = new THREE.Group();        // lo que sube y baja al caminar
    this.raiz.add(this.cadera);
    this.cuerpo = new THREE.Mesh(G.cuerpo);
    const M = MEDIDAS;
    this.cabeza = new THREE.Group(); this.cabeza.position.y = M.cabezaY;
    this.cabezaM = new THREE.Mesh(G.cabeza); this.cabezaM.position.y = -M.cabezaY; this.cabeza.add(this.cabezaM);
    this.brazos = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * M.hombroX, M.hombroY, 0); const m = new THREE.Mesh(G.brazo[(s + 1) / 2]); m.position.set(-s * M.hombroX, -M.hombroY, 0); p.add(m); p.userData.m = m; return p; });
    this.piernas = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * M.caderaX, M.caderaY, 0); const m = new THREE.Mesh(G.pierna[(s + 1) / 2]); m.position.set(-s * M.caderaX, -M.caderaY, 0); p.add(m); p.userData.m = m; return p; });
    this.cadera.add(this.cuerpo, this.cabeza, ...this.brazos, ...this.piernas);
    this.extras = new THREE.Group(); this.cabeza.add(this.extras);
    this.ojos = new THREE.Group(); this.cabeza.add(this.ojos);
    this.tParpadeo = 2 + Math.random() * 3;
    this.atras = new THREE.Group(); this.cadera.add(this.atras);
    for (const m of [this.cuerpo, this.cabezaM, ...this.brazos.map((b) => b.userData.m), ...this.piernas.map((b) => b.userData.m)]) { m.castShadow = true; m.receiveShadow = false; }
    this.fase = 0; this.t = Math.random() * 10; this.estado = 'quieto'; this.gesto = null; this.tGesto = 0;
    this.rot = {};   // las rotaciones actuales (se acercan a las de la pose)
    this.particulas = null;
    this.ponerApariencia(apariencia);
    if (nombre) this.ponerNombre(nombre);
  }
  /* de lejos alcanza el cuerpo: los accesorios, el pelo y los ojos son la mayoría
     de las piezas (hasta 30 llamadas de dibujo por muñeco) */
  detalle(si) {
    if (this._detalle === si) return; this._detalle = si;
    this.extras.visible = this.ojos.visible = this.atras.visible = si;
    if (this.particulas) this.particulas.visible = si;
  }
  ponerApariencia(A) {
    this.A = { ...APARIENCIA_INICIAL(), ...A };
    const m = materialMeeple(this.A);
    for (const q of [this.cuerpo, ...this.brazos.map((b) => b.userData.m), ...this.piernas.map((b) => b.userData.m)]) q.material = m;
    this.cabezaM.material = materialMeeple(this.A, 'cabeza');
    this.ojos.clear(); this.ojos.add(ojos(this.A.ojos || 'ovalos', this.A.color, this.A.color2));
    this.extras.clear(); this.atras.clear();
    /* los accesorios se dibujaron para una cabeza de 0,235: se achican a la de ahora */
    const cab = new THREE.Group(); cab.scale.setScalar(MEDIDAS.cabezaR / 0.235); this.extras.add(cab);
    if (this.A.peinado !== 'ninguno') cab.add(peinado(this.A.peinado, this.A.colorPelo));
    if (this.A.sombrero !== 'ninguno') cab.add(sombrero(this.A.sombrero, this.A.color2));
    if (this.A.anteojos !== 'ninguno') cab.add(anteojos(this.A.anteojos, this.A.color2));
    if (this.A.espalda !== 'ninguno') this.atras.add(espalda(this.A.espalda, this.A.color2));
    this.ponerParticulas(this.A.particulas);
  }
  ponerParticulas(tipo) {
    if (this.particulas) { this.raiz.remove(this.particulas); this.particulas = null; }
    if (!tipo || tipo === 'ninguna') return;
    const col = { burbujas: '#d8f6ff', estrellas: '#fff4a8', hojas: '#8df06a', notas: '#ff9ad8' }[tipo];
    const n = 14, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), f = new Float32Array(n);
    for (let i = 0; i < n; i++) { f[i] = Math.random(); }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('fase', new THREE.BufferAttribute(f, 1));
    const mat = new THREE.PointsMaterial({ color: col, size: tipo === 'burbujas' ? 0.09 : 0.07, transparent: true, opacity: 0.85, depthWrite: false, map: puntoTex(tipo) });
    this.particulas = new THREE.Points(g, mat); this.particulas.frustumCulled = false;
    this.raiz.add(this.particulas);
  }
  ponerNombre(nombre, esYo = false) {
    if (this.cartel) this.raiz.remove(this.cartel);
    this.nombre = nombre;
    this.cartel = cartel(nombre, esYo ? { tinta: '#1f7a2e' } : {});
    this.cartel.position.y = 1.52;
    this.raiz.add(this.cartel);
  }
  decir(texto) {
    if (this.globo) { this.raiz.remove(this.globo); this.globo.material.map.dispose(); }
    this.globo = globo(texto); this.globo.position.y = 1.66; this.tGlobo = 6;
    this.raiz.add(this.globo);
  }
  /* un gesto de un rato: saludar, bailar1..3, festejar, sentarse (este queda hasta moverse) */
  hacerGesto(g) { this.gesto = g; this.tGesto = g === 'sentarse' ? 999 : g.startsWith('bailar') ? 8 : g === 'voltereta' ? 1.1 : g === 'aplaudir' ? 3 : 2.4; this.tG0 = this.tGesto; }

  /* estado: quieto | camina | corre | salta | cae | nada | flota | monta | sentado,
     y los del parkour: desliza | rueda | trepa | pared. vel: velocidad horizontal
     (m/s) para el paso. Correr, caminar, saltar, caer, aterrizar y los del
     parkour salen de poses clave (animador.js) con el estilo de Meeple.estiloAnim */
  animar(dt, estado, vel = 0) {
    this.t += dt;
    if (this.estado !== estado) { this.estado = estado; this._tEst = 0; if (estado !== 'quieto' && this.gesto === 'sentarse') this.gesto = null; }
    this._tEst = (this._tEst || 0) + dt;
    const estilo = Meeple.estiloAnim, chop = estilo === 'chop';
    if (this.gesto && estado !== 'quieto' && estado !== 'flota') { if (this.gesto !== 'saludar') this.gesto = null; }
    if (this.gesto) { this.tGesto -= dt; if (this.tGesto <= 0) this.gesto = null; }
    /* en chop todo va a 12 cuadros por segundo (también respirar y los gestos) */
    const t = chop ? Math.floor(this.t * CUADROS_CHOP) / CUADROS_CHOP : this.t, R = {};
    /* lo que da vida (se calcula antes de la pose): inclinarse en las curvas según
       lo que gira por segundo, aplastarse al caer y estirarse al saltar, y cada
       tanto, si está quieto, estirarse o mirar alrededor */
    const yaw = this.raiz.rotation.y; let dyaw = yaw - (this._yaw ?? yaw); while (dyaw > Math.PI) dyaw -= Math.PI * 2; while (dyaw < -Math.PI) dyaw += Math.PI * 2; this._yaw = yaw;
    const giro = dt > 0 ? dyaw / dt : 0;
    this._incl = suave(this._incl || 0, Math.max(-0.32, Math.min(0.32, -giro * 0.07 * Math.min(1, vel / 3.5))), 1 - Math.exp(-dt * 8));
    const enAire = (q) => q === 'salta' || q === 'cae';
    if (enAire(this._antes) && !enAire(estado) && estado !== 'nada') { this._aplasta = Math.min(1, 0.5 + (this._tAire || 0) * 0.8) * 0.6; if ((this._tAire || 0) > 0.3 && estado !== 'rueda') this._tAterriza = 0; }
    if (estado === 'salta' && this._antes !== 'salta') this._estira = 1;
    this._tAire = enAire(estado) ? (this._tAire || 0) + dt : 0;
    this._antes = estado;
    this._aplasta = Math.max(0, (this._aplasta || 0) - dt * 3.2); this._estira = Math.max(0, (this._estira || 0) - dt * 3.5);
    this._tQuieto = estado === 'quieto' && !this.gesto ? (this._tQuieto || 0) + dt : 0;
    if (this._tQuieto > 9 && !this._ocio) { this._ocio = { tipo: Math.random() < 0.5 ? 'estira' : 'mira', t: 0 }; }
    if (this._ocio) { this._ocio.t += dt; if (this._ocio.t > 2.6 || estado !== 'quieto') { this._ocio = null; this._tQuieto = 0; } }
    /* la pose de base */
    R.cy = 0; R.cx = 0; R.cz = 0; R.hy = 0; R.hx = 0; R.hz = 0;
    R.bl = [0, 0, -0.2]; R.br = [0, 0, 0.2];     // [rx, ry, rz] de cada brazo (cuelgan por fuera del cuerpo)
    R.pl = [0, 0, 0]; R.pr = [0, 0, 0];
    R.sy = 1; R.ry = 0; R.pz = 0;
    let clip = false;
    if (estado === 'camina' || estado === 'corre') {
      const corre = estado === 'corre';
      this.fase += dt * (corre ? 13 : 9) * Math.min(1.4, 0.35 + vel / (corre ? 5 : 2.6));
      /* una vuelta de la fase (2π) es un ciclo entero del clip (los dos pasos) */
      const C = CLIPS[estado]; aplicarClip(R, C, this.fase / (Math.PI * 2) * C.dur, estilo); clip = true;
    } else if (estado === 'salta') { aplicarClip(R, CLIPS.salta, this._tEst, estilo); clip = true; }
    else if (estado === 'cae') { aplicarClip(R, CLIPS.cae, t, estilo); clip = true; }
    else if (CLIPS[estado] && ['desliza', 'rueda', 'trepa', 'pared'].includes(estado)) { aplicarClip(R, CLIPS[estado], estado === 'desliza' ? t : this._tEst, estilo); clip = true; }
    else if (estado === 'nada') {
      const s = Math.sin(t * 5);
      R.cx = 1.25; R.cy = 0.35 + Math.sin(t * 10) * 0.03; R.ry = s * 0.18;
      R.bl = [-2.4 + s * 1.1, 0, -0.5]; R.br = [-2.4 - s * 1.1, 0, 0.5];
      R.pl = [s * 0.5, 0, 0]; R.pr = [-s * 0.5, 0, 0]; R.hx = -1.0;
    } else if (estado === 'flota') {
      R.bl = [0, 0, -1.2 + Math.sin(t * 1.3) * 0.2]; R.br = [0, 0, 1.2 - Math.sin(t * 1.3) * 0.2];
      R.pl = [0.35, 0, 0.1]; R.pr = [-0.1, 0, -0.1]; R.cz = Math.sin(t * 0.8) * 0.2; R.cx = Math.sin(t * 0.6) * 0.15; R.cy = 0.1;
    } else if (estado === 'sentado') {
      /* en el asiento del monorriel: piernas adelante, manos en las rodillas, mira por la ventana */
      R.cy = -0.2; R.pl = [-1.5, 0, 0.1]; R.pr = [-1.5, 0, -0.1]; R.bl = [-0.5, 0, -0.25]; R.br = [-0.5, 0, 0.25]; R.hy = 0.9 + Math.sin(t * 0.3) * 0.35; R.hx = Math.sin(t * 0.7) * 0.04;
    } else if (estado === 'monta') {
      R.cy = -0.18; R.pl = [-1.45, 0, 0.35]; R.pr = [-1.45, 0, -0.35]; R.bl = [-1.2, 0, -0.25]; R.br = [-1.2, 0, 0.25]; R.cx = 0.25; R.hx = -0.1;
    } else {
      /* quieto: respira y se balancea un poquito */
      R.sy = 1 + Math.sin(t * 2.2) * 0.012; R.bl = [Math.sin(t * 1.1) * 0.05, 0, -0.2 - Math.sin(t * 2.2) * 0.02]; R.br = [-Math.sin(t * 1.1) * 0.05, 0, 0.2 + Math.sin(t * 2.2) * 0.02];
      R.hy = Math.sin(t * 0.37) * 0.25; R.hz = Math.sin(t * 0.5) * 0.04;
      if (this._ocio) {
        const k = Math.sin(Math.min(1, this._ocio.t / 2.6) * Math.PI);
        if (this._ocio.tipo === 'estira') { R.bl = [0, 0, -0.2 - k * 2.6]; R.br = [0, 0, 0.2 + k * 2.6]; R.sy = 1 + k * 0.06; R.hx = -k * 0.3; }
        else { R.hy = Math.sin(this._ocio.t * 2.4) * 0.9 * k; R.hx = -0.1 * k; }
      }
    }
    /* el golpe al aterrizar, encima de lo que venga (se va en 0,3 s) */
    if (this._tAterriza != null) {
      this._tAterriza += dt;
      if (this._tAterriza < CLIPS.aterriza.dur && !enAire(estado)) { const q = this._tAterriza / CLIPS.aterriza.dur; aplicarClip(R, CLIPS.aterriza, this._tAterriza, estilo, 1 - q * q); clip = true; }
      else this._tAterriza = null;
    }
    /* los gestos, encima de la pose */
    if (this.gesto) {
      const g = this.gesto;
      if (g === 'saludar') { R.br = [0, 0, 2.6 + Math.sin(t * 12) * 0.35]; R.hz = 0.1; }
      else if (g === 'festejar') { R.bl = [0, 0, -2.7 + Math.sin(t * 14) * 0.2]; R.br = [0, 0, 2.7 - Math.sin(t * 14) * 0.2]; R.cy = Math.abs(Math.sin(t * 7)) * 0.18; }
      else if (g === 'sentarse' && estado === 'quieto') { R.cy = -0.2; R.pl = [-1.5, 0, 0.1]; R.pr = [-1.5, 0, -0.1]; R.bl = [-0.3, 0, -0.25]; R.br = [-0.3, 0, 0.25]; R.cx = -0.05; }
      else if (g === 'bailar1') { const s = Math.sin(t * 8); R.cz = s * 0.25; R.bl = [0, 0, -1.6 - s * 0.9]; R.br = [0, 0, 1.6 - s * 0.9]; R.cy = Math.abs(Math.sin(t * 8)) * 0.06; R.hz = -s * 0.2; }
      else if (g === 'bailar2') { const s = Math.sin(t * 6); R.ry = t * 4; R.bl = [s, 0, -1.2]; R.br = [-s, 0, 1.2]; R.pl = [s * 0.5, 0, 0]; R.pr = [-s * 0.5, 0, 0]; }
      else if (g === 'aplaudir') { const s2 = Math.max(0, Math.sin(t * 15)); R.bl = [-1.25, 0, -0.05 + s2 * 0.3]; R.br = [-1.25, 0, 0.05 - s2 * 0.3]; R.hx = -0.1; R.cy = Math.abs(Math.sin(t * 7.5)) * 0.03; }
      else if (g === 'voltereta') { const p = 1 - Math.max(0, this.tGesto) / this.tG0; R.cx = -p * Math.PI * 2; R.cy = Math.sin(p * Math.PI) * 0.95; R.bl = [0, 0, -2.2]; R.br = [0, 0, 2.2]; R.pl = [-1.2 * Math.sin(p * Math.PI), 0, 0]; R.pr = [-1.2 * Math.sin(p * Math.PI), 0, 0]; }
      else if (g === 'pensar') { R.br = [-2.1, 0, 0.75]; R.bl = [-0.6, 0, -0.5]; R.hz = 0.18; R.hy = Math.sin(t * 0.8) * 0.2; R.hx = 0.1; }
      else if (g === 'saltito') { const s2 = Math.abs(Math.sin(t * 9)); R.cy = s2 * 0.26; R.bl = [0, 0, -0.8 - s2 * 0.8]; R.br = [0, 0, 0.8 + s2 * 0.8]; R.pl = [-s2 * 0.4, 0, 0]; R.pr = [-s2 * 0.4, 0, 0]; R.sy = 1 + (1 - s2) * -0.06; }
      else if (g === 'bailar3') { const s = Math.sin(t * 10); R.cy = Math.max(0, s) * 0.22; R.bl = [-2.9, 0, -0.3]; R.br = [-2.9, 0, 0.3]; R.pl = [s * 0.6, 0, 0.2]; R.pr = [-s * 0.6, 0, -0.2]; R.hx = s * 0.15; }
    }
    /* acercar lo actual a la pose (transiciones suaves) */
    /* con poses clave casi no se suaviza (si no, se borran); en chop, nada */
    const k = chop ? 1 : 1 - Math.exp(-dt * (clip ? 26 : 14)), r = this.rot;
    const v = (n, x) => (r[n] = r[n] === undefined ? x : suave(r[n], x, k));
    /* las vueltas enteras (voltereta para atrás, rodar para adelante) van sin suavizar y después se acomodan */
    if (this.gesto === 'voltereta' || estado === 'rueda') r.cx = R.cx; else { if (r.cx < -Math.PI) r.cx += Math.PI * 2; if (r.cx > Math.PI) r.cx -= Math.PI * 2; }
    this.cadera.position.y = v('cy', R.cy);
    this.cadera.position.z = v('pz', R.pz);
    this.cadera.rotation.set(v('cx', R.cx), v('ry', R.ry), v('cz', R.cz) + this._incl);
    const ap = this._aplasta * this._aplasta, es = this._estira;
    this.cadera.scale.y = v('sy', R.sy) * (1 - ap * 0.26 + es * 0.12);
    this.cadera.scale.x = this.cadera.scale.z = 1 + ap * 0.14 - es * 0.05;
    this.cabeza.rotation.set(v('hx', R.hx), v('hy', R.hy), v('hz', R.hz));
    ['bl', 'br'].forEach((n, i) => { const q = this.brazos[i]; q.rotation.set(v(n + 'x', R[n][0]), v(n + 'y', R[n][1]), v(n + 'z', R[n][2])); });
    ['pl', 'pr'].forEach((n, i) => { const q = this.piernas[i]; q.rotation.set(v(n + 'x', R[n][0]), v(n + 'y', R[n][1]), v(n + 'z', R[n][2])); });
    /* parpadea cada tanto (y dos veces seguidas, a veces) */
    this.tParpadeo -= dt;
    const cierre = this.tParpadeo < 0.12 && this.tParpadeo > 0 ? 0.12 : 1;
    if (this.tParpadeo <= 0) this.tParpadeo = Math.random() < 0.2 ? 0.3 : 2.5 + Math.random() * 3.5;
    for (const o of this.ojos.children[0]?.children || []) o.scale.y = cierre;
    /* las alas aletean */
    for (const o of this.atras.children) for (const w of o.children) { if (w.userData.ala) w.rotation.y = w.userData.ala * (0.5 + Math.sin(t * (estado === 'cae' ? 18 : 4)) * 0.25); if (w.userData.gira) w.rotation.z -= dt * (2.5 + vel * 2.2); }
    /* las partículas dan vueltas alrededor */
    if (this.particulas) {
      const p = this.particulas.geometry.attributes.position, f = this.particulas.geometry.attributes.fase;
      for (let i = 0; i < p.count; i++) { const q = (f.getX(i) + t * 0.12) % 1, a = f.getX(i) * 40 + t * 0.8; p.setXYZ(i, Math.cos(a) * 0.45, 0.2 + q * 1.3, Math.sin(a) * 0.45); }
      p.needsUpdate = true; this.particulas.material.opacity = 0.85;
    }
    if (this.globo) { this.tGlobo -= dt; if (this.tGlobo <= 0) { this.raiz.remove(this.globo); this.globo = null; } else this.globo.material.opacity = Math.min(1, this.tGlobo * 2); }
  }
  /* en primera persona: la cabeza (ahí va la cámara), el cuerpo de campana (taparía las
     piernas al mirar abajo) y los brazos (van los de la cámara, primera.js) no se ven, pero
     siguen dando sombra: en el piso está el muñeco entero. Mirando abajo se ven las piernas */
  primeraPersona(si) {
    const sombra = Meeple._sombra ||= new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    for (const q of [this.cuerpo, this.cabezaM, ...this.brazos.map((b) => b.userData.m)]) {
      if (si) { if (q.material !== sombra) q.userData.mat0 = q.material; q.material = sombra; }
      else if (q.userData.mat0) { q.material = q.userData.mat0; q.userData.mat0 = null; }
    }
    this.ojos.visible = this.extras.visible = this.atras.visible = !si;
    if (this.cartel) this.cartel.visible = !si; if (this.globo) this.globo.visible = !si;
    this.enPrimera = si;
  }
  quitar() { this.raiz.removeFromParent(); }
}

const puntos = {};
function puntoTex(tipo) {
  if (puntos[tipo]) return puntos[tipo];
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  if (tipo === 'burbujas') { g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 5; g.beginPath(); g.arc(32, 32, 24, 0, 7); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(24, 22, 6, 0, 7); g.fill(); }
  else if (tipo === 'estrellas') { g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 11 : 28, a = i / 10 * Math.PI * 2 - Math.PI / 2; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } g.fill(); }
  else if (tipo === 'hojas') { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(32, 32, 26, 12, 0.7, 0, 7); g.fill(); }
  else { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(24, 44, 12, 9, -0.4, 0, 7); g.fill(); g.fillRect(32, 10, 5, 34); g.fillRect(32, 10, 18, 6); }
  const t = new THREE.CanvasTexture(c); puntos[tipo] = t; return t;
}
export { cartel, mergeGeometries };
