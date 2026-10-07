/* El juego acostado: con el celu parado, todo (#raiz) se dibuja girado 90° para jugar de costado, y los toques
   se pasan a las coordenadas del juego. Al tocar JUGAR se pide pantalla completa apaisada (si el navegador deja,
   el giro lo hace el celu y esto no hace falta). */
const tactil = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
export const P = {
  girado: false,
  get W() { return this.girado ? innerHeight : innerWidth; },
  get H() { return this.girado ? innerWidth : innerHeight; },
  xy(cx, cy) { return this.girado ? { x: cy, y: innerWidth - cx } : { x: cx, y: cy }; },
  ev(e) { return this.xy(e.clientX, e.clientY); },
};
export function revisarGiro() {
  const g = tactil && innerHeight > innerWidth;
  if (g !== P.girado) { P.girado = g; document.body.classList.toggle('girado', g); }
  return g;
}
export function completa() {
  if (!tactil || document.fullscreenElement) return;
  try { document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })?.then(() => screen.orientation?.lock?.('landscape')).catch(() => {}); } catch { /* sin pantalla completa */ }
}
revisarGiro();
