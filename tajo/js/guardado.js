// Récords y opciones en localStorage, siempre dentro de try/catch: en una
// ventana privada, o con los datos del sitio bloqueados, leer o escribir TIRA,
// y un juego que no arranca porque no pudo leer un récord es peor que uno que
// se olvida del récord.

const CLAVE = "tajo.v1";

const OPCIONES_BASE = {
  libre: false,          // cualquier sable corta cualquier color
  sinPerder: false,
  lucesSuaves: false,
  ocultarHud: false,
  volMusica: 0.9,
  volEfectos: 0.8,
  calidad: "auto",
  desfaseMs: 0,
  avisoVisto: false,
  dificultad: "normal",
  cancion: 0,
};

function leer() {
  try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch (e) { return {}; }
}

function escribir(d) {
  try { localStorage.setItem(CLAVE, JSON.stringify(d)); return true; } catch (e) { return false; }
}

export function opciones() { return { ...OPCIONES_BASE, ...(leer().opciones || {}) }; }

export function guardarOpciones(o) { const d = leer(); d.opciones = { ...opciones(), ...o }; escribir(d); }

export function record(idCancion, idDificultad) {
  return (leer().records || {})[`${idCancion}|${idDificultad}`] || null;
}

/** Devuelve true si es récord nuevo. */
export function anotar(idCancion, idDificultad, est) {
  const d = leer();
  d.records = d.records || {};
  const k = `${idCancion}|${idDificultad}`;
  const viejo = d.records[k];
  if (est.perdio) return false;
  if (!viejo || est.puntos > viejo.puntos) {
    d.records[k] = { puntos: est.puntos, rango: est.rango, precision: est.precision, comboMax: est.comboMax, fecha: Date.now() };
    escribir(d);
    return true;
  }
  return false;
}
