/* ============================================================================
   motor2d/idioma.js — español, inglés y portugués.
   Cada juego trae sus textos en tablas con las mismas claves por idioma; acá
   se elige cuál vale. La elección se guarda y la próxima vez viene marcada.
   Si nunca se eligió, se propone el idioma del navegador.
   ========================================================================== */

const IDIOMAS = [['es', 'ESPAÑOL'], ['en', 'ENGLISH'], ['pt', 'PORTUGUÊS']];
const Idioma = {
  actual: 'es', clave: null, tablas: { es: {} }, elegido: false,
  iniciar(clave, tablas) {
    this.clave = clave; this.tablas = tablas;
    const g = Guardado.leer(clave, null);
    this.elegido = !!(g && tablas[g]);
    this.actual = this.elegido ? g : this.delNavegador();
  },
  delNavegador() {
    const l = String((navigator.languages && navigator.languages[0]) || navigator.language || 'es').slice(0, 2).toLowerCase();
    return this.tablas[l] ? l : 'es';
  },
  poner(l) { if (!this.tablas[l]) return; this.actual = l; this.elegido = true; Guardado.escribir(this.clave, l); },
  /* una clave de la tabla del idioma; si falta, la del español; si falta, la clave */
  t(k) {
    const T = this.tablas[this.actual];
    if (T && T[k] != null) return T[k];
    const E = this.tablas.es;
    return E && E[k] != null ? E[k] : k;
  },
  /* los textos del DOM marcados con data-t="clave" */
  traducirDOM(raiz) {
    (raiz || document).querySelectorAll('[data-t]').forEach((el) => { el.textContent = this.t(el.dataset.t); delete el.dataset.pxk; });
    document.documentElement.lang = this.actual;
  },
};
/* tr('carta', n, total) → "CARTA 3/19": {0}, {1}… se reemplazan en orden */
function tr(k) {
  let s = String(Idioma.t(k));
  for (let i = 1; i < arguments.length; i++) s = s.split('{' + (i - 1) + '}').join(arguments[i]);
  return s;
}
