// Lo que se guarda en el teléfono (en try: sin localStorage, el juego anda
// igual sin guardar). Lo leído se valida campo por campo.
import { MORFIS, DULCES } from './pieles.js';
import { NIVELES, CAJAS } from './niveles.js';

const CLAVE = 'morfi-1';

export function base() {
  return {
    mejor: NIVELES.map(() => -1),   // las estrellas de cada nivel (-1: todavía no se ganó)
    monedas: 0, morfi: 'kraft', dulce: 'rojo',
    morfis: ['kraft'], dulces: ['rojo'],
    ayudas: [],                     // las ayudas ya vistas
    bonos: [],                      // las cajas que ya dieron el premio de todas las estrellas
    partidas: 0,
    ajustes: { musica: true, sonido: true, vibrar: true, calidad: 'auto', idioma: null },
  };
}

const num = (v, a, b, d) => (Number.isFinite(v) ? Math.max(a, Math.min(b, Math.floor(v))) : d);
const lista = (v, validos, siempre) => [...new Set([...(siempre ? [siempre] : []), ...(Array.isArray(v) ? v.filter((x) => validos.includes(x)) : [])])];

export function validar(d) {
  const b = base();
  if (!d || typeof d !== 'object') return b;
  if (Array.isArray(d.mejor)) b.mejor = NIVELES.map((_, i) => num(d.mejor[i], -1, 3, -1));
  b.monedas = num(d.monedas, 0, 1e9, 0);
  b.morfis = lista(d.morfis, MORFIS.map((p) => p.id), 'kraft');
  b.dulces = lista(d.dulces, DULCES.map((p) => p.id), 'rojo');
  if (b.morfis.includes(d.morfi)) b.morfi = d.morfi;
  if (b.dulces.includes(d.dulce)) b.dulce = d.dulce;
  b.ayudas = lista(d.ayudas, NIVELES.map((n) => n.ayuda).filter(Boolean));
  b.bonos = lista(d.bonos, CAJAS.map((c) => c.id));
  b.partidas = num(d.partidas, 0, 1e9, 0);
  const a = d.ajustes || {};
  for (const k of ['musica', 'sonido', 'vibrar']) if (typeof a[k] === 'boolean') b.ajustes[k] = a[k];
  if (['auto', 'alta', 'baja'].includes(a.calidad)) b.ajustes.calidad = a.calidad;
  if (['es', 'en', 'pt'].includes(a.idioma)) b.ajustes.idioma = a.idioma;
  return b;
}

// cuántas estrellas hay en total y en una caja
export const estrellasTotal = (d) => d.mejor.reduce((a, e) => a + Math.max(0, e), 0);
export const estrellasCaja = (d, c) => d.mejor.slice(c * 10, c * 10 + 10).reduce((a, e) => a + Math.max(0, e), 0);
// ¿se puede jugar? La caja se abre con estrellas; adentro, de a uno
export const cajaAbierta = (d, c) => estrellasTotal(d) >= CAJAS[c].estrellas;
export const nivelAbierto = (d, i) => cajaAbierta(d, Math.floor(i / 10)) && (i % 10 === 0 || d.mejor[i - 1] >= 0);

export function cargar() { try { return validar(JSON.parse(localStorage.getItem(CLAVE))); } catch { return base(); } }
export function guardar(d) { try { localStorage.setItem(CLAVE, JSON.stringify(d)); return true; } catch { return false; } }
