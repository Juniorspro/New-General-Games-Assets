// Lo que se guarda en el teléfono. `localStorage` puede no estar (modo
// privado, archivo abierto de cierta forma) o tirar error: todo va en try y
// el juego anda igual, sin guardar. Lo que se lee se fusiona con los valores
// de base y se valida campo por campo: un guardado viejo o tocado a mano no
// puede romper la partida.
import { PIELES_TIENDA, MEJORAS, NIVEL_MAX } from './catalogo.js';

const CLAVE = 'cripta-neon-1';

export function base() {
  return {
    version: 1,
    monedas: 0,
    estrellas: {},            // id de nivel → mejor cantidad (0-3)
    hechos: {},               // id de nivel → true
    chispas: {},              // id de nivel → mejor porcentaje
    pieles: ['lu'],
    piel: 'lu',
    mejoras: Object.fromEntries(MEJORAS.map((m) => [m, 0])),
    torre: { record: 0, partidas: 0 },
    ajustes: { musica: true, sonido: true, vibrar: true, idioma: null },
    vistos: {},               // carteles del principio ya mostrados
  };
}

const num = (v, a, b, def) => (Number.isFinite(v) ? Math.max(a, Math.min(b, Math.floor(v))) : def);
const bool = (v, def) => (typeof v === 'boolean' ? v : def);

export function validar(d) {
  const b = base();
  if (!d || typeof d !== 'object') return b;
  b.monedas = num(d.monedas, 0, 9999999, 0);
  for (const k of ['estrellas', 'chispas']) if (d[k] && typeof d[k] === 'object') for (const [id, v] of Object.entries(d[k])) if (/^\d-\d+$/.test(id)) b[k][id] = num(v, 0, k === 'estrellas' ? 3 : 100, 0);
  if (d.hechos && typeof d.hechos === 'object') for (const [id, v] of Object.entries(d.hechos)) if (/^\d-\d+$/.test(id) && v === true) b.hechos[id] = true;
  const validas = new Set(PIELES_TIENDA.map((p) => p.id));
  if (Array.isArray(d.pieles)) b.pieles = [...new Set(['lu', ...d.pieles.filter((p) => validas.has(p))])];
  b.piel = b.pieles.includes(d.piel) ? d.piel : 'lu';
  if (d.mejoras && typeof d.mejoras === 'object') for (const m of MEJORAS) b.mejoras[m] = num(d.mejoras[m], 0, NIVEL_MAX, 0);
  if (d.torre) { b.torre.record = num(d.torre.record, 0, 999999, 0); b.torre.partidas = num(d.torre.partidas, 0, 999999, 0); }
  if (d.ajustes) {
    b.ajustes.musica = bool(d.ajustes.musica, true);
    b.ajustes.sonido = bool(d.ajustes.sonido, true);
    b.ajustes.vibrar = bool(d.ajustes.vibrar, true);
    b.ajustes.idioma = ['es', 'en', 'pt'].includes(d.ajustes.idioma) ? d.ajustes.idioma : null;
  }
  if (d.vistos && typeof d.vistos === 'object') for (const [k, v] of Object.entries(d.vistos)) if (v === true && /^[a-z_]+$/.test(k)) b.vistos[k] = true;
  return b;
}

export function cargar() {
  try { return validar(JSON.parse(localStorage.getItem(CLAVE))); } catch { return base(); }
}

export function guardar(d) {
  try { localStorage.setItem(CLAVE, JSON.stringify(d)); return true; } catch { return false; }
}

export function borrar() {
  try { localStorage.removeItem(CLAVE); } catch { /* sin guardado no hay nada que borrar */ }
  return base();
}
