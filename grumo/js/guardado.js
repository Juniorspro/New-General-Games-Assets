// Lo que se guarda en el teléfono (en try: sin localStorage, el juego anda
// igual sin guardar). Lo leído se valida campo por campo.
import { PIELES, SOMBREROS } from './grumo.js';
import { NIVELES, SETS } from './niveles.js';

const CLAVE = 'grumo-1';

export function base() {
  return {
    mejor: NIVELES.map(() => 0),        // las menos tomas en que salió cada escena (0: todavía no)
    unica: [],                          // las escenas que ya dieron el premio de "toma única"
    monedas: 0, piel: 'naranja', sombrero: 'nada',
    pieles: ['naranja'], sombreros: ['nada'],
    tomas: 0,                           // todas las tomas de todas las escenas
    vistos: [],                         // los sets cuyo "set nuevo" ya se anunció
    final: false,
    ajustes: { musica: true, sonido: true, vibrar: true, calidad: 'auto', idioma: null },
  };
}

const num = (v, a, b, d) => (Number.isFinite(v) ? Math.max(a, Math.min(b, Math.floor(v))) : d);
const lista = (v, validos, siempre) => [...new Set([...(siempre ? [siempre] : []), ...(Array.isArray(v) ? v.filter((x) => validos.includes(x)) : [])])];

export function validar(d) {
  const b = base();
  if (!d || typeof d !== 'object') return b;
  if (Array.isArray(d.mejor)) b.mejor = NIVELES.map((_, i) => num(d.mejor[i], 0, 9999, 0));
  b.unica = lista(d.unica, NIVELES.map((n) => n.id));
  b.monedas = num(d.monedas, 0, 1e9, 0);
  b.pieles = lista(d.pieles, PIELES.map((p) => p.id), 'naranja');
  b.sombreros = lista(d.sombreros, SOMBREROS.map((p) => p.id), 'nada');
  if (b.pieles.includes(d.piel)) b.piel = d.piel;
  if (b.sombreros.includes(d.sombrero)) b.sombrero = d.sombrero;
  b.tomas = num(d.tomas, 0, 1e9, 0);
  b.vistos = lista(d.vistos, SETS.map((s) => s.id));
  b.final = d.final === true;
  const a = d.ajustes || {};
  for (const k of ['musica', 'sonido', 'vibrar']) if (typeof a[k] === 'boolean') b.ajustes[k] = a[k];
  if (['auto', 'alta', 'baja'].includes(a.calidad)) b.ajustes.calidad = a.calidad;
  if (['es', 'en', 'pt'].includes(a.idioma)) b.ajustes.idioma = a.idioma;
  return b;
}

export const hecho = (d, i) => d.mejor[i] > 0;
export const hechos = (d) => d.mejor.filter((m) => m > 0).length;
// de a una: cada escena se abre al terminar la anterior (los sets, igual)
export const nivelAbierto = (d, i) => i === 0 || hecho(d, i - 1);
export const setAbierto = (d, s) => nivelAbierto(d, s * 10);
export const setHecho = (d, s) => d.mejor.slice(s * 10, s * 10 + 10).every((m) => m > 0);

// Las bolitas de una escena ganada en `tomas` tomas: la primera vez 20, de
// una sola toma 25 más (una vez), repetirla 5. Terminar un set da 50: con
// todo de una toma alcanza justo para el camarín entero.
export const BONO_SET = 50;
export function premio(d, i, tomas) {
  let n = d.mejor[i] === 0 ? 20 : 5;
  if (tomas === 1 && !d.unica.includes(NIVELES[i].id)) n += 25;
  return n;
}

export function cargar() { try { return validar(JSON.parse(localStorage.getItem(CLAVE))); } catch { return base(); } }
export function guardar(d) { try { localStorage.setItem(CLAVE, JSON.stringify(d)); return true; } catch { return false; } }
