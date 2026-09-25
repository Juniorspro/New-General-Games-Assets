/* ============================================================================
   aeroplaza/js/edificios.js — lo construido: la estación hexagonal de vidrio
   con techo de hojas y su tren, la tienda, el probador, faroles, bancos y
   carteles. Cada función agrega sus sólidos al mundo (para chocar y pisar) y
   devuelve el grupo para la escena.
   ========================================================================== */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { brilloso, JUGADOR } from './naturaleza.js';
import { Meeple, APARIENCIA_INICIAL } from './meeple.js';
import { modelo, instancias, tamDe, hay } from './modelos.js';

/* un cartel con texto dibujado (los generadores no escriben bien: se escribe acá) */
export function letrero(texto, { ancho = 4, alto = 1, fondo = '#ffffff', tinta = '#2a9d3a', borde = '#8fe070', tam = 88 } = {}) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * alto / ancho);
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, c.height); gr.addColorStop(0, fondo); gr.addColorStop(1, '#e8f4ff');
  g.fillStyle = gr; g.beginPath(); g.roundRect(8, 8, c.width - 16, c.height - 16, c.height * 0.3); g.fill();
  g.lineWidth = 14; g.strokeStyle = borde; g.stroke();
  /* el brillo de arriba, como los botones de 2007 */
  const b = g.createLinearGradient(0, 0, 0, c.height * 0.5); b.addColorStop(0, 'rgba(255,255,255,0.9)'); b.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = b; g.beginPath(); g.roundRect(24, 16, c.width - 48, c.height * 0.42, c.height * 0.2); g.fill();
  g.fillStyle = tinta; g.font = `800 ${tam * c.height / 256}px "Nunito","Arial Rounded MT Bold","Segoe UI",system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(texto, c.width / 2, c.height / 2 + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), new THREE.MeshStandardMaterial({ map: t, roughness: 0.3, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.25 }));
  return m;
}

/* los brillosos de la decoración, uno por color (así se pueden fundir) */
const _bri = new Map();
const bri = (c, o = {}) => { const k = c + JSON.stringify(o); if (!_bri.has(k)) _bri.set(k, brilloso(c, o)); return _bri.get(k); };
/* funde las piezas quietas de un grupo por material (una llamada por material en
   vez de una por pieza). Lo que se mueve no se pasa. Devuelve un grupo nuevo */
export function fundir(g) {
  g.updateMatrixWorld(true);
  const inv = g.matrixWorld.clone().invert(), porMat = new Map(), M = new THREE.Matrix4();
  g.traverse((o) => {
    if (!o.isMesh) return;
    const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(M.multiplyMatrices(inv, o.matrixWorld));
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    if (!porMat.has(o.material)) porMat.set(o.material, []);
    porMat.get(o.material).push(geo);
  });
  const R = new THREE.Group();
  for (const [mat, geos] of porMat) { const m = new THREE.Mesh(mergeGeometries(geos), mat); m.castShadow = !mat.transparent; m.receiveShadow = true; R.add(m); }
  return R;
}

/* ------------------------------------------------------------- la estación */
export function estacion(mundo, x, z, rot, alturaPiso) {
  const g = new THREE.Group(); g.position.set(x, alturaPiso, z); g.rotation.y = rot;
  const R = 6.5;
  const blanco = brilloso('#ffffff', { roughness: 0.15 });
  /* el pabellón octogonal (construcciones.js), con la entrada mirando a la plaza (-x local) */
  const M = modelo('estacion', { ancho: 2 * R + 1.4 });
  M.rotation.y = -Math.PI / 2; g.add(M);
  const anden = M.userData.anden;
  /* las vías: salen de la estación, cruzan el agua sobre pilotes y suben al cielo */
  const ida = (u) => new THREE.Vector3(R + 2 + u * 40, u * u * 18, Math.sin(u * 2) * 6);
  const pts = []; for (let i = 0; i <= 30; i++) pts.push(ida(i / 30 * 4 - 0.6));
  const curva = new THREE.CatmullRomCurve3(pts);
  for (const s of [-0.7, 0.7]) {
    const off = pts.map((p, i) => { const t = curva.getTangentAt(i / 30); const n = new THREE.Vector3(-t.z, 0, t.x).normalize(); return p.clone().addScaledVector(n, s).add(new THREE.Vector3(0, 0.55, 0)); });
    const riel = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(off), 160, 0.07, 6), brilloso('#dfe8f0', { metalness: 0.8, roughness: 0.2 })); g.add(riel);
  }
  for (let i = 1; i < 30; i += 2) {
    const p = pts[i]; if (p.y > 30) continue;
    const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, p.y + alturaPiso + 6, 10), blanco); pil.position.set(p.x, (p.y - alturaPiso - 6) / 2 + 0.3, p.z); g.add(pil);
    const trav = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.25, 2.2, 2, 0.08), blanco); trav.position.set(p.x, p.y + 0.4, p.z); g.add(trav);
  }
  /* el tren: el monorriel blanco con la franja de vidrio y la lima (construcciones.js) */
  const tren = new THREE.Group();
  const MT = modelo('tren', { ancho: 8.6 });
  MT.rotation.y = Math.PI / 2; MT.position.y = -1.45; tren.add(MT);
  const RT = M.userData.tam.x / 2 + 4.6;   // el vagón, al lado del pabellón (no adentro)
  tren.position.set(RT, 1.9, 0); g.add(tren);
  g.userData.tren = tren; g.userData.curva = curva;
  /* los sólidos, en coordenadas del mundo */
  const c = Math.cos(rot), s = Math.sin(rot);
  const aMundo = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  mundo.cilindro(x, z, M.userData.tam.x / 2 - 0.2, -5, alturaPiso + anden, { tipo: 'piedra' });
  /* el vidrio del pabellón: una ronda de postes invisibles sobre la pared, menos en la entrada (-x) */
  const rp = M.userData.pared;
  for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; if (Math.cos(a) < -0.8) continue; const [cx, cz] = aMundo(Math.cos(a) * rp, Math.sin(a) * rp); mundo.cilindro(cx, cz, 0.55, alturaPiso, alturaPiso + 4.5); }
  const [tx, tz] = aMundo(RT, 0);
  mundo.caja(tx, tz, 4, 1.3, alturaPiso, alturaPiso + 3.3, rot);
  const [px, pz] = aMundo(rp - 1.0, 0);
  g.userData.puntoTren = new THREE.Vector3(px, alturaPiso + anden, pz);
  return g;
}

/* el pabellón octogonal solo (sin vías ni tren): en el medio de la ciudad */
export function pabellon(mundo, x, z, rot, y, ancho = 14.4) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot;
  const M = modelo('estacion', { ancho }); M.rotation.y = -Math.PI / 2; g.add(M);
  const anden = M.userData.anden, rp = M.userData.pared, R = M.userData.tam.x / 2;
  const c = Math.cos(rot), s = Math.sin(rot), aMundo = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  /* el piso y un escalón (el piso queda más alto que un paso) */
  mundo.cilindro(x, z, R - 0.2, y - 5, y + anden, { tipo: 'piedra' });
  mundo.cilindro(x, z, R + 0.5, y - 5, y + anden * 0.5, { tipo: 'piedra' });
  for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; if (Math.cos(a) < -0.8) continue; const [cx, cz] = aMundo(Math.cos(a) * rp, Math.sin(a) * rp); mundo.cilindro(cx, cz, 0.55, y, y + 4.5); }
  const [ex, ez] = aMundo(-rp - 2, 0);
  g.userData.anden = anden; g.userData.entrada = new THREE.Vector3(ex, y, ez);
  return g;
}

/* ------------------------------------------------------ la tienda de afuera */
export function tiendaAfuera(mundo, x, z, rot, alturaPiso, nombre = 'AERO·MART') {
  let g = new THREE.Group(); g.position.set(x, alturaPiso, z); g.rotation.y = rot;
  /* la tienda blanca con caños verdes y el toldo en la puerta, a la derecha (construcciones.js) */
  const M = modelo('tienda', { ancho: 12 }); g.add(M);
  const { x: W, y: H, z: D } = M.userData.tam, puertaX = W * 0.2;
  const cartel = letrero(nombre, { ancho: 6.5, alto: 1.4, tinta: '#23a33a', borde: '#6fe07a' }); cartel.position.set(0, H + 0.6, D / 2 - 0.9); cartel.rotation.x = -0.1; g.add(cartel);
  const c = Math.cos(rot), s = Math.sin(rot), aMundo = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  mundo.caja(x, z, W / 2, D / 2, alturaPiso - 2, alturaPiso + H, rot, { tipo: 'piedra' });
  g.userData.puerta = new THREE.Vector3(x + puertaX * c + (D / 2 + 1.2) * s, alturaPiso, z - puertaX * s + (D / 2 + 1.2) * c);
  /* ---------------------------------------------- la decoración de afuera */
  /* lo quieto va a "quieto" y se funde al final; lo que se mueve (globos, banderines, maniquí) queda suelto */
  const vivos = [], blanco = bri('#ffffff'), verde = bri('#3fcf4f'), gFinal = g;
  const quieto = new THREE.Group(); g = quieto;
  /* dos maceteros con flores a los lados de la puerta */
  for (const sx of [-1, 1]) {
    const mx = puertaX + sx * 1.9, mz = D / 2 + 0.8;
    const mac = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.7, 0.8, 3, 0.2), blanco); mac.position.set(mx, 0.35, mz); g.add(mac);
    const fil = new THREE.Mesh(new RoundedBoxGeometry(1.14, 0.14, 0.84, 2, 0.06), verde); fil.position.set(mx, 0.62, mz); g.add(fil);
    for (let k = 0; k < 7; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.13 + (k % 3) * 0.03, 12, 8), bri(['#ff6fb0', '#ffffff', '#ffe14a', '#56e05a', '#ff9ad8', '#39d6ff', '#56e05a'][k], { roughness: 0.4 })); f.position.set(mx - 0.4 + (k % 4) * 0.27, 0.78 + (k % 2) * 0.1, mz - 0.18 + Math.floor(k / 4) * 0.34); g.add(f); }
    const [wx, wz] = aMundo(mx, mz); mundo.caja(wx, wz, 0.55, 0.4, alturaPiso - 1, alturaPiso + 0.7, rot);
  }
  /* globos atados al macetero de la derecha */
  ['#ff6fb0', '#39d6ff', '#ffe14a'].forEach((col, i) => {
    const gl = new THREE.Group(); gl.position.set(puertaX + 1.9 + (i - 1) * 0.25, 0.7, D / 2 + 0.8);
    const alto = 2.2 + i * 0.3, b = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 14), new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.15, clearcoat: 1 })); b.scale.y = 1.15; b.position.y = alto; gl.add(b);
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, alto - 0.35, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' })); h.position.y = (alto - 0.35) / 2; gl.add(h);
    gFinal.add(gl); vivos.push({ o: gl, f: i * 2.1, tipo: 'globo' });
  });
  /* banderines de colores del techo a un mástil, frente a la vidriera */
  { const px2 = -W / 2 - 1.2, pz2 = D / 2 + 3.2, mastil = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.6, 10), blanco); mastil.position.set(px2, 2.3, pz2); g.add(mastil);
    const bola = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), verde); bola.position.set(px2, 4.65, pz2); g.add(bola);
    const [mwx, mwz] = aMundo(px2, pz2); mundo.cilindro(mwx, mwz, 0.12, alturaPiso, alturaPiso + 4.6);
    const cuerda = new THREE.Group(); g.add(cuerda);   // (quietos: se funden con lo demás)
    const A0 = new THREE.Vector3(-W / 2 + 0.6, H - 0.6, D / 2 + 0.2), A1 = new THREE.Vector3(px2, 4.4, pz2), n = 11;
    const cols = ['#ff6fb0', '#39d6ff', '#ffe14a', '#56e05a', '#ffffff', '#9b7bff'];
    for (let i = 0; i <= n; i++) {
      const u = i / n, p = A0.clone().lerp(A1, u); p.y -= Math.sin(u * Math.PI) * 0.7;
      if (i < n) { const tri = new THREE.Shape(); tri.moveTo(-0.17, 0); tri.lineTo(0.17, 0); tri.lineTo(0, -0.4); tri.lineTo(-0.17, 0);
        const f = new THREE.Mesh(new THREE.ShapeGeometry(tri), bri(cols[i % cols.length], { side: THREE.DoubleSide, roughness: 0.5, borde: 0.1 })); f.position.copy(p); f.lookAt(p.x + (A1.z - A0.z), p.y, p.z - (A1.x - A0.x)); cuerda.add(f); }
    }
    const pts = []; for (let i = 0; i <= 24; i++) { const u = i / 24, p = A0.clone().lerp(A1, u); p.y -= Math.sin(u * Math.PI) * 0.7; pts.push(p); }
    cuerda.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.012, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' })));
  }
  /* el cartelito de pie con lo nuevo, y el maniquí frente a la vidriera */
  { const pie = new THREE.Group(); pie.position.set(puertaX - 0.2, 0, D / 2 + 3.0); pie.rotation.y = -0.3;
    for (const sz of [-1, 1]) { const tab = new THREE.Mesh(new RoundedBoxGeometry(0.9, 1.2, 0.05, 2, 0.04), blanco); tab.position.set(0, 0.6, sz * 0.2); tab.rotation.x = -sz * 0.18; pie.add(tab); }
    const ct = letrero('¡NUEVO! 🧢', { ancho: 0.8, alto: 0.5, tinta: '#ff3f9a', borde: '#ff9ad8', tam: 120 }); ct.position.set(0, 0.75, 0.25); ct.rotation.x = -0.18; pie.add(ct);
    g.add(pie); const [wx, wz] = aMundo(puertaX - 0.2, D / 2 + 3.0); mundo.cilindro(wx, wz, 0.45, alturaPiso, alturaPiso + 1.2); }
  { const vx = -2.3, vz = D / 2 + 1.1, ped = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.35, 24), blanco); ped.position.set(vx, 0.18, vz); g.add(ped);
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.85, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), materialVidrioTienda()); cup.scale.y = 2.2; cup.position.set(vx, 0.35, vz); g.add(cup);
    const m = new Meeple({ ...APARIENCIA_INICIAL(), motivo: 'ninguno', ojos: 'ninguno', color: '#ff9ad8', color2: '#ffffff', material: 'perla', sombrero: 'corona', espalda: 'alas', anteojos: 'visor' });
    m.raiz.position.set(vx, 0.35, vz); m.raiz.scale.setScalar(0.95); gFinal.add(m.raiz); vivos.push({ o: m, tipo: 'maniqui' });
    const [wx, wz] = aMundo(vx, vz); mundo.cilindro(wx, wz, 0.85, alturaPiso, alturaPiso + 2.2); }
  g = gFinal; g.add(fundir(quieto));
  g.userData.actualizar = (t, dt) => {
    for (const V of vivos) {
      if (V.tipo === 'globo') { V.o.rotation.x = Math.sin(t * 0.9 + V.f) * 0.1; V.o.rotation.z = Math.cos(t * 0.7 + V.f) * 0.1; }
      else if (V.tipo === 'bandera') V.o.rotation.x = Math.sin(t * 3 + V.f) * 0.25;
      else if (V.tipo === 'maniqui') {
        const d = Math.hypot(JUGADOR.x - x, JUGADOR.z - z); V.o.raiz.visible = d < 100; V.o.detalle(d < 32);
        if (d < 100) { V.o.raiz.rotation.y = t * 0.6; V.o.animar(dt, 'quieto', 0); }
      }
    }
  };
  return g;
}
let _vidrioTienda = null;
const materialVidrioTienda = () => _vidrioTienda || (_vidrioTienda = new THREE.MeshPhysicalMaterial({ color: '#e8fff0', roughness: 0.03, transparent: true, opacity: 0.16, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide }));

/* ------------------------------------------------------------- el probador */
export function probadorCabina(mundo, x, z, rot, alturaPiso) {
  const g = new THREE.Group(); g.position.set(x, alturaPiso, z); g.rotation.y = rot;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2, 0.3, 32), brilloso('#ffffff')); base.position.y = 0.15; g.add(base);
  const espejo = new THREE.Mesh(new THREE.CircleGeometry(1.1, 40), new THREE.MeshPhysicalMaterial({ color: '#dff7ff', metalness: 1, roughness: 0.02, envMapIntensity: 2 }));
  espejo.position.set(0, 2.2, -1.2); g.add(espejo);
  const marco = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.12, 12, 48), brilloso('#ff8fd0')); marco.position.copy(espejo.position); g.add(marco);
  const pata = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.2, 10), brilloso('#ffffff')); pata.position.set(0, 0.85, -1.25); g.add(pata);
  const arco = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.1, 10, 40, Math.PI), brilloso('#7fd6ff')); arco.position.y = 0.3; g.add(arco);
  const cartel = letrero('✂  👕  ✨', { ancho: 2.2, alto: 0.6, tinta: '#d0409a', borde: '#ff8fd0' }); cartel.position.set(0, 3.6, -1.2); g.add(cartel);
  mundo.cilindro(x, z, 2, alturaPiso - 1, alturaPiso + 0.3);
  /* el espejo con su marco y la pata: se cruzaba el espejo caminando */
  const ex = x - Math.sin(rot) * 1.22, ez = z - Math.cos(rot) * 1.22;
  mundo.caja(ex, ez, 1.28, 0.14, alturaPiso + 0.25, alturaPiso + 3.5, rot);
  return g;
}

/* ------------------------------------------------------ faroles y bancos */
export function farol(mundo, x, z, y) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const M = modelo('farol', { alto: 3.7 }); g.add(M);
  const arriba = M.userData.bocha, r = M.userData.radio;
  /* la bocha: una cáscara apenas más grande que brilla de noche */
  const luz = new THREE.Mesh(new THREE.SphereGeometry(r * 1.12, 20, 14), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#bff4ff', emissiveIntensity: 0.3, roughness: 0.1, transparent: true, opacity: 0.35, depthWrite: false }));
  luz.position.copy(arriba); luz.userData.op0 = luz.material.opacity; g.add(luz);
  g.userData.luz = luz;
  mundo.cilindro(x, z, 0.15, y, y + 3.2);
  return g;
}
/* muchos faroles juntos: una llamada por material para todos, y las bochas (que se
   prenden de noche) en otra. lugares: [[x, z, y]]. Devuelve el grupo; su luz en userData.luz */
export function faroles(mundo, lugares) {
  const g = new THREE.Group(), M = modelo('farol', { alto: 3.7 }), k = M.userData.k, arriba = M.userData.bocha, r = M.userData.radio;
  /* alcance (detalle.js): en alta no se corta nada y los 43 faroles de la isla eran 98 mil triángulos
     desde cualquier lado; más allá de 160 m miden un par de píxeles. El halo sí se ve de lejos */
  const cuerpo = instancias('farol', lugares.map(([x, z, y]) => [x, y, z, 1, 0]), { alto: 3.7 }); cuerpo.traverse((o) => { if (o.isInstancedMesh) o.userData.alcance = 160; }); g.add(cuerpo);
  const luz = new THREE.InstancedMesh(new THREE.SphereGeometry(r * 1.12, 14, 10), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#bff4ff', emissiveIntensity: 0.3, roughness: 0.1, transparent: true, opacity: 0.35, depthWrite: false }), lugares.length);
  const T = new THREE.Matrix4();
  lugares.forEach(([x, z, y], i) => { luz.setMatrixAt(i, T.makeTranslation(x + arriba.x, y + arriba.y, z + arriba.z)); mundo.cilindro(x, z, 0.15, y, y + 3.2); });
  luz.computeBoundingSphere(); luz.userData.op0 = 0.35; g.add(luz);
  g.userData.luz = luz; g.userData.k = k;
  return g;
}
/* muchos bancos juntos (una llamada por material). lugares: [[x, z, y, giro]] */
export function bancos(mundo, lugares, ancho = 2.1) {
  const T = tamDe('banco'), k = ancho / Math.max(T.x, T.z), asiento = modelo('banco', { ancho }).userData.asiento;
  for (const [x, z, y, rot] of lugares) mundo.caja(x, z, 1, 0.33, y, y + asiento, rot, { asiento: true });
  const I = instancias('banco', lugares.map(([x, z, y, rot]) => [x, y, z, 1, rot]), { alto: T.y * k });
  I.traverse((o) => { if (o.isInstancedMesh) o.userData.alcance = 90; });   // (un banco a más de 90 m no se distingue)
  return I;
}
export function banco(mundo, x, z, y, rot) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot;
  const M = modelo('banco', { ancho: 2.1 }); g.add(M);
  const asiento = M.userData.asiento;
  mundo.caja(x, z, 1, 0.33, y, y + asiento, rot, { asiento: true });
  return g;
}
