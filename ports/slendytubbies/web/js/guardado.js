/* Lo que se guarda en el teléfono: idioma, ajustes, controles y récords. */
const CLAVE = 'slendy.v1';
const FABRICA = () => ({
  idioma: null,
  ajustes: { sens: 1, invertir: false, brillo: 1, calidad: null, volumen: 0.9, vibrar: true, controles: null },
  colores: {}, nombre: '',
});
function leer() {
  try {
    const d = JSON.parse(localStorage.getItem(CLAVE));
    if (d && typeof d === 'object') { const f = FABRICA(); return { ...f, ...d, ajustes: { ...f.ajustes, ...(d.ajustes || {}) } }; }
  } catch { /* sin guardado */ }
  return FABRICA();
}
export const D = leer();
export function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(D)); } catch { /* sin espacio o bloqueado */ } }
