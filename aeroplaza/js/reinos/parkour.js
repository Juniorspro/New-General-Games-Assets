/* ============================================================================
   aeroplaza/js/reinos/parkour.js — el primer minijuego: PARKOUR AERO. Se entra
   por el farol de la Zona de Juegos. Cinco mapas flotantes, cada uno con su
   cielo, su música y sus trampas, de menos a más difícil:
     1. Nubes de Algodón   — escalones de nube, una nube que rebota, nubes que
                             van y vienen, nubes que se deshacen.
     2. Acuario Burbuja    — nenúfares, barras que giran, chorros de burbujas.
     3. Jardín de Cristal  — hojas, pétalos que se caen, flores trampolín, una
                             enredadera que te empuja para atrás, la espiral final.
     4. Ciudad Aurora      — terrazas de noche, cintas de neón de costado, un
                             ascensor, vidrios que se rompen y antenas.
     5. Órbita Aero        — poca gravedad, plataformas en órbita, dos barras a
                             contramano y el trofeo arriba de un planeta de vidrio.
   Reloj que arranca después de 3-2-1, puntos de control (burbujas-aro), caídas
   que te devuelven al último control, orbes para juntar, y al final el tiempo
   con 1 a 3 estrellas y el récord (main.js lo guarda).
   Las plataformas que se mueven son sólidos del mundo que se corren cada cuadro
   y te llevan si estás parado arriba (antesDelJugador).
   ========================================================================== */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Mundo, azar } from '../mundo.js';
import { brilloso, materialVidrio, materialBurbuja, UNI } from '../naturaleza.js';
import { Orbes, Mariposas, Cardumen, Medusas, Burbujas, Chispas } from '../objetos.js';
import { fundir } from '../edificios.js';
import { sumar, t } from '../textos.js';

/* ---------------------------------------------------------------- los mapas */
export const NIVELES = [
  { id: 'nubes', icono: '☁️', musica: 'cielo', cielo: { hora: 0.4, arcoiris: 1, aurora: 0 }, fondo: ['#8fdcff', '#ffffff'], estrellas: [50, 70] },
  { id: 'acuario', icono: '🐠', musica: 'arrecife', cielo: { hora: 0.5, aurora: 0 }, fondo: ['#1fb8e8', '#bff8ff'], estrellas: [65, 90] },
  { id: 'jardin', icono: '🌸', musica: 'bosque', cielo: { hora: 0.3, aurora: 0 }, fondo: ['#9be63a', '#fff6c2'], estrellas: [70, 100] },
  { id: 'ciudad', icono: '🌃', musica: 'ciudad', cielo: { hora: 0.97, aurora: 0.7 }, fondo: ['#1a2a6c', '#ff6fb0'], estrellas: [75, 105] },
  { id: 'orbita', icono: '🪐', musica: 'aurora', cielo: { hora: 0.02, aurora: 1 }, fondo: ['#0b1a4a', '#9b7bff'], estrellas: [85, 120] },
  /* el de los movimientos nuevos: deslizarse, trepar, rebotar en la pared y rodar al caer */
  { id: 'azoteas', icono: '🌇', musica: 'ciudad', cielo: { hora: 0.735, aurora: 0 }, fondo: ['#ff8a5a', '#ffe3b0'], estrellas: [45, 70] },
];
sumar({
  es: {
    pk_titulo: 'PARKOUR AERO', pk_mapas: '6 mapas', pk_elegi: 'Elegí un mapa', pk_bloq: 'Terminá el anterior', pk_mejor: 'Récord {s}', pk_sin: 'Sin tiempo todavía',
    pk_azoteas: 'Azoteas de Vidrio', pk_mov: 'Deslizate con C (⤓), trepá saltando contra un borde, rebotá en las paredes y rodá al caer', pk_nubes: 'Nubes de Algodón', pk_acuario: 'Acuario Burbuja', pk_jardin: 'Jardín de Cristal', pk_ciudad: 'Ciudad Aurora', pk_orbita: 'Órbita Aero',
    pk_ya: '¡YA!', pk_control: '¡Punto de control!', pk_caidas: 'caídas', pk_fin: '¡Llegaste!', pk_tiempo: 'Tiempo', pk_record: '¡Récord nuevo!', pk_siguiente: 'Siguiente mapa', pk_repetir: 'Repetir', pk_volver: 'Volver a la Zona de Juegos', pk_orbes: 'orbes',
    accion_minijuego: 'Entrar a PARKOUR AERO', zona_juegos: 'Zona de Juegos', pk_premio: '+{n} orbes por terminarlo',
  },
  en: {
    pk_titulo: 'AERO PARKOUR', pk_mapas: '6 maps', pk_elegi: 'Pick a map', pk_bloq: 'Finish the previous one', pk_mejor: 'Best {s}', pk_sin: 'No time yet',
    pk_azoteas: 'Glass Rooftops', pk_mov: 'Slide with C (⤓), climb by jumping at a ledge, kick off walls and roll when you land', pk_nubes: 'Cotton Clouds', pk_acuario: 'Bubble Aquarium', pk_jardin: 'Crystal Garden', pk_ciudad: 'Aurora City', pk_orbita: 'Aero Orbit',
    pk_ya: 'GO!', pk_control: 'Checkpoint!', pk_caidas: 'falls', pk_fin: 'You made it!', pk_tiempo: 'Time', pk_record: 'New record!', pk_siguiente: 'Next map', pk_repetir: 'Retry', pk_volver: 'Back to the Game Zone', pk_orbes: 'orbs',
    accion_minijuego: 'Enter AERO PARKOUR', zona_juegos: 'Game Zone', pk_premio: '+{n} orbs for finishing',
  },
  pt: {
    pk_titulo: 'PARKOUR AERO', pk_mapas: '6 mapas', pk_elegi: 'Escolha um mapa', pk_bloq: 'Termine o anterior', pk_mejor: 'Recorde {s}', pk_sin: 'Sem tempo ainda',
    pk_azoteas: 'Terraços de Vidro', pk_mov: 'Deslize com C (⤓), escale pulando contra uma borda, quique nas paredes e role ao cair', pk_nubes: 'Nuvens de Algodão', pk_acuario: 'Aquário Bolha', pk_jardin: 'Jardim de Cristal', pk_ciudad: 'Cidade Aurora', pk_orbita: 'Órbita Aero',
    pk_ya: 'JÁ!', pk_control: 'Ponto de controle!', pk_caidas: 'quedas', pk_fin: 'Você chegou!', pk_tiempo: 'Tempo', pk_record: 'Recorde novo!', pk_siguiente: 'Próximo mapa', pk_repetir: 'Repetir', pk_volver: 'Voltar à Zona de Jogos', pk_orbes: 'orbes',
    accion_minijuego: 'Entrar no PARKOUR AERO', zona_juegos: 'Zona de Jogos', pk_premio: '+{n} orbes por terminar',
  },
});
export const formatoTiempo = (s) => { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`; };

/* ---------------------------------------------------------------- la miniatura */
/* un dibujo del juego para el cartel del farol y las cartas del menú. n = -1: la
   de todo el juego (el título y las cinco islitas); 0 a 4: la de cada mapa */
export function miniaturaParkour(n = -1, W = 640, H = 400) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const N = NIVELES[Math.max(0, n)], [c1, c2] = n < 0 ? ['#3fc6ff', '#e8fbff'] : N.fondo;
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  /* rayos de sol */
  g.save(); g.translate(W * 0.78, H * 0.18); g.globalAlpha = 0.18; g.fillStyle = '#ffffff';
  for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.beginPath(); g.moveTo(0, 0); g.lineTo(W, -40); g.lineTo(W, 40); g.fill(); }
  g.restore();
  const r = azar(7 + n * 3);
  /* burbujas */
  for (let i = 0; i < 26; i++) { const x = r() * W, y = r() * H, rr = 4 + r() * 18; g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, rr, 0, 7); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(x - rr * 0.35, y - rr * 0.35, rr * 0.25, 0, 7); g.fill(); }
  /* las plataformas en perspectiva, subiendo hacia el fondo */
  const colPlat = n < 0 ? ['#ffffff', '#8ff0ff', '#9be63a', '#ff6fb0', '#9b7bff', '#ffb07a'] : [[['#ffffff'], ['#43d8cd'], ['#7fe04a'], ['#2a3a7a'], ['#b8a8ff'], ['#ffb07a']][n][0]];
  for (let i = 0; i < 6; i++) {
    const u = i / 5, x = W * (0.12 + u * 0.68) + Math.sin(i * 2.1) * 30, y = H * (0.84 - u * 0.5), w = 120 - u * 60, h = 26 - u * 12;
    const col = colPlat[i % colPlat.length];
    g.fillStyle = 'rgba(0,40,80,0.18)'; g.beginPath(); g.ellipse(x, y + h * 1.4, w * 0.55, h * 0.5, 0, 0, 7); g.fill();
    const gp = g.createLinearGradient(0, y - h, 0, y + h); gp.addColorStop(0, '#ffffff'); gp.addColorStop(0.5, col); gp.addColorStop(1, 'rgba(0,60,110,0.55)');
    g.fillStyle = gp; g.beginPath(); g.roundRect(x - w / 2, y - h / 2, w, h, h / 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.roundRect(x - w / 2 + 6, y - h / 2 + 3, w - 12, h * 0.32, h * 0.2); g.fill();
    if (i === 5) { g.font = `${40 - u * 10}px sans-serif`; g.textAlign = 'center'; g.fillText('🏆', x, y - h); }
  }
  /* el muñeco saltando (una gota de gelatina con ojitos) */
  const mx = W * 0.36, my = H * 0.5;
  const gm = g.createRadialGradient(mx - 8, my - 18, 4, mx, my, 42); gm.addColorStop(0, '#dff8ff'); gm.addColorStop(0.5, '#39c6ff'); gm.addColorStop(1, '#1576c8');
  g.fillStyle = gm; g.beginPath(); g.ellipse(mx, my, 26, 34, -0.3, 0, 7); g.fill();
  g.beginPath(); g.arc(mx + 4, my - 44, 22, 0, 7); g.fill();
  g.fillStyle = '#0d3f6e'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(mx + 4 + s * 8, my - 46, 3.5, 6, 0, 0, 7); g.fill(); }
  g.strokeStyle = '#39c6ff'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(mx - 18, my - 8); g.lineTo(mx - 40, my - 34); g.moveTo(mx + 20, my - 8); g.lineTo(mx + 38, my - 30); g.moveTo(mx - 8, my + 30); g.lineTo(mx - 26, my + 50); g.moveTo(mx + 10, my + 30); g.lineTo(mx + 30, my + 44); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 4; g.beginPath(); g.arc(mx - 56, my + 10, 14, 0.5, 2.6); g.stroke(); g.beginPath(); g.arc(mx - 72, my + 26, 9, 0.5, 2.6); g.stroke();
  /* el título, brilloso */
  const titulo = n < 0 ? t('pk_titulo') : `${N.icono} ${t('pk_' + N.id)}`, fs = n < 0 ? 64 : 44;
  g.font = `900 ${fs}px "Nunito","Arial Rounded MT Bold","Segoe UI",system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const ty = n < 0 ? H * 0.16 : H * 0.14;
  g.lineWidth = 12; g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineJoin = 'round'; g.strokeText(titulo, W / 2, ty);
  const gt = g.createLinearGradient(0, ty - fs / 2, 0, ty + fs / 2); gt.addColorStop(0, '#5fe0ff'); gt.addColorStop(0.5, '#1591d8'); gt.addColorStop(0.52, '#0f6fb8'); gt.addColorStop(1, '#3fb8ff');
  g.fillStyle = gt; g.fillText(titulo, W / 2, ty);
  if (n < 0) { g.font = '900 30px "Nunito","Segoe UI",system-ui,sans-serif'; g.lineWidth = 8; g.strokeText(t('pk_mapas'), W / 2, H * 0.3); g.fillStyle = '#ff5fa2'; g.fillText(t('pk_mapas'), W / 2, H * 0.3); }
  /* el brillo de vidrio arriba */
  const gb = g.createLinearGradient(0, 0, 0, H * 0.45); gb.addColorStop(0, 'rgba(255,255,255,0.5)'); gb.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gb; g.beginPath(); g.roundRect(10, 8, W - 20, H * 0.42, 30); g.fill();
  return c;
}

/* ---------------------------------------------------------------- las piezas */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function texVentanas(neon = '#ffd98a') {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#1b2b5a'; g.fillRect(0, 0, 128, 256);
  const r = azar(5);
  for (let y = 6; y < 256; y += 16) for (let x = 6; x < 128; x += 16) { g.fillStyle = r() < 0.55 ? neon : r() < 0.5 ? '#7fd6ff' : '#2a3f7a'; g.fillRect(x, y, 10, 9); }
  const t0 = new THREE.CanvasTexture(c); t0.wrapS = t0.wrapT = THREE.RepeatWrapping; t0.colorSpace = THREE.SRGBColorSpace; return t0;
}
function texCinta() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#2a0f4a'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#ff5fd0'; g.beginPath(); g.moveTo(8, 50); g.lineTo(32, 18); g.lineTo(56, 50); g.lineTo(44, 50); g.lineTo(32, 34); g.lineTo(20, 50); g.fill();
  const t0 = new THREE.CanvasTexture(c); t0.wrapS = t0.wrapT = THREE.RepeatWrapping; t0.colorSpace = THREE.SRGBColorSpace; return t0;
}

export function crearParkour(ctx, nivel = 0, o = {}) {
  const N = NIVELES[nivel], mundo = new Mundo(() => -500);
  mundo.agua = null; mundo.limite = 400; mundo.sinRejilla = true;
  const g = new THREE.Group(), quieto = new THREE.Group(), r = azar(11 + nivel * 7);
  /* los materiales de este mapa (uno por color: todo lo quieto se funde al final) */
  const MAT = new Map();
  const mat = (k, f) => MAT.get(k) || (MAT.set(k, f()), MAT.get(k));
  const B = (c, o) => mat('b' + c + JSON.stringify(o || {}), () => brilloso(c, o));
  const vidrioP = () => mat('vidrio', () => { const m = materialVidrio('#dff8ff', 0.3); m.side = THREE.DoubleSide; return m; });
  const ventanas = () => mat('ventanas', () => { const tx = texVentanas(); tx.repeat.set(2, 6); return new THREE.MeshStandardMaterial({ map: tx, emissive: '#ffffff', emissiveMap: tx, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.3 }); });
  const movs = [], barras = [], fragiles = [], cintas = [], controles = [], rebotes = [];
  let meta = null, inicio = null, rumboInicio = Math.PI, killY = 0;
  const poner = (geo, m, x, y, z, ry = 0, dondeG = quieto) => { const q = new THREE.Mesh(geo, m); q.position.set(x, y, z); q.rotation.y = ry; q.castShadow = true; q.receiveShadow = true; dondeG.add(q); return q; };

  /* el aspecto de cada tipo de plataforma: devuelve la malla (para las que se mueven) */
  function aspecto(estilo, w, d, alto, redonda, destino) {
    const grupo = new THREE.Group();
    const cuerpo = redonda ? new THREE.CylinderGeometry(w / 2, w / 2 * 0.92, alto, 32) : new RoundedBoxGeometry(w, alto, d, 3, Math.min(0.25, alto / 2 - 0.01, w / 2 - 0.01, d / 2 - 0.01));
    cuerpo.translate(0, -alto / 2, 0);
    const pon = (geo, m, x = 0, y = 0, z = 0) => { const q = new THREE.Mesh(geo, m); q.position.set(x, y, z); q.castShadow = true; q.receiveShadow = true; grupo.add(q); return q; };
    switch (estilo) {
      case 'nube': {
        pon(cuerpo, B('#ffffff', { roughness: 0.45, borde: 0.35 }));
        const bolas = []; const n = Math.round((w + d) * 1.1);
        for (let i = 0; i < n; i++) {
          const a = i / n * Math.PI * 2, rx = (redonda ? w / 2 : w / 2) * 0.95, rz = (redonda ? w / 2 : d / 2) * 0.95, s = 0.45 + r() * 0.5;
          const q = new THREE.SphereGeometry(s, 12, 9); q.translate(Math.cos(a) * rx, -alto * 0.45 + (r() - 0.5) * 0.3, Math.sin(a) * rz); bolas.push(q);
        }
        for (let i = 0; i < 5; i++) { const q = new THREE.SphereGeometry(0.6 + r() * 0.6, 12, 9); q.translate((r() - 0.5) * w * 0.6, -alto - 0.2, (r() - 0.5) * (redonda ? w : d) * 0.6); bolas.push(q); }
        pon(mergeGeometries(bolas), B('#f4fbff', { roughness: 0.5, borde: 0.45 }));
        break;
      }
      case 'nenufar': { pon(cuerpo, B('#43d8cd', { roughness: 0.2, borde: 0.4 })); pon(new THREE.TorusGeometry(w / 2 * 0.96, 0.08, 6, 40).rotateX(Math.PI / 2), B('#ffffff'), 0, -0.02, 0); break; }
      case 'vidrio': { pon(cuerpo, vidrioP()); const aro = redonda ? new THREE.TorusGeometry(w / 2, 0.1, 6, 40).rotateX(Math.PI / 2) : new RoundedBoxGeometry(w + 0.1, 0.12, d + 0.1, 2, 0.05); pon(aro, B('#ffffff', { roughness: 0.15 }), 0, -0.05, 0); break; }
      case 'coral': pon(cuerpo, B('#ff7a8a', { roughness: 0.3, borde: 0.3 })); break;
      case 'hoja': {
        const f = new THREE.Shape(); f.moveTo(0, -d / 2); f.bezierCurveTo(w * 0.62, -d * 0.3, w * 0.62, d * 0.3, 0, d / 2); f.bezierCurveTo(-w * 0.62, d * 0.3, -w * 0.62, -d * 0.3, 0, -d / 2);
        const q = new THREE.ExtrudeGeometry(f, { depth: alto, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 16 }); q.rotateX(Math.PI / 2); q.translate(0, 0, 0);
        pon(q, B('#56c83a', { roughness: 0.25, borde: 0.35 })); pon(new THREE.BoxGeometry(0.1, 0.04, d * 0.9), B('#b6f03a'), 0, 0.02, 0);
        break;
      }
      case 'petalo': pon(cuerpo, B('#ff9ad8', { roughness: 0.3, borde: 0.4 })); break;
      case 'flor': pon(cuerpo, B('#ffe14a', { roughness: 0.3, emissive: '#ff9d00', emissiveIntensity: 0.15 })); break;
      case 'techo': {
        pon(cuerpo, B('#2a3a6a', { roughness: 0.3, borde: 0.25 }));
        const torre = new THREE.BoxGeometry(w * 0.92, 34, d * 0.92); torre.translate(0, -alto - 17, 0); pon(torre, ventanas());
        pon(new RoundedBoxGeometry(w + 0.12, 0.2, d + 0.12, 2, 0.08), B('#7fd6ff', { emissive: '#3fb8ff', emissiveIntensity: 0.8 }), 0, 0, 0);
        break;
      }
      case 'antena': { pon(cuerpo, B('#e8eef4', { metalness: 0.6, roughness: 0.2 })); const p = new THREE.CylinderGeometry(0.12, 0.2, 20, 8); p.translate(0, -alto - 10, 0); pon(p, B('#c8d4de')); pon(new THREE.SphereGeometry(0.2, 10, 8), B('#ff4f6e', { emissive: '#ff2040', emissiveIntensity: 1 }), 0, 0.2, 0); break; }
      case 'cristal': pon(cuerpo, mat('cristal', () => new THREE.MeshPhysicalMaterial({ color: '#c8b8ff', roughness: 0.05, transmission: 0, clearcoat: 1, emissive: '#6f5fff', emissiveIntensity: 0.25, iridescence: 1, iridescenceIOR: 1.4 }))); break;
      case 'asteroide': { const q = new THREE.IcosahedronGeometry(w / 2, 1); q.scale(1, 0.45, (redonda ? 1 : d / w)); q.translate(0, -w * 0.22, 0); pon(q, B('#9a8fd8', { roughness: 0.5, borde: 0.4 })); pon(new THREE.CylinderGeometry(w / 2 * 0.8, w / 2 * 0.8, 0.12, 24), B('#e0d8ff', { roughness: 0.3 }), 0, -0.06, 0); break; }
      default: pon(cuerpo, B('#ffffff'));
    }
    grupo.traverse((q) => { if (q.isMesh && q.material.transparent) { q.castShadow = false; q.renderOrder = 3; } });
    (destino || quieto).add(grupo);
    return grupo;
  }
  /* ------------------------------------------ la API para armar los mapas */
  const P = {
    inicio(x, y, z, rumbo = Math.PI) { inicio = V(x, y + 0.05, z); rumboInicio = rumbo; },
    plat(x, y, z, w, d, estilo, { alto = 0.7, rot = 0 } = {}) {
      const G0 = aspecto(estilo, w, d, alto, false); G0.position.set(x, y, z); G0.rotation.y = rot;
      return mundo.caja(x, z, w / 2, d / 2, y - alto, y, rot, { tipo: estilo === 'nube' ? 'nube' : 'piedra' });
    },
    disco(x, y, z, rr, estilo, { alto = 0.6 } = {}) { const G0 = aspecto(estilo, rr * 2, rr * 2, alto, true); G0.position.set(x, y, z); return mundo.cilindro(x, z, rr * 0.97, y - alto, y); },
    /* se mueve por una ruta (ida y vuelta, o en vuelta si cerrada) en "periodo" segundos */
    movil(ruta, w, d, periodo, estilo, { redonda = false, cerrada = false, alto = 0.6, fase = 0 } = {}) {
      const G0 = aspecto(estilo, w, d, alto, redonda, g);
      const s = redonda ? mundo.cilindro(ruta[0][0], ruta[0][2], w / 2 * 0.97, ruta[0][1] - alto, ruta[0][1]) : mundo.caja(ruta[0][0], ruta[0][2], w / 2, d / 2, ruta[0][1] - alto, ruta[0][1], 0);
      const pts = ruta.map((q) => V(...q)), curva = cerrada ? new THREE.CatmullRomCurve3(pts, true) : null;
      const M = { G0, s, alto, pos: pts[0].clone(), prev: pts[0].clone(), en: (tt) => {
        let u = ((tt / periodo + fase) % 1 + 1) % 1;
        if (curva) return curva.getPointAt(u);
        u = u < 0.5 ? u * 2 : 2 - u * 2; u = u * u * (3 - 2 * u);   // ida y vuelta, frenando en las puntas
        const f = u * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f));
        return pts[i].clone().lerp(pts[i + 1], f - i);
      } };
      movs.push(M); return M;
    },
    /* una barra que gira sobre una plataforma redonda (hay que saltarla) */
    /* alto: a qué altura va (0,72: saltarla; 2,1: no saltar cuando pasa) */
    barra(x, y, z, largo, vel, { dos = false, alto = 0.72, ang0 = null } = {}) {
      const G0 = new THREE.Group(); G0.position.set(x, y, z); g.add(G0);
      const H = alto + 0.6, eje = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, H, 16), B('#ffffff', { roughness: 0.15 })); eje.position.y = H / 2; G0.add(eje);
      const brazo = new THREE.Group(); brazo.position.y = alto; G0.add(brazo);
      const m = B('#ff5f8a', { roughness: 0.15, emissive: '#ff2060', emissiveIntensity: 0.25 });
      for (const s of dos ? [1, -1] : [1]) { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, largo - 0.44, 4, 12), m); b.rotation.z = Math.PI / 2; b.position.x = s * largo / 2; brazo.add(b); const p = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), B('#ffffff')); p.position.x = s * largo; brazo.add(p); }
      mundo.cilindro(x, z, 0.45, y, y + H);
      barras.push({ x, y, z, largo, vel, dos, brazo, alto, ang: ang0 ?? r() * 6, tGolpe: 0 });
    },
    rebote(x, y, z, rr, fuerza, estilo = 'flor') {
      const G0 = aspecto(estilo, rr * 2, rr * 2, 0.5, true, g); G0.position.set(x, y, z);
      const R = { G0, t: 9 };
      mundo.cilindro(x, z, rr * 0.95, y - 0.5, y, { rebote: fuerza, sinTecho: true, alRebotar: () => { R.t = 0; } });
      rebotes.push(R); return R;
    },
    fragil(x, y, z, w, d, estilo) {
      const G0 = aspecto(estilo, w, d, 0.4, false, g); G0.position.set(x, y, z);
      const s = mundo.caja(x, z, w / 2, d / 2, y - 0.4, y, 0); const F = { G0, s, t: -1, y }; fragiles.push(F); return F;
    },
    cinta(x, y, z, w, d, dx, dz, vel) {
      const tx = texCinta(); tx.repeat.set(w / 2, d / 2); tx.rotation = Math.atan2(dx, dz); tx.center.set(0.5, 0.5);
      const m = new THREE.MeshStandardMaterial({ map: tx, emissive: '#ffffff', emissiveMap: tx, emissiveIntensity: 0.8, roughness: 0.3 });
      const q = new THREE.Mesh(new RoundedBoxGeometry(w, 0.5, d, 2, 0.1), m); q.position.set(x, y - 0.25, z); q.receiveShadow = true; g.add(q);
      const s = mundo.caja(x, z, w / 2, d / 2, y - 0.5, y, 0); cintas.push({ s, dx, dz, vel, tx }); return s;
    },
    geiser(x, y, z, empuje, alto) {
      P.disco(x, y, z, 1.4, 'vidrio');
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, alto + 5, 20, 1, true), mat('chorro', () => new THREE.MeshBasicMaterial({ color: '#dffcff', transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide })));
      col.position.set(x, y + (alto + 5) / 2, z); col.renderOrder = 3; g.add(col);
      mundo.cilindro(x, z, 1.3, y - 0.2, y + 0.01, { empuje, empujeAlto: alto, activo: true });
    },
    control(x, y, z) {
      const aro = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.12, 12, 40), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#7fe6ff', emissiveIntensity: 1.2, roughness: 0.1 }));
      aro.position.set(x, y + 1.5, z); g.add(aro);
      const burbuja = new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 16), materialBurbuja(0.8)); burbuja.position.copy(aro.position); burbuja.renderOrder = 3; g.add(burbuja);
      controles.push({ p: V(x, y + 0.05, z), aro, burbuja, activo: false });
    },
    meta(x, y, z) {
      const G0 = new THREE.Group(); G0.position.set(x, y, z); g.add(G0);
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.6, 32), B('#ffffff', { roughness: 0.1 })); ped.position.y = 0.3; G0.add(ped);
      const oro = B('#ffd23f', { metalness: 0.9, roughness: 0.15, emissive: '#ff9d00', emissiveIntensity: 0.25 });
      const copa = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.35, 0], [0.12, 0.2], [0.12, 0.55], [0.6, 0.85], [0.75, 1.5], [0.68, 1.55]].map(([a, b]) => new THREE.Vector2(a, b)), 32), oro); copa.position.y = 0.6; G0.add(copa);
      for (const s of [-1, 1]) { const asa = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 8, 20, Math.PI), oro); asa.position.set(s * 0.75, 1.75, 0); asa.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2; G0.add(asa); }
      const portal = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.16, 12, 60), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffe68a', emissiveIntensity: 1.4 })); portal.position.y = 1.6; G0.add(portal);
      const brillo = new THREE.Mesh(new THREE.CircleGeometry(2.1, 40), new THREE.MeshBasicMaterial({ color: '#fff6c8', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); brillo.position.y = 1.6; G0.add(brillo);
      meta = { p: V(x, y, z), G0, portal, brillo };
    },
    orbes: [],
    orbe(x, y, z) { P.orbes.push([x, y + 0.9, z]); },
    linea(a, b, n) { for (let i = 1; i <= n; i++) { const u = i / (n + 1); P.orbe(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u); } },
    deco(o) { g.add(o); return o; },
    /* un caño bajo de lado a lado: se pasa deslizándose (o, con doble salto, por arriba) */
    tubo(x, y, z, largo, rot = 0, alto = 0.95) {
      const G0 = new THREE.Group(); G0.position.set(x, y, z); G0.rotation.y = rot; quieto.add(G0);
      const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, largo - 0.52, 4, 14), B('#ff9d3a', { roughness: 0.15, emissive: '#ff6a00', emissiveIntensity: 0.3 })); c.rotation.z = Math.PI / 2; c.position.y = alto + 0.26; G0.add(c);
      for (const sx of [-1, 1]) { const q = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, alto + 0.52, 10), B('#ffffff', { roughness: 0.2 })); q.position.set(sx * largo / 2, (alto + 0.52) / 2, 0); G0.add(q); }
      for (let k = 0; k < Math.floor(largo / 1.2); k++) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.22, 14), B('#ffffff', { roughness: 0.2 })); f.rotation.z = Math.PI / 2; f.position.set(-largo / 2 + 0.6 + k * 1.2, alto + 0.26, 0); G0.add(f); }
      mundo.caja(x, z, largo / 2, 0.26, y + alto, y + alto + 0.52, rot);
    },
    /* una pared alta de vidrio con marco blanco, para rebotar */
    muro(x, y, z, largo, alto, rot = 0) {
      const G0 = new THREE.Group(); G0.position.set(x, y, z); G0.rotation.y = rot; g.add(G0);
      const v = new THREE.Mesh(new RoundedBoxGeometry(largo, alto, 0.3, 2, 0.08), vidrioP()); v.position.y = alto / 2 - 0.4; v.renderOrder = 3; G0.add(v);
      const marco = B('#ffffff', { roughness: 0.15 }), M0 = new THREE.Group(); M0.position.copy(G0.position); M0.rotation.copy(G0.rotation); quieto.add(M0);
      for (const [w, h, px, py] of [[largo + 0.2, 0.22, 0, alto - 0.4], [largo + 0.2, 0.22, 0, -0.4], [0.22, alto, -largo / 2, alto / 2 - 0.4], [0.22, alto, largo / 2, alto / 2 - 0.4]]) { const q = new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.36, 2, 0.06), marco); q.position.set(px, py, 0); M0.add(q); }
      const tira = new THREE.Mesh(new THREE.BoxGeometry(largo - 0.3, 0.08, 0.34), B('#43d8cd', { emissive: '#1fb0ea', emissiveIntensity: 0.9 })); tira.position.y = alto * 0.45; M0.add(tira);
      mundo.caja(x, z, largo / 2, 0.18, y - 0.5, y + alto - 0.4, rot);
    },
  };

  /* ------------------------------------------ los cinco mapas */
  const vivos = [];   // lo que se anima de adorno: { f(tt) }
  if (nivel === 0) {
    /* NUBES DE ALGODÓN: aprender a saltar, rebotar y subirse a lo que se mueve */
    P.inicio(0, 30, 3); P.plat(0, 30, 0, 8, 8, 'nube');
    P.plat(0, 30, -8, 4, 4, 'nube'); P.plat(2.2, 30.8, -13, 3.6, 3.6, 'nube'); P.plat(-1, 31.6, -18, 3.6, 3.6, 'nube'); P.plat(1, 32.4, -23, 4, 4, 'nube');
    P.linea([1, 32.4, -23], [1, 32.4, -31], 3);
    P.plat(1, 32.4, -31, 5, 5, 'nube');
    P.rebote(1, 32.2, -37, 1.6, 16, 'nube');
    P.plat(1, 38, -43.5, 6, 6, 'nube'); P.control(1, 38, -43.5);
    P.movil([[1, 38, -51], [9, 38, -51]], 4, 4, 5, 'nube');
    P.plat(14, 38, -56, 4.5, 4.5, 'nube');
    P.movil([[14, 38, -63], [14, 42, -63]], 4, 4, 4.5, 'nube');
    P.plat(14, 42, -70, 5, 5, 'nube');
    for (const [i, [x, z]] of [[10, -75], [6, -79], [10, -83], [6, -87], [8, -92]].entries()) { P.disco(x, 42.5 + i * 0.5, z, 1.5, 'nube'); P.orbe(x, 42.5 + i * 0.5, z); }
    P.plat(8, 45, -98, 5, 5, 'nube'); P.control(8, 45, -98);
    for (let i = 0; i < 5; i++) P.fragil(8 + (i % 2 ? 1.2 : -1.2), 45, -104 - i * 4.4, 2.8, 2.8, 'nube');
    P.plat(8, 45, -128, 4, 4, 'nube');
    P.plat(8, 47, -135.5, 8, 8, 'nube'); P.meta(8, 47, -136);
    killY = 20;
    /* nubes gigantes de fondo y el arcoíris */
    /* nubes de fondo: racimos de bolas (sin tabla), de muchos tamaños */
    const puf = [];
    for (let i = 0; i < 30; i++) {
      let cx = (r() - 0.5) * 240; const cy = 5 + r() * 55, cz = -60 + (r() - 0.5) * 240, s0 = 3 + r() * 6;
      if (Math.abs(cx) < 28 && cy > 20) cx += Math.sign(cx || 1) * 50;
      for (let k = 0; k < 7; k++) { const q = new THREE.SphereGeometry(s0 * (0.6 + r() * 0.6), 14, 10); q.translate(cx + (r() - 0.5) * s0 * 2.6, cy + (r() - 0.3) * s0 * 0.7, cz + (r() - 0.5) * s0 * 1.6); puf.push(q); }
    }
    quieto.add(new THREE.Mesh(mergeGeometries(puf), B('#ffffff', { roughness: 0.6, borde: 0.5, emissive: '#dff4ff', emissiveIntensity: 0.25 })));
  } else if (nivel === 1) {
    /* ACUARIO BURBUJA: nenúfares, barras que giran y chorros de burbujas */
    P.inicio(0, 40, 3); P.plat(0, 40, 0, 7, 7, 'vidrio');
    for (const [x, z, y] of [[0, -7, 40], [3.2, -12, 40], [-1, -17, 40.4], [2, -22, 40.8]]) P.disco(x, y, z, 2, 'nenufar');
    P.linea([2, 40.8, -22], [2, 40, -31], 2);
    P.disco(2, 40, -31, 6, 'nenufar'); P.barra(2, 40, -31, 5.6, 1.5);
    P.plat(2, 40, -40, 4, 4, 'vidrio');
    P.geiser(2, 40, -45, 15, 4);
    P.plat(2, 48, -50.5, 5, 5, 'vidrio'); P.control(2, 48, -50.5);
    P.movil([[2, 48, -57.5], [2, 48, -66]], 3.5, 3.5, 4, 'vidrio');
    P.movil([[-5, 48, -72], [7, 48, -72]], 3.5, 3.5, 5, 'coral');
    P.plat(0, 48, -80, 5, 5, 'vidrio');
    P.disco(0, 48, -88, 5, 'nenufar'); P.barra(0, 48, -88, 4.8, 2);
    P.disco(0, 48, -99, 5, 'nenufar'); P.barra(0, 48, -99, 4.8, -2.3, { dos: true });
    P.plat(0, 48, -107.5, 5, 5, 'vidrio'); P.control(0, 48, -107.5);
    for (const [i, [x, z]] of [[0, -113], [4, -118], [0, -123], [-4, -128]].entries()) { P.rebote(x, 47.4 + i, z, 1.3, 13, 'nenufar'); P.orbe(x, 48 + i, z); }
    P.plat(-4, 53, -135.5, 8, 8, 'vidrio'); P.meta(-4, 53, -136);
    killY = 30;
    const peces = [new Cardumen(g, V(10, 44, -40), { radio: 14, n: 24 }), new Cardumen(g, V(-12, 50, -95), { radio: 12, n: 20, colores: ['#ffffff', '#ffd23f', '#3fd0ff'] }), new Cardumen(g, V(5, 36, -120), { radio: 18, n: 26, vel: -0.2 })];
    const med = new Medusas(g, [[-9, 44, -20, 2.2, 3], [12, 50, -64, 1.8, 2.5], [-10, 52, -110, 2.4, 3], [14, 46, -100, 1.6, 2], [8, 55, -130, 2, 2.5]]);
    const burb = new Burbujas(g, [[0, 25, -60, 120, 0]], { n: 70, alto: 40, tam: [0.3, 1.4] });
    vivos.push((tt, dt) => { for (const c of peces) c.actualizar(dt); med.actualizar(dt); burb.actualizar(dt, null); });
    for (let i = 0; i < 14; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(3 + r() * 6, 32, 20), materialBurbuja(0.7)); b.position.set((r() - 0.5) * 160, 20 + r() * 50, -60 + (r() - 0.5) * 180); if (Math.abs(b.position.x) < 20) b.position.x += 40; b.renderOrder = 3; g.add(b); const f = r() * 6; vivos.push((tt) => { b.position.y += Math.sin(tt * 0.5 + f) * 0.01; }); }
  } else if (nivel === 2) {
    /* JARDÍN DE CRISTAL: hojas, pétalos que se caen, trampolines y la enredadera que empuja */
    P.inicio(0, 25, 3); P.plat(0, 25, 0, 7, 7, 'vidrio');
    for (const [i, [x, z]] of [[0, -7], [4, -11], [0, -15], [-4, -19], [0, -23]].entries()) P.plat(x, 25.8 + i, z, 3.2, 4.4, 'hoja', { alto: 0.3, rot: i * 0.5 });
    for (let i = 0; i < 4; i++) P.fragil(0 + (i % 2 ? 1 : -1), 29.8, -28.5 - i * 3.8, 2.6, 2.6, 'petalo');
    P.rebote(0, 29.6, -45, 2, 17, 'flor');
    P.plat(0, 36, -51.5, 6, 6, 'vidrio'); P.control(0, 36, -51.5);
    P.cinta(0, 36, -61, 3, 13, 0, 1, 2.6); P.linea([0, 36, -56], [0, 36, -66], 3);
    P.plat(0, 36, -70.5, 4, 4, 'vidrio');
    for (let i = 0; i < 3; i++) P.movil([[6, 37, -78], [11, 37, -83], [6, 37, -88], [1, 37, -83]], 3, 3.8, 9, 'hoja', { cerrada: true, fase: i / 3, alto: 0.3 });
    P.plat(12, 37, -92, 5, 5, 'vidrio'); P.control(12, 37, -92);
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 * 1.2, x = 12 + Math.sin(a) * 4.6, z = -101 + Math.cos(a) * 4.6; P.disco(x, 38 + i * 1.05, z, 1.35, i % 2 ? 'petalo' : 'hoja'); if (i % 2) P.orbe(x, 38 + i * 1.05, z); }
    const tallo = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 40, 16), B('#3fb536', { roughness: 0.3 })); tallo.position.set(12, 28, -101); quieto.add(tallo); mundo.cilindro(12, -101, 1.2, 0, 47.5);
    P.disco(12, 48.5, -101, 4.2, 'flor'); P.meta(12, 48.5, -101);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, p = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 10), B('#ff9ad8', { roughness: 0.25 })); p.scale.set(1, 0.25, 0.55); p.position.set(12 + Math.cos(a) * 4.8, 48.3, -101 + Math.sin(a) * 4.8); p.rotation.y = -a; quieto.add(p); }
    killY = 14;
    const mar = new Mariposas(g, [[0, 30, -20, 10], [0, 38, -70, 10], [12, 45, -100, 8]], 30);
    vivos.push((tt, dt, jp) => mar.actualizar(dt, jp));
    /* flores gigantes y la cúpula del invernadero */
    for (let i = 0; i < 12; i++) { const x = (r() - 0.5) * 120, z = -60 + (r() - 0.5) * 140; if (Math.abs(x) < 18) continue; const h = 20 + r() * 25; const st = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, h, 10), B('#3fb536')); st.position.set(x, h / 2 - 5, z); quieto.add(st); const col = ['#ff6fb0', '#ffe14a', '#ffffff', '#9b7bff'][i % 4]; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, p = new THREE.Mesh(new THREE.SphereGeometry(3, 14, 10), B(col, { roughness: 0.3 })); p.scale.set(1, 0.3, 0.55); p.position.set(x + Math.cos(a) * 3, h - 5, z + Math.sin(a) * 3); p.rotation.y = -a; quieto.add(p); } }
    for (let k = 0; k < 10; k++) { const arco = new THREE.Mesh(new THREE.TorusGeometry(90, 0.5, 8, 60, Math.PI), B('#ffffff', { roughness: 0.2 })); arco.rotation.y = k / 10 * Math.PI; arco.position.set(0, -10, -60); quieto.add(arco); }
  } else if (nivel === 3) {
    /* CIUDAD AURORA: terrazas de noche, cintas de neón, ascensor y antenas */
    P.inicio(0, 60, 3); P.plat(0, 60, 0, 10, 10, 'techo');
    P.plat(0, 60, -13, 8, 8, 'techo'); P.linea([0, 60, -5], [0, 60, -9], 1);
    P.plat(4, 61, -25, 7, 7, 'techo'); P.plat(-2, 62, -37, 8, 6, 'techo');
    P.cinta(-2, 62, -47, 3.2, 10, 1, 0, 3.2);
    P.plat(-2, 62, -57.5, 6, 6, 'techo'); P.control(-2, 62, -57.5);
    P.movil([[-2, 62, -65], [-2, 70, -65]], 3.6, 3.6, 5, 'vidrio');
    P.plat(-2, 70, -73, 8, 8, 'techo');
    for (let i = 0; i < 4; i++) P.fragil(-2 + (i % 2 ? 1.1 : -1.1), 70, -80.5 - i * 4.4, 3, 3, 'vidrio');
    P.plat(-2, 70, -104, 5, 5, 'techo');
    P.disco(-2, 70, -113, 6, 'vidrio'); P.barra(-2, 70, -113, 5.8, 1.9, { dos: true });
    P.plat(-2, 70, -123, 5, 5, 'techo'); P.control(-2, 70, -123);
    for (const [i, [x, z]] of [[0, -129], [3, -133], [0, -137], [-3, -141]].entries()) { P.disco(x, 71 + i, z, 1.25, 'antena'); P.orbe(x, 71 + i, z); }
    P.plat(0, 76, -149.5, 8, 8, 'techo'); P.meta(0, 76, -150);
    killY = 46;
    /* la ciudad de abajo: torres con ventanas prendidas y aros de neón */
    const torre = new THREE.BoxGeometry(1, 1, 1); torre.translate(0, 0.5, 0);
    const im = new THREE.InstancedMesh(torre, ventanas(), 60), M4 = new THREE.Matrix4();
    for (let i = 0; i < 60; i++) { let x = (r() - 0.5) * 200, z = -70 + (r() - 0.5) * 220; if (Math.abs(x) < 16) x += Math.sign(x || 1) * 24; const h = 30 + r() * 60, w = 6 + r() * 10; im.setMatrixAt(i, M4.compose(V(x, -10, z), new THREE.Quaternion(), V(w, h, w * (0.7 + r() * 0.5)))); }
    im.computeBoundingSphere(); g.add(im);
    for (let i = 0; i < 8; i++) { const aro = new THREE.Mesh(new THREE.TorusGeometry(4 + r() * 5, 0.15, 8, 60), new THREE.MeshBasicMaterial({ color: ['#ff5fd0', '#3fe0ff', '#ffe14a'][i % 3] })); aro.position.set((r() - 0.5) * 60, 70 + r() * 30, -30 - i * 16); aro.rotation.set(r(), r(), 0); g.add(aro); const v = 0.3 + r() * 0.5; vivos.push((tt) => { aro.rotation.z = tt * v; }); }
  } else if (nivel === 5) {
    /* AZOTEAS DE VIDRIO, al atardecer: el mapa de los movimientos nuevos.
       Deslizarse por debajo de los caños, trepar un borde, caer rodando a una
       terraza de abajo, el pasillo de paredes para rebotar de una a la otra (o
       la plataforma lenta, para quien no se anime), otra caída, la escalera de
       bordes para trepar y los caños del final. */
    P.inicio(0, 60, 3); P.plat(0, 60, -2, 10, 14, 'techo');
    P.tubo(0, 60, -6, 9);
    P.plat(0, 60, -15.5, 8, 7, 'techo'); P.linea([0, 60, -9], [0, 60, -12], 1);
    P.plat(0, 61.4, -21, 8, 3, 'vidrio', { alto: 1.4 });
    P.plat(0, 61.4, -28.5, 8, 12, 'techo'); P.control(0, 61.4, -26);
    P.tubo(0, 61.4, -30.5, 8); P.tubo(0, 61.4, -32.6, 8);
    P.plat(0, 55, -44, 9, 9, 'techo'); P.control(0, 55, -44);
    for (const sx of [-1, 1]) P.muro(sx * 2.5, 55, -55.5, 12, 7, Math.PI / 2);
    P.movil([[0, 54.4, -50.5], [0, 54.4, -60.5]], 2.6, 2.6, 7, 'vidrio');
    for (let i = 0; i < 3; i++) P.orbe(i % 2 ? 1.4 : -1.4, 56.5, -51 - i * 4);
    P.plat(0, 54.5, -66, 7, 8, 'techo'); P.control(0, 54.5, -66);
    P.plat(0, 47, -80, 10, 10, 'techo');
    for (let i = 0; i < 3; i++) P.plat(0, 48.3 + i * 1.3, -86.5 - i * 3, 7, 3, 'vidrio', { alto: 1.3 + i * 1.3 });
    P.plat(0, 50.9, -100, 8, 12, 'techo');
    P.tubo(0, 50.9, -97, 8); P.tubo(0, 50.9, -99.1, 8); P.tubo(0, 50.9, -101.2, 8);
    P.plat(0, 50.9, -110, 8, 8, 'techo'); P.meta(0, 50.9, -110.5);
    killY = 38;
    /* la ciudad al atardecer: torres con ventanas, techos con aparatos y antenas */
    const torre = new THREE.BoxGeometry(1, 1, 1); torre.translate(0, 0.5, 0);
    const im = new THREE.InstancedMesh(torre, ventanas(), 70), M4 = new THREE.Matrix4();
    for (let i = 0; i < 70; i++) { let x = (r() - 0.5) * 220, z = -55 + (r() - 0.5) * 240; if (Math.abs(x) < 14) x += Math.sign(x || 1) * 22; const h = 20 + r() * 55, w = 6 + r() * 10; im.setMatrixAt(i, M4.compose(V(x, 0, z), new THREE.Quaternion(), V(w, h, w * (0.7 + r() * 0.6)))); }
    im.computeBoundingSphere(); g.add(im);
    /* debajo de cada terraza, su edificio (se ve al caer) */
    for (const [x, z, w, d, y] of [[0, -2, 10, 14, 60], [0, -15.5, 8, 7, 60], [0, -28.5, 8, 12, 61.4], [0, -44, 9, 9, 55], [0, -66, 7, 8, 54.5], [0, -80, 10, 10, 47], [0, -100, 8, 12, 50.9], [0, -110, 8, 8, 50.9]]) {
      const q = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, y - 0.7, d * 0.96), ventanas()); q.position.set(x, (y - 0.7) / 2, z); g.add(q);
    }
    for (const [x, y, z] of [[-3.5, 60, 1], [3.6, 61.4, -33.5], [-3.6, 55, -47], [3.6, 47, -83], [-3.3, 50.9, -104]]) {
      const ac = new THREE.Group(); ac.position.set(x, y, z); quieto.add(ac);
      const caja = new THREE.Mesh(new RoundedBoxGeometry(1.4, 0.9, 1.1, 2, 0.12), B('#e8eef4', { metalness: 0.4, roughness: 0.25 })); caja.position.y = 0.45; ac.add(caja);
      const rej = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.06, 20), B('#8a98a6', { metalness: 0.6 })); rej.position.set(0, 0.92, 0); ac.add(rej);
      mundo.caja(x, z, 0.7, 0.55, y - 0.5, y + 0.9);
    }
    for (const [x, y, z] of [[4.2, 60, -8], [-3.8, 55, -40], [3.2, 50.9, -106]]) { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 5, 8), B('#ffffff')); a.position.set(x, y + 2.5, z); quieto.add(a); const lz = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), B('#ff4f6e', { emissive: '#ff2040', emissiveIntensity: 1.5 })); lz.position.set(x, y + 5.1, z); quieto.add(lz); }
  } else if (nivel === 4) {
    /* ÓRBITA AERO: poca gravedad, órbitas, dos barras y el planeta de vidrio */
    mundo.gravedad = 15;
    P.inicio(0, 50, 3); P.disco(0, 50, 0, 5, 'asteroide');
    for (const [i, [x, z]] of [[0, -8], [4, -14], [0, -20], [-4, -26]].entries()) P.movil([[x, 50 + i - 1.2, z], [x, 50 + i + 1.2, z]], 3.2, 3.2, 3.5, 'asteroide', { redonda: true, fase: i * 0.25 });
    for (let i = 0; i < 4; i++) { const pts = []; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; pts.push([Math.cos(a) * 7, 54, -38 + Math.sin(a) * 7]); } P.movil(pts, 3, 3, 12, 'cristal', { cerrada: true, fase: i / 4, redonda: true }); }
    P.plat(0, 55, -50, 5, 5, 'cristal'); P.control(0, 55, -50);
    P.disco(0, 55, -60, 6, 'asteroide'); P.barra(0, 55, -60, 5.8, 1.6); P.barra(0, 55, -60, 5.8, -2.1, { alto: 2.1, ang0: Math.PI / 2 });
    P.geiser(0, 55, -69, 13, 6);
    P.plat(0, 66, -75.5, 5, 5, 'cristal'); P.control(0, 66, -75.5);
    for (let i = 0; i < 6; i++) { const z = -82 - i * 4.2, x = i % 2 ? 1.5 : -1.5; if (i % 2) P.movil([[x - 2, 66, z], [x + 2, 66, z]], 2.6, 2.6, 3, 'cristal', { fase: i * 0.3 }); else P.fragil(x, 66, z, 2.8, 2.8, 'cristal'); }
    for (const [i, [x, z]] of [[0, -110], [3, -114], [-1, -118]].entries()) { P.rebote(x, 66 + i * 1.5, z, 1.3, 12, 'asteroide'); P.orbe(x, 66.5 + i * 1.5, z); }
    const planeta = new THREE.Mesh(new THREE.SphereGeometry(9, 48, 32), materialVidrio('#bfe4ff', 0.35)); planeta.position.set(0, 64, -128); planeta.renderOrder = 3; g.add(planeta);
    const nucleo = new THREE.Mesh(new THREE.SphereGeometry(5, 32, 20), new THREE.MeshStandardMaterial({ color: '#9b7bff', emissive: '#6f4fff', emissiveIntensity: 0.9 })); nucleo.position.copy(planeta.position); g.add(nucleo);
    const anillo = new THREE.Mesh(new THREE.TorusGeometry(14, 0.5, 10, 80), B('#e0d8ff', { emissive: '#8f7fff', emissiveIntensity: 0.4 })); anillo.position.copy(planeta.position); anillo.rotation.x = 1.25; g.add(anillo);
    vivos.push((tt) => { anillo.rotation.z = tt * 0.2; nucleo.rotation.y = tt * 0.3; });
    P.disco(0, 73.2, -128, 3.2, 'cristal'); P.meta(0, 73.2, -128);
    killY = 34;
    for (let i = 0; i < 7; i++) { const l = new THREE.Mesh(new THREE.IcosahedronGeometry(2 + r() * 4, 1), B(['#9a8fd8', '#bfe4ff', '#ff9ad8'][i % 3], { roughness: 0.4 })); const R = 40 + r() * 60, a0 = r() * 6, h = 30 + r() * 50, v = 0.02 + r() * 0.05; g.add(l); vivos.push((tt) => { const a = a0 + tt * v; l.position.set(Math.cos(a) * R, h, -70 + Math.sin(a) * R); l.rotation.y = tt * 0.2; }); }
  }
  g.add(fundir(quieto));
  const orbes = P.orbes.length ? new Orbes(g, P.orbes) : null;
  const chispas = new Chispas(g, '#ffffff', 120);

  /* ------------------------------------------ el estado de la carrera */
  const E = { nivel, id: N.id, nombre: t('pk_' + N.id), fase: 'cuenta', cuenta: 3.4, tiempo: 0, caidas: 0, control: inicio.clone(), rumbo: rumboInicio, eventos: [], total: controles.length };
  let tt = 0;
  for (const M of movs) { const p0 = M.en(0); M.G0.position.copy(p0); M.prev.copy(p0); }
  return {
    primeraPersona: !!o.fp,   // (el botón 👁 del menú: como Mirror's Edge, con los brazos y las piernas)
    id: 'parkour', nivel, mundo, grupo: g, inicio, rumboInicio, musica: N.musica, cielo: { ...N.cielo, nubes: nivel >= 3 ? 0 : 1 },
    orbes, discos: [], npcs: [], parkour: E, sinZonas: true,
    /* antes de mover al muñeco: las plataformas se corren y lo llevan; las barras lo empujan */
    antesDelJugador(dt, yo) {
      tt += dt;
      if (E.fase === 'cuenta') { E.cuenta -= dt; yo.p.copy(inicio); yo.v.set(0, 0, 0); yo.rumbo = rumboInicio; if (E.cuenta <= 0) { E.fase = 'corre'; E.eventos.push({ tipo: 'ya' }); } }
      else if (E.fase === 'corre') E.tiempo += dt;
      for (const M of movs) {
        const p = M.en(tt), d = p.clone().sub(M.prev);
        M.s.x = p.x; M.s.z = p.z; M.s.y1 = p.y; M.s.y0 = p.y - M.alto;
        M.G0.position.copy(p);
        if (yo.pisando === M.s && yo.enPiso) yo.p.add(d);
        M.prev.copy(p);
      }
      for (const C of cintas) { C.tx.offset.y -= C.vel * dt * 0.5; if (yo.pisando === C.s && yo.enPiso) { yo.p.x += C.dx * C.vel * dt; yo.p.z += C.dz * C.vel * dt; } }
      for (const F of fragiles) {
        if (F.t < 0 && yo.pisando === F.s && yo.enPiso) F.t = 0;
        if (F.t >= 0) {
          F.t += dt;
          if (F.t < 0.7) { F.G0.position.x = F.s.x + Math.sin(F.t * 60) * 0.06; F.G0.position.y = F.y - F.t * 0.1; }
          else if (F.t < 3.6) { if (!F.s.fantasma) { F.s.fantasma = true; F.G0.visible = false; chispas.soltar(V(F.s.x, F.y, F.s.z), 16, 3); } }
          else { F.s.fantasma = false; F.G0.visible = true; F.G0.position.set(F.s.x, F.y, F.s.z); F.t = -1; }
        }
      }
      for (const Bb of barras) {
        Bb.ang += Bb.vel * dt; Bb.brazo.rotation.y = Bb.ang; Bb.tGolpe -= dt;
        if (Bb.tGolpe > 0 || !Bb.vel) continue;
        const dx = yo.p.x - Bb.x, dz = yo.p.z - Bb.z, dy = yo.p.y - Bb.y;
        /* le pega si la barra cruza el cuerpo (de los pies a 1,3 m) */
        if (dy > Bb.alto + 0.05 || dy + 1.3 < Bb.alto - 0.2) continue;
        for (const s of Bb.dos ? [1, -1] : [1]) {
          const ax = Math.cos(-Bb.ang) * s, az = Math.sin(-Bb.ang) * s, u = dx * ax + dz * az;
          if (u < 0 || u > Bb.largo + 0.3) continue;
          const perp = dx * -az + dz * ax;
          if (Math.abs(perp) < 0.6) {
            /* el empujón va para donde gira la barra */
            const sg = Math.sign(Bb.vel), f = 6 + Math.abs(Bb.vel) * u * 0.9;
            yo.v.x = az * sg * f; yo.v.z = -ax * sg * f; yo.v.y = 6.5; yo.enPiso = false; Bb.tGolpe = 0.6; E.eventos.push({ tipo: 'golpe' });
          }
        }
      }
      for (const R of rebotes) { R.t += dt; const k = R.t < 1 ? Math.sin(R.t * 16) * Math.exp(-R.t * 4) * 0.3 : 0; R.G0.scale.set(1 + k, 1 - k, 1 + k); }
    },
    actualizar(dt, jp) {
      for (const f of vivos) f(tt, dt, jp);
      chispas.actualizar(dt);
      /* los controles */
      for (const C of controles) {
        C.aro.rotation.y = tt * 1.4; C.burbuja.scale.setScalar(1 + Math.sin(tt * 3) * 0.04);
        if (!C.activo && jp.distanceTo(C.p) < 2 && E.fase === 'corre') {
          C.activo = true; E.control.copy(C.p); C.aro.material.emissive.set('#8fff6a'); chispas.soltar(C.aro.position, 30, 4); E.eventos.push({ tipo: 'control' });
        }
      }
      if (meta) {
        meta.portal.rotation.z = tt * 0.8; meta.brillo.material.opacity = 0.18 + Math.sin(tt * 3) * 0.08; meta.G0.children[1].rotation.y = tt;
        if (E.fase === 'corre' && Math.hypot(jp.x - meta.p.x, jp.z - meta.p.z) < 2.4 && Math.abs(jp.y - meta.p.y) < 3) {
          E.fase = 'fin'; chispas.soltar(meta.p.clone().setY(meta.p.y + 2), 60, 6); E.eventos.push({ tipo: 'meta', tiempo: E.tiempo, caidas: E.caidas });
        }
      }
      /* se cayó: vuelve al último control */
      if (jp.y < killY) E.eventos.push({ tipo: 'caida' });
    },
    /* main.js llama esto cuando hay que volver al último control */
    reaparecer(yo) { E.caidas++; yo.ponerEn(E.control.clone().setY(E.control.y + 0.05), E.rumbo); chispas.soltar(yo.p.clone().setY(yo.p.y + 1), 20, 3); },
    reiniciar(yo) { E.fase = 'cuenta'; E.cuenta = 3.4; E.tiempo = 0; E.caidas = 0; E.control.copy(inicio); for (const C of controles) { C.activo = false; C.aro.material.emissive.set('#7fe6ff'); } yo.ponerEn(inicio, rumboInicio); },
  };
}
