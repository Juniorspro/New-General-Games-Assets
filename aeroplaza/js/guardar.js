/* ============================================================================
   aeroplaza/js/guardar.js — lo que queda en la computadora (localStorage):
   nombre, muñeco, orbes, joyas, lo comprado, misiones, discos, casa, opciones y los
   controles de dedo. Si el navegador no deja guardar (ventana privada), el
   juego anda igual y se olvida al cerrar.
   ========================================================================== */
import { APARIENCIA_INICIAL } from './meeple.js';

const CLAVE = 'aeroplaza_v1';
const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const escribir = (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } };

function idNuevo() {
  const a = new Uint8Array(6); (crypto.getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => (a[i] = Math.random() * 256)));
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const NOMBRES = ['Burbuja', 'Nube', 'Lima', 'Coral', 'Rocío', 'Brisa', 'Delfi', 'Mora', 'Kiwi', 'Luma', 'Pixel', 'Menta', 'Cielo', 'Gota', 'Bruma', 'Aqua'];

const R90 = Math.PI / 2;
export const CASA_INICIAL = () => [
  ...[-2, 0, 2].flatMap((x) => [{ k: 'piso', x, z: -3, r: 0 }, { k: 'piso', x, z: -1, r: 0 }]),
  { k: 'pared', x: -2, z: -4, r: 0 }, { k: 'ventana', x: 0, z: -4, r: 0 }, { k: 'pared', x: 2, z: -4, r: 0 },
  { k: 'pared', x: -3, z: -3, r: R90 }, { k: 'media', x: -3, z: -1, r: R90 }, { k: 'pared', x: 3, z: -3, r: R90 }, { k: 'media', x: 3, z: -1, r: R90 },
  { k: 'cuadro', x: -2, z: -4, r: 0 }, { k: 'reloj', x: 2, z: -4, r: 0 },
  { k: 'sofa', x: 0, z: -3.2, r: 0, y: 0.05 }, { k: 'alfombra', x: 0, z: -1.5, r: 0, y: 0.05 }, { k: 'mesita', x: 0, z: -1.5, r: 0, y: 0.05 },
  { k: 'lampara', x: -2.2, z: -3.2, r: 0, y: 0.05 }, { k: 'planta', x: 2.2, z: -3.2, r: 0, y: 0.05 },
  { k: 'tele', x: 0, z: 1.5, r: Math.PI }, { k: 'farol', x: -4.5, z: 1.5, r: 0 }, { k: 'burbujero', x: 4.5, z: 1.5, r: 0 }, { k: 'flores', x: -1.5, z: 3, r: 0, c: '#9b7bff' }, { k: 'globo', x: 3, z: 3, r: 0 },
];
export const INICIAL = () => ({
  v: 1, idioma: null, nombre: NOMBRES[Math.floor(Math.random() * NOMBRES.length)] + Math.floor(10 + Math.random() * 89),
  A: APARIENCIA_INICIAL(), orbes: 15, tengo: [], misiones: {}, discos: [],
  /* las joyas (💎): el regalo del día (regalo: la última fecha 'aaaa-mm-dd'), los anuncios con
     premio vistos hoy y los paquetes comprados (uno de bienvenida se compra una sola vez) */
  joyas: 0, regalo: null, anuncios: { dia: null, n: 0, orbes: 0 }, compras: [],
  /* la casa no arranca vacía: un living armado con las piezas de construir (vuelta 48), para que se entienda qué se
     puede hacer: piso, paredes con ventana, un cuadro y un reloj en la pared, muebles, y deco en el patio */
  casa: CASA_INICIAL(), mejorCarrera: null, estrellas: 0,
  opciones: { musica: 0.7, efectos: 0.8, calidad: 'auto', estilo: 'normal', retro: { pix: 0, trama: 0, niveles: 0, barrido: 0, tubo: 0, aberracion: 0, ps1: 0, paleta: 0, vhs: 0 }, sensCam: 1, invertirY: false, nombres: true, chatVisible: true, reloj24: true, giro: 'auto', vrManos: true, vrFps: false, vrSuave: 'media' },
  controles: null, visto: {},
});

export const Guardado = {
  d: null,
  cargar() {
    let d = null;
    try { d = JSON.parse(leer(CLAVE) || 'null'); } catch { d = null; }
    const base = INICIAL();
    this.d = d ? { ...base, ...d, A: { ...base.A, ...(d.A || {}) }, opciones: { ...base.opciones, ...(d.opciones || {}), retro: { ...base.opciones.retro, ...(d.opciones?.retro || {}) } } } : base;
    return this.d;
  },
  guardar() { clearTimeout(this._t); this._t = setTimeout(() => escribir(CLAVE, JSON.stringify(this.d)), 250); },
  ya() { clearTimeout(this._t); escribir(CLAVE, JSON.stringify(this.d)); },
  borrar() { try { localStorage.removeItem(CLAVE); } catch { /* nada */ } this.d = INICIAL(); },
};

/* (vuelta 46) el id nuevo, el de la llave de los amigos (amigos.js): devuelve el de antes si era otro, para
   borrar lo que quedó retenido con ese */
export function cambiarId(id) { const v = leer('aeroplaza_id'); if (v !== id) escribir('aeroplaza_id', id); return v && v !== id ? v : null; }
/* el id de la red: fijo por computadora, aparte del guardado (no se borra al reiniciar el juego) */
export function miId() {
  let id = leer('aeroplaza_id');
  if (!id) { id = idNuevo(); escribir('aeroplaza_id', id); }
  return id;
}
