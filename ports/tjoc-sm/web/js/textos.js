/* Textos de la app (es/en/pt) y traducción de los textos del juego (tabla cargada de datos/textos.json). */
export const IDIOMAS = { es: 'Español', en: 'English', pt: 'Português' };
const APP = {
  elegir: ['Elegí el idioma', 'Choose your language', 'Escolha o idioma'],
  cargando: ['Cargando…', 'Loading…', 'Carregando…'],
  aviso: ['Port no oficial para uso personal de «The Joy of Creation: Story Mode» de Nikson. Five Nights at Freddy\'s y sus personajes son de Scott Cawthon.', 'Unofficial personal-use port of "The Joy of Creation: Story Mode" by Nikson. Five Nights at Freddy\'s and its characters belong to Scott Cawthon.', 'Port não oficial para uso pessoal de «The Joy of Creation: Story Mode» de Nikson. Five Nights at Freddy\'s e seus personagens são de Scott Cawthon.'],
  tocar: ['Tocá para empezar', 'Tap to start', 'Toque para começar'],
  pausa: ['Pausa', 'Pause', 'Pausa'],
  editar: ['Mover botones', 'Move buttons', 'Mover botões'],
  listo: ['Listo', 'Done', 'Pronto'],
  restablecer: ['Restablecer', 'Reset', 'Restaurar'],
  sens: ['Sensibilidad', 'Sensitivity', 'Sensibilidade'],
  tam: ['Tamaño de botones', 'Button size', 'Tamanho dos botões'],
  ajustes: ['Ajustes', 'Settings', 'Ajustes'],
  idioma: ['Idioma', 'Language', 'Idioma'],
  volver: ['Volver', 'Back', 'Voltar'],
  arrastra: ['Arrastrá los botones para moverlos', 'Drag the buttons to move them', 'Arraste os botões para movê-los'],
  brillo: ['Brillo', 'Brightness', 'Brilho'],
};
/* Nombres de las teclas en los botones (según el nivel se puede pisar) */
const TECLAS = {
  SpaceBar: ['Espacio', 'Space', 'Espaço'], LeftMouseButton: ['Usar', 'Use', 'Usar'], RightMouseButton: ['Acción', 'Action', 'Ação'],
  F: ['F', 'F', 'F'], X: ['X', 'X', 'X'], Escape: ['Pausa', 'Pause', 'Pausa'], BackSpace: ['Borrar', 'Back', 'Apagar'], E: ['E', 'E', 'E'], Q: ['Q', 'Q', 'Q'],
  LeftShift: ['Correr', 'Run', 'Correr'], LeftControl: ['Agacharse', 'Crouch', 'Agachar'], Enter: ['Enter', 'Enter', 'Enter'], AnyKey: ['Seguir', 'Continue', 'Continuar'],
  W: ['W', 'W', 'W'], A: ['A', 'A', 'A'], S: ['S', 'S', 'S'], D: ['D', 'D', 'D'], C: ['C', 'C', 'C'], R: ['R', 'R', 'R'], Tab: ['Tab', 'Tab', 'Tab'],
};
/* Etiquetas por nivel (lo que hace cada tecla ahí) */
const POR_NIVEL = {
  SM_Bedroom: { SpaceBar: ['Pararse', 'Stand', 'Levantar'], LeftMouseButton: ['Usar', 'Use', 'Usar'] },
  SM_Cutscene01: { X: ['Saltar', 'Skip', 'Pular'] }, SM_NarrationsBM02: { X: ['Saltar', 'Skip', 'Pular'] },
  SM_Bedroom_Controls: { X: ['Seguir', 'Continue', 'Continuar'], Escape: ['No mostrar', 'Don\'t show', 'Não mostrar'] },
  SM_Bedroom_DeathTips: { X: ['Reintentar', 'Retry', 'Tentar de novo'], Escape: ['Menú', 'Menu', 'Menu'] },
};
let idioma = 'es', tabla = {};
const IDX = { es: 0, en: 1, pt: 2 };
export function ponerIdioma(i) { idioma = IDIOMAS[i] ? i : 'es'; }
export function idiomaActual() { return idioma; }
export function t(k) { const x = APP[k]; return x ? x[IDX[idioma]] : k; }
export function nombreTecla(k, nivel) { const x = POR_NIVEL[nivel]?.[k] || TECLAS[k]; return x ? x[IDX[idioma]] : k; }
export async function cargarTabla(base) { try { tabla = await (await fetch(base + 'textos.json')).json(); } catch { tabla = {}; } }
/* Traduce un texto del juego (inglés original). Conserva mayúsculas si el original las tenía. */
export function traducir(src) {
  if (!src || idioma === 'en') return src;
  const x = tabla[src] || tabla[src.trim()];
  if (!x) return src;
  const r = x[idioma === 'es' ? 0 : 1] || src;
  return src === src.toUpperCase() && /[A-Z]/.test(src) ? r.toUpperCase() : r;
}
