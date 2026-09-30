// Lo que se guarda en el teléfono (en try: sin localStorage, el juego anda
// igual sin guardar). Lo leído se valida campo por campo.
import { GLOBOS, ESCUDOS } from './pieles.js';
import { NIVELES } from './niveles.js';

const CLAVE = 'globo-libre-1';

export function base() {
  return {
    abierto: 0,                 // el nivel más alto que se puede jugar (0 a 29; 30 = pasó todos)
    monedas: 0, globo: 'rojo', escudo: 'blanco',
    globos: ['rojo'], escudos: ['blanco'],
    mejorAltura: 0, partidas: 0,
    ajustes: { musica: true, sonido: true, vibrar: true, sensibilidad: 'media', calidad: 'auto', idioma: null },
  };
}

const num = (v, a, b, d) => (Number.isFinite(v) ? Math.max(a, Math.min(b, Math.floor(v))) : d);
const lista = (v, validos, siempre) => [...new Set([siempre, ...(Array.isArray(v) ? v.filter((x) => validos.includes(x)) : [])])];

export function validar(d) {
  const b = base();
  if (!d || typeof d !== 'object') return b;
  b.abierto = num(d.abierto, 0, NIVELES, 0);
  b.monedas = num(d.monedas, 0, 1e9, 0);
  b.globos = lista(d.globos, GLOBOS.map((p) => p.id), 'rojo');
  b.escudos = lista(d.escudos, ESCUDOS.map((p) => p.id), 'blanco');
  if (b.globos.includes(d.globo)) b.globo = d.globo;
  if (b.escudos.includes(d.escudo)) b.escudo = d.escudo;
  b.mejorAltura = num(d.mejorAltura, 0, 1e9, 0);
  b.partidas = num(d.partidas, 0, 1e9, 0);
  const a = d.ajustes || {};
  for (const k of ['musica', 'sonido', 'vibrar']) if (typeof a[k] === 'boolean') b.ajustes[k] = a[k];
  if (['baja', 'media', 'alta'].includes(a.sensibilidad)) b.ajustes.sensibilidad = a.sensibilidad;
  if (['auto', 'alta', 'baja'].includes(a.calidad)) b.ajustes.calidad = a.calidad;
  if (['es', 'en', 'pt'].includes(a.idioma)) b.ajustes.idioma = a.idioma;
  return b;
}

export function cargar() { try { return validar(JSON.parse(localStorage.getItem(CLAVE))); } catch { return base(); } }
export function guardar(d) { try { localStorage.setItem(CLAVE, JSON.stringify(d)); return true; } catch { return false; } }
