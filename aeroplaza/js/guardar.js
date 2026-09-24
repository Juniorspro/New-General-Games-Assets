/* ============================================================================
   aeroplaza/js/guardar.js — lo que queda en la computadora (localStorage):
   nombre, muñeco, orbes, lo comprado, misiones, discos, casa, opciones y los
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

export const INICIAL = () => ({
  v: 1, idioma: null, nombre: NOMBRES[Math.floor(Math.random() * NOMBRES.length)] + Math.floor(10 + Math.random() * 89),
  A: APARIENCIA_INICIAL(), orbes: 15, tengo: [], misiones: {}, discos: [], casa: [], mejorCarrera: null, estrellas: 0,
  opciones: { musica: 0.7, efectos: 0.8, calidad: 'auto', retro: { pix: 0, trama: 0, niveles: 0, barrido: 0, tubo: 0, aberracion: 0 }, sensCam: 1, invertirY: false, nombres: true, chatVisible: true, reloj24: true },
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

/* el id de la red: fijo por computadora, aparte del guardado (no se borra al reiniciar el juego) */
export function miId() {
  let id = leer('aeroplaza_id');
  if (!id) { id = idNuevo(); escribir('aeroplaza_id', id); }
  return id;
}
