/* ============================================================================
   aeroplaza/js/edificios.js — lo construido: la estación hexagonal de vidrio
   con techo de hojas y su tren, la tienda, el probador, faroles, bancos y
   carteles. Cada función agrega sus sólidos al mundo (para chocar y pisar) y
   devuelve el grupo para la escena.
   ========================================================================== */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { brilloso } from './naturaleza.js';
import { modelo } from './modelos.js';

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

/* ------------------------------------------------------ la tienda de afuera */
export function tiendaAfuera(mundo, x, z, rot, alturaPiso, nombre = 'AERO·MART') {
  const g = new THREE.Group(); g.position.set(x, alturaPiso, z); g.rotation.y = rot;
  /* la tienda blanca con caños verdes y el toldo en la puerta, a la derecha (construcciones.js) */
  const M = modelo('tienda', { ancho: 12 }); g.add(M);
  const { x: W, y: H, z: D } = M.userData.tam, puertaX = W * 0.2;
  const cartel = letrero(nombre, { ancho: 6.5, alto: 1.4, tinta: '#23a33a', borde: '#6fe07a' }); cartel.position.set(0, H + 0.6, D / 2 - 0.9); cartel.rotation.x = -0.1; g.add(cartel);
  const c = Math.cos(rot), s = Math.sin(rot);
  mundo.caja(x, z, W / 2, D / 2, alturaPiso - 2, alturaPiso + H, rot, { tipo: 'piedra' });
  g.userData.puerta = new THREE.Vector3(x + puertaX * c + (D / 2 + 1.2) * s, alturaPiso, z - puertaX * s + (D / 2 + 1.2) * c);
  return g;
}

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
export function banco(mundo, x, z, y, rot) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot;
  const M = modelo('banco', { ancho: 2.1 }); g.add(M);
  const asiento = M.userData.asiento;
  mundo.caja(x, z, 1, 0.33, y, y + asiento, rot, { asiento: true });
  return g;
}
