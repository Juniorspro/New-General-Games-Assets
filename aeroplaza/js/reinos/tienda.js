/* ============================================================================
   aeroplaza/js/reinos/tienda.js — adentro de Aero·Mart: piso de baldosas
   verdes y blancas, caños verdes brillosos por el techo, vitrinas con cosas
   girando en pedestales de luz y Menta atrás del mostrador.
   ========================================================================== */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Mundo } from '../mundo.js';
import { brilloso, materialVidrio, materialBurbuja } from '../naturaleza.js';
import { pecera } from '../objetos.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { letrero } from '../edificios.js';
import { Meeple, APARIENCIA_INICIAL } from '../meeple.js';

export function crearTienda() {
  const W = 22, D = 16, H = 6;
  const mundo = new Mundo(() => 0); mundo.agua = null; mundo.limite = 30;
  const g = new THREE.Group();
  /* el piso de damero */
  const c = document.createElement('canvas'); c.width = c.height = 256; const q = c.getContext('2d');
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { q.fillStyle = (i + j) % 2 ? '#ffffff' : '#bff0c8'; q.fillRect(i * 64, j * 64, 64, 64); }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(W / 4, D / 4); tex.colorSpace = THREE.SRGBColorSpace;
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.15, metalness: 0 })); piso.receiveShadow = true; g.add(piso);
  const paredM = new THREE.MeshStandardMaterial({ color: '#f2fff4', roughness: 0.5, side: THREE.BackSide });
  const caja = new THREE.Mesh(new RoundedBoxGeometry(W, H * 2, D, 4, 1.2), paredM); caja.position.y = H - 0.01; g.add(caja);
  /* el zócalo verde: cuatro tiras (una caja entera tapaba el piso con su cara de abajo) */
  const matZ = new THREE.MeshStandardMaterial({ color: '#3fcf4f', roughness: 0.3 });
  for (const [x, z, w, r] of [[0, -D / 2 + 0.12, W, 0], [0, D / 2 - 0.12, W, Math.PI], [-W / 2 + 0.12, 0, D, Math.PI / 2], [W / 2 - 0.12, 0, D, -Math.PI / 2]]) { const z2 = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.5), matZ); z2.position.set(x, 0.25, z); z2.rotation.y = r; g.add(z2); }
  /* los caños del techo */
  const caño = brilloso('#34c25a', { roughness: 0.12, metalness: 0.35 });
  for (let i = 0; i < 4; i++) {
    const z = -D / 2 + 2 + i * 4;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, W - 1, 16), caño); t.rotation.z = Math.PI / 2; t.position.set(0, H - 0.6 - (i % 2) * 0.5, z); g.add(t);
    for (const s of [-1, 1]) { const codo = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.22, 10, 16, Math.PI / 2), caño); codo.position.set(s * (W / 2 - 1), H - 1.1 - (i % 2) * 0.5, z); codo.rotation.set(0, 0, s > 0 ? 0 : Math.PI / 2); g.add(codo); }
  }
  /* luces del techo: paneles que brillan */
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const l = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff' })); l.position.set(-6 + i * 6, H - 0.05, -3 + j * 6); g.add(l); }
  const luz = new THREE.PointLight('#fffbe8', 30, 30, 1.6); luz.position.set(0, H - 1, 0); g.add(luz);
  const cartel = letrero('AERO·MART', { ancho: 7, alto: 1.4, tinta: '#23a33a', borde: '#6fe07a' }); cartel.position.set(0, H - 1.6, -D / 2 + 0.3); g.add(cartel);
  /* el mostrador y Menta */
  const mostrador = new THREE.Mesh(new RoundedBoxGeometry(7, 1.1, 1.4, 4, 0.4), brilloso('#ffffff')); mostrador.position.set(0, 0.55, -D / 2 + 3); mostrador.castShadow = true; g.add(mostrador);
  const franja = new THREE.Mesh(new RoundedBoxGeometry(7.05, 0.25, 1.45, 3, 0.1), brilloso('#3fcf4f')); franja.position.set(0, 0.85, -D / 2 + 3); g.add(franja);
  mundo.caja(0, -D / 2 + 3, 3.5, 0.7, 0, 1.1);
  /* las vitrinas: pedestales con una cosa que gira (se eligen de lo que se vende) */
  const pedestales = [];
  const muestras = [['sombrero', 'corona'], ['espalda', 'alas'], ['anteojos', 'visor'], ['material', 'neon'], ['sombrero', 'galera'], ['peinado', 'nube'], ['particulas', 'estrellas'], ['sombrero', 'casco']];
  muestras.forEach(([ranura, valor], i) => {
    const lado = i < 4 ? -1 : 1, k = i % 4, x = lado * (W / 2 - 2.2), z = -D / 2 + 5 + k * 3;
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 1, 24), brilloso('#ffffff')); ped.position.set(x, 0.5, z); g.add(ped);
    const luzP = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.05, 24), new THREE.MeshBasicMaterial({ color: '#bfffd0' })); luzP.position.set(x, 1.03, z); g.add(luzP);
    const vit = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.6, 24, 1, true), materialVidrio('#e8fff0', 0.12)); vit.position.set(x, 1.85, z); g.add(vit);
    /* un maniquí chiquito con la cosa puesta */
    const A = { ...APARIENCIA_INICIAL(), color: '#e8f4ff', color2: '#ffffff', motivo: 'ninguno', material: ranura === 'material' ? valor : 'perla', [ranura]: valor };
    const m = new Meeple(A); m.raiz.scale.setScalar(0.62); m.raiz.position.set(x, 1.05, z); m.raiz.rotation.y = -lado * Math.PI / 2; g.add(m.raiz);
    pedestales.push({ m, ranura, valor });
    mundo.cilindro(x, z, 0.8, 0, 1.05);
  });
  /* ---------------------------------------------------------- la decoración */
  const blanco = brilloso('#ffffff'), cromo = new THREE.MeshStandardMaterial({ color: '#eef4f8', metalness: 1, roughness: 0.12 });
  const COL = ['#ff6fb0', '#39d6ff', '#56e05a', '#ffe14a', '#9b7bff', '#ff7a3d', '#3fffd0', '#ffffff'];
  const vivos = [];   // lo que se mueve: remeras, globos, lámparas
  /* dos percheros de cromo con remeritas de colores que se hamacan */
  for (const [px, pz] of [[-3.2, 1.2], [3.2, 1.2]]) {
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 10), cromo); p.position.set(px + s * 1.3, 0.9, pz); g.add(p); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.06, 20), cromo); b.position.set(px + s * 1.3, 0.03, pz); g.add(b); }
    const barra = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.7, 10), cromo); barra.rotation.z = Math.PI / 2; barra.position.set(px, 1.78, pz); g.add(barra);
    for (let i = 0; i < 7; i++) {
      const r = new THREE.Group(); r.position.set(px - 1.05 + i * 0.35, 1.76, pz);
      const gan = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 16, Math.PI), cromo); gan.rotation.z = Math.PI; gan.position.y = -0.05; r.add(gan);
      const rem = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.7, 0.55, 2, 0.04), brilloso(COL[(i * 3 + (px > 0 ? 1 : 0)) % COL.length], { roughness: 0.5, borde: 0.2 })); rem.position.y = -0.46; r.add(rem);
      for (const s of [-1, 1]) { const m = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.2, 0.22, 2, 0.03), rem.material); m.position.set(0, -0.2, s * 0.34); m.rotation.x = s * 0.5; r.add(m); }
      g.add(r); vivos.push({ o: r, tipo: 'remera', f: i + px });
    }
    mundo.caja(px, pz, 1.5, 0.35, 0, 1.9);
  }
  /* el sombrerero: un árbol de cromo con sombreros colgados */
  { const x = 6.8, z = 4.8; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.1, 12), cromo); p.position.set(x, 1.05, z); g.add(p);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 0.08, 24), cromo); b.position.set(x, 0.04, z); g.add(b);
    ['#e8b04a', '#ff5fa2', '#39d6ff', '#ffffff'].forEach((c, i) => { const a = i / 4 * Math.PI * 2, gancho = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 6), cromo); gancho.position.set(x + Math.cos(a) * 0.15, 1.85, z + Math.sin(a) * 0.15); gancho.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); g.add(gancho);
      const ala = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.27, 0.02, 24), brilloso(c)), copa = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.2, 20), brilloso(c));
      const h = new THREE.Group(); h.add(ala, copa); copa.position.y = 0.1; h.position.set(x + Math.cos(a) * 0.36, 1.92 - (i % 2) * 0.1, z + Math.sin(a) * 0.36); h.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4); g.add(h); });
    mundo.cilindro(x, z, 0.4, 0, 2.1); }
  /* los estantes del fondo, con remeras dobladas en pilas y plantitas */
  for (const s of [-1, 1]) {
    const x0 = s * 6.4;
    for (let k = 0; k < 3; k++) { const e = new THREE.Mesh(new RoundedBoxGeometry(3.4, 0.08, 0.6, 2, 0.03), blanco); e.position.set(x0, 1.3 + k * 0.85, -D / 2 + 0.45); g.add(e); }
    for (const sx of [-1, 1]) { const l = new THREE.Mesh(new RoundedBoxGeometry(0.08, 2.6, 0.6, 2, 0.03), blanco); l.position.set(x0 + sx * 1.7, 1.3 + 0.85, -D / 2 + 0.45); g.add(l); }
    const pilas = [];
    for (let k = 0; k < 3; k++) for (let j = 0; j < 4; j++) {
      if ((j + k) % 4 === 3) continue;
      for (let n = 0; n < 3; n++) { const q = new RoundedBoxGeometry(0.62, 0.09, 0.42, 2, 0.03); q.translate(x0 - 1.2 + j * 0.8, 1.39 + k * 0.85 + n * 0.095, -D / 2 + 0.45); const c3 = new THREE.Color(COL[(j + k * 2 + n + (s > 0 ? 3 : 0)) % COL.length]); const nC = q.attributes.position.count, cc = new Float32Array(nC * 3); for (let v = 0; v < nC; v++) cc.set([c3.r, c3.g, c3.b], v * 3); q.setAttribute('color', new THREE.BufferAttribute(cc, 3)); pilas.push(q); }
    }
    g.add(new THREE.Mesh(mergeGeometries(pilas), brilloso('#ffffff', { vertexColors: true, roughness: 0.6, borde: 0.15 })));
    for (const k of [0, 2]) { const mac = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.25, 16), brilloso('#3fcf4f')); mac.position.set(x0 + 1.2, 1.46 + k * 0.85, -D / 2 + 0.45); g.add(mac); const pl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), brilloso('#56e05a', { roughness: 0.4 })); pl.position.set(x0 + 1.2, 1.72 + k * 0.85, -D / 2 + 0.45); g.add(pl); }
  }
  /* la caja registradora sobre el mostrador, con pantalla aqua, y una pecera */
  { const reg = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.45, 0.55, 3, 0.1), brilloso('#ffffff')); reg.position.set(2.2, 1.33, -D / 2 + 3); g.add(reg);
    const pan = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.4, 0.06, 2, 0.05), new THREE.MeshBasicMaterial({ color: '#8ff4ff' })); pan.position.set(2.2, 1.72, -D / 2 + 2.95); pan.rotation.x = -0.25; g.add(pan);
    const pz = pecera(-2.5, 1.1, -D / 2 + 3, 0.6); pz.scale.setScalar(0.6); g.add(pz); vivos.push({ o: pz, tipo: 'pecera' }); }
  /* el racimo de globos junto al mostrador (se mecen) */
  { const x = 4.6, z = -D / 2 + 2.6; const hilos = [];
    ['#ff6fb0', '#39d6ff', '#ffe14a', '#56e05a', '#ffffff'].forEach((c, i) => {
      const gl = new THREE.Group(); const a = i / 5 * Math.PI * 2, alto = 2.7 + (i % 3) * 0.35; gl.position.set(x + Math.cos(a) * 0.35, 0, z + Math.sin(a) * 0.35);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.15, clearcoat: 1, sheen: 0.5 })); b.scale.y = 1.15; b.position.y = alto; gl.add(b);
      const nudo = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.08, 8), b.material); nudo.position.y = alto - 0.36; nudo.rotation.x = Math.PI; gl.add(nudo);
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, alto - 0.4, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' })); h.position.y = (alto - 0.4) / 2 + 0.05; gl.add(h);
      g.add(gl); vivos.push({ o: gl, tipo: 'globo', f: i * 1.7 });
    });
    const peso = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.2, 0.3, 2, 0.06), brilloso('#ff5fa2')); peso.position.set(x, 0.1, z); g.add(peso); }
  /* la alfombra redonda del medio */
  { const c2 = document.createElement('canvas'); c2.width = c2.height = 256; const q2 = c2.getContext('2d');
    for (let i = 8; i > 0; i--) { q2.fillStyle = i % 2 ? '#8fe6ff' : '#ffffff'; q2.beginPath(); q2.arc(128, 128, i * 16, 0, 7); q2.fill(); }
    const tx = new THREE.CanvasTexture(c2); tx.colorSpace = THREE.SRGBColorSpace;
    const alf = new THREE.Mesh(new THREE.CircleGeometry(2.4, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.9 })); alf.position.set(0, 0.01, 1.5); alf.receiveShadow = true; g.add(alf); }
  /* dos maniquíes de tamaño natural en la entrada, con lo nuevo de la isla */
  for (const [x, A2] of [[-2.2, { sombrero: 'capitan', anteojos: 'sol', color: '#1d4fbf', color2: '#ffffff', material: 'perla' }], [2.2, { sombrero: 'explorador', espalda: 'molinete', color: '#ffb13d', color2: '#fff6c2', material: 'gelatina' }]]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.18, 24), blanco); b.position.set(x, 0.09, D / 2 - 2.4); g.add(b);
    const m = new Meeple({ ...APARIENCIA_INICIAL(), motivo: 'ninguno', ojos: 'ninguno', ...A2 }); m.raiz.position.set(x, 0.18, D / 2 - 2.4); m.raiz.rotation.y = Math.PI + (x > 0 ? -0.4 : 0.4); g.add(m.raiz);
    vivos.push({ o: m, tipo: 'maniqui' }); mundo.cilindro(x, D / 2 - 2.4, 0.55, 0, 0.18);
  }
  /* el cartel de neón rosa de la pared izquierda y el espejo grande de la derecha */
  { const neon = letrero('✨ ¡NUEVO! ✨', { ancho: 3.6, alto: 0.9, tinta: '#ff3f9a', borde: '#ff9ad8', tam: 110 }); neon.material.emissiveIntensity = 0.7; neon.position.set(-W / 2 + 0.08, 3.3, 1.5); neon.rotation.y = Math.PI / 2; g.add(neon); vivos.push({ o: neon, tipo: 'neon' });
    const esp = new THREE.Mesh(new THREE.CircleGeometry(1.1, 40), new THREE.MeshPhysicalMaterial({ color: '#dff7ff', metalness: 1, roughness: 0.03, envMapIntensity: 2 })); esp.scale.y = 1.5; esp.position.set(W / 2 - 0.08, 2.2, 1.5); esp.rotation.y = -Math.PI / 2; g.add(esp);
    const marco = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.09, 10, 48), brilloso('#ff8fd0')); marco.scale.y = 1.5; marco.position.copy(esp.position); marco.rotation.y = -Math.PI / 2; g.add(marco); }
  /* lámparas burbuja colgando del techo */
  for (let i = 0; i < 4; i++) { const l = new THREE.Group(); l.position.set(-4.5 + i * 3, H - 0.4, 4.2); const hilo = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.4, 4), cromo); hilo.position.y = -0.7; l.add(hilo);
    const bola = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), materialBurbuja(1)); bola.position.y = -1.6; l.add(bola); const foco = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff1c2' })); foco.position.y = -1.6; l.add(foco);
    g.add(l); vivos.push({ o: l, tipo: 'lampara', f: i }); }
  /* plantas grandes en las esquinas */
  for (const [x, z] of [[-W / 2 + 1, -D / 2 + 1], [W / 2 - 1, -D / 2 + 1], [-W / 2 + 1, D / 2 - 1], [W / 2 - 1, D / 2 - 1]]) {
    const m2 = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.35, 0.7, 20), brilloso('#ffffff')); m2.position.set(x, 0.35, z); g.add(m2);
    for (let k = 0; k < 5; k++) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.36 - k * 0.03, 14, 10), brilloso(k % 2 ? '#3fb536' : '#56e05a', { roughness: 0.4 })); h.position.set(x + Math.cos(k * 2.3) * 0.25, 0.95 + k * 0.28, z + Math.sin(k * 2.3) * 0.25); g.add(h); }
    mundo.cilindro(x, z, 0.5, 0, 0.7);
  }

  /* la puerta de salida */
  const puerta = new THREE.Mesh(new RoundedBoxGeometry(2.2, 3, 0.2, 3, 0.3), new THREE.MeshPhysicalMaterial({ color: '#dff9ff', roughness: 0.02, transparent: true, opacity: 0.85, emissive: '#bff0ff', emissiveIntensity: 0.6 }));
  puerta.position.set(0, 1.5, D / 2 - 0.15); g.add(puerta);
  /* paredes */
  mundo.caja(0, -D / 2 - 0.5, W / 2, 0.5, -1, H); mundo.caja(0, D / 2 + 0.5, W / 2, 0.5, -1, H);
  mundo.caja(-W / 2 - 0.5, 0, 0.5, D / 2, -1, H); mundo.caja(W / 2 + 0.5, 0, 0.5, D / 2, -1, H);
  mundo.interactivo({ id: 'salida', pos: new THREE.Vector3(0, 0, D / 2 - 1.2), radio: 2.2, accion: 'salir_tienda', icono: '🚪' });
  pedestales.forEach((p, i) => mundo.interactivo({ id: 'vitrina', pos: new THREE.Vector3(p.m.raiz.position.x * 0.8, 0, p.m.raiz.position.z), radio: 2, accion: 'comprar', icono: '🛍️', ranura: p.ranura, valor: p.valor }));
  const npcs = [{ id: 'vendedora', pos: [0, -D / 2 + 1.8], rot: 0, y: 0 }];
  let t = 0;
  return {
    id: 'tienda', mundo, grupo: g, inicio: new THREE.Vector3(0, 0, D / 2 - 3.5), rumboInicio: Math.PI, caja: [-W / 2 + 0.6, W / 2 - 0.6, -D / 2 + 0.6, D / 2 - 0.6, H - 0.8], musica: 'ciudad', interior: true, cielo: { hora: 0.5, aurora: 0, nubes: 0, interior: true },
    npcs, discos: [], orbes: null,
    actualizar(dt) {
      t += dt; pedestales.forEach((p, i) => { p.m.raiz.rotation.y += dt * 0.8; p.m.animar(dt, 'quieto', 0); });
      for (const V of vivos) {
        if (V.tipo === 'remera') V.o.rotation.x = Math.sin(t * 1.3 + V.f) * 0.05;
        else if (V.tipo === 'globo') { V.o.rotation.x = Math.sin(t * 0.9 + V.f) * 0.06; V.o.rotation.z = Math.cos(t * 0.7 + V.f) * 0.06; V.o.position.y = Math.sin(t * 1.1 + V.f) * 0.05; }
        else if (V.tipo === 'lampara') V.o.rotation.z = Math.sin(t * 0.8 + V.f) * 0.04;
        else if (V.tipo === 'pecera') V.o.userData.actualizar(t);
        else if (V.tipo === 'maniqui') V.o.animar(dt, 'quieto', 0);
        else if (V.tipo === 'neon') V.o.material.emissiveIntensity = 0.55 + (Math.sin(t * 9) > 0.93 ? -0.4 : 0) + Math.sin(t * 2) * 0.1;
      }
    },
  };
}
