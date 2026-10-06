/* ============================================================================
   barro/js/guardado.js — lo que se guarda en el teléfono: idioma, plata,
   mejoras, colores, número y nombre, medallas y tiempos de cada pista, los
   fantasmas, el Jam del día y los ajustes (con los controles).
   ========================================================================== */
const CLAVE = 'barro.v1';
const BASE = () => ({
  idioma: '', plata: 300, mejoras: { motor: 0, susp: 0, agarre: 0, piloto: 0 },
  equipo: 0, numero: 77, nombre: '',
  medallas: {}, tiempos: {}, fantasmas: {}, jam: {},
  ajustes: { musica: 0.55, efectos: 0.9, vibrar: true, calidad: 2, controles: null },
  vistas: { ayuda: false },
});

function leer() {
  try {
    const d = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    if (!d) return BASE();
    const b = BASE();
    return { ...b, ...d, mejoras: { ...b.mejoras, ...d.mejoras }, ajustes: { ...b.ajustes, ...d.ajustes }, vistas: { ...b.vistas, ...d.vistas } };
  } catch { return BASE(); }
}
export const D = leer();
export function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(D)); } catch { /* lleno o privado: seguimos sin guardar */ }
}
export function borrarTodo() { const b = BASE(); for (const k of Object.keys(D)) delete D[k]; Object.assign(D, b); guardar(); }
