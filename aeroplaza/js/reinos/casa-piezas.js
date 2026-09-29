/* ============================================================================
   aeroplaza/js/reinos/casa-piezas.js — (vuelta 48) LAS PIEZAS PARA CONSTRUIR
   LA CASA ("agregá mejores decoraciones y un sistema de construcción"):
   - Obra: paredes (lisa, con ventana, con puerta, media), baranda de vidrio,
     columna, pisos (liso y damero), plataforma (se sube caminando), tarima con
     su escalera (el segundo nivel) y techo.
   - Muebles y deco nuevas, todas Frutiger Aero: computadora de vidrio, cocina,
     heladera, piano, arcade, bañera con burbujas, cuadro y reloj de pared (que
     da la hora de verdad), espejo, farol, lámpara burbuja, estrella, cartel de
     neón, flores, cactus, orbe de plasma, burbujero, tótem de agua, globo
     terráqueo, peluche, arco iris, nube y delfín.
   Cada una: una función (c) → [grupo, [ancho, fondo, alto], cajas?]. c es su
   color (las que se pintan). cajas, si está: los choques propios [x, z, ancho,
   fondo, y0, y1] (la puerta se atraviesa por el medio; la escalera, de a
   escalones). Las que se mueven dejan su userData.actualizar(t).
   Las geometrías y los materiales se comparten (una por forma, uno por color):
   después casa.js funde lo quieto por material (una llamada de dibujo por color).
   ========================================================================== */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { brilloso, materialVidrio } from '../naturaleza.js';
import { sumar } from '../textos.js';

sumar({
  es: { ob_obra: "Obra", ob_muebles: "Muebles", ob_deco: "Deco", ob_poner: "Poner", ob_mover: "Mover", ob_pintar: "Pintar", ob_quitar: "Quitar", ob_aca: "Acá", ob_girar: "Girar", ob_deshacer: "Deshacer", ob_techos: "Techos", ob_color_orig: "Su color", ob_ayuda_elegi: "Elegí qué poner, abajo", ob_ayuda_poner: "Tocá el piso para ponerlo", ob_ayuda_mover: "Tocá algo para agarrarlo, y después dónde va", ob_ayuda_pintar: "Elegí un color y tocá lo que querés pintar", ob_ayuda_quitar: "Tocá lo que querés sacar", ob_ayuda_dedo: "un dedo gira · dos mueven y acercan", ob_ayuda_mouse: "arrastrá para girar · rueda para acercar · WASD para moverte", ob_lleno: "Llegaste a {n} cosas: sacá alguna para poner más", ob_fuera: "Solo se construye adentro del patio", ob_sin_vr: "Para construir, salí del VR", ob_hola: "Modo construir: elegí una pieza y tocá el piso", ob_guardada: "Tu casa quedó guardada ({n} cosas)", pz_pared: "Pared", pz_ventana: "Ventana", pz_puerta: "Puerta", pz_media: "Media pared", pz_baranda: "Baranda", pz_columna: "Columna", pz_piso: "Piso", pz_damero: "Damero", pz_plataforma: "Plataforma", pz_tarima: "Tarima", pz_escalera: "Escalera", pz_techo: "Techo", pz_sofa: "Sofá", pz_sillon: "Sillón", pz_cama: "Cama", pz_mesa: "Mesa", pz_silla: "Silla", pz_mesita: "Mesita", pz_escritorio: "Compu", pz_tele: "Tele", pz_cocina: "Cocina", pz_heladera: "Heladera", pz_piano: "Piano", pz_arcade: "Arcade", pz_estante: "Estante", pz_banco: "Banco", pz_puff: "Puf", pz_radio: "Radio", pz_banera: "Bañera", pz_lampara: "Lámpara", pz_planta: "Planta", pz_flores: "Flores", pz_cactus: "Cactus", pz_arbolito: "Arbolito", pz_pecera: "Pecera", pz_fuente: "Fuente", pz_cuadro: "Cuadro", pz_reloj: "Reloj", pz_espejo: "Espejo", pz_farol: "Farol", pz_burbujaLuz: "Luz burbuja", pz_estrella: "Estrella", pz_neon: "Neón", pz_orbe: "Orbe", pz_burbujero: "Burbujero", pz_totem: "Tótem de agua", pz_globoT: "Globo terráqueo", pz_peluche: "Peluche", pz_arcoiris: "Arcoíris", pz_nube: "Nube", pz_delfin: "Delfín", pz_alfombra: "Alfombra", pz_alfombra2: "Alfombra cuadrada", pz_globo: "Globo" },
  en: { ob_obra: "Build", ob_muebles: "Furniture", ob_deco: "Decor", ob_poner: "Place", ob_mover: "Move", ob_pintar: "Paint", ob_quitar: "Remove", ob_aca: "Here", ob_girar: "Rotate", ob_deshacer: "Undo", ob_techos: "Roofs", ob_color_orig: "Its color", ob_ayuda_elegi: "Pick what to place, below", ob_ayuda_poner: "Tap the floor to place it", ob_ayuda_mover: "Tap something to pick it up, then where it goes", ob_ayuda_pintar: "Pick a color and tap what you want to paint", ob_ayuda_quitar: "Tap what you want to remove", ob_ayuda_dedo: "one finger rotates · two move and zoom", ob_ayuda_mouse: "drag to rotate · wheel to zoom · WASD to move", ob_lleno: "You reached {n} things: remove some to place more", ob_fuera: "You can only build inside the patio", ob_sin_vr: "To build, leave VR", ob_hola: "Build mode: pick a piece and tap the floor", ob_guardada: "Your home was saved ({n} things)", pz_pared: "Wall", pz_ventana: "Window", pz_puerta: "Door", pz_media: "Half wall", pz_baranda: "Railing", pz_columna: "Column", pz_piso: "Floor", pz_damero: "Checkered", pz_plataforma: "Platform", pz_tarima: "Stage", pz_escalera: "Stairs", pz_techo: "Roof", pz_sofa: "Sofa", pz_sillon: "Armchair", pz_cama: "Bed", pz_mesa: "Table", pz_silla: "Chair", pz_mesita: "Coffee table", pz_escritorio: "Computer", pz_tele: "TV", pz_cocina: "Kitchen", pz_heladera: "Fridge", pz_piano: "Piano", pz_arcade: "Arcade", pz_estante: "Shelf", pz_banco: "Bench", pz_puff: "Beanbag", pz_radio: "Radio", pz_banera: "Bathtub", pz_lampara: "Lamp", pz_planta: "Plant", pz_flores: "Flowers", pz_cactus: "Cactus", pz_arbolito: "Little tree", pz_pecera: "Fish tank", pz_fuente: "Fountain", pz_cuadro: "Painting", pz_reloj: "Clock", pz_espejo: "Mirror", pz_farol: "Street lamp", pz_burbujaLuz: "Bubble light", pz_estrella: "Star", pz_neon: "Neon sign", pz_orbe: "Orb", pz_burbujero: "Bubble machine", pz_totem: "Water totem", pz_globoT: "Globe", pz_peluche: "Teddy", pz_arcoiris: "Rainbow", pz_nube: "Cloud", pz_delfin: "Dolphin", pz_alfombra: "Rug", pz_alfombra2: "Square rug", pz_globo: "Balloon" },
  pt: { ob_obra: "Obra", ob_muebles: "Móveis", ob_deco: "Decoração", ob_poner: "Colocar", ob_mover: "Mover", ob_pintar: "Pintar", ob_quitar: "Tirar", ob_aca: "Aqui", ob_girar: "Girar", ob_deshacer: "Desfazer", ob_techos: "Tetos", ob_color_orig: "A cor dele", ob_ayuda_elegi: "Escolha o que colocar, embaixo", ob_ayuda_poner: "Toque o chão para colocar", ob_ayuda_mover: "Toque algo para pegar, e depois onde vai", ob_ayuda_pintar: "Escolha uma cor e toque o que quer pintar", ob_ayuda_quitar: "Toque o que quer tirar", ob_ayuda_dedo: "um dedo gira · dois movem e aproximam", ob_ayuda_mouse: "arraste para girar · roda para aproximar · WASD para mover", ob_lleno: "Você chegou a {n} coisas: tire alguma para colocar mais", ob_fuera: "Só dá para construir dentro do pátio", ob_sin_vr: "Para construir, saia do VR", ob_hola: "Modo construir: escolha uma peça e toque o chão", ob_guardada: "Sua casa foi salva ({n} coisas)", pz_pared: "Parede", pz_ventana: "Janela", pz_puerta: "Porta", pz_media: "Meia parede", pz_baranda: "Grade", pz_columna: "Coluna", pz_piso: "Piso", pz_damero: "Xadrez", pz_plataforma: "Plataforma", pz_tarima: "Tablado", pz_escalera: "Escada", pz_techo: "Teto", pz_sofa: "Sofá", pz_sillon: "Poltrona", pz_cama: "Cama", pz_mesa: "Mesa", pz_silla: "Cadeira", pz_mesita: "Mesinha", pz_escritorio: "Computador", pz_tele: "TV", pz_cocina: "Cozinha", pz_heladera: "Geladeira", pz_piano: "Piano", pz_arcade: "Fliperama", pz_estante: "Estante", pz_banco: "Banco", pz_puff: "Pufe", pz_radio: "Rádio", pz_banera: "Banheira", pz_lampara: "Luminária", pz_planta: "Planta", pz_flores: "Flores", pz_cactus: "Cacto", pz_arbolito: "Arvorezinha", pz_pecera: "Aquário", pz_fuente: "Fonte", pz_cuadro: "Quadro", pz_reloj: "Relógio", pz_espejo: "Espelho", pz_farol: "Poste", pz_burbujaLuz: "Luz bolha", pz_estrella: "Estrela", pz_neon: "Neon", pz_orbe: "Orbe", pz_burbujero: "Máquina de bolhas", pz_totem: "Totem de água", pz_globoT: "Globo terrestre", pz_peluche: "Pelúcia", pz_arcoiris: "Arco-íris", pz_nube: "Nuvem", pz_delfin: "Golfinho", pz_alfombra: "Tapete", pz_alfombra2: "Tapete quadrado", pz_globo: "Balão" },
});

const GEO = new Map(), MAT = new Map();
const geo = (k, f) => { let g = GEO.get(k); if (!g) { g = f(); GEO.set(k, g); } return g; };
export const mat = (c, o = {}) => { const k = c + JSON.stringify(o); let m = MAT.get(k); if (!m) { m = brilloso(c, o); MAT.set(k, m); } return m; };
const vidrio = (c = '#dff8ff', op = 0.35) => { const k = 'v' + c + op; let m = MAT.get(k); if (!m) { m = materialVidrio(c, op); MAT.set(k, m); } return m; };
const luz = (c) => { const k = 'l' + c; let m = MAT.get(k); if (!m) { m = new THREE.MeshBasicMaterial({ color: c, toneMapped: false }); MAT.set(k, m); } return m; };
const halo = (c) => { const k = 'h' + c; let m = MAT.get(k); if (!m) { m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }); MAT.set(k, m); } return m; };
const caja = (w, h, d, r = 0.04) => geo(`b${w},${h},${d},${r}`, () => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)));
const cil = (rt, rb, h, n = 20) => geo(`c${rt},${rb},${h},${n}`, () => new THREE.CylinderGeometry(rt, rb, h, n));
const esf = (r, n = 18) => geo(`s${r},${n}`, () => new THREE.SphereGeometry(r, n, Math.max(8, n * 0.7 | 0)));
const tor = (r, t, arco = Math.PI * 2) => geo(`t${r},${t},${arco}`, () => new THREE.TorusGeometry(r, t, 8, 36, arco));
function pieza(g, m, x = 0, y = 0, z = 0, grupo) { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); grupo.add(o); return o; }
/* un dibujo en un lienzo, una vez por clave (los cuadros, el neón, el globo) */
const TEX = new Map();
function textura(k, w, h, dibujar) {
  let t = TEX.get(k); if (t) return t;
  const c = document.createElement('canvas'); c.width = w; c.height = h; dibujar(c.getContext('2d'), w, h);
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; TEX.set(k, t); return t;
}
const conTex = (k, t) => { let m = MAT.get(k); if (!m) { m = new THREE.MeshBasicMaterial({ map: t, toneMapped: false }); MAT.set(k, m); } return m; };

const ALTO = 2.6;   // el alto de las paredes
/* la pared: el cuerpo, un filo celeste arriba y un zócalo */
function pared(c, g, partes) {
  for (const [x, y, w, h] of partes) pieza(caja(w, h, 0.2, 0.03), mat(c, { roughness: 0.35 }), x, y + h / 2, 0, g);
  pieza(caja(2.02, 0.07, 0.24, 0.03), mat('#7fd6ff'), 0, ALTO + 0.02, 0, g);
  pieza(caja(2.02, 0.12, 0.23, 0.02), mat('#ffffff'), 0, 0.06, 0, g);
}

export const PIEZAS = {
  /* ------------------------------------------------ obra */
  pared: { cat: 'obra', ico: '🧱', color: '#f4f8ff', paso: 90, f: (c) => { const g = new THREE.Group(); pared(c, g, [[0, 0, 2, ALTO]]); return [g, [2, 0.2, ALTO]]; } },
  ventana: { cat: 'obra', ico: '🪟', color: '#f4f8ff', paso: 90, f: (c) => {
    const g = new THREE.Group(); pared(c, g, [[0, 0, 2, 0.9], [0, 2.1, 2, 0.5], [-0.8, 0.9, 0.4, 1.2], [0.8, 0.9, 0.4, 1.2]]);
    pieza(caja(1.22, 1.22, 0.04, 0.02), vidrio('#bff0ff', 0.28), 0, 1.5, 0, g);
    pieza(caja(1.26, 0.05, 0.08, 0.02), mat('#ffffff'), 0, 1.5, 0, g); pieza(caja(0.05, 1.26, 0.08, 0.02), mat('#ffffff'), 0, 1.5, 0, g);
    return [g, [2, 0.2, ALTO]];
  } },
  puerta: { cat: 'obra', ico: '🚪', color: '#f4f8ff', paso: 90, f: (c) => {
    const g = new THREE.Group(); pared(c, g, [[-0.75, 0, 0.5, ALTO], [0.75, 0, 0.5, ALTO], [0, 2.1, 1, 0.5]]);
    pieza(caja(1.08, 0.08, 0.26, 0.03), mat('#7fd6ff'), 0, 2.1, 0, g);
    for (const s of [-1, 1]) pieza(caja(0.06, 2.1, 0.26, 0.02), mat('#7fd6ff'), s * 0.5, 1.05, 0, g);
    return [g, [2, 0.2, ALTO], [[-0.75, 0, 0.5, 0.2, 0, ALTO], [0.75, 0, 0.5, 0.2, 0, ALTO], [0, 0, 1, 0.2, 2.1, ALTO]]];
  } },
  media: { cat: 'obra', ico: '▭', color: '#f4f8ff', paso: 90, f: (c) => { const g = new THREE.Group(); pieza(caja(2, 1.1, 0.2, 0.03), mat(c, { roughness: 0.35 }), 0, 0.55, 0, g); pieza(caja(2.04, 0.08, 0.28, 0.03), mat('#7fd6ff'), 0, 1.12, 0, g); return [g, [2, 0.2, 1.1]]; } },
  baranda: { cat: 'obra', ico: '🥅', color: '#7fd6ff', paso: 90, f: (c) => {
    const g = new THREE.Group(); pieza(caja(2, 0.8, 0.04, 0.02), vidrio('#dffaff', 0.3), 0, 0.5, 0, g);
    pieza(caja(2.04, 0.08, 0.1, 0.04), mat(c), 0, 0.95, 0, g); for (const s of [-1, 1]) pieza(cil(0.04, 0.04, 1), mat('#ffffff'), s, 0.5, 0, g);
    return [g, [2, 0.14, 1]];
  } },
  columna: { cat: 'obra', ico: '🏛️', color: '#ffffff', paso: 90, f: (c) => {
    const g = new THREE.Group(); pieza(cil(0.2, 0.22, ALTO - 0.3, 24), mat(c), 0, (ALTO - 0.3) / 2 + 0.15, 0, g);
    pieza(cil(0.3, 0.3, 0.15, 24), mat('#7fd6ff'), 0, 0.075, 0, g); pieza(cil(0.3, 0.3, 0.15, 24), mat('#7fd6ff'), 0, ALTO - 0.075, 0, g);
    return [g, [0.5, 0.5, ALTO]];
  } },
  piso: { cat: 'obra', ico: '⬜', color: '#dff4ff', paso: 90, piso: 0.05, f: (c) => { const g = new THREE.Group(); pieza(caja(2, 0.05, 2, 0.02), mat(c, { roughness: 0.15 }), 0, 0.025, 0, g); return [g, [2, 2, 0]]; } },
  damero: { cat: 'obra', ico: '🏁', color: '#9fd8ff', paso: 90, piso: 0.05, f: (c) => {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) pieza(caja(0.5, 0.05, 0.5, 0.01), (i + j) % 2 ? mat(c, { roughness: 0.15 }) : mat('#ffffff', { roughness: 0.15 }), -0.75 + i * 0.5, 0.025, -0.75 + j * 0.5, g);
    return [g, [2, 2, 0]];
  } },
  plataforma: { cat: 'obra', ico: '🟦', color: '#bfe9ff', paso: 90, piso: 0.4, f: (c) => { const g = new THREE.Group(); pieza(caja(2, 0.4, 2, 0.06), mat(c, { roughness: 0.25 }), 0, 0.2, 0, g); pieza(caja(2.02, 0.05, 2.02, 0.02), mat('#ffffff'), 0, 0.4, 0, g); return [g, [2, 2, 0.4]]; } },
  tarima: { cat: 'obra', ico: '🟪', color: '#d6c8ff', paso: 90, piso: 1.2, f: (c) => {
    const g = new THREE.Group(); pieza(caja(2, 1.2, 2, 0.08), mat(c, { roughness: 0.25 }), 0, 0.6, 0, g); pieza(caja(2.04, 0.06, 2.04, 0.02), mat('#ffffff'), 0, 1.2, 0, g);
    for (let i = 0; i < 3; i++) pieza(caja(2.02, 0.04, 2.02, 0.01), mat('#ffffff', { roughness: 0.4 }), 0, 0.3 + i * 0.3, 0, g);
    return [g, [2, 2, 1.2]];
  } },
  /* los escalones suben hacia +z (con la tarima adelante, se sube a 1,2 m) */
  escalera: { cat: 'obra', ico: '🪜', color: '#ffe8b0', paso: 90, f: (c) => {
    const g = new THREE.Group(), cajas = [];
    for (let i = 0; i < 4; i++) { const h = 0.3 * (i + 1), z = -0.75 + i * 0.5; pieza(caja(1.2, h, 0.5, 0.04), mat(i % 2 ? c : '#ffffff', { roughness: 0.3 }), 0, h / 2, z, g); cajas.push([0, z, 1.2, 0.5, 0, h]); }
    return [g, [1.2, 2, 1.2], cajas];
  } },
  techo: { cat: 'obra', ico: '🔷', color: '#7fd6ff', paso: 90, techo: true, f: (c) => { const g = new THREE.Group(); pieza(caja(2.1, 0.12, 2.1, 0.05), mat(c, { roughness: 0.2 }), 0, ALTO + 0.06, 0, g); pieza(caja(2.14, 0.04, 2.14, 0.02), mat('#ffffff'), 0, ALTO + 0.13, 0, g); return [g, [2, 2, 0]]; } },

  /* ------------------------------------------------ muebles */
  mesita: { cat: 'muebles', ico: '☕', color: '#39d6ff', f: (c) => { const g = new THREE.Group(); pieza(caja(1.2, 0.06, 0.7, 0.03), vidrio('#bff4ff', 0.45), 0, 0.42, 0, g); for (const [x, z] of [[-0.5, -0.25], [0.5, -0.25], [-0.5, 0.25], [0.5, 0.25]]) pieza(cil(0.03, 0.03, 0.4), mat(c), x, 0.2, z, g); pieza(caja(0.9, 0.04, 0.45, 0.02), mat(c), 0, 0.12, 0, g); return [g, [1.2, 0.7, 0.45]]; } },
  escritorio: { cat: 'muebles', ico: '🖥️', color: '#3fc6ff', f: (c) => {
    const g = new THREE.Group(); pieza(caja(1.4, 0.06, 0.7, 0.03), mat('#ffffff'), 0, 0.75, 0, g); for (const s of [-1, 1]) pieza(caja(0.06, 0.72, 0.66, 0.02), mat('#ffffff'), s * 0.66, 0.36, 0, g);
    /* la computadora de vidrio de color, como las de 1999 */
    pieza(esf(0.3, 22), vidrio(c, 0.55), 0, 1.1, -0.05, g).scale.set(1, 0.9, 0.85);
    const p = pieza(caja(0.36, 0.28, 0.02, 0.03), new THREE.MeshBasicMaterial({ color: '#7ff0ff', toneMapped: false }), 0, 1.12, 0.21, g); g.userData.pantalla = p;
    pieza(caja(0.46, 0.03, 0.16, 0.015), mat('#ffffff'), 0, 0.795, 0.2, g);
    return [g, [1.4, 0.7, 1.4]];
  } },
  cocina: { cat: 'muebles', ico: '🍳', color: '#56e05a', f: (c) => {
    const g = new THREE.Group(); pieza(caja(2, 0.84, 0.66, 0.04), mat(c), 0, 0.42, 0, g); pieza(caja(2.06, 0.06, 0.72, 0.03), mat('#ffffff', { roughness: 0.1 }), 0, 0.87, 0, g);
    for (const x of [-0.55, -0.15]) pieza(cil(0.13, 0.13, 0.02, 20), mat('#22262b'), x, 0.91, 0, g);
    pieza(caja(0.5, 0.04, 0.4, 0.02), mat('#9fd8ff', { metalness: 0.6, roughness: 0.1 }), 0.55, 0.9, 0, g); pieza(cil(0.02, 0.02, 0.3, 8), mat('#dfe6ec', { metalness: 0.8 }), 0.55, 1.05, -0.2, g);
    for (let i = 0; i < 4; i++) pieza(caja(0.44, 0.03, 0.02, 0.01), mat('#ffffff'), -0.72 + i * 0.48, 0.7, 0.34, g);
    return [g, [2, 0.7, 0.9]];
  } },
  heladera: { cat: 'muebles', ico: '🧊', color: '#9fe8ff', f: (c) => { const g = new THREE.Group(); pieza(caja(0.8, 1.8, 0.72, 0.14), mat(c, { roughness: 0.2 }), 0, 0.9, 0, g); pieza(caja(0.82, 0.02, 0.74, 0.01), mat('#ffffff'), 0, 1.15, 0, g); for (const y of [0.7, 1.45]) pieza(caja(0.04, 0.3, 0.04, 0.02), mat('#ffffff'), 0.3, y, 0.38, g); return [g, [0.8, 0.72, 1.8]]; } },
  piano: { cat: 'muebles', ico: '🎹', color: '#1d2230', f: (c) => {
    const g = new THREE.Group(); pieza(caja(1.5, 0.35, 1.3, 0.1), mat(c, { roughness: 0.05 }), 0, 0.85, 0, g);
    const tapa = pieza(caja(1.46, 0.03, 1.26, 0.02), mat(c, { roughness: 0.05 }), 0, 1.25, -0.25, g); tapa.rotation.x = -0.5;
    for (const [x, z] of [[-0.62, 0.5], [0.62, 0.5], [0, -0.5]]) pieza(cil(0.05, 0.04, 0.7), mat(c), x, 0.35, z, g);
    pieza(caja(1.3, 0.05, 0.22, 0.01), mat('#ffffff'), 0, 0.98, 0.7, g); for (let i = 0; i < 9; i++) pieza(caja(0.05, 0.03, 0.12, 0.01), mat('#22262b'), -0.52 + i * 0.13, 1.01, 0.66, g);
    return [g, [1.5, 1.5, 1.25]];
  } },
  arcade: { cat: 'muebles', ico: '🕹️', color: '#9b7bff', f: (c) => {
    const g = new THREE.Group(); pieza(caja(0.8, 1.8, 0.7, 0.08), mat(c), 0, 0.9, 0, g); pieza(caja(0.84, 0.3, 0.74, 0.06), luz('#ff6fb0'), 0, 1.72, 0, g);
    const p = pieza(caja(0.6, 0.45, 0.03, 0.03), new THREE.MeshBasicMaterial({ color: '#39d6ff', toneMapped: false }), 0, 1.28, 0.34, g); p.rotation.x = -0.15; g.userData.pantalla = p;
    pieza(caja(0.74, 0.06, 0.3, 0.02), mat('#22262b'), 0, 0.98, 0.42, g); pieza(cil(0.015, 0.015, 0.12, 8), mat('#ffffff'), -0.15, 1.06, 0.45, g); pieza(esf(0.035, 10), luz('#ff4f6e'), -0.15, 1.12, 0.45, g);
    for (const [x, col] of [[0.08, '#ffe14a'], [0.2, '#56e05a']]) pieza(cil(0.03, 0.03, 0.02, 12), luz(col), x, 1.02, 0.45, g);
    return [g, [0.8, 0.8, 1.8]];
  } },
  banco: { cat: 'muebles', ico: '🪑', color: '#ff9a3d', f: (c) => { const g = new THREE.Group(); pieza(caja(1.6, 0.08, 0.45, 0.04), mat(c), 0, 0.45, 0, g); pieza(caja(1.6, 0.35, 0.06, 0.03), mat(c), 0, 0.72, -0.2, g); for (const s of [-1, 1]) pieza(caja(0.06, 0.45, 0.4, 0.02), mat('#ffffff'), s * 0.7, 0.22, 0, g); return [g, [1.6, 0.5, 0.8]]; } },
  banera: { cat: 'muebles', ico: '🛁', color: '#ffffff', f: (c) => {
    const g = new THREE.Group(); pieza(caja(1.7, 0.55, 0.85, 0.2), mat(c, { roughness: 0.1 }), 0, 0.32, 0, g);
    pieza(caja(1.5, 0.04, 0.65, 0.02), vidrio('#6fe0ff', 0.7), 0, 0.55, 0, g);
    const bur = []; for (let i = 0; i < 7; i++) bur.push(pieza(esf(0.08 + (i % 3) * 0.04, 12), vidrio('#ffffff', 0.6), -0.55 + i * 0.18, 0.62, (i % 2 - 0.5) * 0.3, g));
    g.userData.actualizar = (t) => { bur.forEach((b, i) => { b.position.y = 0.6 + Math.abs(Math.sin(t * 1.2 + i)) * 0.08; }); };
    return [g, [1.7, 0.85, 0.6]];
  } },

  /* ------------------------------------------------ deco */
  /* cuadro y reloj van de la pared: con el mismo lugar y giro que una pared, quedan pegados a su frente */
  cuadro: { cat: 'deco', ico: '🖼️', color: '#5fd3ff', pared: true, f: (c) => {
    const g = new THREE.Group(), t = textura('cuadro' + c, 192, 128, (x, w, h) => {
      const cielo = x.createLinearGradient(0, 0, 0, h); cielo.addColorStop(0, c); cielo.addColorStop(0.7, '#e8fbff'); x.fillStyle = cielo; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.arc(w * 0.78, h * 0.25, 14, 0, 7); x.fill();
      x.fillStyle = '#6fe060'; x.beginPath(); x.ellipse(w * 0.3, h * 1.05, w * 0.55, h * 0.4, 0, 0, 7); x.fill();
      x.fillStyle = '#3fbf4f'; x.beginPath(); x.ellipse(w * 0.85, h * 1.1, w * 0.45, h * 0.42, 0, 0, 7); x.fill();
      for (let i = 0; i < 6; i++) { x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 2; x.beginPath(); x.arc(20 + i * 30, 30 + (i % 3) * 18, 4 + (i % 2) * 3, 0, 7); x.stroke(); }
    });
    pieza(caja(1.3, 0.9, 0.05, 0.03), mat('#ffffff'), 0, 1.55, 0.13, g);
    pieza(geo('plCuadro', () => new THREE.PlaneGeometry(1.14, 0.74)), conTex('mc' + c, t), 0, 1.55, 0.16, g);
    return [g, [1.3, 0.1, 0]];
  } },
  reloj: { cat: 'deco', ico: '🕒', color: '#39d6ff', pared: true, f: (c) => {
    const g = new THREE.Group(); pieza(cil(0.32, 0.32, 0.06, 32), mat(c), 0, 1.85, 0.13, g).rotation.x = Math.PI / 2;
    pieza(cil(0.27, 0.27, 0.02, 32), mat('#ffffff'), 0, 1.85, 0.165, g).rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; pieza(caja(0.02, 0.05, 0.01, 0.005), mat('#56606b'), Math.sin(a) * 0.22, 1.85 + Math.cos(a) * 0.22, 0.18, g).rotation.z = -a; }
    const aguja = (l, w) => { const p = new THREE.Group(); p.position.set(0, 1.85, 0.185); pieza(caja(w, l, 0.01, 0.005), mat('#22262b'), 0, l / 2 - 0.02, 0, p); g.add(p); return p; };
    const hh = aguja(0.13, 0.03), mm = aguja(0.2, 0.02);
    g.userData.actualizar = () => { const d = new Date(), m = d.getMinutes() + d.getSeconds() / 60, h = (d.getHours() % 12) + m / 60; mm.rotation.z = -m / 60 * Math.PI * 2; hh.rotation.z = -h / 12 * Math.PI * 2; };
    return [g, [0.7, 0.1, 0]];
  } },
  espejo: { cat: 'deco', ico: '🪞', color: '#ffffff', f: (c) => {
    const g = new THREE.Group(); const m = pieza(cil(0.42, 0.42, 0.05, 32), mat('#e8f6ff', { metalness: 1, roughness: 0.02 }), 0, 1.25, 0, g); m.rotation.x = Math.PI / 2; m.scale.set(0.75, 1, 1.35);
    const b = pieza(tor(0.42, 0.04), mat(c), 0, 1.25, 0, g); b.scale.set(0.75, 1.35, 1);
    pieza(cil(0.25, 0.3, 0.06, 20), mat(c), 0, 0.03, 0, g); pieza(cil(0.03, 0.03, 0.7, 8), mat(c), 0, 0.35, 0, g);
    return [g, [0.7, 0.4, 1.8]];
  } },
  farol: { cat: 'deco', ico: '🏮', color: '#7fd6ff', f: (c) => {
    const g = new THREE.Group(); pieza(cil(0.2, 0.26, 0.1, 20), mat('#ffffff'), 0, 0.05, 0, g); pieza(cil(0.04, 0.05, 2.1, 10), mat(c), 0, 1.1, 0, g);
    pieza(esf(0.22, 18), vidrio('#fff6c8', 0.7), 0, 2.3, 0, g); pieza(esf(0.12, 12), luz('#fff1a8'), 0, 2.3, 0, g); pieza(esf(0.45, 14), halo('#fff0a0'), 0, 2.3, 0, g);
    return [g, [0.4, 0.4, 2.5]];
  } },
  burbujaLuz: { cat: 'deco', ico: '🔮', color: '#5fe0ff', f: (c) => {
    const g = new THREE.Group(), q = new THREE.Group(); g.add(q);
    pieza(esf(0.3, 22), vidrio(c, 0.45), 0, 0, 0, q); pieza(esf(0.14, 14), luz('#ffffff'), 0, 0, 0, q); pieza(esf(0.6, 14), halo(c), 0, 0, 0, q);
    pieza(cil(0.18, 0.22, 0.06, 20), mat('#ffffff'), 0, 0.03, 0, g);
    g.userData.actualizar = (t) => { q.position.y = 1.3 + Math.sin(t * 1.3) * 0.12; };
    q.position.y = 1.3;
    return [g, [0.5, 0.5, 0.1]];
  } },
  estrella: { cat: 'deco', ico: '⭐', color: '#ffe14a', f: (c) => {
    const g = new THREE.Group(), q = new THREE.Group(); q.position.y = 2; g.add(q);
    const forma = geo('estrella', () => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 0.16 : 0.38; if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } return new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 2 }).translate(0, 0, -0.05); });
    pieza(forma, mat(c, { emissive: c, emissiveIntensity: 0.6 }), 0, 0, 0, q); pieza(esf(0.6, 12), halo(c), 0, 0, 0, q);
    g.userData.actualizar = (t) => { q.rotation.y = t * 0.8; q.position.y = 2 + Math.sin(t * 1.1) * 0.08; };
    return [g, [0, 0, 0]];
  } },
  neon: { cat: 'deco', ico: '🪧', color: '#ff6fb0', f: (c) => {
    const g = new THREE.Group(), t = textura('neon' + c, 256, 96, (x, w, h) => { x.fillStyle = '#10131c'; x.fillRect(0, 0, w, h); x.font = '900 58px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = c; x.shadowBlur = 18; x.fillStyle = c; x.fillText('AERO', w / 2, h / 2 + 3); x.shadowBlur = 0; x.fillStyle = '#ffffff'; x.globalAlpha = 0.6; x.fillText('AERO', w / 2, h / 2 + 3); });
    pieza(caja(1.3, 0.52, 0.06, 0.04), mat('#22262b'), 0, 1.5, 0, g); pieza(geo('plNeon', () => new THREE.PlaneGeometry(1.2, 0.45)), conTex('mn' + c, t), 0, 1.5, 0.035, g);
    for (const s of [-1, 1]) pieza(cil(0.025, 0.025, 1.25, 8), mat('#ffffff'), s * 0.5, 0.62, 0, g);
    return [g, [1.3, 0.2, 1.8]];
  } },
  flores: { cat: 'deco', ico: '💐', color: '#ff6fb0', f: (c) => {
    const g = new THREE.Group(); pieza(cil(0.26, 0.2, 0.4, 18), mat('#ffffff'), 0, 0.2, 0, g);
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, r = i ? 0.13 : 0; pieza(cil(0.012, 0.012, 0.5, 5), mat('#3fbf4f'), Math.cos(a) * r * 0.6, 0.6, Math.sin(a) * r * 0.6, g); pieza(esf(0.09, 10), mat(i % 3 === 0 ? '#ffe14a' : i % 3 === 1 ? c : '#ffffff'), Math.cos(a) * r, 0.88 + (i % 2) * 0.06, Math.sin(a) * r, g); }
    return [g, [0.5, 0.5, 1]];
  } },
  cactus: { cat: 'deco', ico: '🌵', color: '#3fbf4f', f: (c) => {
    const g = new THREE.Group(); pieza(cil(0.28, 0.22, 0.35, 18), mat('#ff9a3d'), 0, 0.17, 0, g);
    pieza(geo('cactus', () => new THREE.CapsuleGeometry(0.16, 0.6, 6, 14)), mat(c), 0, 0.75, 0, g);
    for (const s of [-1, 1]) { const b = pieza(geo('cactusB', () => new THREE.CapsuleGeometry(0.08, 0.22, 5, 10)), mat(c), s * 0.2, 0.82 + (s > 0 ? 0.1 : 0), 0, g); b.rotation.z = -s * 0.2; }
    pieza(esf(0.06, 8), mat('#ff6fb0'), 0, 1.16, 0, g);
    return [g, [0.5, 0.5, 1.2]];
  } },
  orbe: { cat: 'deco', ico: '🟣', color: '#b07bff', f: (c) => {
    const g = new THREE.Group(); pieza(cil(0.22, 0.3, 0.35, 20), mat('#22262b', { roughness: 0.1 }), 0, 0.17, 0, g);
    pieza(esf(0.3, 24), vidrio('#e8dcff', 0.25), 0, 0.66, 0, g); const n = pieza(esf(0.08, 12), luz(c), 0, 0.66, 0, g); const h = pieza(esf(0.45, 14), halo(c), 0, 0.66, 0, g);
    g.userData.actualizar = (t) => { const k = 0.8 + Math.sin(t * 5) * 0.2 + Math.sin(t * 13) * 0.08; n.scale.setScalar(k); h.scale.setScalar(0.8 + k * 0.3); };
    return [g, [0.6, 0.6, 1]];
  } },
  burbujero: { cat: 'deco', ico: '🫧', color: '#39d6ff', f: (c) => {
    const g = new THREE.Group(); pieza(caja(0.5, 0.5, 0.5, 0.12), mat(c), 0, 0.25, 0, g); pieza(cil(0.1, 0.12, 0.12, 14), mat('#ffffff'), 0, 0.56, 0, g);
    const bur = []; for (let i = 0; i < 8; i++) bur.push(pieza(esf(0.07 + (i % 3) * 0.04, 12), vidrio('#ffffff', 0.5), 0, 0.6, 0, g));
    g.userData.actualizar = (t) => { bur.forEach((b, i) => { const q = (t * 0.35 + i / 8) % 1; b.position.set(Math.sin(i * 2.3 + t) * 0.3 * q, 0.6 + q * 2.2, Math.cos(i * 1.7 + t) * 0.3 * q); b.scale.setScalar(q < 0.9 ? 1 : (1 - q) * 10); }); };
    return [g, [0.5, 0.5, 0.6]];
  } },
  totem: { cat: 'deco', ico: '💧', color: '#3fe0ff', f: (c) => {
    const g = new THREE.Group(); pieza(cil(0.3, 0.35, 0.15, 24), mat('#ffffff'), 0, 0.075, 0, g); pieza(cil(0.3, 0.3, 0.1, 24), mat('#ffffff'), 0, 1.95, 0, g);
    pieza(cil(0.26, 0.26, 1.75, 24), vidrio(c, 0.5), 0, 1.02, 0, g);
    const bur = []; for (let i = 0; i < 6; i++) bur.push(pieza(esf(0.04 + (i % 2) * 0.03, 10), vidrio('#ffffff', 0.7), 0, 0.2, 0, g));
    g.userData.actualizar = (t) => { bur.forEach((b, i) => { const q = (t * 0.25 + i / 6) % 1; b.position.set(Math.sin(i * 3) * 0.12, 0.2 + q * 1.65, Math.cos(i * 3) * 0.12); }); };
    return [g, [0.7, 0.7, 2]];
  } },
  globoT: { cat: 'deco', ico: '🌍', color: '#2f9bff', f: (c) => {
    const g = new THREE.Group(), t = textura('globo' + c, 128, 64, (x, w, h) => { x.fillStyle = c; x.fillRect(0, 0, w, h); x.fillStyle = '#6fe060'; for (const [a, b, r] of [[20, 20, 12], [40, 34, 9], [70, 22, 14], [95, 40, 10], [110, 18, 7]]) { x.beginPath(); x.ellipse(a, b, r, r * 0.7, a, 0, 7); x.fill(); } });
    pieza(cil(0.2, 0.25, 0.06, 20), mat('#ffffff'), 0, 0.03, 0, g); pieza(cil(0.03, 0.03, 0.6, 8), mat('#ffffff'), 0, 0.33, 0, g);
    const q = pieza(esf(0.32, 24), new THREE.MeshStandardMaterial({ map: t, roughness: 0.3 }), 0, 0.95, 0, g); q.rotation.z = 0.4;
    pieza(tor(0.36, 0.015, Math.PI), mat('#ffe14a'), 0, 0.95, 0, g).rotation.z = Math.PI / 2 + 0.4;
    g.userData.actualizar = (tt) => { q.rotation.y = tt * 0.5; };
    return [g, [0.5, 0.5, 1.3]];
  } },
  peluche: { cat: 'deco', ico: '🧸', color: '#ffb13d', f: (c) => {
    const g = new THREE.Group(); pieza(esf(0.25, 16), mat(c, { roughness: 0.8 }), 0, 0.25, 0, g).scale.set(1, 1.1, 0.9); pieza(esf(0.18, 16), mat(c, { roughness: 0.8 }), 0, 0.6, 0.02, g);
    for (const s of [-1, 1]) { pieza(esf(0.07, 10), mat(c, { roughness: 0.8 }), s * 0.13, 0.75, 0, g); pieza(esf(0.08, 10), mat(c, { roughness: 0.8 }), s * 0.24, 0.3, 0.05, g); pieza(esf(0.025, 8), mat('#22262b'), s * 0.06, 0.63, 0.16, g); }
    pieza(esf(0.07, 10), mat('#ffe6c8', { roughness: 0.8 }), 0, 0.56, 0.16, g);
    return [g, [0.5, 0.4, 0.8]];
  } },
  arcoiris: { cat: 'deco', ico: '🌈', color: '#ff4f6e', f: () => {
    const g = new THREE.Group(); ['#ff4f6e', '#ffb13d', '#ffe14a', '#56e05a', '#39d6ff', '#9b7bff'].forEach((col, i) => pieza(tor(1 - i * 0.07, 0.035, Math.PI), mat(col, { emissive: col, emissiveIntensity: 0.3 }), 0, 0.05, 0, g));
    for (const s of [-1, 1]) pieza(esf(0.22, 12), mat('#ffffff', { roughness: 0.9 }), s * 0.82, 0.1, 0, g);
    return [g, [2, 0.3, 0]];
  } },
  nube: { cat: 'deco', ico: '☁️', color: '#ffffff', f: (c) => { const g = new THREE.Group(); for (const [x, y, r] of [[0, 0.3, 0.35], [-0.35, 0.22, 0.26], [0.35, 0.24, 0.28], [0.1, 0.5, 0.25]]) pieza(esf(r, 16), mat(c, { roughness: 0.9 }), x, y, 0, g); return [g, [1.1, 0.6, 0.6]]; } },
  delfin: { cat: 'deco', ico: '🐬', color: '#39a8ff', f: (c) => {
    const g = new THREE.Group(); pieza(cil(0.35, 0.4, 0.3, 24), mat('#ffffff'), 0, 0.15, 0, g); pieza(cil(0.33, 0.33, 0.06, 24), vidrio('#6fe0ff', 0.7), 0, 0.31, 0, g);
    const d = new THREE.Group(); d.position.set(0, 0.95, 0); d.rotation.z = 0.5; g.add(d);
    pieza(esf(0.2, 18), mat(c, { roughness: 0.15 }), 0, 0, 0, d).scale.set(2.4, 0.9, 0.85); pieza(esf(0.08, 12), mat(c), 0.55, -0.02, 0, d).scale.set(1.6, 0.6, 0.7);
    const aleta = pieza(caja(0.16, 0.2, 0.03, 0.01), mat(c), -0.05, 0.2, 0, d); aleta.rotation.z = -0.5;
    const cola = pieza(caja(0.08, 0.3, 0.03, 0.01), mat(c), -0.52, 0, 0, d); cola.rotation.x = Math.PI / 2;
    pieza(cil(0.025, 0.025, 0.55, 8), mat('#ffffff'), 0, 0.55, 0, g);
    return [g, [0.8, 0.8, 1.3]];
  } },
  alfombra2: { cat: 'deco', ico: '🟨', color: '#ffe14a', f: (c) => { const g = new THREE.Group(); pieza(caja(2, 0.03, 1.4, 0.015), mat(c, { roughness: 0.85 }), 0, 0.015, 0, g); pieza(caja(1.6, 0.035, 1.0, 0.015), mat('#ffffff', { roughness: 0.85 }), 0, 0.02, 0, g); pieza(caja(1.3, 0.04, 0.7, 0.015), mat(c, { roughness: 0.85 }), 0, 0.025, 0, g); return [g, [0, 0, 0]]; } },
};
/* en qué orden salen en el catálogo de construir (las de antes, de casa.js, van mezcladas) */
export const CATALOGO = {
  obra: ['pared', 'ventana', 'puerta', 'media', 'baranda', 'columna', 'piso', 'damero', 'plataforma', 'tarima', 'escalera', 'techo'],
  muebles: ['sofa', 'sillon', 'cama', 'mesa', 'silla', 'mesita', 'escritorio', 'tele', 'cocina', 'heladera', 'piano', 'arcade', 'estante', 'banco', 'puff', 'radio', 'banera', 'lampara'],
  deco: ['planta', 'flores', 'cactus', 'arbolito', 'pecera', 'fuente', 'cuadro', 'reloj', 'espejo', 'farol', 'burbujaLuz', 'estrella', 'neon', 'orbe', 'burbujero', 'totem', 'globoT', 'peluche', 'arcoiris', 'nube', 'delfin', 'alfombra', 'alfombra2', 'globo'],
};
export const EMOJI_VIEJAS = { sofa: '🛋️', sillon: '💺', mesa: '🟫', silla: '🪑', cama: '🛏️', lampara: '💡', planta: '🪴', pecera: '🐠', tele: '📺', alfombra: '⭕', estante: '📚', radio: '📻', puff: '🫘', arbolito: '🌳', fuente: '⛲', globo: '🎈' };
