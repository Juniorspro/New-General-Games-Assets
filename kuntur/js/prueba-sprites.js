// hoja de prueba: los cuadros de pixel art en plano y los mismos en cubos
import * as THREE from 'three';
import { cuadrosKilla } from './sprites.js';
import { ELENCO, ANIMALES, APU, DECOR } from './elenco.js';
import { inflar, mallaVox } from './vox.js';

export function probarSprites() {
  const cuadros = cuadrosKilla();
  const lista = [];
  const q = new URLSearchParams(location.search);
  if (q.get('elenco')) {
    for (const [n, f] of Object.entries(ELENCO)) for (const i of [0, 1]) lista.push([n + i, f(i)]);
    for (const [n, f] of Object.entries(ANIMALES)) for (const i of [0, 1, 2]) lista.push([n + i, f(i)]);
    lista.push(['pichon0', APU.pichon(0)], ['pichon2', APU.pichon(2)], ['cuerpo', APU.cuerpo(0.9)], ['ala', APU.ala(0.9)], ['cuerpoJ', APU.cuerpo(0.3)]);
    for (const [n, f] of Object.entries(DECOR)) lista.push([n, f(0)], [n + '1', f(1)]);
  } else for (const [n, fr] of Object.entries(cuadros)) fr.forEach((L, i) => lista.push([n + i, L]));
  /* en plano */
  const k = q.get('elenco') ? 3 : 6, porFila = q.get('elenco') ? 12 : 10;
  const cv = document.createElement('canvas');
  const w = Math.max(...lista.map((q) => q[1].w)), h = Math.max(...lista.map((q) => q[1].h));
  cv.width = porFila * (w + 2) * k; cv.height = Math.ceil(lista.length / porFila) * (h + 4) * k;
  const g = cv.getContext('2d'); g.fillStyle = '#6a8a9a'; g.fillRect(0, 0, cv.width, cv.height);
  lista.forEach(([n, L], j) => {
    const ox = (j % porFila) * (w + 2) * k, oy = Math.floor(j / porFila) * (h + 4) * k;
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) { const c = L.p[y * L.w + x]; if (c) { g.fillStyle = c; g.fillRect(ox + x * k, oy + (h - 1 - y) * k, k, k); } }
    g.fillStyle = '#fff'; g.font = '11px monospace'; g.fillText(n, ox + 2, oy + (h + 3) * k);
  });
  window.__hoja = cv.toDataURL();
  /* en cubos */
  const r = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true });
  r.setSize(innerWidth, innerHeight, false);
  const esc = new THREE.Scene(); esc.background = new THREE.Color('#9ab8c8');
  const cam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 100);
  const luz = new THREE.DirectionalLight('#fff4e0', 2.4); luz.position.set(-3, 5, 6); luz.castShadow = true;
  esc.add(luz, new THREE.HemisphereLight('#bcd8ff', '#8a5a3a', 1.1));
  r.shadowMap.enabled = true;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  const elegidos = (new URLSearchParams(location.search).get('ver') || 'quieta0,corre0,corre2,corre4,sube0,cae0,agachada0,colgada0,empuja0,planea0').split(',');
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(40, 10), new THREE.MeshStandardMaterial({ color: '#c8a87a' }));
  piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; esc.add(piso);
  elegidos.forEach((n, i) => {
    const L = lista.find((q) => q[0] === n);
    if (!L) return;
    const geo = mallaVox(inflar(L[1], { grueso: 5, base: 1, k: 0.85, ox: 14 }), 0.038);
    const m = new THREE.Mesh(geo, mat); m.castShadow = true;
    m.position.set((i - (elegidos.length - 1) / 2) * 1.35, 0, 0);
    m.rotation.y = +(new URLSearchParams(location.search).get('giro') || -0.45);
    esc.add(m);
  });
  const dz = +(new URLSearchParams(location.search).get('dist') || 12); cam.position.set(0, 1.6 * dz / 12, dz); cam.lookAt(0, 0.7, 0);
  r.render(esc, cam);
  window.__K = { listo: true };
}
