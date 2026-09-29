// El juego se juega ACOSTADO. Con el teléfono parado (o con la rotación
// trabada, que es como lo tiene mucha gente) todo se dibuja girado 90° dentro
// de #app, y los toques se pasan al sistema girado. Con el teléfono acostado,
// o en una compu, no se gira nada.
//
// El giro es rotate(90deg) translateY(-100%) con origen arriba a la izquierda:
// el punto (x, y) de la app cae en la pantalla en (anchoPantalla − y, x). La
// vuelta: x = clientY, y = anchoPantalla − clientX.
export const pantalla = { girada: false, w: innerWidth, h: innerHeight };

export function medirPantalla(tactil) {
  const P = pantalla;
  P.girada = !!tactil && innerHeight > innerWidth;
  P.w = P.girada ? innerHeight : innerWidth;
  P.h = P.girada ? innerWidth : innerHeight;
  const raiz = document.documentElement;
  raiz.classList.toggle('girada', P.girada);
  // unidades propias: vw y vh del CSS miden la pantalla, no la app girada
  raiz.style.setProperty('--vw', `${P.w / 100}px`);
  raiz.style.setProperty('--vh', `${P.h / 100}px`);
  raiz.classList.toggle('angosta', P.w <= 460);
  raiz.classList.toggle('chata', P.h <= 460);
  const app = document.getElementById('app');
  if (app) { app.style.width = `${P.w}px`; app.style.height = `${P.h}px`; }
  return P;
}

// De coordenadas de la pantalla (clientX/Y) a las de la app.
export function aApp(x, y) { return pantalla.girada ? [y, innerWidth - x] : [x, y]; }

// Pantalla completa y orientación trabada acostada, si el navegador deja (en
// Android sí, dentro del mismo toque; en iPhone no existe y queda el giro).
export function pedirAcostado() {
  const d = document.documentElement;
  try {
    const p = d.requestFullscreen ? d.requestFullscreen({ navigationUI: 'hide' }) : null;
    if (p && p.then) p.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => {});
  } catch { /* sin pantalla completa: queda el giro por CSS */ }
}
