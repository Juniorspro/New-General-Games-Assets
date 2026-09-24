/* ============================================================================
   aeroplaza/js/reinos/aurora.js — la noche que no termina: campo de nieve
   celeste, cristales que brillan, un lago congelado, aurora en el cielo,
   delfines que vuelan por aros dorados y pedazos de estrella que caen.
   En el centro, el cristal del sueño: cuando la sala le da suficientes
   estrellas, empieza el sueño colectivo (el cielo gira de colores, se flota).
   ========================================================================== */
import * as THREE from 'three';
import { Mundo, azar, ruido2, suaveEntre } from '../mundo.js';
import { terreno, brilloso, materialVidrio, UNI } from '../naturaleza.js';
import { Orbes, Chispas, discoMalla, puntoSuave } from '../objetos.js';
import { Delfin } from '../delfin.js';

const R1 = ruido2(44), R2 = ruido2(12);
export function alturaAurora(x, z) {
  const r = Math.hypot(x, z);
  let h = 1 + R1(x * 0.025, z * 0.025) * 3.5 + R2(x * 0.08, z * 0.08) * 0.6;
  h += suaveEntre(60, 110, r) * 14;          // las lomas del borde
  const dl = Math.hypot(x + 30, z - 25);
  if (dl < 18) h = h + (0.2 - h) * suaveEntre(18, 13, dl);   // el lago congelado (plano)
  h = h + (1.2 - h) * suaveEntre(14, 9, r);  // la explanada del cristal
  return h;
}
function colorAurora(x, z, h) {
  const dl = Math.hypot(x + 30, z - 25);
  if (dl < 13.5) return [0.55, 0.8, 1.0, 1];
  if (Math.hypot(x, z) < 9) { const k = Math.floor(Math.hypot(x, z) / 1.5) % 2; return k ? [0.75, 0.8, 1.0, 1] : [0.6, 0.6, 0.95, 1]; }
  const v = 0.86 + R2(x * 0.3, z * 0.3) * 0.08;
  return [v * 0.9, v * 0.95, v, 1];   // la arena de Rezona como grano: parece nieve venteada
}

export function crearAurora(ctx) {
  const A = alturaAurora;
  const mundo = new Mundo(A); mundo.agua = null; mundo.limite = 100;
  const g = new THREE.Group();
  const suelo = terreno(A, { tam: 240, seg: 160, color: colorAurora });
  suelo.material.roughness = 0.45; g.add(suelo);
  /* el hielo del lago: espejo celeste */
  const hielo = new THREE.Mesh(new THREE.CircleGeometry(13.6, 48).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#bfe8ff', roughness: 0.02, metalness: 0.1, clearcoat: 1, envMapIntensity: 2, emissive: '#2a5fbf', emissiveIntensity: 0.15 }));
  hielo.position.set(-30, 0.23, 25); g.add(hielo);

  /* cristales: prismas que brillan por dentro */
  const r = azar(19), cristales = [];
  const colores = ['#7ff6ff', '#b58bff', '#ff9ad8', '#9bffcf'];
  for (let i = 0; i < 46; i++) {
    const a = r() * 6.28, d = 14 + r() * 70, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.hypot(x + 30, z - 25) < 15) continue;
    const alto = 1 + r() * 4, c = colores[i % colores.length];
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0, alto * 0.28, alto, 6), new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.8, emissive: c, emissiveIntensity: 0.5 }));
    const base = new THREE.Mesh(new THREE.CylinderGeometry(alto * 0.28, alto * 0.22, alto * 0.4, 6), m.material); base.position.y = -alto * 0.7;
    m.add(base);
    m.position.set(x, A(x, z) + alto * 0.9, z); m.rotation.set((r() - 0.5) * 0.3, r() * 6, (r() - 0.5) * 0.3); m.castShadow = true;
    g.add(m); cristales.push(m);
    mundo.cilindro(x, z, alto * 0.25, A(x, z) - 1, A(x, z) + alto * 1.2);
  }
  /* pinos de hielo */
  for (let i = 0; i < 30; i++) {
    const a = r() * 6.28, d = 20 + r() * 60, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.hypot(x + 30, z - 25) < 16) continue;
    const pino = new THREE.Group(); pino.position.set(x, A(x, z), z);
    for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(1.6 - k * 0.4, 1.8, 7), brilloso('#e8f6ff', { roughness: 0.3, emissive: '#7fb0ff', emissiveIntensity: 0.08 })); c.position.y = 1.2 + k * 1.1; c.castShadow = true; pino.add(c); }
    g.add(pino); mundo.cilindro(x, z, 0.5, A(x, z) - 1, A(x, z) + 3.5);
  }
  /* el cristal del sueño, en el centro */
  const altar = new THREE.Group(); altar.position.set(0, A(0, 0), 0);
  const pie = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.2, 0.6, 6), brilloso('#e8f0ff')); pie.position.y = 0.3; altar.add(pie);
  const joya = new THREE.Mesh(new THREE.OctahedronGeometry(1.4, 0), new THREE.MeshPhysicalMaterial({ color: '#dff4ff', roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.85, emissive: '#9fd8ff', emissiveIntensity: 0.6, iridescence: 1 }));
  joya.position.y = 3.3; joya.scale.y = 1.5; altar.add(joya);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: puntoSuave(), color: '#bfe8ff', transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.set(7, 7, 1); halo.position.y = 3.3; altar.add(halo);
  const anillo = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.07, 8, 60), new THREE.MeshBasicMaterial({ color: '#fff4b0' })); anillo.position.y = 3.3; anillo.rotation.x = Math.PI / 2; altar.add(anillo);
  g.add(altar);
  mundo.cilindro(0, 0, 3.1, A(0, 0) - 1, A(0, 0) + 0.6);

  /* los aros dorados del cielo y los delfines que pasan por ellos */
  const pts = [];
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; pts.push(new THREE.Vector3(Math.cos(a) * 45, 22 + Math.sin(a * 2) * 8, Math.sin(a) * 45)); }
  const curva = new THREE.CatmullRomCurve3(pts, true);
  const aros = [];
  for (let i = 0; i < 8; i++) {
    const u = (i + 0.5) / 8, p = curva.getPointAt(u), q = curva.getPointAt((u + 0.01) % 1);
    const aro = new THREE.Mesh(new THREE.TorusGeometry(3, 0.25, 12, 48), brilloso('#ffd23f', { metalness: 0.8, roughness: 0.12, emissive: '#ffb000', emissiveIntensity: 0.9 }));
    aro.position.copy(p); aro.lookAt(q); g.add(aro); aros.push(aro);
  }
  const delfines = [0, 0.33, 0.66].map((f) => { const d = new Delfin(g, new THREE.Vector3(), 1, 0, 0, { vuela: true, curva }); d.a = f; return d; });

  /* las estrellas que caen: una cada tanto, con estela, y quedan brillando en el piso */
  const estrellas = [];
  const matE = new THREE.MeshBasicMaterial({ color: '#fff6b0' });
  const geoE = new THREE.OctahedronGeometry(0.35, 0);
  const estela = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#fff2a0', size: 0.5, map: puntoSuave(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const nE = 200, pE = new Float32Array(nE * 3); estela.geometry.setAttribute('position', new THREE.BufferAttribute(pE, 3)); estela.frustumCulled = false; g.add(estela);
  let iE = 0, tNueva = 2;
  const nueva = () => {
    const a = r() * 6.28, d = 10 + r() * 45, x = Math.cos(a) * d, z = Math.sin(a) * d;
    const m = new THREE.Mesh(geoE, matE); const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: puntoSuave(), color: '#fff2a0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); h.scale.set(2.2, 2.2, 1); m.add(h);
    m.position.set(x + 30, 70, z - 20); g.add(m);
    estrellas.push({ m, destino: new THREE.Vector3(x, A(x, z) + 0.8, z), cae: true, t: 0 });
  };
  const chispas = new Chispas(g, '#fff6b0', 120);

  /* el sueño colectivo */
  const sueno = { activo: false, t: 0, total: 0 };
  const orbLug = [];
  for (let i = 0; i < 24; i++) { const a = i / 24 * 6.28, d = 18 + (i % 3) * 10, x = Math.cos(a) * d, z = Math.sin(a) * d; orbLug.push([x, A(x, z) + 0.9, z]); }
  for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; orbLug.push([-30 + Math.cos(a) * 8, 1.1, 25 + Math.sin(a) * 8]); }
  const orbes = new Orbes(g, orbLug, { color: '#d0a8ff' });
  const discos = [{ id: 'disco-aurora', p: new THREE.Vector3(-30, 1.6, 25), cancion: 'aurora' }].map((d) => { const m = discoMalla(); m.position.copy(d.p); g.add(m); return { ...d, malla: m }; });
  const npcs = [{ id: 'estela', pos: [4, 5], rot: -2.4, y: A(4, 5) }];
  /* la estación: una plataforma de hielo con el tren */
  const anden = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.3, 0.5, 6), brilloso('#e8f0ff')); anden.position.set(0, A(0, 40) + 0.25, 40); g.add(anden);
  mundo.cilindro(0, 40, 4, A(0, 40) - 1, A(0, 40) + 0.5);
  mundo.interactivo({ id: 'tren', pos: new THREE.Vector3(0, A(0, 40) + 0.5, 40), radio: 3.6, accion: 'viajar', icono: '🚆' });
  mundo.interactivo({ id: 'sueno', pos: new THREE.Vector3(0, A(0, 0) + 0.6, 0), radio: 4.2, accion: 'sueno', icono: '✨' });
  let t = 0;
  return {
    id: 'aurora', mundo, grupo: g, inicio: new THREE.Vector3(0, A(0, 40) + 0.55, 38), rumboInicio: Math.PI, musica: 'aurora', cielo: { hora: 0.02, aurora: 1, nubes: 0, hemi: 0.95, hemiColor: '#9fb8ff' },
    orbes, discos, npcs, sueno, estrellas,
    empezarSueno() { sueno.activo = true; sueno.t = 60; sueno.total = 0; mundo.sueno = true; },
    /* devuelve cuántas estrellas juntó el jugador este cuadro */
    actualizar(dt, jp, cielo) {
      t += dt;
      for (const d of delfines) d.actualizar(dt);
      joya.rotation.y = t * 0.6; anillo.rotation.z = t * 0.4; halo.material.opacity = 0.45 + Math.sin(t * 2) * 0.15;
      for (const c of cristales) c.material.emissiveIntensity = 0.4 + Math.sin(t * 1.3 + c.position.x) * 0.2;
      aros.forEach((a, i) => a.rotation.z = t * 0.5 + i);
      for (const d of discos) { d.malla.rotation.y = t * 1.6; d.malla.position.y = d.p.y + Math.sin(t * 2) * 0.12; }
      tNueva -= dt; if (tNueva <= 0 && estrellas.filter((e) => !e.juntada).length < 8) { nueva(); tNueva = 5 + r() * 4; }
      let juntadas = 0;
      for (const e of estrellas) {
        if (e.juntada) continue;
        e.t += dt; e.m.rotation.y += dt * 3;
        if (e.cae) {
          e.m.position.lerp(e.destino, Math.min(1, dt * 1.4));
          const i = iE = (iE + 1) % nE; pE[i * 3] = e.m.position.x; pE[i * 3 + 1] = e.m.position.y; pE[i * 3 + 2] = e.m.position.z;
          if (e.m.position.distanceTo(e.destino) < 0.3) { e.cae = false; chispas.soltar(e.destino, 16, 3); }
        } else e.m.position.y = e.destino.y + Math.sin(t * 3 + e.destino.x) * 0.15;
        if (jp && !e.cae && e.m.position.distanceTo(new THREE.Vector3(jp.x, jp.y + 0.8, jp.z)) < 1.3) { e.juntada = true; g.remove(e.m); chispas.soltar(e.m.position, 20, 4); juntadas++; }
      }
      /* la estela se apaga sola: se corren los puntos viejos abajo del piso */
      for (let k = 0; k < 3; k++) { const j = (iE + 1 + k) % nE; pE[j * 3 + 1] = -999; }
      estela.geometry.attributes.position.needsUpdate = true;
      chispas.actualizar(dt);
      if (sueno.activo) {
        sueno.t -= dt;
        cielo.U.uAurora.value = 1.6 + Math.sin(t * 2) * 0.6;
        UNI.uViento.value = 3;
        if (sueno.t <= 0) { sueno.activo = false; mundo.sueno = false; UNI.uViento.value = 1; }
      }
      return juntadas;
    },
  };
}
