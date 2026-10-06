/* Visor de niveles para revisar la exportación: ?n=SM_LivingRoom */
import * as THREE from 'three';
import { Recursos, armarNivel } from './ue.js';
import { Luces } from './luces.js';
const q = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = +(q.get('exp') || 1.5);
document.body.appendChild(renderer.domElement);
const escena = new THREE.Scene(); escena.background = new THREE.Color(0);
const cam = new THREE.PerspectiveCamera(90, innerWidth / innerHeight, 0.05, 300);
const amb = new THREE.AmbientLight(0xffffff, +(q.get('amb') || 0.02)); escena.add(amb);
const R = new Recursos('datos/', renderer);
const N = await (await fetch('datos/n/' + (q.get('n') || 'SM_LivingRoom') + '.json')).json();
const L = await armarNivel(R, N, { lm: 4 * Math.PI * +(q.get('lm') || 1) });
escena.add(L.raiz);
const luces = new Luces(escena, 6, 3); luces.usar(L.luces);
// cámara inicial: la primera CameraComponent de un jugador
const camNodo = L.nodos.find((o) => o.userData.nodo.tipo === 'CameraComponent' && /Player|Character/.test(N.actores[o.userData.nodo.a].clase));
if (camNodo) { camNodo.getWorldPosition(cam.position); const qq = camNodo.getWorldQuaternion(new THREE.Quaternion()); cam.quaternion.copy(qq).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2)); }
await new Promise((r) => setTimeout(r, 300));
function dibujar() { luces.update(cam.position); renderer.render(escena, cam); }
window.__ver = {
  listo: true, THREE, L, N, cam, escena, renderer, luces, amb, dibujar,
  mirar(p, d) { cam.position.fromArray(p); cam.lookAt(p[0] + d[0], p[1] + d[1], p[2] + d[2]); dibujar(); },
  info() { return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, texs: renderer.info.memory.textures }; },
};
renderer.setAnimationLoop(dibujar);
