// El giro de 90°, al revés que en los juegos apaisados.
//
// EL JUEGO ES VERTICAL, así que con el teléfono parado no se gira nada: ya
// ocupa la pantalla entera. El problema es el teléfono ACOSTADO: el tablero se
// dibuja en 360 de ancho y se escala por el alto, así que en 844×390 queda en
// una franja de 251×390 con celdas de 33 a 46 px (menos de los 44 que pide un
// dedo en la mitad de los niveles). Girándolo −90° el juego se queda "pegado"
// al teléfono como una app que sólo anda vertical: si lo acostás, el juego no
// se acuesta con él, y se juega de costado usando la pantalla entera (390×844
// lógicos, celdas de 51 a 72 px; medido sobre los cuarenta niveles). Sin pantalla completa y sin
// `screen.orientation.lock`, que en la mayoría de los navegadores exige
// pantalla completa y en iPhone no existe.
//
// SOLO EN TELEFONOS: con 560 px o más de alto el juego ya entra con su alto
// mínimo (el mismo 560 de `redimensionar`), así que una tableta acostada lo ve
// derecho y chico no queda. Girarlo ahí sólo obligaría a dar vuelta la tableta.
//
// EL SENTIDO SALE DEL ANGULO DE LA PANTALLA: acostado para un lado se gira −90°
// y para el otro +90°, así la parte de arriba del juego queda siempre del lado
// de arriba del teléfono. Sin el dato (navegadores viejos) se usa −90°.
//
// Todo cálculo con coordenadas de la pantalla pasa por acá. `offsetX/offsetY`
// de un evento ya vienen en coordenadas del elemento girado; lo que NO viene
// girado es `getBoundingClientRect` (sale con el ancho y el alto cambiados).

export const ALTO_MINIMO = 560;

export const GIRO = {
  activo: false,
  signo: -1,                  // −1: rotate(−90deg) · +1: rotate(90deg)
  /** Un punto de la ventana (clientX, clientY) a coordenadas del juego. */
  aLocal(x, y) {
    if (!this.activo) return [x, y];
    return this.signo < 0 ? [innerHeight - y, x] : [y, innerWidth - x];
  },
  /** Un desplazamiento de la ventana a uno del juego. */
  delta(dx, dy) {
    if (!this.activo) return [dx, dy];
    return this.signo < 0 ? [-dy, dx] : [dy, -dx];
  },
  ancho() { return this.activo ? innerHeight : innerWidth; },
  alto() { return this.activo ? innerWidth : innerHeight; },
};

function angulo() {
  const a = screen.orientation && typeof screen.orientation.angle === "number"
    ? screen.orientation.angle : (typeof window.orientation === "number" ? window.orientation : 90);
  return ((a % 360) + 360) % 360;
}

export function aplicarGiro() {
  const tocable = matchMedia("(pointer: coarse)").matches;
  const g = tocable && innerWidth > innerHeight && innerHeight < ALTO_MINIMO;
  const html = document.documentElement, r = document.getElementById("raiz");
  GIRO.activo = g;
  GIRO.signo = angulo() === 270 ? 1 : -1;
  html.classList.toggle("girado", g);
  if (r) {
    r.style.width = g ? innerHeight + "px" : "";
    r.style.height = g ? innerWidth + "px" : "";
    r.style.transform = !g ? ""
      : GIRO.signo < 0 ? `translateY(${innerHeight}px) rotate(-90deg)`
      : `translateX(${innerWidth}px) rotate(90deg)`;
  }
  // Clases y variables en vez de media queries y vw/vh: la ventana y el juego
  // ya no miden lo mismo, y una media query sólo sabe de la ventana.
  const an = GIRO.ancho(), al = GIRO.alto();
  html.style.setProperty("--vw", an / 100 + "px");
  html.style.setProperty("--vh", al / 100 + "px");
  html.classList.toggle("bajo", al < 470);
  html.classList.toggle("medio", al >= 470 && al < 700);
}
