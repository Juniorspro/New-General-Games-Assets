/* ============================================================================
   aeroplaza/js/reinos/tienda.js — adentro de Aero·Mart: piso de baldosas
   verdes y blancas, caños verdes brillosos por el techo, vitrinas con cosas
   girando en pedestales de luz y Menta atrás del mostrador.
   ========================================================================== */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Mundo } from '../mundo.js';
import { brilloso, materialVidrio } from '../naturaleza.js';
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
    actualizar(dt) { t += dt; pedestales.forEach((p, i) => { p.m.raiz.rotation.y += dt * 0.8; p.m.animar(dt, 'quieto', 0); }); },
  };
}
