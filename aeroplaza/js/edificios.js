/* ============================================================================
   aeroplaza/js/edificios.js — lo construido: la estación hexagonal de vidrio
   con techo de hojas y su tren, la tienda, el probador, faroles, bancos y
   carteles. Cada función agrega sus sólidos al mundo (para chocar y pisar) y
   devuelve el grupo para la escena.
   ========================================================================== */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { brilloso, materialVidrio, UNI } from './naturaleza.js';

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
  const blanco = brilloso('#ffffff', { roughness: 0.15 }), verde = brilloso('#45d05a', { roughness: 0.3, borde: 0.4 });
  const piso = new THREE.Mesh(new THREE.CylinderGeometry(R, R + 0.3, 0.5, 6), brilloso('#eef7ff', { roughness: 0.3 })); piso.position.y = 0.25; piso.receiveShadow = true; piso.castShadow = true; g.add(piso);
  const anillo = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.6, R - 0.6, 0.52, 6), brilloso('#bfe9ff', { roughness: 0.2 })); anillo.position.y = 0.26; g.add(anillo);
  /* seis columnas y los vidrios (menos la entrada y el lado del tren) */
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + Math.PI / 6;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 4.4, 12), blanco); col.position.set(Math.cos(a) * (R - 0.3), 2.7, Math.sin(a) * (R - 0.3)); col.castShadow = true; g.add(col);
    if (i === 1 || i === 4) continue;
    const b = (i + 0.5) / 6 * Math.PI * 2 + Math.PI / 6, L = (R - 0.3);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(L, 3.6), materialVidrio('#dff9ff', 0.2)); v.material.side = THREE.DoubleSide;
    v.position.set(Math.cos(b) * L * 0.866, 2.5, Math.sin(b) * L * 0.866); v.rotation.y = -b + Math.PI / 2; v.renderOrder = 4; g.add(v);
  }
  /* el techo: una losa de vidrio verdoso y encima un colchón de hojas */
  const techo = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.4, R + 0.4, 0.25, 6), new THREE.MeshPhysicalMaterial({ color: '#b8ffd0', transparent: true, opacity: 0.55, roughness: 0.05, clearcoat: 1, depthWrite: false })); techo.position.y = 5; g.add(techo);
  const marco = new THREE.Mesh(new THREE.TorusGeometry(R + 0.4, 0.15, 8, 6), blanco); marco.rotation.x = Math.PI / 2; marco.rotation.z = Math.PI / 6; marco.position.y = 5; g.add(marco);
  for (let i = 0; i < 26; i++) {
    const a = i * 2.39996, d = Math.sqrt(i / 26) * (R - 0.4);
    const h = new THREE.Mesh(new THREE.SphereGeometry(1.25 - d * 0.08, 16, 10), verde);
    h.scale.set(1, 0.55, 1); h.position.set(Math.cos(a) * d, 5.35 + (1 - d / R) * 0.8, Math.sin(a) * d); h.castShadow = true; g.add(h);
  }
  /* un banco y el tablero */
  const banco = new THREE.Mesh(new RoundedBoxGeometry(2.4, 0.3, 0.7, 3, 0.12), brilloso('#7fd6ff')); banco.position.set(-1.8, 0.95, -2.2); banco.rotation.y = 0.5; g.add(banco);
  const tablero = letrero('🚆  ✦  ✦  ✦', { ancho: 3, alto: 0.9, tinta: '#1a78c2', borde: '#7fd3ff' }); tablero.position.set(0, 4.1, -R * 0.8); g.add(tablero);
  g.userData.tablero = tablero;
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
  /* el tren: un vagón redondo blanco con franja verde */
  const tren = new THREE.Group();
  const cuerpo = new THREE.Mesh(new THREE.CapsuleGeometry(1.35, 5.2, 10, 24), brilloso('#ffffff', { roughness: 0.12, borde: 0.35 })); cuerpo.rotation.z = Math.PI / 2; cuerpo.scale.set(1.05, 1, 0.9); cuerpo.castShadow = true; tren.add(cuerpo);
  const franja = new THREE.Mesh(new THREE.CapsuleGeometry(1.37, 5.2, 6, 24), brilloso('#3fcf4f')); franja.rotation.z = Math.PI / 2; franja.scale.set(0.3, 1, 0.905); franja.position.y = -0.62; tren.add(franja);
  const vidrioT = new THREE.MeshPhysicalMaterial({ color: '#1d5fa8', roughness: 0.02, metalness: 0.3, clearcoat: 1, emissive: '#2d8fff', emissiveIntensity: 0.15 });
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.5, 4, 12), vidrioT); w.rotation.z = Math.PI / 2; w.scale.set(1.25, 1, 0.25); w.position.set(-2.4 + i * 1.2, 0.35, s * 1.18); tren.add(w);
  }
  const faro = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 10), new THREE.MeshBasicMaterial({ color: '#fffbe0' })); faro.position.set(3.95, 0.2, 0); tren.add(faro);
  tren.position.set(R + 2, 1.9, 0); g.add(tren);
  g.userData.tren = tren; g.userData.curva = curva;
  /* los sólidos, en coordenadas del mundo */
  const c = Math.cos(rot), s = Math.sin(rot);
  const aMundo = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  mundo.cilindro(x, z, R, -5, alturaPiso + 0.5, { tipo: 'piedra' });
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; const [cx, cz] = aMundo(Math.cos(a) * (R - 0.3), Math.sin(a) * (R - 0.3)); mundo.cilindro(cx, cz, 0.25, alturaPiso, alturaPiso + 5); }
  const [tx, tz] = aMundo(R + 2, 0);
  mundo.caja(tx, tz, 4, 1.3, alturaPiso, alturaPiso + 3.3, rot);
  const [px, pz] = aMundo(R - 1.2, 0);
  g.userData.puntoTren = new THREE.Vector3(px, alturaPiso + 0.5, pz);
  return g;
}

/* ------------------------------------------------------ la tienda de afuera */
export function tiendaAfuera(mundo, x, z, rot, alturaPiso, nombre = 'AERO·MART') {
  const g = new THREE.Group(); g.position.set(x, alturaPiso, z); g.rotation.y = rot;
  const W = 11, H = 5.5, D = 8;
  const casa = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 4, 1.2), brilloso('#ffffff', { roughness: 0.18 })); casa.position.y = H / 2; casa.castShadow = true; casa.receiveShadow = true; g.add(casa);
  const banda = new THREE.Mesh(new RoundedBoxGeometry(W + 0.1, 0.6, D + 0.1, 3, 0.3), brilloso('#3fcf4f')); banda.position.y = 1; g.add(banda);
  const vitrina = new THREE.Mesh(new RoundedBoxGeometry(W * 0.7, H * 0.52, 0.3, 3, 0.14), new THREE.MeshPhysicalMaterial({ color: '#a8e8ff', roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.7, emissive: '#6fd0ff', emissiveIntensity: 0.25 }));
  vitrina.position.set(0, H * 0.52, D / 2 + 0.02); g.add(vitrina);
  const puerta = new THREE.Mesh(new RoundedBoxGeometry(1.8, 2.8, 0.4, 3, 0.3), new THREE.MeshPhysicalMaterial({ color: '#dff9ff', roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.85, emissive: '#bff0ff', emissiveIntensity: 0.4 }));
  puerta.position.set(0, 1.4, D / 2 + 0.12); g.add(puerta);
  const toldo = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, W * 0.8, 24, 1, false, 0, Math.PI), brilloso('#6fe07a')); toldo.rotation.z = Math.PI / 2; toldo.scale.set(1, 1, 0.8); toldo.position.set(0, H * 0.84, D / 2 + 0.3); g.add(toldo);
  const cartel = letrero(nombre, { ancho: 6.5, alto: 1.4, tinta: '#23a33a', borde: '#6fe07a' }); cartel.position.set(0, H + 0.6, D / 2 - 0.9); cartel.rotation.x = -0.1; g.add(cartel);
  /* los caños verdes de afuera */
  const caño = brilloso('#34c25a', { roughness: 0.15, metalness: 0.3 });
  const curva = new THREE.CatmullRomCurve3([new THREE.Vector3(-W / 2 - 0.3, 0, 2), new THREE.Vector3(-W / 2 - 0.3, H - 1, 2), new THREE.Vector3(-W / 2 + 1, H + 0.4, 1), new THREE.Vector3(0, H + 0.3, -1.5), new THREE.Vector3(W / 2 - 1, H + 0.4, -2)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curva, 40, 0.22, 10), caño));
  const c = Math.cos(rot), s = Math.sin(rot);
  mundo.caja(x, z, W / 2, D / 2, alturaPiso - 2, alturaPiso + H, rot, { tipo: 'piedra' });
  g.userData.puerta = new THREE.Vector3(x + (D / 2 + 1.2) * s, alturaPiso, z + (D / 2 + 1.2) * c);
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
  const pie = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 3.2, 10), brilloso('#ffffff')); pie.position.y = 1.6; pie.castShadow = true; g.add(pie);
  const luz = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#bff4ff', emissiveIntensity: 0.3, roughness: 0.1, transparent: true, opacity: 0.9 }));
  luz.position.y = 3.35; g.add(luz);
  g.userData.luz = luz;
  mundo.cilindro(x, z, 0.15, y, y + 3.2);
  return g;
}
export function banco(mundo, x, z, y, rot) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot;
  const asiento = new THREE.Mesh(new RoundedBoxGeometry(2, 0.22, 0.65, 3, 0.1), brilloso('#7fd6ff')); asiento.position.y = 0.5; asiento.castShadow = true; g.add(asiento);
  const resp = new THREE.Mesh(new RoundedBoxGeometry(2, 0.6, 0.14, 3, 0.07), brilloso('#7fd6ff')); resp.position.set(0, 0.9, -0.28); g.add(resp);
  for (const s of [-0.8, 0.8]) { const p = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.5, 0.55, 2, 0.05), brilloso('#ffffff')); p.position.set(s, 0.25, 0); g.add(p); }
  mundo.caja(x, z, 1, 0.33, y, y + 0.61, rot, { asiento: true });
  return g;
}
