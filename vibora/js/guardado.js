// Lo que se guarda en el teléfono (en try: sin localStorage, el juego anda
// igual sin guardar). Lo leído se valida campo por campo.
import { PIELES } from './pieles.js';
import { FONDOS } from './fondos.js';

const CLAVE = 'vibora-io-1';

export function base() {
  return {
    apodo: '', piel: 'lima', fondo: 'colmena', nivelBots: 1,
    mejor: 0, partidas: 0, bajas: 0,
    ajustes: { musica: true, sonido: true, vibrar: true, control: 'flecha', calidad: 'auto', idioma: null, nombres: true },
  };
}

const num = (v, a, b, d) => (Number.isFinite(v) ? Math.max(a, Math.min(b, Math.floor(v))) : d);

export function validar(d) {
  const b = base();
  if (!d || typeof d !== 'object') return b;
  if (typeof d.apodo === 'string') b.apodo = d.apodo.slice(0, 16);
  if (PIELES.some((p) => p.id === d.piel)) b.piel = d.piel;
  if (FONDOS.includes(d.fondo)) b.fondo = d.fondo;
  b.nivelBots = num(d.nivelBots, 0, 2, 1);
  b.mejor = num(d.mejor, 0, 1e9, 0);
  b.partidas = num(d.partidas, 0, 1e9, 0);
  b.bajas = num(d.bajas, 0, 1e9, 0);
  const a = d.ajustes || {};
  for (const k of ['musica', 'sonido', 'vibrar', 'nombres']) if (typeof a[k] === 'boolean') b.ajustes[k] = a[k];
  if (['flecha', 'joystick'].includes(a.control)) b.ajustes.control = a.control;
  if (['auto', 'alta', 'baja'].includes(a.calidad)) b.ajustes.calidad = a.calidad;
  if (['es', 'en', 'pt'].includes(a.idioma)) b.ajustes.idioma = a.idioma;
  return b;
}

export function cargar() { try { return validar(JSON.parse(localStorage.getItem(CLAVE))); } catch { return base(); } }
export function guardar(d) { try { localStorage.setItem(CLAVE, JSON.stringify(d)); return true; } catch { return false; } }
